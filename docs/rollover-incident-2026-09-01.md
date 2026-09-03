# Rollover Incident — 2026-09-01

Written: 2026-09-01, Europe/Oslo. Last updated 2026-09-01 evening.

Status: **I1, I2, I4 (alerting), I5 and I8's immediate correction are shipped to
production. I3, I4 (scheduling) and I8's permanent fix remain open.**

This is the tracking record for the 2026-09-01 rollover failure and everything
done in response. If you are picking this up cold, read the Summary, then
**"For the blob retirement"** — that section is the whole of what this incident
changed underneath the canonical migration, and it is the part most likely to
surprise someone working on that branch.

### Actions taken 2026-09-01

| When (UTC) | Action | Result |
| --- | --- | --- |
| 03:33 | Backup `2171` of `lift_log_state` at revision 2121, reason `pre-orphan-bloc-cleanup-2026-09-01` | Verified byte-identical to live before any change |
| 03:34 | Removed `op0-yneefj` and `rrrr-nq9r7f` from `state.groups` and `state.groupOrder` | 16 → 14 Blocs, 16 → 14 order entries, no trace of either key |
| 03:35 | Post-change integrity sweep | 0 orphans, 0 reverse orphans, 35 profiles unchanged, all 450 logs intact |
| ~03:40 | Rollover fired on first authenticated app open | All Blocs advanced to September (`2026-8`), August closed into history |
| 03:41 | Backup `2181` at revision 2122, reason `pre-gregorio-august-correction-2026-09-01` | Taken before the I8 correction |
| 03:42 | Removed Gregorio from the closed August snapshot; set his joined month to September in blob and canonical | Aug members 10 → 9, settlement now Rodri only, count audit 0 mismatches across 127 member-months |
| 07:56 | **PR #8 merged** — per-Bloc rollover isolation (I1) | Live |
| 14:39 | **PR #9 merged** — corrected the month-boundary account in this document | Live |
| ~17:20 | Migrations applied: `preserve_season_closed_at`, `add_system_events` | Inert until PR #10 merged |
| 17:25 | Supabase security advisor flagged both new RPCs as `PUBLIC EXECUTE`; revoked and granted to `service_role` | All four introduced warnings cleared |
| 17:38 | **PR #10 merged** — onboarding sign-in link, I5 fix, rollover alerting | Live |

The rollover fired at ~03:40 on the first authenticated app open after the
cleanup, before any code fix was deployed: the pre-fix code succeeded once the
Blocs that made it fail no longer existed. All Blocs advanced to September.

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
**Severity: critical. This was the outage. SHIPPED — PR #8, merged 2026-09-01 07:56 UTC.**
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

### I3 — Orphan-creation path
**Severity: high. The original hypothesis is DISPROVEN. A better one replaces it,
still unconfirmed.**

**Original hypothesis, now ruled out.** In the `leave-bloc` handler, last-member
deletion calls `deleteBlocFromCanonical(..., { throwOnError: true })` **first**,
then `persistOrSkipBlobMirror(...)`. If the blob mirror were skipped for
`leave-bloc`, the canonical row would go and the blob entry would survive —
exactly the I2 orphan shape.

It is not skipped. `lift_log_backups` holds **39 rows with a `leave-bloc:`
reason**, most recently 2026-08-30. Every one of those is a blob write. In
production `leave-bloc` mirrors to the blob, so it cannot be the source.

Determined from the write log rather than the environment variable, which is
more reliable: `BLOB_MIRROR_SKIP_ACTIONS` is stored as a Vercel **Secret** and is
write-only, so its value cannot be read back by anyone.

**Replacement hypothesis.** `BLOB_MIRROR_SKIP_ACTIONS` is set in Vercel scoped to
**Preview**, on branch `codex/create-group-canon`, last updated **2026-07-18**.
`op0-yneefj` and `rrrr-nq9r7f` were created **2026-07-16** and both still rolled
over correctly on 2026-08-01, so they lost their canonical rows after that.

If that preview branch points at the production Supabase project — which it will
unless a separate project was configured for previews — then any Bloc deletion
performed while testing on that preview skips the blob mirror by design, removes
the canonical row, and leaves the blob entry behind. That is the orphan shape
precisely, and the timeline fits.

**To confirm:** check whether the Preview environment's `SUPABASE_URL` points at
`bpvvvqjsfwmmfjvvijkd`. If it does, preview testing can orphan production Blocs,
which is worth knowing well beyond this incident.

**Live-risk note.** Mirror-skip is being rolled out in waves (see
`docs/blob-retirement-impact-2026-09-03.md`). Each wave that adds a delete-
capable action to the skip list makes this shape reachable in production too,
not just on a preview. Deleting a Bloc canonically while leaving the blob entry
is what took the September rollover down for every Bloc.

### I4 — Rollover has no safety net
**Severity: medium (design). Alerting shipped 2026-09-01; scheduling still open.**

**Alerting (done).** A skipped Bloc is now recorded to
`ante_core.system_events` and surfaced on the founder dashboard — quiet when
healthy, listing Bloc and reason when not. This matters more after I1 than
before it: the rollover fix makes a failing Bloc fail *silently* so the others
proceed, so silence no longer implies health. Summary logic is in
`src/lib/systemHealth.js` with 15 checks in `scripts/test-system-health.mjs`.

**Scheduling (open).** Everything below still stands.
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

#### Scheduling constraints, established 2026-09-01

- **Vercel is on the Hobby plan**: cron runs **once per day**, maximum two jobs,
  and one is already used by `/api/cron-purge-app-daily-activity`. Not enough
  granularity for a rollover.
- **Supabase is on Pro**, and `pg_cron` (1.6.4) and `pg_net` (0.20.0) are
  available though not installed. `supabase_vault` is already installed. So the
  scheduler can live in the database on any interval, calling a locked endpoint
  on the app, without a Vercel upgrade and without consuming the spare slot.
- Colombo is UTC+5:30, so a 15-minute schedule catches a half-hour-offset
  timezone within 15 minutes. Good, not exact.
- The rollover already reads each Bloc's own timezone, so a scheduler does not
  need to compute timezones. It only needs to invoke the existing path.

Not built. The case weakened once the 3am cutoff was understood: timing was 28
minutes out, not hours. The remaining argument is a dormant Bloc nobody opens.

### I5 — Confirming a settlement erased the season's closing timestamp
**Severity: low today, higher after blob retirement. Leak fixed 2026-09-01; the
two existing blanks are deliberately left.**

Two closed seasons carry `status = 'closed'` with `closed_at IS NULL`:

- Ctrl Alt De-feat, `2026-6` (Jul '26)
- Go To Da Gym, `2026-5` (Jun '26)

**Correction.** An earlier version of this document called these "residue from
an earlier partially-applied rollover". That was a guess and it was wrong. The
cause was found by audit and is specific and repeatable.

**Both were erased by a member confirming a settlement payment.** The two events
are identical in shape and each completed inside one second:

| When (UTC) | Bloc | Sequence |
| --- | --- | --- |
| 2026-07-30 15:39:31 | Go To Da Gym | Kisal's profile synced → **Jun '26 season rewritten, stamp erased** → "Kisal confirmed payment." posted |
| 2026-08-25 13:11:24 | Ctrl Alt De-feat | akijain2000 and Giang's profiles synced → **Jul '26 season rewritten, stamp erased** → "Giang confirmed payment." posted |

Both settlement confirmations that exist in production did this. A 100% rate,
and settlements become a monthly event from here.

**Mechanism.** `ensureSettlementConfirmationPrereqs` (`api/lift-log.js`) re-syncs
the Bloc, both profiles and **the month the settlement belongs to** before
recording the confirmation. Settlements only ever concern closed months, so it
always re-saves a closed month. It sources the closing time from the blob
snapshot:

```js
const closedMonth = (group.monthHistory || []).find(month => month?.key === monthKey) || null;
await syncSeasonToCanonical(group, monthKey, closedMonth ? "closed" : "open", closedMonth?.closedAt || null, ...);
```

**A blob `monthHistory` entry has no `closedAt` field.** Its keys are `key`,
`solo`, `year`, `label`, `month`, `counts`, `excused`, `settings`, `logsByUser`,
`settlements`, `memberTargets`. So `closedMonth?.closedAt` is always `undefined`,
null is sent, and the upsert wrote that null over a real timestamp.

**Fix (shipped).** Corrected in `upsert_ante_core_season` rather than at the call
site, because `add-log` passes the same null for a closed month and any future
caller would inherit the trap:

```sql
closed_at = case
              when excluded.status = 'closed'::ante_core.season_status
                then coalesce(excluded.closed_at, seasons.closed_at)
              else excluded.closed_at
            end
```

Closing never discards a timestamp already held; reopening still clears it.
Verified in a rolled-back transaction against a test Bloc: closed+null
preserves, closed+value overwrites, reopen clears.
Migration `20260901190000_preserve_season_closed_at.sql`.

**The two existing blanks are left blank on purpose.** They could be inferred —
rollover closes all due Blocs in one batch under a shared timestamp, and the
other July seasons all closed at `2026-08-01 01:18:22.511961+00` — but that is
inference, and an inferred timestamp is indistinguishable from a recorded one
once written. There is no backup to check against: `closed_at` exists only in
canonical, and `lift_log_backups` stores blob state.

**Why this matters more after blob retirement.** Today nothing reads `closed_at`
for display — it is written and never read, so the user-visible impact is zero.
Once canonical becomes the source of truth, a field that silently erases itself
stops being a harmless copy and becomes the record.

### I6 — No test coverage for rollover
**Severity: medium. Addressed 2026-09-01: `scripts/test-rollover-isolation.mjs`
(25 checks) and `scripts/test-system-health.mjs` (15 checks). Both run without a
backend. The original text below stands as the reason they exist.**
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

## For the blob retirement

Everything from 2026-09-01 that touches the blob, `ante_core`, or the
relationship between them. If you own the canonical migration, this section is
the briefing; the rest of the document is background.

### 1. Blob and canonical can now legitimately disagree for one Bloc

`persistState` used to treat a rollover as all-or-nothing across every Bloc. It
now skips a Bloc whose canonical writes cannot succeed and rolls that Bloc back
to its pre-rollover state, so the others still advance.

**Consequence for parity checking:** a skipped Bloc sits at its old month in the
blob while the rest have moved on. **This is expected, not a parity defect.**
`scripts/blob-parity-gate.mjs` should not read it as one.

The skip is now recorded — see item 4 — so a divergence has an audit trail
rather than being inferred from a diff.

Two layers, both scoped to the rollover sync:

- **Pre-flight.** A Bloc with no `ante_core.blocs` row is skipped *before* any
  write, so no partial canonical state is created. `fetchAnteBlocs()` returns
  `null` when it could not read the list at all — that means "could not verify",
  never "no Blocs exist", and treating it as the latter would skip every Bloc
  and stall the month from the other direction. Pinned by test.
- **Per-Bloc try/catch.** Any other failure reverts that one Bloc and continues.
  It keeps its old month and is retried on the next read.

**Residual risk worth knowing:** if a Bloc fails *midway* — season closed
canonically, member rows not yet written — the blob rollback leaves the two
briefly disagreeing for that Bloc. Reads apply the blob veto so it is not
user-visible, and the season upsert is idempotent so the next successful pass
corrects it. Eliminating it entirely needs one transactional DB function; not
done, deliberately.

### 2. Production data changed today

Retake any parity baseline captured before 2026-09-01.

| What | Detail | Backup |
| --- | --- | --- |
| Two orphan Blocs deleted from the blob | `op0-yneefj`, `rrrr-nq9r7f` — present in `lift_log_state.state.groups`, absent from `ante_core.blocs`. Both empty, both admin+sole member Aadhil, zero logs. Removed from `groups` and `groupOrder`. | `lift_log_backups` id **2171**, revision 2121 |
| One member's August record corrected | Gregorio removed from Ctrl Alt De-feat's closed `2026-7` snapshot (counts, targets, excused, settlements, logsByUser, solo) **and** `season_member_status.joined_for_month` set false canonically. `joinedMonthByName.Gregorio` set to `2026-8` in the blob and `bloc_members.joined_month_key` to `2026-8` in canonical. | `lift_log_backups` id **2181**, revision 2122 |

Post-change sweep: **0 orphans, 0 reverse orphans**, 35 profiles unchanged, all
450 August logs intact, count audit 0 mismatches across 127 member-months.

Rollback for either is `update public.lift_log_state set state = (select state
from public.lift_log_backups where backup_id = <id>) where id = true;` — note
that only restores the blob, not the canonical edits.

### 3. Settlement confirmations already live only in canonical

Found while auditing I5, and the most directly relevant fact here.

The two settlement confirmations in production wrote to `ante_core`
(`settlement_confirmations`, `profiles`, `seasons`, `bloc_messages`) and
produced **no blob write at all** — there is no `lift_log_backups` row at either
moment.

**Correction.** An earlier version of this section attributed that to
`BLOB_MIRROR_SKIP_ACTIONS`. It is not configuration. The
`settlement-confirm-paid` handler contains no blob write of any kind — no
`persistState`, no `persistOrSkipBlobMirror`. It is canonical-native by design.

That makes the conclusion stronger, not weaker: **for this feature the blob is
already retired, and not by a flag that could be switched back.** Confirmation
state has no blob copy to fall back on and none to compare against. A parity
gate covering settlements should expect canonical-only, and any rollback plan
assuming a blob shadow does not apply here.

### 4. New canonical-only table: `ante_core.system_events`

Records failures that belong to no user, so a skipped Bloc surfaces on the
founder dashboard instead of dying in a 400 nobody reads.

- Columns: `id`, `event_type`, `bloc_key`, `detail`, `occurred_at`.
- Written by `record_ante_core_system_event`, read by
  `read_ante_core_system_events`. Both `security definer`, both granted to
  `service_role` only.
- Written from `persistState` when a Bloc is skipped. Best-effort: it swallows
  its own errors, because alerting must never be the reason a rollover fails.
- Self-trimming to 90 days, so it needs no scheduled job.
- **No blob counterpart, by design.** Do not add one.

`ante_core.app_usage_events` could not be reused: its `profile_id` is `NOT NULL`
and a rollover failure has no user.

Migration `20260901191500_add_system_events.sql`.

### 5. `upsert_ante_core_season` changed

The `on conflict` clause no longer overwrites `closed_at` with null when the
incoming status is `closed`. Full reasoning in I5. Relevant because this is the
function every season write in the app goes through, and because it is an
example of canonical *losing* information that the blob never held — the failure
mode to watch for as canonical becomes authoritative.

### 6. The blob snapshot shape is missing a field canonical has

A blob `monthHistory` entry has no `closedAt`. Canonical `seasons` has
`closed_at`. Any code that round-trips a closed month through the blob therefore
cannot reproduce that value, which is exactly what caused I5. Worth checking
whether other canonical columns have the same problem before the blob stops
being the source of truth.

### 7. Unchanged and still true

- The blob veto in read composition is untouched. Canonical membership is still
  ignored unless the blob already knows the user.
- `scripts/blob-parity-gate.mjs` and `scripts/blob-remirror.mjs` were not
  modified.
- Both of today's package.json additions are npm script entries only.

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
2. Does the Preview environment's `SUPABASE_URL` point at the production
   Supabase project? If so, preview testing can orphan production Blocs. (I3)
3. Does `upsert_ante_core_season` have siblings that also overwrite a canonical
   column with a null the blob never held? (I5, item 6 in the blob section)
4. Confirmed not the cause: `leave-bloc`, which mirrors to the blob in
   production (39 backup rows). How the `op0`/`rrrr` canonical rows were removed
   after 1 August — the
   `leave-bloc` last-member path, an admin delete, or manual cleanup? Answering
   this decides whether I3 is the real factory or a red herring.
