# Handover — 2026-10-10: member workout backfills

## Request

The founder asked how many sit-outs Rodri has left in Ctrl Alt De-feat after
considering whether to sit him out for August 2026. No change to Rodri's August
record is authorized yet. The founder explicitly authorized two workout
backfills:

- Add Bananaaaa's second workout on 30 September 2026 to StavanGang as a Home
  Workout (no photo).
- Copy Kisal's 1 October 2026 Gym workout from Go To Da Gym into Sweat Equity.

## Before the changes

- Rodri's 2026 closed season rows in Ctrl Alt De-feat are June–September; none
  is marked excused/sitting out. His current excused map is empty. The annual
  limit is two sit-outs per Bloc, so he has two available now; marking August
  as a sit-out would leave one.
- Bananaaaa's September StavanGang season is closed, target 10, status count 9.
  There is one existing log on 30 September (Gym, ID
  `1790751809311247`); the founder clarified that the missed Home Workout was
  a separate second workout. No September settlement run exists.
- Kisal's Sweat Equity October season is open, current canonical count 0. His
  1 October source workout exists only in Go To Da Gym (ID
  `1790865877571214`, Gym); he joined Sweat Equity on 2 October. The founder
  authorized copying the original log into the new Bloc with its original date
  and details. The source image object is not present in storage, so confirmation
  is pending on adding the workout without an image.
- These are additive log writes. The closed September member count must also
  move from 9 to 10 so its stored count agrees with its canonical logs.
- Rollback for the two inserted logs is by deleting their exact new IDs; if
  Banana's count is changed, restore it to 9.

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
- Kisal remains pending founder confirmation about adding without a photo; no
  Kisal data was changed.

## Commits

| Commit | Description | Live |
| --- | --- | --- |
| Pending | Record the authorized data correction and verification | N/A |

## Close-out

Banana's backfill is in production. Rodri remains unchanged pending a decision.
Kisal remains unchanged pending confirmation about the missing image. Commit
and documentation push are pending close-out.
