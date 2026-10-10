# Handover — 2026-10-10: October return and workout check

## Request

The founder asked who had returned to Fero this month, who had logged workouts
this month, and who had not yet returned. He clarified that the second list was
about logging workouts, not reacting to them.

## Definitions used

- **Returned in October:** an account with at least one recorded Fero app open
  in September and at least one from 1–10 October. This follows the live
  founder-dashboard retention definition: prior-month active people who are
  active in the current month.
- **Workout logged in October:** a workout record created from midnight
  1 October through the end of 10 October in `Europe/Oslo`. If the same workout
  appears in more than one Bloc, it counts once, matching the dashboard's
  session-ID de-duplication rule.
- The founder account, Aadhil, is included in both totals, consistent with the
  numbers guidance for app opens and workout uploads.

## Results from production, through 10 October

- There are **48 accounts**.
- **46** had a recorded app open in September. **39** of those opened Fero
  again in October; **7** had not opened it yet by 10 October.
- **0** people were active in October without also being active in September;
  **0** accounts were created in October.
- The two accounts outside the September-to-October comparison are **Isindu**
  and **Tim**. Neither has a September app-open record in the tracking table.
- **31 people logged 137 unique workouts** in October through 10 October.
- Two workouts were entered during October but carry a 30 September workout
  date: one each for Bananaaaa and Kisal. They are included because the founder
  asked who logged workouts this month, rather than which workout dates fall
  within the month.

### Returned in October (39)

Aadhil, Ashanee, Aysha, Bananaaaa, Bianković, Coach P, Cutie pie,
Dasha the Legend, Deveen, Deyhan, Dinuk, enrico, Giang, Henrik, imadh, Isira,
Janek, Janodhe_W, Juju B, Kasper, Kisal, Krish, Luc, Margareta, Marlène,
Masha, Mathias, mindi, Monika, Nishara, Rahul, Randy, Rishane, Rodri,
Santushni, Shaq, Tobias, Tri, Varun.

### Returned, but no October workout logged yet (8)

Ashanee, Cutie pie, Deyhan, Janek, Juju B, Randy, Rodri, Varun.

### Active in September, not yet active in October (7)

| Person | Last recorded open in September |
| --- | --- |
| Abhishek | 24 September |
| akijain2000 | 18 September |
| Emma | 2 September |
| Gregorio | 4 September |
| Iqran | 20 September |
| Manz | 18 September |
| Rithu | 21 September |

These are app-open counts, not a statement that anyone has left Fero or will
not return later in October. Abhishek and akijain2000 had left their Blocs;
Gregorio had left his only Bloc in September, per the current handovers.

### People who logged workouts in October (31)

| Person | Workouts |
| --- | ---: |
| Aadhil | 4 |
| Aysha | 6 |
| Bananaaaa | 5 |
| Bianković | 2 |
| Coach P | 3 |
| Dasha the Legend | 4 |
| Deveen | 1 |
| Dinuk | 2 |
| enrico | 6 |
| Giang | 5 |
| Henrik | 11 |
| imadh | 8 |
| Isira | 6 |
| Janodhe_W | 2 |
| Kasper | 11 |
| Kisal | 4 |
| Krish | 5 |
| Luc | 2 |
| Margareta | 2 |
| Marlène | 2 |
| Masha | 4 |
| Mathias | 7 |
| mindi | 7 |
| Monika | 3 |
| Nishara | 5 |
| Rahul | 3 |
| Rishane | 3 |
| Santushni | 3 |
| Shaq | 6 |
| Tobias | 2 |
| Tri | 3 |

## Verification and changes

- Read the numbers guidance and Supabase instructions before querying. Queried
  production directly with read-only `SELECT` statements against daily app
  activity, profiles and workout logs; no database writes were made.
- Checked the tracking and counting rules against the live dashboard SQL in
  `supabase/migrations/20260908183917_correct_founder_dashboard_retention.sql`
  and `supabase/migrations/20260828030000_add_founder_dashboard_metrics.sql`.
- The live website returned HTTP 200. The latest Vercel production deployment
  observed before this report was Ready for `3b4139c`. After the handover was
  pushed, Vercel production deployment `dpl_FX72avj2PAADFgqcWMPyUeagyf3i` for
  commit `9bd24d7` reported Ready. The push was documentation-only; no app
  bundle or user data changed.
- The shared Documents checkout was at `19ed525`, eight commits behind
  `origin/main` at `3b4139c`. Four untracked August `.dmg` backups were left
  untouched. Work was recorded in a separate worktree based on `origin/main`.

## Files changed

- `docs/HANDOVERS.md`
- `docs/handover-2026-10-10-october-activity-check.md`

Nothing else was modified.

## Close-out

This is a read-only report of live data through 10 October 2026. The report
commit `9bd24d7` and index are on `main`; its Vercel production deployment is
Ready. No product or user data change was made. This close-out update records
the deployment check.
