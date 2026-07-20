-- Patch for global profile photo persistence.
--
-- The application writes profile photos through upload-profile-photo, which
-- stores the public Storage URL on ante_core.profiles.profile_photo_url via
-- upsert_ante_core_profile(..., p_profile_photo_url).

alter table ante_core.profiles
  add column if not exists profile_photo_url text not null default '';

drop function if exists public.upsert_ante_core_profile(text, text, text);

create or replace function public.upsert_ante_core_profile(
  p_auth_user_id text,
  p_email text,
  p_display_name text,
  p_profile_photo_url text default null
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
    created_at,
    updated_at
  )
  values (
    v_auth_user_id,
    lower(trim(p_email)),
    trim(p_display_name),
    coalesce(p_profile_photo_url, ''),
    now(),
    now()
  )
  on conflict (email) do update
    set
      auth_user_id = coalesce(ante_core.profiles.auth_user_id, excluded.auth_user_id),
      display_name = excluded.display_name,
      profile_photo_url = coalesce(p_profile_photo_url, ante_core.profiles.profile_photo_url, ''),
      updated_at = now();
end;
$$;

revoke execute on function public.upsert_ante_core_profile(text, text, text, text) from public;
revoke execute on function public.upsert_ante_core_profile(text, text, text, text) from anon;
revoke execute on function public.upsert_ante_core_profile(text, text, text, text) from authenticated;
grant execute on function public.upsert_ante_core_profile(text, text, text, text) to service_role;

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
