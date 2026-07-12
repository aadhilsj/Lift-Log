# Backend Migration Handover - 2026-07-12

This is the current source-of-truth handover for backend migration work on:

- branch: `codex/create-group-canonical-first`
- project: `/Users/opera_user/Documents/Codex Space/Lift Log`

Parallel frontend/chat work is happening separately on `feature/chat`. Keep this
branch backend-focused unless explicitly coordinated.

## Current State

The app is live and stable in the current hybrid backend model:

- canonical tables/RPCs exist and are used for many authoritative writes
- user-facing GET still starts from blob state and overlays canonical data
- normal POST mutations still hydrate a blob-shaped writable state before
  computing the in-memory compatibility result
- blob persistence still acts as compatibility mirror and safety net
- production includes the lightweight revision-check polling fix from `da5aa4e`,
  so background sync no longer performs a full composed state read every 3s when
  the blob revision has not changed

Latest backend preview with active write-hydration probes:

- latest promoted production/preview baseline before this constructor follow-up:
  `da5aa4e` (`reduce background state polling cost`)
- newest constructor-probe follow-up should be deployed from the next commit

## Important Recent Finding

The first enabled write-hydration probes proved that
`fetchReadableCurrentState()` is not a safe mutation base.

Observed on preview:

- `reaction` still worked for the user
- probe logged mismatches for target blocs
- earlier probe output showed `writableGroups: 7` and `readableGroups: 1`

Interpretation:

- readable/composed state is a user-facing projection, not a lossless writable
  snapshot
- direct cutover from writable blob hydration to `fetchReadableCurrentState()`
  would be unsafe
- the next migration step is a canonical writable-state constructor, not another
  broad substitution of readable state

## Supabase Read Surface And Coverage - 2026-07-12

Applied production Supabase migrations:

- `restore_ante_core_read_rpcs_20260712`
- `fix_read_ante_core_current_logs_ordering_20260712`

These restored the missing service-role-only canonical read RPCs and fixed the
invalid aggregate ordering in `read_ante_core_current_logs()`.

Verified installed/callable read RPCs:

- `read_ante_core_bloc_members`
- `read_ante_core_blocs`
- `read_ante_core_current_excused_and_sitouts`
- `read_ante_core_current_logs`
- `read_ante_core_month_history`
- `read_ante_core_open_seasons`
- `read_ante_core_profiles`
- `read_ante_core_season_overrides`
- `read_ante_core_settlement_confirmations`

All are executable by `service_role` and not executable by `anon` or
`authenticated`.

Initial coverage report before backfill:

- path: `migration-output/coverage/canonical-coverage-2026-07-12T17-26-07-363Z.json`
- blob groups: `7`
- canonical blocs visible via read RPCs: `1`
- failures: `79`

Fresh backfill artifacts were regenerated locally from the current blob snapshot:

- path: `migration-output/canonical-run-2026-07-12-current/`
- summary: `28` profiles, `7` blocs, `34` bloc members, `9` seasons,
  `54` season member status rows, `413` workout logs, `166` reactions,
  `6` season overrides, `4` sit-out requests
- warning: one reaction by display name `isindug` could not resolve to a
  canonical profile and is skipped by the generated import

The generated import SQL was applied from this workspace through a temporary
service-role-only SQL executor RPC. The temporary RPC was dropped immediately
after apply and verified absent.

Latest coverage report after backfill:

- path: `migration-output/coverage/canonical-coverage-2026-07-12T17-42-19-811Z.json`
- blob groups: `7`
- canonical blocs visible via read RPCs: `7`
- failures: `0`

Canonical coverage is now clean enough to begin constructor parity work.

## Constructor Probe Batch - 2026-07-12

Current branch now includes `buildCanonicalWritableStateForGroup(groupId)` in
`api/lift-log.js`.

Scope:

- starts from the blob-shaped state only as the outer compatibility shell
- replaces the target group's current writable fields from canonical reads:
  settings, memberships, joined-month markers, current logs, current
  excused/sit-out state, and season overrides
- preserves blob historical compatibility where still needed for current
  mutation helpers
- leaves actual mutation authority on `fetchWritableCurrentState()`
- after inspecting preview logs, the constructor now accepts the already
  authenticated writable shell as its compatibility base for probes instead of
  doing an independent blob refetch; this avoids comparing a seven-group real
  writable mutation against a transiently collapsed one-group constructor shell
- joined-month compatibility markers are merged from the blob shell and then
  overlaid by canonical `joined_month_key` rows, instead of being rebuilt from
  canonical rows only

The write-hydration parity probe now compares blob-write output against this
canonical writable constructor instead of `fetchReadableCurrentState()`.

This is observational. The covered POST actions still execute against the
existing blob writable base.

## Latest Probe Status

Preview-only branch gate:

- on Vercel preview deployments for `codex/create-group-canonical-first`, the
  covered write-hydration probes are enabled by default when
  `WRITE_HYDRATION_PARITY_ACTIONS` is unset
- production remains off unless the env var is explicitly configured

Covered actions:

- `update-settings`
- `season-proration-choice`
- `sitout-request`
- `sitout-review`
- `reaction`
- `flag`
- `flag-response`
- `flag-review`
- `delete-log`

The probe now reports target-group field differences only, rather than global
`groupOrder`, `profiles`, or whole group-key-set differences.

Latest log finding before the constructor follow-up:

- preview deployment `dpl_4UbqnPvMF75VwuFSaX3RBjCBxJSt` logged a `reaction`
  mismatch for `test101-us8qvg`
- the real writable path serialized `7` groups, while the constructor/probe path
  serialized `1` group and missed the target group
- no write-input cutover should happen until the new constructor follow-up has
  been deployed and the same probe actions are rechecked

Follow-up finding after `b6f676d`:

- the same `reaction` mismatch remained on preview
- root cause was probe result normalization: some helpers, including
  `applyToggleReaction`, return `{ updated, reason }`, while others return the
  state object directly
- the probe now unwraps `result.updated` / `result.state` before serializing the
  canonical mutation result

Admin-only parity report follow-up:

- `POST /api/lift-log` with `action: "write-hydration-parity-report"` now
  builds a non-persisting parity report behind `ADMIN_PIN`
- the report compares the existing blob writable input against
  `buildCanonicalWritableStateForGroup(...)` for sampled current/open actions
- it returns checked/skipped/failed counts plus per-action mismatches
- it does not call `persistState()` or canonical write RPCs
- skipped rows mean the current data did not have a safe candidate for that
  action, not that the action failed parity

First report result on preview `974b525`:

- `checked: 43`, `failed: 43`, `skipped: 20`
- dominant mismatches were constructor/base shape issues:
  `createdAt`, `memberships`, `activeMemberOrder`, and `logs`
- direct data inspection showed current canonical log counts matched blob log
  counts; one common log mismatch was reaction-member array order, not missing
  workouts
- follow-up constructor patch preserves blob-compatible timestamp spelling when
  canonical and blob timestamps represent the same instant, preserves existing
  membership insertion order for covered auth-linked members, and treats
  reaction member arrays as sets for parity comparison only

Second report result on preview `031b7d2`:

- membership/timestamp/active-order mismatches cleared
- remaining failures were all `logs`
- direct data inspection found `0` missing canonical current logs; raw log
  differences were reaction-member array ordering and one equivalent
  `decisionAt` timestamp spelling difference
- follow-up log constructor patch now keeps blob owner/log ordering as the
  compatibility shell when canonical has matching log IDs, while still sourcing
  canonical log fields by ID

Final constructor parity cleanup:

- preview `a6c74b9` added nested mismatch details to the admin-only report
- preview `d6b1a6b` preserved legacy absence of `ownerDisplayName` on matched
  existing blob logs
- preview `c0d15aa` preserved the existing blob reaction field shape for matched
  logs
- direct raw DB inspection before the reaction-field patch showed blob and
  canonical current logs had matching `(group, owner, logId)` sets and `0`
  reaction-set diffs, so the remaining report failures were constructor-shape
  parity issues rather than missing canonical workout/reaction rows

Latest admin-only parity report on preview `c0d15aa`:

- preview URL: `lift-1xrt8n6gf-aadhilshahjahan11-1221s-projects.vercel.app`
- deployment: `dpl_Eoym8J1XMwgbF2abgi9c7Z9fgDBV`
- `ok: true`
- `checked: 43`
- `skipped: 20`
- `failed: 0`

This clears the sampled current/open write-hydration constructor parity blocker.
It does not mean every backend migration task is done; it means the canonical
writable constructor now matches the existing blob writable base for the
covered sampled action families.

## First Write-Input Cutover Batch - 2026-07-12

The first low-risk write-input cutover is now landed on this branch.

Covered actions:

- `update-settings`
- `season-proration-choice`
- `sitout-request`

Implementation notes:

- these actions still authenticate and perform legacy identity repair against
  the existing blob writable shell first
- after auth succeeds, they build the target group's mutation input with
  `buildCanonicalWritableStateForAuthenticatedMutation(...)`, which wraps
  `buildCanonicalWritableStateForGroup(...)`
- they still compute a shadow blob mutation for the write-hydration parity
  probe, so preview can continue comparing old-vs-new behavior
- canonical sync and blob mirror persistence order is unchanged

Preview verification:

- commit `9ae307c` cut `update-settings` and `season-proration-choice` to the
  canonical writable constructor
- preview report for `9ae307c` returned `ok: true`, `checked: 43`,
  `skipped: 20`, `failed: 0`
- commit `1a9b571` cut `sitout-request` to the canonical writable constructor
- preview `lift-8m5c6f7iq-aadhilshahjahan11-1221s-projects.vercel.app`,
  deployment `dpl_4Ai3WheCJ2oqfWMShFBVarmVnpiZ`, returned `ok: true`,
  `checked: 43`, `skipped: 20`, `failed: 0`

Do not cut over `sitout-review`, `reaction`, `delete-log`, or flag actions in
the same style without a fresh risk pass. The admin report skips
`sitout-review` today because there are no pending candidates, and the workout
log actions touch user-visible log rows directly.

## Do Not Repeat

Do not revive these approaches without a dedicated replacement plan:

- client history pruning / `src/lib/appState.js` normalization cleanup
- using `fetchReadableCurrentState()` as general POST mutation input
- changing `auth-sync` to readable-state-first
- deleting `leftMemberNames`
- deleting `joinedMonthByName`
- treating `repair-display-name` as normal rename behavior

The rejected client-normalizer commit was:

- `ea251b3` `align client history pruning with server`
- reverted by `0aa3035`

That regression made returning users appear like new users with empty blocs.

## Current Backend Closeout Strategy

Stop doing one tiny runtime slice followed by immediate user smoke. Use larger
batches:

1. audit the actual code path and canonical coverage
2. create/update docs first so work can resume cleanly in a new chat
3. build canonical writable reconstruction for target action families
4. run parity internally
5. only ask the user for a smoke test at meaningful batch boundaries

The detailed plan is:

- `docs/backend-migration-closeout-plan-2026-07-12.md`

## Commands

Use these checks before committing backend changes:

```bash
/Users/opera_user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check api/lift-log.js
PATH="/Users/opera_user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/vite build
git diff --check
```

Vercel project IDs:

- project: `prj_wZ1qEL1w37c39qAThaqEkl42HXTI`
- team: `team_XidhhVYn5egpVxdkw6SP8heA`

## Immediate Next Work

The first low-risk write-input cutover batch is complete. Next work is either:

- ask for one preview smoke covering sign-in, bloc load, settings change, and
  any available sit-out/proration UI
- or continue with a separate higher-risk audit for workout-log actions before
  touching `reaction`, `delete-log`, or flags

To rerun the admin-only parity report before/after a cutover:

```json
{ "action": "write-hydration-parity-report", "pin": "<ADMIN_PIN>" }
```

Also inspect Vercel logs for organic probe output while exercising current/open
actions when practical:

```bash
reaction, flag, flag-response, flag-review, delete-log, update-settings,
season-proration-choice, sitout-request, sitout-review
```

Do not use the readable GET projection as the mutation constructor.
