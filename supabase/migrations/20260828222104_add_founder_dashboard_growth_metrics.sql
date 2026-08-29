-- Private founder growth metrics. This is additive: it does not alter product
-- records. Rollback drops the two functions and this table; existing product
-- data and the existing founder dashboard remain intact.

create table if not exists ante_core.app_monthly_feature_usage (
  profile_id uuid not null references ante_core.profiles(id) on delete cascade,
  month_start date not null,
  feature text not null check (feature in ('bloc_stream', 'comment', 'reaction')),
  first_used_at timestamptz not null default now(),
  primary key (profile_id, month_start, feature)
);

create index if not exists ante_core_app_monthly_feature_usage_month_feature_idx
  on ante_core.app_monthly_feature_usage (month_start desc, feature, profile_id);

alter table ante_core.app_monthly_feature_usage enable row level security;
revoke all on table ante_core.app_monthly_feature_usage from public, anon, authenticated;

create or replace function public.record_ante_core_monthly_feature_usage(
  p_auth_user_id text,
  p_feature text,
  p_used_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_profile_id uuid;
  v_used_at timestamptz := coalesce(p_used_at, now());
  v_month_start date;
  v_feature text := trim(coalesce(p_feature, ''));
begin
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then return; end if;
  if v_feature not in ('bloc_stream', 'comment', 'reaction') then return; end if;

  select id into v_profile_id
  from ante_core.profiles
  where auth_user_id = trim(p_auth_user_id)::uuid;
  if v_profile_id is null then return; end if;

  v_month_start := date_trunc('month', v_used_at at time zone 'Europe/Oslo')::date;
  insert into ante_core.app_monthly_feature_usage (profile_id, month_start, feature, first_used_at)
  values (v_profile_id, v_month_start, v_feature, v_used_at)
  on conflict (profile_id, month_start, feature) do nothing;
end;
$$;

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
begin
  v_previous_week_start := v_week_start - 7;
  v_previous_month_start := (v_month_start - interval '1 month')::date;

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
  where created_at >= (v_month_start::timestamp at time zone 'Europe/Oslo');

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

  select count(distinct profile_id) filter (where feature = 'bloc_stream'),
         count(distinct profile_id) filter (where feature = 'comment'),
         count(distinct profile_id) filter (where feature = 'reaction')
  into v_stream_users, v_comment_users, v_reaction_users
  from ante_core.app_monthly_feature_usage
  where month_start = v_month_start;

  return jsonb_build_object(
    'range', jsonb_build_object('timeZone', 'Europe/Oslo', 'weekStarts', v_week_start::text, 'monthStarts', v_month_start::text),
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

revoke execute on function public.record_ante_core_monthly_feature_usage(text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.read_ante_core_founder_dashboard_growth(timestamptz) from public, anon, authenticated;
grant execute on function public.record_ante_core_monthly_feature_usage(text, text, timestamptz) to service_role;
grant execute on function public.read_ante_core_founder_dashboard_growth(timestamptz) to service_role;
