# Future Premium feature map

Last updated: 2026-09-15 (Europe/Oslo).

Purpose: preserve the intended monetisation boundary while version one is
submitted without a paywall. This is an internal product map, not customer copy
and not permission to enable billing before the later StoreKit/payments work.

## Version-one decision

Version one must not promise or imply a purchasable Premium product. There is
no current subscription, paywall, in-app purchase, purchase restoration or
feature-entitlement system. Before submission, remove or rename the visible
`Premium` labels below while leaving the useful features available to everyone.

## Intended future Premium boundary

The founder's stated go-to-market intent is:

1. One Bloc is free per person.
2. Joining or participating in more than one Bloc requires Premium.
3. Selected deeper analytics and insights require Premium.

This document does **not** decide the final price, trial, subscription period,
eligibility edge cases, family sharing, grandfathering, or which exact
analytics are paid. Those require a later product and StoreKit decision.

## Current visible labels to remove or rename for version one

| Surface | Current label | Features currently grouped below it | V1 treatment | Future Premium candidate |
| --- | --- | --- | --- | --- |
| Own Profile stats | `Premium` divider | Workout heatmap, target hit-rate, workouts by day, training mix and related profile insight cards | Keep useful features available; remove/rename the divider so there is no paid promise | Deeper historical insight set, subject to the later entitlement design |
| Other member / Bloc profile | `Premium · This Bloc` | Best month and workout trend | Keep available; remove/rename the heading | Per-Bloc historical trends and advanced comparisons, subject to the later entitlement design |

## Existing code markers (not a real gate)

- `src/pages/ProfilePage.jsx` declares `PROFILE_PREMIUM_GATE = false`, but the
  profile statistics component renders its section independently. This is a
  future implementation marker, not a working entitlement system.
- `src/pages/PlayerProfile.jsx` declares `PLAYER_PROFILE_PREMIUM_GATE = false`.
  Its `premiumSection` renders while the flag is false, so it is currently
  visible to everyone.
- `src/components/ProfileStatsPanel.jsx` contains the visible `Premium` heading
  and the insight cards beneath it.

Do not simply flip either marker to `true`: that would hide features without a
purchase, restore, account-entitlement or customer-support flow. A later
Premium release needs StoreKit purchases, server-side entitlement handling,
restore purchases, appropriate App Store metadata and full testing.

## Later implementation checklist (out of scope for V1)

1. Decide the exact free allowance and the analytics that are genuinely paid.
2. Design the upgrade, restore-purchase, manage-subscription and failure-state
   experience.
3. Implement StoreKit and a server-verified entitlement model.
4. Gate the multi-Bloc creation/joining path and selected analytics consistently
   across web and iOS.
5. Add App Store purchase metadata, support copy, Terms/Privacy updates and
   tests for new purchase, restore, cancellation and account changes.

## Guardrail

Until that work is approved and complete, Fero should describe version one as
one free product—not as free and Premium tiers. This protects the App Store
submission while keeping the monetisation strategy intact for the next release.
