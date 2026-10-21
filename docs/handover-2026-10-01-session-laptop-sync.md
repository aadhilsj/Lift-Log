# Handover — 1–3 October 2026, second session: back on the work laptop, Today and the ended month redesigned, Profile tab designed

**Closed on 8 October 2026.** The founder was away 3–8 October; nothing
landed on GitHub in that time (`origin/main` still `de75946` on 8 October).

Claude, operating. **This is a live handover: it is updated as the session
goes, not written at the end.** The latest entry in §2 is the most recent
thing that happened.

Where this disagrees with an older dated handover, this wins. Where it
disagrees with `docs/WHATS-LIVE.md`, that file wins.

Previous session: `docs/handover-2026-10-01-month-close-and-money-fixes.md`
(ended at `7f2bd10`, then `3446b6d` and `8aa8f47` landed from the founder's
personal laptop).

---

## Where we stopped — read this first

1. **Live on the website** (`473c761`, verified 2 October): new share
   stickers, the Today redesign, the reordered ended-month screen, centred
   pop-ups. **Not on the phone app** — TestFlight is still build 10.
2. **In progress, not built:** the **Profile tab + History-into-Month**
   redesign (§2.15). The founder approved the direction over five mockup
   rounds on 3 October. **The last open question to him was "shall I build
   this for real?" — unanswered.** The mockup code is saved on the branch
   `mockup/profile-tab-2026-10-03` (`3fd8956`, **mockup only, never merge
   it as-is**); the spec is §2.15.
3. **After that, the redesign queue:** an optional large-photo
   ("BeReal-style") view on the Activity tab, as a toggle (§2.9). Remember:
   workout photos are deleted after 72 hours, so such a view only ever has
   ~3 days of pictures.
4. **Time-sensitive:** the **1 November month close** is the first since the
   1 October break was fixed (`c9ce86a`). Check the founder dashboard's
   skipped-Bloc count on 1 November before anything else that morning. The
   two date-dependent tests were pinned (§2.3), so CI should stay green.
5. **Waiting on others:** Deveen's RLS rollout to production was planned for
   2–3 October and is not confirmed anywhere in the repo — ask the founder.

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

### 2.13 The share-sticker sheet: centred, scroll-locked, smaller

Founder's report: with "Share your month" open you could scroll the page
behind it, and the sheet felt too big. Cause of the scroll-through: the sheet
rendered inside the scrolling page, so swipes on its backdrop reached the
page. `src/components/ShareSticker.jsx` now portals to `document.body`
(z-index 1100), cancels touchmove/wheel anywhere outside its own panel while
open, and is 340px wide (`min(340px, 100vw - 52px)`; was ~369 on a 393 phone)
with slightly tighter padding; the preview scales with it. Applies to both
places the sheet opens — the ended-month screen and your profile.

Measured at 393×852 with the page scrolled 250px: panel centred exactly,
340×507, page did not move, wheel and touchmove on the backdrop cancelled,
scrolling allowed again after closing. Same result opened from Jo's profile.

### 2.14 Shipped: everything on `feat/today-calmer-top` is live — `473c761`

The founder said to push it all live (2 October). `origin/main` was still
`5a84359` and an ancestor of the branch; pushed with `--force-with-lease`,
`5a84359..473c761`. GitHub CI green; Vercel Production deploy succeeded; the
live bundle `index-BLGC5dOj.js` contains "Share your month", "Week's MVP:",
"See how you and your Bloc did" and "Month Off"; the live site loads with no
console errors. `docs/WHATS-LIVE.md` brought up to date in the next commit
(it had not been touched since `cd5e912`).

**On the website only.** TestFlight is still build 10, so the phone app has
none of 1–2 October's work (stickers, Today, ended month) until build 11.

**Not seen against live data:** the founder tested on his phone through the
sandbox (fake data), and pop-up centring was measured in Chromium, not on a
real iPhone.

### 2.15 The Profile tab and History — designed, approved, **not built**

3 October. Five mockup rounds in a throwaway copy, shown on the founder's
phone through the sandbox. Saved as `mockup/profile-tab-2026-10-03`
(`3fd8956`) — rough mockup code, rebuild it properly.

**Decided by the founder:**

- **The fifth tab becomes "Profile"** (replacing History), your own
  in-Bloc profile.
  - Tab icon: **no photo → grey person outline** like the other tabs (cyan
    when selected); **with a photo → the photo, dimmed (~60%, desaturated)
    when not selected, full brightness with a thin cyan ring when
    selected.** The bright coloured initial was rejected as too loud.
  - **Tapping your own avatar adds or changes your profile picture** (same
    crop screen and save path as the account screen,
    `handleUpdateProfilePhoto`). No photo → a dashed circle with "+ Photo" so
    it is obvious; with a photo → a small cyan "+" badge.
  - **Name and payment details stay on the account screen** (opened from the
    Bloc switcher). Email, sign out and delete account also stay there,
    deliberately a few taps away. The Profile tab ends with one
    "Account settings › Name, payments, sign out" row linking to it — **in
    the mockup that row does not open anything yet; wire it to
    `setShowProfile(true)` / `accountOverlay()`.**
- **History moves into the Month tab** as a **"Month | All Time"** toggle.
- **Profile header, for every profile (yours and others'):** photo centred
  and bigger (68px in the mockup, up from 24), **name underneath** with the
  full width so 16-character names fit (tested "Kofi Mensah-Owus"). "‹ Back"
  pinned top-left only when the profile slides in, never on the tab.
- **This Bloc / All Blocs toggle much smaller** (~260px wide, 24px tall).
- **Month switcher:** the dropdown becomes a one-tap **"‹ October '26 ›"**
  pill, **the same size and style as the Month screen's** (28px tall, 11px
  text), inside This Bloc only.
- **This Bloc content:** the six equal cards become
  1. a ring card: current month "1 of 12 workouts · 11 to target"; **ended
     month missed → "7 workouts · Missed by 5"** (soft red); **over target
     (any month) → "14 workouts · 2 ahead of target"**; exactly on →
     "Target hit";
  2. three cards in the **All Blocs style** (icon-less in the mockup):
     Average, Perfect months, Months won;
  3. **"Net in this Bloc: -£10"** as a quiet line (money out of the
     foreground);
  4. calendar, workout breakdown, allowance — unchanged.
  Nothing removed; the founder said explicitly no information should go.
- **All Time (the old History page) inside the Month tab:**
  - no big "Bloc History" heading;
  - one line: "Since August 2026 · 84 workouts logged";
  - three cards: Most wins, Most consistent, Most £ lost;
  - **the all-time leaderboard as a snapshot** — top 3 plus your own row if
    you are outside it, "See full leaderboard ›" — that opens a
    **full-screen leaderboard** (portalled) with every member and the
    swipeable extra columns; **tapping a name closes it and opens that
    member's profile.** The founder disliked swiping and "Show 8 more" on
    the page itself. Mockup leftovers to fix: duplicate title, an old "Show
    Less" button inside the full view;
  - then the 12-month chart, workout types, Bloc details.

**Found while mocking, apply in the real build:**

- The crop screen rendered *behind* the profile cards until portalled —
  portal it (same rule as every other pop-up, see the playbook).
- `PlayerProfile` has `minHeight: 100dvh`; as a tab it must size to its
  content (the mockup added an `asTab` prop) or anything after it is pushed
  off screen.
- Moving History into Month puts the Profile page to the right of Month in
  the page track, so the track can now be scrolled sideways. With real taps
  it never shifted, but the browser tool's "scroll into view" clicks shifted
  it by 34px twice. Consider `overflow-x: clip` on the track — and re-check
  swipe against the playbook if you touch it.
- Dashboard: `history_opened` will stop meaning the History tab; decide what
  "All Time opened" should record.

### 2.16 Sandbox notes from this stretch

- **The sandbox ran out of memory after ~13 hours** (4 GB heap). The local
  dev server re-imports `api/lift-log.js` with a cache-busting `?t=` on every
  request and the old modules are never freed. Practice copy only — Vercel
  functions are unaffected. Restart it if it has been up a long time.
- **The sandbox has no photo storage**, so a profile photo saved there
  vanishes on reload. To show a photo, put a small `data:` URL into
  `state.profiles[<id>].profilePhotoUrl` in `.sandbox-data/blob.json`.
- On this laptop a Docker container holds port 54321, which
  `scripts/sandbox.mjs` hardcodes. Change it to 54331 **in your worktree only,
  uncommitted**.
- The sandbox still cannot close a month (§2.6); for closed-month screens a
  throwaway copy relaxed the guard in `rebuildClosedMonthSnapshotFromCanonicalLogs`
  — never commit that.

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
- **Redesign queue (§2.9):** ~~Month page order~~ (built, §2.11); **Profile
  tab + History into Month — designed and approved, not built (§2.15)**;
  large-photo Activity view.
- **1 November month close** — first since the `c9ce86a` fix; check the
  dashboard's skipped-Bloc count that morning.
- **TestFlight build 11** is now well behind the website (§2.14).
- **Desktop Pace Detail shows a red bar when the target is hit** (§2.9).
- ~~`docs/WHATS-LIVE.md` stale~~ — brought up to `473c761` on 2 October.
- Unmerged branches from the last two days: `feat/settlement-note` and
  `feat/safe-area` (both "WIP: preserve ..." commits from 1 October),
  `testflight-build-11`, `claude/push-notifications-plan-2026-09-30`,
  `claude/rls-correction-2026-09-30`. Not reviewed this session.

---

## 4. State of this laptop at close (8 October)

- **Nothing running.** The sandbox had already stopped (§2.16).
- **Worktrees removed:** `today-calmer` (its branch was merged into `main`
  and deleted) and `profile-mockup` (its work is on
  `mockup/profile-tab-2026-10-03`). The practice data went with them; a new
  session starts the sandbox fresh with `npm run sandbox:seed` (which cannot
  close a month — §2.6).
- Main folder on `main` at the latest commit. Still untouched: the four
  August `.dmg` backups and the two old August worktrees (`Lift Log
  Extraction`, `Lift Log iOS Preview`) — candidates for cleanup with the
  founder's yes.

## 5. Commits this session

| | |
| --- | --- |
| `689d9d9` | pin the two calendar-dependent suites to the 15th |
| `aea861f` | docs: AGENTS.md §0, `docs/HANDOVERS.md`, this handover, emoji note removed from WHATS-LIVE |
| `5a84359` | stickers: navy icon outline (Grid/Bare), SESSIONS, month 18; references replaced — **live** |
| `e49e1b3` | docs: handover — stickers live, banner stays off Daily/Weekly |
| `ea1e79f` | Today: pills on the date line, silver recap banner, centred pop-ups |
| `4b77c78` | ended month: new order, brighter colours, periwinkle Sat out |
| `bf46cd9` | ended month: missed months share; sat-out months show no calendar |
| `50fc2d4` | ended month: a mark on the right when no money moved; "Month Off" |
| `d0902ae` | ended month: First month's penalty line on its own line |
| `473c761` | share sheet: centred, scroll-locked, ~10% smaller — **all of the above live** |
| `de75946` | docs: WHATS-LIVE up to date, this handover — **live** |
| `3fd8956` | **on `mockup/profile-tab-2026-10-03` only, never merge** — Profile tab / All Time mockup (§2.15) |
| *(this commit)* | docs: handover closed out on 8 October |
