-- Write RPC for ante_core.sit_out_requests.
-- Called from the app server (service_role caller) on both write paths:
--   - sitout-request action  → initial INSERT (status pending or auto-approved)
--   - sitout-review action   → UPDATE existing row to approved / denied
--
-- Both paths are handled by a single UPSERT keyed on (season_id, display_name_snapshot).
-- At most one request row exists per member per season, matching the blob's map structure.
--
-- Call via: POST /rest/v1/rpc/upsert_ante_core_sit_out_request
-- Body:     {
--   "p_legacy_group_key":        "...",
--   "p_month_key":               "...",
--   "p_display_name":            "...",        -- the map key (authoritative)
--   "p_requested_by_user_id":    "..."|null,
--   "p_status":                  "pending"|"approved"|"declined",
--   "p_reason":                  "...",
--   "p_exceptional":             true|false,
--   "p_requested_at":            "<iso8601>"|null,
--   "p_requested_by":            "...",
--   "p_target_approver_name":    "..."|null,
--   "p_target_approver_user_id": "..."|null,
--   "p_decided_at":              "<iso8601>"|null,
--   "p_decided_by":              "..."|null,
--   "p_decided_by_user_id":      "..."|null,
--   "p_auto_approved":           true|false
-- }
--
-- season_id is resolved from (blocs.legacy_group_key, seasons.month_key).
-- If the bloc or season row is missing, the function exits silently (best-effort).
--
-- Three profile UUIDs are resolved best-effort from profiles.auth_user_id:
--   profile_id            ← p_requested_by_user_id   (subject)
--   requested_by_user_id  ← p_requested_by_user_id   (same; stored explicitly)
--   target_approver_user_id ← p_target_approver_user_id
--   decided_by_user_id    ← p_decided_by_user_id
-- All resolve to null on miss or malformed UUID — never blocks the write.
--
-- Status mapping:
--   blob "declined" → canonical enum 'denied'
--   blob "approved" → 'approved'
--   blob "pending"  → 'pending'
--   Any other value → silently skipped (return early)
--
-- On conflict (season_id, display_name_snapshot):
--   All mutable fields are updated.
--   profile_id, requested_by_user_id, target_approver_user_id, decided_by_user_id
--   all use coalesce so a previously resolved non-null UUID is never overwritten
--   with null (protects against review path where only decidedByUserId is fresh).
--   created_at is preserved.
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly denied.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. upsert_ante_core_sit_out_request
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.upsert_ante_core_sit_out_request(
  p_legacy_group_key        text,
  p_month_key               text,
  p_display_name            text,
  p_requested_by_user_id    text,
  p_status                  text,
  p_reason                  text,
  p_exceptional             boolean,
  p_requested_at            timestamptz,
  p_requested_by            text,
  p_target_approver_name    text,
  p_target_approver_user_id text,
  p_decided_at              timestamptz,
  p_decided_by              text,
  p_decided_by_user_id      text,
  p_auto_approved           boolean
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id                    uuid;
  v_season_id                  uuid;
  v_profile_id                 uuid;   -- subject (requested_by)
  v_target_approver_profile_id uuid;
  v_decided_by_profile_id      uuid;
  v_status                     ante_core.sit_out_request_status;
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

  -- Map blob status to canonical enum.
  -- blob "declined" → canonical 'denied'; anything unrecognised is a no-op.
  case trim(coalesce(p_status, ''))
    when 'pending'  then v_status := 'pending';
    when 'approved' then v_status := 'approved';
    when 'declined' then v_status := 'denied';
    when 'denied'   then v_status := 'denied';
    else return;  -- unrecognised status — skip silently
  end case;

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

  -- Resolve subject profile_id — best-effort.
  if p_requested_by_user_id is not null and trim(p_requested_by_user_id) <> '' then
    begin
      select id into v_profile_id
      from ante_core.profiles
      where auth_user_id = trim(p_requested_by_user_id)::uuid;
    exception when others then
      v_profile_id := null;
    end;
  end if;

  -- Resolve target approver profile_id — best-effort.
  if p_target_approver_user_id is not null and trim(p_target_approver_user_id) <> '' then
    begin
      select id into v_target_approver_profile_id
      from ante_core.profiles
      where auth_user_id = trim(p_target_approver_user_id)::uuid;
    exception when others then
      v_target_approver_profile_id := null;
    end;
  end if;

  -- Resolve decided-by profile_id — best-effort.
  if p_decided_by_user_id is not null and trim(p_decided_by_user_id) <> '' then
    begin
      select id into v_decided_by_profile_id
      from ante_core.profiles
      where auth_user_id = trim(p_decided_by_user_id)::uuid;
    exception when others then
      v_decided_by_profile_id := null;
    end;
  end if;

  -- Upsert the sit-out request row.
  --
  -- On INSERT: full row created with all supplied values.
  --
  -- On conflict (same member, same season — review path updating an existing request):
  --   All mutable fields are updated to reflect the latest blob state.
  --   The four *_user_id UUID columns use coalesce to preserve any previously
  --   resolved non-null profile UUID — the review path may not re-supply the
  --   subject's or target-approver's user_id, so we must not overwrite with null.
  insert into ante_core.sit_out_requests (
    bloc_id,
    season_id,
    profile_id,
    display_name_snapshot,
    status,
    reason,
    exceptional,
    requested_at,
    requested_by,
    requested_by_user_id,
    target_approver_name,
    target_approver_user_id,
    decided_at,
    decided_by,
    decided_by_user_id,
    auto_approved,
    created_at,
    updated_at
  )
  values (
    v_bloc_id,
    v_season_id,
    v_profile_id,
    trim(p_display_name),
    v_status,
    coalesce(p_reason, ''),
    coalesce(p_exceptional, false),
    p_requested_at,
    nullif(trim(coalesce(p_requested_by, '')), ''),
    v_profile_id,    -- requested_by_user_id mirrors profile_id (subject identity)
    nullif(trim(coalesce(p_target_approver_name, '')), ''),
    v_target_approver_profile_id,
    p_decided_at,
    nullif(trim(coalesce(p_decided_by, '')), ''),
    v_decided_by_profile_id,
    coalesce(p_auto_approved, false),
    now(),
    now()
  )
  on conflict (season_id, display_name_snapshot) do update
    set
      status                  = excluded.status,
      reason                  = excluded.reason,
      exceptional             = excluded.exceptional,
      requested_at            = excluded.requested_at,
      requested_by            = excluded.requested_by,
      -- Preserve previously resolved subject profile UUID if new is null.
      profile_id              = coalesce(excluded.profile_id,              ante_core.sit_out_requests.profile_id),
      requested_by_user_id    = coalesce(excluded.requested_by_user_id,    ante_core.sit_out_requests.requested_by_user_id),
      target_approver_name    = excluded.target_approver_name,
      -- Preserve previously resolved target-approver UUID if new is null.
      target_approver_user_id = coalesce(excluded.target_approver_user_id, ante_core.sit_out_requests.target_approver_user_id),
      decided_at              = excluded.decided_at,
      decided_by              = excluded.decided_by,
      -- Preserve previously resolved reviewer UUID if new is null.
      decided_by_user_id      = coalesce(excluded.decided_by_user_id,      ante_core.sit_out_requests.decided_by_user_id),
      auto_approved           = excluded.auto_approved,
      -- created_at is intentionally preserved on conflict.
      updated_at              = now();
end;
$$;

-- Harden access.
revoke execute on function public.upsert_ante_core_sit_out_request(text, text, text, text, text, text, boolean, timestamptz, text, text, text, timestamptz, text, text, boolean) from public;
revoke execute on function public.upsert_ante_core_sit_out_request(text, text, text, text, text, text, boolean, timestamptz, text, text, text, timestamptz, text, text, boolean) from anon;
revoke execute on function public.upsert_ante_core_sit_out_request(text, text, text, text, text, text, boolean, timestamptz, text, text, text, timestamptz, text, text, boolean) from authenticated;
grant  execute on function public.upsert_ante_core_sit_out_request(text, text, text, text, text, text, boolean, timestamptz, text, text, text, timestamptz, text, text, boolean) to service_role;
