# TestFlight build 6 — swipe release render deferred

## Source and scope

Fetched the rebased `origin/ios-header-and-nav-polish` at
`8fecd10c15708937c894505c9fdcd87aeefd1d06`, then merged into
`codex/testflight-build-2` at `907bf1b`. Resolved four small rebase-induced
conflicts: retained packaging dependencies in package.json/package-lock.json;
accepted Claude's completed-swipe release and Nav transition lines. Package
files are unchanged from build 5. App code delta is exactly Claude's App.jsx
and Nav.jsx fix. Push sync, haptics helper and single-save example remain intact.
Native build number incremented to 6 at `5cba539`. Both commits pushed.

No cancelled-swipe optimization or handleMultiLog haptic added. No main merge,
web deployment, database/RLS change, permission invitation or APNs key setup.
Bell stays inert and Bloc names keep auto-shrinking. Running simulator and
Claude's checkout were not modified. Existing untracked config 2.xml and
config 3.xml preserved.

## Verification

Fresh lint, web build, Capacitor sync and all 25 test:* scripts passed on the
combined packaging branch. Browser auth and mobile-navigation regressions
passed against the local sandbox on port 3120. Sandbox stopped afterwards.
The previously recorded sandbox photo-signing warning (`data.map is not a
function`) recurred; tests still passed. No additional simulator installation
or physical-iPhone feel measurement performed. Claude's pre-merge simulator
gesture verification is supplied in his commit; real-thumb feel remains next.

Signed archive succeeded:
`/tmp/Fero-TestFlight-build-6-no-push.xcarchive`.
Codesign verification passed; CFBundleVersion is 6; signed entitlements have
no aps-environment. Archived index.html and assets match dist byte-for-byte.
Archive log: `/tmp/Fero-build-6-no-push-archive.log`.

Aadhil explicitly approved repeating the non-push signing override for build 6.
Used `/tmp/Fero-Build6-NoPush.entitlements` (empty plist) as a command-line
override only; committed Debug/Release entitlement files unchanged.

## Distribution — uploaded and confirmed Testing in Fero Team

Xcode CLI export/upload uses existing manual distribution profile, internal
TestFlight only, no build-number auto-management and no provisioning updates.
Options: `/tmp/Fero-Build6-ExportOptions.plist`.
Upload log: `/tmp/Fero-build-6-upload.log`.
Do not upload again if this attempt succeeds. App Store Connect browser session
expired; Aadhil was asked to sign back in to verify processing/group availability.
Apple confirmed `Upload succeeded`, `Uploaded App` and `EXPORT SUCCEEDED` at
05:15:46 Europe/Oslo on 29 September. The uploaded package is processing.
This is one successful upload; do not repeat it. After Aadhil restored his
App Store Connect session, the Fero Team Builds page confirmed `1.0 (6)`,
Internal, `Testing`, expires in 90 days. Build ID:
`1b2e3073-7505-454d-a462-c13e37db43f6`. No tester permissions were changed.
Physical-iPhone launch and swipe feel are not yet verified; install build 6
through TestFlight to assess the completed-swipe settle under a real thumb.

## Exact tracked file delta from build 5

- src/App.jsx (Claude's swipe fix)
- src/pages/Nav.jsx (Claude's swipe fix)
- docs/handover-2026-09-29-ios-polish-and-swipe.md (Claude's imported handover)
- ios/App/App.xcodeproj/project.pbxproj (build number only)
- docs/handover-2026-09-29-testflight-build-6.md (this record)

Nothing else was modified in tracked source.
