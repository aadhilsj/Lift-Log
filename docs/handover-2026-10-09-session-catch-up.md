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

### 2.3 Mockup change: the profile header is one row, not a stack

The founder is happy with the design but said the photo had too much empty
space round it, making the screen taller than it needs to be. He asked for the
photo left-aligned (same size or slightly smaller), vertically centred, with
the This Bloc / All Blocs buttons beside it.

Built in the mockup worktree only, in `src/pages/PlayerProfile.jsx`:

- the header is now a row — photo on the left at the same 68px, then a column
  holding the name (left-aligned) above the toggle;
- the toggle moved inside that column and fills its width, instead of being a
  separate centred 260px row below the name;
- "‹ Back" (other members' profiles only) is now in the row rather than
  absolutely positioned, where it would have sat on top of the photo.

**Measured at 393×852, same screen, before and after:**

| | before | after |
| --- | --- | --- |
| header block | 99px + a 28px toggle row below | **70px**, toggle included |
| top of the first card | y 351 | **y 282** |

**69px of vertical space saved**, and the ring card and the whole calendar now
fit on the first screen without scrolling. No horizontal scroll
(`scrollWidth` 393 = `clientWidth` 393).

**Long names:** with "Kofi Mensah-Owus" (16 characters) on another member's
profile — the tighter case, because "‹ Back" also takes room — the name stays
on one line and ends 16px from the right edge, exactly on the page padding. A
longer name wraps to a second line and the header grows; on your own profile
there is about 40px more room.

`npm run lint` on the file and `npm run build` both pass. **Nothing is
committed** — the change lives in the throwaway worktree only, and `main` and
the mockup branch are untouched.

---

### 2.4 Mockup change: photo level with the buttons, name centred over them

Second round on the same header. The founder asked for the photo to be
vertically centred against the This Bloc / All Blocs buttons (not against the
whole name-plus-buttons block), and the name horizontally centred over the
buttons.

How it is done, so a real build does not re-derive it: the header is a column
with `paddingLeft: 82` (photo 68 + 14 gap); the name is centred inside that
padded column, so it centres over the buttons; the photo is absolutely
positioned against the buttons' own wrapper with
`right: calc(100% + 14px); top: 50%; transform: translateY(-50%)`, so it
centres on the buttons with no hard-coded offset, and `paddingBottom: 22`
keeps the part of the photo that hangs below the buttons clear of the month
pill. "‹ Back" (other members' profiles) moved onto its own line above,
because the photo now occupies the top-left corner.

**Measured at 393×852:**

| | |
| --- | --- |
| photo centre / buttons centre | y 186 / y 186 — exactly level |
| name centre / buttons centre | x 238 / x 238 — exactly centred |
| photo left edge | x 16, flush with the page padding |
| header block | 81px (was 99px + a 28px row in the original) |
| top of the first card | y 292 (original y 351) |
| horizontal scroll | none (`scrollWidth` 393 = `clientWidth` 393) |

A 16-character name ("Kofi Mensah-Owus") still sits on one line. Net saving
against the original header: **59px**.

`npm run lint` on the file and `npm run build` pass. **Still uncommitted
mockup work** in the throwaway worktree; `main` and the mockup branch are
untouched.

---

### 2.5 Answered: what "Money settled" actually counts

The founder asked whether the figure counts every loser, or only settlements
confirmed as paid and received. Read from the code, not assumed:

`totalSettled` in `src/pages/HistoryPage.jsx` sums
`buildSettlementPairsForMonth(...)` over every closed month.
`buildSettlementPairsForMonth` (`src/lib/appState.js:904`) derives the
winner/loser pairs from that month's penalties and never looks at
`month.settlements`, at a settlement's `status`, or at any confirmation.

**So the number is money owed, not money paid.** Every penalty raised by a
missed month is in it, whether or not anybody ever paid. The app does hold the
other thing separately -- a settlement's `status: "settled"`, the
`settlement-confirm-paid` action and `confirmedAt` -- so a confirmed-only
figure is buildable, but it is only meaningful in Blocs with
`settlementConfirmationsEnabled`.

Recommended to the founder: keep the same number and rename the label, rather
than change what is counted. **Awaiting his answer.**

### 2.6 Mockup change: Bloc details shrunk to a 2x2 card

The founder said the Bloc details card at the bottom of All Time does not
deserve its size, and that "Started ..." can go because the top of the page
already says since when.

In `src/pages/HistoryPage.jsx`, mockup worktree only:

- the "Started" row is removed;
- "Months completed" is now "Months active";
- the five-row table with its own header bar became a small uppercase
  "BLOC DETAILS" label over a 2x2 grid: Months active, Money settled, Best
  month, Toughest month, each a tiny label with the value under it;
- best and toughest months now read "October 2026 · 30" (middle dot
  instead of a hyphen).

**Measured at 393×852: the card went from 221px to 109px**, the same four
facts in half the height, no horizontal scroll. `npm run lint` on the file and
`npm run build` pass.

Note for the real build: `earliestMonth` is now unused in that file -- the
correctness-only lint does not flag it, but it should go.

Still uncommitted mockup work.

---

### 2.7 Founder's follow-ups on the Bloc details card

All three applied in the mockup, `src/pages/HistoryPage.jsx`:

- **"Money settled" is now "Money owed"** — he agreed to rename the label
  rather than change what is counted (§2.5). The figure is untouched.
- **The separator is a semicolon**, not a middle dot: "October 2026; 30".
- **The value text is 1px smaller**, 13px → 12px. It is one shared style, so
  all four values moved together and the cells still match each other.

Card height 109px → 106px; "October 2026; 30" measures 163px and fits its
half of the grid with room to spare. Lint and build pass. Still uncommitted.

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
