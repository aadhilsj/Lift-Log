# Fero App Store Listing Draft — 2026-09-01

This is a factual draft for the first iOS release. It is not ready to enter in
App Store Connect until the public legal/support URLs and publisher identity
are final.

## App information

| Field | Draft |
| --- | --- |
| Name | Fero |
| Bundle ID | `com.aadhilsj.fero` |
| SKU | `fero-ios-001` (internal only; confirm before creating the record) |
| Primary category | Health & Fitness |
| Secondary category | Social Networking |
| Price | Free |
| Age rating | Complete Apple's questionnaire from the submitted build; do not assume a rating because Fero contains member photos, messages, comments, and user-generated content. |
| Support URL | Pending public Fero support page with real contact information |
| Marketing URL | Optional; pending final Fero domain |
| Privacy Policy URL | Pending public, reviewed Fero Privacy Policy |

## Customer-facing copy

### Subtitle (24/30 characters)

```text
Train together. Show up.
```

### Promotional text (optional, 88/170 characters)

```text
Build a private workout Bloc, set a shared monthly goal, and keep each other showing up.
```

### Description

```text
Fero is a private workout-accountability app for the friends who help you keep showing up.

Create a Bloc, invite your people, and choose a monthly workout target together. Log workouts as you go, follow the live leaderboard, and see how everyone is progressing.

With Fero you can:

• Create or join invite-only Blocs
• Set a shared monthly workout target
• Log workouts with optional notes and photos
• See live progress, activity, reactions, and comments
• Review month-end results with your Bloc
• Manage your profile, photos, and account from the app

Fero is built for private groups—not public follower counts. Your Bloc is where the accountability happens.

Fero does not process payments, hold funds, operate a prize pool, or verify off-platform settlements between members.
```

### Keywords (78 bytes; no competitor names)

```text
workout,fitness,accountability,habit,goals,training,exercise,group,leaderboard
```

## Screenshot story

Capture only real screens from the submitted build; do not use local OTP,
fixture identities, or mock data as App Store screenshots.

1. Private Bloc dashboard — target and live leaderboard.
2. Log a workout — optional note/photo flow.
3. Activity — progress, reactions, and comments.
4. Month-end result — explain the accountability outcome without implying that
   Fero moves money.
5. Invite-only Bloc — create or join with an invitation.

Keep screenshots truthful, localized if the listing is localized, and free of
placeholder legal/support details.

## App Review notes draft

Replace each bracketed item only after the review environment is live.

```text
Fero is a private workout-accountability app for invited groups called Blocs.

Review account:
- Email: [REVIEW ACCOUNT EMAIL]
- Sign-in method: [EMAIL OTP / OTHER]
- Instructions: [EXACT STEPS]

Seeded Bloc:
- Name: [REVIEW BLOC NAME]
- Invite method: [ACTIVE INVITE LINK OR CODE]

Recommended review path:
1. Sign in with the review account.
2. Open the seeded Bloc.
3. Log a workout and view the updated leaderboard/activity.
4. Open a comment or reaction.
5. View the completed-month/settlement screen if it is enabled in this build.
6. Open Profile to find sign-out and Delete account.

Settlement behavior:
Fero records workout-accountability outcomes and optional member-confirmed
settlement status. It does not process payments, hold funds, transfer money,
operate a prize pool, or verify an off-platform payment.

External services:
Supabase provides authentication, database, and storage. [ADD FINAL SERVICES]

Permissions:
[LIST ONLY PERMISSIONS PRESENT IN THE SUBMITTED BUILD AND THEIR PURPOSE]
```

## TestFlight description draft

```text
Fero is an invite-only workout-accountability app. Create or join a Bloc, log
workouts, and follow your group’s monthly progress. Please report sign-in,
photo-upload, invitation, activity, and account-deletion issues.
```

## Sources to use during entry

- Apple requires accurate description, keyword, and support details in App
  Store Connect; Support URL must provide real contact information.
- Apple requires valid review-account instructions when sign-in is needed.
- Legal/support URLs and the App Privacy answers must match the submitted
  build.
