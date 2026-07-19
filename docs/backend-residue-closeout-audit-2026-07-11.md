# Backend Residue Closeout Audit 2026-07-11

This note records the backend-only stabilization pass after the current-write
id-first slices on `codex/create-group-canonical-first`.

## Recently Completed Safe Slices

- `multi-log`, `add-log`, `delete-log`, `flag`, `reaction`, and
  `sitout-request` now gate current-member writes through
  `isCurrentGroupMember(...)`, which prefers `memberships[authUserId]` and keeps
  the active-name shell fallback.
- admin checks for settings, first-month target choice, flag review, kick, and
  projection rebuild now route through `isGroupAdminActor(...)`.
- flag self-checks and flag responses now use `isGroupDisplayNameForActor(...)`
  so display-name keyed workout owners are matched against
  `memberships[actorUserId]` first.
- reaction and flag-family canonical workout-log mirror writes now route
  through `syncOpenWorkoutLogSnapshotToCanonical(...)`.
- sit-out review authorization now routes through
  `canReviewSitOutRequest(...)`, preserving the existing admin, target
  approver, and deputy fallback behavior.
- `leftMemberNames` lifecycle behavior was clarified: auth-linked departures
  clear stale suppression; only profile-less legacy removals append suppression.

## Remaining Runtime Residue

These are the remaining areas that should not be changed as drive-by cleanup.

### 1. `auth-sync`

Location: `migrateAuthIdentity(...)`, `applyAuthSync(...)`, and the
`payload.action === "auth-sync"` handler in `api/lift-log.js`.

Why it remains:

- it repairs profile ids by email
- it backfills auth-linked membership rows in legacy groups
- it persists repaired blob state before returning readable overlaid state
- readable state can hide exactly the blob gaps this path repairs

Safe next work:

- add parity logging or targeted test fixtures around legacy email/profile
  repair before changing the hydration source
- keep the current writable blob base until those fixtures exist

Status:

- direct-profile legacy membership backfill now routes through
  `needsLegacyMembershipBackfill(...)` and
  `backfillLegacyMembershipForProfile(...)`
- legacy auth-id rekeying now routes through
  `rekeyLegacyAuthIdentityInGroup(...)` and
  `rekeySitOutRequestUserIds(...)`
- this is a structure-only cleanup; `auth-sync` still hydrates writable blob
  state first and repair behavior is unchanged

### 2. Profile Rename / `upsert-profile`

Location: `applyUpsertProfile(...)`.

Why it remains:

- the path still resolves old display names from `memberships[userId]` first,
  then falls back to `profile.displayName` plus `memberOrder`
- it rewrites many display-name keyed surfaces in one pass
- collision detection still depends on `memberOrder`

Safe next work:

- extract no-behavior helpers for rename collision and old-name resolution if
  needed
- do not change collision semantics without preview validation

Status:

- old-name resolution, collision detection, and name-keyed surface rewrites are
  now split into helpers
- this is a structure-only cleanup; profile rename behavior is unchanged

### 3. `repair-display-name`

Location: `applyRepairDisplayName(...)` and its POST handler.

Why it remains:

- it is an admin PIN compatibility repair, not a normal rename path
- it rewrites blob historical/name-keyed state and canonical display-name
  snapshots
- it intentionally requires `memberOrder` membership checks

Safe next work:

- keep it quarantined
- do not convert it into general profile rename behavior until display-name
  de-keying is complete

Status:

- `repair-display-name` now reuses the shared display-name surface rewrite
  helper while preserving its existing membership behavior
- `leftMemberNames` rename remains repair-specific
- this is a structure-only cleanup; repair behavior is unchanged

### 4. Join / Rejoin

Location: `applyJoinGroup(...)`.

Why it remains:

- it decides whether to write `joinedMonthByName` based on legacy participation
  history
- it removes stale `leftMemberNames` suppression on rejoin
- it still uses `memberOrder` to distinguish fresh names from legacy relinks

Safe next work:

- test join/rejoin fixtures before changing joined-month rules
- avoid client normalization changes around historical joins

Status:

- joined-month recording for joins now routes through
  `shouldRecordJoinedMonthForJoin(...)`
- this is a structure-only cleanup; join/rejoin behavior is unchanged

### 5. Kick / Leave / Delete Account

Locations: `applyKickMember(...)`, `applyLeaveBloc(...)`,
`applyDeleteAccount(...)`.

Why it remains:

- these paths transfer admin, scrub current logs, remove memberships, and update
  compatibility shell state
- they intentionally preserve historical participation while preventing active
  reappearance
- `leftMemberNames` is still needed for profile-less legacy names

Safe next work:

- add targeted fixtures for kick/rejoin, leave/rejoin, admin transfer, and
  delete-account before behavior changes
- avoid deleting `leftMemberNames` until historical rendering is independent of
  today's active shell

Status:

- leave/delete-account admin transfer now routes through
  `resolveAdminAfterMemberDeparture(...)`
- delete-account display-name resolution and sit-out request cleanup now route
  through small helpers
- kick target resolution now routes through `resolveKickTarget(...)`
- kick actor display-name resolution now routes through
  `resolveMembershipDisplayNameByUserId(...)`
- this is a structure-only cleanup; admin transfer behavior is unchanged

### 6. Writable Hydration Endgame

Location: the POST writable mutation boundary before `current = await getCurrent()`.

Why it remains:

- most normal mutations still compute a blob-shaped compatibility payload
- `fetchReadableCurrentState()` is a user-facing composed projection, not a
  writable source of truth
- the reverted client-normalizer slice proved historical-looking cleanup can
  break auth/bootstrap

Safe next work:

- build a non-persisting parity mode for one narrow action family
- compare canonical writable reconstruction against blob-shaped writable state
- only switch mutation input after parity is proven

## Explicit Non-Goals For The Next Slice

- do not edit `src/lib/appState.js`
- do not change `normalizeAppState`
- do not remove `leftMemberNames`
- do not remove `joinedMonthByName`
- do not change `auth-sync` hydration source
- do not use `fetchReadableCurrentState()` as general POST mutation input
