# 23 October (session 2) — the calendar tap

**Live, written as this session goes.** Opened purely as a catch-up; the task
picked up from
[`handover-2026-10-23-session-close.md`](handover-2026-10-23-session-close.md)
§1 is the calendar tap.

---

## 1. State at session open

- Shared folder on `main` at `6137faa`, level with `origin/main`, clean apart
  from the four August `.dmg` backups that were already there.
- **Live is `6137faa`** — Production deployment 23 Oct 07:28 UTC, state
  `success`, bundle `assets/index-BY4Flc-X.js`. `6137faa` is docs only, so the
  last code live is `57795b6` (calendar day badges).
- Unmerged branches of note: `claude/testflight-build-12-2026-10-21`
  (deliberately kept, with its worktree at
  `~/Developer/FERO/build-12-2026-10-21` for the Xcode laptop). Everything else
  unmerged is older than 14 October.
- Nothing applied to the production database this session.

## 2. The task, verified against the code

Confirmed the behaviour described in the previous handover is still exactly as
written. `src/pages/PlayerProfile.jsx:795`:

```js
const canDelete = dayLogs.length > 0 && isCurMonth && !!onDeleteLog;
const canInspect = dayLogs.length > 0;
const openDayLog = () => {
  if (canDelete) { dayLogs.length === 1 ? setDeleteTarget(log) : setDeleteChoices(dayLogs); return; }
  dayLogs.length === 1 ? setWorkoutDetail(log) : setWorkoutChoices(dayLogs);
};
```

### Inventory — every calendar that can be tapped (AGENTS.md §7)

| Where | Tappable? | What a tap does |
| --- | --- | --- |
| `src/pages/PlayerProfile.jsx:795-800` | yes | **The bug.** Delete wins on your own current month |
| `src/pages/TodayPage.jsx:526` `renderMonthLogCalendar` | no tap handler | nothing |
| `src/pages/TodayPage.jsx:1113` `renderWeeklyStrip` | no tap handler | nothing |
| `src/components/MonthCalendarCard.jsx:58` | only with an `onDayClick` prop | its one consumer, `SettlementScreen.jsx:656`, passes none |

So the pattern exists in **one place only**. The previous handover was right to
ask, and the answer is that the other calendars are not affected.

`PlayerProfile` is hosted from four places, all of which pass `onDeleteLog`
only for your own profile: `App.jsx:3774` (the Profile tab),
`TodayPage.jsx:1532`, `HistoryPage.jsx:389`, `MonthPage.jsx:122`.

### The shape of the fix

The view path and the modals already exist and are already reachable (on
someone else's profile, or in a past month). The change is to stop delete
winning, and to add a delete action inside the detail modal at
`PlayerProfile.jsx:615`, which today only offers **Close**. `setDeleteTarget`
and `DeleteModal` stay exactly as they are, so the multi-Bloc delete path
(`findWorkoutCopiesInOtherBlocs`) is untouched.

**Not started — plan and build are separate turns (AGENTS.md §2).**

## 3. Commits

| What | Commit |
| --- | --- |
| This handover opened | pending |
