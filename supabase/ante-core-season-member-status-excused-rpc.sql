-- Excused-sync RPC for ante_core.season_member_status.
-- Called from the app server (service_role caller) when a sit-out is approved:
--   - auto-approval on sitout-request (day ≤ 5, non-exceptional, non-admin, no recent sit-out)
--   - manual approval on sitout-review
--
-- Scope: upsert excused=true for one member in one season.
-- Creates the row if it doesn't exist yet (required for the open/current season,
-- which has no season_member_status row until rollover fires).
-- Updates only excused, profile_id (preserving existing), and updated_at on conflict.
-- Never touches workout_count, joined_for_month, settlement columns, or created_at on conflict.
--
-- Call via: POST /rest/v1/rpc/upsert_ante_core_season_member_excused
-- Body:     { "p_legacy_group_key": "...", "p_month_key": "...",
--             "p_display_name": "...", "p_auth_user_id": "..."|null }
--
-- season_id is resolved from (blocs.legacy_group_key, seasons.month_key).
-- If the bloc or season is missing, the function exits silently (best-effort).
-- profile_id is resolved from profiles.auth_user_id; null if not found or not supplied.
-- On conflict, profile_id is updated only when the newly resolved value is non-null —
-- an existing canonical profile_id is never overwritten with null.
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly denied.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. upsert_ante_core_season_member_excused
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.upsert_ante_core_season_member_excused(
  p_legacy_group_key text,
  p_month_key        text,
  p_display_name     text,
  p_auth_user_id     text
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
  -- No-op if the season row is missing (pre-canonical group).
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

  -- Upsert the excused state.
  --
  -- On INSERT (open-season row doesn't exist yet):
  --   workout_count defaults to 0 — overwritten at rollover by
  --   upsert_ante_core_season_member_status, which is authoritative.
  --   joined_for_month defaults to true — correct for any active member submitting
  --   or being approved for a sit-out.
  --
  -- On conflict (row already exists, e.g. closed-season retroactive approval):
  --   - excused is set to true
  --   - profile_id uses coalesce so a previously resolved non-null profile_id
  --     is never overwritten with null (handles legacy/profile-less callers)
  --   - workout_count, joined_for_month, settlement columns, created_at are
  --     intentionally not touched
  insert into ante_core.season_member_status (
    season_id,
    profile_id,
    display_name_snapshot,
    excused,
    joined_for_month,
    workout_count,
    created_at,
    updated_at
  )
  values (
    v_season_id,
    v_profile_id,
    trim(p_display_name),
    true,
    true,
    0,
    now(),
    now()
  )
  on conflict (season_id, display_name_snapshot) do update
    set
      excused    = true,
      profile_id = coalesce(excluded.profile_id, ante_core.season_member_status.profile_id),
      updated_at = now();
  -- workout_count, joined_for_month, settlement_*, created_at are intentionally
  -- not updated on conflict — rollover snapshot is authoritative for those fields.
end;
$$;

-- Harden access.
revoke execute on function public.upsert_ante_core_season_member_excused(text, text, text, text) from public;
revoke execute on function public.upsert_ante_core_season_member_excused(text, text, text, text) from anon;
revoke execute on function public.upsert_ante_core_season_member_excused(text, text, text, text) from authenticated;
grant  execute on function public.upsert_ante_core_season_member_excused(text, text, text, text) to service_role;
