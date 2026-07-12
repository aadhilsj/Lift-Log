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

Latest backend preview with active write-hydration probes:

- commit: `a9d5b34` (`focus hydration parity probe on target group`)
- preview: `https://lift-6nbikork9-aadhilshahjahan11-1221s-projects.vercel.app`

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

Deploy the constructor-probe batch to preview and inspect Vercel logs while
exercising current/open actions:

```bash
reaction, flag, flag-response, flag-review, delete-log, update-settings,
season-proration-choice, sitout-request, sitout-review
```

If constructor parity is clean, the next code batch can start moving a narrow
low-risk action family away from blob-hydrated mutation input.

Do not use the readable GET projection as the mutation constructor.
