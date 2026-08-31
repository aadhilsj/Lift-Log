# Fero iOS Release Status — 2026-09-01

This is the operational status for the `codex/app-store-readiness` branch. It
does not authorize changes to `main` or to the separate `blob_retirement`
branch.

## Completed on this branch

- Capacitor iOS shell added with display name `Fero` and bundle identifier
  `com.aadhilsj.fero`.
- Native privacy manifest is present and the app declares no non-exempt
  encryption.
- iOS deployment target is 15.0.
- Native app builds successfully with Xcode 16.4 and launches in an iPhone 16
  Pro simulator running iOS 18.6.
- Browser/PWA naming is `Fero`; the browser title and manifest are aligned.
- Invite-download UI is suppressed inside the installed native shell.
- Account deletion UI and backend action already exist; full production
  deletion verification remains required before submission.

## Must be resolved before an App Store Connect submission

1. **Apple Developer Program and App Store Connect owner.** Enrollment is a
   paid account action and must happen under the final publisher identity.
   The selected bundle identifier should only be changed before the first
   App Store release if that identity requires it.
2. **Public legal/support destinations.** Fero needs public, final URLs for a
   Privacy Policy, Terms/EULA, and monitored support contact. Do not publish
   placeholder policy text or claim a company name that has not been formed.
3. **Production-domain decision.** The current live app URL is
   `https://lift-log-nu.vercel.app`. A branded HTTPS domain is needed before
   we can configure reliable Universal Links.
4. **Invite handoff.** Web invite joins work today, but post-install handoff
   needs Universal Links plus a short-lived, server-side opaque token. Browser
   local storage and Supabase URL tokens are explicitly not acceptable for
   that handoff. This needs a small backend/data-model design before code is
   written.
5. **Review environment.** Seed a non-personal review account and Bloc,
   including a working sign-in method, workout activity, a safe log-workout
   path, and invitation coverage.
6. **Blob retirement.** Devin's `blob_retirement` work must independently
   finish its canonical parity checks before it is considered for this
   release. Do not merge it merely because the iOS shell is ready.

## Pre-TestFlight sequence

1. Resolve the publisher identity and enroll it in Apple Developer Program.
2. Create/point the public Fero legal and support URLs.
3. Choose the production domain and implement/test Universal Link handoff.
4. Verify account deletion, photos, auth, invitations, and settlement wording
   in the submitted environment.
5. Create the App Store Connect record, complete privacy answers and metadata,
   then upload an archive for TestFlight.

## Current non-blocking observations

- Cold onboarding currently requests remote Unsplash images. Before final
  submission, confirm their production use and asset rights, or replace them
  with approved local assets.
- The code still uses technical `ante_core`/`AnteWordmark` identifiers. The
  rendered wordmark is `FERO`; the technical names are not customer-facing.
