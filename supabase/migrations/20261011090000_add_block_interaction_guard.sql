-- Blocking is one-way: `read_ante_core_user_blocks` answers "who have I
-- blocked", and the client hides them. That alone lets a blocked member keep
-- commenting on and reacting to the blocker's workouts, visible to everyone
-- else in the Bloc while the blocker cannot see it happening.
--
-- These two read-only lookups let the application server refuse that
-- interaction. Deliberately additive: no existing function is modified, so a
-- mistake here can at worst fail a comment, never corrupt a write path that
-- every member uses many times a day.

-- Everyone who has blocked this person, as auth user ids. The reverse of
-- read_ante_core_user_blocks, and served by the existing
-- ante_core_user_blocks_blocked_profile_idx index.
create or replace function public.read_ante_core_blockers_of(p_auth_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_profile_id uuid;
begin
  if nullif(trim(coalesce(p_auth_user_id, '')), '') is null then
    return '[]'::jsonb;
  end if;

  select p.id into v_profile_id
  from ante_core.profiles p
  where p.auth_user_id = trim(p_auth_user_id)::uuid;

  if v_profile_id is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(blocker.auth_user_id::text order by b.created_at desc)
    from ante_core.user_blocks b
    join ante_core.profiles blocker on blocker.id = b.blocker_profile_id
    where b.blocked_profile_id = v_profile_id
  ), '[]'::jsonb);
end;
$$;

-- A comment's author, as an auth user id. Reacting to a comment is an
-- interaction with its author, and the reaction call carries only the comment
-- id, so the server needs this to apply the guard.
create or replace function public.read_ante_core_workout_log_comment_author(p_comment_id uuid)
returns text
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_auth_user_id text;
begin
  if p_comment_id is null then return null; end if;

  select p.auth_user_id::text into v_auth_user_id
  from ante_core.workout_log_comments c
  join ante_core.profiles p on p.id = c.commenter_profile_id
  where c.id = p_comment_id;

  return v_auth_user_id;
end;
$$;

revoke all on function public.read_ante_core_blockers_of(text) from public, anon, authenticated;
revoke all on function public.read_ante_core_workout_log_comment_author(uuid) from public, anon, authenticated;
grant execute on function public.read_ante_core_blockers_of(text) to service_role;
grant execute on function public.read_ante_core_workout_log_comment_author(uuid) to service_role;
