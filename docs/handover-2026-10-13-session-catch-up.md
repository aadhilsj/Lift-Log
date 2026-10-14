# Handover — 13 October 2026: catch-up, and what the session goes on to do

**Status: open.** Claude, operating. **This is a live handover: it is updated as
the session goes, not written at the end.** The newest entry in §2 is the most
recent thing that happened.

Where this disagrees with an older dated handover, this wins. Where it
disagrees with `docs/WHATS-LIVE.md`, that file wins.

Previous sessions: `handover-2026-10-13-nishara-log-date-correction.md` (the
date correction, closed) and `handover-2026-10-11-blocking-migration-session-2.md`
(11–13 October, closed because it had grown too large — the profile header work
was deliberately handed on from it).

---

## Where things stood at the start

Checked, nothing touched.

- **Live website: `3c53eec`** (last app-code commit `94f1698`). Bundle
  `index--ikbohVg.js`, which contains the blocking strings and the Stream
  fix's hook-before-filter order. The live site loads with **no console
  errors**.
- **Vercel's automatic deploys have recovered.** This was the open question
  from the previous session §2.8: `3c53eec` got a Production deployment at
  14:00 UTC today and `34c225f` a Preview one at 13:59, both success, both
  automatic. Nothing had to be nudged.
- CI green on the last five runs on `main`. `e7b1dcc` shows **cancelled**,
  superseded by `0c6e9b6` a minute later; not a failure.
- **No open pull requests.**
- **TestFlight is still build 10.** None of October is on the phone app.
- **The shared checkout at `~/Documents/Codex Space/Lift Log` is 35 commits
  behind `origin/main`.** Everything here was read from `origin/main`.
- **Nothing is running** — ports 3000 and 54321 are both free, no sandbox, no
  Docker.
- **Worktrees:** the shared folder (`main`, 35 behind), the two August ones in
  `~/Documents` (`Lift Log Extraction`, `Lift Log iOS Preview`), and
  `~/Developer/FERO/blocking-2026-10-11`, which is clean and sitting on
  `claude/close-out-2026-10-13` (level with `origin/main`). This session added
  `~/Developer/FERO/catch-up-2026-10-13` on `claude/catch-up-2026-10-13`.
- Untracked in the shared folder, deliberately left alone: the four August
  backup disk images.

## 1. What is open, carried forward

- **The profile header redesign** — variant `n` chosen and **not built**; the
  mockup is on `mockup/profile-header-2026-10-12` (`34c225f`). A long name and
  iPhone SE width are unchecked on it. Read §2.11 of the previous handover
  before touching it.
- **The bigger month-switcher chevrons** — on that same mockup branch, meant
  for `main`, can go on their own at any time.
- **App Store submission week** — the agreed plan put the merge into the
  TestFlight lineage and build 12 on Wednesday. `main` has no `ios/`
  directory and **Xcode is not installed on this laptop**, so the build day
  cannot happen here.
- **Block/report persistence is proven on `fero-staging`, not production**, and
  the API path joining the app to those functions has never been exercised in
  one run.
- **The Stream's empty state** still tests `messages.length === 0` rather than
  `visibleMessages.length === 0`, so blocking every author shows an empty list
  instead of "No messages yet". A decision, not a crash.
- **1 November month close** — the first full one since `c9ce86a`.
- **Waiting on Deveen:** scaling before launch (not started, the biggest
  pre-launch item), the RLS production rollout, `push_devices` missing from his
  migration, `fero-staging` still billing ~$9.68/month.
- `test:auth-edge-flows` and `test:mobile-navigation` fail on `main` too —
  they need the app served on port 3000.
- The sandbox cannot close a month; a prorated target can exceed the full
  target; `read_ante_core_logs_for_month` has no test.
- Cleanup candidates: ~40 stale local branches, the two August worktrees in
  `~/Documents`, the four August `.dmg` backups.

## 2. What happened, in order

### 2.1 Catch-up performed, this handover opened

Read `docs/HANDOVERS.md` §1, `docs/WHATS-LIVE.md`, the two newest session
handovers in full, both 11 October handovers, the 9 October catch-up, Deveen's
active handover, `docs/solved-issues-log.md` and
`docs/recurring-debugging-playbook.md`. Checked the workspace against
`origin/main`, the branches and worktrees, GitHub CI, the open PRs, the Vercel
deployments, the live bundle and the live site's console.

Nothing was changed, built or deployed. No SQL was run. This handover and its
line in `docs/HANDOVERS.md` are the only change.

### 2.2 Variant `n` put back on screen (14 October)

The founder said yes to building the header, and asked to see the latest
mockup again first.

Checked out `origin/mockup/profile-header-2026-10-12` (`34c225f`) **detached**
in a throwaway worktree at `~/Developer/FERO/header-mockup-view`
(`node_modules` symlinked from the shared folder, `.env.local` copied in),
built it and ran the sandbox at `http://localhost:3000`. No branch was switched
in the shared folder and no file in it was changed.

`npm run sandbox:seed` stopped where it always does — "Rollover did not close
August" — after creating the Bloc, Riley, Jo and Sam and their logs. That is
the documented sandbox limitation, not a fault in the branch.

**One change to the practice data, and why.** The three header numbers
(Avg / Perfect / Won) are all derived from *closed* months, and this sandbox
has none, so all three read as a dash. Five closed months (May–September 2026)
were written into `.sandbox-data/blob.json` so the header could be seen
carrying real figures. `blob.json` was copied to the scratchpad first. **No app
code and no production data was touched**; this is local practice data only.

Three screenshots at 393x852 sent to the founder: his own profile with figures
(13.2 / 5 / 3), another member's profile, and a brand-new member's — the
empty-handed case he asked the design to be judged on.

Observed and **not** acted on, since this is a viewing step: on a brand-new
member all three figures are em-dashes, which is the honest empty state but
reads as three small gaps. Awaiting his direction.

The sandbox is still running.

## 3. Commits this session

| Commit | What | Live |
| --- | --- | --- |
| `98fcc00` | Open the 13 October catch-up handover | Docs only, on `main` |
| *(this one)* | Variant `n` back on screen for review | Docs only |
