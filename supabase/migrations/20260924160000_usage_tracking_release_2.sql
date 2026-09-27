-- Usage tracking, release 2 (2026-09-24).
--
-- Adds fourteen event names to the allowlist and surfaces them on the Usage
-- tab. Two of them -- bloc_loop_opened and settlement_reminders_opened -- have
-- been fired by the app for some time already (src/pages/TodayPage.jsx) but
-- were never allowlisted, so every one of those taps has been silently
-- discarded. They start counting the moment this runs.
--
-- The allowlist lives in TWO places and both must agree, or inserts fail: the
-- check constraint on ante_core.app_usage_events and the guard inside
-- record_ante_core_usage_event. Schema goes before the code that sends the
-- new names.
--
-- Nothing is removed and no existing row is touched, so this only widens what
-- the table will accept.

alter table ante_core.app_usage_events
  drop constraint if exists app_usage_events_event_name_check;

alter table ante_core.app_usage_events
  add constraint app_usage_events_event_name_check check (event_name in (
    'today_opened', 'activity_opened', 'month_opened', 'history_opened',
    'own_profile_opened', 'own_block_profile_opened', 'other_profile_opened',
    'mvp_card_opened', 'bloc_month_opened', 'settings_opened',
    'comment_composer_opened', 'reaction_picker_opened', 'bloc_stream_opened',
    'share_month_clicked', 'monthly_summary_card_clicked', 'last_month_banner_clicked',
    -- release 2
    'bloc_loop_opened', 'settlement_reminders_opened',
    'month_own_slice_opened', 'month_other_slice_opened',
    'own_profile_all_blocs_opened', 'other_profile_all_blocs_opened',
    'bloc_switcher_opened',
    'settings_invite_opened', 'settings_status_opened',
    'settings_members_opened', 'settings_rules_opened',
    'workout_type_more_opened',
    'activity_photo_opened', 'activity_photo_browsed'
  ));

create or replace function public.record_ante_core_usage_event(
  p_auth_user_id text,
  p_event_name text,
  p_occurred_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_profile_id uuid;
  v_event_name text := trim(coalesce(p_event_name, ''));
begin
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then return; end if;
  if v_event_name not in (
    'today_opened', 'activity_opened', 'month_opened', 'history_opened',
    'own_profile_opened', 'own_block_profile_opened', 'other_profile_opened',
    'mvp_card_opened', 'bloc_month_opened', 'settings_opened',
    'comment_composer_opened', 'reaction_picker_opened', 'bloc_stream_opened',
    'share_month_clicked', 'monthly_summary_card_clicked', 'last_month_banner_clicked',
    'bloc_loop_opened', 'settlement_reminders_opened',
    'month_own_slice_opened', 'month_other_slice_opened',
    'own_profile_all_blocs_opened', 'other_profile_all_blocs_opened',
    'bloc_switcher_opened',
    'settings_invite_opened', 'settings_status_opened',
    'settings_members_opened', 'settings_rules_opened',
    'workout_type_more_opened',
    'activity_photo_opened', 'activity_photo_browsed'
  ) then return; end if;

  select id into v_profile_id from ante_core.profiles
  where auth_user_id = trim(p_auth_user_id)::uuid;
  if v_profile_id is null then return; end if;

  insert into ante_core.app_usage_events (profile_id, event_name, occurred_at)
  values (v_profile_id, v_event_name, coalesce(p_occurred_at, now()));
end;
$$;

revoke execute on function public.record_ante_core_usage_event(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_ante_core_usage_event(text, text, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Report the new events on the Usage tab
-- ---------------------------------------------------------------------------
-- Only the event_names list changes in both functions below; the maths is
-- untouched. own_block_profile_opened and share_month_clicked stay out of
-- these lists on purpose -- each is served by its own RPC and composed in by
-- api/lift-log.js.

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
    ('bloc_month_opened'), ('settings_opened'), ('comment_composer_opened'),
    ('reaction_picker_opened'), ('bloc_stream_opened'),
    ('monthly_summary_card_clicked'), ('last_month_banner_clicked'),
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
    ('monthly_summary_card_clicked'), ('last_month_banner_clicked'),
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
