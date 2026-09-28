# TestFlight build 4 — reviewed header and bottom navigation

Requested app source: `ios-header-and-nav-polish` at
`d78e7081c8d762194d3590486c0093e37228926a`, based on main `6f36627`.
Merged into the existing isolated `codex/testflight-build-2` packaging lineage,
not into main. The older `fero-safe-area` simulator checkout was left untouched.
No web production deployment or database change was performed.

Version/build: `1.0 (4)`, bundle ID `com.aadhilsj.fero`.
App sources match d78e708 except the existing native API routing in
src/lib/api.js and src/lib/apiOrigin.js. Wrapper/signing configuration is
unchanged apart from both CURRENT_PROJECT_VERSION settings becoming 4.

Preserved deliberately: inert notification bell (no onClick, tabIndex -1,
aria-hidden); Bloc title fits from 19px down to 12px without ellipsis; client
24-character name cap. The API cap is present in the source branch but is NOT
deployed by uploading a native app. Main deployment needs separate approval.

Verification performed here: lint, build, identity, two-workouts,
founder-dashboard and profile-photo-storage all passed. Capacitor sync and
signed Release archive succeeded. Archived build number is 4; archived web
assets match dist (plus Capacitor's generated cordova bridge files).

auth-edge-flows and mobile-navigation were not rerun here: the handoff reports
identical seeded-sandbox UI timeout failures on unchanged main and this branch.
Other test scripts were not run in this packaging-only session. Do not describe
the whole test suite or real-phone swipe/reaction behaviour as verified.

iPhone 17 simulator 547363ED-CC0B-41AF-8F9A-A475279B5FDF was confirmed booted.
Its installed build and running session were not replaced or stopped.
The founder's simulator approval is reported in the handoff; iPhone 14 layout
validation is still required after installing build 4.

Archive: /tmp/Fero-TestFlight-build-4.xcarchive.
