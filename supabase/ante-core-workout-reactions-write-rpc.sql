-- Write RPCs for ante_core.workout_reactions.
-- Called from the app server (service_role caller) on reaction toggle.
--
-- Identity model:
-- - reactor_profile_id is the real identity when auth_user_id can be resolved
-- - reactor_display_name is retained as a PK component and rendering snapshot
-- - missing or unresolvable auth_user_id is tolerated; reactor_profile_id becomes null
-- - workout_log_id is a text FK matching ante_core.workout_logs(id) exactly
--
-- ON DELETE CASCADE on workout_log_id means all reaction rows for a deleted log
-- are removed automatically — no explicit reaction-cleanup RPC is needed for
-- the delete-log path.
--
-- ON DELETE SET NULL on reactor_profile_id means deleting a profile preserves
-- the reaction row with reactor_profile_id nulled — no extra cleanup needed for
-- the delete-account path.
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly denied.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. upsert_ante_core_workout_reaction
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Inserts a single reaction row. Idempotent on re-add (ON CONFLICT DO NOTHING).
--
-- Call via: POST /rest/v1/rpc/upsert_ante_core_workout_reaction
-- Body:     { "p_workout_log_id": "...", "p_reactor_auth_user_id": "..."|null,
--             "p_reactor_display_name": "...", "p_emoji": "..." }
--
-- Conflict resolution is on (workout_log_id, emoji, reactor_display_name).
-- If the parent workout_log row does not exist (pre-canonical log), the insert
-- raises a FK violation which is caught and silently discarded.
-- reactor_profile_id is resolved from profiles.auth_user_id; null if not found.
-- created_at is set on first insert and preserved on conflict (DO NOTHING).

create or replace function public.upsert_ante_core_workout_reaction(
  p_workout_log_id        text,
  p_reactor_auth_user_id  text,
  p_reactor_display_name  text,
  p_emoji                 text
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_reactor_profile_id uuid;
begin
  -- Validate required inputs.
  if p_workout_log_id is null or trim(p_workout_log_id) = '' then
    return;
  end if;
  if p_reactor_display_name is null or trim(p_reactor_display_name) = '' then
    return;
  end if;
  if p_emoji is null or trim(p_emoji) = '' then
    return;
  end if;

  -- Resolve reactor_profile_id from auth_user_id — best-effort; null is acceptable.
  if p_reactor_auth_user_id is not null and trim(p_reactor_auth_user_id) <> '' then
    begin
      select id into v_reactor_profile_id
      from ante_core.profiles
      where auth_user_id = trim(p_reactor_auth_user_id)::uuid;
    exception when others then
      v_reactor_profile_id := null;
    end;
  end if;

  -- Insert the reaction row. ON CONFLICT DO NOTHING makes this idempotent —
  -- toggling on twice is safe and preserves the original created_at.
  -- If the parent workout_logs row is missing, the FK violation is caught below.
  begin
    insert into ante_core.workout_reactions (
      workout_log_id,
      reactor_profile_id,
      reactor_display_name,
      emoji,
      created_at
    )
    values (
      trim(p_workout_log_id),
      v_reactor_profile_id,
      trim(p_reactor_display_name),
      trim(p_emoji),
      now()
    )
    on conflict (workout_log_id, emoji, reactor_display_name) do nothing;
  exception when foreign_key_violation then
    -- Parent workout_log row does not exist (pre-canonical log or already deleted).
    -- Silently discard — this is a best-effort write.
    return;
  end;
end;
$$;

-- Harden access.
revoke execute on function public.upsert_ante_core_workout_reaction(text, text, text, text) from public;
revoke execute on function public.upsert_ante_core_workout_reaction(text, text, text, text) from anon;
revoke execute on function public.upsert_ante_core_workout_reaction(text, text, text, text) from authenticated;
grant  execute on function public.upsert_ante_core_workout_reaction(text, text, text, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. delete_ante_core_workout_reaction
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Removes a single reaction row. No-ops silently if the row does not exist.
--
-- Call via: POST /rest/v1/rpc/delete_ante_core_workout_reaction
-- Body:     { "p_workout_log_id": "...", "p_reactor_display_name": "...",
--             "p_emoji": "..." }
--
-- Keyed on the full PK: (workout_log_id, emoji, reactor_display_name).
-- No profile resolution needed — display name is the reliable removal key here
-- since that is what the blob toggle uses to identify the reactor.

create or replace function public.delete_ante_core_workout_reaction(
  p_workout_log_id        text,
  p_reactor_display_name  text,
  p_emoji                 text
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
begin
  -- Validate required inputs.
  if p_workout_log_id is null or trim(p_workout_log_id) = '' then
    return;
  end if;
  if p_reactor_display_name is null or trim(p_reactor_display_name) = '' then
    return;
  end if;
  if p_emoji is null or trim(p_emoji) = '' then
    return;
  end if;

  delete from ante_core.workout_reactions
  where workout_log_id       = trim(p_workout_log_id)
    and reactor_display_name = trim(p_reactor_display_name)
    and emoji                = trim(p_emoji);
  -- No-ops silently if the row is already absent.
end;
$$;

-- Harden access.
revoke execute on function public.delete_ante_core_workout_reaction(text, text, text) from public;
revoke execute on function public.delete_ante_core_workout_reaction(text, text, text) from anon;
revoke execute on function public.delete_ante_core_workout_reaction(text, text, text) from authenticated;
grant  execute on function public.delete_ante_core_workout_reaction(text, text, text) to service_role;
