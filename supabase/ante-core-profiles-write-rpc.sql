-- Write RPC for ante_core.profiles.
-- Upserts a single profile from the app server (service_role caller).
--
-- Call via: POST /rest/v1/rpc/upsert_ante_core_profile
-- Body:     { "p_auth_user_id": "...", "p_email": "...", "p_display_name": "..." }
--
-- Conflict resolution is on email (always present, always unique).
-- auth_user_id is filled in if provided, never clobbered once set.
-- legacy_user_key is never touched by this RPC.
-- created_at is preserved on update.
-- updated_at is set to now() on every upsert.
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly denied.

create or replace function public.upsert_ante_core_profile(
  p_auth_user_id text,
  p_email        text,
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_auth_user_id uuid;
begin
  -- Validate required fields.
  if p_email is null or trim(p_email) = '' then
    raise exception 'email is required';
  end if;
  if p_display_name is null or trim(p_display_name) = '' then
    raise exception 'display_name is required';
  end if;

  -- Cast auth_user_id to uuid if provided and non-empty; null otherwise.
  -- This tolerates callers that pass an empty string when no auth id is known.
  if p_auth_user_id is not null and trim(p_auth_user_id) <> '' then
    v_auth_user_id := trim(p_auth_user_id)::uuid;
  else
    v_auth_user_id := null;
  end if;

  insert into ante_core.profiles (
    auth_user_id,
    email,
    display_name,
    created_at,
    updated_at
  )
  values (
    v_auth_user_id,
    lower(trim(p_email)),
    trim(p_display_name),
    now(),
    now()
  )
  on conflict (email) do update
    set
      -- Fill in auth_user_id if we now have one and the row didn't before.
      -- Never overwrite an already-set auth_user_id (safety: one email = one auth identity).
      auth_user_id  = coalesce(ante_core.profiles.auth_user_id, excluded.auth_user_id),
      -- Always update display_name to the latest value.
      display_name  = excluded.display_name,
      -- Preserve original created_at; only bump updated_at.
      updated_at    = now();
  -- legacy_user_key is intentionally not touched by this RPC.
end;
$$;

-- Harden access: deny all by default, then grant narrowly.
revoke execute on function public.upsert_ante_core_profile(text, text, text) from public;
revoke execute on function public.upsert_ante_core_profile(text, text, text) from anon;
revoke execute on function public.upsert_ante_core_profile(text, text, text) from authenticated;
grant  execute on function public.upsert_ante_core_profile(text, text, text) to service_role;
