# 19-20 October — catch-up, the folder brought current, and the notification badge

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

## 9. The counts function — APPLIED TO PRODUCTION on 20 October, and verified

**Superseded note:** this section was first written on 19 October saying the
SQL had never run, because the session had no way to reach a database. The
founder connected the Supabase connector on 20 October and it was applied and
verified then. The original blocker is kept below as §9.1 because it explains
why the migration sat unapplied for a day.

### 9.1 Why it could not be run at first (resolved 20 October)

| Route | State |
| --- | --- |
| Supabase MCP (`execute_sql` / `apply_migration`, what `CLAUDE.md` §12 names) | **Not connected to this session.** Checked the session's connectors: Claude Docs, Gmail, Figma, Notion, Google Calendar, Google Drive, scheduled-tasks. No Supabase |
| `supabase` CLI | not installed |
| `psql` | not installed |
| Local Postgres on 54322 | nothing listening |
| Docker | not installed |
| A Postgres client in `node_modules` | none |
| `.env.local` | has `SUPABASE_URL` and the service key, but **no database connection string** — and PostgREST cannot run DDL |

That was the state for one day. **Resolved** when the founder connected the
Supabase connector to the session on 20 October.

### 9.2 What it is

`supabase/migrations/20261019120000_add_notification_counts.sql` —
`read_ante_core_notification_counts(text, text, text)`, returning
`{ streamUnread, mentions, logComments }`.

It exists because the app **already calls**
`read_ante_core_bloc_stream_unread_count` once per refresh, and that call
already resolves the bloc, the profile and the last-read marker. The two
missing numbers come off rows it is already positioned to scan, so the bell
becomes correct at **no extra round trip** — which is the only shape §20 of
Deveen's handover permits.

Written against the real schema, not from memory:

- `bloc_messages.mentions` is `uuid[]` of **profile** ids
  (`20260719023832_add_bloc_stream_backend.sql:15`) — the client only sees
  auth user ids because the stream read converts them on the way out. So the
  predicate is `v_profile_id = any(m.mentions)`.
- Own comments are excluded with
  `c.commenter_profile_id is distinct from v_profile_id`, copied from
  `20261016090000_latest_comments_exclude_your_own.sql:67`.
- A log is yours by `ante_core.workout_logs.profile_id`
  (`20260606234412_create_ante_core_canonical_schema.sql:243`).
- Both moderation filters match the sibling readers.
- `streamUnread` repeats the existing rule exactly, so the Stream icon cannot
  start disagreeing with itself.
- A bad `p_since` is caught and treated as null rather than becoming
  `-infinity`, which would light the bell with every message the Bloc has
  ever sent.

**The old function is left in place and unchanged.** It still drives the
Stream icon, and leaving it is what makes the rollback a single
`drop function`.

**Grants** follow the house pattern: revoked from `public`, `anon` and
`authenticated`, granted to `service_role` only. **Verified on production** —
see §9.5.

### 9.3 The code around it — written, verified as far as it can be

- `api/lift-log.js`: `readNotificationCountsFromCanonical` calls the new
  function and **returns null when it is not there**, so the handler falls
  back to the old unread count. Null is "could not ask"; zero rows is a real
  answer and comes back as zeroes — the distinction `CLAUDE.md` §6 insists on.
- `src/lib/api.js`: the two new numbers come back as **null, not 0**, from a
  server that does not have the function.
- `src/App.jsx`: the badge adds the server's two numbers to what the client
  works out for itself. **This cannot double-count:** before the centre is
  opened the client holds no comment times and no stream messages, so those
  rows contribute nothing; after it is opened `notificationsSeenAt` is that
  moment and every row then fetched is older than it, so they contribute
  nothing either. The client side of the sum is always reactions and money.
- The badge is cleared optimistically on open, so it goes out with the panel
  and no extra request is made to prove it.
- The last-opened time is also held in a ref, so the refresh callback reads it
  without taking it as a dependency — opening the bell does not rebuild the
  callback and fire an extra request.

**Verified:** `npm run lint` clean, `npm run build` clean, the full suite at
its known baseline — 25 of 27, the two failures being the port-3000 pair that
fails on `main` too.

### 9.4 Applied to production — 20 October

Applied with `apply_migration`, name `add_notification_counts`, project
`bpvvvqjsfwmmfjvvijkd`.

**Before-state recorded first**, so the after-check meant something:

| | Before | After |
| --- | --- | --- |
| `read_ante_core_notification_counts` exists | **0** | 1 |
| `read_ante_core_bloc_stream_unread_count` exists | 1 | 1 (untouched) |
| `ante_core.bloc_messages` | 515 | **515** |
| `ante_core.workout_log_comments` | 306 | **306** |
| `ante_core.workout_logs` | 2312 | **2312** |
| `ante_core.profiles` | 48 | **48** |
| `ante_core.blocs` | 12 | **12** |

**Column types were checked against the live database before applying**, not
taken from the migration files: `bloc_messages.mentions` is an array,
`workout_logs.profile_id` and `commenter_profile_id` are uuid, and both
`workout_logs.id` and `workout_log_comments.workout_log_id` are **text**, so
the join is text-to-text — the exact trap `CLAUDE.md` §6 names.

**Rollback is one statement:**

```sql
drop function if exists public.read_ante_core_notification_counts(text, text, text);
```

The old unread function was not altered, so dropping this one returns the app
to the fallback path and the badge to its 19 October behaviour.

### 9.5 Verified on production

**Grants — identical to the sibling function's, which is the house pattern:**

| Function | acl | anon | authenticated | service_role |
| --- | --- | --- | --- | --- |
| `read_ante_core_bloc_stream_unread_count` | `postgres=X/postgres \| service_role=X/postgres` | false | false | true |
| `read_ante_core_notification_counts` | `postgres=X/postgres \| service_role=X/postgres` | **false** | **false** | true |

Both `security definer`, both owned by `postgres`.

**The numbers, against real data.** A member mentioned 5 times, cross-checked
against a separately computed expectation:

| `p_since` | mentions | logComments | streamUnread |
| --- | --- | --- | --- |
| null (never opened) | **5** — matches the independent count | 5 | 100 |
| `2026-10-19T00:00:00Z` | 0 | 0 | 100 |
| `2099-01-01` (future) | 0 | 0 | 100 |
| `'not a date'` | 5 | 5 | 100 |

`streamUnread` is the same in every row, which is the point: it reads the
Stream's own marker and ignores `p_since` entirely.

**The claim that the Stream icon cannot start disagreeing with itself was
tested, not asserted.** Both functions were run for **every one of the 57
active memberships** on production:

- members checked: **57**
- `streamUnread` agrees with `read_ante_core_bloc_stream_unread_count`: **57**
- disagrees: **0**

Largest values seen anywhere: 5 mentions, 22 log comments.

**One thing this found:** a comment in the migration file claimed a bad
`p_since` was prevented from becoming `-infinity`. It is not — null becomes
`-infinity` through the `coalesce`, so an unparseable value counts everything,
exactly as the client's `unreadCount` does with a seen time it cannot parse.
The behaviour is right and intended; the comment was wrong and has been
corrected. The point of the exception handler is that the function must not
**error** and take the Stream's unread count down with it.

**Still not verified, and it needs a second person:** the path from a real tag
to a lit bell on a phone. Nobody has been tagged since this went live, so the
end-to-end journey has been proved at the database and in the code, but not
with a thumb on a screen.

## 10. Shipped and live — 20 October

`2099e2c` deployed, Vercel state `success`, live bundle
`index-B_0wG8Ws.js` (was `index-BTigpeJn.js`) and it carries both
`mentionCount` and `logCommentCount`. Live site returns HTTP 200 and loads
with no console errors.

**Two of the founder's three badge faults are now fixed and live:**

| Fault | State |
| --- | --- |
| 6.1 A reaction did not light the bell | **Fixed and live** at `e387b2c`, client-side, no new reads |
| 6.2 The first comment on a log was missed | **Fixed and live** at `2099e2c`, via the counts function |
| 6.3 A Stream tag never lit the bell at all | **Fixed and live** at `2099e2c`, via the counts function |

**Still open, and nobody should call the bell done until it is closed:** no
real tag or comment has arrived since this shipped, so the journey from
someone typing `@Aadhil` to a number appearing on a phone has been proved at
the database and in the code but **never with a thumb on a screen**. It needs
a second person in a Bloc. That is the one test left.

**Also still open from §6.4:** "seen" is per browser, in `localStorage`. A new
phone counts everything as unread and the bell does not agree across devices.
Not addressed; it is real per-user read state, which is database work.

**Still not started:** the mention glimmer (§6.5) — the founder's screenshot
shows the outline around the whole message row rather than the bubble. The
target and the reason the current code uses `outline` are recorded there.

## 11. The mention glimmer now hugs the bubble — 20 October

The founder's screenshot showed the shimmer boxing the whole message row.
Cause: the outline sat on the row wrapper in `src/pages/BlocStream.jsx`, the
element that holds the avatar, the name, the bubble, the reaction chip and the
timestamp. It is the full width of the list, so it boxed all of it.

**The fix.** The glow moves onto the bubble itself — the inner div in
`TextBubble`, `borderRadius` 18. `wrap` takes a `glowInside` flag so a text
message draws its own and the wrapper draws none.

**The cards keep the row-level glow.** System, event and log-comment cards
have no bubble to put it on, so they are untouched and look as they did.
Mentions only ever land on text messages — `mentions` is set by
`send_ante_core_bloc_message`, which is the text path — so in practice the
bubble version is the one that runs.

**Still an `outline`, deliberately.** The original comment explains why and it
still applies: an outline is drawn outside the box and changes no layout, so
it cannot move the message after the list has already scrolled to it. Padding
was tried once and left the message clipped under the header. `outlineOffset`
drops from 4 to 2 because it is now hugging a bubble rather than standing off
a whole row.

**Untouched:** `messageNodeRefs`, the scroll anchoring, the 2-second clear,
and every size, padding and radius in the Stream.

### 11.1 How it was checked, and what that does not cover

**The sandbox cannot show this.** `scripts/sandbox.mjs` has no Stream support
at all — zero references to `stream-list`, `stream-send` or `bloc_messages` —
so the Bloc Stream cannot be driven there and the glimmer cannot be triggered.
`npm run sandbox:seed` also stops early, at the August month close.

So it was checked with a **faithful side-by-side of the two states at 375px**,
built by copying the style values verbatim out of `BlocStream.jsx`. It
reproduces the founder's screenshot in the "before" and shows the outline
hugging the bubble in the "after". That proves the CSS, **not the live
component**.

**Not verified:** the real thing, on a real mention, in the real Stream. Same
gap as §10 and it closes the same way — a second person tagging him.

**One thing to look at when it is seen for real:** the reaction chip overhangs
the bubble's bottom edge, so it now sits slightly outside the outline where
before it was inside the box. It reads fine in the comparison; it is the one
detail worth his eye.

### 11.2 A correction to §10's note about the test suite

§10 and earlier commits repeated the handovers' line that
`test:auth-edge-flows` and `test:mobile-navigation` fail because they need the
app served on port 3000. **That was tested today and is not the whole reason:
both still fail with the sandbox running on 3000.** `test:mobile-navigation`
times out waiting for "Your Blocs" to become visible, which points at the
incomplete seed rather than at the port. Not investigated further — outside
today's task — but the old explanation should not be repeated as fact.

## 12. Deveen's staging RLS task — checked, NOT run, and it needs changing first

The founder relayed a task from Deveen: apply
`20260926120000_enable_rls_on_server_only_tables.sql` to **staging only**
(`okwrrspdmoluxatyokzh`), then report two verification queries, both expected
to return zero rows.

**Nothing was run. All of the below is read-only.** Two findings stop it.

### 12.1 Staging already has it

Every one of the **33** `ante_core` tables on staging already has RLS enabled,
and the projection-grant query already returns **0 rows**. This is Deveen's
own 27 September rehearsal, recorded in §11 of
`handover-2026-09-22-for-deveen-active.md`.

So **both of his checks pass before anything is applied.** Re-running the
migration is idempotent and harmless, but it would report "clean" from a
database that was already clean, which is a misleading data point rather than
a useful one.

### 12.2 The check cannot pass on production — 6 tables are not covered

This is the finding that matters, because staging is only a rehearsal for
production.

Production has **40** `ante_core` tables, **14 with RLS off**. The migration
covers **8** of them. The other **6 are not in the file at all**:

| Table | Why it is missing |
| --- | --- |
| `push_devices` | **Exactly what §1 of Deveen's own active handover flagged on 29 September** as "URGENT-ish… needs you before 2 Oct", re-verified 30 September. Still not in the migration, three weeks on |
| `backup_blob_before_force_rollover_2026_10_01` | Created **after** the migration was written |
| `backup_marlene_jul_aug_2026_10_01` | Same |
| `backup_solo_tw_2026_10_01_blob` | Same |
| `backup_solo_tw_2026_10_01_member_status` | Same |
| `backup_nishara_log_date_2026_10_13` | Same — created by this project's own 13 October data correction |

So on production, Deveen's first query returns **6 rows, not 0**, and his
stop condition fires. The five backups are a new class he has not seen: the
migration predates them, and **every production data fix since has created
another one**. Whatever is agreed should cover tables made after the file was
written, or the same gap reappears at the next backup.

### 12.3 Nothing is exposed — this is a gap, not a hole

Checked directly: of the 14 production tables with RLS off, **none grants
anything to `anon`, `authenticated` or `public`** — all report no client
grantees. That matches Deveen's own safety argument (`anon` has no `USAGE` on
`ante_core`). RLS off here is a missing second lock on a door that has no
handle on the outside, not an open door.

**No urgency, and no reason to rush production.**

### 12.4 Where it was left

Not applied to staging, pending the founder's call: running it proves nothing
(§12.1) while the migration still needs changing before production (§12.2).
The useful next move is Deveen seeing §12.2, not a green tick from staging.

Staging `fero-staging` is `ACTIVE_HEALTHY` and still billing.

### 12.5 A second migration written to close the gap — not applied

`supabase/migrations/20261020150000_enable_rls_on_remaining_server_only_tables.sql`

**A separate file, deliberately.** Deveen's September migration is his and he
is mid-rollout with a captured baseline; editing it underneath him would
invalidate his comparison and break `CLAUDE.md` §5. This one is additive and
can be reviewed, reordered or dropped on its own.

It does two things:

1. **`push_devices`** — guarded by an existence check, the same shape his file
   uses for the September backup table.
2. **Sweeps `backup_*` in `ante_core`** rather than naming the five. Naming
   them is what failed the first time: the list is right the day it is written
   and wrong at the next data fix, because every production data change takes
   a backup first (§4). The sweep is idempotent, and re-running it after the
   next backup covers that one too — that is the intended maintenance, and it
   is written in the file.

**Verified read-only on production before committing:** the pattern selects
exactly six tables — the five, plus
`backup_bloc_message_solo_note_2026_09_18`, which his file also covers. That
overlap is harmless: whichever runs first enables it, and the
`relrowsecurity = false` filter makes the other skip it.

**His 8 + `push_devices` + the sweep = all 14.** With both applied, his
zero-rows check finally returns nothing.

**NOT APPLIED — not to staging, not to production.** The RLS rollout stays
Deveen's, and nothing here should move until his comparison comes back. The
file exists so he receives a fix rather than a problem.

## 13. App Store screenshots — a clean demo Bloc staged (20 Oct)

Founder's call: do the screenshot work now, leave the TestFlight build until
last because Xcode is on his other laptop, which he has access to.

### 13.1 The demo Bloc

**Sunday Warriors**, five members — Tariq, Hana, Noah, Eli, Leo — reusing the
cast already on the marketing site, so the website and the listing agree. **No
real member names, faces or data anywhere**, which the runbook requires.

Staged as sandbox data only (`.sandbox-data/blob.json`). **No application code
was changed for any of this.**

On his instruction: **no proration, no Solo, no Training Wheels.** A clean
Bloc, established in January, target 12, on day 20 of 31:

| | Logged | Status |
| --- | --- | --- |
| Tariq | 14 | CLEARED |
| Hana | 11 | CRUISING |
| Noah | 8 | ON TRACK |
| Eli | 4 | BEHIND |
| Leo | 2 | BEHIND |

### 13.2 Four things that had to come off the screen first

1. **A hardcoded demo settlement card** — "Isira says they paid you, $20".
   From `buildSettlementPreviewCards` (`src/lib/appState.js:1134`), gated by
   `settlementConfirmationsPreviewMode`, which the API sets from
   `ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW` — **`true` in `.env.local`**. Run
   the sandbox with it `false`. `.env.local` was not edited.
2. **"Finish setup — 3 things need review"** — `group.setupReview.pending`.
3. **Training Wheels**, which also lives per-member in `group.training`,
   `trainingDecisions` and `solo` — keyed by display name, so a rename has to
   cover them or it silently persists.
4. **"PRORATED" on every row.** Not `seasonOverrides` (empty) and not the
   settings flag. It is `membership.joinedAt`: with no join date the app infers
   the member joined this month and prorates. Fixed by giving every membership
   a January `joinedAt` and a matching `joinedMonthByName`.

### 13.3 The founder's status bug, narrowed — NOT fixed

He flagged that a member on 3 of 12 with 12 days left showed **CRUISING**,
and said it is a bug. Agreed, and this narrows it: **it only happened on the
prorated path.** With proration off the same shape reads BEHIND correctly.

So the suspect is the prorated branch in `src/pages/TodayPage.jsx:199-205` —
`expected = Math.floor((activeTarget / proratedDays) * daysActive)` feeding
`resolvePaceStatus`, rather than `getStatus` on the plain path.

**Deliberately not fixed.** It is outside the screenshot task and he has not
asked for it. Logged here so it is not lost.

### 13.4 What still cannot be shot here

- **The Bloc Stream** — `scripts/sandbox.mjs` has no Stream support at all, so
  it renders "No messages yet".
- **A finished month** — the sandbox cannot close one. The month-close safety
  check refuses because the sandbox answers every canonical read with nothing:
  `canonical logs empty for 2026-7 while blob counted 30`. That check is
  correct; the sandbox is the limitation.
- **The final capture itself.** The "Local test identity" bar shows on
  localhost. It **cannot reach the native build** — `isLocalDevEnvironment()`
  in `src/lib/api.js:77` returns false for `capacitor://`, the fix made after
  it leaked into TestFlight build 1 — but it means today's frames are drafts.

All three land on the Xcode laptop, with the build.

### 13.5 Faces and workout photos (20 Oct)

The founder asked whether fake images are acceptable, and said the feed felt
dead without them. Both added, sandbox data only.

**Profile photos — reused, not sourced.** The four Unsplash portraits already
public on the marketing site (`src/components/ColdOnboarding.jsx:119-122`) are
used for Tariq, Hana, Noah and Eli. **No new image decision was made**, and
the site and the listing now show the same faces. All four were curl-checked
and return 200.

He was told once, and it is recorded here: those are photographs of real
people under the Unsplash licence, which permits commercial use but conveys
**no model release**. That risk already exists on joinfero.app; a store
listing is a more commercial setting. His call, and he kept them.

**Eli and Leo render initials, not photos.** They are the two members invented
for the demo, and the server rebuilds `profiles` from its own records, so a
photo written into the blob for an account that does not exist is dropped.
Left alone deliberately: a Bloc where two of five never uploaded a picture
reads more true than one where everybody did.

**Workout photos on the newest two days only.** Fero deletes workout photos
after 72 hours, so a feed full of them would show an app that does not exist.
19 and 20 October carry photos; everything older shows its activity icon,
which is the honest and the common case.

Every image was verified `200 image/jpeg` before being written. Photos are
matched to the workout type, with a per-type counter so two runs on screen are
never the same picture — the first pass had both runners using one photo.

**One image was rejected on review:** the first pilates photo was a cropped
body shot that could read badly in a store listing. Swapped for a stretching
image. Worth repeating at the real capture: look at every photo as a reviewer
would, not just as a designer.

### 13.6 Where the screenshots stand

| | |
| --- | --- |
| Month ring | **Hero shot**, agreed with the founder |
| Activity feed | Faces and workout photos, done |
| Leaderboard | Clean five-member spread, done |
| Profile | Done |
| Bloc Stream | **Blocked** — the sandbox has no Stream |
| Finished month | **Blocked** — the sandbox cannot close one |
| Final capture | **Blocked** — needs the build, to drop the test-identity bar |

The three blocked items all land on the Xcode laptop with build 12.

## 14. The TestFlight merge for build 12 — done, NOT pushed, NOT built (21 Oct)

The step that killed the 13-19 October plan, done at last. It was scheduled
for the same day as the Xcode build and assumed to need Xcode. **It does not.**

Branch `claude/testflight-build-12-2026-10-21`, cut from
`origin/testflight-build-11`, worktree at
`~/Developer/FERO/build-12-2026-10-21` — `~/Developer`, never `~/Documents`.

### 14.1 Zero conflicts, and why that is not suspicious

Build 10's merge threw **22**. This threw **none**. The reason: build 11 was
cut on 30 September from main's own lineage, and the native work lives in
files main never touches — `ios/`, `capacitor.config.ts`, `server/push.js`,
`pushNotifications.js`, `apiOrigin.js`, the push migrations. The two lineages
had nothing to argue about. Build 10 was merging build 9's older lineage,
which is where the 22 came from.

### 14.2 Verified rather than assumed

Merges have re-broken swipe and reactions twice, so the clean result was
tested, not trusted. **Every file the recurring-debugging playbook names is
byte-identical to `origin/main`:**

`src/lib/swipeRelease.js`, `src/pages/Nav.jsx`, `src/pages/TodayPage.jsx`,
`src/pages/BlocStream.jsx`, `src/pages/ActivityFeed.jsx`,
`src/lib/appState.js`, `src/lib/notificationCentre.js`,
`src/components/primitives.jsx`, `api/lift-log.js`.

The only shared files that differ from main are the native additions
themselves:

| File | Difference |
| --- | --- |
| `src/App.jsx` | **+13 lines**: a push-registration effect. Nothing else |
| `src/lib/api.js` | the native API origin, and revoking push on sign-out |
| `package.json` | the three Capacitor/push dependencies and two scripts |

**Nothing subtractive. No old UI came back.**

`ios/` intact at 24 files; `capacitor.config.ts` unchanged by checksum. Build
number **11 → 12**; `MARKETING_VERSION` left at 1.0, since that is the App
Store version, not the build.

### 14.3 One thing that caught me out

`npm run build` failed at first: `Rollup failed to resolve
"@capacitor/push-notifications"`. The cause is the house instruction to
**symlink `node_modules` from the shared folder** (§12) — the shared folder is
on `main`, whose `package.json` has no Capacitor. The symlink was removed
(**the link, after confirming it was a link, so the shared folder was never at
risk**) and the worktree given its own install.

**Worth adding to §12: a worktree on the TestFlight lineage cannot share
main's `node_modules`.** `package-lock.json` was unchanged by the install.

### 14.4 Verified

`npm run lint` clean. `npm run build` clean. **26 of 28 suites pass** — the
extra one is `test:push-foundation`, which only exists on this branch. The two
failures are `test:auth-edge-flows` and `test:mobile-navigation`, the known
pair that fails on `main` too.

`.env.local` is correctly ignored and was never staged.

### 14.5 Where it stops

**Committed at `b28e71d`, deliberately NOT pushed**, and **nothing has been
built in Xcode** — this is the merge only, and the founder asked to see what
changed before it goes anywhere near the app branch.

What remains for the Xcode laptop, now a short list:

1. Open, build, upload to TestFlight
2. Capture the Stream and the finished month, which the sandbox cannot show
3. Re-take the listing screenshots on the real build, without the test bar
4. Record the review video, run the final test matrix, submit

The risky half is done and is sitting on a branch.

## 5. Commits this session

| Commit | What | Live |
| --- | --- | --- |
| `817836c` | Open this handover, record the 18 October work in `WHATS-LIVE.md` and the index | Docs only |
| `03fd580` | Record the three notification-badge faults and the glimmer target. Findings only | Docs only |
| `e387b2c` | **Fault 6.1 fixed** — a reaction row is dated by the reaction, with seven tests | **On `main`, live** |
| `5bfd4f1` | The counts function and its wiring for faults 6.2 and 6.3 | **Live** |
| `2099e2c` | The migration applied to production and verified; the wrong comment corrected | **Live** |
| `affd9c6` | Close out the badge work | Docs only |
| `08b4793` | The mention glimmer moved onto the bubble | **Live** |
| `9d6681d` | Deveen's staging RLS task checked — not run; 6 production tables uncovered | Docs only |
| `409a8a2` | A second migration covering the six. **Not applied anywhere** | Not applied |
| `bf9d4e3` | The demo Bloc staged and four draft screenshots; the status bug narrowed | Docs only |
| `e606c53` | Faces and workout photos on the demo feed | Docs only |
| *(this one)* | Record the build-12 merge | Docs only |
| `b28e71d` | **The merge itself**, on `claude/testflight-build-12-2026-10-21` | **Not pushed, not built** |
