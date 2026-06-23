-- Upsert RPC for ante_core.blocs.
-- Creates or updates a single bloc from the app server (service_role caller).
--
-- Call via: POST /rest/v1/rpc/upsert_ante_core_bloc
-- Body:     { "p_legacy_group_key": "...", "p_name": "...", ... }
--
-- Conflict resolution is on legacy_group_key (always present, always unique).
-- admin_profile_id is resolved from p_admin_auth_user_id via ante_core.profiles.
-- admin_profile_id is filled in if resolvable, never clobbered once set.
-- invite_code is preserved on update (set once at creation, never regenerated).
-- created_at is preserved on update.
-- updated_at is set to now() on every upsert.
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly denied.

create or replace function public.upsert_ante_core_bloc(
  p_legacy_group_key       text,
  p_name                   text,
  p_admin_auth_user_id     text,
  p_invite_code            text,
  p_time_zone              text,
  p_currency               text,
  p_min_target             integer,
  p_fine_amount            integer,
  p_fee_model              text,
  p_escalation_step_amount integer,
  p_min_run_distance       integer,
  p_distance_unit          text,
  p_strava_enabled         boolean,
  p_accepted_workout_types text[],
  p_sort_order             integer default null
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_admin_profile_id   uuid;
  v_admin_auth_user_id uuid;
begin
  -- Validate required fields.
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    raise exception 'legacy_group_key is required';
  end if;
  if p_name is null or trim(p_name) = '' then
    raise exception 'name is required';
  end if;
  if p_invite_code is null or trim(p_invite_code) = '' then
    raise exception 'invite_code is required';
  end if;

  -- Resolve admin_profile_id from auth_user_id if provided.
  -- If not resolvable (legacy user not yet in canonical), stays null.
  if p_admin_auth_user_id is not null and trim(p_admin_auth_user_id) <> '' then
    begin
      v_admin_auth_user_id := trim(p_admin_auth_user_id)::uuid;
    exception when others then
      v_admin_auth_user_id := null;
    end;
  end if;

  if v_admin_auth_user_id is not null then
    select id into v_admin_profile_id
    from ante_core.profiles
    where auth_user_id = v_admin_auth_user_id;
    -- if not found, v_admin_profile_id stays null
  end if;

  insert into ante_core.blocs (
    legacy_group_key,
    name,
    admin_profile_id,
    invite_code,
    time_zone,
    currency,
    min_target,
    fine_amount,
    fee_model,
    escalation_step_amount,
    min_run_distance,
    distance_unit,
    strava_enabled,
    accepted_workout_types,
    sort_order,
    created_at,
    updated_at
  )
  values (
    trim(p_legacy_group_key),
    trim(p_name),
    v_admin_profile_id,
    upper(trim(p_invite_code)),
    p_time_zone,
    p_currency,
    p_min_target,
    p_fine_amount,
    p_fee_model::ante_core.fee_model_type,
    p_escalation_step_amount,
    p_min_run_distance,
    p_distance_unit,
    p_strava_enabled,
    coalesce(p_accepted_workout_types, '{}'),
    p_sort_order,
    now(),
    now()
  )
  on conflict (legacy_group_key) do update
    set
      name                   = excluded.name,
      -- Fill in admin_profile_id if we now have one and the row didn't before.
      -- Never overwrite an already-set admin_profile_id.
      admin_profile_id       = coalesce(ante_core.blocs.admin_profile_id, excluded.admin_profile_id),
      -- Preserve original invite_code (set once at creation, never regenerated).
      invite_code            = ante_core.blocs.invite_code,
      time_zone              = excluded.time_zone,
      currency               = excluded.currency,
      min_target             = excluded.min_target,
      fine_amount            = excluded.fine_amount,
      fee_model              = excluded.fee_model,
      escalation_step_amount = excluded.escalation_step_amount,
      min_run_distance       = excluded.min_run_distance,
      distance_unit          = excluded.distance_unit,
      strava_enabled         = excluded.strava_enabled,
      accepted_workout_types = excluded.accepted_workout_types,
      sort_order             = excluded.sort_order,
      -- Preserve original created_at; only bump updated_at.
      updated_at             = now();
end;
$$;

-- Harden access: deny all by default, then grant narrowly.
revoke execute on function public.upsert_ante_core_bloc(text, text, text, text, text, text, integer, integer, text, integer, integer, text, boolean, text[], integer) from public;
revoke execute on function public.upsert_ante_core_bloc(text, text, text, text, text, text, integer, integer, text, integer, integer, text, boolean, text[], integer) from anon;
revoke execute on function public.upsert_ante_core_bloc(text, text, text, text, text, text, integer, integer, text, integer, integer, text, boolean, text[], integer) from authenticated;
grant  execute on function public.upsert_ante_core_bloc(text, text, text, text, text, text, integer, integer, text, integer, integer, text, boolean, text[], integer) to service_role;
