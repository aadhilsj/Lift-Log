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
