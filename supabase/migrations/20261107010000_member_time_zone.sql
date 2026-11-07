-- A member's own time zone, so a scheduled notification fires at their 18:00.
--
-- WHY THIS EXISTS
--
-- ante_core stores time_zone on `blocs` and on `seasons`, and nowhere else.
-- There has never been a member time zone. That is fine while every clock in
-- Fero belongs to a Bloc -- the Fero day ending at 3am, a season closing --
-- but push notifications are sent to a person, and a person has their own
-- evening.
--
-- Production today: 11 Blocs on Europe/Oslo, 1 on Europe/Berlin, 1 on
-- Asia/Colombo. A member of the Colombo Bloc who lives in Oslo would get the
-- Bloc's 18:00 nudge at 14:00 their time. The founder spotted this and asked
-- "is it 5 p.m. on the user's time, or 5 p.m. where?" -- this column is the
-- answer. It blocks notification types 1, 6, 7 and 9, all of which are
-- scheduled. See docs/push-notification-design-2026-11-06.md section 2E.
--
-- WHAT STILL BELONGS TO THE BLOC
--
-- Only the DELIVERY HOUR becomes the member's. Which workouts count as
-- "today" is still the Bloc's day, because that is what the Bloc competes on.
-- The two are deliberately different and both are right.
--
-- NULL IS THE NORMAL CASE AT FIRST
--
-- Nobody has one until their phone next reports it. Every caller must fall
-- back to the Bloc's time_zone when this is null, which is exactly today's
-- behaviour -- so this migration changes nothing on its own, and shipping it
-- before the code that reads it is safe.
--
-- THE VALUE IS VALIDATED, NOT TRUSTED
--
-- The zone arrives from the device, so the function rejects anything that is
-- not a real IANA name rather than storing junk a scheduler would later trip
-- over. An unknown zone leaves the column untouched and is not an error: a
-- member on an odd device keeps working, they just keep the Bloc's clock.
--
-- ROLLBACK (two statements, no data loss anywhere else)
--
--   drop function if exists public.set_ante_core_profile_time_zone(uuid, text);
--   alter table ante_core.profiles drop column if exists time_zone;

alter table ante_core.profiles
  add column if not exists time_zone text;

comment on column ante_core.profiles.time_zone is
  'IANA zone reported by the member''s device, e.g. Europe/Oslo. Null means '
  'not yet known: fall back to the Bloc''s time_zone. Used only to choose the '
  'hour a scheduled notification is delivered, never to decide which day a '
  'workout counts for.';

create or replace function public.set_ante_core_profile_time_zone(
  p_auth_user_id uuid,
  p_time_zone    text
)
returns void
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  v_zone text := nullif(btrim(coalesce(p_time_zone, '')), '');
begin
  if p_auth_user_id is null or v_zone is null then
    return;
  end if;

  -- Not a real zone: keep the Bloc's clock rather than storing something the
  -- scheduler would have to defend against every time it runs.
  if not exists (select 1 from pg_timezone_names where name = v_zone) then
    return;
  end if;

  update ante_core.profiles
     set time_zone = v_zone,
         updated_at = now()
   where auth_user_id = p_auth_user_id
     and time_zone is distinct from v_zone;
end;
$$;

revoke execute on function public.set_ante_core_profile_time_zone(uuid, text) from public, anon, authenticated;
grant  execute on function public.set_ante_core_profile_time_zone(uuid, text) to service_role;
