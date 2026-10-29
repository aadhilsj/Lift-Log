# 29 October — comment notifications: your own stop, threads start

Two changes the founder asked for, both **live at `46259d2`** and both applied
to the production database.

## Plain-English summary

**Before:** commenting on a workout raised your *own* Bloc Stream badge, and a
reply to you on somebody else's workout never reached "For you" at all.

**Now:** your own comment is not news to you, and a reply in any conversation
you have spoken in reaches "For you" — the way Slack treats a thread.

---

## 1. Your own comment no longer notifies you

### The cause

`insert_ante_core_workout_log_comment` writes a `log_comment` row into
`ante_core.bloc_messages` so the thread appears in the Stream. That row is a
**system moment: `author_profile_id` is null** — all 187 of them are. Both
unread rules count a message when

```
(author_profile_id is null or author_profile_id <> me)
```

so a null author counted for **everyone**, including whoever had just written
the comment that created the row.

### The fix

One clause, added to **both** `read_ante_core_bloc_stream_unread_count` and the
`streamUnread` half of `read_ante_core_notification_counts`, skipping a
`log_comment` row whose newest comment is the reader's own. The 19 October file
states those two rules are byte-for-byte identical so they cannot disagree;
that property is preserved.

There is exactly **one** such row per workout log — the insert deletes and
re-inserts by `idempotency_key` — so the row always represents the newest
comment. The rule therefore reads correctly in both directions:

- I comment → the row is mine → not unread for me, unread for them
- they reply → the row becomes theirs → unread for me again

### Why not set the row's author instead

That would have needed no change to either count function, and it was the first
idea. It was rejected on evidence: `BlocStream.jsx:705` filters the **whole
Stream** by author against the blocked list, and `:751` decides `mine` from it.
Setting the author would have silently hidden an entire thread from anyone who
had blocked its most recent commenter, and changed which rows offer a report
action. Neither was asked for.

### Proved before applying

For the founder in one Bloc, counting from "never read": **87 under the old
rule, 59 under the new** — a difference of exactly **28**, matching the 28
`log_comment` rows where he is the latest commenter.

---

## 2. A reply in a thread you are in reaches "For you"

### The cause

`logComments` counted comments by others on logs **you own**, and the rows
themselves are built in the client from `group.logs[currentUser]`
(`notificationCentre.js`, `ownLogItems`) — your own workouts only. A reply to
you on somebody else's workout reached the Bloc Stream and nowhere else.

### The change

- **`logComments`** now counts a comment by someone else when the log is yours
  **or** you have commented on it. One count over comments, so a log you own
  *and* replied on is counted once. Your own comments are still excluded and
  both moderation filters are unchanged.
- **`read_ante_core_workout_log_threads`** — new. Returns the threads you are
  in but do **not** own, keyed by log id, carrying the newest comment that is
  not yours, how many such comments there are, and the log's own display
  fields, so a thread on a past month still renders after `group.logs` has
  rolled over.
- **`log-threads`** — new API action, fetched when the centre opens, beside the
  existing comments call. Not on the per-refresh path, which
  `scaling-before-launch-2026-09-15.md` requires stays light.
- **The tap** now looks across every member's logs, not only your own, so a
  thread row opens the right conversation. Own-log rows are unaffected.

`read_ante_core_workout_log_latest_comments` was deliberately **not** touched.

### What it found

For the founder, with `p_since` null: `logComments` went **5 → 39** in one Bloc
and **3 → 25** in another. **69 conversations** he was part of and had never
been told about.

---

## 3. How it was verified

| Check | Result |
| --- | --- |
| `npm run lint` | clean |
| `npm run build` | clean |
| `test:notification-badge`, `test:stream-moments`, `test:activities`, `test:two-workouts`, `test:fero-profile-stats`, `test:identity`, `test:content-safety` | all pass |
| 13 checks on the new row builder | all pass — wording, owner-replying wording, collapsing to one row, zero totals, five-week expiry, and the bell before and after opening |
| `log-threads` in the sandbox | `{"ok":true,"threads":{}}`, HTTP 200 |
| Notification centre opened in the browser at 375×812 | renders, **no console errors** |
| Production after both migrations | `ante_core` tables without RLS still **0**; `anon`/`authenticated` cannot execute either function |
| Live bundle `index-DmZNcxQO.js` | carries `log-threads` and the new row wording |

**Not verified:** the rows on a real phone, and the wording against a real
thread with several repliers. The sandbox answers every canonical RPC with
`[]`, so thread rows cannot be seen there.

## 4. Deliberately not changed

- **`system` moments still raise your own badge.** The other 165 null-author
  rows — a workout logged, a month closed — have exactly the same shape as the
  bug fixed above, so logging a workout still lights your own Stream badge. The
  founder asked about comments specifically. **Worth raising separately.**
- `read_ante_core_workout_log_latest_comments`, left byte-identical.

## 5. One environment repair

`npm run build` failed before any of this, on `main` with no changes:
`@supabase/supabase-js` was installed but its dependency
`@supabase/functions-js` was missing from `node_modules`. Confirmed
pre-existing by stashing and rebuilding. `npm install` restored it;
`package.json` and `package-lock.json` are **unchanged**.

## 6. Rollback

```sql
drop function public.read_ante_core_workout_log_threads(text, text);
```
then re-run `20261029120000`, which carries the previous counts function. The
client change is inert without the function — `log-threads` returns `{}` and no
thread rows are built.

## 7. Commits

| What | Commit | Live? |
| --- | --- | --- |
| Both fixes, client and database | `46259d2` | **yes** |
