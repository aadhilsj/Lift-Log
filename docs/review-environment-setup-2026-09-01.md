# Fero Reviewer Environment Setup — 2026-09-01

Purpose: give App Review a working, non-personal path through Fero without
depending on a second human or any local-only fixture.

## Ownership

| Role | Owner | Status |
| --- | --- | --- |
| Review account owner | Dedicated Fero-controlled inbox | Deferred pending founder setup |
| Seeded Bloc owner | TBD | Not created |
| OTP/email delivery owner | TBD | Not verified |
| App Review contact | TBD | Pending publisher/support details |

## Build a reviewer-safe Bloc

1. Use a dedicated non-personal inbox controlled by Fero—not a founder's
   everyday account and not an `@local.test` address.
2. Create a dedicated review account through the same production authentication
   path Apple will use.
3. Create one private Bloc with realistic but non-identifying test members.
4. Add enough current-month workouts to show a live leaderboard and activity.
5. Ensure the review account can add a workout, reaction, and comment itself.
6. If the submitted build exposes settlement results, seed one closed-month
   example and verify its wording is accurate.
7. Create an active invite link or code that Apple can use without another
   person. Record it only in App Store Connect review notes/password manager,
   never in this repository.
8. Verify photo upload/read, account deletion, sign-out, sign-in, and the
   invite path on the TestFlight build. Also verify that the native build's
   configured API origin handles authenticated refresh and workout saves from
   the Capacitor WebView.

## Evidence to capture before review

- One continuous screen recording of the reviewer flow.
- Screenshots used on the product page, captured from the submitted build.
- A completed App Review notes field using the template in
  `docs/app-store-listing-draft-2026-09-01.md`.
- A record of the exact commit, version, build number, environment, and seed
  date in `docs/app-store-submission-runbook.md`.

## Hard rules

- Never provide a local OTP bypass, `000000`, an `@local.test` identity, or a
  local Banana Berry fixture to App Review.
- Do not put real reviewer credentials, invite links, or OTP secrets in git or
  chat.
- Keep the review account, backend, email delivery, storage, and seeded Bloc
  active until Apple finishes review.
