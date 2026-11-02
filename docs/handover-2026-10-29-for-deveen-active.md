# Handover for Deveen: 29 October (active)

From Aadhil. This replaces
[`handover-2026-09-29-for-deveen-active.md`](handover-2026-09-29-for-deveen-active.md),
which is now closed. Most of it is answered; read it only for history, and for
the detail behind the items carried forward below.

**Everything in §1 was verified against live production on 29 October**, not
taken from the older docs. Where an older doc is now wrong, this one says so.

| | Status |
| --- | --- |
| **1. RLS rollout** | **DONE 23 Oct.** Both files applied and verified; six days in the field |
| **2. `push_devices`** | **ANSWERED.** Not out-of-band — unmerged TestFlight work |
| **3. `supabase db push`** | **FOR YOU.** Unsafe on this project. Migration history has diverged |
| **4. `fero-staging`** | **DELETED 26 Oct.** Billing stopped. One dashboard click left |
| **5. Scaling before launch** | **NOT STARTED. The biggest thing left — §5** |
| 6. Step 0, server size | **Aadhil's.** Checked 26 Oct: production is on **Nano**, not Micro |
| 7. Wave B | Unchanged, still waiting |
| 8. Carried forward | Region, offline outbox, download size, CI not blocking |
| 9. Two open bugs | Prorated target, lazy month close — both still open |
| 10. App-side database changes | 22–23 Oct, recorded so nothing surprises you |
| **11. enrico's October, 2 Nov** | **NEW. A database stall read as data loss. Three client bugs — §11** |
| **12. BEFORE THE APP STORE** | **NEW. The four things that must land before launch, and why — §12** |

---

## 1. RLS: applied, verified, and six days in the field

You approved both files in [`rls-rollout-2026-10-23.md`](rls-rollout-2026-10-23.md).
They were applied to production on **23 October**, yours first then ours.

### Result

| | Before | After |
| --- | --- | --- |
| `ante_core` tables with RLS off | 14 | **0** |
| Projection grant rows to `anon`/`authenticated` | 240 | **0** |
| `bloc_messages` / `workout_log_comments` / `solo_requests` / `push_devices` | 531 / 314 / 11 / 0 | unchanged at the time of applying |

**Both of your verification queries return zero rows.**

Checks beyond yours, all at the time of applying:

- `FORCE ROW LEVEL SECURITY` is set on **nothing** — the one setting that would
  have broken the `SECURITY DEFINER` functions.
- `read_ante_core_workout_log_comments` and
  `read_ante_core_workout_log_comment_counts` were called directly over
  newly-locked tables and still returned their rows.
- `anon` and `authenticated` hold **no execute rights** on those functions.
- Row counts unchanged; the live site returned 200 with no console errors.

### The field evidence, which beats the phone pass we planned

Aadhil and other members have used the app normally for the **six days since**
(23–29 October) with **no issues**. Measured on 29 October:

| | 23 Oct | 29 Oct |
| --- | --- | --- |
| `ante_core` tables with RLS off | 0 | **0** |
| `bloc_messages` | 531 | **551** |
| `workout_log_comments` | 314 | **326** |

Members have been writing to the newly-locked tables every day since. That is
real traffic across the Stream, comments, reactions and logging — not a
scripted probe.

**Rollback**, if ever needed, remains one statement per table:
`alter table ante_core.<name> disable row level security;`

---

## 2. ANSWERED: your `push_devices` question

You noted the table exists in production but nothing in the repo references it,
and wondered whether it was created out-of-band. **It was not — it is unmerged
work.**

`ante_core.push_devices` was created by
`supabase/migrations/20260928213116_add_push_notification_foundation.sql` in
commit `85109b1` (28 September), which **has never been merged to `main`.** It
lives only on the TestFlight lineage — `testflight-build-10`,
`testflight-build-11`, `claude/testflight-build-12-2026-10-21` and
`claude/rls-correction-2026-09-30` — together with `api/push-devices.js`,
`server/push.js`, `src/lib/pushNotifications.js`, the iOS entitlements and a
second migration `20260928214145_fix_push_device_token_validation.sql`.

So the migration reached production while the code stayed on a branch. The
table is still **empty** and nothing in the field writes to it.

---

## 3. FOR YOU: `supabase db push` is unsafe on this project

Found while preparing the rollout, and the reason the migrations were applied
through the Management API instead.

`supabase migration list` shows the repo's history and production's have
diverged by roughly **25 entries in each direction**. The cause looks
structural rather than accidental: anything applied through the MCP
`apply_migration` is stamped with the server's own timestamp, while repo files
carry hand-written ones, so the same change exists under two different version
numbers.

Clearest example — the 23 October cap migration is `20261023100000` locally and
`20261023065455` remotely.

**Consequence:** `db push` would attempt roughly 25 migrations whose content is
already live. Some are `create or replace` and harmless; others are not.

Nothing was done about it, deliberately — reconciling migration history is your
area and it needs a decision about which side is authoritative.

---

## 4. `fero-staging` — deleted 26 October

Your condition was "once this is applied and verified, staging can go". It was
met, Aadhil gave the go-ahead, and the project was deleted.

`okwrrspdmoluxatyokzh`, eu-west-1, created 24 September, `ACTIVE_HEALTHY` at
the moment of deletion. **Billing stops — roughly $9.68/month.**

**No backup was taken, deliberately.** Staging was a restored copy of the 23
September production backup with emails scrubbed; it held nothing that does not
exist in production, and the one test artefact made on it was already deleted
(`handover-2026-10-11-blocking-migration-session-2.md` §2.10). The restore
route is in `handover-2026-09-27-staging-outage-and-header.md` and takes about
fifteen minutes.

### Teardown — three of four steps done

| Step | State |
| --- | --- |
| 1. Delete the Supabase project | **done** |
| 2. Revoke the Vercel shareable link | **NOT done** — see below |
| 3. Delete the four Preview-scoped Vercel variables, and `staging/rls-rehearsal` | **done** |
| 4. Leave the Production `ADMIN_PIN` alone | **honoured** |

The four Preview-scoped variables were removed one at a time with the
environment named explicitly (`vercel env rm <name> preview`), because four
Production variables share their names. Verified afterwards — all four
Production ones survive with their original ages:

| Variable | Production | Preview |
| --- | --- | --- |
| `SUPABASE_URL` | kept, 176d | removed |
| `SUPABASE_ANON_KEY` | kept, 142d | removed |
| `SUPABASE_SERVICE_ROLE_KEY` | kept, 176d | removed |
| `ADMIN_PIN` | **kept, 182d** | removed |

Variables scoped to *both* environments (`ENABLE_LOCAL_PREVIEW_AUTH`,
`ENABLE_SETTLEMENT_CONFIRMATIONS`, `ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW`,
`ENABLE_CANONICAL_READ_COMPOSER`, `STORAGE_BACKEND`) were **not touched**.

Branch `staging/rls-rehearsal` deleted from `origin` at
`d7daa2776136735234b21b9fa1b9fefe6e0cd0f7`, after confirming it carried two
commits with **no file changes** — the empty commits that existed only to give
Vercel something to build. Restore with
`git branch staging/rls-rehearsal d7daa27 && git push origin staging/rls-rehearsal`.

**Step 2 is left for Aadhil.** There is no Vercel CLI command for shareable
links, and the only bypass entry the API exposes on this project is scoped
`automation-bypass` with `isEnvVar: true` — created 13 July, not the shareable
link, and plausibly depended on by something. It was left rather than guessed
at. **This is the link in your §3 of the old handover.** It now resolves to a
deleted database, so it cannot serve data regardless.

---

## 5. Scaling before launch — still not started, and now the only big one

**Unchanged from §20 of the previous handover, which has the full write-up**,
along with [`scaling-before-launch-2026-09-15.md`](scaling-before-launch-2026-09-15.md).
Open since 15 September. **With RLS and staging cleared, this is the one item
left that blocks launch rather than tidying up after it.**

The short version: on 14 September the database was overloaded by **two to four
phones**. Normal sub-second requests took 15–44 seconds, and one comment was
stored twice after a retry. Three things multiply:

1. Every refresh reads the whole app — all members, all Blocs, ~1.4 MB — and
   only then cuts it down to the one member asking.
2. One global "something changed" counter means any action in any Bloc makes
   **every open phone** reload everything.
3. The database is on the smallest instance available (see §6 — it is smaller
   than the old doc states).

Load grows with *people online × actions × total data*, not with member count,
and **nobody knows the real ceiling** because no load test has been run.

| Step | What | Whose |
| --- | --- | --- |
| 0 | Server size. **See §6 — this is not where the docs said it was.** | Aadhil |
| 1 | **Scope reads to the member's own Blocs.** The biggest single win. Keep `scopeReadableStateForUser` as the final filter, and scope the blob fallback the same way | **You** |
| 2 | **A revision per Bloc** instead of one global `revision_clock`, and make the poll read-only (no `insert … on conflict` on every call) | **You** |

---

## 6. Step 0 — CHECKED, and it corrects the older docs

§20 of the previous handover said *"No record exists that this was ever done —
please check the dashboard first."* Checked on 26 October, via the Management
API:

```
GET /v1/projects/bpvvvqjsfwmmfjvvijkd/billing/addons  ->  "selected_addons": []
```

No compute add-on is selected, so production runs on the **default Nano**
instance. Aadhil's dashboard says the same: **COMPUTE SIZE: NANO**.

**This corrects §20 and `scaling-before-launch-2026-09-15.md`**, which both
describe production as being on **Micro (1 GB)**. It is not — it is a size
*below* that. Micro is a paid add-on at roughly **$10/month** (2 shared cores,
1 GB, 60 direct connections) and has never been bought.

So the 14 September overload that two to four phones caused happened on an
instance **smaller** than the analysis assumed. **The real ceiling is lower
than written, not higher.**

Step 0 is Aadhil's and is a two-click job: Supabase → Project Settings →
Compute and Disk → Micro, roughly two minutes of downtime. A stopgap, not a
fix — §5 Steps 1 and 2 are the real work.

---

## 7. Wave B — unchanged

1 October closed → your four post-rollover checks → if clean, Wave B that week
→ soak 48–72h with the gate daily.

Reasoning unchanged: `add-log` and `multi-log` still mirroring to the blob is
the parallel record that made the first canonical close safe. Wave B removes
exactly that. The 1 October close held. **Note the next close, 1 November, is
three days away** — the first since the workout rules changed on 22 October.

---

## 8. Carried forward from the old handover, still open

1. **The server region** (old §6.4). Untouched.
2. **The offline outbox** (old §6.5) — keep a failed workout save on the phone
   and retry it. It touches month close: a 30 September log retried on
   1 October must still count for September.
3. **The app download size check.** Still open.
4. **CI does not block anything.** Your workflow runs on push to `main` and on
   PRs, but `main` has no required status checks, and pushes to `main` deploy
   to Vercel before CI finishes. Flagged, not changed — Aadhil's process call.
5. **The 14-minute outage of 29 September** — reliability, your area, folded
   into §5.

---

## 9. Two bugs still open, neither fixed

**Prorated target can exceed the full target** (old §15). Proration is computed
once when the admin chooses it (`src/App.jsx:3453`) and nothing recomputes it
when the Bloc target later changes — the settings-update path never touches
`season_overrides`. Active divas sat on a prorated 12 against a target of 11.
Nobody was harmed, but any Bloc that lowers its target mid-month leaves members
on a higher one. Suggested fix: recompute on target change, and clamp so it can
never exceed the full target. **A behaviour change, so it needs a decision.**

**The lazy month close** (old §13). The blob rollover is computed in memory on
every read but only persisted on a **write**, so a Bloc nobody touches can sit
half-closed indefinitely — canonical says closed, the blob still says the month
is current. On 1 October that state lasted hours and hid real settlements.
Aadhil considers it a bug, not a design, and would like the close to write
itself as soon as the month turns. **Shape is your call.**

---

## 10. App-side database changes, 22–23 October

Neither is in your area to action — recorded so nothing surprises you. Full
detail in old §21 and `handover-2026-10-23-per-activity-cap.md`.

**`read_ante_core_notification_counts` — new, 22 October.** Returns
`{ streamUnread, mentions, logComments }` in the one call the app already makes
per refresh, so the notification bell became correct at **no extra round trip**
— deliberately shaped that way because of §5.
`read_ante_core_bloc_stream_unread_count` is left in place and unchanged, so
rollback is a single `drop function`. Verified to agree with it on
`streamUnread` for all 57 active memberships.

**`upsert_ante_core_workout_log` — replaced, 23 October.** The daily cap changed
from two workouts per day to **two per activity per day**, on Aadhil's
instruction. Everything outside the cap block is byte-identical, and the
migration aborts unless the live function's md5 matches the revision it was
written against.

**Worth your eye:** the advisory lock key went from
`workout-day:<profile>:<date>` to `workout-day:<profile>:<date>:<activity>`, so
two different activities no longer serialise against each other. Every function
on production that takes an advisory lock was checked — only this one uses that
key — but you know this area better, so it is flagged rather than assumed.

**Still open and Aadhil knows:** the monthly score still counts every workout,
so a twelve-workout month can now be done in two days. He is weighing capping
the score at the first two of a day while still showing the rest. **Not built.**

---

## 11. ADDED 2 November — a member saw October disappear, and it did not come back

From Aadhil's session of 2 November. Full working in
[`handover-2026-11-02-october-sitouts-and-solo.md`](handover-2026-11-02-october-sitouts-and-solo.md)
§16–§18. This is §5 of this handover arriving in the field, plus three client
bugs that turn a database stall into something a member reads as data loss.

### What happened

A database stall, roughly **14:10–14:30 UTC on 2 November**, measured from a
laptop with network time isolated (connect 15–21 ms, TLS 33–41 ms throughout):

- `POST /api/lift-log` → **500 after 63 s**, `57014 canceling statement due to
  statement timeout`.
- The same request again → **no response inside 90 s**.
- `POST` with an unsupported action — a path that touches **no database at all**,
  the state getters at `api/lift-log.js:10106` being lazy — → the correct `400`,
  **after 68 s**. The function was waiting on a connection, not a query.
- A one-row one-column read of `lift_log_state`: **70.0 s**, then 6.1 s; later
  **29.2 s** → 4.2 → 0.25; later **13.8 s** → 6.2 → 1.3 → 0.17.
- `/auth/v1/health`: **4.8 s**.

**enrico (Ctrl Alt De-feat) reported at 15:22–15:30 Oslo = 14:22–14:30 UTC** —
inside that window: October gone from history, a "Your September Recap" banner,
signed out, a slow sign-in, and the Bloc's three Solo members showing without
their Solo marker while their counts still rendered.

### No data was lost, and the server is not at fault

| Check | Result |
| --- | --- |
| Blob, revision **3398**, last written **13:07 UTC** — *before* the stall | October present, Cutie pie excused, Rodri/Varun/Bianković solo at target 6 |
| Canonical `read_ante_core_month_history` | identical — same eight members, same flags, same counts |
| `buildCanonicalMonthHistoryForGroup` over the live rows | `2026-5 … 2026-9`, October intact |
| `scopeReadableStateForUser` **for enrico's own user id** | `2026-5 … 2026-9`, October intact, flags intact |
| Vercel runtime logs, 15:06:57–15:07:32 | 35×200, 15×204, **zero** non-2xx |

Nothing was written during or after the stall. The guards hold: both
`fetchAnteMonthHistory` (`:4421`) and `buildCanonicalMonthHistoryForGroup`
(`:2209`) return the blob on empty, and the overlay `continue`s past any month
where `canonicalCoverage < blobCoverage`. CLAUDE.md §6 is honoured end to end.

### Three client bugs — these are the ones to fix

**11.1 — The state cache is never deleted.** `LOCAL_CACHE_KEY`
(`ll_cached_data_v2`, `src/lib/appState.js:163`) is written at
`src/lib/api.js:1053` and read at `:1041`. **There is no `removeItem` for it
anywhere in `src/`.** `signOutAuthSession` (`:226`) signs out of Supabase Auth
and leaves it untouched. So signing out, signing back in, and force-quitting all
re-render the same stale copy — it can only ever be *overwritten* by a
successful apply. **This is why enrico's force-quit did not clear it.**

**11.2 — A stale screen is indistinguishable from a fresh one.** `App.jsx:1145`
renders `readCachedData()` and calls `setLoading(false)` before any network
call. `fetchData` (`src/lib/api.js:356`) returns `null` on any non-OK response,
so the 500 became `setSyncError(true)` and nothing more. **`syncError` is passed
into `Nav` (`src/pages/Nav.jsx:83`) and never used** — it appears exactly once in
that file, in the parameter list, as do `syncing`, `lastSyncedAt`,
`showJustSynced` and `onRefresh`. A grep of `src/pages` and `src/components` for
"out of date", "unable to sync", "offline", "stale" or "last synced" returns
nothing. Not a regression from the July split: `git show a79d02d^:src/app.jsx`
shows it already passed-and-unused.

Worse, `refreshNow` (`App.jsx:1060`) treats a *rejected* apply as success:
`if (!applied) setSyncError(false)`.

**11.3 — A server failure can sign a member out.** `fetchData` calls
`signOutAuthSession()` on a 401 after one failed refresh (`:379`, `:386`). Every
API call validates the token against Supabase Auth on each request (§2.4 of the
scaling doc), and Auth measured 4.8 s during the stall. An infrastructure stall
therefore presents to a member as "your session is invalid". The playbook already
states the rule — *"'I couldn't check' is never 'it is gone', just as it is never
'you are not signed in'"* — and the code does not follow it.

### Why the symptoms matched a pre-close cache exactly

enrico's cached copy predates the 1 November close:

| Symptom | Mechanism |
| --- | --- |
| October gone from history | his cached `monthHistory` ends at September; October was the *open* month in that copy |
| "Your September Recap" | September is the latest closed month in that copy |
| November header, November-looking counts | the current month comes from the device clock (`CUR_MONTH`), not the data |
| three Solo members unmarked | October's Solo is keyed `2026-9`; with the open month now `2026-10`, `isSoloForMonth` is false for all three |
| counts still rendering | counts come from the cached logs, keyed by date, not by month status |

### Not reproduced, and still open

**enrico reports it is still wrong after a force-quit, with the database
healthy.** 11.1 explains why a restart cannot clear it, but not why a *successful*
refresh has not overwritten it — the canonical revision is moving (6467 at
15:08 UTC, `last_reason` a reaction), so his poll should be seeing new revisions.
Either his fetches are still failing for a reason not visible from here, or
something else holds the apply off. **Not guessed at further.** What would settle
it, from his phone: the browser console on `lift-log-nu.vercel.app`, or the value
of `localStorage.ll_cached_data_v2`'s `meta.revision`.

The one thing that will definitely clear it, given 11.1: clearing the app's
stored site data, or deleting and reinstalling the app.

### Also for you

`fetchRevisionStamp` (`:4191`) uses `Promise.allSettled` and maps a **failed**
revision read to `0` (`:4200–4203`). The client's poll then reads
`revision <= latestRevisionRef.current` (`App.jsx:1153`) as "nothing changed" and
**returns without refetching**. A failed read is being reported to the client as
a successful "no change". Same family as everything above.

Also noted, not actioned: `fetchReadableCurrentState` performs a **write** on a
read when a rollover is pending (`:4618–4620`, `persistState(..., {rolloverOnly:
true})`) — the lazy month close in §9. Under a stall that write is exactly what
fails.

### Nothing was changed

No code, no settings, no data. **Step 0 is still Aadhil's** and is now overdue:
§6 of this handover established production runs on **Nano**, below the Micro the
September analysis assumed.

---

## 12. BEFORE THE APP STORE — Aadhil's words, and why this is now the top of the list

Aadhil, 2 November, after enrico's report:

> "If these problems continue to happen once we're in the App Store and once we
> publicly launch and we have a lot more users, this is going to be bad."

He is right, and the arithmetic is on his side. **On 14 September, two to four
phones took the database down.** The App Store means hundreds. The load grows
with *people online × actions × total data*, not with member count, so it rises
far faster than the roster does. **Nobody knows the real ceiling, because the
load test in `scaling-before-launch-2026-09-15.md` §6 has never been run.**

And this is now at least the **fourth** time members have seen a stall as data
loss: 14 September (two phones, 15–44 s requests, a comment stored twice),
22 September, 29 September (`recurring-debugging-playbook.md:650`, *"second
occurrence after 22 September"*), and 2 November. The playbook's own rule has
been written down since 29 September and the code still does not follow it:

> "'I couldn't check' is never 'it is gone', just as it is never 'you are not
> signed in'."

### The four things, in the order they should land

| # | What | Whose | Why it cannot wait for launch |
| --- | --- | --- | --- |
| 1 | **Compute: Nano → Micro** (§6) | **Aadhil** | Two clicks, ~$10/month, ~2 min downtime. Buys headroom while 3 and 4 are built. Fixes nothing on its own |
| 2 | **Surface a failed refresh** (§11.2) | **You** | The cheapest launch-blocker by a distance. The state already exists and is thrown away — `syncError` reaches `Nav` and is never rendered. This is the single thing that turns a 20-second hiccup into "the app deleted my month" |
| 3 | **Stop signing members out on a server failure** (§11.3) | **You** | A starved Auth service currently reads as "your session is invalid". Members get logged out of a working account |
| 4 | **Scope reads to the member's own Blocs, and a revision per Bloc** (§5 Steps 1–2) | **You** | The only item that stops the stalls happening. 1–3 stop them *looking* like data loss; this stops them |

Shipped on 2 November, ahead of all of the above because a member was affected:
**`d2c3870`** — `readCachedData` no longer serves a cache whose Bloc sits behind
the calendar. That removes the *wrong month*. It does **not** remove the silence,
which is why item 2 stays at the top of your list.

### One thing that is not yet understood, and matters for item 2

enrico was still wrong after a force-quit, with the database healthy and the
revision moving. §11.1 explains why a restart cannot clear the cache, but not why
a *successful* refresh had not overwritten it. If his refreshes are genuinely
still not landing, then item 2 is not cosmetic — it is the only thing that would
have told anyone, him included, what was actually wrong. **Not guessed at
further.** The evidence that would settle it is named in §11.

### A second cause of the same symptom, found while verifying the fix

The sandbox reproduces enrico's screen exactly — "NOVEMBER · DAY 2/30" above
"Your September Recap" — for a different reason: its Bloc has
`lastMonth: 2026-9` **on the server**. That is your §9 lazy month close. So the
same symptom has two causes, and the 2 November fix only addresses the client
one. A Bloc left half-closed on production would show every one of its members
the September-recap screen, and no cache fix can help that. Worth folding into
§9 when you shape it.
