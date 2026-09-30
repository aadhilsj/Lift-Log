# Push notifications — order of operations

Written 30 September 2026, for the session where Codex builds this out.
One page. Each step blocks the one below it.

**Goal: one real push notification arriving on Aadhil's iPhone through
TestFlight.** Not the notification centre, not triggers, not a feature. One
notification, end to end, so the pipe is proven.

---

## Already done (28 September, Codex + Claude)

Tracked in `docs/handover-2026-09-28-push-foundation.md` — which lives on
`codex/testflight-build-2` and `testflight-build-10`, **not on `main`**. Read it
before starting. Two corrections to it are at the bottom of this page.

| | Where |
| --- | --- |
| `ante_core.push_devices` table + 4 service-role RPCs | **applied to production** |
| Device registration helper | `src/lib/pushNotifications.js` (app branch) |
| Server endpoint | `api/push-devices.js` (app branch) |
| APNs sender + JWT signing | `server/push.js` (app branch) |
| Manual test sender | `scripts/send-test-push.mjs` (app branch) |
| Tests | `scripts/test-push-foundation.mjs`, `...-db.sql` (app branch) |
| Swift registration, entitlements | `ios/App/App/AppDelegate.swift`, `Debug`/`Release.entitlements` |

`PUSH_REGISTRATION_ENABLED` defaults **off**. No token has ever been stored;
`push_devices` is empty. Builds 9 and 10 carry this code but were archived with
push signing **disabled** and no `aps-environment`, so no phone in the field can
register. That is why the table is safely empty.

---

## The order

### 1. Apple: enable Push on the App ID
Developer portal → Identifiers → `com.aadhilsj.fero` → tick Push Notifications.
Nothing else works until this is on.

### 2. Apple: create the APNs key
Keys → plus → name `Fero Push` → Apple Push Notification service → Configure.
Prefer Topic Specific for `com.aadhilsj.fero`, Production for TestFlight.
**The .p8 downloads once and only once.** Save it outside the checkout. Never in
the repo, never pasted into a chat. Note the 10-character Key ID from the
details page. Team ID is `SMR55A2M96`.

### 3. Apple: regenerate the distribution provisioning profile
The existing profile predates push. A signed push-enabled archive will not build
against it. This is the step most likely to be forgotten and it fails loudly at
archive time.

### 4. Vercel: three server environment variables
Fero project → Settings → Environment Variables, Production scope. Aadhil sets
these himself, one at a time:
`APNS_PRIVATE_KEY` (whole .p8 contents) · `APNS_KEY_ID` · `APNS_TEAM_ID`.
No `VITE_` prefix on any of them — these must never reach the phone bundle.
**Leave `PUSH_REGISTRATION_ENABLED` off** until step 7.

### 5. Aadhil decides: the permission moment — BLOCKS STEP 6
iOS asks **once, ever.** Say no and it is buried in Settings. Two candidates
were put to him on 28 September and he has not answered:
an explicit "Enable notifications" tap after the first successful workout, or a
tap inside notification settings. **Nobody picks this but him.** Claude owns the
wording and the visual once he chooses.

### 6. Aadhil decides: what earns a push — BLOCKS STEP 10, not step 9
The first types. Reaction on your log, comment on your log, tagged in the
Stream, month deadline approaching, settlement outstanding. Each must be
individually switchable off by the member. This does not block the first test
push, which is a fixed message from the CLI.

### 7. Build the opt-in and turn registration on
Wire the chosen moment to `requestPushPermissionFromUserAction({userInitiated:true})`.
Nothing calls it today. Then deploy `api/push-devices.js` and set
`PUSH_REGISTRATION_ENABLED=true`.
**Hold this step until after the 1 October month close.** It deploys server code.

### 8. Cut a push-enabled TestFlight build
Build 11 or later, with push signing **on** and `aps-environment: production` in
Release entitlements. This is a new signing configuration, not a rebuild of 10.
Merge `main` into the app branch first, resolving shared UI to main's side —
that is the standing rule, and `main` is six-plus commits ahead.

### 9. Prove one notification
Install from TestFlight, accept the prompt, confirm one row appears in
`push_devices` with `status='active'`. Then:
`npm run push:test -- <Aadhil's Supabase Auth user UUID>`
Resolve that UUID before giving him any command. One fixed alert, to his devices
only. **APNs "accepted" means accepted, not delivered** — confirm on the phone.

### 10. Only then: triggers, outbox, and the notification centre
Nothing sends automatically until steps 1–9 are green. The in-app bell
(`docs/concept-2026-09-24-notification-centre.md`) is a separate piece of work
and today opens a "coming soon" modal.

---

## Traps, each already paid for once

- **Never mix environments.** Debug builds use sandbox APNs; TestFlight and App
  Store use production. A sandbox token sent to production APNs returns
  `BadDeviceToken`, which looks like an expired token and is not. For a physical
  Debug build: `VITE_APNS_ENVIRONMENT=sandbox npm run build` before `npx cap sync ios`.
- **`BadDeviceToken` never revokes a device.** Only Apple's `410 Unregistered`
  does, and only when the registration version still matches.
- **The four RPCs take the user ID as a parameter.** `api/push-devices.js`
  already derives it from the verified bearer token and ignores body-supplied
  IDs. Keep it that way; a client-supplied ID here would let anyone register a
  token against another account.
- **The sandbox cannot populate production tokens** by design. Registration
  returns 503 there.
- **Push is native-only, permanently.** Web push is not available to Fero. This
  is the clearest reason the App Store build is the product.

---

## Two corrections to the 28 September handover

1. **Its RLS claim is wrong.** It says the server-only lockdown is already
   applied to production and no database action is needed. Verified against
   production on 30 September: all eight tables in
   `20260926120000_enable_rls_on_server_only_tables.sql` have RLS **off** with
   zero policies, and the migration is not in the applied list. Only
   `settlement_confirmations` has RLS on, and it always did. **Deveen's 2–3
   October rollout is still required.** Do not stand it down.
2. **`push_devices` is missing from Deveen's migration**, because the table was
   created two days after he wrote it. Production has nine uncovered tables; his
   migration names eight. His own verification query will report a failure on the
   day. The table is empty and ungranted, so this is a gap in the fix, not a live
   hole — but `authenticated` does hold `USAGE` on the `ante_core` schema, so the
   only thing keeping it unreachable is the absence of a table grant.
