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

## Current Live vs Preview Awareness

- Live has received month-rollover and settlement visibility fixes directly because August 2026 exposed production issues.
- Preview contains the newer onboarding/auth/invite-code work and ongoing invite-link flow work.
- Before the next merge, compare live `main` against this branch carefully so the rollover fixes from live are not overwritten by older preview behavior.

## Invite-Link Flow

Current preview scope:

- Invite link opens web Bloc preview through `?invite=CODE`.
- Invite context is loaded from the URL.
- User authenticates on web, joins the Bloc, sees the one-time `YOU'RE IN` screen, then enters the real Bloc Today screen.
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
