# Handover — Mutation Audit 2026-06-24

This note records the June 24, 2026 mutation-path audit for
[`api/lift-log.js`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js).

The goal of this pass was to identify the safest candidate for the first
canonical-first write-authority transfer.

## Current Write Model

Today every mutating request still follows the same high-level pattern:

1. hydrate state from blob via `fetchWritableCurrentState()`
2. apply the mutation to blob-shaped JS state
3. persist blob via `persistState(...)`
4. fire best-effort canonical sync RPCs after blob persistence succeeds

That means canonical is still:
- dual-write
- read-overlay authority for many GET surfaces
- but not yet the mutation source of truth

## Mutation Inventory

### Blob-first and should stay that way for now

- `auth-send-otp`
- `auth-verify-otp`
- `auth-sync`

Reason:
- tightly coupled to `pendingOtps`, sessions, and current blob auth scaffolding
- low value as early canonical-first candidates

### Read-only / non-cutover candidates

- `invite-context`

Reason:
- does not mutate state
- irrelevant to write-authority transfer

### Broad / high-risk mutation families

- `multi-log`
- `reaction`
- `flag`
- `flag-response`
- `flag-review`
- `delete-log`
- `join-group`
- `kick-member`
- `leave-bloc`
- `delete-account`
- `repair-display-name`
- `settlement`

Reason:
- touch multiple state surfaces or identity-sensitive structures
- depend heavily on display-name-keyed blob compatibility
- or have destructive / cascading effects

These are poor first canonical-first candidates.

### Medium-risk but still broad

- `create-group`
- `upsert-profile`
- `update-settings`

Reason:
- `create-group` touches bloc shell state, ordering, open season creation, and
  membership setup in one flow
- `upsert-profile` still requires blob propagation across many name-keyed
  structures
- `update-settings` touches both bloc settings and open season snapshot logic

These may become later canonical-first candidates, but they are not the best
first move.

### Narrower / better candidates

- `season-proration-choice`
- `sitout-request`
- `sitout-review`

Reason:
- map to relatively narrow canonical tables already read authoritatively:
  - `season_overrides`
  - `sit_out_requests`
  - open-season excused state
- limited blast radius compared with logs/memberships/group lifecycle

## Best First Canonical-First Candidate

Recommended candidate:
- `season-proration-choice`

Why this is the best first write-authority transfer:

1. Narrow canonical surface
   - primarily `season_overrides`
   - already paired with `upsert_ante_core_season_override`

2. Read side already trusts canonical
   - `season_overrides` is already overlaid from canonical on GET

3. Small blast radius
   - one season, one override row, one admin choice
   - much safer than log or membership flows

4. Rollback is straightforward
   - blob can remain as shadow/fallback during the first transfer
   - parity is easy to inspect

## Second-Tier Candidate

If the first canonical-first slice succeeds, the next likely candidate is:
- `sitout-request` / `sitout-review`

Why second-tier instead of first:
- still fairly bounded
- but more fields are involved than `season-proration-choice`
- includes status transitions and excused side-effects

## Candidate To Avoid Early

Avoid as first canonical-first slices:
- workout log create/delete
- membership joins/leaves/kicks
- profile rename / display-name repair
- delete-account

These are too entangled with blob compatibility and identity edge cases to be a
good first authority transfer.

## Suggested Next Implementation Slice

Design and implement:
- canonical-first `season-proration-choice`

Conservative rollout shape:

1. resolve and write canonical override first
2. mirror the same result back into blob state in the same request
3. keep blob fallback and response shape unchanged
4. add explicit verification / rollback notes

This preserves the current UI contract while transferring a very small piece of
write authority to canonical.
