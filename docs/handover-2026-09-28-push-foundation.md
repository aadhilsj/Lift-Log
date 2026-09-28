# Push foundation — 28 September 2026

Work stays on `codex/testflight-build-2`, checkout
`/Users/aadhilsj/Documents/FERO/fero-testflight-build-2`.
Haptics remains local at `f90d731`. No main merge, push, web deployment,
build-number bump, simulator install or TestFlight upload in this task.

## Scope and current status

Added iOS push plumbing, a private device-token table and a manual test sender.
The notification centre, bell, badges, seen/unread state, deep links, and
notification event selection are untouched. No app events send notifications.

The database foundation was applied to production `bpvvvqjsfwmmfjvvijkd`
using `apply_migration`. Device registration and sending code remains local.
`PUSH_REGISTRATION_ENABLED` defaults off. No real device token has been stored
and no live notification has been sent.

**Permission invitation moment is not yet agreed.** Codex asked Aadhil whether
he wants an explicit Enable notifications tap after the first successful
workout, or an explicit tap in future notification settings. Do not assume
agreement or add UI before his reply. Claude owns the UI/taste decision.

## For Claude

`src/lib/pushNotifications.js` exposes:

- `getPushPermissionStatus()` — check only, no prompt.
- `syncPushRegistration()` — renew token only when already granted.
- `requestPushPermissionFromUserAction({ userInitiated:true })` — future explicit
  opt-in handler. Nothing in the current app calls it. Denied permission never
  prompts again; returning from iOS Settings allows the normal sync to renew.
- `revokePushRegistration()` — revoke the signed-in account's installation,
  then unregister natively even if the network request fails.

All are safe on web, in sandbox, on Android and without the native plugin.
App launch/sign-in/resume checks existing permission only. Sign-out attempts
server revocation before signing out. Permission changes in iOS Settings revoke
on next foreground check. Failures return status instead of throwing into UI.
Registration listeners are scoped to each attempt and removed afterwards.

Installation IDs are random UUIDs in local storage, stable across logins.
Tokens are not cached in local storage. Native registration runs again on later
launch/resume so token rotation updates the same user/device row.

**Environment:** TestFlight and App Store builds use production APNs by default.
For a physical-device Debug build use `VITE_APNS_ENVIRONMENT=sandbox npm run build`
before `npx cap sync ios`; Debug.entitlements uses development APNs. Never mix
Debug sandbox tokens and Release production APNs. No simulator was changed.
The generic Release build was checked without signing. The Apple App ID must
have Push Notifications enabled, and the distribution provisioning profile
must be regenerated before a signed push-enabled TestFlight archive can pass.

## Database and security

`ante_core.push_devices`: primary key `(auth_user_id,device_id)`, foreign key to
`auth.users` with delete cascade, active/revoked/expired/invalid states,
environment, registration version, timestamps and last APNs result.
Active installation and environment/token pairs are unique.
Each registration refreshes a 90-day application-side expiry; expiry is not a
claim about Apple's actual token lifetime. Expired rows are excluded and marked
expired when the sender requests active devices.

Account changes revoke previous owners of an installation/token transactionally.
Apple's 410 Unregistered response invalidates a token only if it still matches
the same registration version and was not registered after Apple's invalidation
timestamp. Provider errors, 429, transport errors and 5xx do not revoke devices.
BadDeviceToken stays visible as a delivery error: it can mean an environment
mismatch, so the sender does not assume it proves expiry.

Four public RPCs are service-role-only SECURITY INVOKER functions with empty
search paths. The table has explicit grants only to service_role. Anonymous and
authenticated roles have no table privileges or RPC execution privileges.
`api/push-devices.js` validates the bearer token with Supabase Auth, derives
ownership from the verified user, rejects local-dev identities and ignores
body-supplied user IDs. It supports native CORS and register/revoke only.
Sandbox disables registration; it cannot populate production tokens.

**RLS discrepancy:** The founder's prompt/handover said production RLS was off.
Direct checks at the start of this task found it already enabled on existing
tables including ante_core.profiles, ante_core.blocs and public.lift_log_state.
The existing-table RLS fingerprint before and after this task is identical:
`cc0569f0eaf65c2a0740f5444a37f9e6`. Do not disable or enable anything on this basis.
No RLS setting was changed. The new table has RLS off and is protected by object
privileges; even the roles' own tokens are not directly readable by clients.

Production operations:

1. Read-only schema/privilege/before-state checks.
2. `add_push_notification_foundation` migration.
3. The rollback-only lifecycle check caught PostgreSQL's maximum bounded regex
   repeat size (255). No device rows persisted. Applied a separately recorded
   `fix_push_device_token_validation` migration instead of rewriting history.
4. Read back function definitions and verified grants before calling them.
5. `scripts/test-push-foundation-db.sql` passed as service_role, anon and
   authenticated in a transaction ending in ROLLBACK. No auth users were created
   or modified. Zero device rows afterwards; existing profile and blob counts
   remain 48 and 1. New objects only; no destructive user-data operation.
6. Security advisor check: no finding on the push objects. Pre-existing RLS/no-
   policy and password-protection notices were not modified.

## APNs key setup — guide Aadhil one screen at a time

He has not created the key in this session. Start at
https://developer.apple.com/account/resources/authkeys/list, sign in, then Keys
in Certificates, Identifiers & Profiles. Wait for him before the next click.

Later screens: plus button, name `Fero Push`, Apple Push Notification service
checkbox, Configure. Prefer Topic Specific for `com.aadhilsj.fero` and Production
for TestFlight. Apple's current UI offers environment and scope choices; read
what he sees before telling him to confirm. A separate related Sandbox key may
be needed for development. Download the .p8 once and save it securely outside
the checkout. Never ask him to paste the key into chat.

When ready, have him privately set server environment variables in the Vercel
Fero project Settings → Environment Variables, one at a time:

- `APNS_PRIVATE_KEY`: entire .p8 contents, pasted directly into the private value
  field; no VITE prefix and never committed. Real multiline PEM or escaped \n
  both work. For local testing use an ignored .env.local multiline quoted value.
- `APNS_KEY_ID`: the 10-character Key ID shown on Apple's key details page.
- `APNS_TEAM_ID`: `SMR55A2M96`.
- `PUSH_REGISTRATION_ENABLED`: `true`, only when the endpoint is ready to deploy.
  APNs credentials are needed only by the sender, never the iPhone/web bundle.
- Existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` stay server-only.

No environment variables were written to Vercel or Apple in this task. After
key/profile setup, code deployment and a new native install with explicit opt-in,
the manual command is `npm run push:test -- <Supabase Auth user UUID>`.
Resolve the founder's UUID safely before giving him a command; no placeholders
in his chat instructions. The CLI rejects a missing target. It sends exactly
one fixed test alert to each of that user's active devices and prints only
device IDs and outcomes. APNs accepted means accepted, not confirmed delivered.

## Verification

Passed: `npm run lint`, `npm run build`, all 25 `test:*` scripts,
`npx cap sync ios`, and a generic iOS Release `xcodebuild` with signing disabled.
The browser sandbox loaded without page errors and the existing mobile navigation
and founder-dashboard browser tests passed. Without the native plugin, the web
helper returns unsupported; the sandbox registration endpoint returns 503 before
any database request. A bounded streamed-body test also verifies local API use.
Vite reported its existing large bundle warning and a harmless static/dynamic
import chunking notice for the push helper.

Foundation tests use generated signing credentials and fake APNs responses;
they do not contact Apple or production. They cover JWT ES256 signing/caching,
production/sandbox routing, API identity/authorization/CORS, transient failures,
permission/no-prompt rules, missing-plugin safety, renewal and revocation.
The SQL rollback checks exercise real database lifecycle and privileges.
Physical permission prompting, registration, signed provisioning and delivery
remain unverified pending Apple's key/profile setup and an approved invitation.

## Exact file list for this task

Paths below are relative to this checkout. No other files belong in the commit.

- `api/push-devices.js`
- `docs/handover-2026-09-28-push-foundation.md`
- `ios/App/App.xcodeproj/project.pbxproj`
- `ios/App/App/AppDelegate.swift`
- `ios/App/App/Debug.entitlements`
- `ios/App/App/Release.entitlements`
- `ios/App/CapApp-SPM/Package.swift`
- `package.json`
- `package-lock.json`
- `scripts/local-dev-server.mjs`
- `scripts/send-test-push.mjs`
- `scripts/test-push-foundation.mjs`
- `scripts/test-push-foundation-db.sql`
- `server/push.js`
- `src/App.jsx`
- `src/lib/api.js`
- `src/lib/pushNotifications.js`
- `supabase/migrations/20260928213116_add_push_notification_foundation.sql`
- `supabase/migrations/20260928214145_fix_push_device_token_validation.sql`

References:
- https://capacitorjs.com/docs/apis/push-notifications
- https://developer.apple.com/help/account/keys/create-a-private-key/
- https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns
- https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/CommunicatingwithAPNs.html

An unexpected untracked `ios/App/App/config 2.xml` appeared during the session.
Codex did not create/edit/stage it; preserve it as other work.
