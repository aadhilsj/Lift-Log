# Handover — 22 September 2026: the perfect-month loop (Month page + results)

## Status

**On a preview branch, not live.** Branch `feat/month-loop`. The founder tests
the Vercel preview first; nothing goes to `main` until they say so.

No database data or schema was changed. No new API calls.

## What it is

The Month page and the end-of-month results screen are rebuilt around one
ring for the whole Bloc (the "perfect month" loop). Round-one design, agreed
over twelve mock-up rounds:

- Month page mock-up: https://claude.ai/artifact/Q6LYmz3ymv8qm6mnh5Uwph (v12)
- Results mock-up: https://claude.ai/artifact/KVondCoPEyc7h5t9Ej2V7z (v7)

Brand work (Randy/Mindi) is still pending; this is expected to get a final pass.

## Rules (agreed with the founder)

- A perfect month is every member in the month clearing their own target.
- Sitting out removes you from the loop (no slice).
- Solo keeps a full-size slice, but only the Solo target can fill (the rest is
  dashed), so the loop can't close. Nothing names the Solo member for it.
- First-month (training-wheels) members count: clearing helps, missing blocks it.
- At least 75% of the Bloc must be in the month.
- Everything for a closed month is read from that month's frozen snapshot
  (`counts`, `memberTargets`, `solo`, `excused`, `training`, `logsByUser`),
  never current Bloc settings.

This changes the results screen's "Perfect Bloc Month" test to the loop's rule
(previously a Solo member hitting the Bloc target counted; now any Solo means
not perfect, and the 75% rule applies).

## Files

- `src/components/MonthLoop.jsx` (new) — the ring (`MonthDial`), the middle
  readout, the two-line caption, the rule maths (`loopTotals`, `loopCaption`)
  and per-person history helpers (personal best, best week, track record,
  same day last month).
- `src/pages/MonthPage.jsx` — current month: ring, caption, notes (sitting
  out / on Solo / prorated), tap a slice for that person's panel. The old
  "Month in progress" card, "This Month v Last Month" card and "If the Month
  Ended Today" list are gone; their information lives in the person panel.
- `src/pages/SettlementScreen.jsx` — closed months: frozen ring, smaller
  report card with personal best + track record, awards, calendar + share,
  settlements at the bottom. Money logic, share sticker and calendar are
  unchanged.
- `scripts/test-month-sit-out-card.mjs` — updated to check the new sit-out
  behaviour (no slice, listed under "Sitting out") instead of the old card.

## Deliberate removals on the results screen (tell the founder if asked)

- Awards "Biggest Turnaround" and "Furthest Behind" → "First to Clear" and
  "Iron Week". Awards are factual; one person can sweep (founder's choice).
- "Month Summary" standings → tapping a slice shows that person's result.
- The perfect-month roster list → the ring.
- The small "Set up how people pay you" link shown to payers → a "Link a
  payment option +" prompt shown to people who are owed and have no method.
- The "View the settlement" button on a missed month → settlements are now
  directly under the calendar; Share on a missed month still scrolls there.
- The receiver ✕ (dispute) from the mock-up was not added here; the screen
  never had a dispute action. Disputes stay on Today's reminders.

## Settlements

Same records and actions as Today's reminders (`buildSettlementPairState`,
`onSettlementClaimPaid`, `onSettlementConfirmPaid`), so marking paid in one
place shows in the other. Button styles match Codex's reminder release:
cyan Confirm, muted Mark as paid, amber amount while pending.

## Verified

- `npm run lint`, `npm run build` — pass.
- All non-browser `test:*` scripts pass. `test:mobile-navigation` and
  `test:auth-edge-flows` can't start here (Playwright not installed).
- Rule checks for the loop (20 cases: Solo, sit-outs, 75%, first month,
  captions, personal best, track record, week boundaries) — all pass. Run ad
  hoc with esbuild; not added as a repo script.
- Sandbox at 375×812 and 320px: Month page ring, person panel, results for a
  winner and a payer, award tap, Mark as paid prompt. No horizontal overflow.

## Not verified

- Real data with photos, Solo, sit-outs, prorated joins together — needs the
  preview (which reads production data).
- Swipe navigation between tabs on a real phone (Playwright unavailable).
- Desktop layout: same component, not tuned (mobile-only product).
