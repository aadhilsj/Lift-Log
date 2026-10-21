-- The six ante_core tables the 26 September RLS migration does not cover.
--
-- This is a SEPARATE file on purpose. `20260926120000_enable_rls_on_server_only_tables.sql`
-- is Deveen's and he is mid-rollout with a captured baseline, so editing it
-- underneath him would invalidate his comparison. This one is additive and
-- can be reviewed, reordered or dropped on its own.
--
-- Measured on production (bpvvvqjsfwmmfjvvijkd) on 20 October 2026: 40 tables
-- in ante_core, 14 with RLS off, 8 of them covered by his file. These are the
-- other six.
--
-- NOT APPLIED ANYWHERE. Production RLS stays Deveen's to roll out, after his
-- staging comparison comes back.
--
-- Why this is safe to the app: none of these tables grants anything to `anon`,
-- `authenticated` or `public` - verified directly, all report no client
-- grantees. Nothing can reach them with a browser key today, so turning RLS on
-- cannot break a path that currently works. The API reads them with the
-- service key, which bypasses RLS. Same argument as the September file, and
-- the same shape: RLS on, no policies, no FORCE.
--
-- Rollback, per table:
--   alter table ante_core.<name> disable row level security;

-- ---------------------------------------------------------------------------
-- 1. push_devices
-- ---------------------------------------------------------------------------
-- Flagged in §1 of handover-2026-09-29-for-deveen-active.md on 29 September
-- as needed before 2 October, re-verified on production on the 30th, and
-- still not in the September file on 20 October. Server-only: the API writes
-- device tokens with the service key.
do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'ante_core' and c.relname = 'push_devices' and c.relkind = 'r'
  ) then
    execute 'alter table ante_core.push_devices enable row level security';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Every ante_core backup_* table, including ones made after this file
-- ---------------------------------------------------------------------------
-- The five uncovered backups all postdate the September migration:
--
--   backup_blob_before_force_rollover_2026_10_01
--   backup_marlene_jul_aug_2026_10_01
--   backup_solo_tw_2026_10_01_blob
--   backup_solo_tw_2026_10_01_member_status
--   backup_nishara_log_date_2026_10_13   <- made by our own 13 Oct date fix
--
-- Naming them one by one is what went wrong the first time: the list is
-- correct the day it is written and wrong at the next data fix, because every
-- production data change takes a backup first (CLAUDE.md §4). So this sweeps
-- the prefix instead.
--
-- Scope is deliberately narrow - `backup_` in ante_core only. These are inert
-- snapshots, never read by a client path, so there is no table in this set
-- that is supposed to be reachable with a browser key.
--
-- Re-running this is how it stays true: it is idempotent, and applying it
-- again after the next backup covers that one too.
--
-- Verified on production, read-only, before this file was committed: the
-- pattern selects exactly six tables, the five above plus
-- backup_bloc_message_solo_note_2026_09_18. That last one overlaps with the
-- September file, deliberately and harmlessly - whichever runs first turns it
-- on, and the `relrowsecurity = false` filter means the other skips it.
--
-- His 8 + push_devices + this sweep = all 14 production tables that have RLS
-- off today. Both files applied, the verification below returns nothing.
do $$
declare
  t text;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'ante_core'
      and c.relkind = 'r'
      and c.relname like 'backup\_%'
      and c.relrowsecurity = false
    order by c.relname
  loop
    execute format('alter table ante_core.%I enable row level security', t);
    raise notice 'RLS enabled on ante_core.%', t;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Verification -- expect zero rows, on whichever database this was run
-- ---------------------------------------------------------------------------
-- This is Deveen's own check from the September file, unchanged. With both
-- files applied it should finally return nothing on production:
--
--   select c.relname
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'ante_core' and c.relkind = 'r' and c.relrowsecurity = false;
--
-- If it returns a backup_* table, this file simply has not been re-run since
-- that backup was taken. Run it again; that is the intended maintenance.
