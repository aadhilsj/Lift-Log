# Read Baseline Apply Runbook — 2026-07-02

This runbook is for the backend step that unblocks full canonical-first GET
composition.

## Why This Exists

The app branch now contains a canonical-first read composer with a safe fallback
to blob-overlay reads.

The remaining blocker is backend state:

- the preview backend currently does not expose at least
  `public.read_ante_core_blocs()` through PostgREST
- that means the canonical GET path cannot become authoritative yet

This is not a product-code gap. The read RPC SQL already exists in the repo.

## Apply Artifact

Use:

- [`/Users/opera_user/Documents/Codex Space/Lift Log/supabase/ante-core-read-baseline-apply.sql`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-read-baseline-apply.sql)

That file bundles the full service-role read baseline required by
`fetchReadableCurrentState()`:

1. `public.read_ante_core_blocs()`
2. `public.read_ante_core_bloc_members()`
3. `public.read_ante_core_profiles()`
4. `public.read_ante_core_current_logs()`
5. `public.read_ante_core_current_excused_and_sitouts()`
6. `public.read_ante_core_month_history()`
7. `public.read_ante_core_season_overrides()`
8. `public.read_ante_core_settlement_confirmations()`

## Safe Intent

This apply bundle:

- creates or replaces functions only
- re-applies service-role execute grants
- does not mutate relational data
- does not delete rows
- does not alter app behavior until the API branch using these RPCs is deployed

## Verification Queries

After applying, verify function presence:

```sql
select
  n.nspname as schema_name,
  p.proname as function_name
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'read_ante_core_blocs',
    'read_ante_core_bloc_members',
    'read_ante_core_profiles',
    'read_ante_core_current_logs',
    'read_ante_core_current_excused_and_sitouts',
    'read_ante_core_month_history',
    'read_ante_core_season_overrides',
    'read_ante_core_settlement_confirmations'
  )
order by p.proname;
```

Then verify grants:

```sql
select
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name in (
    'read_ante_core_blocs',
    'read_ante_core_bloc_members',
    'read_ante_core_profiles',
    'read_ante_core_current_logs',
    'read_ante_core_current_excused_and_sitouts',
    'read_ante_core_month_history',
    'read_ante_core_season_overrides',
    'read_ante_core_settlement_confirmations'
  )
order by routine_name, grantee, privilege_type;
```

Expected grant posture:

- `service_role` has `EXECUTE`
- `public`, `anon`, and `authenticated` do not

## App-Level Verification

Once the backend apply is done and the branch is deployed, re-check:

1. `GET /api/lift-log` returns normal payload shape
2. server logs do not print:
   `Canonical read baseline missing or empty; falling back to blob-overlay read composer.`
3. Today
4. Activity
5. Results
6. History
7. profile navigation
8. settlement surfaces

## Decision After Verification

If all preview checks pass:

- remove the blob-overlay fallback path from `fetchReadableCurrentState()`
- keep blob-backed writable-state compatibility for the later write cutover
