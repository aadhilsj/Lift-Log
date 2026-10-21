-- The notification centre shows "2 comments on your Gym Log" and now wants to
-- show what the newest one actually said, and who wrote it.
--
-- One call for every log, not one call per log. Fero already reads too much on
-- every refresh (docs/scaling-before-launch-2026-09-15.md), so a notification
-- centre that fired a request per workout would be making that worse. This
-- takes the same batched shape as read_ante_core_workout_log_comment_counts,
-- with the same membership check and the same moderation filter.
--
-- Read-only. Returns { "<workout_log_id>": { commenterName, commenterUserId,
-- body, createdAt, total } }, newest comment per log.

create or replace function public.read_ante_core_workout_log_latest_comments(
  p_legacy_group_key text,
  p_auth_user_id text,
  p_workout_log_ids text[] default array[]::text[]
)
returns jsonb
language plpgsql
security definer
set search_path to 'ante_core', 'public'
as $function$
declare
  v_bloc_id uuid;
  v_profile_id uuid;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then return '{}'::jsonb; end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then return '{}'::jsonb; end if;

  select b.id into v_bloc_id from ante_core.blocs b where b.legacy_group_key = trim(p_legacy_group_key);
  select p.id into v_profile_id from ante_core.profiles p where p.auth_user_id = trim(p_auth_user_id)::uuid;
  if v_bloc_id is null or v_profile_id is null then return '{}'::jsonb; end if;

  if not exists (
    select 1 from ante_core.bloc_members bm
    where bm.bloc_id = v_bloc_id and bm.profile_id = v_profile_id and bm.left_at is null
  ) then
    raise exception 'not a bloc member' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_object_agg(latest.workout_log_id, jsonb_build_object(
      'commenterName', latest.commenter_display_name,
      'commenterUserId', latest.commenter_auth_user_id,
      'body', latest.body,
      'createdAt', latest.created_at,
      'total', latest.total
    ))
    from (
      select distinct on (c.workout_log_id)
        c.workout_log_id,
        c.commenter_display_name,
        commenter.auth_user_id::text as commenter_auth_user_id,
        c.body,
        c.created_at,
        count(*) over (partition by c.workout_log_id)::integer as total
      from ante_core.workout_log_comments c
      join ante_core.workout_logs wl on wl.id = c.workout_log_id
      left join ante_core.profiles commenter on commenter.id = c.commenter_profile_id
      where wl.bloc_id = v_bloc_id
        and wl.moderation_hidden_at is null
        and c.moderation_hidden_at is null
        and (coalesce(array_length(p_workout_log_ids, 1), 0) = 0 or c.workout_log_id = any(p_workout_log_ids))
      order by c.workout_log_id, c.created_at desc, c.id desc
    ) latest
  ), '{}'::jsonb);
end;
$function$;

-- Server-side only, like every other ante_core reader: the API calls it with
-- the service key and does its own auth first.
revoke execute on function public.read_ante_core_workout_log_latest_comments(text, text, text[]) from public;
revoke execute on function public.read_ante_core_workout_log_latest_comments(text, text, text[]) from anon;
revoke execute on function public.read_ante_core_workout_log_latest_comments(text, text, text[]) from authenticated;
grant execute on function public.read_ante_core_workout_log_latest_comments(text, text, text[]) to service_role;
