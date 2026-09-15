# Fero App Store release pack

Last updated: 2026-09-15 (Europe/Oslo).

Purpose: one simple handover for the remaining App Store preparation. It is
based on the Preview branch and factual source review; it does not publish
anything or alter production.

## The release in one sentence

Fero 1.0 is a **free, invite-only workout-accountability app** for private
groups called Blocs. Members log workouts, follow progress, and record
member-to-member accountability outcomes; Fero does not process payments.

## Confirmed build facts

| Item | Current fact |
| --- | --- |
| App name | Fero |
| Bundle ID | `com.aadhilsj.fero` |
| Version / build in Xcode project | 1.0 / 1 |
| Price for V1 | Free |
| Premium / purchases | Not implemented; visible Premium copy still needs removal/renaming before submission |
| Native permissions declared | No camera, photo-library, location, microphone, contacts or tracking-usage string was found in the iOS `Info.plist` |
| Encryption declaration | `ITSAppUsesNonExemptEncryption` is `false` in the current `Info.plist`; confirm this during App Store Connect export-compliance questions |
| Backend | Supabase plus Vercel-hosted API/web delivery |
| User-generated content | Workout photos/notes, reactions, comments and Bloc Stream messages/events |

## App Privacy working draft — founder/legal review required

This is a factual starting point for Apple's questionnaire, **not final
answers**. Complete it only after the privacy decisions in the data inventory
are approved and the submitted build is frozen.

| Likely Apple data area | Actual Fero data | Likely purpose | What still needs confirmation |
| --- | --- | --- | --- |
| Contact information | Email address | Account sign-in and support | Final email vendor and retention after deletion |
| Identifiers | Fero/Supabase account identifier | App functionality and security | Final App Store category wording |
| User content | Workout notes, photos, comments, messages, reactions and event RSVPs | App functionality | Retention/deletion rule for shared historic content |
| Health & fitness information | Workout type, date, counts, targets and workout history | App functionality | Exact Apple questionnaire category; Fero must not make medical claims |
| Financial / payment-related details | Member-selected payment handles and settlement status; no card data or Fero payment processing | App functionality | Whether handles stay in V1 and Apple’s exact category selection |
| Usage data | Account-linked, named screen/action events and daily opens | Product analytics and app functionality | Granular-event retention period |
| Photos | Profile and workout photos | App functionality | Change/confirm public photo delivery before final disclosure |

Based on source review, Fero does **not** use the above data for cross-app or
cross-company tracking. Reconfirm this after the final vendor configuration is
known.

## Screenshot plan

Capture five clean, non-personal screenshots from the signed TestFlight build.
Use truthful seeded data; do not use an internal local-only fixture or show
real users' names, emails, payment handles, invite codes, or private photos.

1. **Your Bloc, in motion** — Today screen with a live target and leaderboard.
2. **Log the work** — workout logging flow with an optional note/photo shown
   using reviewer-safe test data.
3. **See the team show up** — Activity with a reaction/comment example, only
   after moderation controls are complete.
4. **Every month tells a story** — Month or History screen with progress and
   a finished-month result. Do not imply Fero transfers money.
5. **Private by design** — invite-only Bloc setup/joining screen with a fake
   seeded invitation, never a usable production code.

Apple currently permits one to ten screenshots. For a 6.9-inch iPhone
portrait, use an accepted 1260 × 2736, 1290 × 2796, or 1320 × 2868 pixel image;
screenshots cannot contain transparency. Capture the largest required iPhone
size after confirming the target device in App Store Connect.

## Reviewer walkthrough — ready to fill once the review account exists

1. Sign in with the dedicated Fero reviewer account.
2. Open the seeded private Bloc.
3. Log a workout and see the leaderboard/activity update.
4. View a member profile, activity and month/history screens.
5. Use the finished moderation/report/block experience once built.
6. Open Settings/Profile to find support, Privacy Policy, Terms, sign-out and
   Delete account.

In the final App Review notes, explain that Blocs are invite-only and that
Fero only records member-to-member accountability outcomes—it does not hold,
transfer or verify money. Give Apple a working, non-personal account and keep
the account, email route, backend and seeded Bloc active for the whole review.

## Current verification evidence

Passed on Preview during this release-pack refresh:

- `npm run lint`
- `npm run build` (one non-blocking 945.58 kB JavaScript-bundle warning)
- Release guards and account-deletion contract checks
- Founder-dashboard, two-workouts-per-day, month-rollover-isolation,
  display-name identity, profile-stat cache, Bloc Stream, month-award,
  system-health and Blob-parity test suites
- Greenlight preflight: no critical issues; one informational existing
  `console.error` about canonical profile-sync failures

The two Playwright browser flows were improved to wait for the actual page/UI
rather than an impossible "no network traffic" state. They now need the
purpose-built seeded test account and invite code to complete; the ordinary
local server did not contain those fixtures. Re-run them against the final
review/TestFlight environment before submission.

## Blocking work before submission

1. Build and test user blocking plus an objectionable-content filtering and
   support process for messages/comments. Reporting a workout alone is not
   enough for Fero's user-generated-content features.
2. Decide and implement photo delivery: public direct links should be replaced
   with authenticated/signed access unless a reviewed reason says otherwise.
3. Remove/rename all visible Premium labels for V1; retain the internal future
   feature map but do not promise an unavailable paid tier.
4. Decide the historical-data-on-account-deletion rule and granular-usage-event
   retention, then make the implementation and Privacy Policy agree.
5. Choose the public support email/domain and publish Privacy, Terms, Support
   and Community Rules pages.
6. Create the non-personal reviewer account and seeded Bloc, then perform the
   final signed TestFlight end-to-end test.
7. Finalise App Store Connect fields: publisher/seller identity, countries,
   age rating, privacy answers, screenshots, review notes and signed build.

## Founder review — the sensitive choices only

- Which public support email and domain represents Fero?
- Should workout/profile photos become access-controlled before V1? Recommended:
  yes.
- What happens to a departed member's old shared workouts, comments, reactions,
  photos and settlement history?
- How long should detailed product-use events be kept? Recommended starting
  point: 90 days, with anonymised/aggregate reporting retained if needed.
- Which launch countries are intended, and has the settlement wording received
  appropriate advice for those countries?
- After the moderation work is complete, who monitors reports and the support
  inbox during App Review and launch?

## Related documents

- `docs/privacy-data-inventory-2026-09-15.md`
- `docs/future-premium-feature-map-2026-09-15.md`
- `docs/app-store-listing-draft-2026-09-01.md`
- `docs/review-environment-setup-2026-09-01.md`
- `docs/app-store-submission-runbook.md`
