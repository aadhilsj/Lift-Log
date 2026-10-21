-- Founder moderation actions are reversible: content is hidden from normal
-- readers, never deleted. The audit table retains who acted and when.

alter table ante_core.bloc_messages
  add column if not exists moderation_hidden_at timestamptz,
  add column if not exists moderation_hidden_by_profile_id uuid references ante_core.profiles(id) on delete set null;

alter table ante_core.workout_log_comments
  add column if not exists moderation_hidden_at timestamptz,
  add column if not exists moderation_hidden_by_profile_id uuid references ante_core.profiles(id) on delete set null;

create table if not exists ante_core.content_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references ante_core.content_reports(id) on delete set null,
  content_type text not null check (content_type in ('stream_message', 'workout_comment')),
  content_id text not null check (nullif(trim(content_id), '') is not null),
  action text not null check (action in ('hide', 'restore')),
  actor_profile_id uuid references ante_core.profiles(id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists ante_core_content_moderation_actions_content_idx
  on ante_core.content_moderation_actions (content_type, content_id, created_at desc);

alter table ante_core.content_moderation_actions enable row level security;
revoke all on table ante_core.content_moderation_actions from public, anon, authenticated;

-- Keep the Stream reader's pagination honest: filter first, then select the
-- newest visible messages, so hidden messages do not create an apparent gap.
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
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then return '[]'::jsonb; end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then return '[]'::jsonb; end if;

  select b.id into v_bloc_id from ante_core.blocs b where b.legacy_group_key = trim(p_legacy_group_key);
  select p.id into v_profile_id from ante_core.profiles p where p.auth_user_id = trim(p_auth_user_id)::uuid;
  if v_bloc_id is null or v_profile_id is null then return '[]'::jsonb; end if;

  if not exists (
    select 1 from ante_core.bloc_members bm
    where bm.bloc_id = v_bloc_id and bm.profile_id = v_profile_id and bm.left_at is null
  ) then
    raise exception 'not a bloc member' using errcode = '42501';
  end if;

  return coalesce((
    with selected_messages as (
      select m.* from ante_core.bloc_messages m
      where m.bloc_id = v_bloc_id and m.moderation_hidden_at is null
      order by m.created_at desc, m.id desc limit v_limit
    ), ordered_messages as (
      select * from selected_messages order by created_at asc, id asc
    ), reaction_rows as (
      select r.message_id, r.emoji,
        jsonb_agg(p.auth_user_id::text order by r.created_at asc, p.auth_user_id::text) as user_ids
      from ante_core.bloc_message_reactions r
      join ante_core.profiles p on p.id = r.reactor_profile_id
      where r.message_id in (select id from selected_messages)
      group by r.message_id, r.emoji
    ), reactions_by_message as (
      select message_id, jsonb_object_agg(emoji, user_ids order by emoji) as reactions
      from reaction_rows group by message_id
    )
    select jsonb_agg(jsonb_build_object(
      'id', m.id::text, 'bloc_id', p_legacy_group_key,
      'author_id', author_profile.auth_user_id::text, 'message_type', m.message_type,
      'body', coalesce(m.body, ''), 'system_kind', coalesce(m.system_kind, ''),
      'payload', coalesce(m.payload, '{}'::jsonb), 'reply_to', m.reply_to::text,
      'mentions', coalesce((
        select jsonb_agg(mp.auth_user_id::text order by mp.auth_user_id::text)
        from unnest(m.mentions) mention_profile_id join ante_core.profiles mp on mp.id = mention_profile_id
      ), '[]'::jsonb),
      'reactions', coalesce(rbm.reactions, '{}'::jsonb), 'created_at', m.created_at
    ) order by m.created_at asc, m.id asc)
    from ordered_messages m
    left join ante_core.profiles author_profile on author_profile.id = m.author_profile_id
    left join reactions_by_message rbm on rbm.message_id = m.id
  ), '[]'::jsonb);
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
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then return '[]'::jsonb; end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then return '[]'::jsonb; end if;
  if v_workout_log_id = '' then return '[]'::jsonb; end if;

  select b.id into v_bloc_id from ante_core.blocs b where b.legacy_group_key = trim(p_legacy_group_key);
  select p.id into v_profile_id from ante_core.profiles p where p.auth_user_id = trim(p_auth_user_id)::uuid;
  if v_bloc_id is null or v_profile_id is null then return '[]'::jsonb; end if;
  if not exists (select 1 from ante_core.bloc_members bm where bm.bloc_id = v_bloc_id and bm.profile_id = v_profile_id and bm.left_at is null) then
    raise exception 'not a bloc member' using errcode = '42501';
  end if;
  if not exists (select 1 from ante_core.workout_logs wl where wl.id = v_workout_log_id and wl.bloc_id = v_bloc_id) then return '[]'::jsonb; end if;

  return coalesce((
    with reaction_rows as (
      select r.comment_id, r.emoji, jsonb_agg(p.auth_user_id::text order by r.created_at asc, p.auth_user_id::text) as user_ids
      from ante_core.workout_log_comment_reactions r
      join ante_core.profiles p on p.id = r.reactor_profile_id
      join ante_core.workout_log_comments c on c.id = r.comment_id
      where c.workout_log_id = v_workout_log_id and c.moderation_hidden_at is null
      group by r.comment_id, r.emoji
    ), reactions_by_comment as (
      select comment_id, jsonb_object_agg(emoji, user_ids order by emoji) as reactions from reaction_rows group by comment_id
    )
    select jsonb_agg(jsonb_build_object(
      'id', c.id::text, 'logId', c.workout_log_id,
      'commenterUserId', commenter.auth_user_id::text,
      'commenterName', c.commenter_display_name, 'body', c.body,
      'reactions', coalesce(rbc.reactions, '{}'::jsonb), 'createdAt', c.created_at
    ) order by c.created_at asc, c.id asc)
    from ante_core.workout_log_comments c
    left join ante_core.profiles commenter on commenter.id = c.commenter_profile_id
    left join reactions_by_comment rbc on rbc.comment_id = c.id
    where c.workout_log_id = v_workout_log_id and c.moderation_hidden_at is null
  ), '[]'::jsonb);
end;
$$;

create or replace function public.read_ante_core_content_reports(p_limit integer default 100)
returns jsonb
language sql
security definer
set search_path = ante_core, public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id::text, 'status', r.status, 'contentType', r.content_type,
    'contentId', r.content_id, 'reason', r.reason, 'details', r.details,
    'createdAt', r.created_at, 'reviewedAt', r.reviewed_at, 'reviewNote', r.review_note,
    'reporterName', coalesce(reporter.display_name, 'Deleted account'),
    'reportedName', coalesce(reported.display_name, 'Deleted account'),
    'blocName', coalesce(b.name, 'Deleted Bloc'), 'reviewedByName', reviewer.display_name,
    'moderationHidden', case r.content_type
      when 'stream_message' then exists (select 1 from ante_core.bloc_messages m where m.id::text = r.content_id and m.moderation_hidden_at is not null)
      when 'workout_comment' then exists (select 1 from ante_core.workout_log_comments c where c.id::text = r.content_id and c.moderation_hidden_at is not null)
      else false
    end
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

create or replace function public.moderate_ante_core_report_content(
  p_report_id uuid,
  p_action text,
  p_reviewer_auth_user_id text,
  p_review_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_report ante_core.content_reports%rowtype;
  v_reviewer_profile_id uuid;
  v_action text := trim(coalesce(p_action, ''));
  v_note text := left(trim(coalesce(p_review_note, '')), 1000);
  v_updated_id uuid;
begin
  if p_report_id is null or v_action not in ('hide', 'restore')
     or nullif(trim(coalesce(p_reviewer_auth_user_id, '')), '') is null then
    raise exception 'valid moderation details are required' using errcode = '22023';
  end if;

  select p.id into v_reviewer_profile_id from ante_core.profiles p
  where p.auth_user_id = trim(p_reviewer_auth_user_id)::uuid;
  if v_reviewer_profile_id is null then raise exception 'reviewer profile not found' using errcode = 'P0002'; end if;

  select * into v_report from ante_core.content_reports where id = p_report_id for update;
  if not found then raise exception 'report not found' using errcode = 'P0002'; end if;
  if v_report.bloc_id is null or v_report.content_type not in ('stream_message', 'workout_comment') then
    raise exception 'this report type cannot be hidden from the moderation queue' using errcode = '22023';
  end if;

  if v_report.content_type = 'stream_message' then
    update ante_core.bloc_messages
    set moderation_hidden_at = case when v_action = 'hide' then now() else null end,
        moderation_hidden_by_profile_id = case when v_action = 'hide' then v_reviewer_profile_id else null end
    where id::text = v_report.content_id and bloc_id = v_report.bloc_id
    returning id into v_updated_id;
  else
    update ante_core.workout_log_comments c
    set moderation_hidden_at = case when v_action = 'hide' then now() else null end,
        moderation_hidden_by_profile_id = case when v_action = 'hide' then v_reviewer_profile_id else null end
    from ante_core.workout_logs wl
    where c.id::text = v_report.content_id and c.workout_log_id = wl.id and wl.bloc_id = v_report.bloc_id
    returning c.id into v_updated_id;
  end if;
  if v_updated_id is null then raise exception 'reported content was not found in this Bloc' using errcode = 'P0002'; end if;

  update ante_core.content_reports
  set status = 'reviewed', reviewed_by_profile_id = v_reviewer_profile_id,
      review_note = v_note, reviewed_at = now()
  where id = p_report_id;

  insert into ante_core.content_moderation_actions (report_id, content_type, content_id, action, actor_profile_id, note)
  values (v_report.id, v_report.content_type, v_report.content_id, v_action, v_reviewer_profile_id, v_note);

  return jsonb_build_object('id', v_report.id::text, 'status', 'reviewed', 'moderationHidden', v_action = 'hide');
end;
$$;

revoke all on function public.read_ante_core_bloc_stream(text, text, integer) from public, anon, authenticated;
revoke all on function public.read_ante_core_workout_log_comments(text, text, text) from public, anon, authenticated;
revoke all on function public.read_ante_core_content_reports(integer) from public, anon, authenticated;
revoke all on function public.moderate_ante_core_report_content(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.read_ante_core_bloc_stream(text, text, integer) to service_role;
grant execute on function public.read_ante_core_workout_log_comments(text, text, text) to service_role;
grant execute on function public.read_ante_core_content_reports(integer) to service_role;
grant execute on function public.moderate_ante_core_report_content(uuid, text, text, text) to service_role;
