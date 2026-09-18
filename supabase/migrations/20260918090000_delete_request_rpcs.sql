-- Cancelling a pending sit-out or Solo request removes it outright: the member
-- simply never asked. Nothing reads withdrawn requests, so no status is added
-- to sit_out_request_status. Both functions are no-ops when the row is gone.

create or replace function public.delete_ante_core_sit_out_request(
  p_legacy_group_key text,
  p_month_key        text,
  p_display_name     text
) returns void
language plpgsql
security definer
set search_path to 'ante_core', 'public'
as $$
begin
  delete from ante_core.sit_out_requests r
  using ante_core.seasons s, ante_core.blocs b
  where r.season_id = s.id
    and s.bloc_id = b.id
    and b.legacy_group_key = p_legacy_group_key
    and s.month_key = p_month_key
    and r.display_name_snapshot = p_display_name
    and r.status = 'pending';
end;
$$;

create or replace function public.delete_ante_core_solo_request(
  p_legacy_group_key text,
  p_month_key        text,
  p_display_name     text
) returns void
language plpgsql
security definer
set search_path to 'ante_core', 'public'
as $$
begin
  delete from ante_core.solo_requests r
  using ante_core.seasons s, ante_core.blocs b
  where r.season_id = s.id
    and s.bloc_id = b.id
    and b.legacy_group_key = p_legacy_group_key
    and s.month_key = p_month_key
    and r.display_name_snapshot = p_display_name
    and r.status = 'pending';
end;
$$;

revoke all on function public.delete_ante_core_sit_out_request(text, text, text) from public, anon, authenticated;
revoke all on function public.delete_ante_core_solo_request(text, text, text)    from public, anon, authenticated;
grant execute on function public.delete_ante_core_sit_out_request(text, text, text) to postgres, service_role;
grant execute on function public.delete_ante_core_solo_request(text, text, text)    to postgres, service_role;
