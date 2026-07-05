-- Delete RPC for ante_core.blocs.
-- Deletes a single bloc by legacy_group_key (service_role caller).
--
-- Call via: POST /rest/v1/rpc/delete_ante_core_bloc
-- Body:     { "p_legacy_group_key": "..." }
--
-- Cascade behaviour:
--   bloc_members, seasons, season_member_status, settlement_confirmations,
--   workout_logs, workout_reactions, sit_out_requests, season_overrides, and
--   other bloc-owned canonical rows are hard-deleted via ON DELETE CASCADE.
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly denied.

create or replace function public.delete_ante_core_bloc(
  p_legacy_group_key text
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    raise exception 'legacy_group_key is required';
  end if;

  delete from ante_core.blocs
  where legacy_group_key = trim(p_legacy_group_key);
end;
$$;

-- Harden access: deny all by default, then grant narrowly.
revoke execute on function public.delete_ante_core_bloc(text) from public;
revoke execute on function public.delete_ante_core_bloc(text) from anon;
revoke execute on function public.delete_ante_core_bloc(text) from authenticated;
grant  execute on function public.delete_ante_core_bloc(text) to service_role;
