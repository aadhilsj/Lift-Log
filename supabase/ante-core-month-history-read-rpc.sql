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
              'auth_user_id',          case
                                         when p.auth_user_id is null then null
                                         else p.auth_user_id::text
                                       end,
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
        left join ante_core.profiles p
          on p.id = sms.profile_id
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
