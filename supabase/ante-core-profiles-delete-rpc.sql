-- Delete RPC for ante_core.profiles.
-- Deletes a single profile by auth_user_id (service_role caller).
--
-- Call via: POST /rest/v1/rpc/delete_ante_core_profile
-- Body:     { "p_auth_user_id": "..." }
--
-- Cascade behaviour:
--   payment_methods rows are hard-deleted via ON DELETE CASCADE.
--   All other referencing tables (bloc_members, workout_logs, workout_reactions,
--   sit_out_requests, etc.) get profile_id = null via ON DELETE SET NULL —
--   historical data is preserved.
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly denied.

create or replace function public.delete_ante_core_profile(
  p_auth_user_id text
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_auth_user_id uuid;
begin
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then
    raise exception 'auth_user_id is required';
  end if;

  v_auth_user_id := trim(p_auth_user_id)::uuid;

  delete from ante_core.profiles
  where auth_user_id = v_auth_user_id;
end;
$$;

-- Harden access: deny all by default, then grant narrowly.
revoke execute on function public.delete_ante_core_profile(text) from public;
revoke execute on function public.delete_ante_core_profile(text) from anon;
revoke execute on function public.delete_ante_core_profile(text) from authenticated;
grant  execute on function public.delete_ante_core_profile(text) to service_role;
