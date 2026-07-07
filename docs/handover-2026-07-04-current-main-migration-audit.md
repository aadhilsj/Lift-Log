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

Important nuance:

- some of these slices reached the codebase earlier as canonical-backed or
  dual-write behavior before they were made truly authoritative
- `update-settings` specifically now uses throwing canonical writes before blob
  persistence, making it a real authority-transfer slice rather than just a
  best-effort mirror

## Verification Amendment — 2026-07-05 (Settings)

`update-settings` was verified live after the authority-tightening change.

Verified against bloc:

- `legacy_group_key = test101-us8qvg`

Verified change:

- currency changed to `EUR`

Verified outcome:

- canonical `ante_core.blocs.currency = 'EUR'`
- canonical open `ante_core.seasons.currency = 'EUR'`
- blob `group.settings.currency = 'EUR'`

That means `update-settings` should now be treated as a fully verified
canonical-first slice, not merely a canonical-backed one.

## Verification Amendment — 2026-07-05 (Sit-Out Family)

The sit-out family had already been validated earlier in the bounded
write-cutover sequence and should be treated as verified on current `main`,
not as a merely theoretical or unproven slice.

Treat as verified:

- `sitout-request`
- `sitout-review`

This matches the status already recorded in:

- `docs/handover-2026-06-24-mutation-audit.md`

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

## Verification Amendment — 2026-07-05 (Leave Last Member)

`leave-bloc` was subsequently verified live for last-member deletion too.

Verified outcome:

- canonical bloc row was deleted
- canonical dependent membership and season rows were deleted
- blob group row was deleted
- blob `groupOrder` no longer contained the bloc

That means the currently-bounded `leave-bloc` migration slice should now be
treated as fully verified.

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
9. `leave-bloc` is now verified as canonical-first for the full currently
   bounded lifecycle batch.
10. The migration is now past the core member lifecycle authority-transfer
    boundary.

## Implementation Amendment — 2026-07-05 (Workout Logging)

`multi-log` is now implemented locally as a bounded canonical-first slice.

Current local shape:

1. compute the exact post-log blob-compatible state in memory
2. identify the exact newly created logs from that in-memory result
3. ensure canonical bloc and open-season rows exist for each target bloc
4. upsert the exact new logs canonically from that payload
5. persist blob afterward as the compatibility mirror

This should still be treated as pending live verification.

## Implementation Amendment — 2026-07-05 (Reactions)

`reaction` is now implemented locally as a bounded canonical-first slice.

Current local shape:

1. compute the exact post-toggle blob-compatible state in memory
2. ensure the parent canonical workout log exists from that payload
3. apply the exact reaction direction canonically
4. persist blob afterward as the compatibility mirror

This should still be treated as pending live verification.

## Verification Amendment — 2026-07-05 (Workout Logging)

`multi-log` was verified live.

Verified against blocs:

- `test101-us8qvg`
- `stavanger-4ever-7162hj`

Verified payload:

- owner display name: `Aadhil`
- workout date: `2026-07-05`
- workout type: `Gym`
- `verified_via = 'photo'`

Verified outcome:

- canonical `ante_core.workout_logs` row existed in both target blocs
- canonical owner identity resolved correctly to
  `768de245-5b17-4292-b91c-804daaa3b217`
- canonical open seasons already existed and the write succeeded against them
- blob `logs['Aadhil']` contained the same newly created log in both blocs

That means `multi-log` should now be treated as a verified canonical-first
slice.

## Verification Amendment — 2026-07-05 (Reactions)

`reaction` was verified live on the source-bloc path.

Verified against bloc:

- `test101-us8qvg`

Verified reaction:

- workout owner: `Aadhil`
- emoji: `🔥`
- reactor display name: `Aadhil`

Verified outcome:

- canonical `ante_core.workout_reactions` row existed for the workout log
- canonical reactor identity resolved correctly to
  `768de245-5b17-4292-b91c-804daaa3b217`
- blob reaction state on the same log matched `{"🔥":["Aadhil"]}`

That means the bounded `reaction` slice should now be treated as verified on
the source-bloc path used by the app.

## Implementation Amendment — 2026-07-05 (Flag Family)

The workout-log moderation family is now implemented locally as a bounded
canonical-first slice:

- `flag`
- `flag-response`
- `flag-review`

Current local shape:

1. compute the exact post-moderation blob-compatible log state in memory
2. ensure the canonical open season exists
3. upsert the exact moderated workout-log payload canonically
4. persist blob afterward as the compatibility mirror

This should still be treated as pending live verification.

## Verification Amendment — 2026-07-07 (Flag Family)

The workout-log moderation family is now fully verified live.

Verified against bloc:

- `test101-us8qvg`

Verified log:

- `id = 1783346485002`
- owner display name: `Aadhil`

Verified actions:

- `flag`
- `flag-response`
- `flag-review`

Verified outcome:

- canonical `ante_core.workout_logs` reflected `flag_status = 'flagged'`
-  with `flagged_by = 'Test'`
- canonical `ante_core.workout_logs` then reflected
  `flag_response = 'not sus'` while still keeping
  `flag_status = 'flagged'` and no decision yet
- canonical `ante_core.workout_logs` then reflected
  `flag_status = 'approved'` with `decision_by = 'Aadhil'`
  and `decision_at` populated
- blob mirror for `logs['Aadhil']` matched the same moderation state at both
  intermediate and reviewed stages

So the flag family should now be treated as:

- `flag`: verified
- `flag-response`: verified
- `flag-review`: verified

## Implementation Amendment — 2026-07-05 (Delete Log)

`delete-log` is now implemented locally as a bounded canonical-first slice.

Current local shape:

1. compute the exact post-delete blob-compatible state in memory
2. delete the canonical workout log first
3. persist blob afterward as the compatibility mirror

This should still be treated as pending live verification.

## Verification Amendment — 2026-07-06 (Delete Log)

`delete-log` was subsequently verified live.

Verified against bloc:

- `test101-us8qvg`

Verified log:

- `id = 1783270506896`
- owner display name: `Aadhil`

Verified outcome:

- canonical `ante_core.workout_logs` row was deleted
- canonical `ante_core.workout_reactions` rows for that workout were absent
- blob `logs['Aadhil']` no longer contained the deleted log id

That means `delete-log` should now be treated as a verified
canonical-first slice.

## Implementation Amendment — 2026-07-06 (Delete Account)

`delete-account` is now implemented locally as a bounded canonical-first slice.

Current local shape:

1. compute the exact post-delete blob-compatible state in memory
2. delete canonical blocs first for any sole-member blocs
3. transfer canonical admin first for any surviving admin-owned blocs
4. delete the canonical profile so dependent memberships cascade away
5. persist blob afterward as the compatibility mirror

## Verification Amendment — 2026-07-07 (Delete Account)

`delete-account` was subsequently verified live.

Verified deleted account:

- auth user id: `85278d6f-2457-4153-9d06-27d96a4aec32`
- display name: `Test`

Verified outcome:

- canonical `ante_core.profiles` row was deleted
- canonical `ante_core.bloc_members` rows for that account were absent
- canonical solo bloc `test123-pmiura` was deleted
- blob `profiles[userId]` was absent
- blob surviving-bloc membership entry was absent
- blob `leftMemberNames` for `test101-us8qvg` included `Test`
- blob `test123-pmiura` group entry was absent

That means `delete-account` should now be treated as a verified
canonical-first slice.

## Settlement Amendment — 2026-07-06

Two live settlement correctness fixes landed after the original July 4 audit:

1. historical settled state is now preserved during month-history rebuilds
   instead of being recomputed back to `outstanding`
2. settlement reminder pair amounts now render the per-pair amount owed,
   not the receiver's total aggregate payout for the month

These are not new write-authority transfers by themselves, but they are part
of the current production migration reality and should be considered part of
the live app baseline.

## Current Remaining Write Gaps

On current local branch state, the meaningful remaining write-authority gaps
are now:

- `repair-display-name`: still blob-first with best-effort canonical member
  sync afterward
- legacy `settlement` month-history mutation: still blob-first with
  best-effort canonical settlement mirror

## Repair-Display-Name Audit Amendment — 2026-07-07

`repair-display-name` should not currently be treated as the next bounded
canonical-first migration slice.

Why:

1. it is an admin-only repair action behind `ADMIN_PIN`, not a normal product
   write path
2. it rewrites many blob-only name-keyed structures directly:
   - `memberOrder`
   - `logs`
   - `excused`
   - `joinedMonthByName`
   - `leftMemberNames`
   - `sitOutRequests`
   - historical month-history snapshots
3. its canonical side today is only a best-effort
   `syncBlocMemberToCanonical(...)` for the active membership row afterward
4. canonical does not currently own the broader historical rename semantics
   that this repair is mutating in blob compatibility state

Recommended stance:

- keep `repair-display-name` as a blob-compatibility repair tool for now
- do not spend a bounded authority-transfer slice on it before the broader
  display-name de-keying / lifecycle redesign
- revisit it only after active-vs-historical identity is separated cleanly

So the next practical work should no longer be described as
`create-group`/`join-group`/`kick-member`/`leave-bloc`/`multi-log`/`reaction`
work. Those slices are already done. The remaining scope is now much narrower
 and mostly concentrated in:

- `repair-display-name`
- broader display-name / `leftMemberNames` lifecycle cleanup
- eventual mutation hydration/read-shell retirement away from blob
