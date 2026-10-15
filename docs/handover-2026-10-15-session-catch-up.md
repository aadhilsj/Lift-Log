# Handover — 15 October 2026 (session 3): catch-up

**Status: OPEN.** Claude, operating. **This is a live handover: it is updated as
the session goes, not written at the end.** The newest entry in §2 is the most
recent thing that happened.

Where this disagrees with an older dated handover, this wins. Where it
disagrees with `docs/WHATS-LIVE.md`, that file wins.

Previous sessions today:
`handover-2026-10-15-notification-centre-pickup.md` (**open**, written to be
picked up) and `handover-2026-10-15-month-ring-displaced-page.md` (closed).

---

## 1. Where things stood at the start

Checked, nothing touched.

- **Live website: `4f05c7e`** (last app-code commit `ebf9de5`). Production
  deployment `7092955609` for `4f05c7e` reports **success**; the live bundle is
  `index-BjQfpxxM.js` and contains both the page-track scroll guard
  (`scrollLeft`) and `profileBack`, so the app code live is `ebf9de5` as
  recorded.
- **A note on the bundle hash.** `WHATS-LIVE.md` recorded `index-DIhYQ_rD.js`
  for `ebf9de5`; live now serves `index-BjQfpxxM.js` after the two docs-only
  commits were deployed. Same app code by content check — the hash moved, the
  behaviour did not.
- CI **green** on the last five runs on `main`. **No open pull requests.**
- **TestFlight is still build 10.** None of October is on the phone app.
- **The shared checkout at `~/Documents/Codex Space/Lift Log` is 51 commits
  behind `origin/main`.** Everything here was read from `origin/main`.
- **Nothing is running** — ports 3000, 5173 and 54321 are free, no sandbox, no
  Docker.
- **Worktrees:** the shared folder (`main`, 51 behind),
  `~/Developer/FERO/blocking-2026-10-11` (on `claude/close-out-2026-10-13`),
  and the two August ones in `~/Documents` (`Lift Log Extraction`,
  `Lift Log iOS Preview`). This session added
  `~/Developer/FERO/catch-up-2026-10-15` on `claude/catch-up-2026-10-15`.
- Untracked in the shared folder, deliberately left alone: the four August
  backup disk images.
- ~20 stale local branches, most of them behind `origin/main`.

## 2. What happened, in order

### 2.1 Catch-up performed, this handover opened

Read `docs/HANDOVERS.md` §1, `docs/WHATS-LIVE.md`, the three 15 October
handovers, the 13–15 October catch-up, the 11–13 October session 2, the
11 October pickup verification, the 9 October catch-up, Deveen's active
handover including §20 (scaling), and the headings of
`recurring-debugging-playbook.md` and `solved-issues-log.md`. Checked the
workspace against `origin/main`, branches, worktrees, GitHub CI, open PRs, the
Vercel deployments and the live bundle.

Nothing was changed, built or deployed. No SQL was run. This handover and its
line in `docs/HANDOVERS.md` are the only change.

## 3. What is open, carried forward

- **The notification centre** — the one question the last session put to the
  founder and he has not answered: **does v1 need "who commented"?** The
  implementation exists on `origin/feat/settlement-note` (`5a59d6e`, 690
  insertions, 11 files, no tests), 207 commits behind `main`; the
  recommendation is to port the four new files and rewrite the wiring by hand.
  Full inventory in `handover-2026-10-15-notification-centre-pickup.md`.
- **The bell is a placeholder in the native build** — "Notifications are coming
  soon" is a real App Store submission risk, and hiding it behind
  `Capacitor.isNativePlatform()` is an hour's work independent of the centre.
- **TestFlight build 11** — never built; `main` is far past build 10, and Xcode
  is not installed on this laptop.
- **Block/report persistence is proven on `fero-staging`, not production**, and
  the API path joining the app to those functions has never been exercised in
  one run.
- **The Stream's empty state** still tests `messages.length === 0` rather than
  `visibleMessages.length === 0`, so blocking every author shows an empty list
  instead of "No messages yet". A decision, not a crash.
- **1 November month close** — the first full one since `c9ce86a`.
- **Waiting on Deveen:** scaling before launch (not started since
  15 September, and the biggest pre-launch item — read §20 of his handover), the
  RLS production rollout, `push_devices` missing from his migration,
  `fero-staging` still billing ~$9.68/month.
- `support@joinfero.app` is still unconfirmed — no test email has been sent.
- `test:auth-edge-flows` and `test:mobile-navigation` fail on `main` too.
- Cleanup candidates: the stale local branches, the two August worktrees in
  `~/Documents`, the four August `.dmg` backups, and the mockup branch
  `mockup/profile-header-2026-10-12`.

## 4. Commits this session

| Commit | What | Live |
| --- | --- | --- |
| *(this one)* | Open the 15 October catch-up handover | Docs only |
