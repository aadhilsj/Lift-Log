-- Bloc Stream RPCs.
--
-- Access: service_role only. The app server passes the authenticated user id.
-- Each RPC checks active Bloc membership before reading or writing.

create or replace function public.read_ante_core_bloc_stream(
  p_legacy_group_key text,
  p_auth_user_id text,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_profile_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    return '[]'::jsonb;
  end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then
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

  return coalesce((
    with selected_messages as (
      select m.*
      from ante_core.bloc_messages m
      where m.bloc_id = v_bloc_id
      order by m.created_at desc, m.id desc
      limit v_limit
    ),
    ordered_messages as (
      select *
      from selected_messages
      order by created_at asc, id asc
    ),
    reaction_rows as (
      select
        r.message_id,
        r.emoji,
        jsonb_agg(p.auth_user_id::text order by r.created_at asc, p.auth_user_id::text) as user_ids
      from ante_core.bloc_message_reactions r
      join ante_core.profiles p on p.id = r.reactor_profile_id
      where r.message_id in (select id from selected_messages)
      group by r.message_id, r.emoji
    ),
    reactions_by_message as (
      select
        message_id,
        jsonb_object_agg(emoji, user_ids order by emoji) as reactions
      from reaction_rows
      group by message_id
    )
    select jsonb_agg(
      jsonb_build_object(
        'id', m.id::text,
        'bloc_id', p_legacy_group_key,
        'author_id', author_profile.auth_user_id::text,
        'message_type', m.message_type,
        'body', coalesce(m.body, ''),
        'system_kind', coalesce(m.system_kind, ''),
        'payload', coalesce(m.payload, '{}'::jsonb),
        'reply_to', m.reply_to::text,
        'mentions', coalesce((
          select jsonb_agg(mp.auth_user_id::text order by mp.auth_user_id::text)
          from unnest(m.mentions) mention_profile_id
          join ante_core.profiles mp on mp.id = mention_profile_id
        ), '[]'::jsonb),
        'reactions', coalesce(rbm.reactions, '{}'::jsonb),
        'created_at', m.created_at
      )
      order by m.created_at asc, m.id asc
    )
    from ordered_messages m
    left join ante_core.profiles author_profile on author_profile.id = m.author_profile_id
    left join reactions_by_message rbm on rbm.message_id = m.id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.read_ante_core_bloc_stream_unread_count(
  p_legacy_group_key text,
  p_auth_user_id text
)
returns integer
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_profile_id uuid;
  v_last_read_at timestamptz;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    return 0;
  end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then
    return 0;
  end if;

  select b.id into v_bloc_id
  from ante_core.blocs b
  where b.legacy_group_key = trim(p_legacy_group_key);

  select p.id into v_profile_id
  from ante_core.profiles p
  where p.auth_user_id = trim(p_auth_user_id)::uuid;

  if v_bloc_id is null or v_profile_id is null then
    return 0;
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

  select r.last_read_at into v_last_read_at
  from ante_core.bloc_message_reads r
  where r.bloc_id = v_bloc_id
    and r.profile_id = v_profile_id;

  return (
    select count(*)::integer
    from ante_core.bloc_messages m
    where m.bloc_id = v_bloc_id
      and m.created_at > coalesce(v_last_read_at, '-infinity'::timestamptz)
      and (m.author_profile_id is null or m.author_profile_id <> v_profile_id)
  );
end;
$$;

create or replace function public.send_ante_core_bloc_message(
  p_legacy_group_key text,
  p_author_auth_user_id text,
  p_body text,
  p_reply_to text default null,
  p_mentions text[] default array[]::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_author_profile_id uuid;
  v_reply_to uuid;
  v_mentions uuid[] := '{}'::uuid[];
  v_message_id uuid;
  v_body text := trim(coalesce(p_body, ''));
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    raise exception 'legacy group key is required' using errcode = '22023';
  end if;
  if p_author_auth_user_id is null or trim(p_author_auth_user_id) = '' then
    raise exception 'author is required' using errcode = '22023';
  end if;
  if v_body = '' then
    raise exception 'message body is required' using errcode = '22023';
  end if;

  select b.id into v_bloc_id
  from ante_core.blocs b
  where b.legacy_group_key = trim(p_legacy_group_key);

  select p.id into v_author_profile_id
  from ante_core.profiles p
  where p.auth_user_id = trim(p_author_auth_user_id)::uuid;

  if v_bloc_id is null or v_author_profile_id is null then
    raise exception 'bloc or author not found' using errcode = '22023';
  end if;

  if not exists (
    select 1 from ante_core.bloc_members bm
    where bm.bloc_id = v_bloc_id and bm.profile_id = v_author_profile_id and bm.left_at is null
  ) then
    raise exception 'not a bloc member' using errcode = '42501';
  end if;

  if p_reply_to is not null and trim(p_reply_to) <> '' then
    select m.id into v_reply_to
    from ante_core.bloc_messages m
    where m.id = trim(p_reply_to)::uuid
      and m.bloc_id = v_bloc_id;
  end if;

  select coalesce(array_agg(p.id), '{}'::uuid[]) into v_mentions
  from ante_core.profiles p
  join unnest(coalesce(p_mentions, array[]::text[])) mention_auth_user_id
    on p.auth_user_id = mention_auth_user_id::uuid;

  insert into ante_core.bloc_messages (
    bloc_id,
    message_type,
    author_profile_id,
    body,
    reply_to,
    mentions,
    payload
  )
  values (
    v_bloc_id,
    'text',
    v_author_profile_id,
    left(v_body, 2000),
    v_reply_to,
    v_mentions,
    '{}'::jsonb
  )
  returning id into v_message_id;

  return jsonb_build_object('id', v_message_id::text);
end;
$$;

create or replace function public.create_ante_core_bloc_event(
  p_legacy_group_key text,
  p_author_auth_user_id text,
  p_activity text,
  p_when text default '',
  p_location text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_author_profile_id uuid;
  v_message_id uuid;
  v_activity text := trim(coalesce(p_activity, ''));
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    raise exception 'legacy group key is required' using errcode = '22023';
  end if;
  if p_author_auth_user_id is null or trim(p_author_auth_user_id) = '' then
    raise exception 'author is required' using errcode = '22023';
  end if;
  if v_activity = '' then
    raise exception 'activity is required' using errcode = '22023';
  end if;

  select b.id into v_bloc_id
  from ante_core.blocs b
  where b.legacy_group_key = trim(p_legacy_group_key);

  select p.id into v_author_profile_id
  from ante_core.profiles p
  where p.auth_user_id = trim(p_author_auth_user_id)::uuid;

  if v_bloc_id is null or v_author_profile_id is null then
    raise exception 'bloc or author not found' using errcode = '22023';
  end if;

  if not exists (
    select 1 from ante_core.bloc_members bm
    where bm.bloc_id = v_bloc_id and bm.profile_id = v_author_profile_id and bm.left_at is null
  ) then
    raise exception 'not a bloc member' using errcode = '42501';
  end if;

  insert into ante_core.bloc_messages (
    bloc_id,
    message_type,
    author_profile_id,
    payload
  )
  values (
    v_bloc_id,
    'event',
    v_author_profile_id,
    jsonb_build_object(
      'activity', left(v_activity, 120),
      'when', left(trim(coalesce(p_when, '')), 120),
      'location', left(trim(coalesce(p_location, '')), 160),
      'rsvp', '{}'::jsonb
    )
  )
  returning id into v_message_id;

  return jsonb_build_object('id', v_message_id::text);
end;
$$;

create or replace function public.set_ante_core_bloc_event_rsvp(
  p_legacy_group_key text,
  p_auth_user_id text,
  p_message_id text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_profile_id uuid;
  v_message_id uuid;
  v_status text := trim(coalesce(p_status, ''));
  v_current text;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    return;
  end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then
    return;
  end if;
  if p_message_id is null or trim(p_message_id) = '' then
    return;
  end if;
  if v_status not in ('in', 'pass') then
    return;
  end if;

  select b.id into v_bloc_id
  from ante_core.blocs b
  where b.legacy_group_key = trim(p_legacy_group_key);

  select p.id into v_profile_id
  from ante_core.profiles p
  where p.auth_user_id = trim(p_auth_user_id)::uuid;

  if v_bloc_id is null or v_profile_id is null then
    return;
  end if;

  if not exists (
    select 1 from ante_core.bloc_members bm
    where bm.bloc_id = v_bloc_id and bm.profile_id = v_profile_id and bm.left_at is null
  ) then
    raise exception 'not a bloc member' using errcode = '42501';
  end if;

  select m.id into v_message_id
  from ante_core.bloc_messages m
  where m.id = trim(p_message_id)::uuid
    and m.bloc_id = v_bloc_id
    and m.message_type = 'event';

  if v_message_id is null then
    return;
  end if;

  select payload #>> array['rsvp', p_auth_user_id] into v_current
  from ante_core.bloc_messages
  where id = v_message_id;

  update ante_core.bloc_messages
  set payload = case
      when v_current = v_status then payload #- array['rsvp', p_auth_user_id]
      else jsonb_set(payload, array['rsvp', p_auth_user_id], to_jsonb(v_status), true)
    end,
    updated_at = now()
  where id = v_message_id;
end;
$$;

create or replace function public.toggle_ante_core_bloc_message_reaction(
  p_legacy_group_key text,
  p_auth_user_id text,
  p_message_id text,
  p_emoji text,
  p_is_adding boolean default null
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_profile_id uuid;
  v_message_id uuid;
  v_emoji text := trim(coalesce(p_emoji, ''));
  v_exists boolean;
  v_is_adding boolean;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    return;
  end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then
    return;
  end if;
  if p_message_id is null or trim(p_message_id) = '' then
    return;
  end if;
  if v_emoji = '' then
    return;
  end if;

  select b.id into v_bloc_id
  from ante_core.blocs b
  where b.legacy_group_key = trim(p_legacy_group_key);

  select p.id into v_profile_id
  from ante_core.profiles p
  where p.auth_user_id = trim(p_auth_user_id)::uuid;

  if v_bloc_id is null or v_profile_id is null then
    return;
  end if;

  if not exists (
    select 1 from ante_core.bloc_members bm
    where bm.bloc_id = v_bloc_id and bm.profile_id = v_profile_id and bm.left_at is null
  ) then
    raise exception 'not a bloc member' using errcode = '42501';
  end if;

  select m.id into v_message_id
  from ante_core.bloc_messages m
  where m.id = trim(p_message_id)::uuid
    and m.bloc_id = v_bloc_id;

  if v_message_id is null then
    return;
  end if;

  select exists (
    select 1
    from ante_core.bloc_message_reactions r
    where r.message_id = v_message_id
      and r.reactor_profile_id = v_profile_id
      and r.emoji = v_emoji
  ) into v_exists;

  v_is_adding := coalesce(p_is_adding, not v_exists);

  if v_is_adding then
    insert into ante_core.bloc_message_reactions (message_id, reactor_profile_id, emoji)
    values (v_message_id, v_profile_id, v_emoji)
    on conflict (message_id, reactor_profile_id, emoji) do nothing;
  else
    delete from ante_core.bloc_message_reactions
    where message_id = v_message_id
      and reactor_profile_id = v_profile_id
      and emoji = v_emoji;
  end if;
end;
$$;

create or replace function public.mark_ante_core_bloc_stream_read(
  p_legacy_group_key text,
  p_auth_user_id text
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_profile_id uuid;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    return;
  end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then
    return;
  end if;

  select b.id into v_bloc_id
  from ante_core.blocs b
  where b.legacy_group_key = trim(p_legacy_group_key);

  select p.id into v_profile_id
  from ante_core.profiles p
  where p.auth_user_id = trim(p_auth_user_id)::uuid;

  if v_bloc_id is null or v_profile_id is null then
    return;
  end if;

  if not exists (
    select 1 from ante_core.bloc_members bm
    where bm.bloc_id = v_bloc_id and bm.profile_id = v_profile_id and bm.left_at is null
  ) then
    raise exception 'not a bloc member' using errcode = '42501';
  end if;

  insert into ante_core.bloc_message_reads (bloc_id, profile_id, last_read_at, updated_at)
  values (v_bloc_id, v_profile_id, now(), now())
  on conflict (bloc_id, profile_id)
  do update set last_read_at = excluded.last_read_at, updated_at = excluded.updated_at;
end;
$$;

create or replace function public.insert_ante_core_bloc_system_moment(
  p_legacy_group_key text,
  p_system_kind text,
  p_body text,
  p_payload jsonb,
  p_idempotency_key text,
  p_created_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_message_id uuid;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    return null;
  end if;
  if p_system_kind is null or trim(p_system_kind) = '' then
    return null;
  end if;
  if p_idempotency_key is null or trim(p_idempotency_key) = '' then
    return null;
  end if;

  select b.id into v_bloc_id
  from ante_core.blocs b
  where b.legacy_group_key = trim(p_legacy_group_key);

  if v_bloc_id is null then
    return null;
  end if;

  insert into ante_core.bloc_messages (
    bloc_id,
    message_type,
    author_profile_id,
    body,
    system_kind,
    payload,
    idempotency_key,
    created_at
  )
  values (
    v_bloc_id,
    'system',
    null,
    coalesce(p_body, ''),
    trim(p_system_kind),
    coalesce(p_payload, '{}'::jsonb),
    trim(p_idempotency_key),
    coalesce(p_created_at, now())
  )
  on conflict (bloc_id, idempotency_key) where idempotency_key is not null do nothing
  returning id into v_message_id;

  if v_message_id is null then
    select id into v_message_id
    from ante_core.bloc_messages
    where bloc_id = v_bloc_id
      and idempotency_key = trim(p_idempotency_key);
  end if;

  return jsonb_build_object('id', v_message_id::text);
end;
$$;

create or replace function public.delete_ante_core_bloc_system_moment(
  p_legacy_group_key text,
  p_idempotency_key text
)
returns integer
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_deleted_count integer := 0;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    return 0;
  end if;
  if p_idempotency_key is null or trim(p_idempotency_key) = '' then
    return 0;
  end if;

  select b.id into v_bloc_id
  from ante_core.blocs b
  where b.legacy_group_key = trim(p_legacy_group_key);

  if v_bloc_id is null then
    return 0;
  end if;

  delete from ante_core.bloc_messages
  where bloc_id = v_bloc_id
    and message_type = 'system'
    and idempotency_key = trim(p_idempotency_key);

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

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
    with reaction_rows as (
      select
        r.comment_id,
        r.emoji,
        jsonb_agg(p.auth_user_id::text order by r.created_at asc, p.auth_user_id::text) as user_ids
      from ante_core.workout_log_comment_reactions r
      join ante_core.profiles p on p.id = r.reactor_profile_id
      join ante_core.workout_log_comments c on c.id = r.comment_id
      where c.workout_log_id = v_workout_log_id
      group by r.comment_id, r.emoji
    ),
    reactions_by_comment as (
      select
        comment_id,
        jsonb_object_agg(emoji, user_ids order by emoji) as reactions
      from reaction_rows
      group by comment_id
    )
    select jsonb_agg(
      jsonb_build_object(
        'id', c.id::text,
        'logId', c.workout_log_id,
        'commenterUserId', commenter.auth_user_id::text,
        'commenterName', c.commenter_display_name,
        'body', c.body,
        'reactions', coalesce(rbc.reactions, '{}'::jsonb),
        'createdAt', c.created_at
      )
      order by c.created_at asc, c.id asc
    )
    from ante_core.workout_log_comments c
    left join ante_core.profiles commenter on commenter.id = c.commenter_profile_id
    left join reactions_by_comment rbc on rbc.comment_id = c.id
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
    'reactions', '{}'::jsonb,
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

create or replace function public.toggle_ante_core_workout_log_comment_reaction(
  p_legacy_group_key text,
  p_auth_user_id text,
  p_comment_id text,
  p_emoji text,
  p_is_adding boolean default null
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_profile_id uuid;
  v_comment_id uuid;
  v_emoji text := left(trim(coalesce(p_emoji, '')), 16);
  v_exists boolean;
  v_is_adding boolean;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    raise exception 'legacy group key is required' using errcode = '22023';
  end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then
    raise exception 'reactor is required' using errcode = '22023';
  end if;
  if p_comment_id is null or trim(p_comment_id) = '' then
    raise exception 'comment is required' using errcode = '22023';
  end if;
  if v_emoji = '' then
    raise exception 'emoji is required' using errcode = '22023';
  end if;

  select b.id into v_bloc_id
  from ante_core.blocs b
  where b.legacy_group_key = trim(p_legacy_group_key);

  select p.id into v_profile_id
  from ante_core.profiles p
  where p.auth_user_id = trim(p_auth_user_id)::uuid;

  if v_bloc_id is null or v_profile_id is null then
    raise exception 'bloc or reactor not found' using errcode = '22023';
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

  select c.id into v_comment_id
  from ante_core.workout_log_comments c
  join ante_core.workout_logs wl on wl.id = c.workout_log_id
  where c.id = trim(p_comment_id)::uuid
    and wl.bloc_id = v_bloc_id;

  if v_comment_id is null then
    raise exception 'comment not found' using errcode = '22023';
  end if;

  select exists (
    select 1
    from ante_core.workout_log_comment_reactions r
    where r.comment_id = v_comment_id
      and r.reactor_profile_id = v_profile_id
      and r.emoji = v_emoji
  ) into v_exists;

  v_is_adding := coalesce(p_is_adding, not v_exists);

  if v_is_adding then
    insert into ante_core.workout_log_comment_reactions (comment_id, reactor_profile_id, emoji)
    values (v_comment_id, v_profile_id, v_emoji)
    on conflict (comment_id, reactor_profile_id, emoji) do nothing;
  else
    delete from ante_core.workout_log_comment_reactions
    where comment_id = v_comment_id
      and reactor_profile_id = v_profile_id
      and emoji = v_emoji;
  end if;
end;
$$;

revoke execute on function public.read_ante_core_bloc_stream(text, text, integer) from public;
revoke execute on function public.read_ante_core_bloc_stream(text, text, integer) from anon;
revoke execute on function public.read_ante_core_bloc_stream(text, text, integer) from authenticated;
grant execute on function public.read_ante_core_bloc_stream(text, text, integer) to service_role;

revoke execute on function public.read_ante_core_bloc_stream_unread_count(text, text) from public;
revoke execute on function public.read_ante_core_bloc_stream_unread_count(text, text) from anon;
revoke execute on function public.read_ante_core_bloc_stream_unread_count(text, text) from authenticated;
grant execute on function public.read_ante_core_bloc_stream_unread_count(text, text) to service_role;

revoke execute on function public.send_ante_core_bloc_message(text, text, text, text, text[]) from public;
revoke execute on function public.send_ante_core_bloc_message(text, text, text, text, text[]) from anon;
revoke execute on function public.send_ante_core_bloc_message(text, text, text, text, text[]) from authenticated;
grant execute on function public.send_ante_core_bloc_message(text, text, text, text, text[]) to service_role;

revoke execute on function public.create_ante_core_bloc_event(text, text, text, text, text) from public;
revoke execute on function public.create_ante_core_bloc_event(text, text, text, text, text) from anon;
revoke execute on function public.create_ante_core_bloc_event(text, text, text, text, text) from authenticated;
grant execute on function public.create_ante_core_bloc_event(text, text, text, text, text) to service_role;

revoke execute on function public.set_ante_core_bloc_event_rsvp(text, text, text, text) from public;
revoke execute on function public.set_ante_core_bloc_event_rsvp(text, text, text, text) from anon;
revoke execute on function public.set_ante_core_bloc_event_rsvp(text, text, text, text) from authenticated;
grant execute on function public.set_ante_core_bloc_event_rsvp(text, text, text, text) to service_role;

revoke execute on function public.toggle_ante_core_bloc_message_reaction(text, text, text, text, boolean) from public;
revoke execute on function public.toggle_ante_core_bloc_message_reaction(text, text, text, text, boolean) from anon;
revoke execute on function public.toggle_ante_core_bloc_message_reaction(text, text, text, text, boolean) from authenticated;
grant execute on function public.toggle_ante_core_bloc_message_reaction(text, text, text, text, boolean) to service_role;

revoke execute on function public.mark_ante_core_bloc_stream_read(text, text) from public;
revoke execute on function public.mark_ante_core_bloc_stream_read(text, text) from anon;
revoke execute on function public.mark_ante_core_bloc_stream_read(text, text) from authenticated;
grant execute on function public.mark_ante_core_bloc_stream_read(text, text) to service_role;

revoke execute on function public.insert_ante_core_bloc_system_moment(text, text, text, jsonb, text, timestamptz) from public;
revoke execute on function public.insert_ante_core_bloc_system_moment(text, text, text, jsonb, text, timestamptz) from anon;
revoke execute on function public.insert_ante_core_bloc_system_moment(text, text, text, jsonb, text, timestamptz) from authenticated;
grant execute on function public.insert_ante_core_bloc_system_moment(text, text, text, jsonb, text, timestamptz) to service_role;

revoke execute on function public.delete_ante_core_bloc_system_moment(text, text) from public;
revoke execute on function public.delete_ante_core_bloc_system_moment(text, text) from anon;
revoke execute on function public.delete_ante_core_bloc_system_moment(text, text) from authenticated;
grant execute on function public.delete_ante_core_bloc_system_moment(text, text) to service_role;

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
grant execute on function public.insert_ante_core_workout_log_comment(text, text, text, text) to service_role;

revoke execute on function public.toggle_ante_core_workout_log_comment_reaction(text, text, text, text, boolean) from public;
revoke execute on function public.toggle_ante_core_workout_log_comment_reaction(text, text, text, text, boolean) from anon;
revoke execute on function public.toggle_ante_core_workout_log_comment_reaction(text, text, text, text, boolean) from authenticated;
grant execute on function public.toggle_ante_core_workout_log_comment_reaction(text, text, text, text, boolean) to service_role;
