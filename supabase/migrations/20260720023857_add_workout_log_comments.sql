alter table ante_core.bloc_messages
  drop constraint if exists bloc_messages_message_type_check;

alter table ante_core.bloc_messages
  add constraint bloc_messages_message_type_check
  check (message_type in ('text', 'system', 'event', 'log_comment'));

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

create or replace function public.read_ante_core_workout_log_comments(
  p_legacy_group_key text,
  p_auth_user_id text,
  p_workout_log_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_profile_id uuid;
  v_workout_log_id text := trim(coalesce(p_workout_log_id, ''));
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    return '[]'::jsonb;
  end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then
    return '[]'::jsonb;
  end if;
  if v_workout_log_id = '' then
    return '[]'::jsonb;
  end if;

  select b.id into v_bloc_id
  from ante_core.blocs b
  where b.legacy_group_key = trim(p_legacy_group_key);

  select p.id into v_profile_id
  from ante_core.profiles p
  where p.auth_user_id = trim(p_auth_user_id)::uuid;

  if v_bloc_id is null or v_profile_id is null then
    return '[]'::jsonb;
  end if;

  if not exists (
    select 1
    from ante_core.bloc_members bm
    where bm.bloc_id = v_bloc_id
      and bm.profile_id = v_profile_id
      and bm.left_at is null
  ) then
    raise exception 'not a bloc member' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from ante_core.workout_logs wl
    where wl.id = v_workout_log_id
      and wl.bloc_id = v_bloc_id
  ) then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', c.id::text,
        'logId', c.workout_log_id,
        'commenterUserId', commenter.auth_user_id::text,
        'commenterName', c.commenter_display_name,
        'body', c.body,
        'createdAt', c.created_at
      )
      order by c.created_at asc, c.id asc
    )
    from ante_core.workout_log_comments c
    left join ante_core.profiles commenter on commenter.id = c.commenter_profile_id
    where c.workout_log_id = v_workout_log_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.read_ante_core_workout_log_comment_counts(
  p_legacy_group_key text,
  p_auth_user_id text,
  p_workout_log_ids text[] default array[]::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_profile_id uuid;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    return '{}'::jsonb;
  end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then
    return '{}'::jsonb;
  end if;

  select b.id into v_bloc_id
  from ante_core.blocs b
  where b.legacy_group_key = trim(p_legacy_group_key);

  select p.id into v_profile_id
  from ante_core.profiles p
  where p.auth_user_id = trim(p_auth_user_id)::uuid;

  if v_bloc_id is null or v_profile_id is null then
    return '{}'::jsonb;
  end if;

  if not exists (
    select 1
    from ante_core.bloc_members bm
    where bm.bloc_id = v_bloc_id
      and bm.profile_id = v_profile_id
      and bm.left_at is null
  ) then
    raise exception 'not a bloc member' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_object_agg(wl.id, coalesce(counts.comment_count, 0))
    from ante_core.workout_logs wl
    left join (
      select workout_log_id, count(*)::integer as comment_count
      from ante_core.workout_log_comments
      group by workout_log_id
    ) counts on counts.workout_log_id = wl.id
    where wl.bloc_id = v_bloc_id
      and (
        coalesce(array_length(p_workout_log_ids, 1), 0) = 0
        or wl.id = any(p_workout_log_ids)
      )
  ), '{}'::jsonb);
end;
$$;

create or replace function public.insert_ante_core_workout_log_comment(
  p_legacy_group_key text,
  p_auth_user_id text,
  p_workout_log_id text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_commenter_profile_id uuid;
  v_commenter_display_name text;
  v_workout_log_id text := trim(coalesce(p_workout_log_id, ''));
  v_body text := trim(coalesce(p_body, ''));
  v_comment_id uuid;
  v_comment_count integer;
  v_latest_comment jsonb;
  v_log_payload jsonb;
  v_message_id uuid;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    raise exception 'legacy group key is required' using errcode = '22023';
  end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then
    raise exception 'commenter is required' using errcode = '22023';
  end if;
  if v_workout_log_id = '' then
    raise exception 'workout log is required' using errcode = '22023';
  end if;
  if v_body = '' then
    raise exception 'comment body is required' using errcode = '22023';
  end if;

  select b.id into v_bloc_id
  from ante_core.blocs b
  where b.legacy_group_key = trim(p_legacy_group_key);

  select p.id, p.display_name into v_commenter_profile_id, v_commenter_display_name
  from ante_core.profiles p
  where p.auth_user_id = trim(p_auth_user_id)::uuid;

  if v_bloc_id is null or v_commenter_profile_id is null then
    raise exception 'bloc or commenter not found' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from ante_core.bloc_members bm
    where bm.bloc_id = v_bloc_id
      and bm.profile_id = v_commenter_profile_id
      and bm.left_at is null
  ) then
    raise exception 'not a bloc member' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from ante_core.workout_logs wl
    where wl.id = v_workout_log_id
      and wl.bloc_id = v_bloc_id
  ) then
    raise exception 'workout log not found' using errcode = '22023';
  end if;

  insert into ante_core.workout_log_comments (
    workout_log_id,
    commenter_profile_id,
    commenter_display_name,
    body
  )
  values (
    v_workout_log_id,
    v_commenter_profile_id,
    coalesce(nullif(trim(v_commenter_display_name), ''), 'Member'),
    left(v_body, 1000)
  )
  returning id into v_comment_id;

  select count(*)::integer into v_comment_count
  from ante_core.workout_log_comments c
  where c.workout_log_id = v_workout_log_id;

  select jsonb_build_object(
    'id', c.id::text,
    'logId', c.workout_log_id,
    'commenterUserId', commenter.auth_user_id::text,
    'commenterName', c.commenter_display_name,
    'body', c.body,
    'createdAt', c.created_at
  ) into v_latest_comment
  from ante_core.workout_log_comments c
  left join ante_core.profiles commenter on commenter.id = c.commenter_profile_id
  where c.id = v_comment_id;

  select jsonb_build_object(
    'id', wl.id,
    'ownerDisplayName', wl.owner_display_name,
    'workoutDate', to_char(wl.workout_date, 'YYYY-MM-DD'),
    'workoutType', wl.workout_type,
    'note', wl.note,
    'photoUrl', wl.photo_url,
    'createdAt', wl.created_at,
    'verifiedVia', wl.verified_via,
    'commentCount', v_comment_count,
    'latestComment', v_latest_comment
  ) into v_log_payload
  from ante_core.workout_logs wl
  where wl.id = v_workout_log_id;

  delete from ante_core.bloc_messages
  where bloc_id = v_bloc_id
    and message_type = 'log_comment'
    and idempotency_key = 'log_comment:' || v_workout_log_id;

  insert into ante_core.bloc_messages (
    bloc_id,
    message_type,
    author_profile_id,
    body,
    payload,
    idempotency_key,
    created_at
  )
  values (
    v_bloc_id,
    'log_comment',
    null,
    '',
    v_log_payload,
    'log_comment:' || v_workout_log_id,
    now()
  )
  returning id into v_message_id;

  return jsonb_build_object(
    'comment', v_latest_comment,
    'commentCount', v_comment_count,
    'streamMessageId', v_message_id::text
  );
end;
$$;

revoke execute on function public.read_ante_core_workout_log_comments(text, text, text) from public;
revoke execute on function public.read_ante_core_workout_log_comments(text, text, text) from anon;
revoke execute on function public.read_ante_core_workout_log_comments(text, text, text) from authenticated;
grant execute on function public.read_ante_core_workout_log_comments(text, text, text) to service_role;

revoke execute on function public.read_ante_core_workout_log_comment_counts(text, text, text[]) from public;
revoke execute on function public.read_ante_core_workout_log_comment_counts(text, text, text[]) from anon;
revoke execute on function public.read_ante_core_workout_log_comment_counts(text, text, text[]) from authenticated;
grant execute on function public.read_ante_core_workout_log_comment_counts(text, text, text[]) to service_role;

revoke execute on function public.insert_ante_core_workout_log_comment(text, text, text, text) from public;
revoke execute on function public.insert_ante_core_workout_log_comment(text, text, text, text) from anon;
revoke execute on function public.insert_ante_core_workout_log_comment(text, text, text, text) from authenticated;
grant execute on function public.insert_ante_core_workout_log_comment(text, text, text, text) to service_role;;
