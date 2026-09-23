# Handover — 22 to 23 September 2026: the Month ring polished, a Bloc streak on Today

Read this first in the next session. Everything below is **live on `main`** and
verified: on `main`, deployed by Vercel to Production for that exact commit, and
found in the live bundle. No database data or schema was touched all session.

## TL;DR

- The Month ring got bigger, calmer and clearer, on the live month and on the
  results screen (`427f311`, `9f42ce1`, `27c733e`, `5851e7c`).
- Today gained a **Bloc streak card** and a **Bloc Loop card** that replaces
  Bloc Month (`5851e7c`, then three fixes).
- The results **report card was rebuilt**: smaller, analog, one colour hint per
  result (`5851e7c`).
- The bug playbook and the solved-issues log gained six entries from earlier
  September work (`6630023`).
- **Open:** per-member workout dates (the time-zone question), agreed to be its
  own session. Nothing else is outstanding.

## 1. Commits, in order

| Commit | What |
|---|---|
| `6630023` | Docs only: five playbook entries, one solved-issues entry |
| `427f311` | Month page: bigger ring, cleared slices lit, Solo wording, no dead space |
| `9f42ce1` | Glow draws cleanly on every slice; results screen uses the new ring |
| `27c733e` | Tapping an open slice spotlights it |
| `5851e7c` | Calm faces, Bloc streak card, Bloc Loop card, perfect-run pill, report card |
| `135914b` | Stat cards back to 80px |
| `8c8f790` | Removed the unreachable Bloc Month History pop-up |
| `aeba49b` | The Bloc Loop count sits inside the ring |
| `d8b0461` | The Bloc Loop count matches the Month caption (Solo slices not counted) |

## 2. The Month ring

Design decisions are the founder's, taken over this session against mock-ups:
- Month ring set: https://claude.ai/artifact/D2FJCqVaDcVXTBJDmSbYEV
- Today, streaks and report card: https://claude.ai/artifact/Ndb93EZdi9kfYMBaCmg5x1

What changed:

- **Bigger.** The live ring runs edge to edge, about 7% larger, centre unmoved.
  `RING_LIVE` in `src/components/MonthLoop.jsx`; the results screen passes
  `live: true` too, so both months look the same.
- **Faces scale with the Bloc:** 24px up to 12 people, 17px at 20
  (`liveFaceSize`), and always keep 8 units clear of the extra-workout ticks.
- **Faces are veiled at rest** (`FACE_VEIL_PHOTO`, `FACE_VEIL_LETTER`): a letter
  avatar is a flat block of colour, so it is calmed harder than a photo. The
  face you tap returns to full colour. This was the fix for "a ring of
  confetti" in Blocs where nobody has a profile photo.
- **Cleared slices** are full cyan with a soft glow; open ones are dim teal.
- **Tapping an open slice spotlights it**: a soft band behind it, brighter
  progress, and the rest of the ring drops to 12% instead of 22%. A cleared
  slice already glows, so it keeps the 22%.
- **Extra-workout marks** are quiet grey-cyan at rest, white for the person you
  tap.
- **Layout:** month switcher one line higher (`STEPPER_TOP`), a tick separator
  under the caption, notes and hint just above the nav, and with no notes the
  caption drops 30px and slides back up when a slice is tapped. The resting page
  fits the screen exactly (`RESTING_MIN_HEIGHT`, `RESTING_OVERLAP`); with a
  person open it ends after their track record, like Today.

### Copy rules now in code

- "Your Bloc", never "The Bloc".
- Solo: the middle reads **"Can't be perfect"** (also when under 75% are in the
  month). When every other slice has cleared: "A Solo month keeps/kept the loop
  from closing."
- A member's own streak says **"N consecutive months cleared"**, deliberately
  worded differently from the Bloc's "N Perfect months in a row".
- Fixed while building: a lone "." on the Month page, and "0 workouts from a
  perfect month" on results, both when a Solo month had every other slice clear.

## 3. Today

- **Bloc streak card** (`src/lib/blocStreak.js`): consecutive days on which
  anybody in the Bloc logged a workout.
  - Appears at **10 days** (`BLOC_STREAK_MIN_DAYS`), disappears if the chain
    breaks, and stays gone until the Bloc builds back to ten.
  - Turns amber from **7pm** on the Bloc's clock (`BLOC_STREAK_WARN_HOUR`) when
    nobody has logged; after midnight the copy names **3am**, the real deadline,
    because a Fero day ends at `LEAGUE_CUTOFF_HOUR = 3`.
  - Counted from **workout dates**, not save times, so a workout logged late
    repairs the day it belongs to and the streak jumps back up.
  - Tests: `npm run test:bloc-streak` (12 cases). It is **not** in `ci.yml`,
    which lists suites explicitly — add it there if wanted.
- **Bloc Loop card** replaces Bloc Month: the Month ring in miniature, one
  segment per member in the month, lit when they have cleared, count inside the
  ring, and a tap opens the Month tab (`onOpenMonth` in `src/App.jsx`).
  Bloc Month's number duplicated History and disagreed with the ring.
- "+N ahead" is **white**; cyan on Today now means the Bloc's loop.
- The unreachable Bloc Month History pop-up was removed.

## 4. The results report card

Rebuilt in `src/pages/SettlementScreen.jsx` (`renderReport`, `REPORT_TONES`):
stamp, the work, one line of copy, and the money beside it only when money
moved. About a third shorter than before. Each result keeps a hint of its old
colour: green won, red lost, silver cleared, amber first month, cyan perfect.
On a perfect month the stamp is "Your <Month>", because the ring already says
the Bloc's result. The perfect-run pill (`PerfectRunPill`, `perfectMonthRun`)
shows under the Month caption and on a perfect month's results.

## 5. Three mistakes worth knowing about

1. **A clipped glow shipped twice.** The SVG filter was sized to each slice's
   own box, so slices running almost straight had their blur cut flat. Fixed in
   the app with `filterUnits="userSpaceOnUse"` over the whole dial — then the
   same bug reappeared in the mock-up generator, which had never received the
   fix. If a glow ever looks squared, check the filter region first.
2. **The stat cards grew from 80px to 94px** because the loop card put its count
   under the ring. Compressing it by moving the count beside the ring was the
   wrong fix and had to be redone: the card now takes the space the sub-line
   would have used, ring 40px, count inside, all four cards 80px again.
3. **The loop card counted every slice** (5/7) while the Month caption counts
   only the slices that can clear (5 of 6). A Solo slice is drawn and not
   counted. Both now use that rule.

## 6. How this was verified

- `npm run lint`, `npm run build`, and all 21 non-browser `test:*` suites pass.
  `test:mobile-navigation` and `test:auth-edge-flows` still cannot run here
  (Playwright is not installed in this checkout).
- Sandbox at 390px, 375px and 320px: Today, the Month tab with 13 and 21
  members, a perfect month's results, a winner's card, a missed card, the
  remaining stat pop-ups. No horizontal overflow anywhere.
- Each push checked three ways: the commit on `main`, a Vercel Production
  deployment for that exact SHA, and the changed strings present in the live
  bundle.
- **A crash reached the sandbox once:** `Array.from`'s callback has no third
  argument, so the streak ticks read `all.length` of `undefined` and the Today
  error card appeared. Caught, fixed, re-tested before the push.

## 7. Sandbox notes

- Test data was shaped by hand in `.sandbox-data/blob.json` (extra members,
  daily logs for the streak, perfect closed months, a Solo member). The seed
  backup is `.sandbox-data/blob.seed-backup.json`; the sandbox was restored to
  it and stopped at the end of the session.
- The browser holds a cached copy in `localStorage` (`ll_cached_data_v2`).
  After editing the blob by hand, clear it or the app shows the old data.
- The sandbox's "Local test identity" bar is dev-only and shifts the layout;
  hide it before measuring anything.

## 8. Open, for another session

- **Per-member workout dates.** Today a Fero day ends at 3am in the *Bloc's*
  time zone, so a member in another country can log a 5:30am workout and have it
  land on the day before. The proposal: keep the Bloc's clock for everything
  (month boundaries, close, settlements) but stamp a workout with the date it is
  for the member who logged it. The edge to handle is a workout dated into a
  month the Bloc has not opened yet, which touches month close. The founder
  wants this looked at properly on its own.
- Optional: add `test:bloc-streak` to `ci.yml`.
- Brand work (Randy/Mindi) is still expected to restyle all of this.

## 9. For Deveen

Nothing here touches his area. No migrations, no RPC changes, no writes. The
only new file on the backend side of the fence is `src/lib/blocStreak.js`, which
reads the state the client already has.
