# Handover — Data Migration Restart Plan 2026-07-01

This note resumes the relational migration track after the product/UI and
settlement-confirmation release pass was intentionally closed.

Read alongside:
- [docs/handover-2026-07-01-product-pass-closed.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-07-01-product-pass-closed.md)
- [docs/handover-2026-06-28-migration-pause-checkpoint.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-06-28-migration-pause-checkpoint.md)
- [docs/handover-2026-06-26-blob-retirement-audit.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-06-26-blob-retirement-audit.md)
- [docs/relational-cutover-plan.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/relational-cutover-plan.md)

## Current Branch Context

Branch still in use:
- `codex/membership-safety-fixes`

Recent already-landed work on this branch includes:
- migration overlays and canonical-first write slices from late June
- settlement confirmations and release polish from July 1

That means the migration restart should be treated as continuing work on the
same branch context, not as a fresh architectural exploration.

## What Is Already Green

The following slices were previously verified and should be treated as done
unless a regression is found:

- canonical closed-season month-history overlay
- canonical member sort order reconstruction
- canonical group sort order reconstruction
- canonical `lastMonth` sourcing for covered groups
- canonical invite resolution on read
- canonical `join-group` invite lookup path
- canonical `createdAt` read authority from `blocs.created_at`
- canonical-first `season-proration-choice`
- canonical-first `sitout-request`
- canonical-first `sitout-review`
- canonical-first `update-settings`
- `create-group` / `join-group` seeding of open-season
  `season_member_status` rows for zero-log members

## What Still Blocks Blob Retirement

The remaining blockers are not more micro-overlays. They are the blob-owned
shell/runtime surfaces and the lifecycle flows that still depend on them.

### Blob-owned top-level state

- none remaining after the July 1 cleanup slices

Completed in this pass:
- `defaultGroupId` is now derived from `groupOrder`
- `meta.revision` and `meta.updatedAt` are compatibility values reconstructed
  from `lift_log_state` row metadata
- legacy blob `pendingOtps` runtime state was removed from the interactive app
  path

### Blob-owned per-group shell state

- `leftMemberNames`

Note:
- `inviteCode` read authority is already effectively handled canonically
- `createdAt` read authority is already effectively handled canonically

### Blob-first mutation hydration

Still true in code:
- `fetchWritableCurrentState()` returns blob state directly

This is the main reason canonical cannot yet be called the mutation base.

### Lifecycle / identity-sensitive flows still blob-coupled

- `kick-member`
- `leave-bloc`
- `delete-account`
- `repair-display-name`

## Code Reality At Restart

Current `api/lift-log.js` still shows:

- read composition still filters against `leftMemberNames`
- join/leave/kick/delete-account paths still mutate `leftMemberNames`
- mutation hydration still starts with `fetchWritableCurrentState()`

So the migration is now in the authority-transfer phase, not the parity phase.

## Recommended Restart Order

The restart order should stay conservative:

1. re-verify zero-log active-member coverage
2. remove or replace the easy blob shell fields
3. design replacements for the true blockers
4. only then move mutation hydration off the blob
5. only after that touch the lifecycle cleanup flows

More concretely:

### Phase 1 — Quick sanity pass

Reconfirm before code changes:
- open-season `season_member_status` coverage for zero-log active members
- leave-and-rejoin still restores active canonical membership correctly
- no regression from the settlement pass touched migration read paths

This should be a short re-baseline, not a new audit.

### Phase 2 — Cheap blob deletions / replacements

Do first because they reduce blob surface with low blast radius:

- `defaultGroupId`
  - replace with deterministic first-visible-group behavior or client
    preference semantics
- `meta.revision`
  - delete as semantic state
- `meta.updatedAt`
  - delete as semantic state

These should not require canonical schema work.

### Phase 3 — Lifecycle redesign for `leftMemberNames`

Do before mutation-hydration transfer:

- define canonical rules for leave
- define canonical rules for kick/remove
- define canonical rules for rejoin after leave
- define canonical rules for rejoin after kick
- stop using string-list residue as lifecycle authority

Goal:
- remove `leftMemberNames` entirely instead of migrating it 1:1

### Phase 4 — Mutation hydration transfer

Only after Phases 2–3:

- introduce canonical-backed writable state composition
- ensure blob shadow writes cannot erase canonical-only state
- switch targeted mutations away from blob-first hydration

This is the true authority handoff.

### Phase 5 — Final blob retirement pass

Only after writable-state transfer is stable:

- audit remaining blob readers
- delete compatibility fallbacks deliberately
- retire blob persistence from the interactive path

## What Not To Do Next

Do not do these first:

- another random medium-risk mutation slice
- workout-log authority transfer before lifecycle cleanup
- display-name de-keying before lifecycle rules are explicit

Those paths increase blast radius without removing the real blockers.

## Immediate Next Task

The best next working task is:

1. run a short migration sanity verification pass
2. design and implement the `defaultGroupId` / `meta.*` cleanup slice

That is the smallest honest restart step that advances retirement without
dragging us straight into OTP or lifecycle complexity on the first turn back.
