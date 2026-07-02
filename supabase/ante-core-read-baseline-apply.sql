-- Canonical read baseline apply bundle.
-- Purpose: install all service_role-only ante_core read RPCs required by
-- canonical-first GET composition in api/lift-log.js.
--
-- Safe intent:
-- - additive / idempotent function replacement only
-- - no table mutation
-- - no data deletion

create or replace function public.read_ante_core_blocs()
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'legacy_group_key',       b.legacy_group_key,
        'name',                   b.name,
        'invite_code',            b.invite_code,
        'created_at',             b.created_at,
        'sort_order',             b.sort_order,
        'time_zone',              b.time_zone,
        'currency',               b.currency,
        'min_target',             b.min_target,
        'fine_amount',            b.fine_amount,
        'fee_model',              b.fee_model::text,
        'escalation_step_amount', b.escalation_step_amount,
        'min_run_distance',       b.min_run_distance,
        'distance_unit',          b.distance_unit,
        'strava_enabled',         b.strava_enabled,
        'accepted_workout_types', b.accepted_workout_types
      )
    ),
    '[]'::jsonb
  )
  into result
  from ante_core.blocs b
  where b.legacy_group_key is not null;

  return result;
end;
$$;

revoke execute on function public.read_ante_core_blocs() from public;
revoke execute on function public.read_ante_core_blocs() from anon;
revoke execute on function public.read_ante_core_blocs() from authenticated;
grant execute on function public.read_ante_core_blocs() to service_role;

create or replace function public.read_ante_core_bloc_members()
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'legacy_group_key', b.legacy_group_key,
        'auth_user_id',     p.auth_user_id::text,
        'display_name',     bm.display_name_snapshot,
        'role',             bm.role::text,
        'joined_at',        bm.joined_at,
        'joined_month_key', bm.joined_month_key,
        'sort_order',       bm.sort_order
      )
    ),
    '[]'::jsonb
  )
  into result
  from ante_core.bloc_members bm
  join ante_core.profiles p
    on p.id = bm.profile_id
  join ante_core.blocs b
    on b.id = bm.bloc_id
  where bm.left_at is null
    and b.legacy_group_key is not null
    and p.auth_user_id is not null;

  return result;
end;
$$;

revoke execute on function public.read_ante_core_bloc_members() from public;
revoke execute on function public.read_ante_core_bloc_members() from anon;
revoke execute on function public.read_ante_core_bloc_members() from authenticated;
grant execute on function public.read_ante_core_bloc_members() to service_role;

create or replace function public.read_ante_core_profiles()
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id',      coalesce(p.auth_user_id::text, p.legacy_user_key),
        'email',        p.email,
        'display_name', p.display_name,
        'created_at',   p.created_at
      )
    ),
    '[]'::jsonb
  )
  into result
  from ante_core.profiles p
  where p.auth_user_id is not null
     or p.legacy_user_key is not null;

  return result;
end;
$$;

revoke execute on function public.read_ante_core_profiles() from public;
revoke execute on function public.read_ante_core_profiles() from anon;
revoke execute on function public.read_ante_core_profiles() from authenticated;
grant execute on function public.read_ante_core_profiles() to service_role;

create or replace function public.read_ante_core_current_logs()
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
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
    and b.legacy_group_key is not null
  order by wl.created_at asc;

  return result;
end;
$$;

revoke execute on function public.read_ante_core_current_logs() from public;
revoke execute on function public.read_ante_core_current_logs() from anon;
revoke execute on function public.read_ante_core_current_logs() from authenticated;
grant execute on function public.read_ante_core_current_logs() to service_role;

create or replace function public.read_ante_core_current_excused_and_sitouts()
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_excused jsonb;
  v_sitouts jsonb;
  v_open_seasons jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'legacy_group_key', b.legacy_group_key,
        'month_key',        s.month_key,
        'display_name',     sms.display_name_snapshot,
        'excused',          sms.excused
      )
    ),
    '[]'::jsonb
  )
  into v_excused
  from ante_core.season_member_status sms
  join ante_core.seasons s
    on s.id = sms.season_id
  join ante_core.blocs b
    on b.id = s.bloc_id
  where s.status = 'open'
    and b.legacy_group_key is not null
    and sms.excused = true;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'legacy_group_key',        b.legacy_group_key,
        'month_key',               s.month_key,
        'display_name',            sor.display_name_snapshot,
        'status',                  case sor.status::text
                                     when 'denied' then 'declined'
                                     else sor.status::text
                                   end,
        'reason',                  sor.reason,
        'exceptional',             sor.exceptional,
        'requested_at',            case
                                     when sor.requested_at is null then null
                                     else to_char(sor.requested_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                                   end,
        'requested_by',            sor.requested_by,
        'requested_by_user_id',    rp.auth_user_id::text,
        'target_approver_name',    sor.target_approver_name,
        'target_approver_user_id', tp.auth_user_id::text,
        'decided_at',              case
                                     when sor.decided_at is null then null
                                     else to_char(sor.decided_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                                   end,
        'decided_by',              sor.decided_by,
        'decided_by_user_id',      dp.auth_user_id::text,
        'auto_approved',           sor.auto_approved
      )
    ),
    '[]'::jsonb
  )
  into v_sitouts
  from ante_core.sit_out_requests sor
  join ante_core.seasons s
    on s.id = sor.season_id
  join ante_core.blocs b
    on b.id = sor.bloc_id
  left join ante_core.profiles rp
    on rp.id = sor.requested_by_user_id
  left join ante_core.profiles tp
    on tp.id = sor.target_approver_user_id
  left join ante_core.profiles dp
    on dp.id = sor.decided_by_user_id
  where s.status = 'open'
    and b.legacy_group_key is not null;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'legacy_group_key', b.legacy_group_key,
        'month_key',        s.month_key
      )
    ),
    '[]'::jsonb
  )
  into v_open_seasons
  from ante_core.seasons s
  join ante_core.blocs b
    on b.id = s.bloc_id
  where s.status = 'open'
    and b.legacy_group_key is not null;

  return jsonb_build_object(
    'excused',          v_excused,
    'sit_out_requests', v_sitouts,
    'open_seasons',     v_open_seasons
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
              'workout_count',         sms.workout_count,
              'excused',               sms.excused,
              'joined_for_month',      sms.joined_for_month,
              'settlement_status',     sms.settlement_status,
              'settlement_settled_at', case
                                         when sms.settlement_settled_at is null then null
                                         else to_char(sms.settlement_settled_at, 'YYYY-MM-DD')
                                       end,
              'settlement_updated_at', case
                                         when sms.settlement_updated_at is null then null
                                         else to_char(sms.settlement_updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                                       end
            )
            order by sms.display_name_snapshot
          ),
          '[]'::jsonb
        )
        from ante_core.season_member_status sms
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
        from ante_core.workout_logs wl
        where wl.season_id = s.id
      ) as logs
    from ante_core.seasons s
    join ante_core.blocs b
      on b.id = s.bloc_id
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

create or replace function public.read_ante_core_season_overrides()
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'legacy_group_key',  b.legacy_group_key,
        'month_key',         s.month_key,
        'prorated',          so.prorated,
        'prorated_mas',      so.prorated_mas,
        'chosen_at',         so.chosen_at,
        'chosen_by',         so.chosen_by,
        'chosen_by_user_id', coalesce(p.auth_user_id::text, p.legacy_user_key)
      )
    ),
    '[]'::jsonb
  )
  into result
  from ante_core.season_overrides so
  join ante_core.seasons s
    on s.id = so.season_id
  join ante_core.blocs b
    on b.id = s.bloc_id
  left join ante_core.profiles p
    on p.id = so.chosen_by_user_id
  where b.legacy_group_key is not null;

  return result;
end;
$$;

revoke execute on function public.read_ante_core_season_overrides() from public;
revoke execute on function public.read_ante_core_season_overrides() from anon;
revoke execute on function public.read_ante_core_season_overrides() from authenticated;
grant execute on function public.read_ante_core_season_overrides() to service_role;

create or replace function public.read_ante_core_settlement_confirmations()
returns jsonb
language sql
security definer
set search_path = ante_core, public
as '
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        ''id'', sc.id,
        ''legacy_group_key'', b.legacy_group_key,
        ''bloc_id'', sc.bloc_id,
        ''season_id'', sc.season_id,
        ''month_key'', s.month_key,
        ''month_label'', s.label,
        ''payer_auth_user_id'', case
          when payer.auth_user_id is null then null
          else payer.auth_user_id::text
        end,
        ''receiver_auth_user_id'', case
          when receiver.auth_user_id is null then null
          else receiver.auth_user_id::text
        end,
        ''payer_display_name'', sc.payer_display_name_snapshot,
        ''receiver_display_name'', sc.receiver_display_name_snapshot,
        ''amount'', sc.amount,
        ''currency'', sc.currency,
        ''payer_claimed_at'', case
          when sc.payer_claimed_at is null then null
          else to_char(sc.payer_claimed_at at time zone ''UTC'', ''YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'')
        end,
        ''confirmed_at'', case
          when sc.confirmed_at is null then null
          else to_char(sc.confirmed_at at time zone ''UTC'', ''YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'')
        end,
        ''created_at'', to_char(sc.created_at at time zone ''UTC'', ''YYYY-MM-DD"T"HH24:MI:SS.MS"Z"''),
        ''updated_at'', to_char(sc.updated_at at time zone ''UTC'', ''YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'')
      )
      order by s.month_key desc, sc.created_at asc
    ),
    ''[]''::jsonb
  )
  from ante_core.settlement_confirmations sc
  join ante_core.seasons s
    on s.id = sc.season_id
  join ante_core.blocs b
    on b.id = sc.bloc_id
  join ante_core.profiles payer
    on payer.id = sc.payer_profile_id
  join ante_core.profiles receiver
    on receiver.id = sc.receiver_profile_id
  where b.legacy_group_key is not null;
';

revoke execute on function public.read_ante_core_settlement_confirmations() from public;
revoke execute on function public.read_ante_core_settlement_confirmations() from anon;
revoke execute on function public.read_ante_core_settlement_confirmations() from authenticated;
grant execute on function public.read_ante_core_settlement_confirmations() to service_role;
