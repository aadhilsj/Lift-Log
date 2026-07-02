# Production Rollout Plan — 2026-07-01

This document is the production-path audit for the current local preview work in:

- [/Users/opera_user/Documents/Codex Space/Lift Log](/Users/opera_user/Documents/Codex%20Space/Lift%20Log)

It is written for the current state of the repo and should be treated as the working plan for pushing the current preview app changes to live after the final streak decision is made.

## Executive Summary

The safest production path is:

1. finish the last product polish item
   - final streak treatment
2. ship the current UI/server changes on the **existing Supabase singleton state architecture**
3. keep the broader relational / canonical migration work **paused**
4. only enable settlement confirmations in production if the required `ante_core` SQL baseline is confirmed on the live database first

This is the best plan because it avoids mixing two risky changes into one release:

- product/UI changes that are already close to approved
- architectural migration work that is explicitly not complete

The current repo supports both tracks, but they should not be released as one big cutover.

## Current Architecture

Production runtime, as the repo is currently structured:

- frontend shell: [index.html](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/index.html)
- API runtime: [api/lift-log.js](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js)
- local preview server only: [scripts/local-dev-server.mjs](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/scripts/local-dev-server.mjs)
- Vercel-linked project metadata: [.vercel/project.json](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/.vercel/project.json)

The live app is effectively:

- a static HTML app
- plus a serverless `/api/lift-log` endpoint
- backed by Supabase

Important distinction:

- the shippable persisted app state still centers on `public.lift_log_state`
- there is additive canonical / `ante_core` support in the API for specific slices
- the full relational cutover is not complete and should not be treated as part of this release

## Key Audit Findings

### 1. This should not be a migration release

The migration docs are explicit that the canonical/relational program is paused:

- [docs/handover-2026-06-28-migration-pause-checkpoint.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-06-28-migration-pause-checkpoint.md)
- [docs/relational-cutover-plan.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/relational-cutover-plan.md)
- [docs/handover-2026-06-30-today-screen-settlement-and-stat-cards.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-06-30-today-screen-settlement-and-stat-cards.md)

Do not combine:

- Today/History/Results product polish
- settlement reminders / confirmations
- blob retirement
- identity de-keying
- full canonical authority transfer

into one production event.

### 2. The live deployment path is already Supabase-backed

The immediate production backend path uses:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PIN`

from:

- [.env.example](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/.env.example)

The current immediate state schema is:

- [supabase/state-schema.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/state-schema.sql)

That means the safe production release is a normal application deploy against the current backend model, not a backend rewrite.

### 3. Settlement confirmations are a conditional production feature

Settlement confirmations are implemented as an additive canonical feature in `ante_core`.

Required pieces include:

- [supabase/ante-core-settlement-confirmations-schema.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-schema.sql)
- [supabase/ante-core-settlement-confirmations-read-rpc.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-read-rpc.sql)
- [supabase/ante-core-settlement-confirmations-write-rpcs.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-write-rpcs.sql)
- [supabase/ante-core-settlement-confirmations-rls.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-rls.sql)

And the helper canonical baseline matters too:

- `canonical-schema.sql`
- bloc/profile/member/season helper write RPCs

Reference:

- [docs/settlement-audit-2026-06-29-preview-branch.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/settlement-audit-2026-06-29-preview-branch.md)

Conclusion:

- if production should include settlement confirmations, production DB verification must happen before turning `ENABLE_SETTLEMENT_CONFIRMATIONS=true`
- if that baseline is not ready, keep settlement confirmations off for production and ship only the non-settlement UI changes

### 4. Local preview flags must not leak into production

These flags exist only for local / preview workflows:

- `ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW`
- `ENABLE_LOCAL_PREVIEW_AUTH`

They must be `false` in production.

### 5. The app now has several device-specific regressions already discovered and fixed

Recent work uncovered and fixed:

- Today profile hook-order crash
- preserved-scroll white-screen bug when switching views

These were exactly the kind of mobile behavior regressions that can slip through if release QA is desktop-only.

Conclusion:

- iPhone Safari and installed-PWA verification must be a required release gate

Reference:

- [docs/solved-issues-log.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/solved-issues-log.md)

## What Is Left Before Production

### Explicit remaining product blocker

The main remaining product item is:

- final streak treatment

Current instruction from user:

- streak UI is removed for now
- final icon/treatment will be revisited before production

This should be treated as the last intentional product blocker before release.

### Re-verify after streak pass

Once streak is reintroduced, re-run QA on:

- Today top bar
- block switcher cards
- Today leaderboard rows
- profile navigation from Today
- Activity tab switching from deep scroll positions
- Week's MVP popover

Even if the streak change looks visually small, it has already touched multiple surfaces and caused regressions before.

## Recommended Production Strategy

## Recommendation

Ship in one narrow production release with this scope only:

- Today screen redesign/polish
- leaderboard interaction/styling changes
- Results copy changes
- block switcher preview-state copy updates
- any final streak treatment
- settlement confirmations only if production SQL baseline is verified first

Do not include:

- relational cutover
- blob retirement
- OTP/auth architecture changes
- display-name de-keying
- any broad canonical authority transfer

## Why this is the best plan

- smallest risky surface
- easiest rollback
- preserves current data model
- does not force live users onto unfinished migration work
- matches the explicit pause state already documented in the repo

## Production Release Plan

### Phase 1 — Finish product scope

1. Finalize the streak design/treatment.
2. Re-run local preview on phone.
3. Re-run targeted UI QA on Today, History, Activity, Results, block switcher.
4. Confirm no known visual blockers remain.

Exit criteria:

- user signs off on streak treatment
- no known mobile navigation/render regressions remain

### Phase 2 — Production-readiness audit

Before touching production:

1. Confirm which feature set is actually in scope for go-live:
   - UI-only release
   - or UI + settlement confirmations
2. Confirm production DB shape.
3. Confirm production hosting env vars.
4. Confirm rollback artifacts exist.

Exit criteria:

- exact go-live scope is frozen
- rollback path is written and available

### Phase 3 — Database preflight

Always do this before deploy:

1. Take a fresh backup of live state.
2. Export the current singleton state row from `lift_log_state`.
3. Preserve backup copy outside the app.
4. If settlement confirmations are in scope, verify required `ante_core` SQL baseline exists in production.

Minimum backup artifacts:

- current `lift_log_state.state`
- current `lift_log_state.revision`
- latest `lift_log_backups` snapshot(s)

If settlement confirmations are in scope, verify:

- `ante_core.settlement_confirmations` exists
- required helper write RPCs exist
- read RPC exists
- write RPCs exist
- RLS is enabled and configured

### Phase 4 — Hosting preflight

Verify production env vars in Vercel:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PIN`
- `ENABLE_SETTLEMENT_CONFIRMATIONS`
- `ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW=false`
- `ENABLE_LOCAL_PREVIEW_AUTH=false`

Release rule:

- never enable preview flags in live

If settlement confirmations are not ready:

- `ENABLE_SETTLEMENT_CONFIRMATIONS=false`

If they are ready:

- `ENABLE_SETTLEMENT_CONFIRMATIONS=true`

### Phase 5 — Pre-production verification build

Deploy the release candidate first in a non-live Vercel preview deployment and verify:

- app boots
- auth works
- Today renders correctly
- profile navigation works from Today and History
- Activity tab works from deep scroll positions
- Results screen copy/states are correct
- block switcher states are correct on first two days
- Week's MVP popover renders correctly
- if settlement confirmations are enabled, claim/confirm/dispute work

Recommended tools:

- manual phone QA
- [scripts/mobile-qa.mjs](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/scripts/mobile-qa.mjs) as a quick automated sweep

### Phase 6 — Production deploy

Production release steps:

1. Freeze scope.
2. Take fresh live backup.
3. Apply production SQL only if required for in-scope features.
4. Confirm env vars.
5. Deploy to Vercel production.
6. Immediately verify key user flows on mobile and desktop.

### Phase 7 — Post-deploy smoke test

Required smoke test list:

- app opens in mobile Safari
- installed PWA opens
- Today loads without crash
- bottom nav works
- profile opens from Today
- profile opens from History
- Activity loads from Today after deep scroll
- Activity loads from History after deep scroll
- Results loads
- leaderboard styles match approved direction
- if settlement confirmations are enabled:
  - payer action works
  - receiver confirm works
  - pending state shows correctly
  - confirmed reminder disappears

## Rollback Plan

If production deploy fails:

1. revert the Vercel deployment to the prior production build
2. if necessary, restore from the pre-release `lift_log_state` backup
3. if settlement-confirmation SQL was applied and is causing issues:
   - disable `ENABLE_SETTLEMENT_CONFIRMATIONS`
   - redeploy app first
   - then decide whether DB rollback is actually needed

Principle:

- prefer feature disable + app rollback before any destructive DB rollback

## Risks

### High risk

- mixing UI release with unfinished migration work
- enabling settlement confirmations without the full production canonical helper baseline
- insufficient mobile QA

### Medium risk

- stale service worker / iPhone PWA cache behavior
- display-name / membership edge cases in canonical overlays
- month-boundary behavior around the first two days and league cutoff

### Low risk

- static asset / icon updates
- copy-only changes once verified visually

## Recommended SQL / Hosting Decision Tree

### Option A — safest release

Ship:

- UI changes
- no settlement confirmations

Requirements:

- existing state-schema backend only
- `ENABLE_SETTLEMENT_CONFIRMATIONS=false`

Use this if:

- the streak is finalized
- UI is approved
- production canonical settlement baseline is not fully ready

### Option B — full intended product release

Ship:

- UI changes
- settlement confirmations

Requirements:

- production `ante_core` helper baseline verified
- settlement confirmation SQL applied
- `ENABLE_SETTLEMENT_CONFIRMATIONS=true`

Use this only if:

- production DB verification is complete
- preview branch behavior has been rechecked

## What I Would Do

Recommended path:

1. finalize streak tomorrow
2. do one more focused phone QA pass
3. choose between Option A and Option B explicitly
4. if there is any doubt about production canonical settlement readiness, ship Option A first
5. ship settlement confirmations in a second, narrower release if needed

That is the best tradeoff between speed and safety.

## Final Recommendation

Treat the next production push as:

- a product polish release
- on the current Supabase-state architecture
- with settlement confirmations gated behind explicit production SQL verification
- with the final streak decision as the last blocker

Do not treat the next release as the relational migration launch.
