# Removal Lifecycle Audit — 2026-07-04

This note records the next migration boundary after `create-group` and
`join-group` were both verified as canonical-first.

The remaining lifecycle authority problem is now concentrated in the removal
side:

- `kick-member`
- `leave-bloc`

These are best audited together because they both:

- deactivate active membership
- update `leftMemberNames`
- remove the member from blob active composition
- rely on canonical `bloc_members.left_at`

But they diverge in two important ways:

- `leave-bloc` may transfer admin
- `leave-bloc` may delete the bloc entirely when the last member leaves

## Current Code Shape

### `kick-member`

Current handler shape:

1. hydrate writable blob state
2. compute the kicked result in memory
3. persist blob
4. best-effort canonical removal via `remove_ante_core_bloc_member(...)`

Blob semantics today:

- remove target membership
- remove target display name from `memberOrder`
- append target display name to `leftMemberNames`

Canonical semantics today:

- set `bloc_members.left_at = now()`

### `leave-bloc`

Current handler shape:

1. hydrate writable blob state
2. compute the leave result in memory
3. persist blob
4. best-effort canonical removal via `remove_ante_core_bloc_member(...)`
5. if the leaver was admin and the bloc survives:
   - best-effort canonical admin transfer via `update_ante_core_bloc_admin(...)`

Blob semantics today:

- remove leaver membership
- remove leaver display name from `memberOrder`
- append leaver display name to `leftMemberNames`
- if leaver was admin:
  - choose the earliest joined remaining member as the new admin
- if no members remain:
  - delete the bloc from blob state entirely

Canonical semantics today:

- set `bloc_members.left_at = now()`
- optionally update `blocs.admin_profile_id`
- no explicit canonical bloc deletion path is part of this slice yet

## Why This Batch Is Riskier Than Join-Group

`join-group` reactivates one member into an existing bloc.

Removal flows can:

- deactivate one member
- change who the admin is
- remove the bloc entirely
- affect later rejoin eligibility and suppression semantics

So the removal batch is not just “the inverse of join”.

## What Is Already Structurally Good

Canonical already gives us the core membership primitive:

- `remove_ante_core_bloc_member(...)`
  - soft-deletes active membership through `left_at`

That means the database already models:

- leave history
- kick history
- later rejoin through the existing join path

The join verification also proved that:

- a later rejoin correctly reactivates the same canonical membership row
- no duplicate canonical membership rows are created

So the unresolved risk is now mostly around authoritative ordering and
side-effects, not basic membership reactivation.

## Main Risks By Flow

### `kick-member`

Primary risks:

- blob persists removal even if canonical deactivation fails
- blob and canonical diverge on whether the member is active
- removal happens for the blob but canonical still shows an active membership

Secondary risks:

- no active-member duplicate risk if removal succeeds
- `leftMemberNames` behavior is already understood and was indirectly validated
  by the later rejoin pass

### `leave-bloc`

Primary risks:

- same blob-first/canonical-second divergence risk as kick
- canonical admin transfer can fail after blob already promoted a new admin
- the last-member-delete path can remove the bloc from blob while canonical
  still retains rows

This makes `leave-bloc` the more dangerous of the two.

## Recommended Sequencing

Do not cut over `kick-member` and `leave-bloc` in one patch.

Recommended order:

1. `kick-member`
2. `leave-bloc` for non-admin members
3. `leave-bloc` for admin transfer
4. only later, last-member bloc deletion

That order isolates the risky side-effects.

## Safe Patch Shape For `kick-member`

Recommended narrow slice:

1. compute the exact post-kick blob-compatible state in memory
2. write canonical member removal first from that exact target
3. persist blob only after canonical removal succeeds

Important non-goals:

- do not redesign `leftMemberNames`
- do not change current blob suppression behavior
- do not mix in leave/admin-transfer logic

## Safe Patch Shape For `leave-bloc`

Recommended follow-on slice, not same patch:

1. compute the exact post-leave blob-compatible state in memory
2. canonical member removal first
3. if bloc survives and admin changes, canonical admin transfer next
4. blob persist only after those canonical writes succeed

Still defer:

- broader redesign beyond a narrow canonical-first hard delete

## Implementation Amendment — 2026-07-05 (`leave-bloc`)

The next narrow authority-transfer patch for `leave-bloc` is now implemented
locally for surviving-bloc cases only.

Current local `leave-bloc` shape now:

1. compute the exact post-leave blob-compatible state in memory
2. if the bloc survives:
   - remove the canonical active membership first
   - if admin changes, update canonical bloc admin next
   - persist blob only after those canonical writes succeed
3. if the leaver was the last member:
   - delete the canonical bloc first
   - rely on ON DELETE CASCADE for dependent ante_core rows
   - persist blob deletion only after canonical delete succeeds

What did **not** change in this implementation:

- `applyLeaveBloc(...)` blob lifecycle semantics
- blob `leftMemberNames` behavior
- broader lifecycle redesign around deleted blocs

So this is still a bounded migration slice, not a full leave lifecycle redesign.

## Recommended Next Implementation Target

Best next bounded patch:

- `kick-member`

Why:

- narrower than `leave-bloc`
- no admin transfer
- no last-member bloc deletion
- removal semantics are already partially validated by the successful rejoin
  verification after kick

## Implementation Amendment — 2026-07-04

The narrow authority-transfer patch for `kick-member` was subsequently
implemented locally.

Current local `kick-member` shape now:

1. compute the exact post-kick blob-compatible state in memory
2. remove the canonical active membership first for auth-linked members
3. persist blob only after the canonical removal succeeds

What did **not** change in this implementation:

- `applyKickMember(...)` blob lifecycle semantics
- blob `leftMemberNames` behavior
- support for name-only legacy members without canonical profile rows

So this remains an authority-transfer slice, not a lifecycle redesign.

## Required Verification For `kick-member`

When that patch lands, minimum checks:

1. kick a normal member
2. verify canonical `left_at` is populated
3. verify blob member removal and `leftMemberNames` update
4. rejoin that member through the already-verified join path
5. verify canonical membership row reactivates without duplication

## Verification Result — 2026-07-05 (`kick-member`)

Status: `PASS`

Verified live against bloc:

- `legacy_group_key = test123-pmiura`

Verified test account:

- `auth_user_id = 85278d6f-2457-4153-9d06-27d96a4aec32`
- `display_name = 'Test'`

### Verified kick outcome

After `kick-member`:

- canonical `ante_core.bloc_members` kept exactly one membership row
- `bloc_members.left_at` was populated for the kicked member
- canonical active membership count became `0`
- blob `memberOrder` removed `Test`
- blob `leftMemberNames` included `Test`
- blob `memberships` removed the kicked member

### Verified rejoin-after-kick outcome

After rejoining through the already-verified `join-group` path:

- canonical membership row count still remained exactly `1`
- canonical `left_at` returned to `null`
- canonical active membership count returned to `1`
- blob `memberOrder` included `Test` again
- blob `leftMemberNames` no longer included `Test`
- blob `memberships` included the test account again

## Verified Conclusion

The narrow `kick-member` canonical-first slice is now verified.

That means the next remaining bounded lifecycle target is still:

- `leave-bloc`

But only in its still-unverified form, with last-member deletion now
implemented locally and awaiting verification.

## Verification Amendment — 2026-07-05 (`leave-bloc`, non-admin)

Status: `PARTIAL PASS`

Verified live against bloc:

- `legacy_group_key = test123-pmiura`

Verified test account:

- `auth_user_id = 85278d6f-2457-4153-9d06-27d96a4aec32`
- `display_name = 'Test'`

### Verified non-admin leave outcome

After `leave-bloc` by a non-admin member:

- canonical `ante_core.bloc_members` kept exactly one membership row
- `bloc_members.left_at` was populated for the leaving member
- canonical active membership count became `0`
- blob `memberOrder` removed `Test`
- blob `leftMemberNames` included `Test`
- blob `memberships` removed the leaving member

### Remaining verification still required

- last-member deletion verification

## Verification Amendment — 2026-07-05 (`leave-bloc`, admin transfer)

Status: `PASS`

Verified live against bloc:

- `legacy_group_key = test123-pmiura`

Verified admin-leave outcome on a surviving bloc:

- canonical `ante_core.blocs.admin_profile_id` transferred to the remaining
  member
- canonical admin auth user became
  `85278d6f-2457-4153-9d06-27d96a4aec32`
- leaving admin membership received `left_at`
- remaining member stayed active with `left_at = null`
- blob `adminUserId` and `adminName` transferred to `Test`
- blob `memberOrder` became `["Test"]`
- blob `leftMemberNames` included `Aadhil`
- blob `memberships` retained only the new admin member

## Verified Conclusion

The surviving-bloc `leave-bloc` slice is now verified.

What still remains outside this verified slice:

- last-member deletion verification

## Bottom Line

The program has now verified:

- `create-group`
- `join-group`
- `kick-member`

The next migration boundary is no longer member activation.

It is authoritative member removal, starting with:

- `leave-bloc`
