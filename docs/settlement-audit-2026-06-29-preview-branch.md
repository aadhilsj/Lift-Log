# Settlement Preview Branch Audit — 2026-06-29

This note records the full audit after repeated failures while trying to test
the real settlement-confirmation flow on the Supabase preview branch
`settlement-test`.

## 2026-06-29 Verification Outcome

After the missing canonical helper baseline was applied to the preview branch,
the real settlement-confirmation flow was tested successfully:

- payer could mark the settlement as paid
- receiver could confirm it
- the reminder disappeared for everyone after confirmation

That means the preview-branch database and the current claim/confirm product
flow are now functionally valid.

The remaining known issue is a UI/data-loading one:

- on refresh, the Today reminder slot can appear a second or two late

That issue appears to be a read/hydration timing problem, not a settlement
write-path correctness problem.

## Scope

This audit is about the **preview-branch functional test path** for:

- Today settlement reminder cards
- payer `Mark as paid`
- receiver `Confirm`
- third-party visibility
- card disappearance after confirmation

It is **not** a re-audit of the approved visual design.

## Executive Summary

The feature implementation is not the main blocker.

The blocker is that the preview branch currently has the new
`settlement_confirmations` table/RPCs, but it does **not** reliably have the
older canonical helper RPC baseline that the app now depends on to bootstrap
canonical prerequisite rows before a claim/confirm action.

That means we are currently testing against a branch that is only
**partially canonical-capable**.

So the repeated failures are primarily environment/setup failures, not proof
that the settlement product model is wrong.

## Verified Failure Chain

### 1. Settlement write RPCs are strict

The claim/confirm RPCs require:

- a canonical `ante_core.blocs` row for the target `legacy_group_key`
- a canonical `ante_core.seasons` row for the target `month_key`
- canonical `ante_core.profiles` rows for payer and receiver

If those rows do not exist, the write RPCs raise:

- `bloc not found`
- `season not found`
- `payer profile not found`
- `receiver profile not found`

Reference:

- [supabase/ante-core-settlement-confirmations-write-rpcs.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-write-rpcs.sql:44)

### 2. The app tries to bootstrap those prerequisites automatically

Before claim/confirm, the server now calls:

- `syncBlocToCanonical(...)`
- `syncProfileToCanonical(...)`
- `syncBlocMemberToCanonical(...)`
- `syncSeasonToCanonical(...)`

through `ensureSettlementConfirmationPrereqs(...)`.

Reference:

- [api/lift-log.js](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js:1234)
- [api/lift-log.js](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js:3932)
- [api/lift-log.js](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js:3967)

### 3. The preview branch is missing the helper RPC baseline

Live local server logs against the preview branch showed repeated PostgREST
schema-cache failures for:

- `public.upsert_ante_core_bloc`
- `public.upsert_ante_core_profile`
- `public.upsert_ante_core_bloc_member`
- `public.upsert_ante_core_season`

When that bootstrap fails, the settlement claim still continues into the
strict settlement RPC, which then fails with `bloc not found`.

That is why the mobile UI showed:

- `{"message":"bloc not found"}`

even though the real missing issue was higher up: the branch did not have the
bootstrap helper RPCs available.

## Why The Manual Seed Attempts Kept Failing

We also tried to bypass the missing helper baseline by manually seeding the
preview branch.

That path kept failing because it mixed:

- assumed canonical profile IDs
- direct inserts into relational tables
- branch drift
- type-sensitive columns such as `left_at timestamptz`

Observed examples:

- FK failure on `blocs.admin_profile_id`
- type error on `left_at`
- successful query execution with no useful rows created

This was not the right level to debug the feature.

## Client/Server Audit Outcome

### Client read model

The client settlement reminder logic is conceptually correct:

- closed-month loser/winner pairs are derived from month history
- canonical `settlementConfirmations` overlay payer-claimed / confirmed state
- confirmed rows disappear
- unpaid older months remain visible

Reference:

- [index.html](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/index.html:706)
- [index.html](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/index.html:730)
- [index.html](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/index.html:832)

### Results / Today consistency

The branch code was already moved so both surfaces read canonical settlement
confirmation state instead of treating Today and Results as separate business
truths.

That direction is correct and should be kept.

### Refresh flicker

The reminder briefly disappearing on refresh and then appearing after a second
or two is likely a separate fetch/render timing issue on the readable overlay
path.

This is real, but it is **not** the reason the claim/confirm flow is failing.

It should be treated as a later UI/data-loading cleanup item after the branch
environment is valid.

## Minimum Branch Prerequisites Required

To make the preview branch a valid settlement test environment, it must have:

### Schema

- [canonical-schema.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/canonical-schema.sql)

### Helper write RPCs used by bootstrap

- [ante-core-profiles-write-rpc.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-profiles-write-rpc.sql)
- [ante-core-blocs-write-rpc.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-blocs-write-rpc.sql)
- [ante-core-bloc-members-write-rpc.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-bloc-members-write-rpc.sql)
- [ante-core-seasons-write-rpc.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-seasons-write-rpc.sql)

### Settlement confirmation SQL

- [ante-core-settlement-confirmations-schema.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-schema.sql)
- [ante-core-settlement-confirmations-read-rpc.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-read-rpc.sql)
- [ante-core-settlement-confirmations-write-rpcs.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-write-rpcs.sql)
- [ante-core-settlement-confirmations-rls.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-rls.sql)

### Optional but recommended for stable closed-month overlay

- [ante-core-month-history-read-rpc.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-month-history-read-rpc.sql)

Without that helper baseline, the preview branch will keep producing misleading
feature failures.

## Recommended Apply Order

Apply in this order on the preview branch:

1. `supabase/canonical-schema.sql`
2. `supabase/ante-core-profiles-write-rpc.sql`
3. `supabase/ante-core-blocs-write-rpc.sql`
4. `supabase/ante-core-bloc-members-write-rpc.sql`
5. `supabase/ante-core-seasons-write-rpc.sql`
6. `supabase/ante-core-month-history-read-rpc.sql`
7. `supabase/ante-core-settlement-confirmations-schema.sql`
8. `supabase/ante-core-settlement-confirmations-read-rpc.sql`
9. `supabase/ante-core-settlement-confirmations-write-rpcs.sql`
10. `supabase/ante-core-settlement-confirmations-rls.sql`

## Verification Order After Apply

After applying the branch prerequisites, verify these before touching the app:

1. helper RPCs exist in schema cache
2. `ante_core.settlement_confirmations` exists
3. RLS is enabled on `ante_core.settlement_confirmations`
4. the preview branch can create:
   - bloc row for `legacy-group`
   - profile rows for payer and receiver
   - bloc member rows for those profiles
   - season row for `2026-3`

Only after that should the app claim/confirm flow be tested again.

## Verification SQL

Run these on the preview branch **after** applying the prerequisite SQL.

### A. Check required helper / settlement functions exist

```sql
select
  n.nspname as schema_name,
  p.proname as function_name
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'upsert_ante_core_profile',
    'upsert_ante_core_bloc',
    'upsert_ante_core_bloc_member',
    'upsert_ante_core_season',
    'read_ante_core_month_history',
    'read_ante_core_settlement_confirmations',
    'claim_ante_core_settlement_confirmation',
    'confirm_ante_core_settlement_confirmation'
  )
order by p.proname;
```

Expected:

- 8 rows

### B. Check settlement table + RLS

```sql
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'ante_core'
  and tablename = 'settlement_confirmations';
```

Expected:

- one row
- `rowsecurity = true`

### C. Check settlement policies

```sql
select
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'ante_core'
  and tablename = 'settlement_confirmations'
order by policyname;
```

Expected:

- readable-by-bloc-members `SELECT`
- payer claim `UPDATE`
- receiver confirm `UPDATE`

### D. After first real claim attempt, check canonical prereqs were created

```sql
select
  id,
  legacy_group_key,
  name,
  invite_code
from ante_core.blocs
where legacy_group_key = 'legacy-group';
```

```sql
select
  id,
  email,
  auth_user_id,
  display_name
from ante_core.profiles
where lower(email) in (
  'aadhil101@gmail.com',
  'rishanedassanayake@gmail.com'
)
order by email;
```

```sql
select
  b.legacy_group_key,
  p.email,
  bm.display_name_snapshot,
  bm.role,
  bm.joined_at,
  bm.joined_month_key,
  bm.left_at
from ante_core.bloc_members bm
join ante_core.blocs b
  on b.id = bm.bloc_id
join ante_core.profiles p
  on p.id = bm.profile_id
where b.legacy_group_key = 'legacy-group'
  and lower(p.email) in (
    'aadhil101@gmail.com',
    'rishanedassanayake@gmail.com'
  )
order by p.email;
```

## Final Outcome

After the preview branch prerequisites were applied and the auth-sync response
was changed to always return `fetchReadableCurrentState()`, the hosted preview
branch is now green for the settlement confirmation slice.

### Confirmed Working

- Today reminder card appears immediately after refresh
- payer can mark a settlement as paid
- receiver can confirm receipt
- confirmation clears the reminder for every bloc member view
- Results screen and Today screen now agree on the same canonical settlement
  confirmation state

### Root Cause of the Refresh Glitch

The delayed-on-refresh reminder issue was caused by `auth-sync` returning a raw
blob-backed state during app bootstrap. That briefly replaced the readable
canonical overlay until the later background refresh finished.

Returning the readable overlaid state directly from `auth-sync` removed that
temporary wipe and fixed the delayed reminder appearance.

```sql
select
  s.id,
  b.legacy_group_key,
  s.month_key,
  s.label,
  s.status,
  s.closed_at
from ante_core.seasons s
join ante_core.blocs b
  on b.id = s.bloc_id
where b.legacy_group_key = 'legacy-group'
  and s.month_key = '2026-3';
```

Expected after a successful claim-path bootstrap:

- one `legacy-group` bloc row
- both profiles present
- both bloc-members rows active (`left_at is null`)
- one season row for `2026-3`

### E. After claim, check the settlement confirmation row itself

```sql
select
  b.legacy_group_key,
  s.month_key,
  payer.email    as payer_email,
  receiver.email as receiver_email,
  sc.payer_display_name_snapshot,
  sc.receiver_display_name_snapshot,
  sc.amount,
  sc.currency,
  sc.payer_claimed_at,
  sc.confirmed_at,
  sc.created_at,
  sc.updated_at
from ante_core.settlement_confirmations sc
join ante_core.blocs b
  on b.id = sc.bloc_id
join ante_core.seasons s
  on s.id = sc.season_id
join ante_core.profiles payer
  on payer.id = sc.payer_profile_id
join ante_core.profiles receiver
  on receiver.id = sc.receiver_profile_id
where b.legacy_group_key = 'legacy-group'
  and s.month_key = '2026-3'
order by sc.created_at desc;
```

Expected after payer clicks `Mark as paid`:

- row exists
- `payer_claimed_at is not null`
- `confirmed_at is null`

## Safe Next Execution Plan

1. Repair the preview branch baseline
2. Verify the helper RPCs exist
3. Let the app bootstrap canonical prereqs through the normal claim/confirm path
4. Retest:
   - payer unpaid
   - payer pending after claim
   - receiver pending with confirm button
   - third-party unpaid
   - third-party pending
   - disappearance after confirm
5. Fix the refresh flicker separately

## What Not To Do Next

Do **not**:

- keep manually improvising branch seed SQL
- keep changing the reminder-card UI
- keep debugging the settlement RPCs in isolation

Those actions will keep mixing feature logic with broken environment setup.

## Current Assessment

The feature is still viable and still aligned with the long-term migration
direction.

The current issue is that the chosen preview environment is missing part of the
canonical baseline required to test it properly.
