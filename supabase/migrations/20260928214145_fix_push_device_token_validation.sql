-- PostgreSQL limits bounded regex repetitions to 255. Validate token length
-- separately so Apple's variable-length hexadecimal tokens can be accepted.
-- The new table is empty; no existing data is changed by this correction.
begin;
alter table ante_core.push_devices drop constraint push_devices_token_check;
alter table ante_core.push_devices add constraint push_devices_token_check
  check (token ~ '^[0-9a-f]+$' and length(token) between 32 and 512 and length(token)%2=0);

create or replace function public.register_fero_push_device(
  p_auth_user_id uuid, p_device_id uuid, p_token text, p_environment text,
  p_app_version text default ''
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_auth_user_id is null or p_device_id is null or p_token is null
     or p_token !~ '^[0-9a-f]+$' or length(p_token) not between 32 and 512 or length(p_token)%2<>0
     or p_environment is null or p_environment not in ('production','sandbox') then
    raise exception 'Invalid device registration' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(742608291);
  update ante_core.push_devices set status='revoked', revoked_at=now(), inactive_reason='account_or_installation_changed'
    where status='active'
      and (device_id=p_device_id or (environment=p_environment and token=p_token))
      and (auth_user_id<>p_auth_user_id or device_id<>p_device_id);
  insert into ante_core.push_devices(auth_user_id,device_id,token,environment,app_version)
    values(p_auth_user_id,p_device_id,p_token,p_environment,left(coalesce(p_app_version,''),40))
    on conflict(auth_user_id,device_id) do update set
      token=excluded.token, environment=excluded.environment, app_version=excluded.app_version,
      status='active', registration_id=gen_random_uuid(), registered_at=now(),
      expires_at=now()+interval '90 days', revoked_at=null, inactive_reason=null,
      last_apns_status=null, last_apns_reason=null;
end;
$$;
revoke all on function public.register_fero_push_device(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.register_fero_push_device(uuid,uuid,text,text,text) to service_role;
commit;
