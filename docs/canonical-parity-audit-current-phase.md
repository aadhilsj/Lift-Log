# Canonical Parity Audit — Current Migration Phase

This document is the durable parity gate for the current migration phase.

It is intentionally narrower than the older projection-era parity tooling in
[`scripts/canonical-parity-report.mjs`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/scripts/canonical-parity-report.mjs).

Use this document when evaluating whether the current canonical read overlays are
safe to keep expanding.

Current live read overlays:
- profiles
- bloc settings
- `season_overrides`
- current-month logs
- current-month excused
- current-month sit-out requests
- closed-season `monthHistory`
- guarded canonical `memberOrder`
- guarded canonical `groupOrder`
- canonical open-season `lastMonth` for covered groups

The main remaining risk is no longer "does the overlay code run?".
The main risk is "does canonical data fully and correctly cover what the overlay
is now authoritative for?".

## When To Run This Audit

Run these checks:
- before any broader read-cutover slice
- after importer/backfill reruns
- after any canonical data repair touching historical seasons/logs/reactions
- before deciding that canonical ordering can replace blob ordering more broadly

## Audit Areas

### 1. Historical workout count parity

Purpose:
- verify that `season_member_status.workout_count` still matches the actual
  number of canonical `workout_logs` rows for the same member+season
- this matters because the closed-season `monthHistory` overlay now reads
  `counts[name]` from canonical `season_member_status.workout_count`

Pass condition:
- zero rows returned

```sql
select
  b.legacy_group_key,
  s.month_key,
  sms.display_name_snapshot,
  sms.workout_count                                              as canonical_count,
  count(wl.id) filter (where wl.id is not null)                  as actual_log_rows
from ante_core.season_member_status sms
join ante_core.seasons s on s.id = sms.season_id
join ante_core.blocs b on b.id = s.bloc_id
left join ante_core.workout_logs wl
  on wl.season_id = s.id
  and wl.owner_display_name = sms.display_name_snapshot
where s.status = 'closed'
  and b.legacy_group_key is not null
group by b.legacy_group_key, s.month_key, sms.display_name_snapshot, sms.workout_count
having sms.workout_count != count(wl.id) filter (where wl.id is not null)
order by b.legacy_group_key, s.month_key, sms.display_name_snapshot;
```

Do not use the same count-parity query for open seasons.

Why:
- current open-season logs are canonical and already overlaid from
  `ante_core.workout_logs`
- `season_member_status.workout_count` is still primarily a rollover /
  closed-season snapshot path, not the authoritative live current-month counter
- so open-season count mismatches are expected under the current architecture
  and are not by themselves a bug

### 2. Historical reaction coverage

Purpose:
- identify closed seasons where canonical reactions may be incomplete relative
  to blob history
- this matters because historical `monthHistory.logsByUser[*].reactions` is now
  served from canonical log rows when the month overlay takes authority

Pass condition:
- no unexplained gaps after comparing against blob history for the same months

```sql
select
  b.legacy_group_key,
  s.month_key,
  count(r.workout_log_id) as canonical_reaction_count
from ante_core.workout_reactions r
join ante_core.workout_logs wl on wl.id = r.workout_log_id
join ante_core.seasons s on s.id = wl.season_id
join ante_core.blocs b on b.id = s.bloc_id
where s.status = 'closed'
  and b.legacy_group_key is not null
group by b.legacy_group_key, s.month_key
order by b.legacy_group_key, s.month_key;
```

Support query:

```sql
select
  b.legacy_group_key,
  s.month_key,
  count(distinct wl.id) as log_count,
  count(r.workout_log_id) as reaction_count
from ante_core.workout_logs wl
join ante_core.seasons s on s.id = wl.season_id
join ante_core.blocs b on b.id = s.bloc_id
left join ante_core.workout_reactions r on r.workout_log_id = wl.id
where s.status = 'closed'
  and b.legacy_group_key is not null
group by b.legacy_group_key, s.month_key
order by b.legacy_group_key, s.month_key;
```

Interpretation:
- a month with logs but zero reactions is not automatically wrong
- it becomes a problem only if blob history for that same month shows reactions

### 3. Historical settlement parity

Purpose:
- verify that canonical settlement state matches blob settlement state for
  overlaid historical months

Pass condition:
- no blob/canonical status mismatches for reviewed months

```sql
select
  b.legacy_group_key,
  s.month_key,
  sms.display_name_snapshot,
  sms.settlement_status,
  sms.settlement_settled_at,
  sms.settlement_updated_at
from ante_core.season_member_status sms
join ante_core.seasons s on s.id = sms.season_id
join ante_core.blocs b on b.id = s.bloc_id
where s.status = 'closed'
  and b.legacy_group_key is not null
  and sms.settlement_status is not null
order by b.legacy_group_key, s.month_key, sms.display_name_snapshot;
```

Support query:

```sql
select
  b.legacy_group_key,
  s.month_key,
  sms.display_name_snapshot
from ante_core.season_member_status sms
join ante_core.seasons s on s.id = sms.season_id
join ante_core.blocs b on b.id = s.bloc_id
where s.status = 'closed'
  and b.legacy_group_key is not null
  and sms.settlement_status is null
order by b.legacy_group_key, s.month_key, sms.display_name_snapshot;
```

Interpretation:
- rows from the first query should be cross-checked against blob
  `monthHistory[monthKey].settlements[name]`
- rows from the second query are only a problem if blob marks any of those
  members as settled

### 4. Bloc sort_order coverage

Purpose:
- measure readiness for any future top-level `groupOrder` reconstruction

Pass condition:
- for canonical-first top-level ordering, zero active legacy-keyed blocs with
  null `sort_order`

```sql
select
  b.legacy_group_key,
  b.name,
  b.sort_order
from ante_core.blocs b
where b.legacy_group_key is not null
  and b.sort_order is null
order by b.legacy_group_key;
```

Support query:

```sql
select
  b.legacy_group_key,
  b.name,
  b.sort_order,
  b.updated_at
from ante_core.blocs b
where b.legacy_group_key is not null
order by b.sort_order nulls last, b.legacy_group_key;
```

### 5. Bloc member sort_order coverage

Purpose:
- measure readiness for canonical ordering authority inside blocs

Pass condition:
- for canonical-first `memberOrder`, zero active auth-linked members with null
  `sort_order`
- until then, guarded blob fallback remains required

```sql
select
  b.legacy_group_key,
  bm.display_name_snapshot,
  bm.sort_order,
  bm.joined_at
from ante_core.bloc_members bm
join ante_core.blocs b on b.id = bm.bloc_id
where b.legacy_group_key is not null
  and bm.left_at is null
  and bm.sort_order is null
order by b.legacy_group_key, bm.display_name_snapshot;
```

Support query:

```sql
select
  b.legacy_group_key,
  bm.sort_order,
  bm.display_name_snapshot,
  bm.joined_at
from ante_core.bloc_members bm
join ante_core.blocs b on b.id = bm.bloc_id
where b.legacy_group_key is not null
  and bm.left_at is null
order by b.legacy_group_key, bm.sort_order nulls last, bm.display_name_snapshot;
```

### 6. Open-season status interpretation

Purpose:
- avoid false-positive audits against open-season `season_member_status`

Important:
- absence of an open-season `season_member_status` row for a member with
  zero logs and no excused state is not automatically a bug
- current open-season reads use:
  - `workout_logs` for logs
  - `season_member_status` rows with `excused = true` for excused state
  - `sit_out_requests` for sit-out decisions
- so a bloc can behave correctly even if some zero-log / non-excused active
  members do not yet have open-season status rows

What is still worth checking on open seasons:
- logs and reactions exist where expected
- excused members have canonical `season_member_status` rows
- sit-out requests exist where expected
- season overrides exist where expected
- open `seasons` rows exist for the active blocs

## What Counts As Healthy Right Now

For the current phase, "healthy" means:
- no evidence of count drift on historically overlaid months
- no unexplained reaction loss on reviewed historical months
- no settlement mismatches on reviewed historical months
- new live writes are populating bloc/member `sort_order`
- guarded blob fallback is still in place where canonical ordering is incomplete
- open-season `season_member_status.workout_count` drift is not treated as a
  blocker until open-season status counts become an explicit canonical live
  authority surface

It does NOT require:
- full canonical authority over top-level `groupOrder`
- full canonical authority over every `memberOrder`
- blob retirement

## Recommended Next Step After This Audit

If the queries above look clean enough, the next likely bounded slice is:
- broader open-season parity review followed by the next bounded current-state
  or write-authority cutover slice

Do not start that slice if:
- many active legacy-keyed blocs still have null `sort_order`
- current production evidence suggests blob and canonical ordering are diverging

## References

- [`api/lift-log.js`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js)
- [`scripts/state-to-canonical.mjs`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/scripts/state-to-canonical.mjs)
- [`scripts/canonical-parity-report.mjs`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/scripts/canonical-parity-report.mjs)
- [`docs/relational-cutover-plan.md`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/relational-cutover-plan.md)
