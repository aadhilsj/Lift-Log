# Current Plan - 2026-08-01 Merge To App Store

This is the active planning doc for Fero from the current live/preview split through App Store readiness. Keep this file updated whenever substantial product, backend, migration, QA, or release work lands.

## Durable Product And Launch Principles

These principles survive the current preview/main reconciliation and should guide onboarding, analytics, monetization, acquisition, and App Store work:

- Optimize for an **activated Bloc**, not an install or onboarding completion in isolation.
- Until real usage data justifies a stricter definition, treat activation as provisional when:
  - a person has created or joined a Bloc;
  - at least one additional member has joined that Bloc; and
  - the creator/new member has logged a first workout.
- Instrument the full path from app open through authentication, Bloc creation/join, invitation, first workout, and return activity. Do not lengthen onboarding solely to increase screen-level conversion.
- Do not place a hard paywall before a Bloc can form and demonstrate its accountability value. If monetization is introduced, preserve the core join/log/leaderboard loop and first evaluate Bloc-level or admin-funded upgrades.
- Measure paid acquisition by **cost per activated Bloc** and the invite multiplier, not cost per download alone. One acquired creator can bring several members.
- Design sharing around Fero's genuine emotional peaks: a target hit, a last-minute save, a meaningful leaderboard/status change, and the finalized month result. A generic dashboard is not the growth moment.
- Describe Fero's penalty and settlement model precisely. The current product records obligations and member-confirmed payment status; no payment processor, stored balance, prize pool, or wagering integration was found in the 2026-08-24 source audit. Re-verify this before submission and never imply a broader legal conclusion from the implementation alone.
- Paid acquisition comes after activation and retention are measurable. Use organically proven positioning/creative before scaling paid channels.

Operational specifications:

- `docs/app-store-submission-runbook.md`
- `docs/product-growth-measurement.md`
- `docs/onboarding-evaluation-2026-08-24.md` — deferred post-Banana-Berry review; do not redesign the approved flow before stabilization

## Current Branch State

Date captured: 2026-08-01, Europe/Oslo.

Banana Berry closed on 2026-08-26. The branch snapshot below is the final pre-reconciliation state.

- Live branch: `main`
- Live remote commit before reconciliation: `588abfd` - `Fix live Solo Mode fallback`
- Preview/testing branch: `codex/reconcile-chat-with-backend`
- Preview commit before reconciliation: `e7e355f` - `docs: close Banana Berry preview acceptance`
- Merge base observed: `124d9a`
- Preview was 36 commits ahead of the merge base and 11 commits behind current `origin/main` immediately before reconciliation.

Rule: do not merge preview into live wholesale. `main` currently contains critical live data-correctness fixes that preview does not have. Preview contains onboarding/product work that live does not have. The next merge should be a deliberate reconciliation from current `main`.

## What Live Has That Preview Does Not

These are production fixes on `main` that must survive the next reconciliation:

- August rollover fixes:
  - current-month read state no longer keeps stale previous-month counts
  - readable fetch now persists rollover when needed
  - canonical month counts are guarded against stale status
- Departed-member closed-month filtering:
  - stale departed members are filtered from month history and settlement composition
  - this specifically protects cases like a former member appearing in a closed month they should not be part of
- Stale mutation response protection:
  - old bloc membership/mutation responses should not briefly re-add old blocs to the Bloc Switcher
- Live interaction guards:
  - Today overscroll/switcher bleed fixes
  - swipe edge-case fixes
  - inert switcher render guard
- Rollover audit tooling:
  - `scripts/audit-rollover-counts.mjs`
- Invite-flow rollback:
  - unfinished invite welcome work was reverted from live and should not be restored blindly.

## What Preview Has That Live Does Not

These are useful preview changes that should be brought forward carefully:

- Cold-download onboarding polish:
  - four-screen cold onboarding sequence
  - copy/layout revisions
  - typeable Bloc name handoff into Create Bloc
- Cold user auth handoff:
  - Create Bloc and Join Existing Bloc can start from onboarding
  - existing-account detection path
  - display-name setup path for new accounts
  - intended rule: no empty Bloc Switcher flash during cold onboarding
- Display-name identity protection:
  - display names must not be used to bind or migrate accounts
  - same display name across different emails must be allowed without account takeover
  - `scripts/test-display-name-identity.mjs`
- Setup-review flow after first Bloc creation:
  - defaulted rules can be reviewed
  - review highlights are intended to clear on user interaction or save
- Onboarding setup progress UI:
  - dynamic progress/copy during account and Bloc setup
- Misc product polish in shared files:
  - updates in `src/App.jsx`, `src/components/ColdOnboarding.jsx`, `src/components/authShell.jsx`, `src/modals/modals.jsx`, `src/pages/BlocSettingsScreen.jsx`, and related app state/API helpers.
- Dynamic Bloc Switcher ordering:
  - preview now sorts visible Blocs by the newest workout log from any member
  - ties and no-log Blocs keep the existing saved `groupOrder` as the fallback
  - this is display-only and does not mutate stored Bloc order
- Bloc Switcher swipe-return polish:
  - opening a Bloc from a scrolled switcher preserves that switcher scroll position
  - swiping Today back to the Bloc Switcher restores the exact previous switcher position
  - tapping the top home/switcher button still intentionally resets the switcher to the top
- Settlement reminder timing parity with live:
  - the most recently closed month reminder is hidden while the "last month results" card is visible
  - older unpaid reminders still remain visible during that window
- Activity Feed reaction picker clipping fix:
  - the Activity Feed shell now allows the absolutely positioned emoji picker to escape the feed card boundary
  - the picker fix must not add conditional padding or otherwise resize the Activity Feed card when the emoji row opens

Preview invite/onboarding work passed the complete Banana Berry checklist on 2026-08-26, including profile-photo persistence, signed-in already-member entry, and accidental signup-to-sign-in recovery. It is approved for deliberate reconciliation onto current main.

## Merge Plan

1. Create a fresh reconciliation branch from current `main`.
2. Bring over preview changes selectively, not as a blind merge.
3. Preserve `main` versions of data-correctness logic first, especially:
   - `api/lift-log.js`
   - rollover/read-state paths
   - closed-month member filtering
   - stale mutation guards
4. Re-apply preview onboarding/auth/product changes deliberately on top.
5. Bring over the approved invite-link web flow while keeping the retired full-screen `YOU'RE IN` component out of live.
6. Build and test locally.
7. Push preview and smoke-test on device.
8. Merge to `main` only after onboarding, existing-account handling, and rollover parity all pass.

## Immediate Work Before The Next Main Merge

- Finish cold-download onboarding:
  - no empty Bloc Switcher flash after OTP
  - new users land directly on display-name setup when required
  - create flow: onboarding -> Create Bloc modal -> auth -> display name -> setup progress -> Bloc Today
  - join flow: onboarding -> code -> auth -> display name -> joined Bloc Today
  - existing-account email path clearly offers sign-in or a new email
  - setup progress should not feel stuck; no static loading state longer than roughly 3 seconds
- Finish first-Bloc setup review:
  - review highlights clear when touched or when rules are saved
  - Save Rules should dismiss immediately and persist in the background where safe
  - setup card disappears after Save Rules even if unchanged
- Finish invite flow later, still preview-only:
  - unauthenticated web preview
  - web auth/join
  - one-screen "YOU'RE IN" welcome
  - functional web Bloc view
  - non-blocking download prompt
  - reliable native app handoff via a chosen deep-link/session mechanism
- Add or verify perfect-month Bloc Stream system moment:
  - renderer exists conceptually, but backend generation is not yet proven
  - should be idempotent and generated only after month finalization rules are satisfied
- Tighten the Bloc Switcher return interaction:
  - after swiping Today back to the Bloc Switcher, first tap and first scroll must register immediately
  - no gesture lock, transition guard, or invisible overlay should remain active after the switcher is visible
- Use the local dev OTP harness while polishing onboarding/invite flows:
  - local only, never live/main
  - run local API + Vite from the preview worktree
  - set `ENABLE_LOCAL_DEV_OTP=true` and `LOCAL_DEV_OTP_CODE=000000` in local env
  - use fake emails like `flow1@local.test`
  - reserve real Supabase OTP for the final end-to-end pass after the flow is stable
- Complete the Fero rebrand audit:
  - browser tab title currently still needs checking/updating
  - PWA manifest name/short name needs checking/updating
  - install prompt/home-screen name needs checking/updating
  - OTP/sign-in email sender/copy still needs checking/updating
  - search for old `Firo`, `Anté`, and `NT` naming before App Store submission
- Keep `docs/recurring-debugging-playbook.md` updated for recurring bugs and exact fixes.

## Blob Retirement And Canonical Readiness

The July migration docs show that normal product writes became mostly canonical-authoritative, but the August rollover issue proves the blob compatibility layer can still affect live UI if stale compatibility data is allowed into read composition.

App Store readiness should now be blocked on one of these outcomes:

- fully retire the remaining blob compatibility paths, or
- prove with fresh audits that every remaining blob dependency is inert and cannot affect live UI, settlement, membership, auth/profile, or month history.

### Blob Retirement Work Still To Audit

Audit and either retire or explicitly prove harmless:

- `auth-sync` blob/profile repair dependencies
- display-name keyed historical/profile shell repair
- `upsert-profile` mirror dependency
- `delete-account` blob cleanup dependency
- sit-out request/review compatibility paths
- solo-mode write/read paths if solo remains in scope
- legacy/admin settlement compatibility
- any read fallback that can compose stale blob members, logs, settlements, or month records into canonical UI

### Blob Retirement Test Matrix

Run these before declaring the blob safe to retire or harmless:

- Current month parity:
  - active Bloc leaderboard counts match canonical logs
  - Activity Feed logs/photos/comments/reactions match canonical sources
  - Bloc Switcher statuses match current canonical membership and counts
- Closed month parity:
  - previous month history counts match canonical logs
  - settlement winners/losers match canonical month data
  - departed members are excluded when they were not active for that month
  - previous unpaid reminders remain visible, but newly closed-month reminders wait until the result card expires
- Rollover:
  - simulate or safely reproduce month rollover
  - verify Day 1 current month resets to zero where appropriate
  - verify previous month remains accessible and accurate
  - run `npm run audit:rollover-counts` where available
- Membership lifecycle:
  - create Bloc
  - join Bloc
  - leave Bloc
  - last member leaves and Bloc is removed
  - old left/deleted Blocs never reappear in Bloc Switcher after refresh, mutation, or navigation
  - removed/departed members do not re-enter month summaries or all-time counts incorrectly
- Auth/profile identity:
  - two users can share the same display name without account crossover
  - new-account flow rejects or redirects existing authenticated emails before any account confusion
  - profile email remains tied to the authenticated user id, not display name
  - profile photo persists and renders anywhere avatars are used
- Settlement:
  - settlement creation, confirmation, paid status, reminders, and history are canonical
  - June/July/older unpaid reminders behave according to product rules
- Bloc Stream/system moments:
  - join/leave/member removed
  - target hit
  - cooked and cooked reversal
  - comeback
  - perfect Bloc month
  - log comment cards delete/recreate correctly
- Visual/product smoke:
  - Today, Activity, Month, History
  - Bloc Stream and comments
  - Create Bloc, Join Existing, Settings
  - Solo and Sit Out flows
  - onboarding cold user
  - invite user, once completed

## App Store Readiness Work

Do this after the current product/data readiness work is stable:

- Complete `docs/app-store-submission-runbook.md`; do not submit with placeholders, local-only OTP credentials, or an unseeded social experience.
- Implement and verify the launch-critical events in `docs/product-growth-measurement.md` without logging email addresses, invite codes, profile-photo URLs, or other unnecessary personal data.

- Decide and implement native shell approach, likely Capacitor.
- Configure iOS/Android app identifiers, icons, splash screens, and app name spelling.
- Complete a full naming audit so web title, PWA manifest, installed app name, OTP email copy/sender, support email, legal text, and in-app copy consistently use `Fero`.
- Implement universal links/deep links for invite and post-install handoff.
- Verify auth behavior in native webview/app shell.
- Add native haptics later for completed swipe gestures if desired.
- Prepare privacy policy, terms, data deletion language, and support contact.
- Prepare App Store / Play Store metadata and screenshots.
- Run TestFlight/internal testing with:
  - cold user create flow
  - cold user join flow
  - returning signed-out user flow
  - invite-link flow
  - month rollover and settlement smoke
  - profile photos and media uploads
  - Android emulator/device scroll QA, specifically Bloc Stream scrolling outside the composer/chat input, Today/Activity/Month/History page scroll, and modal/background scroll locks

## Open Decisions

- Exact invite-link app handoff mechanism:
  - universal link, one-time session token, magic-link continuation, or another explicit mechanism
  - do not assume browser session survives app install
- Blob retirement strategy:
  - delete compatibility code entirely, or keep an emergency disabled fallback behind a clear flag
- Perfect-month system moment trigger timing:
  - only after month finalization, not while month is still mutable
- Local/dev auth testing:
  - local dev OTP harness exists on the preview branch for repeated cold onboarding/invite QA without real email cleanup
  - before merging to live, confirm the bypass is disabled unless `ENABLE_LOCAL_DEV_OTP=true` is explicitly set

## Update Log

- 2026-08-01: Created as the active plan after the August rollover incident, live/preview branch split, and onboarding/auth identity work.
- 2026-08-01: Added local-only dev OTP harness plan for repeated onboarding/invite QA using fake `@local.test` emails and code `000000`.
- 2026-08-09: Deferred Android Studio emulator verification for the Android scroll bug; keep the preview fix tracked and verify it on a Pixel emulator/device before App Store/Play Store readiness.
- 2026-08-17: Added `docs/handover-2026-08-17-banana-berry-onboarding-invite.md` as the current long-thread handover for Banana Berry onboarding/invite QA, preview/main reconciliation, and pending App Store blockers. Start there when resuming this work in a new chat.
- 2026-08-24: Added `docs/onboarding-evaluation-2026-08-24.md` to preserve the post-launch onboarding hypotheses derived from the three external growth/App Store articles. Revisit only after Banana Berry is stable and activation instrumentation exists.
- 2026-08-26: Banana Berry passed final manual review. Profile photos, signed-in already-member entry, and accidental signup-to-sign-in recovery are approved. Began deliberate reconciliation of preview onto current main.
