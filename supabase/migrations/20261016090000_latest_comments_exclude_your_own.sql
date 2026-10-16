-- Your own replies are not news to you.
--
-- The notification centre read "Aadhil and 1 other commented on your Gym Log"
-- on the founder's own Bloc, where Aadhil is the founder: his own reply to
-- somebody else's comment was being counted, and was the newest, so it was
-- also the one being quoted back at him.
--
-- The viewer is already identified here, so the honest place to drop their own
-- comments is in the count and the "latest" pick, not in the client. `total`
-- now means "comments by other people", and a log where the only comments are
-- yours returns nothing at all.
--
-- Replaces the function added in 20261016060000. Read-only, same guards, same
-- grants.

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
        -- Everything above this line is unchanged; this is the whole fix.
        and c.commenter_profile_id is distinct from v_profile_id
        and (coalesce(array_length(p_workout_log_ids, 1), 0) = 0 or c.workout_log_id = any(p_workout_log_ids))
      order by c.workout_log_id, c.created_at desc, c.id desc
    ) latest
  ), '{}'::jsonb);
end;
$function$;

revoke execute on function public.read_ante_core_workout_log_latest_comments(text, text, text[]) from public;
revoke execute on function public.read_ante_core_workout_log_latest_comments(text, text, text[]) from anon;
revoke execute on function public.read_ante_core_workout_log_latest_comments(text, text, text[]) from authenticated;
grant execute on function public.read_ante_core_workout_log_latest_comments(text, text, text[]) to service_role;
