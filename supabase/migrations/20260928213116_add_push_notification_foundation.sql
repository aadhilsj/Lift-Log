-- Additive, server-only push plumbing. Deliberately does NOT change RLS on
-- this or any existing table; access is denied by explicit object privileges.
begin;

create table ante_core.push_devices (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  token text not null check (token ~ '^[0-9a-f]{32,512}$' and length(token) % 2 = 0),
  environment text not null check (environment in ('production','sandbox')),
  platform text not null default 'ios' check (platform = 'ios'),
  app_version text not null default '',
  status text not null default 'active' check (status in ('active','revoked','expired','invalid')),
  registration_id uuid not null default gen_random_uuid(),
  registered_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days',
  revoked_at timestamptz,
  inactive_reason text,
  last_attempt_at timestamptz,
  last_sent_at timestamptz,
  last_apns_status integer,
  last_apns_reason text,
  created_at timestamptz not null default now(),
  primary key (auth_user_id, device_id)
);

create unique index push_devices_active_installation on ante_core.push_devices(device_id) where status='active';
create unique index push_devices_active_token on ante_core.push_devices(environment,token) where status='active';
create index push_devices_expiry on ante_core.push_devices(expires_at) where status='active';
revoke all on ante_core.push_devices from public, anon, authenticated;
grant usage on schema ante_core to service_role;
grant select, insert, update, delete on ante_core.push_devices to service_role;

-- The application server validates the bearer token with Supabase Auth and
-- supplies that authenticated ID. Clients cannot invoke these RPCs directly.
create function public.register_fero_push_device(
  p_auth_user_id uuid, p_device_id uuid, p_token text, p_environment text,
  p_app_version text default ''
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_auth_user_id is null or p_device_id is null or p_token is null
     or p_token !~ '^[0-9a-f]{32,512}$' or length(p_token)%2<>0
     or p_environment is null or p_environment not in ('production','sandbox') then
    raise exception 'Invalid device registration' using errcode='22023';
  end if;
  -- Serialise ownership transfers so two concurrent sign-ins cannot leave
  -- the same installation/token active for different accounts.
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

create function public.revoke_fero_push_device(p_auth_user_id uuid,p_device_id uuid)
returns void language sql security invoker set search_path = '' as $$
  update ante_core.push_devices set status='revoked',revoked_at=now(),inactive_reason='user_disabled_or_signed_out'
    where auth_user_id=p_auth_user_id and device_id=p_device_id and status='active';
$$;

create function public.list_fero_push_devices(p_auth_user_id uuid)
returns setof ante_core.push_devices language plpgsql security invoker set search_path = '' as $$
begin
  update ante_core.push_devices set status='expired',inactive_reason='registration_not_renewed'
    where auth_user_id=p_auth_user_id and status='active' and expires_at<=now();
  return query select * from ante_core.push_devices
    where auth_user_id=p_auth_user_id and status='active' and expires_at>now()
    order by registered_at desc;
end;
$$;

create function public.record_fero_push_result(
  p_auth_user_id uuid,p_device_id uuid,p_registration_id uuid,
  p_status integer,p_reason text,p_invalid_since timestamptz default null
) returns void language sql security invoker set search_path = '' as $$
  update ante_core.push_devices set
    last_attempt_at=now(),last_apns_status=p_status,last_apns_reason=left(p_reason,100),
    last_sent_at=case when p_status=200 then now() else last_sent_at end,
    status=case when p_status=410 and p_reason='Unregistered'
      and (p_invalid_since is null or registered_at<=p_invalid_since) then 'invalid' else status end,
    inactive_reason=case when p_status=410 and p_reason='Unregistered'
      and (p_invalid_since is null or registered_at<=p_invalid_since) then 'apns_unregistered' else inactive_reason end
    where auth_user_id=p_auth_user_id and device_id=p_device_id
      and registration_id=p_registration_id and status='active';
$$;

revoke all on function public.register_fero_push_device(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.revoke_fero_push_device(uuid,uuid) from public,anon,authenticated;
revoke all on function public.list_fero_push_devices(uuid) from public,anon,authenticated;
revoke all on function public.record_fero_push_result(uuid,uuid,uuid,integer,text,timestamptz) from public,anon,authenticated;
grant execute on function public.register_fero_push_device(uuid,uuid,text,text,text) to service_role;
grant execute on function public.revoke_fero_push_device(uuid,uuid) to service_role;
grant execute on function public.list_fero_push_devices(uuid) to service_role;
grant execute on function public.record_fero_push_result(uuid,uuid,uuid,integer,text,timestamptz) to service_role;
commit;
