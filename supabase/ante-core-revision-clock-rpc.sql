-- Canonical revision clock for blob-mirror retirement.
--
-- Purpose:
-- - provide a cheap canonical revision source independent of lift_log_state
-- - keep GET /api/lift-log?revision=1 numeric and monotonic for the existing
--   client poller
-- - make future blob-write skip experiments visible to polling before blob
--   persistence is disabled for any action family
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly
-- denied. The private ante_core table is not exposed directly.

create table if not exists ante_core.revision_clock (
  id boolean primary key default true,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  last_reason text,
  constraint ante_core_revision_clock_singleton check (id = true)
);

insert into ante_core.revision_clock (id, revision, updated_at, last_reason)
select
  true,
  coalesce(max(revision), 0)::bigint,
  coalesce(max(updated_at), now()),
  'seed-from-lift-log-state'
from public.lift_log_state
on conflict (id) do nothing;

create or replace function public.read_ante_core_revision()
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  result jsonb;
begin
  insert into ante_core.revision_clock (id, revision, updated_at, last_reason)
  values (true, 0, now(), 'lazy-seed')
  on conflict (id) do nothing;

  select jsonb_build_object(
    'revision',    rc.revision,
    'updated_at',  rc.updated_at,
    'last_reason', rc.last_reason
  )
  into result
  from ante_core.revision_clock rc
  where rc.id = true;

  return result;
end;
$$;

create or replace function public.bump_ante_core_revision(
  p_reason text default null,
  p_floor_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  result jsonb;
begin
  insert into ante_core.revision_clock (id, revision, updated_at, last_reason)
  values (true, coalesce(p_floor_revision, 0), now(), p_reason)
  on conflict (id) do update
    set revision = greatest(
          ante_core.revision_clock.revision + 1,
          coalesce(p_floor_revision, 0)
        ),
        updated_at = now(),
        last_reason = p_reason
  returning jsonb_build_object(
    'revision',    revision,
    'updated_at',  updated_at,
    'last_reason', last_reason
  )
  into result;

  return result;
end;
$$;

revoke execute on function public.read_ante_core_revision() from public;
revoke execute on function public.read_ante_core_revision() from anon;
revoke execute on function public.read_ante_core_revision() from authenticated;
grant  execute on function public.read_ante_core_revision() to service_role;

revoke execute on function public.bump_ante_core_revision(text, bigint) from public;
revoke execute on function public.bump_ante_core_revision(text, bigint) from anon;
revoke execute on function public.bump_ante_core_revision(text, bigint) from authenticated;
grant  execute on function public.bump_ante_core_revision(text, bigint) to service_role;
