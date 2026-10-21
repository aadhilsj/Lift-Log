-- App Store UGC safety: durable user blocks and a founder-only report queue.
--
-- These are private ante_core tables. The browser never receives direct table
-- access: the application server calls the service_role-only RPCs below after
-- it has authenticated the user (and, for the queue, checked the founder
-- allowlist). Keeping membership checks inside the RPCs protects against an
-- API caller substituting another person's identifier.

create table if not exists ante_core.user_blocks (
  blocker_profile_id uuid not null references ante_core.profiles(id) on delete cascade,
  blocked_profile_id uuid not null references ante_core.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_profile_id, blocked_profile_id),
  constraint ante_core_user_blocks_not_self check (blocker_profile_id <> blocked_profile_id)
);

create index if not exists ante_core_user_blocks_blocked_profile_idx
  on ante_core.user_blocks (blocked_profile_id);

create table if not exists ante_core.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_profile_id uuid references ante_core.profiles(id) on delete set null,
  reported_profile_id uuid references ante_core.profiles(id) on delete set null,
  bloc_id uuid references ante_core.blocs(id) on delete set null,
  content_type text not null check (content_type in ('stream_message', 'workout_comment', 'workout_log', 'profile')),
  content_id text not null check (nullif(trim(content_id), '') is not null),
  reason text not null check (reason in ('harassment', 'hate_or_discrimination', 'threat_or_safety', 'sexual_or_inappropriate', 'spam', 'other')),
  details text not null default '',
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  reviewed_by_profile_id uuid references ante_core.profiles(id) on delete set null,
  review_note text not null default '',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists ante_core_content_reports_queue_idx
  on ante_core.content_reports (status, created_at desc, id desc);

create index if not exists ante_core_content_reports_reported_profile_idx
  on ante_core.content_reports (reported_profile_id);

alter table ante_core.user_blocks enable row level security;
alter table ante_core.content_reports enable row level security;
revoke all on table ante_core.user_blocks from public, anon, authenticated;
revoke all on table ante_core.content_reports from public, anon, authenticated;

create or replace function public.read_ante_core_user_blocks(p_auth_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_profile_id uuid;
begin
  if nullif(trim(coalesce(p_auth_user_id, '')), '') is null then
    return '[]'::jsonb;
  end if;

  select p.id into v_profile_id
  from ante_core.profiles p
  where p.auth_user_id = trim(p_auth_user_id)::uuid;

  if v_profile_id is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(blocked.auth_user_id::text order by b.created_at desc)
    from ante_core.user_blocks b
    join ante_core.profiles blocked on blocked.id = b.blocked_profile_id
    where b.blocker_profile_id = v_profile_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.set_ante_core_user_block(
  p_auth_user_id text,
  p_blocked_auth_user_id text,
  p_blocked boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_blocker_profile_id uuid;
  v_blocked_profile_id uuid;
begin
  if nullif(trim(coalesce(p_auth_user_id, '')), '') is null
     or nullif(trim(coalesce(p_blocked_auth_user_id, '')), '') is null then
    raise exception 'both user identifiers are required' using errcode = '22023';
  end if;

  select p.id into v_blocker_profile_id from ante_core.profiles p
  where p.auth_user_id = trim(p_auth_user_id)::uuid;
  select p.id into v_blocked_profile_id from ante_core.profiles p
  where p.auth_user_id = trim(p_blocked_auth_user_id)::uuid;

  if v_blocker_profile_id is null or v_blocked_profile_id is null then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
  if v_blocker_profile_id = v_blocked_profile_id then
    raise exception 'you cannot block yourself' using errcode = '22023';
  end if;

  -- Blocking is only available to people who currently share at least one Bloc.
  if not exists (
    select 1
    from ante_core.bloc_members mine
    join ante_core.bloc_members theirs on theirs.bloc_id = mine.bloc_id
    where mine.profile_id = v_blocker_profile_id and mine.left_at is null
      and theirs.profile_id = v_blocked_profile_id and theirs.left_at is null
  ) then
    raise exception 'you can only block a current Bloc member' using errcode = '42501';
  end if;

  if coalesce(p_blocked, true) then
    insert into ante_core.user_blocks (blocker_profile_id, blocked_profile_id)
    values (v_blocker_profile_id, v_blocked_profile_id)
    on conflict do nothing;
    return jsonb_build_object('blocked', true);
  end if;

  delete from ante_core.user_blocks
  where blocker_profile_id = v_blocker_profile_id and blocked_profile_id = v_blocked_profile_id;
  return jsonb_build_object('blocked', false);
end;
$$;

create or replace function public.create_ante_core_content_report(
  p_auth_user_id text,
  p_legacy_group_key text,
  p_reported_auth_user_id text,
  p_content_type text,
  p_content_id text,
  p_reason text,
  p_details text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_reporter_profile_id uuid;
  v_reported_profile_id uuid;
  v_bloc_id uuid;
  v_content_type text := trim(coalesce(p_content_type, ''));
  v_content_id text := trim(coalesce(p_content_id, ''));
  v_reason text := trim(coalesce(p_reason, ''));
  v_details text := left(trim(coalesce(p_details, '')), 1000);
  v_report_id uuid;
begin
  if nullif(trim(coalesce(p_auth_user_id, '')), '') is null
     or nullif(trim(coalesce(p_legacy_group_key, '')), '') is null
     or nullif(trim(coalesce(p_reported_auth_user_id, '')), '') is null
     or v_content_id = '' then
    raise exception 'report details are required' using errcode = '22023';
  end if;
  if v_content_type not in ('stream_message', 'workout_comment', 'workout_log', 'profile')
     or v_reason not in ('harassment', 'hate_or_discrimination', 'threat_or_safety', 'sexual_or_inappropriate', 'spam', 'other') then
    raise exception 'invalid report category' using errcode = '22023';
  end if;

  select b.id into v_bloc_id from ante_core.blocs b where b.legacy_group_key = trim(p_legacy_group_key);
  select p.id into v_reporter_profile_id from ante_core.profiles p where p.auth_user_id = trim(p_auth_user_id)::uuid;
  select p.id into v_reported_profile_id from ante_core.profiles p where p.auth_user_id = trim(p_reported_auth_user_id)::uuid;
  if v_bloc_id is null or v_reporter_profile_id is null or v_reported_profile_id is null then
    raise exception 'report context was not found' using errcode = 'P0002';
  end if;
  if v_reporter_profile_id = v_reported_profile_id then
    raise exception 'you cannot report yourself' using errcode = '22023';
  end if;
  if not exists (select 1 from ante_core.bloc_members bm where bm.bloc_id = v_bloc_id and bm.profile_id = v_reporter_profile_id and bm.left_at is null)
     or not exists (select 1 from ante_core.bloc_members bm where bm.bloc_id = v_bloc_id and bm.profile_id = v_reported_profile_id and bm.left_at is null) then
    raise exception 'reports are limited to current Bloc members' using errcode = '42501';
  end if;

  insert into ante_core.content_reports (
    reporter_profile_id, reported_profile_id, bloc_id, content_type, content_id, reason, details
  ) values (
    v_reporter_profile_id, v_reported_profile_id, v_bloc_id, v_content_type, v_content_id, v_reason, v_details
  ) returning id into v_report_id;

  return jsonb_build_object('id', v_report_id::text, 'status', 'open');
end;
$$;

create or replace function public.read_ante_core_content_reports(p_limit integer default 100)
returns jsonb
language sql
security definer
set search_path = ante_core, public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id::text,
    'status', r.status,
    'contentType', r.content_type,
    'contentId', r.content_id,
    'reason', r.reason,
    'details', r.details,
    'createdAt', r.created_at,
    'reviewedAt', r.reviewed_at,
    'reviewNote', r.review_note,
    'reporterName', coalesce(reporter.display_name, 'Deleted account'),
    'reportedName', coalesce(reported.display_name, 'Deleted account'),
    'blocName', coalesce(b.name, 'Deleted Bloc'),
    'reviewedByName', reviewer.display_name
  ) order by r.created_at desc, r.id desc), '[]'::jsonb)
  from (
    select * from ante_core.content_reports order by status = 'open' desc, created_at desc, id desc
    limit least(greatest(coalesce(p_limit, 100), 1), 200)
  ) r
  left join ante_core.profiles reporter on reporter.id = r.reporter_profile_id
  left join ante_core.profiles reported on reported.id = r.reported_profile_id
  left join ante_core.profiles reviewer on reviewer.id = r.reviewed_by_profile_id
  left join ante_core.blocs b on b.id = r.bloc_id;
$$;

create or replace function public.review_ante_core_content_report(
  p_report_id uuid,
  p_status text,
  p_reviewer_auth_user_id text,
  p_review_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_reviewer_profile_id uuid;
  v_status text := trim(coalesce(p_status, ''));
  v_updated_id uuid;
begin
  if p_report_id is null or v_status not in ('reviewed', 'dismissed')
     or nullif(trim(coalesce(p_reviewer_auth_user_id, '')), '') is null then
    raise exception 'valid review details are required' using errcode = '22023';
  end if;
  select p.id into v_reviewer_profile_id from ante_core.profiles p
  where p.auth_user_id = trim(p_reviewer_auth_user_id)::uuid;
  if v_reviewer_profile_id is null then raise exception 'reviewer profile not found' using errcode = 'P0002'; end if;

  update ante_core.content_reports
  set status = v_status, reviewed_by_profile_id = v_reviewer_profile_id,
      review_note = left(trim(coalesce(p_review_note, '')), 1000), reviewed_at = now()
  where id = p_report_id
  returning id into v_updated_id;
  if v_updated_id is null then raise exception 'report not found' using errcode = 'P0002'; end if;
  return jsonb_build_object('id', v_updated_id::text, 'status', v_status);
end;
$$;

revoke all on function public.read_ante_core_user_blocks(text) from public, anon, authenticated;
revoke all on function public.set_ante_core_user_block(text, text, boolean) from public, anon, authenticated;
revoke all on function public.create_ante_core_content_report(text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.read_ante_core_content_reports(integer) from public, anon, authenticated;
revoke all on function public.review_ante_core_content_report(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.read_ante_core_user_blocks(text) to service_role;
grant execute on function public.set_ante_core_user_block(text, text, boolean) to service_role;
grant execute on function public.create_ante_core_content_report(text, text, text, text, text, text, text) to service_role;
grant execute on function public.read_ante_core_content_reports(integer) to service_role;
grant execute on function public.review_ante_core_content_report(uuid, text, text, text) to service_role;
