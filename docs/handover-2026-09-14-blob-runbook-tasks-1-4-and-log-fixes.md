# Handover — 2026-09-14 Blob runbook Tasks 1–4 done, and three workout-log fixes

Follows `docs/handover-2026-09-09-signin-fixes-and-delete-log-blob-divergence.md`
and closes out the Aadhil side of
`docs/blob-retirement-runbook-aadhil-side-2026-09-06.md` up to Task 5.

**Deveen: section 2 is yours. Section 3 lists what is still open on your side.**

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
