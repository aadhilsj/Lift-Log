# Rollover Incident — 2026-09-01

Written: 2026-09-01, Europe/Oslo.
Status: **I2 and I8 corrected in production. I1 fixed on a branch awaiting
promotion. I3, I4, I5, I8's permanent fix still open.** This file is the
tracking record for the issues found.

### Actions taken 2026-09-01

| When (UTC) | Action | Result |
| --- | --- | --- |
| 03:33 | Backup `2171` of `lift_log_state` at revision 2121, reason `pre-orphan-bloc-cleanup-2026-09-01` | Verified byte-identical to live before any change |
| 03:34 | Removed `op0-yneefj` and `rrrr-nq9r7f` from `state.groups` and `state.groupOrder` | 16 → 14 Blocs, 16 → 14 order entries, no trace of either key |
| 03:35 | Post-change integrity sweep | 0 orphans, 0 reverse orphans, 35 profiles unchanged, all 450 logs intact |
| ~03:40 | Rollover fired on first authenticated app open | All Blocs advanced to September (`2026-8`), August closed into history |
| 03:41 | Backup `2181` at revision 2122, reason `pre-gregorio-august-correction-2026-09-01` | Taken before the I8 correction |
| 03:42 | Removed Gregorio from the closed August snapshot; set his joined month to September in blob and canonical | Aug members 10 → 9, settlement now Rodri only, count audit 0 mismatches across 127 member-months |

The rollover had not yet fired at the time of writing: it requires an
authenticated app open, and none had occurred since the cleanup. Production was
still running the pre-fix code, which now succeeds because the Blocs that made
it fail no longer exist.

Rollback if ever needed:

```sql
update public.lift_log_state
set state = (select state from public.lift_log_backups where backup_id = 2171)
where id = true;
```

Note: the originally drafted cleanup SQL supplied `backup_id` explicitly and
would have failed — the column is `GENERATED ALWAYS` identity. The statement
actually run omits it.

Audit method: read-only SQL against production (`bpvvvqjsfwmmfjvvijkd`) plus
source reading. `npm run audit:rollover-counts` could not run locally — see I7.

---

## Summary

The September month rollover is failing on every app open and being discarded.
Two empty test Blocs that exist in the legacy blob but no longer exist in
`ante_core` cause the canonical season write to fail, and because the rollover
persists all Blocs or none, **all sixteen Blocs stay on August**.

The month header reads September because the client derives it from the device
clock. Everything below it is August data. Every reported symptom follows from
that single mismatch.

Confirmed failure count: **50** failed rollover attempts between 01:28 and
02:51 UTC on 2026-09-01, one per app open, still ongoing.

Nothing is corrupted. August data is intact and the stored-vs-actual count
audit passes with zero mismatches across all 21 closed months. The rollover is
stuck, not destructive.

---

## Reported symptoms, and what each one actually is

Observed on Ctrl Alt De-feat at 04:50 Oslo.

| Symptom | Cause |
| --- | --- |
| Header says `SEPTEMBER · DAY 1/30` | Client-side, from the device clock. Correct. |
| Leaderboard still shows 26/20/18/12… | August counts. Season never closed. |
| `BLOC MONTH 112 workouts` | Exactly August's 112 logs for this Bloc. |
| "Jul '26 results are in" | True. August was never appended to `monthHistory`, so July really is the newest closed month on record. |
| CLEARED status tags | August counts measured against target. |
| Sit-out members reset | `excused` is keyed `2026-7`. The screen asks for `2026-8`, gets nothing, renders them as ordinary members. Confirmed: Cutie pie and akijain2000 both hold `{"2026-7": true}`. |

There is no second bug behind these. One root cause.

---

## Root cause

`persistState` in `api/lift-log.js` (~line 4592) performs the canonical-first
rollover sync. Every canonical write in that loop uses `throwOnError: true`, and
the blob write happens only after the entire loop succeeds:

```js
for (const { groupId, closedMonthKey, newMonthKey, closedAt } of rollovers) {
  await syncSeasonToCanonical(group, closedMonthKey, "closed", closedAt, { throwOnError: true });
  ...
}
const persisted = await persistStateToSupabase(safeState, reason);
```

`upsert_ante_core_season` raises `bloc not found for legacy_group_key: …` when
the Bloc has no `ante_core.blocs` row. PostgREST returns 400, the throw
propagates, and `persistStateToSupabase` is never reached. Nothing is written,
for any Bloc, and the next read repeats the identical failure.

Evidence: `POST | 400 | /rest/v1/rpc/upsert_ante_core_season`, 50 occurrences,
first at 2026-09-01T01:28:02Z, most recent at 02:51:57Z. No Postgres
ERROR-severity entries — the exception surfaces only as the PostgREST 400.

### Why it did not fire on 2026-08-01

`op0` and `rrrr` both rolled successfully on 1 August: each has `2026-6` in
`monthHistory` and `lastMonth: "2026-7"`. They were present in `ante_core.blocs`
at that time and their season writes succeeded. Their canonical rows were
removed sometime after 1 August while their blob entries survived.

The abort-on-first-failure behaviour was introduced 2026-07-10 (`a66eb1e`,
"make rollover canonical-first") and was never touched by the August work.

### Relationship to the August 2026 incident

Different failure, similar-looking screen. The 1 August fixes (`f93e6d5`,
`7ddfa9b`, `7f45373`, `6e91f2a`) all addressed **read composition after a
rollover that had completed**. On 1 August the rollover itself succeeded — all
July seasons closed at 01:18 UTC. Those fixes are intact and are not implicated
here. This incident is the rollover **failing to complete at all**.

Note that `7ddfa9b` ("Persist rollover during readable fetch") added the
read-path trigger that now re-attempts and re-fails on every GET. It did not
cause the fault; it made an existing fragility fire continuously.

---

## Issues

### I1 — One failing Bloc discards the rollover for all Blocs
**Severity: critical. This is the outage. Fixed on `fix/rollover-per-bloc-isolation`, not yet in production.**
`persistState` treats the rollover batch as all-or-nothing across every Bloc.
A single unsatisfiable canonical write blocks the month from advancing for
everyone. Self-healing is impossible: every retry hits the same Bloc.

### I2 — Two orphan Blocs in the blob with no canonical row
**Severity: critical (the trigger). Data, not code. RESOLVED 2026-09-01 03:34 UTC.**
`op0-yneefj` ("op0") and `rrrr-nq9r7f` ("rrrr"), both created 2026-07-16, both
admin+sole member `Aadhil` (`768de245-5b17-4292-b91c-804daaa3b217`), both with
**zero workout logs**. Present in `lift_log_state.state.groups`, absent from
`ante_core.blocs`.

A full sweep found **exactly these two** orphans and **no reverse orphans**
(no canonical Bloc missing from the blob).

Because the readable group set is now canonical-driven, these two are almost
certainly invisible in the Bloc switcher while still blocking the rollover.

### I3 — Suspected orphan-creation path
**Severity: high. Unconfirmed.**
In the `leave-bloc` handler (~line 9410), last-member deletion calls
`deleteBlocFromCanonical(..., { throwOnError: true })` **first**, then
`persistOrSkipBlobMirror(...)`. If the blob mirror is skipped for `leave-bloc`,
the canonical row is deleted and the blob entry survives — producing exactly the
I2 orphan shape.

Whether this is live depends on `BLOB_MIRROR_SKIP_ACTIONS` in the production
Vercel environment. The local `.env.local` value is redacted (`[SENSITIVE]`), so
this could not be confirmed from the workspace. **Check the Vercel environment
variable before designing the fix.** If `leave-bloc` is listed, this is an
active orphan factory and I2 will recur.

### I4 — Rollover has no safety net
**Severity: medium (design).**
Rollover is lazy and read-triggered only; `vercel.json` schedules just
`/api/cron-purge-app-daily-activity` at 03:00. The month therefore advances at
whatever moment the first person opens the app, and a Bloc nobody opens rolls
over late. It also means a rollover failure is silent — there is no alert, and
the only signal is a 400 buried in the edge logs.

**The month boundary is 03:00 local, not midnight.** `LEAGUE_CUTOFF_HOUR = 3`
(`api/lift-log.js:6`, `src/lib/appState.js:9`): a Fero day runs 3am to 3am, and
anything before 3am belongs to the previous day. `getLeagueMonthKey` applies
that cutoff, so the month key flips at 03:00 on the 1st in each Bloc's own
timezone.

Timing on 2026-09-01 was therefore much better than the raw clock suggests:

- `Asia/Colombo` (UTC+5:30) rolled at 2026-08-31T21:31Z = **03:01 local**, one
  minute after its cutoff.
- `Europe/Oslo` (UTC+2) reached its cutoff at 01:00Z; the first app open was at
  01:28Z, so it was **28 minutes late**, not the several hours a midnight
  boundary would imply.

The real exposure is therefore not a few hours' drift on an active Bloc. It is
a **dormant Bloc that nobody opens for days**, and the absence of any alert when
a rollover fails.

#### Validated "is a rollover due?" probe

Any scheduled rollover should not pull the whole blob on every tick just to ask
whether there is work: the blob is ~471 kB, so a 15-minute schedule would move
over 1 GB a month for nothing. This answers the question inside the database and
returns one integer.

It applies the 3am cutoff by subtracting three hours from local time, which is
exactly equivalent to the JS rule (`if (hour < 3) date -= 1 day`). An earlier
draft of this probe compared against the plain calendar month and was wrong
between 00:00 and 03:00 on the 1st — it would have reported work due for three
hours before the app agreed. That direction is merely wasteful, never a missed
rollover, but the version below is the correct one.

```sql
select count(*) as blocs_due
from public.lift_log_state, lateral jsonb_object_keys(state->'groups') k
where (state->'groups'->k->>'lastMonth') is distinct from (
  extract(year from ((now() at time zone coalesce(
    state->'groups'->k->'settings'->>'timeZone', 'Europe/Oslo')) - interval '3 hours'))::int::text
  || '-' ||
  (extract(month from ((now() at time zone coalesce(
    state->'groups'->k->'settings'->>'timeZone', 'Europe/Oslo')) - interval '3 hours'))::int - 1)::text
);
```

Verified against nine boundary cases including 02:59 vs 03:00 on the 1st, the
exact minute Gregorio joined, and 1 January 02:00 (which must resolve to
December of the previous year). All nine matched the JS rule. Run live on
2026-09-01 it returns 0 across all 16 Blocs, which is correct.

### I5 — Two closed seasons with a null `closed_at`
**Severity: low. Pre-existing data inconsistency.**
- Ctrl Alt De-feat, `2026-6` (Jul '26)
- Go To Da Gym, `2026-5` (Jun '26)

Both `status = 'closed'` with `closed_at IS NULL`. Every other closed season has
a timestamp. Likely residue from an earlier partially-applied rollover. No
known user-visible effect; recorded so it is not mistaken for new damage.

### I6 — No test coverage for rollover
**Severity: medium.**
`scripts/` contains no rollover test. `rolloverStateIfNeeded` and
`rolloverGroupIfNeeded` are not exported from `api/lift-log.js`, so no test can
reach them. The month boundary is the single most incident-prone path in the
product and is the only major one with nothing pinning it.

`scripts/audit-rollover-counts.mjs` checks stored-vs-actual counts *after* a
rollover; it cannot detect a rollover that never ran. It passed clean during
this outage.

### I7 — Local environment cannot run the audit or API scripts
**Severity: low (workflow).**
`.env.local` holds `[SENSITIVE]` placeholders for `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` — the file was pulled from Vercel, which redacts
them. `npm run audit:rollover-counts` fails with 401, as will any script needing
backend access. This audit was completed by other means, but it blocks routine
verification.

### I8 — Joining late in a month can enrol someone in the month that is closing
**Severity: high. Open — needs a product decision, not a patch.**

Gregorio joined Ctrl Alt De-feat at 2026-08-31T23:43:48Z, which is 01:43 on
1 September in Oslo, the Bloc's own timezone.

**Correction (2026-09-01): the app did not put him in the wrong month.** An
earlier version of this document claimed he "joined in September by any reading
a member would recognise". That was wrong, and the error mattered enough to
correct in place rather than quietly. Under `LEAGUE_CUTOFF_HOUR = 3` a Fero day
runs 3am to 3am, so 01:43 on 1 September **is 31 August** — the last Fero-day of
the month. Enrolling him in August was the designed behaviour.

The real defect is narrower, and worse for being correct-by-design: a member who
joins in the final hours of a month is prorated to a target of **1 workout** for
the fraction of a day remaining, and is fined for missing it. Gregorio logged
none in those two hours, so the closed month recorded him as having missed and
billed him 250 NOK.

Money consequences of a wrong enrolment are not contained to the person
affected. Because the fee model escalates with the number of members who miss,
his presence changed two other people's figures:

| | As recorded | After correction |
| --- | --- | --- |
| Gregorio | owed 250 NOK | owes nothing |
| Rodri | owed 250 NOK | owes 200 NOK |
| Giang received | 500 NOK | 200 NOK |

Corrected in production 2026-09-01 (backup `2181`). See the actions table above.

**Why this is not simply "late joiners join next month".** The founder has
explicitly said the rule should not be that literal, and the reasons are worth
recording before anyone reaches for the obvious patch:

- "Late" has no self-evident threshold. The last day? The last week? A fixed
  cut-off would be arbitrary and would surprise people near the boundary.
- Proration already exists to handle mid-month joiners and works correctly for
  the ordinary case. The defect is at the very end of the month, not with
  proration itself.
- The month assignment was correct, so a rule that reassigns "late" joiners to
  the next month would be fixing the wrong thing. Gregorio genuinely joined on
  31 August under the 3am rule. What failed was the *target*, not the month: a
  1-workout target for a two-hour membership is not a commitment anyone agreed
  to, and it carried a 250 NOK penalty.
- A prorated target below some floor is arguably not a real target at all.
  Whether the answer is a minimum target, a minimum membership duration before
  penalties apply, or excusing the first partial month, is the decision to make.
- A join that lands in a month with a target the member cannot physically meet
  is the actual failure, whatever the calendar says.

Note that a scheduled rollover (I4) does **not** fix this. Even with the month
turning at exactly 03:00, someone joining at 02:00 still lands in the closing
month with a near-zero target. I4 shrinks the *lateness* of the boundary; it
does not change what happens to someone who joins just before it.

**Status: to be designed. Do not implement a threshold rule without agreeing
the behaviour first.**

---

## Verified unaffected

- Stored vs actual workout counts: **0 mismatches** across 21 closed months.
- Orphan sweep: exactly 2 blob-only Blocs, 0 canonical-only.
- August logs intact: 450 logs across 5 Blocs, latest 2026-08-31T22:11Z.
- Timezone rollover logic correct: Asia/Colombo Blocs rolled at 03:01 local,
  one minute after the 03:00 cutoff.
- No Postgres ERROR/FATAL entries in the incident window.

---

## Open questions

1. What should happen when someone joins a Bloc in the closing hours of a
   month, or in the gap before its rollover has fired? (I8 — to be designed)
2. Is `leave-bloc` present in production `BLOB_MIRROR_SKIP_ACTIONS`? (I3)
3. How were the `op0`/`rrrr` canonical rows removed after 1 August — the
   `leave-bloc` last-member path, an admin delete, or manual cleanup? Answering
   this decides whether I3 is the real factory or a red herring.
