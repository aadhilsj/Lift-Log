# QA Update — Importer ID Reconciliation

Date: June 18, 2026

This note records verification of the importer reconciliation changes used to
align importer-generated rows with live canonical IDs already present in
production.

## Context

The June 17 `bloc_members` backfill uncovered two importer identity problems:

- importer profile IDs did not always match live `ante_core.profiles.id`
- importer bloc IDs did not always match live `ante_core.blocs.id`

Those mismatches forced manual SQL reconciliation during the first successful
`bloc_members` repair.

## What changed

`scripts/state-to-canonical.mjs` now supports optional canonical exports for:

- `ante_core.profiles`
  - `id`
  - `auth_user_id`
  - `email`
- `ante_core.blocs`
  - `id`
  - `legacy_group_key`

When those JSON exports are provided, the importer now:

- reuses live canonical `profiles.id` instead of inventing conflicting profile IDs
- reuses live canonical `blocs.id` instead of inventing conflicting bloc IDs

## June 18 verification

Fresh exports were taken on June 18, 2026:

- blob state from `lift_log_state`
- canonical profiles from `ante_core.profiles`
- canonical blocs from `ante_core.blocs`

Importer rerun result:

- `profiles`: `24`
- `blocs`: `5`
- `bloc_members`: `27`
- `seasons`: `7`
- `workout_logs`: `274`
- `workout_reactions`: `67`
- `warnings`: `0`

Verified from importer output:

- `profiles.json` reused canonical profile IDs with `0` mismatches
- `blocs.json` reused canonical bloc IDs with `0` mismatches
- `bloc_members.json` contained `0` unrecognized canonical bloc IDs
- `seasons.json` contained `0` unrecognized canonical bloc IDs

## Conclusion

The importer is now verified to be canonical-aware for both:

- `profiles.id`
- `blocs.id`

This removes the specific identity-reconciliation blocker that previously
required manual SQL surgery during backfill runs.

It does not by itself complete all historical backfill work, but it means
future importer runs can use current canonical IDs directly for profiles and
blocs instead of generating conflicting IDs.
