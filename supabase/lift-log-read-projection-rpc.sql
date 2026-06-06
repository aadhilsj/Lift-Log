-- Atomic projection read RPC.
-- Returns the full projection state in a single round-trip instead of
-- 14 separate REST calls, eliminating read latency.
--
-- Call via: POST /rest/v1/rpc/read_lift_log_projection

create or replace function public.read_lift_log_projection()
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'meta', (
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'source_revision', source_revision,
        'source_updated_at', source_updated_at,
        'default_group_id', default_group_id,
        'group_order', group_order,
        'updated_at', updated_at
      )) from public.lift_log_projection_meta
    ),
    'profiles', (
      select jsonb_agg(jsonb_build_object(
        'user_id', user_id,
        'email', email,
        'display_name', display_name,
        'created_at', created_at
      )) from public.lift_log_projection_profiles
    ),
    'pendingOtps', (
      select jsonb_agg(jsonb_build_object(
        'email', email,
        'code', code,
        'expires_at', expires_at,
        'user_id', user_id
      )) from public.lift_log_projection_pending_otps
    ),
    'groups', (
      select jsonb_agg(jsonb_build_object(
        'group_id', group_id,
        'name', name,
        'admin_name', admin_name,
        'admin_user_id', admin_user_id,
        'invite_code', invite_code,
        'created_at', created_at,
        'last_month_key', last_month_key,
        'member_order', member_order,
        'min_target', min_target,
        'fine_amount', fine_amount,
        'fee_model', fee_model,
        'escalation_step_amount', escalation_step_amount,
        'currency', currency,
        'min_run_distance', min_run_distance,
        'distance_unit', distance_unit,
        'strava_enabled', strava_enabled,
        'time_zone', time_zone,
        'accepted_workout_types', accepted_workout_types
      )) from public.lift_log_projection_groups
    ),
    'memberships', (
      select jsonb_agg(jsonb_build_object(
        'group_id', group_id,
        'user_id', user_id,
        'display_name', display_name,
        'role', role,
        'joined_at', joined_at
      )) from public.lift_log_projection_group_memberships
    ),
    'joinedMonths', (
      select jsonb_agg(jsonb_build_object(
        'group_id', group_id,
        'display_name', display_name,
        'joined_month_key', joined_month_key
      )) from public.lift_log_projection_group_joined_months
    ),
    'groupExcused', (
      select jsonb_agg(jsonb_build_object(
        'group_id', group_id,
        'display_name', display_name,
        'month_key', month_key,
        'excused', excused
      )) from public.lift_log_projection_group_excused
    ),
    'groupLogs', (
      select jsonb_agg(jsonb_build_object(
        'group_id', group_id,
        'log_id', log_id,
        'owner_display_name', owner_display_name,
        'workout_date', workout_date,
        'workout_type', workout_type,
        'note', note,
        'photo_url', photo_url,
        'created_at', created_at,
        'verified_via', verified_via,
        'flag_status', flag_status,
        'flag_reason', flag_reason,
        'flag_response', flag_response,
        'flagged_by', flagged_by,
        'decision_by', decision_by,
        'decision_at', decision_at
      )) from public.lift_log_projection_group_logs
    ),
    'logReactions', (
      select jsonb_agg(jsonb_build_object(
        'group_id', group_id,
        'log_id', log_id,
        'emoji', emoji,
        'reactor_display_name', reactor_display_name
      )) from public.lift_log_projection_log_reactions
    ),
    'seasonOverrides', (
      select jsonb_agg(jsonb_build_object(
        'group_id', group_id,
        'month_key', month_key,
        'prorated', prorated,
        'prorated_mas', prorated_mas,
        'chosen_at', chosen_at,
        'chosen_by', chosen_by,
        'chosen_by_user_id', chosen_by_user_id
      )) from public.lift_log_projection_season_overrides
    ),
    'sitOutRequests', (
      select jsonb_agg(jsonb_build_object(
        'group_id', group_id,
        'month_key', month_key,
        'member_name', member_name,
        'status', status,
        'reason', reason,
        'exceptional', exceptional,
        'requested_at', requested_at,
        'requested_by', requested_by,
        'requested_by_user_id', requested_by_user_id,
        'target_approver_name', target_approver_name,
        'target_approver_user_id', target_approver_user_id,
        'decided_at', decided_at,
        'decided_by', decided_by,
        'decided_by_user_id', decided_by_user_id,
        'auto_approved', auto_approved
      )) from public.lift_log_projection_sit_out_requests
    ),
    'monthHistory', (
      select jsonb_agg(jsonb_build_object(
        'group_id', group_id,
        'month_key', month_key,
        'label', label,
        'year', year,
        'month', month,
        'min_target', min_target,
        'fine_amount', fine_amount,
        'fee_model', fee_model,
        'escalation_step_amount', escalation_step_amount,
        'currency', currency,
        'min_run_distance', min_run_distance,
        'distance_unit', distance_unit,
        'strava_enabled', strava_enabled,
        'time_zone', time_zone,
        'accepted_workout_types', accepted_workout_types
      )) from public.lift_log_projection_month_history
    ),
    'monthCounts', (
      select jsonb_agg(jsonb_build_object(
        'group_id', group_id,
        'month_key', month_key,
        'display_name', display_name,
        'workout_count', workout_count,
        'excused', excused,
        'settlement_status', settlement_status,
        'settlement_settled_at', settlement_settled_at,
        'settlement_updated_at', settlement_updated_at
      )) from public.lift_log_projection_month_counts
    ),
    'monthLogs', (
      select jsonb_agg(jsonb_build_object(
        'group_id', group_id,
        'month_key', month_key,
        'log_id', log_id,
        'owner_display_name', owner_display_name,
        'workout_date', workout_date,
        'workout_type', workout_type,
        'note', note,
        'photo_url', photo_url,
        'created_at', created_at,
        'verified_via', verified_via,
        'flag_status', flag_status,
        'flag_reason', flag_reason,
        'flag_response', flag_response,
        'flagged_by', flagged_by,
        'decision_by', decision_by,
        'decision_at', decision_at
      )) from public.lift_log_projection_month_logs
    ),
    'monthLogReactions', (
      select jsonb_agg(jsonb_build_object(
        'group_id', group_id,
        'month_key', month_key,
        'log_id', log_id,
        'emoji', emoji,
        'reactor_display_name', reactor_display_name
      )) from public.lift_log_projection_month_log_reactions
    )
  ) into result;

  return result;
end;
$$;
