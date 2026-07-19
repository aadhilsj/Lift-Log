# Handover - 2026-07-19 Merge And App Store Readiness

Project: `/Users/opera_user/Documents/Codex Space/Lift Log`

This is the current handover for any new Codex/Claude chat that picks up after
the backend mirror-skip migration closeout and before merging the frontend/chat
branch.

## Current Branch State

As of this handover:

- `main` points at `0629527` (`close out mirror skip policy`)
- `origin/main` points at the same commit
- `codex/create-group-canonical-first` and
  `origin/codex/create-group-canonical-first` also point at `0629527`
- local tag observed: `prod-2026-07-19-backend`
- `feature/chat` is in a separate worktree:
  `/Users/opera_user/Documents/Codex Space/Lift Log Extraction`
- latest observed `feature/chat` commit: `664700a`
  (`Enlarge player workout trend chart`)

Important workflow rule:

- do not promote/deploy production unless the user explicitly asks
- previews are okay when requested
- the user smoke-tests previews and controls production promotion

## Backend Migration Status

The normal product-write backend migration is closed out.

Remaining normal-write backend batches:

- `0`

Normal product writes are canonical-authoritative. The blob is still retained as
a compatibility mirror/fallback for intentionally risky paths.

Current normal product actions allowed to skip blob mirror:

```text
create-group,leave-bloc,kick-member,join-group,update-settings,season-proration-choice,reaction,flag,flag-response,flag-review,delete-log,add-log,multi-log
```

Still intentionally mirrored:

- `auth-sync`
- `repair-display-name`
- `upsert-profile`
- `delete-account`
- `sitout-request`
- `sitout-review`
- legacy/admin settlement paths

Do not casually add these mirrored paths to `BLOB_MIRROR_SKIP_ACTIONS`.

Why:

- `auth-sync` is a real legacy identity repair path and must see blob gaps that
  readable/canonical state can hide
- `repair-display-name` is an admin compatibility repair path
- `upsert-profile` still touches display-name keyed compatibility/history
  surfaces
- `delete-account` is destructive and still needs blob cleanup while read-side
  compatibility exists
- sit-out request/review still have compatibility-shell validation/read
  dependencies
- legacy/admin settlement paths are low-frequency compatibility paths

The blob is not fully deleted. That should not block App Store readiness unless
a fresh audit finds a concrete user-visible or review-visible blocker.

## Backend Work Completed On This Branch

The final backend batches did the following:

- introduced and applied the canonical revision clock:
  `supabase/ante-core-revision-clock-rpc.sql`
- `GET /api/lift-log?revision=1` now uses an effective revision from
  `max(lift_log_state.revision, ante_core.revision_clock.revision)`
- canonical-skipped writes bump `ante_core.revision_clock`
- background polling was moved from full-state fetches to lightweight revision
  checks, with hidden-tab/background behavior improved
- normal high-traffic mutations were moved to canonical-first/canonical
  authority with env-gated blob mirror skip
- canonical-only new bloc follow-up writes were fixed
- canonical writable shell synthesis was added for missing blob groups
- global writable state now includes canonical `ante_core` bloc IDs, not only
  blob group IDs
- display-name rename duplication was fixed so one auth-linked member does not
  become two historical people after rename
- currency is locked after bloc creation
- settlement/history/result money display now follows the bloc currency
- current and historical membership/joined-month behavior was tightened so late
  joiners are not counted as losers for months before they joined
- reactions were made instant/stable after navigation and refetch
- sit-out review regressions from mirror-skip expansion were fixed
- canonical-only newly-created blocs can now be created, prorated, logged,
  reacted to, deleted/left, and used by follow-up mutations

Important files:

- `api/lift-log.js`
- `src/lib/api.js`
- `src/lib/appState.js`
- `src/App.jsx`
- `supabase/ante-core-revision-clock-rpc.sql`
- `supabase/ante-core-current-logs-read-rpc.sql`
- `supabase/ante-core-month-history-read-rpc.sql`
- `scripts/canonical-coverage-report.mjs`
- `docs/backend-migration-closeout-plan-2026-07-12.md`
- `docs/write-hydration-retirement-plan-2026-07-11.md`

## Supabase RPC / Schema Expectations

The backend assumes the production/preview Supabase project has the canonical
`ante_core` schema and service-role-only helper RPCs already applied.

Merge or deploy work must preserve these SQL files and API calls:

- `supabase/canonical-schema.sql`
- `supabase/ante-core-revision-clock-rpc.sql`
- `supabase/ante-core-current-logs-read-rpc.sql`
- `supabase/ante-core-month-history-read-rpc.sql`
- current/read RPC files for blocs, members, profiles, open seasons,
  season overrides, excused/sit-outs, and settlement confirmations
- write RPC files for profile/bloc/member/season/log/reaction/flag/sit-out/
  settlement paths

The key newer RPCs are:

- `public.read_ante_core_revision()`
- `public.bump_ante_core_revision(reason, floor_revision)`

These are service-role-only. Do not expose `ante_core` tables or service-role
RPCs to `anon` or `authenticated`.

When manually running SQL in the Supabase dashboard, the dashboard may show an
RLS warning if it misreads `insert into ante_core...` as table creation. Do not
click "Run and enable RLS" for existing private `ante_core` tables without a
separate schema/RLS audit.

## Manual Production Repair On 2026-07-19

A one-off admin SQL repair was run in production:

- bloc: `Go To Da Gym`
- member: `Isindu`
- month key: `2026-6`
- meaning: July 2026, because app month keys are zero-based
- production revision after repair: `1631`
- revision reason:
  `manual-sitout:isindu-go-to-gym-july-2026`

The repair inserted/updated:

- `ante_core.season_member_status.excused = true`
- `ante_core.sit_out_requests.status = approved`
- blob compatibility state under `lift_log_state.state.groups.legacy-group`
- `lift_log_state.revision`
- `ante_core.revision_clock`

Do not treat this as a new product flow. It was an admin repair. The normal app
flow remains "member requests sit-out, admin/reviewer approves."

## Month Key Convention

Month keys are zero-based and match JavaScript `Date.getMonth()`.

Examples:

- `2026-0` = January 2026
- `2026-5` = June 2026
- `2026-6` = July 2026
- `2026-7` = August 2026

Evidence in code:

- `src/lib/appState.js` sets `CUR_MONTH = LEAGUE_TODAY.month - 1`
- `src/lib/appState.js` builds `curKey = \`${CUR_YEAR}-${CUR_MONTH}\``
- `api/lift-log.js` writes SQL `month_start` as `monthIndex + 1`
- `src/pages/SettlementScreen.jsx` documents the month as 0-indexed

## Feature/Chat Merge Situation

The next large risk is branch divergence, not the blob.

`feature/chat` contains substantial frontend work and a divergent copy of
`api/lift-log.js`.

Observed `feature/chat` work includes:

- Bloc Stream / chat UI foundation
- `src/lib/blocStream.js`
- `src/pages/BlocStream.jsx`
- profile/account UI work
- reaction picker UI rework
- activity feed/photo interaction polish
- Monday-first calendar changes
- player workout trend chart changes
- broader `PlayerProfile.jsx`, `HistoryPage.jsx`, `MonthPage.jsx`,
  `SettlementScreen.jsx`, `TodayPage.jsx`, `Nav.jsx`, and CSS edits

Observed merge-conflict/diff areas include:

- `api/lift-log.js`
- `src/App.jsx`
- `src/pages/ActivityFeed.jsx`
- `src/pages/ActivityPage.jsx`
- `src/pages/MonthPage.jsx`
- `src/pages/PlayerProfile.jsx`
- `src/pages/SettlementScreen.jsx`
- likely other frontend files depending on the final branch tip

Merge rule for `api/lift-log.js`:

- prefer `main` / backend closeout version as the authority
- then re-apply any `feature/chat` backend deltas deliberately if still needed
- do not line-by-line merge backend migration logic casually

Known useful `feature/chat` backend deltas from Claude's audit:

- `resolveDeleteLogOwner(...)`
- `deletedCurrentLogIds` tombstones/filtering to prevent deleted workouts from
  resurfacing

If those are still present on `feature/chat`, preserve them by re-applying them
on top of the backend closeout `api/lift-log.js`, then run backend checks.

Do not let an older `feature/chat` copy of `api/lift-log.js` overwrite:

- canonical revision clock integration
- `BLOB_MIRROR_SKIP_ALLOWED_ACTIONS`
- `BLOB_MIRROR_SKIP_WIRED_ACTIONS`
- final `BLOB_MIRROR_SKIP_ACTIONS` policy
- canonical-only bloc shell synthesis
- canonical IDs in global writable state
- 404-tolerant canonical-only follow-up paths
- current currency/membership/display-name fixes

## Frontend/Profile/Stat Merge Notes

The user specifically cares that profile/stat/trend work survives the merge.

During merge, preserve `feature/chat` UI work unless it conflicts with backend
correctness:

- player profile stat cards and labels
- workout trend/sparkline/chart work
- Monday-first calendar behavior if intended by the frontend branch
- Bloc Stream/chat UI
- reaction picker frontend changes
- photo interaction polish
- profile/account page changes
- all user-facing stat calculations that depend on current canonical data

However, if a frontend stat/card/trend reads from backend-shaped state, verify
it against the backend closeout data shape after merge:

- current month logs are canonical-overlaid
- current excused/sit-out state is canonical-overlaid
- closed month history is canonical-composed where available
- current currency is the bloc currency and cannot be changed after creation
- membership/history views must be auth/profile-aware, not display-name keyed
  when determining whether someone is the same person
- late joiners must not appear as losers for months before they joined
- display-name rename must not create duplicate historical people

Smoke profile/stat areas after merge:

- Today stat cards
- History all-time leaderboard
- Player Profile current month
- Player Profile historical month selector
- Player Profile workout trend chart/sparkline
- settlement reminders
- reactions after navigating away/back
- logging/deleting after creating a brand-new bloc

## Recommended Merge Order

1. Confirm `main` is still at the promoted backend closeout commit.
2. In the `feature/chat` worktree, merge/rebase `main` into `feature/chat`.
3. Resolve `api/lift-log.js` using backend closeout as the base, then re-apply
   any still-needed chat delete-log tombstone/owner-resolution deltas.
4. Resolve frontend conflicts by preserving chat UI work while adapting to the
   current backend state shape.
5. Run:

```bash
PATH="/Users/opera_user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node --check api/lift-log.js
PATH="/Users/opera_user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/vite build
git diff --check
```

6. Deploy preview only.
7. User smoke-tests preview.
8. Promote production only if the user explicitly says so.

## Required Post-Merge Smoke Matrix

Minimum:

- sign in
- blocs load
- create disposable bloc
- choose proration
- log one workout
- multi-log one workout
- react and unreact
- navigate away/back and verify reactions stay correct
- delete the workout and verify it stays deleted
- leave/delete disposable bloc
- settings safe change
- confirm currency is locked
- settlement reminders render
- History screen renders expected currency and membership history
- Player Profile opens from a leaderboard row
- Player Profile current stats/trends render
- Player Profile historical months do not include months before actual
  membership

Recommended if practical:

- invite join with a test account
- auth-linked kick from disposable bloc
- flag another user's workout
- respond/review a flag
- sit-out request and sit-out review

## App Store Readiness Advice

Do not block App Store readiness on fully deleting the blob.

Block App Store readiness on:

- auth/session reliability
- account deletion working end-to-end
- no unauthenticated app-data endpoints
- service-role key staying server-only
- privacy/data disclosure accuracy
- production usage/cost stability
- stable merged frontend/backend branch
- final mobile/PWA/native wrapper packaging
- user-visible UX polish and smoke matrix passing

Full blob deletion is an internal post-launch cleanup unless a future audit finds
a concrete App Store blocker.

## Things Not To Do Casually

Do not casually edit:

- `src/lib/appState.js` bootstrap normalization
- `normalizeAppState`
- profile/session resolution
- display-name/history normalization
- auth-sync repair logic

Earlier, a client history-pruning patch made real users look like fresh users
with empty blocs. That approach was reverted and should not be resumed without
a tighter design.

Rejected/reverted slice:

- rejected: `ea251b3 align client history pruning with server`
- reverted by: `0aa3035 Revert "align client history pruning with server"`

## Remaining Backend Work

Normal backend write migration:

- `0` batches left

Optional future compatibility-retirement work:

- retire `auth-sync` blob repair dependencies
- retire display-name keyed historical/profile compatibility shells
- retire `upsert-profile` mirror dependency
- retire `delete-account` blob cleanup dependency
- make sit-out request/review validation fully canonical-input
- retire legacy/admin settlement blob compatibility
- eventually remove blob read/write fallback after a dedicated migration plan

Treat these as separate post-stability projects, not as a prerequisite for the
`feature/chat` merge or App Store readiness unless new evidence says otherwise.
