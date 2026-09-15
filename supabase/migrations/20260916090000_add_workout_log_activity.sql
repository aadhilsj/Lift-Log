-- Workout activity (Padel, Hiking…) alongside the existing category.
--
-- `workout_type` keeps holding the category (Gym, Run, Sports, Pilates,
-- Other), so Bloc rules, the daily cap and month close are unchanged.
-- `activity` is optional: logs saved before activities existed have none.
--
-- Additive and backward compatible. The new p_activity parameter defaults to
-- null, so the currently deployed code (which does not send it) keeps working
-- after this runs. Run this BEFORE deploying code that sends p_activity.
--
-- Function bodies are the live production definitions as of 2026-09-16, read
-- with pg_get_functiondef, with only the activity lines added.

begin;

-- 1. The column.
alter table ante_core.workout_logs
  add column if not exists activity text;

-- 2. Save a workout. The signature gains p_activity, so the old 17-argument
--    version is dropped first: two versions would make every call ambiguous.
drop function if exists public.upsert_ante_core_workout_log(
  text, text, text, text, text, date, text, text, text,
  timestamp with time zone, text, text, text, text, text, text, timestamp with time zone
);

create function public.upsert_ante_core_workout_log(
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
  p_activity text default null
)
returns void
language plpgsql
security definer
set search_path to 'ante_core', 'public'
as $function$
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

-- Same access as before: the server (service_role) only.
revoke all on function public.upsert_ante_core_workout_log(
  text, text, text, text, text, date, text, text, text,
  timestamp with time zone, text, text, text, text, text, text, timestamp with time zone, text
) from public, anon, authenticated;
grant execute on function public.upsert_ante_core_workout_log(
  text, text, text, text, text, date, text, text, text,
  timestamp with time zone, text, text, text, text, text, text, timestamp with time zone, text
) to service_role;

-- 3. This month's workouts. Unchanged signature, so replace in place (grants kept).
create or replace function public.read_ante_core_current_logs()
returns jsonb
language plpgsql
security definer
set search_path to 'ante_core', 'public'
as $function$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'legacy_group_key',   b.legacy_group_key,
        'id',                 wl.id,
        'owner_display_name', wl.owner_display_name,
        'workout_date',       to_char(wl.workout_date, 'YYYY-MM-DD'),
        'workout_type',       wl.workout_type,
        'activity',           wl.activity,
        'note',               wl.note,
        'photo_url',          wl.photo_url,
        'created_at',         to_char(wl.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'verified_via',       wl.verified_via,
        'flag_status',        wl.flag_status,
        'flag_reason',        wl.flag_reason,
        'flag_response',      wl.flag_response,
        'flagged_by',         wl.flagged_by,
        'decision_by',        wl.decision_by,
        'decision_at',        case
                                when wl.decision_at is null then null
                                else to_char(wl.decision_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                              end,
        'reactions',          coalesce(
                                (
                                  select jsonb_object_agg(r2.emoji, r2.reactor_names)
                                  from (
                                    select
                                      r.emoji,
                                      jsonb_agg(r.reactor_display_name order by r.created_at) as reactor_names
                                    from ante_core.workout_reactions r
                                    where r.workout_log_id = wl.id
                                    group by r.emoji
                                  ) r2
                                ),
                                '{}'::jsonb
                              )
      )
      order by wl.created_at asc
    ),
    '[]'::jsonb
  )
  into result
  from ante_core.workout_logs wl
  join ante_core.seasons s
    on s.id = wl.season_id
  join ante_core.blocs b
    on b.id = wl.bloc_id
  where s.status = 'open'
    and b.legacy_group_key is not null;

  return result;
end;
$function$;

-- 4. Closed months. Unchanged signature, replaced in place.
create or replace function public.read_ante_core_month_history()
returns jsonb
language plpgsql
security definer
set search_path to 'ante_core', 'public'
as $function$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'legacy_group_key',       season_row.legacy_group_key,
        'month_key',              season_row.month_key,
        'label',                  season_row.label,
        'year',                   season_row.year,
        'month_index',            season_row.month_index,
        'min_target',             season_row.min_target,
        'fine_amount',            season_row.fine_amount,
        'fee_model',              season_row.fee_model,
        'escalation_step_amount', season_row.escalation_step_amount,
        'currency',               season_row.currency,
        'min_run_distance',       season_row.min_run_distance,
        'distance_unit',          season_row.distance_unit,
        'strava_enabled',         season_row.strava_enabled,
        'time_zone',              season_row.time_zone,
        'accepted_workout_types', season_row.accepted_workout_types,
        'members',                season_row.members,
        'logs',                   season_row.logs
      )
      order by season_row.month_key
    ),
    '[]'::jsonb
  )
  into result
  from (
    select
      b.legacy_group_key,
      s.month_key,
      s.label,
      s.year,
      s.month_index,
      s.min_target,
      s.fine_amount,
      s.fee_model::text as fee_model,
      s.escalation_step_amount,
      s.currency,
      s.min_run_distance,
      s.distance_unit,
      s.strava_enabled,
      s.time_zone,
      s.accepted_workout_types,
      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'display_name',          sms.display_name_snapshot,
              'auth_user_id',          case when p.auth_user_id is null then null else p.auth_user_id::text end,
              'workout_count',         sms.workout_count,
              'excused',               sms.excused,
              'solo',                  sms.solo,
              'solo_target',           sms.solo_target,
              'training_wheels',       sms.training_wheels,
              'joined_for_month',      sms.joined_for_month,
              'settlement_status',     sms.settlement_status,
              'settlement_settled_at', case when sms.settlement_settled_at is null then null else to_char(sms.settlement_settled_at, 'YYYY-MM-DD') end,
              'settlement_updated_at', case when sms.settlement_updated_at is null then null else to_char(sms.settlement_updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
            )
            order by sms.display_name_snapshot
          ),
          '[]'::jsonb
        )
        from ante_core.season_member_status sms
        left join ante_core.profiles p on p.id = sms.profile_id
        where sms.season_id = s.id
      ) as members,
      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id',                 wl.id,
              'owner_display_name', wl.owner_display_name,
              'workout_date',       to_char(wl.workout_date, 'YYYY-MM-DD'),
              'workout_type',       wl.workout_type,
              'activity',           wl.activity,
              'note',               wl.note,
              'photo_url',          wl.photo_url,
              'created_at',         to_char(wl.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
              'verified_via',       wl.verified_via,
              'flag_status',        wl.flag_status,
              'flag_reason',        wl.flag_reason,
              'flag_response',      wl.flag_response,
              'flagged_by',         wl.flagged_by,
              'decision_by',        wl.decision_by,
              'decision_at',        case when wl.decision_at is null then null else to_char(wl.decision_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
              'reactions',          coalesce(
                                      (
                                        select jsonb_object_agg(r2.emoji, r2.reactor_names)
                                        from (
                                          select
                                            r.emoji,
                                            jsonb_agg(r.reactor_display_name order by r.created_at) as reactor_names
                                          from ante_core.workout_reactions r
                                          where r.workout_log_id = wl.id
                                          group by r.emoji
                                        ) r2
                                      ),
                                      '{}'::jsonb
                                    )
            )
            order by wl.created_at asc
          ),
          '[]'::jsonb
        )
        from ante_core.workout_logs wl
        where wl.season_id = s.id
      ) as logs
    from ante_core.seasons s
    join ante_core.blocs b on b.id = s.bloc_id
    where s.status = 'closed'
      and b.legacy_group_key is not null
  ) as season_row;

  return result;
end;
$function$;

-- 5. Commenting: the Bloc chat card carries the activity. Replaced in place.
create or replace function public.insert_ante_core_workout_log_comment(
  p_legacy_group_key text,
  p_auth_user_id text,
  p_workout_log_id text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path to 'ante_core', 'public'
as $function$
declare
  v_bloc_id uuid;
  v_commenter_profile_id uuid;
  v_commenter_display_name text;
  v_workout_log_id text := trim(coalesce(p_workout_log_id, ''));
  v_body text := trim(coalesce(p_body, ''));
  v_comment_id uuid;
  v_comment_count integer;
  v_latest_comment jsonb;
  v_log_payload jsonb;
  v_message_id uuid;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    raise exception 'legacy group key is required' using errcode = '22023';
  end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then
    raise exception 'commenter is required' using errcode = '22023';
  end if;
  if v_workout_log_id = '' then
    raise exception 'workout log is required' using errcode = '22023';
  end if;
  if v_body = '' then
    raise exception 'comment body is required' using errcode = '22023';
  end if;

  select b.id into v_bloc_id
  from ante_core.blocs b
  where b.legacy_group_key = trim(p_legacy_group_key);

  select p.id, p.display_name into v_commenter_profile_id, v_commenter_display_name
  from ante_core.profiles p
  where p.auth_user_id = trim(p_auth_user_id)::uuid;

  if v_bloc_id is null or v_commenter_profile_id is null then
    raise exception 'bloc or commenter not found' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from ante_core.bloc_members bm
    where bm.bloc_id = v_bloc_id
      and bm.profile_id = v_commenter_profile_id
      and bm.left_at is null
  ) then
    raise exception 'not a bloc member' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from ante_core.workout_logs wl
    where wl.id = v_workout_log_id
      and wl.bloc_id = v_bloc_id
  ) then
    raise exception 'workout log not found' using errcode = '22023';
  end if;

  insert into ante_core.workout_log_comments (
    workout_log_id,
    commenter_profile_id,
    commenter_display_name,
    body
  )
  values (
    v_workout_log_id,
    v_commenter_profile_id,
    coalesce(nullif(trim(v_commenter_display_name), ''), 'Member'),
    left(v_body, 1000)
  )
  returning id into v_comment_id;

  select count(*)::integer into v_comment_count
  from ante_core.workout_log_comments c
  where c.workout_log_id = v_workout_log_id;

  select jsonb_build_object(
    'id', c.id::text,
    'logId', c.workout_log_id,
    'commenterUserId', commenter.auth_user_id::text,
    'commenterName', c.commenter_display_name,
    'body', c.body,
    'createdAt', c.created_at
  ) into v_latest_comment
  from ante_core.workout_log_comments c
  left join ante_core.profiles commenter on commenter.id = c.commenter_profile_id
  where c.id = v_comment_id;

  select jsonb_build_object(
    'id', wl.id,
    'ownerDisplayName', wl.owner_display_name,
    'workoutDate', to_char(wl.workout_date, 'YYYY-MM-DD'),
    'workoutType', wl.workout_type,
    'activity', wl.activity,
    'note', wl.note,
    'photoUrl', wl.photo_url,
    'createdAt', wl.created_at,
    'verifiedVia', wl.verified_via,
    'commentCount', v_comment_count,
    'latestComment', v_latest_comment
  ) into v_log_payload
  from ante_core.workout_logs wl
  where wl.id = v_workout_log_id;

  delete from ante_core.bloc_messages
  where bloc_id = v_bloc_id
    and message_type = 'log_comment'
    and idempotency_key = 'log_comment:' || v_workout_log_id;

  insert into ante_core.bloc_messages (
    bloc_id,
    message_type,
    author_profile_id,
    body,
    payload,
    idempotency_key,
    created_at
  )
  values (
    v_bloc_id,
    'log_comment',
    null,
    '',
    v_log_payload,
    'log_comment:' || v_workout_log_id,
    now()
  )
  returning id into v_message_id;

  return jsonb_build_object(
    'comment', v_latest_comment,
    'commentCount', v_comment_count,
    'streamMessageId', v_message_id::text
  );
end;
$function$;

commit;

-- PostgREST must see the new upsert signature.
notify pgrst, 'reload schema';
