-- Enable RLS on the eight server-only ante_core tables, and take the browser
-- grants off the fifteen abandoned projection tables (2026-09-26).
--
-- Inventory and verdict: docs/handover-2026-09-22-for-deveen-active.md §1-§2,
-- which ran the checks from docs/rls-inventory-2026-09-20.md against
-- production. Verdict was NOT EXPOSED, so this is the low-risk shape: enable
-- RLS, write no client policies.
--
-- WHY THIS DOES NOT BREAK THE APP
--
-- Enabling RLS with zero policies denies everything -- to roles that are
-- subject to RLS. Neither path the app uses is:
--
--   1. service_role has the BYPASSRLS attribute, so the server's own queries
--      through PostgREST are unaffected.
--   2. The 22 public.* functions over these tables are SECURITY DEFINER and
--      owned by the table owner. A table's owner is exempt from its own RLS
--      unless FORCE ROW LEVEL SECURITY is set -- which is deliberately NOT set
--      below. Setting it would break exactly these functions.
--
-- What is denied is a direct anon/authenticated query, which is the thing
-- being closed off. Those roles hold no grants on these tables today, so this
-- is a second lock on an already-locked door: it means a future stray GRANT
-- cannot open the table by itself.
--
-- DO NOT add client policies here. These tables are server-only by design.
-- ante_core.settlement_confirmations is the one table meant to be
-- client-readable and it already has its own policies; leave it alone.
--
-- ROLLBACK, if ever needed (safe, immediate):
--   alter table ante_core.bloc_messages disable row level security;
--   ... repeat per table ...
--   -- and for the projection grants, if something unexpected depended on them:
--   grant all on public.lift_log_projection_<name> to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. The seven server-only tables from the inventory
-- ---------------------------------------------------------------------------

alter table ante_core.bloc_messages                  enable row level security;
alter table ante_core.bloc_message_reactions         enable row level security;
alter table ante_core.bloc_message_reads             enable row level security;
alter table ante_core.workout_log_comments           enable row level security;
alter table ante_core.workout_log_comment_reactions  enable row level security;
alter table ante_core.solo_requests                  enable row level security;
alter table ante_core.revision_clock                 enable row level security;

-- ---------------------------------------------------------------------------
-- 2. The eighth table, found by the inventory (§2.1)
-- ---------------------------------------------------------------------------
-- A 2026-09-18 backup holding one row of Bloc Stream message content. Included
-- rather than dropped: enabling RLS is additive and reversible, dropping is
-- not, and whether the backup is still wanted is Aadhil's call to make
-- separately. Guarded so this migration still applies cleanly if he drops it
-- first.

do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'ante_core'
      and c.relname = 'backup_bloc_message_solo_note_2026_09_18'
      and c.relkind = 'r'
  ) then
    execute 'alter table ante_core.backup_bloc_message_solo_note_2026_09_18 enable row level security';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. The fifteen abandoned projection tables (§2.2)
-- ---------------------------------------------------------------------------
-- Last touched 9 June, referenced nowhere in api/ or src/, and carrying the
-- Supabase default full grants to anon and authenticated -- SELECT, INSERT,
-- UPDATE, DELETE, TRUNCATE. They are safe today only because RLS is on with no
-- policies, which means RLS is the single layer holding. If RLS were ever
-- switched off on one, or a broad policy added, it would become fully readable
-- AND writable by anyone signed in.
--
-- Revoking the grants removes that single-point dependency. Deliberately NOT
-- dropping the tables: they hold ~280 rows of June data, dropping is
-- destructive and irreversible, and it deserves its own decision with a backup
-- rather than riding along in a security migration. Recommended as a follow-up.

do $$
declare
  t text;
  projection_tables text[] := array[
    'lift_log_projection_meta',
    'lift_log_projection_profiles',
    'lift_log_projection_pending_otps',
    'lift_log_projection_groups',
    'lift_log_projection_group_memberships',
    'lift_log_projection_group_joined_months',
    'lift_log_projection_group_excused',
    'lift_log_projection_group_logs',
    'lift_log_projection_log_reactions',
    'lift_log_projection_season_overrides',
    'lift_log_projection_sit_out_requests',
    'lift_log_projection_month_history',
    'lift_log_projection_month_counts',
    'lift_log_projection_month_logs',
    'lift_log_projection_month_log_reactions'
  ];
begin
  foreach t in array projection_tables loop
    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t and c.relkind = 'r'
    ) then
      execute format('revoke all on public.%I from anon', t);
      execute format('revoke all on public.%I from authenticated', t);
      -- RLS stays on: belt and braces, not belt instead of braces.
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Verification -- run these after applying, expect zero rows from both
-- ---------------------------------------------------------------------------
--
-- Any ante_core table still without RLS:
--
--   select c.relname
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'ante_core' and c.relkind = 'r' and c.relrowsecurity = false;
--
-- Any projection table a browser role can still touch:
--
--   select c.relname, pg_get_userbyid(a.grantee) as grantee, a.privilege_type
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--   cross join lateral aclexplode(c.relacl) a
--   where n.nspname = 'public'
--     and c.relname like 'lift_log_projection_%'
--     and pg_get_userbyid(a.grantee) in ('anon', 'authenticated');
--
-- And confirm nothing regressed in the app, which is the real test:
-- Bloc Stream read/send/react/unread, workout comments and comment reactions,
-- solo mode request and review, sign-in and bootstrap, and logging a workout.
