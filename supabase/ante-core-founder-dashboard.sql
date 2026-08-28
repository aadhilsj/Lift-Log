-- Fero founder dashboard: privacy-minimised daily activity and aggregate metrics.
--
-- Deployment requirements:
-- 1. Take a fresh production application-data backup.
-- 2. Apply this reviewed SQL to the confirmed production Supabase project.
-- 3. Set FOUNDER_DASHBOARD_USER_IDS and CRON_SECRET as Sensitive Vercel
--    variables, then deploy the app code.
-- 4. Read back the functions, ACLs, RLS state and retention-cron result.
--
-- Privacy model:
-- - one row per authenticated canonical profile per Europe/Oslo calendar day
-- - no email, device ID, IP address, content or third-party data
-- - profile deletion cascades to this table
-- - daily rows are purged after 90 days; the founder-only dashboard may show
--   existing profile display names, but never emails or per-person activity

create table if not exists ante_core.app_daily_activity (
  profile_id uuid not null references ante_core.profiles(id) on delete cascade,
  activity_date date not null,
  first_opened_at timestamptz not null,
  last_opened_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, activity_date),
  check (last_opened_at >= first_opened_at)
);

create index if not exists ante_core_app_daily_activity_date_profile_idx
  on ante_core.app_daily_activity (activity_date desc, profile_id);

-- Global canonical upload metrics filter by creation time. This is additive and
-- does not affect product reads/writes.
create index if not exists ante_core_workout_logs_created_at_idx
  on ante_core.workout_logs (created_at desc);

alter table ante_core.app_daily_activity enable row level security;
revoke all on table ante_core.app_daily_activity from public;
revoke all on table ante_core.app_daily_activity from anon;
revoke all on table ante_core.app_daily_activity from authenticated;

create or replace function public.record_ante_core_daily_app_activity(
  p_auth_user_id text,
  p_opened_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_profile_id uuid;
  v_opened_at timestamptz := coalesce(p_opened_at, now());
  v_activity_date date;
begin
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then
    return;
  end if;

  select id into v_profile_id
  from ante_core.profiles
  where auth_user_id = trim(p_auth_user_id)::uuid;

  -- A signed-in account may not have completed profile setup yet. Do not create
  -- a separate identity record merely for analytics.
  if v_profile_id is null then
    return;
  end if;

  v_activity_date := (v_opened_at at time zone 'Europe/Oslo')::date;
  insert into ante_core.app_daily_activity (profile_id, activity_date, first_opened_at, last_opened_at)
  values (v_profile_id, v_activity_date, v_opened_at, v_opened_at)
  on conflict (profile_id, activity_date) do update
    set last_opened_at = greatest(ante_core.app_daily_activity.last_opened_at, excluded.last_opened_at);
end;
$$;

create or replace function public.purge_ante_core_daily_app_activity(
  p_retention_days integer default 90
)
returns integer
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_deleted integer := 0;
  v_retention_days integer := greatest(30, least(coalesce(p_retention_days, 90), 365));
begin
  delete from ante_core.app_daily_activity
  where activity_date < ((now() at time zone 'Europe/Oslo')::date - (v_retention_days - 1));
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.read_ante_core_founder_dashboard(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_today date := (coalesce(p_now, now()) at time zone 'Europe/Oslo')::date;
  v_week_start date;
  v_month_start date;
  v_thirty_day_start date;
  v_today_start timestamptz;
  v_week_start_at timestamptz;
  v_month_start_at timestamptz;
  v_thirty_day_start_at timestamptz;
  v_active_today bigint;
  v_active_week bigint;
  v_active_month bigint;
  v_active_tracking_started date;
  v_active_average_daily numeric;
  v_active_average_weekly numeric;
  v_active_average_monthly numeric;
  v_upload_today bigint;
  v_upload_week bigint;
  v_upload_month bigint;
  v_upload_all_time bigint;
  v_upload_tracking_started date;
  v_upload_average_daily numeric;
  v_upload_average_weekly numeric;
  v_upload_average_monthly numeric;
  v_accounts_total bigint;
  v_accounts_new_last_30_days bigint;
  v_trend jsonb;
begin
  v_week_start := v_today - (extract(isodow from v_today)::integer - 1);
  v_month_start := date_trunc('month', v_today::timestamp)::date;
  v_thirty_day_start := v_today - 29;
  v_today_start := v_today::timestamp at time zone 'Europe/Oslo';
  v_week_start_at := v_week_start::timestamp at time zone 'Europe/Oslo';
  v_month_start_at := v_month_start::timestamp at time zone 'Europe/Oslo';
  v_thirty_day_start_at := v_thirty_day_start::timestamp at time zone 'Europe/Oslo';

  select count(distinct profile_id) into v_active_today
  from ante_core.app_daily_activity where activity_date = v_today;
  select count(distinct profile_id) into v_active_week
  from ante_core.app_daily_activity where activity_date between v_week_start and v_today;
  select count(distinct profile_id) into v_active_month
  from ante_core.app_daily_activity where activity_date between v_month_start and v_today;

  select min(activity_date) into v_active_tracking_started
  from ante_core.app_daily_activity;

  -- Averages use comparable trailing periods: 30 days, four seven-day
  -- periods, and three 30-day periods. Empty days/periods count as zero.
  select coalesce(round(avg(coalesce(activity.total, 0))::numeric, 1), 0) into v_active_average_daily
  from generate_series(coalesce(v_active_tracking_started, v_today), v_today, interval '1 day') as period_start(activity_date)
  left join (
    select activity_date, count(distinct profile_id)::bigint as total
    from ante_core.app_daily_activity
    where activity_date between coalesce(v_active_tracking_started, v_today) and v_today
    group by activity_date
  ) activity on activity.activity_date = period_start.activity_date::date;

  select coalesce(round(avg(coalesce(activity.total, 0))::numeric, 1), 0) into v_active_average_weekly
  from generate_series(
    date_trunc('week', coalesce(v_active_tracking_started, v_today)::timestamp)::date,
    v_week_start,
    interval '7 days'
  ) as period_start(activity_date)
  left join lateral (
    select count(distinct profile_id)::bigint as total
    from ante_core.app_daily_activity
    where activity_date between period_start.activity_date::date and (period_start.activity_date::date + 6)
  ) activity on true;

  select coalesce(round(avg(coalesce(activity.total, 0))::numeric, 1), 0) into v_active_average_monthly
  from generate_series(
    date_trunc('month', coalesce(v_active_tracking_started, v_today)::timestamp)::date,
    v_month_start,
    interval '1 month'
  ) as period_start(activity_date)
  left join lateral (
    select count(distinct profile_id)::bigint as total
    from ante_core.app_daily_activity
    where activity_date >= period_start.activity_date::date
      and activity_date < (period_start.activity_date::date + interval '1 month')::date
  ) activity on true;

  -- A workout copied into another Bloc remains one user upload. This mirrors
  -- the app's existing logical-session convention used by the two-per-day cap.
  select
    count(distinct case when created_at >= v_today_start then coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id) end),
    count(distinct case when created_at >= v_week_start_at then coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id) end),
    count(distinct case when created_at >= v_month_start_at then coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id) end),
    count(distinct coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id))
  into v_upload_today, v_upload_week, v_upload_month, v_upload_all_time
  from ante_core.workout_logs;

  select min((created_at at time zone 'Europe/Oslo')::date) into v_upload_tracking_started
  from ante_core.workout_logs;

  select coalesce(round(avg(coalesce(uploads.total, 0))::numeric, 1), 0) into v_upload_average_daily
  from generate_series(coalesce(v_upload_tracking_started, v_today), v_today, interval '1 day') as period_start(activity_date)
  left join lateral (
    select count(distinct coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id))::bigint as total
    from ante_core.workout_logs
    where (created_at at time zone 'Europe/Oslo')::date = period_start.activity_date::date
  ) uploads on true;

  select coalesce(round(avg(coalesce(uploads.total, 0))::numeric, 1), 0) into v_upload_average_weekly
  from generate_series(
    date_trunc('week', coalesce(v_upload_tracking_started, v_today)::timestamp)::date,
    v_week_start,
    interval '7 days'
  ) as period_start(activity_date)
  left join lateral (
    select count(distinct coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id))::bigint as total
    from ante_core.workout_logs
    where (created_at at time zone 'Europe/Oslo')::date between period_start.activity_date::date and (period_start.activity_date::date + 6)
  ) uploads on true;

  select coalesce(round(avg(coalesce(uploads.total, 0))::numeric, 1), 0) into v_upload_average_monthly
  from generate_series(
    date_trunc('month', coalesce(v_upload_tracking_started, v_today)::timestamp)::date,
    v_month_start,
    interval '1 month'
  ) as period_start(activity_date)
  left join lateral (
    select count(distinct coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id))::bigint as total
    from ante_core.workout_logs
    where (created_at at time zone 'Europe/Oslo')::date >= period_start.activity_date::date
      and (created_at at time zone 'Europe/Oslo')::date < (period_start.activity_date::date + interval '1 month')::date
  ) uploads on true;

  select count(*) into v_accounts_total from ante_core.profiles;
  select count(*) into v_accounts_new_last_30_days
  from ante_core.profiles where created_at >= v_thirty_day_start_at;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', series.activity_date::date::text,
    'activeUsers', coalesce(activity.total, 0),
    'workoutUploads', coalesce(uploads.total, 0)
  ) order by series.activity_date), '[]'::jsonb)
  into v_trend
  from generate_series(v_thirty_day_start, v_today, interval '1 day') as series(activity_date)
  left join (
    select activity_date, count(distinct profile_id)::bigint as total
    from ante_core.app_daily_activity
    where activity_date between v_thirty_day_start and v_today
    group by activity_date
  ) activity on activity.activity_date = series.activity_date::date
  left join (
    select (created_at at time zone 'Europe/Oslo')::date as activity_date,
           count(distinct coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id))::bigint as total
    from ante_core.workout_logs
    where created_at >= v_thirty_day_start_at
    group by (created_at at time zone 'Europe/Oslo')::date
  ) uploads on uploads.activity_date = series.activity_date::date;

  return jsonb_build_object(
    'range', jsonb_build_object('timeZone', 'Europe/Oslo', 'today', v_today::text, 'weekStarts', v_week_start::text, 'monthStarts', v_month_start::text, 'activeUserTrackingStarted', v_active_tracking_started::text, 'workoutUploadTrackingStarted', v_upload_tracking_started::text),
    'activeUsers', jsonb_build_object('today', v_active_today, 'week', v_active_week, 'month', v_active_month, 'averages', jsonb_build_object('daily', v_active_average_daily, 'weekly', v_active_average_weekly, 'monthly', v_active_average_monthly)),
    'workoutUploads', jsonb_build_object('today', v_upload_today, 'week', v_upload_week, 'month', v_upload_month, 'allTime', v_upload_all_time, 'averages', jsonb_build_object('daily', v_upload_average_daily, 'weekly', v_upload_average_weekly, 'monthly', v_upload_average_monthly)),
    'accounts', jsonb_build_object('total', v_accounts_total, 'newLast30Days', v_accounts_new_last_30_days),
    'trend', jsonb_build_object('daily', v_trend)
  );
end;
$$;

-- Owner-dashboard detail payload. This is an RPC rather than a direct
-- PostgREST read because ante_core is deliberately not an exposed API schema.
-- The application applies its founder allowlist before it invokes this
-- service-role-only function.
create or replace function public.read_ante_core_founder_dashboard_details(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_today date := (coalesce(p_now, now()) at time zone 'Europe/Oslo')::date;
  v_thirty_day_start date;
  v_thirty_day_start_at timestamptz;
  v_active_blocs_three_plus bigint;
  v_active_blocs_five_plus bigint;
  v_new_profiles jsonb;
  v_all_profiles jsonb;
begin
  v_thirty_day_start := v_today - 29;
  v_thirty_day_start_at := v_thirty_day_start::timestamp at time zone 'Europe/Oslo';

  select coalesce(jsonb_agg(jsonb_build_object('displayName', display_name) order by created_at desc, id), '[]'::jsonb)
  into v_new_profiles
  from ante_core.profiles
  where created_at >= v_thirty_day_start_at;

  select coalesce(jsonb_agg(jsonb_build_object('displayName', display_name) order by lower(display_name), id), '[]'::jsonb)
  into v_all_profiles
  from ante_core.profiles;

  -- Count each Bloc's own log rows. A shared workout means that both Blocs
  -- were active communities, so it intentionally counts in each Bloc.
  select
    count(*) filter (where recent_logs >= 3),
    count(*) filter (where recent_logs >= 5)
  into v_active_blocs_three_plus, v_active_blocs_five_plus
  from (
    select bloc_id, count(*) as recent_logs
    from ante_core.workout_logs
    where created_at >= v_thirty_day_start_at
    group by bloc_id
  ) active_blocs;

  return jsonb_build_object(
    'accounts', jsonb_build_object('newProfiles', v_new_profiles, 'allProfiles', v_all_profiles),
    'activeBlocs', jsonb_build_object('threePlus', v_active_blocs_three_plus, 'fivePlus', v_active_blocs_five_plus, 'periodDays', 30)
  );
end;
$$;

-- Every function starts executable by PUBLIC in PostgreSQL. Keep these private:
-- the app server authenticates the caller and enforces the founder allowlist.
revoke execute on function public.record_ante_core_daily_app_activity(text, timestamptz) from public, anon, authenticated;
revoke execute on function public.purge_ante_core_daily_app_activity(integer) from public, anon, authenticated;
revoke execute on function public.read_ante_core_founder_dashboard(timestamptz) from public, anon, authenticated;
revoke execute on function public.read_ante_core_founder_dashboard_details(timestamptz) from public, anon, authenticated;
grant execute on function public.record_ante_core_daily_app_activity(text, timestamptz) to service_role;
grant execute on function public.purge_ante_core_daily_app_activity(integer) to service_role;
grant execute on function public.read_ante_core_founder_dashboard(timestamptz) to service_role;
grant execute on function public.read_ante_core_founder_dashboard_details(timestamptz) to service_role;
