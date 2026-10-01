# Handover — 30 September into 1 October: the month close, and the money it hid

Claude, operating. One long overnight session that started as "get up to speed"
and ended with the 1 October month close being broken and fixed in production.

Where this disagrees with an older dated handover, this wins. Where it
disagrees with `docs/WHATS-LIVE.md`, that file wins.

`main` finished at **`7f2bd10`**. Every commit below deployed green.

---

## 0. Read this first — what actually happened

**The 1 October month close failed for half the Blocs, for about six hours.**

`rebuildClosedMonthSnapshotFromCanonicalLogs` was fed the wrong month's logs.
The rollover fetched them with `fetchAnteCurrentLogs()`, whose RPC ends
`where s.status = 'open'`. The canonical rollover closes September and opens
October *first*, so by the time month close asked for logs, the only open
season was the new empty one.

The guard saw zero canonical rows against a blob that counted workouts and
refused to freeze the month — **correctly**; that guard exists because a
wrongly frozen settlement is permanent. It was simply reading October.

Result: the Bloc was skipped and retried on every read. **862
`rollover_skipped` events across 9 Blocs.**

Everything else that looked wrong that night was downstream of this:

- Nine of eighteen Blocs never wrote September to the blob.
- That lost the **Solo standard-penalty marker**, which is carried from
  `blobMonth.solo` because canonical has no rule column. Rahul — Solo target 6,
  logged 5 — showed "Nothing to settle" instead of owing $20 in Go To Da Gym
  and £10 in Sarandawgs. Rithu the same.
- StavanGang and others looked like they had reset.

**Fixed in `c9ce86a`.** Additive migration
`20261001070000_read_ante_core_logs_for_month.sql`, applied to production:
`read_ante_core_logs_for_month(p_month_key)` is identical to
`read_ante_core_current_logs()` except it filters `s.month_key` instead of
`s.status`. The old function is untouched. Grants match it exactly —
`service_role` only, never `anon` or `authenticated`. The rollover now fetches
once per *distinct* closed month, because Blocs roll at their own 3am and two
time zones can close different months in one pass.

**Verified at 11:19 UTC, 6½ hours later:** last skip ever 04:46:39, zero since,
18 of 18 Blocs closed, Aadhil confirmed Rahul and Rithu on his phone.

### The lesson worth keeping

**The founder dashboard already said this.** It read "745 Blocs skipped in 7
days" with the exact reason on screen, and I spent an hour reading code before
he sent me a screenshot of it. **Check the dashboard before reading source.**

I also shipped one fix (`64fab2f`) that addressed a symptom of this rather than
the cause — a fallback so the Solo marker is read from the live `group.solo`
map when the snapshot is missing. It is harmless and a genuine safety net, and
it is still in. But it was not the fix, and I should have found §0 first.

---

## 1. Money bugs found and fixed

Both are the "same figure computed in more than one place" problem from
`AGENTS.md` §7. Both were wrong in the copy nobody re-checked.

**`cc6c990` — the all-time leaderboard charged exempt members.**
`HistoryPage.jsx`'s money loop checked only `excused`, so a Solo or Training
Wheels month still counted as a failure to hit target. `PlayerProfile.jsx` had
it right all along. Against production: Sarandawgs August, Rithu and Deveen each
shown owing 15 → both 0. It also invented winnings, because the pot was funded
by those phantom fines: mindi 30 → 0, Aadhil 10 → 0. Real misses untouched.

**`9b25e74` — Most Diverse counted the category, not the activity.**
It read `log.type`, the five broad buckets, so Basketball, Padel, Badminton and
Volleyball all collapsed into one "Sports". Now reads `getLogDisplayActivity`.
Go To Da Gym September: Isira with 4 becomes **Aadhil with 6**. Ties were
already broken on count then name — unchanged.

---

## 2. UI changes

**`7ac1220`** — two changes to the ended-month screen.

- **Close button on the share sheet.** It had none; tapping the backdrop worked
  but on a phone the sheet fills the screen. Uses the same round 30px control
  the app already has elsewhere, top right, with the title given `paddingRight`
  so a long month name cannot run under it. **Width and padding unchanged.**
- **Your own card now leads the report**, then the dial, then awards, then the
  calendar. The focus plate stays with the dial because it is what a slice tap
  opens. `renderReport()` returns null for a month you were not in, in which
  case the dial leads exactly as before. **Only the order changed — nothing was
  resized, restyled or removed.**

**`5f84b54`** — no haptic when you tap the nav bar. Instagram buzzes on swipe
and stays silent on tap; Fero buzzed on both, and on a tap the buzz lands
before the screen does, which reads as lag. Swipe-to-change-tab and the Bloc
back-swipe keep theirs. Verified in the sandbox with haptics instrumented to
log on web: **four nav taps produced zero calls, one swipe produced exactly
one**. Native-only, so it reaches members through a TestFlight build.

**`b7c9f78`** — the comment-thread react bar opened on the opposite side from
the message. Own comments sit right, the bar pinned left. Not a regression from
the emoji work — `4c4b6f2` left those two lines untouched; it became visible
because the bar went from eight emoji to five plus a more button, narrow enough
to show the offset. Measured at 375px: own comment's bar now spans x 251–359,
another member's x 16–124.

---

## 3. Production data changed, at the founder's request

| Bloc | Member | Change |
| --- | --- | --- |
| StavanGang | Marlène | July sit-out; August + September Solo, target 5 |
| Active divas | Emma | September Training Wheels |
| Sweat Equity | Manz | September Training Wheels |

Written to **both** `ante_core.season_member_status` and the blob, plus two
approved `solo_requests` rows for Marlène so the grants have a paper trail.
Verified by running `buildDefaultSettlements` and `buildSettlementPairsForMonth`
against production: none of the three owes anything, and Bananaaaa's genuine
September miss is untouched.

Backups, read-only copies, safe to drop once reviewed:

```
ante_core.backup_solo_tw_2026_10_01_blob
ante_core.backup_solo_tw_2026_10_01_member_status
ante_core.backup_marlene_jul_aug_2026_10_01
ante_core.backup_blob_before_force_rollover_2026_10_01
```

### The correction that cost two wrong answers

**Read `monthHistory[].memberTargets[name]`, never `seasons.min_target`.**

I twice reported people as owing money by reading the Bloc MAS instead of the
frozen per-member target:

- **Two & a half men** — real prorated target 2, reported as 15, so Imadh looked
  like he failed when he had passed.
- **StavanGang June** — Marlène's target was prorated to 7 and she logged
  exactly 7. She cleared. I reported her as owing.

Two separate things reduce a target and they are not the same: **Bloc
proration** (the whole Bloc started mid-month, `season_overrides`) and
**per-member proration** (that member joined mid-month). Saved as a standing
memory.

---

## 4. Found and deliberately **not** fixed

**A prorated target can exceed the full target.** Active divas September:
`season_overrides.prorated_mas` is 12 while `seasons.min_target` is 11.
Proration is computed once when the admin chooses it (`src/App.jsx:3453`); the
Bloc target was later lowered to 11 and nothing recomputed the override. The
settings-update path never touches `season_overrides`.

Nobody was harmed — Emma logged 0, Masha cleared either way — but any Bloc that
lowers its target mid-month leaves its members on a higher one. Suggested fix:
recompute on target change, and clamp so it can never exceed the full target.
Left alone because it is a behaviour change, not a 6am patch.

**Related trap:** starting on the 2nd of a 30-day month gives 29/30, so a
"prorated" target is 97% of the full one. Two & a half men starting on the 27th
got 2. Both correct by the formula, wildly different in feel.

**The lazy month close.** The blob rollover is computed on every read but only
*persisted on a write*, so a Bloc nobody touches sits half-closed. During 1
October that hid real settlements for hours. Aadhil's words: *"that shouldn't
be the case... it's a bug, it's a delay."* He wants the close to write itself
when the month turns. Flagged in Deveen's §13.

---

## 5. Two Training Wheels rules that were written down nowhere

Both surfaced when Aadhil asked for a Bloc's whole first month to be covered.

1. **The Bloc creator never gets Training Wheels.** `getCreatorMonthContext`
   returns null for the admin who created the Bloc that month, so they are not
   treated as a late joiner. Deliberate — they chose when to start and set the
   target — but undocumented, and it surprised us.
2. **There is no "whole Bloc's first month" switch.** `settings.trainingWheels`
   only controls whether the *offer* appears; the grant is per member, per
   month, by their own choice. Covering a first month means a grant per member.

---

## 6. CI, and why it went red

Two of the 21 offline suites fail on the calendar, not the code. Recorded in
full in Deveen's §10.

- **`test:solo-sitout-exclusion` fails days 1–10 of every month.** Solo before
  day 10 is instant, so there is no pending request to cancel. Reproduced with
  a faked clock: passes 30 Sep, fails 1/2/5/9/10 Oct, passes from the 11th.
  **It will go red again on 1 November.**
- **`test:month-close-canonical` fails 00:00–03:00 UTC on the 1st**, the gap
  between UTC midnight and the 3am Bloc-day cutoff. Clears itself.

Both should be pinned to a fixed date so they test the rule, not the calendar.

---

## 7. The machine got slow, and why

`AGENTS.md` told every agent to create worktrees under `~/Documents/FERO`,
which is **iCloud-synced**. By 1 October there were **27** there, 25 holding a
built `dist/`. Every `npm install` and every rebuild was uploaded file by file.

- `npm run lint` took 90s instead of 3
- `git status` hung for minutes
- a plain `mv` out of the folder sat **17 minutes having used 0.02s of CPU**,
  blocked behind the iCloud daemon at 65%
- iCloud had started writing conflict duplicates (`config 2.xml`,
  `README 2.md`) **inside the repo**

**26 of 27 deleted** — every branch was already on GitHub. `git status` went
from timing out at 120s to **0.04s**. `AGENTS.md` now says `~/Developer/FERO`
and tells you to remove a worktree when its branch is done (`eee3e91`).

**Still open:** the main folder and its `node_modules` are still in iCloud, so
`npm run lint` still takes ~3 minutes. I moved `node_modules` out and symlinked
it; **`npm install` replaced the symlink with a real directory** and put it
back. The real fix is moving the main checkout to `~/Developer`, which needs
the founder because it breaks the session's working directory.

**Never commit a file whose name ends in " 2" or " 3" — they are sync
artifacts.**

---

## 8. Honest gaps

- **`npm run lint` and `npm run build` were not run on the last four commits.**
  Each file was syntax-checked with `node --check` and every Vercel Production
  build succeeded, but that is not the same thing. Worth a clean pass.
- **`test:auth-edge-flows` and `test:mobile-navigation` are still broken**, not
  merely un-runnable. 23 of 25 remains the honest number.
- **The new RPC has no test.** Nothing in CI closes a month after the canonical
  season has already flipped — the exact shape of §0. Asked for in Deveen's §12.
- **I did not reproduce §0 in the sandbox.** It was diagnosed from production
  reads and the founder's dashboard screenshot, then verified after the fact by
  the skip count stopping. A sandbox reproduction would be better.

---

## 9. Commits, in order

| | |
| --- | --- |
| `5f84b54` | no haptic on nav-bar tap (+ Codex's WHATS-LIVE note finished) |
| `b7c9f78` | react bar on the same side as the comment |
| `5d5c713` | docs: Deveen — CI red on 1 Oct, and the close verified |
| `cc6c990` | all-time leaderboard: Solo and Training Wheels keep you out of the money |
| `eee3e91` | worktrees go in `~/Developer`, never `~/Documents` |
| `9b25e74` | Most Diverse counts the activity, not the category |
| `7ac1220` | share-sheet close button; your own month leads the report |
| `64fab2f` | Solo marker fallback when the month has no blob snapshot |
| `c9ce86a` | **month close reads the month it is closing** |
| `7f2bd10` | docs: Deveen's full handover for this session |
