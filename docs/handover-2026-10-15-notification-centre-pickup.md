# Handover — 15 October 2026: the notification centre, ready to pick up

**Status: OPEN — written so another session can do the work.** Claude,
operating. No code was changed. This is an inventory of what already exists, a
recommendation for how to land it, and the one decision that has to be made
first.

Previous sessions today: `handover-2026-10-13-session-catch-up.md` (the profile
header, closed) and `handover-2026-10-15-month-ring-displaced-page.md` (closed).

---

## 1. Why this exists

The founder asked whether the notification centre still has to be finished. The
first answer given was **wrong** and is corrected here: it was reported as "not
built", because `main` and the concept doc were checked but **the branches were
not**. The founder pushed back — *"isn't there a branch"* — and there is.

**The lesson, for whoever picks this up: before saying something is not built,
list the remote branches.** `git branch -r` takes a second and this cost a
wrong answer.

## 2. What exists, exactly

### `origin/feat/settlement-note` — the implementation

One WIP commit, `5a59d6e`, 1 October 2026: *"WIP: preserve settlement note and
notification work"*. **690 insertions over 11 files.**

| File | Lines | New? | What it is |
| --- | --- | --- | --- |
| `src/lib/notificationCentre.js` | 184 | **new** | Builds the list, and the unread count |
| `src/components/NotificationCentre.jsx` | 125 | **new** | The panel itself, portalled to `document.body` |
| `src/components/SettlementNotePrompt.jsx` | 58 | **new** | The "say what the money's going toward" prompt |
| `src/lib/settlementNotePreview.js` | 51 | **new** | Note preview helper |
| `src/App.jsx` | 52 | wiring | State, `buildNotifications`, open/close |
| `src/pages/TodayPage.jsx` | 95 | wiring | Settlement-note surface |
| `src/pages/SettlementScreen.jsx` | 50 | wiring | |
| `src/pages/ActivityFeed.jsx` | 31 | wiring | |
| `src/components/MonthLoop.jsx` | 27 | wiring | |
| `src/pages/Nav.jsx` | 25 | wiring | The bell, with its unread badge |
| `src/pages/ActivityPage.jsx` | 4 | wiring | |

**No tests.** Nothing in `scripts/` or `package.json` covers any of it.

### `origin/claude/push-notifications-plan-2026-09-30` — documentation only

132 lines, one file:
`docs/push-notifications-order-of-operations-2026-09-30.md`. No code. It is
about real push (APNs), which is a separate thing from this in-app centre.

## 3. What it does today — seen running, not read off the code

Built and run in a throwaway worktree off that branch, in the sandbox at
393x852. It works. Two screenshots went to the founder.

It is called **"For you"**, opened by a bell in the header that carries an
unread badge, and it has two sections:

- **NEEDS YOU** — the pinned, actionable rows. "Say what the money's going
  toward", one per month that is settling up, each with a **Do this** button.
  This is the founder's settlement-note prompt, in the place he asked for it.
- **EARLIER** — "Sam still owes you £10 · Aug '26", and so on.

Sorting is pinned-first, then newest-first (`buildNotifications`, end of
`notificationCentre.js`).

### What it cannot do, in the author's own words

From the top of `src/lib/notificationCentre.js`, verbatim:

> NOT covered yet, because the client does not hold the data:
>   - who commented (logs carry commentCount, not the comments themselves)
>   - @mentions in the Bloc Stream or in a comment thread
> Both need the stream/comments API and are the real work in shipping this.

So of the six row types in the concept, **three are built** (reactions on your
own logs, money, the note prompt) and **three are not** (who commented,
mentions in the Stream, mentions in a comment thread).

### How "seen" works, and why it is not enough

`src/App.jsx` on that branch:

```js
localStorage.getItem("fero_notifications_seen_v1")
```

"Seen" is **the last time the centre was opened, stored in the browser**. That
means: it does not follow a member between devices, it resets when site data is
cleared, and it is not per-user on the server. Pinned rows always count as
unread regardless (`unreadCount`, `notificationCentre.js`).

**There is still no per-user read state anywhere in Fero.** That remains the
real design question, and it is database work.

## 4. Three things observed while running it

1. **The header around it is two weeks stale.** The branch's Nav is the
   30 September layout — FERO wordmark, bell beside the Stream and settings
   buttons. `main` today has the Bloc name plus three buttons, and since
   `abc568f` **the Bloc name turns into a back chevron while a member's profile
   is open**. Where the bell lives has to be decided against today's header, not
   ported across.
2. **No reaction rows appeared**, because the practice data has no reactions on
   the signed-in member's logs. That half of the feature is **unproven, not
   broken**. Seed reactions before judging it.
3. **Two rows read identically** — "Sam still owes you £10 · Aug '26" twice.
   Could be two genuine debts in the practice data, could be a missing dedupe.
   **Check before shipping.**

## 5. The recommendation: port, do not rebase

`origin/feat/settlement-note` is **207 commits behind `origin/main`**, and it
touches the files that have moved most:

| File it changes | Commits on `main` since the merge base |
| --- | --- |
| `src/App.jsx` | 34 |
| `src/pages/Nav.jsx` | 11 |
| `src/pages/ActivityFeed.jsx` | 7 |
| `src/pages/SettlementScreen.jsx` | 6 |
| `src/pages/TodayPage.jsx` | 5 |
| `src/components/MonthLoop.jsx` | 0 |

It predates the Profile tab, blocking and reporting, press-and-hold, the
profile header card and the page-track scroll fix.

**But four of the files are brand new**, so they carry no conflict at all. Take
those across whole and **rewrite the wiring by hand** against today's `App.jsx`
and `Nav.jsx`. That is how the profile header was landed on 15 October and it
worked cleanly; a 207-commit rebase through `App.jsx` and `Nav.jsx` is exactly
the shape of merge that the playbook records breaking swipe and reactions.

## 6. The decision that has to be made first

**Does v1 need "who commented"?**

- **No** → it is a port, a header decision and a dedupe check. Days.
- **Yes** → it needs the comments API to return authors, and mentions need the
  stream API. Weeks, and some of it is Deveen's.

The concept doc already leaves the door open: *"a purely static list that you
only read would also be acceptable for a first version."*
(`docs/concept-2026-09-24-notification-centre.md`.)

**The founder has not answered this.** It was the one question put to him when
this session ended.

## 7. A separate matter: the bell and the App Store

`main` today ships a bell that opens a dialog saying **"Notifications are
coming soon."** Apple rejects placeholder UI often enough that this is a real
submission risk on its own.

Two ways out, and they do not depend on each other:

1. Ship the notification centre, so the bell does something.
2. **Hide the bell in the native build** with a runtime gate — the
   `Capacitor.isNativePlatform()` pattern `src/lib/haptics.js` already uses —
   so the website keeps it and the App Store build never shows it.

If the centre is not going to be ready before submission, do (2). It is an
hour's work and it is independent of everything above.

## 8. How to pick this up

```bash
# see it running, exactly as this session did
cd "/Users/opera_user/Documents/Codex Space/Lift Log"
git worktree add --detach /Users/opera_user/Developer/FERO/notif-view origin/feat/settlement-note
ln -s "/Users/opera_user/Documents/Codex Space/Lift Log/node_modules" /Users/opera_user/Developer/FERO/notif-view/node_modules
cp "/Users/opera_user/Documents/Codex Space/Lift Log/.env.local" /Users/opera_user/Developer/FERO/notif-view/.env.local
cd /Users/opera_user/Developer/FERO/notif-view && npm run build && npm run sandbox
```

Then sign in at `http://localhost:3000` with any `@local.test` address, code
`000000`, and tap the bell (its accessible name is **"For you"**, not
"Notifications" — `find` will not match on "Notifications").

The practice blob this session used is at
`/tmp/claude-501/blob-for-build.json`; copy it to `.sandbox-data/blob.json`
before starting, because `npm run sandbox:seed` still cannot close a month.

**Read first:**
- `docs/concept-2026-09-24-notification-centre.md` — the founder's own spec,
  including which rows must be pinned and what tapping a row should do
- `docs/concept-2026-09-23-settlement-notes-and-the-chooser.md` — the note
  prompt this centre is the home for
- `docs/push-notifications-order-of-operations-2026-09-30.md` (on
  `origin/claude/push-notifications-plan-2026-09-30`) — only if real push comes
  into scope

## 9. State at close

- **Nothing was changed, committed or pushed** except this handover.
- The throwaway worktree at `~/Developer/FERO/notif-view` was removed, the
  sandbox stopped by PID, and the browser viewport reset.
- `origin/feat/settlement-note` is untouched and still holds the work.
