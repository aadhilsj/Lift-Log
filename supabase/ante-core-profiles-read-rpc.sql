-- Read RPC for ante_core.profiles.
-- Returns the canonical profile set for the app-state profiles overlay.
-- Reads from the private ante_core schema; never exposes the schema directly.
--
-- Call via: POST /rest/v1/rpc/read_ante_core_profiles
--
-- Return shape (jsonb array):
--   [{ "user_id": text, "email": text, "display_name": text,
--      "profile_photo_url": text, "created_at": timestamptz }, ...]
--
-- user_id is coalesce(auth_user_id::text, legacy_user_key).
-- Rows where both identity columns are null are excluded (unmappable; should not exist).
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly denied.

create or replace function public.read_ante_core_profiles()
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id',      coalesce(p.auth_user_id::text, p.legacy_user_key),
        'email',        p.email,
        'display_name', p.display_name,
        'profile_photo_url', coalesce(p.profile_photo_url, ''),
        'created_at',   p.created_at
      )
    ),
    '[]'::jsonb
  )
  into result
  from ante_core.profiles p
  where p.auth_user_id is not null
     or p.legacy_user_key is not null;

  return result;
end;
$$;

-- Harden access: deny all by default, then grant narrowly.
revoke execute on function public.read_ante_core_profiles() from public;
revoke execute on function public.read_ante_core_profiles() from anon;
revoke execute on function public.read_ante_core_profiles() from authenticated;
grant  execute on function public.read_ante_core_profiles() to service_role;
