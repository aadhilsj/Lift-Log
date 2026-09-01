# Fero Legal Launch Pack — 2026-09-01

This is a product-specific drafting brief, not legal advice. It records the
current implementation so that public policy, terms, App Store privacy answers,
and the app's actual behavior can agree. Do not publish it as a user-facing
policy.

## Required publisher details before publication

- Legal publisher name (individual name until an organization is registered,
  or the final organization name once it is registered).
- Support email address that is monitored during App Review and after launch.
- Legal/contact address or the jurisdictional contact details required for the
  publisher's chosen operating location.
- Effective date and governing-law choice, reviewed by qualified local counsel.
- The final public Fero domain. Do not put placeholder links in App Store
  Connect.

## Observed data inventory

| Data | Why Fero uses it | Who can receive/see it |
| --- | --- | --- |
| Email address and Supabase auth identifier | Passwordless sign-in, account identity, account recovery | Fero backend and Supabase authentication services |
| Display name and profile photo | Identify members in private Blocs | Other members of the same private Bloc |
| Bloc membership, invite codes, targets, penalties, settings | Operate invited workout-accountability groups | Members/admins of the relevant Bloc |
| Workout date, type, note, and optional workout photo | Record progress and leaderboard activity | Members of the relevant Bloc |
| Comments, reactions, Bloc Stream messages, and reports | Social/accountability features and safety handling | Members of the relevant Bloc; Fero for moderation/support when needed |
| Settlement status and voluntary payment handles (Revolut, PayPal, Vipps) | Let members record a member-to-member obligation and optionally open an external payment destination | Members of the relevant Bloc; Fero does not process, hold, route, or verify money |
| Feature usage event and timestamp tied to an authenticated user | Aggregate product usage and founder dashboard metrics | Fero backend; not exposed as raw per-user activity to ordinary members |

The product uses Supabase for authentication, database, and object storage and
is deployed through Vercel. The public policy must name the final processors
and links only after their production configuration is confirmed.

## Public Privacy Policy: factual topics it must cover

1. Who operates Fero and how to contact them.
2. The data above, how it is collected, and why it is used.
3. Private-Bloc sharing: workout information and user-generated content are
   visible to relevant Bloc members, not the public internet by default.
4. Processor/service-provider categories, including Supabase and Vercel.
5. External payment destinations: Fero stores a handle/link when a member adds
   one, but does not process payments or operate a prize pool.
6. Retention and deletion: state only behavior that has been verified in the
   submitted environment.
7. User rights, privacy choices, and a contact route for requests.
8. Changes to the policy and its effective date.

## Public Terms: factual starting points

- Fero is a private workout-accountability service for invited Blocs.
- Users are responsible for their own workout entries, photos, messages,
  comments, and conduct.
- Penalties and settlement records are an accountability feature. Fero does
  not take custody of funds, transfer money, sell wagering credit, operate a
  prize pool, or verify an off-platform payment.
- Users must not use the service for unlawful conduct, harassment, fraud, or
  rights-infringing content.
- The publisher needs a defined moderation/support process before relying on
  user-generated-content features in App Review.
- Final terms must be reviewed for the publisher's jurisdiction, age position,
  consumer rights, and governing-law choices.

## App Store privacy working answers (not yet final)

- Data is collected; do **not** select "No, we do not collect data."
- Likely categories include Contact Info (email), User Content (photos,
  comments/messages), Identifiers (user ID), Usage Data, and Financial Info
  only if payment handles are disclosed under Apple's definitions. Verify the
  final App Store questionnaire against the production build and legal review.
- Fero's empty native privacy manifest means no native SDK declares tracking or
  required-reason API data collection. This does not remove the obligation to
  declare web-view and backend collection in App Store Connect.

## Account-deletion release blocker

This preview branch now removes user-scoped profile/workout uploads and calls
the server-only Supabase Admin API to delete the underlying Auth user after the
Fero application-state writes complete. Do not describe the flow as verified
full account deletion until it is tested in a non-personal production-like
environment for profiles, uploads, user-generated content, retained records,
and repeat sign-in attempts.

Apple requires apps that support account creation to let users initiate account
deletion within the app. The current UI placement is suitable, but the backend
semantics must be completed and verified before submission.

## Publication sequence

1. Resolve the account-deletion behavior and retention decisions.
2. Fill the required publisher details above.
3. Have appropriate counsel review the public Privacy Policy and Terms.
4. Publish them on the final public Fero domain.
5. Add easy in-app links and the matching App Store Connect URLs.
6. Complete App Store privacy answers from the final reviewed data inventory.
