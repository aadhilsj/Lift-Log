# TestFlight build 9 — 29 September 2026

## Source and scope

- Merged `origin/ios-header-and-nav-polish` at `b88db37d75387d87ce4557a51c711ac0665e3805` into `codex/testflight-build-2`, cleanly.
- Merge commit `7e63add`; native build-number commit `dfc5b4e`. Both pushed before archiving.
- Includes release-time tab lift using inline variables (160ms against screen 200ms), cleanup after destination commit, tab swipe/tap cross-fades with minimum opacity 0.28, and press-time Bloc-entry light haptic.
- `tapMedium` remains absent from `src/App.jsx`; original duplicate server-confirmation buzz did not return. Today owns workout press-time medium intent.
- Aadhil explicitly approved the **build-9-only** no-push signing override in chat. Committed entitlements and push foundation unchanged; temporary archive-signing override only.

## Verification

- `npm run lint`, `npm run build`, `npx cap sync ios`: passed. Existing large-bundle/static-dynamic-import warnings remain.
- All **25** current `test:*` scripts passed. Includes mobile navigation and reaction checks. Log: `/tmp/Fero-build-9-tests.log`.
- Sandbox used port 3120 and existing local-only Alex/DCGEMX fixture. Stopped only the process started for this run. Existing local realtime/photo-signing warnings remain; browser regressions passed.
- Device Release archive succeeded: `/tmp/Fero-TestFlight-build-9-no-push.xcarchive`. Log: `/tmp/Fero-build-9-no-push-archive.log`.
- Archive CFBundleVersion `9`; `codesign --verify --deep --strict` passed. No `aps-environment` in archived entitlements.
- Archived public index and assets match `dist` exactly.
- Single upload succeeded at **08:51:12 Oslo time, 29 September** (`EXPORT SUCCEEDED`); log `/tmp/Fero-build-9-upload.log`.
- App Store Connect visibly confirmed **Build 1.0 (9) Internal — Testing — Expires in 90 days** in **Fero Team**. Build ID `f3a90475-111e-4893-a313-9c31fc0b7e81`. No duplicate upload.
- Browser-verification skill used for final App Store Connect check through native Chrome accessibility.

## Not changed or verified

- No main merge, web deployment, production SQL/RLS, APNs setup or permission prompt/timing changes.
- No simulator installation; Claude's simulator and checkouts untouched.
- Cancelled Bloc release stall and in-Bloc tab-track shadow geometry remain open deliberately.
- Physical-iPhone animation feel/haptics still require Aadhil's install/review.
- Month-close/server code unchanged. Passing local regression scripts is **not** a production month-close data audit; 1 October readiness remains separate work.
- Notification bell inert and Bloc-name auto-shrinking preserved.
- Existing untracked `ios/App/App/config 2.xml` and `config 3.xml` preserved, not staged.

## Exact tracked file delta from build 8

1. `src/App.jsx`
2. `src/pages/Nav.jsx`
3. `src/styles/app.css`
4. `ios/App/App.xcodeproj/project.pbxproj`
5. `docs/handover-2026-09-29-testflight-build-9.md`

No other tracked files modified.
