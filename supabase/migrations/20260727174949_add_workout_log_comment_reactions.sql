create table if not exists ante_core.workout_log_comment_reactions (
  comment_id uuid not null references ante_core.workout_log_comments(id) on delete cascade,
  reactor_profile_id uuid references ante_core.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (comment_id, reactor_profile_id, emoji)
);

create index if not exists ante_core_workout_log_comment_reactions_profile_idx
  on ante_core.workout_log_comment_reactions (reactor_profile_id);

do $$
begin
  begin
    alter publication supabase_realtime add table ante_core.workout_log_comment_reactions;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

create or replace function public.toggle_ante_core_workout_log_comment_reaction(
  p_legacy_group_key text,
  p_auth_user_id text,
  p_comment_id text,
  p_emoji text,
  p_is_adding boolean default null
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_profile_id uuid;
  v_comment_id uuid;
  v_emoji text := left(trim(coalesce(p_emoji, '')), 16);
  v_exists boolean;
  v_is_adding boolean;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    raise exception 'legacy group key is required' using errcode = '22023';
  end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then
    raise exception 'reactor is required' using errcode = '22023';
  end if;
  if p_comment_id is null or trim(p_comment_id) = '' then
    raise exception 'comment is required' using errcode = '22023';
  end if;
  if v_emoji = '' then
    raise exception 'emoji is required' using errcode = '22023';
  end if;

  select b.id into v_bloc_id
  from ante_core.blocs b
  where b.legacy_group_key = trim(p_legacy_group_key);

  select p.id into v_profile_id
  from ante_core.profiles p
  where p.auth_user_id = trim(p_auth_user_id)::uuid;

  if v_bloc_id is null or v_profile_id is null then
    raise exception 'bloc or reactor not found' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from ante_core.bloc_members bm
    where bm.bloc_id = v_bloc_id
      and bm.profile_id = v_profile_id
      and bm.left_at is null
  ) then
    raise exception 'not a bloc member' using errcode = '42501';
  end if;

  select c.id into v_comment_id
  from ante_core.workout_log_comments c
  join ante_core.workout_logs wl on wl.id = c.workout_log_id
  where c.id = trim(p_comment_id)::uuid
    and wl.bloc_id = v_bloc_id;

  if v_comment_id is null then
    raise exception 'comment not found' using errcode = '22023';
  end if;

  select exists (
    select 1
    from ante_core.workout_log_comment_reactions r
    where r.comment_id = v_comment_id
      and r.reactor_profile_id = v_profile_id
      and r.emoji = v_emoji
  ) into v_exists;

  v_is_adding := coalesce(p_is_adding, not v_exists);

  if v_is_adding then
    insert into ante_core.workout_log_comment_reactions (comment_id, reactor_profile_id, emoji)
    values (v_comment_id, v_profile_id, v_emoji)
    on conflict (comment_id, reactor_profile_id, emoji) do nothing;
  else
    delete from ante_core.workout_log_comment_reactions
    where comment_id = v_comment_id
      and reactor_profile_id = v_profile_id
      and emoji = v_emoji;
  end if;
end;
$$;

revoke execute on function public.toggle_ante_core_workout_log_comment_reaction(text, text, text, text, boolean) from public;
revoke execute on function public.toggle_ante_core_workout_log_comment_reaction(text, text, text, text, boolean) from anon;
revoke execute on function public.toggle_ante_core_workout_log_comment_reaction(text, text, text, text, boolean) from authenticated;
grant execute on function public.toggle_ante_core_workout_log_comment_reaction(text, text, text, text, boolean) to service_role;;
