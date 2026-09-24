# Fero TestFlight and real-iPhone checklist

Last updated: 2026-09-24 (Europe/Oslo).

Run this against the final signed build installed through TestFlight. Local
browser, simulator, or unsigned archive results do not replace the real-iPhone
checks. Use only fictional seeded review data.

## Before installing

- [ ] Apple Developer enrollment is active and the correct team is selected in Xcode.
- [ ] App Store server code has been founder-approved and promoted to `main`.
- [ ] Final API origin is HTTPS production, not localhost or Vercel Preview.
- [ ] The review account, seeded Bloc, email route, storage, and moderation
      owner are ready.
- [ ] Privacy Policy, Terms, Support, and Community Rules URLs are public and
      approved.

## Install and launch

- [ ] Install from TestFlight on a real iPhone.
- [ ] Launch from a cold state.
- [ ] Confirm the app name, icon, version, and first-run screen are correct.
- [ ] Confirm no Premium label, development menu, local OTP shortcut, or preview
      fixture is visible.

## Authentication and Bloc flows

- [ ] Sign in with the dedicated test account.
- [ ] Close and reopen the app; confirm the session restores safely.
- [ ] Join the seeded invite-only Bloc.
- [ ] Confirm the Bloc name, membership, target, and leaderboard load.
- [ ] Sign out and sign back in.

## Workout and photo flows

- [ ] Log a workout without a photo.
- [ ] Choose a workout photo from the photo library.
- [ ] Take a workout photo with the camera.
- [ ] Replace or remove a profile photo.
- [ ] Confirm denied camera/photo permissions produce a recoverable explanation.
- [ ] Leave the app open beyond 15 minutes, return to a photo, and confirm it
      still loads; if a signed URL has expired, confirm the app re-signs it.

## Navigation and scrolling

- [ ] Drag vertically over the History All-Time Leaderboard and confirm the
      page scrolls vertically.
- [ ] Drag horizontally inside the leaderboard and confirm the table scrolls
      horizontally without changing the mobile page.
- [ ] Confirm the History result label is `historyScrollable`, not a claim that
      a finger drag was already tested.
- [ ] Navigate Today, Activity, Profile, Settings, and Month/History repeatedly.

## User-generated content and safety

- [ ] Add a comment and reaction.
- [ ] Report a test post/comment.
- [ ] Block a test member and confirm the expected visibility change.
- [ ] As the authorized moderator, hide the test content and restore it.
- [ ] Confirm unauthorized members cannot access the moderation action.
- [ ] Confirm support/report paths use the public support route.

## Account deletion

- [ ] Open the in-app Delete account action.
- [ ] Confirm the warning and cancellation path.
- [ ] Complete deletion in the isolated/test environment only.
- [ ] Confirm owned profile/workout uploads are handled as documented.
- [ ] Confirm sign-in cannot silently recreate or restore the deleted account.
- [ ] Confirm shared historical content matches the founder-approved retention rule.

## Evidence to record

- [ ] iPhone model and iOS version.
- [ ] TestFlight version/build and install date.
- [ ] Git commit used for the archive.
- [ ] API origin and environment label.
- [ ] Pass/fail result for each section.
- [ ] Screenshots or screen recording without personal data.
- [ ] Any crash, blank screen, expired-photo, auth, moderation, or deletion issue.

