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
as '
declare
  v_bloc_id uuid;
  v_season_id uuid;
  v_payer_profile_id uuid;
  v_receiver_profile_id uuid;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    raise exception ''legacy_group_key is required'';
  end if;
  if p_month_key is null or trim(p_month_key) = '' then
    raise exception ''month_key is required'';
  end if;
  if p_payer_auth_user_id is null or trim(p_payer_auth_user_id) = '' then
    raise exception ''payer_auth_user_id is required'';
  end if;
  if p_receiver_auth_user_id is null or trim(p_receiver_auth_user_id) = '' then
    raise exception ''receiver_auth_user_id is required'';
  end if;
  if p_payer_display_name is null or trim(p_payer_display_name) = '' then
    raise exception ''payer_display_name is required'';
  end if;
  if p_receiver_display_name is null or trim(p_receiver_display_name) = '' then
    raise exception ''receiver_display_name is required'';
  end if;
  if p_currency is null or trim(p_currency) = '' then
    raise exception ''currency is required'';
  end if;

  select id into v_bloc_id
  from ante_core.blocs
  where legacy_group_key = trim(p_legacy_group_key);

  if v_bloc_id is null then
    raise exception ''bloc not found'';
  end if;

  select id into v_season_id
  from ante_core.seasons
  where bloc_id = v_bloc_id
    and month_key = trim(p_month_key);

  if v_season_id is null then
    raise exception ''season not found'';
  end if;

  select id into v_payer_profile_id
  from ante_core.profiles
  where auth_user_id = trim(p_payer_auth_user_id)::uuid;

  if v_payer_profile_id is null then
    raise exception ''payer profile not found'';
  end if;

  select id into v_receiver_profile_id
  from ante_core.profiles
  where auth_user_id = trim(p_receiver_auth_user_id)::uuid;

  if v_receiver_profile_id is null then
    raise exception ''receiver profile not found'';
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
';

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
as '
declare
  v_bloc_id uuid;
  v_season_id uuid;
  v_payer_profile_id uuid;
  v_receiver_profile_id uuid;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    raise exception ''legacy_group_key is required'';
  end if;
  if p_month_key is null or trim(p_month_key) = '' then
    raise exception ''month_key is required'';
  end if;
  if p_payer_auth_user_id is null or trim(p_payer_auth_user_id) = '' then
    raise exception ''payer_auth_user_id is required'';
  end if;
  if p_receiver_auth_user_id is null or trim(p_receiver_auth_user_id) = '' then
    raise exception ''receiver_auth_user_id is required'';
  end if;

  select id into v_bloc_id
  from ante_core.blocs
  where legacy_group_key = trim(p_legacy_group_key);

  if v_bloc_id is null then
    raise exception ''bloc not found'';
  end if;

  select id into v_season_id
  from ante_core.seasons
  where bloc_id = v_bloc_id
    and month_key = trim(p_month_key);

  if v_season_id is null then
    raise exception ''season not found'';
  end if;

  select id into v_payer_profile_id
  from ante_core.profiles
  where auth_user_id = trim(p_payer_auth_user_id)::uuid;

  if v_payer_profile_id is null then
    raise exception ''payer profile not found'';
  end if;

  select id into v_receiver_profile_id
  from ante_core.profiles
  where auth_user_id = trim(p_receiver_auth_user_id)::uuid;

  if v_receiver_profile_id is null then
    raise exception ''receiver profile not found'';
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
';

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
as '
declare
  v_bloc_id uuid;
  v_season_id uuid;
  v_payer_profile_id uuid;
  v_receiver_profile_id uuid;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    raise exception ''legacy_group_key is required'';
  end if;
  if p_month_key is null or trim(p_month_key) = '' then
    raise exception ''month_key is required'';
  end if;
  if p_payer_auth_user_id is null or trim(p_payer_auth_user_id) = '' then
    raise exception ''payer_auth_user_id is required'';
  end if;
  if p_receiver_auth_user_id is null or trim(p_receiver_auth_user_id) = '' then
    raise exception ''receiver_auth_user_id is required'';
  end if;

  select id into v_bloc_id
  from ante_core.blocs
  where legacy_group_key = trim(p_legacy_group_key);

  if v_bloc_id is null then
    raise exception ''bloc not found'';
  end if;

  select id into v_season_id
  from ante_core.seasons
  where bloc_id = v_bloc_id
    and month_key = trim(p_month_key);

  if v_season_id is null then
    raise exception ''season not found'';
  end if;

  select id into v_payer_profile_id
  from ante_core.profiles
  where auth_user_id = trim(p_payer_auth_user_id)::uuid;

  if v_payer_profile_id is null then
    raise exception ''payer profile not found'';
  end if;

  select id into v_receiver_profile_id
  from ante_core.profiles
  where auth_user_id = trim(p_receiver_auth_user_id)::uuid;

  if v_receiver_profile_id is null then
    raise exception ''receiver profile not found'';
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
';

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
