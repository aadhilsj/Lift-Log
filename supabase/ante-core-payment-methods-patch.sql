-- Multiple payment methods per profile.
--
-- Supersedes the single payment_provider/payment_handle pair added by
-- ante-core-payment-handle-patch.sql. People hold different apps in different
-- markets, so a member can now list every method they accept and the payer
-- picks whichever suits them.
--
-- Fero still never processes, routes, holds, or verifies a payment. These rows
-- hold opaque user-supplied strings; settlement status stays member-confirmed.
--
-- Safe to run more than once. The old columns are left in place and simply
-- stop being read, so a rollback needs no data restore. They can be dropped in
-- a later cleanup once nothing references them.

alter table ante_core.profiles
  add column if not exists payment_methods jsonb not null default '[]'::jsonb;

-- Carry any existing single method into the list, without duplicating on a
-- second run.
update ante_core.profiles
set payment_methods = jsonb_build_array(
      jsonb_build_object('provider', payment_provider, 'handle', payment_handle)
    )
where coalesce(payment_provider, '') <> ''
  and coalesce(payment_handle, '') <> ''
  and jsonb_array_length(payment_methods) = 0;

drop function if exists public.upsert_ante_core_profile(text, text, text, text, text, text);

create or replace function public.upsert_ante_core_profile(
  p_auth_user_id text,
  p_email text,
  p_display_name text,
  p_profile_photo_url text default null,
  p_payment_methods jsonb default null
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
    payment_methods,
    created_at,
    updated_at
  )
  values (
    v_auth_user_id,
    lower(trim(p_email)),
    trim(p_display_name),
    coalesce(p_profile_photo_url, ''),
    coalesce(p_payment_methods, '[]'::jsonb),
    now(),
    now()
  )
  on conflict (email) do update
    set
      auth_user_id = coalesce(ante_core.profiles.auth_user_id, excluded.auth_user_id),
      display_name = excluded.display_name,
      profile_photo_url = coalesce(p_profile_photo_url, ante_core.profiles.profile_photo_url, ''),
      -- null means "leave untouched", so callers that predate payment methods
      -- cannot blank a stored list.
      payment_methods = coalesce(p_payment_methods, ante_core.profiles.payment_methods, '[]'::jsonb),
      updated_at = now();
end;
$$;

revoke execute on function public.upsert_ante_core_profile(text, text, text, text, jsonb) from public;
revoke execute on function public.upsert_ante_core_profile(text, text, text, text, jsonb) from anon;
revoke execute on function public.upsert_ante_core_profile(text, text, text, text, jsonb) from authenticated;
grant execute on function public.upsert_ante_core_profile(text, text, text, text, jsonb) to service_role;

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
        'payment_methods', coalesce(p.payment_methods, '[]'::jsonb),
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
