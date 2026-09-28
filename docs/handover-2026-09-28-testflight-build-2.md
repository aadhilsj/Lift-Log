# TestFlight build 2 replacement

App source base: `a7675ea0b99cd416ea2553e1dd4ea3fc42a9187a` (main).
Candidate branch: `codex/testflight-build-2`.
Version/build: `1.0 (2)`; bundle ID: `com.aadhilsj.fero`.

Build 1 could not reach the production API because Capacitor's origin was
blocked by CORS. The earlier email-delivery diagnosis was unverified and wrong.
Main already includes the CORS fix (`0bab15f`) and the development-environment
protocol guard (`a7675ea`). Build 1 also carried older frontend code.

This candidate starts directly from main and adds only the existing iOS wrapper,
Capacitor dependencies/config, native API routing, distribution signing and
build number 2. It does not merge the App Store readiness branch's application
changes. Native API calls target `https://lift-log-nu.vercel.app`.

Verification completed before upload:

- Lint and Vite production build passed.
- OTP error handling, display-name identity, profile-photo storage and Bloc
  streak tests passed.
- Capacitor sync copied the new bundle into the native project.
- Signed release archive succeeded at
  `/tmp/Fero-TestFlight-build-2-final.xcarchive`.
- The archived bundle is byte-identical to the newly built bundle.
- Executed the actual minified archive guard: `capacitor://localhost` returns
  false; `http://localhost` returns true. The developer identity control remains
  guarded by that result.
- Today uses `Bloc Loop`; onboarding uses `Show up together.` / `Or settle up.`.
  `PERFECT BLOC MONTH` still exists as the intentional award label, not the old
  Today heading.
- Live production preflight returned 204 and allowed `capacitor://localhost`
  with Authorization and Content-Type headers.

Real-iPhone verification remains required after Apple processes build 2:
OTP sign-in, Activity photos, Bloc Stream photos, cropped workout-photo preview,
and absence of development controls throughout the app. Desktop/archive checks
are not evidence those real-device flows passed.

Production state reported by Claude: photo buckets private with 24-hour signed
URLs; deletion shipped and proved on staging; RLS off in production and on in
staging. No database changes were made as part of this rebuild.

Build 1 should no longer be used for testing. Build 2 upload/processing state
will be recorded below after verification.
