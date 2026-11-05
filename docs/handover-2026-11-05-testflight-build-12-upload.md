# 5 November 2026 — TestFlight build 12 upload

## Status at session start

The requested build has not yet been archived or uploaded. This session will
cut and upload build 12 from the dedicated iOS branch, without merging `main`
or hand-editing anything under `ios/`.

| | State |
| --- | --- |
| Branch | `claude/testflight-build-12-2026-10-21` |
| Branch head | `bdee799a45f3b351d2e1ccef8856e4ac15eb6b36` |
| `origin/main` at session start | `40b36aa201fee477fac069b8f6d86022a0fea84c` |
| Build number / version | 12 / 1.0 |
| Bundle ID | `com.aadhilsj.fero` |
| Xcode | 27.0 |
| TestFlight upload | Uploaded; App Store Connect shows build 12 as Ready to Submit |
| Working tree before this handover | Clean |

`git fetch` was run first. This clone's default fetch refspec tracks only the
build branch, so `main` was explicitly fetched as well. Current `main` must not
be merged into this branch. Its new changes are not needed to produce the
native build; the build branch is the only copy of the iOS project.

The updated `docs/build-12-xcode-handoff.md` was read from `origin/main` at
`40b36aa`. It confirms that `npx cap sync ios` may write generated files under
`ios/`. Those generated files are ignored. The tracked file
`ios/App/CapApp-SPM/Package.swift` must remain identical; if it changes, stop
and show its diff without committing it.

## Work completed

- `npm ci`, `npm run lint`, and `npm run build` all succeeded. Build warnings
  were limited to the existing Vite chunk/dynamic-import warnings; npm reported
  18 dependency audit findings.
- `VITE_FERO_API_ORIGIN` was unset, and no `.env.local` was present.
- `npx cap sync ios` succeeded and copied the web build. The tracked
  `ios/App/CapApp-SPM/Package.swift` remained byte-identical; `git diff` for
  that file is empty. The only working-tree changes are this handover and its
  index entry in `docs/HANDOVERS.md`.
- `xcodebuild -list -project ios/App/App.xcodeproj` resolved packages and found
  the `App` scheme. The handoff's `ios/App/App.xcworkspace` path does not exist
  in this branch, so the valid `App.xcodeproj` was opened and used.
- Release build settings report version 1.0, build 12, bundle ID
  `com.aadhilsj.fero`, and team `SMR55A2M96`.
- A Debug simulator build succeeded and launched on the iPhone 17 simulator.
  Its initial Fero onboarding screen was visible. Device Hub displayed the
  simulator, but rejected UI taps, so the four required in-app checks could
  not be completed here.
- A manual Release archive failed because the installed `Fero App Store
  Distribution` provisioning profile does not include Push Notifications or
  the `aps-environment` entitlement already declared by the app.
- An automatic-signing attempt without command-line overrides failed because
  the project explicitly specifies the manual profile. A retry overriding
  profile and identity produced an unsigned archive; Xcode explicitly warned
  it cannot add entitlements without signing. That archive is not suitable
  for TestFlight.
- Apple Developer is signed in as Aadhil Shah Jahan on team `SMR55A2M96`.
  Before the approved change, profile `Fero App Store Distribution` (ID
  `3GFJUL2U9V`, expires 2027-09-28) for `Fero (com.aadhilsj.fero)` listed only
  In-App Purchase. Push Notifications was off, matching Xcode's signing error.
- After the founder approved the capability change, Push Notifications was
  enabled on the existing App ID. Apple invalidated the old profile; the
  `Fero App Store Distribution` profile was regenerated with In-App Purchase
  and Push Notifications enabled.
- Xcode refreshed the profile during archive signing and used profile UUID
  `5d8ff2ff-7825-4532-8135-103afd59cba5` plus the existing Apple Distribution
  certificate. The resulting archive is version 1.0, build 12, and contains
  `aps-environment=production`.
- Xcode Organizer uploaded the archive to Apple at 19:13. App Store Connect's
  TestFlight page now lists build 12 with status **Ready to Submit**, uploaded
  5 Nov 2026 at 19:14, and attached to the existing **Fero Team** internal
  group (2 testers). The build's Test Information page shows one group and no
  individual testers.

## Close-out

- Session handover was created before build or sync work.
- Build 12 was uploaded successfully and is listed in TestFlight as **Ready to
  Submit**, attached to the existing internal Fero Team group. No production
  App Store release was made.
- The four required in-app checks remain unverified because the simulator's
  device window rejected taps. It launched to the onboarding screen.
- Push is only a technical foundation. There are no designed notification
  events, no current app call that requests permission, and the opt-in prompt
  timing remains undecided. Enabling the Apple App ID capability and signing
  entitlement does not send notifications or show a permission prompt.
- No application source or `ios/` files were committed. The working tree is
  clean; only this session handover and its index entry were changed.

| Commit | Change |
| --- | --- |
| `bb7a433` | Created the session handover before build work; recorded the initial signing blocker. |
| `06d5c13` | Recorded the Apple Developer profile state. |
| `0c4eb4c` | Recorded Push Notifications capability approval and profile regeneration. |
| `4db98d3` | Recorded the signed archive and upload while App Store Connect processed it. |
- Do not alter the project, entitlements, or any file under `ios/`; do not
  remove Push Notifications to work around the profile mismatch. Do not merge
  `main` or push anything to `main`.
