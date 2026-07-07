# Next Migration Phase: Write Cutover and Identity De-Keying

Date: 2026-07-04

## Current-Main Amendment

This note was written during the transition out of the guarded
`codex/read-cutover-get-composer` branch state.

It is still directionally useful, but these corrections now apply on current
`main`:

- live production is now on `main` commit `c2eed0d`, not `f67f25d`
- current `api/lift-log.js` no longer references
  `ENABLE_CANONICAL_READ_COMPOSER`
- read cutover is still incomplete, but it is no longer env-flag guarded in
  application code
- the earlier recommended first write slices are already present in code:
  - `season-proration-choice`
  - `sitout-request`
  - `sitout-review`
  - `update-settings`
- `invite-context` and `join-group` already resolve invite codes canonically
  before the existing blob flow
- settlement confirmation actions already write canonically
- several later bounded slices are also now already implemented and verified:
  - `create-group`
  - `join-group`
  - `kick-member`
  - `leave-bloc`
  - `multi-log`
  - `reaction`
  - `flag`
  - `flag-response`
  - `flag-review`
  - `delete-log`
- `delete-account` is also now verified live as a canonical-first slice
- `repair-display-name` remains blob-first with best-effort canonical sync
- July 6 settlement fixes also landed:
  - preserve historical settled state during rebuilds
  - render per-pair settlement reminder amounts correctly

Read this note together with:

- `docs/handover-2026-07-04-current-main-migration-audit.md`

## Current State

The app is in a guarded transitional state.

- Production reads are no longer using the old timed-out projection RPC.
- GET responses are still blob-backed first, then selectively overlaid with canonical data.
- Mutations are still blob-authoritative.
- Display names are still structurally meaningful in multiple lifecycle paths.

This means the migration is **not** fully complete yet, even though the production app is currently stable.

## What Is Already Done

- Canonical import is in place.
- Canonical read RPCs exist for:
  - blocs
  - bloc members
  - profiles
  - current logs
  - current excused/sit-outs
  - month history
  - settlement confirmations
  - season overrides
- The production app has already proven that canonical reads can safely compose large parts of the UI.

## What Is Not Done Yet

### 1. Read Cutover Is Still Blob-First

`fetchReadableCurrentState()` still does this:

1. hydrate from blob state
2. overlay canonical blocs
3. overlay canonical members
4. overlay canonical current logs
5. overlay canonical current excused/sit-outs
6. overlay canonical month history
7. overlay canonical profiles
8. overlay canonical settlement confirmations

So the app is **canonical-assisted**, not canonical-native.

On current `main`, this is no longer controlled by the old
`ENABLE_CANONICAL_READ_COMPOSER` app-code gate. The remaining issue is the
blob-first composition model itself.

Small read-path cleanup already landed on 2026-07-04:

- `group.inviteCode` now overlays from canonical `blocs.invite_code`
- `defaultGroupId` is now re-derived from the composed `groupOrder` instead of
  surviving from the blob snapshot

### 2. Write Cutover Is Not Done

`fetchWritableCurrentState()` still returns the blob state directly.

That means write actions still compute their mutations from blob state and then persist back into blob, with canonical mostly acting as a side sync.

This is the clearest sign that write cutover is still pending.

### 3. Display Names Are Still Part of Data Identity

The app still relies on display-name keyed structures such as:

- `memberOrder`
- `joinedMonthByName`
- `leftMemberNames`
- `logs[displayName]`
- historical `logsByUser`
- settlement rows keyed by display-name snapshots
- lifecycle lookups that compare `membership.displayName`

This means display names are **not cosmetic only** yet.

## Why We Should Not Jump Straight To Display-Name Cleanup

Display-name de-keying sits on top of two unfinished foundations:

1. active-vs-historical membership separation
2. write authority moving away from blob

If we try to make display names cosmetic before the write path is stabilized, we will be rewriting identity logic while the mutation authority is still split.

That is the wrong order.

## Recommended Execution Order

### Phase 1: Finish Read Cutover Deliberately

Goal: stop depending on blob as the normal GET shell.

Work:

- identify every field in `fetchReadableCurrentState()` that is still blob-originated after overlays
- define the exact canonical response shape for:
  - current state
  - month history
  - settlement confirmations
  - season overrides
  - current sit-out / excused state
- remove fallback behavior only after parity verification is explicit

Exit condition:

- normal GET reads no longer depend on blob-first hydration
- blob is no longer required to render the main app state

### Phase 2: Write Cutover by Safe Vertical Slices

Goal: stop using blob as the mutation authority.

Recommended order:

1. season overrides
2. sit-out requests / excused state
3. settings updates
4. settlement confirmation actions
5. join / leave / kick flows
6. workout logging
7. delete-account and rename-sensitive lifecycle flows

Why this order:

- the early slices are narrower and easier to validate
- membership and workout writes are the riskiest and should land later

Exit condition:

- write actions compute from canonical-backed state
- blob becomes mirror / compatibility output only, not source of truth

### Phase 3: Make Display Names Cosmetic Only

Goal: identity is driven by stable ids, not names.

Required changes:

- replace display-name keyed current structures with id-keyed structures
- separate active current-member ordering from historical month snapshots
- keep display-name snapshots only where historical rendering genuinely needs them
- ensure rename no longer rewrites structural keys across the app state

Exit condition:

- renaming a user changes presentation, not data identity
- lifecycle operations resolve by stable ids only

### Phase 4: Blob Retirement / Cleanup

Goal: remove compatibility layers and dead paths.

Work:

- remove blob-overlay read code
- remove blob-first write hydration
- remove stale migration toggles / guards
- prune non-critical storage cleanup paths that only exist for transitional safety

## Immediate Next Slice

The older recommendation to start with `create-group` is now obsolete.

The real remaining short-list on current `main` is:

1. finish the active-vs-historical membership split on the read side so
   current-member surfaces stop inheriting membership from blob-era
   `memberOrder`
2. audit whether `repair-display-name` should become canonical-first at all, or
   stay as a one-off blob-compatibility repair until display names are fully
   de-keyed
3. decide how far the legacy blob-backed `settlement` month-history mutation
   should be migrated versus retired with the broader historical redesign

If the goal is more implementation rather than verification, the next genuine
code-side migration target is the read-side membership authority split, then
the rename / lifecycle residue around:

- `activeMemberOrder`
- `memberOrder`
- current-month rollover / snapshot composition
- `repair-display-name`
- `leftMemberNames`
- display-name keyed historical structures

### Active-Membership Read Cutover Amendment

The first patch in this phase should be intentionally narrow:

- treat canonical-backed memberships as the authority for `activeMemberOrder`
- stop letting blob `memberOrder` leak historical names into current active
  membership when canonical memberships are present
- use `activeMemberOrder` for current-month rollover and snapshot composition
- keep historical `monthHistory` rendering on `memberOrder` for now

This does **not** complete read cutover by itself, but it removes the most
important current-state ambiguity without forcing the historical redesign into
the same patch.

## Non-Goals For This Slice

Do **not** start with:

- workout logging
- full member lifecycle refactors
- rename / display-name de-keying
- delete-account cleanup

Those should wait until the earlier migration slices are locked down.

## Bottom Line

Yes, the remaining major work is:

1. finish read cutover
2. do write cutover
3. make display names cosmetic

That is still the correct order.
