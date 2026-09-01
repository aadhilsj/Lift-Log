# Fero TestFlight and Push Notification Plan

Last updated: 2026-09-01, Europe/Oslo.

## What TestFlight is

TestFlight is Apple's beta-distribution channel. We upload a signed build to
App Store Connect, assign it to a tester group, and testers install Apple's
TestFlight app before installing Fero.

Apple currently allows up to 100 internal testers and up to 10,000 external
testers per app. A build can be tested for up to 90 days. The first external
build may need TestFlight beta review before it can be distributed.

## Can existing Fero users move to TestFlight?

Yes, but it is an opt-in migration, not a forced switch.

- Users receive an email or invitation link, install TestFlight, accept the
  Fero beta, and install the beta build.
- Their existing Fero data remains available if the native app uses the same
  production backend and they sign in with the same account.
- Users who currently use Fero in a browser or as a PWA do not automatically
  become TestFlight users; we must invite them and they must install it.
- TestFlight and the public App Store are distribution channels for the same
  app identity. We should keep the same bundle identifier and production
  backend. A TestFlight build may replace the App Store build on a device;
  users should not be told to create a second account.
- We should migrate a small internal group first, then invite the wider Bloc
  community after sign-in, uploads, invites, and deletion are verified.

## Push notifications

Push notifications are not implemented in the current native build. We can
design and test them during TestFlight, but TestFlight itself does not create
the feature.

The implementation sequence will be:

1. Decide the first notification types (for example, workout reminder,
   reaction/comment, or Bloc deadline) and make each one user-controlled.
2. Add the iOS Push Notifications capability and request permission in context
   from the app.
3. Register device tokens and associate them with the signed-in Fero account;
   handle token rotation and account deletion.
4. Add a server-side notification job/outbox and an APNs provider using a
   securely stored Apple key. Never put the key in the app or repository.
5. Test foreground, background, denied-permission, signed-out, reinstall, and
   multiple-device behavior in TestFlight.

TestFlight distribution uses the production APNs entitlement, while local
development builds use the development/sandbox entitlement. The bundle ID and
provisioning configuration must match the push-enabled App ID.

## Current status

- Native TestFlight shell: ready for signing once the Apple Developer account
  and publisher identity are available.
- Push capability: not yet added; deliberately deferred until notification
  behavior and the Apple account are ready.
- User migration: safe to plan, but do not invite users until a TestFlight
  build has passed the authenticated native smoke test.

## Sources

- [Apple TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview)
- [Apple TestFlight](https://developer.apple.com/testflight/)
- [Apple APS Environment Entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/aps-environment)
- [Apple Push Notifications Console](https://developer.apple.com/notifications/push-notifications-console/)
