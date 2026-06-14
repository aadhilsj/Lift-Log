-- Read RPC for ante_core.blocs.
-- Returns canonical bloc settings for the app-state groups overlay.
-- Reads from the private ante_core schema; never exposes the schema directly.
-- Mirrors the shape written by upsert_ante_core_bloc.
--
-- Call via: POST /rest/v1/rpc/read_ante_core_blocs
--
-- Return shape (jsonb array):
--   [{
--     "legacy_group_key":        text,
--     "name":                    text,
--     "time_zone":               text,
--     "currency":                text,
--     "min_target":              integer,
--     "fine_amount":             integer,
--     "fee_model":               text,
--     "escalation_step_amount":  integer|null,
--     "min_run_distance":        integer,
--     "distance_unit":           text,
--     "strava_enabled":          boolean,
--     "accepted_workout_types":  text[]
--   }, ...]
--
-- Only blocs with a legacy_group_key are returned — canonical-only blocs
-- (no legacy_group_key) have no corresponding blob group to overlay onto.
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly denied.

create or replace function public.read_ante_core_blocs()
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
        'legacy_group_key',       b.legacy_group_key,
        'name',                   b.name,
        'time_zone',              b.time_zone,
        'currency',               b.currency,
        'min_target',             b.min_target,
        'fine_amount',            b.fine_amount,
        'fee_model',              b.fee_model::text,
        'escalation_step_amount', b.escalation_step_amount,
        'min_run_distance',       b.min_run_distance,
        'distance_unit',          b.distance_unit,
        'strava_enabled',         b.strava_enabled,
        'accepted_workout_types', b.accepted_workout_types
      )
    ),
    '[]'::jsonb
  )
  into result
  from ante_core.blocs b
  where b.legacy_group_key is not null;

  return result;
end;
$$;

-- Harden access: deny all by default, then grant narrowly.
revoke execute on function public.read_ante_core_blocs() from public;
revoke execute on function public.read_ante_core_blocs() from anon;
revoke execute on function public.read_ante_core_blocs() from authenticated;
grant  execute on function public.read_ante_core_blocs() to service_role;
