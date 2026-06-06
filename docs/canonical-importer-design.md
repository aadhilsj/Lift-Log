# Canonical Importer Design

This document defines how we import the current blob-backed state into the canonical relational schema in [`supabase/canonical-schema.sql`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/canonical-schema.sql).

It is a design for migration tooling only. It does not change production behavior.

## Importer Goal

Given one current app-state snapshot, produce deterministic relational records for:

- `profiles`
- `blocs`
- `bloc_members`
- `seasons`
- `season_member_status`
- `workout_logs`
- `workout_reactions`
- `season_overrides`
- `sit_out_requests`

And where possible:

- `payment_methods`
- `settlement_runs`
- `settlement_entries`
- `settlement_transfers`
- `notification_jobs`
- `auth_otps`

## Input

Accepted input shapes:

1. Raw normalized state JSON
2. JSONBin export with `.record`
3. exported live blob object with `.state`

The importer must normalize all of these to the same version-2 state shape before mapping.

## Deterministic Identity Strategy

The importer must be repeatable. That means generated IDs should be deterministic.

Rules:

- `profiles.id`
  - keep UUID-looking legacy auth IDs when available
  - otherwise derive deterministic UUID from `email`
- `blocs.id`
  - deterministic UUID from `group.id`
- `bloc_members.id`
  - deterministic UUID from `bloc_id + profile_id`
- `seasons.id`
  - deterministic UUID from `bloc_id + month_key`
- `season_member_status.id`
  - deterministic UUID from `season_id + display_name`
- settlement IDs
  - deterministic UUID from their natural keys

We should not generate random IDs during import.

## Mapping Rules

## Profiles

Source:

- `state.profiles`

Mapping:

- one row per profile object
- `legacy_user_key` stores the current string key when it is not already a UUID auth ID
- `auth_user_id` is populated only when the current user ID is a UUID

Limitations:

- the blob currently has no payment methods
- `payment_methods` stays empty until that feature exists

## Blocs

Source:

- `state.groups`

Mapping:

- one row per group
- `legacy_group_key = group.id`
- settings copied from `group.settings`
- `admin_profile_id` resolved by:
  - `group.adminUserId` when it maps to a profile
  - otherwise null initially

## Bloc Members

Source:

- `group.memberships`
- `group.memberOrder`
- `group.joinedMonthByName`

Mapping:

- primary source is `group.memberships`
- if a display name appears in `memberOrder` but there is no membership row, emit a synthetic member row with:
  - null profile mapping if unresolved
  - `joined_month_key` from `joinedMonthByName`

Why:

- older legacy state can have members present by display name without a complete auth-linked membership object

## Seasons

Source:

- `group.monthHistory`
- `group.lastMonth`
- `group.settings`

Mapping:

- one historical season row for every `monthHistory[*]`
- one open season row for `group.lastMonth`
- season settings snapshot comes from:
  - `month.settings` for historical seasons
  - `group.settings` for the current open season

Open season specifics:

- `status = 'open'`
- label/year/month derived from `lastMonth`
- `closed_at = null`

Historical season specifics:

- `status = 'settled'` only if settlement status data exists and all relevant rows are settled
- otherwise `status = 'closed'`

## Season Member Status

Source:

- historical:
  - `monthHistory[*].counts`
  - `monthHistory[*].excused`
  - `monthHistory[*].settlements`
- current:
  - `group.logs`
  - `group.excused`
  - membership/joined-month filtering

Mapping:

- one row per `(season, display_name)`
- for historical months:
  - `workout_count` from `counts`
  - `excused` from `excused`
  - settlement status fields from `settlements`
- for open season:
  - `workout_count` derived from current `group.logs`
  - `excused` derived from current `group.excused[lastMonth]`

`joined_for_month`:

- true when `isJoinedForMonth(joinedMonthByName, displayName, monthKey)` is true

## Workout Logs

Source:

- historical:
  - `monthHistory[*].logsByUser`
- current:
  - `group.logs`

Mapping:

- one row per log entry
- historical logs attach to historical `season_id`
- current logs attach to the open `season_id`
- `profile_id` resolved from membership by display name when possible
- preserve:
  - `id`
  - `date`
  - `type`
  - `note`
  - `photoUrl`
  - `createdAt`
  - `verifiedVia`
  - moderation fields

## Workout Reactions

Source:

- `log.reactions`

Mapping:

- one row per `(log, emoji, reactor)`
- `reactor_profile_id` resolved by display name when possible

## Season Overrides

Source:

- `group.seasonOverrides`

Mapping:

- one row per `(season_id)`

## Sit-out Requests

Source:

- `group.sitOutRequests`

Mapping:

- one row per `(season_id, member)`
- preserve all review metadata

## Settlements

Source available today:

- historical `monthHistory[*].settlements`

Important limitation:

This data does not contain the full winner/loser/payout graph needed for:

- `settlement_runs`
- `settlement_entries`
- `settlement_transfers`

It only contains lightweight member settlement status such as:

- `outstanding`
- `settled`
- timestamps

Decision:

- importer should seed those status fields into `season_member_status`
- importer should not invent historical payout rows that are not present
- canonical settlement payout tables should start empty for old history unless a separate reconstruction pass is written later

## Pending OTPs

Source:

- `state.pendingOtps`

Mapping:

- one row per email into `auth_otps`

## Import Outputs

The importer should produce:

1. machine-readable JSON files per canonical table
2. CSV files per canonical table for inspection
3. a `summary.json` report with counts
4. a `warnings.json` report for unresolved mappings

## Warnings The Importer Should Emit

Examples:

- member name present without profile mapping
- admin display name could not resolve to profile
- log owner display name unresolved
- reactor display name unresolved
- settlement status exists for member with no corresponding profile

These warnings are expected during early runs and should not abort import by default.

## Out Of Scope For First Importer

- writing directly to Supabase
- RLS
- cutover logic
- rebuilding full historical settlement payout graphs
- notification job generation

First importer target is offline parity output, not live database mutation.

## Success Criteria

The importer is ready for the next phase when:

- it can read a current blob snapshot
- it can produce canonical table outputs deterministically
- output counts can be compared against current projection counts
- unresolved mappings are surfaced clearly
