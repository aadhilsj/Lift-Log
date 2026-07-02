# Read Cutover Audit — 2026-07-02

This note defines the next migration track after landing the product/stabilization
branch and verifying production.

## Status Update

This branch now contains the first implementation pass.

Current implementation state:

- normal GET composition has a canonical-first composer
- if the canonical read baseline is missing (for example
  `read_ante_core_blocs` is not present in the PostgREST schema cache), GET
  falls back to the prior blob-overlay composer instead of returning an empty
  app shell
- `meta.revision` / `meta.updatedAt` are still sourced from the singleton blob
  row for sync ordering safety in this pass

That means this branch is a safe transitional cutover, not the final blob-free
GET path yet.

Branch context at audit time:

- landed branch: `codex/membership-safety-fixes`
- production was verified healthy after merge

This is the plan for the next dedicated pass:

- move app reads onto canonical relational data by default
- keep blob-backed write hydration in place until the later write cutover pass

## Current Reality

`GET /api/lift-log` is still composed by:

1. reading the blob from `public.lift_log_state`
2. normalizing it into app state
3. overlaying selected canonical `ante_core` reads on top

The frontend still expects one normalized app payload shaped like:

```js
{
  version: 2,
  groups: { ... },
  groupOrder: [...],
  defaultGroupId: "...",
  profiles: { ... },
  meta: { revision, updatedAt }
}
```

So the read cutover is not “switch the frontend.” It is:

- replace the blob-first server composition base
- continue returning the same client-facing shape

## What Is Already Effectively Canonical On Read

Inside `fetchReadableCurrentState()` in
[`api/lift-log.js`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js),
these surfaces are already sourced from canonical RPCs and overlaid:

- bloc settings and bloc name via `read_ante_core_blocs`
- group creation timestamp via canonical bloc `created_at`
- `groupOrder` via canonical bloc `sort_order` when coverage is complete
- `memberOrder` via canonical bloc-member `sort_order` when coverage is complete
- `memberships`
- `joinedMonthByName`
- `adminUserId`
- `adminName`
- current-month logs via `read_ante_core_current_logs`
- current-month excused state via `read_ante_core_current_excused_and_sitouts`
- current-month sit-out requests via `read_ante_core_current_excused_and_sitouts`
- current open month key (`lastMonth`) for covered groups via open seasons
- closed-season `monthHistory` via `read_ante_core_month_history`
- profiles via `read_ante_core_profiles`
- settlement confirmations via `read_ante_core_settlement_confirmations`

This means most user-visible screens are already reading mostly canonical data,
but only after the blob state has been loaded first.

## What Is Still Blob-First On Read

### Top-level payload fields

- `defaultGroupId`
- `meta.revision`
- `meta.updatedAt`

### Blob-only / compatibility shell

- fallback empty groups that survive because blob is the starting point
- fallback zero-log / edge-case members that survive because blob is the
  starting point
- `leftMemberNames` as an active-member suppression mechanism

### Not an actual read blocker for this slice

- `pendingOtps`

`pendingOtps` is still blob-backed, but it is not a normal live-view dependency.
It is an auth runtime dependency and should be handled in the later auth/write
cutover path, not treated as a blocker for canonical read composition.

## Important Observations From Current Code

### `defaultGroupId` can be derived

The frontend already stores the selected group in local storage:

- `LOCAL_GROUP_KEY = "ll_group_id"`

The server-side `defaultGroupId` is not a deep business-state requirement for
the read cutover. It can be derived from the canonical group order when needed.

### `meta.revision` and `meta.updatedAt` are transport concerns, not product state

The frontend uses these for optimistic-update / poll ordering behavior.

That means the read cutover still needs:

- a stable monotonic sync token
- an updated timestamp

But it does **not** require blob state itself to remain the source of truth.

### `leftMemberNames` is mostly compatibility residue

`leftMemberNames` is still referenced when deriving `activeMemberOrder` and in
lifecycle mutations, but it is not a primary UI field.

For read composition specifically, this means we should be able to stop relying
on it by composing from:

- active canonical `bloc_members`
- canonical historical `monthHistory`

rather than carrying blob suppression lists forward on GET.

## Read Cutover Goal

For the next pass, `fetchReadableCurrentState()` should become:

- canonical-first
- blob-shape-compatible
- no blob fetch on normal GET

The blob should remain available only for:

- `fetchWritableCurrentState()`
- auth OTP runtime compatibility
- backup / rollback safety during the later write cutover

## Proposed Execution Plan

### Slice 1 — Canonical-first GET composer

Build a new server read path that composes app state entirely from canonical
RPCs / relational sources, returning the same client shape.

Inputs:

- `read_ante_core_blocs`
- `read_ante_core_bloc_members`
- `read_ante_core_current_logs`
- `read_ante_core_current_excused_and_sitouts`
- `read_ante_core_month_history`
- `read_ante_core_profiles`
- `read_ante_core_season_overrides`
- `read_ante_core_settlement_confirmations`

Outputs to synthesize:

- `groups`
- `groupOrder`
- `defaultGroupId`
- `profiles`
- `meta`

### Slice 2 — Remove blob-base fallback from GET

Replace:

- blob-first `fetchCurrentStateFromSupabase()`
- overlay composition on top

with:

- canonical app-state composition directly

Fallback policy:

- if canonical read fails hard, return an error rather than silently rebuilding
  from blob
- if a narrow optional canonical surface fails, degrade only that surface if
  truly necessary

### Slice 3 — Compatibility decisions

Explicitly replace or delete these read-time fields:

- `defaultGroupId`
  - derive from selected local group or first visible canonical group
- `meta.revision`
  - replace with a synthetic monotonic token
- `meta.updatedAt`
  - replace with a server-generated timestamp or max-source timestamp
- `leftMemberNames`
  - stop using it to drive GET composition

### Slice 4 — Verification

Must verify on preview before landing:

- Today
- Activity
- Results
- History
- profile open from Today and History
- Week’s MVP
- settlement reminders / confirmations
- empty bloc / no-log member visibility
- early-month state behavior
- member leave / rejoin visibility on GET

## Concrete Blockers Before Coding

These should be resolved in the implementation plan before writing code:

1. Decide the replacement source for `meta.revision`
   - likely synthetic on the server, not persisted as canonical product state

2. Decide whether any canonical read RPCs need extension
   - especially if GET composition still needs a cleaner open-season shell view

3. Decide whether to add a dedicated canonical “read current app shell” RPC
   - may simplify composition versus many separate RPC calls

## Recommended Implementation Strategy

Do **not** combine read and write cutover.

Recommended order:

1. add a new canonical-only GET composer behind a server flag or temporary
   branch-local switch
2. verify full UI parity in preview
3. ship read cutover
4. only then begin the write cutover pass

## Bottom Line

The next step is not another tiny overlay.

The next step is to replace blob-first GET composition with canonical-first GET
composition while preserving the same client-facing app-state shape.

That is the correct next migration slice.
