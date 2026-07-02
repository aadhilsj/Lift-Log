# Handover — Left Member Lifecycle Audit 2026-07-01

This note records the first focused audit of the remaining `leftMemberNames`
dependency after the July 1 metadata and OTP cleanup slices.

Read alongside:
- [docs/handover-2026-07-01-data-migration-restart-plan.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-07-01-data-migration-restart-plan.md)
- [docs/handover-2026-06-26-blob-retirement-audit.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-06-26-blob-retirement-audit.md)
- [docs/relational-cutover-plan.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/relational-cutover-plan.md)

## Executive Summary

`leftMemberNames` is no longer a generic “member state” field.

It serves one narrow but important purpose:
- it suppresses former members from being re-inferred into active
  `memberOrder` from historical participation surfaces such as:
  - current logs
  - `excused`
  - `monthHistory[*].counts`
  - `monthHistory[*].logsByUser`
  - `monthHistory[*].settlements`

Without this suppression, a user who left or was kicked but still has old logs
or month-history data can silently reappear as an active member when
`normalizeGroup()` rebuilds `memberOrder`.

So this is not just decorative residue. It is the blob’s current workaround for
the gap between:
- active membership identity
- historical participation identity

## Current Blob Behavior

### Read path

`normalizeGroup()` currently:

1. builds `leftMemberNames` as a set from `group.leftMemberNames`
2. infers candidate members from:
   - `memberOrder`
   - `logs`
   - `excused`
   - historical month snapshots
3. filters those inferred names through `leftMemberNames`
4. normalizes the surviving names into the active `memberOrder`

That means `leftMemberNames` is actively used to prevent historical names from
being promoted back into active membership.

### Write paths that mutate it

Current blob mutations:

- `join-group`
  - removes the joining display name from `leftMemberNames`
- `kick-member`
  - removes the target from `memberships`
  - removes the target from `memberOrder`
  - appends the display name to `leftMemberNames`
- `leave-bloc`
  - removes the leaver from `memberships`
  - removes the leaver from `memberOrder`
  - appends the display name to `leftMemberNames`
- `delete-account`
  - removes the user from memberships and group state
  - does **not** currently append them to `leftMemberNames`
  - instead relies on direct removal of the active membership + profile
- `repair-display-name`
  - does not currently repair `leftMemberNames`

## Canonical Reality Already Available

Canonical membership already has the right structural primitive:

- `ante_core.bloc_members.left_at`

And the current canonical write/read behavior is already aligned:

- `upsert_ante_core_bloc_member`
  - clears `left_at` on rejoin
- `remove_ante_core_bloc_member`
  - sets `left_at = now()`
- `read_ante_core_bloc_members`
  - returns only active rows where `left_at is null`

So on the canonical side:
- active membership is already modeled directly
- rejoin semantics are already modeled directly
- soft-deleted history is already preserved

This means the remaining problem is not database capability.
It is blob composition compatibility.

## Important Behavioral Gap

Canonical active membership is keyed by auth-linked `bloc_members` rows.
Blob active membership is still reconstructed partly from name-keyed historical
surfaces.

That creates the current need for `leftMemberNames`.

If we removed `leftMemberNames` today without replacing its effect:
- kicked members with old logs could reappear
- leavers with month-history entries could reappear
- deleted users with surviving historical names could reappear

## Lifecycle Verdicts

### Leave

Desired canonical rule:
- active membership ends
- historical participation remains visible in history
- member must not reappear in current active `memberOrder`
- rejoin should restore active membership cleanly

Verdict:
- canonical already models this correctly with `left_at`
- blob still needs a replacement suppression rule before `leftMemberNames` can go

### Kick

Desired canonical rule:
- same suppression behavior as leave for current active views
- historical participation remains
- rejoin is allowed only through the normal join path

Verdict:
- same structural answer as leave
- no separate schema needed

### Rejoin

Desired canonical rule:
- if an old membership exists, clear `left_at`
- restore active membership
- preserve historical participation
- member appears again exactly once in active membership

Verdict:
- canonical already does this cleanly through `upsert_ante_core_bloc_member`
- blob still depends on removing the display name from `leftMemberNames`

### Delete Account

Desired canonical rule:
- remove active identity
- remove active memberships
- preserve historical participation unless product policy explicitly says
  otherwise
- never let the deleted user reappear in active current membership

Verdict:
- current blob path is weaker here than leave/kick because it does not maintain
  an explicit suppression list entry
- however, profile deletion plus membership deletion has been good enough so far
  only because the read path still begins from blob state

This path should be reconsidered together with the eventual `leftMemberNames`
replacement.

### Repair Display Name

Desired canonical rule:
- rename active identity surfaces safely
- historical references stay coherent
- no stale suppression key survives under the old name

Verdict:
- current repair path updates many name-keyed surfaces
- it does not explicitly reconcile `leftMemberNames`
- this is a secondary correctness gap and should be included in the same
  lifecycle cleanup program

## Best Next Implementation Strategy

Do **not** try to delete `leftMemberNames` in the same slice as:
- leave
- kick
- delete-account
- repair-display-name

That is too much blast radius.

Best next order:

1. introduce a read-time active-member reconstruction rule that trusts
   active canonical/blob memberships over historical inference
2. preserve historical names in history-only surfaces
3. once current active membership no longer needs the suppression list,
   stop mutating `leftMemberNames`
4. only then delete the field from normalization

## July 1 Amendment — First Cutover Attempt Result

The first attempted direct read cutover exposed a deeper coupling:

- `memberOrder` is not only the current active-member list
- it is also indirectly used to preserve historical names inside normalized
  `monthHistory`

If `memberOrder` is switched to active-only too early:
- former members disappear from historical month snapshots
- history views become incomplete

So the true next architectural requirement is:
- separate current active-member authority from historical-participation
  authority

That means a safe first implementation slice is smaller:

- keep `leftMemberNames` in place for now
- harden the lifecycle mutations so suppression state stays internally
  consistent
- only then revisit the broader read-authority transfer

Prep fixes landed locally after this audit:
- `delete-account` now appends the removed member display name to
  `leftMemberNames` for surviving blocs
- `repair-display-name` now renames any matching `leftMemberNames` entry

## Safest First Slice

The safest first slice is:

- change `normalizeGroup()` / read composition so active membership is sourced
  from explicit active membership structures, not historical inference, when
  coverage is complete

Why this first:
- it reduces dependence on the suppression list without touching every
  lifecycle mutation at once
- it matches the canonical model already in place
- it can be preview-tested through leave/rejoin and kick/rejoin flows

## Not Recommended Next

Do not start with:

- `delete-account`
- `repair-display-name`
- blind field deletion

Those are downstream cleanup slices, not the first cutover move.

## Recommended Immediate Next Task

Next concrete migration slice:

1. audit whether active `memberships` coverage is complete enough to become the
   authoritative active-member source on read
2. if yes, implement guarded read authority transfer for active membership
3. test:
   - leave bloc
   - rejoin bloc
   - kick member
   - rejoin after kick

Only after that should we decide whether `leftMemberNames` can stop being
written at all.
