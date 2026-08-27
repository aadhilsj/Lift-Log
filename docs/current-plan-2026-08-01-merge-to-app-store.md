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

Updated: 2026-08-26, Europe/Oslo.

Banana Berry closed on 2026-08-26. Preview was deliberately reconciled onto current main in `codex/banana-berry-reconcile-main` at merge commit `f842e4e`.

- Live branch: `main`
- Live remote commit before reconciliation: `588abfd` - `Fix live Solo Mode fallback`
- Preview/testing branch: `codex/reconcile-chat-with-backend`
- Preview commit before reconciliation: `e7e355f` - `docs: close Banana Berry preview acceptance`
- Merge base observed: `124d9a`
- Preview was 36 commits ahead of the merge base and 11 commits behind current `origin/main` immediately before reconciliation.

Reconciliation result:

- Live canonical readable-state, rollover, stale-member, stale-mutation, switcher, and Solo Mode fixes were preserved.
- Approved onboarding, auth, invite, profile-photo, settings, reaction-picker, and switcher-order work was brought forward.
- The obsolete full-screen `InviteWelcomeScreen` remained deleted.
- Main's rollover audit and recurring debugging playbook remained intact.
- Fake invite-preview member fallbacks were removed.

## Live Fixes Preserved During Reconciliation

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

## Preview Work Brought Forward

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

## Completed Reconciliation Plan

1. Created a fresh reconciliation branch from current `main`.
2. Brought over preview changes selectively, not as a blind merge.
3. Preserved `main` versions of data-correctness logic first, especially:
   - `api/lift-log.js`
   - rollover/read-state paths
   - closed-month member filtering
   - stale mutation guards
4. Re-applied preview onboarding/auth/product changes deliberately on top.
5. Brought over the approved invite-link web flow while keeping the retired full-screen `YOU'RE IN` component out of live.
6. Passed the merged production build and local regression suite.
7. Passed a merged-source browser smoke test and the two automated auth edge flows.
8. Merge the verified reconciliation commit to `main`.

## Verified Complete In Live `main` (2026-08-27 code audit)

These were finished during the Banana Berry work but were never struck from the
plan, so they were being re-reported as outstanding. Each was re-verified
against the live `main` source, not against commit messages alone. Do not
re-open these without new evidence.

### Bloc Switcher return interaction — DONE

- Fixed by `0a70bba` (`Fix switcher reveal interaction handoff`), confirmed an
  ancestor of `main`.
- Mechanism: a `switcherRevealInteractive` state in `src/App.jsx` is set the
  moment a closing swipe is committed. While it is true, the Today surface gets
  `pointerEvents:"none"` and the switcher is rendered with `inert:false`, so the
  first tap and first scroll land on the switcher instead of being swallowed by
  the outgoing Today layer. The flag is cleared on commit and on swipe reset.
- Related and also in `main`: `d1d5def` (`Preserve switcher scroll on swipe
  return`), `4b460e1` (inert switcher render guard), and `4b013a4`
  (`fix: stabilize mobile tab gestures`).

### First-Bloc setup review — DONE, all three sub-items

- Fixed by `fb2a73e` (`Fix onboarding account handoff and setup review`), plus a
  later `optimisticClose` addition. Confirmed an ancestor of `main`.
- Highlights clear when touched: `ReviewShell`
  (`src/pages/BlocSettingsScreen.jsx:90`) fires `onDismiss` on `onPointerDown`,
  wired to `dismissReviewField` for `feeModel`, `acceptedWorkoutTypes`, and
  `timeZone`. Dismissed fields are filtered out of `pendingSet`.
- Save Rules dismisses immediately: `saveRules` passes `optimisticClose: true`,
  and `src/App.jsx:1022` closes the sheet up front and reconciles the mutation
  in the background.
- Card disappears even if unchanged: `saveRules` always sends
  `setupReview: { pending: {} }` regardless of whether any value changed.

### Cold-download onboarding — DONE, all six sub-items

Verified in live `main` on 2026-08-27 by reading the render gate in
`src/App.jsx` (~line 2645 onward), not by commit message.

- No empty Bloc Switcher flash after OTP: `postAuthActionPending` returns
  `SetupProgressScreen` *before* any switcher surface can render, and
  `authStep === "name"` returns `DisplayNameSetupScreen` directly. There is no
  window in which an empty switcher can paint.
- New users land directly on display-name setup when required: same gate.
- Create and join flow sequences: both are wired through `handleColdOnboarding
  Create` / `handleColdOnboardingJoin` with the documented stage order. The
  join path collects the invite code *before* auth via a dedicated
  `onboardingJoinCodeStep` branch that keeps onboarding screen 4 mounted behind
  the sheet so Cancel returns exactly where it began.
- Existing-account email path: `checkAuthEmailExistsData` runs before OTP send
  on both the `signup` intent and the onboarding create/join intents, routing to
  `authStep = "existing"` rather than silently creating a duplicate account.
- Setup progress never feels stuck: `SETUP_PROGRESS_STAGES` defines five stages
  with rotating labels advancing every 2200ms over a continuously animating
  progress bar, so no static state persists past roughly 3 seconds.
- Also shipped and in `main`: `be5b537` (`Keep cold onboarding actions out of
  empty switcher`).

### Invite flow — MOSTLY DONE; only native handoff outstanding

Previously tracked as entirely preview-only. In live `main`:

- Unauthenticated web preview: `PreviewLanding` in `src/components/authShell.jsx:87`
  renders the real Bloc name, target, member count, and leaderboard rows.
- Web auth/join: `JoinGroupModal` (`src/components/authShell.jsx:298`) with
  signed-in and signed-out paths and an already-member entry path.
- Invalid/expired/full invite states: dedicated invalid-invite screen and a
  `memberCount >= 20` full-Bloc branch.
- Non-blocking download prompt: `renderInviteDownloadPrompt` in `src/App.jsx:2464`,
  explicitly non-blocking ("You can keep using your Bloc here").
- The one-screen "YOU'RE IN" welcome was **deliberately retired**, not left
  undone. Do not rebuild it.
- **Still outstanding:** reliable native app handoff via a chosen
  deep-link/session mechanism. This is the only remaining invite work.

### Local dev OTP harness — SAFE, guard verified

The plan required confirming the bypass cannot reach production. Verified in
`api/lift-log.js`:

- `ENABLE_LOCAL_DEV_OTP` (line 33) defaults to false and requires the literal
  string `true`.
- `.env.example` ships `ENABLE_LOCAL_DEV_OTP=false`.
- `parseLocalDevAuthToken` (line 5193) additionally requires the token prefix
  `local-dev:` **and** an `@local.test` email domain.
- The RPC-fallback path additionally requires the Supabase hostname to be
  `127.0.0.1`, `localhost`, or `::1` (line 3194).

Four independent conditions. Still re-confirm the env var is unset on the
production/native build before submission, but the code fails closed.

### Fero naming audit — NEARLY DONE

- Clean: `index.html` (`<title>Fero`, `apple-mobile-web-app-title` Fero) and
  `public/manifest.webmanifest` (`name` and `short_name` both Fero).
- **Outstanding residue:**
  - `public/sw.js:1` — `const CACHE_NAME = "firo-v51"`
  - `api/lift-log.js:9667` — user-facing error string `"Anté sync proxy failed"`
  - `package.json` — `"name": "firo"`
- **Cannot be audited from the repo:** the OTP/sign-in email sender and copy are
  Supabase-hosted templates with no source in this codebase. Check them in the
  Supabase dashboard.

## Immediate Work Before The Next Main Merge

> Cold-download onboarding and the web half of the invite flow moved to
> **Verified Complete In Live `main`** on 2026-08-27. Only the items below are
> genuinely outstanding.

- Invite flow — remaining piece only:
  - reliable native app handoff via a chosen deep-link/session mechanism
  - everything else in this flow is shipped; the "YOU'RE IN" screen was
    deliberately retired and must not be rebuilt
- Add perfect-month Bloc Stream system moment (CONFIRMED NOT IMPLEMENTED, 2026-08-27 audit):
  - the renderer is fully present: `src/pages/BlocStream.jsx:49` registers the
    `perfect_bloc_month` system kind and `src/pages/BlocStream.jsx:388` renders
    the `perfect_month` UI kind
  - the only producer is fixture/demo data at `src/lib/blocStream.js:102`
  - `perfect_bloc_month` appears nowhere in `api/`, `scripts/`, or `supabase/`;
    the backend emits only `target_hit`, `cooked`, `comeback`, `member_joined`,
    `member_left`, and `member_removed`
  - a real Bloc can therefore have a perfect month and no card is ever created
  - remaining work is backend generation only; it must be idempotent and run
    only after month finalization rules are satisfied
- Use the local dev OTP harness while polishing onboarding/invite flows:
  - local only, never live/main
  - run local API + Vite from the preview worktree
  - set `ENABLE_LOCAL_DEV_OTP=true` and `LOCAL_DEV_OTP_CODE=000000` in local env
  - use fake emails like `flow1@local.test`
  - reserve real Supabase OTP for the final end-to-end pass after the flow is stable
- Complete the Fero rebrand audit — three known residues remain:
  - `public/sw.js:1` — `const CACHE_NAME = "firo-v51"`
  - `api/lift-log.js:9667` — user-facing string `"Anté sync proxy failed"`
  - `package.json` — `"name": "firo"`
  - OTP/sign-in email sender/copy: Supabase-hosted template, must be checked in
    the Supabase dashboard; there is no source for it in this repo
  - browser tab title and PWA manifest are already correct; do not re-check
- Keep `docs/recurring-debugging-playbook.md` updated for recurring bugs and exact fixes.

## Blob Retirement And Canonical Readiness

The July migration docs show that normal product writes became mostly canonical-authoritative, but the August rollover issue proves the blob compatibility layer can still affect live UI if stale compatibility data is allowed into read composition.

App Store readiness should now be blocked on one of these outcomes:

- fully retire the remaining blob compatibility paths, or
- prove with fresh audits that every remaining blob dependency is inert and cannot affect live UI, settlement, membership, auth/profile, or month history.

### Existing Blob Audit Tooling (found 2026-08-27 — read this first)

The plan described blob retirement as an unscoped audit. It is not. Substantial
machinery already exists in `api/lift-log.js` and was never referenced here:

- `BLOB_MIRROR_DEPENDENCY_AUDIT` (generated 2026-07-13) already classifies every
  action into `trueBlobInputAuthorities`, `canonicalInputMutations` (18 actions),
  `readableOrCanonicalOnlyActions`, and `disabledLegacyActions`.
- `BLOB_MIRROR_RETIREMENT_READINESS` already records `mirrorSkipCandidates` with
  per-family status, `blockedActionFamilies` with named blockers, and a
  `requiredBeforeFirstSkip` checklist.
- A runtime kill switch already exists: `BLOB_MIRROR_SKIP_ACTIONS`, an env var
  parsed at line 91 and filtered against `BLOB_MIRROR_SKIP_ALLOWED_ACTIONS`.
  **13 actions are already wired** for mirror-skip (`create-group`, `join-group`,
  `kick-member`, `leave-bloc`, `update-settings`, `season-proration-choice`,
  `add-log`, `multi-log`, `reaction`, `flag`, `flag-response`, `flag-review`,
  `delete-log`).
- The env var is **not set in `.env.example`, `.env.local`, or `vercel.json`**,
  so it currently defaults to empty and every blob write is still on. The
  mechanism is built and switched off.
- Two admin-pinned diagnostic endpoints already exist and can be called against
  a live environment: POST actions `blob-mirror-dependency-report` and
  `blob-mirror-retirement-readiness-report`.

The audit's own conclusions on the four items this plan flagged as unknown:

| Item | Recorded status |
| --- | --- |
| `auth-sync` | True blob input authority; **blocked**. Legacy identity repair must see blob gaps canonical projections hide. |
| `repair-display-name` | True blob input authority; quarantined legacy path, explicitly not a proving ground. |
| `upsert-profile` | Canonical-input, but **blocked** on identity-rename historical shell scope. |
| `delete-account` | Canonical-input, but **blocked** on destructive stale-blob cleanup scope. |
| `sitout-request` / `sitout-review` / `settlement` | Canonical-input, **blocked** on historical closed-month scope. |

Practical consequence: this is a staged rollout, not a research project. The
next step is the `requiredBeforeFirstSkip` checklist (apply the revision-clock
RPC everywhere, confirm `canonicalRevisionAvailable=true`, then enable
`BLOB_MIRROR_SKIP_ACTIONS` for one narrow family and soak it), not a fresh
investigation. Run the two report endpoints against production before planning
further.

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
- 2026-08-27: Code audit of live `main` confirmed the Bloc Switcher return interaction and all three first-Bloc setup-review sub-items are implemented and shipped; both were removed from outstanding work and recorded under Verified Complete with their commits and mechanisms. The same audit confirmed the perfect-month system moment is genuinely not implemented: the renderer and system-kind registration exist, but no backend code path ever emits `perfect_bloc_month`.
- 2026-08-27: Full audit of every remaining "Immediate Work" item against live `main`. Cold-download onboarding (all six sub-items) confirmed shipped. Invite flow confirmed mostly shipped; only native handoff remains. Local dev OTP guard confirmed to fail closed behind four independent conditions. Naming audit confirmed nearly complete with three specific residues plus a Supabase-hosted OTP email template that cannot be audited from the repo. Discovered pre-existing blob-retirement audit tooling, a 13-action mirror-skip allowlist, and two diagnostic endpoints that this plan had never referenced; blob retirement is a staged rollout that is built and switched off, not an unscoped investigation.
