-- System events: a place for failures that belong to no user.
--
-- On 2026-09-01 the rollover failed 50 times and the only trace was a 400 in the
-- edge logs. The founder found out by looking at his own phone at 4:50am.
--
-- The rollover fix makes this more pressing, not less: a Bloc that cannot roll
-- over is now skipped so the others can proceed, which is correct but silent.
-- Silence no longer means nothing is wrong.
--
-- ante_core.app_usage_events cannot be reused: its profile_id is NOT NULL and a
-- rollover failure has no user attached.
--
-- See docs/rollover-incident-2026-09-01.md (I4).

create table if not exists ante_core.system_events (
  id           bigint generated always as identity primary key,
  event_type   text        not null,
  bloc_key     text,
  detail       text,
  occurred_at  timestamptz not null default now()
);

create index if not exists system_events_occurred_at_idx
  on ante_core.system_events (occurred_at desc);

create index if not exists system_events_type_occurred_at_idx
  on ante_core.system_events (event_type, occurred_at desc);

alter table ante_core.system_events enable row level security;

-- Writer. Called from persistState when a Bloc is skipped. Deliberately
-- forgiving: this must never be the reason a rollover fails, so it validates
-- rather than raises, and trims its own history instead of needing a cron.
create or replace function public.record_ante_core_system_event(
  p_event_type text,
  p_bloc_key   text default null,
  p_detail     text default null
)
returns void
language plpgsql
security definer
set search_path to 'ante_core', 'public'
as $function$
begin
  if p_event_type is null or trim(p_event_type) = '' then
    return;
  end if;

  insert into ante_core.system_events (event_type, bloc_key, detail)
  values (trim(p_event_type), nullif(trim(coalesce(p_bloc_key,'')),''), left(coalesce(p_detail,''), 1000));

  -- Self-trimming: volume is a handful of rows a month, so a scheduled purge
  -- would be more moving parts than the problem deserves.
  delete from ante_core.system_events where occurred_at < now() - interval '90 days';
end;
$function$;

-- Reader for the founder dashboard.
create or replace function public.read_ante_core_system_events(p_limit integer default 20)
returns jsonb
language sql
security definer
set search_path to 'ante_core', 'public'
as $function$
  select jsonb_build_object(
    'last24h', (select count(*) from ante_core.system_events where occurred_at >= now() - interval '24 hours'),
    'last7d',  (select count(*) from ante_core.system_events where occurred_at >= now() - interval '7 days'),
    'total',   (select count(*) from ante_core.system_events),
    'recent',  coalesce((
      select jsonb_agg(jsonb_build_object(
               'eventType',  e.event_type,
               'blocKey',    e.bloc_key,
               'detail',     e.detail,
               'occurredAt', e.occurred_at
             ) order by e.occurred_at desc)
      from (
        select * from ante_core.system_events
        order by occurred_at desc
        limit greatest(1, least(coalesce(p_limit, 20), 100))
      ) e
    ), '[]'::jsonb)
  );
$function$;

-- Match the lockdown every other ante_core RPC has. Postgres defaults new
-- functions to PUBLIC EXECUTE, which left both of these callable with the
-- public anon key: anyone could have written rows into the founder's health
-- panel, and each write also trims the table. Caught by the Supabase security
-- advisor, which flags these two and no existing RPC.
revoke all on function public.record_ante_core_system_event(text, text, text) from public;
revoke all on function public.record_ante_core_system_event(text, text, text) from anon;
revoke all on function public.record_ante_core_system_event(text, text, text) from authenticated;
grant execute on function public.record_ante_core_system_event(text, text, text) to service_role;

revoke all on function public.read_ante_core_system_events(integer) from public;
revoke all on function public.read_ante_core_system_events(integer) from anon;
revoke all on function public.read_ante_core_system_events(integer) from authenticated;
grant execute on function public.read_ante_core_system_events(integer) to service_role;
