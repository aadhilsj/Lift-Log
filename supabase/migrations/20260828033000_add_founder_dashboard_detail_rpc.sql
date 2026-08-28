-- Read private canonical account names and Bloc thresholds only through a
-- service-role RPC. ante_core intentionally remains absent from PostgREST's
-- exposed schema list.

create or replace function public.read_ante_core_founder_dashboard_details(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_today date := (coalesce(p_now, now()) at time zone 'Europe/Oslo')::date;
  v_thirty_day_start date;
  v_thirty_day_start_at timestamptz;
  v_active_blocs_three_plus bigint;
  v_active_blocs_five_plus bigint;
  v_new_profiles jsonb;
  v_all_profiles jsonb;
begin
  v_thirty_day_start := v_today - 29;
  v_thirty_day_start_at := v_thirty_day_start::timestamp at time zone 'Europe/Oslo';

  select coalesce(jsonb_agg(jsonb_build_object('displayName', display_name) order by created_at desc, id), '[]'::jsonb)
  into v_new_profiles
  from ante_core.profiles
  where created_at >= v_thirty_day_start_at;

  select coalesce(jsonb_agg(jsonb_build_object('displayName', display_name) order by lower(display_name), id), '[]'::jsonb)
  into v_all_profiles
  from ante_core.profiles;

  select
    count(*) filter (where recent_logs >= 3),
    count(*) filter (where recent_logs >= 5)
  into v_active_blocs_three_plus, v_active_blocs_five_plus
  from (
    select bloc_id, count(*) as recent_logs
    from ante_core.workout_logs
    where created_at >= v_thirty_day_start_at
    group by bloc_id
  ) active_blocs;

  return jsonb_build_object(
    'accounts', jsonb_build_object('newProfiles', v_new_profiles, 'allProfiles', v_all_profiles),
    'activeBlocs', jsonb_build_object('threePlus', v_active_blocs_three_plus, 'fivePlus', v_active_blocs_five_plus, 'periodDays', 30)
  );
end;
$$;

revoke execute on function public.read_ante_core_founder_dashboard_details(timestamptz) from public, anon, authenticated;
grant execute on function public.read_ante_core_founder_dashboard_details(timestamptz) to service_role;
