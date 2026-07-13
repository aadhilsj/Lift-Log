# Backend Migration Closeout Plan - 2026-07-12

This plan replaces the slice-by-slice handoff loop for the remaining backend
migration work. The objective is to finish the blob retirement path in larger
batches, with fewer user smoke-test interruptions.

## Goal

Reach an App Store-ready backend posture:

- normal app writes no longer depend on blob hydration as their source of truth
- canonical tables are complete enough for the current product model
- blob is either a temporary mirror or fully outside normal runtime authority
- auth/bootstrap remains stable
- production and preview flags are clear and documented
- a new chat can resume from current docs without reconstructing two months of
  context

## Current Architecture Reality

The backend is hybrid:

- `fetchWritableCurrentState()` still reads the blob at the writable mutation
  boundary for validation, compatibility shell construction, and mirror
  persistence
- `fetchReadableCurrentState()` reads blob then overlays canonical data for the
  user-facing GET response
- canonical writable constructors now compute the post-action state for normal
  product mutations
- blob persistence mirrors the post-action compatibility state

The current blocker is blob mirror retirement, not normal write authority.

## Why The Old Approach Was Slow

The previous working mode optimized for safety:

- change one narrow slice
- deploy preview
- ask user to smoke test
- repeat

That was appropriate while touching auth/bootstrap and historical membership
logic, but it is now the main bottleneck. The new mode is batch-based:

- docs and audit first
- implement a coherent backend batch
- verify locally and through logs
- ask for user smoke only at major boundaries

## Hard Lessons Already Learned

### Do Not Use Readable State As Writable State

`fetchReadableCurrentState()` is a projection for UI reads. It can be narrower
than the full writable blob. On preview, write-hydration probes showed a case
with:

- writable blob groups: `7`
- readable/composed groups: `1`

Even after narrowing probe reporting to the target group, `reaction` probes
still produced target-bloc mismatches. The next step is not to use the readable
projection for mutations.

### Do Not Touch Client Bootstrap Casually

The reverted commit `ea251b3` tried to align client history pruning with server
history pruning. It made returning users appear as fresh users with empty blocs.

Avoid opportunistic edits to:

- `src/lib/appState.js`
- client bootstrap normalization
- `normalizeAppState`
- profile/session resolution

### Auth Sync Is A Repair Path

`auth-sync` still repairs:

- legacy profile IDs by email
- missing auth-linked membership rows in legacy groups
- blob identity state

Readable/composed state can hide exactly the gaps `auth-sync` must repair.
Keep `auth-sync` writable-blob-first until a replacement legacy identity repair
path exists.

## Remaining Workstreams

### Workstream A - Canonical Coverage Audit

Purpose: prove canonical tables cover all runtime-required data before relying
on them for writes.

Initial result on 2026-07-12:

- service-role read RPCs are now installed and callable
- `read_ante_core_current_logs()` SQL source was fixed so ordering happens
  inside `jsonb_agg(...)`
- coverage failed because canonical data was incomplete, not because the read
  RPCs were missing
- initial report: `migration-output/coverage/canonical-coverage-2026-07-12T17-26-07-363Z.json`
- visible canonical blocs: `1` of `7`
- visible current canonical workout logs: `0` while blob has current logs

Fresh local backfill artifacts were regenerated and applied:

- `migration-output/canonical-run-2026-07-12-current/`
- generated from blob revision `858`
- generated SQL: `migration-output/canonical-run-2026-07-12-current/canonical-import.sql`
- one non-blocking warning: a reaction by `isindug` has no resolvable profile
- apply method: temporary service-role-only executor RPC, dropped immediately
  after import and verified absent
- latest report: `migration-output/coverage/canonical-coverage-2026-07-12T17-42-19-811Z.json`
- visible canonical blocs: `7` of `7`
- failures: `0`

Do not apply older generated imports unless they are regenerated from a fresh
snapshot. Coverage is clean as of the report above.

Audit:

- `ante_core.profiles`
- `ante_core.blocs`
- `ante_core.bloc_members`
- open `ante_core.seasons`
- current `ante_core.workout_logs`
- `ante_core.workout_reactions`
- `ante_core.season_overrides`
- `ante_core.sit_out_requests`
- `ante_core.season_member_status`
- settlement confirmation rows

Specific known risk:

- preview probes imply canonical/readable coverage may include fewer groups than
  blob state

Exit criteria:

- every blob group that should exist in the app has a canonical bloc row
- every active auth-linked member has an active canonical `bloc_members` row
- every open group has an open canonical season row
- current logs/reactions for tested groups are present canonically

### Workstream B - Canonical Writable-State Constructor

Purpose: replace blob hydration with a canonical-built blob-shaped state for
safe action families.

Current status:

- `buildCanonicalWritableStateForGroup(groupId)` now exists in `api/lift-log.js`
- write-hydration parity probes compare blob write output against this
  constructor, not against `fetchReadableCurrentState()`
- admin-only report on preview has returned `ok: true`, `checked: 43`,
  `failed: 0`
- the first low-risk write-input cutover batch now uses this constructor for
  `update-settings`, `season-proration-choice`, and `sitout-request`

This constructor is not `fetchReadableCurrentState()`.

It should build a mutation-grade group/state object with:

- `groups[groupId]`
- `groupOrder` only where needed
- normalized settings
- `memberOrder` / `activeMemberOrder`
- `memberships`
- `joinedMonthByName` only where still needed for compatibility
- current `logs`
- current `excused`
- current `sitOutRequests`
- `seasonOverrides`
- profiles needed for actor/member resolution

Initial scope should be target-group reconstruction for current/open actions,
not a full whole-app state rebuild.

Candidate helper shape:

```js
async function buildCanonicalWritableStateForGroup(groupId, authUserId) {
  // fetch canonical bloc, members, open season, current logs,
  // current sit-outs/excused/overrides, and needed profiles
  // return a normalizeState-compatible object with one reconstructed group
}
```

Exit criteria:

- action helpers can run against the constructed state without falling back to
  full blob hydration for the target group
- parity logs compare target-group fields cleanly for the covered actions

### Workstream C - Low-Risk Write Cutover Batch

Completed first cutover:

- `update-settings`
- `season-proration-choice`
- `sitout-request`
- `reaction`
- `delete-log`
- `flag`
- `flag-response`
- `flag-review`
- `sitout-review`
- `add-log`
- `multi-log`
- `kick-member`
- `leave-bloc`
- `join-group`
- `upsert-profile`

These actions now authenticate/repair against the blob shell first, then compute
the mutation from a canonical writable constructor.
The earlier current/open cutovers still run shadow blob parity probes where
their handler has a runtime probe. The logging cutover keeps a shadow blob
calculation for compatibility validation, while the admin report carries the
explicit current/open parity signal.

Most group-local actions use
`buildCanonicalWritableStateForAuthenticatedMutation(...)`. `join-group` uses
the global canonical writable constructor because the target bloc can be
resolved by invite code and may not be one of the actor's current blocs before
the mutation. `upsert-profile` also uses the global constructor because a
display-name/profile update is account-wide across every bloc membership.

Preview/admin report status:

- `9ae307c`: settings/proration report clean
- `1a9b571`: sitout-request report clean
- `a5b2ea5`: reaction report clean
- `a676af4`: delete-log report clean
- `26a415d`: flag family report clean
- `70d05cb`: report-only synthetic sitout-review candidate coverage added
- `b637e22`: sitout-review report clean
- latest report shape for these cutovers after synthetic sitout-review
  coverage: `ok: true`, `checked: 47`, `skipped: 16`, `failed: 0`
- July 12 logging cutover used the narrower current/open report because full
  group parity is now blocked by historical shell drift:
  - `add-log`: `ok 7`, `failed 0`, `skipped 0`
  - `multi-log`: `ok 2`, `failed 0`, `skipped 5`
- July 13 lifecycle-exit cutover used the same current/open report boundary:
  - `kick-member`: `ok 5`, `failed 0`, `skipped 2`
  - `leave-bloc`: `ok 7`, `failed 0`, `skipped 0`

The admin report now includes a `summary` object keyed by action/scope and an
`excludedActions` list for paths intentionally outside group-scoped parity:

- `auth-sync`: blob-writable by design until legacy identity repair is replaced
- `upsert-profile`: canonical-first global identity rewrite, still
  blob-shaped for compatibility
- `delete-account`: verified canonical-first account deletion, now covered by
  a synthetic global/current-open report bucket and cut to canonical global
  writable input after clean local parity
- `repair-display-name`: quarantined admin-only compatibility repair
- legacy admin `settlement`: historical closed-month write covered by focused
  settlement-entry parity and cut to canonical group writable input

July 12 report/current-open expansion:

- the admin `write-hydration-parity-report` now includes report-only probes for
  `add-log`, `multi-log`, `kick-member`, and `leave-bloc`
- generated workout log ids/timestamps are redacted only for `add-log` and
  `multi-log` comparisons, because the probe simulates blob and canonical
  mutations separately
- the report now also emits `scope: "current-open"` comparisons for `add-log`
  and `multi-log`; the July 13 batch added the same scoped signal for
  `kick-member` and `leave-bloc`
- local current/open report status before the logging cutover:
  - `add-log`: `ok 7`, `failed 0`, `skipped 0`
  - `multi-log`: `ok 2`, `failed 0`, `skipped 5`
- `add-log` and `multi-log` now authenticate/repair against the blob shell
  first, then compute the logging mutation from the canonical writable
  constructor
- local current/open report status before the lifecycle-exit cutover:
  - `kick-member`: `ok 5`, `failed 0`, `skipped 2`
  - `leave-bloc`: `ok 7`, `failed 0`, `skipped 0`
- `kick-member` and `leave-bloc` now authenticate/repair against the blob shell
  first, then compute the departure/removal mutation from the canonical
  writable constructor
- full-group report status still fails on historical compatibility-shell drift,
  mostly `monthHistory`, and for some blocs historical `seasonOverrides`
- July 13 historical-shell probe:
  - added admin-only `historical-shell-reconciliation-report`
  - the report compares blob `monthHistory` / `seasonOverrides` against the
    canonical writable constructor without persisting anything
  - local status after preserving season override metadata: `ok: true`,
    `checked: 7`, `needsReconciliation: 0`
- canonical season override merges now preserve blob-side compatibility
  metadata (`chosenAt`, `chosenBy`, `chosenByUserId`) when the canonical row is
  otherwise authoritative
- preview parity warnings for current/open cutover actions now use the same
  current/open comparison scope as the report slices, so known historical-shell
  residue does not generate noisy warning logs for those actions
- do not use these current/open results as approval to move global identity
  paths; `auth-sync`, `upsert-profile`, `repair-display-name`, and legacy
  admin `settlement` still need separate handling

Exit criteria:

- canonical constructor parity is clean for the target group
- mutations write canonical first as today
- blob persistence is mirror-only after canonical mutation computation
- preview smoke: sign in, blocs load, react/unreact, setting change, one flag
  path if practical

Settlement reminder note:

- commit `aa016e9` fixed a frontend-only reminder visibility issue where Today
  settlement cards were hidden while the last-month results banner was active
- backend data was still present, and the production API had no runtime errors
- do not treat that incident as canonical settlement data loss

### Workstream D - High-Risk Compatibility Paths

Do not bundle these with Workstream C unless coverage is proven:

- `auth-sync`
- `upsert-profile`
- `repair-display-name`
- `join-group`
- legacy admin `settlement`

These paths still touch identity repair, lifecycle residue, historical/display-
name keyed state, or admin transfer behavior.

Current stance after the July 13 lifecycle-exit cutover:

- `kick-member` and `leave-bloc` have moved to canonical writable input for
  current/open mutation computation
- `delete-account` is a verified canonical-first global account deletion path,
  but remains excluded from group-scoped parity reports because it deletes
  profile/bloc membership state across the account
- `auth-sync`, `upsert-profile`, and `repair-display-name` remain explicitly
  high risk because readable/canonical state can hide the legacy blob gaps they
  still repair or rewrite
- July 13 join-group report-only coverage:
  - added `join-group:current-open` probes to `write-hydration-parity-report`
  - the probe samples safe cross-bloc profile candidates and compares the
    post-join current/open target bloc shell from blob input vs canonical-built
    global input
  - synthetic join `memberships[*].joinedAt` timestamps are redacted for this
    report only because the probe runs the two simulations separately
  - local status: `7` checked, `0` failed, `0` skipped
- July 13 follow-up cutover:
  - `join-group` now authenticates/repairs and validates against the blob shell
  - it then computes the post-join result from
    `buildCanonicalWritableStateForAuthenticatedGlobalMutation(...)`
  - canonical profile/bloc-member/open-season writes still run before blob
    mirror persistence

Exit criteria:

- dedicated fixtures or production-like parity for each lifecycle path
- canonical replacement rules for `leftMemberNames` and `joinedMonthByName`
- no dependency on client normalization changes

### Workstream E - Blob Mirror Retirement

Only after normal writes use canonical input/authority:

1. keep blob as mirror and monitor
2. remove frontend/runtime dependency on blob `meta`
3. stop writing blob for low-risk actions
4. delete or archive blob code paths only after production soak

Do not delete the blob mirror immediately after first cutover.

## App Store Backend Readiness Checklist

Backend items before App Store polish:

- auth sign-in and `auth-sync` stable
- no unauthenticated app-data endpoints
- preview-only flags cannot affect production
- canonical coverage report is clean or documented
- blob mirror is explicitly temporary or retired
- storage cleanup and image retention are confirmed
- Vercel runtime logs are clean after production smoke
- Supabase service-role usage remains server-only
- no debug/test admin features exposed without pins/guards
- current production deploy source is clear

## Batch Execution Rules

Use this decision boundary:

- documentation/audit/code structure: do without user smoke
- parity/log-only instrumentation: do without user smoke, then inspect logs when
  traffic exists
- constructor or write-input cutover: deploy one preview for the whole batch,
  then ask for one smoke pass
- auth/bootstrap/lifecycle behavior change: ask only after a coherent batch,
  not after every helper extraction

## Immediate Next Batch

Batch 1 started on 2026-07-13 with historical shell parity:

- extracted the closed-season `monthHistory` canonical composer into
  `buildCanonicalMonthHistoryForGroup(...)`
- kept the same completeness guard already used on reads: if canonical closed
  season coverage is narrower than the blob month, preserve the blob month
- wired the canonical writable constructor to fetch `ante_core` month history
  and compose the target group's historical shell before normalization
- left client bootstrap and `src/lib/appState.js` untouched
- expanded the admin report with `mismatchSummary`, a compact field-level count
  of remaining full-report mismatches

Local report after this slice:

- current/open scopes remain clean
- full report still fails: `45` failures
- remaining mismatch fields:
  - `monthHistory`: `45`
  - `seasonOverrides`: `29`

Interpretation:

- canonical closed-season history now exists in the writable constructor, but
  the blob writable shell is missing some canonical-only closed months, so full
  parity still cannot pass until historical shell backfill/reconciliation is
  explicit
- historical `seasonOverrides` still differ on metadata such as
  `chosenByUserId`

Next Batch 1 steps:

1. Run the admin write-hydration report on preview and inspect the new
   `summary` and `mismatchSummary`.
2. If full parity still fails, classify the remaining differences by field:
   historical `seasonOverrides`, `joinedMonthByName`, or true coverage gaps.
3. Keep `auth-sync`, `upsert-profile`, and `repair-display-name` out of this
   batch; they belong to the identity/display-name and auth-sync batches.

If a future constructor report reveals missing canonical rows, fix
coverage/import first.

## Batch 2 - Identity / Display Name Cleanup

Batch 2 started on 2026-07-13 with report-only profile rename coverage:

- added `buildCanonicalWritableStateForAllGroups(...)` for admin/report use
- added synthetic `upsert-profile:identity-rename` comparisons to
  `write-hydration-parity-report`
- capped identity rename probes at 12 candidates per report run to keep the
  admin endpoint bounded
- kept `upsert-profile` runtime behavior unchanged
- kept `repair-display-name` quarantined as an admin compatibility tool

Local report after adding the identity probe:

- `upsert-profile:identity-rename`: `12` checked, `12` failed, `1` skipped
- the failures mostly inherit Batch 1 historical shell drift:
  - `monthHistory`
- the identity probe now ignores `profiles.*.createdAt` because profile rename
  does not semantically change account creation time and the canonical profile
  RPC preserves its own row creation timestamp
- after the historical-shell probe landed, at-rest `monthHistory` /
  `seasonOverrides` reconciliation is clean; the remaining broad
  `upsert-profile:identity-rename` failures are still `monthHistory` after
  synthetic global rename mutation, so runtime `upsert-profile` remains out of
  scope for canonical writable input

Interpretation:

- `upsert-profile` current/open profile rename behavior is ready for canonical
  global writable input, but full historical rename parity still reports
  `monthHistory` residue
- identity/display-name cleanup still has deeper historical month semantics,
  but the normal account-wide current/open rename path no longer needs blob
  input for computation
- no auth/bootstrap or client normalization paths were touched

## Batch 3 - Join Group Coverage And Cutover

Batch 3 started on 2026-07-13 as report-only coverage:

- added `join-group:current-open` to the admin write-hydration parity report
- candidates are existing profiles that are not members of the sampled bloc and
  whose display name does not collide with the target bloc shell
- comparisons are capped at 12 candidates per report run
- only the current/open target bloc shell is compared; historical/global
  residue remains outside this report scope
- local result: `7` checked, `0` failed, `0` skipped

Runtime follow-up:

- added `buildCanonicalWritableStateForAuthenticatedGlobalMutation(...)`
- `join-group` still validates against the blob shell first
- the persisted post-join state is now computed from the canonical global
  writable constructor
- canonical profile/bloc/member/open-season writes remain authoritative and
  still complete before blob persistence

Interpretation:

- canonical-built global input can reproduce current/open join behavior for
  the sampled production-like candidates
- `join-group` moved in a dedicated cutover batch and should not be bundled
  with `auth-sync` or `upsert-profile`
- client bootstrap and app-state normalization were untouched

## Batch 4 - Historical Settlement Identity

Batch 4 started on 2026-07-13 after a join/rejoin smoke test showed prior-month
settlement reminders reappearing for a returning test account.

Finding:

- settlement confirmation rows and claim/confirm/dispute writes are auth-ID
  backed (`payerAuthUserId` / `receiverAuthUserId`)
- generated historical reminder pairs still started from display-name keyed
  month snapshots, then mapped the name to the current active membership
- that was correct for a true rejoin by the same auth account, but unsafe for a
  hypothetical different auth account using the same historical display name

Implemented:

- updated `read_ante_core_month_history()` to include each historical member's
  `auth_user_id` from `ante_core.profiles`
- applied that RPC update to the live Lift Log Supabase project and verified it
  returns historical members with auth IDs
- server-composed month history now carries `memberAuthUserIds`
- settlement reminder pairs carry `payerAuthUserId` / `receiverAuthUserId`
  derived from `memberAuthUserIds`
- reminder visibility and current-user matching now prefer auth IDs and only
  fall back to display names for true legacy rows without auth IDs
- parity reports ignore the `memberAuthUserIds` sidecar because it is
  read/identity metadata, not a historical count/settlement compatibility
  difference

Focused local regression:

- a current active member with the same display name but the wrong auth ID gets
  `0` generated settlement reminders
- the historical auth ID gets the expected reminder

## Batch 5 - Profile Rename Current/Open Cutover

Batch 5 started on 2026-07-13 after settling historical reminder identity.

Implemented:

- added `upsert-profile:current-open` report coverage alongside the existing
  full `upsert-profile:identity-rename` report
- the current/open report compares the profile row plus active/current bloc
  surfaces and intentionally excludes deeper historical month-history rename
  residue
- local report status: `12` checked, `0` failed, `1` skipped
- `upsert-profile` now validates against the blob shell first, then computes
  the post-profile result from
  `buildCanonicalWritableStateForAuthenticatedGlobalMutation(...)`
- canonical profile and active bloc-member display-name snapshots still sync
  before blob mirror persistence
- follow-up regression fix after preview smoke: normal profile rename now also
  runs the auth-ID scoped canonical display-name snapshot repair for each
  touched bloc before blob mirror persistence; this keeps closed-season
  `season_member_status`, workout-log, reaction, sit-out, and settlement
  confirmation display-name snapshots aligned with the account's current
  display name
- the blob mirror rename now also rewrites `monthHistory[*].memberAuthUserIds`
  and `settlementConfirmations[*].payerDisplayName/receiverDisplayName` when
  the row belongs to the renamed auth user
- rename collision validation is auth-aware for stale same-user display-name
  residue: it still rejects another member's display name, but it no longer
  blocks a rename just because the target name already appears in historical
  `memberAuthUserIds` for the same auth user
- follow-up from preview testing: auth-linked blocs use active memberships as
  the collision authority. Historical-only `memberOrder` names are not enough
  to block a profile rename, because they can be stale closed-season residue
  for the same account.

Remaining caveat:

- full `upsert-profile:identity-rename` parity still has `monthHistory`
  coverage gaps because historical snapshots are still display-name-shaped at
  the blob boundary; normal runtime rename now repairs canonical historical
  snapshots by auth ID, but this is not the same as fully de-keying all
  historical rendering from display names

## Batch 6 - Create Group Canonical Writable Input

Batch 6 started on 2026-07-13 after the profile rename regression was fixed and
verified on preview.

Implemented:

- `applyCreateGroup(...)` now accepts caller-supplied generated values for the
  new group id, invite code, and creation timestamp
- added `create-group:current-open` write-hydration report coverage using those
  stable generated values so blob-shell input and canonical global input can be
  compared without random id/invite noise
- local report status: `12` checked, `0` failed, `1` skipped
- runtime `create-group` now validates against the blob shell first, then
  computes the post-create result from
  `buildCanonicalWritableStateForAuthenticatedGlobalMutation(...)` using the
  same generated id/invite/timestamps
- canonical profile, bloc, open-season, bloc-member, and open-season member
  status writes still complete before blob mirror persistence

Verification:

- `node --check api/lift-log.js`
- Vite production build
- `historical-shell-reconciliation-report`: `7` checked, `0` needing
  reconciliation
- `write-hydration-parity-report`: broad failures remain confined to the known
  `monthHistory` bucket

## Batch 7 - Delete Account Global Cutover

Batch 7 started on 2026-07-13 after create-group was verified on preview.

Implemented:

- added `delete-account:global-account-current-open` synthetic report coverage
  to `write-hydration-parity-report`
- report candidates are capped at 12 profiles per run, matching the other
  global probes
- the probe compares profile removal, global `groupOrder`, and current/open
  surfaces for touched blocs after simulating `applyDeleteAccount(...)` against
  blob-shaped input and canonical-global input
- local report status before cutover: `12` checked, `0` failed, `1` skipped
- runtime `delete-account` now validates against the blob shell first, then
  computes the post-delete result from
  `buildCanonicalWritableStateForAuthenticatedGlobalMutation(...)`
- canonical bloc deletion, admin transfer, and profile deletion still complete
  before blob mirror persistence

Interpretation:

- account deletion was moved only after synthetic current/open parity was clean
  on production-like local data
- this remains a high-risk global path; do not bundle any future account/auth
  repair changes with `auth-sync` or `repair-display-name`

## Batch 8 - Legacy Settlement Admin Cutover

Batch 8 started on 2026-07-13 after the delete-account global cutover was
verified on preview.

Implemented:

- added `settlement:historical-admin-settlement-entry` report coverage to
  `write-hydration-parity-report`
- report candidates are capped at 12 historical settlement entries per run
- the probe intentionally compares the exact `{ status, settled }` settlement
  entry that the admin action mutates, instead of broad `monthHistory`, because
  broad historical month shell parity still has known non-behavioral drift
- runtime `settlement` now validates against the blob shell first, then
  computes the post-settlement result from
  `buildCanonicalWritableStateForAuthenticatedMutation(...)`
- canonical `season_member_status` settlement status is still written before
  blob mirror persistence

Interpretation:

- this removes the legacy admin settlement action from the remaining
  blob-input bucket without pretending broad closed-month rendering is fully
  de-keyed from display names
- future settlement-confirmation work should remain separate from this admin
  closed-month settlement toggle path

## Batch 9 - Blob Mirror Dependency Audit

Batch 9 started on 2026-07-13 after the legacy settlement admin cutover was
verified on preview.

Implemented:

- added admin-only `blob-mirror-dependency-report`
- the report records the current writable boundary, true blob-input authority
  actions, canonical-input mutation actions, readable/canonical-only actions,
  disabled legacy actions, and remaining mirror-dependent fields
- the report also returns live blob-shell counts for:
  - groups with `leftMemberNames`
  - groups with `joinedMonthByName`
  - groups with `memberOrder`
  - groups with `monthHistory`

Current authority map:

- true blob-input authorities:
  - `auth-sync`
  - `repair-display-name`
- canonical-input normal/admin mutations:
  - `settlement`
  - `create-group`
  - `upsert-profile`
  - `join-group`
  - `kick-member`
  - `leave-bloc`
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
  - `delete-account`
- readable/canonical-only paths:
  - `invite-context`
  - `settlement-claim-paid`
  - `settlement-confirm-paid`
  - `settlement-dispute-paid`

Remaining mirror dependencies:

- blob `revision` / `updated_at` powers `GET /api/lift-log?revision=1`
- client `meta.revision` / `meta.updatedAt` still exists in normalized app
  state and optimistic local updates
- `leftMemberNames` still suppresses legacy departed display names
- `joinedMonthByName` still protects legacy historical participation /
  proration boundaries
- `memberOrder` still carries historical ordering and profile-less legacy
  compatibility

Interpretation:

- normal product writes are no longer blocked on blob input authority
- do not stop writing the blob globally yet; the client still uses revision
  semantics and historical compatibility fields still need either canonical
  replacements or explicit retirement rules
- the next retirement batch should focus on canonical revision / mirror-write
  instrumentation before disabling blob persistence for any action family

## Batch 10 - Blob Mirror Retirement Readiness

Batch 10 started on 2026-07-13 after the Batch 9 blob mirror dependency audit
was smoke-tested on preview.

Implemented:

- added admin-only `blob-mirror-retirement-readiness-report`
- the report is intentionally read-only/report-only; no mutation behavior,
  client polling behavior, or blob persistence behavior changed
- the report records:
  - current blob revision / updated timestamp and mirror field counts
  - the fact that `GET /api/lift-log?revision=1` still reads
    `lift_log_state.revision`
  - that no independent canonical revision source exists yet
  - candidate action families for a future blob-write skip experiment
  - blocked action families that must not be used as the first skip
  - required steps before disabling blob writes for even one action family

Current conclusion:

- `canDisableBlobWritesNow: false`
- the first real blob-write skip must wait until the revision endpoint no
  longer depends only on the blob row
- otherwise skipped writes would leave background polling blind to canonical
  changes until a later full refresh or unrelated blob write

Recommended next move:

- add a canonical revision source or dual-source revision stamp that changes
  for every canonical-input mutation
- only after that should a disabled-by-default mirror-skip flag be introduced
  for one narrow current/open action family
