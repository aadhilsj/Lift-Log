# Fero App Store submission packet — working copy

Last updated: 2026-09-24 (Europe/Oslo).

This is a preparation document for the first iOS release. It does not create
an App Store Connect record, publish a URL, upload a build, or change
Production. Items marked **Founder** require Aadhil's decision or account
action. Items marked **Codex** can be prepared in the repository. Items marked
**Devin** depend on the RLS/month-close work.

## Current release position

- Branch: `codex/app-store-readiness`
- Current commit: `5a80df4`
- `origin/main`: `1600a2d`; it is already an ancestor of this branch, so there
  is no newer main commit to merge today.
- App: Fero, bundle ID `com.aadhilsj.fero`, intended price Free.
- Version/build currently in the Xcode project: 1.0 / 1.
- V1 has no Premium paywall, subscription, or in-app purchase.
- The native app is configured to talk to the production API; therefore the
  App Store server work must reach `main` before a final TestFlight build.

## Copy ready for App Store Connect

### Name

Fero

### Subtitle

Train together. Show up.

### Promotional text

Build a private workout Bloc, set a shared monthly goal, and keep each other
showing up.

### Description

Fero is a private workout-accountability app for the friends who help you keep
showing up.

Create a Bloc, invite your people, and choose a monthly workout target
together. Log workouts as you go, follow the live leaderboard, and see how
everyone is progressing.

With Fero you can:

- Create or join invite-only Blocs
- Set a shared monthly workout target
- Log workouts with optional notes and photos
- See live progress, activity, reactions, and comments
- Review month-end results with your Bloc
- Manage your profile, photos, and account from the app

Fero is built for private groups — not public follower counts. Your Bloc is
where the accountability happens.

Fero does not process payments, hold funds, operate a prize pool, or verify
off-platform settlements between members.

### Keywords

`workout,fitness,accountability,habit,goals,training,exercise,group,leaderboard`

### Categories

- Primary: Health & Fitness
- Secondary: Social Networking
- Age rating: Founder/legal review required after the final build and
  questionnaire are complete.

## Screenshot storyboard

Capture these from the final signed TestFlight build using seeded, fictional
data. Do not show real names, emails, invite codes, payment handles, or private
photos.

1. **Your Bloc, in motion** — Today screen with a monthly target and leaderboard.
2. **Log the work** — workout entry with an optional note/photo.
3. **See the team show up** — Activity with a reaction/comment example.
4. **Every month tells a story** — Month or History screen with a completed result.
5. **Private by design** — invite-only Bloc creation or joining.

## App Review notes — fill only after the review environment exists

```text
Fero is a private workout-accountability app for invited groups called Blocs.

Review account:
- Email: [Founder]
- Sign-in instructions: [Founder]

Seeded Bloc:
- Name: [Founder]
- Invite method: [Founder]

Recommended path:
1. Sign in with the review account.
2. Open the seeded Bloc.
3. Log a workout and view the updated leaderboard and activity.
4. View a profile, comments, reactions, report/block controls, and History.
5. Open Settings/Profile to find Privacy Policy, Terms, Support, sign-out,
   and Delete account.

Settlement behavior:
Fero records workout-accountability obligations and member-confirmed status.
It does not process payments, hold funds, transfer money, operate a prize pool,
or verify an off-platform payment.

External services:
Supabase provides authentication, database, and storage. Vercel hosts the API
and web delivery. [Founder/Codex: confirm final production services.]

Permissions:
Camera — to take workout and profile photos.
Photo Library — to choose workout and profile photos.
```

## Owner checklist

### Codex

- [x] Remove user-visible Premium labels and retain the future-feature map.
- [x] Add camera and photo-library purpose strings.
- [x] Correct the activity reader copies and preserve `wl.activity`.
- [x] Stabilise the History leaderboard test and rename its result to
  `historyScrollable`.
- [x] Apply the 24-hour signed-photo lifetime with the documented trade-off.
- [ ] Prepare the final signed archive after the Apple team is available.
- [ ] Verify the final binary, screenshots, API origin, permissions, and
  account deletion on a real iPhone.

### Devin

- [ ] Complete the RLS rollout and month-close checks before 1 October.
- [ ] Confirm the safe-copy moderation/hide/restore flow.
- [ ] Report any canonical-vs-blob parity or retention issue that changes the
  App Store disclosures.

### Founder

- [ ] Resolve Apple Developer enrollment/support case.
- [ ] Choose public support email and final domain.
- [ ] Review and approve the legal drafts before publication.
- [ ] Decide how shared historical content behaves after account deletion.
- [ ] Approve the tested promotion of App Store server code to `main`.
- [ ] Create App Store Connect record, reviewer account, and seeded review Bloc.
- [ ] Enter seller identity, tax/banking details, privacy answers, age rating,
  screenshots, and review notes.

## Submission gate

Do not submit until all three conditions are true:

1. The final signed build is installed through TestFlight on a real iPhone.
2. The production API and database contain the tested server/moderation/RLS
   behavior, with the founder-approved promotion recorded.
3. Public legal/support URLs and App Store Connect privacy answers match the
   submitted binary and actual data handling.

