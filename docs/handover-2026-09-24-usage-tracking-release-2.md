# Handover — usage tracking, release 2 (2026-09-24)

Live on `main` as `23c5a20`. Migration applied to production before the code
was pushed. Follows release 1 (`e58ea83`), see
`handover-2026-09-24-dashboard-metrics-accuracy.md`.

## The headline

**Two events were already being fired by the app and thrown away.** The
allowlist never learned `bloc_loop_opened` or `settlement_reminders_opened`,
so every tap on the Bloc Loop card and the Settlement Reminders row since
those shipped was discarded in silence. Production held **zero** rows for
both. They count from now on; the taps already lost are not recoverable.

This is the failure mode to remember: **an event name missing from the
allowlist is dropped with no error anywhere** — not in the client, not in the
API, not in the database. Nothing goes red. The only symptom is a number that
stays at zero, which is easy to read as "nobody uses it".

## Fourteen events now tracked

| Event | Dashboard label |
|---|---|
| `bloc_loop_opened` | Bloc Loop Card |
| `settlement_reminders_opened` | Settlement Reminders |
| `month_own_slice_opened` | Own Month Slice |
| `month_other_slice_opened` | Other Month Slice |
| `own_profile_all_blocs_opened` | Own All Blocs |
| `other_profile_all_blocs_opened` | Other All Blocs |
| `bloc_switcher_opened` | Bloc Switcher |
| `settings_invite_opened` | Settings Invite |
| `settings_status_opened` | Settings Status |
| `settings_members_opened` | Settings Members |
| `settings_rules_opened` | Settings Rules |
| `workout_type_more_opened` | More Workout Types |
| `activity_photo_opened` | Photo Enlarged |
| `activity_photo_browsed` | Photo Browsed |

Naming rule: **Own** is the viewer's own thing, **Other** is somebody else's.
These controls are near-identical in the app, so the labels have to carry the
distinction on their own.

## Decisions worth keeping

- **Only selections count.** Deselecting a Month slice, re-tapping the
  Settings tab you are on, or re-tapping All Blocs when already there all send
  nothing. Otherwise a fidget would read as engagement.
- **`isOwnProfile` is passed by the caller**, not derived from the existing
  `isSelf` inside `PlayerProfile`. `isSelf` needs `memberUserId`, which the
  Month route does not pass, so it would silently report every own-profile
  visit as somebody else's.
- **Bloc switcher is wrapped around `handleSwitchGroup`**, not tracked inside
  `Nav` — `Nav` renders twice (desktop header, mobile bottom bar) and tracking
  in there would need doing twice.
- **Photo browsing counts swipe and edge-tap identically** because both route
  through `navigateImage`. Running off the end closes the viewer and is not a
  browse.
- **`workout_type_more_opened` covers both faces of that tile** — "More" when
  nothing is chosen, "Change" once something is.
- **Bloc Loop does not also fire `month_opened`**, so it stays a separate
  count from reaching the Month tab by nav or swipe, as the founder asked.
- Month-slice tracking sits **outside** the `setFocus` updater. React may run
  an updater more than once, which would double-count a single tap.

## Verified

- Every one of the fourteen driven in the sandbox at 375x812 with the event
  name read off the wire. All fourteen fire with the right name; the
  deliberate no-ops stay silent.
- Migration executed against a real Postgres (PGlite) before production: 9
  assertions, including reproducing the discarded-event bug beforehand and
  confirming unknown names are still rejected afterwards.
- Production after/before: usage rows 7,983, activity 536, profiles 46,
  workout logs 1,737 — unchanged. Usage and averages RPCs now report 28 events
  each, up from 14. `anon` and `authenticated` still cannot execute
  `record_ante_core_usage_event`.
- Live bundle grepped for each new name; site loads with no console errors.

## Still open

- Roughly nine in-app routes call `setPage` directly and so record no screen
  open: opening Month from the Today card, switching Bloc, the log button.
  Deliberately out of scope for both releases — only the swipe fix was
  approved. Worth doing, since Today Screen is still undercounted.
- Every Usage number from before 24 Sep 2026 is a floor, and the four main
  tabs are undercounted *more* than tap-driven features, so cross-feature
  comparisons across that date are skewed rather than merely low.
- App Opens is exact only from 24 Sep 2026; earlier days hold one open per
  active person. October is the first trustworthy month.

## Adding another event later

1. Add the name to **both** allowlists — the check constraint on
   `ante_core.app_usage_events` and the guard in
   `record_ante_core_usage_event`. They must agree.
2. Add it to the event list in `read_ante_core_founder_dashboard_usage` and
   `read_ante_core_founder_dashboard_usage_averages`.
3. Add a label to `usageLabels` in `src/pages/FounderDashboard.jsx`, or the
   row will not render at all.
4. Then fire it from the client. Schema first, always.
