# 23 October (session 2) — the calendar tap

**Live, written as this session goes.** Opened purely as a catch-up; the task
picked up from
[`handover-2026-10-23-session-close.md`](handover-2026-10-23-session-close.md)
§1 is the calendar tap.

---

## 1. State at session open

- Shared folder on `main` at `6137faa`, level with `origin/main`, clean apart
  from the four August `.dmg` backups that were already there.
- **Live is `6137faa`** — Production deployment 23 Oct 07:28 UTC, state
  `success`, bundle `assets/index-BY4Flc-X.js`. `6137faa` is docs only, so the
  last code live is `57795b6` (calendar day badges).
- Unmerged branches of note: `claude/testflight-build-12-2026-10-21`
  (deliberately kept, with its worktree at
  `~/Developer/FERO/build-12-2026-10-21` for the Xcode laptop). Everything else
  unmerged is older than 14 October.
- Nothing applied to the production database this session.

## 2. The task, verified against the code

Confirmed the behaviour described in the previous handover is still exactly as
written. `src/pages/PlayerProfile.jsx:795`:

```js
const canDelete = dayLogs.length > 0 && isCurMonth && !!onDeleteLog;
const canInspect = dayLogs.length > 0;
const openDayLog = () => {
  if (canDelete) { dayLogs.length === 1 ? setDeleteTarget(log) : setDeleteChoices(dayLogs); return; }
  dayLogs.length === 1 ? setWorkoutDetail(log) : setWorkoutChoices(dayLogs);
};
```

### Inventory — every calendar that can be tapped (AGENTS.md §7)

| Where | Tappable? | What a tap does |
| --- | --- | --- |
| `src/pages/PlayerProfile.jsx:795-800` | yes | **The bug.** Delete wins on your own current month |
| `src/pages/TodayPage.jsx:526` `renderMonthLogCalendar` | no tap handler | nothing |
| `src/pages/TodayPage.jsx:1113` `renderWeeklyStrip` | no tap handler | nothing |
| `src/components/MonthCalendarCard.jsx:58` | only with an `onDayClick` prop | its one consumer, `SettlementScreen.jsx:656`, passes none |

So the pattern exists in **one place only**. The previous handover was right to
ask, and the answer is that the other calendars are not affected.

`PlayerProfile` is hosted from four places, all of which pass `onDeleteLog`
only for your own profile: `App.jsx:3774` (the Profile tab),
`TodayPage.jsx:1532`, `HistoryPage.jsx:389`, `MonthPage.jsx:122`.

### The shape of the fix

The view path and the modals already exist and are already reachable (on
someone else's profile, or in a past month). The change is to stop delete
winning, and to add a delete action inside the detail modal at
`PlayerProfile.jsx:615`, which today only offers **Close**. `setDeleteTarget`
and `DeleteModal` stay exactly as they are, so the multi-Bloc delete path
(`findWorkoutCopiesInOtherBlocs`) is untouched.

**Built, shipped and live at `ca248a2`.** See §3.

## 3. What changed, and what it is now

`src/pages/PlayerProfile.jsx`, two places, nothing else:

1. `openDayLog` no longer branches on delete. A tap always runs the view path —
   one workout opens the detail sheet, several open "Choose a workout — select
   a workout to view its details".
2. The detail sheet carries a **Delete workout** button above **Close**, shown
   only when `isCurMonth && !!onDeleteLog` — the same two conditions that used
   to let a tap delete. It hands the log to the existing `setDeleteTarget`, so
   `DeleteModal` and `findWorkoutCopiesInOtherBlocs` are untouched and a
   multi-Bloc workout still deletes everywhere at once.

### Deliberately left alone

The `deleteChoices` sheet ("Select the workout you want to delete") is now
unreachable — the calendar was its only caller. Its state and markup were left
in place rather than removed, because removing them is cleanup nobody asked
for. It costs a few hundred bytes of bundle and no behaviour. Worth deleting
the next time that file is open for another reason.

## 4. How it was verified

Sandbox at 375×812, signed in as Tariq (`riley@local.test`), with three
activities seeded on 23 October, one on 22 October, and a closed September
seeded into `monthHistory`:

| State | Result |
| --- | --- |
| Own profile, current month, **one** workout | Detail sheet: Pilates, 22 October, the note, **Delete workout** + Close ✓ |
| Own profile, current month, **three** workouts | "Choose a workout — select a workout to view its details"; picking Run opened its detail sheet with Delete ✓ |
| Own profile, **closed** month (September) | Detail sheet, **Close only** — no delete ✓ |
| **Another member's** profile (Hana) | Detail sheet, **Close only** — no delete ✓ |
| Delete from the detail sheet | Opened the real `DeleteModal`, named the right workout, "Keep it" backed out ✓ |

`npm run lint` clean. `npm run build` clean. No console errors in the sandbox
or on the live site.

**Test scripts run:** `test:two-workouts`, `test:fero-profile-stats`,
`test:month-sit-out-card`, `test:activities`, `test:notification-badge`,
`test:identity` — all passed.

**`test:mobile-navigation` fails, and it is not this change.** It times out
waiting for "Your Blocs". Confirmed pre-existing by stashing the change,
rebuilding and running it again — it fails identically. The cause is the
sandbox blob: the script expects the seeded identity `seed-invite@local.test`
and invite code `ALHK05`, and the blob in `.sandbox-data/` was carried over
from an earlier session with different seed data. Deleting
`.sandbox-data/blob.json` and reseeding should settle it. **Not investigated
further — outside this task.**

**Not verified:** the sheet on a real phone, on glass.

## 5. Commits

| What | Commit | Live? |
| --- | --- | --- |
| This handover opened | `a0f3ad2` | n/a |
| Tapping a calendar day shows the workout | `ca248a2` | **yes** |

Pushed straight to `main` at the founder's instruction. Production deployment
of `ca248a2` reported `success`; the live bundle `assets/index-BQ6nZQi3.js`
carries the new button's style, and the live site loads with no console
errors.

## 6. Still open

Unchanged from the previous handover: the scoring question (AGENTS.md §8),
TestFlight build 12, the four App Store items, the 1 November month close,
Deveen's list, and the prorated status bug.

## 7. Housekeeping at close

Sandbox stopped by PID on ports 3000 and 54321. Browser viewport reset. The
shared folder is on `main`, level with `origin/main`, clean apart from the four
August `.dmg` backups that were there before. No worktrees added or removed.
Nothing was run against the production database this session.

---

## 8. Addendum — Deveen's RLS approval, read and checked

Added later the same session, after the founder relayed Deveen's message
approving both migrations. **Nothing was applied. Nothing was changed.** This
section records what was read and the one question it answered.

### What Deveen sent

Both migrations approved as-is. Apply to production, his
(`20260926120000`) first, then ours (`20261020150000`), fresh backup before.
Verification, rollback and the phone checks are in
[`rls-rollout-2026-10-23.md`](rls-rollout-2026-10-23.md), already on `main` at
`1e2daf3`. Timing: this week, or after 2 November — not beside the month close.

### Checked against the repo

- `docs/rls-rollout-2026-10-23.md` is present and matches what he described.
- Both migration files are present and were read line by line. They enable RLS
  with **no policies** and deliberately do **not** set
  `FORCE ROW LEVEL SECURITY` — which is what keeps the `SECURITY DEFINER`
  functions working, since a table's owner is exempt from its own RLS unless
  FORCE is set. The second file sweeps `backup\_%` in `ante_core` with a
  `relrowsecurity = false` filter, so it is idempotent and the one table both
  files touch is skipped by whichever runs second.
- Rollback is one statement per table.

### ANSWERED: why `push_devices` is in production but not in the repo

Deveen asked about this. **It is not orphaned — it is unmerged work.**

`ante_core.push_devices` was created by
`supabase/migrations/20260928213116_add_push_notification_foundation.sql`,
added in commit `85109b1` ("Add local iOS push notification foundation",
28 September). That commit **has never been merged to `main`.** It lives only
on the TestFlight lineage:

`testflight-build-10`, `testflight-build-11`,
`claude/testflight-build-12-2026-10-21`, and
`claude/rls-correction-2026-09-30`.

It carries the whole feature, not just the table: `api/push-devices.js`,
`server/push.js`, `src/lib/pushNotifications.js`, the iOS entitlements, and a
second migration `20260928214145_fix_push_device_token_validation.sql`.

So the migration was applied to production while the code that uses it stayed
on a branch. That is why `main` references the table nowhere. The table is
**empty** and no build in the field writes to it (no APNs key, no permission
prompt, push signing overridden off) — recorded in
`handover-2026-09-29-for-deveen-active.md` §1. Enabling RLS on it is safe, and
it will be covered whether or not that branch ever merges.

**Worth telling Deveen**, since his note assumed it was created out-of-band.

### THE BLOCKER: this session cannot reach production

Checked directly:

| | |
| --- | --- |
| Supabase MCP tools in this session | **none available** |
| `supabase` CLI on this machine | **not installed** |
| `SUPABASE_URL` / `SERVICE_ROLE_KEY` in `.env.local` | **present but empty** |

So the migrations cannot be applied, and the verification queries cannot be
run, from here — regardless of approval. That has to be solved first.

### Update — Supabase connector added, but to the wrong account

The founder added the official Supabase connector to this app. It connects and
its tools work. **It does not reach Fero.**

The connected account holds **one** organisation ("aadhilsj's Org") and **two**
projects:

| Project | Ref | Region |
| --- | --- | --- |
| Runway | `kmbepvzsbmucrvhbjgbj` | eu-central-1 |
| LifeOS | `oulbhauthynnqumormte` | eu-north-1 |

Fero production is `bpvvvqjsfwmmfjvvijkd` (CLAUDE.md §12, and the second
migration's own header). It is **not in the list**, and neither is
`fero-staging`. So the Supabase login used is a different one from the account
that owns Fero.

**Nothing was queried.** Runway and LifeOS are unrelated projects and were not
touched. The rollout stays blocked until the connector is signed in to the
account that owns `bpvvvqjsfwmmfjvvijkd`.

### RESOLVED — the CLI already had access on this Mac

The connector was a dead end (wrong account). The **Supabase CLI was already
signed in on this machine**, with a token in `~/.supabase/access-token` last
used 19 October. That account sees all five projects, Lift Log among them:

| Project | Ref | Region |
| --- | --- | --- |
| **Lift Log** (production) | `bpvvvqjsfwmmfjvvijkd` | eu-west-1 |
| fero-staging | `okwrrspdmoluxatyokzh` | eu-west-1 |
| Huddle (inactive) | `zmijzfjfajrrwyrffkkb` | eu-central-1 |
| Runway | `kmbepvzsbmucrvhbjgbj` | eu-central-1 |
| LifeOS | `oulbhauthynnqumormte` | eu-north-1 |

**No new token was created and none was needed.** A `SUPABASE_ACCESS_TOKEN`
line was briefly added to `.env.local` and then removed once this was found.

The CLI runs via `npx supabase@latest` — nothing installed. It has **no ad-hoc
SQL command**, and `db dump` needs Docker, which is not on this machine. Read
queries therefore go through the Management API directly, using that same
stored token:

```
POST https://api.supabase.com/v1/projects/bpvvvqjsfwmmfjvvijkd/database/query
```

### Production state, measured directly — Deveen's numbers confirmed

| Check | Result |
| --- | --- |
| `ante_core` tables, total | **40** |
| ...with RLS off | **14** — exactly his figure |
| ...of those, granting to `anon` or `authenticated` | **none** |

The 14: `bloc_messages`, `bloc_message_reactions`, `bloc_message_reads`,
`workout_log_comments`, `workout_log_comment_reactions`, `solo_requests`,
`revision_clock` (his seven), `push_devices`, and six `backup_*` tables
(`bloc_message_solo_note_2026_09_18`, `blob_before_force_rollover_2026_10_01`,
`marlene_jul_aug_2026_10_01`, `solo_tw_2026_10_01_blob`,
`solo_tw_2026_10_01_member_status`, `nishara_log_date_2026_10_13`).

That is his 8 + `push_devices` + the five later backups = 14. The two
migrations cover all of them, and the zero-grants result independently confirms
his safety argument: nothing can reach these tables with a browser key today.

### WARNING — do NOT use `supabase db push`

`supabase migration list` shows the repo's migration history and production's
are **badly divergent**: roughly 25 local files have no remote record, and
roughly 25 remote entries have no local file. The cause looks structural —
work applied through the MCP `apply_migration` gets the server's own timestamp,
while repo files carry hand-written ones, so the same change exists under two
different version numbers. Today's cap migration is the clearest example: local
`20261023100000`, remote `20261023065455`.

**`db push` would therefore try to apply around 25 migrations whose content is
already in production.** Some are `create or replace` and harmless; others are
not. Apply the two RLS files individually instead, exactly as Deveen's doc
says, and never `db push` against this project without resolving the history
first. **Worth a separate task, and worth telling Deveen.**

### Supabase incident, at time of writing

Status page: **"Elevated Mgmt API Error Rates in Multiple Regions"** — minor,
status `monitoring`, mitigations deployed. Every read above succeeded. It
matters only because the Management API is the route the migrations would be
applied through. Both files are idempotent and guarded, so a partial failure
is safely re-runnable rather than damaging.

### Recommended timing

Today is Friday 23 October. Applying this week leaves eight days of ordinary
use before the 1 November close, which is the settling period Deveen wants.
Waiting until 2 November gives up that settling time. **This week is the better
half of his own window.**
