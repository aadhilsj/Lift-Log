-- Read RPC for ante_core.workout_logs (open season only).
-- Returns all current-month log rows for all legacy-keyed blocs, with
-- reactions aggregated inline as a jsonb object shaped { emoji: [names] }.
-- Reads from the private ante_core schema; never exposes the schema directly.
--
-- Call via: POST /rest/v1/rpc/read_ante_core_current_logs
--
-- Return shape (jsonb array, one element per workout_log row):
--   [{
--     "legacy_group_key":   text,
--     "id":                 text,
--     "owner_display_name": text,
--     "workout_date":       text,      -- "YYYY-MM-DD"
--     "workout_type":       text,
--     "note":               text,
--     "photo_url":          text,
--     "created_at":         text,      -- ISO 8601 UTC, "YYYY-MM-DDTHH:MI:SS.MSZ"
--     "verified_via":       text,
--     "flag_status":        text|null,
--     "flag_reason":        text,
--     "flag_response":      text,
--     "flagged_by":         text|null,
--     "decision_by":        text|null,
--     "decision_at":        text|null, -- ISO 8601 UTC or null
--     "reactions":          jsonb       -- { "<emoji>": ["DisplayName", ...] }
--   }, ...]
--
-- Filters:
--   - s.status = 'open'               — open seasons only
--   - b.legacy_group_key is not null  — only blocs with a blob counterpart
--
-- Timestamps are formatted as ISO 8601 UTC strings to match the blob shape
-- expected by resolveLogCreatedAt() and shouldKeepLogPhoto() in lift-log.js.
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly denied.

create or replace function public.read_ante_core_current_logs()
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
        'legacy_group_key',   b.legacy_group_key,
        'id',                 wl.id,
        'owner_display_name', wl.owner_display_name,
        'workout_date',       to_char(wl.workout_date, 'YYYY-MM-DD'),
        'workout_type',       wl.workout_type,
        'note',               wl.note,
        'photo_url',          wl.photo_url,
        'created_at',         to_char(wl.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'verified_via',       wl.verified_via,
        'flag_status',        wl.flag_status,
        'flag_reason',        wl.flag_reason,
        'flag_response',      wl.flag_response,
        'flagged_by',         wl.flagged_by,
        'decision_by',        wl.decision_by,
        'decision_at',        case
                                when wl.decision_at is null then null
                                else to_char(wl.decision_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                              end,
        'reactions',          coalesce(
                                (
                                  select jsonb_object_agg(r2.emoji, r2.reactor_names)
                                  from (
                                    select
                                      r.emoji,
                                      jsonb_agg(r.reactor_display_name order by r.created_at) as reactor_names
                                    from ante_core.workout_reactions r
                                    where r.workout_log_id = wl.id
                                    group by r.emoji
                                  ) r2
                                ),
                                '{}'::jsonb
                              )
      )
    ),
    '[]'::jsonb
  )
  into result
  from ante_core.workout_logs wl
  join ante_core.seasons s
    on s.id = wl.season_id
  join ante_core.blocs b
    on b.id = wl.bloc_id
  where s.status = 'open'
    and b.legacy_group_key is not null;

  return result;
end;
$$;

revoke execute on function public.read_ante_core_current_logs() from public;
revoke execute on function public.read_ante_core_current_logs() from anon;
revoke execute on function public.read_ante_core_current_logs() from authenticated;
grant  execute on function public.read_ante_core_current_logs() to service_role;
