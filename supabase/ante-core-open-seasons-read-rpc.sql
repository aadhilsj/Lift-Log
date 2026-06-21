-- Read RPC for ante_core.seasons (open seasons only).
-- Returns one row per legacy-keyed bloc that has an open season.
-- Used by the canonical read path to anchor current-month data fetches.
-- Reads from the private ante_core schema; never exposes the schema directly.
--
-- Call via: POST /rest/v1/rpc/read_ante_core_open_seasons
--
-- Return shape (jsonb array):
--   [{
--     "legacy_group_key": text,
--     "season_id":        text,
--     "month_key":        text
--   }, ...]
--
-- month_key format is YYYY-M (zero-based month index, non-padded), e.g. "2026-5".
--
-- Filters:
--   - s.status = 'open'               — open seasons only
--   - b.legacy_group_key is not null  — only blocs with a blob counterpart
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly denied.

create or replace function public.read_ante_core_open_seasons()
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
        'legacy_group_key', b.legacy_group_key,
        'season_id',        s.id::text,
        'month_key',        s.month_key
      )
    ),
    '[]'::jsonb
  )
  into result
  from ante_core.seasons s
  join ante_core.blocs b
    on b.id = s.bloc_id
  where s.status = 'open'
    and b.legacy_group_key is not null;

  return result;
end;
$$;

revoke execute on function public.read_ante_core_open_seasons() from public;
revoke execute on function public.read_ante_core_open_seasons() from anon;
revoke execute on function public.read_ante_core_open_seasons() from authenticated;
grant  execute on function public.read_ante_core_open_seasons() to service_role;
