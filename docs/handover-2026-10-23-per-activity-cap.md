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

## 7. Timing

Shipped **ten days before the 1 November month close**, which is the first
full close since the one that broke on 1 October. The founder was told and
chose to ship now.

**If anything looks wrong on 1 November, this is a change to how workouts
count and it landed in the same fortnight.** Check it early.
