# Session handover — 21 to 22 September 2026: reminders design, then the perfect-month loop

Read this first in the next session. It covers the whole session. The
technical detail of the Month build is in
`docs/handover-2026-09-22-month-loop.md`; this file is the story, the
decisions, the state of things, and what's next.

## TL;DR

- **Live on `main` (`cd7282d`, deployed and verified):** the Month page and
  the end-of-month results screen, rebuilt around one ring for the whole Bloc
  (the "perfect month" loop).
- **Settlement reminders on Today:** designed in this session, finished and
  shipped by Codex (`e2cb1e9`, `ea75914`, handover
  `docs/handover-2026-09-22-settlement-reminders-and-setup-review.md`).
- **Waiting on the founder:** a look at the live Month tab with real Blocs
  (photos, Solo, sit-outs, prorated joins). Nothing has been seen with real
  data yet.
- **Agreed but not done:** an in-depth copy review of the results screen.

## 1. Settlement reminders (Today)

Designed with the founder on the sandbox, then handed to Codex, who finished
and released it. In short: Today shows one reminder (a payment waiting for
your Confirm first, then the newest involving you, then the newest overall),
"N unpaid ›" in red opens a centred sheet with every reminder and why it's
owed ("Fell short with 7 of 12 workouts"), and "Link a payment option +"
appears where it applies. Codex then changed buttons (cyan Confirm, muted
Mark as paid, payment icons after the name, amber amount while pending) —
the results screen's settlements were matched to Codex's version.

My uncommitted reminder work was in `/Users/aadhilsj/Documents/FERO/fero-reminders`
(branch `feat/settlement-reminders-one-card`); Codex committed it from there.
That worktree is now clean and at `381db42`. It can be removed (delete its
`node_modules` symlink first) — not done, ask the founder.

## 2. The perfect-month loop (Month page + results)

Designed over 12 mock-up rounds, then built. Mock-ups (private artifacts):

- Month page: https://claude.ai/artifact/Q6LYmz3ymv8qm6mnh5Uwph (v12 agreed)
- Results screen: https://claude.ai/artifact/KVondCoPEyc7h5t9Ej2V7z (v7 agreed)

The built version then changed further on the founder's phone review (below);
the code on `main` is now the source of truth, not the mock-ups.

### Rules (founder decisions)

- Perfect month = every member in the month clears their own target.
- Sitting out: no slice, doesn't block perfect. Listed under "Sitting out".
- Solo: full-size slice, only the Solo target can fill (rest dashed), so the
  loop can't close. Never named or blamed in copy.
- First-month (training-wheels) members count: clearing helps, missing
  blocks. Still no penalty.
- At least 75% of the Bloc must be in the month (round up).
- Slices are sized by target (founder chose this over equal slices). The
  first slice is centred at 12 o'clock, so equal targets form a plus /
  pentagon / hexagon; uneven targets (prorated, Solo) won't be symmetric, by
  choice.
- Workouts past a target sit on an outer track (max 2 rows); only a face with
  a second row steps outward.
- Closed months read only their frozen snapshot, never current settings.

### Month page (current month) — what's on it

- Header: centred one-tap `‹ September '26 ›` switcher; "9 days left" on the
  same line (right, 9px mono). No separate title.
- Ring; middle shows done / of total / "N% to a perfect month" (or "Day one",
  nothing under 75% or with Solo). Tap a slice or face: others dim, middle
  shows that person, panel opens. Tap anywhere else to close.
- Two-line caption. Names only when 3 or fewer are left. Say **"cleared"**,
  never "closed".
- Default bottom: Sitting out / On Solo / Prorated notes, then the centred
  hint "Tap a slice to see someone's month".
- Person panel: day strip chart (cleared line at the end of the clearing
  day, label flips left late in the month), **Personal best** card (full
  month names), **Best week** card, **Same day last month** (two rails with
  dates, each against that month's own target), **If the month ended today**
  (own slice only), **Track record** (six most recent finished months).

### Results screen (closed months, incl. all past months)

Order: frozen ring → caption ("7 of 9 slices cleared. / 5 workouts from a
perfect month.", perfect: "Every slice cleared. / Nobody left the loop open.")
→ tapped-person plate (name + result chip; only extra line "New best month")
→ report card (original tints per result, smaller than before; hidden for a
month the viewer wasn't in) with Personal best + Track record → awards →
calendar (title = month only) + Share (sticker unchanged) → settlements.

- Awards: Bloc Champ (gold + trophy), First to Clear (cyan), Most Diverse
  (violet, "4 different activities"), Iron Week (brushed steel). Static, not
  tappable. Factual; one person can sweep (founder's choice). Show the real
  name, never "You".
- Settlements: your own rows open ("You owe" / "Owed to you", "1 Open");
  everyone else's folded under "Everyone else +"; not involved = one folded
  line "Settlements – 2 Open"; perfect = "Nothing to settle." Same records
  and actions as Today's reminders. "Link a payment option +" uses Today's
  check and opens Today's payment window.

### Removed on purpose (founder agreed)

Month page: "Month in progress" card, "This Month v Last Month" card, "If the
Month Ended Today" list, the dropdown, the separate title. Results: Month
Summary standings, perfect roster, Biggest Turnaround and Furthest Behind
awards, "View the settlement" button, the payer's "Set up how people pay you"
link. The ✕ dispute is not on results (never was; disputes stay on Today).

## 3. Things learned this session

- **Vercel previews have no data.** Since 2026-09-14 the database keys are
  Production-only: previews can't sign in (the founder got "Unable to send
  code") or load anything. Test on the sandbox from the founder's phone
  (same wifi, `http://192.168.1.195:3000`, `riley@local.test`, code
  `000000`). `AGENTS.md` said the opposite; corrected in this release.
- **Sandbox quirks:** it can't store settlement claims or payment methods
  (canonical writes are dropped), so Mark as paid and a saved Revolut vanish
  on reload. Codex's seed gives Riley/Jo/Sam with July and August closed and
  Alex joining in September; I added September logs by hand.
- **Quick sandbox sign-in:** set localStorage
  `ll_auth_session_hint_v1` to `{"localDevOtp":true,"userId":"x","email":"riley@local.test"}` and reload.
- **The test identity dropdown writes as the signed-in account**, not the
  impersonated one (a first-month choice made "as Alex" landed on Riley).
- **Hidden tabs are mounted.** Today's buttons exist behind the Month tab; in
  scripted tests, pick elements that are on screen.
- **Founder preferences confirmed:** they want to see things on their phone;
  measure, don't eyeball; one question per message; two-line captions with
  whole thoughts; fewer repeated numbers; no gambling words; red only for
  missed/Cooked.

## 4. State right now

- `main` = `cd7282d`. CI `verify` passed; Vercel deployed; live bundle
  contains the new screens; live site loads with no console errors.
- Branch `feat/month-loop` = `main` (fully merged). Worktree
  `/Users/aadhilsj/Documents/FERO/fero-month-loop`. Safe to remove later
  (delete the `node_modules` symlink first).
- The sandbox is **still running** from that worktree (PIDs on ports 3000 and
  54321). Stop by PID when done; never `pkill -f`.
- Old worktree `fero-reminders` is merged and clean; removable.
- The one-off briefing file
  (`/Users/aadhilsj/Documents/FERO/HANDOVER-new-session-reminders-and-month-page-2026-09-21.md`)
  was deleted as it instructed.
- Auto-memory updated: `perfect-month-loop-design.md` (all the rules and copy
  above) and `vercel-previews-have-no-data.md`.

## 5. Next steps

1. **Founder checks the live Month tab with real Blocs** and taps back through
   past months. Fix anything that looks off with real data (photos in faces,
   Solo dashed places, sit-outs, prorated slices, long names).
2. **Copy review of the results screen** — agreed with the founder as a later,
   in-depth pass (report card lines, e.g. "Top of the Bloc. 14 workouts. Keep
   it going.").
3. Optional: add the 20 loop rule checks as a repo script (they run via
   esbuild because `MonthLoop.jsx` is JSX; the ad-hoc script is not in the
   repo).
4. Optional: swipe navigation on a real phone after this change (Playwright
   isn't installed on this Mac, so `test:mobile-navigation` can't run).
5. Brand work (Randy/Mindi) will likely restyle this; it's round one.

## 6. Deveen

Nothing here touches his area (RLS, staging, month close). The only overlap:
`AGENTS.md` now states previews can't reach the live database, which is his
runbook Task 4 result. No change to his handover.
