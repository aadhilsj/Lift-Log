-- Read RPC for ante_core.season_overrides.
-- Returns canonical season override rows for the app-state groups overlay.
-- Reads from the private ante_core schema; never exposes the schema directly.
--
-- Call via: POST /rest/v1/rpc/read_ante_core_season_overrides
--
-- Return shape (jsonb array):
--   [{
--     "legacy_group_key":  text,
--     "month_key":         text,
--     "prorated":          boolean,
--     "prorated_mas":      integer|null,
--     "chosen_at":         timestamptz|null,
--     "chosen_by":         text|null,
--     "chosen_by_user_id": text|null
--   }, ...]
--
-- chosen_by_user_id is mapped back to the app-state identity shape via
-- coalesce(profiles.auth_user_id::text, profiles.legacy_user_key).
--
-- Only rows whose parent bloc has a legacy_group_key are returned so the
-- overlay can be applied only to existing blob-backed groups.
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly denied.

create or replace function public.read_ante_core_season_overrides()
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
        'legacy_group_key',  b.legacy_group_key,
        'month_key',         s.month_key,
        'prorated',          so.prorated,
        'prorated_mas',      so.prorated_mas,
        'chosen_at',         so.chosen_at,
        'chosen_by',         so.chosen_by,
        'chosen_by_user_id', coalesce(p.auth_user_id::text, p.legacy_user_key)
      )
    ),
    '[]'::jsonb
  )
  into result
  from ante_core.season_overrides so
  join ante_core.seasons s
    on s.id = so.season_id
  join ante_core.blocs b
    on b.id = s.bloc_id
  left join ante_core.profiles p
    on p.id = so.chosen_by_user_id
  where b.legacy_group_key is not null;

  return result;
end;
$$;

revoke execute on function public.read_ante_core_season_overrides() from public;
revoke execute on function public.read_ante_core_season_overrides() from anon;
revoke execute on function public.read_ante_core_season_overrides() from authenticated;
grant  execute on function public.read_ante_core_season_overrides() to service_role;
