# Fero — data schema reference

**Read this before writing any SQL against Fero data. Do not guess JSONB paths.**

Fero stores data in two places at once during the ongoing migration:

- **Canonical tables** — the `ante_core` Postgres schema. Properly structured,
  the destination of the migration.
- **The blob** — one giant JSON document in `public.lift_log_state.state`. The
  legacy store, still authoritative for anything not yet migrated.

Source of truth for this doc: `supabase/migrations/*.sql` and
`scripts/state-to-canonical.mjs`.

---

## Part 1 — The blob (`public.lift_log_state.state`, JSONB)

### Table

```
public.lift_log_state
  id          boolean primary key (always true — single row)
  state       jsonb not null      <- everything lives in here
  revision    bigint not null default 0
  updated_at  timestamptz
  created_at  timestamptz

public.lift_log_backups
  backup_id       bigint identity primary key
  state_revision  bigint
  state           jsonb
  reason          text
  created_at      timestamptz
```

There is exactly **one row** in `lift_log_state`, with `id = true`.

### Top-level keys of `state`

```
state.version          number (currently 2)
state.groups           object, keyed by legacy group id  -> group object
state.groupOrder       array of legacy group ids (display order)
state.defaultGroupId   legacy group id
state.profiles         object, keyed by legacy USER id   -> profile object
state.pendingOtps      object, keyed by email
state.meta.revision    number
state.meta.updatedAt   ISO timestamp string
```

Note: a "group" in the blob is what the product calls a **Bloc**.

### `state.profiles[userId]`

Keyed by the legacy user id (NOT by email, NOT by display name).

```
state.profiles[userId].displayName
state.profiles[userId].email
```

### `state.groups[groupId]` — a Bloc

```
group.id                 legacy group id (same as the key)
group.name
group.adminName          display name of the admin
group.adminUserId        legacy user id of the admin
group.inviteCode
group.createdAt

group.memberOrder        ARRAY OF DISPLAY NAME STRINGS — the member list & order
group.memberships        object keyed by membership id -> { userId, displayName,
                                                            role, joinedAt }
group.joinedMonthByName  object: displayName -> monthKey ("2026-08")
group.leftMemberNames    array of display names that have departed

group.logs               object: displayName -> array of log entries
group.excused            object: displayName -> { monthKey: boolean }
group.monthHistory       ARRAY of closed-month objects (see below)
group.lastMonth          monthKey string, or null — the current open month

group.seasonOverrides    object: monthKey -> override object
group.sitOutRequests     object: monthKey -> { requestId: request object }
group.settings           see below
```

**The member-list gotcha.** Members are addressed **by display name**, not by
id, almost everywhere in the blob. `group.memberOrder` is a flat array of
display-name strings and is the canonical member list for a Bloc.
`group.memberships` is keyed by membership id and each entry carries `userId`
and `displayName` — it is NOT keyed by user id. To go from a display name to a
user id you must scan `Object.values(group.memberships)` and match on
`displayName`. This is the path that has been guessed wrong repeatedly.

### `group.settings`

```
settings.minTarget             integer (the MAS — monthly workout target)
settings.fineAmount            integer
settings.feeModel              string
settings.escalationStepAmount  integer or null
settings.currency              e.g. "NOK"
settings.minRunDistance        integer
settings.distanceUnit          e.g. "km"
settings.stravaEnabled         boolean
settings.timeZone              e.g. "Europe/Oslo"
settings.acceptedWorkoutTypes  array of strings
```

### `group.monthHistory[]` — one closed month

```
month.monthKey    "2026-07"
month.counts      object: displayName -> workout count
month.logsByUser  object: displayName -> array of log entries
month.excused     object: displayName -> boolean
month.settings    a settings object snapshot for that month (may be absent —
                  fall back to group.settings)
month.closedAt    timestamp
```

`monthHistory` is an **array**, not an object keyed by month. Find a month by
scanning for `monthKey`.

---

## Part 2 — Canonical tables (`ante_core` schema)

All ids are `uuid` with `gen_random_uuid()` defaults **except** `workout_logs.id`
and its referencing columns, which are `text`.

### `ante_core.profiles`
`id` uuid pk · `auth_user_id` uuid unique · `legacy_user_key` text unique ·
`email` text unique not null · `display_name` text not null ·
`profile_photo_url` (added later migration) · `created_at` · `updated_at`

`legacy_user_key` is the bridge back to the blob's `state.profiles` key.

### `ante_core.blocs`
`id` uuid pk · `legacy_group_key` text unique · `name` ·
`admin_profile_id` -> profiles · `invite_code` text unique ·
`time_zone` (default `Europe/Oslo`) · `currency` (default `NOK`) ·
`min_target` int (default 12) · `fine_amount` int (default 20) ·
`fee_model` · `escalation_step_amount` · `min_run_distance` (default 3) ·
`distance_unit` (default `km`) · `strava_enabled` bool · `accepted_workout_types`
text[] · `sort_order` int · `created_at` · `updated_at`

`legacy_group_key` is the bridge back to the blob's `state.groups` key.

### `ante_core.bloc_members`
`id` uuid pk · `bloc_id` -> blocs · `profile_id` -> profiles ·
`display_name_snapshot` text not null · `role` · `joined_at` ·
`joined_month_key` text · `left_at` · `sort_order` int · `created_at`

`left_at` non-null means departed. This is the canonical equivalent of the
blob's `leftMemberNames`.

### `ante_core.seasons`
One row per Bloc per month.
`id` uuid pk · `bloc_id` -> blocs · `month_key` text · `month_start` date ·
`label` · `year` · `month_index` · `closed_at` · plus a **frozen snapshot** of
the settings for that month: `min_target`, `fine_amount`, `fee_model`,
`escalation_step_amount`, `currency`, `min_run_distance`, `distance_unit`,
`strava_enabled`, `time_zone`, `accepted_workout_types`

### `ante_core.season_member_status`
`id` uuid pk · `season_id` -> seasons · `profile_id` -> profiles (nullable) ·
`display_name_snapshot` · `joined_for_month` bool · `workout_count` int ·
`excused` bool · `settlement_status` · `settlement_settled_at` ·
`settlement_updated_at`

`joined_for_month` must only be true for members actually active that month —
see the left-member rules in `docs/recurring-debugging-playbook.md`.

### `ante_core.workout_logs`
**`id` is `text`, not uuid.**
`id` text pk · `bloc_id` -> blocs · `season_id` -> seasons · `profile_id` ·
`owner_display_name` · `workout_date` date · `workout_type` · `note` ·
`photo_url` · `created_at` · `verified_via` · `flag_status` · `flag_reason` ·
`flag_response` · `flagged_by` · `decision_by` · `decision_at`

### `ante_core.workout_reactions`
`workout_log_id` text -> workout_logs · `reactor_profile_id` ·
`reactor_display_name` · `emoji` · `created_at`

### `ante_core.workout_log_comments` / `workout_log_comment_reactions`
Comment threads on individual logs.

### `ante_core.season_overrides`
`season_id` uuid **unique** -> seasons · `prorated` bool · `prorated_mas` int ·
`chosen_at` · `chosen_by` · `chosen_by_user_id`

Prorated targets for members who joined mid-month. Historically a source of
"wrong pace" bugs — the value is computed in more than one place.

### `ante_core.sit_out_requests`
`bloc_id` · `season_id` · `profile_id` · `display_name_snapshot` · `status` ·
`reason` · `exceptional` bool · `requested_at` · `requested_by` ·
`target_approver_name` · `decided_at` · `decided_by` · `auto_approved` bool

### Settlement
- `settlement_runs` — `bloc_id` · `season_id` (unique) · `status` · `currency` ·
  `completed_at` · `failed_at` · `failure_reason`
- `settlement_entries` — `settlement_run_id` · `profile_id` ·
  `display_name_snapshot` · `workout_count` · `mas` · `hit_mas` bool ·
  `amount_owed` numeric(12,2) · `amount_receiving` numeric(12,2)
- `settlement_transfers` — `settlement_run_id` · `from_profile_id` /
  `from_display_name` · `to_profile_id` / `to_display_name` · `amount`
  numeric(12,2) · `recipient_payment_label` / `_details` / `_custom_label`

### Bloc Stream (chat)
- `bloc_messages`, `bloc_message_reactions`, `bloc_message_reads`

### Supporting
- `payment_methods` — `profile_id` · `provider` · `label` · `details` ·
  `custom_label` · `is_active`
- `auth_otps` — `email` pk · `code` · `expires_at` · `profile_id`
- `revision_clock` — migration revision tracking
- `notification_jobs` — `job_type` · `status` · `payload` jsonb ·
  `scheduled_for` · `sent_at` · `attempt_count` · `last_error`
- `app_daily_activity` — founder dashboard metrics

---

## Part 3 — Example queries that work

### List every Bloc with its active member count

```sql
select b.name,
       b.invite_code,
       count(m.id) filter (where m.left_at is null) as active_members
from ante_core.blocs b
left join ante_core.bloc_members m on m.bloc_id = b.id
group by b.id, b.name, b.invite_code
order by b.sort_order nulls last, b.name;
```

### Members of one Bloc, from the BLOB (correct JSONB paths)

```sql
select g.key                          as legacy_group_id,
       g.value ->> 'name'             as bloc_name,
       jsonb_array_elements_text(g.value -> 'memberOrder') as display_name
from public.lift_log_state s,
     jsonb_each(s.state -> 'groups') g
where s.id = true;
```

To get the user id behind a display name you must scan `memberships`:

```sql
select g.key                       as legacy_group_id,
       m.value ->> 'displayName'   as display_name,
       m.value ->> 'userId'        as legacy_user_id,
       m.value ->> 'role'          as role
from public.lift_log_state s,
     jsonb_each(s.state -> 'groups') g,
     jsonb_each(g.value -> 'memberships') m
where s.id = true;
```

### One member's workout count for a month, canonical

```sql
select p.display_name,
       sms.workout_count,
       se.min_target as mas,
       sms.excused
from ante_core.season_member_status sms
join ante_core.seasons se on se.id = sms.season_id
join ante_core.blocs   b  on b.id  = se.bloc_id
left join ante_core.profiles p on p.id = sms.profile_id
where b.legacy_group_key = 'YOUR_GROUP_KEY'::text
  and se.month_key = '2026-08'
  and sms.joined_for_month
order by sms.workout_count desc;
```

---

## Gotchas checklist

- `workout_logs.id` is **text** — cast with `::text`, never `::uuid`.
- `monthHistory` is an **array**, not a keyed object.
- Blob members are addressed **by display name**; `memberships` is keyed by
  membership id, not user id.
- `state.profiles` is keyed by **legacy user id**, not email.
- `season_overrides.season_id` is unique — one override per season, max.
- Seasons carry a **frozen settings snapshot**; do not read current Bloc
  settings when computing a closed month.
- Empty canonical results mean "no data", never "RPC failed". See the data
  safety rules in `CLAUDE.md`.
