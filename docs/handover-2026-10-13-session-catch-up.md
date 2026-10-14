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

### 2.3 Variant `p`: the Back row and the net line both reclaimed (14 October)

The founder's two notes on `n`, in his words: the back button and the `...` on
someone else's profile "look awkward" and take an extra line for no reason, and
"Net in this Bloc" takes another line that could be folded into the workout
counter, right-aligned and smaller with a divider.

**Measured first, rather than eyeballed.** The Back/`...` row costs 29px (a
21px row plus the gap); the net line costs 24px. Inside the header card the
only free space is the band to the right of the name — "Sam" is 26px wide in a
238px row — and the card's top-right corner.

Built as **variant `p`** on `mockup/profile-header-2026-10-12` (`6204952`), so
`n` stays selectable for comparison:

- the `...` moved into the card's **top-right corner**;
- Back became a **chevron in front of the name**, placed outside the text
  column so the name and the first number still share one left edge (both at
  x141) — the column simply starts further right on someone else's profile;
- the net figure **rides the workout counter**, right-aligned, 12.5px, behind a
  1px divider, and only when there is money to report.

**Measured at 393x852, same member, same screen, both variants, scrolled to
the top:**

| | `n` | `p` | back |
| --- | --- | --- | --- |
| Someone else's profile, calendar top | 397 | **354** | 43px |
| Your own profile, calendar top | 449 | **425** | 24px |

No horizontal scroll (`scrollWidth` 393 = `clientWidth` 393).

**Two things fixed during the build, both found by measuring:**

1. The three Average / Perfect / Won cards reappeared under the card, because
   the suppression list that hides them for `n` did not name `p`. The figures
   were showing twice.
2. Both new tap targets were too small — the chevron 22px wide, the `...`
   25x31. They are now **44x42** and **39x45**, done with negative margins so
   the layout does not move. The founder has already raised one hard-to-hit
   chevron this month; shipping two more would have been the same bug again.

**The day-one case was checked, not assumed.** `monthHistory` was temporarily
emptied in the sandbox data: a member with no closed months shows **no net
figure and no divider** — the counter card reads exactly as it does today.
The practice data was restored straight afterwards.

Lint and build clean. **Still unchecked on `p`:** a long name against the
chevron, and iPhone SE width. Nothing is on `main`; this is the mockup branch
only.

### 2.4 Variants `q` and `r`, and four measured corrections (14 October)

The founder found the in-card chevron still wrong, and gave four other notes.
All of it is on `mockup/profile-header-2026-10-12` (`7da7b03`); `n` and `p`
stay selectable.

**`q` — the header carries the back.** Inside a member's profile the Bloc name
steps aside for a big chevron, so the card is identical to your own. The one
piece of plumbing worth knowing: `viewPlayer` is state inside `TodayPage` and
`HistoryPage`, so the header has no way to know a profile is open. The mockup
bridges it with a module-level store (`src/lib/headerBack.js`); **a real build
should lift that state into `App.jsx` and pass the handler down as a prop.**

Checked before he asked me to stop: back works from both the Today and the All
Time routes, the Bloc name returns on the way out, the own Profile tab keeps
the Bloc name, and tapping another tab with a profile open restores the header.
The trade, recorded: while a profile is open the Bloc switcher is one tap
further away.

**`r` — the card is compressed and the chevron sits outside it**, 28px, in the
gutter, vertically centred on the card (measured: both centres at y151).

**Four corrections, each measured rather than eyeballed:**

| | Was | Now |
| --- | --- | --- |
| Clearance under the app header | **3px** | 16px, the page's own gutter |
| The `...` ink | a 15px glyph measuring **5.8px wide** | three 4px dots over **20px**, the iOS/Instagram size, in a 46x45 target |
| Month pill height | **32** — I had grown it, which was never asked for | back to **28**, 44px target kept through negative margins |
| Month chevrons | box-centred but reading low | the glyph's ink measured on a canvas at **2.25px below the line-box centre**, corrected with `translateY(-2.25px)` |
| Net divider to the figure | 11px | 18px |

The pill is the lesson worth keeping: **the founder asked for a bigger chevron
and got a bigger pill.** The target was widened by growing the box instead of
by negative margins alone. He noticed.

**One thing seen and not yet explained:** the Month page came up blank once,
after tapping a member's month from the Month tab with variant `r` selected.
It did not reproduce on a clean load and there was no console error. **Not
established whether it is this branch's or pre-existing** — it must be pinned
down before any of this goes near `main`.

Lint and build clean. No horizontal scroll. Nothing is on `main`.

## 3. Commits this session

| Commit | What | Live |
| --- | --- | --- |
| `98fcc00` | Open the 13 October catch-up handover | Docs only, on `main` |
| `f4e414b` | Variant `n` back on screen for review | Docs only, on `main` |
| `6204952` | Variant `p` — the back row and the net line reclaimed | **Mockup branch only, not live** |
| `cf4f4af` | Record variant `p` and how it was measured | Docs only, on `main` |
| `7da7b03` | Variants `q` and `r`, and four measured corrections | **Mockup branch only, not live** |
| *(this one)* | Record `q`, `r` and the corrections | Docs only |
