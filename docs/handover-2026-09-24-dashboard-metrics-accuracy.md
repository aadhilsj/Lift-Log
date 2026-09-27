# Handover — founder dashboard accuracy (2026-09-24)

Shipped to `main` and applied to production. Two commits: `e58ea83` (code +
migration file) and `89727ea` (tested rollback).

## What was wrong

An audit of the dashboard against the live tables found five faults. Four of
them printed a confident `0` where the honest answer was a real number or
"this does not apply".

1. **All Time showed Avg Users / Avg Uses as 0.0.** The averages RPC only ever
   returned daily, weekly and monthly. The screen rendered a missing value.
   An average over a single all-time window is meaningless anyway, so both
   columns and their sort options are now dropped there rather than faked.
2. **Profile Screen read 0 users / 0 uses on All Time.** Its RPC never
   returned an `allTime` block. The real figure is 35 users / 305 opens.
3. **Profile Screen's weekly and monthly "averages" were the current week's
   and month's totals** copied into an average-shaped field. Only its daily
   average was real.
4. **Month Standings Expanded and Last Month Banner were missing from the
   per-feature averages list**, so both read 0.0 on every period.
5. **Logging a workout did not mark you active.** Active-user tracking fired
   only on `auth-sync` and `upsert-profile`, so anyone on an already-warm
   session could log, react and browse without appearing in Total Active
   Users. Janodhe logged a workout on 23 Sep and was reported to the founder
   as a drop-off because of this; Santushni was missed on 22 and 23 Sep the
   same way. **Total Active Users was a floor, not a count.**

Separately: **swiping between screens recorded nothing.** It called `setPage`
directly while only nav buttons tracked. On a mobile-only app that lost most
screen opens — roughly 20 people opened Fero on a typical day but only ~11
registered a Today Screen open. Every Usage tab number before 24 Sep is an
undercount, and the four main tabs are undercounted *more* than the tap-driven
features (Bloc Stream, comments, reactions), so cross-feature comparisons from
before this date are skewed, not just low.

## What changed

- `src/App.jsx` — tap and swipe now share one `trackPageOpen` helper. The
  swipe path deliberately does not compare against `page`: that callback's
  deps do not include it, so the read would be stale. A committed swipe always
  lands on an adjacent screen, so no comparison is needed.
- `api/lift-log.js` — new `markCanonicalDailyAppActive`, called from
  `usage-event`, `add-log` and `multi-log`. New app-opens reader, guarded in
  try/catch so the shared `Promise.all` cannot take the whole dashboard down.
- `src/pages/FounderDashboard.jsx` — All Time drops the average columns; the
  Usage list is ranked highest-first and sortable by Users / Uses / Avg Users
  / Avg Uses; new Total App Opens panel that **hides itself until its RPC
  answers**, so it can never show a card full of zeros.
- `supabase/migrations/20260924120000_fix_founder_dashboard_metrics.sql`.

## App opens: read this before trusting the number

`open_count` counts launches, not people. A return after 30+ minutes counts as
a new open, which keeps token refreshes and second tabs from inflating it.

**Rows written before 24 Sep 2026 are backfilled to 1** — a floor, since an
active person opened the app at least once, but not a real count. So
`allTime` currently equals the row count (536) and **any window spanning
before 24 Sep reads low**. The RPC returns `countingStarted` and the dashboard
says so on screen. The monthly figure will not be trustworthy until October.

## Verified

- Migration executed against a real Postgres (PGlite 18.3) before production:
  21 assertions covering the 30-minute open rule, the activity mark not
  inflating open counts, the new `allTime` block, and averages no longer
  echoing totals. A genuine syntax error was caught this way.
- **The rollback was tested, not just written** —
  `docs/rollback-2026-09-24-dashboard-metrics.sql`. Applying it after the
  migration restores the old behaviour exactly.
- Production after/before: row counts identical (536 / 7,983 / 46 / 1,737).
  Grants confirmed: `anon` and `authenticated` cannot execute any of the five
  functions; `service_role` can. All are `security definer`.
- Sandbox: swiping fired `month_opened` and `history_opened`; tapping the tab
  you are already on still fires nothing. `add-log` and `usage-event` confirmed
  to call the activity mark via a logging proxy.
- `lint`, `build`, `test:founder-dashboard`, identity, two-workouts,
  activities, bloc-streak, month-awards, system-health all pass.
- **Not run:** `test:mobile-navigation` and `test:auth-edge-flows` — playwright
  is not installed. Confirmed failing identically on `main`, so pre-existing.

## Still open — Release 2 (agreed, not started)

New tracking the founder asked for on 24 Sep:

- `bloc_loop_opened` and `settlement_reminders_opened` **are already fired by
  the client** ([TodayPage.jsx:1337](../src/pages/TodayPage.jsx)) but are **not
  in the database allowlist**, so every one of those taps has been silently
  discarded. Adding the two names is the whole fix.
- Month tab: own slice vs someone else's slice, as two separate events.
- "All Blocs" tab, tracked separately in your own profile and in others'.
- Bloc switcher button; each individual tab inside Settings; the "More" button
  in log-a-workout; enlarging a photo on Activity (including swiping/tapping
  between photos while enlarged).
- Week's MVP card is **already tracked** (`mvp_card_opened`, 91 opens / 8
  users) — it does not need building.

Every new event name must be added to the allowlist in
`record_ante_core_usage_event` *and* the `app_usage_events` check constraint
first, or it is dropped silently. Schema before code.

Also still open: roughly nine in-app routes (opening Month from the Today
card, switching Bloc, the log button) call `setPage` directly and so record
nothing. Scoped out of this release deliberately — the founder approved the
swipe fix only.

## Findings the founder asked about

- **Emma** signed up 2 Sep 11:27 and her first and last app-open are the same
  timestamp, 0.1s after account creation. Zero screen events, zero workouts.
  Sign-up-and-vanish, not an activation problem.
- **Gregorio** is in no Bloc; **Randy** is the CEO and just busy. Both were
  ruled out by the founder as activation targets.
- **Isindu and Tim never opened Fero at all** — a sign-up problem, distinct
  from members who open it and never log.
- Weekly drop-offs worth attention: Rishane (5 active days last week, then
  nothing), Nishara, Manz.
