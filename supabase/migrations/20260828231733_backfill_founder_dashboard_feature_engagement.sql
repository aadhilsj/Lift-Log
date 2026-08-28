-- Use canonical comment/reaction records in the monthly feature report.
-- Bloc Stream remains recorded through the private monthly usage table because
-- opening the stream is an app-view event rather than a persisted product row.

create or replace function public.read_ante_core_founder_dashboard_growth(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_today date := (v_now at time zone 'Europe/Oslo')::date;
  v_week_start date := v_today - (extract(isodow from v_today)::integer - 1);
  v_previous_week_start date;
  v_month_start date := date_trunc('month', v_today::timestamp)::date;
  v_previous_month_start date;
  v_active_week bigint := 0;
  v_returning_week bigint := 0;
  v_active_month bigint := 0;
  v_returning_month bigint := 0;
  v_month_uploads bigint := 0;
  v_activation_eligible bigint := 0;
  v_activation_completed bigint := 0;
  v_stream_users bigint := 0;
  v_comment_users bigint := 0;
  v_reaction_users bigint := 0;
  v_month_start_at timestamptz;
begin
  v_previous_week_start := v_week_start - 7;
  v_previous_month_start := (v_month_start - interval '1 month')::date;
  v_month_start_at := v_month_start::timestamp at time zone 'Europe/Oslo';

  select count(distinct profile_id) into v_active_week
  from ante_core.app_daily_activity
  where activity_date between v_week_start and v_today;

  select count(distinct current_period.profile_id) into v_returning_week
  from ante_core.app_daily_activity current_period
  where current_period.activity_date between v_week_start and v_today
    and exists (
      select 1 from ante_core.app_daily_activity previous_period
      where previous_period.profile_id = current_period.profile_id
        and previous_period.activity_date between v_previous_week_start and (v_week_start - 1)
    );

  select count(distinct profile_id) into v_active_month
  from ante_core.app_daily_activity
  where activity_date between v_month_start and v_today;

  select count(distinct current_period.profile_id) into v_returning_month
  from ante_core.app_daily_activity current_period
  where current_period.activity_date between v_month_start and v_today
    and exists (
      select 1 from ante_core.app_daily_activity previous_period
      where previous_period.profile_id = current_period.profile_id
        and previous_period.activity_date >= v_previous_month_start
        and previous_period.activity_date < v_month_start
    );

  select count(distinct coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id)) into v_month_uploads
  from ante_core.workout_logs
  where created_at >= v_month_start_at;

  select
    count(*),
    count(*) filter (where first_workout_at <= profile_created_at + interval '7 days')
  into v_activation_eligible, v_activation_completed
  from (
    select p.id, p.created_at as profile_created_at, min(w.created_at) as first_workout_at
    from ante_core.profiles p
    left join ante_core.workout_logs w on w.profile_id = p.id
    where p.created_at <= v_now - interval '7 days'
    group by p.id, p.created_at
  ) eligible_profiles;

  -- Count each current-month active user once per feature. Comments and
  -- reactions come from canonical product tables; opening Bloc Stream comes
  -- from the lightweight monthly view-event table.
  with current_active as (
    select distinct profile_id
    from ante_core.app_daily_activity
    where activity_date between v_month_start and v_today
  )
  select
    count(*) filter (where exists (
      select 1 from ante_core.app_monthly_feature_usage f
      where f.profile_id = current_active.profile_id
        and f.month_start = v_month_start
        and f.feature = 'bloc_stream'
    )),
    count(*) filter (where exists (
      select 1 from ante_core.workout_log_comments c
      where c.commenter_profile_id = current_active.profile_id
        and c.created_at >= v_month_start_at
    )),
    count(*) filter (where exists (
      select 1 from ante_core.workout_reactions r
      where r.reactor_profile_id = current_active.profile_id
        and r.created_at >= v_month_start_at
    ) or exists (
      select 1 from ante_core.workout_log_comment_reactions cr
      where cr.reactor_profile_id = current_active.profile_id
        and cr.created_at >= v_month_start_at
    ))
  into v_stream_users, v_comment_users, v_reaction_users
  from current_active;

  return jsonb_build_object(
    'range', jsonb_build_object(
      'timeZone', 'Europe/Oslo',
      'weekStarts', v_week_start::text,
      'previousWeekStarts', v_previous_week_start::text,
      'monthStarts', v_month_start::text,
      'previousMonthStarts', v_previous_month_start::text
    ),
    'activation', jsonb_build_object(
      'eligibleAccounts', v_activation_eligible,
      'activatedAccounts', v_activation_completed,
      'rate', case when v_activation_eligible = 0 then 0 else round((v_activation_completed::numeric * 100) / v_activation_eligible, 1) end
    ),
    'retention', jsonb_build_object(
      'weekly', jsonb_build_object('activeUsers', v_active_week, 'returningUsers', v_returning_week, 'rate', case when v_active_week = 0 then 0 else round((v_returning_week::numeric * 100) / v_active_week, 1) end),
      'monthly', jsonb_build_object('activeUsers', v_active_month, 'returningUsers', v_returning_month, 'rate', case when v_active_month = 0 then 0 else round((v_returning_month::numeric * 100) / v_active_month, 1) end)
    ),
    'workoutsPerActiveUser', jsonb_build_object('uploads', v_month_uploads, 'activeUsers', v_active_month, 'value', case when v_active_month = 0 then 0 else round(v_month_uploads::numeric / v_active_month, 1) end),
    'featureEngagement', jsonb_build_object('activeUsers', v_active_month, 'blocStreamUsers', v_stream_users, 'commentUsers', v_comment_users, 'reactionUsers', v_reaction_users)
  );
end;
$$;

revoke execute on function public.read_ante_core_founder_dashboard_growth(timestamptz) from public, anon, authenticated;
grant execute on function public.read_ante_core_founder_dashboard_growth(timestamptz) to service_role;
