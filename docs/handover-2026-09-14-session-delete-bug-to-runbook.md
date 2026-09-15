# Handover — Session 2026-09-09 to 2026-09-14: from the delete bug to the blob runbook

**Start here.** This is the session handover. It says what changed, what is true
now, what is open, and what was learned the hard way. It does not repeat the detail
already written elsewhere; it points to it.

| For | Read |
|---|---|
| The delete bug, month close, the parity gate's blind spot | `docs/handover-2026-09-09-signin-fixes-and-delete-log-blob-divergence.md` §2.5, §2.6, §6, §6.5 |
| Deveen's runbook results (Tasks 1–4) and the fixes, in depth | `docs/handover-2026-09-14-blob-runbook-tasks-1-4-and-log-fixes.md` |
| Rules for these bugs if they recur | `docs/recurring-debugging-playbook.md`: "A Skipped Blob Write…", "A Failed Mutation That Says Nothing", "The Same Workout Saved Twice", "Optimistic Updates Must Target The Bloc On Screen" |
| One entry per fixed bug | `docs/solved-issues-log.md`, 2026-09-13 and 2026-09-14 |

---

## Plain-English summary

The session began with one bug: deleting a workout left it in the old copy of the
data, so it kept counting against the two-a-day limit. Following it further showed
it would also have skewed month-end totals, and that Deveen's next planned step
would have made that worse.

Deveen approved the fix, and it is live. Along the way, three more workout bugs were
found and fixed; Deveen's safety runbook was completed up to the step he paused;
Fero's backups were proven to work for the first time; and preview versions of the
app were cut off from live member data.

Nothing is broken in production. The biggest item left is bringing the App Store
branch up to date: it is 69 commits behind.

---

## 1. What changed in production

### Code — all on `main`, deployed, Vercel status success

| Commit | Change |
|---|---|
| `19e3d8b` | A failed workout log says why; a repeated save (same member, date, photo) is not recorded twice |
| `6e9da32` | Deleting a multi-Bloc workout offers to remove it from every Bloc |
| `e69fb24` | A failed workout delete tells the member |
| `559d774` | `test:mobile-navigation` and `test:auth-edge-flows` run again (Playwright 1.62.1 is a devDependency) |
| `b9ca1b9`, `dbed071` | Five helper scripts no longer hard-code `/Users/opera_user/...` |
| Other commits from `37167e1` to `858ff36` | Documentation only |

### Configuration — changed by the founder, in the dashboards

| Where | Change | Undo |
|---|---|---|
| Vercel, Production `BLOB_MIRROR_SKIP_ACTIONS` | `delete-log` removed. Now `reaction,flag,flag-response,flag-review` | Add `,delete-log`, redeploy |
| Vercel, `ADMIN_PIN` | Rotated. The local `.env.local` copy from 31 Aug is stale | Rotate again |
| Vercel, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Scoped to **Production only** (were Production and Preview) | Re-tick Preview, redeploy |
| Supabase | Scratch project `fero-backup-test` created from a backup, verified, **deleted** | — |

Every Vercel change was followed by a production redeploy and a read-back through
the admin `blob-mirror-dependency-report`.

---

## 2. Decisions, and who made them

| Decision | By |
|---|---|
| Restore the `delete-log` blob mirror rather than move the cap onto canonical | Deveen, on the founder's report |
| No heal needed after the fix | Deveen; confirmed by audit (zero rows) |
| Hold runbook Task 5 | Deveen |
| Reaction mirror skip is safe | Deveen ("nothing user-facing reads them from the blob") |
| Previews cut off from production data (Task 4, Option A) | Founder |
| Ship straight to `main`, with Claude testing in the sandbox instead of the founder testing a preview | Founder ("I don't have time to test on preview") |
| Claude may run **read-only** SQL on production | Founder ("you can run this on supabase"). Writes still go to the founder |
| App Store branch catch-up goes last | Founder; App Store work is paused |

---

## 3. Verified state — 2026-09-14 02:32 UTC

| Check | Result |
|---|---|
| `main` | `858ff36`; deploy status success; live site loads, no console errors |
| Phantom audit, blob vs canonical sessions, all members and dates | **0 rows** |
| Blob revision | 2395 |
| September workout logs | 321 |
| `delete-log` blob writes since the fix | **0 — nobody has deleted yet.** Last is still 2026-07-19 |
| Test suites | All 14 runnable, including the two restored Playwright suites |
| Sandboxes | None running |

---

## 4. Open items

| # | Item | Owner | Notes |
|---|---|---|---|
| 1 | **Merge `main` into `codex/app-store-readiness`** | Founder / Codex, when App Store work resumes | 69 behind, 15 ahead. Missing every sign-in fix, including the display-name overwrite. Expect conflicts in `api/lift-log.js`, `src/pages/TodayPage.jsx`, `src/App.jsx`. Re-verify swipe and reactions afterwards (playbook) |
| 2 | Confirm the first real `delete-log` blob write | Anyone | `select max(created_at) from public.lift_log_backups where reason like 'delete-log%'` — a date after 2026-09-13 confirms deletes mirror again |
| 3 | Open-season parity check | Deveen | The gate audits closed months only; this is the net Task 5 needs |
| 4 | Runbook Task 5 sequencing | Deveen | Does `left_at` move month close onto canonical? |
| 5 | Strip quotes in the gate's `loadEnvFile()` | Deveen | |
| 6 | Delete the inert preview `BLOB_MIRROR_SKIP_ACTIONS` on `codex/create-group-canon` | Founder, if Deveen agrees | |
| 7 | `handleLogMutation` still never alerts | Future | Deletes now check `result.ok` in `deleteOwnLog`; flag actions do not |
| 8 | `test-workout-flow-local` needs a local Supabase CLI setup not in the repo | Future | Path fixed; not runnable as-is |

---

## 5. Things learned the hard way

**Vercel**

- A **Secret** variable cannot be read back, even by its owner. The edit box shows
  empty; saving it empty overwrites the value. To change part of a list, read the
  live value first — the admin `blob-mirror-dependency-report` returns
  `mirrorSkipRuntime.enabledActions` — then type the whole new value.
- An environment-variable change does nothing until a redeploy.
- `vercel env pull` quotes every value and writes secrets as the literal
  `[SENSITIVE]`, so `.env.local` is not a source of working secrets.
- "Rotate" on a Vercel variable is just "replace the value". Its checkbox about
  revoking at the issuer is written for third-party API keys.

**Supabase**

- On Database → Backups, the **Restore** buttons on the *Scheduled backups* tab
  restore **over production**. Only the *Restore to new project* tab is safe for
  testing.
- Database backups do not include Storage objects. A restore brings back every
  workout row, but not the photos.
- `bloc_members where left_at is null` counts **memberships** (55), not people. The
  founder dashboard's 45 is all accounts; 43 people are in at least one Bloc.

**The blob**

- Phantoms self-healed in busy Blocs. Another member's write to the same Bloc
  rewrote current-month logs from canonical. That is why audits found almost
  nothing, and why a quiet Bloc is where the month-close risk actually lived.
- An identical photo URL is proof of a repeated request. Every upload gets a new
  `<timestamp>-<random>.jpg` name.

**Testing without the founder**

- `npm run sandbox` hard-codes ports 3000 and 54321. To run a second sandbox beside
  one already running, launch `scripts/sandbox-supabase.mjs` and
  `scripts/local-dev-server.mjs` directly with `SANDBOX_SUPABASE_PORT`,
  `SUPABASE_URL`, `PORT` and `SANDBOX_BLOB_FILE` set, and with no `.env.local` in
  that checkout.
- **Stop sandboxes by the PID on their port, never `pkill -f` by script name.** A
  name match killed a five-day-old sandbox belonging to another session.
- The sandbox stands in for canonical with empty RPC results, so any logic that
  *reads* canonical falls back to the blob there. Canonical-read behaviour has to be
  verified from the code and production evidence, and the report must say so.
- To see a `window.alert` in the in-app browser, replace `window.alert` with a
  recorder before the action. To force a failure, wrap `window.fetch` for that
  action. Neither ships; both are test instrumentation.
- A control run against `origin/main` is what proves a test catches the bug: the
  duplicate-save scenarios reproduced both duplicates and the misleading 409 on the
  old code.
- Each change was built in its own `git worktree` from `origin/main`, so the shared
  checkout — and whatever the other agent was doing in it — was never touched.

**Counting**

- `git log a..b | head -20` is not a count. It produced "21 commits behind" for the
  App Store branch when the truth was 56. Use `git rev-list --count a..b`. Corrected
  in the 09-09 handover.

---

## 6. Working with the founder, this session

- Plain language every time, and one step at a time with a screenshot back. Long
  technical replies were repeatedly bounced with "explain simply".
- They click in Vercel and Supabase themselves. Instructions that worked named the
  exact row (for example "Production, Added Jul 13"), said what to leave alone, and
  warned before any destructive-looking button.
- They want results they can forward: a WhatsApp-ready message for Deveen with the
  handover linked.
- Mistakes were stated plainly when they happened — the killed sandbox, the wrong
  commit count. That was received fine; hiding them would not have been.
