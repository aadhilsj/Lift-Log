# Handover — 2026-09-16: workout activities live, name fixes, and the scaling problem

**Start here.** Everything in section 1 is already live in production. Section 7
is what the next session picks up. Section 8 is the one thing with a deadline.

| For | Read |
|---|---|
| What Deveen needs to know about the canonical change | `docs/handover-2026-09-14-blob-runbook-tasks-1-4-and-log-fixes.md` §8 |
| The scaling problem and its plan | `docs/scaling-before-launch-2026-09-15.md` |
| The previous session | `docs/handover-2026-09-14-session-delete-bug-to-runbook.md` |

---

## Plain-English summary

Members can now pick a **specific activity** when they log — Padel, Hiking,
Basketball, Badminton and so on — instead of only the five categories. It shows
everywhere: the feed, calendars, the comment screen, the delete pop-up, the Bloc
chat card, profiles and the History page. September's existing workouts were
filled in by hand from their notes, with the founder confirming each one.

Along the way: a database change was rehearsed on a restored copy before going
live, long member names no longer get cut off anywhere, and names are now capped
at 16 characters.

Nothing is broken. The one deadline item is Deveen's month-close fix, which is
still unmerged with September closing on 1 October.

---

## 1. What went live, in order

All on `main`, each deployed and verified. Times UTC.

| Commit | What |
|---|---|
| `496e5cc` (PR [#20](https://github.com/aadhilsj/Lift-Log/pull/20)) | The activity picker, and activities shown across the app |
| `e42d074` | Canonical migration + the API sending/reading `activity` |
| `423abf7` | Badminton and Climbing added |
| `929cf63` | Feed cards: full names, per-card date removed |
| `550eb01` | No member name is cut off anywhere |
| `3422c81` | Display names capped at 16 characters |
| `9d52d6d` | Deveen's handover §8 |

### The model, which everything else depends on

Every activity belongs to one of the **five existing categories**. A log's
`type` still holds the **category**, so Bloc `acceptedWorkoutTypes`, multi-Bloc
logging, the two-a-day cap, month close and settlements are untouched. The
activity rides alongside as `log.activity` (blob) and
`ante_core.workout_logs.activity` (canonical).

- Only **"Other"** requires a note. Named Other-category activities (Hiking,
  Swimming, Home Workout…) do not.
- Logs saved before this show their category: an old Sports log reads "Sports".
- The list lives in `src/lib/activities.js`; `api/lift-log.js` keeps a mirror
  map (`ACTIVITY_CATEGORIES`). **`npm run test:activities` fails if they drift.**
- The server derives the category from the activity and ignores unknown ones, so
  an older client (or the App Store build) logs exactly as before.

### The picker

Five most-logged activities as tiles, plus **More** → a searchable A–Z sheet
portalled to `document.body` (inside the page it sits under the mobile nav).
A new member starts with Gym, Run, Hiking, Basketball, Pilates.

---

## 2. The canonical change (already applied to production)

`supabase/migrations/20260916090000_add_workout_log_activity.sql`, run
**2026-09-15 22:32 UTC**, before the code deploy.

- `ante_core.workout_logs.activity text` (nullable).
- `upsert_ante_core_workout_log` gains `p_activity text default null` (the old
  17-argument version is dropped; two overloads with a default make every call
  ambiguous). On conflict:
  `activity = coalesce(excluded.activity, workout_logs.activity)` — a re-save
  without an activity never erases a stored one.
- `read_ante_core_current_logs`, `read_ante_core_month_history` and the
  `log_comment` stream payload now return `activity`.
- Grants unchanged: `postgres` and `service_role` only.

Bodies were the **live definitions read with `pg_get_functiondef` that morning**,
with only the activity lines added. Verified after: one upsert version, grants
intact, 1,577 logs unchanged, both readers returning `activity`, no errors.

**Ordering rule:** the migration is backward compatible, so SQL first, code
second. Proven, not assumed — see §3.

---

## 3. How it was verified (reusable recipe)

The sandbox stands in for canonical with empty results, so it cannot test any of
the above. The route that worked:

1. Supabase → Database → Backups → **Restore to new project** (never the
   Scheduled backups tab) into a scratch project. ~10 minutes, about a cent an
   hour. Founder does the clicks.
2. Founder saves the scratch project's secret key to a gitignored file with a
   `read -rs` one-liner, so it never reaches chat or shell history.
3. Confirm the copy matches production by comparing
   `md5(pg_get_functiondef(...))` per function before applying anything.
4. Apply the migration to the copy, then run the app against it:
   `SUPABASE_URL=<copy> SUPABASE_SERVICE_ROLE_KEY=<copy key> ENABLE_LOCAL_DEV_OTP=true
   BLOB_MIRROR_SKIP_ACTIONS="reaction,flag,flag-response,flag-review" PORT=3100
   node scripts/local-dev-server.mjs`. Local dev sign-in works against a remote
   database, and `create-group` builds fresh canonical rows, so no real member's
   data is written.
5. **Run the currently deployed `main` against the migrated copy too.** That is
   what proved SQL-before-deploy is safe.
6. Delete the scratch project immediately.

Results: 12/12 end-to-end checks on the new code, 5/5 on the then-live code,
parity gate 8/8 with 0 warnings, lint, build and all 14 suites green.

**Found this way, worth knowing:** code without the activity change rewrites the
**blob** copy of current logs without `activity`. Canonical keeps it, and the
next write by current code restores the blob. Both directions were observed. So a
deploy overlap or a rollback costs nothing permanent.

---

## 4. The September backfill (data change, done)

70 sessions / 112 rows given an activity on 2026-09-16, each confirmed by the
founder from the log's note: Basketball 24, Hiking 12, Volleyball 7, Padel 6,
Badminton 6, Home Workout 4, Swimming 3, Tennis 2, Cycling 2, Climbing 2,
Football 1, Pickleball 1.

Two sessions also moved category, Sports → Other, because Cycling and Climbing
live under Other: Masha's bike ride (`1788707488389877`) and Rishane's climbing
(`1789336887834338`). Every Bloc they are in accepts Other, checked first, so
neither stopped counting.

Deliberately left blank (the note did not say): Janek "Court day", Rishane
"forgot to take a picture", Kasper "Frisbee + American football", Kasper
"Plyometrics", mindi "speed walk + run up hill".

**Undo, if it is ever wanted.** Every one of those 112 rows had `activity = null`
before:

```sql
update ante_core.workout_logs set activity = null
where coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id) in (
'1788642680803417','1788704638040484','1788812989733541','1788813011220100','1789209689957039','1789416088468659',
'1788384039921928','1788612050954556','1788813826878399','1788881408311928','1788964172120087','1789309537380180','1789418929286766',
'1788449800962209','1788884007168617','1788973684700877','1789227676087996','1789412260949264','1788918109165147','1789353330265428',
'1788553505325711','1789290950188935','1788423189306488','1788878128872873','1789481371889444','1788974460851474','1788981989482863',
'1788708055649817','1788814016437283','1789418387091173','1788823269992606','1788992971351205','1789428372980966',
'1788332239902540','1788333651819803','1788706857446904','1789075926105365','1789330448269616','1789074939082782','1789363493973903',
'1788709661452960','1789063177602994','1788808643392008','1788808617580326','1788808961288333','1788862839281030','1789136134157831',
'1788443530546303','1788507057523946','1789231224546255','1788724432477430','1788724455116486','1788724478804633','1788613204407020',
'1788697991793822','1789215554670471','1789292805169518','1789311089302581','1788705021201874','1789323323185827','1789323437688527',
'1788706948083192','1788889895233071','1789317221317712','1789492529587431','1789510042202827','1788707979787645','1788707488389877',
'1789199642245983','1789336887834338');

update ante_core.workout_logs set workout_type = 'Sports'
where coalesce(substring(id from '^([0-9]{10,})(?:-|$)'), id) in ('1788707488389877','1789336887834338');
```

---

## 5. Names: no longer cut off, and capped at 16

Longer activity labels exposed an old problem: a long display name was squeezed
to an ellipsis. Fixed in five places (`929cf63`, `550eb01`):

- **Feed cards** — the per-card date was removed (every card already sits under a
  date header) and the space went to the name.
- **Bloc leaderboard**, both layouts — the name keeps one line; "you" and
  "Prorated" wrap beneath it.
- **Week's MVP list row**, **Month page leader card**.
- **History all-time table** — name column 120px → 150px, table min width 520 →
  550 (it already scrolls sideways).
- **Week's MVP tile** is ~60px wide, where no full name fits legibly, so it shows
  the **first name** rather than clipping mid-word.

Then `3422c81`: **display names are capped at 16 characters**, the length of the
longest existing name ("Dasha the Legend"), so nobody was renamed. Enforced on
every name field and again on the server (`applyUpsertProfile`, rename-member,
create-group). `DISPLAY_NAME_MAX_LENGTH` exists in both `api/lift-log.js` and
`src/lib/appState.js`; `npm run test:activities` fails if they disagree.

Measured at 375px: no name-bearing element overflows its box.

---

## 6. The scaling problem (Deveen's, not started)

On 14 September the database stalled for ~2.5 minutes with only **2–4 phones**
open. Full write-up, including the exact causes and a six-step plan:
**`docs/scaling-before-launch-2026-09-15.md`**, linked from Deveen's handover §7.

Short version: every refresh reads all members' data across all Blocs (~1.4 MB),
one global revision counter makes every open phone reload after any action in any
Bloc, and the database is on Supabase's smallest compute. The dashboard showed
the stall was **IOwait with no free memory**, so the recommendation is to move
compute Micro → **Small** (~$5/month more) **before 1 October**, and then do the
code work. The founder has not upgraded yet.

---

## 7. What the next session picks up

1. ~~**Share stickers should show activities**~~ — **done, live 2026-09-16.**
   PR [#21](https://github.com/aadhilsj/Lift-Log/pull/21), merged as `2d3fa8c`.
   All 12 approved PNGs re-rendered and compared: 7–65 opaque pixels differ out
   of 1,218,240, the rest is anti-aliasing. A July fixture with all 21 activities
   plus pre-activity logs was run through `buildDayMap`: every activity has an
   icon, old logs fall back to their category, count badges still draw. Stickers
   are closed-months only, so the first one with activity icons is September —
   and that depends on `blob/month-close-canonical` (see §8 item 1).
2. **Real icons.** Every new activity uses a placeholder: Tabler Icons (MIT),
   plus a hand-drawn Padel racket and shuttlecock. Devinmin and Randy are drawing
   the real set. Swapping one in is a single entry in `src/lib/workoutIcons.js`.
3. **Add activities on request.** Badminton and Climbing were added this way.
   Adding one means: `src/lib/activities.js`, the mirror map in `api/lift-log.js`,
   an icon, and `npm run test:activities`.
4. ~~**Confirm a real member's activity save.**~~ — **done, 2026-09-16.** Janek
   (Sweat Equity) and Kisal (Go To Da Gym) each logged `Gym` just after the
   deploy; both saved with `activity` in canonical and in the blob.

---

## 8. Still open from earlier work

1. **`blob/month-close-canonical` is unmerged** and has no PR. It makes month
   close count from canonical, and **September closes 1 October**. It merges
   cleanly with `main` and its own suite passes (checked 2026-09-14). Deveen is
   away for a few days; see his handover §6.
   **Update 2026-09-16:** it now also keeps September's activities. The backfill
   reached canonical only, so 93 September logs have no `activity` in the blob,
   and `main` freezes the closed month from the blob. Re-checked against `main`:
   merges cleanly, 14/16 suites pass (the two browser suites fail identically on
   plain `main`). Full write-up in his handover §9.
2. **The scaling plan** (§6) — nobody has started it.
3. **`codex/app-store-readiness`** is far behind `main` and now missing the whole
   activity feature. Another agent has been working in that worktree
   (`/Users/aadhilsj/Documents/FERO/fero-app-store`); leave it alone.
4. The open-season parity check and the gate's env-loader quoting bug remain
   Deveen's, unchanged.

---

## 9. Working notes worth keeping

- **The founder now lets an agent run SQL on production**, asked for explicitly
  each time and preceded by read-only verification. Data changes still get a
  before-state snapshot and a written undo (§4).
- **`npm run sandbox` runs out of memory after roughly two hours** with a browser
  tab polling it. It dies with a JavaScript heap error; just restart it. Stop it
  by the PID on port 3000/54321, never `pkill -f`, because another session's
  sandbox has been killed that way before.
- **The sandbox cannot test canonical behaviour at all.** Use the restored-copy
  route in §3.
- Photos never display in the sandbox: its storage stand-in discards uploads and
  the image proxy answers 415. That is expected, not a bug.
- **Measure, do not eyeball, layout claims.** Every "it fits" in §5 came from
  comparing `scrollWidth` with `clientWidth` in the page at 375px.
- The founder reviews on a phone and notices single pixels. Small, verified
  changes with a screenshot land well; batches do not.
