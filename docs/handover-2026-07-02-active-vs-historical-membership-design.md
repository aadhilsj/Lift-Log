# Handover — Active vs Historical Membership Design 2026-07-02

This note captures the next architectural blocker in the migration program:
`memberOrder` currently represents both:

- the active members of a bloc right now
- the set of member names that must still exist in historical month views

Those are not the same thing.

Read alongside:
- [docs/handover-2026-07-01-left-member-lifecycle-audit.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-07-01-left-member-lifecycle-audit.md)
- [docs/handover-2026-07-01-data-migration-restart-plan.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-07-01-data-migration-restart-plan.md)
- [docs/relational-cutover-plan.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/relational-cutover-plan.md)

## Problem

Today, on both server and client:

- `normalizeGroup()` / `normalizeGroupState()` build `memberOrder`
- `memberOrder` is inferred from:
  - current `group.memberOrder`
  - current logs
  - month-history `counts`
  - month-history `logsByUser`
- `leftMemberNames` suppresses ex-members so those historical names do not get
  re-promoted into current active membership

This means:
- current active views rely on `memberOrder`
- historical month normalization also relies on `memberOrder`

So if `memberOrder` becomes active-only too early:
- historical ex-members disappear from `monthHistory`
- profile/history/all-time views become wrong

## Current Surface Split

### Surfaces that actually want active members only

These should eventually stop depending on historical name inference:

- Today screen leaderboard
- current-month pace / MAS calculations
- current-month settlement reminder surfaces
- current-month logging permissions
- member count shown in current bloc settings / headers
- join / leave / kick lifecycle checks
- cross-bloc current-month log targeting

### Surfaces that must preserve historical participants

These need historical names even after someone leaves:

- closed month history
- Results / History month detail views
- Player profile closed-month stats
- historical `logsByUser`
- historical `counts`
- historical `settlements`
- historical month averages / rankings

## Current Data Model Limitation

The app currently has no explicit split between:

- `activeMemberOrder`
- `historicalMemberNames`

Instead it has:

- `memberOrder`
- `leftMemberNames`

Where `leftMemberNames` acts as a subtraction list to keep historical members
from being treated as active.

That is why simple removal is unsafe.

## Canonical Model Already Supports The Split

Canonical already has:

- `ante_core.bloc_members.left_at`
  - explicit active membership boundary
- historical workout data in month/season tables
  - historical participation is preserved independently

So the canonical model already separates:
- active membership
- historical participation

The blob-compatible app model does not.

## Correct Direction

Do not try to make `memberOrder` do less without replacing its historical role.

Instead introduce an explicit split in app-state composition:

### Proposed composed fields

- `activeMemberOrder`
  - current active members only
  - sourced from explicit memberships / canonical bloc members
- `historicalMemberNames`
  - union of names needed to render month history safely
  - derived from month snapshots and historical log ownership
- `memberOrder`
  - temporary compatibility alias during transition

Short-term compatibility options:

1. keep `memberOrder` as today for legacy UI compatibility, but add
   `activeMemberOrder` beside it for current-month surfaces
2. migrate current-month calculations/screens onto `activeMemberOrder`
3. leave history/profile surfaces on historical name sources
4. only then consider shrinking or redefining `memberOrder`

## Safest Next Slice

The best next code slice is not deleting `leftMemberNames`.

It is:

1. add a composed `activeMemberOrder` on server and client normalization
2. source it from explicit active membership structures:
   - `memberships`
   - canonical bloc member overlays
   - current explicit member order when coverage is complete
3. switch only current-month logic to use `activeMemberOrder`
4. leave `memberOrder` and history normalization untouched for now

## Why This Is Safer

This avoids:

- breaking historical month snapshots
- breaking Player Profile closed-month views
- breaking results/history stats that rely on old names

While still letting us:

- stop using history-derived names for live active-member logic
- reduce the need for `leftMemberNames` in current-month flows

## Concrete Implementation Order

### Phase A

Add `activeMemberOrder` to composed state:

- server `normalizeGroup()`
- client `normalizeGroupState()`

Rules:

- if explicit active memberships exist, use them
- preserve display order via current/canonical sort order
- do not infer active members from historical `monthHistory`

### Phase B

Move current-month logic to `activeMemberOrder`:

- leaderboard
- pace calculations
- current-month settlement logic
- current-month logging/membership checks
- current member counts

### Phase C

Validate lifecycle flows again:

- kick
- leave
- rejoin
- delete-account

### Phase D

Only after A-C:

- decide whether `leftMemberNames` is still required
- possibly stop writing it
- much later, possibly redefine or retire `memberOrder`

## Not Recommended

Do not do these next:

- direct deletion of `leftMemberNames`
- redefining `memberOrder` to active-only in one pass
- changing historical month normalization and current-month logic together

That is too much surface area for one migration slice.

## Immediate Recommendation

Next working slice:

- introduce `activeMemberOrder`
- switch one narrow current-month read path to it first

Best first consumer:

- Today leaderboard / current-month member count logic

That gives the highest signal with the smallest blast radius.
