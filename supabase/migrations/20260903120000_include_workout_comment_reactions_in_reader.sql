-- The comment-reaction write RPC was introduced after the original comment
-- reader. The original reader consequently returns every comment with no
-- reactions, which makes a successfully saved reaction disappear at refresh.
-- This is an additive reader replacement; it does not alter existing comments
-- or reaction rows.
create or replace function public.read_ante_core_workout_log_comments(
  p_legacy_group_key text,
  p_auth_user_id text,
  p_workout_log_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_profile_id uuid;
  v_workout_log_id text := trim(coalesce(p_workout_log_id, ''));
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then return '[]'::jsonb; end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then return '[]'::jsonb; end if;
  if v_workout_log_id = '' then return '[]'::jsonb; end if;

  select b.id into v_bloc_id from ante_core.blocs b where b.legacy_group_key = trim(p_legacy_group_key);
  select p.id into v_profile_id from ante_core.profiles p where p.auth_user_id = trim(p_auth_user_id)::uuid;
  if v_bloc_id is null or v_profile_id is null then return '[]'::jsonb; end if;

  if not exists (
    select 1 from ante_core.bloc_members bm
    where bm.bloc_id = v_bloc_id and bm.profile_id = v_profile_id and bm.left_at is null
  ) then
    raise exception 'not a bloc member' using errcode = '42501';
  end if;

  if not exists (select 1 from ante_core.workout_logs wl where wl.id = v_workout_log_id and wl.bloc_id = v_bloc_id) then
    return '[]'::jsonb;
  end if;

  return coalesce((
    with reaction_rows as (
      select r.comment_id, r.emoji,
        jsonb_agg(p.auth_user_id::text order by r.created_at asc, p.auth_user_id::text) as user_ids
      from ante_core.workout_log_comment_reactions r
      join ante_core.profiles p on p.id = r.reactor_profile_id
      join ante_core.workout_log_comments c on c.id = r.comment_id
      where c.workout_log_id = v_workout_log_id
      group by r.comment_id, r.emoji
    ), reactions_by_comment as (
      select comment_id, jsonb_object_agg(emoji, user_ids order by emoji) as reactions
      from reaction_rows group by comment_id
    )
    select jsonb_agg(jsonb_build_object(
      'id', c.id::text, 'logId', c.workout_log_id,
      'commenterUserId', commenter.auth_user_id::text,
      'commenterName', c.commenter_display_name, 'body', c.body,
      'reactions', coalesce(rbc.reactions, '{}'::jsonb), 'createdAt', c.created_at
    ) order by c.created_at asc, c.id asc)
    from ante_core.workout_log_comments c
    left join ante_core.profiles commenter on commenter.id = c.commenter_profile_id
    left join reactions_by_comment rbc on rbc.comment_id = c.id
    where c.workout_log_id = v_workout_log_id
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.read_ante_core_workout_log_comments(text, text, text) from public;
revoke execute on function public.read_ante_core_workout_log_comments(text, text, text) from anon;
revoke execute on function public.read_ante_core_workout_log_comments(text, text, text) from authenticated;
grant execute on function public.read_ante_core_workout_log_comments(text, text, text) to service_role;
