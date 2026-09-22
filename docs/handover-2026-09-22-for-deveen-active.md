# Handover for Deveen: week of 22 September (active, added to through the week)

From Aadhil, for your weekend check-out on 26–27 September. This is the one
running document for the week. New sections get added below, newest last, each
dated. Nothing here needs you before the weekend, **unless a section is marked
URGENT.**

It answers your two 20 September docs (on the unmerged branch
`docs/rls-inventory-and-staging-spec`):

- `docs/rls-inventory-2026-09-20.md`
- `docs/staging-environment-spec-2026-09-20.md`

It also lists the meeting action items that are still open.

| Section | Status |
|---|---|
| 1. RLS inventory: the verdict (your Step 5) | **Done 2026-09-22.** Not exposed. |
| 2. Two findings outside your seven tables | For you to decide |
| 3. Staging | Not built yet. Plan and cost agreed. |
| 4. Other things for you | Open |
| 5. What we need from you this weekend | |
| 6. The 22 September outage, and a fix shipped | **Fixed and live** (`9cb945c`). Two follow-ups for you. |

---

## 1. RLS inventory: the verdict (2026-09-22)

**Verdict: NOT EXPOSED.** A signed-in user cannot read or write the seven
tables, directly or through a function. This is your "expected" outcome, so the
fix is the low-risk one you described: an additive migration enabling RLS with no
client policies, rehearsed on staging first.

Steps 1 and 4 were run on the dashboard and from a terminal. Steps 2 and 3 were
run as read-only `select`s against production through the Supabase MCP. Nothing
was changed.

### Step 1: exposed schemas

The dashboard has moved. It's now **Integrations → Data API → Settings**, not
Settings → API, and it shows a count ("2 of 3 schemas exposed") that you open to
see names.

- **Exposed:** `public` and `graphql_public`.
- **`ante_core` is NOT exposed.**
- Also on that screen:
  - "15 of 52 tables exposed" (see §2.2)
  - "0 of 69 functions exposed"
  - "Automatically expose new tables" is **off**
  - Extra search path: `public, extensions`

### Step 2: RLS and browser grants (every `ante_core` table)

Your query, extended to views and to `public`. `browser_grants` means grants to
`anon`, `authenticated` or `public`.

**RLS off (all have `browser_grants = (none)`):**

| Table | Kind |
|---|---|
| `bloc_messages` | table |
| `bloc_message_reactions` | table |
| `bloc_message_reads` | table |
| `workout_log_comments` | table |
| `workout_log_comment_reactions` | table |
| `solo_requests` | table |
| `revision_clock` | table |
| `backup_bloc_message_solo_note_2026_09_18` | table (**not in your list**, see §2.1) |
| `current_member_workout_counts` | view (RLS not applicable) |
| `current_open_seasons` | view (RLS not applicable) |

**Every other `ante_core` table:** RLS **on**, 0 policies, `(none)`, except:

- `settlement_confirmations`: RLS on, **3 policies**, `authenticated:SELECT,
  authenticated:UPDATE`. That matches your template, as expected.

No `rls_enabled = true, policy_count = 0` table has any browser grant. So they
deny everything except `service_role`, which is the intended server-only model.

### Step 3: functions a browser could call

- **Every row `false, false`.**
- 22 `public` functions touch the seven tables, and all are `security definer`.
  None is executable by `anon` or `authenticated`.
- I also asked the broader question: **no function in `public` at all is
  executable by `anon` or `authenticated`.** That matches the dashboard's "0 of
  69 functions exposed".

### Step 4: from outside, with the publishable key

| Request | HTTP | Meaning |
|---|---|---|
| `bloc_messages`, default schema | 404 | "Could not find the table 'public.bloc_messages'" |
| `bloc_messages`, `Accept-Profile: ante_core` | 406 | "Invalid schema: ante_core" |
| `workout_log_comments`, `Accept-Profile: ante_core` | 406 | "Invalid schema: ante_core" |
| `public.lift_log_state` (the blob) | 401 | "permission denied for table lift_log_state" |
| `public.lift_log_projection_pending_otps` | 200 | **0 rows** (see §2.2) |
| `public.lift_log_projection_profiles` | 200 | **0 rows** |
| `public.lift_log_projection_group_logs` | 200 | **0 rows** |

**Not run:** the same calls with a signed-in user's bearer token. I'm confident it
wouldn't change the result: the 406 is PostgREST rejecting the profile because
`ante_core` isn't in the exposed list, which happens before the role is looked
at. Say if you want it run anyway.

**One correction to your doc:** it reads any `200` as an incident. The three
`200`s above returned an **empty array**, which is RLS-on-no-policy denying
rows, not a leak. Worth distinguishing "200 with rows" from "200 empty" in any
future version of the check.

---

## 2. Two findings outside your seven tables

### 2.1 An eighth `ante_core` table with RLS off

`ante_core.backup_bloc_message_solo_note_2026_09_18` is a backup taken on
18 September. It holds **1 row** of Bloc Stream message content. RLS is off, and
it has no browser grants, so it's protected exactly like the seven. Either
include it in the migration, or drop it if the backup is no longer needed
(backup first, your call).

### 2.2 The 15 "exposed" `public` tables are an abandoned June experiment

These are the 15 `public.lift_log_projection_*` tables:

- **Last touched 9 June.**
- **Not referenced anywhere in `api/` or `src/`.** Only three standalone files
  in `supabase/` mention them (`lift-log-relational-schema.sql`,
  `lift-log-read-projection-rpc.sql`, `lift-log-sync-projection-rpc.sql`).
- They hold about 280 rows of old June data. The largest are `month_logs`
  (186), `month_counts` (20), `group_logs` (18), `group_memberships` (14) and
  `profiles` (13).

They're **safe today:** RLS on, 0 policies, and strangers get empty results.
But they carry **the Supabase default full grants** to `anon` and
`authenticated`: SELECT, INSERT, UPDATE, DELETE, TRUNCATE and the rest. **RLS is
the only layer protecting them.** If RLS were ever switched off on one, or a
broad policy added to it, that table would be fully readable and writable by
anyone.

**Suggested fix, for you to decide:** revoke all `anon` / `authenticated`
grants on them, or drop them after a backup, since nothing uses them. Could go
in the same migration as the RLS work.

---

## 3. Staging: not built yet

**Aadhil will create it this week, following your spec,** so you can rehearse
the migration at the weekend. The plan and costs, checked against the Supabase
account:

- **Cost:**
  - The org is on **Pro**. Its $10 compute credit already covers production, so
    staging is extra.
  - A new project on **Micro** is **~$10/month, billed hourly** ($0.01344/hr).
  - Production is **359 MB**, so Micro should be enough. The spec's $15–25
    assumed Small.
- **Projects on a paid plan can't be paused.** A project is either running
  (billed) or deleted.
- **Plan:** a **throwaway restore.** Create it now, keep it until the RLS fix is
  live on production (about 10 days, ~$3), then delete it. Whether to keep a
  permanent staging project gets decided afterwards, based on how often it was
  needed.
- **Status of each step in your spec:** see the log at the bottom of this
  section, which gets filled in as each step is done.

**Two decisions for Aadhil, recorded here when made:**

1. The blob scrub: scrub the JSON too, or accept real names in staging's blob.
2. Whether to delete staging after the RLS rollout.

**Staging build log:**

- *(not started)*

---

## 4. Other things for you

1. **Your two branches are unmerged.**
   - `docs/rls-inventory-and-staging-spec` holds the docs this handover answers.
   - `test/month-close-allowance-regression` holds the 1 October allowance test.
   - The test is worth having on `main` **before the 1 October close.**
2. **CI does not block anything.** Your workflow runs on push to `main` and on
   PRs, but `main` has no required status checks. A failing run doesn't stop a
   merge or a deploy, and pushes to `main` deploy to Vercel before CI finishes.
   Making it a required check would mean going back to PRs. That's a process
   decision for Aadhil, so it's flagged, not changed.
3. **`npm run sandbox:seed` fails** with "Rollover did not produce a closed
   month". It still creates the Bloc and September logs.
   - **Cause unconfirmed.** One candidate is in your area: month close now skips
     a Bloc whose canonical logs are empty, and the sandbox answers every
     canonical RPC with `[]`.
   - Another session is looking at it, because settlement reminders can't be
     tested without a closed month.
4. **Open from the 20 September meeting, not yet covered by a doc:**
   - The traffic incident (five simultaneous users). This is your 09-15 scaling
     doc, still not started.
   - Checking the app's download size.
5. **Date for the RLS migration.** The meeting set 1 October for App Store
   readiness, RLS included. A date for writing it (this weekend?) and for the
   production rollout would help Aadhil plan TestFlight.

---

## 5. What we need from you this weekend

1. Write the RLS migration: the seven tables, plus the §2.1 backup table and
   the §2.2 grants if you agree.
2. Rehearse it on staging, if §3 shows staging is built.
3. Decide on §2.1 and §2.2.
4. Merge `test/month-close-allowance-regression` before 1 October.
5. Add `test:auth-outage` to the CI suite list (§6.3).
6. Look at the server region (§6.4).

*(New sections go below this line during the week.)*

---

## 6. The 22 September outage (2026-09-22)

### 6.1 What happened

A **Cloudflare incident** ("Network connectivity issues in LHR, London",
opened 02:25 UTC) made traffic from Vercel to Supabase time out.

**Timeline:**

| Time (UTC) | Time (CEST) | What happened |
|---|---|---|
| 02:14 | 04:14 | Failures start |
| 02:34 | 04:34 | Brief recovery |
| 02:41–02:50 | 04:41–04:50 | Relapse |
| 02:51 | 04:51 | Clean since |

Cloudflare's incident was still open at the time of writing.

**Evidence** (Supabase unified logs, `edge_logs`):

- **Only the app server was affected.** About 39% of requests from the Vercel
  functions (`user-agent: node`, Cloudflare colo **IAD**) returned **522/520**
  after about 19–40 s. Phones reaching Supabase directly (CMB, OSL) were fine.
- **Every service failed equally:** `/auth/v1/user`, `/rest/v1/*` RPCs and
  `lift_log_state`. That points at the network path, not PostgREST or Postgres.
- **Postgres was idle throughout:** nothing long-running, no locks, catalog
  queries instant.
- PostgREST "Thread killed by timeout manager" lines and schema-cache reloads
  appear all evening, well before 02:14. That is background noise, not the
  cause.
- No deploy was involved. The last one before the incident was `77a0def`,
  13 hours earlier.

**What users saw:**

- The founder dashboard stuck on loading.
- "Send code" failing with "Load failed".
- **Members signed out mid-use** (see §6.2).

**Data impact:**

- Checked with read-only queries straight after, and your live gate at
  03:01 UTC, blob revision 2528: **9/9 clean, 0 failures, 0 warnings.**
  - Open-season parity: 0 phantoms, 0 missing.
  - Historical workout, reaction and settlement parity across 31 closed
    months: all clean.
  - My own blob-vs-canonical comparison of the open season: **469 = 469
    logs**, none on only one side.
- **No workout write reached the database during the window.** Only two
  `record_ante_core_daily_app_activity` pings failed.
- **One workout lost.** Imadh pressed Log at 02:41 UTC, during the relapse.
  His photo uploaded to storage, but `add-log` failed before any write. There
  is no client-side retry, so the log exists nowhere. He has been asked to
  log it again. (That's what §6.5 would prevent.)

### 6.2 Root cause of the sign-outs: ours, now fixed

`fetchAuthenticatedUser` in `api/lift-log.js` turned **every** non-OK response
from `/auth/v1/user` into `401 "Your session is no longer valid"`, including
Cloudflare 522s and network errors. The client's revision poll (`fetchRevision`
/ `fetchData` in `src/lib/api.js`) then did: 401 → refresh → retry → 401 again
→ `signOutAuthSession()`. So a network outage signed members out.

**Fix, commit `9cb945c`, live 2026-09-22:**

- **Server:** only `400/401/403` from Supabase Auth mean the token was rejected
  (401). Unreachable, 5xx, 52x and 429 return a **retryable 503**. The client
  already treats non-401 failures as a sync error and keeps the session.
- **Client:** `refreshAuthSession` now **throws** on `AuthRetryableFetchError`
  or a 5xx, instead of returning `null`, because all three callers sign out on
  `null`. All three already catch, so a network-failed refresh becomes a sync
  error.
- **Verified:**
  - The new test passes, and it fails on the old code: a 522 came back as 401.
  - Lint, build and 22/24 suites pass. The two Playwright suites still can't
    run locally.
  - CI passed on the commit.
  - Checked in the sandbox: sign-in and polling still work.
  - Live: a bogus token still gets 401.

### 6.3 Please add the new test to CI

`npm run test:auth-outage` (`scripts/test-auth-outage.mjs`) drives the real
handler through each outage shape: 27 cases, offline, no credentials. It's in
`package.json`, but `ci.yml` lists its suites explicitly (your design), so it
doesn't run in CI until you add it. I left your workflow file alone.

### 6.4 Worth a look: the server is in the US, the database in Ireland

`vercel.json` sets no region, and every server request in the logs goes through
Cloudflare **IAD** (US East), so the functions appear to run in Vercel's default
`iad1`. The Supabase project is in **eu-west-1** (Ireland). Every API call makes
several transatlantic round trips. That's slower in normal use, and last night
it made the app depend on a London path.

Pinning the functions near the database, e.g. `"regions": ["dub1"]`, would cut
latency and take that path out of the loop. It seems to belong with your
scaling work (`docs/scaling-before-launch-2026-09-15.md`). **Not changed.**
Your call on whether and when, and **worth confirming the actual region in
Vercel first**, since this was inferred from the logs.

### 6.5 Proposed (not built): keep failed workout saves on the phone

Aadhil asked whether failed saves can be kept so nobody has to re-log. The copy
has to live **on the phone**. Last night the server couldn't reach the
database, so any server-side "store the failed save" would have failed the same
way. The idea is a small outbox:

- If `add-log` / `multi-log` fails on a network or 5xx error, keep the full
  payload, including the already-uploaded photo URL.
- Show "saved on your phone, will upload when you're back online".
- Retry until it lands, reusing the existing idempotency key so a save that
  actually succeeded can't duplicate.

**Hard parts:**

- The workout keeps its original date across a month boundary. A 30 September
  log retried on 1 October must still count for September, which interacts
  with month close.
- The two-a-day cap must still apply.
- What to show if the retry is finally rejected, e.g. cap reached.

Planned for **after 1 October**. Who builds it is not decided yet. Flag if you
see a reason it touches your side more than expected.
