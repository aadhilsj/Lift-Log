-- What the bell should count, in one call.
--
-- The founder asked on 19 October 2026 whether the bell lights up for a
-- reaction, a comment and a Stream tag. It did not. A reaction was fixed on
-- the client (it already had the timestamp it needed). The other two could
-- not be: the data is not on the device until the centre is opened, so a
-- comment or a tag could never raise the badge beforehand.
--
-- The cheap way to fix that is this function. The app ALREADY calls
-- read_ante_core_bloc_stream_unread_count once per refresh, and that call
-- already resolves the bloc, the profile and the last-read marker. This
-- returns the same unread number plus two more from the rows it is already
-- positioned to scan, so the bell becomes correct at NO extra round trip.
-- That matters: docs/scaling-before-launch-2026-09-15.md is explicit that the
-- per-refresh read path has to get lighter, not heavier.
--
-- Read-only. Returns
--   { "streamUnread": int, "mentions": int, "logComments": int }
--
-- p_since is the client's "last opened the notification centre" time. Null or
-- unparseable means it has never been opened, and everything counts - which
-- is exactly what unreadCount does on the client when it has no seen time
-- (`if (!Number.isFinite(seenAt)) return true`).
--
-- Verified on production against real data: a member mentioned 5 times gets
-- mentions = 5 with p_since null, 0 with p_since in the future, and 5 again
-- with p_since = 'not a date' - the unparseable case deliberately behaving as
-- "never opened" rather than failing.
--
-- read_ante_core_bloc_stream_unread_count is deliberately left in place and
-- unchanged: it still drives the Stream icon, and leaving it is what makes
-- rolling this back a single drop statement.

create or replace function public.read_ante_core_notification_counts(
  p_legacy_group_key text,
  p_auth_user_id text,
  p_since text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'ante_core', 'public'
as $function$
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

  -- Same membership check, same error code, as every other reader here.
  if not exists (
    select 1
    from ante_core.bloc_members bm
    where bm.bloc_id = v_bloc_id
      and bm.profile_id = v_profile_id
      and bm.left_at is null
  ) then
    raise exception 'not a bloc member' using errcode = '42501';
  end if;

  -- A bad timestamp becomes null, and null then means "never opened", so
  -- everything counts. That is deliberate and matches the client: it is what
  -- unreadCount does with a seen time it cannot parse. The point of catching
  -- it here is that the function must not ERROR on a malformed value and take
  -- the Stream's unread count down with it.
  begin
    v_since := nullif(trim(coalesce(p_since, '')), '')::timestamptz;
  exception when others then
    v_since := null;
  end;

  select r.last_read_at into v_last_read_at
  from ante_core.bloc_message_reads r
  where r.bloc_id = v_bloc_id
    and r.profile_id = v_profile_id;

  -- 1. The Stream icon's number. Byte-for-byte the same rule as
  --    read_ante_core_bloc_stream_unread_count, so the two cannot disagree.
  select count(*)::integer into v_stream_unread
  from ante_core.bloc_messages m
  where m.bloc_id = v_bloc_id
    and m.created_at > coalesce(v_last_read_at, '-infinity'::timestamptz)
    and (m.author_profile_id is null or m.author_profile_id <> v_profile_id);

  -- 2. Being tagged. bloc_messages.mentions is a uuid[] of PROFILE ids - the
  --    client sees auth user ids only because the stream read converts them
  --    on the way out. Never your own message.
  select count(*)::integer into v_mentions
  from ante_core.bloc_messages m
  where m.bloc_id = v_bloc_id
    and m.created_at > coalesce(v_since, '-infinity'::timestamptz)
    and (m.author_profile_id is null or m.author_profile_id <> v_profile_id)
    and v_profile_id = any(m.mentions);

  -- 3. Comments by other people on YOUR OWN logs. Your own comment on your own
  --    log is not news to you - the same rule 16 October applied to the rows
  --    themselves, in 20261016090000_latest_comments_exclude_your_own.sql.
  --    Both moderation filters match the sibling readers.
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

-- Server-side only, like every other ante_core reader: the API calls it with
-- the service key and does its own auth first.
revoke execute on function public.read_ante_core_notification_counts(text, text, text) from public;
revoke execute on function public.read_ante_core_notification_counts(text, text, text) from anon;
revoke execute on function public.read_ante_core_notification_counts(text, text, text) from authenticated;
grant execute on function public.read_ante_core_notification_counts(text, text, text) to service_role;
