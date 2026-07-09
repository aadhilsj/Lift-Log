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
- `repair-display-name` was blob-first at the time of this note; a later local
  July 9 patch converts it into a canonical snapshot-repair slice for one bloc,
  but that should not be treated as full display-name de-keying
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

### Current-Member Surface Cleanup Amendment

The follow-on read cleanup after active-membership composition should stay
equally narrow:

- current-only client surfaces must enumerate `activeMemberOrder`, not
  historical `memberOrder`
- this especially applies to:
  - activity feed flattening
  - current-week MVP / weekly count helpers
  - any current-group identity pickers that should only resolve active members
- current-month membership gating should use effective join logic derived from
  canonical memberships when available, not raw blob `joinedMonthByName`
- closed-month history and broader historical rendering should continue to use
  `memberOrder` until the historical redesign lands

Exit condition for this sub-slice:

- no current-page UI surface shows departed/historical members purely because
  they still exist in blob-era `memberOrder`
- historical pages still retain the broader member shell

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

## Read Composer Residual Inventory — 2026-07-07

After the active-membership split, current-surface cleanup, effective
joined-month gating, and orphaned-flag scrub, `fetchReadableCurrentState()`
now falls into three buckets:

### Canonical-backed enough for current-state use

These current surfaces now materially compose from canonical data:

- bloc settings shell:
  - `name`
  - `inviteCode`
  - `createdAt`
  - normalized current settings
- active membership shell:
  - `memberships`
  - `adminUserId`
  - `adminName`
  - canonical-first `memberOrder` when canonical sort coverage is complete
  - derived `activeMemberOrder`
- current-month state:
  - `logs` for groups with canonical current-log rows
  - `excused` for the open month
  - current-month `sitOutRequests`
  - open-month `lastMonth`
- canonical profiles overlay for existing blob profile ids
- settlement confirmations when the feature is enabled
- season overrides

### Still blob-assisted on read

These are the remaining read-shell dependencies that still stop GET state from
being truly canonical-first:

#### 1. Top-level group shell still starts from blob

- canonical blocs only overlay groups that already exist in blob state
- groups absent from blob can never appear from canonical alone
- uncovered / inactive residual groups can still survive through blob
  `groupOrder` fallback

#### 2. Current logs do not support canonical empty-state clearing

- `read_ante_core_current_logs()` only overlays groups that return log rows
- if a group has zero canonical current logs, the composer currently preserves
  blob `group.logs` unchanged
- this is the largest remaining current-state ambiguity on the read side

This is meaningfully different from current excused / sit-out overlays, which
already use open-season coverage to clear stale blob state even when canonical
returns zero rows.

#### 3. Membership shell still preserves blob fallback residue

- canonical bloc-members only overlay auth-linked members already present in
  blob `memberships`
- canonical read still refuses to invent or resurrect missing members
- residual `memberOrder` names can still survive when canonical sort coverage
  is incomplete

This is deliberate safety behavior, but it means read authority is not yet
fully canonical-native.

#### 4. `joinedMonthByName` is still partially blob-owned

- canonical member rows only add / override entries when
  `joined_month_key` exists
- blob `joinedMonthByName` entries survive otherwise
- current-month gating now uses effective join inference, so this is less
  visible than before, but the structure is still not canonical-owned

#### 5. `leftMemberNames` is still blob-only

- no canonical source reconstructs it
- current read composition still relies on it to suppress departed users from
  active state
- orphaned current-log cleanup also still uses it as the departure shell

#### 6. Closed-month history is still canonical-assisted, not canonical-native

- canonical month history only replaces blob months that already exist in
  `group.monthHistory`
- months absent from blob are never invented from canonical
- months with incomplete canonical member coverage preserve blob history
- historical member shell is still keyed to broader `memberOrder`

#### 7. Historical sit-out scaffolding is still blob-owned

- only the open-season month of `sitOutRequests` is canonical-overlaid
- historical month keys in `sitOutRequests` are preserved from blob

### Blob-only compatibility fields that still matter

- `leftMemberNames`
- residual `joinedMonthByName`
- historical `monthHistory` shell existence
- blob-first group existence / `groupOrder` fallback

### Recommended Remaining Read Order

#### Slice A — current-log zero-state cutover

Goal:

- make canonical current logs authoritative even when a group has zero current
  logs

Implementation direction:

- extend current-log read coverage so the composer knows the open-season group
  set independently of whether log rows exist
- then replace current `group.logs` for every open-season covered group,
  including `{ memberName: [] }` empty states

Why this is next:

- it closes the largest remaining current-state ambiguity
- it is still a bounded current-state patch
- it avoids forcing the historical redesign into the same change

Status:

- completed locally on 2026-07-07
- `fetchReadableCurrentState()` now treats canonical current logs as
  authoritative for every canonically open group, including zero-log empty
  states
- successful-but-empty current-log reads no longer fall back to stale blob
  `group.logs`

#### Slice B — top-level canonical group shell authority

Goal:

- stop requiring blob existence as the prerequisite for a readable group shell

Implementation direction:

- compose readable groups from canonical bloc rows first
- then merge compatibility-only blob residue onto those groups only where still
  required

This is where read composition starts becoming truly canonical-first rather
than blob-hydrate-plus-overlay.

Status:

- completed locally on 2026-07-08
- readable group shells are now composed from canonical bloc rows first
- generic blob-only groups no longer survive on read just because they still
  exist in blob `groupOrder`
- the only remaining blob-only group fallback is explicit legacy compatibility
  for `legacy-group` if no canonical bloc row exists for it
- canonical bloc-member rows can now seed a readable membership shell for a
  canonical group that has no blob shell at all
- pre-existing blob groups still retain the old blob-key guard against
  accidental canonical member resurrection

#### Slice C — explicit handling for blob-only lifecycle residue

Goal:

- isolate the fields that remain blob compatibility only:
  - `leftMemberNames`
  - partial `joinedMonthByName`
  - historical sit-out residue

Implementation direction:

- either keep them as temporary compatibility inputs on the read side, or
- add canonical replacements if they are still required after lifecycle cleanup

This slice should happen before a full claim that GET state is canonical-first.

Status:

- completed locally on 2026-07-09
- current-log cleanup now keys off the composed current-member set instead of
  using blob `leftMemberNames` as the trigger for removing departed members'
  current logs / reactions / pending flags
- canonical active-member derivation no longer lets stale blob
  `leftMemberNames` suppress users who are present in canonical memberships
- `leftMemberNames` still exists as compatibility residue for active-shell
  shaping, but it is no longer required for current-log cleanup on read
- redundant blob `joinedMonthByName` entries for auth-linked members are now
  pruned on read when canonical `joinedAt` already carries the same join-month
  meaning
- historical `sitOutRequests` residue no longer survives in readable state;
  read composition now exposes only the canonically open month
- remaining `joinedMonthByName` read residue is intentionally narrow legacy
  compatibility where canonical membership timing alone cannot fully recreate
  historical participation boundaries

#### Slice D — historical month-history redesign

Goal:

- remove blob dependence from closed-month history existence and shell shape

Implementation direction:

- allow canonical history to invent missing months
- move historical month composition off blob month-shell presence
- eventually de-key historical member rendering from the broader blob
  `memberOrder` shell

This is the largest remaining read migration item and should stay separate from
the current-state cutover.

Status:

- completed locally on 2026-07-08
- canonical closed-month history is no longer blocked on blob month-shell
  existence
- canonical closed seasons can now invent missing historical months on read,
  while the existing completeness guard still preserves blob months when
  canonical member coverage looks partial
- canonical closed-month member shells are now derived from historical
  season-member rows and historical log owners rather than being filtered
  through today’s `group.memberOrder`
- client-side closed-month normalization no longer re-trims historical months
  through today’s live `memberOrder`
- backend `normalizeMonthHistory()` parity now derives closed-month shells
  from month-local evidence first, so blob-state normalizations do not
  silently reintroduce current-shell dependence

### Recommended Immediate Next Patch

If implementation continues now, the next patch should be:

- finish and verify top-level canonical group shell authority

The current-log zero-state loophole is now closed, so the next highest-value
read step is removing the requirement that a readable group must already exist
in the blob shell.

That is still the correct order.
