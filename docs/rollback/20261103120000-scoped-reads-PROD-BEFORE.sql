-- Production definitions as they stood immediately BEFORE
-- 20261103120000_scope_readers_to_member_blocs.sql was applied, 5 Nov 2026.
--
-- Captured with pg_get_functiondef from project bpvvvqjsfwmmfjvvijkd, not
-- transcribed from the repo, so this is what was genuinely running. Run both
-- statements to undo that migration, then:
--
--   drop function if exists public.read_ante_core_member_bloc_keys(uuid);
--
-- Tracked in git on purpose: the capture lived in migration-output/, which is
-- gitignored, so the only copy of the pre-change definitions was on one laptop.
-- The founder works from more than one.

drop function if exists public.read_ante_core_month_history(text[]);

CREATE OR REPLACE FUNCTION public.read_ante_core_month_history()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ante_core', 'public'
AS $function$
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
$function$


drop function if exists public.read_ante_core_current_logs(text[]);

CREATE OR REPLACE FUNCTION public.read_ante_core_current_logs()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ante_core', 'public'
AS $function$
declare
  result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'legacy_group_key', b.legacy_group_key, 'id', wl.id,
    'owner_display_name', wl.owner_display_name,
    'workout_date', to_char(wl.workout_date, 'YYYY-MM-DD'),
    'workout_type', wl.workout_type, 'activity', wl.activity,
    'note', wl.note, 'photo_url', wl.photo_url,
    'created_at', to_char(wl.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'verified_via', wl.verified_via, 'flag_status', wl.flag_status,
    'flag_reason', wl.flag_reason, 'flag_response', wl.flag_response,
    'flagged_by', wl.flagged_by, 'decision_by', wl.decision_by,
    'decision_at', case when wl.decision_at is null then null else to_char(wl.decision_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'reactions', coalesce((
      select jsonb_object_agg(r2.emoji, r2.reactor_names)
      from (
        select r.emoji, jsonb_agg(r.reactor_display_name order by r.created_at) as reactor_names
        from ante_core.workout_reactions r where r.workout_log_id = wl.id group by r.emoji
      ) r2
    ), '{}'::jsonb),
    -- The single most recently added reaction. Ties break on emoji so the
    -- answer is the same every read rather than whichever row came back first.
    'latest_reaction', (
      select jsonb_build_object(
        'emoji', lr.emoji,
        'at', to_char(lr.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
      from ante_core.workout_reactions lr
      where lr.workout_log_id = wl.id
      order by lr.created_at desc, lr.emoji asc
      limit 1
    ),
    'comment_count', (select count(*)::integer from ante_core.workout_log_comments c where c.workout_log_id = wl.id and c.moderation_hidden_at is null)
  ) order by wl.created_at asc), '[]'::jsonb)
  into result
  from ante_core.workout_logs wl
  join ante_core.seasons s on s.id = wl.season_id
  join ante_core.blocs b on b.id = wl.bloc_id
  where s.status = 'open' and b.legacy_group_key is not null and wl.moderation_hidden_at is null;
  return result;
end;
$function$

