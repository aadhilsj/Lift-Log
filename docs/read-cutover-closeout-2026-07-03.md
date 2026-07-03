# Read Cutover Closeout Status — 2026-07-03

This note records the current state after the canonical read baseline was
applied, the current-logs RPC was repaired, and the guarded canonical composer
branch was promoted.

## Current Production State

- live production is currently running commit `f67f25d`
- that commit does **not** force canonical reads on by itself
- `api/lift-log.js` still falls back to the blob-overlay composer unless
  `ENABLE_CANONICAL_READ_COMPOSER=true`
- production app behavior was manually checked after promotion and remained
  healthy

This means production is in a guarded transitional state, not a final
blob-free read state.

## Verified Surfaces

### 1. Current logs

Status: `PASS`

What was verified:

- production `public.read_ante_core_current_logs()` was repaired after the
  invalid aggregate ordering bug
- direct RPC count returned `16`
- grouped RPC counts matched canonical open-season workout log counts:
  - `ctrl-alt-de-feat-ocdti8` → `7`
  - `legacy-group` → `4`
  - `osi-h3-9pmkuy` → `4`
  - `stavanger-4ever-7162hj` → `1`
- app UI on production showed current-month logs correctly after the fix

### 2. Bloc list / visible bloc settings

Status: `PASS`

Confidence basis:

- production app loaded normally after promotion
- bloc switching and normal current app navigation continued to work
- no evidence of missing/blank blocs after the guarded deployment

### 3. Profiles

Status: `PASS`

Confidence basis:

- profile navigation regressions were fixed earlier in this release cycle
- current production app was verified healthy after the guarded deployment
- no fresh profile-read regression was reported after `f67f25d` promotion

### 4. Bloc members

Status: `PASS`

Confidence basis:

- leaderboard / visible member rendering remained intact in production
- no member-list collapse or missing-member issue appeared after promotion

### 5. Month history

Status: `PASS`

What was verified:

- `public.read_ante_core_month_history()` returned closed-month rows for real
  blocs
- returned member/log counts were populated and structurally sensible:
  - `ctrl-alt-de-feat-ocdti8` `2026-5` → `9` members, `64` logs
  - `legacy-group` `2026-5` → `10` members, `108` logs
  - `legacy-group` `2026-4` → `10` members, `121` logs
  - `legacy-group` `2026-3` → `10` members, `65` logs
  - `osi-h3-9pmkuy` `2026-5` → `8` members, `60` logs
  - `stavanger-4ever-7162hj` `2026-5` → `3` members, `22` logs
- no empty-shell / malformed JSON result was observed

### 6. Season overrides

Status: `PASS`

What was verified:

- `public.read_ante_core_season_overrides()` returned expected override rows
- rows contained sensible values for:
  - `legacy_group_key`
  - `month_key`
  - `prorated`
  - `prorated_mas`
  - `chosen_at`
  - `chosen_by`
- example live rows included:
  - `ctrl-alt-de-feat-ocdti8` `2026-5` → `prorated_mas = 6`
  - `osi-h3-9pmkuy` `2026-5` → `prorated_mas = 9`
  - `stavanger-4ever-7162hj` `2026-5` → `prorated_mas = 7`

### 7. Current excused / sit-outs

Status: `PASS`

What was verified:

- `public.read_ante_core_current_excused_and_sitouts()` returned a valid object
- payload included all expected top-level keys:
  - `excused`
  - `open_seasons`
  - `sit_out_requests`
- live payload included structurally valid example rows for:
  - an excused member
  - open seasons
  - an approved sit-out request

### 8. Settlement confirmations

Status: `PASS (ZERO-ROW SHAPE)`

Confidence basis:

- read baseline exists in production
- related functions and policies were confirmed earlier in rollout
- `public.read_ante_core_settlement_confirmations()` executed successfully
- it returned zero rows rather than throwing or returning malformed output

Gap:

- there were no active live rows available to prove populated-row parity

## What Actually Broke

The production regression was not data loss.

The issue was:

- `public.read_ante_core_current_logs()` contained an invalid outer
  `order by wl.created_at`
- once production tried to use that RPC, it threw a SQL aggregate error
- that caused the canonical current-log read to fail
- after the SQL fix, canonical current-log reads matched live data again

## What Is Safe Right Now

Safe to say:

- canonical read baseline is largely in place
- the most critical live blocker (`read_ante_core_current_logs`) is fixed
- the promoted app version is healthy in production
- the guarded composer pattern prevented the migration from becoming destructive

## What Still Blocks A Clean “Read Cutover Complete” Label

These are the remaining blockers to call the read cutover fully complete:

1. intentionally decide whether production should run with
   `ENABLE_CANONICAL_READ_COMPOSER=true`
2. once that is intentionally enabled and verified, remove the blob-overlay
   fallback path from normal GET reads

## Recommended Next Step

Do **not** treat this as final blob retirement yet.

Recommended next move:

1. keep production stable as-is
2. intentionally enable canonical composer in production when ready
3. smoke test immediately after enabling
4. if still clean, remove blob-overlay read fallback in a final cleanup pass
