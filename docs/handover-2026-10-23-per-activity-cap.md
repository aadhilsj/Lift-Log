# 23 October — the daily cap becomes two per activity

## Plain-English summary

Fero used to allow two workouts a day, full stop. It now allows **as many as
you like, but no more than two of the same activity**. Two runs, a gym session
and a padel game is fine. Three runs is not.

Live. Applied to the production database, shipped to the website, and it
reaches the phone app on the next TestFlight build.

## 1. The rule

**Two per ACTIVITY per day. No cap on the total.**

Keyed on the **specific activity**, not the broad type. Padel, Tennis and
Basketball are all "Sports"; a cap on the type would have treated three
different sports as three of the same thing. The founder's own examples only
hold if they count apart.

Two existing behaviours are unchanged and deliberately so:

- **The cap spans all your Blocs.** Two gym sessions anywhere means no third
  gym session anywhere. It is your day, not the Bloc's.
- **One workout logged to several Blocs is still one workout.**

## 2. THE OPEN QUESTION — the founder knows, and is thinking about it

**The monthly score still counts every workout.** Someone who logs two runs,
two gym sessions and two padel games is **six closer to their target in one
day**. A twelve-workout month that used to need at least six separate days can
now be done in two.

`AGENTS.md` §8 used to justify the old cap as rewarding "consistency over
intensity". That property is gone, and it went deliberately — the founder was
told before this was built and chose to ship it and think about the scoring
separately.

**The shape he is considering, in his words:** log as many as you like, but
the **score** only goes up for the first two of a day. The third still shows
in your stats, your calendar and the activity feed — you can see you did it —
it just does not earn another point.

**Not built. Do not build it without him asking.**

## 3. Enforced in three places, which must agree

| Where | What |
| --- | --- |
| `upsert_ante_core_workout_log` (database) | The real guard. Advisory lock per profile + date + activity, then counts distinct session keys in that bucket |
| `assertWorkoutSlotAvailable` (`api/lift-log.js`) | Server-side check before the write |
| The log modal (`src/modals/modals.jsx`) | What the member sees |

All three derive the bucket the same way: **the specific activity, falling
back to the broad type** when a log has none — the same fallback
`getLogDisplayActivity` uses, so none of the three can disagree about what
"the same activity" means.

About half the logs written before 16 September 2026 carry no activity. Every
log since does — **450 October logs, zero missing** — so the fallback only
affects history, not anything being capped today.

### The log screen had to change shape

It used to decide "you have already logged 2 today" **before** the member
picked anything. It cannot any more: two runs blocks a third run and permits a
gym session, and the screen only knows which when they choose. The check now
recomputes as they pick, and the message names the activity —
*"Already logged 2 Gym workouts for this date"* — so it is obvious something
else can still be logged.

## 4. Applied to production

Migration `20261023100000_cap_two_per_activity_per_day.sql`, applied as
`cap_two_per_activity_per_day`.

**Guarded.** The migration aborts unless the live function's md5 is
`b99164508e4b13eeb6b257849ed08d8f`, the revision it was written against. Every
line outside the cap block is byte-identical to what was live.

| | Before | After |
| --- | --- | --- |
| `ante_core.workout_logs` | 2,377 | **2,377** |
| `ante_core.profiles` | 48 | **48** |
| `anon` can execute | false | **false** |
| `authenticated` can execute | false | **false** |
| `service_role` can execute | true | **true** |

**Rollback:** re-apply
`20260827112719_enforce_two_workouts_per_day_atomic.sql`, whose cap block is
the pre-change version.

## 5. Verified

**Against the production function itself**, in a transaction that rolled
itself back — nothing persisted, confirmed afterwards at 0 test rows:

| Attempt | Result |
| --- | --- |
| 1st Run | allowed |
| 2nd Run | allowed |
| 3rd Run | **refused — "Already logged 2 Run workouts for this date"** |
| Gym, same day | allowed |
| 2 Padel | allowed |
| 3rd Padel | **refused — "Already logged 2 Padel workouts for this date"** |
| Kitesurfing, same day | allowed |

**In the app**, with two gym sessions seeded for today: picking Gym shows the
red "Already logged 2 Gym workouts for this date" and outlines the date field;
picking Run clears it. The heading reads "Log another workout".

**Tests.** `test:two-workouts` rewritten around the new rule — a third of the
same activity refused by name, a different activity allowed, four workouts in
a day allowed, Padel and Tennis counted apart though both are Sports, the
cross-Bloc behaviour preserved, and the per-activity counter agreeing between
API and client.

Lint and build clean. **25 of 27 suites pass** — the two failures are
`test:auth-edge-flows` and `test:mobile-navigation`, the known pair that fails
on `main` too.

## 6. One thing I got wrong on the way

The first draft of the test claimed Padel and Kitesurfing were both "Sports".
**Kitesurfing is "Other".** Caught by listing the categories rather than
trusting the example, and the test now uses Padel, Tennis and Basketball,
which genuinely share a category and so actually prove the point.

## 8. Post-ship audit — one real bug found (23 October)

The founder asked for a sweep of every screen after shipping. Driven in the
sandbox with **four workouts logged on one day** (2 Gym + 2 Run).

### 8.1 FIXED — calendar day badges were clamped to "2"

Four places render the day badge as **`Math.min(dayLogs.length, 2)`**:

| File | Surface |
| --- | --- |
| `src/pages/PlayerProfile.jsx:800` | The Profile tab calendar, and a member's in-Bloc profile |
| `src/pages/TodayPage.jsx:556` | `renderMonthLogCalendar` on Today |
| `src/pages/TodayPage.jsx:1140` | `renderWeeklyStrip` on Today |
| `src/components/MonthCalendarCard.jsx:73` | The settlement screen's calendar |

With four workouts on one day, **every one of these says "2"**. Confirmed on
screen on two of them; the other two are the same expression.

That clamp was correct when the cap was two a day. It is wrong now, and it
contradicts the founder's own intent for the change — he said the extra
workouts should still be visible in the calendar.

**Fixed.** The four inline clamps are replaced by one
`formatDayWorkoutCount` in `src/lib/appState.js`, so they cannot drift apart
again — four copies of the same expression is how this happened. Over nine it
shows **`9+`**, because the circle is ~12px and two digits do not fit; the
notification badge already solves it that way.

Verified on screen: the same day that read "2" now reads **4**. Pinned by
unit tests for 2, 3, 4, 9, 10, 37 and for junk input, so a day never renders
`NaN` on a calendar.

**One thing I broke and caught while fixing it:** the first attempt added the
import with a regex that matched *every* `import {` in the file, inserting the
symbol into fifteen import statements in one file and eighteen in another.
Caught by counting occurrences before building rather than after. Reverted
both files and redid it against the exact appState import block.

### 8.2 Everything else checked out

| Surface | Result |
| --- | --- |
| Bloc leaderboard count | **18** — all four counted |
| Profile "18 workouts, 6 ahead of target" | Correct |
| ALL BLOCS total | **18** |
| Profile heatmap | Correct; `heatCell` already handles 4+ |
| Workout Breakdown | Gym 9 + Run 7 + Pilates 2 = **18** |
| Activity feed | All four rows shown separately |
| Tapping a calendar day | Lists all four — 1. Gym, 2. Gym, 3. Run, 4. Run |
| Month ring | **37 of 60, unchanged** — and correct: it caps each member at their target (12+11+8+4+2), because it measures everyone hitting target, not raw volume |

### 8.3 Two risks ruled out, with evidence

**The loosened database lock is safe.** The cap's advisory lock went from
per profile+date to per profile+date+activity, which allows two different
activities to be written concurrently where they used to serialise. Checked
every function on production that takes an advisory lock: only
`upsert_ante_core_workout_log` uses the `workout-day:` key, so nothing else
depended on that serialisation.

**No log path can skip the activity.** Only two functions create workouts,
`applyAddLog` and `applyMultiLog`, both via `resolveWorkoutActivity`, and both
now pass the activity to the guard. There is no Strava or import path writing
logs behind them.

### 8.4 Noted, pre-existing, not caused by this change

Tapping a day in your own current-month calendar opens the **delete** chooser
("Select the workout you want to delete"), not a view. That was true before
this change, but members will tap days far more often now that a day can hold
several workouts, so it is more exposed than it was.

## 7. Timing

Shipped **ten days before the 1 November month close**, which is the first
full close since the one that broke on 1 October. The founder was told and
chose to ship now.

**If anything looks wrong on 1 November, this is a change to how workouts
count and it landed in the same fortnight.** Check it early.
