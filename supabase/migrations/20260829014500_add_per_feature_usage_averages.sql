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
  v_events jsonb;
begin
  select min((occurred_at at time zone 'Europe/Oslo')::date) into v_first_day from ante_core.app_usage_events;
  if v_first_day is null then return '{}'::jsonb; end if;
  v_first_week := date_trunc('week', v_first_day::timestamp)::date;
  v_first_month := date_trunc('month', v_first_day::timestamp)::date;

  with event_names(event_name) as (values
    ('today_opened'), ('activity_opened'), ('month_opened'), ('history_opened'),
    ('own_profile_opened'), ('other_profile_opened'), ('mvp_card_opened'),
    ('bloc_month_opened'), ('settings_opened'), ('comment_composer_opened'),
    ('reaction_picker_opened'), ('bloc_stream_opened')
  )
  select jsonb_object_agg(n.event_name, jsonb_build_object(
    'daily', coalesce((select round(avg(users), 1) from (
      select d.day, count(distinct e.profile_id) users
      from generate_series(v_first_day, v_today, interval '1 day') d(day)
      left join ante_core.app_usage_events e on e.event_name=n.event_name and (e.occurred_at at time zone 'Europe/Oslo')::date=d.day::date
      group by d.day
    ) x), 0),
    'weekly', coalesce((select round(avg(users), 1) from (
      select w.week_start, count(distinct e.profile_id) users
      from generate_series(v_first_week, date_trunc('week', v_today::timestamp)::date, interval '1 week') w(week_start)
      left join ante_core.app_usage_events e on e.event_name=n.event_name and date_trunc('week', e.occurred_at at time zone 'Europe/Oslo')::date=w.week_start::date
      group by w.week_start
    ) x), 0),
    'monthly', coalesce((select round(avg(users), 1) from (
      select m.month_start, count(distinct e.profile_id) users
      from generate_series(v_first_month, date_trunc('month', v_today::timestamp)::date, interval '1 month') m(month_start)
      left join ante_core.app_usage_events e on e.event_name=n.event_name and date_trunc('month', e.occurred_at at time zone 'Europe/Oslo')::date=m.month_start::date
      group by m.month_start
    ) x), 0)
  )) into v_events from event_names n;
  return coalesce(v_events, '{}'::jsonb);
end;
$$;

revoke execute on function public.read_ante_core_founder_dashboard_usage_averages(timestamptz) from public, anon, authenticated;
grant execute on function public.read_ante_core_founder_dashboard_usage_averages(timestamptz) to service_role;
