-- Upsert RPC for ante_core.seasons.
-- Creates or updates a single season from the app server (service_role caller).
--
-- Call via: POST /rest/v1/rpc/upsert_ante_core_season
-- Body:     { "p_legacy_group_key": "...", "p_month_key": "...", ... }
--
-- Conflict resolution is on (bloc_id, month_key).
-- bloc_id is resolved from p_legacy_group_key via ante_core.blocs.
-- If bloc not found, raises exception (bloc must exist before season).
-- fee_model and status are cast to their enum types explicitly.
-- created_at is preserved on update.
-- updated_at is set to now() on every upsert.
--
-- Scope: covers create-group (open first season) and season-proration-choice
-- (upsert current season with proration data).
-- Month rollover close/reopen is deferred to a separate slice.
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly denied.

create or replace function public.upsert_ante_core_season(
  p_legacy_group_key       text,
  p_month_key              text,
  p_month_start            date,
  p_label                  text,
  p_year                   integer,
  p_month_index            integer,
  p_status                 text,
  p_closed_at              timestamptz,
  p_min_target             integer,
  p_fine_amount            integer,
  p_fee_model              text,
  p_escalation_step_amount integer,
  p_currency               text,
  p_min_run_distance       integer,
  p_distance_unit          text,
  p_time_zone              text,
  p_strava_enabled         boolean,
  p_accepted_workout_types text[]
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
begin
  -- Validate required fields.
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    raise exception 'legacy_group_key is required';
  end if;
  if p_month_key is null or trim(p_month_key) = '' then
    raise exception 'month_key is required';
  end if;

  -- Resolve bloc_id from legacy_group_key.
  select id into v_bloc_id
  from ante_core.blocs
  where legacy_group_key = trim(p_legacy_group_key);

  if v_bloc_id is null then
    raise exception 'bloc not found for legacy_group_key: %', p_legacy_group_key;
  end if;

  insert into ante_core.seasons (
    bloc_id,
    month_key,
    month_start,
    label,
    year,
    month_index,
    status,
    closed_at,
    min_target,
    fine_amount,
    fee_model,
    escalation_step_amount,
    currency,
    min_run_distance,
    distance_unit,
    time_zone,
    strava_enabled,
    accepted_workout_types,
    created_at,
    updated_at
  )
  values (
    v_bloc_id,
    trim(p_month_key),
    p_month_start,
    p_label,
    p_year,
    p_month_index,
    p_status::ante_core.season_status,
    p_closed_at,
    p_min_target,
    p_fine_amount,
    p_fee_model::ante_core.fee_model_type,
    p_escalation_step_amount,
    p_currency,
    p_min_run_distance,
    p_distance_unit,
    p_time_zone,
    p_strava_enabled,
    coalesce(p_accepted_workout_types, '{}'),
    now(),
    now()
  )
  on conflict (bloc_id, month_key) do update
    set
      label                  = excluded.label,
      status                 = excluded.status,
      closed_at              = excluded.closed_at,
      min_target             = excluded.min_target,
      fine_amount            = excluded.fine_amount,
      fee_model              = excluded.fee_model,
      escalation_step_amount = excluded.escalation_step_amount,
      currency               = excluded.currency,
      min_run_distance       = excluded.min_run_distance,
      distance_unit          = excluded.distance_unit,
      time_zone              = excluded.time_zone,
      strava_enabled         = excluded.strava_enabled,
      accepted_workout_types = excluded.accepted_workout_types,
      -- Preserve original created_at; only bump updated_at.
      updated_at             = now();
end;
$$;

-- Harden access: deny all by default, then grant narrowly.
revoke execute on function public.upsert_ante_core_season(text, text, date, text, integer, integer, text, timestamptz, integer, integer, text, integer, text, integer, text, boolean, text[]) from public;
revoke execute on function public.upsert_ante_core_season(text, text, date, text, integer, integer, text, timestamptz, integer, integer, text, integer, text, integer, text, boolean, text[]) from anon;
revoke execute on function public.upsert_ante_core_season(text, text, date, text, integer, integer, text, timestamptz, integer, integer, text, integer, text, integer, text, boolean, text[]) from authenticated;
grant  execute on function public.upsert_ante_core_season(text, text, date, text, integer, integer, text, timestamptz, integer, integer, text, integer, text, integer, text, boolean, text[]) to service_role;
