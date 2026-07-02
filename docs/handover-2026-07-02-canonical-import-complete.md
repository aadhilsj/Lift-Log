# Canonical Import Completion — 2026-07-02

This note closes the current production canonical-import pass.

## Outcome

- production canonical import was applied successfully on July 2, 2026
- importer and SQL generator fixes were validated against the live run
- post-import parity checks passed after one manual legacy-row cleanup

## Import Scope

Imported/backfilled into `ante_core`:

- `profiles`
- `blocs`
- `bloc_members`
- `seasons`
- `season_member_status`
- `workout_logs`
- `workout_reactions`
- `season_overrides`
- `sit_out_requests`

Settlement tables were not part of this historical canonical backfill.

## Manual Cleanup Performed

One legacy duplicate workout row remained in production after the additive import:

- bloc: `ctrl-alt-de-feat-ocdti8`
- month: `2026-5`
- member: `Varun`
- removed workout log id: `1782581753428`

Reason:

- live canonical/blob-backed state recorded `8` workouts for Varun in that month
- legacy relational rows still contained `9`
- the extra row was a duplicate June 27 volleyball entry that no longer existed in canonical source state

The row was removed directly from `ante_core.workout_logs`.

## Final Verification

Verified after cleanup:

- canonical `season_member_status.workout_count` matched actual `workout_logs` counts
- full closed-season parity query returned `0 rows`
- active member ordering audit returned `0 rows`
- no remaining known canonical-count mismatches remain from this run

## Files That Matter

- [production-canonical-import-runbook-2026-07-02.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/production-canonical-import-runbook-2026-07-02.md)
- [scripts/state-to-canonical.mjs](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/scripts/state-to-canonical.mjs)
- [scripts/canonical-to-sql.mjs](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/scripts/canonical-to-sql.mjs)

## Status

This migration pass is complete.
