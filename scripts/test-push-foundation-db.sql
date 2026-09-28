-- Rollback-only checks of the new push objects. Never sends a notification,
-- creates an auth user, or changes a pre-existing app row.
begin;
do $$
declare u1 uuid; u2 uuid;
begin
  select id into u1 from auth.users order by created_at limit 1;
  select id into u2 from auth.users where id<>u1 order by created_at limit 1;
  if u1 is null or u2 is null then raise exception 'Need two auth users for rollback-only checks'; end if;
  perform set_config('fero.qa_user_one',u1::text,true);
  perform set_config('fero.qa_user_two',u2::text,true);
end $$;
set local role service_role;
do $$
declare
  u1 uuid:=current_setting('fero.qa_user_one')::uuid;
  u2 uuid:=current_setting('fero.qa_user_two')::uuid;
  d uuid:=gen_random_uuid(); old_registration uuid; new_registration uuid; n integer; s text;
begin
  perform public.register_fero_push_device(u1,d,repeat('a',64),'production','qa');
  select count(*) into n from ante_core.push_devices where auth_user_id=u1 and device_id=d;
  if n<>1 then raise exception 'Initial registration failed'; end if;
  select registration_id into old_registration from ante_core.push_devices where auth_user_id=u1 and device_id=d;
  perform public.register_fero_push_device(u1,d,repeat('b',64),'production','qa');
  select registration_id into new_registration from ante_core.push_devices where auth_user_id=u1 and device_id=d;
  if new_registration=old_registration then raise exception 'Registration not renewed'; end if;
  select count(*) into n from ante_core.push_devices where auth_user_id=u1 and device_id=d;
  if n<>1 then raise exception 'Duplicate device row'; end if;
  perform public.record_fero_push_result(u1,d,old_registration,410,'Unregistered',now());
  select status into s from ante_core.push_devices where auth_user_id=u1 and device_id=d;
  if s<>'active' then raise exception 'Old result invalidated renewed registration'; end if;
  perform public.register_fero_push_device(u2,d,repeat('b',64),'production','qa');
  select status into s from ante_core.push_devices where auth_user_id=u1 and device_id=d;
  if s<>'revoked' then raise exception 'Old installation owner still active'; end if;
  perform public.revoke_fero_push_device(u1,d);
  select status into s from ante_core.push_devices where auth_user_id=u2 and device_id=d;
  if s<>'active' then raise exception 'Wrong owner revoked active account'; end if;
  perform public.revoke_fero_push_device(u2,d);
  select status into s from ante_core.push_devices where auth_user_id=u2 and device_id=d;
  if s<>'revoked' then raise exception 'Revocation failed'; end if;
  perform public.register_fero_push_device(u2,d,repeat('b',64),'production','qa');
  update ante_core.push_devices set expires_at=now()-interval '1 second' where auth_user_id=u2 and device_id=d;
  select count(*) into n from public.list_fero_push_devices(u2) where device_id=d;
  if n<>0 then raise exception 'Expired token returned as active'; end if;
  select status into s from ante_core.push_devices where auth_user_id=u2 and device_id=d;
  if s<>'expired' then raise exception 'Expiry not recorded'; end if;
  perform public.register_fero_push_device(u2,d,repeat('b',64),'production','qa');
  select registration_id into new_registration from ante_core.push_devices where auth_user_id=u2 and device_id=d;
  perform public.record_fero_push_result(u2,d,new_registration,410,'Unregistered',now()-interval '1 day');
  select status into s from ante_core.push_devices where auth_user_id=u2 and device_id=d;
  if s<>'active' then raise exception 'Old invalidation timestamp disabled later registration'; end if;
  perform public.record_fero_push_result(u2,d,new_registration,410,'Unregistered',now());
  select status into s from ante_core.push_devices where auth_user_id=u2 and device_id=d;
  if s<>'invalid' then raise exception 'Apple Unregistered token not disabled'; end if;
  perform public.register_fero_push_device(u2,d,repeat('c',512),'production','qa');
  select count(*) into n from public.list_fero_push_devices(u2) where device_id=d;
  if n<>1 then raise exception 'Fresh/variable-length registration did not recover invalid token'; end if;
  begin
    perform public.register_fero_push_device(u2,d,'not-a-token','production','qa');
    raise exception 'Invalid token was accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from ante_core.push_devices;
    raise exception 'Anonymous token access was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.list_fero_push_devices(current_setting('fero.qa_user_one')::uuid);
    raise exception 'Anonymous RPC execution was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role authenticated;
do $$
begin
  begin
    perform 1 from ante_core.push_devices;
    raise exception 'Authenticated direct token access was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.list_fero_push_devices(current_setting('fero.qa_user_two')::uuid);
    raise exception 'Authenticated RPC execution was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
select count(*) as persisted_push_rows_after_rollback from ante_core.push_devices;
