-- Retain detailed, account-linked founder-dashboard usage events for six months.
-- This is separate from the existing 90-day daily app-activity cleanup.

create or replace function public.purge_ante_core_usage_events(
  p_retention_days integer default 180
)
returns integer
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_deleted integer := 0;
  v_retention_days integer := greatest(30, least(coalesce(p_retention_days, 180), 365));
begin
  delete from ante_core.app_usage_events
  where occurred_at < (now() - make_interval(days => v_retention_days));
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.purge_ante_core_usage_events(integer) from public, anon, authenticated;
grant execute on function public.purge_ante_core_usage_events(integer) to service_role;
