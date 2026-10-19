# 19 October — catch-up, the folder brought current, and the 18 October record

## Plain-English summary

The founder came back after ten days away. The shared laptop folder was 78
commits behind GitHub, so it was brought level. `WHATS-LIVE.md` had not been
updated since 16 October and was missing Deveen's two 18 October changes, so
those are now recorded. No application code was touched this session.

## 1. Where things were found

- **Live:** `99de67f`, production deployment `7121675219`-era successor
  deployed 19 October 10:28 UTC, state `success`. Live site returns HTTP 200.
- **The shared checkout** at `~/Documents/Codex Space/Lift Log` was on
  `19ed525` (9 October), **78 commits behind** `origin/main`, 0 ahead.
- **No open pull requests.** PRs #34 and #35 both merged 18 October.
- `WHATS-LIVE.md` last updated 16 October at `2b54000` — two code changes
  behind.
- `HANDOVERS.md` did not list `handover-2026-10-18-open-season-sweep.md`.

## 2. What was done

### 2.1 The folder brought current

`git pull --ff-only` — a clean fast-forward to `99de67f`, no merge, no
conflicts. Verified after: 0 behind / 0 ahead, `.env.local` present,
`node_modules` present, the other three worktrees untouched on their own
branches.

`package.json` changed in those 78 commits but only to add two test scripts
(`test:content-safety`, `test:notification-badge`); `package-lock.json` was
never touched, so no dependency install was needed. `npm run lint` clean.

### 2.2 The 18 October work recorded

Deveen's two merged PRs were added to `WHATS-LIVE.md`, and his handover added
to the `HANDOVERS.md` October table. Both were already live; this is a
documentation catch-up only, so that `WHATS-LIVE.md` — the file that wins
every "what is actually live" question — stops giving a stale answer.

## 3. What was deliberately not touched

- The four August `.dmg` backups still sitting untracked in the shared folder.
- The three other worktrees, and every stale local branch.
- Any application code. This session changed documentation only.

## 4. Still open, carried forward from the 15 October handover

Unchanged by this session, restated so it is not lost:

- **The skipped-Bloc overlay fix is live but never exercised** against a really
  skipped Bloc. **1 November** is the next full month close.
- **The newest-emoji badge** has only been seen against a sandbox fixture.
- **Block/report persistence** proven on `fero-staging`, not production.
- **TestFlight build 11** never made; `main` is far past build 10.
- The in-Bloc shell's parent still has no scroll guard (deliberate).
- The Stream's empty state counts hidden messages.
- `support@joinfero.app` unconfirmed.
- `test:auth-edge-flows` and `test:mobile-navigation` fail on `main`.
- **Waiting on Deveen:** scaling before launch, the RLS production rollout,
  `push_devices` missing from his migration, `fero-staging` still billing.

## 6. The notification centre, checked against the founder's question (19 Oct)

He asked: does the bell light up, with an accurate number, when somebody
reacts, comments on a log, or tags you in the Stream? **Checked against the
code and proved with a probe script. The answer is no, in three separate
ways.** Nothing is fixed yet.

The badge itself is real — `NotificationDot` in `src/pages/Nav.jsx:70` renders
the number and caps it at `9+`. What is wrong is what gets counted.

`unreadCount` (`src/lib/notificationCentre.js:349`) counts a row when its
`when` is later than `notificationsSeenAt`. The three failures are all about
what `when` holds, and when the data arrives.

### 6.1 A reaction is dated by the WORKOUT, not by the reaction

`ownLogItems` sets the reaction row's `when` to `logWhen(log)` — the workout's
own `createdAt` (`notificationCentre.js:140`). So reacting to a workout you
logged last week produces a row dated last week, which is older than the last
time you opened the centre.

Proved: a reaction arriving today on a log from six days ago gives a badge of
**0**. The same reaction on a log made today gives **1**.

**Effect: react to anything but a brand-new workout and the bell stays dark.**

`latestReaction` already carries a timestamp (added 16 October for the emoji
badge) but it is read only for `emoji`, never for `at`.

### 6.2 A comment is dated by the workout too, until the centre is opened

`when` is `latest?.createdAt || when` (`notificationCentre.js:175`), and
`latestComments` is only fetched inside `handleOpenNotifications`
(`src/App.jsx:2455`). Before the first open, the row falls back to the blob's
`commentCount` and the workout's date — so it is older than `seenAt` and is
not counted. After an open, the real comment time is known and it counts.

**Effect: the first comment is missed; later ones are counted.**

### 6.3 A mention can never light the bell at all

`notificationStreamMessages` starts as `[]` (`src/App.jsx:448`) and is only
filled by `listBlocStreamMessagesData` inside `handleOpenNotifications`
(`src/App.jsx:2464`). `mentionItems` therefore has nothing to work with until
the centre has been opened.

**Effect: being tagged never produces a badge. You have to open the centre to
discover you should have opened the centre.** This is the worst of the three
and it is unconditional.

### 6.4 Also true, and smaller

`notificationsSeenAt` lives in `localStorage` (`src/App.jsx:438`), so "seen"
is per browser and per device. A new phone counts everything as unread.

### 6.5 The mention glimmer outlines the whole row, not the bubble

Reported by the founder with a screenshot. The glow is applied to the row
wrapper `div` in `src/pages/BlocStream.jsx:1385` — the element that wraps the
avatar, the name, the bubble, the reaction chip and the timestamp. So the
outline is drawn around all of it.

He wants it on the message bubble only: the inner `div` at
`src/pages/BlocStream.jsx:334` (`borderRadius: radius`, radius 18).

Note for whoever fixes it: the current code uses `outline` with
`outlineOffset` deliberately, and says why in a comment — padding moved the
message *after* the list had scrolled to it, leaving it clipped under the
header. Keep `outline`; do not reach for padding or a border. Also note the
glow currently sits on the shared wrapper used by every message type, so
moving it into `TextBubble` covers text messages only.

### 6.6 How this was checked

A probe script built fixtures through `buildNotifications` and read
`unreadCount` back, for each of the three cases, before and after the centre
is opened. Read-only, in the scratchpad, not added to the repo. **No test in
the repo covers `unreadCount` at all** — `scripts/test-notification-badge.mjs`
only covers which emoji the badge shows.

## 7. Fault 6.1 fixed — a reaction is dated by the reaction (19 Oct)

**The first of the three is fixed and tested. The other two are not, and the
reason is in §8.**

`ownLogItems` now dates a reaction row by `log.latestReaction.at` — the
timestamp that already arrives beside the emoji — instead of by the workout's
own `createdAt`. `unreadCount` compares that against `notificationsSeenAt`, so
a reaction arriving today on a workout from last week now counts.

Measured with a probe before and after, same fixture: **badge 0 before, badge
1 after.**

**The guard that matters.** The timestamp is only trusted when the newest
emoji is one somebody *else* used — the same `usableNewest` condition the
badge emoji already used, now shared. If the most recent reaction is your own,
the row falls back to the workout's time, because dating it by your own
reaction would light your own bell. A missing or unparseable timestamp falls
back the same way, which is the older-server and canonical-out-of-reach case.

**No new reads.** `latestReaction` has been on every log since 16 October;
this only stops throwing its `at` away.

**Tests.** `scripts/test-notification-badge.mjs` previously covered only which
emoji the badge shows — `unreadCount` had no test at all, which is how this
shipped. Seven cases added: the reaction on an older log counts; the row
carries the reaction's time; no timestamp falls back; an unparseable timestamp
falls back rather than throwing; your own newest reaction does not date the
row; a reaction from before the last open is not counted; a log with no
reactions produces no row.

**Verified:** `npm run lint` clean, `npm run build` clean, **25 of 27 suites
pass**. The two failures are `test:auth-edge-flows` and
`test:mobile-navigation`, the known pair that needs the app served on port
3000 and that fails on `main` too.

**Files changed:** `src/lib/notificationCentre.js`,
`scripts/test-notification-badge.mjs`. Nothing else was modified.

## 8. Faults 6.2 and 6.3 need one database function — not yet written

Both were traced to the same root cause: **the data is not on the device until
the centre is opened.**

- A log carries `commentCount` and nothing else — **there is no comment
  timestamp in the blob at all** (`normalizeLogEntry`, `api/lift-log.js:1676`).
  The real one only exists after `read_ante_core_workout_log_latest_comments`
  runs, which happens on open.
- Stream messages are fetched in exactly two places: the Stream screen, and
  `handleOpenNotifications`. Neither runs before the bell is tapped, so
  `mentionItems` has nothing to read.

So neither can be fixed on the client with what is already there. The options
were weighed against §20 of Deveen's handover, which is explicit that the
per-refresh read path must get lighter, not heavier:

| Option | Verdict |
| --- | --- |
| Fetch comments and stream messages on every refresh | **No.** Two extra calls per refresh per phone, against the one item that blocks launch |
| localStorage count-delta on the blob's `commentCount` | **No.** It counts your own comments, which 16 October deliberately removed |
| Extend the stream-unread call the app **already makes** on refresh | **Recommended** |

`read_ante_core_bloc_stream_unread_count`
(`supabase/migrations/20260719065836_add_bloc_stream_unread_count.sql`) is
already called once per refresh and already resolves the bloc, the profile and
the last-read time. `bloc_messages.mentions` is a `uuid[]` of profile ids, so
a mention count is `v_profile_id = any(m.mentions)` on the rows it already
scans. A comment count since a given time is the same shape against the
comments table.

That makes the bell correct for all three at **no extra round trip** — the one
call returns three numbers instead of one.

**Not done, and deliberately not started:** it is a new read-only function on
production, and `CLAUDE.md` §4 says to say what is about to run before running
it. Waiting on the founder.

## 5. Commits this session

| Commit | What | Live |
| --- | --- | --- |
| `817836c` | Open this handover, record the 18 October work in `WHATS-LIVE.md` and the index | Docs only |
| `03fd580` | Record the three notification-badge faults and the glimmer target. Findings only | Docs only |
| *(this one)* | **Fault 6.1 fixed** — a reaction row is dated by the reaction, with seven tests | **On `main`, live** |
