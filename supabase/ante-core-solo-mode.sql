-- Solo Mode canonical support.
--
-- Solo is separate from sit-out:
--   - the member still logs workouts
--   - the member is excluded from month stakes/settlements
--   - every request requires admin approval

alter table ante_core.season_member_status
  add column if not exists solo boolean not null default false,
  add column if not exists solo_target integer;

create table if not exists ante_core.solo_requests (
  id uuid primary key default gen_random_uuid(),
  bloc_id uuid not null references ante_core.blocs(id) on delete cascade,
  season_id uuid not null references ante_core.seasons(id) on delete cascade,
  profile_id uuid references ante_core.profiles(id) on delete set null,
  display_name_snapshot text not null,
  status ante_core.sit_out_request_status not null default 'pending',
  reason text not null default '',
  exceptional boolean not null default false,
  personal_target integer not null,
  requested_at timestamptz,
  requested_by text not null,
  requested_by_user_id uuid references ante_core.profiles(id) on delete set null,
  target_approver_name text,
  target_approver_user_id uuid references ante_core.profiles(id) on delete set null,
  decided_at timestamptz,
  decided_by text,
  decided_by_user_id uuid references ante_core.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, display_name_snapshot)
);

create index if not exists ante_core_solo_requests_bloc_season_idx
  on ante_core.solo_requests (bloc_id, season_id);

create or replace function public.upsert_ante_core_season_member_solo(
  p_legacy_group_key text,
  p_month_key        text,
  p_display_name     text,
  p_auth_user_id     text,
  p_solo_target      integer
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
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then return; end if;
  if p_month_key is null or trim(p_month_key) = '' then return; end if;
  if p_display_name is null or trim(p_display_name) = '' then return; end if;
  if p_solo_target is null or p_solo_target < 1 then return; end if;

  select id into v_bloc_id
  from ante_core.blocs
  where legacy_group_key = trim(p_legacy_group_key);
  if v_bloc_id is null then return; end if;

  select id into v_season_id
  from ante_core.seasons
  where bloc_id = v_bloc_id
    and month_key = trim(p_month_key);
  if v_season_id is null then return; end if;

  if p_auth_user_id is not null and trim(p_auth_user_id) <> '' then
    begin
      select id into v_profile_id
      from ante_core.profiles
      where auth_user_id = trim(p_auth_user_id)::uuid;
    exception when others then
      v_profile_id := null;
    end;
  end if;

  insert into ante_core.season_member_status (
    season_id,
    profile_id,
    display_name_snapshot,
    joined_for_month,
    workout_count,
    excused,
    solo,
    solo_target,
    created_at,
    updated_at
  )
  values (
    v_season_id,
    v_profile_id,
    trim(p_display_name),
    true,
    0,
    false,
    true,
    p_solo_target,
    now(),
    now()
  )
  on conflict (season_id, display_name_snapshot) do update
    set
      solo        = true,
      solo_target = excluded.solo_target,
      excused     = false,
      profile_id  = coalesce(excluded.profile_id, ante_core.season_member_status.profile_id),
      updated_at  = now();
end;
$$;

revoke execute on function public.upsert_ante_core_season_member_solo(text, text, text, text, integer) from public;
revoke execute on function public.upsert_ante_core_season_member_solo(text, text, text, text, integer) from anon;
revoke execute on function public.upsert_ante_core_season_member_solo(text, text, text, text, integer) from authenticated;
grant execute on function public.upsert_ante_core_season_member_solo(text, text, text, text, integer) to service_role;

create or replace function public.upsert_ante_core_solo_request(
  p_legacy_group_key        text,
  p_month_key               text,
  p_display_name            text,
  p_requested_by_user_id    text,
  p_status                  text,
  p_reason                  text,
  p_exceptional             boolean,
  p_personal_target         integer,
  p_requested_at            timestamptz,
  p_requested_by            text,
  p_target_approver_name    text,
  p_target_approver_user_id text,
  p_decided_at              timestamptz,
  p_decided_by              text,
  p_decided_by_user_id      text
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id                    uuid;
  v_season_id                  uuid;
  v_profile_id                 uuid;
  v_target_approver_profile_id uuid;
  v_decided_by_profile_id      uuid;
  v_status                     ante_core.sit_out_request_status;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then return; end if;
  if p_month_key is null or trim(p_month_key) = '' then return; end if;
  if p_display_name is null or trim(p_display_name) = '' then return; end if;
  if p_personal_target is null or p_personal_target < 1 then return; end if;

  case trim(coalesce(p_status, ''))
    when 'pending'  then v_status := 'pending';
    when 'approved' then v_status := 'approved';
    when 'declined' then v_status := 'denied';
    when 'denied'   then v_status := 'denied';
    else return;
  end case;

  select id into v_bloc_id
  from ante_core.blocs
  where legacy_group_key = trim(p_legacy_group_key);
  if v_bloc_id is null then return; end if;

  select id into v_season_id
  from ante_core.seasons
  where bloc_id = v_bloc_id
    and month_key = trim(p_month_key);
  if v_season_id is null then return; end if;

  if p_requested_by_user_id is not null and trim(p_requested_by_user_id) <> '' then
    begin
      select id into v_profile_id
      from ante_core.profiles
      where auth_user_id = trim(p_requested_by_user_id)::uuid;
    exception when others then
      v_profile_id := null;
    end;
  end if;

  if p_target_approver_user_id is not null and trim(p_target_approver_user_id) <> '' then
    begin
      select id into v_target_approver_profile_id
      from ante_core.profiles
      where auth_user_id = trim(p_target_approver_user_id)::uuid;
    exception when others then
      v_target_approver_profile_id := null;
    end;
  end if;

  if p_decided_by_user_id is not null and trim(p_decided_by_user_id) <> '' then
    begin
      select id into v_decided_by_profile_id
      from ante_core.profiles
      where auth_user_id = trim(p_decided_by_user_id)::uuid;
    exception when others then
      v_decided_by_profile_id := null;
    end;
  end if;

  insert into ante_core.solo_requests (
    bloc_id,
    season_id,
    profile_id,
    display_name_snapshot,
    status,
    reason,
    exceptional,
    personal_target,
    requested_at,
    requested_by,
    requested_by_user_id,
    target_approver_name,
    target_approver_user_id,
    decided_at,
    decided_by,
    decided_by_user_id,
    created_at,
    updated_at
  )
  values (
    v_bloc_id,
    v_season_id,
    v_profile_id,
    trim(p_display_name),
    v_status,
    coalesce(p_reason, ''),
    coalesce(p_exceptional, false),
    p_personal_target,
    p_requested_at,
    nullif(trim(coalesce(p_requested_by, '')), ''),
    v_profile_id,
    nullif(trim(coalesce(p_target_approver_name, '')), ''),
    v_target_approver_profile_id,
    p_decided_at,
    nullif(trim(coalesce(p_decided_by, '')), ''),
    v_decided_by_profile_id,
    now(),
    now()
  )
  on conflict (season_id, display_name_snapshot) do update
    set
      status                  = excluded.status,
      reason                  = excluded.reason,
      exceptional             = excluded.exceptional,
      personal_target         = excluded.personal_target,
      requested_at            = excluded.requested_at,
      requested_by            = excluded.requested_by,
      profile_id              = coalesce(excluded.profile_id, ante_core.solo_requests.profile_id),
      requested_by_user_id    = coalesce(excluded.requested_by_user_id, ante_core.solo_requests.requested_by_user_id),
      target_approver_name    = excluded.target_approver_name,
      target_approver_user_id = coalesce(excluded.target_approver_user_id, ante_core.solo_requests.target_approver_user_id),
      decided_at              = excluded.decided_at,
      decided_by              = excluded.decided_by,
      decided_by_user_id      = coalesce(excluded.decided_by_user_id, ante_core.solo_requests.decided_by_user_id),
      updated_at              = now();
end;
$$;

revoke execute on function public.upsert_ante_core_solo_request(text, text, text, text, text, text, boolean, integer, timestamptz, text, text, text, timestamptz, text, text) from public;
revoke execute on function public.upsert_ante_core_solo_request(text, text, text, text, text, text, boolean, integer, timestamptz, text, text, text, timestamptz, text, text) from anon;
revoke execute on function public.upsert_ante_core_solo_request(text, text, text, text, text, text, boolean, integer, timestamptz, text, text, text, timestamptz, text, text) from authenticated;
grant execute on function public.upsert_ante_core_solo_request(text, text, text, text, text, text, boolean, integer, timestamptz, text, text, text, timestamptz, text, text) to service_role;

create or replace function public.read_ante_core_current_excused_and_sitouts()
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_excused       jsonb;
  v_sitouts       jsonb;
  v_solo          jsonb;
  v_solo_requests jsonb;
  v_open_seasons  jsonb;
begin
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'legacy_group_key', b.legacy_group_key,
      'month_key',        s.month_key,
      'display_name',     sms.display_name_snapshot,
      'excused',          sms.excused
    )),
    '[]'::jsonb
  )
  into v_excused
  from ante_core.season_member_status sms
  join ante_core.seasons s on s.id = sms.season_id
  join ante_core.blocs b on b.id = s.bloc_id
  where s.status = 'open'
    and b.legacy_group_key is not null
    and sms.excused = true;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'legacy_group_key',        b.legacy_group_key,
      'month_key',               s.month_key,
      'display_name',            sor.display_name_snapshot,
      'status',                  case sor.status::text when 'denied' then 'declined' else sor.status::text end,
      'reason',                  sor.reason,
      'exceptional',             sor.exceptional,
      'requested_at',            case when sor.requested_at is null then null else to_char(sor.requested_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
      'requested_by',            sor.requested_by,
      'requested_by_user_id',    rp.auth_user_id::text,
      'target_approver_name',    sor.target_approver_name,
      'target_approver_user_id', tp.auth_user_id::text,
      'decided_at',              case when sor.decided_at is null then null else to_char(sor.decided_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
      'decided_by',              sor.decided_by,
      'decided_by_user_id',      dp.auth_user_id::text,
      'auto_approved',           sor.auto_approved
    )),
    '[]'::jsonb
  )
  into v_sitouts
  from ante_core.sit_out_requests sor
  join ante_core.seasons s on s.id = sor.season_id
  join ante_core.blocs b on b.id = sor.bloc_id
  left join ante_core.profiles rp on rp.id = sor.requested_by_user_id
  left join ante_core.profiles tp on tp.id = sor.target_approver_user_id
  left join ante_core.profiles dp on dp.id = sor.decided_by_user_id
  where s.status = 'open'
    and b.legacy_group_key is not null;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'legacy_group_key', b.legacy_group_key,
      'month_key',        s.month_key,
      'display_name',     sms.display_name_snapshot,
      'solo',             sms.solo,
      'solo_target',      sms.solo_target
    )),
    '[]'::jsonb
  )
  into v_solo
  from ante_core.season_member_status sms
  join ante_core.seasons s on s.id = sms.season_id
  join ante_core.blocs b on b.id = s.bloc_id
  where s.status = 'open'
    and b.legacy_group_key is not null
    and sms.solo = true;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'legacy_group_key',        b.legacy_group_key,
      'month_key',               s.month_key,
      'display_name',            sr.display_name_snapshot,
      'status',                  case sr.status::text when 'denied' then 'declined' else sr.status::text end,
      'reason',                  sr.reason,
      'exceptional',             sr.exceptional,
      'personal_target',         sr.personal_target,
      'requested_at',            case when sr.requested_at is null then null else to_char(sr.requested_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
      'requested_by',            sr.requested_by,
      'requested_by_user_id',    rp.auth_user_id::text,
      'target_approver_name',    sr.target_approver_name,
      'target_approver_user_id', tp.auth_user_id::text,
      'decided_at',              case when sr.decided_at is null then null else to_char(sr.decided_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
      'decided_by',              sr.decided_by,
      'decided_by_user_id',      dp.auth_user_id::text
    )),
    '[]'::jsonb
  )
  into v_solo_requests
  from ante_core.solo_requests sr
  join ante_core.seasons s on s.id = sr.season_id
  join ante_core.blocs b on b.id = sr.bloc_id
  left join ante_core.profiles rp on rp.id = sr.requested_by_user_id
  left join ante_core.profiles tp on tp.id = sr.target_approver_user_id
  left join ante_core.profiles dp on dp.id = sr.decided_by_user_id
  where s.status = 'open'
    and b.legacy_group_key is not null;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'legacy_group_key', b.legacy_group_key,
      'month_key',        s.month_key
    )),
    '[]'::jsonb
  )
  into v_open_seasons
  from ante_core.seasons s
  join ante_core.blocs b on b.id = s.bloc_id
  where s.status = 'open'
    and b.legacy_group_key is not null;

  return jsonb_build_object(
    'excused',           v_excused,
    'sit_out_requests',  v_sitouts,
    'solo',              v_solo,
    'solo_requests',     v_solo_requests,
    'open_seasons',      v_open_seasons
  );
end;
$$;

revoke execute on function public.read_ante_core_current_excused_and_sitouts() from public;
revoke execute on function public.read_ante_core_current_excused_and_sitouts() from anon;
revoke execute on function public.read_ante_core_current_excused_and_sitouts() from authenticated;
grant execute on function public.read_ante_core_current_excused_and_sitouts() to service_role;

create or replace function public.read_ante_core_month_history()
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $fn$
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
$fn$;

revoke execute on function public.read_ante_core_month_history() from public;
revoke execute on function public.read_ante_core_month_history() from anon;
revoke execute on function public.read_ante_core_month_history() from authenticated;
grant execute on function public.read_ante_core_month_history() to service_role;
