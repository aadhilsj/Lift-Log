# Future Premium boundary

Last updated: 2026-09-18 (Europe/Oslo).

This is an internal product note for after the free Fero V1 App Store release.
It records what the old Premium labels were intended to signal so the product
plan is not lost when those labels are removed from the submission build.

## V1 rule

Fero V1 is free. It has no paywall, subscription, in-app purchase, purchase
restoration, or entitlement system. The former Premium headings have been
removed from the app, and the useful profile insights remain available to all
members.

## Intended future paid boundary

These are the features that were intended to sit behind a later Premium plan:

1. Participation in more than one Bloc per person.
2. Deeper historical analytics and insights beyond the free profile summary.
3. Advanced per-Bloc comparisons and trend analysis.

The final allowance, price, trial, subscription period, grandfathering rules,
and exact paid analytics are not decided yet.

## Features that were previously grouped under the removed labels

These remain free in V1 and must not be described as paid in the submission:

- Own-profile workout heatmap.
- Own-profile target hit rate.
- Own-profile workouts-by-day breakdown.
- Own-profile training-mix insight cards.
- Other-member profile best-month summary.
- Other-member profile workout-trend chart.

## Requirements before enabling Premium later

Do not gate these features by flipping a boolean. A later paid release needs a
complete StoreKit purchase flow, server-verified entitlements, restore and
manage-purchase handling, account-change handling, support procedures,
App Store metadata, updated legal/privacy wording, and end-to-end tests.
