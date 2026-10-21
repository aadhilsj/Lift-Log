-- Month close reads the logs of the month it is closing, not the open season.
--
-- read_ante_core_current_logs() filters `s.status = 'open'`. The canonical
-- rollover closes September and opens October before the blob rollover runs,
-- so by the time the month close asks for logs the only open season is the new
-- one, which is empty. rebuildClosedMonthSnapshotFromCanonicalLogs then sees
-- zero rows against a blob that counted workouts, correctly refuses to freeze
-- the month, and the Bloc is skipped and retried forever. On 1 October 2026
-- that was 745 skips in a day across nine Blocs.
--
-- This is additive: read_ante_core_current_logs is unchanged and still serves
-- the live month. Grants match it exactly -- service_role only, never anon or
-- authenticated.
create or replace function public.read_ante_core_logs_for_month(p_month_key text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'ante_core', 'public'
as $function$
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
    'comment_count', (select count(*)::integer from ante_core.workout_log_comments c where c.workout_log_id = wl.id and c.moderation_hidden_at is null)
  ) order by wl.created_at asc), '[]'::jsonb)
  into result
  from ante_core.workout_logs wl
  join ante_core.seasons s on s.id = wl.season_id
  join ante_core.blocs b on b.id = wl.bloc_id
  where s.month_key = p_month_key and b.legacy_group_key is not null and wl.moderation_hidden_at is null;
  return result;
end;
$function$;

revoke all on function public.read_ante_core_logs_for_month(text) from public;
revoke all on function public.read_ante_core_logs_for_month(text) from anon;
revoke all on function public.read_ante_core_logs_for_month(text) from authenticated;
grant execute on function public.read_ante_core_logs_for_month(text) to service_role;
