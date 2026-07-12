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

- `fetchWritableCurrentState()` still reads the blob and feeds most POST
  mutation helpers
- `fetchReadableCurrentState()` reads blob then overlays canonical data for the
  user-facing GET response
- canonical writes are already first/authoritative for many bounded actions
- blob persistence mirrors the post-action compatibility state

The current blocker is the writable input shape, not write ordering.

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

Current result on 2026-07-12:

- service-role read RPCs are now installed and callable
- `read_ante_core_current_logs()` SQL source was fixed so ordering happens
  inside `jsonb_agg(...)`
- coverage still fails because canonical data is incomplete, not because the
  read RPCs are missing
- latest report: `migration-output/coverage/canonical-coverage-2026-07-12T17-26-07-363Z.json`
- visible canonical blocs: `1` of `7`
- visible current canonical workout logs: `0` while blob has current logs

Fresh local backfill artifacts:

- `migration-output/canonical-run-2026-07-12/`
- generated from blob revision `858`
- generated SQL: `migration-output/canonical-run-2026-07-12/canonical-import.sql`
- one non-blocking warning: a reaction by `isindug` has no resolvable profile

Do not apply older generated imports unless they are regenerated from a fresh
snapshot. The July 12 artifacts are the current evidence, but should still be
regenerated if there has been meaningful production write activity.

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

Blocked until Workstream A coverage is materially improved. The constructor
must not be built against a canonical dataset that only contains one visible
bloc and zero visible current logs.

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

Candidate actions after constructor parity:

- `reaction`
- `flag`
- `flag-response`
- `flag-review`
- `delete-log`
- `update-settings`
- `season-proration-choice`
- `sitout-request`
- `sitout-review`

These are current/open or row-shaped actions. They are the best batch for moving
away from blob-hydrated mutation input.

Exit criteria:

- canonical constructor parity is clean for the target group
- mutations write canonical first as today
- blob persistence is mirror-only after canonical mutation computation
- preview smoke: sign in, blocs load, react/unreact, setting change, one flag
  path if practical

### Workstream D - High-Risk Compatibility Paths

Do not bundle these with Workstream C unless coverage is proven:

- `auth-sync`
- `upsert-profile`
- `repair-display-name`
- `join-group`
- `kick-member`
- `leave-bloc`
- `delete-account`
- legacy admin `settlement`

These paths still touch identity repair, lifecycle residue, historical/display-
name keyed state, or admin transfer behavior.

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

1. Apply or regenerate the canonical backfill from
   `migration-output/canonical-run-2026-07-12/`.
2. Rerun `scripts/canonical-coverage-report.mjs` and inspect group-level
   failures.
3. Add the first canonical writable constructor for one target group.
4. Point parity probes at the constructor, not `fetchReadableCurrentState()`.
5. Use preview smoke/logs to determine whether the low-risk action batch can be
   cut over together.

If the constructor reveals missing canonical rows, fix coverage/import first.
