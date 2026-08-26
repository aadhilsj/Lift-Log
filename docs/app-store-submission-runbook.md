# Fero App Store Submission Runbook

Last updated: 2026-08-24, Europe/Oslo.

Purpose: make Fero deterministic and understandable to App Review. This is an operational runbook, not legal advice and not a place to store production secrets. Store reviewer credentials in App Store Connect and the team password manager; record only ownership and readiness here.

Official references:

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Submitting for review](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/overview-of-submitting-for-review)
- [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Offering account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/)

## Submission Record

Complete a fresh copy of this table for every submitted build.

| Field | Value |
| --- | --- |
| App version | TBD |
| Build number | TBD |
| Commit | TBD |
| Submission date/time | TBD |
| App Store Connect owner | TBD |
| Reviewer-account owner | TBD |
| Seeded review Bloc | TBD |
| Review invite code/link | TBD — never use a local-only Banana Berry fixture |
| Backend/environment | TBD |
| Screen recording | TBD |
| Result/rejection reference | TBD |

## Reviewer-Safe Product Description

Use this as the factual starting point and update it if the implementation changes:

> Fero is a private workout-accountability app for invited groups called Blocs. Members choose a monthly workout target and an accountability penalty. Fero records workouts, calculates the month result, and records obligations and member-confirmed settlement status between Bloc members.

Before submission, explicitly confirm whether the following statement remains true:

> Fero does not hold funds, transfer money, sell wagering credit, operate a prize pool, or process the settlement between members. Members handle any real-world settlement outside Fero; the app only records the obligation and its member-confirmed status.

Do not submit that statement by assumption. Re-audit the build, backend, store products, and policies. If any payment or reward behavior changes, obtain appropriate legal review and rewrite the App Review explanation.

Also explain:

- Blocs are private and invite-based.
- Who can create a Bloc and change its target/penalty rules.
- The maximum membership currently enforced by the submitted build.
- How workout photos, comments, reactions, flags, and moderation work.
- What `Claim paid`, `Confirm`, and `Dispute` mean if settlement confirmations are enabled.
- Whether any preview-only or feature-flagged behavior is present in the submitted build.

## Deterministic Review Environment

Apple should be able to evaluate the social product without finding another tester.

- [ ] Provide an active review account or a fully featured demo mode.
- [ ] Do not use `@local.test`, OTP `000000`, `ALHK05`, or another local Banana Berry fixture.
- [ ] Ensure the review authentication method works from Apple's network and devices for the entire review window.
- [ ] Seed a review Bloc with realistic, non-personal test members.
- [ ] Include current-month workout activity, leaderboard movement, and a safe route to log a new workout.
- [ ] Include a closed-month result/settlement example if that screen is in the submitted build.
- [ ] Ensure the reviewer can test invitations without needing a second live person.
- [ ] Keep backend, authentication, storage, email delivery, and required feature flags running throughout review.
- [ ] Verify profile-photo and workout-photo upload/read permissions in the review environment.
- [ ] Remove or clearly explain destructive test data reset behavior.

## Screen Recording

Record the submitted build on a supported device. Keep the video short but continuous enough to establish the path:

1. Launch from a cold state.
2. Create/sign in to the review account using the supplied method.
3. Complete or bypass first-run profile setup as the reviewer will.
4. Join the seeded review Bloc using the supplied invite path.
5. Open the Bloc and show its target, penalty, membership, and leaderboard.
6. Log a workout and show the resulting count/status/activity change.
7. Show comments/reactions/reporting or moderation controls if included.
8. Show the finalized month and settlement-confirmation behavior if included.
9. Upload/change a profile photo.
10. Show Privacy Policy, Terms, Support, sign-out, and account deletion.
11. Show any permission prompt and the feature that requires it.

## App Review Notes Template

Replace every bracketed field; do not paste this with placeholders.

```text
Fero is a private workout-accountability app for invited groups called Blocs.

Review video: [URL]

Review account:
- Email/username: [ENTER IN APP STORE CONNECT]
- Authentication instructions: [STEPS]

Seeded Bloc:
- Name: [NAME]
- Invite method/code: [METHOD]

Recommended test path:
1. [SIGN IN]
2. [JOIN SEEDED BLOC]
3. [LOG WORKOUT]
4. [VIEW LEADERBOARD/ACTIVITY]
5. [VIEW CLOSED MONTH/SETTLEMENT IF ENABLED]
6. [VIEW PROFILE AND ACCOUNT DELETION]

Penalty and settlement behavior:
[EXPLAIN EXACTLY WHAT THE SUBMITTED BUILD RECORDS AND WHETHER MONEY EVER MOVES THROUGH FERO]

External services required during review:
[AUTH, DATABASE, STORAGE, EMAIL, ANALYTICS, OTHER]

Permissions:
[PERMISSION -> USER-VISIBLE PURPOSE]

Non-obvious navigation or regional differences:
[DETAILS OR NONE]
```

## Account, Privacy, Safety, And Legal Checks

- [ ] Privacy Policy URL is public, correct, and matches actual collection, retention, sharing, analytics, photos, and account deletion.
- [ ] Terms/EULA and Support URLs are public and branded consistently as Fero.
- [ ] In-app account deletion removes the account and associated personal/user-generated data except data that must legally be retained; document any retention and timing.
- [ ] Deletion is tested end-to-end in the submitted environment, including profile photos and other owned uploads.
- [ ] Support contact is monitored.
- [ ] App privacy disclosures match the submitted binary and backend behavior.
- [ ] Photo, notification, camera, and tracking permission strings are accurate and contextual.
- [ ] Pre-permission UI uses neutral actions such as `Continue` or `Next`; it does not simulate the system `Allow` action.
- [ ] User-generated content surfaces have the reporting, blocking, filtering, and support behavior required for the submitted feature set.
- [ ] Age rating and fitness/health representations are accurate; Fero does not make unsupported medical claims.
- [ ] Penalty/settlement language has been reviewed for every distribution region. Gambling/payment classification is not inferred solely from implementation.

## Store Listing And Build Checks

- [ ] `Fero` is consistent in the binary, browser/PWA artifacts, native display name, authentication emails, support, legal pages, and store metadata; no `Firo`, `Anté`, or `NT` residue.
- [ ] App name, subtitle, description, keywords, category, age rating, support URL, marketing URL, and privacy URL are complete for every localization.
- [ ] Screenshots show the real submitted UI and tell the sequence: create/join Bloc, invite friends, log workouts, leaderboard/accountability, finalized month.
- [ ] Upload one to ten screenshots in current accepted dimensions; images have no alpha/transparency.
- [ ] Icons, splash screens, dark mode, small-device layout, and native safe areas are verified.
- [ ] Universal/deep links and post-install invite handoff are verified.
- [ ] No development menu, local OTP bypass, debug identity, preview-only data, or secret is present/enabled.
- [ ] Export compliance, content rights, privacy nutrition labels, and regional availability are complete.
- [ ] Any in-app purchase or subscription introduced later uses Apple's required purchase flow and has complete metadata, localized terms, restore/manage behavior, and review screenshots.

## Final Test Matrix

- [ ] Cold create flow.
- [ ] Cold join-by-code flow.
- [ ] Invite-link new-user flow.
- [ ] Returning signed-out user flow.
- [ ] Signed-in already-member invite flow.
- [ ] Invalid, expired/full, and already-member invite states.
- [ ] First profile-photo upload and later replacement.
- [ ] First workout and optional workout-photo upload.
- [ ] Bloc Stream/activity, comments, reactions, reporting, and moderation.
- [ ] Month rollover, history, result, settlement claim/confirm/dispute if enabled.
- [ ] Sign out, sign back in, and full account deletion.
- [ ] Offline/transient backend failure produces recoverable UI.
- [ ] TestFlight smoke on the oldest supported iPhone and a current device.
- [ ] Android/Play readiness is tracked separately; do not treat iOS success as Android scroll verification.

## Rejection Log

For each rejection, record the guideline, Apple's exact concern in paraphrase, affected build, evidence supplied, code/metadata change, resubmission date, and outcome. Never work around a reviewer concern by hiding behavior; make the behavior and explanation compliant and testable.
