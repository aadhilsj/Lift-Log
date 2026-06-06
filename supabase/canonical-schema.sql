-- Antè canonical relational schema draft
--
-- Purpose:
-- - define the long-term canonical backend Antè should move to
-- - stay additive beside the current blob + projection system
-- - avoid changing current production behavior until importer/read/write
--   cutover work is ready
--
-- This file is intentionally separate from:
-- - supabase/state-schema.sql                 (current blob storage)
-- - supabase/lift-log-relational-schema.sql  (current projection mirror)

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Shared enums
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'bloc_member_role') then
    create type public.bloc_member_role as enum ('admin', 'member');
  end if;
  if not exists (select 1 from pg_type where typname = 'season_status') then
    create type public.season_status as enum ('open', 'closed', 'settled');
  end if;
  if not exists (select 1 from pg_type where typname = 'settlement_run_status') then
    create type public.settlement_run_status as enum ('pending', 'complete', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'settlement_outcome') then
    create type public.settlement_outcome as enum ('winner', 'loser', 'neutral');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_job_status') then
    create type public.notification_job_status as enum ('pending', 'sent', 'failed', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_channel') then
    create type public.notification_channel as enum ('email', 'push');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_method_type') then
    create type public.payment_method_type as enum ('revolut', 'wise', 'paypal', 'bank', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'sit_out_request_status') then
    create type public.sit_out_request_status as enum ('pending', 'approved', 'denied');
  end if;
  if not exists (select 1 from pg_type where typname = 'fee_model_type') then
    create type public.fee_model_type as enum ('flat', 'escalating');
  end if;
end$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Profiles and auth-adjacent data
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  legacy_user_key text unique,
  email text not null unique,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_auth_user_id_idx
  on public.profiles (auth_user_id);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  method_type public.payment_method_type not null,
  label text not null,
  details text not null,
  custom_label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_methods_profile_id_idx
  on public.payment_methods (profile_id);

create table if not exists public.auth_otps (
  email text primary key,
  code text not null,
  expires_at timestamptz not null,
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists auth_otps_expires_at_idx
  on public.auth_otps (expires_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- Bloc membership and settings
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.blocs (
  id uuid primary key default gen_random_uuid(),
  legacy_group_key text unique,
  name text not null,
  admin_profile_id uuid references public.profiles(id) on delete set null,
  invite_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  time_zone text not null default 'Europe/Oslo',
  currency text not null default 'NOK',
  min_target integer not null default 12,
  fine_amount integer not null default 20,
  fee_model public.fee_model_type not null default 'escalating',
  escalation_step_amount integer,
  min_run_distance integer not null default 3,
  distance_unit text not null default 'km',
  strava_enabled boolean not null default true,
  accepted_workout_types text[] not null default '{}',
  sort_order integer
);

create table if not exists public.bloc_members (
  id uuid primary key default gen_random_uuid(),
  bloc_id uuid not null references public.blocs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  display_name_snapshot text not null,
  role public.bloc_member_role not null default 'member',
  joined_at timestamptz,
  joined_month_key text,
  left_at timestamptz,
  sort_order integer,
  created_at timestamptz not null default now(),
  unique (bloc_id, profile_id)
);

create index if not exists bloc_members_bloc_id_idx
  on public.bloc_members (bloc_id);

create index if not exists bloc_members_profile_id_idx
  on public.bloc_members (profile_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Seasons
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  bloc_id uuid not null references public.blocs(id) on delete cascade,
  month_key text not null,
  month_start date not null,
  label text not null,
  year integer not null,
  month_index integer not null,
  status public.season_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  min_target integer not null,
  fine_amount integer not null,
  fee_model public.fee_model_type not null,
  escalation_step_amount integer,
  currency text not null,
  min_run_distance integer not null,
  distance_unit text not null,
  strava_enabled boolean not null default true,
  time_zone text not null,
  accepted_workout_types text[] not null default '{}',
  unique (bloc_id, month_key)
);

create index if not exists seasons_bloc_id_status_idx
  on public.seasons (bloc_id, status, month_start desc);

create table if not exists public.season_member_status (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  display_name_snapshot text not null,
  joined_for_month boolean not null default true,
  workout_count integer not null default 0,
  excused boolean not null default false,
  settlement_status text,
  settlement_settled_at date,
  settlement_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, display_name_snapshot)
);

create index if not exists season_member_status_season_id_idx
  on public.season_member_status (season_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Logs and reactions
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.workout_logs (
  id text primary key,
  bloc_id uuid not null references public.blocs(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
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
  decision_at timestamptz
);

create index if not exists workout_logs_bloc_season_date_idx
  on public.workout_logs (bloc_id, season_id, workout_date desc, created_at desc);

create index if not exists workout_logs_profile_id_idx
  on public.workout_logs (profile_id);

create table if not exists public.workout_reactions (
  workout_log_id text not null references public.workout_logs(id) on delete cascade,
  reactor_profile_id uuid references public.profiles(id) on delete set null,
  reactor_display_name text not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (workout_log_id, emoji, reactor_display_name)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Sit-outs and overrides
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.season_overrides (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null unique references public.seasons(id) on delete cascade,
  prorated boolean not null default false,
  prorated_mas integer,
  chosen_at timestamptz,
  chosen_by text,
  chosen_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sit_out_requests (
  id uuid primary key default gen_random_uuid(),
  bloc_id uuid not null references public.blocs(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  display_name_snapshot text not null,
  status public.sit_out_request_status not null default 'pending',
  reason text not null default '',
  exceptional boolean not null default false,
  requested_at timestamptz,
  requested_by text not null,
  requested_by_user_id uuid references public.profiles(id) on delete set null,
  target_approver_name text,
  target_approver_user_id uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decided_by text,
  decided_by_user_id uuid references public.profiles(id) on delete set null,
  auto_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, display_name_snapshot)
);

create index if not exists sit_out_requests_bloc_season_idx
  on public.sit_out_requests (bloc_id, season_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Settlements
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.settlement_runs (
  id uuid primary key default gen_random_uuid(),
  bloc_id uuid not null references public.blocs(id) on delete cascade,
  season_id uuid not null unique references public.seasons(id) on delete cascade,
  status public.settlement_run_status not null default 'pending',
  currency text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  failed_at timestamptz,
  failure_reason text
);

create index if not exists settlement_runs_bloc_id_idx
  on public.settlement_runs (bloc_id, created_at desc);

create table if not exists public.settlement_entries (
  id uuid primary key default gen_random_uuid(),
  settlement_run_id uuid not null references public.settlement_runs(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  display_name_snapshot text not null,
  workout_count integer not null default 0,
  mas integer not null,
  hit_mas boolean not null default false,
  outcome public.settlement_outcome not null,
  amount_owed numeric(12,2) not null default 0,
  amount_receiving numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (settlement_run_id, display_name_snapshot)
);

create index if not exists settlement_entries_run_id_idx
  on public.settlement_entries (settlement_run_id);

create table if not exists public.settlement_transfers (
  id uuid primary key default gen_random_uuid(),
  settlement_run_id uuid not null references public.settlement_runs(id) on delete cascade,
  from_profile_id uuid references public.profiles(id) on delete set null,
  from_display_name text not null,
  to_profile_id uuid references public.profiles(id) on delete set null,
  to_display_name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  recipient_payment_method_type public.payment_method_type,
  recipient_payment_label text,
  recipient_payment_details text,
  recipient_payment_custom_label text,
  created_at timestamptz not null default now()
);

create index if not exists settlement_transfers_run_id_idx
  on public.settlement_transfers (settlement_run_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Notifications outbox
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  bloc_id uuid references public.blocs(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete cascade,
  settlement_run_id uuid references public.settlement_runs(id) on delete cascade,
  job_type text not null,
  channel public.notification_channel not null,
  status public.notification_job_status not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz,
  sent_at timestamptz,
  cancelled_at timestamptz,
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_jobs_pending_idx
  on public.notification_jobs (status, scheduled_for, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpful views for migration parity and read composition
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.current_open_seasons as
select *
from public.seasons
where status = 'open';

create or replace view public.current_member_workout_counts as
select
  s.bloc_id,
  s.id as season_id,
  sms.display_name_snapshot,
  sms.workout_count,
  sms.excused
from public.season_member_status sms
join public.seasons s on s.id = sms.season_id
where s.status = 'open';

-- RLS is intentionally not enabled in this draft yet.
-- Policy design belongs in the next phase once table responsibilities and
-- read paths are finalized.
