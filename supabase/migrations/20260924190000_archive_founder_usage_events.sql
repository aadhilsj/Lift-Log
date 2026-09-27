-- Move the founder's own usage events out of the live analytics table
-- (2026-09-24).
--
-- 4,019 of the 8,186 usage events ever recorded came from the founder's
-- account while building and testing Fero. That is 49% of the table, and it
-- distorted the volume columns badly: 92% of Month Standings Expanded, 71% of
-- Reaction Picker, 60% of Comment Composer. The Users columns were barely
-- affected, because one person only ever adds one to a distinct count -- it is
-- the "uses" figures that were misleading.
--
-- The rows are MOVED, not deleted. Undoing this is an insert ... select back
-- from the archive, so nothing is lost if the decision is ever reversed.
--
-- Deliberately NOT touched:
--   * ante_core.app_daily_activity -- the founder stays in Active Users, which
--     counts a person once a day and is honest regardless of how often he
--     opens the app.
--   * ante_core.workout_logs -- his workouts are real training, not testing.
--
-- Writes from this account are already blocked at the API (see
-- recordCanonicalUsageEvent / recordCanonicalDailyAppActivity), so this is a
-- one-off clean-up of history rather than an ongoing filter. The reason it is
-- a move rather than a read-time exclusion: a filter would have to be
-- remembered by every present and future dashboard query, which is the same
-- shape as the bug that silently discarded bloc_loop_opened for weeks.

create table if not exists ante_core.app_usage_events_archive (
  id bigint primary key,
  profile_id uuid not null,
  event_name text not null,
  occurred_at timestamptz not null,
  archived_at timestamptz not null default now(),
  archive_reason text not null
);

-- No foreign key to profiles on purpose: deleting a profile should not quietly
-- destroy the archived copy as well.
alter table ante_core.app_usage_events_archive enable row level security;
revoke all on table ante_core.app_usage_events_archive from public, anon, authenticated;

create index if not exists ante_core_app_usage_events_archive_profile_idx
  on ante_core.app_usage_events_archive (profile_id, occurred_at desc);

with moved as (
  delete from ante_core.app_usage_events
  where profile_id = '768de245-5b17-4292-b91c-804daaa3b217'::uuid
  returning id, profile_id, event_name, occurred_at
)
insert into ante_core.app_usage_events_archive (id, profile_id, event_name, occurred_at, archive_reason)
select id, profile_id, event_name, occurred_at, 'founder testing, excluded from product analytics 2026-09-24'
from moved
on conflict (id) do nothing;
