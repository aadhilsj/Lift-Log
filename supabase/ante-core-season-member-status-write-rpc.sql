-- Write RPC for ante_core.season_member_status.
-- Called from the app server (service_role caller) on month rollover only.
-- Writes one row per member per closed season (the rollover snapshot).
--
-- Call via: POST /rest/v1/rpc/upsert_ante_core_season_member_status
-- Body:     { "p_legacy_group_key": "...", "p_month_key": "...",
--             "p_display_name": "...", "p_auth_user_id": "..."|null,
--             "p_workout_count": 0, "p_excused": false,
--             "p_joined_for_month": true }
--
-- Conflict resolution is on (season_id, display_name_snapshot).
-- season_id is resolved from (blocs.legacy_group_key, seasons.month_key).
-- If the bloc or season is missing, the function exits silently (best-effort).
-- profile_id is resolved from profiles.auth_user_id; null if not found or not supplied.
-- Settlement columns (settlement_status, settlement_settled_at, settlement_updated_at)
-- are intentionally not touched here — those are managed by a separate RPC.
-- created_at is preserved on conflict (not overwritten).
-- updated_at is set to now() on every upsert.
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly denied.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. upsert_ante_core_season_member_status
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.upsert_ante_core_season_member_status(
  p_legacy_group_key text,
  p_month_key        text,
  p_display_name     text,
  p_auth_user_id     text,
  p_workout_count    integer,
  p_excused          boolean,
  p_joined_for_month boolean
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id    uuid;
  v_season_id  uuid;
  v_profile_id uuid;
begin
  -- Validate required inputs.
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    return;
  end if;
  if p_month_key is null or trim(p_month_key) = '' then
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

  -- Resolve season_id from (bloc_id, month_key).
  -- No-op if the season row hasn't been written yet (pre-canonical group).
  select id into v_season_id
  from ante_core.seasons
  where bloc_id   = v_bloc_id
    and month_key = trim(p_month_key);

  if v_season_id is null then
    return;
  end if;

  -- Resolve profile_id from auth_user_id — best-effort; null is acceptable.
  if p_auth_user_id is not null and trim(p_auth_user_id) <> '' then
    begin
      select id into v_profile_id
      from ante_core.profiles
      where auth_user_id = trim(p_auth_user_id)::uuid;
    exception when others then
      -- Malformed UUID or any other error — treat as unresolvable.
      v_profile_id := null;
    end;
  end if;

  -- Upsert the season member status row.
  -- On conflict: update workout_count, excused, joined_for_month, profile_id,
  --              and updated_at. Preserve created_at and settlement columns.
  insert into ante_core.season_member_status (
    season_id,
    profile_id,
    display_name_snapshot,
    joined_for_month,
    workout_count,
    excused,
    created_at,
    updated_at
  )
  values (
    v_season_id,
    v_profile_id,
    trim(p_display_name),
    coalesce(p_joined_for_month, true),
    coalesce(p_workout_count, 0),
    coalesce(p_excused, false),
    now(),
    now()
  )
  on conflict (season_id, display_name_snapshot) do update
    set
      profile_id       = excluded.profile_id,
      joined_for_month = excluded.joined_for_month,
      workout_count    = excluded.workout_count,
      excused          = excluded.excused,
      updated_at       = now();
  -- created_at is intentionally not updated on conflict.
  -- settlement_status, settlement_settled_at, settlement_updated_at are
  -- intentionally not touched — managed by a dedicated settlement RPC.
end;
$$;

-- Harden access.
revoke execute on function public.upsert_ante_core_season_member_status(text, text, text, text, integer, boolean, boolean) from public;
revoke execute on function public.upsert_ante_core_season_member_status(text, text, text, text, integer, boolean, boolean) from anon;
revoke execute on function public.upsert_ante_core_season_member_status(text, text, text, text, integer, boolean, boolean) from authenticated;
grant  execute on function public.upsert_ante_core_season_member_status(text, text, text, text, integer, boolean, boolean) to service_role;
