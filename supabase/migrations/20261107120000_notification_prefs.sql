-- Per-type notification preferences: which kinds of push a member wants.
--
-- WHY THIS EXISTS
--
-- Push can send twelve different kinds of thing (see
-- docs/push-notification-design-2026-11-06.md section 2). Without a per-type
-- switch the only "off" available is Apple's, which kills every Fero
-- notification at once and is one-shot -- so one notification someone finds
-- annoying costs Fero all of them. The order-of-operations doc has required
-- this since the design was written.
--
-- FIVE SWITCHES, NOT TWELVE
--
-- The founder approved five, grouped by what a notification feels like to
-- receive rather than by how it is built. Twelve rows of toggles is a settings
-- screen nobody reads. The grouping, and the one case it cannot express
-- (comments but not reactions), are recorded in
-- docs/handover-2026-11-07-notification-switches.md section 3.
--
--   training_nudges     types 1, 6, 9   - "go and train"
--   reactions_comments  types 2, 3, 4   - reaction, comment, thread reply
--   mentions            type  5         - named by someone in the Stream
--   month_close         types 7, 8, 12  - the month closing, money, a perfect month
--   requests            types 10, 11    - sit-out / Solo asked, and answered
--
-- NO ROW MEANS ALL ON, AND THAT IS THE NORMAL CASE
--
-- Nobody has a row until they turn something off. The reader returns all-true
-- for a member with no row, so "empty" is an answer and never an error -- the
-- standing rule in AGENTS.md section 6. That also makes the default correct
-- without a backfill: a member who has just allowed notifications said yes
-- once, and should not have to say it five more times.
--
-- QUIET HOURS ARE NOT HERE, DELIBERATELY
--
-- 23:30 to 06:00 in the member's own time zone is a rule for everyone, settled
-- by the founder on 7 November. It is not a per-member setting and nobody
-- asked for one, so it stays a constant in the sender rather than becoming
-- two columns that imply it is configurable.
--
-- THESE SWITCH PUSH ONLY
--
-- The "For you" centre is computed in the client from state the app already
-- holds (design section 6), so it cannot be switched off from here and is not
-- meant to be. Turning a switch off stops the phone buzzing; it does not hide
-- anything inside the app.
--
-- ROLLBACK (three statements, no other data touched)
--
--   drop function if exists public.set_ante_core_notification_prefs(uuid, jsonb);
--   drop function if exists public.read_ante_core_notification_prefs(uuid);
--   drop table if exists ante_core.notification_prefs;

create table if not exists ante_core.notification_prefs (
  profile_id         uuid primary key references ante_core.profiles(id) on delete cascade,
  training_nudges    boolean not null default true,
  reactions_comments boolean not null default true,
  mentions           boolean not null default true,
  month_close        boolean not null default true,
  requests           boolean not null default true,
  updated_at         timestamptz not null default now()
);

comment on table ante_core.notification_prefs is
  'One row per member who has changed a notification switch. No row means '
  'every type is on, which is the default and the common case.';

-- Reading: always answers, row or no row.
create or replace function public.read_ante_core_notification_prefs(
  p_auth_user_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ante_core, public
as $$
  select jsonb_build_object(
    'trainingNudges',     coalesce(np.training_nudges,    true),
    'reactionsComments',  coalesce(np.reactions_comments, true),
    'mentions',           coalesce(np.mentions,           true),
    'monthClose',         coalesce(np.month_close,        true),
    'requests',           coalesce(np.requests,           true)
  )
  from ante_core.profiles p
  left join ante_core.notification_prefs np on np.profile_id = p.id
  where p.auth_user_id = p_auth_user_id;
$$;

-- Writing: only the keys actually present in p_prefs change. A key that is
-- missing, null, or not a JSON boolean is ignored rather than treated as
-- false -- a client sending a partial object must never silently switch
-- something off it did not mention.
create or replace function public.set_ante_core_notification_prefs(
  p_auth_user_id uuid,
  p_prefs        jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_profile_id uuid;
  v_training   boolean := case when jsonb_typeof(p_prefs->'trainingNudges')    = 'boolean' then (p_prefs->>'trainingNudges')::boolean    end;
  v_reactions  boolean := case when jsonb_typeof(p_prefs->'reactionsComments') = 'boolean' then (p_prefs->>'reactionsComments')::boolean end;
  v_mentions   boolean := case when jsonb_typeof(p_prefs->'mentions')          = 'boolean' then (p_prefs->>'mentions')::boolean          end;
  v_month      boolean := case when jsonb_typeof(p_prefs->'monthClose')        = 'boolean' then (p_prefs->>'monthClose')::boolean        end;
  v_requests   boolean := case when jsonb_typeof(p_prefs->'requests')          = 'boolean' then (p_prefs->>'requests')::boolean          end;
begin
  if p_auth_user_id is null then
    return null;
  end if;

  select id into v_profile_id
    from ante_core.profiles
   where auth_user_id = p_auth_user_id;

  if v_profile_id is null then
    return null;
  end if;

  insert into ante_core.notification_prefs as np (
    profile_id, training_nudges, reactions_comments, mentions, month_close, requests
  )
  values (
    v_profile_id,
    coalesce(v_training,  true),
    coalesce(v_reactions, true),
    coalesce(v_mentions,  true),
    coalesce(v_month,     true),
    coalesce(v_requests,  true)
  )
  on conflict (profile_id) do update set
    training_nudges    = coalesce(v_training,  np.training_nudges),
    reactions_comments = coalesce(v_reactions, np.reactions_comments),
    mentions           = coalesce(v_mentions,  np.mentions),
    month_close        = coalesce(v_month,     np.month_close),
    requests           = coalesce(v_requests,  np.requests),
    updated_at         = now();

  return public.read_ante_core_notification_prefs(p_auth_user_id);
end;
$$;

revoke execute on function public.read_ante_core_notification_prefs(uuid)        from public, anon, authenticated;
revoke execute on function public.set_ante_core_notification_prefs(uuid, jsonb)  from public, anon, authenticated;
grant  execute on function public.read_ante_core_notification_prefs(uuid)        to service_role;
grant  execute on function public.set_ante_core_notification_prefs(uuid, jsonb)  to service_role;
