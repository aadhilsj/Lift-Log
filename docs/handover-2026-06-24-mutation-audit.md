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

These were not the best first move, but `update-settings` became a reasonable
third bounded candidate after proration and sit-out flows were validated.

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

## Second Canonical-First Slice

Implemented after `season-proration-choice`:
- `sitout-request`
- `sitout-review`

Current shape:

1. compute the exact sit-out request / review result in memory against the
   blob-compatible JS state
2. ensure the open season exists canonically via `syncSeasonToCanonical(...)`
3. upsert the canonical sit-out request row from that exact in-memory payload
4. for approved outcomes, upsert canonical excused state from the same payload
5. persist blob immediately after as a mirror / compatibility shadow

Why this was the right second move:
- same bounded pattern as proration
- already read canonically on the GET path through current excused / sit-out
  overlays
- meaningful side-effect coverage without touching workout log authority yet

## Candidate To Avoid Early

Avoid as first canonical-first slices:
- workout log create/delete
- membership joins/leaves/kicks
- profile rename / display-name repair
- delete-account

These are too entangled with blob compatibility and identity edge cases to be a
good first authority transfer.

## Current Canonical-First Write Coverage

Now validated on branch:
- `season-proration-choice`
- `sitout-request`
- `sitout-review`
- `update-settings` for the season-facing snapshot path

These are the first real write-authority transfers across the mutation
boundary, while keeping the current blob response contract intact.

## Third Canonical-First Slice

Implemented after sit-out validation:
- `update-settings`

Current shape:

1. compute the exact post-settings bloc state in memory
2. sync canonical `blocs` from that exact payload
3. sync the canonical open-season snapshot from the same payload
4. persist blob immediately after as the mirror / compatibility shadow

Why this is acceptable now:
- already dual-written canonically before, so behavior is well understood
- bounded compared with logs or membership lifecycle writes
- directly affects a season-facing canonical read surface already used on GET

## Important Follow-Up Fix

Discovered and fixed on June 24, 2026:
- newly created blocs and newly joined members could have a canonical
  `bloc_members` row without a matching open-season
  `season_member_status` row when they had not logged yet

Observed production symptom:
- current-month leaderboard membership could still render via blob-compatible
  fallback
- but canonical open-season coverage was incomplete for zero-log new members

Root cause:
- `create-group` synced:
  - canonical `blocs`
  - canonical open `seasons`
  - canonical `bloc_members`
  - but not an initial open-season `season_member_status` row
- `join-group` had the same gap

Fix landed:
- `fix(write): seed open season member status on create and join`

Behavior after fix:
- `create-group` now seeds a zero-count, non-excused,
  `joined_for_month=true` canonical `season_member_status` row for the creator
- `join-group` now seeds the same row for the joining member

Production cleanup:
- a one-time backfill was applied for the already-missing live open-season rows
- after the backfill, the only remaining active/status mismatch was test-bloc
  residue (`test-bloc-ka2ovu`), not a real-user production issue

## Suggested Next Implementation Slice

Best next candidate after these:
- or pause write-authority transfers and finish the remaining read-shell cleanup
- or evaluate whether any remaining bounded write paths are worth moving before
  a larger blob-retirement design pass

Do not jump next to workout log authority or membership lifecycle writes unless
we intentionally accept a much larger blast radius.
