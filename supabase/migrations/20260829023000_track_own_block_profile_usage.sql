alter table ante_core.app_usage_events drop constraint if exists app_usage_events_event_name_check;
alter table ante_core.app_usage_events add constraint app_usage_events_event_name_check check (event_name in (
  'today_opened','activity_opened','month_opened','history_opened','own_profile_opened','own_block_profile_opened','other_profile_opened','mvp_card_opened','bloc_month_opened','settings_opened','comment_composer_opened','reaction_picker_opened','bloc_stream_opened'
));

create or replace function public.record_ante_core_usage_event(p_auth_user_id text, p_event_name text, p_occurred_at timestamptz default now()) returns void language plpgsql security definer set search_path=ante_core,public as $$
declare v_profile_id uuid; v_event text:=trim(coalesce(p_event_name,''));
begin
  if v_event not in ('today_opened','activity_opened','month_opened','history_opened','own_profile_opened','own_block_profile_opened','other_profile_opened','mvp_card_opened','bloc_month_opened','settings_opened','comment_composer_opened','reaction_picker_opened','bloc_stream_opened') then return; end if;
  select id into v_profile_id from ante_core.profiles where auth_user_id=trim(p_auth_user_id)::uuid;
  if v_profile_id is null then return; end if;
  insert into ante_core.app_usage_events(profile_id,event_name,occurred_at) values(v_profile_id,v_event,coalesce(p_occurred_at,now()));
end; $$;

create or replace function public.read_ante_core_founder_dashboard_block_profile_usage(p_now timestamptz default now()) returns jsonb language plpgsql security definer set search_path=ante_core,public as $$
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
end; $$;
revoke execute on function public.record_ante_core_usage_event(text,text,timestamptz) from public,anon,authenticated;
revoke execute on function public.read_ante_core_founder_dashboard_block_profile_usage(timestamptz) from public,anon,authenticated;
grant execute on function public.record_ante_core_usage_event(text,text,timestamptz) to service_role;
grant execute on function public.read_ante_core_founder_dashboard_block_profile_usage(timestamptz) to service_role;
