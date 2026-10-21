# The `status = 'open'` sweep — one more place it bites, and it is the read path

From Deveen, answering §12's third ask ("the `status = 'open'` pattern may
exist elsewhere"). Also covers the RPC review and the missing CI test.

## Plain-English summary

You asked me to check whether the 1 October bug shape exists anywhere else. It
does, in one place: **when a Bloc's month close is skipped, the app actively
shows members an empty new month instead of their real, unrolled old one.**
That is the "StavanGang looked like it had reset" symptom from §12 — not a
side effect of the missing snapshot, but a separate bug in the read path.

It is latent right now because nothing is skipping. It matters because the skip
is supposed to be the *safe* outcome, and today a safe skip still shows members
a wiped month.

## 1. Your new RPC — reviewed, correct

`read_ante_core_logs_for_month` diffed against `read_ante_core_current_logs`,
bodies only. The only differences are the intended ones:

| Difference | Verdict |
|---|---|
| `s.month_key = p_month_key` instead of `s.status = 'open'` | The fix. Correct. |
| `wl.moderation_hidden_at is null` | Matches production's sibling. |
| `c.moderation_hidden_at is null` on the comment count | Matches. |
| `'activity', wl.activity` present | Correct — the repo's standalone copy of the sibling is stale; production has carried `activity` since 16 September. |
| `revoke all` from `public`/`anon`/`authenticated`, `grant execute` to `service_role` | Matches the house pattern exactly. |

The API side is right too: `fetchAnteLogsForMonth` returns `null` on failure,
and `persistState` still treats null as "could not verify" and skips the Bloc
rather than freezing. Fetching once per *distinct* closed month handles two
time zones closing different months in one pass. **No changes needed.**

## 2. The sweep — where else the pattern lives

Every SQL object filtering `status = 'open'`:

| Object | Used to reason about a closed month? |
|---|---|
| `read_ante_core_current_logs` | Was. Fixed by your new sibling. |
| `read_ante_core_open_seasons` | No — it is definitionally about open seasons. |
| `read_ante_core_current_excused_and_sitouts` | **Yes, indirectly — see below.** |
| comment/moderation RPCs | No. |

## 3. The finding: the read overlays replace on "canonical ahead", not "equal"

Both canonical overlays in `fetchReadableCurrentState` are gated by:

```js
function canonicalOpenMonthIsCurrentForGroup(group, canonicalMonthKey) {
  const groupMonthKey = group?.lastMonth || getLeagueMonthKey(group?.settings?.timeZone);
  return compareMonthKeys(canonicalMonthKey, groupMonthKey) >= 0;
}
```

`>= 0` means the overlay also proceeds when canonical is **ahead** of the blob.
That is exactly the state a skipped Bloc is in: canonical opened October, the
blob is still on September.

What then happens, verified by reading both call sites:

- **Logs overlay** (`api/lift-log.js`, the `anteCurrentLogs` block) **replaces**
  `group.logs` wholesale with canonical's *open-season* logs — October's, which
  early in the month is empty or nearly so.
- **Excused/sit-out overlay** replaces `group.excused`, and also sets
  **`lastMonth: openMonthKey`** — so the readable state reports the Bloc as
  being on October.

So a member of a skipped Bloc sees October as the current month, with no logs
and no excused state, while the blob still correctly holds September. Their
month looks reset.

**Two things make this worth fixing rather than noting:**

1. It converts the safe outcome into the visible one. The skip was designed so
   a Bloc keeps its real month and retries; the read path overrides that.
2. It hides the fault. The app looks like it rolled over normally, so the only
   signal is the founder dashboard — which is how 1 October ran six hours.

**Not corrupting anything.** This is the readable projection only; the blob is
untouched. The damage is what members are shown.

## 4. Proposed fix — one operator, but in the most sensitive function

The replace semantics are only valid when canonical's open month **is** the
blob's current month:

```js
return compareMonthKeys(canonicalMonthKey, groupMonthKey) === 0;
```

With that, a skipped Bloc falls through both overlays and shows its real
September data, stale but true, while the dashboard reports the skip.

**I have not shipped this.** It is `fetchReadableCurrentState`, every read in
the app goes through it, and CLAUDE.md is explicit about not touching the
bootstrap path casually. The case I cannot rule out from reading alone: whether
any flow depends on the overlay running while canonical is ahead — a
canonical-first Bloc whose blob shell lags, for instance. That wants either a
staging check or your read.

**Suggested order:** confirm on staging that a Bloc with `lastMonth` behind the
canonical open season renders its old month rather than an empty new one, then
ship with a test.

## 5. The missing CI test — added

§12 noted that nothing in CI closes a month after the canonical season has
flipped, which is the exact bug shape. `npm run test:month-close-canonical`
now has two cases:

- fed the closing month's logs, it freezes with the closing month's counts
- fed the new month's empty logs, it refuses, and the skip reason names the
  month it could not verify

The second is the 1 October shape. Both pass.

## 6. One thing I got wrong, for the record

My own month-close check (`scripts/month-close-check.mjs`) would **not** have
caught 1 October. It compares before/after totals and assumes the close either
happens or does not; a close that silently skips nine Blocs while eighteen
still report "archived" was outside what it tested. The founder dashboard's
skipped-Bloc count was the signal, and your note to check it first is right.

For 1 November: the dashboard first, then `--after`, then `npm run parity:gate`.
