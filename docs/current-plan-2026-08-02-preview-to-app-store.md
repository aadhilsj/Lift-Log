# Current Plan: Preview Branch to App Store - 2026-08-02

Branch: `codex/reconcile-chat-with-backend`

This is the working source-of-truth plan for the current preview branch. Keep this file updated whenever a substantial product, backend, migration, or App Store-readiness decision changes.

## Current Focus

- Finish and verify all pre-Bloc flows before the next merge:
  - cold first-open onboarding
  - cold create Bloc
  - cold join existing Bloc by code
  - returning signed-out user
  - invite-link web flow
  - empty Bloc switcher state
- Keep preview work separate from live emergency patches until we intentionally merge.

## Pre-Bloc Flow Test Matrix

Approved on preview/local testing:

- Cold first-open onboarding: four-screen pitch opens only for a fresh unauthenticated/no-Bloc entry.
- Cold create Bloc: onboarding screen 4 Bloc-name input -> create modal -> auth -> display name -> progress -> real new Bloc Today screen.
- Cold join by invite code: onboarding screen 4 -> code entry -> auth -> display name -> progress -> real joined Bloc Today screen.
- Returning signed-out user sign-in: welcome-back screen -> sign in -> OTP/dev code -> existing account/Bloc restored.
- Returning signed-out user creates a new account: welcome-back screen -> create new account -> four-screen onboarding -> create Bloc -> finish setup card -> settings review/save.
- Invite-link web flow: `?invite=CODE` opens the invite preview, joins through auth/display-name, then lands directly in the real Bloc with a short top toast.
- Sign-out after invite-link join: after joining from an invite link, signing out returns to the welcome-back screen, not cold onboarding.
- Existing account accidentally entering from onboarding: returning user entering an existing email through onboarding create/join is recognized and routed through sign-in rather than duplicated.
- Empty Bloc switcher state: authenticated user with zero Blocs and onboarding already seen sees a deliberate empty state. Current polish request: make the brand and Create/Join buttons slightly larger.
- Invite-link returning-user path: invited user who already has an account signs in from the invite link and lands directly in the invited Bloc, without cold onboarding and without duplicate invite-code confirmation.
- Invite-link already-member path, signed-out fallback: entering an email already in the invited Bloc is caught before OTP and shows a friendly "You're already in this Bloc" state with an `Enter the Bloc` action.
- Invite-link already-member path, signed-in storage case: a signed-in member opening an invite to a Bloc they already belong to is recognized and can enter without another OTP.
- Existing-account recovery from accidental signup: a returning user who chooses `Create new account`, enters an existing email, and then selects `Sign in` completes OTP and enters the existing account instead of returning to signup.
- Invite-link invalid code state: invalid invite links show a deliberate invalid-invite dead-end screen, not welcome-back and not a sign-in CTA.
- Invite-link full Bloc state: full Blocs block joining with clear copy. Local repeatable test fixture: append `&full=1` to a local invite URL to force the preview into the 20/20 full-Bloc blocked state without mutating real data.

Deferred future state:

- Invite-link expired code state: expiry is not currently modeled. If invite expiry is introduced later, add a dedicated expired-invite state and test it separately from invalid/full.

Current display-name setup behavior:

- Display-name setup now includes optional profile photo capture on the same screen.
- Display name remains mandatory; profile photo is optional.
- `Continue` remains available once the display name is present.
- The selected photo previews immediately, is compressed to a square profile image client-side, and uploads only after the profile identity exists.
- Photo upload runs in the background and must not block create/join navigation. If upload fails, the user can continue and add the photo later from Profile.

Verified after profile-photo addition:

- Cold create Bloc with and without a selected photo.
- Cold join existing Bloc by code with and without a selected photo.
- Invite-link new user join with and without a selected photo.
- Returning signed-out create-new-account flow with and without a selected photo.
- Profile-screen replacement persists and renders after a fresh authenticated read.

## Banana Berry Acceptance - 2026-08-26

- The user manually approved the complete Banana Berry checklist, including the signed-in already-member flow and accidental signup-to-sign-in recovery.
- Profile-photo persistence passed through onboarding and the main Profile screen.
- `test:identity`, `test:profile-photo-storage`, `test:auth-edge-flows`, `test:stream-moments`, and the production build passed before reconciliation.
- Banana Berry flow design is closed. Remaining work is branch reconciliation and the separate native/App Store handoff.

## Current Live vs Preview Awareness

- Live has received month-rollover and settlement visibility fixes directly because August 2026 exposed production issues.
- Preview contains the newer onboarding/auth/invite-code work and ongoing invite-link flow work.
- Before the next merge, compare live `main` against this branch carefully so the rollover fixes from live are not overwritten by older preview behavior.

## Invite-Link Flow

Current preview scope:

- Invite link opens web Bloc preview through `?invite=CODE`.
- Invite context is loaded from the URL.
- User authenticates on web, joins the Bloc, and lands directly in the real Bloc Today screen with a short non-blocking `You're in` toast.
- A non-blocking app download prompt is allowed only for invite-link web joins, not invite-code joins from cold onboarding.

Deferred native handoff:

- Full app-open handoff is not complete until the iOS/Capacitor phase.
- Required later: Universal Links plus an opaque server-side handoff token that lets the installed app route the already-joined user directly into the joined Bloc.
- Do not rely on Safari localStorage or Supabase URL tokens for native handoff.
- Details: `docs/invite-link-flow-handoff-note-2026-07-31.md`.

## Blob Retirement Before App Store

Do not retire the blob yet.

Required before blob retirement:

- Re-run canonical parity/read audits against current production data.
- Verify month rollover, active historical membership, left-member exclusion, settlement summaries, invite/join, create/leave/delete, profile/display-name changes, log comments, reactions, and stream system moments against canonical data.
- Confirm remaining name-keyed card/log structures no longer depend on display-name identity in a way that breaks same-name or renamed-user scenarios.
- Confirm canonical revision/polling can replace blob revision behavior.
- Confirm account deletion and cleanup paths no longer need blob-compatible shells.

## Pre-App Store Checklist

- Finish invite-link native handoff design and implementation during Capacitor/iOS work.
- Rebrand audit:
  - manifest / PWA app name
  - browser tab title
  - installed app label
  - OTP/email copy
  - any remaining `Firo`, `Antè`, or `NT` strings
- Privacy policy and App Store metadata.
- Full QA pass across:
  - auth
  - onboarding
  - invite links
  - create/join/leave Bloc
  - logging
  - activity reactions/comments
  - Bloc Stream
  - month rollover/settlement
  - settings admin/non-admin
  - profile photos
  - swipe navigation

## Testing Notes

- Local/dev auth can use `@local.test` emails and dev OTP `000000`.
- Use real auth only for final confirmation after the local flow passes.
- Do not make users repeatedly scrub real emails during early iteration if local/dev auth can cover the product flow.
