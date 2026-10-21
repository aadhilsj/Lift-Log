# Handover for Deveen: week of 29 September (active)

From Aadhil. This replaces `docs/handover-2026-09-22-for-deveen-active.md`,
which is answered and closed — your 27 September rehearsal is recorded in its
§11. Read that one only for history.

**Everything here was verified against live production on 29 September, not
taken from the older docs.** Where an older doc is now wrong, this one says so.

| | Status |
| --- | --- |
| 1. **`push_devices` is missing from your RLS migration** | **Needs you before 2 Oct** — re-verified on production 30 Sep, still nine tables |
| 2. RLS production rollout | Scheduled 2–3 Oct, after the close |
| 3. The staging app pass | **No longer yours** — Aadhil is taking it |
| 4. `fero-staging` billing and teardown | Still running, ~$9.68/month |
| 5. Things you asked for that are now done | Nothing to do |
| 6. Wave B | After the 1 Oct close, unchanged |
| 7. A 14-minute total outage today | Your area — scaling/reliability |
| 8. Still open from before | Region, outbox, download size |
| **19. Since this was written** | The 1 Oct close held; your §10.3 ask is done |
| **20. Scaling before launch** | **Not started. The biggest pre-launch item — read this** |

---

## 1. URGENT-ish: `push_devices` is not in your migration

Your migration
`supabase/migrations/20260926120000_enable_rls_on_server_only_tables.sql`
names **eight** `ante_core` tables:

`bloc_messages`, `bloc_message_reactions`, `bloc_message_reads`,
`workout_log_comments`, `workout_log_comment_reactions`, `solo_requests`,
`revision_clock`, `backup_bloc_message_solo_note_2026_09_18`

**Production has nine tables with RLS off.** The extra one is
**`ante_core.push_devices`**, created by
`20260928213759_add_push_notification_foundation` on 28 September — two days
after you wrote the migration, and eight days after the inventory that produced
the list.

Two consequences:

1. Applying as-is leaves `push_devices` unlocked, and it holds device push
   tokens — exactly the kind of table this exercise exists to protect.
2. **Your own verification query will report a failure on the day.** The check
   "`ante_core` tables still without RLS" is written to return zero rows; with
   `push_devices` uncovered it returns one, which will read as the migration
   having gone wrong.

**Not exposed today.** `anon` has no `USAGE` on `ante_core`, and the table
grants nothing to `anon` or `authenticated`. This is a gap in the fix, not a
live hole.

**Ask:** add it to the migration in the same guarded shape as the others. Your
migration, your call on how.

**The general point, which matters more than this one table:** the 20 September
inventory was a photograph. Tables have been added since and will be again
before 2 October. **Re-run the "which tables have RLS off" query immediately
before applying**, rather than trusting the list:

```sql
select n.nspname, c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname = 'ante_core' and not c.relrowsecurity
order by 2;
```

### Re-verified on production, 30 September — still true, plus two corrections

Ran the query above against production. **Still exactly nine tables, still
`push_devices` as the ninth.** Nothing new has been added since 28 September,
so the list in the migration is short by exactly one and no more.

**Correction to the "not exposed today" note above.** `anon` has no `USAGE` on
`ante_core`, as stated — but **`authenticated` does**:

| | |
| --- | --- |
| `anon` USAGE on `ante_core` | `false` |
| `authenticated` USAGE on `ante_core` | **`true`** |
| table grants on `push_devices` to either | **NONE** |

So what keeps `push_devices` unreachable is the **absence of table grants
alone**, not the schema barrier. For a signed-in user the schema door is
already open. That does not change the conclusion — it is still a gap in the
fix rather than a live hole — but it means the single thing standing between a
signed-in user and this table is one `GRANT` nobody has made. Worth knowing
before deciding how much the ordering on 2 October matters.

**The table is empty — 0 rows.** No device tokens exist yet, so nothing is at
risk today.

**TestFlight build 10 does not change that.** The branch `testflight-build-10`
(`77fe4d8`) merges the website work onto the app lineage and carries the push
foundation code, but push stays off: there is no APNs key, no wired permission
prompt, and the build is archived with the same no-push signing override as
build 9, with no `aps-environment` in its entitlements. **No build in the field
will write a row to `push_devices` before your migration lands.** If that ever
changes, this table stops being empty and the ordering starts to matter.

---

## 2. RLS production rollout: still 2–3 October, after the close

Unchanged and still agreed. A database change has no business landing next to
the first real canonical rollover.

**Confirmed today: nothing has been applied to production.** Nine `ante_core`
tables still have RLS off, and the 15 projection tables still carry the full
`anon`/`authenticated` grants including `TRUNCATE`. That is exactly the
pre-migration state your rehearsal expected.

Independent re-check of your safety argument against live production:

| | |
| --- | --- |
| `anon` has `USAGE` on `ante_core` | **no** |
| `authenticated` has `USAGE` on `ante_core` | yes |
| `ante_core` tables granting to `anon` | **none** |
| `ante_core` tables granting to `authenticated` | one: `settlement_confirmations` (SELECT, UPDATE), and it is the only one with real policies — 3 of them |
| Supabase security advisor | 42 × `rls_enabled_no_policy` at **INFO**, plus one irrelevant `auth_leaked_password_protection` warning (Fero has no passwords — sign-in is an emailed code) |

Before applying: a fresh backup, and the rollback line to hand.

---

## 3. The staging app pass is no longer waiting on you

Your §11 left one thing open: signing into the staging preview and exercising
Stream, comments, solo requests, sign-in and logging, end to end.

**Aadhil is taking this.** His own account (`aadhil101@gmail.com`) was
deliberately kept working on staging, so he does not need your login. Do not
plan around it.

Worth stating what it actually covers, so the decision is informed: the database
checks you and Aadhil already ran prove the locks moved and that server-side
reads still work. The click-through is the only test that exercises the
**`SECURITY DEFINER` path through the real HTTP API**. It is the cheapest
insurance available and it should still happen before 2 October — just not by
you.

---

## 4. `fero-staging` is still running and still billing

Project **`okwrrspdmoluxatyokzh`**, `ACTIVE_HEALTHY`, created 24 September,
**~$9.68/month billed hourly.** Confirmed live today.

**Do not delete it yet** — it is still needed for §3. **Delete it as soon as the
migration is on production**, or it keeps costing.

Teardown, in order (full detail in
`handover-2026-09-27-staging-outage-and-header.md`):

1. Delete the `fero-staging` Supabase project — **this is what stops the cost**.
2. Revoke the Vercel shareable link (Deployment Protection → Shareable Links).
3. Delete the four **Preview-scoped** Vercel variables and the branch
   `staging/rls-rehearsal`.
4. **Leave the Production `ADMIN_PIN` alone.**

---

## 5. Things from your last handover that are now done

Checked today, so your agent does not re-raise them:

- **`test/month-close-allowance-regression` is merged into `main`.** `main` and
  that branch no longer differ in `scripts/test-month-close-canonical.mjs`. The
  1 October allowance test is in place.
- **The runbook line is fixed.** §Task 5 of
  `blob-retirement-runbook-aadhil-side-2026-09-06.md` now reads
  `reaction,flag,flag-response,flag-review,add-log,multi-log` — `delete-log` is
  gone, as you asked.
- **`test:auth-outage` is in `ci.yml`** — you did this on 26 September.

---

## 6. Wave B: after the close, unchanged

1 October closes → your four post-rollover checks → if clean, Wave B that week
→ soak 48–72h with the gate daily.

Reasoning unchanged: `add-log` and `multi-log` still mirroring to the blob is
the parallel record that makes the first canonical close safe. Wave B removes
exactly that. Nothing is lost by waiting.

---

## 7. A 14-minute total outage today — your area

**29 September, 16:31–16:45 UTC. Every Supabase endpoint failed**, not one
path. From the edge logs:

| path | status | count |
| --- | --- | --- |
| `/auth/v1/user` | 504 | 114 |
| `/rest/v1/lift_log_state` | 504 | 43 |
| `read_ante_core_revision` | 504 | 28 |
| `read_ante_core_workout_log_comment_counts` | 504 | 22 |
| `read_ante_core_settlement_confirmations` | 504 | 21 |
| `read_ante_core_current_logs` | 500 | 20 |
| every other canonical RPC | 504 | 9–14 each |

That hour carries **346 × 504 and 56 × 500**. Every other hour of the day is
clean. A smaller window shows 4 × 500 around 05:00.

**No data was lost.** Writes during the window succeeded — four reactions
written at 16:30–16:34 are all in `ante_core.workout_reactions`. Only reads
failed. A full blob-vs-canonical comparison of every September workout, both
directions, returns zero discrepancies.

**What it cost in user terms:** reactions appeared to vanish (written fine, the
read after them failed), and comment threads spun forever rather than reporting
a failure. The second of those is now fixed and live (`e9b7704`) — a failed
comment load says so and offers a retry instead of an endless skeleton.

**Why this is yours:** this is the second outage in eight days
(22 September Cloudflare, 29 September Supabase). Both surfaced as apparent data
loss rather than as an outage. Relevant to your §6.4 (the server is in the US,
the database in Ireland — every request goes via Cloudflare IAD) and to your
09-15 scaling doc. `"regions": ["dub1"]` would remove the London path; confirm
Hobby allows region selection before planning on it.

---

## 8. Still open from before

1. **§6.4, the server region.** Untouched. After 1 October.
2. **§6.5, the offline outbox** — keep a failed workout save on the phone and
   retry it. Planned for after 1 October. Note it touches month close: a
   30 September log retried on 1 October must still count for September.
3. **The scaling doc / traffic incident**, from 15 September. Still not
   started — and now the largest piece of work left before launch. It has its
   own section at the end of this file: **§20**.
4. **The app download size check.** Still open.
5. **CI does not block anything.** Your workflow runs on push to `main` and on
   PRs, but `main` has no required status checks, and pushes to `main` deploy to
   Vercel before CI finishes. Flagged, not changed — it is Aadhil's process
   call.

---

## 9. One thing to know about the repo this week

`main` is about to receive a month of iPhone app work that the website has never
had — the rebuilt header, safe-area handling, screen transitions, haptics. It
has only ever run through TestFlight. None of it touches the database, the API,
or anything in your area, but it explains why `main` will move a lot this week.

`docs/WHATS-LIVE.md` is the running answer to "what is on the website versus the
phone". It is kept current; prefer it over any dated handover.

---

## 10. CI has been red since 00:00 UTC on 1 October — two date-dependent tests

**Your CI workflow is doing its job. The code it is testing is fine.** Two of
the 21 offline suites fail because of what day it is, not because of anything
that was pushed. Aadhil has had three "All jobs have failed" emails.

| Run | When (UTC) | Result |
| --- | --- | --- |
| `4ba67e3` | 30 Sep 23:08 | fail — test month-key maths predated the 3am Bloc-day rule |
| `cd5e912` | 30 Sep 23:28 | **pass** — Codex fixed that maths |
| `5f84b54` | 1 Oct 00:27 | fail — UTC had crossed into 1 October |
| `b7c9f78` | 1 Oct 01:06 | fail — same |

### 10.1 `test:solo-sitout-exclusion` — fails days 1–10 of every month

Not your file (created 18 September in the Solo rules work), but it is the
louder of the two and it breaks your pipeline.

The test makes a Solo request and then cancels it. **Solo before day 10 is
granted instantly** — it only becomes a pending request after the 10th. So on
day 1 there is nothing pending, and `applyRequestCancel` throws
`There's no request to cancel` (404).

Reproduced locally against `origin/main` with the clock faked:

| Faked date | Result |
| --- | --- |
| 30 Sep | pass |
| **1, 2, 5, 9, 10 Oct** | **fail** |
| 11, 15, 20 Oct | pass |

It passed all September only because September was already past the 10th when
CI was built. **It will go red again on 1 November, 1 December, and every
month after** — for ten days at a time.

### 10.2 `test:month-close-canonical` — fails 00:00–03:00 UTC on the 1st

This one is yours (10 September, "Month close counts from canonical, not the
blob"). Line 101: `TypeError: Cannot read properties of undefined (reading
'monthHistory')` — `rolloverGroupIfNeeded` returns a group with no closed
snapshot, so `monthHistory[0]` is undefined.

It fails only in the three-hour window between UTC midnight and the 3am
Bloc-day cutoff, when the test and the app disagree about which month it is:

| Faked time (UTC) | Result |
| --- | --- |
| 30 Sep 23:08, 23:28 | pass |
| **1 Oct 00:27, 01:06** | **fail** |
| 1 Oct 06:00, 2 Oct, 20 Oct | pass |

This one clears itself after 03:00 UTC on the 1st. It will recur every month.

### 10.3 The ask

**Pin both tests to a fixed date instead of `new Date()`**, so they test the
rule rather than the calendar. The day-10 Solo boundary and the 3am Bloc-day
cutoff should each be exercised deliberately, from both sides, rather than
being whatever today happens to be.

A date-faking shim already works for this — set the clock with
`NODE_OPTIONS="--import <file overriding Date>"`, which is how the table above
was produced.

Your call on how. Flagging it rather than changing your test. Related: §8.5
still stands — CI blocks nothing, and Vercel deploys before CI finishes, so a
red run never stopped either of these pushes reaching production.

---

## 11. The 1 October month close — verified clean

Read-only against production, after the rollover.

| Check | Result |
| --- | --- |
| September (`2026-8`) closed | **18/18 Blocs** |
| October (`2026-9`) open | **18/18 Blocs**, no Bloc left behind |
| Blocs still open on September | **0** |
| Frozen counts vs actual September logs | **699 = 699, 0 mismatches over 61 members** |
| October logs so far | 0 (expected) |

Member states frozen for September: 6 Solo, 3 sitting out, 10 with zero
workouts, 15 below target and facing a penalty.

**One thing that looks wrong and is not:** `settlement_runs` and
`settlement_entries` are empty for September. They are empty for *every* month
back to `2026-3` — settlements still live in the blob, not in those canonical
tables. Not a rollover failure, and not a regression. Worth knowing before
anyone reads those tables as a health signal during Wave B.

---

## 12. READ FIRST — the month close was broken all of 1 October, and is now fixed

**This is the one that matters.** It is your area, it was live for roughly six
hours, and it is the cause of almost everything else on this page.

### What was wrong

`rebuildClosedMonthSnapshotFromCanonicalLogs` was being fed the wrong month's
logs. The rollover fetched them with `fetchAnteCurrentLogs()`, and the RPC
behind it ends:

```sql
where s.status = 'open' and b.legacy_group_key is not null and wl.moderation_hidden_at is null
```

The canonical rollover closes September and opens October **before** the blob
rollover runs. So by the time month close asked for logs, the only open season
was the new, empty one. The guard saw zero canonical rows against a blob that
counted workouts and refused to freeze the month — which is exactly what you
designed it to do, and it was right. It was simply reading October.

The Bloc was then skipped and retried on every read:

```
month close snapshot rebuild failed: canonical logs empty for 2026-8 while blob counted 107
```

**862 `rollover_skipped` events in 7 days, 9 distinct Blocs, 216 in the 04:00
hour alone.** Aadhil found it on the founder dashboard; I had been reading code
for an hour while the app was already reporting it. Check the dashboard first
next time — I should have.

### What it caused

Nine of eighteen Blocs never wrote September to the blob, which in turn:

- **Lost the Solo standard-penalty marker.** Canonical has no rule column, so
  `buildCanonicalMonthHistoryForGroup` carries it from `blobMonth.solo`. No
  snapshot, no marker, and the Solo silently reverted to the old rules. Rahul
  in Go To Da Gym — Solo target 6, logged 5 — showed "Nothing to settle"
  instead of owing $20, and £10 in Sarandawgs. Rithu the same.
  Per `docs/handover-2026-09-18-solo-new-rules.md`, **September 2026 is the
  only month this can happen in**: `SOLO_STANDARD_PENALTY_FROM = "2026-9"`, so
  from October the rule follows from the month alone.
- Made StavanGang and others look like they had reset.
- Left the in-memory rollover recomputing September on every single read.

### The fix — `c9ce86a`

**Migration applied to production:**
`supabase/migrations/20261001070000_read_ante_core_logs_for_month.sql`

Adds `public.read_ante_core_logs_for_month(p_month_key text)`. Byte-identical
to `read_ante_core_current_logs()` except `s.status = 'open'` becomes
`s.month_key = p_month_key`. **`read_ante_core_current_logs` is untouched** and
still serves the live month.

Grants match its sibling exactly:

| | |
| --- | --- |
| acl | `postgres=X/postgres \| service_role=X/postgres` |
| `anon` | cannot execute |
| `authenticated` | cannot execute |

**API:** the rollover now calls `fetchAnteLogsForMonth(closedMonthKey)`, once
per *distinct* closed month — Blocs roll at their own 3am, so two time zones
can close different months in one pass. The failure mode is unchanged: a null
fetch still skips the Bloc rather than freezing anything unverified. Your guard
is intact; it is simply fed the right month.

### Verified on production after the fix

| Check | Before | After |
| --- | --- | --- |
| Blocs with September in the blob | 9 of 18 | **18 of 18** |
| Blocs still on `lastMonth 2026-8` | 9 | **0** |
| `rollover_skipped` after 04:47 UTC | — | **0** |
| Last skip ever | 04:46:39 UTC | none since |
| `read_ante_core_logs_for_month('2026-8')` | — | **699 rows** |
| `read_ante_core_logs_for_month('2026-9')` | — | 0 rows |
| `read_ante_core_current_logs()` | 0 | 0, unchanged |
| Rahul's saved marker | absent | `{"rule":"standard_penalty","target":6}` |

Aadhil confirmed on his phone: Rahul and Rithu now show correctly.

**The 862 on the dashboard is historical.** The card counts a rolling 7 days,
so it will keep showing those events until they age out. No new ones since
04:46:39 UTC.

### What I would like you to look at

1. **Sanity-check the new RPC.** It is yours by area and I wrote it at 6am.
2. **The `status = 'open'` pattern may exist elsewhere.** I only fixed the
   rollover path. Anything else that reads "current" data to reason about a
   *closed* month has the same latent bug, and it only shows on the 1st.
3. **This is untested in CI.** There is no test that closes a month after the
   canonical season has already flipped. That is the exact shape of this bug
   and nothing would have caught it.

---

## 13. The lazy month close — Aadhil considers this a bug, not a design

Separate from §12 and still open.

The blob rollover is computed in memory on every read but only **persisted on a
write**. A Bloc nobody touches can sit half-closed indefinitely: canonical says
closed, the blob still says the month is current. During 1 October that state
lasted hours and hid real settlements.

His words: *"that shouldn't be the case, that's not the most optimal or
efficient way, it's a bug, it's a delay."*

He would like the close to write itself as soon as the month turns rather than
waiting for someone to happen to save something. Flagging rather than
designing it — your call on shape.

---

## 14. Two money bugs found and fixed, both the same shape

Both are the "same figure computed in more than one place" problem from
`AGENTS.md` §7, and both were wrong in the copy nobody re-checked.

**`cc6c990` — the all-time leaderboard charged exempt members.**
`HistoryPage.jsx`'s money loop checked only `excused`, so a Solo month or a
Training Wheels month still counted as a failure to hit target.
`PlayerProfile.jsx` had it right all along. Verified against production:
Sarandawgs August, Rithu and Deveen both had Training Wheels and were each
shown owing 15 — both now 0. It also invented winnings, because the pot was
funded by those phantom fines: mindi 30 → 0.

**`9b25e74` — Most Diverse counted the category, not the activity.**
It read `log.type`, the five broad buckets. Basketball, Padel, Badminton and
Volleyball all collapse into "Sports", so four different sports scored one. Now
reads `getLogDisplayActivity`. Go To Da Gym September: Isira with 4 becomes
Aadhil with 6. Ties were already broken on count then name; unchanged.

---

## 15. A real bug I found and did **not** fix — prorated target can exceed the full target

**Active divas, September: `season_overrides.prorated_mas` is 12 while
`seasons.min_target` is 11.** A prorated target should only ever reduce.

Proration is `round(daysRemaining / daysInMonth × minTarget)`, computed once
when the admin chooses it (`src/App.jsx:3453`). Active divas was created on 2
September — 29 of 30 days — so with a target of 12 the prorated value was 12.
The Bloc target was later lowered to 11 and **nothing recomputed the override**.
I checked the settings-update path; it never touches `season_overrides`.

Nobody was harmed here — Emma logged 0 and Masha cleared either way — but any
Bloc that lowers its target mid-month leaves its members on a higher one.

Suggested fix: recompute the prorated target when the Bloc target changes, and
clamp it so it can never exceed the full target. Not done; it is a behaviour
change and deserves a decision rather than a 6am patch.

**Related trap, worth knowing:** starting on the 2nd of a 30-day month gives
29/30, so a "prorated" target is 97% of the full one. Two & a half men starting
on the 27th got 2. Both correct by the formula, wildly different in feel.

---

## 16. Production data I changed, and the backups

All at Aadhil's explicit request, all verified afterwards by running the real
settlement code against production.

| Bloc | Member | Change |
| --- | --- | --- |
| StavanGang | Marlène | July sit-out; August + September Solo, target 5 |
| Active divas | Emma | September Training Wheels |
| Sweat Equity | Manz | September Training Wheels |

Written to **both** `ante_core.season_member_status` and the blob, plus two
approved `solo_requests` rows for Marlène so the grants have a paper trail.
Verified with `buildDefaultSettlements` / `buildSettlementPairsForMonth`: none
of the three owes anything, and Bananaaaa's genuine September miss is untouched.

Backups, all read-only copies, safe to drop once you are satisfied:

```
ante_core.backup_solo_tw_2026_10_01_blob
ante_core.backup_solo_tw_2026_10_01_member_status
ante_core.backup_marlene_jul_aug_2026_10_01
ante_core.backup_blob_before_force_rollover_2026_10_01
```

**A correction worth keeping.** June was *not* a month Marlène owed for. Her
June target was prorated to 7 and she logged exactly 7. I twice reported people
as owing money by reading `seasons.min_target` instead of the frozen
per-member target. **Read `monthHistory[].memberTargets[name]`** — or
`season_overrides.prorated_mas` — never the Bloc MAS. Two confidently wrong
answers came from that: Two & a half men (real target 2, reported as 15) and
this one.

---

## 17. Training Wheels — two things that are not written down anywhere

Both came up when Aadhil asked for a Bloc's whole first month to be covered.

1. **The Bloc creator never gets Training Wheels.** `getCreatorMonthContext`
   returns null for the admin who created the Bloc that month, so they are not
   treated as a late joiner. Deliberate — they chose when to start and set the
   target — but it is not documented and it surprised us.
2. **There is no "whole Bloc's first month" switch.** `settings.trainingWheels`
   only controls whether the *offer* appears; the grant is per member, per
   month, by the member's own choice. Covering a Bloc's first month means
   writing a grant per member.

Recording both so the next person does not re-derive them.

---

## 18. Housekeeping that affects you

- **Worktrees moved.** `AGENTS.md` told every agent to create worktrees under
  `~/Documents/FERO`, which is iCloud-synced. By 1 October there were 27 there,
  25 holding a built `dist/`. `npm run lint` took 90s instead of 3, `git status`
  hung for minutes, and iCloud had started writing conflict duplicates
  (`config 2.xml`, `README 2.md`) **inside the repo**. 26 were deleted — every
  branch was already pushed — and `AGENTS.md` now says `~/Developer/FERO`
  (`eee3e91`). `git status` went from timing out at 120s to 0.04s.
  **Do not commit any file whose name ends in " 2" or " 3".**
- **`main` moved a lot this session:** `cc6c990`, `eee3e91`, `9b25e74`,
  `7ac1220`, `64fab2f`, `c9ce86a`. All deployed green.
- **Not run this session: `npm run lint` and `npm run build` on the last four
  commits.** Each file was syntax-checked with `node --check` and every Vercel
  Production build succeeded, but that is not the same thing. Worth a clean
  `lint` + `build` pass when you pick this up.

### §12 follow-up — holding after 6½ hours of real use

Re-checked at 11:19 UTC, 1 October.

| | |
| --- | --- |
| Last `rollover_skipped` ever | **04:46:39 UTC** |
| New skips since the fix | **0**, across 6½ hours |
| Blocs with September in the blob | **18 of 18** |
| October logs recorded since | 5 — normal use, closing cleanly |

The founder dashboard still reads **862 skipped in 7 days**. That is the
historical total inside a rolling 7-day window, not new failures; it will
decay on its own. If that number ever climbs again, the fix has regressed and
it is the first thing to look at.

---

## 19. Since this handover was written (updated 9 October)

Nothing below is in your area, but it is what changed while you were away, so
nothing here surprises you on Saturday.

- **Your §10.3 ask is done.** Both date-dependent suites are pinned to
  2026-09-15 (`689d9d9`, on `main`). CI has been green since. The pattern is
  the `NODE_OPTIONS` date shim you suggested, with `api/lift-log.js` imported
  after the clock is pinned.
- **The 1 October close held.** No new `rollover_skipped` since the fix. The
  next real test is the **1 November close** — the first full one since
  `c9ce86a`. First thing to check that morning is the founder dashboard's
  skipped-Bloc count.
- **`main` has moved a long way** — the Today and ended-month redesigns, the
  share stickers, and on 9 October a new **Profile tab** (the fifth tab is a
  member's own profile; History moved inside Month). All front-end. **No
  schema, API or RPC changes**, so none of it touches your work.
- **One server-side fix worth knowing:** inside a Bloc the account screen was
  rendered inside the comment-thread layer, so it only opened while a comment
  thread was open. Front-end only, now fixed.
- **Lint and build were run clean** on everything, which closes the gap §18
  flagged.
- **Nothing in your area was touched by anyone else.** The RLS migration, the
  rehearsal harness and the month-close check are exactly as you left them on
  27 September.

---

## 20. Scaling before launch — not started, and now the biggest thing left

**This is the one item on your list that blocks launch rather than tidying up
after it.** It has been open since 15 September and nothing has started. The
full write-up, with the evidence, is
[`scaling-before-launch-2026-09-15.md`](scaling-before-launch-2026-09-15.md);
this is the short version so it stops living only in an older doc.

### What happened

On 14 September, between 20:51 and 20:53 UTC, the database was overloaded.
Normal sub-second requests took **15–44 seconds** and some failed. A comment
looked like it had failed, was sent again, and was stored **twice**.

**It was not a crowd. About two to four phones had the app open.**

### Why so few phones could do that

Three things multiply together:

1. **Every refresh reads the whole app** — all members, all Blocs, about
   1.4 MB — and only then cuts it down to the one member asking.
2. **There is one global "something changed" counter.** Any action in any Bloc
   makes **every open phone** reload everything.
3. The database is on Supabase's smallest paid size (**Micro**, 1 GB).

So load grows with *people online × actions × total data*, not with member
count. At launch traffic this does not hold up, and **nobody knows the real
ceiling** because no load test has been run.

### What needs doing, in order

Each step ships and is testable on its own. All of it is your area except
Step 0.

| Step | What | Whose |
| --- | --- | --- |
| 0 | **Server size** Micro → Small (2 GB), ~$5/month more. A stopgap, not a fix. Takes the database offline ~2 minutes. **No record exists that this was ever done — please check the dashboard first.** | Aadhil |
| 1 | **Scope reads to the member's own Blocs.** The biggest single win. Keep `scopeReadableStateForUser` as the final filter, and scope the blob fallback the same way. | You |
| 2 | **A revision per Bloc** instead of one global `revision_clock`, and make the poll read-only (no `insert … on conflict` on every call). | You |
| 3 | **Stop sending past months on every refresh.** Inventory every reader of closed months first — settlement banners, redemption notes and profile stats all read them. | You |
| 4 | **Lighter mutations:** a one-Bloc membership check instead of a full-app read, plus a duplicate guard on `log-comment-create` (the 14 September double comment). | You |
| 5 | **Polling:** the 3-second comment poll, pausing polls while the page is hidden, and validating the JWT locally instead of calling `/auth/v1/user` on every request. | You |

### The number nobody has

**A load test is the only way to know how many members Fero can take.** Never
against production, and the sandbox cannot do it (it stubs the canonical
readers with empty results). The documented way is a **restore-to-new-project**
from a daily backup, driven by a local API build, then delete the scratch
project. Agree the target first: how many members online at once in the busiest
hour at launch.

### Why it matters more this week

Two outages in eight days (22 September Cloudflare, 29 September Supabase, §7)
both surfaced to members as *apparent data loss* rather than as an outage. The
same shape as 14 September. And the App Store submission is now the active
piece of work, so launch traffic stops being hypothetical.

### Done means

- A refresh costs the same whether the Bloc has 3 members or the app has 300.
- An action in one Bloc does not reload phones in other Blocs.
- Past months are not reloaded on every refresh.
- A load test at the agreed concurrency: no statement timeouts, no pool
  exhaustion, p95 reads under an agreed limit.
- A slow or failed comment says so, and sending again does not store it twice.
