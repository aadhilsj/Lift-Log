-- Client sync outages: when a member's app could not reach Fero.
--
-- 5-6 November 2026. The founder's Activity Feed was slow, the "Can't reach
-- Fero" notice appeared, Retry loaded the content, and the notice still read
-- "Still can't reach Fero". The notice having no success state explains what
-- he SAW; it does not explain why the app could not reach the server, and
-- nothing in Fero recorded that it happened. There was no client-side error
-- reporting of any kind.
--
-- Deliberately not ante_core.system_events. That table is the founder
-- dashboard's health panel, and its reader takes the most recent rows with no
-- filter on event_type. Client outages are many-per-member where rollover
-- failures are a handful a month, so sharing the table would push the one
-- alarm it exists for off the bottom of the list. See
-- docs/rollover-incident-2026-09-01.md for why that panel matters.
--
-- One row per outage episode, not per failed request: the client holds the
-- episode open while it is failing and sends it once, on the other side.

create table if not exists ante_core.client_sync_events (
  id            bigint generated always as identity primary key,
  profile_id    uuid references ante_core.profiles(id) on delete set null,
  started_at    timestamptz not null,
  ended_at      timestamptz,
  duration_ms   integer,
  retries       integer     not null default 0,
  -- 'retry' when a member pressed it, 'auto' when it healed on its own,
  -- null when the app was closed before it ever came back.
  resolved_by   text,
  -- navigator.onLine when it started. false means the phone knew it was
  -- offline, which is a different problem from the server being unreachable.
  was_online    boolean,
  platform      text,
  app_version   text,
  detail        text,
  recorded_at   timestamptz not null default now()
);

create index if not exists client_sync_events_started_at_idx
  on ante_core.client_sync_events (started_at desc);

alter table ante_core.client_sync_events enable row level security;

-- Writer. Forgiving on purpose: this is diagnostics, and it must never be the
-- reason a member's request fails. It validates rather than raises, clamps
-- everything a client could get wrong, and trims its own history.
create or replace function public.record_ante_core_client_sync_event(
  p_auth_user_id uuid,
  p_started_at   timestamptz,
  p_ended_at     timestamptz default null,
  p_duration_ms  integer     default null,
  p_retries      integer     default 0,
  p_resolved_by  text        default null,
  p_was_online   boolean     default null,
  p_platform     text        default null,
  p_app_version  text        default null,
  p_detail       text        default null
)
returns void
language plpgsql
security definer
set search_path to 'ante_core', 'public'
as $function$
declare
  v_profile_id uuid;
begin
  if p_started_at is null then
    return;
  end if;

  -- A clock that is wrong, or deliberately wrong, must not put rows in the
  -- far future or the distant past where they would skew every window.
  if p_started_at > now() + interval '1 day' or p_started_at < now() - interval '30 days' then
    return;
  end if;

  if p_auth_user_id is not null then
    select p.id into v_profile_id
    from ante_core.profiles p
    where p.auth_user_id = p_auth_user_id;
  end if;

  insert into ante_core.client_sync_events (
    profile_id, started_at, ended_at, duration_ms, retries,
    resolved_by, was_online, platform, app_version, detail
  )
  values (
    v_profile_id,
    p_started_at,
    p_ended_at,
    greatest(0, least(coalesce(p_duration_ms, 0), 86400000)),
    greatest(0, least(coalesce(p_retries, 0), 1000)),
    nullif(left(trim(coalesce(p_resolved_by, '')), 16), ''),
    p_was_online,
    nullif(left(trim(coalesce(p_platform, '')), 16), ''),
    nullif(left(trim(coalesce(p_app_version, '')), 32), ''),
    nullif(left(coalesce(p_detail, ''), 1000), '')
  );

  delete from ante_core.client_sync_events where started_at < now() - interval '90 days';
end;
$function$;

-- Reader. Shaped like read_ante_core_system_events so it can sit beside it.
create or replace function public.read_ante_core_client_sync_events(p_limit integer default 20)
returns jsonb
language sql
security definer
set search_path to 'ante_core', 'public'
as $function$
  select jsonb_build_object(
    'last24h', (select count(*) from ante_core.client_sync_events where started_at >= now() - interval '24 hours'),
    'last7d',  (select count(*) from ante_core.client_sync_events where started_at >= now() - interval '7 days'),
    'total',   (select count(*) from ante_core.client_sync_events),
    'recent',  coalesce((
      select jsonb_agg(jsonb_build_object(
               'displayName', p.display_name,
               'startedAt',   e.started_at,
               'durationMs',  e.duration_ms,
               'retries',     e.retries,
               'resolvedBy',  e.resolved_by,
               'wasOnline',   e.was_online,
               'platform',    e.platform,
               'appVersion',  e.app_version,
               'detail',      e.detail
             ) order by e.started_at desc)
      from (
        select * from ante_core.client_sync_events
        order by started_at desc
        limit greatest(1, least(coalesce(p_limit, 20), 200))
      ) e
      left join ante_core.profiles p on p.id = e.profile_id
    ), '[]'::jsonb)
  );
$function$;

-- Same lockdown every other ante_core RPC has. Postgres defaults new functions
-- to PUBLIC EXECUTE, which would leave both callable with the public anon key.
revoke all on function public.record_ante_core_client_sync_event(uuid, timestamptz, timestamptz, integer, integer, text, boolean, text, text, text) from public;
revoke all on function public.record_ante_core_client_sync_event(uuid, timestamptz, timestamptz, integer, integer, text, boolean, text, text, text) from anon;
revoke all on function public.record_ante_core_client_sync_event(uuid, timestamptz, timestamptz, integer, integer, text, boolean, text, text, text) from authenticated;
grant execute on function public.record_ante_core_client_sync_event(uuid, timestamptz, timestamptz, integer, integer, text, boolean, text, text, text) to service_role;

revoke all on function public.read_ante_core_client_sync_events(integer) from public;
revoke all on function public.read_ante_core_client_sync_events(integer) from anon;
revoke all on function public.read_ante_core_client_sync_events(integer) from authenticated;
grant execute on function public.read_ante_core_client_sync_events(integer) to service_role;
