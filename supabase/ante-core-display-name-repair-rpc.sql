-- Canonical snapshot repair RPC for one bloc-scoped display-name correction.
-- Called from the app server (service_role caller) by the admin-only
-- `repair-display-name` mutation.
--
-- Scope:
-- - updates canonical snapshot fields that still persist a display name
-- - limited to one bloc via legacy_group_key
-- - uses auth_user_id when available, but also falls back to old display name
--   to catch legacy rows whose profile_id is null
--
-- Important:
-- - this is intentionally a narrow repair tool, not the broader “display names
--   are cosmetic only” migration
-- - it updates current and historical snapshot rows for one bloc so canonical
--   read surfaces stay aligned with the existing blob repair behavior

create or replace function public.repair_ante_core_display_name_snapshots(
  p_legacy_group_key text,
  p_auth_user_id text,
  p_old_display_name text,
  p_new_display_name text
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_bloc_id uuid;
  v_profile_id uuid;
  v_old_name text;
  v_new_name text;
begin
  if p_legacy_group_key is null or trim(p_legacy_group_key) = '' then
    return;
  end if;
  if p_old_display_name is null or trim(p_old_display_name) = '' then
    return;
  end if;
  if p_new_display_name is null or trim(p_new_display_name) = '' then
    return;
  end if;

  v_old_name := trim(p_old_display_name);
  v_new_name := trim(p_new_display_name);
  if v_old_name = v_new_name then
    return;
  end if;

  select id into v_bloc_id
  from ante_core.blocs
  where legacy_group_key = trim(p_legacy_group_key);

  if v_bloc_id is null then
    return;
  end if;

  if p_auth_user_id is not null and trim(p_auth_user_id) <> '' then
    begin
      select id into v_profile_id
      from ante_core.profiles
      where auth_user_id = trim(p_auth_user_id)::uuid;
    exception when others then
      v_profile_id := null;
    end;
  end if;

  update ante_core.bloc_members
  set display_name_snapshot = v_new_name
  where bloc_id = v_bloc_id
    and (
      (v_profile_id is not null and profile_id = v_profile_id)
      or display_name_snapshot = v_old_name
    );

  delete from ante_core.season_member_status sms
  using ante_core.seasons s
  where sms.season_id = s.id
    and s.bloc_id = v_bloc_id
    and sms.display_name_snapshot = v_old_name
    and exists (
      select 1
      from ante_core.season_member_status sms_new
      where sms_new.season_id = sms.season_id
        and sms_new.display_name_snapshot = v_new_name
    );

  update ante_core.season_member_status sms
  set
    display_name_snapshot = v_new_name,
    profile_id = coalesce(sms.profile_id, v_profile_id),
    updated_at = now()
  from ante_core.seasons s
  where sms.season_id = s.id
    and s.bloc_id = v_bloc_id
    and (
      (v_profile_id is not null and sms.profile_id = v_profile_id)
      or sms.display_name_snapshot = v_old_name
    );

  delete from ante_core.sit_out_requests sor
  using ante_core.seasons s
  where sor.season_id = s.id
    and s.bloc_id = v_bloc_id
    and sor.display_name_snapshot = v_old_name
    and exists (
      select 1
      from ante_core.sit_out_requests sor_new
      where sor_new.season_id = sor.season_id
        and sor_new.display_name_snapshot = v_new_name
    );

  update ante_core.sit_out_requests sor
  set
    display_name_snapshot = case
      when (v_profile_id is not null and sor.profile_id = v_profile_id) or sor.display_name_snapshot = v_old_name
        then v_new_name
      else sor.display_name_snapshot
    end,
    profile_id = coalesce(sor.profile_id, v_profile_id),
    requested_by = case when sor.requested_by = v_old_name then v_new_name else sor.requested_by end,
    target_approver_name = case when sor.target_approver_name = v_old_name then v_new_name else sor.target_approver_name end,
    decided_by = case when sor.decided_by = v_old_name then v_new_name else sor.decided_by end,
    updated_at = now()
  from ante_core.seasons s
  where sor.season_id = s.id
    and s.bloc_id = v_bloc_id
    and (
      (v_profile_id is not null and sor.profile_id = v_profile_id)
      or sor.display_name_snapshot = v_old_name
      or sor.requested_by = v_old_name
      or sor.target_approver_name = v_old_name
      or sor.decided_by = v_old_name
    );

  update ante_core.workout_logs wl
  set
    owner_display_name = case
      when (v_profile_id is not null and wl.profile_id = v_profile_id) or wl.owner_display_name = v_old_name
        then v_new_name
      else wl.owner_display_name
    end,
    flagged_by = case when wl.flagged_by = v_old_name then v_new_name else wl.flagged_by end,
    decision_by = case when wl.decision_by = v_old_name then v_new_name else wl.decision_by end
  where wl.bloc_id = v_bloc_id
    and (
      (v_profile_id is not null and wl.profile_id = v_profile_id)
      or wl.owner_display_name = v_old_name
      or wl.flagged_by = v_old_name
      or wl.decision_by = v_old_name
    );

  delete from ante_core.workout_reactions wr
  using ante_core.workout_logs wl
  where wl.id = wr.workout_log_id
    and wl.bloc_id = v_bloc_id
    and wr.reactor_display_name = v_old_name
    and exists (
      select 1
      from ante_core.workout_reactions wr_new
      where wr_new.workout_log_id = wr.workout_log_id
        and wr_new.emoji = wr.emoji
        and wr_new.reactor_display_name = v_new_name
    );

  update ante_core.workout_reactions wr
  set
    reactor_display_name = v_new_name,
    reactor_profile_id = coalesce(wr.reactor_profile_id, v_profile_id)
  from ante_core.workout_logs wl
  where wl.id = wr.workout_log_id
    and wl.bloc_id = v_bloc_id
    and (
      (v_profile_id is not null and wr.reactor_profile_id = v_profile_id)
      or wr.reactor_display_name = v_old_name
    );

  update ante_core.season_overrides so
  set chosen_by = v_new_name
  from ante_core.seasons s
  where so.season_id = s.id
    and s.bloc_id = v_bloc_id
    and (
      (v_profile_id is not null and so.chosen_by_user_id = v_profile_id)
      or so.chosen_by = v_old_name
    );

  update ante_core.settlement_confirmations sc
  set
    payer_display_name_snapshot = case
      when (v_profile_id is not null and sc.payer_profile_id = v_profile_id) or sc.payer_display_name_snapshot = v_old_name
        then v_new_name
      else sc.payer_display_name_snapshot
    end,
    receiver_display_name_snapshot = case
      when (v_profile_id is not null and sc.receiver_profile_id = v_profile_id) or sc.receiver_display_name_snapshot = v_old_name
        then v_new_name
      else sc.receiver_display_name_snapshot
    end,
    updated_at = now()
  where sc.bloc_id = v_bloc_id
    and (
      (v_profile_id is not null and (sc.payer_profile_id = v_profile_id or sc.receiver_profile_id = v_profile_id))
      or sc.payer_display_name_snapshot = v_old_name
      or sc.receiver_display_name_snapshot = v_old_name
    );

  delete from ante_core.settlement_entries se
  using ante_core.settlement_runs sr
  where se.settlement_run_id = sr.id
    and sr.bloc_id = v_bloc_id
    and se.display_name_snapshot = v_old_name
    and exists (
      select 1
      from ante_core.settlement_entries se_new
      where se_new.settlement_run_id = se.settlement_run_id
        and se_new.display_name_snapshot = v_new_name
    );

  update ante_core.settlement_entries se
  set
    display_name_snapshot = v_new_name,
    profile_id = coalesce(se.profile_id, v_profile_id)
  from ante_core.settlement_runs sr
  where se.settlement_run_id = sr.id
    and sr.bloc_id = v_bloc_id
    and (
      (v_profile_id is not null and se.profile_id = v_profile_id)
      or se.display_name_snapshot = v_old_name
    );

  update ante_core.settlement_transfers st
  set
    from_display_name = case
      when (v_profile_id is not null and st.from_profile_id = v_profile_id) or st.from_display_name = v_old_name
        then v_new_name
      else st.from_display_name
    end,
    to_display_name = case
      when (v_profile_id is not null and st.to_profile_id = v_profile_id) or st.to_display_name = v_old_name
        then v_new_name
      else st.to_display_name
    end
  from ante_core.settlement_runs sr
  where st.settlement_run_id = sr.id
    and sr.bloc_id = v_bloc_id
    and (
      (v_profile_id is not null and (st.from_profile_id = v_profile_id or st.to_profile_id = v_profile_id))
      or st.from_display_name = v_old_name
      or st.to_display_name = v_old_name
    );
end;
$$;

revoke execute on function public.repair_ante_core_display_name_snapshots(text, text, text, text) from public;
revoke execute on function public.repair_ante_core_display_name_snapshots(text, text, text, text) from anon;
revoke execute on function public.repair_ante_core_display_name_snapshots(text, text, text, text) from authenticated;
grant execute on function public.repair_ante_core_display_name_snapshots(text, text, text, text) to service_role;
