# Fero App Store release pack

Last updated: 2026-09-18 (Europe/Oslo).

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
| Premium / purchases | V1 has no paywall or purchases; visible Premium labels were removed on the App Store branch. Recheck the signed build before submission. |
| Native permissions declared | Camera and photo-library purpose strings are present for workout/profile photos. No add-to-library string is needed; no location, microphone, contacts or tracking API was found in the reviewed app paths. |
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
| Photos | Profile and workout photos | App functionality | App Store branch signs scoped photo links for 24 hours; production bucket privacy is not confirmed. Verify the owner-run Storage rollout before final disclosure. |

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
   from the tested release build with its report/block/moderation controls.
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
5. Use the report/block/moderation experience in the tested release build.
6. Open Settings/Profile to find support, Privacy Policy, Terms, sign-out and
   Delete account.

In the final App Review notes, explain that Blocs are invite-only and that
Fero only records member-to-member accountability outcomes—it does not hold,
transfer or verify money. Give Apple a working, non-personal account and keep
the account, email route, backend and seeded Bloc active for the whole review.

## Current verification evidence

Passed on the local `codex/app-store-readiness` branch during the 2026-09-18
release checks (this is not a claim that these changes are deployed):

- `npm run lint`
- `npm run build` (existing non-blocking large JavaScript-bundle warning)
- Every `test:*` script; `test:mobile-navigation` passed five consecutive runs
  after correcting the test's touch point. Its `historyScrollable` result checks
  scroll-container capability; real vertical finger scrolling still needs the
  iPhone TestFlight check below.
- Greenlight preflight was not run in that session.

The browser flows use local seeded fixtures. Database-backed moderation and RLS
flows still need an isolated restored/development Supabase copy; the sandbox
does not implement the canonical RPCs, and Vercel Preview has Production-only
database variables. Do not use production member content as test data.

## Blocking work before submission

1. Promote the App Store server code (report/block/moderation, Capacitor CORS,
   and photo signing) to `main` only after full checks and explicit founder
   approval. The native app talks to production, so do not submit against a
   production API that lacks those endpoints.
2. Test report/block/hide/restore and RLS flows on an isolated copy using
   `docs/app-store-safe-copy-test-checklist-2026-09-18.md`.
3. Confirm private photo buckets on the isolated copy, then have the founder
   review and run the Storage migration in production after a fresh backup.
4. Premium labels are removed on the branch; verify the signed build and
   screenshots contain no unavailable paid-tier promise.
5. Decide the historical-data-on-account-deletion rule. Implement the
   founder-approved six-month granular-usage-event retention rule, then make
   the implementation and Privacy Policy agree.
6. Choose the public support email/domain and publish Privacy, Terms, Support
   and Community Rules pages.
7. Create the non-personal reviewer account and seeded Bloc, then perform the
   final signed TestFlight end-to-end test. On a real iPhone, open History and
   drag up and down over the All-Time Leaderboard; confirm the page scrolls
   vertically and horizontal drags remain within the table.
8. Finalise App Store Connect fields: publisher/seller identity, countries,
   age rating, privacy answers, screenshots, review notes and signed build.

## Founder review — the sensitive choices only

- Which public support email and domain represents Fero?
- Photo access control before V1: **approved**. Preserve the visible UI; change
  only who is technically allowed to load the underlying image.
- What happens to a departed member's old shared workouts, comments, reactions,
  photos and settlement history?
- Detailed product-use event retention: **six months** approved. The existing
  90-day daily-activity cleanup remains separate.
- Launch availability: intended for **all App Store countries/regions**. Confirm
  the final settlement wording and region-specific legal review before turning
  that availability on.
- After the moderation work is complete, who monitors reports and the support
  inbox during App Review and launch?

## Related documents

- `docs/privacy-data-inventory-2026-09-15.md`
- `docs/future-premium-feature-map-2026-09-15.md`
- `docs/app-store-listing-draft-2026-09-01.md`
- `docs/review-environment-setup-2026-09-01.md`
- `docs/app-store-submission-runbook.md`
