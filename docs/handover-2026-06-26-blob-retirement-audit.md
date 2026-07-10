# Handover — Blob Retirement Audit 2026-06-26

This note records the June 26, 2026 audit of what still depends on the blob in
[`api/lift-log.js`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js)
after the latest verified canonical-first write slices.

Read alongside:
- [docs/handover-2026-06-24-read-composition-audit.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-06-24-read-composition-audit.md)
- [docs/handover-2026-06-24-mutation-audit.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-06-24-mutation-audit.md)
- [docs/relational-cutover-plan.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/relational-cutover-plan.md)

## Current Verified Canonical-First Write Slices

Validated on branch and/or preview:
- `season-proration-choice`
- `sitout-request`
- `sitout-review`
- `update-settings`

Also fixed and verified:
- `create-group` / `join-group` now seed open-season
  `season_member_status` rows for zero-log members
- missing live rows were backfilled; only test-bloc residue remained afterward

## What Is Still Blob-Only

### Top-level state

Still blob-backed in normalized app state:
- `defaultGroupId`
- `meta.revision`
- `meta.updatedAt`

Why this matters:
- these fields are not yet reconstructed from canonical sources
- they are still read and written directly through the blob engine

### Per-group shell fields

Still blob-backed:
- `inviteCode`
- `createdAt`
- `leftMemberNames`

Why this matters:
- they influence join flows, lifecycle edge cases, or UI shape
- there is no current canonical-first replacement path for them in the app

### Compatibility scaffolding still supplied by the blob base

Because `fetchReadableCurrentState()` still starts from
`fetchCurrentStateFromSupabase()`:
- empty groups can still survive even if canonical has no useful coverage
- zero-log / non-excused members can still appear via blob-compatible group
  shell composition
- old edge-case names or leftovers can still survive if the blob still carries
  them

This is intentional for safety today, but it is exactly why blob retirement is
not yet a mechanical switch-flip.

## What Still Hydrates From Blob By Design

`fetchWritableCurrentState()` is still:

```js
return fetchCurrentStateFromSupabase();
```

That means every mutation still hydrates from blob first, even when parts of
the same mutation have become canonical-first on the authority boundary.

This is currently the main anti-retirement fact in the codebase.

Why it still exists:
- using canonical read overlays as mutation hydration input would risk writing
  an incomplete state back into the blob
- several blob-only shell/state fields still have no canonical source
- several remaining writes still depend on blob-only structures

## Remaining Blob-Dependent Behaviors

### Must stay blob-backed for now

- `auth-send-otp`
- `auth-verify-otp`
- `auth-sync`

Reason:
- the interactive app no longer uses legacy blob OTP challenge storage;
  `auth-send-otp` and `auth-verify-otp` now return `410`
- `auth-sync` still depends on writable blob hydration for compatibility
  scaffolding around auth/session/profile state
- broad blob retirement still needs an auth/profile writable-base plan, but is
  no longer blocked on `pendingOtps` as live runtime auth state

### Strong blob coupling still present

- `join-group`
  - resolves by blob `inviteCode`
- `kick-member`
  - updates blob `leftMemberNames`
- `leave-bloc`
  - updates blob `leftMemberNames`
  - has special admin-transfer and delete-empty-group behavior
- `delete-account`
  - tears through blob memberships/groups/profile scaffolding
- `repair-display-name`
  - rewrites many blob name-keyed structures

Reason:
- these are not narrow row-level mutations
- they depend on blob compatibility shape and legacy name-keyed history

### Likely easier than the lifecycle flows, but still not retirement-ready

- `create-group`
  - still originates group shell fields such as `inviteCode` and `createdAt`
- `upsert-profile`
  - still propagates through blob profile + membership/name scaffolding

## Retirement Blocking List

Blob retirement is still blocked by these categories:

1. Top-level shell ownership
   - `defaultGroupId`
   - `meta`

2. Group shell ownership
   - `inviteCode`
   - `createdAt`
   - `leftMemberNames`

3. Blob-first mutation hydration
   - `fetchWritableCurrentState()` is still blob-only

4. Identity/lifecycle edge cases
   - invite resolution
   - member leave/kick residue
   - profile/name repair propagation
   - account deletion

## Field-By-Field Verdicts

This is the concrete June 26 design decision pass for the remaining blob-owned
fields.

### `defaultGroupId`

Verdict: `replace`, not migrate 1:1.

Reason:
- it is a client preference, not durable business state
- it does not need relational authority to preserve product correctness
- canonical group ordering already gives a deterministic fallback

Recommended replacement:
- short term: keep blob-backed while blob still exists
- retirement path: store as client/local preference or derive from first visible
  group in canonical order

### `pendingOtps`

Verdict: no longer a live interactive-app blocker.

Reason:
- the interactive client now uses Supabase Auth directly
- `auth-send-otp` and `auth-verify-otp` now return `410`
- no current normalized app-state field carries `pendingOtps`
- the remaining auth residue is `auth-sync` still hydrating writable blob state
  around auth/profile scaffolding

Recommended replacement:
- do not revive blob OTP challenge storage
- if any future server-side auth challenge state is needed, model it explicitly
  outside the app-state blob
- treat the real remaining work as moving auth/profile writable-state hydration
  off blob, not replacing `pendingOtps`

### `meta.revision`

Verdict: `delete` as semantic app state.

Reason:
- it exists to version blob snapshots, not to model the product
- canonical persistence already has its own row timestamps and write ordering
- keeping it would force fake canonical bookkeeping for low-value metadata

Recommended replacement:
- none
- if the frontend still needs a cache-bust token later, derive it from fetch
  time or response headers instead of migrating blob revision semantics

### `meta.updatedAt`

Verdict: `delete` as semantic app state.

Reason:
- same class as `meta.revision`
- useful only as blob snapshot metadata
- not worth recreating as canonical product state

Recommended replacement:
- none

### `inviteCode`

Verdict: `migrate` to canonical authority.

Reason:
- this is real product state
- canonical `blocs` already carries invite code data
- current blocker is app code still resolving joins from blob group shells

Recommended replacement:
- change invite resolution and invite-context reads to canonical `blocs`
- then stop trusting blob `group.inviteCode`

### `createdAt`

Verdict: `migrate` to canonical authority.

Reason:
- this is real group metadata already represented canonically
- canonical `blocs.created_at` already exists
- UI usage is read-only and should not require blob ownership

Recommended replacement:
- read from canonical bloc creation timestamps in the composed state
- stop preserving blob-only `group.createdAt` as a source of truth

### `leftMemberNames`

Verdict: `must redesign`, not blindly migrate.

Reason:
- this is not just metadata; it is legacy lifecycle residue used to suppress
  previously left/kicked members from active composition
- canonical membership history should model this through `bloc_members.left_at`
  and explicit lifecycle behavior instead
- copying this string list into canonical state would preserve a workaround, not
  fix the model

Recommended replacement:
- define canonical lifecycle rules for:
  - voluntary leave
  - kick/remove
  - rejoin after leave
  - rejoin after kick
- once those rules are encoded, remove `leftMemberNames` entirely

## What Could Potentially Be Cut Over Later

These are not immediate next steps, but they are plausible future cleanup
candidates:

Verdict summary:
- `migrate`: `inviteCode`, `createdAt`
- `replace/delete`: `defaultGroupId`, `meta.revision`, `meta.updatedAt`
- `must redesign`: `leftMemberNames`
- `compatibility residue, not OTP blocker`: `auth-sync`

## Recommended Next Phase

Do not pick another random medium-risk write slice next.

Recommended sequence:

1. Freeze further broad write-authority expansion.
2. Use the verdicts above as the retirement decision baseline.
3. Design a dedicated blob-retirement plan around:
   - auth temp state
   - invite resolution
   - group lifecycle residue
   - profile/name-repair behavior
4. Only after that, decide whether mutation hydration itself can begin moving
   off blob.

## Recommended Next Slice

This older recommendation is now complete:

- `invite-context` reads canonical bloc invite data first
- `join-group` resolves invite targets canonically before entering the existing
  blob-compatible join flow
- `invite-context` no longer hydrates the writable blob base first

The more relevant remaining residue now is:

1. auth/profile writable-base cleanup around `auth-sync`
2. blob-only compatibility structures such as `leftMemberNames`,
   `joinedMonthByName`, and blob `meta`
3. the eventual endgame transfer away from blob-backed writable hydration

## Updated Progress Estimate

Judgment-call estimate as of June 26, 2026:
- read-path migration for user-visible data: `91%`
- write-path migration for bounded product writes: `89%`
- current authoritative canonical overlays / ordering / month-history: `96%`
- historical parity and live data repair confidence: `78%`
- blob-retirement readiness: `48%`
- overall migration program: `81%`

Interpretation:
- the migration is well past the “can canonical model this product?” stage
- it is now in the “how do we safely remove blob scaffolding?” stage
- the remaining work is more architectural than incremental
