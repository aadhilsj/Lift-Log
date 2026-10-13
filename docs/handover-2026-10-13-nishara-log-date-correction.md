# Handover — 2026-10-13: Nishara's gym log moved from 11 to 12 October

## Request

The founder asked to change Nishara's gym log dated **11 October 2026** to
**12 October 2026** — it was meant to be the 12th.

## Before the changes

- Nishara (`Nishara`, canonical profile `5362ac2f-9ed0-4bc6-bb10-b00275daf816`)
  has exactly one log on 11 October 2026: ID `1791766284757856`, type `Gym`,
  Bloc **Go To Da Gym** (`legacy-group`, canonical bloc
  `7703d58c-4c64-32b8-eee7-4845077d5093`), season
  `fbe636d6-7a13-4469-932b-d16936c3acf8` (`month_key` `2026-9`, i.e. October,
  still open — `closed_at` is null), photo present, `verified_via` `photo`,
  `created_at` `2026-10-12T00:51:24.757Z`.
- It is her only October log on either the 11th or the 12th, so **the two-a-day
  cap is not touched** — the 12th had no log at all before this change.
- Both stores agree on the date: the blob
  (`state.groups['legacy-group'].logs['Nishara']`, 7 October entries) and
  `ante_core.workout_logs`. No reactions (0) and no comments (0) reference the
  log, so nothing else points at it.
- The move is **inside the same month**, so no season, workout count, target,
  pace or settlement figure changes. Nishara has no
  `season_member_status` row in that October season (only Deyhan and
  Santushni do, both at 0), so there is no stored count to keep in step.
- Only the `date` / `workout_date` field changes. `id`, `createdAt`, type,
  photo and verification are left exactly as they were.
- **Backup:** `ante_core.backup_nishara_log_date_2026_10_13` holds the full
  blob state and the canonical row as they were at `00:49 UTC` on 13 Oct.
  Not readable by `anon` or `authenticated` (checked).
- **Rollback** is two statements, setting the same two fields back to
  `2026-10-11`.

## Work and verification

- 2026-10-13: backup table created and checked (blob captured, canonical date
  recorded as `2026-10-11`, grants closed to `anon`/`authenticated`).
- 2026-10-13: both dates moved to **2026-10-12** in one transaction —
  `ante_core.workout_logs.workout_date` (guarded on the old value being
  `2026-10-11`) and the blob entry's `date`, rebuilt in place so the array
  order is preserved.
- Verified three ways:
  1. Direct read: canonical `workout_date` and blob `date` both
     `2026-10-12`; `id`, `createdAt` (`2026-10-12T00:51:24.757Z`), type `Gym`,
     photo and `verified_via` `photo` all unchanged; still 7 October entries.
  2. Through the app's own read path,
     `public.read_ante_core_current_logs()`: Nishara's Go To Da Gym October
     logs now read 2, 3, 4, 7, 8, 9 and **12** October. No 11th, one 12th.
  3. Diffed the whole live blob against the backup copy: identical apart from
     that single `date` field. Total `workout_logs` row count 2168, unchanged.
- No app code changed, so there is nothing to lint, build or deploy. The fix is
  live the moment the app next reads, on web and on TestFlight alike.

## Commits

| Commit | Description | Live |
| --- | --- | --- |
| This commit | The date correction, before-state, backup and verification | Data live; docs only |

## Close-out

Nishara's gym log now sits on **12 October 2026** in production, in both the
blob and canonical, verified through the app's own read path. Nothing else was
changed: no other log, no count, no season, no code.

Rollback, if ever needed, is these two statements:

```sql
update ante_core.workout_logs
set workout_date = date '2026-10-11'
where id = '1791766284757856'::text;

update public.lift_log_state s
set state = jsonb_set(s.state, '{groups,legacy-group,logs,Nishara}',
      (select jsonb_agg(case when entry->>'id' = '1791766284757856'
                             then jsonb_set(entry,'{date}','"2026-10-11"'::jsonb)
                             else entry end order by ord)
       from jsonb_array_elements(s.state->'groups'->'legacy-group'->'logs'->'Nishara')
            with ordinality as t(entry, ord)));
```

The backup table `ante_core.backup_nishara_log_date_2026_10_13` can be dropped
once the founder is happy with the result.
