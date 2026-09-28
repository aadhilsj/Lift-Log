# TestFlight build 5 — approved non-push signing

## Follow-up after Aadhil's signing approval

Aadhil approved build 5 without push in its signature, preserving the foundation
in source. Pulled and cleanly merged Claude's corrected Dashboard contract test
at `e199ddd`. No additional application changes were made.

Lint, web build, Capacitor sync and all 25 test scripts passed, including both
browser regressions. Added a regression to test-push-foundation that simulates
the native registrationError for missing aps-environment: returns
`{ok:false,status:"registration-failed"}`, stores no token, removes listeners,
and never throws. Normal launch with undecided permission does not register or
prompt. These are source/mock checks, not a physical-iPhone launch observation.

Signed archive succeeded at `/tmp/Fero-TestFlight-build-5-no-push.xcarchive`.
Build number 5 verified; signed entitlements have no aps-environment; codesign
verification passed. Archived index.html/assets match dist byte-for-byte.
Used the one-build command-line override
`CODE_SIGN_ENTITLEMENTS=/tmp/Fero-Build5-NoPush.entitlements` with an empty plist.
Committed Debug/Release entitlements, capability and push client are untouched.
Archive log: `/tmp/Fero-build-5-no-push-archive.log`.

Xcode distribution uses TestFlight Internal Only. Upload/Apple processing status
is recorded below once confirmed. Do not repeat an upload that already succeeded.
The earlier blocker/verification record below is historical and superseded by
this approved successful archive and regression pass.

The additional untracked `ios/App/App/config 3.xml` appeared before this follow-up;
it and config 2.xml were preserved and excluded from commits.

## Earlier blocked attempt (historical)

Checkout: `/Users/aadhilsj/Documents/FERO/fero-testflight-build-2`.
Branch: `codex/testflight-build-2`.

Merged reviewed source `ios-header-and-nav-polish` at
`61f08015d236f78d966aff61b760b52cd4f28c33` cleanly at `44e5799`.
This adds the seven reviewed commits after build 4's d78e708.
Both native CURRENT_PROJECT_VERSION settings now specify 5; marketing version
remains 1.0. Build 4 is still the available TestFlight build. No build 5 upload
was attempted, and no signed build 5 archive was produced.

## Merge review

`src/App.jsx` retains push sync and the single successful-workout haptic call.
It also contains Claude's Dashboard relocation and Today-to-switcher gesture:
260ms settle, cubic-bezier(.32,.72,0,1), 0.32-width commit threshold, classifier
waiting for a clear horizontal/vertical signal rather than locking on 4px drift.
The main-tab gesture was not retuned. Bell remains inert; name shrinking remains.
Imported application files: App.jsx, authShell.jsx, ActivityFeed.jsx, Nav.jsx,
ProfilePage.jsx. Codex made no additional application/layout edits.
Revert tag supplied by Claude: `pre-swipe-work-2026-09-29`; not used or moved.

## Verification

Lint, web build and Capacitor sync passed. Of 23 non-browser test scripts,
22 passed, including push-foundation. `test:founder-dashboard` failed its stale
source assertion expecting the entry in the Bloc switcher; the reviewed source
intentionally moves it to Account. No test assertion was weakened or rewritten.
`test:auth-edge-flows` and `test:mobile-navigation` were not run in this packaging
attempt. No browser gesture/reaction check was performed before the signing
blocker ended this attempt. Real-thumb timing remains unverified.

## Signing blocker

Signed Release archive was attempted without provisioning updates:
`/tmp/Fero-TestFlight-build-5.xcarchive` (not a successful archive).
Log: `/tmp/Fero-build-5-archive.log`.
Derived data: `/tmp/Fero-Build-5-validation`.

Xcode errors:
- Provisioning profile "Fero App Store Distribution" doesn't include the Push
  Notifications capability.
- The same profile doesn't include the aps-environment entitlement.

Both installed distribution profiles lack aps-environment. The push foundation
added that entitlement after build 4. Do not silently remove the committed push
configuration, enable Apple capabilities, regenerate profiles, or set up APNs.
Ask Aadhil whether build 5 may use a non-push signing override just for this
swipe/haptics test, preserving the foundation in source. Otherwise wait for an
approved push-capable provisioning setup. An APNs sending key is distinct from
the provisioning entitlement, but neither Apple account workflow was changed.

## Main dependency request

Already prepared in `/Users/aadhilsj/Documents/FERO/fero-web-haptics-deps`, local
branch `codex/web-haptics-deps`: 2ddc545 adds core 8.5.0 and haptics 8.0.2;
d773292 corrects RLS docs. Main remains unchanged because merging to main and
web deployment are explicitly not approved. Do not claim dependencies landed.

## Scope preserved

No database writes, RLS changes, web deployment, permission invitation, APNs key
setup, Apple capability/profile mutation, simulator installation, or TestFlight
upload. Running iPhone 17 and its checkout untouched. Unrelated untracked
`ios/App/App/config 2.xml` preserved. New Codex edits in this attempt are only
the native build-number file and this handover, in addition to the reviewed merge.
