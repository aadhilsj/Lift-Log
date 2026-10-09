# Handover — 9 October 2026: back after a week, catch-up and state of play

Claude, operating. **This is a live handover: it is updated as the session
goes, not written at the end.** The latest entry in §2 is the most recent
thing that happened.

Where this disagrees with an older dated handover, this wins. Where it
disagrees with `docs/WHATS-LIVE.md`, that file wins.

Previous session: `docs/handover-2026-10-01-session-laptop-sync.md`
(1–3 October, closed 8 October at `2e7f87b`).

---

## Where we stopped — read this first

1. **Nothing has changed since 8 October.** `origin/main` is still `2e7f87b`;
   no branch, commit or deployment anywhere in the repo is newer. Nothing
   arrived from the personal laptop, from Codex, or from Deveen during the
   week away.
2. **Live on the website:** `2e7f87b` (the app code is `473c761`; the two
   commits after it are docs only). Verified 9 October — Vercel Production
   deployment `6925431209` success, live bundle `index-Dlk5Uk0G.js` contains
   "Share your month" and "Month Off". CI green on `2e7f87b`.
3. **TestFlight is still build 10** (`77fe4d8`). The branch
   `testflight-build-11` exists (`c0157ec`, build number set, main merged in
   up to `66943f0` on 30 September) but was never built or released, and
   `main` has since moved 29 commits past it. So the phone app has none of
   1–2 October's work.
4. **In progress, not built:** the Profile tab + History-into-Month redesign.
   Approved over five mockup rounds on 3 October; spec in the previous
   handover §2.15; mockup code on `mockup/profile-tab-2026-10-03` (`3fd8956`,
   **mockup only, never merge as-is**). The last open question — "shall I
   build this for real?" — is still unanswered.
5. **Time-sensitive:** the 1 November month close is the first since the
   1 October break was fixed (`c9ce86a`). Check the founder dashboard's
   skipped-Bloc count that morning before anything else.
6. **Waiting on others:** Deveen's RLS production rollout was planned for
   2–3 October and is still not confirmed anywhere in the repo. No commit,
   branch or doc records it being applied. Needs asking.

---

## 1. Where things stood at the start (9 October, catch-up only)

Checked, nothing touched:

- `main` is level with `origin/main` at `2e7f87b` — 0 ahead, 0 behind.
- Newest ref anywhere on the remote is 8 October (`main` and
  `mockup/profile-tab-2026-10-03`). Nothing newer from any laptop or agent.
- No open pull requests. CI green on the last five runs on `main`.
- Untracked in the main folder, deliberately left alone: the four August
  backup disk images (`Fero-branding-backups-2026-08-31.dmg`,
  `Fero-private-data-2026-08-31.dmg`,
  `Fero-private-recovery-2026-08-31 2..dmg`,
  `Fero-supabase-local-2026-08-31.dmg`).
- **Worktrees:** the main folder, plus two August ones on this laptop
  (`Lift Log Extraction` on `codex/reconcile-chat-with-backend`, `Lift Log
  iOS Preview` on `codex/app-store-ios-preview`) and **two prunable stale
  entries** pointing at deleted `/private/tmp` folders
  (`fero-release-hygiene-preview`, `lift-log-founder-dashboard-main-CihJUB`).
  All four are cleanup candidates, with the founder's yes. Nothing was removed.
- ~40 stale local branches, most with their remote already gone. Not touched.

---

## 2. What happened, in order

### 2.1 Catch-up performed, handover opened

Read `docs/HANDOVERS.md` §1, the 1–3 October handover in full,
`docs/WHATS-LIVE.md`, and Deveen's active handover
(`handover-2026-09-29-for-deveen-active.md`). Checked the workspace, the
remote refs, GitHub CI, the Vercel deployments and the live bundle. Nothing
was changed, built or deployed; no SQL was run.

This handover and its line in `docs/HANDOVERS.md` are the only change so far.

### 2.2 The Profile tab mockup put back on screen

The founder asked to see the mockup again. Checked out
`origin/mockup/profile-tab-2026-10-03` (`3fd8956`) detached in a throwaway
worktree at `/Users/opera_user/Developer/FERO/profile-mockup-view`
(`node_modules` symlinked from the main folder, `.env.local` copied in), built
it, and ran the sandbox at `http://localhost:3000`. No branch was switched in
the main folder and no file in it was changed.

`npm run sandbox:seed` stopped where the previous handover §2.6 said it would —
"Rollover did not close August" — after creating the Bloc, Riley, Jo and Sam
and their logs. That is enough for the Profile tab and All Time; only
closed-month screens are out of reach. Ports 54321 and 3000 were both free on
this laptop today, so the Docker port clash from last session did not apply
and nothing was changed in `scripts/sandbox.mjs`.

Six screenshots taken at 393×852 and sent to the founder: the Profile tab top
and bottom, All Blocs, the Month tab with the Month | All Time toggle, All
Time, and the full-screen leaderboard.

**Seen again in the mockup, consistent with the previous handover's list of
things to fix in a real build:** the full-screen leaderboard shows its title
twice (a screen header and the card heading). Nothing was fixed — this is a
viewing session.

The sandbox was left running for now.

---

---

## 3. Still open (carried forward)

- **Profile tab + History into Month** — designed and approved, not built.
- **TestFlight build 11** — branch ready, never built; 29 commits behind main.
- **RLS production rollout** — Deveen's, unconfirmed since 2–3 October.
- **`push_devices` missing from the RLS migration** — Deveen's handover §1,
  still open as far as the repo shows.
- **1 November month close** — first since the `c9ce86a` fix.
- **Lazy month close** — a Bloc nobody touches sits half-closed.
- **A prorated target can exceed the full target** when a Bloc lowers it
  mid-month.
- **`read_ante_core_logs_for_month` has no test.**
- **The sandbox cannot close a month**, so closed-month screens cannot be
  rehearsed locally.
- `test:auth-edge-flows` and `test:mobile-navigation` still broken.
- **Desktop Pace Detail shows a red bar when the target is hit.**
- Large-photo ("BeReal-style") Activity view — next in the redesign queue.
- Unmerged branches not reviewed: `feat/settlement-note`, `feat/safe-area`,
  `testflight-build-11`, `claude/push-notifications-plan-2026-09-30`,
  `claude/rls-correction-2026-09-30`.
- Cleanup candidates: two prunable worktree entries, two August worktrees,
  ~40 stale local branches.

## 4. Commits this session

| | |
| --- | --- |
| *(this commit)* | docs: open the 9 October handover |
