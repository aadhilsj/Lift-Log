-- Read RPC for ante_core current-month excused + sit-out requests (open season only).
-- Returns both data sets in one call to avoid a second PostgREST round-trip.
-- Reads from the private ante_core schema; never exposes the schema directly.
--
-- Call via: POST /rest/v1/rpc/read_ante_core_current_excused_and_sitouts
--
-- Return shape (jsonb object with two array keys):
--   {
--     "excused": [{
--       "legacy_group_key": text,
--       "month_key":        text,
--       "display_name":     text,
--       "excused":          boolean
--     }, ...],
--     "sit_out_requests": [{
--       "legacy_group_key":        text,
--       "month_key":               text,
--       "display_name":            text,
--       "status":                  text,   -- "pending" | "approved" | "declined"
--       "reason":                  text,
--       "exceptional":             boolean,
--       "requested_at":            text|null,  -- ISO 8601 UTC
--       "requested_by":            text,
--       "requested_by_user_id":    text|null,  -- profiles.auth_user_id::text
--       "target_approver_name":    text|null,
--       "target_approver_user_id": text|null,
--       "decided_at":              text|null,  -- ISO 8601 UTC
--       "decided_by":              text|null,
--       "decided_by_user_id":      text|null,
--       "auto_approved":           boolean
--     }, ...]
--   }
--
-- Status mapping: canonical enum 'denied' is mapped back to the blob/UI-facing
-- value 'declined' here. The JS layer never sees 'denied'. This is the inverse
-- of the write-path mapping in upsert_ante_core_sit_out_request.
--
-- Timestamps are formatted as ISO 8601 UTC strings to match the blob shape.
-- *_user_id columns are resolved from their *_profile_id columns to
-- profiles.auth_user_id::text, matching the blob userId string format.
--
-- Filters (both sub-queries):
--   - s.status = 'open'               — open seasons only
--   - b.legacy_group_key is not null  — only blocs with a blob counterpart
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly denied.

create or replace function public.read_ante_core_current_excused_and_sitouts()
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_excused      jsonb;
  v_sitouts      jsonb;
  v_open_seasons jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'legacy_group_key', b.legacy_group_key,
        'month_key',        s.month_key,
        'display_name',     sms.display_name_snapshot,
        'excused',          sms.excused
      )
    ),
    '[]'::jsonb
  )
  into v_excused
  from ante_core.season_member_status sms
  join ante_core.seasons s
    on s.id = sms.season_id
  join ante_core.blocs b
    on b.id = s.bloc_id
  where s.status = 'open'
    and b.legacy_group_key is not null
    and sms.excused = true;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'legacy_group_key',        b.legacy_group_key,
        'month_key',               s.month_key,
        'display_name',            sor.display_name_snapshot,
        'status',                  case sor.status::text
                                     when 'denied' then 'declined'
                                     else sor.status::text
                                   end,
        'reason',                  sor.reason,
        'exceptional',             sor.exceptional,
        'requested_at',            case
                                     when sor.requested_at is null then null
                                     else to_char(sor.requested_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                                   end,
        'requested_by',            sor.requested_by,
        'requested_by_user_id',    rp.auth_user_id::text,
        'target_approver_name',    sor.target_approver_name,
        'target_approver_user_id', tp.auth_user_id::text,
        'decided_at',              case
                                     when sor.decided_at is null then null
                                     else to_char(sor.decided_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                                   end,
        'decided_by',              sor.decided_by,
        'decided_by_user_id',      dp.auth_user_id::text,
        'auto_approved',           sor.auto_approved
      )
    ),
    '[]'::jsonb
  )
  into v_sitouts
  from ante_core.sit_out_requests sor
  join ante_core.seasons s
    on s.id = sor.season_id
  join ante_core.blocs b
    on b.id = sor.bloc_id
  left join ante_core.profiles rp
    on rp.id = sor.requested_by_user_id
  left join ante_core.profiles tp
    on tp.id = sor.target_approver_user_id
  left join ante_core.profiles dp
    on dp.id = sor.decided_by_user_id
  where s.status = 'open'
    and b.legacy_group_key is not null;

  -- Open-seasons sub-query: one row per open legacy-keyed bloc.
  -- Used by the JS overlay to know each group's current month_key even when
  -- the excused and sit-out arrays are empty (zero-row empty-state case).
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'legacy_group_key', b.legacy_group_key,
        'month_key',        s.month_key
      )
    ),
    '[]'::jsonb
  )
  into v_open_seasons
  from ante_core.seasons s
  join ante_core.blocs b
    on b.id = s.bloc_id
  where s.status = 'open'
    and b.legacy_group_key is not null;

  return jsonb_build_object(
    'excused',          v_excused,
    'sit_out_requests', v_sitouts,
    'open_seasons',     v_open_seasons
  );
end;
$$;

revoke execute on function public.read_ante_core_current_excused_and_sitouts() from public;
revoke execute on function public.read_ante_core_current_excused_and_sitouts() from anon;
revoke execute on function public.read_ante_core_current_excused_and_sitouts() from authenticated;
grant  execute on function public.read_ante_core_current_excused_and_sitouts() to service_role;
