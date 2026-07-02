-- Local apply bundle for settlement confirmations.
-- Paste this whole file into the local Supabase Studio SQL Editor and run once.

create table if not exists ante_core.settlement_confirmations (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references ante_core.seasons(id) on delete cascade,
  bloc_id uuid not null references ante_core.blocs(id) on delete cascade,
  payer_profile_id uuid not null references ante_core.profiles(id) on delete cascade,
  receiver_profile_id uuid not null references ante_core.profiles(id) on delete cascade,
  payer_display_name_snapshot text not null,
  receiver_display_name_snapshot text not null,
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null,
  payer_claimed_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, payer_profile_id, receiver_profile_id),
  check (payer_profile_id <> receiver_profile_id)
);

create index if not exists ante_core_settlement_confirmations_bloc_id_confirmed_idx
  on ante_core.settlement_confirmations (bloc_id, confirmed_at, created_at desc);

create index if not exists ante_core_settlement_confirmations_season_id_idx
  on ante_core.settlement_confirmations (season_id);

create index if not exists ante_core_settlement_confirmations_payer_idx
  on ante_core.settlement_confirmations (payer_profile_id, confirmed_at);

create index if not exists ante_core_settlement_confirmations_receiver_idx
  on ante_core.settlement_confirmations (receiver_profile_id, confirmed_at);

alter table ante_core.settlement_confirmations replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table ante_core.settlement_confirmations;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end;
$$;

create or replace function public.read_ante_core_settlement_confirmations()
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sc.id,
        'legacy_group_key', b.legacy_group_key,
        'bloc_id', sc.bloc_id,
        'season_id', sc.season_id,
        'month_key', s.month_key,
        'month_label', s.label,
        'payer_auth_user_id', case
          when payer.auth_user_id is null then null
          else payer.auth_user_id::text
        end,
        'receiver_auth_user_id', case
          when receiver.auth_user_id is null then null
          else receiver.auth_user_id::text
        end,
        'payer_display_name', sc.payer_display_name_snapshot,
        'receiver_display_name', sc.receiver_display_name_snapshot,
        'amount', sc.amount,
        'currency', sc.currency,
        'payer_claimed_at', case
          when sc.payer_claimed_at is null then null
          else to_char(sc.payer_claimed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        end,
        'confirmed_at', case
          when sc.confirmed_at is null then null
          else to_char(sc.confirmed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        end,
        'created_at', to_char(sc.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'updated_at', to_char(sc.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
      order by s.month_key desc, sc.created_at asc
    ),
    '[]'::jsonb
  )
  into result
  from ante_core.settlement_confirmations sc
  join ante_core.seasons s
    on s.id = sc.season_id
  join ante_core.blocs b
    on b.id = sc.bloc_id
  join ante_core.profiles payer
    on payer.id = sc.payer_profile_id
  join ante_core.profiles receiver
    on receiver.id = sc.receiver_profile_id
  where b.legacy_group_key is not null;

  return result;
end;
$$;

revoke execute on function public.read_ante_core_settlement_confirmations() from public;
revoke execute on function public.read_ante_core_settlement_confirmations() from anon;
revoke execute on function public.read_ante_core_settlement_confirmations() from authenticated;
grant execute on function public.read_ante_core_settlement_confirmations() to service_role;

create or replace function public.claim_ante_core_settlement_confirmation(
  p_legacy_group_key         text,
  p_month_key                text,
  p_payer_auth_user_id       text,
  p_payer_display_name       text,
  p_receiver_auth_user_id    text,
  p_receiver_display_name    text,
  p_amount                   numeric,
  p_currency                 text
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_season_id uuid;
  v_payer_profile_id uuid;
  v_receiver_profile_id uuid;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    raise exception 'legacy_group_key is required';
  end if;
  if p_month_key is null or trim(p_month_key) = '' then
    raise exception 'month_key is required';
  end if;
  if p_payer_auth_user_id is null or trim(p_payer_auth_user_id) = '' then
    raise exception 'payer_auth_user_id is required';
  end if;
  if p_receiver_auth_user_id is null or trim(p_receiver_auth_user_id) = '' then
    raise exception 'receiver_auth_user_id is required';
  end if;
  if p_payer_display_name is null or trim(p_payer_display_name) = '' then
    raise exception 'payer_display_name is required';
  end if;
  if p_receiver_display_name is null or trim(p_receiver_display_name) = '' then
    raise exception 'receiver_display_name is required';
  end if;
  if p_currency is null or trim(p_currency) = '' then
    raise exception 'currency is required';
  end if;

  select id into v_bloc_id
  from ante_core.blocs
  where legacy_group_key = trim(p_legacy_group_key);

  if v_bloc_id is null then
    raise exception 'bloc not found';
  end if;

  select id into v_season_id
  from ante_core.seasons
  where bloc_id = v_bloc_id
    and month_key = trim(p_month_key);

  if v_season_id is null then
    raise exception 'season not found';
  end if;

  select id into v_payer_profile_id
  from ante_core.profiles
  where auth_user_id = trim(p_payer_auth_user_id)::uuid;

  if v_payer_profile_id is null then
    raise exception 'payer profile not found';
  end if;

  select id into v_receiver_profile_id
  from ante_core.profiles
  where auth_user_id = trim(p_receiver_auth_user_id)::uuid;

  if v_receiver_profile_id is null then
    raise exception 'receiver profile not found';
  end if;

  insert into ante_core.settlement_confirmations (
    season_id,
    bloc_id,
    payer_profile_id,
    receiver_profile_id,
    payer_display_name_snapshot,
    receiver_display_name_snapshot,
    amount,
    currency,
    payer_claimed_at,
    created_at,
    updated_at
  )
  values (
    v_season_id,
    v_bloc_id,
    v_payer_profile_id,
    v_receiver_profile_id,
    trim(p_payer_display_name),
    trim(p_receiver_display_name),
    coalesce(p_amount, 0),
    trim(p_currency),
    now(),
    now(),
    now()
  )
  on conflict (season_id, payer_profile_id, receiver_profile_id) do update
    set
      payer_display_name_snapshot = excluded.payer_display_name_snapshot,
      receiver_display_name_snapshot = excluded.receiver_display_name_snapshot,
      amount = excluded.amount,
      currency = excluded.currency,
      payer_claimed_at = now(),
      updated_at = now();
end;
$$;

create or replace function public.confirm_ante_core_settlement_confirmation(
  p_legacy_group_key         text,
  p_month_key                text,
  p_payer_auth_user_id       text,
  p_receiver_auth_user_id    text
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_season_id uuid;
  v_payer_profile_id uuid;
  v_receiver_profile_id uuid;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    raise exception 'legacy_group_key is required';
  end if;
  if p_month_key is null or trim(p_month_key) = '' then
    raise exception 'month_key is required';
  end if;
  if p_payer_auth_user_id is null or trim(p_payer_auth_user_id) = '' then
    raise exception 'payer_auth_user_id is required';
  end if;
  if p_receiver_auth_user_id is null or trim(p_receiver_auth_user_id) = '' then
    raise exception 'receiver_auth_user_id is required';
  end if;

  select id into v_bloc_id
  from ante_core.blocs
  where legacy_group_key = trim(p_legacy_group_key);

  if v_bloc_id is null then
    raise exception 'bloc not found';
  end if;

  select id into v_season_id
  from ante_core.seasons
  where bloc_id = v_bloc_id
    and month_key = trim(p_month_key);

  if v_season_id is null then
    raise exception 'season not found';
  end if;

  select id into v_payer_profile_id
  from ante_core.profiles
  where auth_user_id = trim(p_payer_auth_user_id)::uuid;

  if v_payer_profile_id is null then
    raise exception 'payer profile not found';
  end if;

  select id into v_receiver_profile_id
  from ante_core.profiles
  where auth_user_id = trim(p_receiver_auth_user_id)::uuid;

  if v_receiver_profile_id is null then
    raise exception 'receiver profile not found';
  end if;

  update ante_core.settlement_confirmations
  set
    confirmed_at = now(),
    updated_at = now()
  where season_id = v_season_id
    and payer_profile_id = v_payer_profile_id
    and receiver_profile_id = v_receiver_profile_id
    and payer_claimed_at is not null
    and confirmed_at is null;
end;
$$;

create or replace function public.dispute_ante_core_settlement_confirmation(
  p_legacy_group_key         text,
  p_month_key                text,
  p_payer_auth_user_id       text,
  p_receiver_auth_user_id    text
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_season_id uuid;
  v_payer_profile_id uuid;
  v_receiver_profile_id uuid;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    raise exception 'legacy_group_key is required';
  end if;
  if p_month_key is null or trim(p_month_key) = '' then
    raise exception 'month_key is required';
  end if;
  if p_payer_auth_user_id is null or trim(p_payer_auth_user_id) = '' then
    raise exception 'payer_auth_user_id is required';
  end if;
  if p_receiver_auth_user_id is null or trim(p_receiver_auth_user_id) = '' then
    raise exception 'receiver_auth_user_id is required';
  end if;

  select id into v_bloc_id
  from ante_core.blocs
  where legacy_group_key = trim(p_legacy_group_key);

  if v_bloc_id is null then
    raise exception 'bloc not found';
  end if;

  select id into v_season_id
  from ante_core.seasons
  where bloc_id = v_bloc_id
    and month_key = trim(p_month_key);

  if v_season_id is null then
    raise exception 'season not found';
  end if;

  select id into v_payer_profile_id
  from ante_core.profiles
  where auth_user_id = trim(p_payer_auth_user_id)::uuid;

  if v_payer_profile_id is null then
    raise exception 'payer profile not found';
  end if;

  select id into v_receiver_profile_id
  from ante_core.profiles
  where auth_user_id = trim(p_receiver_auth_user_id)::uuid;

  if v_receiver_profile_id is null then
    raise exception 'receiver profile not found';
  end if;

  update ante_core.settlement_confirmations
  set
    payer_claimed_at = null,
    confirmed_at = null,
    updated_at = now()
  where season_id = v_season_id
    and payer_profile_id = v_payer_profile_id
    and receiver_profile_id = v_receiver_profile_id
    and payer_claimed_at is not null
    and confirmed_at is null;
end;
$$;

revoke execute on function public.claim_ante_core_settlement_confirmation(text, text, text, text, text, text, numeric, text) from public;
revoke execute on function public.claim_ante_core_settlement_confirmation(text, text, text, text, text, text, numeric, text) from anon;
revoke execute on function public.claim_ante_core_settlement_confirmation(text, text, text, text, text, text, numeric, text) from authenticated;
grant execute on function public.claim_ante_core_settlement_confirmation(text, text, text, text, text, text, numeric, text) to service_role;

revoke execute on function public.confirm_ante_core_settlement_confirmation(text, text, text, text) from public;
revoke execute on function public.confirm_ante_core_settlement_confirmation(text, text, text, text) from anon;
revoke execute on function public.confirm_ante_core_settlement_confirmation(text, text, text, text) from authenticated;
grant execute on function public.confirm_ante_core_settlement_confirmation(text, text, text, text) to service_role;

revoke execute on function public.dispute_ante_core_settlement_confirmation(text, text, text, text) from public;
revoke execute on function public.dispute_ante_core_settlement_confirmation(text, text, text, text) from anon;
revoke execute on function public.dispute_ante_core_settlement_confirmation(text, text, text, text) from authenticated;
grant execute on function public.dispute_ante_core_settlement_confirmation(text, text, text, text) to service_role;

grant usage on schema ante_core to authenticated;
grant select, update on ante_core.settlement_confirmations to authenticated;

alter table ante_core.settlement_confirmations enable row level security;

drop policy if exists "settlement confirmations readable by active bloc members" on ante_core.settlement_confirmations;
create policy "settlement confirmations readable by active bloc members"
on ante_core.settlement_confirmations
for select
to authenticated
using (
  exists (
    select 1
    from ante_core.bloc_members bm
    join ante_core.profiles p
      on p.id = bm.profile_id
    where bm.bloc_id = settlement_confirmations.bloc_id
      and bm.left_at is null
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "payers can claim settlement confirmations" on ante_core.settlement_confirmations;
create policy "payers can claim settlement confirmations"
on ante_core.settlement_confirmations
for update
to authenticated
using (
  exists (
    select 1
    from ante_core.profiles p
    where p.id = settlement_confirmations.payer_profile_id
      and p.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from ante_core.profiles p
    where p.id = settlement_confirmations.payer_profile_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "receivers can confirm settlement confirmations" on ante_core.settlement_confirmations;
create policy "receivers can confirm settlement confirmations"
on ante_core.settlement_confirmations
for update
to authenticated
using (
  exists (
    select 1
    from ante_core.profiles p
    where p.id = settlement_confirmations.receiver_profile_id
      and p.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from ante_core.profiles p
    where p.id = settlement_confirmations.receiver_profile_id
      and p.auth_user_id = auth.uid()
  )
);
