# Handover — 2026-09-16 to 09-17: stickers, Squash, Dance, reload-on-deploy, and the June–September backfill

**Start here.** Everything in section 1 is live in production. Section 8 is what
the next session picks up. Section 9 is what Deveen needs, and it is also copied
into his handover (`docs/handover-2026-09-14-blob-runbook-tasks-1-4-and-log-fixes.md` §10).

| For | Read |
|---|---|
| The previous session (activities going live) | `docs/handover-2026-09-16-activities-live.md` |
| Deveen's open items, including the 1 October deadline | `docs/handover-2026-09-14-blob-runbook-tasks-1-4-and-log-fixes.md` §9 and §10 |
| The scaling problem | `docs/scaling-before-launch-2026-09-15.md` |

---

## Plain-English summary

Share stickers now show the activity icon. Squash and Dance were added to the
activity list. An open app now refreshes itself once when a new version is
released, so phones stop running old code for days. That was why Varun's and
Coach P's workouts saved as a bare "Sports".

The founder read and approved every note, and 246 past workouts from June to
September were filled in with their activity. Nine of them also moved to the
right category. Counts and payments are unaffected. A before-copy is kept in the
database, and one statement undoes it.

Nothing is broken. The one deadline is unchanged: Deveen's month-close branch
must merge before 1 October (his handover §9).

---

## 1. What went live, in order

| Commit / PR | What |
|---|---|
| `e04fe80` | Deveen's handover §9: September's activities depend on his month-close branch |
| PR [#21](https://github.com/aadhilsj/Lift-Log/pull/21) → `2d3fa8c` | Share stickers show the activity icon (`buildDayMap` reads `getLogDisplayActivity`) |
| `e0189de` | Docs: stickers and the member-save check marked done; `activities.js` header comment corrected |
| PR [#22](https://github.com/aadhilsj/Lift-Log/pull/22) → `5a64972` | Squash (Sports), and the app reloads once when a newer version is deployed |
| Data, 2026-09-17 | 246 workouts / 310 rows given an activity in canonical (§4) |
| PR [#23](https://github.com/aadhilsj/Lift-Log/pull/23) → `d0a497f` | Dance (Other) |

Each was deployed and checked: Vercel reported success, the live page loaded
with no console errors, and the live bundle contained the change.

---

## 2. Share stickers show activities

One line in `src/lib/shareSticker.js` (`buildDayMap`) now reads the activity, and
a log without one falls back to its category.

**How it was checked.** The 12 approved PNGs in
`docs/share-sticker-reference/png/` were re-rendered and compared pixel by pixel.
Real differences were 7–65 opaque pixels out of 1,218,240; the rest is
anti-aliasing. The built-in `FIXTURES` hold category names and bypass
`buildDayMap`, so they cannot test the change. A July fixture with all activities
plus pre-activity logs was therefore run through `buildDayMap`: every activity
has an icon, old logs fall back, and the count badges still draw.

**Worth knowing.** Stickers are offered on **closed months only** (`canShareMonth`
in `src/pages/PlayerProfile.jsx`). They read `monthHistory[].logsByUser` from the
readable state, which is rebuilt from canonical where canonical covers the month.

---

## 3. Reload once on a new deploy (PR #22)

**The bug.** Varun and Coach P each logged a workout that saved as a bare
category. The code was fine. Their phones were still running the pre-activity
bundle, and the server deliberately accepts a category-only log from older
clients (`resolveWorkoutActivity` in `api/lift-log.js`). A phone left open had no
way to learn that a new version existed.

**The fix rides the existing 6-second revision poll.** No new request.

| File | Change |
|---|---|
| `vite.config.js` | `import.meta.env.FERO_BUILD_ID` = `VERCEL_GIT_COMMIT_SHA` at build, `""` elsewhere |
| `api/lift-log.js` | `GET ?revision=1` adds `build: process.env.VERCEL_GIT_COMMIT_SHA \|\| ""`. Only that route; `fetchRevisionStamp`'s other callers are unchanged |
| `src/lib/api.js` | Records the build (`getLatestServerBuild`). `fetchRevision` still returns a plain number |
| `src/App.jsx` | `reloadIfNewBuild`, called on each poll |

**Guards.** A reload happens only when all of these hold:
- both stamps are non-empty and they differ
- the app is not on a local dev host and the page is visible
- nothing is saving (`saving`, `optimisticMutationRef`)
- there has been no touch, key or scroll for 20 seconds
- no form field on screen has content
- this is the first reload of the session (`sessionStorage`); if the flag cannot be stored, it never reloads

**Tested end to end.** The bundle was built with one stamp and the sandbox server
run with another. Playwright drove a non-local hostname
(`--host-resolver-rules=MAP fero.test 127.0.0.1`) with the service worker on:

| Case | Result |
|---|---|
| Log form open with a note typed, idle | 0 reloads, note intact |
| Form closed, idle | exactly 1 reload |
| 70 seconds more, stamps still differ | 0 further reloads |
| Local dev host, stamps differ | 0 |
| Stamps match | 0 |
| Server reports no build | 0 |

**Not directly verified:** that the Vercel function sees `VERCEL_GIT_COMMIT_SHA`
at runtime. The route needs a signed-in session. The evidence is that the same
file already relies on `VERCEL_ENV` and `VERCEL_GIT_COMMIT_REF` at runtime. If it
is missing, `build` is empty and nothing reloads, which is the safe direction.
The Dance deploy (`d0a497f`) was the first release after this shipped, so it was
the first real-world trigger.

**Cannot help phones already on the old bundle.** That code has no check in it.
They update on their next full open (network-first navigation in `public/sw.js`).
Their old version also cannot show a custom message, because
`getWorkoutSaveFailureMessage` shows "check your connection" for any failure. So
rejecting category-only logs would only confuse those members. Do not do it.

**Test setup that worked, reusable:**
- Playwright is not installed in the main folder's `node_modules`. The app-store
  worktree has it; import it by absolute path, or symlink it into a scratch
  `node_modules`.
- A fresh sandbox needs an account for the two browser suites. Run
  `npm run sandbox:seed`, then
  `FERO_QA_EXISTING_EMAIL=riley@local.test FERO_QA_INVITE_CODE=<printed code>`.
  With that, all 16 suites passed.

---

## 4. The June–September activity backfill (data change, done)

**Scope.** 246 workouts, which is 310 rows because workouts logged to several Blocs
have one row per Bloc. Canonical only (`ante_core.workout_logs`). The founder read
every note and approved each one, including corrections to the guesses. Run on
2026-09-17 after a before-copy.

| Activity | Workouts | | Activity | Workouts |
|---|---|---|---|---|
| Basketball | 79 | | Tennis | 9 |
| Hiking | 55 | | Volleyball | 7 |
| Swimming | 38 | | Climbing | 4 |
| Padel | 13 | | Football | 4 |
| Home Workout | 11 | | Squash | 3 |
| Cycling | 8 | | Run | 3 |
| Kitesurfing | 5 | | Yoga | 2 |
| Badminton, Rowing, Dance, Cricket, Gym | 1 each | | | |

This includes the three logs from the old bundle: Coach P → Basketball (the founder
confirmed it), Varun → Squash, Varun → Swimming.

**Nine workouts changed category (10 rows).** The founder decided each one:
- Varun, 27 Jun: Other → Volleyball
- Bananaaaa, 15 and 17 Aug: Other → Tennis
- Rishane, 15 Aug (2 Blocs): Sports → Climbing
- Nishara, 6, 14 and 25 Jun ("Treadmill"): Other → Run
- Monika, 8 Aug ("Push day"): Other → Gym
- Bianković, 11 Jul (dance class): Sports → Dance

**Why the category moves are safe.** `isCountedLog` only excludes rejected logs;
category plays no part in counts, targets or settlements. The only derived
display that reads category is **Most Diverse** on the settlement screen
(`src/pages/SettlementScreen.jsx`). It is computed on render, so its winner for
June, July or August may have changed. There are no triggers on
`ante_core.workout_logs`, which was checked before the write.

**Left out on purpose:**
- Isira's two "forgot pic", Rodri "Twisted ankle", Kasper "🕸️", Bianković "Peak athletic performance"
- walks, mobility and calisthenics, which have no matching activity
- Marlène's kayak, which already shows as Other
- Pilates-category notes, which already show as Pilates

**Before-copy.** Table `ante_core.backup_activity_backfill_2026_09_17`, with RLS
enabled. Columns: `id`, `old_workout_type`, `old_activity`, `new_activity`,
`new_workout_type`, `taken_at`. Verified after the write: all 310 rows match the plan.

**Undo:**

```sql
update ante_core.workout_logs w
set activity = b.old_activity, workout_type = b.old_workout_type
from ante_core.backup_activity_backfill_2026_09_17 b
where w.id = b.id;
```

**How the list was built** (reuse it for the next backfill):
1. Run a keyword pass per activity, but only accept a match that names exactly
   one activity in the log's own category.
2. Read every match by hand.
3. Show the founder the full list with notes, plus everything left out with a guess.

The keyword pass missed elongated spellings ("hoooooops", "Hikeeee", "Swam",
"Sykling"), so the hand review is not optional.

---

## 5. Squash and Dance

| | Category | Icon |
|---|---|---|
| Squash | Sports | Drawn racket and ball |
| Dance | Other | Drawn dancer |

Both icons are placeholders, like every new activity, until Devinmin and Randy's set
arrives. Each was compared at tile size against its neighbours. Each was then logged
in the sandbox at phone size (search, pick, save) and stored as the right
`type` / `activity`. Dance needs no note.

Adding an activity is still four touches: `src/lib/activities.js`,
`ACTIVITY_CATEGORIES` in `api/lift-log.js`, `src/lib/workoutIcons.js`, and
`npm run test:activities`.

---

## 6. Live members who logged through the new picker

A real save through the new code was confirmed on 2026-09-16: Janek (Sweat Equity)
and Kisal (Go To Da Gym), both `Gym`, saved in blob and canonical.
Handover 09-16 §7.4 is closed.

---

## 7. State at handover

| | |
|---|---|
| `main` | `d0a497f`, deployed |
| Worktrees made this session | removed (`fero-activity-updates`, `fero-add-dance`, scratch test trees) |
| `feat/sticker-activities` worktree | `/Users/aadhilsj/Documents/FERO/fero-activity-picker`, merged, left in place |
| Sandboxes / dev servers | all stopped |
| Open PRs from this session | none |

---

## 8. What the next session picks up

1. **Deveen's month-close branch before 1 October.** Unchanged, and still the only
   deadline. His handover §9.
2. **Watch the reload on the next deploy.** If a member reports the app "blinking"
   repeatedly, the once-per-session guard failed. Look at `reloadIfNewBuild` first.
3. **Real icons** from Devinmin and Randy. One entry each in `src/lib/workoutIcons.js`.
4. **Database compute upgrade (Micro → Small).** The founder is deferring it until
   Deveen has reviewed the scaling plan.
5. **Drop the backup table** once the founder is happy with the backfill, a week or
   two out. Use `drop table ante_core.backup_activity_backfill_2026_09_17;`, and
   only on the founder's word.
6. Still noted, not fixed: `docs/SCHEMA.md` does not list
   `ante_core.workout_logs.activity`.

---

## 9. For Deveen

This is also in his handover as §10.

1. **The blob is further behind canonical on activity and category.** The 09-16
   backfill and today's 310 rows were canonical-only writes. For June–August the
   blob's `monthHistory` still has the old `type` and no `activity` on those rows;
   the readable state shows canonical wherever
   `buildCanonicalMonthHistoryForGroup` accepts the month. For September, three
   more current-month rows (Coach P, Varun ×2) join the 93 already described in his
   §9, and they depend on the month-close branch in the same way.
2. **`scripts/canonical-parity-report.mjs` will flag these rows.** It keys logs on
   `workout_type`, so the 10 category-moved rows will show as blob/canonical
   mismatches. They are intended. `scripts/blob-parity-gate.mjs` compares counts,
   reactions, settlements and overrides, not category, so it is unaffected.
3. **Every deploy now makes open apps reload once.** Each reload is a full state
   load (~1.4 MB, scaling doc). Harmless at today's traffic, but it is a burst
   right after each release. Keep it in mind for the scaling work, and avoid
   deploying right on top of month close.
4. **`GET ?revision=1` has a new `build` field.** Anything that consumes that
   response should ignore unknown fields, as the client does.
5. **Two new activities in the mirror map:** `Squash: "Sports"`, `Dance: "Other"`.
   Any SQL that maps activities must include them.
6. **A new table: `ante_core.backup_activity_backfill_2026_09_17`**, RLS on. It is
   the undo for §4 and should not be copied into migrations.
