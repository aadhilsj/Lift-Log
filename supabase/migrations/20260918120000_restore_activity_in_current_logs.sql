-- Put `activity` back into the current-month log reader.
--
-- 20260918100000_add_workout_post_moderation (App Store work, applied to
-- production 2026-09-18 04:06 UTC) replaced read_ante_core_current_logs from a
-- copy older than 20260916090000_add_workout_log_activity, so the activity key
-- was dropped. Every current-month workout then reached the app without its
-- activity and showed only its category (Sports, Other...).
--
-- This is the live definition at 2026-09-18 with exactly one addition:
-- 'activity', wl.activity. The moderation filter is kept. CREATE OR REPLACE
-- keeps the existing grants (service_role and postgres only).

create or replace function public.read_ante_core_current_logs()
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
  where s.status = 'open' and b.legacy_group_key is not null and wl.moderation_hidden_at is null;
  return result;
end;
$function$;
