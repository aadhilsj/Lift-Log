# Handover — 2026-10-10: member workout backfills

## Request

The founder asked how many sit-outs Rodri has left in Ctrl Alt De-feat and then
authorized marking him as sitting out for August 2026. The founder also
authorized two workout backfills:

- Add Bananaaaa's second workout on 30 September 2026 to StavanGang as a Home
  Workout (no photo).
- Copy Kisal's 1 October 2026 Gym workout from Go To Da Gym into Sweat Equity.

## Before the changes

- Rodri's 2026 closed season rows in Ctrl Alt De-feat are June–September; none
  is marked excused/sitting out. His current excused map is empty. The annual
  limit is two sit-outs per Bloc, so he has two available now; marking August
  as a sit-out leaves one. August status row before change: member-status ID
  `342a85da-f5c0-47ba-a75b-728efa8e8749`, 5 workouts, `excused=false`,
  `solo=false`, `joined_for_month=true`, no settlement status. There was no
  formal settlement run for the season.
- Bananaaaa's September StavanGang season is closed, target 10, status count 9.
  There is one existing log on 30 September (Gym, ID
  `1790751809311247`); the founder clarified that the missed Home Workout was
  a separate second workout. No September settlement run exists.
- Kisal's Sweat Equity October season is open, current canonical count 0. His
  1 October source workout exists only in Go To Da Gym (ID
  `1790865877571214`, Gym); he joined Sweat Equity on 2 October. The source
  record's image object is not present in storage. The founder authorized
  copying the original log into the new Bloc with its original date and details,
  without a photo.
- These are additive log writes. The closed September member count must also
  move from 9 to 10 so its stored count agrees with its canonical logs.
- Rollback for inserted logs is by deleting their exact new IDs; restore
  Banana's count to 9 and Rodri's `excused` flag to false if a rollback is
  needed.

## Work and verification

- 2026-10-10: Rodri's allowance checked read-only. His 2026 history has no
  sit-outs; the current limit is two per Bloc per calendar year. He has two
  available now, or one if August is later marked as a sit-out. No Rodri data
  was changed.
- 2026-10-10: Added Bananaaaa's second 30 September workout as `Other` /
  `Home Workout`, with no photo and manual verification. The exact new log ID
  is `manual-bananaaaa-stavang-2026-09-30-home-2`. Updated her closed-season
  count from 9 to 10. Verified the new row and count in the read-only closed
  month reader; it reports 10 and includes the new log. The before-state was
  count 9 with the original Gym row above. No settlement entry/run existed.
- 2026-10-10: Marked Rodri's August season `excused=true` while retaining his
  5 workouts, non-Solo status and active-month status. Verified through the
  closed-month read model; it reports excused true. The Settlement screen
  excludes excused members before calculating penalties, so Rodri no longer
  owes the computed penalty. No formal settlement run or transfer existed.
- 2026-10-10: Copied Kisal's 1 October Gym session into Sweat Equity with the
  original date, activity and creation time, no photo, and manual verification.
  New ID: `1790865877571214-sweat-equity-saucff`, sharing the original session
  ID prefix so the same workout remains one session for the daily limit. The
  open-month read model returns the new Sweat Equity log. The original Go To Da
  Gym row was left unchanged.
- `npm run lint` (using the bundled Node runtime) passed. `npm run build` passed
  with the existing large-chunk warning. Of the `test:*` scripts, the
  self-contained tests passed; `remirror`, `solo-standard-penalty`,
  `yearly-allowance`, `training-wheels`, and `otp-errors` could not start because
  this shell has no `node`/`npx` on PATH; `auth-edge-flows` and
  `mobile-navigation` could not run because the local API server on port 3000
  was not started. No app code changed.

## Commits

| Commit | Description | Live |
| --- | --- | --- |
| `1f1867d` | Record the first confirmed workout backfill and before-state | Data live; docs branch only |
| `b2185dd` | Record Rodri and Kisal corrections and final verification | Data live; Vercel production deployment `dpl_8E33GX7Ap3A6sFaCPCTs2M3x68q2` reports Ready |
| This close-out commit | Record the production deployment check | Docs only |

## Close-out

Rodri's August sit-out, Banana's September Home Workout, and Kisal's copied
October 1 workout are in production data. No app code changed. The documentation
commit `b2185dd` is on `main`; its Vercel production deployment reports Ready.
This final handover update records that check.
