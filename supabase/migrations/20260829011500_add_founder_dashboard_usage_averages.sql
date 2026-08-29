create or replace function public.read_ante_core_founder_dashboard_usage_averages(
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
  v_first_day date;
  v_first_week date;
  v_first_month date;
  v_daily numeric := 0;
  v_weekly numeric := 0;
  v_monthly numeric := 0;
begin
  select min((occurred_at at time zone 'Europe/Oslo')::date) into v_first_day
  from ante_core.app_usage_events;
  if v_first_day is null then
    return jsonb_build_object('daily', 0, 'weekly', 0, 'monthly', 0, 'trackedDays', 0, 'trackedWeeks', 0, 'trackedMonths', 0);
  end if;

  v_first_week := date_trunc('week', v_first_day::timestamp)::date;
  v_first_month := date_trunc('month', v_first_day::timestamp)::date;

  select coalesce(round(avg(users), 1), 0) into v_daily
  from (
    select days.day, count(distinct events.profile_id) as users
    from generate_series(v_first_day, v_today, interval '1 day') days(day)
    left join ante_core.app_usage_events events
      on (events.occurred_at at time zone 'Europe/Oslo')::date = days.day::date
    group by days.day
  ) daily_counts;

  select coalesce(round(avg(users), 1), 0) into v_weekly
  from (
    select weeks.week_start, count(distinct events.profile_id) as users
    from generate_series(v_first_week, date_trunc('week', v_today::timestamp)::date, interval '1 week') weeks(week_start)
    left join ante_core.app_usage_events events
      on date_trunc('week', (events.occurred_at at time zone 'Europe/Oslo'))::date = weeks.week_start::date
    group by weeks.week_start
  ) weekly_counts;

  select coalesce(round(avg(users), 1), 0) into v_monthly
  from (
    select months.month_start, count(distinct events.profile_id) as users
    from generate_series(v_first_month, date_trunc('month', v_today::timestamp)::date, interval '1 month') months(month_start)
    left join ante_core.app_usage_events events
      on date_trunc('month', (events.occurred_at at time zone 'Europe/Oslo'))::date = months.month_start::date
    group by months.month_start
  ) monthly_counts;

  return jsonb_build_object(
    'daily', v_daily, 'weekly', v_weekly, 'monthly', v_monthly,
    'trackedDays', (v_today - v_first_day + 1),
    'trackedWeeks', ((date_trunc('week', v_today::timestamp)::date - v_first_week) / 7 + 1),
    'trackedMonths', ((date_part('year', v_today) - date_part('year', v_first_month)) * 12 + date_part('month', v_today) - date_part('month', v_first_month) + 1)
  );
end;
$$;

revoke execute on function public.read_ante_core_founder_dashboard_usage_averages(timestamptz) from public, anon, authenticated;
grant execute on function public.read_ante_core_founder_dashboard_usage_averages(timestamptz) to service_role;
