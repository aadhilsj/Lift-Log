# Production Canonical Import Runbook — 2026-07-02

This is the exact runbook for the current production data-migration pass.

Scope of this runbook:

- backfill current blob-backed production state into `ante_core`
- preserve existing canonical IDs for `profiles`, `blocs`, and `seasons`
- generate deterministic import SQL locally
- apply that SQL to production safely
- validate the import afterward

This is **not** the final blob-retirement cutover.

After this run:

- the live app can keep working exactly as it does now
- canonical history/backfill coverage should be materially improved
- no Vercel redeploy is required just to apply the import

Read alongside:

- [docs/handover-2026-07-01-data-migration-restart-plan.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-07-01-data-migration-restart-plan.md)
- [docs/canonical-importer-design.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/canonical-importer-design.md)
- [docs/canonical-parity-audit-current-phase.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/canonical-parity-audit-current-phase.md)

## What This Run Needs

You need four fresh exports from production:

1. one blob snapshot from `public.lift_log_state`
2. one canonical profiles export from `ante_core.profiles`
3. one canonical blocs export from `ante_core.blocs`
4. one canonical seasons export from `ante_core.seasons`

Important:

- export them immediately before the run
- do the import during a low-traffic window
- do not leave a long delay between export and SQL apply

Why:

- the generated SQL is an idempotent upsert
- if users write new data after the export but before the import, the import can
  re-apply older snapshot values onto the same canonical rows

## Recommended Working Directory

Use a fresh dated output folder, for example:

`migration-output/canonical-run-2026-07-02`

Do not overwrite old evidence folders.

## Phase 1 — Fresh Production Exports

### 1. Export live blob snapshot

Run in Supabase SQL editor:

```sql
select
  id,
  revision,
  updated_at,
  state
from public.lift_log_state
where id = true;
```

Export result as JSON.

Suggested local filename:

`~/Downloads/lift-log-state-2026-07-02.json`

The importer accepts a row object with `.state`, so this export shape is valid.

### 2. Export canonical profiles

Run:

```sql
select
  id,
  auth_user_id,
  email
from ante_core.profiles
order by created_at nulls last, id;
```

Export result as JSON.

Suggested filename:

`~/Downloads/ante-core-profiles-2026-07-02.json`

### 3. Export canonical blocs

Run:

```sql
select
  id,
  legacy_group_key
from ante_core.blocs
order by legacy_group_key nulls last, id;
```

Export result as JSON.

Suggested filename:

`~/Downloads/ante-core-blocs-2026-07-02.json`

### 4. Export canonical seasons

Run:

```sql
select
  id,
  bloc_id,
  month_key
from ante_core.seasons
order by bloc_id, month_key, id;
```

Export result as JSON.

Suggested filename:

`~/Downloads/ante-core-seasons-2026-07-02.json`

## Phase 2 — Generate Canonical Import Artifacts Locally

From repo root:

```bash
node scripts/state-to-canonical.mjs \
  ~/Downloads/lift-log-state-2026-07-02.json \
  migration-output/canonical-run-2026-07-02 \
  ~/Downloads/ante-core-profiles-2026-07-02.json \
  ~/Downloads/ante-core-blocs-2026-07-02.json \
  ~/Downloads/ante-core-seasons-2026-07-02.json
```

If your shell does not have `node`, use:

```bash
/Users/opera_user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  scripts/state-to-canonical.mjs \
  ~/Downloads/lift-log-state-2026-07-02.json \
  migration-output/canonical-run-2026-07-02 \
  ~/Downloads/ante-core-profiles-2026-07-02.json \
  ~/Downloads/ante-core-blocs-2026-07-02.json \
  ~/Downloads/ante-core-seasons-2026-07-02.json
```

Expected outputs:

- one `.json` file per canonical table
- one `.csv` file per canonical table
- `summary.json`
- `warnings.json`

## Phase 3 — Inspect Output Before SQL Generation

Check:

```bash
cat migration-output/canonical-run-2026-07-02/summary.json
cat migration-output/canonical-run-2026-07-02/warnings.json
```

Pass expectation:

- `warnings.json` should ideally be `[]`
- if warnings exist, inspect them before continuing

Warnings that should block the run:

- unresolved profile mappings for active real members
- unresolved admin mapping for a real bloc
- obviously wrong counts for `blocs`, `bloc_members`, `seasons`, or `workout_logs`

Warnings that are less scary but still worth reviewing:

- dead historical/test residue
- empty optional tables like `payment_methods`, `notification_jobs`, `settlement_runs`

## Phase 4 — Generate SQL

Run:

```bash
node scripts/canonical-to-sql.mjs \
  migration-output/canonical-run-2026-07-02 \
  migration-output/canonical-run-2026-07-02/canonical-import.sql
```

Or, if needed:

```bash
/Users/opera_user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  scripts/canonical-to-sql.mjs \
  migration-output/canonical-run-2026-07-02 \
  migration-output/canonical-run-2026-07-02/canonical-import.sql
```

Result:

- `migration-output/canonical-run-2026-07-02/canonical-import.sql`

Important behavior:

- this SQL uses additive/idempotent upserts
- it does `on conflict ... do update`
- it is not a destructive schema migration
- it can still overwrite stale values if your source export is stale

That is why the export and apply window should stay tight.

## Phase 5 — Optional Local Review Before Apply

Sanity-check the generated SQL:

```bash
sed -n '1,120p' migration-output/canonical-run-2026-07-02/canonical-import.sql
```

Spot-check:

- `insert into ante_core.profiles`
- `insert into ante_core.blocs`
- `insert into ante_core.bloc_members`
- `insert into ante_core.seasons`
- `insert into ante_core.season_member_status`
- `insert into ante_core.workout_logs`

## Phase 6 — Apply SQL To Production

In Supabase SQL editor:

1. open a new query
2. paste `canonical-import.sql`
3. run it once

Expected behavior:

- transaction begins
- all inserts/upserts run
- transaction commits

If it fails:

- stop there
- do not retry with edited partial SQL unless the failure reason is understood
- keep the exact generated SQL file as evidence

## Phase 7 — Immediate Post-Apply Validation

### 1. Row-count sanity

Run:

```sql
select 'profiles' as table_name, count(*) from ante_core.profiles
union all
select 'blocs', count(*) from ante_core.blocs
union all
select 'bloc_members', count(*) from ante_core.bloc_members
union all
select 'seasons', count(*) from ante_core.seasons
union all
select 'season_member_status', count(*) from ante_core.season_member_status
union all
select 'workout_logs', count(*) from ante_core.workout_logs
union all
select 'workout_reactions', count(*) from ante_core.workout_reactions
union all
select 'season_overrides', count(*) from ante_core.season_overrides
union all
select 'sit_out_requests', count(*) from ante_core.sit_out_requests;
```

Interpretation:

- total DB counts do not have to equal importer counts exactly if production
  already contains extra historical/test rows
- what matters is that counts do not look obviously wrong or unexpectedly low

### 2. Active member coverage by bloc

Run:

```sql
select
  b.legacy_group_key,
  b.name,
  count(*) filter (where bm.left_at is null) as active_member_count
from ante_core.blocs b
left join ante_core.bloc_members bm on bm.bloc_id = b.id
where b.legacy_group_key is not null
group by b.legacy_group_key, b.name
order by b.legacy_group_key;
```

Use this to compare against what the live app currently shows.

### 3. Historical workout count parity

Run the exact query from
[docs/canonical-parity-audit-current-phase.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/canonical-parity-audit-current-phase.md).

Pass condition:

- zero rows returned

### 4. Bloc member sort-order coverage

Run the exact query from the same audit doc:

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

Pass condition:

- ideally zero rows for active real blocs

## Phase 8 — App-Level Validation

No new deploy is required for the import itself, but the live app should still
be checked after the SQL apply.

Minimum spot-check:

1. Today loads
2. Results loads
3. History loads
4. member counts still look sane
5. a known closed month still renders correctly
6. a known player profile still renders historical data correctly

This is not a full UI release QA pass.
It is a migration sanity pass.

## What This Run Does Not Finish

This run does not:

- remove blob writes
- switch mutation hydration off `fetchWritableCurrentState()`
- remove `leftMemberNames`
- make canonical the sole write authority
- complete lifecycle cleanup for kick/leave/delete-account

Those are later phases.

## Recommended Execution Order In Plain English

1. take four fresh exports
2. run the importer locally
3. inspect `summary.json` and `warnings.json`
4. generate `canonical-import.sql`
5. apply it to production during a low-traffic window
6. run the parity queries
7. do a quick live app sanity pass

## Suggested Artifact Checklist

Keep these after the run:

- the four raw export files
- the generated `migration-output/canonical-run-2026-07-02/` folder
- the exact `canonical-import.sql` used
- screenshots or copies of the post-apply validation query results

That gives us rollback evidence and an audit trail for the next phase.
