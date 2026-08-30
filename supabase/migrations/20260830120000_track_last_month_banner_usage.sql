-- Track the start-of-month "Last month results are in" banner on Today, and
-- widen the Month Summary expander to every period.
--
-- The banner is the card that points people into the Month tab in the first
-- five days of a month. It was never counted; the dashboard row named
-- "Monthly Summary Card" counts the Month Summary expander on the settlement
-- screen instead, which is a different control.
--
-- Both event names are added to the general usage reader so they report
-- daily/weekly/monthly/all-time. The dashboard decides which periods to show:
-- the expander on all four, the banner on this month and all time only.
--
-- bloc_stream_opened is added to the same reader. The server has been
-- recording it on every stream load since the event was introduced, but the
-- reader never listed it, so the dashboard row has always read zero. Adding
-- it here surfaces the history already in the table; no backfill is needed.

alter table ante_core.app_usage_events drop constraint if exists app_usage_events_event_name_check;
alter table ante_core.app_usage_events add constraint app_usage_events_event_name_check check (event_name in ('today_opened','activity_opened','month_opened','history_opened','own_profile_opened','own_block_profile_opened','other_profile_opened','mvp_card_opened','bloc_month_opened','settings_opened','comment_composer_opened','reaction_picker_opened','bloc_stream_opened','share_month_clicked','monthly_summary_card_clicked','last_month_banner_clicked'));

create or replace function public.record_ante_core_usage_event(p_auth_user_id text,p_event_name text,p_occurred_at timestamptz default now()) returns void language plpgsql security definer set search_path=ante_core,public as $$ declare v_profile_id uuid; v_event text:=trim(coalesce(p_event_name,'')); begin if v_event not in ('today_opened','activity_opened','month_opened','history_opened','own_profile_opened','own_block_profile_opened','other_profile_opened','mvp_card_opened','bloc_month_opened','settings_opened','comment_composer_opened','reaction_picker_opened','bloc_stream_opened','share_month_clicked','monthly_summary_card_clicked','last_month_banner_clicked') then return; end if; select id into v_profile_id from ante_core.profiles where auth_user_id=trim(p_auth_user_id)::uuid; if v_profile_id is null then return; end if; insert into ante_core.app_usage_events(profile_id,event_name,occurred_at) values(v_profile_id,v_event,coalesce(p_occurred_at,now())); end; $$;

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
    ('monthly_summary_card_clicked'), ('last_month_banner_clicked')
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
