# Join-Group Audit — 2026-07-04

This note records the current-main audit of `join-group` after
`create-group` was verified as canonical-first.

It is intended to answer one question precisely:

- what would still need to be true for `join-group` to become the next safe
  canonical-first write slice

## Current Handler Shape

Current `join-group` flow in `api/lift-log.js`:

1. hydrate writable state from blob
2. resolve invite code canonically when `groupId` is absent
3. compute the joined state in memory through `applyJoinGroup(...)`
4. persist blob
5. best-effort canonical sync:
   - `upsert_ante_core_bloc_member`
   - `upsert_ante_core_season`
   - seeded open-season `season_member_status`

So the current branch has already done the lower-risk part:

- canonical invite resolution
- canonical member reactivation support on the database side
- open-season zero-log seeding

What it has **not** done:

- move the authority boundary itself away from blob

## What Is Already Structurally Good

### Invite resolution

This is already canonical-first.

`join-group` now:

- resolves `payload.inviteCode` through canonical bloc data
- injects `legacy_group_key` into the existing join flow

This means canonical already owns:

- invite code authority
- invite-to-bloc resolution

### Canonical rejoin model

Canonical membership already models rejoin correctly.

`upsert_ante_core_bloc_member`:

- upserts on `(bloc_id, profile_id)`
- clears `left_at` on conflict
- refreshes display name snapshot and role

So on the database side:

- leave/kick history is preserved
- active membership is restored on rejoin
- duplicate active rows are avoided

### Open-season member status seeding

Current `join-group` already seeds:

- an open-season `season_member_status` row
- `workout_count = 0`
- `excused = false`
- `joined_for_month = true`

That closed the earlier zero-log gap.

## What Still Makes Join-Group Riskier Than Create-Group

`create-group` only creates new state.

`join-group` can also be:

- first join into an existing bloc
- rejoin after leave
- rejoin after kick
- re-link into old historical name surfaces

Those cases all interact with blob compatibility and historical name inference.

### `leftMemberNames`

`applyJoinGroup(...)` explicitly removes the joining display name from
`leftMemberNames`.

That is required today because `normalizeGroup()` still suppresses ex-members
through that field to prevent historical names from being re-inferred into
active membership.

So `join-group` is not just “add a member row”.
It is also:

- compatibility suppression repair
- historical-vs-active membership reconciliation

### `joinedMonthByName`

`applyJoinGroup(...)` decides whether to write a fresh `joinedMonthByName`
entry based on:

- whether the display name is new to `memberOrder`
- whether that display name already has participation before the current month

That means the join path still contains historical-identity policy, not just
current active membership creation.

### Display-name identity

Blob join still keys active additions by the profile display name.

So the path still depends on:

- `memberOrder`
- `joinedMonthByName`
- `leftMemberNames`
- `membership.displayName`

This is a narrower blast radius than leave/kick/delete-account, but it is not
as clean as `create-group`.

## Code-Level Verdict

`join-group` is now a plausible next bounded write slice, but only with a
careful scope.

It should **not** be framed as:

- full lifecycle write cutover
- `leftMemberNames` retirement
- active-vs-historical membership redesign

It should be framed as:

- canonical-first membership activation for the existing join path
- while preserving the current blob compatibility repair behavior

## Safe Patch Shape

If implemented next, the patch should follow the same narrow pattern used for
`create-group`.

Recommended shape:

1. compute the exact joined blob-compatible group in memory
2. write canonical profile if needed for the joining user
3. write canonical bloc member from that exact joined payload
4. ensure canonical open season exists
5. seed canonical open-season member status from that exact joined payload
6. persist blob only after those canonical writes succeed

Important constraint:

- do not change the blob join semantics themselves in this slice

That means:

- keep the current `leftMemberNames` removal
- keep the current `joinedMonthByName` rule
- keep the current active-member-count enforcement

The slice should move the authority boundary, not redesign join semantics.

## Required Verification Cases

If `join-group` becomes the next patch, these are the minimum live checks:

1. first join into an existing bloc
2. leave and rejoin the same bloc
3. kick and rejoin the same bloc
4. zero-log rejoin still seeds open-season member status
5. no duplicate active canonical membership row appears
6. blob and canonical both show the member active exactly once

## Not In Scope For The Join-Group Slice

Do not combine these with the join cutover:

- `leave-bloc`
- `kick-member`
- `delete-account`
- `repair-display-name`
- `leftMemberNames` deletion
- redefinition of `memberOrder`

Those are follow-on lifecycle or identity slices.

## Recommendation

After verified `create-group`, `join-group` is now the best candidate for the
next bounded audit-and-implementation cycle.

But the implementation should stay strict:

- transfer authority only
- preserve current blob compatibility semantics
- verify rejoin paths explicitly before proceeding to leave/kick/delete-account

## Implementation Amendment — 2026-07-04

The narrow authority-transfer patch was subsequently implemented locally.

Current local `join-group` shape now:

1. resolve invite code canonically when needed
2. compute the exact joined blob-compatible state in memory
3. write canonical profile, bloc, bloc-member, open-season, and seeded
   open-season member-status from that exact joined payload
4. persist blob only after those canonical writes succeed

What did **not** change in this implementation:

- `applyJoinGroup(...)` blob lifecycle semantics
- `leftMemberNames` removal behavior
- `joinedMonthByName` rules
- current active-member-count enforcement

So this is intentionally an authority-transfer slice, not a lifecycle redesign.

What still remains before calling this verified:

- live first-join verification
- live leave/rejoin verification
- live kick/rejoin verification
- confirmation that blob and canonical both show exactly one active joined
  member row after rejoin

## Verification Result — 2026-07-04

Status: `PASS`

Verified live against bloc:

- `legacy_group_key = test123-pmiura`

Verified test account:

- `auth_user_id = 85278d6f-2457-4153-9d06-27d96a4aec32`
- `display_name = 'Test'`

### Verified flows

1. first join
2. leave
3. rejoin after leave
4. kick
5. rejoin after kick

### Confirmed canonical behavior

For the test account in `ante_core.bloc_members`:

- first join created one active membership row
- leave populated `left_at`
- rejoin cleared `left_at`
- kick populated `left_at` again
- kick-rejoin cleared `left_at` again
- total canonical membership rows stayed at exactly `1`
- active canonical membership rows were always either `0` or `1`, never more

Confirmed seeded open-season state:

- `ante_core.season_member_status` row existed for the joined member
- `joined_for_month = true`
- `workout_count = 0`
- `excused = false`

### Confirmed blob compatibility behavior

After join / rejoin:

- blob `memberOrder` included `Test`
- blob `memberships` included the test account
- blob `leftMemberNames` did not include `Test`

After leave / kick:

- blob `memberOrder` removed `Test`
- blob `memberships` removed the test account
- blob `leftMemberNames` included `Test`

## Verified Conclusion

The narrow `join-group` canonical-first slice is now verified.

This should no longer be treated as pending migration QA.
