# Codex session handover — TestFlight packaging and delivery

This complements Claude's design/source handover; it does not replace or repeat
it. Read AGENTS.md first, then this file. For design rationale, read
docs/handover-2026-09-28-ios-header-and-layout.md, the d78e708 commit message,
and the founder's latest instructions. Claude's older handover describes some
work as unbuilt; d78e708 and the founder's subsequent approval supersede that.

## Outcome and next action

TestFlight **1.0 (4)** is uploaded, processed and available to the existing
**Fero Team** internal group with status **Testing**. Codex verified this in
App Store Connect after the founder signed in and refreshed the group page.
The founder was told to open TestFlight → Fero → Update and confirm 1.0 (4).
He has NOT yet reported installation or real-iPhone layout results for build 4.

Start the next session by asking for that phone feedback and the next requested
change. Do not rebuild or upload the same build again. Do not invent further
layout changes. The user is moving sessions for context/token reasons, not
requesting another implementation yet.

## Exact source and packaging lineage

- App source: ios-header-and-nav-polish at
  d78e7081c8d762194d3590486c0093e37228926a, based on main 6f36627.
- Active Codex checkout: /Users/aadhilsj/Documents/FERO/fero-testflight-build-2.
- Branch: codex/testflight-build-2. Its name is historical; reuse it rather than
  renaming it or creating another checkout simply to match the build number.
- Clean merge of the reviewed app branch into this packaging lineage: 6c15b63.
- Build-number/doc commit: 1905731. Upload record: 7ceff52. Tester-availability
  record: d037ab1. This session handover is committed after those.
- App sources match d78e708 except existing native API routing in
  src/lib/api.js and src/lib/apiOrigin.js. These route native requests to
  https://lift-log-nu.vercel.app rather than the local packaged origin.
- iOS wrapper, capacitor.config.ts and Capacitor dependencies live on this
  separate packaging lineage, not main. Main last fetched was 6f36627.
- Version 1.0, build 4; bundle com.aadhilsj.fero; team SMR55A2M96; Release uses
  manual Apple Distribution signing and Fero App Store Distribution profile.
- node_modules is an untracked symlink to
  /Users/aadhilsj/Documents/FERO/fero-app-store/node_modules. Do not stage it or
  delete its shared target. It is the only untracked entry at handoff.

The founder explicitly authorized TestFlight ONLY. Nothing was merged/pushed
to main; no web deployment or database write occurred. A main merge would
deploy the web app and needs separate approval. The branch's server-side
24-character Bloc-name limit was NOT deployed by the native upload; the client
fields carry it. Do not claim the API cap is live.

## What Codex did and verified

Build 2 previously replaced the stale build 1 frontend with main a7675ea while
retaining native routing and wrapper. Build 3 incorporated main 3dd78a4's
viewport-fit=cover attribute. Build 4 incorporates Claude's reviewed header
and bottom-nav branch. Detailed evidence is in the three build handovers;
do not duplicate or re-land those app fixes.

For build 4, Codex ran successfully:

- npm run lint and npm run build.
- test:identity, test:two-workouts, test:founder-dashboard,
  test:profile-photo-storage.
- npx cap sync ios and signed generic-device Release archive.
- Archive Info.plist confirmed CFBundleVersion 4. Archived web assets matched
  dist, apart from generated Capacitor cordova bridge files.
- Xcode explicitly reported App 1.0 (4) uploaded; Organizer confirmed
  Uploaded to Apple at 19:55 local time on 28 September.
- App Store Connect Fero Team Builds showed 1.0 (4), Testing. It was added
  automatically to the existing internal group; no tester permissions changed.

auth-edge-flows and mobile-navigation were NOT rerun by Codex: Claude reported
identical seeded-sandbox timeout failures on clean main and the reviewed branch.
Other test scripts were not run in this packaging session. Real-phone layout,
swipe and reaction behaviour must not be described as verified by Codex.

## Preserve the founder's approved choices

Notification bell is deliberately visible but inert: no onClick, tabIndex -1,
aria-hidden. Do not wire it up or remove it. Notifications are separate work.
Bloc names auto-shrink from 19px to 12px; do not substitute ellipsis/truncation.
Do not redesign the header or bottom navigation without fresh user direction.

iPhone 17 simulator 547363ED-CC0B-41AF-8F9A-A475279B5FDF was confirmed booted.
Codex did not install over its app or stop the simulator. Leave it running.
The /Users/aadhilsj/Documents/FERO/fero-safe-area checkout belongs to that
simulator workflow and was left untouched. Do not replace its local work.

## Artifacts and access

- /tmp/Fero-TestFlight-build-4.xcarchive (build 4 archive).
- /tmp/Fero-build-4-archive.log (archive log).
- /tmp/Fero-TestFlight-build-3.xcarchive (previous safe-area build).
- docs/handover-2026-09-28-testflight-build-2.md
- docs/handover-2026-09-28-testflight-build-3.md
- docs/handover-2026-09-28-testflight-build-4.md

App Store Connect group URL:
https://appstoreconnect.apple.com/teams/58411b37-f391-4420-af75-594bc23a2166/apps/6816498779/testflight/groups/a1280346-a142-440a-b8ec-d67eae39e480/builds

Build 4 Apple ID: d477af1a-7f0b-46da-91d2-989991dc33cf.
Browser sign-in was completed by the founder; no credentials were recorded.
Re-discover browser/app bindings in a fresh session; old REPL handles do not
carry over. Xcode Organizer is open with build 4 selected.

All packaging/session commits remain local on codex/testflight-build-2 unless
someone subsequently pushes them. Uploading to Apple is not a Git push.
Read current git status/worktree inventory before continuing; another agent
shares the repository. Stage only explicit paths and never switch their branch.

No RLS, storage/privacy, SMTP/support spam or notification implementation was
undertaken here. Consult Claude's latest handovers for those areas rather than
treating this packaging session as an updated production audit.
