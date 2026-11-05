# 19–23 October — session close, and the one task waiting

**Read this first.** It closes the 19–23 October session and hands on one
specific task the founder asked to do in a fresh session.

---

## 1. THE TASK WAITING FOR THE NEXT SESSION

**Tapping a day in your own current-month calendar starts a delete instead of
showing you the workout.** The founder wants it changed. He stopped this
session rather than do it here, so start with this.

### What happens today

`src/pages/PlayerProfile.jsx`, around line 797:

```js
const canDelete = dayLogs.length > 0 && isCurMonth && !!onDeleteLog;
const openDayLog = () => {
  if (canDelete) { dayLogs.length === 1 ? setDeleteTarget(log) : setDeleteChoices(dayLogs); return; }
  dayLogs.length === 1 ? setWorkoutDetail(log) : setWorkoutChoices(dayLogs);
};
```

Delete wins and `return` means the view path is never reached. So on your own
calendar, in the current month:

- a day with **one** workout opens the delete confirmation immediately
- a day with **several** opens "Choose a workout — **Select the workout you
  want to delete**"

`setWorkoutDetail` / `setWorkoutChoices` — the actual view — only run when you
**cannot** delete: someone else's profile, or a past month.

### What he wants

Tapping should **show the workout**, with delete reachable from there as a
deliberate second step.

### Why it matters now

It is **pre-existing, not caused by this session.** It was harmless while a
day held at most two workouts. Since 23 October a day can hold several (two
per activity, no daily total), so members will tap days far more often to see
what they did — and get asked to delete something.

### Before changing it

- The same pattern may exist on the other calendars. Check `TodayPage.jsx`
  (`renderMonthLogCalendar`, `renderWeeklyStrip`) and
  `src/components/MonthCalendarCard.jsx` before editing just the one.
- The delete flow itself is wired to `onDeleteLog` and `DeleteModal`, which
  handles copies of the same workout in other Blocs
  (`findWorkoutCopiesInOtherBlocs`). Do not break that path — it is how a
  multi-Bloc workout gets deleted everywhere at once.
- The founder asked for **this change only**. He has not asked for a redesign
  of the detail screen.

---

## 2. What went live this session

| | Commit |
| --- | --- |
| A reaction counts from when it was made | `e387b2c` |
| Stream tags and first comments reach the bell (counts function) | `2099e2c` |
| The mention shimmer hugs the bubble | `08b4793` |
| Four reaction and emoji tweaks | `3c51172` |
| Bell and Stream badges match; comment "···" removed | `c4f1543` |
| Five notification timing fixes, skeleton on open | `a35d256` |
| **Two workouts per ACTIVITY per day** | `21f8425` |
| Calendar day badges tell the truth | `57795b6` |

**Live is `57795b6`.** Deployment success, bundle verified.

**On production's database, applied and verified:**
`read_ante_core_notification_counts` (new), and
`upsert_ante_core_workout_log` replaced to cap per activity.

**On a branch, built by nobody yet:**
`claude/testflight-build-12-2026-10-21` — October merged into the TestFlight
lineage, build number 12. Its worktree is kept at
`~/Developer/FERO/build-12-2026-10-21` on purpose, for the Xcode laptop.

**Written, NOT applied:** the RLS migration covering the six tables Deveen's
file misses (`20261023…` is mine; his rollout is his to run).

---

## 3. Open, in rough priority

1. **The calendar tap**, §1 above.
2. **The scoring question.** Every workout still counts toward the monthly
   target, so a 12-workout month can now be done in two days. The founder is
   weighing capping the SCORE at the first two of a day while still showing
   the rest in stats, the calendar and the feed. **Recorded in `AGENTS.md` §8.
   Do not build without him asking.**
3. **TestFlight build 12** — needs his Xcode laptop. With it: the Stream and
   finished-month screenshots, the real listing capture, the review video, the
   final test matrix.
4. **Four things before App Store submission** — the review account, the
   seeded Bloc, the video URL, and proof `support@joinfero.app` receives mail.
   See `app-store-review-notes-2026-10-22.md` §3.
5. **1 November month close** — founder dashboard first, then
   `month-close-check --after`, then `parity:gate`. **Note the workout rules
   changed 10 days before it.**
6. **Deveen:** scaling before launch, the RLS rollout, `push_devices`,
   `fero-staging` still billing.
7. The prorated status bug (`handover-2026-10-19…` §13.3), and
   `payment_methods` allowing a free-text `bank` type.

---

## 4. Not verified, and only a phone can settle it

- The 420ms/500ms hold timings on glass.
- The bell and the shimmer against a real tag from a second person.
- The per-activity cap on a real device, though it was proved against the
  production function directly and in the app.

---

## 5. Housekeeping at close

Sandboxes stopped (3000 and 54321 free), scratch worktrees removed, browser
viewport reset, shared folder level with `origin/main` and clean apart from
the four August `.dmg` backups, which were there before and were left alone.

`~/Developer/FERO/build-12-2026-10-21` is **deliberately kept** — it is the
TestFlight build, not scratch.
