-- Write RPC for ante_core.season_overrides.
-- Called from the app server (service_role caller) when an admin chooses
-- the first-month proration target via the `season-proration-choice` action.
--
-- Scope: upsert one override row per season.
-- The table has a unique constraint on season_id, so there is at most one
-- override per season. The blob guards against re-submission (applySeasonProrationChoice
-- short-circuits if an override already exists), but the RPC is idempotent anyway.
--
-- Call via: POST /rest/v1/rpc/upsert_ante_core_season_override
-- Body:     { "p_legacy_group_key": "...", "p_month_key": "...",
--             "p_prorated": true|false,    "p_prorated_mas": 9,
--             "p_chosen_at": "<iso8601>",  "p_chosen_by": "...",
--             "p_chosen_by_user_id": "..."|null }
--
-- season_id is resolved from (blocs.legacy_group_key, seasons.month_key).
-- If the bloc or season row is missing, the function exits silently (best-effort).
-- chosen_by_user_id is resolved from profiles.auth_user_id; null if not found
-- or not supplied.
--
-- On conflict (season_id already has an override row):
--   - prorated, prorated_mas, chosen_at, chosen_by are always updated
--   - chosen_by_user_id uses coalesce so a previously resolved non-null profile
--     UUID is never overwritten with null (handles legacy/profile-less callers)
--   - created_at is preserved
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly denied.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. upsert_ante_core_season_override
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.upsert_ante_core_season_override(
  p_legacy_group_key  text,
  p_month_key         text,
  p_prorated          boolean,
  p_prorated_mas      integer,
  p_chosen_at         timestamptz,
  p_chosen_by         text,
  p_chosen_by_user_id text
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

  -- Resolve chosen_by profile_id from auth_user_id — best-effort; null is acceptable.
  if p_chosen_by_user_id is not null and trim(p_chosen_by_user_id) <> '' then
    begin
      select id into v_profile_id
      from ante_core.profiles
      where auth_user_id = trim(p_chosen_by_user_id)::uuid;
    exception when others then
      -- Malformed UUID or any other error — treat as unresolvable.
      v_profile_id := null;
    end;
  end if;

  -- Upsert the season override.
  --
  -- On INSERT: full row created with all supplied values.
  --
  -- On conflict (override already exists for this season — rare in practice
  -- because the blob guards against re-submission, but handled for safety):
  --   - prorated, prorated_mas, chosen_at, chosen_by are updated
  --   - chosen_by_user_id uses coalesce so a previously resolved non-null
  --     profile UUID is never overwritten with null
  --   - created_at is intentionally preserved
  insert into ante_core.season_overrides (
    season_id,
    prorated,
    prorated_mas,
    chosen_at,
    chosen_by,
    chosen_by_user_id,
    created_at,
    updated_at
  )
  values (
    v_season_id,
    coalesce(p_prorated, false),
    p_prorated_mas,
    p_chosen_at,
    nullif(trim(coalesce(p_chosen_by, '')), ''),
    v_profile_id,
    now(),
    now()
  )
  on conflict (season_id) do update
    set
      prorated          = excluded.prorated,
      prorated_mas      = excluded.prorated_mas,
      chosen_at         = excluded.chosen_at,
      chosen_by         = excluded.chosen_by,
      chosen_by_user_id = coalesce(excluded.chosen_by_user_id, ante_core.season_overrides.chosen_by_user_id),
      updated_at        = now();
  -- created_at is intentionally not updated on conflict.
end;
$$;

-- Harden access.
revoke execute on function public.upsert_ante_core_season_override(text, text, boolean, integer, timestamptz, text, text) from public;
revoke execute on function public.upsert_ante_core_season_override(text, text, boolean, integer, timestamptz, text, text) from anon;
revoke execute on function public.upsert_ante_core_season_override(text, text, boolean, integer, timestamptz, text, text) from authenticated;
grant  execute on function public.upsert_ante_core_season_override(text, text, boolean, integer, timestamptz, text, text) to service_role;
