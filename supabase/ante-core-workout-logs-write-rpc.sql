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
-- - missing or unresolvable auth_user_id is tolerated; profile_id becomes null
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

  -- Resolve profile_id from auth_user_id — best-effort; null is acceptable.
  if p_owner_auth_user_id is not null and trim(p_owner_auth_user_id) <> '' then
    begin
      select id into v_profile_id
      from ante_core.profiles
      where auth_user_id = trim(p_owner_auth_user_id)::uuid;
    exception when others then
      v_profile_id := null;
    end;
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
