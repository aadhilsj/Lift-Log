# Fero privacy and data inventory

Last updated: 2026-09-15 (Europe/Oslo).

Purpose: factual handover for the eventual Privacy Policy and App Store Connect
App Privacy answers. This is a source-code review of the App Store Preview
branch at `a74d5a7`; it is not legal advice, a production-database inspection,
or a substitute for confirming the live deployment and vendor contracts.

## Plain-English summary

Fero is a private group workout-accountability app. It needs an email account,
then stores the profile and workout/group information needed to run a Bloc. It
also records limited, account-linked product-use events for the founder
dashboard. It does not currently contain a paywall, in-app purchase flow, or a
push-notification client implementation.

Before publishing a policy, we need to settle a few factual choices—especially
what remains in a shared Bloc's history after somebody deletes their account,
how long granular usage events are retained, and whether public photo URLs are
acceptable for version one.

## Data map observed in Preview

| Data | Why Fero uses it | Where it is handled | Who can see it / current retention fact |
| --- | --- | --- | --- |
| Email, account ID, sign-in session | Email-OTP sign-in, account recovery, account operation | Supabase Auth; Fero API | The account holder and authorised Fero operations. The source does not define a separate email-retention period after account deletion. |
| Display name and optional profile photo | Identify a member across Blocs | Supabase database and `profile-photos` storage | Other members of the same Bloc can see them. The source configures profile-photo objects as public URLs; verify the deployed bucket before launch. |
| Bloc name, invite code, membership, roles, joined/left dates | Create and operate private workout groups | Supabase database, compatibility mirror while Blob retirement is in progress | Relevant Bloc members and Fero operations. Invite links/codes must be treated as private. |
| Workouts: type, date/time, notes, counts, verification/moderation state, optional photo | Show progress, leaderboards, monthly results, and accountability | Supabase database and `workout-photos` storage | Relevant Bloc members and Fero operations. Source describes workout-photo cleanup: unflagged after 72 hours; flagged photos until resolved; then 24 hours after a decision. Verify live configuration. |
| Comments, reactions, Bloc Stream messages/replies, event details and RSVPs | Group conversation and accountability | Supabase database; a small local message cache | Relevant Bloc members and Fero operations. No separate retention rule was found in source. |
| Sit-out, solo/training, target and exception requests | Apply each Bloc's workout rules fairly | Supabase database | Relevant Bloc members/admins and Fero operations. |
| Settlement records and member payment handles | Let members record workout-penalty outcomes and optionally copy/open a member-selected payment handle | Supabase database | Relevant Bloc members. Fero does not process, hold, route, or verify a payment in the current code. A handle can be a Revolut, PayPal, Vipps or similar identifier, so it needs explicit policy disclosure. |
| Reports/flags and responses | Allow members/admins to flag a workout and record a review | Supabase database | Reporter, involved member, Bloc admin and Fero operations as the product permits. |
| Product-use events and daily activity | Aggregate product improvement and founder dashboard | Supabase database | Private Fero operations only. Events are limited to named UI actions and timestamp/profile link; no content or route parameters are recorded. Preview config schedules the daily-activity 90-day purge for 03:00 every day; final production execution still needs verification. No retention limit was found for granular `app_usage_events`. |
| Device/browser state | Keep a selected Bloc, app preferences, cached app state, sign-in/session state, install/onboarding status and stream draft cache working | Device local storage and service-worker cache | On the user's device/browser. The service worker excludes API responses from its static cache. Account deletion needs a final device-level test to confirm no personal cache remains usable. |

## Services and outside destinations found in source

- **Supabase:** authentication, database, and photo storage.
- **Vercel:** web/API hosting.
- **Google Fonts:** the service worker fetches the Outfit and JetBrains Mono font stylesheet from Google.
- **Unsplash:** onboarding sample imagery is loaded from Unsplash URLs.
- **Member-chosen payment providers:** a member may choose to open/copy their own Revolut, PayPal or Vipps-style payment details. This is user initiated; it is not a Fero payment service.

No third-party behavioural-analytics SDK was found in the source/package
inventory. Before launch, confirm the real production configuration, any email
delivery vendor, and whether any platform-level analytics are enabled.

## Account deletion: what the current code does

The account-deletion action authenticates the user, removes their owned profile
and workout photos from the two storage buckets, deletes their profile and
Supabase Auth identity, removes them from active Bloc membership, deletes a
sole-member Bloc, and transfers an admin role where a surviving Bloc needs one.

The canonical database deliberately preserves historical shared records by
clearing their profile link rather than deleting all referenced rows. The
compatibility state also scrubs the departing member from current logs. This
creates a decision that must be made before public wording: which old workouts,
comments, reactions, settlement history, photos and display-name snapshots—if
any—remain visible to other Bloc members after deletion. The policy, deletion
implementation and final test must all match that decision.

## Content-safety finding

The build has a workflow to flag a workout/photo and have a Bloc admin review
it. I found no user-to-user blocking control and no general filtering system
for Stream messages/comments in the reviewed source. Because Fero includes
user-generated content, this is a release blocker to resolve before
submission: confirm the intended moderation/support process and add a suitable
block/report/filter capability if the final product still includes those social
surfaces. Do not claim such a feature in Community Rules until it exists and is
tested.

## Decisions or confirmations needed before public privacy wording

1. Set the deletion rule for historic shared content, then make the app and
   policy agree.
2. Confirm that the daily-activity purge is successfully running in production,
   and implement the founder-approved six-month retention period for granular
   usage events.
3. Change the live `profile-photos` and `workout-photos` buckets from public
   URLs to access-controlled delivery before launch. This is founder-approved;
   verify the final deployed configuration.
4. Confirm each live vendor, hosting region, email provider, analytics setting
   and launch country/region.
5. Decide whether member payment handles remain in version one. If yes,
   disclose them precisely and state that Fero does not process payments.
6. Resolve the missing UGC blocking/filtering/support controls, then write the
   Community Rules to match the working product.
7. Test deletion, photo cleanup, cached-device behaviour, reporting and
   moderation in the final TestFlight environment.

## What this means for the App Store work

This audit is the factual base for the Privacy Policy and App Store Connect
answers. It does not publish a legal page and does not change product behavior.
Once the decisions above are made, an agent can draft public-facing Privacy,
Terms, Support and Community Rules pages with the selected support email and
domain. The App Store branch remains Preview-only; nothing here authorises a
change to `main` or production.

## Source areas reviewed

- `docs/SCHEMA.md`
- `api/lift-log.js`
- `src/lib/api.js`, `src/lib/appState.js`, `src/lib/paymentLinks.js`
- `src/pages/ActivityPage.jsx`, `src/pages/ActivityFeed.jsx`,
  `src/pages/BlocStream.jsx`, `src/pages/ProfilePage.jsx`
- `supabase/ante-core-profiles-delete-rpc.sql`
- `supabase/storage-profile-photos.sql`, `supabase/storage-workout-photos.sql`
- `supabase/migrations/20260828030000_add_founder_dashboard_metrics.sql`
- `supabase/migrations/20260829003000_add_founder_dashboard_usage_events.sql`
- `public/sw.js`, `src/components/ColdOnboarding.jsx`
