# RLS rollout — approved, with the evidence it was waiting on

From Deveen. Reviews `20261020150000_enable_rls_on_remaining_server_only_tables.sql`
and closes out the rehearsal.

## Plain-English summary

**Both migrations are ready to apply to production.** The thing the rehearsal
was supposed to prove is already proven — by production itself, which has been
running 26 of its 40 `ante_core` tables with RLS enabled for weeks without
anyone noticing. These migrations extend a configuration that is already live
and working to the remaining 14 tables.

## 1. The second migration — reviewed, approved

No changes requested. Three things it gets right:

- **The prefix sweep is the correct call.** Naming backup tables is what went
  stale the first time; `like 'backup\_%'` scoped to `ante_core` with a
  `relrowsecurity = false` filter is idempotent and self-maintaining. The
  escape on the underscore is right too — unescaped, `_` is a single-character
  wildcard.
- **Keeping it a separate file** rather than editing mine. Correct instinct.
- **The deliberate overlap** on `backup_bloc_message_solo_note_2026_09_18`,
  handled by the `relrowsecurity = false` filter so whichever runs second skips
  it.

One note, not a blocker: **`push_devices` appears nowhere in this repo except
that migration.** Not in `api/`, not in `src/`, not in any other migration. The
comment says the API writes it with the service key; nothing in the repo does.
So it was created out-of-band and is either written by something outside this
codebase or is not wired up yet. Either way it is safe to enable — it has no
client grantees, and anything writing it with the service key bypasses RLS —
but a production table that no repo code references is worth knowing about on
its own merits, separately from this.

## 2. The evidence — stronger than the rehearsal was going to give us

Three independent facts, in increasing order of weight:

**a. Staging.** All 33 `ante_core` tables have RLS on. I ran the probe harness
against it today: **8/8 server paths OK** — Bloc Stream, unread counts, revision
clock, current logs, month history, comment counts, comments — and anon still
shut out at 404/406. So a database with RLS on across every `ante_core` table
serves every path the app uses.

*Honest caveat:* I cannot date when staging's RLS was switched on, so my
before/after comparison is not a clean A/B — both runs may have been against an
already-enabled database. The evidence is the **end state**, not the transition.

**b. Production, already.** 40 `ante_core` tables, 14 with RLS off — which means
**26 are already RLS-on with zero policies**, and the app has been serving
members on them daily. That is not a rehearsal, it is the live system. The
migrations extend a proven configuration rather than introducing a new one.

**c. The mechanism.** `service_role` carries `BYPASSRLS`; the functions over
these tables are `SECURITY DEFINER` running as the table owner, and an owner is
exempt from its own table's RLS unless `FORCE ROW LEVEL SECURITY` is set —
which neither migration sets, deliberately.

(b) is the one that settles it. Any argument that these migrations break the
app has to explain why the same configuration on 26 other tables does not.

## 3. Rollout — both files, production, in order

Take a fresh backup first (standing rule), then:

1. Apply `20260926120000_enable_rls_on_server_only_tables.sql`
2. Apply `20261020150000_enable_rls_on_remaining_server_only_tables.sql`

Then the verification, expecting **zero rows** from both:

```sql
select c.relname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'ante_core' and c.relkind = 'r' and c.relrowsecurity = false;
```

```sql
select c.relname, pg_get_userbyid(a.grantee) as grantee, a.privilege_type
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(c.relacl) a
where n.nspname = 'public'
  and c.relname like 'lift_log_projection_%'
  and pg_get_userbyid(a.grantee) in ('anon', 'authenticated');
```

Then exercise on a phone: Bloc Stream read/send/react/unread, workout comments
and reactions, solo mode, sign in, log a workout. Those are the paths that
would show a problem.

**Rollback** is per table and immediate:
`alter table ante_core.<name> disable row level security;`

**Timing:** any time except near a month boundary. 1 November is the next close
and the first full one since the 1 October fix, so either apply this week and
let it settle, or wait until the 2nd.

## 4. The recurrence problem — worth solving properly later

The sweep handles today and is honest that the fix is "re-run it after the next
backup". That works but depends on remembering, and the trigger for forgetting
is a production incident, which is when attention is elsewhere.

The structural fix is that **backup tables should not live in `ante_core` at
all.** They are not application data; they are snapshots. A separate schema —
say `ante_archive` — that is never added to the exposed list and has no grants
would make every future backup safe by construction, with no per-table RLS and
no recurring maintenance.

That is a convention change for the data-fix process, not a blocker here. Worth
adopting the next time a fix needs a backup.

## 5. After this

RLS was the last technical blocker on App Store submission. Once it is applied
and verified, staging can be deleted — and agreed with Aadhil's suggestion that
it be recreated on demand rather than left running; the restore route is proven
and takes about fifteen minutes.
