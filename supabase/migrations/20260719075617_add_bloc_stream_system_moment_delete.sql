create or replace function public.delete_ante_core_bloc_system_moment(
  p_legacy_group_key text,
  p_idempotency_key text
)
returns integer
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_deleted_count integer := 0;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    return 0;
  end if;
  if p_idempotency_key is null or trim(p_idempotency_key) = '' then
    return 0;
  end if;

  select b.id into v_bloc_id
  from ante_core.blocs b
  where b.legacy_group_key = trim(p_legacy_group_key);

  if v_bloc_id is null then
    return 0;
  end if;

  delete from ante_core.bloc_messages
  where bloc_id = v_bloc_id
    and message_type = 'system'
    and idempotency_key = trim(p_idempotency_key);

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

revoke execute on function public.delete_ante_core_bloc_system_moment(text, text) from public;
revoke execute on function public.delete_ante_core_bloc_system_moment(text, text) from anon;
revoke execute on function public.delete_ante_core_bloc_system_moment(text, text) from authenticated;
grant execute on function public.delete_ante_core_bloc_system_moment(text, text) to service_role;;
