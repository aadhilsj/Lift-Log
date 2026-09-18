# Handover — 2026-09-14 Blob runbook Tasks 1–4 done, and three workout-log fixes

Follows `docs/handover-2026-09-09-signin-fixes-and-delete-log-blob-divergence.md`
and closes out the Aadhil side of
`docs/blob-retirement-runbook-aadhil-side-2026-09-06.md` up to Task 5.

**Deveen: section 2 is yours. Section 3 lists what is still open on your side.**

> **Added after this was sent — three more items for you at the end:**
> §6, your month-close branch is ready and unmerged; §7, a database scaling
> problem that must be solved before launch —
> [`docs/scaling-before-launch-2026-09-15.md`](https://github.com/aadhilsj/Lift-Log/blob/main/docs/scaling-before-launch-2026-09-15.md);
> §8, workout activities are live, including a canonical migration — **read §8.4
> before your next canonical SQL.** §9, **your month-close branch must merge
> before 1 October, or September's activities are lost from the closed month.**
> §10, canonical-only activity backfill for June–September, a reload on every
> deploy, and two new activities — read before running parity reports.

---

## Plain-English summary

Everything Deveen asked for on Aadhil's side is done except Task 5, which stays
on hold by agreement.

- The bug where a deleted workout stayed in the old copy of the data is fixed and
  live. Nobody is left carrying a stuck workout.
- Supabase's daily backups were tested for the first time by restoring one into a
  spare project. It came back identical, record for record. Photos are the one
  thing backups do not contain.
- Preview versions of the app can no longer reach live member data.
- Four workout-log fixes shipped: a failed log now says why, a failed delete now
  says so too, the same workout can no longer be saved twice by accident, and
  deleting a workout logged to several Blocs offers to remove it from all of them.

---

## 1. State at handover

| | |
|---|---|
| `main` | `6e9da32`, deployed to production and verified loading with no console errors |
| Blob mirror skip (prod) | `reaction,flag,flag-response,flag-review` |
| Supabase / Vercel previews | cannot reach production — `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are Production-only |
| Phantom audit (blob vs canonical sessions) | zero rows after the delete fix |
| Parity gate | 18/18 offline, 8/8 live, 0 warnings (2026-09-09, rev 2304) |
| Test suites | all 14 pass, including `test:mobile-navigation` (6/6) and `test:auth-edge-flows` (2/2), fixed 2026-09-14 |
| Open branches from this work | none |

---

## 2. Runbook results — for Deveen

### Task 1 — mirror-skip flag read back from production ✅

The admin `blob-mirror-dependency-report` returned
`enabledActions: ["reaction","flag","flag-response","flag-review","delete-log"]`,
matching your 2026-09-01 reading.

Per your decision, `delete-log` was dropped from the Production value, the app was
redeployed, and the report read back
`["reaction","flag","flag-response","flag-review"]`. `ADMIN_PIN` had to be rotated
first; the copy in the local `.env.local` from 31 August no longer matched.

After the fix the phantom audit query from the 09-09 handover returned **zero
rows**, and blob and canonical each held **317** September logs. No heal was
needed.

Not yet observed: a real `delete-log` backup row since the fix, because nobody had
deleted a workout by 2026-09-14. Check with
`select max(created_at) from public.lift_log_backups where reason like 'delete-log%'`
— anything after 2026-09-13 confirms deletes are mirroring again.

### Task 2 — parity gate baseline ✅

18/18 offline, 8/8 live, 0 failures, 0 warnings, blob revision 2304.

Two things stop the gate running as the runbook describes:

- `loadEnvFile()` in `scripts/blob-parity-gate.mjs` does not strip quotes. A
  Vercel-pulled `.env.local` quotes every value, so `SUPABASE_URL` fails with
  `ERR_INVALID_URL`.
- Vercel redacts secrets on pull: `SUPABASE_SERVICE_ROLE_KEY` arrives as the
  literal `[SENSITIVE]`.

Workaround, with the key typed into the terminal and never written to disk:

```bash
cd "/Users/aadhilsj/Documents/Codex Space/Fero" && printf 'Paste your secret key, then press Enter: ' && read -rs KEY && echo && SUPABASE_URL="$(grep '^SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '"')" SUPABASE_SERVICE_ROLE_KEY="$KEY" node scripts/blob-parity-gate.mjs
```

### Task 3 — backup restore verified ✅

- Plan: **Pro**. Daily physical backups at about 07:45 UTC, at least 7 days
  retained. The Point-in-time tab exists; whether PITR is enabled was not checked.
- Restored the **2026-09-13 07:48:23 UTC** backup with **Restore to new project**
  into a scratch project, `fero-backup-test`. Production was never touched.
- Compared against production as it was at the backup moment (blob revision at
  that time taken from `lift_log_backups`; workout logs filtered by `created_at`):

| Check | Restored | Production at backup time |
|---|---|---|
| `lift_log_state.revision` | 2378 | 2378 |
| `ante_core.blocs` | 17 | 17 |
| `ante_core.profiles` | 45 | 45 |
| `ante_core.bloc_members` where `left_at is null` | 55 | 55 |
| `ante_core.workout_logs` | 1,520 | 1,520 |
| md5 of all workout logs (id, date, type, note) | `61efc6e7…` | `61efc6e7…` |
| md5 of all bloc keys | `61f2d370…` | `61f2d370…` |
| md5 of the full blob state | `5ac61068…` | `5ac61068…` (rev 2378 backup row) |

Reactions (1,357) and comments (149) were present too.

**Caveat worth knowing: Storage objects are not in database backups.** Supabase says
so on the Backups page. A restore brings back every workout row but not the photo
files. Auth settings, API keys and edge functions also need manual setup on a
restored project.

The scratch project was deleted straight after, and its deletion confirmed.

Note on counts: 55 is **memberships**. Distinct people in at least one Bloc: 43.
All accounts: 45, which is what the founder dashboard shows.

### Task 4 — previews cut off from production data ✅ (Option A)

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are now scoped to **Production
only**. After a production redeploy, the admin report confirmed production still
reads the database.

Effect: a Vercel preview can no longer read or write member data, and will not
load or sign in. Anything that writes member data is rehearsed in
`npm run sandbox` instead, which also works from a phone on the same wifi.

The stale preview-scoped `BLOB_MIRROR_SKIP_ACTIONS` on `codex/create-group-canon`
(Option B) was left in place; it is now inert and can be deleted.

### Task 5 — on hold

Unchanged. The stop condition is in the 09-09 handover §6.1: month close reads
`group.logs` from the blob, so skipping `add-log,multi-log` would freeze a partial
month, and `blob-remirror.mjs` never repairs `monthHistory`.

One finding softens that, without removing it: in active Blocs, phantoms were
cleared by the next member's write to the same Bloc (Kasper, 09-09 handover §6.5).
A quiet Bloc gets no such rescue.

---

## 3. Still open on Deveen's side

1. **Open-season parity check.** The gate audits closed months only
   (`open-season-scope`). A check comparing blob current-month log sets with
   `ante_core.workout_logs` per member per date would have caught the delete bug on
   day one, and is the safety net Task 5 needs.
2. **Gate env loader** — strip quotes in `loadEnvFile()`.
3. **Delete the inert preview `BLOB_MIRROR_SKIP_ACTIONS`** on
   `codex/create-group-canon`, if you agree.
4. **Task 5 sequencing** — does `left_at` move month close onto canonical?
5. **Database access-control audit and RLS rollout — App Store blocker.**
   This is separate from the blob-parity work, but belongs with the canonical
   database owner because it covers the same `ante_core` tables and
   service-role-only RPC model.

   **What was found (2026-09-18):** Supabase reports Row Level Security (RLS)
   disabled on seven older canonical tables: `revision_clock`, `bloc_messages`,
   `bloc_message_reactions`, `bloc_message_reads`, `workout_log_comments`,
   `workout_log_comment_reactions`, and `solo_requests`. In plain English, an
   RLS-disabled table can be directly reachable through the public Supabase
   data API if its schema and grants permit it, bypassing the app server’s
   intended membership checks. The intended design is already documented in
   this repo: browser users must not directly access `ante_core`; the app server
   uses its service-role key and the approved RPCs.

   **What was deliberately not done:** do **not** run Supabase's generic
   “enable RLS” fix directly against Production. With no matching policies or
   grants review, that could break the live Stream, comments, reactions, unread
   counts, or solo mode. This is the same caution recorded in the 2026-07-19
   App Store handover.

   **Required safe sequence:**

   1. Inventory the affected tables' exposed schema membership, table grants,
      RPC grants, and every server call site. Confirm the browser has no valid
      direct-table path and identify any legacy exception.
   2. Write one reviewable, additive migration that enables RLS and removes
      direct `anon` / `authenticated` table access while preserving only the
      server's service-role path. Do not create broad client policies merely to
      silence the Supabase warning.
   3. Apply and test it in a Supabase development copy first. Exercise Stream
      read/send/reaction/unread, workout comments/reactions, solo mode, and
      normal app bootstrap with real authentication.
   4. Only after those checks pass, schedule the production rollout with a
      current backup and an immediate rollback plan. Re-run the Supabase
      security advisor and explicitly verify that anonymous and authenticated
      roles cannot select from the seven tables or execute protected RPCs.

   **Related App Store work already live:** the new UGC safety tables
   `ante_core.user_blocks` and `ante_core.content_reports` were added on
   2026-09-16. They already have RLS enabled; direct `anon` and
   `authenticated` table/RPC access was verified denied. They are a good
   reference for the desired end-state, not a reason to rush the older-table
   rollout.

---

## 4. What shipped this session

| Commit | What |
|---|---|
| `37167e1`, `061670a` | Docs: month close reads the blob; the gate's blind spot; the Kasper and Varun cases |
| `19e3d8b` | A failed workout log says why; a repeated save is not recorded twice |
| `6e9da32` | Deleting a multi-Bloc workout offers to remove it from every Bloc |
| `e69fb24` | A failed workout delete tells the member |

### A failed log says why

`handleMultiLog` rolled back its optimistic row silently. It now alerts, as the
single-Bloc path already did. Both paths name the daily cap —
"You've already logged 2 workouts for this day." — instead of blaming the
connection.

### The same save is not recorded twice

Kasper (09-09, 37 seconds apart) and Varun (09-13, 13 seconds apart) each got two
workouts with an **identical photo URL**. Every upload gets a fresh URL, so the
same request arrived twice. Nothing in the app resends: the service worker ignores
POSTs, nothing replays on reconnect, and each save has one call site. The source
is unconfirmed; Vercel logs had expired.

`add-log` and `multi-log` now check canonical for the same member, date and photo
**before** the cap check, and answer a repeat with the current scoped state
without writing. Before the cap matters: a repeat at the limit used to return 409
to a member whose save had succeeded. The canonical writable state is now built
before the blob shadow apply, so this check can run first.

Not covered: two copies arriving within about 1.5 seconds, before the first
reaches canonical.

### Delete from every Bloc

When the deleted workout's session exists in the member's other Blocs on that
date, the confirmation offers "Also delete from Bloc B and Bloc C", ticked by
default. Each copy is removed with an ordinary `delete-log`, one Bloc at a time,
so each Bloc keeps its own target-hit retraction and blob mirror.

A latent bug fixed alongside: `handleLogMutation`'s optimistic delete wrote
`currentGroup` under `payload.groupId`, which would have swapped two Blocs' logs
on screen once deletes targeted another Bloc. It now only patches optimistically
for the Bloc on screen.

### A failed delete says so

Every delete goes through `deleteOwnLog`. When the delete in the current Bloc
fails, it now alerts "Workout couldn't be deleted. Please check your connection
and try again." and stops before touching other Blocs. `handleLogMutation` still
does not alert on its own, so any new caller must check `result.ok`.

### The two Playwright suites run again

Both imported Playwright from a path on another machine. Playwright 1.62.1 is now
a devDependency and imported by name, matching `codex/app-store-readiness`. Both
launch the installed Google Chrome, so nothing downloads a browser.

They need a running app and a member in a Bloc. Against the sandbox:

```bash
npm run build && npm run sandbox
```

Create a member in a Bloc with at least one workout (`npm run sandbox:seed`, or
the API), then, with that member's email and the Bloc's invite code:

```bash
FERO_QA_BASE_URL=http://127.0.0.1:3000 FERO_QA_EXISTING_EMAIL=seed-invite@local.test FERO_QA_INVITE_CODE=<invite code> npm run test:auth-edge-flows
```

The defaults (`seed-invite@local.test`, invite `ALHK05`) only exist in old local
data, so pass both explicitly.

### How it was tested

Every fix ran in an isolated sandbox against the real API and in the browser; the
delete confirmation was also checked at phone size. The duplicate guard was checked with 23 scenarios, and the same
scenarios run against the previous code reproduced both bugs. Lint, build and all
12 runnable suites pass. The duplicate guard's canonical read was verified by
reading the code and the production evidence, because the sandbox stands in for
canonical with empty results.

---

## 5. Next, in order

1. **Bring `codex/app-store-readiness` up to date with `main`** before any App
   Store submission. It is missing every sign-in fix, including the display-name
   overwrite. Paused with the App Store work.
2. Confirm the first real `delete-log` blob write (query in §2, Task 1).
3. ~~Helper scripts with `/Users/opera_user/...` paths~~ — fixed 2026-09-14
   (`b9ca1b9`, `dbed071`): `mobile-qa`, `capture-onboarding-journeys`,
   `render-onboarding-journey-pack`, `test-workout-flow-local` and
   `canonical-parity-report` now resolve from the checkout or the user's home. None
   remain in `scripts/`, `api/` or `src/`. `test-workout-flow-local` still needs the
   local Supabase CLI setup it was written for, which is not in the repo.

---

## 6. Update, 2026-09-14 — your month-close branch is ready and not merged

**Deveen, this section is for you.** It was added after this handover was sent.

**Plain English:** your fix that makes month close count workouts from canonical
is pushed, but there is no pull request, so it is not live. September closes on
**1 October**. We would like it reviewed and merged well before then.

| | |
|---|---|
| Branch | `blob/month-close-canonical`, one commit, `be34784` (2026-09-10) |
| Pull request | none open |
| Against `main` at `3eb43f1` | 1 ahead, 13 behind; merges with no conflicts |

### Checked on a throwaway merge into `main`

The branch was merged into `main` (`3eb43f1`) in a temporary worktree, tested,
and the worktree deleted. Nothing was pushed or deployed.

| Check | Result |
|---|---|
| `npm run test:month-close-canonical` | all checks pass |
| `npm run test:rollover-isolation` | pass |
| `npm run parity:gate:test` | 18/18 |
| `npm run test:two-workouts` | pass |
| `npm run lint`, `npm run build` | clean |

Since your branch point (`37167e1`), `main` changed `api/lift-log.js` in two
places: the daily-cap and duplicate-save check near `assertWorkoutSlotAvailable`,
and the `add-log` / `multi-log` handlers (`19e3d8b`). Neither touches
`persistState` or the rollover loop your commit changes.

**Not verified:** a real month close against production. The sandbox stands in
for canonical with empty results, so your rebuild would take its "canonical logs
empty while blob counted" skip there. The canonical-read path can only be
checked from the code and your fixture suite.

### What we need from you

1. **Open a pull request** for `blob/month-close-canonical`, or say if you want
   us to open it.
2. **Does this answer §3 item 4?** With month close reading canonical, is Task 5
   still waiting on `left_at`, or only on the open-season parity check (§3 item 1)?

---

## 7. Update, 2026-09-15 — the database cannot handle launch traffic yet

**Deveen, this section is for you too.** Full write-up:
[`docs/scaling-before-launch-2026-09-15.md`](https://github.com/aadhilsj/Lift-Log/blob/main/docs/scaling-before-launch-2026-09-15.md).

**Plain English:** on 14 September the database was overloaded for about two
minutes with only **2–4 phones** open. Every refresh reads all members' data
across all Blocs (about 1.4 MB). One app-wide change counter makes every open
phone reload after any action in any Bloc. And the server is Supabase's smallest
paid size. As built, launch traffic would not run smoothly. It needs solving
before launch, and it overlaps with blob retirement, so we would like you to own it.

- Evidence: statement timeouts on `read_ante_core_month_history`, `PGRST003`
  pool exhaustion, reads up to 44 s (20:51–20:53 UTC). No writes failed.
- Main causes: `fetchReadableCurrentState()` calls every canonical reader with an
  empty filter, and there is one global `revision_clock` row that every client
  polls every 6 s.
- Proposed order: scope reads to the member's Blocs → a revision per Bloc → past
  months on demand → lighter mutations and a comment duplicate guard → longer
  polling → blob retirement. A load test against a restored backup comes before
  and after each step.

What we need from you: read the doc, and say whether you agree with the order
and will take it on.

---

## 8. Update, 2026-09-16 — workout activities are live (canonical change inside)

**Deveen, §8.4 is the part that touches your work.** PR
[#20](https://github.com/aadhilsj/Lift-Log/pull/20), merged to `main` as
`496e5cc`, deployed to production 2026-09-15 22:36 UTC.

### 8.1 What shipped

Members now pick a specific **activity** when logging — Padel, Hiking,
Basketball, Yoga, Kitesurfing and so on — instead of only the five categories.
The log pop-up offers their five most-logged activities plus a searchable A–Z
list. The activity shows on the feed, calendars, comment screen, delete
confirmation, Bloc stream card, profile and History page, and both mix charts
count per activity.

**Every activity belongs to one of the five existing categories**, and a log's
`type` still holds that category. Bloc `acceptedWorkoutTypes`, multi-Bloc
logging, the two-a-day cap, month close and share stickers are unchanged. Only
"Other" requires a note; named Other-category activities (Hiking, Swimming) do
not. Logs saved before this show their category, so an old Sports log reads
"Sports".

### 8.2 The canonical change — already applied to production

`supabase/migrations/20260916090000_add_workout_log_activity.sql`, run on
production **2026-09-15 22:32 UTC**, before the code deploy:

| | |
|---|---|
| `ante_core.workout_logs` | new nullable `activity text` column |
| `upsert_ante_core_workout_log` | new `p_activity text default null`, appended last. The old 17-argument version was dropped (two overloads with a default make every call ambiguous) |
| `read_ante_core_current_logs`, `read_ante_core_month_history` | return `activity` |
| `insert_ante_core_workout_log_comment` | `activity` in the log_comment stream payload |

Function bodies are the **live definitions read with `pg_get_functiondef` that
morning**, with only the activity lines added. Grants are unchanged (`postgres`,
`service_role`). On conflict the column is written as
`coalesce(excluded.activity, workout_logs.activity)`: a re-save that does not
carry an activity — a flag, a repair script, older code — never erases a stored
one.

Verified on production after the run: one upsert version, grants intact, all
1,577 logs unchanged, both readers returning `activity`, no errors in the
Postgres, PostgREST or edge logs.

### 8.3 How it was tested before touching production

- The 2026-09-15 backup was restored into a scratch project
  (`fero-activity-test`, deleted straight after) and the migration applied there
  first.
- Against that copy: 12/12 end-to-end checks on the new code (add-log,
  multi-log, a Bloc without Sports refusing a sport, the Other note rule, the
  daily cap, the comment card payload, profile stats, delete, existing logs
  untouched).
- **The then-deployed `main` (`8156ef3`) was run against the migrated copy too**
  — add-log, multi-log, cap, comment and delete all worked. That is what made
  SQL-before-deploy safe.
- `npm run parity:gate` against the copy: **8 checks, 0 failures, 0 warnings.**
- Lint, build and all 14 suites, including the new `npm run test:activities`,
  which fails if the app's activity list and the server's copy ever drift.

### 8.4 What this means for your work

1. **Your next canonical SQL must build on the current definitions.** Those four
   functions now carry `activity`. Recreating any of them from an older copy
   would silently drop it from reads — no data lost (the column keeps it), but
   activities would stop appearing. `pg_get_functiondef` is the source of truth;
   the repo migration above matches production exactly.
2. **`scripts/blob-remirror.mjs` now carries `activity`** in `LOG_FIELDS`, so a
   re-added log keeps it. Its self-test still passes 13/13.
3. **`blob/month-close-canonical` merges cleanly with this** and picks activities
   up for free: it rebuilds the closing snapshot from `fetchAnteCurrentLogs`,
   which now includes `activity`. Nothing to change there.
4. **Known and accepted:** if code without this change writes while activities
   exist (a deploy overlap, or a rollback), the **blob** copy of the logs loses
   `activity` — canonical keeps it, and the next write by current code restores
   the blob. Both directions were observed on the scratch project.

### 8.5 Still open

- Activity icons are placeholders (Tabler, MIT; Padel drawn by hand) until the
  Fero set is ready. One entry each in `src/lib/workoutIcons.js`.
- Share stickers still render the category icon. Their design is locked
  (`docs/share-sticker-reference/`), so that is the founder's call.

---

## 9. Update, 2026-09-16 — September's activities depend on your month-close branch

**Deveen, this section is for you.** It was added after this handover was sent.

**Plain English:** the activities filled in for September only reached
canonical. The blob copy of 93 September logs has no `activity`. When September
closes on **1 October**, `main` freezes the month from the blob, so those
activities would be lost from the closed month for good, and September's share
sticker would show category icons. Your branch freezes the month from canonical
instead, which keeps them. So `blob/month-close-canonical` now matters for two
reasons: correct counts, and keeping September's activities.

### What was found (read-only queries on production, 2026-09-16)

| September logs (`2026-09-*`) | Rows |
|---|---|
| Total, blob and canonical | 360 each |
| `activity` set in canonical | 114 (the 112-row backfill + 2 new logs) |
| `activity` set in the blob | 21 |
| Joined on `id`: canonical has it, blob does not | **93** |
| Blob has it, canonical does not | 0 |

The backfill (`docs/handover-2026-09-16-activities-live.md` §4) was SQL on
`ante_core.workout_logs` only. It is not the deploy-overlap case in §8.4 item 4,
where the next write restores the blob: nothing rewrites these logs unless a
member touches them.

### Why it is invisible today

`fetchReadableCurrentState()` overlays current-month logs from
`fetchAnteCurrentLogs()` for every group with a canonical open season
(`api/lift-log.js`, the `anteCurrentLogs` block). Members see the activities now.
The blob only matters when the month is frozen.

### Why it matters at month close

- On `main`, rollover builds the snapshot from the blob:
  `logsByUser: buildMonthLogsSnapshot(group.logs, relevantNames)`.
- On `blob/month-close-canonical`, `rebuildClosedMonthSnapshotFromCanonicalLogs`
  rebuilds `logsByUser` from `fetchAnteCurrentLogs()`. That reader carries
  `activity`, and `normalizeLogEntry` keeps it. Traced in the code, not run
  against a real close.
- Share stickers are offered on closed months only (`canShareMonth` in
  `src/pages/PlayerProfile.jsx`) and read `monthHistory[].logsByUser`.

### Your branch, re-checked against today's `main`

Merged into `main` at `a2c30a2` in a throwaway worktree, tested, then deleted.
Nothing was merged, pushed or deployed.

| Check | Result |
|---|---|
| Merge | no conflicts |
| `npm run lint`, `npm run build` | clean |
| 14 of 16 suites, including `test:month-close-canonical`, `test:rollover-isolation`, `test:activities` | pass |
| `test:auth-edge-flows`, `test:mobile-navigation` | fail, **identically on plain `main`**: a fresh sandbox has no `seed-invite@local.test` account. The test setup, not your branch |

### If the branch cannot merge before 1 October

The fallback is `node scripts/blob-remirror.mjs --scope wave-b` before the close.
It copies current-month logs from canonical into the blob, `activity` included.
Not run: `.env.local` holds a redacted service key. It replaces whole
current-month log sets, not just `activity`, so read the dry-run diff first and
take a fresh backup before `--apply`.

### Also since §8

- Share stickers showing the activity icon are in PR
  [#21](https://github.com/aadhilsj/Lift-Log/pull/21) (`feat/sticker-activities`),
  preview only. Checked against the 12 approved PNGs: 7–65 opaque pixels differ
  out of 1,218,240, the rest is anti-aliasing. This replaces the second bullet of §8.5.
- Two members have logged through the new picker, both `Gym`, both still present
  in blob and canonical.

### What we need from you

1. **Merge `blob/month-close-canonical` before 1 October**, or tell us if you
   cannot, so the fallback above can be run in time.

---

## 10. Update, 2026-09-17 — backfill, reload on deploy, Squash and Dance

**Deveen, this section is for you.** It was added after this handover was sent.
Full detail: `docs/handover-2026-09-17-squash-dance-reload-and-backfill.md`.

**Plain English:** 246 past workouts (310 rows) from June to September were given
their activity in canonical only, from notes the founder approved one by one.
Nine of them also moved category. Counts and payments are unaffected. Separately,
an open app now reloads once when a new version is deployed, and Squash and Dance
were added.

1. **The blob is further behind canonical.** June–August `monthHistory` in the
   blob keeps the old `type` and has no `activity` on those rows. The readable state
   shows canonical wherever `buildCanonicalMonthHistoryForGroup` accepts the month.
   For September, three more current-month rows (Coach P, Varun ×2) join the 93
   in §9, and they depend on your month-close branch the same way.
2. **`scripts/canonical-parity-report.mjs` will flag 10 rows.** It keys logs on
   `workout_type`, and these category moves are intentional:
   - Varun 27 Jun: Other → Sports
   - Bananaaaa 15 and 17 Aug: Other → Sports
   - Rishane 15 Aug, 2 Blocs: Sports → Other
   - Nishara 6, 14 and 25 Jun: Other → Run
   - Monika 8 Aug: Other → Gym
   - Bianković 11 Jul: Sports → Other

   `scripts/blob-parity-gate.mjs` does not compare category and is unaffected.
3. **Every deploy now makes open apps reload once** (idle 20 s, no save or filled
   form, once per session). Each reload is a full state load, so expect a small
   burst after each release. Relevant to the scaling plan, and a reason not to
   deploy on top of month close.
4. **`GET /api/lift-log?revision=1` now includes `build`** (`VERCEL_GIT_COMMIT_SHA`).
5. **`ACTIVITY_CATEGORIES` gained `Squash: "Sports"` and `Dance: "Other"`.**
6. **New table `ante_core.backup_activity_backfill_2026_09_17`** (RLS on). It is the
   undo for the backfill. Do not carry it into migrations; the founder will decide
   when to drop it.

---

## 11. Update, 2026-09-18 — request cancel, two new RPCs, Solo joins payments in November

**Deveen, this section is for you.** It was added after this handover was sent.
Full detail: `docs/handover-2026-09-18-settings-redesign-and-solo-unlock.md`.

**Plain English:** members can now cancel their own pending sit-out or Solo
request, and Solo after day 10 is a request instead of being blocked. Nothing
here needs action from you beyond the month-close merge. Your branch still
merges cleanly with today's `main` (`b4bc285`), and `test:month-close-canonical`,
`test:rollover-isolation` and `test:activities` pass on the merge.

1. **Two new production RPCs:** `delete_ante_core_sit_out_request(text, text, text)`
   and `delete_ante_core_solo_request(text, text, text)`. They delete **pending**
   rows only, for (legacy group key, month key, display name), and are granted to
   `postgres` and `service_role` only. Migration:
   `supabase/migrations/20260918090000_delete_request_rpcs.sql`, applied
   2026-09-18. No data changed.
2. **Two new actions, `sitout-cancel` and `solo-cancel`.** They compute from
   canonical writable state, delete canonically, then mirror through
   `persistAndScopeReadableStateForUser`, so the request disappears from both.
   They are not in `WRITE_HYDRATION_PARITY_DEFAULT_ACTIONS` or the mirror-policy
   lists; add them if you want parity probes on them.
3. **`solo_requests` gets more pending rows**, because every Solo after day 10 is
   now a request. It is one of the seven RLS-disabled tables in item 5 above.
4. **Heads-up for November:** Solo members will join the penalty from
   1 November. They'll have an automatic reduced target, pay the normal penalty
   if they miss it, and can never win the pot. That changes `calcPenalties`,
   `buildDefaultSettlements`, `isExemptFromStakes` and month close. It will be
   built on top of your branch after it merges, not alongside it.

---

## 12. Update, 2026-09-18 (later) — Solo payments shipped now, and an activity regression

**Deveen, this section is for you.** Details:
`docs/handover-2026-09-18-solo-new-rules.md`.

1. **§11 item 4 is superseded.** The founder moved the new Solo rules to
   **now**, not November, and they are live on `main` (`f7356aa`). They were not
   built on your branch. `origin/blob/month-close-canonical` still merges into
   today's `main` with no conflicts (checked with `git merge-tree`, nothing
   written). Your `rebuildClosedMonthSnapshotFromCanonicalLogs` keeps
   `snapshot.solo` and calls `buildDefaultSettlements`, so it inherits the new
   rules as is.
2. **What changed in your area:**
   - A new-rules Solo entry is `{ target, rule: "standard_penalty" }`; no marker
     means old rules. From October (`"2026-9"`) every Solo is new-rules by month.
   - Canonical has no rule column, so the marker is carried from the blob in
     `rolloverGroupIfNeeded`, `normalizeMonthHistory`,
     `buildCanonicalMonthHistoryForGroup` (from `blobMonth`),
     `fetchReadableCurrentState` and `buildCanonicalWritableStateForGroup`.
     If blob retirement replaces any of these, the September marker has to come
     with it (or add a `solo_rule` column).
   - `buildDefaultSettlements` now adds each new-rules Solo miss at the flat
     `fineAmount` via `addStandardSoloPenalties`; Solo never joins
     `calcPenalties`. Test: `npm run test:solo-standard-penalty`.
3. **Activity regression, fixed:** the App Store session's
   `add_workout_post_moderation` migration (applied 2026-09-18 04:06 UTC)
   rebuilt `read_ante_core_current_logs` from a pre-activity copy, which is the
   exact case §8.4 warned about. It was restored by
   `20260918120000_restore_activity_in_current_logs.sql`. It matters to you
   because your month close reads `fetchAnteCurrentLogs`: had it stayed broken
   until 1 October, September would have closed without activities.
4. **RLS, for your rollout (§3 item 5):** checked read-only on production. The
   seven RLS-disabled tables grant nothing to `anon` or `authenticated`, and
   `anon` has no usage on `ante_core`. So the exposure is currently nil, and
   enabling RLS with no policies should not affect the server
   (service_role and the security-definer RPC owner bypass RLS). It still wants
   your test-copy run. Separately, the old `public.lift_log_projection_*` tables
   grant `anon` select/update but have RLS on with zero policies, so they deny
   everything; they hold stale early data and are candidates to drop.
