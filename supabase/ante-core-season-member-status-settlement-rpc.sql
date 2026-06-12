-- Settlement-sync RPC for ante_core.season_member_status.
-- Called from the app server (service_role caller) when a settlement status
-- is updated by the admin via the `settlement` action.
--
-- Scope: update settlement columns on an existing season_member_status row only.
-- This RPC never inserts a new row — that is the rollover snapshot's job.
-- If the row or season is missing (pre-canonical group), the UPDATE touches
-- 0 rows and returns silently.
--
-- Call via: POST /rest/v1/rpc/update_ante_core_season_member_settlement
-- Body:     { "p_legacy_group_key": "...", "p_month_key": "...",
--             "p_display_name": "...", "p_status": "settled"|"outstanding",
--             "p_settled_at": "YYYY-MM-DD"|null }
--
-- Columns updated: settlement_status, settlement_settled_at,
--                  settlement_updated_at (always now()), updated_at (always now()).
-- Columns NOT touched: profile_id, workout_count, excused, joined_for_month,
--                      created_at, and all other fields.
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly denied.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. update_ante_core_season_member_settlement
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.update_ante_core_season_member_settlement(
  p_legacy_group_key text,
  p_month_key        text,
  p_display_name     text,
  p_status           text,
  p_settled_at       date
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id   uuid;
  v_season_id uuid;
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
  if p_status is null or trim(p_status) = '' then
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
  -- No-op if season row is missing (pre-canonical group).
  select id into v_season_id
  from ante_core.seasons
  where bloc_id   = v_bloc_id
    and month_key = trim(p_month_key);

  if v_season_id is null then
    return;
  end if;

  -- Update settlement columns only. No INSERT — if the season_member_status row
  -- does not exist, 0 rows are updated and we return silently. Row creation is
  -- handled exclusively by upsert_ante_core_season_member_status (rollover).
  update ante_core.season_member_status
  set
    settlement_status     = trim(p_status),
    settlement_settled_at = p_settled_at,
    settlement_updated_at = now(),
    updated_at            = now()
  where season_id              = v_season_id
    and display_name_snapshot  = trim(p_display_name);
  -- 0 rows affected = pre-canonical group or member not in canonical yet.
  -- Both are acceptable; the blob write already succeeded.
end;
$$;

-- Harden access.
revoke execute on function public.update_ante_core_season_member_settlement(text, text, text, text, date) from public;
revoke execute on function public.update_ante_core_season_member_settlement(text, text, text, text, date) from anon;
revoke execute on function public.update_ante_core_season_member_settlement(text, text, text, text, date) from authenticated;
grant  execute on function public.update_ante_core_season_member_settlement(text, text, text, text, date) to service_role;
