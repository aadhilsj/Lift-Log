# Handover — 1 October 2026, second session: back on the work laptop

Claude, operating. **This is a live handover: it is updated as the session
goes, not written at the end.** The latest entry in §2 is the most recent
thing that happened.

Where this disagrees with an older dated handover, this wins. Where it
disagrees with `docs/WHATS-LIVE.md`, that file wins.

Previous session: `docs/handover-2026-10-01-month-close-and-money-fixes.md`
(ended at `7f2bd10`, then `3446b6d` and `8aa8f47` landed from the founder's
personal laptop).

---

## 0. Read this first

- **There are two Macs.** The founder spent September on his personal laptop
  (user `aadhilsj`, `Aadhils-Air`). This session is on the work laptop (user
  `opera_user`). Paths in `AGENTS.md` that say `/Users/aadhilsj/...` mean
  `/Users/opera_user/...` here. Worktrees on this laptop live in
  `/Users/opera_user/Developer/FERO/`.
- **On this laptop `~/Documents` is not synced to iCloud.** Checked by
  comparing `~/Documents` with
  `~/Library/Mobile Documents/com~apple~CloudDocs/Documents`: the contents
  differ, and `Lift Log` exists only locally. The iCloud slowdown from the
  personal laptop (previous handover §7) does not apply to this checkout.
  The `~/Developer` rule still stands.
- **Every session now starts and keeps a live handover.** Made mandatory in
  `AGENTS.md` §0 this session, at the founder's request. See §2.

---

## 1. Where things stood at the start

- The work laptop's `main` was at `5d0ea67` (30 August), **349 commits behind**
  `origin/main`, with **0 local commits** not on GitHub. Nothing was at risk.
- Live website: `3446b6d`, the newest commit at the time. TestFlight: build 10.
- Untracked in the main folder, and deliberately left alone: four backup disk
  images from 31 August — `Fero-branding-backups-2026-08-31.dmg`,
  `Fero-private-data-2026-08-31.dmg`,
  `Fero-private-recovery-2026-08-31 2..dmg`,
  `Fero-supabase-local-2026-08-31.dmg`.
- Two stale August worktrees on this laptop, untouched:
  `Lift Log Extraction` (`codex/reconcile-chat-with-backend`, remote branch
  gone, two untracked pnpm files) and `Lift Log iOS Preview`
  (`codex/app-store-ios-preview` at `5d0ea67`). Neither holds unpushed work.
  Candidates for cleanup, with the founder's yes.

---

## 2. What happened, in order

### 2.1 Laptop brought up to date

`git merge --ff-only origin/main` in the main folder: `5d0ea67` → `8aa8f47`.
Fast-forward only, nothing overwritten, `.dmg` files untouched. `npm install`
(new dependency `emojibase-data`), then `npm run lint` clean and
`npm run build` succeeded. That also covers previous handover §8's gap
("lint and build were not run on the last four commits"): they pass.

`.env.local` in the main folder dates from August. If keys changed during
September it may be stale; not yet exercised by running the app locally.

### 2.2 Emoji sheet bottom band — founder says it is fine

`docs/WHATS-LIVE.md` and the 30 September handover §0 listed a predicted
bottom band under the emoji "more" sheet in the installed iOS PWA. That was a
code-review prediction, never seen on a device. **The founder checked on his
phone on 1 October: the emoji sheet is fine.** The warning box in
`WHATS-LIVE.md` is removed in this session's docs commit, and the TestFlight
build 11 blocker it created is lifted.

### 2.3 The two calendar-dependent tests pinned — `689d9d9`, on `main`

Previous handover §6 / Deveen's §10:

- `test:solo-sitout-exclusion` failed days 1–10 of every month (Solo before
  day 10 is instant, so no pending request to cancel).
- `test:month-close-canonical` failed 00:00–03:00 UTC on the 1st (the gap
  before the 3am Bloc-day cutoff).

Both now fake the clock at `2026-09-15T12:00:00Z`, the same pattern
`scripts/test-yearly-allowance.mjs` already used, with `api/lift-log.js`
loaded by dynamic `import()` after the clock is pinned.

Verified by forcing the real clock with `NODE_OPTIONS=--import`:

| Real clock | old Solo | new Solo | old close | new close |
|---|---|---|---|---|
| 1 Oct 01:00 UTC | FAIL | pass | FAIL | pass |
| 5 Nov 12:00 UTC | FAIL | pass | pass | pass |
| 1 Jan 02:00 UTC | FAIL | pass | FAIL | pass |

Then `npm run lint`, `npm run build`, and all 20 CI suites: 20/20. Pushed
with `--force-with-lease` after confirming `origin/main` (`8aa8f47`) was an
ancestor. GitHub CI green; Vercel Production deploy succeeded. Test files
only — nothing a member sees changed. **Deveen's §10.3 ask is done.**

### 2.4 Handover habit made mandatory, and the docs given an index

At the founder's request:

- `AGENTS.md` (which `CLAUDE.md` symlinks to, so Codex and Claude read the
  same file) has a new **§0**: every session must get fully up to speed
  before any work — every handover, the workspace, recent commits, the live
  app — and must start its own handover immediately and keep it updated until
  the session closes.
- New **`docs/HANDOVERS.md`**: one index of every handover and reference
  doc, grouped and newest first. No doc was moved or renamed, because other
  docs and `AGENTS.md` link to them by path.
- §11 and §12 of `AGENTS.md` now point at §0 instead of repeating it.

### 2.5 Share stickers: navy icon outline, "SESSIONS", bigger month

The founder redesigned the Grid and Bare stickers (two hand-edited PNGs, now
kept in `docs/share-sticker-reference/founder-design-2026-10-01/`), then asked
for two more changes on all three styles. All in `src/lib/shareSticker.js`:

1. **Grid and Bare icons get a solid navy outline** (`#1A2E4A`, the existing
   `NAVY`), replacing the half-transparent `rgba(2,26,24,.5)` hairline.
   Measured from his PNGs: the outline is fully opaque, about 1px outside the
   old silhouette and 1px into the silver. Two constants, `OUTLINE_OUT = 1.5`
   and `OUTLINE_IN = 0.5` (× the existing per-icon `edge`), were tuned against
   his files — navy coverage within 5% (1.03× and 1.05×). The first attempt
   ate equally in and out and nearly erased the line-drawn icons (dumbbell,
   rower), so the inward reach is deliberately smaller. `EDGE_INK` was only
   used for this and is removed. **Solid's icons are untouched** (0 pixels
   changed in its grid).
2. **"ACTIVITIES" → "SESSIONS"** in the header, all styles.
3. **Month name 17 → 18** authoring px, all styles. The header centres on
   its measured width, so it re-centres; widest case (September, 60
   sessions, Bare) has ink from x 60 to 1013 of 1080 — fits.

**Verified:** all 12 stickers rendered in headless Chromium from the real
module with the app's Google fonts, and diffed against the pre-change render:
same canvas size, weekday row and FERO mark 0 pixels changed, changes only in
the header and (Grid/Bare) the icons. The real `ShareSticker` pop-up loaded
standalone through Vite at 375×812, Grid and Bare both drawn, no console
errors. `npm run lint`, `npm run build`, 20/20 CI suites.

**Reference images replaced.** The twelve `docs/share-sticker-reference/png/`
files are now the new renders, and a new `README.md` in that folder records
why. `sticker-core.js` / `sticker-style.css` were not updated and no longer
match the PNGs on these three points.

**Not verified:** the pop-up inside the full app with a real closed month —
see §2.6. A count of 1 reads "1 SESSIONS" (it read "1 ACTIVITIES" before);
not changed, not asked.

**Live:** pushed as `5a84359`. CI green, Vercel Production success, `SESSIONS`
present in the live bundle `index-FXCNzRAX.js`, live site loads with no console
errors. Reaches the TestFlight app only with the next build.

### 2.6 Found: the sandbox can no longer close a month

`npm run sandbox:seed` fails with "Rollover did not close August". The
sandbox answers every canonical RPC with `[]`, and since `c9ce86a` the month
close reads `read_ante_core_logs_for_month`, gets nothing, sees the blob
counted 30, and correctly skips the Bloc. So nothing that needs a closed
month (stickers, results, settlement reminders) can be rehearsed in the
sandbox until the sandbox fakes that RPC. Not fixed — outside this task.

Also on this laptop: a Docker container (`com.docker`, likely the August
local Supabase) holds port 54321, which `scripts/sandbox.mjs` hardcodes. For
this session the port was changed to 54331 in the worktree only and reverted;
Docker was not touched.

### 2.7 Decision: the Last Month Banner stays off Daily and Weekly

The founder asked why the dashboard's Usage tab does not show the "Last month
results are in" banner under Daily and Weekly. It is hidden on purpose
(`src/pages/FounderDashboard.jsx:166`, since `c8c1bf8` on 30 August): the
banner is only on screen for the first five days of a month, so those views
would read zero most of the time. The data exists — the server already
computes daily and weekly figures for it — so showing it would be one line.
**The founder decided to leave it as it is.** Do not change it without asking.

### 2.8 Deveen asked what was pushed

On 1 October Deveen planned to "hit some of the rollover checks tonight" and
asked whether anything had been pushed. Answer drafted for the founder and
sent: ~45 commits to `main` since 24 September; all 14 of Deveen's commits
since 15 September are on `main`; the month-close break and fix (`c9ce86a`)
are written up in his handover §11–§18; his §10.3 ask (pin the date tests) is
done in `689d9d9`. Flagged that his `0da04b4` before/after month-close check
can no longer take its "before" snapshot — the close already ran.

### 2.9 Today redesign — the top of the screen, and centred pop-ups

**Planned with the founder over six mockup rounds** (real screenshots from the
sandbox at 393×852, in a throwaway worktree). Agreed order for the wider
redesign: **Today → Month → a Profile tab in the bottom-right (and where
History goes — suggested: merged into Month as This month / All time) →
an optional large-photo Activity view.** Only Today is built so far.

What was decided, and built on branch `feat/today-calmer-top`:

- **Phone only:** the four stat cards (Target, Pace Check, Week's MVP, Bloc
  Loop) are gone from the phone layout. Their place is two small pills on the
  "OCTOBER · DAY n/31" line: **"N to go ›"** and **"Week's MVP: Name ›"**.
  - "N to go" opens the Your Log pop-up, which now shows pace on top (bar,
    "You are 1 workout ahead of pace", "N to go · X by today · Y days left")
    above the calendar. Pace Check's own pop-up is no longer reachable on the
    phone; its content is here.
  - Week's MVP still opens its pop-up and still fires `mvp_card_opened`.
  - **Bloc Loop is dropped** on the phone (the Month tab has the ring), so
    `bloc_loop_opened` will stop growing from phones.
  - The founder rejected: moving the cards below the leaderboard (nobody
    scrolls there in a big Bloc), an MVP tag on leaderboard rows (crowds it),
    and two half-width cards (too heavy).
  - Pills are drawn 20px tall but the button is 36px (negative margin), so the
    row stays 20px and the tap target is not tiny.
  - Hidden when sitting out (as the cards were). Solo counts to the Solo goal
    ("5 to go" for goal 6, 1 logged). Target hit reads "Target hit ›".
  - Measured at 360px with "12 to go" and names up to 11 letters: fits, 25px+
    clear of the date, no horizontal scroll.
- **Desktop layout is unchanged** — it keeps its four cards.
- **Ties:** "Tied" / "3-way tie" became **"2 tied" / "3 tied"** everywhere the
  MVP value shows (founder asked for both places to match).
- **Recap banner (first 5 days):** "LAST MONTH" label removed, slimmer
  (padding 8px), see-through silver gradient instead of dark teal, copy
  **"Your September Recap" / "See how you and your Bloc did."** Several
  brightness rounds; the shipped values are the founder-approved middle.
- **Duplicate title fixed:** the Your Log pop-up said "Oct · Your Log" twice.
  `renderMonthLogCalendar` now takes an optional title.
- **Bar colour bug, partly fixed:** `barColor` has no `locked-in` case and
  falls through to red. The new pace block uses the Cleared silver for
  target-hit. **The old desktop Pace Detail pop-up still shows red for
  target-hit — not touched.**

**Pop-ups centred in the visible screen** (founder's request): the Your Log /
Week's MVP pop-up and the log-a-workout pop-up are now portalled to
`document.body` and centred with symmetric safe-area padding. Before, the
detail pop-up reserved 94px at the bottom for the nav, so it sat ~40px high,
and both were rendered inside the page, where a transformed ancestor in Safari
moves `position:fixed` (playbook: "any modal opened from a transformed screen
must portal"). Measured in Chromium with Today scrolled to the bottom: all
three centre exactly (0px off), the page does not jump, and the backdrop now
also dims the header and nav. The activity list sheet still stacks above the
log pop-up (1001/1002 over 1000). The + pressed from the Month tab also opens
it centred. **Not verified on a real iPhone** — no simulator on this laptop.

---

### 2.10 Today approved on the phone; held back from `main`

The founder tested the Today build on his phone over wifi (sandbox at
`http://192.168.1.224:3000`): *"so much nicer... I'm a big fan of this work."*
**He asked not to push it to `main` yet** — it stays on `feat/today-calmer-top`
with the Month work below, to go out together.

Side finding while he tested: he typed `joe@local.test` instead of
`jo@local.test` and landed on "what should your Bloc call you". Not a
regression — the sandbox's local-dev OTP shortcut (`ENABLE_LOCAL_DEV_OTP`)
accepts any `@local.test` address and skips the account check. **Live has the
"No Fero account found" message** (`3612223`, confirmed in the live bundle).
The practice data now has an extra member "Joe" in Sandbox Bloc.

### 2.11 The ended-month screen, reordered and brightened

Planned over four mockup rounds, built on the same branch, in
`src/pages/SettlementScreen.jsx` only.

- **Order:** a small centred "September's Recap" → your result card → your
  calendar with a full-width **"Share your month"** button (the small corner
  Share on the calendar is removed, so there is one) → the month's awards →
  "The Bloc's September" card holding the ring (84% width, slice taps still
  open the focus plate) → Personal best + Track record → what you owe.
- **Result card slimmer:** Personal best, Track record and the thin "SEP '26"
  divider moved out of it. **Every line of copy is unchanged** — the founder
  was explicit about that ("Bounce back next month" stays).
- **Brighter colours** for all six cards (Winner, Perfect Bloc month, Target
  hit, Tough month, First month, Sat out): stronger edge, corner glow, ~2× wash.
- **Sat out has its own periwinkle** (`rgba(150,165,235)`), so it no longer
  looks identical to Target hit's silver.
- Headings rejected along the way: a large "September's in the books".

Verified in the sandbox at 393px: order measured top to bottom, no horizontal
scroll, the small Share gone, "Share your month" opens the sticker for a
winner, a slice tap opens that member's plate. Lint, build, 20/20 CI suites.

**Decided by the founder:** a *missed* month shares too — `handleShare` no
longer scrolls to what you owe first (that older rule felt broken behind a
"Share your month" button), and the unused `outcome` variable it relied on is
gone. **A month you sat out shows no calendar and no Share button** — the
periwinkle Sat out card is followed straight by the awards. Verified in the
sandbox for Jo as missed (sticker opens, "10 SESSIONS") and as sat out
(no calendar, no button). The profile's own share already hides a sat-out
month, because it needs logged workouts and sitting out blocks logging.

### 2.12 The result card's empty right side

When no money moved, the right of the result card was empty. It now carries
the mark that already means that result in the app, in the card's colour, at
about the money's size (`reportMark` in `SettlementScreen.jsx`; the card body
is now `renderReportCard`, called by `renderReport`):

| Result | Right side |
| --- | --- |
| Winner with a pot / Tough month | money, unchanged |
| Winner, nothing in the pot | trophy (`TrophyIcon`) |
| Perfect Bloc month | target-hit hexagon, teal, soft glow |
| Target hit | target-hit hexagon, silver |
| First month | Training Wheels sprout |
| Sat out | a new pause mark (two rounded bars), periwinkle |

Sat out also drops the "—" and reads **"Month Off"** (capital O), founder's
request. **First month** now reads on two lines: "Target was 12. No penalty
yet." / "Penalties kick off from next month." (a `\n` in a hero line now starts
a new line on the card). Approved from a seven-card test page in the sandbox
(temporary, not committed). Verified on real cards: Sam (Target hit, hexagon) and Jo marked
sat out (pause, "Month Off").

---

## 3. Still open (carried forward, not worked on yet)

- **Lazy month close** — a Bloc nobody touches sits half-closed after the
  month turns. The founder calls this a bug. Previous handover §4.
- **A prorated target can exceed the full target** when a Bloc lowers its
  target mid-month. Previous handover §4.
- **The new `read_ante_core_logs_for_month` RPC has no test.** Previous
  handover §8.
- **TestFlight build 11** — the website is ahead of build 10; the emoji-sheet
  blocker is lifted (§2.2).
- **RLS production rollout** — Deveen's, planned for 2–3 October.
- `test:auth-edge-flows` and `test:mobile-navigation` are still broken.
- **The sandbox cannot close a month** (§2.6), so closed-month screens cannot
  be rehearsed locally.
- **Redesign queue (§2.9):** ~~Month page order~~ (built, §2.11), Profile as
  the fifth tab + where History goes, large-photo Activity view.
- **`feat/today-calmer-top` is unpushed on purpose** (§2.10): Today + Month
  go to `main` together when the founder says so.
- **Desktop Pace Detail shows a red bar when the target is hit** (§2.9).
- **`docs/WHATS-LIVE.md`'s website column is stale.** It still says
  `cd5e912` and lists none of the previous session's fixes (month close,
  leaderboard money, Most Diverse, share-sheet close button). Only the emoji
  note was corrected this session.
- Unmerged branches from the last two days: `feat/settlement-note` and
  `feat/safe-area` (both "WIP: preserve ..." commits from 1 October),
  `testflight-build-11`, `claude/push-notifications-plan-2026-09-30`,
  `claude/rls-correction-2026-09-30`. Not reviewed this session.

---

## 4. Commits this session

| | |
| --- | --- |
| `689d9d9` | pin the two calendar-dependent suites to the 15th |
| `aea861f` | docs: AGENTS.md §0, `docs/HANDOVERS.md`, this handover, emoji note removed from WHATS-LIVE |
| `5a84359` | stickers: navy icon outline (Grid/Bare), SESSIONS, month 18; references replaced — **live** |
