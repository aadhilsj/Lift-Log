create or replace function public.read_ante_core_bloc_stream_unread_count(
  p_legacy_group_key text,
  p_auth_user_id text
)
returns integer
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_profile_id uuid;
  v_last_read_at timestamptz;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    return 0;
  end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then
    return 0;
  end if;

  select b.id into v_bloc_id
  from ante_core.blocs b
  where b.legacy_group_key = trim(p_legacy_group_key);

  select p.id into v_profile_id
  from ante_core.profiles p
  where p.auth_user_id = trim(p_auth_user_id)::uuid;

  if v_bloc_id is null or v_profile_id is null then
    return 0;
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

  select r.last_read_at into v_last_read_at
  from ante_core.bloc_message_reads r
  where r.bloc_id = v_bloc_id
    and r.profile_id = v_profile_id;

  return (
    select count(*)::integer
    from ante_core.bloc_messages m
    where m.bloc_id = v_bloc_id
      and m.created_at > coalesce(v_last_read_at, '-infinity'::timestamptz)
      and (m.author_profile_id is null or m.author_profile_id <> v_profile_id)
  );
end;
$$;

revoke execute on function public.read_ante_core_bloc_stream_unread_count(text, text) from public;
revoke execute on function public.read_ante_core_bloc_stream_unread_count(text, text) from anon;
revoke execute on function public.read_ante_core_bloc_stream_unread_count(text, text) from authenticated;
grant execute on function public.read_ante_core_bloc_stream_unread_count(text, text) to service_role;;
