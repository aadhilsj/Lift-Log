-- Founder dashboard metric corrections (2026-09-24).
--
-- Four separate faults, all found while auditing the dashboard against the
-- live tables:
--
-- 1. "Profile Screen" had no all-time figure at all, so the All Time view
--    printed 0 users / 0 uses for a row whose real total is 305 opens.
-- 2. "Profile Screen" weekly and monthly "averages" were the CURRENT week's
--    and month's totals copied into an average-shaped field. Only its daily
--    average was a real average.
-- 3. Month Standings Expanded and Last Month Banner were missing from the
--    per-feature averages entirely, so both read 0.0 on every period.
-- 4. There was no count of app opens — only a count of distinct people per
--    day. One person opening Fero ten times looked the same as opening once.
--
-- Backwards compatible: every key returned before is still returned, with the
-- same meaning. Only new keys are added and wrong numbers corrected.

-- ---------------------------------------------------------------------------
-- App opens
-- ---------------------------------------------------------------------------

-- Rows written before today have no per-open history, so they start at 1:
-- that is a floor (the person was active, so they opened it at least once),
-- never an invention. read_ante_core_founder_dashboard reports the date exact
-- counting began so the dashboard can say so out loud.
alter table ante_core.app_daily_activity
  add column if not exists open_count integer not null default 1;

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
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then return; end if;

  select id into v_profile_id from ante_core.profiles
  where auth_user_id = trim(p_auth_user_id)::uuid;
  if v_profile_id is null then return; end if;

  v_activity_date := (v_opened_at at time zone 'Europe/Oslo')::date;

  insert into ante_core.app_daily_activity (profile_id, activity_date, first_opened_at, last_opened_at, open_count)
  values (v_profile_id, v_activity_date, v_opened_at, v_opened_at, 1)
  on conflict (profile_id, activity_date) do update
    set last_opened_at = greatest(ante_core.app_daily_activity.last_opened_at, excluded.last_opened_at),
        -- A fresh open, not a token refresh or a second tab. Coming back after
        -- a 30 minute gap is a new open; anything tighter is the same sitting.
        open_count = ante_core.app_daily_activity.open_count
          + case when excluded.last_opened_at > ante_core.app_daily_activity.last_opened_at + interval '30 minutes'
                 then 1 else 0 end;
end;
$$;

revoke execute on function public.record_ante_core_daily_app_activity(text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_ante_core_daily_app_activity(text, timestamptz) to service_role;

-- Marks someone active for the day WITHOUT counting an app open. Used by
-- actions that prove the app is in use on an already-warm session (logging a
-- workout, opening a screen) where no fresh launch happened. Before this,
-- someone whose session never re-bootstrapped could log a workout and not
-- appear in Total Active Users at all.
create or replace function public.mark_ante_core_daily_app_active(
  p_auth_user_id text,
  p_active_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_profile_id uuid;
  v_active_at timestamptz := coalesce(p_active_at, now());
begin
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then return; end if;

  select id into v_profile_id from ante_core.profiles
  where auth_user_id = trim(p_auth_user_id)::uuid;
  if v_profile_id is null then return; end if;

  insert into ante_core.app_daily_activity (profile_id, activity_date, first_opened_at, last_opened_at, open_count)
  values (v_profile_id, (v_active_at at time zone 'Europe/Oslo')::date, v_active_at, v_active_at, 1)
  on conflict (profile_id, activity_date) do update
    set last_opened_at = greatest(ante_core.app_daily_activity.last_opened_at, excluded.last_opened_at);
end;
$$;

revoke execute on function public.mark_ante_core_daily_app_active(text, timestamptz) from public, anon, authenticated;
grant execute on function public.mark_ante_core_daily_app_active(text, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Profile Screen: a real all-time count, and real averages
-- ---------------------------------------------------------------------------

create or replace function public.read_ante_core_founder_dashboard_block_profile_usage(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_day date := (v_now at time zone 'Europe/Oslo')::date;
  v_week_start date;
  v_month_start date;
  v_first date;
  v_events jsonb;
  v_averages jsonb;
begin
  select min((occurred_at at time zone 'Europe/Oslo')::date) into v_first
  from ante_core.app_usage_events where event_name = 'own_block_profile_opened';

  if v_first is null then
    return jsonb_build_object(
      'events', jsonb_build_object('own_block_profile_opened', jsonb_build_object(
        'daily',   jsonb_build_object('users', 0, 'total', 0),
        'weekly',  jsonb_build_object('users', 0, 'total', 0),
        'monthly', jsonb_build_object('users', 0, 'total', 0),
        'allTime', jsonb_build_object('users', 0, 'total', 0))),
      'averages', jsonb_build_object('own_block_profile_opened', jsonb_build_object(
        'daily',   jsonb_build_object('users', 0, 'uses', 0),
        'weekly',  jsonb_build_object('users', 0, 'uses', 0),
        'monthly', jsonb_build_object('users', 0, 'uses', 0))));
  end if;

  v_week_start  := date_trunc('week',  v_day::timestamp)::date;
  v_month_start := date_trunc('month', v_day::timestamp)::date;

  with scoped as (
    select profile_id, (occurred_at at time zone 'Europe/Oslo')::date as day
    from ante_core.app_usage_events
    where event_name = 'own_block_profile_opened'
  )
  select jsonb_build_object('own_block_profile_opened', jsonb_build_object(
    'daily', jsonb_build_object(
      'users', count(distinct profile_id) filter (where day = v_day),
      'total', count(*) filter (where day = v_day)),
    'weekly', jsonb_build_object(
      'users', count(distinct profile_id) filter (where day >= v_week_start),
      'total', count(*) filter (where day >= v_week_start)),
    'monthly', jsonb_build_object(
      'users', count(distinct profile_id) filter (where day >= v_month_start),
      'total', count(*) filter (where day >= v_month_start)),
    -- Was absent entirely, which the dashboard rendered as a hard zero.
    'allTime', jsonb_build_object(
      'users', count(distinct profile_id),
      'total', count(*))
  )) into v_events from scoped;

  -- Real averages over every period since tracking began, matching how every
  -- other row on the Usage tab is calculated. These were previously the
  -- current week's and month's totals wearing an "average" label.
  select jsonb_build_object('own_block_profile_opened', jsonb_build_object(
    'daily', jsonb_build_object(
      'users', coalesce((select round(avg(users), 1) from (
        select d.day, count(distinct e.profile_id) as users
        from generate_series(v_first, v_day, interval '1 day') d(day)
        left join ante_core.app_usage_events e
          on e.event_name = 'own_block_profile_opened'
         and (e.occurred_at at time zone 'Europe/Oslo')::date = d.day::date
        group by d.day) x), 0),
      'uses', coalesce((select round(avg(uses), 1) from (
        select d.day, count(e.id) as uses
        from generate_series(v_first, v_day, interval '1 day') d(day)
        left join ante_core.app_usage_events e
          on e.event_name = 'own_block_profile_opened'
         and (e.occurred_at at time zone 'Europe/Oslo')::date = d.day::date
        group by d.day) x), 0)),
    'weekly', jsonb_build_object(
      'users', coalesce((select round(avg(users), 1) from (
        select w.week_start, count(distinct e.profile_id) as users
        from generate_series(date_trunc('week', v_first::timestamp)::date, v_week_start, interval '1 week') w(week_start)
        left join ante_core.app_usage_events e
          on e.event_name = 'own_block_profile_opened'
         and date_trunc('week', e.occurred_at at time zone 'Europe/Oslo')::date = w.week_start::date
        group by w.week_start) x), 0),
      'uses', coalesce((select round(avg(uses), 1) from (
        select w.week_start, count(e.id) as uses
        from generate_series(date_trunc('week', v_first::timestamp)::date, v_week_start, interval '1 week') w(week_start)
        left join ante_core.app_usage_events e
          on e.event_name = 'own_block_profile_opened'
         and date_trunc('week', e.occurred_at at time zone 'Europe/Oslo')::date = w.week_start::date
        group by w.week_start) x), 0)),
    'monthly', jsonb_build_object(
      'users', coalesce((select round(avg(users), 1) from (
        select m.month_start, count(distinct e.profile_id) as users
        from generate_series(date_trunc('month', v_first::timestamp)::date, v_month_start, interval '1 month') m(month_start)
        left join ante_core.app_usage_events e
          on e.event_name = 'own_block_profile_opened'
         and date_trunc('month', e.occurred_at at time zone 'Europe/Oslo')::date = m.month_start::date
        group by m.month_start) x), 0),
      'uses', coalesce((select round(avg(uses), 1) from (
        select m.month_start, count(e.id) as uses
        from generate_series(date_trunc('month', v_first::timestamp)::date, v_month_start, interval '1 month') m(month_start)
        left join ante_core.app_usage_events e
          on e.event_name = 'own_block_profile_opened'
         and date_trunc('month', e.occurred_at at time zone 'Europe/Oslo')::date = m.month_start::date
        group by m.month_start) x), 0))
  )) into v_averages;

  return jsonb_build_object('events', v_events, 'averages', v_averages);
end;
$$;

revoke execute on function public.read_ante_core_founder_dashboard_block_profile_usage(timestamptz) from public, anon, authenticated;
grant execute on function public.read_ante_core_founder_dashboard_block_profile_usage(timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Per-feature averages: add the two rows that were missing from the list
-- ---------------------------------------------------------------------------
-- Month Standings Expanded and Last Month Banner are shown on the Usage tab
-- but were absent from this function's event list, so both printed 0.0 under
-- Avg Users and Avg Uses on every period. Only the list changed below.

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
    ('reaction_picker_opened'), ('bloc_stream_opened'),
    ('monthly_summary_card_clicked'), ('last_month_banner_clicked')
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

-- ---------------------------------------------------------------------------
-- App opens
-- ---------------------------------------------------------------------------
-- Deliberately its own function rather than an edit to
-- read_ante_core_founder_dashboard: that one is long, correct, and carries
-- every headline number on the Overview tab. This follows the same
-- compose-from-small-RPCs pattern the dashboard already uses.
--
-- 'countingStarted' is the first day open_count was real. Days before it hold
-- one open per active person, which is a floor, so the dashboard can say where
-- the exact figures begin instead of implying the earlier ones are precise.

create or replace function public.read_ante_core_founder_dashboard_app_opens(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_today date := (coalesce(p_now, now()) at time zone 'Europe/Oslo')::date;
  v_week_start date := v_today - (extract(isodow from v_today)::integer - 1);
  v_month_start date := date_trunc('month', v_today::timestamp)::date;
  v_counting_started constant date := date '2026-09-24';
  v_first date;
  v_result jsonb;
begin
  select min(activity_date) into v_first from ante_core.app_daily_activity;

  select jsonb_build_object(
    'today',   coalesce(sum(open_count) filter (where activity_date = v_today), 0),
    'week',    coalesce(sum(open_count) filter (where activity_date >= v_week_start), 0),
    'month',   coalesce(sum(open_count) filter (where activity_date >= v_month_start), 0),
    'allTime', coalesce(sum(open_count), 0),
    'averages', jsonb_build_object(
      'daily', case when v_first is null then 0 else coalesce(round(
        sum(open_count)::numeric / greatest(1, (v_today - v_first) + 1), 1), 0) end,
      'weekly', case when v_first is null then 0 else coalesce(round(
        sum(open_count)::numeric / greatest(1, ((v_week_start - date_trunc('week', v_first::timestamp)::date) / 7) + 1), 1), 0) end,
      'monthly', case when v_first is null then 0 else coalesce(round(
        sum(open_count)::numeric / greatest(1,
          ((date_part('year', v_today) - date_part('year', v_first)) * 12
           + date_part('month', v_today) - date_part('month', v_first) + 1)::int), 1), 0) end),
    'countingStarted', v_counting_started::text
  ) into v_result
  from ante_core.app_daily_activity;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke execute on function public.read_ante_core_founder_dashboard_app_opens(timestamptz) from public, anon, authenticated;
grant execute on function public.read_ante_core_founder_dashboard_app_opens(timestamptz) to service_role;
