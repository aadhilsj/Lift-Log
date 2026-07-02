create table if not exists lift_log_state (
  id boolean primary key default true check (id = true),
  state jsonb not null,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists lift_log_backups (
  backup_id bigint generated always as identity primary key,
  state_revision bigint not null,
  state jsonb not null,
  reason text not null,
  created_at timestamptz not null default now()
);
