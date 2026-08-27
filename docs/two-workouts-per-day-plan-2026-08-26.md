# Two Workouts Per Day

Status: approved for implementation on `codex/two-workouts-per-day`.

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
- The API enforces the cap in addition to the modal.
- No production database migration is planned. Testing uses the feature branch
  against the existing account, with test logs deleted after verification.

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
9. Rapid repeated submission cannot intentionally exceed the UI limit.

## Local photo-upload requirement

Workout photos are uploaded through the authenticated app API. This keeps the
real Supabase Auth flow and the local `@local.test` OTP flow on the same path,
and allows the local `workout-photos` bucket to be created automatically when
it is missing.

The local preview also tolerates a missing canonical workout write/delete RPC
and falls back to the existing blob mirror. That exception is restricted to a
localhost Supabase runtime with local dev OTP enabled; production continues to
fail closed when canonical workout persistence is unavailable. The active
local Supabase fixture has the canonical workout RPCs and current-log comment
dependencies applied so it exercises the same canonical path as production.
