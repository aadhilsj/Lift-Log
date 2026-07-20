-- Bloc Stream canonical tables.
--
-- Private ante_core tables. The browser must not access these directly; the app
-- server calls service-role-only RPCs and enforces membership from auth context.

create table if not exists ante_core.bloc_messages (
  id uuid primary key default gen_random_uuid(),
  bloc_id uuid not null references ante_core.blocs(id) on delete cascade,
  message_type text not null check (message_type in ('text', 'system', 'event', 'log_comment')),
  author_profile_id uuid references ante_core.profiles(id) on delete set null,
  body text,
  system_kind text,
  payload jsonb not null default '{}'::jsonb,
  reply_to uuid references ante_core.bloc_messages(id) on delete set null,
  mentions uuid[] not null default '{}'::uuid[],
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ante_core_bloc_messages_text_body_check
    check (message_type <> 'text' or nullif(trim(coalesce(body, '')), '') is not null),
  constraint ante_core_bloc_messages_system_kind_check
    check (message_type <> 'system' or nullif(trim(coalesce(system_kind, '')), '') is not null)
);

create unique index if not exists ante_core_bloc_messages_idempotency_key_uidx
  on ante_core.bloc_messages (bloc_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists ante_core_bloc_messages_bloc_created_idx
  on ante_core.bloc_messages (bloc_id, created_at asc, id asc);

create index if not exists ante_core_bloc_messages_author_idx
  on ante_core.bloc_messages (author_profile_id);

create table if not exists ante_core.bloc_message_reactions (
  message_id uuid not null references ante_core.bloc_messages(id) on delete cascade,
  reactor_profile_id uuid references ante_core.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, reactor_profile_id, emoji)
);

create index if not exists ante_core_bloc_message_reactions_profile_idx
  on ante_core.bloc_message_reactions (reactor_profile_id);

create table if not exists ante_core.bloc_message_reads (
  bloc_id uuid not null references ante_core.blocs(id) on delete cascade,
  profile_id uuid not null references ante_core.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (bloc_id, profile_id)
);

create index if not exists ante_core_bloc_message_reads_profile_idx
  on ante_core.bloc_message_reads (profile_id);

create table if not exists ante_core.workout_log_comments (
  id uuid primary key default gen_random_uuid(),
  workout_log_id text not null references ante_core.workout_logs(id) on delete cascade,
  commenter_profile_id uuid references ante_core.profiles(id) on delete set null,
  commenter_display_name text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint ante_core_workout_log_comments_body_check
    check (nullif(trim(body), '') is not null)
);

create index if not exists ante_core_workout_log_comments_log_created_idx
  on ante_core.workout_log_comments (workout_log_id, created_at asc, id asc);

create index if not exists ante_core_workout_log_comments_commenter_idx
  on ante_core.workout_log_comments (commenter_profile_id);

do $$
begin
  begin
    alter publication supabase_realtime add table ante_core.workout_log_comments;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
