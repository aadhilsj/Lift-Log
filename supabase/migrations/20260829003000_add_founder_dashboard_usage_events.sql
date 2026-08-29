-- Private, low-cardinality product usage events for the founder dashboard.
-- Event names are a reviewed allowlist; no content or route parameters are stored.

create table if not exists ante_core.app_usage_events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references ante_core.profiles(id) on delete cascade,
  event_name text not null check (event_name in (
    'today_opened', 'activity_opened', 'month_opened', 'history_opened',
    'own_profile_opened', 'other_profile_opened', 'mvp_card_opened',
    'bloc_month_opened', 'settings_opened', 'comment_composer_opened',
    'reaction_picker_opened'
  )),
  occurred_at timestamptz not null default now()
);

create index if not exists ante_core_app_usage_events_event_time_idx
  on ante_core.app_usage_events (event_name, occurred_at desc, profile_id);

alter table ante_core.app_usage_events enable row level security;
revoke all on table ante_core.app_usage_events from public, anon, authenticated;

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
    'own_profile_opened', 'other_profile_opened', 'mvp_card_opened',
    'bloc_month_opened', 'settings_opened', 'comment_composer_opened',
    'reaction_picker_opened'
  ) then return; end if;

  select id into v_profile_id from ante_core.profiles
  where auth_user_id = trim(p_auth_user_id)::uuid;
  if v_profile_id is null then return; end if;

  insert into ante_core.app_usage_events (profile_id, event_name, occurred_at)
  values (v_profile_id, v_event_name, coalesce(p_occurred_at, now()));
end;
$$;

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
    ('reaction_picker_opened')
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

revoke execute on function public.record_ante_core_usage_event(text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.read_ante_core_founder_dashboard_usage(timestamptz) from public, anon, authenticated;
grant execute on function public.record_ante_core_usage_event(text, text, timestamptz) to service_role;
grant execute on function public.read_ante_core_founder_dashboard_usage(timestamptz) to service_role;
