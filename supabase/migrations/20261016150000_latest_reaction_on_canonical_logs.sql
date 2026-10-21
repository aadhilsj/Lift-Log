-- The "For you" badge shows the emoji the most people chose. The founder asked
-- for the one most recently used.
--
-- Why it could not be done before (docs/handover-2026-10-15-session-catch-up.md
-- §2.8): `ante_core.workout_reactions` carries `created_at`, but the shape both
-- of these functions return is `{emoji: [names]}`. The names are ordered within
-- an emoji; the timestamps are not returned at all, and `jsonb` sorts object
-- keys, so recency cannot survive the trip to the client.
--
-- The smallest fix is a SIBLING field, not a new reactions shape. `reactions`
-- here is byte-for-byte what it was: `normalizeReactions` in `api/lift-log.js`,
-- the optimistic reaction updates in `App.jsx` and the Activity feed all depend
-- on `{emoji: [names]}`, and changing it would touch every one of them.
--
--   'latest_reaction': { "emoji": "💪", "at": "2026-10-16T09:12:04.731Z" }
--
-- It is null when a log has no reactions, which the client already treats as
-- "fall back to the emoji the most people chose".
--
-- On cost, because Fero's pre-launch problem is read volume
-- (docs/scaling-before-launch-2026-09-15.md): this is ONE extra subquery per
-- log, `order by created_at desc limit 1`, matched on the primary key's leading
-- column `workout_log_id` and then sorting the handful of rows for that one
-- log. The whole table is 1,919 rows. The existing `reactions` subquery is
-- untouched, so nothing already paid for is paid for twice.
--
-- Both functions get it. `read_ante_core_logs_for_month` is documented as the
-- mirror of `read_ante_core_current_logs` and only the month close reads it, so
-- the notification centre never sees its rows -- but letting the two diverge
-- would leave a trap for whoever reads one and assumes the other matches.
--
-- Additive and backward compatible: an older server ignores a field it does not
-- read. Grants are re-stated to match exactly what was there before --
-- service_role only, never anon or authenticated.

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
$function$;

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
  where s.month_key = p_month_key and b.legacy_group_key is not null and wl.moderation_hidden_at is null;
  return result;
end;
$function$;

revoke all on function public.read_ante_core_current_logs() from public;
revoke all on function public.read_ante_core_current_logs() from anon;
revoke all on function public.read_ante_core_current_logs() from authenticated;
grant execute on function public.read_ante_core_current_logs() to service_role;

revoke all on function public.read_ante_core_logs_for_month(text) from public;
revoke all on function public.read_ante_core_logs_for_month(text) from anon;
revoke all on function public.read_ante_core_logs_for_month(text) from authenticated;
grant execute on function public.read_ante_core_logs_for_month(text) to service_role;
