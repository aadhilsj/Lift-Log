SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
 IF (SELECT md5(pg_get_functiondef('public.upsert_ante_core_workout_log'::regproc))) <> 'ca4aaadec74bea0e0bd39e18da8ba4ea' THEN
  RAISE EXCEPTION 'Live workout RPC changed since backup; aborting for review';
 END IF;
END $$;
-- Write RPCs for ante_core.workout_logs.
-- Called from the app server (service_role caller).
--
-- Scope of this first slice:
-- - upsert current-month workout logs
-- - update current-month workout log moderation fields through the same upsert
-- - hard-delete workout logs by canonical log id
--
-- Identity model:
-- - profile_id is the real identity when auth_user_id can be resolved
-- - owner_display_name is retained as a rendering/history snapshot only
-- - missing or unresolvable auth_user_id is tolerated only for existing legacy rows
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly denied.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. upsert_ante_core_workout_log
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Call via: POST /rest/v1/rpc/upsert_ante_core_workout_log
-- Body:     {
--             "p_id": "...",
--             "p_legacy_group_key": "...",
--             "p_month_key": "...",
--             "p_owner_display_name": "...",
--             "p_owner_auth_user_id": "..."|null,
--             "p_workout_date": "YYYY-MM-DD",
--             "p_workout_type": "...",
--             "p_note": "..."|null,
--             "p_photo_url": "..."|null,
--             "p_created_at": "<iso8601>",
--             "p_verified_via": "photo"|"strava",
--             "p_flag_status": "flagged"|"approved"|"rejected"|null,
--             "p_flag_reason": "..."|null,
--             "p_flag_response": "..."|null,
--             "p_flagged_by": "..."|null,
--             "p_decision_by": "..."|null,
--             "p_decision_at": "<iso8601>"|null
--           }
--
-- season_id is resolved from (blocs.legacy_group_key, seasons.month_key).
-- If the bloc or season is missing, the function exits silently (best-effort).
-- profile_id is resolved from profiles.auth_user_id; null if not found or not supplied.
-- Conflict resolution is on (id). created_at is preserved on conflict.
-- New workouts require a resolved profile. The daily cap is serialized per
-- profile/date across ALL Blocs, including calls from separate app instances.
-- Apply this RPC replacement to Supabase BEFORE deploying two-workout support.

create or replace function public.upsert_ante_core_workout_log(
  p_id                 text,
  p_legacy_group_key   text,
  p_month_key          text,
  p_owner_display_name text,
  p_owner_auth_user_id text,
  p_workout_date       date,
  p_workout_type       text,
  p_note               text,
  p_photo_url          text,
  p_created_at         timestamptz,
  p_verified_via       text,
  p_flag_status        text,
  p_flag_reason        text,
  p_flag_response      text,
  p_flagged_by         text,
  p_decision_by        text,
  p_decision_at        timestamptz
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id    uuid;
  v_season_id  uuid;
  v_profile_id uuid;
  v_session_key text;
  v_session_keys text[];
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
    -- Transaction-scoped: automatically released on success OR rollback.
    -- Take the lock in its own statement before reading the count so a waiting
    -- READ COMMITTED request sees the preceding writer's committed rows.
    perform pg_advisory_xact_lock(hashtextextended(
      'workout-day:' || v_profile_id::text || ':' || p_workout_date::text, 0
    ));
    -- Same session-key convention as getWorkoutSessionKey in the app: copies
    -- share a numeric prefix; non-numeric legacy IDs are independent sessions.
    v_session_key := coalesce(substring(trim(p_id) from '^([0-9]{10,})(?:-|$)'), trim(p_id));
    select array_agg(distinct coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id))
      into v_session_keys
      from ante_core.workout_logs
      where profile_id = v_profile_id and workout_date = p_workout_date;

    -- Existing sessions may be retried, moderated or copied even at the cap.
    -- Existing over-limit historical data is neither deleted nor rewritten.
    if not (v_session_key = any(coalesce(v_session_keys, array[]::text[])))
       and coalesce(cardinality(v_session_keys), 0) >= 2 then
      raise sqlstate 'PT409' using message = 'Already logged 2 workouts for this date';
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
$$;

revoke execute on function public.upsert_ante_core_workout_log(text, text, text, text, text, date, text, text, text, timestamptz, text, text, text, text, text, text, timestamptz) from public;
revoke execute on function public.upsert_ante_core_workout_log(text, text, text, text, text, date, text, text, text, timestamptz, text, text, text, text, text, text, timestamptz) from anon;
revoke execute on function public.upsert_ante_core_workout_log(text, text, text, text, text, date, text, text, text, timestamptz, text, text, text, text, text, text, timestamptz) from authenticated;
grant  execute on function public.upsert_ante_core_workout_log(text, text, text, text, text, date, text, text, text, timestamptz, text, text, text, text, text, text, timestamptz) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. delete_ante_core_workout_log
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Call via: POST /rest/v1/rpc/delete_ante_core_workout_log
-- Body:     { "p_id": "..." }
--
-- Hard-deletes the canonical workout log row by id.
-- No-ops silently if the row does not exist.

create or replace function public.delete_ante_core_workout_log(
  p_id text
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
begin
  if p_id is null or trim(p_id) = '' then
    return;
  end if;

  delete from ante_core.workout_logs
  where id = trim(p_id);
end;
$$;

revoke execute on function public.delete_ante_core_workout_log(text) from public;
revoke execute on function public.delete_ante_core_workout_log(text) from anon;
revoke execute on function public.delete_ante_core_workout_log(text) from authenticated;
grant  execute on function public.delete_ante_core_workout_log(text) to service_role;
;
