# Scaling before launch — why a few phones overloaded the database, and the plan (2026-09-15)

**Status: must be done before launch. Nothing below has been started.**
Owner for the code work: Deveen (to confirm). Server-size decision: Aadhil.

---

## Plain-English summary

On 14 September, from 22:51 to 22:53 Aadhil's time (20:51–20:53 UTC), Fero's
database was overloaded. Requests that normally take a fraction of a second took
15–44 seconds, and some failed. A comment appeared to fail, was sent again, and
now shows twice. The Bloc stream showed an unread "1" but opened empty.

It was not a crowd. Only about **2–4 phones had the app open**. The app's design
made that small group enough to overload the smallest server size:

1. Every refresh makes the server read **all members' data across all Blocs** —
   about 1.4 MB — and only then cut it down to one member's Blocs.
2. There is **one "something changed" counter for the whole app**. Any action in
   any Bloc makes **every open phone** reload everything.
3. The database runs on Supabase's smallest paid server size (**Micro**).

The load grows with *people online × actions happening × total data*, so it
grows much faster than the member count. As it stands, launch-level traffic
would not run smoothly. How many members it can handle is unknown until a load
test is run (§6).

The fix is mostly in the code: load only the member's own Blocs, give each Bloc
its own change counter, and stop sending past months on every refresh. A bigger
server is a cheap stopgap, not the fix.

---

## 1. The incident, with evidence

All times UTC, 2026-09-14. Sources: Supabase edge, Postgres and PostgREST logs;
`ante_core` tables. Vercel function logs for the window had already expired.

### What the member saw

| UTC | Event |
|---|---|
| 20:47–20:51 | Aadhil comments on six logs; all normal |
| 20:52:15 | Comment "i have to ask about the mushrooms" on Bianca's (Bianković) log `1789323323185827`, Bloc `ctrl-alt-de-feat-ocdti8` — **saved** (`48d65444-…`) |
| — | The phone did not show it as sent; he sent it again |
| 20:53:18 | Second, identical comment saved (`f89d66df-…`). Stream card `log_comment:1789323323185827` recreated with `commentCount: 2` |
| 20:54 | Database back to normal |

The stream card is created in the same database function as the comment
(`insert_ante_core_workout_log_comment` deletes and re-inserts the
`bloc_messages` row), so the card existed at 20:52:15. The delay was in reading,
not writing.

### What the server did

Requests per minute through the Supabase gateway, and response times:

| Minute | Requests | Median ms | Slowest ms | 5xx |
|---|---|---|---|---|
| 20:49 | 351 | 140 | 1,235 | 0 |
| 20:50 | 547 | 179 | 4,792 | 0 |
| **20:51** | 351 | **3,938** | **30,664** | 9 |
| **20:52** | 395 | **3,422** | **44,158** | 2 |
| **20:53** | 203 | 1,453 | 16,569 | 0 |
| 20:54 | 75 | 194 | 2,931 | 0 |

Postgres and PostgREST logs in the same window:

- `canceling statement due to statement timeout` — 7 times, all on
  `read_ante_core_month_history` (returned 500)
- `PGRST003 Timed out acquiring connection from connection pool` — 2 times;
  `read_ante_core_blocs`, `read_ante_core_profiles`, `lift_log_state` and others
  returned 504
- A trivial `pg_stat_statements` sum took **14.8 s**, and a checkpoint writing 172
  buffers took **31 s** (11 s for 113 buffers ten minutes earlier). The whole
  instance was starved, not one query.
- **No write failed.** Every 5xx was a read. `upsert_ante_core_workout_log` and
  `insert_ante_core_workout_log_comment` all returned 2xx.

In the surrounding 24 hours there were **zero** other statement timeouts or pool
exhaustions. That hour had about 3,800 requests, when other hours had a few
hundred to about 1,300.

### How many phones

The client polls `?revision=1` every 6 seconds while visible (10 a minute per open
app). Revision reads at the gateway were 18–35 a minute across 20:47–20:53,
which is **about 2–4 open apps**. Full reloads (`read_ante_core_month_history`)
ran at 13–28 a minute over the same period.

### Server size

`max_connections = 60`, `shared_buffers = 224MB`. These match Supabase's
**Micro** compute (2-core shared ARM, 1 GB RAM, 60 connections), on the Pro plan.

### What the Supabase dashboard showed (Observability → Database, 22:30–23:15 local, per minute)

Read from founder screenshots on 2026-09-15:

| Chart | Normal minutes | At 22:51 |
|---|---|---|
| CPU usage | under ~10% | **~95%, almost all IOwait**; User and System stay small |
| Memory — Free | near zero throughout; Used ~250 MB, the rest cache and buffers; no swap | unchanged |
| Memory commitment | ~1.5 GB, above the 1 GB of RAM | peaks ~1.9 GB |
| Database connections | ~15 of 60 | ~40 of 60, from 22:51 to 22:59 |
| Network throughput | low | peaks ~700 KB/s at 22:50 |

Hourly averages over the previous day showed CPU around 2% and about 4
connections. **The instance is idle most of the time and starves in bursts.**

**Reading:** the CPU was not busy computing; it was waiting on disk. With no free
memory, the burst of full-app reads went to disk, and IOwait stalled everything.
That points at memory and disk I/O, not processor speed.

---

## 2. Root causes, in the code

### 2.1 Every read loads the whole app

`fetchReadableCurrentState()` — `api/lift-log.js:3835` — runs on every `GET`
(`api/lift-log.js` ~8970) and inside mutations. It calls eight canonical readers
**with an empty body**, so each returns every Bloc's data, plus the full blob:

| Reader | Size today (2026-09-15) |
|---|---|
| `lift_log_state.state` (the blob) | 604 kB |
| `read_ante_core_month_history` | 597 kB, **grows every month** |
| `read_ante_core_current_logs` | 192 kB |
| `read_ante_core_bloc_members` | 13 kB |
| `read_ante_core_profiles` | 11 kB |
| blocs, overrides, excused/sit-outs, settlement confirmations | small |

Only afterwards does `scopeReadableStateForUser()` (`api/lift-log.js:627`) cut it
down to one member. So the cost of a refresh scales with **all of Fero's data**,
not the member's Blocs. Each Bloc added and each month closed makes every
refresh, for every member, more expensive.

### 2.2 One global revision makes every phone reload

`ante_core.revision_clock` is a single row. `bumpCanonicalRevision` runs after
every mutation (log, comment, reaction, stream message, …).

The client (`src/App.jsx:878`, `SYNC_POLL_INTERVAL_MS = 6000` in
`src/lib/appState.js:153`) polls the revision and, whenever it has moved, calls
`fetchData()` — a full `GET`. Any action in any Bloc therefore makes every open
phone, in every Bloc, run §2.1.

Load ≈ open apps × actions per minute × total data size. All three rise at launch.

The revision poll itself also does work per call: `fetchRevisionStamp()`
(`api/lift-log.js:3474`) reads the blob revision **and** calls
`read_ante_core_revision()`, which runs an `insert … on conflict do nothing`
every time. `refreshStreamUnreadCount` (`src/App.jsx:1807`) also fires on every
revision change.

### 2.3 Mutations read the whole app too

`log-comment-create` (`api/lift-log.js` ~9128) first runs
`requireAuthenticatedContext(req, payload, await getReadableCurrent())` — a full
§2.1 read — then `buildCanonicalWritableStateForAuthenticatedMutation`, then the
insert, `recordCanonicalMonthlyFeatureUsage` (up to 30 s in the incident) and
`bumpCanonicalRevision`. Adding one comment costs at least one full-app read
before it writes, and then triggers §2.2 on every open phone.

### 2.4 Short polling intervals

| Where | Interval | Calls |
|---|---|---|
| `src/components/LogCommentThread.jsx:205` | **3 s** while a thread is open | `log-comments-list` |
| `src/pages/ActivityFeed.jsx:118` | 8 s | `log-comment-counts` |
| `src/App.jsx:878` | 6 s | revision, then full `GET` on change |

Every API call also calls Supabase Auth (`/auth/v1/user`, via
`fetchAuthenticatedUser`, `api/lift-log.js:5643`) to validate the token — 180 of
those in the three bad minutes.

### 2.5 Failures are silent, so members retry

- `LogCommentThread` `submit()` removes the optimistic comment and shows an error
  only if the request fails. If the request is slow, or fails after the insert
  committed, the member reasonably sends again. **There is no duplicate guard for
  comments**, unlike `add-log` / `multi-log` (`19e3d8b`).
- `BlocStream` `refreshMessages()` returns silently on failure and keeps the
  cached list. The unread count is a separate call, so "1 unread" plus an empty or
  stale list is exactly what a member sees.

Retries add load at the worst moment. See also the playbook entries "A Failed
Mutation That Says Nothing" and "The Same Workout Saved Twice".

### 2.6 Housekeeping noticed, not a cause

`public.lift_log_backups` is 315 MB of the 344 MB database (2,475 full blob
copies). It does not slow reads directly, but it is most of the disk and cache
footprint. **Do not delete anything without a fresh backup and the founder
running the SQL.**

---

## 3. What "fixed" means

Before launch, all of these must hold:

- A refresh reads only the member's own Blocs. Its cost does not grow with the
  number of other Blocs or members.
- An action in one Bloc does not make members of other Blocs reload.
- Past months are not reloaded on every refresh.
- A load test (§6) at the agreed launch concurrency shows no statement timeouts,
  no pool exhaustion, and p95 reads under an agreed limit.
- A failed or slow comment says so, and a repeat send is not stored twice.

---

## 4. The plan, in order

Each step is independently shippable and testable. Each must follow CLAUDE.md:
mutation responses re-scoped through `persistAndScopeReadableStateForUser`,
"blob wins on doubt" when merging, "empty is not an error".

### Step 0 — Server size (stopgap, founder, dashboard only)

Supabase → project **Lift Log** → Project Settings → **Compute and Disk**.

| Size | CPU | RAM | Max connections | ~USD / month |
|---|---|---|---|---|
| Micro (today) | 2-core ARM, shared | 1 GB | 60 | ~$10 (covered by the Pro plan's $10 compute credit) |
| Small | 2-core ARM, shared | 2 GB | 90 | ~$15 |
| Medium | 2-core ARM, shared | 4 GB | 120 | ~$60 |
| Large | 2-core ARM, **dedicated** | 8 GB | 160 | ~$110 |

Prices are Supabase's published compute prices as of 2026-09-15. The $10 credit
comes off whichever size is chosen. Billing is hourly, so it can be reversed.
**A size change takes the database offline for about 2 minutes** — do it at a quiet hour.

Micro, Small and Medium share the same 2-core CPU; Large is the first dedicated
one. The dashboard (§1) showed the stall was **IOwait with no free memory**, not
CPU work. So the extra memory is what matters.

**Recommendation: Small** (2 GB). The working data is well under 350 MB, and most
of the 344 MB database is `lift_log_backups`, which live reads do not touch. So
2 GB lets the hot data sit in memory. Medium is not justified by the evidence
so far.

- **Timing:** before 1 October if possible. Month close is the next predictable
  burst (§5).
- **After upgrading:** re-check the same per-minute charts on the next busy evening.
  IOwait spikes should shrink and Free memory should no longer sit at zero.

This step buys headroom only. It does not change how load grows (§2.2).

### Step 1 — Scope reads to the member's Blocs (biggest win)

- Give the canonical readers a filter (Bloc ids or `auth_user_id`), and have the
  `GET` path resolve the member's Blocs first and read only those.
- Keep `scopeReadableStateForUser` as the final safety filter; it must still run.
- Watch the §2.1 blob fallback: while the blob is still read, scope what is read
  from it the same way, or read it only for the member's Blocs.
- Acceptance: response and database work for a member in one small Bloc do not
  change when unrelated Blocs are added.

### Step 2 — A revision per Bloc

- Replace, or add alongside, the single `revision_clock` row: a revision per Bloc,
  bumped by mutations for the Blocs they touch. Profile-level changes (name,
  photo) bump every Bloc the member is in.
- The client polls the revisions of its own Blocs only, and reloads only when one
  of those moves.
- Make the poll read-only: no `insert … on conflict` on every call.
- Acceptance: a comment in Bloc A causes zero full reloads on a phone that is
  only in Bloc B.

### Step 3 — Past months on demand

- Drop `month_history` from the default `GET`. Load it when Month or History is
  opened, or cache it per closed season — a closed month never changes.
- Careful: settlement banners, redemption notes and profile stats read closed
  months today. Inventory every reader before moving it (CLAUDE.md §7).

### Step 4 — Lighter mutations

- `log-comment-create`, reactions and stream actions should not need a full-app
  read to authorise. A membership check for the one Bloc is enough.
- Add a duplicate guard to `log-comment-create` (same commenter, log and body
  within a short window), matching `add-log`.
- Show a visible error and a retry when the stream list fails to load.

### Step 5 — Polling

- Comment thread 3 s → longer, or push via Supabase Realtime (already enabled on
  `workout_log_comments`). Pause every poll while the page is hidden.
- Consider validating the JWT locally instead of calling `/auth/v1/user` on every
  request.

### Step 6 — Blob retirement (already in progress)

Removes the 604 kB blob read from every request. This is Deveen's existing work
(`docs/blob-retirement-runbook-aadhil-side-2026-09-06.md`, and the unmerged
`blob/month-close-canonical`). Steps 1–3 should be designed with it, not against it.

---

## 5. Risks to check while doing this

- **Month rollover on read.** `fetchReadableCurrentState()` can call
  `persistState(…, "auto-rollover-read")` when a month has turned. At midnight on
  1 October, many phones refreshing at once could all try it. Confirm whether
  anything serialises that, and include it in the load test.
- **Stale or left Blocs leaking back** (playbook "Stale Or Left Blocs Reappearing
  After Mutations"). Scoping reads differently must not reintroduce them.
- **Swipe and reaction regressions** after large `App.jsx` changes — re-verify both
  against the playbook.

---

## 6. Load test — the only way to get a real number

- **Never against production.** Previews cannot reach production data (runbook
  Task 4), and must not.
- **`npm run sandbox` is not enough.** It stubs canonical readers with empty
  results, so it cannot reproduce §2.1.
- Use a restored copy: **Restore to new project** from a daily backup (proven in
  runbook Task 3, 2026-09-13), pointed at by a local API build. Delete the scratch
  project afterwards.
- Simulate N signed-in members polling on the real client intervals, with a
  realistic rate of logs, comments and reactions. Run it before and after each
  step. Record requests/minute, p50/p95 latency, statement timeouts and
  `PGRST003` counts.
- Agree the target first: how many members online at once, at launch, in the
  busiest evening hour.

---

## 7. How to re-measure

Supabase log query — per-minute load and latency (UTC window of your choice):

```sql
select toStartOfMinute(timestamp) m,
       count() n,
       countIf(toInt32OrZero(log_attributes['response.status_code']) >= 500) err5,
       quantile(0.5)(toFloat64OrZero(log_attributes['response.origin_time'])) p50,
       max(toFloat64OrZero(log_attributes['response.origin_time'])) mx
from logs
where source = 'edge_logs'
group by m
order by m
```

Timeouts and pool exhaustion per hour:

```sql
select toStartOfHour(timestamp) h,
       countIf(source = 'postgres_logs' and event_message like '%statement timeout%') timeouts,
       countIf(source = 'postgrest_logs' and event_message like '%PGRST003%') pool_exhausted,
       countIf(source = 'edge_logs') requests
from logs
group by h
order by h
```

Payload size of the full-app readers (read-only):

```sql
select 'month_history' f, pg_size_pretty(octet_length(public.read_ante_core_month_history()::text)::bigint) sz
union all select 'current_logs', pg_size_pretty(octet_length(public.read_ante_core_current_logs()::text)::bigint)
union all select 'blob', pg_size_pretty(octet_length(state::text)::bigint) from public.lift_log_state where id = true;
```

---

## 8. Not done, and why

- No code, configuration or data was changed while writing this.
- The duplicate comment on log `1789323323185827` is still there. Fero has no
  comment delete. Removing it means deleting one `workout_log_comments` row and
  fixing the stream card's `commentCount` — founder-run SQL, with a backup first.
- The server size was not changed; that is the founder's decision (§4 Step 0).
