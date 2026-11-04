-- Scope the two expensive readers to the Blocs the member is actually in.
--
-- Measured on production 2026-10-25: read_ante_core_month_history takes 1.4s
-- and runs ~3,820 per-log subqueries (reactions and comment counts over 1,910
-- closed logs); read_ante_core_current_logs is another 0.6s. Together they are
-- 1.3 MB of a ~2.25 MB refresh and most of its time. Both run on EVERY refresh.
--
-- And the work is thrown away. scopeReadableStateForUser in api/lift-log.js
-- filters the response down to the Blocs the member belongs to AFTER all of it
-- has been read, so the server reads 17 Blocs to serve someone who is in one.
-- Scoping the read is behaviour-preserving: the client already never sees the
-- other sixteen.
--
-- This is Step 1 of docs/scaling-before-launch-2026-09-15.md, and item 4 of the
-- four App Store blockers in handover-2026-10-29-for-deveen-active.md §12 --
-- the only one that stops the stalls rather than making them legible. On
-- 14 September two to four phones took the database down; one global revision
-- clock means any action in any Bloc makes every open phone refresh, so load
-- grows with people-online x actions x total data, not with member count.
--
-- HOW IT STAYS BACKWARD COMPATIBLE
--
-- The parameter defaults to null, and null means "every Bloc" -- exactly
-- today's behaviour. The rollover path calls these with no member context and
-- must keep seeing everything, so it passes nothing and is unaffected.
--
-- Postgres treats a different signature as a different function, and leaving
-- the old zero-argument version in place would make an unqualified call
-- ambiguous. So each is dropped and recreated in the same transaction: atomic,
-- invisible to other sessions until commit.
--
-- BEFORE APPLYING, PLEASE CHECK
--
-- These bodies were taken from the newest definition in supabase/migrations
-- (20260916090000 for month_history, 20261016150000 for current_logs) and
-- transformed programmatically -- only the signature and the filter differ, so
-- nothing is retyped and no column can be silently dropped. That is the trap
-- named in handover-2026-09-14 §8.4. But the repo is not production: please
-- diff each against `pg_get_functiondef` on production first, and if they
-- differ, say so rather than applying. The filter to carry across is one line:
--
--   and (p_legacy_group_keys is null or b.legacy_group_key = any(p_legacy_group_keys))
--
-- ROLLBACK
--
-- Re-apply the previous definitions from the two migrations named above. The
-- API tolerates either shape -- see fetchAnteMonthHistory in api/lift-log.js,
-- which falls back to an unscoped call if the scoped one is not deployed -- so
-- code and database can be rolled back independently, in either order.

-- ---------------------------------------------------------------------------
-- 1. month_history -- 1.0 MB and ~3,820 subqueries per call
-- ---------------------------------------------------------------------------

drop function if exists public.read_ante_core_month_history();

create or replace function public.read_ante_core_month_history(p_legacy_group_keys text[] default null)
returns jsonb
language plpgsql
security definer
set search_path to 'ante_core', 'public'
as $function$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'legacy_group_key',       season_row.legacy_group_key,
        'month_key',              season_row.month_key,
        'label',                  season_row.label,
        'year',                   season_row.year,
        'month_index',            season_row.month_index,
        'min_target',             season_row.min_target,
        'fine_amount',            season_row.fine_amount,
        'fee_model',              season_row.fee_model,
        'escalation_step_amount', season_row.escalation_step_amount,
        'currency',               season_row.currency,
        'min_run_distance',       season_row.min_run_distance,
        'distance_unit',          season_row.distance_unit,
        'strava_enabled',         season_row.strava_enabled,
        'time_zone',              season_row.time_zone,
        'accepted_workout_types', season_row.accepted_workout_types,
        'members',                season_row.members,
        'logs',                   season_row.logs
      )
      order by season_row.month_key
    ),
    '[]'::jsonb
  )
  into result
  from (
    select
      b.legacy_group_key,
      s.month_key,
      s.label,
      s.year,
      s.month_index,
      s.min_target,
      s.fine_amount,
      s.fee_model::text as fee_model,
      s.escalation_step_amount,
      s.currency,
      s.min_run_distance,
      s.distance_unit,
      s.strava_enabled,
      s.time_zone,
      s.accepted_workout_types,
      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'display_name',          sms.display_name_snapshot,
              'auth_user_id',          case when p.auth_user_id is null then null else p.auth_user_id::text end,
              'workout_count',         sms.workout_count,
              'excused',               sms.excused,
              'solo',                  sms.solo,
              'solo_target',           sms.solo_target,
              'training_wheels',       sms.training_wheels,
              'joined_for_month',      sms.joined_for_month,
              'settlement_status',     sms.settlement_status,
              'settlement_settled_at', case when sms.settlement_settled_at is null then null else to_char(sms.settlement_settled_at, 'YYYY-MM-DD') end,
              'settlement_updated_at', case when sms.settlement_updated_at is null then null else to_char(sms.settlement_updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
            )
            order by sms.display_name_snapshot
          ),
          '[]'::jsonb
        )
        from ante_core.season_member_status sms
        left join ante_core.profiles p on p.id = sms.profile_id
        where sms.season_id = s.id
      ) as members,
      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id',                 wl.id,
              'owner_display_name', wl.owner_display_name,
              'workout_date',       to_char(wl.workout_date, 'YYYY-MM-DD'),
              'workout_type',       wl.workout_type,
              'activity',           wl.activity,
              'note',               wl.note,
              'photo_url',          wl.photo_url,
              'created_at',         to_char(wl.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
              'verified_via',       wl.verified_via,
              'flag_status',        wl.flag_status,
              'flag_reason',        wl.flag_reason,
              'flag_response',      wl.flag_response,
              'flagged_by',         wl.flagged_by,
              'decision_by',        wl.decision_by,
              'decision_at',        case when wl.decision_at is null then null else to_char(wl.decision_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
              'reactions',          coalesce(
                                      (
                                        select jsonb_object_agg(r2.emoji, r2.reactor_names)
                                        from (
                                          select
                                            r.emoji,
                                            jsonb_agg(r.reactor_display_name order by r.created_at) as reactor_names
                                          from ante_core.workout_reactions r
                                          where r.workout_log_id = wl.id
                                          group by r.emoji
                                        ) r2
                                      ),
                                      '{}'::jsonb
                                    )
            )
            order by wl.created_at asc
          ),
          '[]'::jsonb
        )
        from ante_core.workout_logs wl
        where wl.season_id = s.id
      ) as logs
    from ante_core.seasons s
    join ante_core.blocs b on b.id = s.bloc_id
    where s.status = 'closed'
      and b.legacy_group_key is not null
      and (p_legacy_group_keys is null or b.legacy_group_key = any(p_legacy_group_keys))
  ) as season_row;

  return result;
end;
$function$;

revoke all on function public.read_ante_core_month_history(text[]) from public;
revoke all on function public.read_ante_core_month_history(text[]) from anon;
revoke all on function public.read_ante_core_month_history(text[]) from authenticated;
grant execute on function public.read_ante_core_month_history(text[]) to service_role;

-- ---------------------------------------------------------------------------
-- 2. current_logs -- 304 KB per call
-- ---------------------------------------------------------------------------

drop function if exists public.read_ante_core_current_logs();

create or replace function public.read_ante_core_current_logs(p_legacy_group_keys text[] default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'ante_core', 'public'
as $function$
declare
  result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'legacy_group_key', b.legacy_group_key, 'id', wl.id,
    'owner_display_name', wl.owner_display_name,
    'workout_date', to_char(wl.workout_date, 'YYYY-MM-DD'),
    'workout_type', wl.workout_type, 'activity', wl.activity,
    'note', wl.note, 'photo_url', wl.photo_url,
    'created_at', to_char(wl.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'verified_via', wl.verified_via, 'flag_status', wl.flag_status,
    'flag_reason', wl.flag_reason, 'flag_response', wl.flag_response,
    'flagged_by', wl.flagged_by, 'decision_by', wl.decision_by,
    'decision_at', case when wl.decision_at is null then null else to_char(wl.decision_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'reactions', coalesce((
      select jsonb_object_agg(r2.emoji, r2.reactor_names)
      from (
        select r.emoji, jsonb_agg(r.reactor_display_name order by r.created_at) as reactor_names
        from ante_core.workout_reactions r where r.workout_log_id = wl.id group by r.emoji
      ) r2
    ), '{}'::jsonb),
    -- The single most recently added reaction. Ties break on emoji so the
    -- answer is the same every read rather than whichever row came back first.
    'latest_reaction', (
      select jsonb_build_object(
        'emoji', lr.emoji,
        'at', to_char(lr.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
      from ante_core.workout_reactions lr
      where lr.workout_log_id = wl.id
      order by lr.created_at desc, lr.emoji asc
      limit 1
    ),
    'comment_count', (select count(*)::integer from ante_core.workout_log_comments c where c.workout_log_id = wl.id and c.moderation_hidden_at is null)
  ) order by wl.created_at asc), '[]'::jsonb)
  into result
  from ante_core.workout_logs wl
  join ante_core.seasons s on s.id = wl.season_id
  join ante_core.blocs b on b.id = wl.bloc_id
  where s.status = 'open' and b.legacy_group_key is not null and wl.moderation_hidden_at is null
    and (p_legacy_group_keys is null or b.legacy_group_key = any(p_legacy_group_keys));
  return result;
end;
$function$;

revoke all on function public.read_ante_core_current_logs(text[]) from public;
revoke all on function public.read_ante_core_current_logs(text[]) from anon;
revoke all on function public.read_ante_core_current_logs(text[]) from authenticated;
grant execute on function public.read_ante_core_current_logs(text[]) to service_role;


-- ---------------------------------------------------------------------------
-- 3. Which Blocs is this member in?
-- ---------------------------------------------------------------------------
-- One indexed lookup, so the GET path can resolve the member's Blocs before
-- firing the readers. Returns legacy_group_key because that is what the blob
-- and both readers above are keyed by.
--
-- Active membership only: left_at is null. A member who has left should not
-- pull that Bloc's history back into their refresh.

create or replace function public.read_ante_core_member_bloc_keys(p_auth_user_id uuid)
returns jsonb
language sql
security definer
set search_path to 'ante_core', 'public'
as $function$
  select coalesce(jsonb_agg(distinct b.legacy_group_key), '[]'::jsonb)
  from ante_core.bloc_members bm
  join ante_core.profiles p on p.id = bm.profile_id
  join ante_core.blocs b on b.id = bm.bloc_id
  where p.auth_user_id = p_auth_user_id
    and bm.left_at is null
    and b.legacy_group_key is not null;
$function$;

revoke all on function public.read_ante_core_member_bloc_keys(uuid) from public;
revoke all on function public.read_ante_core_member_bloc_keys(uuid) from anon;
revoke all on function public.read_ante_core_member_bloc_keys(uuid) from authenticated;
grant execute on function public.read_ante_core_member_bloc_keys(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Verification -- run after applying
-- ---------------------------------------------------------------------------
-- Unscoped must be unchanged, scoped must be a strict subset, and the member
-- lookup must agree with what the app shows that member.
--
--   select jsonb_array_length(public.read_ante_core_month_history())        as all_seasons;
--   select jsonb_array_length(public.read_ante_core_month_history(array['<one-bloc-key>'])) as one_bloc;
--   select public.read_ante_core_member_bloc_keys('<an-auth-user-id>'::uuid);
--
-- And the saving, which is the point:
--
--   explain analyze select public.read_ante_core_month_history();
--   explain analyze select public.read_ante_core_month_history(array['<one-bloc-key>']);
