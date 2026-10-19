# Handover — 15–16 October 2026 (session 3): catch-up, then the notification centre

**Status: CLOSED.** Corrected 19 October: the one item this close-out left
open — the most-recent-emoji badge — shipped on 16 October. Everything the
founder raised about "For you" between 15 and 16 October is live. Claude, operating. **This is a live handover: it is updated as
the session goes, not written at the end.** The newest entry in §2 is the most
recent thing that happened.

Where this disagrees with an older dated handover, this wins. Where it
disagrees with `docs/WHATS-LIVE.md`, that file wins.

Previous sessions today:
`handover-2026-10-15-notification-centre-pickup.md` (**open**, written to be
picked up) and `handover-2026-10-15-month-ring-displaced-page.md` (closed).

---

## 1. Where things stood at the start

Checked, nothing touched.

- **Live website: `4f05c7e`** (last app-code commit `ebf9de5`). Production
  deployment `7092955609` for `4f05c7e` reports **success**; the live bundle is
  `index-BjQfpxxM.js` and contains both the page-track scroll guard
  (`scrollLeft`) and `profileBack`, so the app code live is `ebf9de5` as
  recorded.
- **A note on the bundle hash.** `WHATS-LIVE.md` recorded `index-DIhYQ_rD.js`
  for `ebf9de5`; live now serves `index-BjQfpxxM.js` after the two docs-only
  commits were deployed. Same app code by content check — the hash moved, the
  behaviour did not.
- CI **green** on the last five runs on `main`. **No open pull requests.**
- **TestFlight is still build 10.** None of October is on the phone app.
- **The shared checkout at `~/Documents/Codex Space/Lift Log` is 51 commits
  behind `origin/main`.** Everything here was read from `origin/main`.
- **Nothing is running** — ports 3000, 5173 and 54321 are free, no sandbox, no
  Docker.
- **Worktrees:** the shared folder (`main`, 51 behind),
  `~/Developer/FERO/blocking-2026-10-11` (on `claude/close-out-2026-10-13`),
  and the two August ones in `~/Documents` (`Lift Log Extraction`,
  `Lift Log iOS Preview`). This session added
  `~/Developer/FERO/catch-up-2026-10-15` on `claude/catch-up-2026-10-15`.
- Untracked in the shared folder, deliberately left alone: the four August
  backup disk images.
- ~20 stale local branches, most of them behind `origin/main`.

## 2. What happened, in order

### 2.1 Catch-up performed, this handover opened

Read `docs/HANDOVERS.md` §1, `docs/WHATS-LIVE.md`, the three 15 October
handovers, the 13–15 October catch-up, the 11–13 October session 2, the
11 October pickup verification, the 9 October catch-up, Deveen's active
handover including §20 (scaling), and the headings of
`recurring-debugging-playbook.md` and `solved-issues-log.md`. Checked the
workspace against `origin/main`, branches, worktrees, GitHub CI, open PRs, the
Vercel deployments and the live bundle.

Nothing was changed, built or deployed. No SQL was run. This handover and its
line in `docs/HANDOVERS.md` are the only change.

### 2.2 The notification centre ported, and the bell made real — `711e9fb`

The founder said yes to shipping a first version without "who commented".

**Where it came from.** `origin/feat/settlement-note` (`5a59d6e`, 1 October),
207 commits behind `main`. The two new files came across whole and the wiring
was **rewritten by hand** against today's `App.jsx` and `Nav.jsx`, as the
previous handover recommended — not rebased.

**The port turned out smaller than that handover expected.** It said the bell
"has to be decided against today's header". It does not: `main` already ships a
bell at 42px wired to `onOpenNotifications`, added when the placeholder was
built. Only the destination and a badge are new. Size, icon and position are
untouched, and the badge is absolutely positioned, so it claims no layout —
measured: the button is still 42x42, the button row still 42px tall, and there
is no horizontal scroll at 393px.

**What it shows:** reactions on your own workouts, comments on them, and money
you owe or are owed. All derived from state the client already holds; nothing
is fetched and nothing is written.

#### Left out deliberately, and why

**The "say what the money's going toward" prompt** — the pinned **Do this** row
in the screenshots the previous session sent. `src/lib/settlementNotePreview.js`
on that branch says so in its own header: it stores the note in
**`localStorage` only**. It never reaches the API, the blob or canonical, so a
note one person writes is never seen by anyone else — while the row's copy says
*"Your Bloc will see it."* Shipping that would put a promise in front of members
that the code cannot keep. It needs a real save first. **This is the one thing
the founder saw on screen that is not in this build**, and it is his call to
put back.

Also absent, because the client does not hold the data: **who** commented (logs
carry a count, not the authors) and **@mentions**. Comment rows still appear —
"2 comments on your Gym Log" — they just cannot name anybody.

#### The two things the previous session flagged

1. **The duplicate row** — "Sam still owes you £10 · Aug '26" appearing twice.
   The card builder keys on `monthKey:payer:receiver`, which is unique, so a
   repeat can only come from the same month appearing twice in `monthHistory`.
   A dedupe on that key is in, and proven with a fixture that feeds the same
   card twice.
2. **Reaction rows were unproven** — they are now proven, driven through the
   real API: Jo and Sam reacted to Riley's workout and Jo commented, and the
   row read "Jo and Sam reacted to your Other Log".

#### One thing caught before it shipped

Wiring `trackUsage` into the open handler put `handleOpenNotifications` **above**
`trackUsage`'s own declaration, with `trackUsage` in its dependency array — read
at render time, so every render would have thrown on the temporal dead zone.
A blank screen, from the same family as the ones in §3 of `AGENTS.md`. The
declaration was moved up. Caught by reading the result of the edit, not by lint.

#### How it was verified

Lint and build clean. **24 of 26 suites pass** — the two failures are
`test:auth-edge-flows` and `test:mobile-navigation`, which fail on `main` too.

A fixture check of the builder, independent of the sandbox: the duplicate debt
collapses, somebody else's debt is excluded, your own reaction on your own log
does not count, a comment row appears with no reaction on it, what **you** owe
sorts first as pinned, and the badge falls from 5 to 1 once opened — the 1
being the pinned debt, which always counts.

Then in the sandbox at **393x852**, signed in as Riley:

| Checked | Result |
| --- | --- |
| The badge | **3** on the bell, teal, clear of the Stream and settings buttons |
| The panel | centred, portalled to `document.body`, titled "For you" |
| All three row types | reaction, comment and money all rendered |
| Tapping a reaction row | centre closes, Activity opens, the workout is on screen |
| The glow | measured on the right card: the teal ring is in its computed `box-shadow` |
| The page track afterwards | active page at **x0**, `scrollLeft` 0 — `ebf9de5`'s guard holds |
| Console | no errors |
| Badge after opening | cleared to none, as designed |
| Pinned counting | as Sam, who owes, the badge read **1** with "seen" already set — so it was the pinned row |

**Not seen on screen: the "Needs you" heading itself.** Its one condition
(`pinned.length > 0`) was exercised by the fixture check and the badge count,
but the sandbox's "Your first month" modal kept intercepting the bell for the
member who owes, and the practice data that caused it was my own. Worth a look
on the first real screen.

**Also unseen: comment rows against a real backend.** The sandbox answers every
canonical RPC with `[]`, so `commentCount` stays 0 there; the count was written
into the practice blob to see the row. In production that field is filled from
canonical (`api/lift-log.js`, the `comment_count` mapping), so this should work
— but it has not been watched doing it.

#### One loose end, not touched

`src/pages/NotificationsPage.jsx` — the old "coming soon" placeholder — is now
imported by nothing. It was left in place rather than deleted, since removing it
was not asked for. One line to delete whenever.

### 2.3 Live at `a6d7bab` (16 October)

The founder said `main`. Pre-flight: `git fetch`, `origin/main` confirmed an
ancestor (it had not moved), lint and build clean. Pushed
`4f05c7e..a6d7bab` with `--force-with-lease`.

**Verified three ways:** the commit is on `main`; the Vercel Production
deployment `7108411190` for that exact commit reports **success**; the live
bundle `index-CGGcHe4P.js` contains "For you", "Needs you", "Nothing for you
right now", `fero_notifications_seen_v1` and `notifications_opened`, and **no
longer contains "Notifications are coming soon"**. CI green on `a6d7bab`.
`joinfero.app` answers, and the live site loads with **no console errors**.

**Website only.** TestFlight is still build 10.

**Not seen against live data or on a real iPhone.** It was driven end to end in
the sandbox, but nobody has opened the bell on the live site yet.

### 2.4 Three questions from the founder, answered against the code

Asked straight after the push. Checked in `src/App.jsx` and `api/lift-log.js`
rather than answered from memory.

| His question | The answer |
| --- | --- |
| Tapping a **reaction** row — does it go to that workout on the feed, and shimmer? | **Yes.** Exactly that, and it was measured: the teal ring is in the card's computed `box-shadow`, and it fades after 1.8s. |
| Tapping a **comment** row — does it open that comment? | **No.** It lands on the workout in the feed, same as a reaction row. `handleNotificationAct` treats `opens: "comments"` identically to `"activity"`. **This is a gap, not a decision**, and he has asked for it. |
| Should it say **who** commented, and tell him about **@mentions**? | Yes, and both are **more reachable than the earlier note suggested** — see below. |

**A correction to §2.2 and to what was said in chat.** Both were described as
needing backend work that does not exist. That is wrong, and the branch
author's own note ("the client does not hold the data") is true but was read
too broadly — the client does not *hold* it, but it can *ask* for it:

- `log-comments-list` already returns a log's comments for a Bloc member, so
  **who commented** is reachable from the client today. The real cost is how
  many calls it takes to cover your own logs, which runs straight into the
  scaling work in §20 of Deveen's handover — every refresh already reads too
  much. It wants batching, not a naive call per log.
- Stream **@mentions are already stored id-keyed on the message**
  (`src/pages/BlocStream.jsx`), and `stream-list` serves them, so "you were
  tagged" is derivable without new schema.

Neither is a one-liner, and both were **left alone** rather than started
unasked. The comment-row destination is the smallest of the three and the one
he asked for first.

### 2.5 Full screen, and a stuck scroll that was mine — `ba54e87`

Two things the founder found on the live site within minutes of it shipping.

#### It is a full screen now

His words: it "should be a full screen thing", not a modal. It was a centred
card capped at `min(80vh, 640px)` with the Bloc showing around it. It now fills
the viewport: same background as the in-Bloc shell so the screen does not
change colour under it, `env(safe-area-inset-top/bottom)` for the notch and the
home indicator, a 19px title, and a **44px** close target with the glyph still
at 18.

Measured at **393x852** and at **375x667** (iPhone SE): the panel is exactly
393x852 and 375x667 at x0 y0 — the playbook's "cover the exact viewport" check
— still portalled to `document.body`, and no horizontal scroll at either width.

#### The stuck scroll — the `ebf9de5` bug a second time

**This one was mine, shipped in `a6d7bab`.** After opening the centre and
tapping a row, **every** tab — Today, Activity and Month — opened about 62px
below its own top and would not scroll back up. It read as "I can't scroll all
the way to the top".

`scrollIntoView` walks up the tree and scrolls **every** scrollable ancestor.
The in-Bloc shell (`#root > div`, `height:100dvh; overflow:hidden`) is
**still programmatically scrollable** — exactly the trap that
`handover-2026-10-15-month-ring-displaced-page.md` recorded for the horizontal
axis yesterday. It ended at `scrollTop` 62 and nothing put it back, so the Bloc
header sat off the top of the screen until the app was reloaded. It persisted
across tabs because that shell wraps all four in-Bloc pages.

`ebf9de5`'s guard did not catch it: that guard is on the **page track**, and
this is the track's **parent**.

**The fix:** the feed scrolls its own `[data-page-scroll-container]` by hand —
target computed from the two bounding boxes, clamped to
`[0, scrollHeight - clientHeight]` — and touches nothing above it.

**Reproduced and proven, same build, with and without the fix**, using a feed
of 43 logs and a reaction on a workout at the far end of it:

| | Before | After |
| --- | --- | --- |
| Page container `scrollTop` | 3413 | 3413 — unchanged, the workout is on screen |
| **In-Bloc shell `scrollTop`** | **62** | **0** |
| Hidden-overflow elements left scrolled | 1 | **0** |
| Bloc header's top edge, all three tabs | off screen | **y0** |

**Why the first pass missed it.** The check after the first build looked at
`scrollLeft` on the track's ancestors — the horizontal axis the playbook had
just been updated for — and at a sandbox whose feed held **one** log, so
nothing needed scrolling in either axis. A one-log feed cannot show this bug.

#### Worth deciding, not done

The in-Bloc shell has **no guard of its own**. This fix removes the cause here,
but any focus or programmatic scroll inside it can displace it the same way,
and that is true on `main` today independently of this feature — the same
reasoning that made `ebf9de5` fix the track rather than the Month ring. Adding
a guard to the shell is a change to shared layout that was not asked for, so it
is **flagged, not made**.

Lint and build clean. **24 of 26 suites pass** — the same two that fail on
`main`. No console errors from this build (the ones in the buffer cite the
previous bundle, from the restart).

### 2.6 The background was shading, and the comment on it was wrong — `3eeefbf`

The founder looked at the full-screen panel and said the background shade
changes, and should be even. **He was right.**

The line said it matched the in-Bloc shell. **It did not.** It was the Bloc
Stream sheet's background, lifted along with the rest of the panel:

| | Glow centred at | Alpha | Reads as |
| --- | --- | --- | --- |
| Bloc Stream (what was used) | **50% 16%** — inside the screen | 0.13 | a bright band across the top, fading to `#05090a` |
| The app's `--bg-radial-hint` | **60% -10%** — above the screen | 0.105 | only the soft lower edge, an even wash |

On a 92dvh sheet the Stream's glow sits at the very top edge and works as a
light source. On a **full** screen the same gradient puts its brightest point a
sixth of the way down, inside the picture, which is exactly what he saw.

Now `backgroundColor: var(--bg-primary)` with
`backgroundImage: var(--bg-radial-hint), var(--bg-gradient)` — the app's own
two layers.

**Verified by reading both computed styles side by side**, not by eye: the
panel and the in-Bloc shell report the same `background-color`
(`rgb(7, 12, 12)`) and the same `background-image`, character for character.

**The lesson worth keeping:** a background copied from a sheet does not
transfer to a full screen. The gradient is positioned relative to the box it
paints, and the box changed size. And a comment asserting something matches is
not evidence that it does — this one was wrong for a whole commit.

### 2.7 Live at `5f86d45` (16 October)

Pushed `370a523..5f86d45` with `--force-with-lease` after `git fetch` confirmed
`origin/main` an ancestor and had not moved. Lint and build clean.

**Verified three ways:** the commit is on `main`; Production deployment
`7108771686` for that exact commit reports **success**; the live bundle
`index-DD4tOGBK.js` contains `bg-radial-hint` and the page-container scroll,
and contains **no `scrollIntoView`** anywhere. CI green. The live site loads
with **no console errors**.

Website only — TestFlight is still build 10.

---

## Close-out

**What is live**, all on the website at `5f86d45`:

- The bell opens **"For you"** — a full screen listing reactions on your own
  workouts, comments on them, and money you owe or are owed, with an unread
  count on the bell. Tapping a row opens that workout in the Activity feed,
  scrolled to it and briefly glowing.
- The "Notifications are coming soon" placeholder is **gone**.
- The panel paints the app's own background, identical to every other screen.
- The stuck-scroll bug that shipped in `a6d7bab` is fixed.

**What is open** — the three things the founder asked for, in his order:

1. **A comment row should open the comment thread**, not just the workout.
   A task has been proposed for it; `handleOpenLogComments` in `App.jsx`
   already does the work.
2. **Say who commented** — reachable via `log-comments-list`, but it must be
   batched (§20 of Deveen's handover). This would also give comment rows a
   face, which they do not have today.
   **2b. The badge as the most recent emoji** (§2.8) — needs
   `read_ante_core_current_logs` to return a per-emoji latest `created_at`.
3. **Tell him when he is tagged in the Bloc Stream** — mentions are already
   stored id-keyed on the message and served by `stream-list`.

Plus: the settlement-note prompt, once the note has a real save; and the
**in-Bloc shell has no scroll guard** of its own (§2.5), which is true on
`main` regardless of this feature and was deliberately left alone.

**Not verified:** nobody has opened the bell on the live site or on a real
iPhone. The "Needs you" heading was seen in the sandbox; comment rows have
never been seen against a real backend, because the sandbox stubs canonical.

**State of this laptop at close:** sandbox stopped by PID (ports 3000 and 54321
free), browser viewport reset, the worktree at
`~/Developer/FERO/catch-up-2026-10-15` clean on `claude/catch-up-2026-10-15`
(level with `origin/main`). The shared checkout at `~/Documents/Codex Space/
Lift Log` was never written to and is still behind `origin/main`.

### 2.8 For you redesigned from the founder's review — `cb7f4fb`

He looked at the live screen and said it reads as "just a list of emojis and
text", which it did: nearly every row says *somebody reacted to your log*, so
nothing separated one row from the next. He asked for Instagram's and Strava's
notification screens to be looked at, for older and newer to be separated, and
asked whether the thumbnail should be the workout photo with the emoji moved to
the other side.

**What the research actually settled.** Instagram's and Strava's own screens
are behind logins and no teardown with real layouts could be found, so the
pattern came from design-system sources rather than from their screens, and
that is stated rather than dressed up. The useful parts: a leading avatar or
icon should encode who or what before any text is read; bundling repeats into
one row is the highest-impact fix for a noisy feed (Fero already bundles per
log); and date sections — Today, Yesterday, This week — are the standard way to
order a long list.

**The finding that decided the thumbnail question.** Workout photos are
**deleted after 72 hours** (`UNFLAGGED_IMAGE_RETENTION_MS`, `shouldKeepLogPhoto`
in `appState.js`; 24 hours after a flag is resolved), and logs in past months
are stripped of `photoUrl` entirely. A notification outlives its photo, so a
photo-led row would be empty for most rows. The always-present thing is **who
did it** — `Avatar` falls back to a coloured initial and never renders nothing.

So, as the founder chose after seeing three variants:

- the member's **face leads**, badged with the emoji they used;
- two faces overlap when more than one person reacted — **and the badge stays**,
  which was his correction to the first mockup;
- the **right-hand square** is the photo while it exists, the activity icon
  once it does not;
- **comment rows have no face**, because the client holds the count and not the
  authors; they lead with a comment mark rather than inventing someone;
- **Today / This week / Earlier** sections.

### The money heading, exactly as he specified it

| What is in the section | Heading |
| --- | --- |
| Only money you owe | **Needs you** |
| Only money owed to you | **Settling up** |
| Both | **Settling up**, one section |

What you owe sorts first either way and keeps the warmer colour with a **Pay**
chip; being owed is quieter and green with an **Owed** chip.

**One judgement call, stated because he did not ask for it.** Both directions
are pinned to the top, but only money **you owe** keeps the bell lit. Being
owed is not something you can act on, and a badge that can never be cleared is
nagging. `unreadCount` now keys off `alwaysUnread` rather than `pinned`.

### "The most recent emoji" — asked for, and not possible today

He asked for the badge to be the most recently used emoji. It cannot be, yet,
and this is the evidence rather than a guess:

- `ante_core.workout_reactions` **does** carry `created_at` (`docs/SCHEMA.md`).
- But `read_ante_core_current_logs` — read from production with
  `pg_get_functiondef` — returns
  `jsonb_object_agg(emoji, jsonb_agg(reactor_display_name order by created_at))`.
  Names are ordered within an emoji; **the timestamps are not returned**, and
  `jsonb` sorts object keys, so there is no way to tell which emoji came last.

The badge is therefore the emoji **the most people chose**. Making it the
newest means that function returning a per-emoji latest `created_at`, plus
carrying it through `api/lift-log.js` and the blob. Small, but it is a schema
read-path change and it belongs with the scaling work, not bolted on.

### One bug found and fixed while building

A row could read **"today"** while sitting under **"This week"**: `shortWhen`
measured age as a rolling 24 hours while the new section used the calendar day.
Both now come from one `daysAgo` helper, so the words and the section cannot
disagree. Seen on screen before it was fixed.

### How it was verified

Lint and build clean. **24 of 26 suites pass** — the same two that fail on
`main`. A fixture check covers the heading rule in all four states, the sort
order, the badge surviving a multi-reactor row, the photo/icon fallback and the
bell counting.

In the sandbox at 393x852, against practice months built for each case:

| Case | Result |
| --- | --- |
| Only you owe | heading reads **NEEDS YOU** |
| Only you are owed | heading reads **SETTLING UP**, and the bell clears on opening |
| Both | one **SETTLING UP** section, what you owe first |
| Multi-reactor row | two overlapping faces, badge kept |
| Photo vs icon | both seen on screen in the same list |
| Tapping a row | centre closes, workout on screen, shell `scrollTop` still **0** |

**Not seen:** the real photo path against Supabase storage — the sandbox photo
was a data URI, since the stub has no storage. The `onError` fallback to the
icon covers a photo that fails to load.

### 2.9 The three things the founder asked for next — `0c93d90`

All three, before pushing anything, at his instruction.

#### 1. A comment row opens the comment thread

It used to land on the workout in the Activity feed, same as a reaction row.
`handleOpenLogComments` in `App.jsx` already does the work and needs the whole
log, which is always one of your own, so it is found in your own list. If the
log has gone (deleted, or the month rolled) the row still falls back to the
feed rather than doing nothing.

#### 2. Rows say what the comment was

Who wrote the newest comment, and a line of what they said — cut on a word at
80 characters, with an ellipsis, clamped to two lines so one chatty comment
cannot make a row twice the height of its neighbours. More than one and the
row reads *"Sam and 2 others commented on your Run Log"*. The commenter now
gives the row a face, which it did not have before.

**This needed one new database function.** `read_ante_core_workout_log_latest_comments`
returns the newest comment for a **set** of logs in one call, modelled line for
line on `read_ante_core_workout_log_comment_counts` — same membership check,
same `moderation_hidden_at` filter, same grants.

**Applied to production on 16 October** and verified immediately:

| Check | Result |
| --- | --- |
| Existed before | No — `0` rows in `pg_proc` |
| `anon` can execute | **false** |
| `authenticated` can execute | **false** |
| `service_role` can execute | true |
| `null`, empty and unknown-bloc input | returns `{}`, does not raise |

No data was written and no existing object was touched. **Rollback is one
statement:** `drop function public.read_ante_core_workout_log_latest_comments(text, text, text[]);`
The migration file is `supabase/migrations/20261016060000_read_ante_core_workout_log_latest_comments.sql`.

#### 3. Being tagged in the Bloc Stream

A mention now shows up with the message quoted and an `@` badge, and tapping it
opens the Stream. **This needed no database work at all** —
`read_ante_core_bloc_stream`, read from production, already returns each
message's `mentions` as auth user ids. Your own messages never mention you.

#### The decision that keeps this off the scaling pile

**Both fetches happen when the centre is opened, never on a refresh.** Fero's
biggest pre-launch problem is that every poll reads too much (§20 of Deveen's
handover); a notification screen firing a request per workout would have made
exactly that worse. So: the panel opens instantly on what the client already
holds, then **two batched calls** fill in the comment text and the mentions.
None at all if the bell is never tapped. An empty answer means "nothing to
show", never a failure — the rows fall back to the count they already had.

#### The sandbox can now show this

Comments and Stream messages live **only** in canonical, which the sandbox
stubs with `[]`, so there was no way to see this screen before shipping it.
`scripts/sandbox-supabase.mjs` now answers those two reads from
`.sandbox-data/canonical.json` when that file exists. **Test aid only** — it
mirrors nothing and changes no behaviour without the file.

#### How it was verified

Lint and build clean. **24 of 26 suites** — the same two that fail on `main`.
A fixture check covers the naming, the bundling, the word-boundary cut, the
un-fetched fallback, mentions of you, messages that mention nobody, and your
own messages being ignored.

In the sandbox at 393x852, with a fixture standing in for canonical:

| Checked | Result |
| --- | --- |
| Comment row | *"Jo and 2 others commented on your Other Log"* with the text quoted |
| Tapping it | the **comment thread** opens, headed "2 comments" |
| Mention row | *"Jo mentioned you in the Bloc Stream"*, message quoted, `@` badge |
| Tapping it | the **Bloc Stream** opens with `@Riley` highlighted |
| Shell scroll afterwards | `scrollTop` **0**, nothing stuck, no horizontal scroll |
| Network | every request 200 |

**Not seen against a real backend.** The sandbox fixture stands in for
canonical, so the new function has been proven safe on production but its
results have never been drawn on screen from real comments.

### 2.10 Live at `a6280a3` (16 October)

Pushed `486d2cc..a6280a3` with `--force-with-lease` after `git fetch` confirmed
`origin/main` an ancestor. Lint and build clean.

**Verified three ways:** the commit is on `main`; Production deployment
`7109250746` reports **success**; the live bundle `index-OVZJQPmf.js` contains
"mentioned you in the Bloc Stream", `log-latest-comments`, "Settling up",
"Needs you" and the `other${n===1?"":"s"} commented on` template. CI green, and
the live site loads with **no console errors**.

Website only — TestFlight is still build 10.

---

## Close-out (16 October)

**What is live**, all on the website at `a6280a3`:

- The bell opens **"For you"**, a full screen in the app's own background.
- A row reads **who, then what, then which workout** — face, emoji badge,
  sentence, and the photo or activity icon on the right.
- **Comments say who wrote the newest one and quote it**, and open the
  **comment thread**.
- **Stream mentions** appear, quoted, and open the Stream.
- Rows grouped **Today / This week / Earlier**.
- Money at the top both ways, under **Needs you** or **Settling up** by the
  founder's rule. Only money you owe keeps the bell lit.
- One new production function, `read_ante_core_workout_log_latest_comments`
  (§2.9), read-only and server-side only.

**What is open:**

- ~~The badge is the **most-chosen** emoji, not the most recent~~ — shipped on 16 October at `2b54000`; see the close-out.
- **@mentions inside a comment thread** — the last unbuilt piece of the
  concept.
- The new function's results have **never been drawn from real comments**.
- Nobody has opened the bell **on the live site or a real iPhone**.
- The **in-Bloc shell has no scroll guard** of its own (§2.5).
- The settlement-note prompt, once the note has a real save (§2.2).
- **TestFlight build 11** — never built; Xcode is not on this laptop.
- **Waiting on Deveen:** scaling before launch, the RLS rollout,
  `push_devices`, `fero-staging` billing.

**State of this laptop at close:** sandbox stopped by PID (ports 3000 and 54321
free), browser viewport reset, the worktree at
`~/Developer/FERO/catch-up-2026-10-15` clean and level with `origin/main`. The
shared checkout at `~/Documents/Codex Space/Lift Log` was never written to.

### 2.11 Four more from the founder's review — `25941cc`

#### Rows name the activity, not the category

Every racket and ball sport read **"your Sports Log"**. `Sports` is the broad
*category*; the *activity* is Padel, Basketball and so on, and Sports has not
been something anyone can log for a long time. `describeWorkout` used
`log.type`; it now uses **`getLogDisplayActivity`**, the app's own answer,
already used by the feed, the month calendar and the log modal. The square on
the right uses the same call, so the icon and the words cannot disagree.

#### Your own comments no longer count

On the founder's own Bloc it read *"Aadhil and 1 other commented on your Gym
Log"* — he **is** Aadhil. His reply to somebody else's comment was being
counted, and being the newest, was also the line quoted back at him.

The viewer is already identified inside
`read_ante_core_workout_log_latest_comments`, so that is where they are
dropped: `and c.commenter_profile_id is distinct from v_profile_id`. **`total`
now means "comments by other people"**, and a log whose only comments are
yours returns nothing at all.

**Applied to production 16 October** (migration
`20261016090000_latest_comments_exclude_your_own.sql`, a `create or replace`
of the function added that morning). Verified: `anon` **false**,
`authenticated` **false**, `service_role` true, the exclusion present in the
installed definition, and bad input still returns `{}`.

**The client had to stop second-guessing it.** It took
`Math.max(blob count, server total)`; the blob's count includes your own
comments, so it would have put the row straight back. Once the fetch has
answered, **its number is the only one used — zero included**. That needed a
`latestCommentsLoaded` flag, because an empty answer and "not asked yet" are
otherwise the same thing.

#### Rows expire after five weeks

Anything dated older than **35 days** is dropped. Money is deliberately **not**
on that clock: a debt is still a debt however old it is.

#### A mention lands on the message, and it glimmers

It used to open the Stream wherever the Stream happened to be. It now anchors
on the message itself, through the same `pendingListAnchor` mechanism the
unread marker uses — **not `scrollIntoView`**, which is what left every tab
sitting low in §2.5.

**Two things measuring caught, both in the glimmer:**

| Seen | Why | Fix |
| --- | --- | --- |
| The message landed with its first line cut off | the ring was drawn with padding and negative margin, which moved the message **after** the list had already scrolled to it | an `outline`, drawn outside the box, changing no layout |
| It still sat **52px** under the header | the shared anchor positions with `node.offsetTop`, measured from the offsetParent and not from the scroller | the focus path corrects itself from the two bounding rectangles over the following frames |

Measured after: `clippedAtTop: false`, **16px** below the list top, fully
visible, the outline present and gone again after two seconds.

#### How it was verified

Lint and build clean. **24 of 26 suites** — the same two that fail on `main`.
A fixture check covers the Padel naming, a log whose only comments are the
viewer's own (no row), a log with one of each (the other person named and
quoted), 42 days (gone), 34 days (kept), and the pre-fetch fallback.

In the sandbox at 393x852: the row read **"Jo and 1 other commented on your
Padel Log"**, tapping the mention put the message on screen with its ring and
`@Riley` highlighted, the ring faded on its own, the shell stayed at
`scrollTop` 0 and nothing with hidden overflow was left scrolled.

**A note on the console.** This session restarted the sandbox fifteen times,
and the browser tab's console keeps every error across navigations, so it had
filled with `ERR_CONNECTION_REFUSED` from the gaps between restarts. Checked
properly in a **fresh tab**: no console errors, and every live request 200.
Worth knowing before reading a stale console as a regression.

### 2.12 Live at `5ebd5f5` (16 October)

Pushed `d1e53fe..5ebd5f5` with `--force-with-lease`; `origin/main` confirmed an
ancestor, lint and build clean.

**Verified three ways:** on `main`; Production deployment `7109481996`
**success**; the live bundle `index-DraxXqb-.js` contains the glimmer's
`outlineOffset`, `latestCommentsLoaded`, the teal ring colour, the mention
copy and the `your ${activity} Log` template, and **no longer contains "your
Sports Log"**. CI green; the live site loads with **no console errors**.

**A note for whoever picks this up:** a second session
(`claude/...badge-the-newest-emoji`) was started on the most-recent-emoji
problem while this work was in flight, and it edits the same file. It has been
told that `main` moved and to rebase rather than merge. If its branch is still
open, check that before trusting it.

---

## Close-out (16 October, final)

**What is live** at `5ebd5f5`, website only — TestFlight is still build 10:

- The bell opens **"For you"**, full screen, in the app's own background.
- Rows read **who, then what, then which workout**, named by the **activity**
  logged, with the photo while it lasts and the activity icon after.
- **Comments** name the writer, quote a line, and **open the thread**; your own
  comments are excluded in the database function itself.
- **Stream mentions** appear, quoted, and land on the message with a glimmer.
- **Today / This week / Earlier**, and rows **expire at five weeks**.
- Money at the top both ways, under **Needs you** or **Settling up**.
- Two production functions added, both read-only and server-side only.

**What is open:**

- ~~The badge is the **most-chosen** emoji, not the most recent~~ — **done and
  live on 16 October at `2b54000`**, by the session this one started. The
  emoji most recently used now badges the row, falling back to the most-chosen
  one when there is no newer answer. See
  [`handover-2026-10-16-latest-reaction-emoji.md`](handover-2026-10-16-latest-reaction-emoji.md).
- **@mentions inside a comment thread** — the last unbuilt piece of the
  concept.
- Neither new function's results have been **drawn from real comments**; the
  sandbox fixture stands in for canonical.
- Nobody has opened the bell **on the live site or a real iPhone**.
- The **in-Bloc shell has no scroll guard** of its own (§2.5).
- The settlement-note prompt, once the note has a real save (§2.2).
- **TestFlight build 11** — never built; Xcode is not on this laptop.
- **Waiting on Deveen:** scaling before launch, the RLS rollout,
  `push_devices`, `fero-staging` billing.

**State of this laptop at close:** sandbox stopped by PID (ports 3000 and 54321
free), the mockup server on 8899 stopped, browser viewport reset and the scratch
tab closed, the worktree at `~/Developer/FERO/catch-up-2026-10-15` clean and
level with `origin/main`. The shared checkout at `~/Documents/Codex Space/Lift
Log` was never written to.

## 3. What is open, carried forward

- **The notification centre is live** at `a6d7bab` (§2.2, §2.3). Three things
  the founder has now asked for on top of it, in his order of wanting them:
  1. **A comment row should open the comment thread**, not just the workout.
     The smallest of the three; `handleOpenLogComments` in `App.jsx` already
     does the work, the row just does not call it.
  2. **Say who commented** — reachable through `log-comments-list`, but it must
     be batched, not one call per log (§20 of Deveen's handover).
  3. **Tell him when he is tagged in the Bloc Stream** — mentions are already
     stored on the message and served by `stream-list`.
  Also still open: whether to put the settlement-note prompt back, once the
  note has a real save behind it.
- **The in-Bloc shell has no scroll guard** (§2.5). `ebf9de5` guards the page
  track; its parent is open to the same displacement, on `main` today and
  regardless of the notification centre. Flagged deliberately rather than
  fixed, because it is shared layout nobody asked to change.
- **The bell is no longer a placeholder**, which removes the App Store risk the
  previous handover raised — provided `711e9fb` ships before submission. If it
  does not, the fallback stands: hide the bell in the native build behind
  `Capacitor.isNativePlatform()`.
- **TestFlight build 11** — never built; `main` is far past build 10, and Xcode
  is not installed on this laptop.
- **Block/report persistence is proven on `fero-staging`, not production**, and
  the API path joining the app to those functions has never been exercised in
  one run.
- **The Stream's empty state** still tests `messages.length === 0` rather than
  `visibleMessages.length === 0`, so blocking every author shows an empty list
  instead of "No messages yet". A decision, not a crash.
- **1 November month close** — the first full one since `c9ce86a`.
- **Waiting on Deveen:** scaling before launch (not started since
  15 September, and the biggest pre-launch item — read §20 of his handover), the
  RLS production rollout, `push_devices` missing from his migration,
  `fero-staging` still billing ~$9.68/month.
- `support@joinfero.app` is still unconfirmed — no test email has been sent.
- `test:auth-edge-flows` and `test:mobile-navigation` fail on `main` too.
- Cleanup candidates: the stale local branches, the two August worktrees in
  `~/Documents`, the four August `.dmg` backups, and the mockup branch
  `mockup/profile-header-2026-10-12`.

## 4. Commits this session

| Commit | What | Live |
| --- | --- | --- |
| `0a500a9` | Open the 15 October catch-up handover | Docs only |
| `711e9fb` | **The notification centre** — the bell opens "For you" | On the branch, **not pushed, not live** |
| `a6d7bab` | Record the port and how it was verified | Docs only |
| `370a523` | What's live at `a6d7bab`, and the three follow-ups | Docs only |
| `ba54e87` | **Full screen, and the stuck scroll fixed** | On the branch, **not pushed** |
| `8d14881` | Record both | Docs only |
| `3eeefbf` | **The app's own background**, not the Stream's | On the branch, **not pushed** |
| `5f86d45` | Record the background correction | Docs only |
| `486d2cc` | What's live at `5f86d45`, and the close-out | Docs only |
| `cb7f4fb` | **For you redesigned** — faces, badges, thumbnails, sections, the money heading rule | On the branch, **not pushed** |
| `c7b8cf4` | Record the redesign | Docs only |
| `0c93d90` | **Thread opening, comment text, Stream mentions** + the new RPC | On the branch, **not pushed** |
| `a6280a3` | Record all three | Docs only |
| `d1e53fe` | What's live at `a6280a3`, and the close-out | Docs only |
| `25941cc` | **Activity naming, own comments out, five-week expiry, mention glimmer** + the RPC change | On the branch, **not pushed** |
| `5ebd5f5` | Record all four | Docs only |
| *(this one)* | What's live at `5ebd5f5`, and the close-out | Docs only |
