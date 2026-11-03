-- The two account counts use the excluded set as well (3 November 2026).
--
-- Found by checking, not by reading. After 20261103230000 landed and the
-- reviewer's account joined Sunday Warriors, activeUsers and workoutUploads
-- held steady but accounts moved 48 -> 49 and newLast30Days 0 -> 1.
--
-- The cause: these two counts were written by 20261029140000, before
-- v_excluded_profile_ids existed, and still carried their own inline
-- `email not like 'review.%@joinfero.app'`. 20261030120000 added the variable
-- and used it for the nine other reads but left these two as it found them, so
-- widening the variable had no effect on them.
--
-- They now use v_excluded_profile_ids like everything else, which both fixes
-- the reviewer and removes the last place the prefix is spelled out twice.
--
-- Rollback: re-run 20261103230000.

CREATE OR REPLACE FUNCTION public.read_ante_core_founder_dashboard(p_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ante_core', 'public'
AS $function$
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
  v_trend jsonb;  v_excluded_bloc_ids uuid[];
  v_excluded_profile_ids uuid[];
begin
  v_week_start := v_today - (extract(isodow from v_today)::integer - 1);
  -- App Review's fixture Bloc and its accounts are not product. Resolved by
  -- email prefix so a future review.<name>@joinfero.app needs no edit here,
  -- and excluded by BLOC rather than by author so anything the reviewer logs
  -- during review is left out too, whatever account they use.
  select array_agg(distinct bm.bloc_id) into v_excluded_bloc_ids
  from ante_core.bloc_members bm
  join ante_core.profiles p on p.id = bm.profile_id
  where p.email like 'review.%@joinfero.app';
  v_excluded_bloc_ids := coalesce(v_excluded_bloc_ids, array[]::uuid[]);

  -- Anyone sitting in an excluded Bloc is excluded too, not only the seeded
  -- review.% accounts. Apple's own reviewer signs in with an ordinary mailbox
  -- (feroappreview@gmail.com), which matches no prefix; resolving the set from
  -- membership rather than from the address keeps that account, and any future
  -- one, out of the activity counts without another edit here.
  select array_agg(distinct id) into v_excluded_profile_ids
  from (
    select p.id from ante_core.profiles p where p.email like 'review.%@joinfero.app'
    union
    select bm.profile_id from ante_core.bloc_members bm where bm.bloc_id = any(v_excluded_bloc_ids)
  ) s;
  v_excluded_profile_ids := coalesce(v_excluded_profile_ids, array[]::uuid[]);

  v_month_start := date_trunc('month', v_today::timestamp)::date;
  v_thirty_day_start := v_today - 29;
  v_today_start := v_today::timestamp at time zone 'Europe/Oslo';
  v_week_start_at := v_week_start::timestamp at time zone 'Europe/Oslo';
  v_month_start_at := v_month_start::timestamp at time zone 'Europe/Oslo';
  v_thirty_day_start_at := v_thirty_day_start::timestamp at time zone 'Europe/Oslo';

  select count(distinct profile_id) into v_active_today
  from ante_core.app_daily_activity where profile_id <> all(v_excluded_profile_ids) and activity_date = v_today;
  select count(distinct profile_id) into v_active_week
  from ante_core.app_daily_activity where profile_id <> all(v_excluded_profile_ids) and activity_date between v_week_start and v_today;
  select count(distinct profile_id) into v_active_month
  from ante_core.app_daily_activity where profile_id <> all(v_excluded_profile_ids) and activity_date between v_month_start and v_today;
  select min(activity_date) into v_active_tracking_started from ante_core.app_daily_activity
  where profile_id <> all(v_excluded_profile_ids);

  select coalesce(round(avg(coalesce(activity.total, 0))::numeric, 1), 0) into v_active_average_daily
  from generate_series(coalesce(v_active_tracking_started, v_today), v_today, interval '1 day') as period_start(activity_date)
  left join (
    select activity_date, count(distinct profile_id)::bigint as total
    from ante_core.app_daily_activity
    where profile_id <> all(v_excluded_profile_ids)
      and activity_date between coalesce(v_active_tracking_started, v_today) and v_today
    group by activity_date
  ) activity on activity.activity_date = period_start.activity_date::date;

  select coalesce(round(avg(coalesce(activity.total, 0))::numeric, 1), 0) into v_active_average_weekly
  from generate_series(date_trunc('week', coalesce(v_active_tracking_started, v_today)::timestamp)::date, v_week_start, interval '7 days') as period_start(activity_date)
  left join lateral (
    select count(distinct profile_id)::bigint as total
    from ante_core.app_daily_activity
    where profile_id <> all(v_excluded_profile_ids)
      and activity_date between period_start.activity_date::date and (period_start.activity_date::date + 6)
  ) activity on true;

  select coalesce(round(avg(coalesce(activity.total, 0))::numeric, 1), 0) into v_active_average_monthly
  from generate_series(date_trunc('month', coalesce(v_active_tracking_started, v_today)::timestamp)::date, v_month_start, interval '1 month') as period_start(activity_date)
  left join lateral (
    select count(distinct profile_id)::bigint as total
    from ante_core.app_daily_activity
    where profile_id <> all(v_excluded_profile_ids)
      and activity_date >= period_start.activity_date::date
      and activity_date < (period_start.activity_date::date + interval '1 month')::date
  ) activity on true;

  select
    count(distinct case when created_at >= v_today_start then coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id) end),
    count(distinct case when created_at >= v_week_start_at then coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id) end),
    count(distinct case when created_at >= v_month_start_at then coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id) end),
    count(distinct coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id))
  into v_upload_today, v_upload_week, v_upload_month, v_upload_all_time
  from ante_core.workout_logs
  where bloc_id <> all(v_excluded_bloc_ids);
  select min((created_at at time zone 'Europe/Oslo')::date) into v_upload_tracking_started from ante_core.workout_logs
  where bloc_id <> all(v_excluded_bloc_ids);

  select coalesce(round(avg(coalesce(uploads.total, 0))::numeric, 1), 0) into v_upload_average_daily
  from generate_series(coalesce(v_upload_tracking_started, v_today), v_today, interval '1 day') as period_start(activity_date)
  left join lateral (
    select count(distinct coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id))::bigint as total
    from ante_core.workout_logs
    where bloc_id <> all(v_excluded_bloc_ids)
      and (created_at at time zone 'Europe/Oslo')::date = period_start.activity_date::date
  ) uploads on true;

  select coalesce(round(avg(coalesce(uploads.total, 0))::numeric, 1), 0) into v_upload_average_weekly
  from generate_series(date_trunc('week', coalesce(v_upload_tracking_started, v_today)::timestamp)::date, v_week_start, interval '7 days') as period_start(activity_date)
  left join lateral (
    select count(distinct coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id))::bigint as total
    from ante_core.workout_logs
    where bloc_id <> all(v_excluded_bloc_ids)
      and (created_at at time zone 'Europe/Oslo')::date between period_start.activity_date::date and (period_start.activity_date::date + 6)
  ) uploads on true;

  select coalesce(round(avg(coalesce(uploads.total, 0))::numeric, 1), 0) into v_upload_average_monthly
  from generate_series(date_trunc('month', coalesce(v_upload_tracking_started, v_today)::timestamp)::date, v_month_start, interval '1 month') as period_start(activity_date)
  left join lateral (
    select count(distinct coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id))::bigint as total
    from ante_core.workout_logs
    where bloc_id <> all(v_excluded_bloc_ids)
      and (created_at at time zone 'Europe/Oslo')::date >= period_start.activity_date::date
      and (created_at at time zone 'Europe/Oslo')::date < (period_start.activity_date::date + interval '1 month')::date
  ) uploads on true;

  select count(*) into v_accounts_total from ante_core.profiles where id <> all(v_excluded_profile_ids);
  select count(*) into v_accounts_new_last_30_days from ante_core.profiles where id <> all(v_excluded_profile_ids) and created_at >= v_thirty_day_start_at;

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
    where profile_id <> all(v_excluded_profile_ids)
      and activity_date between v_thirty_day_start and v_today
    group by activity_date
  ) activity on activity.activity_date = series.activity_date::date
  left join (
    select (created_at at time zone 'Europe/Oslo')::date as activity_date,
           count(distinct coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id))::bigint as total
    from ante_core.workout_logs
    where bloc_id <> all(v_excluded_bloc_ids)
      and created_at >= v_thirty_day_start_at
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
$function$;
