# Handover — the founder is out of the usage numbers (2026-09-24)

Live on `main` as `eb21de6` and `f6fbb06`. Third and final piece of the
2026-09-24 dashboard work, after
`handover-2026-09-24-dashboard-metrics-accuracy.md` and
`handover-2026-09-24-usage-tracking-release-2.md`.

## Why

**4,019 of the 8,186 usage events ever recorded were the founder's own
testing — 49% of the table.** The distortion sat almost entirely in the volume
columns:

| | Was | Members only | Was him |
|---|---|---|---|
| Month Standings Expanded | 37 | 3 | 92% |
| Reaction Picker | 497 | 145 | 71% |
| Other Profiles | 734 | 285 | 61% |
| Today Screen | 1,829 | 920 | 50% |
| Activity Screen | 2,438 | 1,354 | 44% |

**The Users columns barely moved** (Activity Screen 39 → 38). One person only
ever adds one to a distinct count. So reach was roughly honest all along; it
was "uses" and "avg uses" that misled.

## The rule now in force

**Real things he actually did stay. Things he did only because he is testing
go.**

| | Founder counted? | Why |
|---|---|---|
| Workout uploads | yes | real training |
| Active Users | yes | counts a person once a day, honest either way |
| Feature Engagement | yes | counts people, not taps — see below |
| Usage events | **no** | every tap counted, so he was 49% |
| App Opens | **no** | he launches Fero dozens of times a day |

**Feature Engagement was deliberately left alone.** It reports "19 of 43
reacted": the founder is one of the 43 and one of the 19, and reacting four
hundred times while testing still puts him in the 19 exactly once. His
distortion there is one person in 43, about 2%. He is also on both sides of
the fraction, so including him keeps it internally consistent — excluding him
from the numerator alone would make it *less* accurate. Revisit only if
precision matters more than simplicity.

## How it works

- `recordCanonicalUsageEvent` and `recordCanonicalDailyAppActivity` in
  `api/lift-log.js` return early for the founder. The activity one falls
  through to `markCanonicalDailyAppActive`, which updates the day without
  incrementing `open_count` — that is what keeps him in Active Users.
- Both helpers take the **auth user object**, not its id, so
  `isFounderDashboardUser` can match on `FOUNDER_DASHBOARD_USER_IDS` *or*
  `FOUNDER_DASHBOARD_EMAILS`. An id alone matches only the first, which would
  fail silently if a deployment ever configured just the email. Production has
  one entry in each.
- History was **moved**, not deleted:
  `ante_core.app_usage_events_archive`, 4,019 rows, each carrying
  `archive_reason`. Undo is `insert ... select` back from it.

**A read-time filter was considered and rejected.** It would have to be
remembered by every present and future dashboard query — the same shape as the
bug that silently discarded `bloc_loop_opened` for weeks. Rows that are not in
the table cannot be forgotten.

## Two dead cards retired

`monthly_summary_card_clicked` (Month Standings expander, gone in the Month
redesign) and `bloc_month_opened` (Bloc Month card on Today, replaced by the
Bloc Loop card) are no longer reported. Neither is fired anywhere in `src/` or
`api/`.

**Their names stay in the allowlist and the `app_usage_events` check
constraint on purpose.** Real member rows from when those features existed are
still in the table, and a check constraint is validated against existing rows —
dropping the names would either fail outright or force deleting genuine
history.

## Also fixed

Picking a Bloc in the switcher lands on Today and now records `today_opened`.
It called `setPage` directly before, so every Bloc switch was a Today Screen
visit the dashboard never saw.

## State at handover

- Production usage table: 4,167 live rows + 4,019 archived = 8,186, every row
  accounted for. Founder rows in the live table: 0.
- Usage tab reports 26 events (was 28 before the two retirements).
- Three rows legitimately read 0 and are waiting on real members, not broken:
  Bloc Loop Card, Settlement Reminders, Photo Browsed.
- App Opens is exact only from 24 Sep 2026; earlier days hold one open per
  active person, so October is the first fully trustworthy month.

## Still open

- Arrivals still record no screen open: joining by invite, creating a Bloc and
  signing in all land on Today, as does returning from Month. The Bloc switcher
  case is now fixed; the rest were left deliberately. Whether an arrival should
  count as an open is a product question, not a bug.
- `handleStreamSeasonClosedTap` jumps from the Bloc Stream to last month and is
  the one untracked route into the Month screen.
