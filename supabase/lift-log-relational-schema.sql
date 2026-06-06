create table if not exists public.lift_log_projection_meta (
  id boolean primary key default true check (id = true),
  source_revision bigint not null default 0,
  source_updated_at timestamptz,
  default_group_id text,
  group_order text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.lift_log_projection_profiles (
  user_id text primary key,
  email text not null,
  display_name text not null,
  created_at timestamptz not null
);

create index if not exists lift_log_projection_profiles_email_idx
  on public.lift_log_projection_profiles (email);

create table if not exists public.lift_log_projection_pending_otps (
  email text primary key,
  code text not null,
  expires_at timestamptz not null,
  user_id text
);

create table if not exists public.lift_log_projection_groups (
  group_id text primary key,
  name text not null,
  admin_name text not null,
  admin_user_id text,
  invite_code text not null unique,
  created_at timestamptz not null,
  last_month_key text,
  min_target integer not null,
  fine_amount integer not null,
  fee_model text not null,
  escalation_step_amount integer,
  currency text not null,
  min_run_distance integer not null,
  distance_unit text not null,
  strava_enabled boolean not null default true,
  time_zone text not null,
  accepted_workout_types text[] not null default '{}'
);

create table if not exists public.lift_log_projection_group_memberships (
  group_id text not null references public.lift_log_projection_groups(group_id) on delete cascade,
  user_id text not null,
  display_name text not null,
  role text not null check (role in ('admin', 'member')),
  joined_at timestamptz,
  primary key (group_id, user_id)
);

create index if not exists lift_log_projection_memberships_display_name_idx
  on public.lift_log_projection_group_memberships (group_id, display_name);

create table if not exists public.lift_log_projection_group_joined_months (
  group_id text not null references public.lift_log_projection_groups(group_id) on delete cascade,
  display_name text not null,
  joined_month_key text not null,
  primary key (group_id, display_name)
);

create table if not exists public.lift_log_projection_group_logs (
  group_id text not null references public.lift_log_projection_groups(group_id) on delete cascade,
  log_id text not null,
  owner_display_name text not null,
  workout_date date not null,
  workout_type text not null,
  note text not null default '',
  photo_url text not null default '',
  created_at timestamptz not null,
  verified_via text not null,
  flag_status text,
  flag_reason text not null default '',
  flag_response text not null default '',
  flagged_by text,
  decision_by text,
  decision_at timestamptz,
  primary key (group_id, log_id)
);

create index if not exists lift_log_projection_group_logs_date_idx
  on public.lift_log_projection_group_logs (group_id, workout_date desc, created_at desc);

create table if not exists public.lift_log_projection_log_reactions (
  group_id text not null,
  log_id text not null,
  emoji text not null,
  reactor_display_name text not null,
  primary key (group_id, log_id, emoji, reactor_display_name),
  foreign key (group_id, log_id)
    references public.lift_log_projection_group_logs(group_id, log_id)
    on delete cascade
);

create table if not exists public.lift_log_projection_season_overrides (
  group_id text not null references public.lift_log_projection_groups(group_id) on delete cascade,
  month_key text not null,
  prorated boolean not null default false,
  prorated_mas integer,
  chosen_at timestamptz,
  chosen_by text,
  chosen_by_user_id text,
  primary key (group_id, month_key)
);

create table if not exists public.lift_log_projection_sit_out_requests (
  group_id text not null references public.lift_log_projection_groups(group_id) on delete cascade,
  month_key text not null,
  member_name text not null,
  status text not null,
  reason text not null default '',
  exceptional boolean not null default false,
  requested_at timestamptz,
  requested_by text not null,
  requested_by_user_id text,
  target_approver_name text,
  target_approver_user_id text,
  decided_at timestamptz,
  decided_by text,
  decided_by_user_id text,
  auto_approved boolean not null default false,
  primary key (group_id, month_key, member_name)
);

create table if not exists public.lift_log_projection_month_history (
  group_id text not null references public.lift_log_projection_groups(group_id) on delete cascade,
  month_key text not null,
  label text not null,
  year integer not null,
  month integer not null,
  min_target integer not null,
  fine_amount integer not null,
  fee_model text not null,
  escalation_step_amount integer,
  currency text not null,
  min_run_distance integer not null,
  distance_unit text not null,
  strava_enabled boolean not null default true,
  time_zone text not null,
  accepted_workout_types text[] not null default '{}',
  primary key (group_id, month_key)
);

create table if not exists public.lift_log_projection_month_counts (
  group_id text not null,
  month_key text not null,
  display_name text not null,
  workout_count integer not null default 0,
  excused boolean not null default false,
  settlement_status text,
  settlement_settled_at date,
  settlement_updated_at timestamptz,
  primary key (group_id, month_key, display_name),
  foreign key (group_id, month_key)
    references public.lift_log_projection_month_history(group_id, month_key)
    on delete cascade
);

create table if not exists public.lift_log_projection_month_logs (
  group_id text not null,
  month_key text not null,
  log_id text not null,
  owner_display_name text not null,
  workout_date date not null,
  workout_type text not null,
  note text not null default '',
  photo_url text not null default '',
  created_at timestamptz not null,
  verified_via text not null,
  flag_status text,
  flag_reason text not null default '',
  flag_response text not null default '',
  flagged_by text,
  decision_by text,
  decision_at timestamptz,
  primary key (group_id, month_key, log_id),
  foreign key (group_id, month_key)
    references public.lift_log_projection_month_history(group_id, month_key)
    on delete cascade
);

create index if not exists lift_log_projection_month_logs_date_idx
  on public.lift_log_projection_month_logs (group_id, month_key, workout_date desc, created_at desc);

create table if not exists public.lift_log_projection_month_log_reactions (
  group_id text not null,
  month_key text not null,
  log_id text not null,
  emoji text not null,
  reactor_display_name text not null,
  primary key (group_id, month_key, log_id, emoji, reactor_display_name),
  foreign key (group_id, month_key, log_id)
    references public.lift_log_projection_month_logs(group_id, month_key, log_id)
    on delete cascade
);

alter table public.lift_log_projection_meta enable row level security;
alter table public.lift_log_projection_profiles enable row level security;
alter table public.lift_log_projection_pending_otps enable row level security;
alter table public.lift_log_projection_groups enable row level security;
alter table public.lift_log_projection_group_memberships enable row level security;
alter table public.lift_log_projection_group_joined_months enable row level security;
alter table public.lift_log_projection_group_logs enable row level security;
alter table public.lift_log_projection_log_reactions enable row level security;
alter table public.lift_log_projection_season_overrides enable row level security;
alter table public.lift_log_projection_sit_out_requests enable row level security;
alter table public.lift_log_projection_month_history enable row level security;
alter table public.lift_log_projection_month_counts enable row level security;
alter table public.lift_log_projection_month_logs enable row level security;
alter table public.lift_log_projection_month_log_reactions enable row level security;
