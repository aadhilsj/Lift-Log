# Fero Onboarding Evaluation

Status: Banana Berry is stable as of 2026-08-26. Keep these experiments deferred until activation instrumentation exists and the reconciled build is stable on main.

Last reviewed: 2026-08-24, Europe/Oslo.

Purpose: preserve product hypotheses about the approved four-screen cold onboarding without turning them into unmeasured pre-launch changes. This document is a return point, not authorization to redesign the current flow.

## Current Decision

Keep the approved four-screen onboarding for the Banana Berry review and App Store stabilization work. Do not expand it to an arbitrary longer sequence and do not add a hard paywall before a Bloc can form.

The current structure is directionally strong because it:

- shows the product visually through leaderboard, activity, settlement, and Bloc creation;
- explains the loop from people to target to penalty to accountability;
- ends with a concrete create/join action;
- keeps invite-link entrants out of cold onboarding;
- uses short copy and product outcomes instead of a long feature tutorial;
- allows a user to experience the core network value before monetization.

## Areas To Watch

### 1. Instant category comprehension

`For the Bloc that keeps you showing up` is brand-led. A completely cold user may not yet know what a Bloc is or that Fero is a monthly workout challenge with friends.

Future hypothesis: test the approved opening against a plain category explanation such as `A monthly workout challenge with your mates.` Do not replace the approved copy without measurement.

### 2. Timing of the emotional payoff

The strongest social consequence, settlement and status change, appears on screen three. Test whether an earlier glimpse of a target hit, last-minute save, or leaderboard movement improves create/join activation without making the flow feel punitive.

### 3. Payment and gambling interpretation

`Or pay up` and explicit dollar examples explain the accountability mechanism quickly. They may also cause some users or reviewers to assume Fero handles payments or wagering.

Keep the product explanation and App Review notes precise: the current implementation records obligations and member-confirmed settlement status, and a pre-submission audit must confirm whether any money ever moves through Fero. Do not weaken or intensify the money language based on opinion alone.

### 4. First-run image reliability

The current onboarding previews use remote Unsplash image URLs. For a native/App Store build, evaluate bundling approved assets locally so first-run comprehension does not depend on a third-party image request. Confirm licensing and asset rights before bundling.

### 5. Duplicate create friction

Screen four collects a Bloc name and passes it into the Create Bloc modal. This is useful when the modal is visibly prefilled, but the two-step interaction may still feel repetitive. Measure abandonment between `Create your Bloc` and confirmed Bloc creation before changing it.

### 6. Evidence, not synthetic social proof

Do not add invented testimonials, fake scientific claims, inflated member counts, or manufactured urgency. If future social proof is used, it must be real, attributable, and appropriate for App Store metadata and the in-app experience.

### 7. Permission timing

Request photo or notification permissions only when the user reaches the feature that needs them. A profile photo remains optional and upload failure must not block Bloc creation/joining, but successful selection should persist and render everywhere avatars appear.

## Measurement Needed Before Changes

Use `docs/product-growth-measurement.md` as the event contract. At minimum, establish:

- progression and abandonment for each onboarding screen;
- create versus join intent;
- authentication request and verification success;
- profile setup completion, photo selection, and photo save success;
- confirmed Bloc creation/join;
- first workout;
- invite acceptance;
- provisional activated-Bloc rate;
- week-one return behavior.

Onboarding completion alone is not success. The outcome is an activated Bloc and continued participation.

## Revisit Gate

Return to this document only after:

1. Banana Berry flows are approved and stable.
2. Profile-photo persistence is verified in the intended local and hosted environments.
3. Launch-critical onboarding/activation events are implemented.
4. A baseline cohort is large enough to reveal where users actually leave.

Then test one change at a time. Recommended first experiment: approved opening copy versus a more literal category explanation. Preserve the rest of the flow so the result is interpretable.
