-- Your own comment must not raise your own Stream badge (29 October 2026).
--
-- THE BUG, in the founder's words: "when I comment on either my own workout or
-- somebody else's workout, I get a notification in the Bloc Stream."
--
-- WHY IT HAPPENS. insert_ante_core_workout_log_comment writes a `log_comment`
-- row into ante_core.bloc_messages so the thread shows up in the Stream. That
-- row is a system moment: author_profile_id is NULL. All 187 of them are.
-- Both unread rules count a message when
--     (author_profile_id is null or author_profile_id <> me)
-- so a null author counts for EVERYONE - including the person who just wrote
-- the comment that created it.
--
-- THE FIX. One extra clause, in both functions, excluding a `log_comment` row
-- whose newest comment is the reader's own. There is exactly one such row per
-- workout log (the insert deletes and re-inserts by idempotency_key), so the
-- row always represents the NEWEST comment on that log. That makes the rule
-- read correctly in both directions:
--   * I comment     -> the row is mine     -> not unread for me, unread for them
--   * they reply    -> the row becomes theirs -> unread for me again
--
-- WHY NOT set author_profile_id on the row instead, which would need no change
-- here at all: BlocStream.jsx filters the whole Stream by author against the
-- blocked list (line 705) and decides `mine` from it (line 751). Setting the
-- author would silently hide a whole thread from anyone who had blocked its
-- most recent commenter, and change which rows offer a report action. Neither
-- was asked for. The payload already carries commenterUserId on every row, so
-- this clause needs no new column and no backfill.
--
-- BOTH functions change together, deliberately. The 19 October file states the
-- two rules are byte-for-byte identical so they cannot disagree; that property
-- is preserved here.
--
-- NOT CHANGED: `system` moments (165 rows) also carry a null author, so logging
-- a workout still raises your own badge the same way. The founder asked about
-- comments specifically and that is all this touches. Worth raising separately.
--
-- Rollback: re-run this file with the two `and not (...)` clauses removed.

CREATE OR REPLACE FUNCTION public.read_ante_core_bloc_stream_unread_count(p_legacy_group_key text, p_auth_user_id text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ante_core', 'public'
AS $function$
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
      and not (
        m.message_type = 'log_comment'
        and m.payload->'latestComment'->>'commenterUserId' = trim(p_auth_user_id)
      )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.read_ante_core_notification_counts(p_legacy_group_key text, p_auth_user_id text, p_since text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ante_core', 'public'
AS $function$
declare
  v_bloc_id uuid;
  v_profile_id uuid;
  v_last_read_at timestamptz;
  v_since timestamptz;
  v_stream_unread integer := 0;
  v_mentions integer := 0;
  v_log_comments integer := 0;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    return jsonb_build_object('streamUnread', 0, 'mentions', 0, 'logComments', 0);
  end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then
    return jsonb_build_object('streamUnread', 0, 'mentions', 0, 'logComments', 0);
  end if;

  select b.id into v_bloc_id
  from ante_core.blocs b
  where b.legacy_group_key = trim(p_legacy_group_key);

  select p.id into v_profile_id
  from ante_core.profiles p
  where p.auth_user_id = trim(p_auth_user_id)::uuid;

  if v_bloc_id is null or v_profile_id is null then
    return jsonb_build_object('streamUnread', 0, 'mentions', 0, 'logComments', 0);
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

  begin
    v_since := nullif(trim(coalesce(p_since, '')), '')::timestamptz;
  exception when others then
    v_since := null;
  end;

  select r.last_read_at into v_last_read_at
  from ante_core.bloc_message_reads r
  where r.bloc_id = v_bloc_id
    and r.profile_id = v_profile_id;

  select count(*)::integer into v_stream_unread
  from ante_core.bloc_messages m
  where m.bloc_id = v_bloc_id
    and m.created_at > coalesce(v_last_read_at, '-infinity'::timestamptz)
    and (m.author_profile_id is null or m.author_profile_id <> v_profile_id)
    and not (
      m.message_type = 'log_comment'
      and m.payload->'latestComment'->>'commenterUserId' = trim(p_auth_user_id)
    );

  select count(*)::integer into v_mentions
  from ante_core.bloc_messages m
  where m.bloc_id = v_bloc_id
    and m.created_at > coalesce(v_since, '-infinity'::timestamptz)
    and (m.author_profile_id is null or m.author_profile_id <> v_profile_id)
    and v_profile_id = any(m.mentions);

  select count(*)::integer into v_log_comments
  from ante_core.workout_log_comments c
  join ante_core.workout_logs wl on wl.id = c.workout_log_id
  where wl.bloc_id = v_bloc_id
    and wl.profile_id = v_profile_id
    and wl.moderation_hidden_at is null
    and c.moderation_hidden_at is null
    and c.commenter_profile_id is distinct from v_profile_id
    and c.created_at > coalesce(v_since, '-infinity'::timestamptz);

  return jsonb_build_object(
    'streamUnread', v_stream_unread,
    'mentions', v_mentions,
    'logComments', v_log_comments
  );
end;
$function$;

-- `create or replace` preserves the existing ACL, so these are restated rather
-- than required. Both are server-side only: the API calls them with the
-- service key and does its own auth first.
revoke execute on function public.read_ante_core_bloc_stream_unread_count(text, text) from public;
revoke execute on function public.read_ante_core_bloc_stream_unread_count(text, text) from anon;
revoke execute on function public.read_ante_core_bloc_stream_unread_count(text, text) from authenticated;
grant execute on function public.read_ante_core_bloc_stream_unread_count(text, text) to service_role;

revoke execute on function public.read_ante_core_notification_counts(text, text, text) from public;
revoke execute on function public.read_ante_core_notification_counts(text, text, text) from anon;
revoke execute on function public.read_ante_core_notification_counts(text, text, text) from authenticated;
grant execute on function public.read_ante_core_notification_counts(text, text, text) to service_role;
