# QA Update — Sit-out Migration Slices

Date: June 17, 2026

This note updates the migration QA status after live verification on a
disposable test bloc using a real admin account and a separate test account.

Related commits:
- `314186f` — `season_member_status` excused / sit-out sync
- `92998e0` — `sit_out_requests` canonical write path

Test bloc:
- `test-bloc-ka2ovu`

Test member display name:
- `Test`

## What was tested

### 1. Decline path

Flow:
- test account submitted a sit-out request
- admin account declined it

Verified in canonical:
- `ante_core.sit_out_requests`
  - row existed for bloc `test-bloc-ka2ovu`
  - `month_key = '2026-5'`
  - `display_name_snapshot = 'Test'`
  - `status = 'denied'`
  - `decided_at` populated
  - `decided_by = 'Aadhil'`
- `ante_core.season_member_status`
  - no row was returned for `Test` in that season after decline
  - this is acceptable and confirms decline did not incorrectly mark the member as excused

### 2. Approval path

Flow:
- test account submitted a new sit-out request again
- admin account approved it

Verified in canonical:
- `ante_core.sit_out_requests`
  - row existed for bloc `test-bloc-ka2ovu`
  - `month_key = '2026-5'`
  - `display_name_snapshot = 'Test'`
  - `status = 'approved'`
  - `decided_at` populated
  - `decided_by = 'Aadhil'`
- `ante_core.season_member_status`
  - row existed for bloc `test-bloc-ka2ovu`
  - `month_key = '2026-5'`
  - `display_name_snapshot = 'Test'`
  - `joined_for_month = true`
  - `workout_count = 0`
  - `excused = true`

## QA conclusion

The following slices are now verified and should no longer be treated as
pending safe live QA:

- `314186f` — `season_member_status` excused / sit-out sync
- `92998e0` — `sit_out_requests` canonical write path

## Remaining migration QA item

The main remaining migration QA item is:

- `175d4df` — `season_overrides` read overlay

That slice remains functionally pending because the exact divergence case
(canonical override present for a blob-backed group while blob override is
missing or stale) has not yet been exercised end-to-end.
