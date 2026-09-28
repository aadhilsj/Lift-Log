# TestFlight build 3 — safe-area opt-in

App source: main `3dd78a4dccdcd14e7eb685a5c7932eef38c89475`.
Packaging branch: `codex/testflight-build-2`, with main merged at `98e32c5`.
Version/build: `1.0 (3)`, bundle ID `com.aadhilsj.fero`.

The sole main application change since build 2 is `viewport-fit=cover` in
`index.html`. Existing safe-area CSS was not changed. The existing native
wrapper/API routing was retained; both native build-number settings now use 3.
No stale App Store readiness application code was brought over.

Verification: lint and production web build passed; Capacitor sync passed;
signed Release archive succeeded at `/tmp/Fero-TestFlight-build-3.xcarchive`.
The archive's Info.plist has CFBundleVersion 3. Its public/index.html is
byte-identical to dist/index.html and includes `viewport-fit=cover`.
The full test suite was not rerun for this one-attribute packaging rebuild;
real-device visual verification remains outstanding.

On Aadhil's iPhone 14, check the FERO wordmark, chat/settings icons and Bloc
name clear the clock/status bar/notch; bottom navigation clears the home
indicator. Also check Bloc Stream, a sheet, comment thread and photo viewer.
Do not describe these visual checks as passed until observed on the phone.

No database, RLS, notification or support-email changes were made.

Xcode confirmed `App 1.0 (3) uploaded`; Organizer shows `Uploaded to Apple`,
build number 3, uploaded at 18:22 local time on 28 September 2026.
Chrome's App Store Connect session has expired and shows the Apple sign-in
page. Apple processing and availability in Fero Team are not yet verified.
The sign-in tab was left open for Aadhil; no duplicate upload is needed.
