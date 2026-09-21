# RLS inventory — the seven tables, before any migration is written

From Deveen, for §3 item 5 of the 2026-09-14 handover. **Read-only. Nothing
here changes production.** Every query below is a `select`.

Aadhil runs all Supabase SQL, so this is written to be pasted straight into the
SQL editor, one block at a time, with what each result means underneath.

**One caveat up front:** these queries use standard catalog views but could not
be run against a live database before writing them — there is no local Postgres
on this machine (no Docker). They are read-only, so the worst case is a syntax
error in the SQL editor, not a change to anything. If a block errors, say so
and it gets fixed rather than worked around.

## Plain-English summary

Supabase says seven tables in the new database have their per-row access rules
switched off. The app is designed so that browsers never talk to those tables
directly — the server holds a privileged key and hands back only what you are
allowed to see. **If that design is holding, this is a warning to tidy up. If
it is not, members' private messages and comments are readable by anyone
signed in.**

Nobody has checked which. That is what this does, and it answers it in about
fifteen minutes. **No fix is designed until we know** — the shape of the fix
depends entirely on which layer is the actual gap.

## The seven tables

| Table | Holds | Defined in |
|---|---|---|
| `bloc_messages` | Bloc Stream messages | `migrations/20260719023832_add_bloc_stream_backend.sql` |
| `bloc_message_reactions` | Stream reactions | same |
| `bloc_message_reads` | Unread tracking | same |
| `workout_log_comments` | Comments on workouts | `migrations/20260720023857_add_workout_log_comments.sql` |
| `workout_log_comment_reactions` | Comment reactions | `migrations/20260727174949_add_workout_log_comment_reactions.sql` |
| `solo_requests` | Solo mode requests | `ante-core-solo-mode.sql` |
| `revision_clock` | Change counter | `migrations/20260713040347_ante_core_revision_clock_rpc.sql` |

Six of the seven are member-generated social content. `revision_clock` is a
single bookkeeping row and is the low-stakes one.

## What the repo already tells us (and why it is not enough)

Two things found by reading the SQL in this repo:

**1. The RPC layer looks correct.** Every function over these tables follows the
same pattern — revoked from `public`, `anon` and `authenticated`, granted only
to `service_role`. If that held in production, browsers cannot call them.

**2. `ante_core` schema usage IS granted to `authenticated`.**
`ante-core-settlement-confirmations-rls.sql:1` runs
`grant usage on schema ante_core to authenticated`. So the schema door is open
to any signed-in user, and **the only thing standing between them and these
seven tables is the absence of table-level grants.** That is a thinner margin
than "the server holds the key" implies, and it is why this needs checking
rather than assuming.

Neither fact can be trusted from the repo alone: grants drift, migrations get
applied by hand, and `ante-core-solo-mode.sql` and the settlement RLS file are
not in `migrations/` at all, so what actually ran in production is unknown.
**Production is the only source of truth here.**

## Step 1 — Is `ante_core` reachable through the API at all?

Dashboard, not SQL: **Settings → API → Exposed schemas.**

- If the list is only `public` (and maybe `graphql_public`) → PostgREST cannot
  serve `ante_core` tables at any grant or RLS setting. That makes this
  defence-in-depth, not live exposure, and the whole thing drops in urgency.
- If `ante_core` is listed → continue, and treat the rest as urgent.

Record the exact list.

## Step 2 — Confirm RLS status and find every grant

Grants are read straight from the catalog with `aclexplode` rather than from
`information_schema.role_table_grants`, because that view only shows grants
involving roles the querying user belongs to — it can under-report and quietly
make a table look safe.

```sql
select
  c.relname                                              as table_name,
  c.relrowsecurity                                       as rls_enabled,
  c.relforcerowsecurity                                  as rls_forced,
  (select count(*) from pg_policies p
     where p.schemaname = 'ante_core' and p.tablename = c.relname)
                                                         as policy_count,
  coalesce(
    (select string_agg(distinct pg_get_userbyid(a.grantee) || ':' || a.privilege_type, ', ')
       from aclexplode(c.relacl) a
      where pg_get_userbyid(a.grantee) in ('anon','authenticated','public')),
    '(none)'
  )                                                      as risky_grants
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'ante_core'
  and c.relkind = 'r'
order by (c.relrowsecurity is false) desc, c.relname;
```

Note: `relacl` is null when a table has only default owner privileges, which
`coalesce` renders as `(none)` — the safe case.

**How to read it.** The dangerous combination is one row with
`rls_enabled = false` **and** `risky_grants` showing anything other than
`(none)`. That is a table a signed-in user can read or write directly,
bypassing every membership check in the app.

- `rls_enabled = false` and `risky_grants = (none)` → not reachable by
  `anon`/`authenticated`; the warning is hygiene. **Expected result.**
- `rls_enabled = true` with `policy_count = 0` → worse than it looks: that
  table is denying everyone except `service_role` right now.
- The query deliberately lists **every** `ante_core` table, not just the seven,
  so a table nobody flagged cannot hide. `settlement_confirmations` should come
  back `rls_enabled = true` with 3 policies — that one was done properly and is
  our template.

## Step 3 — Can a browser call any function that touches them?

```sql
select
  p.proname                                as function_name,
  has_function_privilege('anon',          p.oid, 'execute') as anon_can_call,
  has_function_privilege('authenticated', p.oid, 'execute') as authed_can_call
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.prosrc ilike '%bloc_messages%'
    or p.prosrc ilike '%bloc_message_reactions%'
    or p.prosrc ilike '%bloc_message_reads%'
    or p.prosrc ilike '%workout_log_comments%'
    or p.prosrc ilike '%workout_log_comment_reactions%'
    or p.prosrc ilike '%solo_requests%'
    or p.prosrc ilike '%revision_clock%'
  )
order by (has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute')) desc,
      p.proname;
```

**How to read it.** Every row should be `false, false`. Any `true` is a direct
path from a browser into these tables — and because these functions are
`security definer`, a callable one runs with **owner** privileges, so RLS would
not save us even once it is enabled. **A `true` here is the most serious
possible finding in this document.**

## Step 4 — Prove it from outside, not just from the catalog

Steps 2 and 3 describe intent. This is what an attacker would actually get.
Run from a terminal. Uses only the publishable/anon key, which is already
public in the browser bundle — no secret is involved.

```bash
curl -s -o /dev/null -w "anon direct table read -> HTTP %{http_code}\n" \
  "https://bpvvvqjsfwmmfjvvijkd.supabase.co/rest/v1/bloc_messages?select=id&limit=1" \
  -H "apikey: sb_publishable_kBqaFKIk1tbdg0OCPnuKsQ_TPTr9lKi"
```

Then repeat with `-H "Accept-Profile: ante_core"` added, which is how PostgREST
is asked for a non-default schema:

```bash
curl -s -o /dev/null -w "anon, ante_core schema -> HTTP %{http_code}\n" \
  "https://bpvvvqjsfwmmfjvvijkd.supabase.co/rest/v1/bloc_messages?select=id&limit=1" \
  -H "apikey: sb_publishable_kBqaFKIk1tbdg0OCPnuKsQ_TPTr9lKi" \
  -H "Accept-Profile: ante_core"
```

**How to read it.** `404` or `406` means PostgREST will not serve the table —
good. `401`/`403` means blocked — good. **`200` means it returned data, and
this becomes an incident**: stop, take a backup, and treat closing it as the
only priority.

Worth repeating the same two calls with a real signed-in user's bearer token
(any test account), since `authenticated` is the role that holds schema usage.
That is the case that actually matters.

## Step 5 — Write down the verdict

A short dated note in `docs/`, recording:
1. The exposed-schema list from Step 1.
2. The Step 2 table, verbatim.
3. Any `true` from Step 3.
4. The HTTP codes from Step 4, anon and authenticated.
5. **A one-line verdict: exposed, or not exposed.**

Then, and only then, the fix gets designed. The three plausible outcomes need
three different fixes:

- **Not exposed** (expected) → one additive migration enabling RLS on the seven
  with no client policies, purely so the warning is gone and a future stray
  grant cannot open anything. Low risk, but still rehearsed on staging first.
- **Exposed via table grants** → revoke the grants. Fastest real fix, and it
  does not need policies at all, since the app reaches these tables only
  through `service_role`, which bypasses RLS.
- **Exposed via a callable function** → fix the grant on that function
  immediately; it is the one case that is urgent rather than scheduled.

## Two things not to do

**Do not click Supabase's "Enable RLS" quick fix.** With RLS on and no
policies, the table denies everyone except `service_role`. If any client path
depends on direct access, Stream, comments, reactions or solo mode break the
moment it is applied. Aadhil's §3 item 5 already says this and it is correct.

**Do not copy the `settlement_confirmations` policies onto these tables.** That
table is deliberately client-readable, so it needs policies. These seven are
server-only, so the right answer is almost certainly RLS **without** client
policies — adding broad policies just to silence a warning would create the
client access that does not currently exist.

## Why staging is a prerequisite for the fix

Whatever the verdict, the migration gets rehearsed before production: apply on
a staging copy, then exercise Stream read/send/reaction/unread, workout
comments and reactions, solo mode, and a normal authenticated bootstrap. See
`docs/staging-environment-spec-2026-09-20.md`.

One open question for that rehearsal, flagged rather than guessed: the existing
`settlement_confirmations` policies subquery `bloc_members` and `profiles`,
which `authenticated` may not hold grants on. Whether those policies currently
evaluate correctly is worth confirming empirically on staging — it affects
nothing in this inventory, but it would affect any policy we write later.
