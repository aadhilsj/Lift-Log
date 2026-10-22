# Notification timing audit — 22 October 2026

The founder asked for a hunt across three things: when notifications appear in
"For you", lag as the cards draw after tapping the bell, and anything wrong
with the Bloc Stream's unread icon.

**Five findings. Read-only — nothing changed.** Two are certain and visible on
every open; three are races that need the timing to line up.

Ordered by how often a member would see them.

---

## 1. A comment card can appear and then vanish — CERTAIN

`src/lib/notificationCentre.js`, the comment branch of `ownLogItems`:

```js
const comments = latestCommentsLoaded
  ? Number(latest?.total || 0)        // after the fetch: OTHER people's comments
  : Number(log?.commentCount || 0);   // before it: the blob's count, which
                                      // INCLUDES your own
if (comments > 0) { ...push a row... }
```

The panel opens on what the client already knows, then
`read_ante_core_workout_log_latest_comments` fills in behind it
(`handleOpenNotifications`, `src/App.jsx`).

So for a log whose only comments are **your own**, the count before the fetch
is 1 and the row is drawn; after the fetch it is 0 and the row is **removed**.

**A card appears, then deletes itself a few hundred milliseconds later.**

This is the collision of two good decisions — 16 October's "your own comments
are not news to you", and opening the panel instantly instead of waiting —
neither of which is wrong alone.

## 2. Mention rows pop in and shove the list — CERTAIN

`notificationStreamMessages` starts as `[]` (`src/App.jsx`) and is only filled
by `listBlocStreamMessagesData` **after** the panel is open. So mention rows
do not exist at the moment of opening and are **inserted** when the call
returns.

Worse than an insert: rows are sorted by `when`, and sections are Today / This
week / Earlier. A mention landing in the middle **re-sorts and re-sections the
list under the finger**. Anything the member was reaching for moves.

Comment rows change too — "2 comments on your Gym Log" becomes "Sam and 1
other commented…" with a quoted line — so the row's height can change as well
as its text.

**There is no loading state.** `src/components/NotificationCentre.jsx` has no
skeleton and no "filling in" state; it renders whatever `items` holds and
re-renders as data lands. Rows are keyed by id, so React inserts and removes
them in place rather than redrawing the list as a unit.

## 3. The bell can re-light moments after you clear it — RACE

`refreshStreamUnreadCount` (`src/App.jsx`) has **no staleness guard of any
kind**: no sequence number, no abort, and no check that the world is still
what it was when the request went out.

```js
const result = await getBlocStreamUnreadCountData(groupId, notificationsSeenAtRef.current);
if (result?.ok) {
  setStreamUnreadCount(result.unreadCount);
  setNotificationServerCounts({mentions:result.mentionCount, logComments:result.logCommentCount});
}
```

So:

1. A refresh goes out carrying the **old** `since`.
2. The member taps the bell. `handleOpenNotifications` sets `seenAt` to now and
   clears the server counts — the badge goes out.
3. The in-flight response lands and sets those counts **back to their
   pre-open values**.

**The badge returns a moment after being cleared**, and stays until the next
refresh. The effect fires on every `appState.meta.revision` change, so the
window is open whenever anything has just been written.

## 4. Switching Bloc can show another Bloc's number — RACE

Same missing guard. `refreshStreamUnreadCount(groupId = selectedGroupId)`
captures the Bloc at call time, but the response sets state **unconditionally**
— it never re-checks that the member is still in that Bloc.

Switch Bloc and a second request goes out while the first is in flight.
Whichever lands **last** wins, not whichever is **newest**. The bell and the
Stream icon can show the previous Bloc's count.

**This matters more since 22 October**, when the founder confirmed the centre
is deliberately per-Bloc: switching Bloc is now the normal way to see the rest
of your notifications, so it is a path members will use constantly.

The same hole lets two overlapping refreshes resolve out of order and leave an
older number on screen.

## 5. The Stream badge can come back after you leave the Stream — RACE

`src/pages/BlocStream.jsx` marks the Stream read **after** messages load, and
does not wait for it:

```js
markBlocStreamReadData(requestBlocId)
  .then(result => { if (result?.ok) onUnreadCountChange?.(requestBlocId, 0); })
```

Closing the Stream calls `refreshStreamUnreadCount(currentGroup.id)`
(`onClose`, `src/App.jsx`). If the read marker has not committed yet, the
server still counts those messages unread and **the badge comes back**.

Also: if the member opens the Stream and leaves before the messages load, the
read is never marked at all. Arguably right — they did not see them — but it
reads as a stuck badge.

---

## What would fix them

| | Fix | Size |
| --- | --- | --- |
| 3, 4, 5 | One request-sequence guard in `refreshStreamUnreadCount`: keep a counter, ignore any response that is not the newest, and drop a response whose `groupId` is no longer selected. Await the read marker before the post-close refresh | Small, contained |
| 1 | Do not draw a comment row until `latestCommentsLoaded`, **or** subtract your own comments from the blob count up front so the first paint matches the second | Small |
| 2 | Fetch the mentions and comment text **before** showing the panel, with a brief skeleton, instead of opening instantly onto a list that then rearranges | A judgement call — it trades instant-open for stable |

1, 3, 4 and 5 are straightforward corrections. **2 is a product decision**: the
instant open was deliberate, and the cost of it is the list moving.

**Nothing was changed. Read-only audit.**
