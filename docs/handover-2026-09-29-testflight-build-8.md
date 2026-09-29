# TestFlight build 8 — 29 September 2026

## Source and scope

- Fetched and merged `origin/ios-header-and-nav-polish` at `d4edcc807792d94468289735594747d7d138f3d6`, including `1417d87` and `d4edcc8`.
- Clean merge commit: `a534831`. Native build-number commit: `f2d1431` (both Release/Debug settings now 8). Both pushed to `origin/codex/testflight-build-2` before archiving.
- Includes pill/screen release synchronisation, bottom scroll clearance, 200ms settles, capped switcher stagger, Bloc/month/delete haptics and active-tab icon motion.
- Original duplicate server-confirmation haptic remains absent: App has light intents, Today owns the press-time medium intent and delete warning.
- Aadhil explicitly approved the build-8-only non-push signing override. Committed push entitlements and push foundation remain intact; archive signing alone uses `/tmp/Fero-Build8-NoPush.entitlements`.

## Verification

- `npm run lint`: passed.
- `npm run build`: passed; existing large-chunk and mixed static/dynamic push-module warnings remain.
- `npx cap sync ios`: passed, haptics and push plugins present.
- All **25** current `test:*` scripts passed, including mobile navigation. Results: `/tmp/Fero-build-8-tests.log`.
- Sandbox ran on port 3120 using local-only existing fixture data. Stopped only the sandbox process started for this run. Existing sandbox realtime/photo-signing warnings remain; browser regression scripts passed.
- Release device archive succeeded: `/tmp/Fero-TestFlight-build-8-no-push.xcarchive`.
- `codesign --verify --deep --strict`: passed; archived entitlements contain no `aps-environment`, and CFBundleVersion is `8`.
- Archived public index and asset directory match `dist` byte-for-byte.
- Archive log: `/tmp/Fero-build-8-no-push-archive.log`. Upload log: `/tmp/Fero-build-8-upload.log`.
- Single upload succeeded at 07:41:34 Oslo time on 29 September; `EXPORT SUCCEEDED`.
- App Store Connect Fero Team group visibly confirmed **Build 1.0 (8) Internal — Testing — Expires in 90 days** after processing. Build ID: `55b129fa-3ecc-4536-a181-e4a3663283fe`. No duplicate upload.
- Browser-verification skill guided the final status check; Chrome extension was unavailable, so native Chrome accessibility verification was used. Fresh group view resolved Apple's blank reload shell.

## Deliberately not changed or verified

- No merge to main, web deployment, production SQL/RLS, permission prompt/timing or APNs key setup.
- No simulator installation; running iPhone 17 simulator and Claude's checkouts untouched.
- Cancelled Bloc release stall and in-Bloc tab-track shadow geometry remain open by choice.
- Physical-iPhone feel and haptics require Aadhil to install build 8; not claimed verified on hardware.
- Notification bell remains inert; Bloc-name auto-shrinking retained.
- Existing untracked `ios/App/App/config 2.xml` and `config 3.xml` preserved and not staged.

## Exact tracked file delta from build 7

1. `src/App.jsx`
2. `src/components/authShell.jsx`
3. `src/pages/MonthPage.jsx`
4. `src/pages/Nav.jsx`
5. `src/pages/TodayPage.jsx`
6. `src/styles/app.css`
7. `docs/handover-2026-09-29-swipe-settle-and-haptics.md` (imported Claude handover)
8. `ios/App/App.xcodeproj/project.pbxproj`
9. `docs/handover-2026-09-29-testflight-build-8.md`

No other tracked files modified.
