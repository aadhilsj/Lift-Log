# Handover — Antè Relational Migration Prep

## Project / Environment
- Repo: `/Users/opera_user/Documents/Codex Space/Lift Log`
- Live app: [https://lift-log-nu.vercel.app](https://lift-log-nu.vercel.app)
- Supabase project id: `bpvvvqjsfwmmfjvvijkd`
- Current production backend is still the old blob-based system
- No production schema cutover has happened yet
- No production app behavior has been changed for the migration yet

## Big Picture
We are preparing to migrate Antè away from the single JSON blob backend and toward a proper relational SQL backend.

Current status:
- current app still runs on blob
- migration planning/tooling has been built locally
- backup snapshot has been taken
- next safe path is additive-only: create new canonical tables beside the existing system, then import/verify, then later cut over reads/writes gradually

## Important Constraint
We cannot use Supabase preview/dev branches because they require the Pro plan, and the user does not want to pay for that right now.

So the plan is:
- no branch-based DB testing
- additive-only production-safe schema rollout later
- no destructive changes
- blob remains safety net

## Backup Status
A fresh backup row was created in Supabase:
- `backup_id = 207`
- `reason = pre-sql-migration-snapshot`
- `state_revision = 259`

Live blob export was also saved locally.

Projection snapshot exports were also saved locally.

## Backup Files Exported By User
The user exported these CSVs from Supabase to Downloads:

- `/Users/opera_user/Downloads/Supabase Snippet Recent Lift Log Backup Status.csv`
  Current `lift_log_state` export
- `/Users/opera_user/Downloads/Supabase Snippet Recent Lift Log Backup Status (1).csv`
  `lift_log_projection_meta`
- `/Users/opera_user/Downloads/Supabase Snippet Recent Lift Log Backup Status (2).csv`
  `lift_log_projection_groups`
- `/Users/opera_user/Downloads/Supabase Snippet Recent Lift Log Backup Status (3).csv`
  `lift_log_projection_group_memberships`
- `/Users/opera_user/Downloads/Supabase Snippet Recent Lift Log Backup Status (4).csv`
  `lift_log_projection_group_logs`
- `/Users/opera_user/Downloads/Supabase Snippet Recent Lift Log Backup Status (5).csv`
  `lift_log_projection_month_history`
- `/Users/opera_user/Downloads/Supabase Snippet Recent Lift Log Backup Status (6).csv`
  `lift_log_projection_month_counts`
- `/Users/opera_user/Downloads/Supabase Snippet Recent Lift Log Backup Status (7).csv`
  `lift_log_projection_month_logs`
- `/Users/opera_user/Downloads/Supabase Snippet Recent Lift Log Backup Status (8).csv`
  `lift_log_projection_log_reactions`
- `/Users/opera_user/Downloads/Supabase Snippet Recent Lift Log Backup Status (9).csv`
  `lift_log_projection_profiles`

## Important Known Backup Issue
The exported `lift_log_projection_month_logs` file is incomplete because Supabase limited the results to 100 rows.

This is the very next thing the next chat should ask the user to do:

Run in Supabase:
```sql
select * from public.lift_log_projection_month_logs;
```

Then:
- remove or increase the bottom-right result limit so it is not capped at 100
- export again
- save it as a new file, e.g. `ante-projection-month-logs-full-backup-2026-06-07.csv`
- provide screenshot / confirm export

This is needed for full historical-log parity signoff.

## Migration Docs / Tooling Already Created Locally
These files exist locally in the repo:

- `/Users/opera_user/Documents/Codex Space/Lift Log/docs/relational-cutover-plan.md`
- `/Users/opera_user/Documents/Codex Space/Lift Log/docs/canonical-importer-design.md`
- `/Users/opera_user/Documents/Codex Space/Lift Log/supabase/canonical-schema.sql`
- `/Users/opera_user/Documents/Codex Space/Lift Log/scripts/state-to-canonical.mjs`
- `/Users/opera_user/Documents/Codex Space/Lift Log/scripts/canonical-parity-report.mjs`
- `/Users/opera_user/Documents/Codex Space/Lift Log/scripts/canonical-to-sql.mjs`

What they do:
- `relational-cutover-plan.md`: overall migration plan
- `canonical-importer-design.md`: importer design / mapping rules
- `canonical-schema.sql`: target relational schema draft
- `state-to-canonical.mjs`: converts current blob backup into canonical relational-shaped data
- `canonical-parity-report.mjs`: compares converted output against current exported backup CSVs
- `canonical-to-sql.mjs`: generates SQL load statements from the converted canonical output

## Importer / Tooling Status
The importer has already been tested locally against the real live backup export.

Importer output summary:
- profiles: 9
- payment_methods: 0
- auth_otps: 0
- blocs: 1
- bloc_members: 9
- seasons: 3
- season_member_status: 27
- workout_logs: 194
- workout_reactions: 2
- season_overrides: 0
- sit_out_requests: 0
- settlement_runs: 0
- settlement_entries: 0
- settlement_transfers: 0
- notification_jobs: 0

Parity check status:
- `failureCount = 0`
- `warningCount = 1`
- only warning is the truncated `projection_month_logs` CSV

## Important Schema Safety Change
The first schema draft originally used `public`, which would have been too exposed too early.

That was corrected locally:
- canonical future tables now live in a private schema: `ante_core`

Meaning:
- if/when we apply the schema, it should not interfere with the current live app
- existing blob/projection system remains untouched
- this is the right additive-only rollout strategy

## Git State
Committed:
- `0300c30` — `Add canonical migration planning and tooling`

But there are also local uncommitted changes after that commit:
- `docs/canonical-importer-design.md`
- `docs/relational-cutover-plan.md`
- `scripts/canonical-to-sql.mjs`
- `supabase/canonical-schema.sql`

And this handover doc was created locally too:
- `/Users/opera_user/Documents/Codex Space/Lift Log/docs/handover-2026-06-07-canonical-migration.md`

So the next chat should check `git status` before doing anything major.

## What Has NOT Happened Yet
- No new canonical tables have been created in Supabase
- No production DB migration has been run
- No read path has been cut over
- No write path has been cut over
- No old blob logic has been removed
- No settlements feature has been built on the new schema yet

## Recommended Next Steps
1. Re-export the full `lift_log_projection_month_logs` CSV without the 100-row cap.
2. Re-run the parity check so historical month logs can be fully signed off.
3. Inspect local git state and likely commit the private-schema safety changes.
4. Review `supabase/canonical-schema.sql` specifically as an additive-only production-safe migration.
5. If comfortable, the first real DB step later should be:
   - create `ante_core`
   - create the new canonical tables only
   - nothing destructive
   - no app cutover yet
6. After that:
   - generate/load imported canonical data
   - verify counts and shape
   - only then plan read cutover
   - write cutover much later

## Plain-English Status
We are still in the safe preparation stage.
The current app is unchanged.
The migration plan and tooling exist.
The backup exists.
The only immediate loose end is re-exporting the full historical `month_logs` CSV.
