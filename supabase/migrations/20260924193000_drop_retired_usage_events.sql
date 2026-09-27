-- Stop reporting two cards that no longer exist in the app (2026-09-24).
--
--   monthly_summary_card_clicked -- the Month Standings expander, removed when
--     the Month page was redesigned
--   bloc_month_opened            -- the Bloc Month card on Today, replaced by
--     the Bloc Loop card (bloc_loop_opened)
--
-- Neither is fired anywhere in src/ or api/ any more, so both rows on the
-- Usage tab could only ever show a frozen historical number next to live ones,
-- which invites reading them as current.
--
-- The names stay in the allowlist and in the app_usage_events check
-- constraint ON PURPOSE. Real rows recorded while those features existed are
-- still in the table, and a check constraint is validated against existing
-- rows -- dropping the names would either fail outright or force deleting
-- genuine member history. Leaving them costs nothing: no code sends them.
--
-- Only the reporting lists change below. The maths is untouched.

create or replace function public.read_ante_core_founder_dashboard_usage(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_today_start timestamptz;
  v_week_start timestamptz;
  v_month_start timestamptz;
  v_events jsonb;
begin
  v_today_start := date_trunc('day', v_now at time zone 'Europe/Oslo') at time zone 'Europe/Oslo';
  v_week_start := date_trunc('week', v_now at time zone 'Europe/Oslo') at time zone 'Europe/Oslo';
  v_month_start := date_trunc('month', v_now at time zone 'Europe/Oslo') at time zone 'Europe/Oslo';

  with event_names(event_name) as (values
    ('today_opened'), ('activity_opened'), ('month_opened'), ('history_opened'),
    ('own_profile_opened'), ('other_profile_opened'), ('mvp_card_opened'),
    ('settings_opened'), ('comment_composer_opened'),
    ('reaction_picker_opened'), ('bloc_stream_opened'),
    ('last_month_banner_clicked'),
    ('bloc_loop_opened'), ('settlement_reminders_opened'),
    ('month_own_slice_opened'), ('month_other_slice_opened'),
    ('own_profile_all_blocs_opened'), ('other_profile_all_blocs_opened'),
    ('bloc_switcher_opened'),
    ('settings_invite_opened'), ('settings_status_opened'),
    ('settings_members_opened'), ('settings_rules_opened'),
    ('workout_type_more_opened'),
    ('activity_photo_opened'), ('activity_photo_browsed')
  ), counts as (
    select n.event_name,
      count(e.id) filter (where e.occurred_at >= v_today_start) as daily_total,
      count(distinct e.profile_id) filter (where e.occurred_at >= v_today_start) as daily_users,
      count(e.id) filter (where e.occurred_at >= v_week_start) as weekly_total,
      count(distinct e.profile_id) filter (where e.occurred_at >= v_week_start) as weekly_users,
      count(e.id) filter (where e.occurred_at >= v_month_start) as monthly_total,
      count(distinct e.profile_id) filter (where e.occurred_at >= v_month_start) as monthly_users,
      count(e.id) as all_time_total,
      count(distinct e.profile_id) as all_time_users
    from event_names n left join ante_core.app_usage_events e on e.event_name = n.event_name
    group by n.event_name
  )
  select jsonb_object_agg(event_name, jsonb_build_object(
    'daily', jsonb_build_object('users', daily_users, 'total', daily_total),
    'weekly', jsonb_build_object('users', weekly_users, 'total', weekly_total),
    'monthly', jsonb_build_object('users', monthly_users, 'total', monthly_total),
    'allTime', jsonb_build_object('users', all_time_users, 'total', all_time_total)
  )) into v_events from counts;

  return jsonb_build_object(
    'range', jsonb_build_object('timeZone', 'Europe/Oslo', 'dailyStarts', v_today_start::text, 'weekStarts', v_week_start::text, 'monthStarts', v_month_start::text),
    'events', coalesce(v_events, '{}'::jsonb)
  );
end;
$$;

revoke execute on function public.read_ante_core_founder_dashboard_usage(timestamptz) from public, anon, authenticated;
grant execute on function public.read_ante_core_founder_dashboard_usage(timestamptz) to service_role;

-- Only share_month_clicked remains a monthly-only action.
create or replace function public.read_ante_core_founder_dashboard_monthly_actions(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_start timestamptz := date_trunc('month', coalesce(p_now, now()) at time zone 'Europe/Oslo') at time zone 'Europe/Oslo';
  v_events jsonb;
begin
  select jsonb_object_agg(event_name, jsonb_build_object('monthly', jsonb_build_object('users', users, 'total', total)))
  into v_events
  from (
    select n.event_name,
           count(distinct e.profile_id) filter (where e.occurred_at >= v_start) as users,
           count(e.id) filter (where e.occurred_at >= v_start) as total
    from (values ('share_month_clicked')) n(event_name)
    left join ante_core.app_usage_events e on e.event_name = n.event_name
    group by n.event_name
  ) x;
  return jsonb_build_object('events', coalesce(v_events, '{}'::jsonb));
end;
$$;

revoke execute on function public.read_ante_core_founder_dashboard_monthly_actions(timestamptz) from public, anon, authenticated;
grant execute on function public.read_ante_core_founder_dashboard_monthly_actions(timestamptz) to service_role;

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
    ('settings_opened'), ('comment_composer_opened'),
    ('reaction_picker_opened'), ('bloc_stream_opened'),
    ('last_month_banner_clicked'),
    ('bloc_loop_opened'), ('settlement_reminders_opened'),
    ('month_own_slice_opened'), ('month_other_slice_opened'),
    ('own_profile_all_blocs_opened'), ('other_profile_all_blocs_opened'),
    ('bloc_switcher_opened'),
    ('settings_invite_opened'), ('settings_status_opened'),
    ('settings_members_opened'), ('settings_rules_opened'),
    ('workout_type_more_opened'),
    ('activity_photo_opened'), ('activity_photo_browsed')
  )
  select jsonb_object_agg(n.event_name, jsonb_build_object(
    'daily', jsonb_build_object('users', coalesce((select round(avg(users),1) from (
      select d.day, count(distinct e.profile_id) users from generate_series(v_first_day,v_today,interval '1 day') d(day)
      left join ante_core.app_usage_events e on e.event_name=n.event_name and (e.occurred_at at time zone 'Europe/Oslo')::date=d.day::date group by d.day) x),0), 'uses', coalesce((select round(avg(uses),1) from (
      select d.day, count(e.id) uses from generate_series(v_first_day,v_today,interval '1 day') d(day)
      left join ante_core.app_usage_events e on e.event_name=n.event_name and (e.occurred_at at time zone 'Europe/Oslo')::date=d.day::date group by d.day) x),0)),
    'weekly', jsonb_build_object('users', coalesce((select round(avg(users),1) from (
      select w.week_start, count(distinct e.profile_id) users from generate_series(v_first_week,date_trunc('week',v_today::timestamp)::date,interval '1 week') w(week_start)
      left join ante_core.app_usage_events e on e.event_name=n.event_name and date_trunc('week',e.occurred_at at time zone 'Europe/Oslo')::date=w.week_start::date group by w.week_start) x),0), 'uses', coalesce((select round(avg(uses),1) from (
      select w.week_start, count(e.id) uses from generate_series(v_first_week,date_trunc('week',v_today::timestamp)::date,interval '1 week') w(week_start)
      left join ante_core.app_usage_events e on e.event_name=n.event_name and date_trunc('week',e.occurred_at at time zone 'Europe/Oslo')::date=w.week_start::date group by w.week_start) x),0)),
    'monthly', jsonb_build_object('users', coalesce((select round(avg(users),1) from (
      select m.month_start, count(distinct e.profile_id) users from generate_series(v_first_month,date_trunc('month',v_today::timestamp)::date,interval '1 month') m(month_start)
      left join ante_core.app_usage_events e on e.event_name=n.event_name and date_trunc('month',e.occurred_at at time zone 'Europe/Oslo')::date=m.month_start::date group by m.month_start) x),0), 'uses', coalesce((select round(avg(uses),1) from (
      select m.month_start, count(e.id) uses from generate_series(v_first_month,date_trunc('month',v_today::timestamp)::date,interval '1 month') m(month_start)
      left join ante_core.app_usage_events e on e.event_name=n.event_name and date_trunc('month',e.occurred_at at time zone 'Europe/Oslo')::date=m.month_start::date group by m.month_start) x),0))
  )) into v_events from event_names n;
  return coalesce(v_events, '{}'::jsonb);
end;
$$;

revoke execute on function public.read_ante_core_founder_dashboard_usage_averages(timestamptz) from public, anon, authenticated;
grant execute on function public.read_ante_core_founder_dashboard_usage_averages(timestamptz) to service_role;
