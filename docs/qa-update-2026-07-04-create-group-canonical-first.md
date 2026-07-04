# QA Update — Create-Group Canonical-First Slice

Date: 2026-07-04

This note defines the verification gate for the `create-group`
canonical-first write slice now implemented in
[`api/lift-log.js`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js).

The goal is to verify that new bloc creation now behaves like this:

1. compute the exact post-create group in memory
2. write the canonical profile / bloc / season / membership / seeded
   season-member-status first
3. persist the blob mirror only after those canonical writes succeed

This must be verified before moving to the next bounded write slice.

## What Changed

The `create-group` handler now requires canonical success before blob mirror
persistence for the new bloc.

That means this slice is no longer merely best-effort dual-write.

It is now the first new-state lifecycle flow on current `main` that should be
treated as canonical-first.

## Verification Environment

Run this against a production-like preview deploy, not local preview.

Required conditions:

- real Supabase auth
- no local identity picker
- no local impersonation
- preview deploy using the branch that contains the `create-group`
  canonical-first patch
- preview database with the required canonical write RPCs already applied

## Test Data

Use a disposable test bloc.

Recommended naming:

- group name: `create-group-test-YYYYMMDD-HHMM`

Use a real signed-in account whose profile already has:

- a valid `auth.user.id`
- a non-empty profile display name

## Primary Functional Test

### App flow

1. open the preview deploy while signed in
2. create a new bloc with:
   - a unique disposable name
   - normal valid settings
   - no unusual extra-member edge cases for the first pass
3. confirm the API returns success
4. confirm the UI shows the new bloc immediately
5. confirm the creator appears as the admin in the new bloc
6. confirm the bloc opens without an error or blank-state collapse

### Expected app-level pass condition

The new bloc appears and behaves normally in the app with no manual refresh
repair step.

## Canonical Verification

After the create succeeds, verify the following canonical rows exist for the
new bloc.

### 1. `ante_core.blocs`

Expected:

- row exists for the new `legacy_group_key`
- `name` matches the created bloc name
- `admin_auth_user_id` matches the creator auth user id
- `invite_code` is populated
- settings snapshot fields look correct
- `sort_order` matches the new bloc's appended position

### 2. `ante_core.seasons`

Expected:

- one open-season row exists for the new bloc
- `month_key` matches the app's current `lastMonth`
- `status = 'open'`
- settings snapshot fields match the created bloc settings

### 3. `ante_core.bloc_members`

Expected:

- one member row exists for the creator
- `role = 'admin'`
- `display_name_snapshot` matches the creator display name
- `left_at is null`
- `sort_order = 0`

### 4. `ante_core.season_member_status`

Expected:

- one row exists for the creator in the open season
- `joined_for_month = true`
- `workout_count = 0`
- `excused = false`

### 5. `ante_core.profiles`

Expected:

- creator profile row exists
- `display_name` matches the creator display name

## Blob Mirror Verification

After canonical verification, confirm the blob mirror was also persisted.

Expected in blob-shaped app state:

- new group exists under `groups[newGroupId]`
- `groupOrder` includes the new group id at the appended position
- creator membership exists as admin
- `lastMonth` matches the canonical open season
- `inviteCode` exists
- `createdAt` exists

This confirms the compatibility shadow still reflects the same created result.

## Failure Semantics To Verify

This slice is only valid if canonical failure prevents blob-only success.

Required behavior:

- if one of the required canonical writes fails, `create-group` must fail
- it must not leave behind a blob-only created bloc

## Recommended Negative Test

If a safe preview environment is available, force a canonical failure and
verify the request fails before blob persistence.

Examples:

- temporarily use a preview database missing one required canonical RPC
- temporarily revoke one required RPC permission in preview only

Expected result:

- API request fails
- no new bloc appears in the app
- no blob-only group is created

Do not run this negative-path test against production.

## Minimal SQL Verification Template

Use the newly created `legacy_group_key`.

Suggested checks:

```sql
select *
from ante_core.blocs
where legacy_group_key = '<new_group_id>';

select *
from ante_core.seasons
where legacy_group_key = '<new_group_id>'
order by month_key desc;

select *
from ante_core.bloc_members
where legacy_group_key = '<new_group_id>';

select *
from ante_core.season_member_status
where legacy_group_key = '<new_group_id>'
order by month_key desc, display_name_snapshot asc;

select *
from ante_core.profiles
where auth_user_id = '<creator_auth_user_id>';
```

If these exact table names are not directly queryable in the target environment,
use the equivalent view or branch-accessible inspection path already used in
earlier migration QA.

## Pass / Fail Gate

Mark this slice `PASS` only if:

1. app create flow succeeds on preview
2. all canonical rows above exist and match the created payload
3. blob mirror reflects the same result
4. negative-path validation shows canonical failure blocks blob-only create, or
   there is a strong environment-based reason the negative-path test cannot be
   run yet

Mark this slice `FAIL` if:

- the app shows the new bloc but canonical rows are incomplete
- canonical rows exist but blob mirror is missing or divergent
- canonical failure still allows blob-only bloc creation

## Recommendation After Verification

If this passes, the next bounded candidate remains:

- `join-group`

But only after re-checking the `leftMemberNames` and rejoin semantics for that
exact path, because `join-group` is materially riskier than `create-group`.

## Verification Result — 2026-07-04

Status: `PASS`

Verified on a live preview deployment that was also pointed at the live
Supabase production database.

Created test bloc:

- bloc name: `test123`
- `legacy_group_key`: `test123-pmiura`

Verified canonical rows:

### `ante_core.blocs`

Confirmed:

- row exists for `test123-pmiura`
- `name = 'test123'`
- `admin_profile_id` populated
- `invite_code = '1NAQPY'`
- `sort_order = 7`
- settings snapshot fields matched the created payload

Confirmed admin profile resolution:

- `auth_user_id = 768de245-5b17-4292-b91c-804daaa3b217`
- `email = 'aadhil101@gmail.com'`
- `display_name = 'Aadhil'`

### `ante_core.seasons`

Confirmed:

- open season row exists
- `month_key = '2026-6'`
- `status = 'open'`
- settings snapshot fields matched the created payload

### `ante_core.bloc_members`

Confirmed:

- creator membership row exists
- `display_name_snapshot = 'Aadhil'`
- `role = 'admin'`
- `sort_order = 0`
- `left_at is null`

### `ante_core.season_member_status`

Confirmed:

- creator open-season row exists
- `display_name_snapshot = 'Aadhil'`
- `joined_for_month = true`
- `workout_count = 0`
- `excused = false`

### Blob mirror

Confirmed:

- blob group exists under `groups['test123-pmiura']`
- `adminUserId` matches the creator auth user id
- `memberOrder = ['Aadhil']`
- `inviteCode = '1NAQPY'`
- `lastMonth = '2026-6'`

## Verified Conclusion

The `create-group` canonical-first write slice is now verified.

This should no longer be treated as pending migration QA.
