-- Preserve a season's closing timestamp when it is re-saved.
--
-- Confirming a settlement re-syncs the month it belongs to, via
-- ensureSettlementConfirmationPrereqs in api/lift-log.js. That path reads the
-- closing time from the legacy blob snapshot, which has never carried a
-- closedAt field, so it passes null. The upsert then wrote that null over a
-- real timestamp.
--
-- Both settlement confirmations that exist in production erased one:
--   Go To Da Gym  Jun '26  wiped 2026-07-30 (Kisal confirmed payment)
--   Ctrl Alt De-feat Jul '26 wiped 2026-08-25 (Giang confirmed payment)
--
-- A 100% rate, and settlements are about to become a monthly event.
--
-- Fixed here rather than at the one call site, because add-log passes the same
-- null for a closed month and any future caller would inherit the same trap.
-- Closing a season never clears a timestamp it already has; reopening one still
-- clears it, which is the only case where clearing is meaningful.
--
-- See docs/rollover-incident-2026-09-01.md (I5).

create or replace function public.upsert_ante_core_season(
  p_legacy_group_key text, p_month_key text, p_month_start date, p_label text,
  p_year integer, p_month_index integer, p_status text,
  p_closed_at timestamp with time zone, p_min_target integer,
  p_fine_amount integer, p_fee_model text, p_escalation_step_amount integer,
  p_currency text, p_min_run_distance integer, p_distance_unit text,
  p_time_zone text, p_strava_enabled boolean, p_accepted_workout_types text[]
)
returns void
language plpgsql
security definer
set search_path to 'ante_core', 'public'
as $function$
declare
  v_bloc_id uuid;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    raise exception 'legacy_group_key is required';
  end if;
  if p_month_key is null or trim(p_month_key) = '' then
    raise exception 'month_key is required';
  end if;

  select id into v_bloc_id
  from ante_core.blocs
  where legacy_group_key = trim(p_legacy_group_key);

  if v_bloc_id is null then
    raise exception 'bloc not found for legacy_group_key: %', p_legacy_group_key;
  end if;

  insert into ante_core.seasons (
    bloc_id, month_key, month_start, label, year, month_index,
    status, closed_at, min_target, fine_amount, fee_model,
    escalation_step_amount, currency, min_run_distance, distance_unit,
    time_zone, strava_enabled, accepted_workout_types, created_at, updated_at
  )
  values (
    v_bloc_id, trim(p_month_key), p_month_start, p_label, p_year, p_month_index,
    p_status::ante_core.season_status, p_closed_at, p_min_target, p_fine_amount,
    p_fee_model::ante_core.fee_model_type, p_escalation_step_amount, p_currency,
    p_min_run_distance, p_distance_unit, p_time_zone, p_strava_enabled,
    coalesce(p_accepted_workout_types, '{}'), now(), now()
  )
  on conflict (bloc_id, month_key) do update
    set
      label                  = excluded.label,
      status                 = excluded.status,
      -- The only changed line. A close never discards a timestamp it already
      -- has; a reopen still clears it.
      closed_at              = case
                                 when excluded.status = 'closed'::ante_core.season_status
                                   then coalesce(excluded.closed_at, seasons.closed_at)
                                 else excluded.closed_at
                               end,
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
      updated_at             = now();
end;
$function$;
