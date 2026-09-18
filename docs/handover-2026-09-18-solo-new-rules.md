# Handover — 2026-09-18: new Solo rules live

**Start here.** Picks up from Codex's unfinished Solo work (see
`docs/solo-rules-decisions-2026-09-18.md` for the founder's decisions).

## Plain-English summary

New Solo rules are live on `main` (`f7356aa`, Vercel production success,
live bundle checked, no console errors). A Solo goal is automatic: half the
Bloc target, rounded up, with no picker. Reach it and you're clear; miss it and
you pay the standard monthly penalty. A Solo miss never raises anyone else's
escalating fine, and Solo members can't receive a reward. Tobias (OSI H3,
September) stays on the old rules. No database change was made.

**Follow-up (`789a2e8`, live):** the Solo sheet's goal box now reads "6
workouts / Half your Bloc's usual 12" (founder chose "half" over "50%"), and
each request sheet mentions the Bloc Admin once. Sheet heights at 375×812:
late and second-Solo sheets 484px (was 460px), day 1–10 sheet 524px (was
497px). All fit on screen.

**Second follow-up (`d0ee6e4`, live):** the sheet was redesigned to read less
like a paragraph. Order: a "Your Solo goal" card (6 workouts / Half your Bloc's
usual 12), the intro line "Solo is for a heavier month…" on every sheet, the
four rules as an icon list ("You keep logging as normal." / "Reach 6 and
you're clear." / "If you fall short, the agreed monthly penalty applies." /
"You can't receive a reward in a Solo month."), a divider, then the Bloc Admin
approval note on the two request sheets. The founder chose "agreed" over
"standard" for the penalty wording. Spacing was tightened so every sheet fits
a 375×667 iPhone SE without scrolling: the modal's max height there is 547px;
request sheets are 523px and the day 1–10 sheet is 478px.

**Third follow-up (`72124f1`, live):** the Solo heading and goal number now use
Raleway (`DISPLAY_FONT`), like other sheet headings; the body stays Outfit. The
goal card is smaller (18px number, 11.5px subline), the reason box is 2 rows,
and the freed space went into the gaps (16px around the divider). At 375×667:
request sheets 538px, day 1–10 sheet 488px, against a 547px limit. The Sit out
sheet heading is still Outfit (not asked to change).

**Activity regression (fixed, DB only):** the App Store session's
`add_workout_post_moderation` migration dropped `activity` from
`read_ante_core_current_logs` in production, so all September workouts showed
their category instead of the activity. Restored by
`20260918120000_restore_activity_in_current_logs.sql`, applied by Claude on the
founder's instruction. Details in the App Store handover's correction section.

## How it works

- **The marker.** A new Solo entry is stored as
  `{ target, rule: "standard_penalty" }`. No marker means old rules.
- **From October 2026** every Solo is new-rules by month alone
  (`SOLO_STANDARD_PENALTY_FROM = "2026-9"`, month keys are 0-indexed). Only
  September 2026 depends on the marker.
- **Canonical has no rule column.** The marker is carried from the blob through
  every rebuild: `buildCanonicalWritableStateForGroup` (runs before every
  save), the readable overlay in `fetchReadableCurrentState`,
  `rolloverGroupIfNeeded`, `normalizeMonthHistory`, and
  `buildCanonicalMonthHistoryForGroup` (closed month rebuilt from canonical).
  Missing any one of these silently reverts a new Solo to old rules.
- **The money.** `getStandardSoloMisses` + `addStandardSoloPenalties`, mirrored
  in `api/lift-log.js` and `src/lib/appState.js`. Solo stays out of
  `calcPenalties`; each Solo miss is added afterwards at the flat
  `fineAmount`, split among regular winners like any other fine. With no
  regular winner the penalty is still owed and no payment row is created (the
  everyone-misses outcome is deliberately undecided).
- **Used by:** month close (`buildDefaultSettlements`), `buildSettlementMap`,
  `buildSettlementPairsForMonth` (payment rows), MonthPage (live "Would owe"
  and closed standings), SettlementScreen, PlayerProfile money totals and the
  Solo note.

## Verified

- Lint, build, 15 script suites (new: `test:solo-standard-penalty`, 13
  checks). `auth-edge-flows` and `mobile-navigation` not run (need a seeded
  account).
- Sandbox, real API: instant Solo on day 5 (fake server date), late request,
  exceptional request, approve, decline, cancel, sit-out clashes both ways,
  marker surviving other members' saves. 13/13.
- Sandbox, 375×812: Month page "Would owe", Solo sheets (all three modes; sheet
  portals to `body`, covers the viewport, no horizontal overflow), and
  September closed with the server and browser clocks on 2 October: Sam sees
  "You needed 6" and owes £10; Riley sees "2 to pay".
- Production, read-only: no pending Solo requests existed at ship time.

## Known, not changed

- The "Furthest behind" award excludes Solo, so it can say "Everyone hit
  target" when a Solo member missed their goal.
- The Solo goal uses the Bloc target, so a member who joined mid-month with a
  prorated target below it would get a Solo goal above their own target.
- `HistoryPage` money totals and `profileStats` "Bloc wins" never handled Solo
  at all (pre-existing).
- In the sandbox every joiner starts on Training Wheels, which overrides Solo.
  Take members off it before testing Solo money.

## Housekeeping

- Worktree `/Users/aadhilsj/Documents/FERO/fero-solo-september` (branch
  `codex/solo-september`) is still there. Its `node_modules` symlink points at
  `fero-app-store/node_modules`, not the main folder. Delete the symlink before
  removing the worktree.
- Nothing here touches Deveen's area beyond one note: if his month-close work
  replaces `buildCanonicalMonthHistoryForGroup`, the September Solo rule marker
  must still be carried (or a `solo_rule` column added).
