-- Write RPCs for ante_core.bloc_members.
-- All three RPCs are called from the app server (service_role caller).
-- All resolve bloc via ante_core.blocs.legacy_group_key.
-- All resolve profile via ante_core.profiles.auth_user_id.
-- If either lookup fails, the function exits silently (best-effort, never raises).
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly denied.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. upsert_ante_core_bloc_member
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Creates or updates a single active membership.
--
-- Call via: POST /rest/v1/rpc/upsert_ante_core_bloc_member
-- Body:     { "p_legacy_group_key": "...", "p_auth_user_id": "...",
--             "p_display_name": "...", "p_role": "member"|"admin",
--             "p_joined_at": "<iso8601>"|null, "p_joined_month_key": "..."|null }
--
-- Conflict resolution is on (bloc_id, profile_id).
-- left_at is always cleared — handles re-joins.
-- display_name_snapshot, role, joined_at, joined_month_key are always updated.
-- created_at is preserved on update.

create or replace function public.upsert_ante_core_bloc_member(
  p_legacy_group_key text,
  p_auth_user_id     text,
  p_display_name     text,
  p_role             text,
  p_joined_at        timestamptz,
  p_joined_month_key text
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id    uuid;
  v_profile_id uuid;
  v_role       ante_core.bloc_member_role;
begin
  -- Validate required inputs.
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    return;
  end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then
    return;
  end if;
  if p_display_name is null or trim(p_display_name) = '' then
    return;
  end if;

  -- Resolve bloc_id from legacy_group_key.
  select id into v_bloc_id
  from ante_core.blocs
  where legacy_group_key = trim(p_legacy_group_key);

  if v_bloc_id is null then
    return;
  end if;

  -- Resolve profile_id from auth_user_id.
  begin
    select id into v_profile_id
    from ante_core.profiles
    where auth_user_id = trim(p_auth_user_id)::uuid;
  exception when others then
    return;
  end;

  if v_profile_id is null then
    return;
  end if;

  -- Normalise role; default to 'member' for any unrecognised value.
  v_role := case
    when p_role = 'admin' then 'admin'::ante_core.bloc_member_role
    else 'member'::ante_core.bloc_member_role
  end;

  insert into ante_core.bloc_members (
    bloc_id,
    profile_id,
    display_name_snapshot,
    role,
    joined_at,
    joined_month_key,
    left_at,
    created_at
  )
  values (
    v_bloc_id,
    v_profile_id,
    trim(p_display_name),
    v_role,
    p_joined_at,
    p_joined_month_key,
    null,          -- active membership: left_at is null
    now()
  )
  on conflict (bloc_id, profile_id) do update
    set
      display_name_snapshot = excluded.display_name_snapshot,
      role                  = excluded.role,
      joined_at             = excluded.joined_at,
      joined_month_key      = excluded.joined_month_key,
      -- Always clear left_at — handles re-joins cleanly.
      left_at               = null;
  -- created_at is intentionally not updated on conflict.
end;
$$;

-- Harden access.
revoke execute on function public.upsert_ante_core_bloc_member(text, text, text, text, timestamptz, text) from public;
revoke execute on function public.upsert_ante_core_bloc_member(text, text, text, text, timestamptz, text) from anon;
revoke execute on function public.upsert_ante_core_bloc_member(text, text, text, text, timestamptz, text) from authenticated;
grant  execute on function public.upsert_ante_core_bloc_member(text, text, text, text, timestamptz, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. remove_ante_core_bloc_member
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Soft-deletes a membership by setting left_at = now().
-- Used by kick-member and leave-bloc.
-- Also suitable for delete-account admin-transfer cleanup if needed in future.
--
-- Call via: POST /rest/v1/rpc/remove_ante_core_bloc_member
-- Body:     { "p_legacy_group_key": "...", "p_auth_user_id": "..." }
--
-- Does not hard-delete. Row is preserved for historical queries and parity checks.
-- No-ops silently if bloc, profile, or membership row is missing.

create or replace function public.remove_ante_core_bloc_member(
  p_legacy_group_key text,
  p_auth_user_id     text
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id    uuid;
  v_profile_id uuid;
begin
  -- Validate required inputs.
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    return;
  end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then
    return;
  end if;

  -- Resolve bloc_id.
  select id into v_bloc_id
  from ante_core.blocs
  where legacy_group_key = trim(p_legacy_group_key);

  if v_bloc_id is null then
    return;
  end if;

  -- Resolve profile_id.
  begin
    select id into v_profile_id
    from ante_core.profiles
    where auth_user_id = trim(p_auth_user_id)::uuid;
  exception when others then
    return;
  end;

  if v_profile_id is null then
    return;
  end if;

  -- Soft-delete: stamp left_at. No-op if already left or row absent.
  update ante_core.bloc_members
  set left_at = now()
  where bloc_id   = v_bloc_id
    and profile_id = v_profile_id
    and left_at   is null;
end;
$$;

-- Harden access.
revoke execute on function public.remove_ante_core_bloc_member(text, text) from public;
revoke execute on function public.remove_ante_core_bloc_member(text, text) from anon;
revoke execute on function public.remove_ante_core_bloc_member(text, text) from authenticated;
grant  execute on function public.remove_ante_core_bloc_member(text, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. update_ante_core_bloc_admin
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Transfers admin to a new profile within a bloc.
-- Used when the current admin leaves or deletes their account and a surviving
-- member is promoted (earliest joinedAt wins, determined by the app layer).
--
-- Call via: POST /rest/v1/rpc/update_ante_core_bloc_admin
-- Body:     { "p_legacy_group_key": "...", "p_new_admin_auth_user_id": "..." }
--
-- Unconditionally overwrites ante_core.blocs.admin_profile_id.
-- Sets the new admin's bloc_members.role to 'admin' (active row only).
-- Demotes any other active 'admin' rows in the same bloc to 'member'.
-- No-ops silently if bloc or new-admin profile is missing.

create or replace function public.update_ante_core_bloc_admin(
  p_legacy_group_key      text,
  p_new_admin_auth_user_id text
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id            uuid;
  v_new_admin_profile_id uuid;
begin
  -- Validate required inputs.
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    return;
  end if;
  if p_new_admin_auth_user_id is null or trim(p_new_admin_auth_user_id) = '' then
    return;
  end if;

  -- Resolve bloc_id.
  select id into v_bloc_id
  from ante_core.blocs
  where legacy_group_key = trim(p_legacy_group_key);

  if v_bloc_id is null then
    return;
  end if;

  -- Resolve new admin profile_id.
  begin
    select id into v_new_admin_profile_id
    from ante_core.profiles
    where auth_user_id = trim(p_new_admin_auth_user_id)::uuid;
  exception when others then
    return;
  end;

  if v_new_admin_profile_id is null then
    return;
  end if;

  -- Update blocs.admin_profile_id unconditionally.
  -- Unlike upsert_ante_core_bloc, this always overwrites — it exists
  -- specifically to handle admin transfer, not initial population.
  update ante_core.blocs
  set    admin_profile_id = v_new_admin_profile_id,
         updated_at       = now()
  where  id = v_bloc_id;

  -- Demote all currently-active admin rows in this bloc to 'member'.
  update ante_core.bloc_members
  set    role = 'member'::ante_core.bloc_member_role
  where  bloc_id  = v_bloc_id
    and  role     = 'admin'::ante_core.bloc_member_role
    and  left_at  is null;

  -- Promote the new admin's active membership row.
  -- No-op if the new admin has no active bloc_members row yet
  -- (they may join later; upsert_ante_core_bloc_member will set role correctly).
  update ante_core.bloc_members
  set    role = 'admin'::ante_core.bloc_member_role
  where  bloc_id    = v_bloc_id
    and  profile_id = v_new_admin_profile_id
    and  left_at    is null;
end;
$$;

-- Harden access.
revoke execute on function public.update_ante_core_bloc_admin(text, text) from public;
revoke execute on function public.update_ante_core_bloc_admin(text, text) from anon;
revoke execute on function public.update_ante_core_bloc_admin(text, text) from authenticated;
grant  execute on function public.update_ante_core_bloc_admin(text, text) to service_role;
