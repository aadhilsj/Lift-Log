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

**Built, shipped and live at `ca248a2`.** See §3.

## 3. What changed, and what it is now

`src/pages/PlayerProfile.jsx`, two places, nothing else:

1. `openDayLog` no longer branches on delete. A tap always runs the view path —
   one workout opens the detail sheet, several open "Choose a workout — select
   a workout to view its details".
2. The detail sheet carries a **Delete workout** button above **Close**, shown
   only when `isCurMonth && !!onDeleteLog` — the same two conditions that used
   to let a tap delete. It hands the log to the existing `setDeleteTarget`, so
   `DeleteModal` and `findWorkoutCopiesInOtherBlocs` are untouched and a
   multi-Bloc workout still deletes everywhere at once.

### Deliberately left alone

The `deleteChoices` sheet ("Select the workout you want to delete") is now
unreachable — the calendar was its only caller. Its state and markup were left
in place rather than removed, because removing them is cleanup nobody asked
for. It costs a few hundred bytes of bundle and no behaviour. Worth deleting
the next time that file is open for another reason.

## 4. How it was verified

Sandbox at 375×812, signed in as Tariq (`riley@local.test`), with three
activities seeded on 23 October, one on 22 October, and a closed September
seeded into `monthHistory`:

| State | Result |
| --- | --- |
| Own profile, current month, **one** workout | Detail sheet: Pilates, 22 October, the note, **Delete workout** + Close ✓ |
| Own profile, current month, **three** workouts | "Choose a workout — select a workout to view its details"; picking Run opened its detail sheet with Delete ✓ |
| Own profile, **closed** month (September) | Detail sheet, **Close only** — no delete ✓ |
| **Another member's** profile (Hana) | Detail sheet, **Close only** — no delete ✓ |
| Delete from the detail sheet | Opened the real `DeleteModal`, named the right workout, "Keep it" backed out ✓ |

`npm run lint` clean. `npm run build` clean. No console errors in the sandbox
or on the live site.

**Test scripts run:** `test:two-workouts`, `test:fero-profile-stats`,
`test:month-sit-out-card`, `test:activities`, `test:notification-badge`,
`test:identity` — all passed.

**`test:mobile-navigation` fails, and it is not this change.** It times out
waiting for "Your Blocs". Confirmed pre-existing by stashing the change,
rebuilding and running it again — it fails identically. The cause is the
sandbox blob: the script expects the seeded identity `seed-invite@local.test`
and invite code `ALHK05`, and the blob in `.sandbox-data/` was carried over
from an earlier session with different seed data. Deleting
`.sandbox-data/blob.json` and reseeding should settle it. **Not investigated
further — outside this task.**

**Not verified:** the sheet on a real phone, on glass.

## 5. Commits

| What | Commit | Live? |
| --- | --- | --- |
| This handover opened | `a0f3ad2` | n/a |
| Tapping a calendar day shows the workout | `ca248a2` | **yes** |

Pushed straight to `main` at the founder's instruction. Production deployment
of `ca248a2` reported `success`; the live bundle `assets/index-BQ6nZQi3.js`
carries the new button's style, and the live site loads with no console
errors.

## 6. Still open

Unchanged from the previous handover: the scoring question (AGENTS.md §8),
TestFlight build 12, the four App Store items, the 1 November month close,
Deveen's list, and the prorated status bug.

## 7. Housekeeping at close

Sandbox stopped by PID on ports 3000 and 54321. Browser viewport reset. The
shared folder is on `main`, level with `origin/main`, clean apart from the four
August `.dmg` backups that were there before. No worktrees added or removed.
Nothing was run against the production database this session.
