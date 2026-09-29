# Reactions vanishing, stream comments, and PWA parity (29 September 2026)

Written after build 9 testing. Read `AGENTS.md` first.

**This document was rewritten once.** An earlier version blamed duplicate open
seasons. That was wrong and is recorded in §5 so nobody re-derives it.

---

## 1. What is certain

Verified read-only against production today.

**Reactions are saved. Nothing is lost.** Every reaction made this afternoon is
in `ante_core.workout_reactions`:

| when | emoji | Bloc |
| --- | --- | --- |
| 16:34:56 | 🦍 | Sweat Equity |
| 16:31:30 | 🦍 | Go To Da Gym |
| 16:31:28 | 🏃 | Go To Da Gym |
| 16:30:57 | 💪 | Go To Da Gym |

**Comments are saved.** `ante_core.workout_log_comments` holds 242 rows, 37 in
the last seven days, most recent today at 13:14.

**The database read paths are correct.**

- `read_ante_core_current_logs()` returns the reactions above, per log, correct.
- `read_ante_core_workout_log_comments(...)` returns 2 comments for log
  `1790447771984374`, and `comment_count` agrees.
- Grants are right: `service_role` only. `anon` and `authenticated` cannot call
  these functions.
- No relevant errors in `postgres_logs`. No `not a bloc member` rejections.

So the database, the RPCs and the data are all healthy. The failure is above
them.

---

## 2. Confirmed client bug: the skeleton never gives up

`src/components/LogCommentThread.jsx`, in `refresh()`:

```js
const result = await listLogCommentsData(groupId, logId);
if (!result.ok) {
  setError(result.error || "Unable to load comments");
  return;                    // <-- setLoaded(true) is never reached
}
```

`setLoaded(true)` only happens on the success path. The render gate is:

```js
comments.length === 0 && !loaded && knownCommentCount > 0
  ? CommentThreadSkeleton
```

So when the fetch fails, `loaded` stays false, the skeleton stays on screen, and
the `setInterval(refresh, 3000)` re-fails every three seconds forever. That is
exactly the reported symptom: the thread opens, the workout and photo render
(they come from props, not from this fetch), and the comments never arrive.

This is the same family as "A Failed Mutation That Says Nothing" in the
recurring debugging playbook: a real failure presented as an endless wait.

**Worth fixing on its own merits, whatever the underlying cause.** A failed load
must reach a terminal state and say so.

---

## 3. Still unknown: why the API call fails

The database is fine, so `/api/lift-log` with `action: "log-comments-list"` is
returning something non-OK to this client. What that is has **not** been
established. It cannot be seen from the Supabase side — it needs either the
Vercel function logs for that request, or the network response captured on the
device.

Reported on both the PWA and TestFlight, which points at the API rather than
either build.

**Do not guess this.** Capture the actual status code and response body first.

Note the reaction symptom may share this cause: a reaction is applied
optimistically, and if the following refetch fails or returns stale state, the
reaction disappears from the screen while remaining in the database — which is
precisely what was observed.

---

## 4. PWA is missing the bottom-nav blackout

The nav bar sits higher on the PWA and content shows below it — the problem
already fixed on the iPhone app. TestFlight is correct; the PWA is not.

Cause: none of this session's app work went to `main`. It is all on
`ios-header-and-nav-polish`; `main` is at `2ddc545`.

What the PWA is missing:

- `--bottom-scroll-clearance` (offset + 116px) for scrolling content, kept
  separate from `--bottom-nav-clearance` (offset + 68px) for chrome such as the
  install banner. **These two must not be merged back together.**
- The safe-area / notch handling from `3dd78a4`.

`env(safe-area-inset-bottom)` is 0 in a desktop browser and ~34px on a phone, so
verify on a real phone.

---

## 5. The confident wrong answer — do not re-derive it

**Claim:** two Blocs had two open seasons each, so `openSeasonMonthKeys` in
`api/lift-log.js` (built last-row-wins, no ordering) sometimes picked the stale
month, `canonicalOpenMonthIsCurrentForGroup` returned false, the canonical
overlay was skipped, and the blob's empty reactions won.

**Why it looked right:** querying `ante_core.seasons` for `closed_at is null`
returns two rows for `legacy-group` (2026-8 and 2026-5) and two for
`ctrl-alt-de-feat-ocdti8` (2026-8 and 2026-6).

**Why it is wrong:** `closed_at is null` is not what the code means by open.
`read_ante_core_current_excused_and_sitouts()` builds `open_seasons` with:

```sql
from ante_core.seasons s
join ante_core.blocs b on b.id = s.bloc_id
where s.status = 'open'
  and b.legacy_group_key is not null;
```

Every block in that function filters on `s.status`, not `closed_at`. Checked
directly:

```sql
select b.legacy_group_key, count(*)
from ante_core.seasons s join ante_core.blocs b on b.id = s.bloc_id
where s.status = 'open' and b.legacy_group_key is not null
group by 1 having count(*) > 1;
-- returns zero rows
```

**No Bloc has more than one open season.** `openSeasonMonthKeys` gets exactly one
entry per Bloc, the guard passes, and the overlay runs. The last-row-wins reduce
is untidy but currently harmless, and changing it would have fixed nothing.

**What is actually true about those rows:** two seasons carry
`status = 'closed'` with `closed_at` still null — Go To Da Gym `2026-5` and
Ctrl Alt De-feat `2026-6`. They are properly closed everywhere the app looks.
Only the timestamp was never filled in, probably by a partial rollover. This is
a cosmetic inconsistency, not a cause, and **not a month-close risk for
1 October** — every read filters on `status`.

---

## 6. What was NOT touched

No code was changed. Every statement run against production was read-only:
`select` against `information_schema`, `pg_proc`, `pg_get_functiondef`,
`ante_core` tables, `public.lift_log_state`, the log stream, and two read-only
`SECURITY DEFINER` read RPCs whose definitions were read before calling them.
No writes, no DDL, no row counts changed.

---

## 7. Month-close pre-flight for 1 October — all four checks pass

Run read-only on 29 September, two days before close. Every check below is the
one a documented past incident says to run.

### 7.1 Every Bloc's month agrees, blob against canonical

All **18** Blocs report `lastMonth = 2026-8` in the blob and an open canonical
season of `2026-8`. No mismatches, no blob-only Blocs, no canonical-only Blocs.

This matters because `rolloverGroupIfNeeded` skips a Bloc whose canonical row is
missing, and the 2026-09-01 incident was a stalled batch.

### 7.2 No logs the blob has and canonical is missing — the dangerous direction

Month close now freezes counts from canonical
(`rebuildClosedMonthSnapshotFromCanonicalLogs`), so a log present in the blob but
absent from canonical would **deflate** a member's count and charge someone who
actually completed the month. The playbook calls this the worse direction.

Compared every September blob log against `ante_core.workout_logs` in the open
season, excluding `deletedCurrentLogIds`: **zero rows**.

### 7.3 No logs canonical has and the blob is missing

The inflating direction, checked for completeness: **zero rows**.

Blob and canonical agree exactly on September, in both directions.

### 7.4 No departed member is still countable

Seven members have `left_at` set. Checked each against that Bloc's blob
`memberOrder`: **none** is still listed. The "Left Members Appearing In New
Month Or Settlement" failure is not present.

### 7.5 No deleted log is still countable

Every `deletedCurrentLogIds` entry checked against canonical September logs in
open seasons: **zero rows**. No phantom will be counted at close.

### What this does and does not say

It says the **data** going into month close is consistent right now. It does not
test the rollover **code path** — nobody has exercised `rolloverGroupIfNeeded`
against a faked 1 October date this session. If there is appetite before
Wednesday, that is the remaining gap, and the method is in `AGENTS.md` §12
(`NODE_OPTIONS="--import <file overriding Date>"` against the sandbox).

Re-run 7.1–7.5 on 30 September, since logs keep arriving until the last minute.

---

## 8. Month-close dry run against live data — passed

Run 29 September against real production data, clock faked to
`2026-10-01T12:00:00Z`. Read-only: it fetched the live blob and the live
canonical logs, then ran the real `rolloverGroupIfNeeded` and
`rebuildClosedMonthSnapshotFromCanonicalLogs` over an in-memory copy. Nothing
was written.

```
Blocs in blob: 18
Rolled over:   18
Did NOT roll:  0
Rebuild fails: 0

No problems. Every Bloc rolled, and canonical counts match the frozen snapshot.
```

Every Bloc moved `2026-8 -> 2026-9`, and for every one of them the count frozen
from the blob and the count rebuilt from canonical were **identical**. Members
counted per Bloc: Go To Da Gym 11, Ctrl Alt De-feat 9, Sarandawgs 8, OSI H3 7,
StavanGang 7, Sweat Equity 6, Curke 3, Active divas 2, Two & a half men 2,
FIMctive / Lazy no more / Sparring sessions / Test 7000 / Test Bloc / Trying
times 1 each, and **0** for `test`, `Test` and `Gym gal`.

A zero is not a failure. It means that Bloc's snapshot had no members to count
for September — Gym gal's only member left in June, and the other two are test
Blocs. The safety guard would have refused the close if the blob had counted
anyone while canonical returned nothing; it did not fire, so both stores agree
there was nobody to count.

### The guard was tested directly

Against fixtures, `rebuildClosedMonthSnapshotFromCanonicalLogs` with an empty
canonical list and a blob that counted 3 returns:

```
ok: false | reason: canonical logs empty for 2026-8 while blob counted 3
```

So if canonical were unreadable on 1 October, that Bloc is rolled back and
retried rather than frozen at zero. This is the protection that matters most,
and it is live.

### Method, if this needs repeating

The sandbox cannot be used for this — it answers every canonical RPC with `[]`,
which would make a healthy close look like a catastrophic one. **And port 54321
was already in use by the other agent's sandbox**, so `npm run sandbox:seed`
would have seeded their data, not ours. Check the port first, every time.

The route that works: fake the clock before importing `api/lift-log.js`, fetch
the live blob and `read_ante_core_current_logs()` over REST with the service
key, and call the two exported helpers on a deep copy. `.env.local` cannot
supply the key — Vercel redacts it to the literal string `[SENSITIVE]` — so it
has to be read into the shell at run time.

### What is now covered

| | |
| --- | --- |
| Data going into the close | checked, §7 |
| The rollover code path | checked, §8 |
| The empty-canonical guard | checked, §8 |

Re-run both on 30 September, since workouts keep arriving until the last minute.

---

## 9. Live status board — keep this updated

Last updated 29 September, after handing Codex round two.

| Reported by Aadhil | Status | Where |
| --- | --- | --- |
| Reactions disappear | **Cause found: the outage (§12). Nothing lost, no fix needed.** | — |
| Stream/activity comments never load | **Cause found: the outage (§12).** Honest-failure fix **with Codex now** to land on main | `e9b7704` |
| Bloc entry could be faster | **Reframed — there is no entry animation.** See §15 | §15 |
| Tab lift arrives late | **Done, `0b1d7c3`.** Not live, not in a build | §15 |
| Reaction bar overflows the screen | **With Codex now** | see §11 |
| Full emoji picker (top 5 + more) | Not started, feature not fix | — |
| PWA missing the bottom-nav blackout | Not started | see §4 |
| Month close on 1 October | **Verified safe** | §7, §8 |

---

## 10. Review of Codex's first round

### 10.1 The retracted fix reached production

**`e9ea4cd` "Choose newest canonical open season so reactions remain visible" is
on `main` and deployed to Production** (deployment succeeded 17:00 UTC). This is
the fix from the *withdrawn* instruction — the one based on the wrong diagnosis
in §5. Codex had started before the correction arrived, and his report did not
mention this commit at all.

**Is it harmful? No.** Verified: 18 Blocs have an open season, **0** have more
than one, and `read_ante_core_current_excused_and_sitouts()` filters on
`s.status = 'open'`. With exactly one row per Bloc the new condition
(`!acc[key] || compareMonthKeys(...) > 0`) is true on that single row, so the map
is identical to before. It is a no-op against current data, and marginally more
defensive if a Bloc ever did have two open seasons.

**Recommendation: leave it.** Reverting a live no-op is churn with its own risk.

**But it fixes nothing.** Nobody should read this commit as "reactions fixed".
It is recorded here so that it is not mistaken for a fix later.

It also added `scripts/test-open-season-month-selection.mjs` and a
`package.json` entry, which is why the suite is now 25 scripts rather than 24.

### 10.2 The comment-thread fix — reviewed, sound

`e9b7704`, one file, `src/components/LogCommentThread.jsx`, +12 −2.

Correct on every point:

- `setLoaded(true)` and `setLoadFailed(true)` on the failure path, so the
  skeleton stops. This was the bug.
- `setLoadFailed(false)` on success **and** when the thread reopens, so a
  recovered thread does not stay stuck in the failed state.
- The 3-second poll, the cache and the optimistic pending-comment handling are
  all preserved, as instructed.
- The error banner is suppressed while the dedicated failure panel is showing,
  so the same message does not appear twice.
- Cached comments plus a later failure shows the stale comments *and* the error
  banner, rather than throwing the comments away. Good behaviour.
- Scope respected: no API, RPC, SQL or reaction code touched.

Build verified independently — Vercel built the preview successfully.

**It is not live**, and previews cannot reach the production database, so it
cannot be tested there. It needs to go to `main` to be seen on the PWA, and into
a TestFlight build to be seen on the phone.

### 10.3 Task 1 is genuinely still open

Codex could not read the Vercel function logs — the query returned
`400 ExceedsBillingLimitError` — and the web session available to him was signed
out. He made no server change and claimed no cause. **That is the correct call**
and matches the instruction not to guess.

So the reason `log-comments-list` fails is still unknown. The evidence needed is
the status code and response body of one failing request, captured on the phone.

---

## 11. Reaction bar overflows — diagnosed, not yet fixed

`src/pages/ActivityFeed.jsx` line ~277. The picker is anchored to the right edge
of the `+` button:

```js
left: centered ? "50%" : "calc(100% + 5px)"
```

Every reaction added pushes the `+` further right, and the picker goes with it.
`maxWidth: "calc(100vw - 48px)"` cannot save it, because by then the picker's
*left* edge is already past the screen. It needs to be positioned against the
viewport, or flipped to open leftward when it would overflow.

---

## 12. CAUSE FOUND — it was a database outage, not a code bug

Aadhil reported at ~19:00 local that comments were loading again, with no
deploy and no change in between. That was the clue. The Supabase edge logs
answer it.

**Every endpoint timed out between 16:31 and 16:45 UTC.** Not one path — all of
them:

| path | status | window | count |
| --- | --- | --- | --- |
| `/auth/v1/user` | 504 | 16:37:33 – 16:40:40 | 114 |
| `/rest/v1/lift_log_state` | 504 | 16:33:23 – 16:38:50 | 43 |
| `read_ante_core_revision` | 504 | 16:34:15 – 16:38:40 | 28 |
| `read_ante_core_workout_log_comment_counts` | 504 | 16:34:05 – 16:42:01 | 22 |
| `read_ante_core_settlement_confirmations` | 504 | 16:33:55 – 16:42:01 | 21 |
| `read_ante_core_current_logs` | 500 | 16:31:52 – 16:45:07 | 20 |
| `read_ante_core_current_logs` | 504 | 16:33:22 – 16:38:39 | 16 |
| `read_ante_core_month_history` | 504 | 16:33:53 – 16:42:57 | 16 |
| …every other canonical RPC | 504 | same window | 9–14 each |

Hour by hour, 16:00 UTC carries **346 × 504 and 56 × 500**. Every other hour of
the day is clean. A smaller earlier window shows 4 × 500 around 05:00.

### This explains both symptoms exactly

Aadhil's reactions were written at **16:30:57, 16:31:28, 16:31:30 and 16:34:56** —
right as the outage began. The **writes got through** (all four are in
`ante_core.workout_reactions`), but every **read** afterwards timed out, so the
screen fell back and they looked deleted. They were never lost.

Comments were the same: `read_ante_core_workout_log_comment_counts` and the
comment read were timing out, the fetch failed, and the old code answered a
failure with an endless skeleton.

### What this changes

- **There is no server bug to find.** Task 1 is answered. Nobody should keep
  hunting for a cause in `api/lift-log.js`, and the Vercel log access is no
  longer needed for this.
- **Codex's fix is still worth shipping.** It does not prevent an outage, but it
  turns "spins forever and lies to you" into "says it failed, offers Try again".
  That is the right behaviour for the next outage, and there will be one.
- **`read_ante_core_month_history` is healthy.** Its 500s fall entirely inside
  the two outage windows, and the function returns 31 months correctly right
  now. It is not a standing problem — checked before saying so.

### Related precedent

The playbook already records an outage on 2026-09-22 that signed members out,
fixed in `9cb945c`, under the rule **"I couldn't check" is never "you're not
signed in"**. This is the same family: a transient outage presenting as data
loss. The lesson generalises — a failed read must never look like an answer.

---

## 13. App health check — everything is fine

Run after the outage, 29 September.

- **Logging is working.** 14 workouts landed across the last 12 hours, most
  recent 16:00 UTC, spread through the day rather than bunched.
- **Nothing was lost during the outage.** Compared every September workout in
  the blob against canonical, both directions, excluding deleted ids:
  **zero discrepancies**. No workout came in without being registered.
- **No member is missing a workout they logged.** The two stores agree exactly.

Aadhil's instinct to check was right, but the app came through it clean.


---

## 14. Round two handed to Codex (29 September)

One message, three items in order:

1. **Stop Task 1.** The outage evidence in §12, handed over in full so he does
   not keep chasing Vercel logs for a cause that does not exist.
2. **Land `e9b7704` on `main`.** Reviewed and sound (§10.2). Straight to main per
   the standing workflow — previews cannot reach the live database. Told
   explicitly to leave `e9ea4cd` alone and why.
3. **Fix the reaction picker overflow** (§11), with the card and chip row as
   hard locks and a measured pass/fail at 375x812.

TestFlight deliberately left out. Build 10 should carry both once they land;
that is a separate hand-off.

### Still open after round two

| | Owner | Note |
| --- | --- | --- |
| Tab lift arrives late | unassigned | Cause NOT found by reading. Needs a frame-gap measurement on the simulator, method in the 29 Sep motion handover §3 |
| Bloc entry could be faster | unassigned | Not investigated at all |
| Full emoji picker, top 5 + more | unassigned | Feature, not a fix. Three surfaces: activity, comments, Bloc Stream |
| PWA bottom-nav blackout | unassigned | §4 |
| TestFlight build 10 | Codex | After items 2 and 3 land |
| Notification permission timing | **Aadhil** | iOS asks once. Do not pick it for him |
| Re-run §7 and §8 | unassigned | On 30 September, before month close |
| Cancelled Bloc back-swipe stall | parked | Deliberate, see motion handover §8 |
| In-Bloc tab shadow strip | parked | Not reported by Aadhil |


---

## 15. The nav lift, and what "enter the Bloc faster" actually means

### The lift — done, `0b1d7c3`

**There was no bug.** On a tab tap, `setPage(nextPage)` flips `.on` in one
render, so the pill and the lift change in the same commit. On a swipe,
`applyTabLift(s.target)` and the pill's slot are both written imperatively in
the same block at release. Nothing delayed the lift's start. Reading the code
harder would never have found a cause, because there was not one.

**The problem was the end of the motion, not the beginning.** The lift borrowed
`SCREEN_SETTLE_EASING` (`cubic-bezier(.32,.72,0,1)`), which decelerates hard. A
1.5px rise and a 1.16x growth are subtle, so the final fraction of that curve
arrives long after the screen has settled — and a subtle change that *finishes*
slowly reads as late even when it *starts* on time.

So the curve mattered as much as the duration:

```js
const TAB_LIFT_MS = Math.round(SCREEN_SETTLE_MS * 0.5);   // 100ms, was 160
const TAB_LIFT_EASING = "cubic-bezier(.2,.9,.3,1)";       // front-loaded, was the shared settle
const TAB_LIFT_TRANSITION = `transform ${TAB_LIFT_MS}ms ${TAB_LIFT_EASING}`;
```

Still derived from `SCREEN_SETTLE_MS` rather than hardcoded, so the lift keeps
tracking the screen if that ever changes. `TAB_LIFT_MS` feeds nothing but this
transition — no commit delay depends on it — so giving it its own easing does
not violate the playbook's "same constant" rule, which is about
`SCREEN_SETTLE_MS` and is untouched.

**Chosen, not guessed.** Three speeds were mocked against the real nav bar,
with the pill left at its shipped 200ms so the icon could be judged against it.
Aadhil picked option 2 of 3. Artifact: `SRh6yLr5LEuPJgvAqtMRRs`.

Verified: lint clean, build clean, all 24 `test:*` pass, and the new easing is
present in the built bundle while the old `0.8` ratio is gone. Layout is
unchanged **by construction** — only `transition` timing changed, and at rest
the computed transform is identical, so nav height and tab positions cannot
have moved.

**Not live and not in a TestFlight build.** It is on `ios-header-and-nav-polish`
only. Note `TAB_LIFT_MS` does not exist on `main` at all — the whole lift lives
on this branch — so this must not be sent to Codex as a main-branch change.

### "Enter the Bloc faster" — there is nothing to speed up

Worth recording, because the obvious assumption is wrong.

**There is no entry animation.** Tapping a Bloc in the switcher runs
`onOpenGroup`: a haptic, a scroll reset, `persistGroupSelection(groupId)`,
`setPage("today")`. The switcher branch stops rendering and the Bloc surface
renders. It is a hard swap. The Bloc surface's only transition is the swipe
transform, which is not involved here.

The `.fu`/`.fu2`…`.fu5` staggered fade-ups (0.35s, delayed up to 0.24s) are
**not** on the Today page — only `HistoryPage.jsx` uses them. So they are not
what is being felt either.

What is left is render cost: **every in-Bloc page mounts at once** in the swipe
track, not just Today. The playbook records this ("every in-Bloc page mounts
together in the swipe track"), and the 29 Sep motion handover measured the
reverse direction — unmounting ~730 nodes for the switcher — at one normal
frame.

So making this faster means **mounting less up front**, which touches the swipe
track. That is exactly the area the playbook warns has been broken and re-fixed
repeatedly. It needs an on-device measurement before anyone changes it, and it
should not be bundled with a motion tweak.

**Incidental finding, not fixed:** `HistoryPage.jsx` uses `className:"fu6"`, but
`.fu6` is not defined in `app.css`. That element simply appears with no
animation. Left alone — not reported, and out of scope.
