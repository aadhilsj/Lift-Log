-- Comments reach the people in the conversation, not only the log's owner
-- (29 October 2026).
--
-- THE ASK, in the founder's words: "if I've commented on somebody's log and
-- somebody else or even the owner of that log responds, I should get a
-- notification in the For You Centre because I am involved in that thread...
-- it's kind of like in Slack, when you're a part of a thread."
--
-- TODAY. `logComments` counts comments by other people on logs YOU OWN, and
-- the For You rows are built in the client from `group.logs[currentUser]` -
-- your own workouts only (notificationCentre.js, ownLogItems). So a reply to
-- you on someone else's workout is invisible in For You. It reaches the Bloc
-- Stream and nowhere else.
--
-- TWO CHANGES HERE.
--
-- 1. read_ante_core_notification_counts: `logComments` now counts a comment by
--    someone else when EITHER the log is yours OR you have commented on it.
--    It stays a single count over comments, so a log you own and also replied
--    on is counted once, not twice. Your own comments are still excluded, and
--    both moderation filters are unchanged.
--
-- 2. read_ante_core_workout_log_threads - NEW. Returns the threads you are in
--    but do not own, keyed by workout log id, with everything a For You row
--    needs: who wrote the newest comment that is not yours, what it said, how
--    many such comments there are, and the log's own display fields so the row
--    can render without the client holding that log.
--
-- Deliberately NOT changed: read_ante_core_workout_log_latest_comments. It is
-- asked about specific log ids and is used for your own logs; leaving it alone
-- keeps that path byte-identical and makes this rollback a drop plus one
-- replace.
--
-- Rollback:
--   drop function public.read_ante_core_workout_log_threads(text, text);
--   -- and re-run 20261029120000, which has the previous counts function.

create or replace function public.read_ante_core_workout_log_threads(
  p_legacy_group_key text,
  p_auth_user_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'ante_core', 'public'
as $function$
declare
  v_bloc_id uuid;
  v_profile_id uuid;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then return '{}'::jsonb; end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then return '{}'::jsonb; end if;

  select b.id into v_bloc_id from ante_core.blocs b where b.legacy_group_key = trim(p_legacy_group_key);
  select p.id into v_profile_id from ante_core.profiles p where p.auth_user_id = trim(p_auth_user_id)::uuid;
  if v_bloc_id is null or v_profile_id is null then return '{}'::jsonb; end if;

  -- Same membership check, same error code, as every other reader here.
  if not exists (
    select 1 from ante_core.bloc_members bm
    where bm.bloc_id = v_bloc_id and bm.profile_id = v_profile_id and bm.left_at is null
  ) then
    raise exception 'not a bloc member' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_object_agg(latest.workout_log_id, jsonb_build_object(
      'ownerName', latest.owner_display_name,
      'ownerUserId', latest.owner_auth_user_id,
      'workoutDate', latest.workout_date,
      'workoutType', latest.workout_type,
      'activity', latest.activity,
      'photoUrl', latest.photo_url,
      'commenterName', latest.commenter_display_name,
      'commenterUserId', latest.commenter_auth_user_id,
      'body', latest.body,
      'createdAt', latest.created_at,
      'total', latest.total
    ))
    from (
      select distinct on (c.workout_log_id)
        c.workout_log_id,
        wl.owner_display_name,
        owner.auth_user_id::text as owner_auth_user_id,
        to_char(wl.workout_date, 'YYYY-MM-DD') as workout_date,
        wl.workout_type,
        wl.activity,
        wl.photo_url,
        c.commenter_display_name,
        commenter.auth_user_id::text as commenter_auth_user_id,
        c.body,
        c.created_at,
        count(*) over (partition by c.workout_log_id)::integer as total
      from ante_core.workout_log_comments c
      join ante_core.workout_logs wl on wl.id = c.workout_log_id
      left join ante_core.profiles commenter on commenter.id = c.commenter_profile_id
      left join ante_core.profiles owner on owner.id = wl.profile_id
      where wl.bloc_id = v_bloc_id
        and wl.moderation_hidden_at is null
        and c.moderation_hidden_at is null
        -- Not your own workout: those rows already come from ownLogItems, and
        -- showing both would double every conversation on your own log.
        and wl.profile_id is distinct from v_profile_id
        -- Somebody else's comment, same rule as the sibling reader.
        and c.commenter_profile_id is distinct from v_profile_id
        -- ...on a thread you have spoken in. This is the whole point.
        and exists (
          select 1
          from ante_core.workout_log_comments mine
          where mine.workout_log_id = c.workout_log_id
            and mine.commenter_profile_id = v_profile_id
            and mine.moderation_hidden_at is null
        )
      order by c.workout_log_id, c.created_at desc, c.id desc
    ) latest
  ), '{}'::jsonb);
end;
$function$;

revoke execute on function public.read_ante_core_workout_log_threads(text, text) from public;
revoke execute on function public.read_ante_core_workout_log_threads(text, text) from anon;
revoke execute on function public.read_ante_core_workout_log_threads(text, text) from authenticated;
grant execute on function public.read_ante_core_workout_log_threads(text, text) to service_role;

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
    and wl.moderation_hidden_at is null
    and c.moderation_hidden_at is null
    and c.commenter_profile_id is distinct from v_profile_id
    and c.created_at > coalesce(v_since, '-infinity'::timestamptz)
    -- 29 October: a thread you are IN is news too, not only your own log.
    -- Slack's rule - once you have spoken in a thread, later replies reach
    -- you. One count over comments, so a log you own AND commented on is
    -- still counted once.
    and (
      wl.profile_id = v_profile_id
      or exists (
        select 1
        from ante_core.workout_log_comments mine
        where mine.workout_log_id = c.workout_log_id
          and mine.commenter_profile_id = v_profile_id
          and mine.moderation_hidden_at is null
      )
    );

  return jsonb_build_object(
    'streamUnread', v_stream_unread,
    'mentions', v_mentions,
    'logComments', v_log_comments
  );
end;
$function$;
