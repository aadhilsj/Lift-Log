# Two Workouts Per Day

Status (2026-08-27): merged into `main` and deployed to production through
[PR #1](https://github.com/aadhilsj/Lift-Log/pull/1), merge commit `5316e64`.
User acceptance, local regression/full-flow tests, production RPC verification,
Vercel deployment checks and the production smoke check passed.

## Product rule

Fero promotes consistency rather than intensity. A member may log at most two
distinct workouts on one calendar date. Each workout counts separately toward
the member's workout total, target, pace, rankings, and workout-type statistics.
The date still represents one active day for day-based consistency measures.

## Logging behavior

- With no workout on the selected date, the existing modal says `Log a workout`.
- With one workout on the selected date, the same modal says
  `Log another workout` and permits a second submission.
- With two workouts on the selected date, the existing restricted date state is
  shown with `Already logged 2 workouts for this date` and submission is disabled.
- The limit is global per authenticated member and date, not per Bloc.
- One workout copied to several Blocs through Also Log To consumes one slot.
- The existing accepted-workout-type rules apply independently in every Bloc.
- The main plus button and navigation do not change.

## Visible changes

- Calendar dates containing two workouts show the first workout type icon with
  a compact `2` badge.
- A member deleting from a two-workout calendar date first chooses which workout
  to delete, then receives the existing delete confirmation.
- Existing count-driven screens update naturally because both rows count.

## Compatibility and safety

- Existing data containing more than two workouts is preserved; only additional
  submissions for that date are blocked.
- Multi-logged copies are deduplicated by their existing shared logical ID
  convention.
- The modal and API check the cap. The canonical write RPC also enforces it
  atomically with a transaction-scoped advisory lock per profile/date. Separate
  app requests or Blocs cannot concurrently claim the same remaining slot.
- Copies, retries and moderation of existing sessions remain allowed at the cap.
- New canonical workouts require a resolved profile; display names are not the
  identity used to enforce the limit.
- Frontend/API daily counts ignore unrelated Blocs where a different account
  happens to share the member's display name.
- Weekly MVP ranking and its workout-count label count both workouts, while
  active-day/consistency calculations still count the date once.
- A production RPC replacement **is required before merging/deploying**. This
  supersedes the earlier assumption that no database change was needed.

## Acceptance checks

1. First and second workouts save on the same date.
2. A third workout is blocked.
3. Two workouts of the same type are allowed.
4. Also Log To creates one logical workout across eligible Blocs.
5. Ineligible Blocs remain unavailable for that workout type.
6. Calendar, Activity, Month, History, Bloc profile, and account profile reflect
   both workouts correctly.
7. Deleting either workout removes only the selected entry.
8. Deleting one of two single-Bloc workouts reopens one slot for that date.
9. Concurrent submissions, including from different Blocs, cannot exceed two
   distinct sessions at the database layer.

## Local photo-upload requirement

Workout photos are uploaded through the authenticated app API. This keeps the
real Supabase Auth flow and the local `@local.test` OTP flow on the same path,
and allows the local `workout-photos` bucket to be created automatically when
it is missing.

Canonical workout inserts now fail closed in both local and production runtimes
if the write RPC is missing. The earlier local blob-only write fallback bypassed
the atomic cap and has been disabled. The existing local-only delete fallback is
unchanged. The active local Supabase fixture has the canonical workout RPCs and
current-log comment dependencies applied.

## Race fix verification — 2026-08-27

Root cause: the API checked an in-memory snapshot before a separate database
write. Two requests could both see one workout and insert, producing three.
The old RPC reproduced the failure; the updated RPC serializes writes before
reading the day's distinct session count. A rejected competing request returns
HTTP 409 with `Already logged 2 workouts for this date`.

Verified locally:

- `scripts/test-workout-race-local.mjs`: observes a real advisory-lock wait on
  separate Postgres connections; tests a six-request burst, global cap, Bloc
  copies, retries, same-name/different-user identity, date isolation, deletion,
  rollback, preservation of over-limit history, and RPC execute permissions.
  The script targets only `supabase_db_supabase-local`, creates isolated test
  profiles/Blocs and removes them in `finally`. Fixture cleanup was confirmed.
- Existing two-workout, profile-photo storage, display-name identity and Bloc
  Stream derived-moment suites passed.
- `scripts/test-workout-flow-local.mjs`: authenticated JPEG upload and browser
  decode, two same-type saves, HTTP 409 for a third, fresh saved-photo readback,
  exact deletion and slot reuse all passed. Its isolated account, Bloc and photo
  are removed after testing. The local fixture needed existing Bloc/profile
  delete RPCs and the Bloc system-moment table/function installed first; those
  setup changes were local only, using tracked SQL definitions.
- Pre-landing review corrected unrelated same-name accounts consuming slots,
  plus Weekly MVP counting days rather than workouts. Added helper regressions
  pass; the final build and browser suites passed after these corrections.
- Browser auth-edge and mobile-navigation suites passed, including signed-in
  invites, accidental-signup recovery, reverse swipes, leaderboard scrolling and
  blank-frame-free tab transitions.
- Production build passed (existing large-chunk warning remains).
- Local app was restarted against local Supabase only; a browser smoke check
  confirmed visible content, interactive controls and no console/error overlay.

## Production rollout

1. Take a fresh live-data backup, as required by `docs/local-dev.md`. **Done.**
2. Review and apply `supabase/ante-core-workout-logs-write-rpc.sql` in
   the confirmed live Supabase project. This replaces the existing functions;
   it does not delete or rewrite workout history. The delete function and
   service-role-only execute permissions remain unchanged. **Done with explicit
   user authorization: "You can apply the SQL."**
3. Confirm the installed upsert contains `pg_advisory_xact_lock` and the `PT409`
   daily-cap check. Confirm `anon` and `authenticated` cannot execute it, while
   `service_role` can. **Verified.** Do not run the local fixture script against production.
4. Resume the branch merge, CI/deployment verification and production smoke
   check only after that prerequisite is confirmed. **Complete.**

The project keeps canonical RPC definitions in standalone SQL files, rather
than relying on the incomplete, gitignored local Supabase migration history.
Deploying application code alone does not install this RPC update.

### Production execution record — 2026-08-27

- Confirmed target: `Lift Log`, `bpvvvqjsfwmmfjvvijkd`, `ACTIVE_HEALTHY`.
- Backup captured at `2026-08-27T11:26:50.825083Z`: 23 application tables,
  including the current compatibility state, canonical workouts and related
  records, plus the existing upsert/delete function definitions and ACLs.
  This is an application-data snapshot, not a full Auth/Storage backup; it
  excludes historical backup copies and transient OTPs.
- Private, gitignored backup directory:
  `migration-output/pre-two-workout-race-2026-08-27-KfR4V8/`.
  `snapshot.json` and `restore-functions.sql` have owner-only file permissions.
- Snapshot SHA-256:
  `62d014227d7a8694b99ae82c687704f5c5ae3bafa1e49bb8c5a2c1de31ba8096`.
- Applied migration: `20260827112719_enforce_two_workouts_per_day_atomic`.
  A preflight hash check ensured the live upsert had not changed since backup;
  lock/statement timeouts bounded the DDL operation.
- Readback verified both installed function bodies exactly match the reviewed
  SQL, and only `service_role` (not `anon` or `authenticated`) has execute access.
- Counts before and after match: 1,162 workout rows, 36 profiles, 15 Blocs,
  34 seasons. No production workout fixtures were created or deleted.
- Production security advisor: no errors; existing INFO notices for RLS-enabled
  server-only tables without client policies, and one existing warning about
  [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Initial merge preflight paused because no PR existed. On explicit instruction
  to complete the merge without routine pauses, the changes were committed and
  pushed, PR #1 was created, both Vercel checks passed, and the PR was merged at
  `2026-08-27T11:45:16Z`.

### Application deployment verification — 2026-08-27

- Merge SHA: `5316e64697bc62521daadfa7615b818ad8daadc5`.
- Production deployment: `dpl_FCweeKzWEhfm2xzvSEYhitrnro5A`, `READY`, exact merge
  SHA verified behind [the live app](https://lift-log-nu.vercel.app).
- Live browser smoke: HTTP 200, real content rendered, 1.706-second navigation,
  no console errors or error overlays, new two-workout UI present in the served
  asset. Screenshot: `/tmp/fero-two-workouts-production.png` (temporary local evidence).
- Live API: correct production Supabase project, local OTP/preview auth disabled,
  unauthenticated and fake-local-token data requests rejected with HTTP 401.
- No error/fatal runtime logs found for the new deployment in the immediate
  post-merge verification window. This is a smoke check, not extended monitoring.
- Authenticated upload/save/delete mutation tests ran against local Supabase;
  no real users' production workouts were changed for verification.
- Local `main` synchronized with `origin/main`; feature branch deleted locally
  and remotely after merge. Unrelated untracked workspace documents preserved.

Separate security follow-up: direct local catalog checks found RLS disabled and
anonymous SELECT/UPDATE grants on `public.lift_log_state`,
`public.lift_log_backups`, and `public.season_close_log`. The CLI security advisor
reported no issues despite those catalog results. These pre-existing local
permissions were not changed as part of this fix. Production catalog checks on
2026-08-27 confirmed RLS is enabled on `lift_log_state` and `lift_log_backups`;
`season_close_log` is not present there. The local finding does not describe the
live database.
