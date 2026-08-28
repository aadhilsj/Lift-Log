-- Patch for settlement payment handles.
--
-- Stores an optional per-profile payment handle so the settlement screen can
-- offer a "Pay" affordance that opens the receiver's own payment app.
--
-- Fero never processes, routes, holds, or verifies a payment. These columns
-- hold an opaque user-supplied string and a provider tag. Settlement status
-- remains member-confirmed and is never derived from a payment link being
-- opened.
--
-- Modelled on ante-core-profile-photo-url-patch.sql. Both new parameters use
-- the same coalesce-preserve semantics as p_profile_photo_url: passing null
-- leaves the stored value untouched, so existing callers that do not know
-- about payment handles cannot blank them.

alter table ante_core.profiles
  add column if not exists payment_provider text not null default '';

alter table ante_core.profiles
  add column if not exists payment_handle text not null default '';

drop function if exists public.upsert_ante_core_profile(text, text, text, text);

create or replace function public.upsert_ante_core_profile(
  p_auth_user_id text,
  p_email text,
  p_display_name text,
  p_profile_photo_url text default null,
  p_payment_provider text default null,
  p_payment_handle text default null
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_auth_user_id uuid;
begin
  if p_email is null or trim(p_email) = '' then
    raise exception 'email is required';
  end if;
  if p_display_name is null or trim(p_display_name) = '' then
    raise exception 'display_name is required';
  end if;

  if p_auth_user_id is not null and trim(p_auth_user_id) <> '' then
    v_auth_user_id := trim(p_auth_user_id)::uuid;
  else
    v_auth_user_id := null;
  end if;

  insert into ante_core.profiles (
    auth_user_id,
    email,
    display_name,
    profile_photo_url,
    payment_provider,
    payment_handle,
    created_at,
    updated_at
  )
  values (
    v_auth_user_id,
    lower(trim(p_email)),
    trim(p_display_name),
    coalesce(p_profile_photo_url, ''),
    coalesce(p_payment_provider, ''),
    coalesce(p_payment_handle, ''),
    now(),
    now()
  )
  on conflict (email) do update
    set
      auth_user_id = coalesce(ante_core.profiles.auth_user_id, excluded.auth_user_id),
      display_name = excluded.display_name,
      profile_photo_url = coalesce(p_profile_photo_url, ante_core.profiles.profile_photo_url, ''),
      payment_provider = coalesce(p_payment_provider, ante_core.profiles.payment_provider, ''),
      payment_handle = coalesce(p_payment_handle, ante_core.profiles.payment_handle, ''),
      updated_at = now();
end;
$$;

revoke execute on function public.upsert_ante_core_profile(text, text, text, text, text, text) from public;
revoke execute on function public.upsert_ante_core_profile(text, text, text, text, text, text) from anon;
revoke execute on function public.upsert_ante_core_profile(text, text, text, text, text, text) from authenticated;
grant execute on function public.upsert_ante_core_profile(text, text, text, text, text, text) to service_role;

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
        'user_id', coalesce(p.auth_user_id::text, p.legacy_user_key),
        'email', p.email,
        'display_name', p.display_name,
        'profile_photo_url', coalesce(p.profile_photo_url, ''),
        'payment_provider', coalesce(p.payment_provider, ''),
        'payment_handle', coalesce(p.payment_handle, ''),
        'created_at', p.created_at
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

revoke execute on function public.read_ante_core_profiles() from public;
revoke execute on function public.read_ante_core_profiles() from anon;
revoke execute on function public.read_ante_core_profiles() from authenticated;
grant execute on function public.read_ante_core_profiles() to service_role;
