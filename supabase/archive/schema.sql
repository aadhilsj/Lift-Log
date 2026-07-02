create extension if not exists pgcrypto;

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  joined_month_key text,
  created_at timestamptz not null default now()
);

create table if not exists workout_logs (
  id text primary key,
  player_id uuid not null references players(id) on delete cascade,
  workout_date date not null,
  workout_type text not null,
  month_key text not null,
  source text not null default 'migration',
  created_at timestamptz not null default now(),
  unique (player_id, workout_date, id)
);

create index if not exists workout_logs_player_month_idx
  on workout_logs (player_id, month_key, workout_date desc);

create table if not exists month_excusals (
  player_id uuid not null references players(id) on delete cascade,
  month_key text not null,
  excused boolean not null default false,
  source text not null default 'migration',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (player_id, month_key)
);

create table if not exists monthly_snapshots (
  month_key text primary key,
  label text not null,
  year integer not null,
  month integer not null,
  migrated_from_last_month boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists monthly_snapshot_counts (
  month_key text not null references monthly_snapshots(month_key) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  workout_count integer not null default 0,
  excused boolean not null default false,
  primary key (month_key, player_id)
);

create table if not exists settlement_status (
  month_key text not null references monthly_snapshots(month_key) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  status text not null check (status in ('outstanding', 'settled')),
  settled_at date,
  updated_at timestamptz,
  primary key (month_key, player_id)
);

create table if not exists app_state (
  id boolean primary key default true check (id = true),
  current_month_key text not null,
  revision bigint not null default 0,
  updated_at timestamptz,
  imported_at timestamptz not null default now()
);

create or replace view leaderboard_current_month as
select
  p.name,
  a.current_month_key as month_key,
  coalesce(count(w.id), 0) as workout_count,
  coalesce(me.excused, false) as excused
from app_state a
cross join players p
left join workout_logs w
  on w.player_id = p.id
 and w.month_key = a.current_month_key
left join month_excusals me
  on me.player_id = p.id
 and me.month_key = a.current_month_key
group by p.name, a.current_month_key, me.excused;
