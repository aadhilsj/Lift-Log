# QA Follow-up — Season Overrides Read Overlay

Date: June 16, 2026

Related code:
- `/Users/opera_user/Documents/Codex Space/Lift Log/api/lift-log.js`
- `/Users/opera_user/Documents/Codex Space/Lift Log/supabase/ante-core-season-overrides-read-rpc.sql`

Related commit:
- `175d4df` — `feat(read): overlay canonical season overrides on GET`

## What was verified

- `read_ante_core_season_overrides()` was applied successfully in Supabase.
- The RPC returns canonical rows in the shape expected by the app overlay:
  - `legacy_group_key`
  - `month_key`
  - `prorated`
  - `prorated_mas`
  - `chosen_at`
  - `chosen_by`
  - `chosen_by_user_id`
- `node --check /Users/opera_user/Documents/Codex Space/Lift Log/api/lift-log.js` passed.
- Preview deployment for `175d4df` built successfully.
- No preview runtime warnings/errors were observed during the verification window.

## What is still pending

Full functional QA of the read overlay is still pending.

Why it is pending:
- We are mid-month, so the natural season override flow is not available to test through normal product behavior.
- Current canonical rows do exist, but the only blob-backed group checked already had matching blob override data, so the overlay would be a no-op in that case.
- Other canonical override rows checked belonged to groups not present in the current blob state, so they are intentionally ignored by the overlay.

## Exact QA scenario still needed

Validate a blob-backed group where:

1. the group exists in `lift_log_state`
2. a canonical `ante_core.season_overrides` row exists for that group/month
3. the blob `group.seasonOverrides[monthKey]` is missing or stale
4. a GET on the app returns the canonical override in the normalized group payload

Expected outcome:
- canonical override is overlaid onto the blob-backed group on read
- no phantom groups are created
- writable state remains blob-only

## Recommendation

- Keep this marked as functionally pending until the divergence case above is tested.
- Safe enough to keep on preview.
- Production promotion should be a judgment call, not a claim of fully completed QA.
