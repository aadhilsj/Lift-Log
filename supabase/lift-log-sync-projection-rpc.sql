-- Atomic projection sync RPC.
-- Replaces the 15-step sequential HTTP delete+insert with a single
-- PostgreSQL transaction, eliminating all read/write race conditions.
--
-- Call via: POST /rest/v1/rpc/sync_lift_log_projection
-- Body: the full buildProjectionPayload() output as JSON

create or replace function public.sync_lift_log_projection(payload jsonb)
returns void
language plpgsql
security definer
as $$
begin
  -- Delete order respects FK constraints (children before parents).
  delete from public.lift_log_projection_month_log_reactions where group_id is not null;
  delete from public.lift_log_projection_month_logs         where group_id is not null;
  delete from public.lift_log_projection_month_counts       where group_id is not null;
  delete from public.lift_log_projection_month_history      where group_id is not null;
  delete from public.lift_log_projection_sit_out_requests   where group_id is not null;
  delete from public.lift_log_projection_season_overrides   where group_id is not null;
  delete from public.lift_log_projection_log_reactions      where group_id is not null;
  delete from public.lift_log_projection_group_logs         where group_id is not null;
  delete from public.lift_log_projection_group_excused      where group_id is not null;
  delete from public.lift_log_projection_group_joined_months where group_id is not null;
  delete from public.lift_log_projection_group_memberships  where group_id is not null;
  delete from public.lift_log_projection_groups             where group_id is not null;
  delete from public.lift_log_projection_pending_otps       where email   is not null;
  delete from public.lift_log_projection_profiles           where user_id  is not null;
  delete from public.lift_log_projection_meta               where id = true;

  -- Profiles
  insert into public.lift_log_projection_profiles
    (user_id, email, display_name, created_at)
  select
    r->>'user_id',
    r->>'email',
    r->>'display_name',
    (r->>'created_at')::timestamptz
  from jsonb_array_elements(coalesce(payload->'profiles', '[]'::jsonb)) as r;

  -- Pending OTPs
  insert into public.lift_log_projection_pending_otps
    (email, code, expires_at, user_id)
  select
    r->>'email',
    r->>'code',
    (r->>'expires_at')::timestamptz,
    nullif(r->>'user_id', '')
  from jsonb_array_elements(coalesce(payload->'pendingOtps', '[]'::jsonb)) as r;

  -- Groups
  insert into public.lift_log_projection_groups
    (group_id, name, admin_name, admin_user_id, invite_code, created_at,
     last_month_key, member_order, min_target, fine_amount, fee_model,
     escalation_step_amount, currency, min_run_distance, distance_unit,
     strava_enabled, time_zone, accepted_workout_types)
  select
    r->>'group_id',
    r->>'name',
    r->>'admin_name',
    nullif(r->>'admin_user_id', ''),
    r->>'invite_code',
    (r->>'created_at')::timestamptz,
    nullif(r->>'last_month_key', ''),
    array(select jsonb_array_elements_text(coalesce(r->'member_order', '[]'::jsonb))),
    (r->>'min_target')::integer,
    (r->>'fine_amount')::integer,
    r->>'fee_model',
    nullif(r->>'escalation_step_amount', '')::integer,
    r->>'currency',
    (r->>'min_run_distance')::integer,
    r->>'distance_unit',
    (r->>'strava_enabled')::boolean,
    r->>'time_zone',
    array(select jsonb_array_elements_text(coalesce(r->'accepted_workout_types', '[]'::jsonb)))
  from jsonb_array_elements(coalesce(payload->'groups', '[]'::jsonb)) as r;

  -- Memberships
  insert into public.lift_log_projection_group_memberships
    (group_id, user_id, display_name, role, joined_at)
  select
    r->>'group_id',
    r->>'user_id',
    r->>'display_name',
    r->>'role',
    nullif(r->>'joined_at', '')::timestamptz
  from jsonb_array_elements(coalesce(payload->'memberships', '[]'::jsonb)) as r;

  -- Joined months
  insert into public.lift_log_projection_group_joined_months
    (group_id, display_name, joined_month_key)
  select
    r->>'group_id',
    r->>'display_name',
    r->>'joined_month_key'
  from jsonb_array_elements(coalesce(payload->'joinedMonths', '[]'::jsonb)) as r;

  -- Group excused
  insert into public.lift_log_projection_group_excused
    (group_id, display_name, month_key, excused)
  select
    r->>'group_id',
    r->>'display_name',
    r->>'month_key',
    (r->>'excused')::boolean
  from jsonb_array_elements(coalesce(payload->'groupExcused', '[]'::jsonb)) as r;

  -- Group logs
  insert into public.lift_log_projection_group_logs
    (group_id, log_id, owner_display_name, workout_date, workout_type,
     note, photo_url, created_at, verified_via,
     flag_status, flag_reason, flag_response, flagged_by, decision_by, decision_at)
  select
    r->>'group_id',
    r->>'log_id',
    r->>'owner_display_name',
    (r->>'workout_date')::date,
    r->>'workout_type',
    coalesce(r->>'note', ''),
    coalesce(r->>'photo_url', ''),
    (r->>'created_at')::timestamptz,
    r->>'verified_via',
    nullif(r->>'flag_status', ''),
    coalesce(r->>'flag_reason', ''),
    coalesce(r->>'flag_response', ''),
    nullif(r->>'flagged_by', ''),
    nullif(r->>'decision_by', ''),
    nullif(r->>'decision_at', '')::timestamptz
  from jsonb_array_elements(coalesce(payload->'groupLogs', '[]'::jsonb)) as r;

  -- Log reactions
  insert into public.lift_log_projection_log_reactions
    (group_id, log_id, emoji, reactor_display_name)
  select
    r->>'group_id',
    r->>'log_id',
    r->>'emoji',
    r->>'reactor_display_name'
  from jsonb_array_elements(coalesce(payload->'logReactions', '[]'::jsonb)) as r;

  -- Season overrides
  insert into public.lift_log_projection_season_overrides
    (group_id, month_key, prorated, prorated_mas, chosen_at, chosen_by, chosen_by_user_id)
  select
    r->>'group_id',
    r->>'month_key',
    (r->>'prorated')::boolean,
    nullif(r->>'prorated_mas', '')::integer,
    nullif(r->>'chosen_at', '')::timestamptz,
    nullif(r->>'chosen_by', ''),
    nullif(r->>'chosen_by_user_id', '')
  from jsonb_array_elements(coalesce(payload->'seasonOverrides', '[]'::jsonb)) as r;

  -- Sit-out requests
  insert into public.lift_log_projection_sit_out_requests
    (group_id, month_key, member_name, status, reason, exceptional,
     requested_at, requested_by, requested_by_user_id,
     target_approver_name, target_approver_user_id,
     decided_at, decided_by, decided_by_user_id, auto_approved)
  select
    r->>'group_id',
    r->>'month_key',
    r->>'member_name',
    r->>'status',
    coalesce(r->>'reason', ''),
    (r->>'exceptional')::boolean,
    nullif(r->>'requested_at', '')::timestamptz,
    r->>'requested_by',
    nullif(r->>'requested_by_user_id', ''),
    nullif(r->>'target_approver_name', ''),
    nullif(r->>'target_approver_user_id', ''),
    nullif(r->>'decided_at', '')::timestamptz,
    nullif(r->>'decided_by', ''),
    nullif(r->>'decided_by_user_id', ''),
    (r->>'auto_approved')::boolean
  from jsonb_array_elements(coalesce(payload->'sitOutRequests', '[]'::jsonb)) as r;

  -- Month history
  insert into public.lift_log_projection_month_history
    (group_id, month_key, label, year, month, min_target, fine_amount,
     fee_model, escalation_step_amount, currency, min_run_distance,
     distance_unit, strava_enabled, time_zone, accepted_workout_types)
  select
    r->>'group_id',
    r->>'month_key',
    r->>'label',
    (r->>'year')::integer,
    (r->>'month')::integer,
    (r->>'min_target')::integer,
    (r->>'fine_amount')::integer,
    r->>'fee_model',
    nullif(r->>'escalation_step_amount', '')::integer,
    r->>'currency',
    (r->>'min_run_distance')::integer,
    r->>'distance_unit',
    (r->>'strava_enabled')::boolean,
    r->>'time_zone',
    array(select jsonb_array_elements_text(coalesce(r->'accepted_workout_types', '[]'::jsonb)))
  from jsonb_array_elements(coalesce(payload->'monthHistory', '[]'::jsonb)) as r;

  -- Month counts
  insert into public.lift_log_projection_month_counts
    (group_id, month_key, display_name, workout_count, excused,
     settlement_status, settlement_settled_at, settlement_updated_at)
  select
    r->>'group_id',
    r->>'month_key',
    r->>'display_name',
    coalesce((r->>'workout_count')::integer, 0),
    (r->>'excused')::boolean,
    nullif(r->>'settlement_status', ''),
    nullif(r->>'settlement_settled_at', '')::date,
    nullif(r->>'settlement_updated_at', '')::timestamptz
  from jsonb_array_elements(coalesce(payload->'monthCounts', '[]'::jsonb)) as r;

  -- Month logs
  insert into public.lift_log_projection_month_logs
    (group_id, month_key, log_id, owner_display_name, workout_date, workout_type,
     note, photo_url, created_at, verified_via,
     flag_status, flag_reason, flag_response, flagged_by, decision_by, decision_at)
  select
    r->>'group_id',
    r->>'month_key',
    r->>'log_id',
    r->>'owner_display_name',
    (r->>'workout_date')::date,
    r->>'workout_type',
    coalesce(r->>'note', ''),
    coalesce(r->>'photo_url', ''),
    (r->>'created_at')::timestamptz,
    r->>'verified_via',
    nullif(r->>'flag_status', ''),
    coalesce(r->>'flag_reason', ''),
    coalesce(r->>'flag_response', ''),
    nullif(r->>'flagged_by', ''),
    nullif(r->>'decision_by', ''),
    nullif(r->>'decision_at', '')::timestamptz
  from jsonb_array_elements(coalesce(payload->'monthLogs', '[]'::jsonb)) as r;

  -- Month log reactions
  insert into public.lift_log_projection_month_log_reactions
    (group_id, month_key, log_id, emoji, reactor_display_name)
  select
    r->>'group_id',
    r->>'month_key',
    r->>'log_id',
    r->>'emoji',
    r->>'reactor_display_name'
  from jsonb_array_elements(coalesce(payload->'monthLogReactions', '[]'::jsonb)) as r;

  -- Meta written last: becomes visible to readers only after all inserts succeed.
  insert into public.lift_log_projection_meta
    (id, source_revision, source_updated_at, default_group_id, group_order, updated_at)
  select
    true,
    (r->>'source_revision')::bigint,
    nullif(r->>'source_updated_at', '')::timestamptz,
    nullif(r->>'default_group_id', ''),
    array(select jsonb_array_elements_text(coalesce(r->'group_order', '[]'::jsonb))),
    (r->>'updated_at')::timestamptz
  from jsonb_array_elements(coalesce(payload->'meta', '[]'::jsonb)) as r;
end;
$$;
