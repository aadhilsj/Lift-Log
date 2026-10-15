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

### 2.2 The notification centre ported, and the bell made real — `711e9fb`

The founder said yes to shipping a first version without "who commented".

**Where it came from.** `origin/feat/settlement-note` (`5a59d6e`, 1 October),
207 commits behind `main`. The two new files came across whole and the wiring
was **rewritten by hand** against today's `App.jsx` and `Nav.jsx`, as the
previous handover recommended — not rebased.

**The port turned out smaller than that handover expected.** It said the bell
"has to be decided against today's header". It does not: `main` already ships a
bell at 42px wired to `onOpenNotifications`, added when the placeholder was
built. Only the destination and a badge are new. Size, icon and position are
untouched, and the badge is absolutely positioned, so it claims no layout —
measured: the button is still 42x42, the button row still 42px tall, and there
is no horizontal scroll at 393px.

**What it shows:** reactions on your own workouts, comments on them, and money
you owe or are owed. All derived from state the client already holds; nothing
is fetched and nothing is written.

#### Left out deliberately, and why

**The "say what the money's going toward" prompt** — the pinned **Do this** row
in the screenshots the previous session sent. `src/lib/settlementNotePreview.js`
on that branch says so in its own header: it stores the note in
**`localStorage` only**. It never reaches the API, the blob or canonical, so a
note one person writes is never seen by anyone else — while the row's copy says
*"Your Bloc will see it."* Shipping that would put a promise in front of members
that the code cannot keep. It needs a real save first. **This is the one thing
the founder saw on screen that is not in this build**, and it is his call to
put back.

Also absent, because the client does not hold the data: **who** commented (logs
carry a count, not the authors) and **@mentions**. Comment rows still appear —
"2 comments on your Gym Log" — they just cannot name anybody.

#### The two things the previous session flagged

1. **The duplicate row** — "Sam still owes you £10 · Aug '26" appearing twice.
   The card builder keys on `monthKey:payer:receiver`, which is unique, so a
   repeat can only come from the same month appearing twice in `monthHistory`.
   A dedupe on that key is in, and proven with a fixture that feeds the same
   card twice.
2. **Reaction rows were unproven** — they are now proven, driven through the
   real API: Jo and Sam reacted to Riley's workout and Jo commented, and the
   row read "Jo and Sam reacted to your Other Log".

#### One thing caught before it shipped

Wiring `trackUsage` into the open handler put `handleOpenNotifications` **above**
`trackUsage`'s own declaration, with `trackUsage` in its dependency array — read
at render time, so every render would have thrown on the temporal dead zone.
A blank screen, from the same family as the ones in §3 of `AGENTS.md`. The
declaration was moved up. Caught by reading the result of the edit, not by lint.

#### How it was verified

Lint and build clean. **24 of 26 suites pass** — the two failures are
`test:auth-edge-flows` and `test:mobile-navigation`, which fail on `main` too.

A fixture check of the builder, independent of the sandbox: the duplicate debt
collapses, somebody else's debt is excluded, your own reaction on your own log
does not count, a comment row appears with no reaction on it, what **you** owe
sorts first as pinned, and the badge falls from 5 to 1 once opened — the 1
being the pinned debt, which always counts.

Then in the sandbox at **393x852**, signed in as Riley:

| Checked | Result |
| --- | --- |
| The badge | **3** on the bell, teal, clear of the Stream and settings buttons |
| The panel | centred, portalled to `document.body`, titled "For you" |
| All three row types | reaction, comment and money all rendered |
| Tapping a reaction row | centre closes, Activity opens, the workout is on screen |
| The glow | measured on the right card: the teal ring is in its computed `box-shadow` |
| The page track afterwards | active page at **x0**, `scrollLeft` 0 — `ebf9de5`'s guard holds |
| Console | no errors |
| Badge after opening | cleared to none, as designed |
| Pinned counting | as Sam, who owes, the badge read **1** with "seen" already set — so it was the pinned row |

**Not seen on screen: the "Needs you" heading itself.** Its one condition
(`pinned.length > 0`) was exercised by the fixture check and the badge count,
but the sandbox's "Your first month" modal kept intercepting the bell for the
member who owes, and the practice data that caused it was my own. Worth a look
on the first real screen.

**Also unseen: comment rows against a real backend.** The sandbox answers every
canonical RPC with `[]`, so `commentCount` stays 0 there; the count was written
into the practice blob to see the row. In production that field is filled from
canonical (`api/lift-log.js`, the `comment_count` mapping), so this should work
— but it has not been watched doing it.

#### One loose end, not touched

`src/pages/NotificationsPage.jsx` — the old "coming soon" placeholder — is now
imported by nothing. It was left in place rather than deleted, since removing it
was not asked for. One line to delete whenever.

## 3. What is open, carried forward

- **The notification centre is built** (§2.2, `711e9fb`) and **not pushed**.
  The founder answered the open question: v1 ships without "who commented".
  Still open on top of it: whether to put the settlement-note prompt back once
  the note has a real save, and whether mentions are ever wanted.
- **The bell is no longer a placeholder**, which removes the App Store risk the
  previous handover raised — provided `711e9fb` ships before submission. If it
  does not, the fallback stands: hide the bell in the native build behind
  `Capacitor.isNativePlatform()`.
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
| `0a500a9` | Open the 15 October catch-up handover | Docs only |
| `711e9fb` | **The notification centre** — the bell opens "For you" | On the branch, **not pushed, not live** |
| *(this one)* | Record the port and how it was verified | Docs only |
