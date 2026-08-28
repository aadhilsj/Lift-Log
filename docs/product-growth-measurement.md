# Fero Product Growth Measurement

Last updated: 2026-08-24, Europe/Oslo.

Purpose: define what healthy growth means before optimizing onboarding, organic content, monetization, or paid acquisition. This is an instrumentation specification; it does not mean the listed events are implemented.

## Implemented Founder Dashboard Measurement

The founder dashboard records only a signed-in person's daily presence: one
canonical profile ID and one Europe/Oslo calendar date, with first/last open
timestamps. It deliberately does not record email addresses, display names,
messages, workout content, device identifiers, IP addresses, precise location,
or third-party analytics data.

Daily presence is used only for first-party active-user totals. The raw rows are
deleted after 90 days by a protected production retention job; account deletion
cascades to any remaining daily-presence rows. The dashboard is available only
to explicit server-side founder account IDs and returns aggregate counts, never
per-person activity records.

## North-Star Unit

Measure **activated Blocs**, not downloads alone.

Provisional activation definition until real data supports refinement:

1. A person creates or joins a Bloc.
2. At least one additional person joins that Bloc.
3. The creator or newly joined member logs a first workout.

Also retain the timestamps for each underlying step. A single activation boolean hides where formation fails.

Candidate later definition: require multiple active members or a return session within seven days. Do not adopt it until baseline data exists.

## Core Funnel

1. App opened.
2. Onboarding started and each screen viewed.
3. Create or join intent selected.
4. Authentication code requested and verified.
5. Profile setup completed or skipped.
6. Bloc created or joined.
7. Invite shared.
8. Invite opened and accepted.
9. First workout logged.
10. Another Bloc member logs a workout.
11. User returns in week one.
12. Bloc reaches its first finalized month.

Onboarding completion is a diagnostic metric, not the product outcome.

## Event Contract

Use stable `snake_case` names. Every event should include an anonymous/stable user ID when authenticated, a Bloc ID when relevant, app version/build, platform, environment, and timestamp. Never send raw email addresses, display names, invite codes/links, comments, photo URLs, penalty amounts, or authentication secrets unless a separately approved need and privacy review exists.

| Event | Trigger | Useful non-sensitive properties |
| --- | --- | --- |
| `app_opened` | Foreground/cold launch | `entry_source`, `platform`, `is_authenticated` |
| `onboarding_screen_viewed` | A cold-onboarding screen becomes visible | `screen_id`, `position`, `entry_source` |
| `bloc_intent_selected` | Create/join selected | `intent`, `entry_source` |
| `auth_code_requested` | Server accepts code request | `intent`, `result` |
| `auth_verified` | Session established | `intent`, `is_new_account` |
| `profile_setup_completed` | Display-name/photo step continues successfully | `photo_selected`, `photo_saved`, `skipped_photo` |
| `bloc_created` | Server confirms Bloc creation | `setup_source` |
| `bloc_joined` | Server confirms membership | `join_source`, `is_first_bloc` |
| `invite_share_started` | Share/copy action selected | `surface`, `method` |
| `invite_opened` | Valid invite landing resolves | `source`, `is_authenticated` |
| `invite_join_completed` | Invite results in membership | `source`, `is_new_account` |
| `workout_log_created` | Server confirms log | `is_first_user_log`, `is_first_bloc_log`, `workout_type`, `has_photo` |
| `bloc_activated` | Provisional activation first becomes true | `activation_version`, `hours_since_bloc_created` |
| `share_asset_created` | Sticker/result asset renders | `surface`, `moment_type`, `style` |
| `share_action_completed` | OS share resolves or clipboard write succeeds | `surface`, `method`, `moment_type` |
| `month_finalized_viewed` | User sees finalized result | `first_month_for_bloc`, `outcome_type` |
| `account_deleted` | Backend confirms deletion | `account_age_bucket` |

Client attempts and server-confirmed success must be distinguishable. Activation, creation, joining, workout logging, and deletion should be derived from authoritative server outcomes.

## Metrics

- **Bloc formation rate:** Blocs with 2+ members / Blocs created.
- **First-workout rate:** formed Blocs with a workout / formed Blocs.
- **Activated-Bloc rate:** activated Blocs / Blocs created.
- **Time to activation:** median time from `bloc_created` to `bloc_activated`.
- **Invite multiplier:** accepted invited members / Bloc creators.
- **Invite conversion:** completed joins / valid invite opens.
- **Week-one creator retention:** creators active 7 days after creation / creators.
- **Week-one member retention:** invited members active 7 days after join / invited members.
- **First-month completion:** Blocs reaching a finalized month / eligible Blocs.
- **Share completion:** successful share/clipboard actions / share assets created.
- **Share-to-activation:** activated Blocs attributed to a shared invite/content campaign / attributable share visitors.
- **Cost per activated Bloc:** acquisition spend / activated Blocs attributable to that spend.

Report creator and invited-member cohorts separately. Their intent and acquisition costs differ.

## Organic Growth Hypotheses

The product moments most likely to earn attention are:

- a member hitting the target;
- a last-minute workout changing the outcome;
- a meaningful leaderboard/status movement;
- a finalized month result;
- a direct friend-to-friend accountability reaction.

Test content using a consistent sequence: immediate social hook, visible product action, status/result change, and a create/join Bloc call to action. Views and likes are creative diagnostics; attributable activated Blocs are the business result.

The share sticker plan in `docs/share-sticker-implementation-plan-2026-08-01.md` owns the visual asset implementation. This document owns its measurement contract.

## Monetization And Paid Acquisition Gates

Do not scale paid acquisition until:

- activation is instrumented and reliable;
- week-one and first-month retention baselines exist;
- attribution can connect spend to activated Blocs;
- any monetization model has measurable payer conversion, churn/refunds, net proceeds, and support cost;
- expected lifetime value exceeds acquisition cost with a deliberate safety margin.

Do not hard-paywall Bloc formation. If monetization is tested, begin with post-activation or Bloc/admin-level value such as advanced history, statistics, customization, reminders, or multiple challenges. Treat these as hypotheses, not committed roadmap promises.

## Experiment Record

For every onboarding, sharing, store-listing, pricing, or paid campaign experiment record:

- hypothesis;
- primary metric and guardrails;
- target cohort;
- exact variant;
- start/end date and build;
- minimum observation rule chosen in advance;
- result and confidence/limitations;
- decision: ship, iterate, or stop.

Never infer causation from a before/after screenshot or a small number of enthusiastic users.
