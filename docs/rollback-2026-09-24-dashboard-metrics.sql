-- ROLLBACK for migration 20260924120000_fix_founder_dashboard_metrics.sql
-- Captured from production (bpvvvqjsfwmmfjvvijkd) on 2026-09-24 immediately
-- before applying it. Restores the three replaced functions to exactly what
-- they were. Run only if the new dashboard numbers look wrong.
--
-- NOTE: this does NOT drop app_daily_activity.open_count or the two new
-- functions. Leaving them is harmless -- nothing reads them once these
-- definitions are back -- and dropping a column is the one genuinely
-- destructive step here, so it stays a deliberate, separate decision.

create or replace function public.record_ante_core_daily_app_activity(p_auth_user_id text, p_opened_at timestamp with time zone DEFAULT now())
 returns void language plpgsql security definer set search_path to 'ante_core', 'public'
as $function$
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

  if v_profile_id is null then
    return;
  end if;

  v_activity_date := (v_opened_at at time zone 'Europe/Oslo')::date;
  insert into ante_core.app_daily_activity (profile_id, activity_date, first_opened_at, last_opened_at)
  values (v_profile_id, v_activity_date, v_opened_at, v_opened_at)
  on conflict (profile_id, activity_date) do update
    set last_opened_at = greatest(ante_core.app_daily_activity.last_opened_at, excluded.last_opened_at);
end;
$function$;

create or replace function public.read_ante_core_founder_dashboard_block_profile_usage(p_now timestamp with time zone DEFAULT now())
 returns jsonb language plpgsql security definer set search_path to 'ante_core', 'public'
as $function$
declare v_now timestamptz:=coalesce(p_now,now()); v_day date:=(v_now at time zone 'Europe/Oslo')::date; v_first date; v_events jsonb; v_averages jsonb;
begin
  select min((occurred_at at time zone 'Europe/Oslo')::date) into v_first from ante_core.app_usage_events where event_name='own_block_profile_opened';
  if v_first is null then return jsonb_build_object('events',jsonb_build_object('own_block_profile_opened',jsonb_build_object('daily',jsonb_build_object('users',0,'total',0),'weekly',jsonb_build_object('users',0,'total',0),'monthly',jsonb_build_object('users',0,'total',0))),'averages',jsonb_build_object('own_block_profile_opened',jsonb_build_object('daily',jsonb_build_object('users',0,'uses',0),'weekly',jsonb_build_object('users',0,'uses',0),'monthly',jsonb_build_object('users',0,'uses',0)))); end if;
  select jsonb_build_object('own_block_profile_opened',jsonb_build_object(
    'daily',jsonb_build_object('users',(select count(distinct profile_id) from ante_core.app_usage_events where event_name='own_block_profile_opened' and (occurred_at at time zone 'Europe/Oslo')::date=v_day),'total',(select count(*) from ante_core.app_usage_events where event_name='own_block_profile_opened' and (occurred_at at time zone 'Europe/Oslo')::date=v_day)),
    'weekly',jsonb_build_object('users',(select count(distinct profile_id) from ante_core.app_usage_events where event_name='own_block_profile_opened' and occurred_at >= date_trunc('week',v_now at time zone 'Europe/Oslo') at time zone 'Europe/Oslo'),'total',(select count(*) from ante_core.app_usage_events where event_name='own_block_profile_opened' and occurred_at >= date_trunc('week',v_now at time zone 'Europe/Oslo') at time zone 'Europe/Oslo')),
    'monthly',jsonb_build_object('users',(select count(distinct profile_id) from ante_core.app_usage_events where event_name='own_block_profile_opened' and occurred_at >= date_trunc('month',v_now at time zone 'Europe/Oslo') at time zone 'Europe/Oslo'),'total',(select count(*) from ante_core.app_usage_events where event_name='own_block_profile_opened' and occurred_at >= date_trunc('month',v_now at time zone 'Europe/Oslo') at time zone 'Europe/Oslo'))
  )) into v_events;
  select jsonb_build_object('own_block_profile_opened',jsonb_build_object('daily',jsonb_build_object('users',(select round(avg(users),1) from (select d, count(distinct e.profile_id) users from generate_series(v_first,v_day,interval '1 day') d left join ante_core.app_usage_events e on e.event_name='own_block_profile_opened' and (e.occurred_at at time zone 'Europe/Oslo')::date=d::date group by d)x),'uses',(select round(avg(uses),1) from (select d,count(e.id) uses from generate_series(v_first,v_day,interval '1 day') d left join ante_core.app_usage_events e on e.event_name='own_block_profile_opened' and (e.occurred_at at time zone 'Europe/Oslo')::date=d::date group by d)x)), 'weekly',jsonb_build_object('users',(v_events->'own_block_profile_opened'->'weekly'->>'users')::numeric,'uses',(v_events->'own_block_profile_opened'->'weekly'->>'total')::numeric), 'monthly',jsonb_build_object('users',(v_events->'own_block_profile_opened'->'monthly'->>'users')::numeric,'uses',(v_events->'own_block_profile_opened'->'monthly'->>'total')::numeric))) into v_averages;
  return jsonb_build_object('events',v_events,'averages',v_averages);
end; $function$;

create or replace function public.read_ante_core_founder_dashboard_usage_averages(p_now timestamp with time zone DEFAULT now())
 returns jsonb language plpgsql security definer set search_path to 'ante_core', 'public'
as $function$
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
$function$;

-- Grants, unchanged by either direction, restated so a rollback leaves the
-- same permissions the migration guaranteed.
revoke execute on function public.record_ante_core_daily_app_activity(text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_ante_core_daily_app_activity(text, timestamptz) to service_role;
revoke execute on function public.read_ante_core_founder_dashboard_block_profile_usage(timestamptz) from public, anon, authenticated;
grant execute on function public.read_ante_core_founder_dashboard_block_profile_usage(timestamptz) to service_role;
revoke execute on function public.read_ante_core_founder_dashboard_usage_averages(timestamptz) from public, anon, authenticated;
grant execute on function public.read_ante_core_founder_dashboard_usage_averages(timestamptz) to service_role;
