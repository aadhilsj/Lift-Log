-- The daily cap becomes two per ACTIVITY instead of two per day.
--
-- Founder's decision, 22 October 2026: a member may log as many workouts in a
-- day as they like, but no more than two of the same activity. Two runs and a
-- gym session is fine; three runs is not. Two kitesurfs and a padel is fine;
-- three padel is not.
--
-- Keyed on the ACTIVITY, not the broad workout_type. Kitesurfing and padel are
-- both "Sports" underneath, and the founder's own examples only hold if they
-- are counted apart.
--
-- AGENTS.md §8 said the two-per-day cap was deliberate and must not be
-- "fixed". That rule is replaced by this one, and §8 is updated in the same
-- change so a later session does not restore the old cap.
--
-- NOT changed here, and deliberately so: the monthly score still counts every
-- workout. A member who logs six in a day is six closer to their target. The
-- founder knows and wants to revisit it; the open question is recorded in the
-- handover.
--
-- Everything else in this function is byte-identical to what is live. The only
-- edit is the cap block.
--
-- Rollback: re-apply 20260827112719_enforce_two_workouts_per_day_atomic.sql,
-- whose cap block is the pre-change version.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Abort if the live function is not the one this was written against.
DO $$ BEGIN
 IF (SELECT md5(pg_get_functiondef('public.upsert_ante_core_workout_log'::regproc)))
    <> 'b99164508e4b13eeb6b257849ed08d8f' THEN
  RAISE EXCEPTION 'Live workout RPC is not the revision this migration was written against; aborting for review';
 END IF;
END $$;

create or replace function public.upsert_ante_core_workout_log(
  p_id text,
  p_legacy_group_key text,
  p_month_key text,
  p_owner_display_name text,
  p_owner_auth_user_id text,
  p_workout_date date,
  p_workout_type text,
  p_note text,
  p_photo_url text,
  p_created_at timestamp with time zone,
  p_verified_via text,
  p_flag_status text,
  p_flag_reason text,
  p_flag_response text,
  p_flagged_by text,
  p_decision_by text,
  p_decision_at timestamp with time zone,
  p_activity text DEFAULT NULL::text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ante_core', 'public'
AS $function$
declare
  v_bloc_id    uuid;
  v_season_id  uuid;
  v_profile_id uuid;
  v_session_key text;
  v_session_keys text[];
  v_activity_key text;
  v_activity_label text;
begin
  -- Validate required inputs.
  if p_id is null or trim(p_id) = '' then
    return;
  end if;
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    return;
  end if;
  if p_month_key is null or trim(p_month_key) = '' then
    return;
  end if;
  if p_owner_display_name is null or trim(p_owner_display_name) = '' then
    return;
  end if;
  if p_workout_date is null then
    return;
  end if;
  if p_workout_type is null or trim(p_workout_type) = '' then
    return;
  end if;
  if p_created_at is null then
    return;
  end if;
  if p_verified_via is null or trim(p_verified_via) = '' then
    return;
  end if;

  -- Resolve bloc_id from legacy_group_key.
  select id into v_bloc_id
  from ante_core.blocs
  where legacy_group_key = trim(p_legacy_group_key);

  if v_bloc_id is null then
    return;
  end if;

  -- Resolve season_id from (bloc_id, month_key).
  select id into v_season_id
  from ante_core.seasons
  where bloc_id   = v_bloc_id
    and month_key = trim(p_month_key);

  if v_season_id is null then
    return;
  end if;

  -- Resolve profile_id from auth_user_id; new workouts must resolve an identity.
  if p_owner_auth_user_id is not null and trim(p_owner_auth_user_id) <> '' then
    begin
      select id into v_profile_id
      from ante_core.profiles
      where auth_user_id = trim(p_owner_auth_user_id)::uuid;
    exception when others then
      v_profile_id := null;
    end;
  end if;

  if v_profile_id is null then
    -- Legacy moderation remains possible, but an unidentified new workout must
    -- not bypass the authenticated member's daily cap.
    if not exists (select 1 from ante_core.workout_logs where id = trim(p_id)) then
      raise sqlstate 'PT400' using message = 'A resolved profile is required to log a workout';
    end if;
  else
    -- Which bucket this workout falls in. Falls back to workout_type when no
    -- activity is supplied, which is exactly what getLogDisplayActivity does
    -- in the app, so the two agree. About half of the logs written before
    -- 16 September 2026 carry no activity; every log since does.
    v_activity_label := coalesce(
      nullif(trim(coalesce(p_activity, '')), ''),
      trim(p_workout_type)
    );
    v_activity_key := lower(v_activity_label);

    -- Transaction-scoped: automatically released on success OR rollback.
    -- Take the lock in its own statement before reading the count so a waiting
    -- READ COMMITTED request sees the preceding writer's committed rows.
    --
    -- The activity is part of the key, so logging a run and a gym session at
    -- the same moment no longer serialises one behind the other.
    perform pg_advisory_xact_lock(hashtextextended(
      'workout-day:' || v_profile_id::text || ':' || p_workout_date::text || ':' || v_activity_key, 0
    ));
    -- Same session-key convention as getWorkoutSessionKey in the app: copies
    -- share a numeric prefix; non-numeric legacy IDs are independent sessions.
    -- One workout logged to several Blocs at once is still ONE workout.
    v_session_key := coalesce(substring(trim(p_id) from '^([0-9]{10,})(?:-|$)'), trim(p_id));
    select array_agg(distinct coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id))
      into v_session_keys
      from ante_core.workout_logs
      where profile_id = v_profile_id
        and workout_date = p_workout_date
        and lower(coalesce(nullif(trim(coalesce(activity, '')), ''), trim(workout_type))) = v_activity_key;

    -- Existing sessions may be retried, moderated or copied even at the cap.
    -- Existing over-limit historical data is neither deleted nor rewritten.
    -- The message names the activity, so it is obvious something else may
    -- still be logged.
    if not (v_session_key = any(coalesce(v_session_keys, array[]::text[])))
       and coalesce(cardinality(v_session_keys), 0) >= 2 then
      raise sqlstate 'PT409' using message =
        'Already logged 2 ' || v_activity_label || ' workouts for this date';
    end if;
  end if;

  insert into ante_core.workout_logs (
    id,
    bloc_id,
    season_id,
    profile_id,
    owner_display_name,
    workout_date,
    workout_type,
    activity,
    note,
    photo_url,
    created_at,
    verified_via,
    flag_status,
    flag_reason,
    flag_response,
    flagged_by,
    decision_by,
    decision_at
  )
  values (
    trim(p_id),
    v_bloc_id,
    v_season_id,
    v_profile_id,
    trim(p_owner_display_name),
    p_workout_date,
    trim(p_workout_type),
    nullif(trim(coalesce(p_activity, '')), ''),
    coalesce(p_note, ''),
    coalesce(p_photo_url, ''),
    p_created_at,
    trim(p_verified_via),
    p_flag_status,
    coalesce(p_flag_reason, ''),
    coalesce(p_flag_response, ''),
    nullif(trim(coalesce(p_flagged_by, '')), ''),
    nullif(trim(coalesce(p_decision_by, '')), ''),
    p_decision_at
  )
  on conflict (id) do update
    set
      bloc_id             = excluded.bloc_id,
      season_id           = excluded.season_id,
      profile_id          = excluded.profile_id,
      owner_display_name  = excluded.owner_display_name,
      workout_date        = excluded.workout_date,
      workout_type        = excluded.workout_type,
      -- A re-save that does not carry the activity (a flag, a repair script,
      -- older code) must never erase one already stored.
      activity            = coalesce(excluded.activity, ante_core.workout_logs.activity),
      note                = excluded.note,
      photo_url           = excluded.photo_url,
      verified_via        = excluded.verified_via,
      flag_status         = excluded.flag_status,
      flag_reason         = excluded.flag_reason,
      flag_response       = excluded.flag_response,
      flagged_by          = excluded.flagged_by,
      decision_by         = excluded.decision_by,
      decision_at         = excluded.decision_at;
  -- created_at is intentionally preserved on conflict.
end;
$function$;

-- create or replace keeps the existing ACL, but assert the house pattern
-- rather than assume it.
revoke execute on function public.upsert_ante_core_workout_log(text, text, text, text, text, date, text, text, text, timestamptz, text, text, text, text, text, text, timestamptz, text) from public;
revoke execute on function public.upsert_ante_core_workout_log(text, text, text, text, text, date, text, text, text, timestamptz, text, text, text, text, text, text, timestamptz, text) from anon;
revoke execute on function public.upsert_ante_core_workout_log(text, text, text, text, text, date, text, text, text, timestamptz, text, text, text, text, text, text, timestamptz, text) from authenticated;
grant execute on function public.upsert_ante_core_workout_log(text, text, text, text, text, date, text, text, text, timestamptz, text, text, text, text, text, text, timestamptz, text) to service_role;
