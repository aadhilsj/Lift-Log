# Staging environment — what to create, and why it is needed now

From Deveen. This needs a paid Supabase project and Vercel configuration, both
of which only Aadhil can do, so it is written as an orderable spec rather than
something to be actioned from the repo.

## Plain-English summary

There is currently nowhere to test anything that touches the new database.
The local sandbox answers every canonical query with "no rows", so code that
reads the new tables cannot be exercised before it ships. Staging is a second,
disposable copy of the app and database where real behaviour can be rehearsed.

**The immediate reason to build it this week:** the RLS security fix cannot be
applied safely without one. Applied wrong it takes down Stream, comments,
reactions and solo mode instantly, and the only way to know it is right is to
run it somewhere real first.

## What it costs

A second Supabase project. Free tier is enough to *start*, but the restore
route below needs Pro on the source project (already have it) and the staging
project will want Small if the full production dataset is restored — call it
**~$15–25/month**, cancellable hourly.

No extra Vercel cost: preview deployments already exist and are currently
pointed at nothing.

## Why this cannot be built from `supabase/migrations/`

`supabase/migrations/` holds **31** files. `supabase/` holds **42** more
standalone `.sql` files that are not in the migrations folder at all — among
them `ante-core-solo-mode.sql` (which creates `solo_requests`, one of the seven
RLS tables) and `ante-core-settlement-confirmations-rls.sql`.

So a project built by replaying `migrations/` would be **missing objects that
exist in production**, and would rehearse the wrong thing. Do not build it that
way.

**Use the restore route instead** — it was proven on 13 September, md5-identical
across blob state, workout logs and bloc keys. It copies production exactly,
standalone-SQL drift included, which is the entire point.

## Step 1 — Create the staging database

1. Supabase → **Restore to new project** from the most recent production
   backup, into a project named `fero-staging`.
2. This is the same procedure as the 13 September backup verification, so it is
   already known to work.
3. **Known gap, carried over from that test:** Storage objects are *not* in
   database backups. Workout and profile photos will be missing. Rows referencing
   them are intact, so the app renders with broken images. Acceptable for
   rehearsing database behaviour; worth knowing before anyone reports it as a bug.
4. Auth settings, API keys and edge functions are not restored either and need
   setting up on the new project.

## Step 2 — Scrub it before anyone signs in

Staging holds real members' names, emails and messages until this is done. Run
on **staging only** — confirm the project ref in the SQL editor header first.

```sql
-- Emails first: they are the login identifier and the real privacy risk.
update auth.users
set email = 'member' || substr(md5(id::text), 1, 8) || '@staging.invalid';

update ante_core.profiles
set email = 'member' || substr(md5(id::text), 1, 8) || '@staging.invalid';

-- Display names appear throughout Stream, comments and history.
update ante_core.profiles
set display_name = 'Member ' || substr(md5(id::text), 1, 4);

-- Message and comment bodies are the other free-text member content.
update ante_core.bloc_messages            set body = '[scrubbed]' where body is not null;
update ante_core.workout_log_comments     set body = '[scrubbed]' where body is not null;
```

The blob (`public.lift_log_state.state`) also holds display names and profile
data in JSON. It is not scrubbed by the above. Either accept that staging's
blob carries real names, or rewrite it — **decide deliberately and record which.**

## Step 3 — Environment variables

All 17 the server reads. "Same" means copy production's value; **"MUST DIFFER"**
means a shared value would let staging act on production or vice versa.

| Variable | Staging value |
|---|---|
| `SUPABASE_URL` | **MUST DIFFER** — the staging project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **MUST DIFFER** — staging's key |
| `SUPABASE_ANON_KEY` | **MUST DIFFER** — staging's key |
| `SUPABASE_PUBLISHABLE_KEY` | **MUST DIFFER** — staging's key |
| `ADMIN_PIN` | **MUST DIFFER** — a staging-only PIN |
| `CRON_SECRET` | **MUST DIFFER** — a fresh random value |
| `FOUNDER_DASHBOARD_USER_IDS` | Staging auth user UUIDs (they change on restore) |
| `FOUNDER_DASHBOARD_EMAILS` | Staging emails, post-scrub |
| `BLOB_MIRROR_SKIP_ACTIONS` | Free to differ — this is where wave B/C get rehearsed |
| `WRITE_HYDRATION_PARITY_ACTIONS` | Free to differ |
| `ENABLE_SETTLEMENT_CONFIRMATIONS` | Same as production |
| `ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW` | Same as production |
| `ENABLE_LOCAL_PREVIEW_AUTH` | `false` — staging uses real auth |
| `ENABLE_LOCAL_DEV_OTP` | `true` is reasonable on staging, so sign-in does not need real email |
| `LOCAL_DEV_OTP_CODE` | A staging-only code if the above is `true` |
| `VERCEL_ENV`, `VERCEL_GIT_COMMIT_REF`, `VERCEL_GIT_COMMIT_SHA` | Set by Vercel; nothing to do |

**The single most important line in this document:** `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` must be **Preview-scoped only**. Production scope
stays exactly as it is today. Getting this wrong points previews back at
production, which is the mistake Task 4 Option A just fixed and is the leading
explanation for the orphan Blocs that stalled the September rollover.

## Step 4 — Vercel wiring

Add the staging values under **Preview** scope only:
Vercel → Project → Settings → Environment Variables → add each with only the
**Preview** box ticked.

This deliberately restores something Task 4 removed, but pointed somewhere safe.
Previews were cut off from *production* data, which was correct and stays
correct. Pointing them at *staging* data gives back a working preview without
the hazard.

**Vercel Cron note:** `vercel.json` schedules
`/api/cron-purge-app-daily-activity` daily at 03:00. Crons run on production
deployments only, so a preview-based staging never fires it. If cron behaviour
ever needs rehearsing, that needs a separate Vercel project — out of scope here.

## Step 5 — First real use: the RLS rehearsal

Staging exists so this can be done safely. Order:

1. Run the inventory from `docs/rls-inventory-2026-09-20.md` **against staging**
   as a dry run, confirming it returns the same shape as production.
2. Apply the proposed RLS migration on staging.
3. Exercise, on a preview deployment pointed at staging: Bloc Stream read,
   send, react, unread counts; workout comments and comment reactions; solo
   mode request and review; a normal sign-in and bootstrap; and logging a
   workout.
4. Only if all of that still works does production get scheduled, with a fresh
   backup and the rollback statement written down first.

## What staging is not for

Worth stating plainly, because the wrong expectation here is its own risk.

Staging makes **code paths** testable. It does **not** validate production data
consistency. Every real incident on this project — the orphan Blocs, the 93
activity logs, the delete phantoms, the phantom cap slots — was a production
*data* artifact that no staging environment would have surfaced. Those were
caught by `npm run parity:gate` reading production, and that remains the tool
for that job.

Two safety nets, two different jobs. Staging does not replace the gate.

## Verification that staging is correctly wired

Once built, these should hold:

1. A preview deployment loads and can be signed into with a staging account.
2. The admin `blob-mirror-dependency-report` on the preview URL returns the
   **staging** PIN's response, not production's.
3. `npm run parity:gate` with staging credentials runs and reports on staging
   data — a second, independent check that the two are genuinely separate.
4. **The decisive one:** make a visible change on staging (send a Stream
   message), then confirm it does **not** appear in production. If it does,
   stop immediately — the env scoping is wrong.
