# TestFlight build 7 — press haptics and shared settle

## Source and scope

Fetched `origin/ios-header-and-nav-polish` at
`3b525da1050fe31c052e5bc0516ae30529a4be2d`, merged cleanly into
`codex/testflight-build-2` at `b4cb4d6`. Native build number 7 at `68a0946`.
Both commits pushed. Changes include press-time workout haptic, light tab-change
haptics, switcher shadow clearance and the shared 260ms screen settle.

As explicitly requested, removed the original tapMedium import and server-success
call from App.jsx during the merge. App.jsx now uses only tapLight; TodayPage.jsx
has the sole tapMedium workout call before either save branch. This prevents
single-Bloc logs buzzing again on the server reply. haptics.js is unchanged.
Press-time feedback confirms the action, not its eventual API success.

Push foundation and committed native entitlements remain intact. Aadhil explicitly
approved a build-7-only non-push signing override. No APNs/provisioning changes,
permission prompt, main merge, web deployment, database/RLS changes or simulator
installation. Cancelled Bloc back-swipe optimization remains deliberately open.
Bell stays inert, Bloc name auto-shrinking remains. Existing config 2.xml and
config 3.xml preserved and excluded from commits.

## Verification and distribution — in progress

Fresh lint, web build and Capacitor sync passed. A focused source/VM check in
`/tmp/Fero-build-7-haptics-check.mjs` passed: one press-time call for a single
Bloc and six Blocs, before saving; all five helper intents safely no-op on web,
absent plugin and catch rejected native calls. Physical haptic feel is not tested.

Full regression suite log: `/tmp/Fero-build-7-tests.log`.
Initial run passed 24 of 25 scripts; mobile-navigation checked the destination
after an obsolete fixed 180ms wait while the new animation lasts 260ms. Updated
only that test's wait to read SCREEN_SETTLE_MS from App.jsx and add 60ms of
handoff allowance. Assertions are unchanged; no application timing changed.
Rerun log: `/tmp/Fero-build-7-mobile-navigation-rerun.log`.
Rerun passed all navigation assertions. All 25 test:* scripts now pass. Lint
rerun passed after the test edit. The sandbox has been stopped; its previously
recorded scoped-photo signing warning recurred without failing browser tests.
Signed archive succeeded; codesign verification passed, CFBundleVersion is 7,
signature has no aps-environment, and archived index.html/assets match dist
byte-for-byte. Committed entitlement files are unchanged.
Archive: `/tmp/Fero-TestFlight-build-7-no-push.xcarchive`.
Archive log: `/tmp/Fero-build-7-no-push-archive.log`.
Signing override: `/tmp/Fero-Build7-NoPush.entitlements` (empty plist).
Upload options: `/tmp/Fero-Build7-ExportOptions.plist` (internal-only, existing
manual profile, no automatic build-number management or provisioning updates).
Upload log: `/tmp/Fero-build-7-upload.log`.
Do not repeat a successful upload. Final outcomes will be recorded below.

## Exact tracked file list relative to build 6

- src/App.jsx
- src/pages/TodayPage.jsx
- ios/App/App.xcodeproj/project.pbxproj
- scripts/test-mobile-navigation.mjs (wait follows shared settle duration)
- docs/handover-2026-09-29-testflight-build-7.md

Nothing else in tracked source was modified.
