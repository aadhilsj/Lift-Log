# Antè Relational Cutover Plan

This document is the execution plan for retiring the blob-backed state engine in [`api/lift-log.js`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js) and moving Antè onto a canonical relational backend.

It is intentionally repo-specific. It reflects what the app actually does today, not a generic product spec.

## Goal

End state:

- SQL is canonical for reads and writes
- workout logging, reactions, month history, memberships, and settlements all live in relational tables
- the current blob in `lift_log_state.state` is retired from the interactive app path
- the current projection layer is no longer needed as a separate read model

Non-goal:

- big-bang rewrite
- building new settlement features on top of the blob
- permanent dual-write

## Current Architecture

Today the app uses:

- `public.lift_log_state`
  - singleton JSON blob
  - canonical source of truth
- `public.lift_log_backups`
  - point-in-time backup snapshots of that blob
- `public.lift_log_projection_*`
  - derived relational mirror built from the blob

The interactive server logic is concentrated in [`api/lift-log.js`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js):

- `normalizeState`
- `normalizeGroup`
- `normalizeMonthHistory`
- `rolloverGroupIfNeeded`
- mutation handlers under `POST`
- projection serialization in `buildProjectionPayload`
- projection deserialization in `fetchStateFromProjectionMeta`

The frontend in [`index.html`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/index.html) still expects one normalized app-state payload shaped like:

```js
{
  version: 2,
  groups: { ... },
  groupOrder: [...],
  defaultGroupId: "...",
  profiles: { ... },
  pendingOtps: { ... },
  meta: { revision, updatedAt }
}
```

That means the migration must replace both:

- canonical storage
- the server-side state composition layer

## Canonical Blob Shape Today

Top-level state:

- `version`
- `groups`
- `groupOrder`
- `defaultGroupId`
- `profiles`
- `pendingOtps`
- `meta`

Each group currently contains:

- `id`
- `name`
- `adminName`
- `adminUserId`
- `inviteCode`
- `createdAt`
- `memberOrder`
- `memberships`
- `joinedMonthByName`
- `settings`
- `logs`
- `excused`
- `seasonOverrides`
- `sitOutRequests`
- `monthHistory`
- `lastMonth`

Each month history entry currently contains:

- `key`
- `label`
- `year`
- `month`
- `counts`
- `excused`
- `logsByUser`
- `settings`
- `settlements`

Important existing behaviors tied to the blob:

- month rollover at 05:00 local time
- joined-mid-month filtering via `joinedMonthByName`
- current-month logs live in `group.logs`
- historical logs live in `monthHistory[*].logsByUser`
- settlement status in historical months is currently lightweight status metadata, not full payout rows

## Existing Relational Material

Already present in the repo:

- [`supabase/lift-log-relational-schema.sql`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/lift-log-relational-schema.sql)
  - projection schema only
- [`supabase/lift-log-sync-projection-rpc.sql`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/lift-log-sync-projection-rpc.sql)
  - atomically rebuilds projection from serialized payload
- [`supabase/lift-log-read-projection-rpc.sql`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/lift-log-read-projection-rpc.sql)
  - reads projection back into app-state shape
- [`supabase/schema.sql`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/schema.sql)
  - earlier future-schema attempt, too simple for current product
- [`supabase-local/supabase/functions/season-close/index.ts`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase-local/supabase/functions/season-close/index.ts)
  - local Edge Function that mirrors blob rollover logic

These are useful references, but they should not be declared canonical as-is.

## Canonical Relational Target

New canonical tables should be introduced beside the current blob/projection system.
For the first rollout, they should live in a private schema, `ante_core`, not in
`public`. That keeps the additive rollout isolated from the Data API until access
patterns and RLS are ready.

The canonical table set is:

- `profiles`
- `payment_methods`
- `blocs`
- `bloc_members`
- `seasons`
- `season_member_status`
- `workout_logs`
- `workout_reactions`
- `sit_out_requests`
- `season_overrides`
- `settlement_runs`
- `settlement_entries`
- `settlement_transfers`
- `notification_jobs`
- `auth_otps` or equivalent ephemeral auth table

### Why this target

- `payment_methods` should be structured, not embedded in profile JSON
- settlement data should be normalized, not one JSON blob row
- season/month data should have explicit identity
- current and historical logs should share one canonical log table

## Proposed Canonical Table Responsibilities

### `profiles`

One row per authenticated user.

Key fields:

- `id uuid`
- `email`
- `display_name`
- `created_at`

### `payment_methods`

One row per payment method per user.

Key fields:

- `id uuid`
- `profile_id`
- `type`
- `label`
- `details`
- `custom_label`
- `created_at`

### `blocs`

Canonical Bloc identity.

Key fields:

- `id uuid`
- `legacy_group_key text unique null`
- `name`
- `admin_user_id`
- `invite_code`
- `created_at`
- settings fields now stored at Bloc level

### `bloc_members`

Membership and role.

Key fields:

- `bloc_id`
- `profile_id`
- `display_name_snapshot`
- `role`
- `joined_at`
- `left_at null`

### `seasons`

One row per Bloc per league month.

Key fields:

- `id uuid`
- `bloc_id`
- `month_key text`
- `month_start date`
- `label`
- `status`
- settings snapshot for the month
- `closed_at`

### `season_member_status`

Per-member per-season computed state.

Key fields:

- `season_id`
- `profile_id`
- `display_name_snapshot`
- `joined_for_month`
- `workout_count`
- `excused`
- `settlement_status`
- `settlement_settled_at`
- `settlement_updated_at`

This table absorbs what is currently split across:

- `monthHistory[*].counts`
- `monthHistory[*].excused`
- historical settlement status fields

### `workout_logs`

Canonical log rows for both current and historical months.

Key fields:

- `id text or uuid`
- `bloc_id`
- `season_id`
- `profile_id nullable`
- `owner_display_name`
- `workout_date`
- `workout_type`
- `note`
- `photo_url`
- `created_at`
- `verified_via`
- `flag_status`
- `flag_reason`
- `flag_response`
- `flagged_by`
- `decision_by`
- `decision_at`

### `workout_reactions`

Key fields:

- `log_id`
- `reactor_profile_id nullable`
- `reactor_display_name`
- `emoji`

### `sit_out_requests`

Key fields:

- `bloc_id`
- `season_id`
- `profile_id`
- `display_name_snapshot`
- `status`
- `reason`
- `exceptional`
- `requested_at`
- `requested_by`
- `requested_by_user_id`
- `target_approver_name`
- `target_approver_user_id`
- `decided_at`
- `decided_by`
- `decided_by_user_id`
- `auto_approved`

### `season_overrides`

Key fields:

- `season_id`
- `prorated`
- `prorated_mas`
- `chosen_at`
- `chosen_by`
- `chosen_by_user_id`

### `settlement_runs`

One settlement calculation event per Bloc season.

Key fields:

- `id uuid`
- `bloc_id`
- `season_id`
- `status`
- `currency`
- `created_at`
- `completed_at`

### `settlement_entries`

One row per member outcome.

Key fields:

- `settlement_run_id`
- `profile_id`
- `display_name_snapshot`
- `workout_count`
- `mas`
- `hit_mas`
- `outcome`
- `amount_owed`
- `amount_receiving`

### `settlement_transfers`

One row per loser-to-winner obligation.

Key fields:

- `settlement_run_id`
- `from_profile_id`
- `from_display_name`
- `to_profile_id`
- `to_display_name`
- `amount`
- payment detail snapshot columns

### `notification_jobs`

Outbox for email/push.

Key fields:

- `id uuid`
- `profile_id`
- `bloc_id`
- `season_id nullable`
- `type`
- `channel`
- `payload jsonb`
- `status`
- `attempt_count`
- `scheduled_for`
- `sent_at`
- `last_error`

## Blob To SQL Mapping

### Top-level state

| Blob field | Canonical destination |
| --- | --- |
| `profiles` | `profiles`, `payment_methods` later |
| `pendingOtps` | `auth_otps` or ephemeral auth table |
| `groupOrder` / `defaultGroupId` | transitional only; eventually derived from memberships / UI prefs |
| `meta.revision` | migration/audit metadata only, not app-state truth |

### Group fields

| Blob field | Canonical destination |
| --- | --- |
| `group.id` | `blocs.legacy_group_key` |
| `group.name` | `blocs.name` |
| `group.adminUserId` | `blocs.admin_user_id` |
| `group.adminName` | admin display snapshot, possibly redundant |
| `group.inviteCode` | `blocs.invite_code` |
| `group.createdAt` | `blocs.created_at` |
| `group.settings.*` | `blocs` defaults + `seasons` snapshots |
| `group.memberOrder` | derived ordering metadata; may live in `bloc_members.sort_order` |
| `group.memberships` | `bloc_members` |
| `group.joinedMonthByName` | seed `bloc_members` plus derived season joins |
| `group.lastMonth` | current open season marker |

### Current-month activity

| Blob field | Canonical destination |
| --- | --- |
| `group.logs` | `workout_logs` for the open season |
| `group.excused` | open-season `season_member_status` |
| `group.seasonOverrides` | `season_overrides` |
| `group.sitOutRequests` | `sit_out_requests` |

### Historical month activity

| Blob field | Canonical destination |
| --- | --- |
| `monthHistory[*]` | `seasons` |
| `monthHistory[*].counts` | `season_member_status.workout_count` |
| `monthHistory[*].excused` | `season_member_status.excused` |
| `monthHistory[*].logsByUser` | `workout_logs` tied to historical `season_id` |
| `monthHistory[*].settings` | season settings snapshot |
| `monthHistory[*].settlements` | historical settlement status seed data |

## Hard Migration Decisions

These are the decisions this plan assumes:

1. New settlement work will be canonical in SQL from day one.
2. We will not make the current projection tables canonical.
3. We will not keep the blob as the long-term write source.
4. We will use real UUID Bloc IDs in SQL and preserve `legacy-group` as a compatibility key during migration.
5. We will keep the server composing the old app-state payload shape during transition so the frontend does not need a full rewrite up front.

## Execution Phases

## Phase 1 — Inventory And Spec

Deliverables:

- this document
- canonical schema SQL draft
- explicit field mapping

Exit criteria:

- every current blob concept has a relational home
- no unsettled architectural questions remain for schema design

## Phase 2 — Canonical Schema

Deliverables:

- new canonical SQL schema files
- indexes
- constraints
- RLS policy plan

Do not:

- cut app traffic to new tables yet
- reuse projection tables as canonical

Exit criteria:

- blank schema can represent all live features

## Phase 3 — Importer

Deliverables:

- repeatable importer from blob to canonical SQL
- staging dry-run
- parity report

Importer must preserve:

- historical month logs
- reactions
- joined-mid-month behavior
- sit-out requests
- season overrides
- settlement status history

Exit criteria:

- staging imports are repeatable and deterministic

## Phase 4 — SQL Read Composition

Deliverables:

- server-side SQL fetchers that compose the same app-state payload shape now expected by the client

Current status as of June 23, 2026:

- the following read overlays are already live:
  - profiles
  - Bloc settings
  - `season_overrides`
  - current-month logs
  - current-month excused
  - current-month sit-out requests
  - closed-season `monthHistory`
  - guarded canonical `memberOrder`
  - guarded canonical `groupOrder`
  - canonical open-season `lastMonth` for covered groups
- this means the main blocker for broader Phase 4 progress is no longer another
  narrow overlay; it is importer/backfill completeness and historical parity
  confidence

Primary parity gate for this phase:
- [`docs/canonical-parity-audit-current-phase.md`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/canonical-parity-audit-current-phase.md)

Current known caveats before broader Phase 4 work:

- active legacy-backed production blocs now have complete `sort_order` coverage
  for both `ante_core.blocs` and `ante_core.bloc_members`, and the read path
  now trusts canonical ordering when coverage is complete. Guarded fallback is
  still intentionally retained for inactive, test, and otherwise uncovered
  residue.
- Production validation on June 21, 2026 found no active blob `pendingOtps`
  entries. That removes OTP session state as a Phase 4 read-composition blocker,
  but OTP storage still remains a Phase 5/6 write-retirement concern.
- open-season `season_member_status.workout_count` is not yet a live canonical
  current-month authority surface. Open-season log parity should be evaluated
  through `workout_logs`, not through `season_member_status.workout_count`.

Cutover order:

1. profiles
2. Bloc settings
3. memberships
4. current-month logs
5. reactions
6. month history
7. sit-outs and overrides

Exit criteria:

- UI renders correctly from SQL-backed state composition

## Phase 5 — Write Cutover

Deliverables:

- mutation handlers write canonically to SQL
- temporary rollback/backfill path for safety

Cutover order:

1. profile writes
2. join/leave/kick membership
3. Bloc settings
4. workout log create/delete
5. reactions
6. sit-out requests
7. settlement status updates
8. month rollover / season close

Exit criteria:

- all interactive writes are SQL-first
- blob is no longer used as mutation source of truth

## Phase 6 — Blob Retirement

Deliverables:

- blob removed from interactive read/write path
- backup/export tooling retained

Possible end state options:

- keep `lift_log_state` only as migration fallback for a short period
- eventually drop projection rebuild logic and blob composition code

Exit criteria:

- blob no longer participates in normal app operations

## Verification Gates

Before each cutover phase, verify parity on:

- profile count
- Bloc count
- membership count
- current-month workout count
- historical month counts
- historical month log count
- reaction count
- sit-out request count
- season override count
- settlement status count

UI parity checks:

- Today view
- Activity view
- Month view
- History view
- profile onboarding
- join Bloc flow
- leave/kick flows
- reaction flow
- month rollover behavior

## Existing Code To Reuse Carefully

Safe logic candidates to reuse:

- `normalizeLogEntry`
- `compareMonthKeys`
- `isJoinedForMonth`
- `getLeagueMonthKey`
- settlement math helpers after review

Unsafe long-term patterns to keep:

- singleton whole-app blob mutation
- rebuilding canonical state from one in-memory merged object
- using projection snapshots as mutation inputs

## Notes On The Existing Season Close Function

[`supabase-local/supabase/functions/season-close/index.ts`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase-local/supabase/functions/season-close/index.ts) is useful as a behavioral reference for:

- local-time 05:00 cutover
- month rollover semantics
- default settlement generation

It should not be treated as the final production settlement engine without being rewritten against canonical SQL tables.

## Immediate Next Deliverables

The next implementation steps in this repo should be:

1. create canonical schema draft SQL
2. create blob-to-canonical importer design
3. decide table names and compatibility fields
4. stage importer against current backup snapshot

Only after that should we start changing live read/write paths.
