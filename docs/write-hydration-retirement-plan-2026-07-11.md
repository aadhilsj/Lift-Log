# Write Hydration Retirement Plan - 2026-07-11

This note records the post-promotion audit of the remaining
`fetchWritableCurrentState()` dependency on
`codex/create-group-canonical-first`.

## Baseline

Runtime state after preview validation:

- high-traffic product writes are mostly canonical-first at the authority
  boundary
- mutations still hydrate a blob-shaped writable state before computing their
  in-memory result
- that blob-shaped state is still the compatibility contract for name-keyed
  current logs, historical month snapshots, lifecycle residue, and blob mirror
  persistence

Important git/deploy note:

- production may have been promoted from this branch's Vercel preview
- `origin/main` did not contain this branch at the time of this audit
- do not assume `main` is the source branch for follow-up migration work until
  the git branch is explicitly merged or rebased

## Current POST Buckets

### No writable hydration

- `auth-send-otp`
- `auth-verify-otp`

Both return `410`.

### Readable-state only

- `invite-context`
- `settlement-claim-paid`
- `settlement-confirm-paid`
- `settlement-dispute-paid`

These already authenticate / resolve against composed readable state and do
not hydrate the writable blob base first.

### Writable blob by design

- `auth-sync`

Reason:

- repairs legacy profile identity by email
- repairs missing auth-linked membership rows in legacy groups
- persists those repairs back to blob
- now best-effort mirrors repaired profiles and active bloc-member rows to
  canonical, but readable state can still hide exactly the blob gaps this path
  exists to repair

Do not move this to readable-state-first without a dedicated replacement for
legacy identity repair.

### Canonical-first writes that still need blob-shaped computation

- `create-group`
- `upsert-profile`
- `join-group`
- `kick-member`
- `leave-bloc`
- `delete-account`
- `multi-log`
- `add-log`
- `update-settings`
- `season-proration-choice`
- `sitout-request`
- `sitout-review`
- `reaction`
- `flag`
- `flag-response`
- `flag-review`
- `delete-log`
- legacy admin `settlement`

These generally follow:

1. hydrate writable blob-shaped state
2. compute the exact post-action compatibility payload
3. write the canonical authority row(s) first
4. persist blob as a compatibility mirror

The remaining problem is not canonical write ordering. It is the writable
input shape.

### Quarantined compatibility tools

- `repair-display-name`

This now writes canonical display-name snapshots and refreshes the active
canonical bloc-member row before blob persist, but it is still a one-bloc
compatibility repair tool. It should not become the normal rename model before
display names are de-keyed.

## Why Direct Writable Cutover Is Unsafe

`fetchReadableCurrentState()` is intentionally a user-facing composed response,
not a lossless mutation base. Using it as the write input today can still erase
or distort:

- blob-only legacy groups / compatibility shells
- legacy profile-less member names
- name-keyed current log containers
- historical month snapshots that are still preserved from blob when canonical
  coverage is incomplete
- `leftMemberNames` residue needed to suppress legacy departed names
- narrow `joinedMonthByName` residue for historical participation boundaries
- blob `meta` revision / updatedAt bookkeeping used by blob persistence

This matches the reverted client-normalizer regression: historical-looking
cleanup can affect auth/bootstrap and membership resolution.

## Remaining Residue By Field

### `leftMemberNames`

Current role:

- legacy suppression list for profile-less or historical names
- no longer grows for auth-linked kick / leave / delete-account paths
- still required by `normalizeGroup()` for blob-compatible active shell shaping

Retirement condition:

- current active membership must be derived from canonical active
  `bloc_members` for every normal path
- profile-less legacy names must have an explicit retirement or migration rule
- historical member rendering must be independent of today's active shell

### `joinedMonthByName`

Current role:

- mostly canonical-derived or pruned on read for auth-linked members
- still survives narrowly for legacy historical participation boundaries

Retirement condition:

- canonical `joined_at`, `joined_month_key`, and closed-season
  `joined_for_month` must fully cover historical target/count behavior
- write paths must stop needing the display-name keyed map as mutation input

### blob `meta`

Current role:

- blob snapshot revision and updatedAt bookkeeping
- not product state

Retirement condition:

- blob mirror persistence is no longer used for normal mutations
- frontend no longer treats blob revision semantics as meaningful app state

### `memberOrder` / `activeMemberOrder`

Current role:

- `activeMemberOrder` is the current-member surface
- `memberOrder` still carries compatibility and historical shell behavior in
  several write helpers

Retirement condition:

- current-member writes must resolve by auth user id / canonical membership
- historical render order must be stored as month-local snapshots, not today's
  group shell

## Recommended Next Slices

### Slice 1 - writable dependency assertions

Add explicit comments or helper boundaries around actions that must remain
blob-hydrated. Goal is to prevent accidental readable-state substitution in
auth/profile, lifecycle, rename, and history code.

This is low-risk and mostly documentation / code-structure.

### Slice 2 - canonical-safe hydration candidates

Audit only narrow actions whose mutation input is already row-shaped:

- `season-proration-choice`
- `sitout-request`
- `sitout-review`
- `update-settings`

For each, prove whether the action can use a group reconstructed from
canonical current state without needing blob-only history or lifecycle fields.
Do not change all four together.

Status:

- `update-settings`, `season-proration-choice`, `sitout-request`, and
  `sitout-review` now have opt-in, non-persisting parity probes controlled by
  `WRITE_HYDRATION_PARITY_ACTIONS=update-settings,season-proration-choice,sitout-request,sitout-review`
- when enabled, the server computes the existing writable-blob result and a
  readable/composed-state result, compares timestamp-redacted
  blob-serializable outputs, and logs a compact mismatch summary
- the probe is off by default and does not change the mutation response,
  canonical writes, or blob persistence

Additional current-open-workout probe coverage:

- `reaction`, `flag`, `flag-response`, `flag-review`, and `delete-log` now use
  the same opt-in, non-persisting parity probe
- `decisionAt` is redacted with the existing generated timestamp fields so flag
  review probes compare mutation semantics instead of wall-clock differences
- this is still probe-only coverage; mutation input continues to come from the
  writable blob state until parity has been observed with the env flag enabled

### Slice 3 - id-first membership resolution

Start replacing display-name membership checks in current-only write paths with
auth-user-id membership checks where the payload already carries an auth user.

Candidate checks:

- workout logging membership validation
- reaction / flag actor validation
- admin checks where `adminUserId` exists

Do not rewrite historical keys in the same slice.

Status:

- started on this branch for current-only workout actions
- `multi-log`, `add-log`, `delete-log`, and `flag` now route actor membership
  checks through a server helper that prefers `memberships[authUserId]` and
  falls back to the active member shell for compatibility
- `reaction` now uses the same current-member guard before mutating a workout's
  reaction list
- `sitout-request` now uses the same current-member guard before creating a
  sit-out request
- admin checks for settings, first-month target choice, sit-out review, flag
  review, projection rebuild, and kick now route through a shared server helper
  that prefers `adminUserId` and keeps the legacy `adminName` fallback
- sit-out review approver checks now route through a shared server helper that
  keeps the existing admin / target approver / deputy fallback behavior
- flag self-checks and flag-response ownership now route through a shared server
  helper that verifies the display-name keyed log owner against
  `memberships[actorUserId]` first, then falls back to the actor display name
- historical key rewrites and closed-month snapshots were not changed

### Slice 4 - `leftMemberNames` shrink audit

Verify every remaining write that can mutate `leftMemberNames`:

- `join-group`
- `kick-member`
- `leave-bloc`
- `delete-account`
- `repair-display-name`

Goal:

- auth-linked paths should remove or preserve only necessary legacy residue
- profile-less legacy paths can keep the compatibility list until a separate
  migration decision exists

Status:

- `join-group` removes stale suppression when a member rejoins
- `kick-member` now uses `updateLegacyLeftMemberNamesForDeparture(...)`: it
  removes stale suppression for auth-linked members and appends only for
  profile-less legacy display-name removals
- `leave-bloc` and `delete-account` remove stale suppression after auth-linked
  membership removal
- `repair-display-name` renames matching suppression entries with the rest of
  the legacy name-keyed state
- no lifecycle behavior changed in this audit slice

### Slice 5 - canonical writable state constructor

Only after the smaller audits:

- build a server-only canonical writable-state constructor for a single narrow
  action family
- compare it against blob-shaped writable state in logs or a non-persisting
  parity mode
- promote it to mutation input only after parity is proven

## Non-Goals

Do not do these as opportunistic cleanup:

- edit `src/lib/appState.js` client normalization
- delete `leftMemberNames`
- delete `joinedMonthByName`
- make `repair-display-name` a normal rename flow
- use `fetchReadableCurrentState()` directly as the base for general POST
  mutations
- invent canonical historical rows from current settings during settlement
  updates

## Practical Next Step

The safe current-write guardrail batch is now complete. See:

- [docs/backend-residue-closeout-audit-2026-07-11.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/backend-residue-closeout-audit-2026-07-11.md)

The next code change should either be:

1. a non-persisting parity harness for one narrow action family, or
2. a deliberately preview-tested runtime slice from the closeout audit.

Do not continue with broad authority transfer or client normalization cleanup.
