# Handover for Deveen: week of 29 September (active)

From Aadhil. This replaces `docs/handover-2026-09-22-for-deveen-active.md`,
which is answered and closed — your 27 September rehearsal is recorded in its
§11. Read that one only for history.

**Everything here was verified against live production on 29 September, not
taken from the older docs.** Where an older doc is now wrong, this one says so.

| | Status |
| --- | --- |
| 1. **`push_devices` is missing from your RLS migration** | **Needs you before 2 Oct** — re-verified on production 30 Sep, still nine tables |
| 2. RLS production rollout | Scheduled 2–3 Oct, after the close |
| 3. The staging app pass | **No longer yours** — Aadhil is taking it |
| 4. `fero-staging` billing and teardown | Still running, ~$9.68/month |
| 5. Things you asked for that are now done | Nothing to do |
| 6. Wave B | After the 1 Oct close, unchanged |
| 7. A 14-minute total outage today | Your area — scaling/reliability |
| 8. Still open from before | Region, outbox, scaling doc, download size |

---

## 1. URGENT-ish: `push_devices` is not in your migration

Your migration
`supabase/migrations/20260926120000_enable_rls_on_server_only_tables.sql`
names **eight** `ante_core` tables:

`bloc_messages`, `bloc_message_reactions`, `bloc_message_reads`,
`workout_log_comments`, `workout_log_comment_reactions`, `solo_requests`,
`revision_clock`, `backup_bloc_message_solo_note_2026_09_18`

**Production has nine tables with RLS off.** The extra one is
**`ante_core.push_devices`**, created by
`20260928213759_add_push_notification_foundation` on 28 September — two days
after you wrote the migration, and eight days after the inventory that produced
the list.

Two consequences:

1. Applying as-is leaves `push_devices` unlocked, and it holds device push
   tokens — exactly the kind of table this exercise exists to protect.
2. **Your own verification query will report a failure on the day.** The check
   "`ante_core` tables still without RLS" is written to return zero rows; with
   `push_devices` uncovered it returns one, which will read as the migration
   having gone wrong.

**Not exposed today.** `anon` has no `USAGE` on `ante_core`, and the table
grants nothing to `anon` or `authenticated`. This is a gap in the fix, not a
live hole.

**Ask:** add it to the migration in the same guarded shape as the others. Your
migration, your call on how.

**The general point, which matters more than this one table:** the 20 September
inventory was a photograph. Tables have been added since and will be again
before 2 October. **Re-run the "which tables have RLS off" query immediately
before applying**, rather than trusting the list:

```sql
select n.nspname, c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname = 'ante_core' and not c.relrowsecurity
order by 2;
```

### Re-verified on production, 30 September — still true, plus two corrections

Ran the query above against production. **Still exactly nine tables, still
`push_devices` as the ninth.** Nothing new has been added since 28 September,
so the list in the migration is short by exactly one and no more.

**Correction to the "not exposed today" note above.** `anon` has no `USAGE` on
`ante_core`, as stated — but **`authenticated` does**:

| | |
| --- | --- |
| `anon` USAGE on `ante_core` | `false` |
| `authenticated` USAGE on `ante_core` | **`true`** |
| table grants on `push_devices` to either | **NONE** |

So what keeps `push_devices` unreachable is the **absence of table grants
alone**, not the schema barrier. For a signed-in user the schema door is
already open. That does not change the conclusion — it is still a gap in the
fix rather than a live hole — but it means the single thing standing between a
signed-in user and this table is one `GRANT` nobody has made. Worth knowing
before deciding how much the ordering on 2 October matters.

**The table is empty — 0 rows.** No device tokens exist yet, so nothing is at
risk today.

**TestFlight build 10 does not change that.** The branch `testflight-build-10`
(`77fe4d8`) merges the website work onto the app lineage and carries the push
foundation code, but push stays off: there is no APNs key, no wired permission
prompt, and the build is archived with the same no-push signing override as
build 9, with no `aps-environment` in its entitlements. **No build in the field
will write a row to `push_devices` before your migration lands.** If that ever
changes, this table stops being empty and the ordering starts to matter.

---

## 2. RLS production rollout: still 2–3 October, after the close

Unchanged and still agreed. A database change has no business landing next to
the first real canonical rollover.

**Confirmed today: nothing has been applied to production.** Nine `ante_core`
tables still have RLS off, and the 15 projection tables still carry the full
`anon`/`authenticated` grants including `TRUNCATE`. That is exactly the
pre-migration state your rehearsal expected.

Independent re-check of your safety argument against live production:

| | |
| --- | --- |
| `anon` has `USAGE` on `ante_core` | **no** |
| `authenticated` has `USAGE` on `ante_core` | yes |
| `ante_core` tables granting to `anon` | **none** |
| `ante_core` tables granting to `authenticated` | one: `settlement_confirmations` (SELECT, UPDATE), and it is the only one with real policies — 3 of them |
| Supabase security advisor | 42 × `rls_enabled_no_policy` at **INFO**, plus one irrelevant `auth_leaked_password_protection` warning (Fero has no passwords — sign-in is an emailed code) |

Before applying: a fresh backup, and the rollback line to hand.

---

## 3. The staging app pass is no longer waiting on you

Your §11 left one thing open: signing into the staging preview and exercising
Stream, comments, solo requests, sign-in and logging, end to end.

**Aadhil is taking this.** His own account (`aadhil101@gmail.com`) was
deliberately kept working on staging, so he does not need your login. Do not
plan around it.

Worth stating what it actually covers, so the decision is informed: the database
checks you and Aadhil already ran prove the locks moved and that server-side
reads still work. The click-through is the only test that exercises the
**`SECURITY DEFINER` path through the real HTTP API**. It is the cheapest
insurance available and it should still happen before 2 October — just not by
you.

---

## 4. `fero-staging` is still running and still billing

Project **`okwrrspdmoluxatyokzh`**, `ACTIVE_HEALTHY`, created 24 September,
**~$9.68/month billed hourly.** Confirmed live today.

**Do not delete it yet** — it is still needed for §3. **Delete it as soon as the
migration is on production**, or it keeps costing.

Teardown, in order (full detail in
`handover-2026-09-27-staging-outage-and-header.md`):

1. Delete the `fero-staging` Supabase project — **this is what stops the cost**.
2. Revoke the Vercel shareable link (Deployment Protection → Shareable Links).
3. Delete the four **Preview-scoped** Vercel variables and the branch
   `staging/rls-rehearsal`.
4. **Leave the Production `ADMIN_PIN` alone.**

---

## 5. Things from your last handover that are now done

Checked today, so your agent does not re-raise them:

- **`test/month-close-allowance-regression` is merged into `main`.** `main` and
  that branch no longer differ in `scripts/test-month-close-canonical.mjs`. The
  1 October allowance test is in place.
- **The runbook line is fixed.** §Task 5 of
  `blob-retirement-runbook-aadhil-side-2026-09-06.md` now reads
  `reaction,flag,flag-response,flag-review,add-log,multi-log` — `delete-log` is
  gone, as you asked.
- **`test:auth-outage` is in `ci.yml`** — you did this on 26 September.

---

## 6. Wave B: after the close, unchanged

1 October closes → your four post-rollover checks → if clean, Wave B that week
→ soak 48–72h with the gate daily.

Reasoning unchanged: `add-log` and `multi-log` still mirroring to the blob is
the parallel record that makes the first canonical close safe. Wave B removes
exactly that. Nothing is lost by waiting.

---

## 7. A 14-minute total outage today — your area

**29 September, 16:31–16:45 UTC. Every Supabase endpoint failed**, not one
path. From the edge logs:

| path | status | count |
| --- | --- | --- |
| `/auth/v1/user` | 504 | 114 |
| `/rest/v1/lift_log_state` | 504 | 43 |
| `read_ante_core_revision` | 504 | 28 |
| `read_ante_core_workout_log_comment_counts` | 504 | 22 |
| `read_ante_core_settlement_confirmations` | 504 | 21 |
| `read_ante_core_current_logs` | 500 | 20 |
| every other canonical RPC | 504 | 9–14 each |

That hour carries **346 × 504 and 56 × 500**. Every other hour of the day is
clean. A smaller window shows 4 × 500 around 05:00.

**No data was lost.** Writes during the window succeeded — four reactions
written at 16:30–16:34 are all in `ante_core.workout_reactions`. Only reads
failed. A full blob-vs-canonical comparison of every September workout, both
directions, returns zero discrepancies.

**What it cost in user terms:** reactions appeared to vanish (written fine, the
read after them failed), and comment threads spun forever rather than reporting
a failure. The second of those is now fixed and live (`e9b7704`) — a failed
comment load says so and offers a retry instead of an endless skeleton.

**Why this is yours:** this is the second outage in eight days
(22 September Cloudflare, 29 September Supabase). Both surfaced as apparent data
loss rather than as an outage. Relevant to your §6.4 (the server is in the US,
the database in Ireland — every request goes via Cloudflare IAD) and to your
09-15 scaling doc. `"regions": ["dub1"]` would remove the London path; confirm
Hobby allows region selection before planning on it.

---

## 8. Still open from before

1. **§6.4, the server region.** Untouched. After 1 October.
2. **§6.5, the offline outbox** — keep a failed workout save on the phone and
   retry it. Planned for after 1 October. Note it touches month close: a
   30 September log retried on 1 October must still count for September.
3. **The scaling doc / traffic incident** (five simultaneous users), from
   15 September. Still not started.
4. **The app download size check.** Still open.
5. **CI does not block anything.** Your workflow runs on push to `main` and on
   PRs, but `main` has no required status checks, and pushes to `main` deploy to
   Vercel before CI finishes. Flagged, not changed — it is Aadhil's process
   call.

---

## 9. One thing to know about the repo this week

`main` is about to receive a month of iPhone app work that the website has never
had — the rebuilt header, safe-area handling, screen transitions, haptics. It
has only ever run through TestFlight. None of it touches the database, the API,
or anything in your area, but it explains why `main` will move a lot this week.

`docs/WHATS-LIVE.md` is the running answer to "what is on the website versus the
phone". It is kept current; prefer it over any dated handover.
