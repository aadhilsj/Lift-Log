-- Extend reversible founder moderation to workout posts. A hide only changes
-- what member-facing readers return; the workout and the complete audit trail
-- remain intact for a possible restoration.

alter table ante_core.workout_logs
  add column if not exists moderation_hidden_at timestamptz,
  add column if not exists moderation_hidden_by_profile_id uuid references ante_core.profiles(id) on delete set null;

alter table ante_core.content_moderation_actions
  drop constraint if exists content_moderation_actions_content_type_check;

alter table ante_core.content_moderation_actions
  add constraint content_moderation_actions_content_type_check
  check (content_type in ('stream_message', 'workout_comment', 'workout_log'));

-- The current-month log reader drives Today and Activity. Filter before
-- aggregation so hidden posts do not leave a blank card or stale comment count.
create or replace function public.read_ante_core_current_logs()
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
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
    'comment_count', (select count(*)::integer from ante_core.workout_log_comments c where c.workout_log_id = wl.id and c.moderation_hidden_at is null)
  ) order by wl.created_at asc), '[]'::jsonb)
  into result
  from ante_core.workout_logs wl
  join ante_core.seasons s on s.id = wl.season_id
  join ante_core.blocs b on b.id = wl.bloc_id
  where s.status = 'open' and b.legacy_group_key is not null and wl.moderation_hidden_at is null;
  return result;
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
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then return '{}'::jsonb; end if;
  if p_auth_user_id is null or trim(p_auth_user_id) = '' then return '{}'::jsonb; end if;
  select b.id into v_bloc_id from ante_core.blocs b where b.legacy_group_key = trim(p_legacy_group_key);
  select p.id into v_profile_id from ante_core.profiles p where p.auth_user_id = trim(p_auth_user_id)::uuid;
  if v_bloc_id is null or v_profile_id is null then return '{}'::jsonb; end if;
  if not exists (select 1 from ante_core.bloc_members bm where bm.bloc_id = v_bloc_id and bm.profile_id = v_profile_id and bm.left_at is null) then
    raise exception 'not a bloc member' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_object_agg(wl.id, coalesce(counts.comment_count, 0))
    from ante_core.workout_logs wl
    left join (
      select workout_log_id, count(*)::integer as comment_count
      from ante_core.workout_log_comments where moderation_hidden_at is null group by workout_log_id
    ) counts on counts.workout_log_id = wl.id
    where wl.bloc_id = v_bloc_id and wl.moderation_hidden_at is null
      and (coalesce(array_length(p_workout_log_ids, 1), 0) = 0 or wl.id = any(p_workout_log_ids))
  ), '{}'::jsonb);
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
      when 'workout_log' then exists (select 1 from ante_core.workout_logs wl where wl.id = r.content_id and wl.moderation_hidden_at is not null)
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
  v_updated_id text;
begin
  if p_report_id is null or v_action not in ('hide', 'restore')
     or nullif(trim(coalesce(p_reviewer_auth_user_id, '')), '') is null then
    raise exception 'valid moderation details are required' using errcode = '22023';
  end if;
  select p.id into v_reviewer_profile_id from ante_core.profiles p where p.auth_user_id = trim(p_reviewer_auth_user_id)::uuid;
  if v_reviewer_profile_id is null then raise exception 'reviewer profile not found' using errcode = 'P0002'; end if;
  select * into v_report from ante_core.content_reports where id = p_report_id for update;
  if not found then raise exception 'report not found' using errcode = 'P0002'; end if;
  if v_report.bloc_id is null or v_report.reported_profile_id is null or v_report.content_type not in ('stream_message', 'workout_comment', 'workout_log') then
    raise exception 'this report type cannot be hidden from the moderation queue' using errcode = '22023';
  end if;

  if v_report.content_type = 'stream_message' then
    update ante_core.bloc_messages
    set moderation_hidden_at = case when v_action = 'hide' then now() else null end,
        moderation_hidden_by_profile_id = case when v_action = 'hide' then v_reviewer_profile_id else null end
    where id::text = v_report.content_id and bloc_id = v_report.bloc_id and author_profile_id = v_report.reported_profile_id
    returning id::text into v_updated_id;
  elsif v_report.content_type = 'workout_comment' then
    update ante_core.workout_log_comments c
    set moderation_hidden_at = case when v_action = 'hide' then now() else null end,
        moderation_hidden_by_profile_id = case when v_action = 'hide' then v_reviewer_profile_id else null end
    from ante_core.workout_logs wl
    where c.id::text = v_report.content_id and c.workout_log_id = wl.id and wl.bloc_id = v_report.bloc_id
      and c.commenter_profile_id = v_report.reported_profile_id
    returning c.id::text into v_updated_id;
  else
    update ante_core.workout_logs wl
    set moderation_hidden_at = case when v_action = 'hide' then now() else null end,
        moderation_hidden_by_profile_id = case when v_action = 'hide' then v_reviewer_profile_id else null end
    where wl.id = v_report.content_id and wl.bloc_id = v_report.bloc_id and wl.profile_id = v_report.reported_profile_id
    returning wl.id into v_updated_id;
  end if;
  if v_updated_id is null then raise exception 'reported content was not found in this Bloc' using errcode = 'P0002'; end if;

  update ante_core.content_reports
  set status = 'reviewed', reviewed_by_profile_id = v_reviewer_profile_id, review_note = v_note, reviewed_at = now()
  where id = p_report_id;
  insert into ante_core.content_moderation_actions (report_id, content_type, content_id, action, actor_profile_id, note)
  values (v_report.id, v_report.content_type, v_report.content_id, v_action, v_reviewer_profile_id, v_note);
  return jsonb_build_object('id', v_report.id::text, 'status', 'reviewed', 'moderationHidden', v_action = 'hide');
end;
$$;

revoke all on function public.read_ante_core_current_logs() from public, anon, authenticated;
revoke all on function public.read_ante_core_workout_log_comment_counts(text, text, text[]) from public, anon, authenticated;
revoke all on function public.read_ante_core_content_reports(integer) from public, anon, authenticated;
revoke all on function public.moderate_ante_core_report_content(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.read_ante_core_current_logs() to service_role;
grant execute on function public.read_ante_core_workout_log_comment_counts(text, text, text[]) to service_role;
grant execute on function public.read_ante_core_content_reports(integer) to service_role;
grant execute on function public.moderate_ante_core_report_content(uuid, text, text, text) to service_role;
