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
- `pendingOtps`
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
- depend on `pendingOtps`
- no canonical auth-OTP runtime path exists in the app yet

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
   - `pendingOtps`
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

## What Could Potentially Be Cut Over Later

These are not immediate next steps, but they are plausible future cleanup
candidates:

### Maybe reconstructable

- `defaultGroupId`
  - possibly from a user preference or a deterministic first-covered-group rule
- `createdAt`
  - likely from canonical `blocs.created_at`
- `inviteCode`
  - likely from canonical `blocs.invite_code`

### Maybe deletable instead of migrated

- `meta.revision`
- `meta.updatedAt`

If the frontend no longer truly needs them as app-level semantic state, they
may not deserve a canonical replacement at all.

### Probably needs an explicit new canonical design

- `pendingOtps`
- `leftMemberNames`

These are not just missing fields. They represent actual product/runtime
behavior that needs a clear replacement decision.

## Recommended Next Phase

Do not pick another random medium-risk write slice next.

Recommended sequence:

1. Freeze further broad write-authority expansion.
2. Decide which remaining blob-only fields are:
   - must migrate
   - can be deleted
   - can remain blob-backed temporarily
3. Design a dedicated blob-retirement plan around:
   - auth temp state
   - invite resolution
   - group lifecycle residue
   - profile/name-repair behavior
4. Only after that, decide whether mutation hydration itself can begin moving
   off blob.

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
