# Current Main Migration Audit — 2026-07-04

This note reconciles the migration docs against the actual current `main`
branch and the live Vercel production deployment.

It exists because several older notes still describe the temporary
`codex/read-cutover-get-composer` branch state rather than the current app.

## Verified Repo + Deploy State

Repo state at audit time:

- branch: `main`
- HEAD: `c2eed0d` — `fix(api): harden storage cleanup path`
- local unstaged change:
  - `api/lift-log.js`
- local untracked doc:
  - `docs/handover-2026-07-04-next-migration-phase.md`

Verified live Vercel production deployment:

- project: `lift-log`
- project id: `prj_wZ1qEL1w37c39qAThaqEkl42HXTI`
- team id: `team_XidhhVYn5egpVxdkw6SP8heA`
- current production commit: `c2eed0d`
- current production commit message:
  `fix(api): harden storage cleanup path`

Important consequence:

- production is no longer running the old guarded composer branch described in
  `docs/read-cutover-closeout-2026-07-03.md`

## Current Read Reality On Main

`fetchReadableCurrentState()` still starts from the blob and overlays
canonical data in this order:

1. canonical blocs
2. canonical season overrides
3. canonical bloc members
4. canonical current logs
5. canonical current excused and sit-out state
6. canonical closed-month history
7. canonical profiles
8. canonical settlement confirmations

That means the app is still:

- blob-first for GET composition
- canonical-assisted for most user-visible data
- not yet canonical-native on read

However, current `main` no longer contains the old
`ENABLE_CANONICAL_READ_COMPOSER` gate.

So the correct statement is:

- read cutover is still incomplete
- but it is no longer env-flag guarded in application code on current `main`

## Current Write Reality On Main

`fetchWritableCurrentState()` still returns the blob state directly.

That remains the main migration boundary:

- writes still hydrate from blob
- mutations still persist blob state
- canonical is partly authoritative for selected bounded actions, but not the
  general mutation base yet

### Canonical-first or canonical-backed slices already present in code

Verified in `api/lift-log.js`:

- `season-proration-choice`
- `sitout-request`
- `sitout-review`
- `update-settings`
- `invite-context` canonical-first invite resolution
- `join-group` canonical-first invite resolution before entering the existing
  blob join flow
- settlement confirmation actions write canonically and then re-read the
  composed GET state:
  - `settlement-claim-paid`
  - `settlement-confirm-paid`
  - `settlement-dispute-paid`

These should no longer be discussed as merely hypothetical future slices.

## Remaining Blob-Borne Read Shell Re-Audit

This section replaces older broad lists that still included fields already
cleaned up or removed from the live app path.

### No longer a real read-shell blocker

`defaultGroupId`

- current GET state re-derives it from composed `groupOrder`
- it is no longer semantically preserved from blob state

`pendingOtps`

- no current normalized app-state field carries `pendingOtps`
- `auth-send-otp` and `auth-verify-otp` now return `410`
- the interactive auth path uses Supabase Auth plus `auth-sync`
- this is no longer a live read-shell blocker in `api/lift-log.js`

`group.inviteCode`

- current GET overlay prefers canonical `blocs.invite_code`
- blob is now fallback only when canonical bloc coverage is absent

`group.createdAt`

- current GET overlay prefers canonical `blocs.created_at`
- blob is now fallback only when canonical bloc coverage is absent

### Still blob-derived, but compatibility-only

`meta.revision`

- still produced by blob normalization and blob persistence
- still used for backup/persist bookkeeping
- not part of the user-visible relational migration problem anymore

`meta.updatedAt`

- same class as `meta.revision`
- still returned in state
- still not a user-visible canonical-surface blocker

### Still blob-derived and behaviorally important

`leftMemberNames`

- still read directly into `normalizeGroup()`
- still used to suppress historical or departed names from active composition
- still mutated by:
  - `join-group`
  - `kick-member`
  - `leave-bloc`
  - `delete-account`
  - `repair-display-name`

This remains the highest-value blob-owned shell dependency in the current app.

### Still blob-backed compatibility scaffolding

Because GET still starts from blob hydration:

- empty groups can survive via blob base state
- zero-log or profile-incomplete members can survive via blob-compatible shell
  composition
- historical leftovers can survive when canonical overlays intentionally refuse
  to invent or resurrect rows

This is the real reason read cutover is not complete, more than any single
top-level scalar field.

## Display-Name Identity Reality

Display names are still structurally meaningful in current `main`.

Still name-keyed or name-dependent:

- `memberOrder`
- `joinedMonthByName`
- `logs[displayName]`
- `monthHistory[*].logsByUser`
- settlement snapshots in month history
- `sitOutRequests[monthKey][displayName]`
- `leftMemberNames`
- multiple lifecycle comparisons against `membership.displayName`

So display names are still not cosmetic-only.

## Practical Migration Implications

The remaining migration problem is narrower than some older docs imply.

It is no longer:

- `pendingOtps`
- `defaultGroupId`
- invite-code read authority
- created-at read authority
- the old canonical-read env flag

It is still:

- blob-first mutation hydration
- blob-backed compatibility scaffolding on GET
- `leftMemberNames`
- display-name keyed lifecycle and history structures

## Recommended Next Concrete Migration Patch

Recommended next bounded write slice on current `main` at audit time:

- `create-group`

Why `create-group` is the best next slice now:

1. It already dual-writes almost every required canonical surface:
   - bloc
   - open season
   - creator membership
   - initial open-season member status
2. It only creates new state.
3. It does not depend on `leftMemberNames` cleanup.
4. It avoids the rejoin/kick/leave/delete-account edge cases that still make
   lifecycle flows poor next candidates.
5. It is a cleaner authority-transfer target than `upsert-profile`, which still
   rewrites many name-keyed structures during rename propagation.

Recommended patch shape:

1. compute the exact post-create group in memory with `applyCreateGroup(...)`
2. write canonical bloc, open season, bloc member, and seeded season-member
   status from that exact in-memory payload first
3. persist blob immediately after as the mirror / compatibility shadow
4. keep the response contract unchanged

### Why not `join-group` next

Do not move `join-group` first.

Even with canonical-first invite resolution already in place, `join-group`
still intersects with:

- `leftMemberNames`
- rejoin semantics
- active-vs-historical membership suppression

That makes it materially riskier than `create-group`.

### Why not workout/log/lifecycle writes next

Still poor next candidates:

- `multi-log`
- `reaction`
- `flag`
- `flag-response`
- `flag-review`
- `delete-log`
- `kick-member`
- `leave-bloc`
- `delete-account`
- `repair-display-name`

These remain too entangled with name-keyed structures or lifecycle cleanup.

## Verification Amendment — 2026-07-04

`create-group` was subsequently verified live.

Verified created bloc:

- `legacy_group_key = test123-pmiura`
- canonical bloc row present
- canonical open season present
- canonical admin membership present
- canonical seeded open-season `season_member_status` present
- blob mirror group present

That means `create-group` should no longer be treated as merely the next
candidate. It is now a verified canonical-first slice.

Next candidate after that verification:

- `join-group`

But only with the narrower scope documented in:

- `docs/handover-2026-07-04-join-group-audit.md`

As of the latest local branch state, the narrow `join-group`
authority-transfer patch is also implemented locally but not yet verified live.

## Verification Amendment — 2026-07-04 (Join)

`join-group` was subsequently verified live.

Verified flows:

- first join
- leave and rejoin
- kick and rejoin

Verified outcome:

- canonical membership activation/deactivation remained single-row and correct
- blob `memberOrder`, `memberships`, and `leftMemberNames` tracked the expected
  active/removal states
- open-season seeded member status remained correct for the joined member

That means `join-group` should no longer be treated as pending migration QA.

Next lifecycle boundary after that verification:

- `kick-member`
- then `leave-bloc`

See:

- `docs/handover-2026-07-04-removal-lifecycle-audit.md`

As of the latest local branch state, the narrow `kick-member`
authority-transfer patch is also implemented locally but not yet verified live.

## Verification Amendment — 2026-07-05 (Kick)

`kick-member` was subsequently verified live.

Verified flow:

- kick
- rejoin after kick

Verified outcome:

- canonical deactivation populated `bloc_members.left_at`
- canonical membership stayed single-row through kick and rejoin
- canonical active membership count toggled correctly from `0` back to `1`
- blob `memberOrder`, `memberships`, and `leftMemberNames` tracked the expected
  removed and restored states

That means `kick-member` should no longer be treated as pending migration QA.

Next lifecycle boundary after that verification:

- `leave-bloc`

See:

- `docs/handover-2026-07-04-removal-lifecycle-audit.md`

## Verification Amendment — 2026-07-05 (Leave)

`leave-bloc` was subsequently verified live for surviving-bloc cases.

Verified flows:

- non-admin leave on a surviving bloc
- admin leave with canonical admin transfer on a surviving bloc

Verified outcome:

- canonical member deactivation populated `bloc_members.left_at`
- canonical admin transfer updated `blocs.admin_profile_id`
- blob `adminUserId`, `adminName`, `memberOrder`, `memberships`, and
  `leftMemberNames` tracked the expected post-leave state

That means the surviving-bloc `leave-bloc` slice should no longer be treated as
pending migration QA.

What still remains outside that verified slice:

- last-member deletion
- verification of the newly implemented canonical bloc delete path

## Bottom Line

Current `main` is more advanced than the older July 3 docs suggest.

Accurate current-state summary:

1. GET reads are still blob-first plus canonical overlays.
2. The old read-composer env flag is no longer part of current app code.
3. `pendingOtps` is no longer in the interactive app path.
4. `defaultGroupId`, `inviteCode`, and `createdAt` are no longer the important
   read-shell blockers.
5. The real remaining blob shell problem is `leftMemberNames` plus the broader
   blob-first mutation boundary.
6. `create-group` is now verified as canonical-first.
7. `join-group` is now verified as canonical-first.
8. `kick-member` is now verified as canonical-first in its narrow removal
   slice.
9. `leave-bloc` is now verified as canonical-first for surviving-bloc cases.
10. Last-member deletion is now the remaining unverified lifecycle boundary in
    this area, but the canonical-first delete path is now implemented locally.
