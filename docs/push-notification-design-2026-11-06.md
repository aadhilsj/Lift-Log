# Push notifications — the design — 6 November 2026

**Status: a proposal, nothing built.** The founder asked which moments deserve a
notification, how they bundle, what the types are, and when to ask permission.
This answers all four. It does **not** change code. The APNs key is deliberately
last: it needs his personal laptop and he asked to leave it until the end.

Mockup of every notification below, in Fero's own styling, with the exact copy:
the Design canvas titled **Fero push notifications** (four artboards — the six
types, bundling, the permission moment, and the measured volume).

Read first, both already existing and both read for this:
- `docs/push-notifications-order-of-operations-2026-09-30.md` (on
  `origin/claude/push-notifications-plan-2026-09-30`) — the ten-step order
- `docs/handover-2026-09-28-push-foundation.md` (on the iOS branch) — what the
  foundation already does

---

## 1. Everything is measured, because the obvious design is the wrong one

The founder's own example was "when somebody has logged a workout". Counted
against production for **October 2026** — 730 workouts, 512 reactions, 84
comments and 124 Bloc Stream messages across every Bloc — that rule is the one
thing in this design that must not be built.

Both columns are notifications **one member** would have received that month.

| Bloc | People | Workouts | "Someone logged a workout" | "Reacted to yours", bundled |
| --- | --- | --- | --- | --- |
| OSI H3 | 7 | 157 | **135** | 9.7 |
| Go To Da Gym | 10 | 110 | **99** | 5.5 |
| Sweat Equity | 7 | 93 | **80** | 8.4 |
| Ctrl Alt De-feat | 8 | 92 | **81** | 9.9 |
| StavanGang | 7 | 90 | **77** | 9.6 |
| Sarandawgs | 8 | 63 | **55** | 4.6 |
| Curke | 3 | 18 | 12 | 0.7 |

`per-member per-log = logs × (members − 1) / members`; the bundled column is
`count(distinct log that got a reaction from someone other than its owner) /
members`, so it is the real number of notifications after bundling, not an
estimate.

**135 a month is four or five buzzes a day, and not one of them is about you.**
That is the shape of notification people switch off — and iOS never asks again.
The whole design follows from that single number.

**Caveat that belongs on every Fero number:** the app has not launched. October
is six real Blocs of friends, not a market. The *ratio* between the two columns
holds at any size; the absolute figures will move.
(`docs/READ-BEFORE-ANALYSING-FERO-NUMBERS.md`.)

---

## 2. The six types

The Bloc name is always the iOS **title**, because members belong to more than
one and "who reacted" is useless without "where". The **body** is the same
sentence the bell already writes, so the two can never disagree — including
`describeWorkout`'s "your Gym Log" capitalisation and `nameList`'s
"Hana, Noah and 2 others".

| # | Type | Title | Body | Timing |
| --- | --- | --- | --- | --- |
| 1 | Reaction on your workout | Sarandawgs | `Hana and Noah reacted to your Run Log 🔥` | instant, bundled |
| 2 | Comment on your workout | Sarandawgs | `Noah commented on your Gym Log` + the comment | instant, bundled |
| 3 | Reply in a thread you are in | Sarandawgs | `Tariq replied on Leo's Run Log` + the comment | instant, bundled |
| 4 | Mentioned in the Bloc Stream | Sarandawgs | `Eli mentioned you in the Bloc Stream` + the message | instant |
| 5 | Pace nudge | Sarandawgs | `3 days left. You're 2 workouts off 12.` | scheduled, once a month |
| 6 | Month closed | Sarandawgs | `October closed. You owe Leo £10.` | scheduled, once a month |

Types 1 to 4 are exactly the four kinds the "For you" centre already builds
(`reaction`, `comment`, thread `comment`, `mention` in
`src/lib/notificationCentre.js`). Nothing new is invented, which is the point:
the bell's wording has already been through the founder.

**Two deliberate omissions.**

- **"Someone logged a workout" is not a push.** It becomes **one daily digest**,
  **off by default**: *"5 workouts in Sarandawgs today. You're 3rd on 7."* One
  notification instead of 135, and it still carries the competitive bit that
  made the idea attractive.
- **Being owed money is not a push.** You cannot act on it. The bell already
  draws this line: `alwaysUnread` is true only for money you owe, with the
  comment *"a badge you cannot clear is just nagging"*. Push inherits it.

**Type 5 does not exist anywhere yet.** The pace nudge is the only genuinely new
thing here, and for an accountability app it is probably the most valuable
notification of the six — it is the only one that can change the outcome rather
than report it. It needs a scheduled job and the member's own time zone, which
`ante_core.blocs.time_zone` already stores.

---

## 3. Bundling — five rules

1. **One notification per workout, not per reaction.** Keyed on the workout, via
   the APNs collapse id, so a second reaction **replaces** the first on the lock
   screen instead of landing beside it. The app already decided this for the
   bell, in those words: *"five reactions on one workout is one thing that
   happened, not five."*
2. **Names collapse.** "Hana", then "Hana and Noah", then "Hana, Noah and 2
   others" — `nameList`, unchanged.
3. **Never your own action.** Already true of the bell; `ownLogItems` filters
   `name !== currentUser` and the comment count excludes your own.
4. **Quiet from 22:00 to 07:00**, in the member's own time zone, held and sent at
   07:00. Nothing in an accountability app is worth waking someone for.
5. **Each type switchable off**, six switches on the account screen. A member who
   wants only the month nudge can have only that. The order-of-operations doc
   already requires this.

---

## 4. The permission moment

iOS asks **once, ever**. Say no and it is buried in Settings, which is where
notifications go to die. So Fero asks **first, in its own card**, and only a tap
on the green button reaches Apple.

**Recommended: immediately after the member's first workout is logged.**

> **First one logged.**
> Your Bloc can see it now. Want to know when they react, or when the month is
> running out?
> **[ Turn on notifications ]**  [ Not now ]

Why that moment:

- They are in the app, and they have just succeeded at the thing the app is for.
  It is the warmest second Fero gets.
- The ask is self-evidently about something they want — whether anyone noticed.
  Asking at sign-up, before there is a Bloc or a workout, is asking about
  nothing.
- **"Not now" costs nothing**, because Apple is never called, so Fero can ask
  again next month. Asking at sign-up and being refused spends the one prompt
  permanently.

Plus a plain switch on the account screen, for anyone who said no and changes
their mind. This is the moment the 28 September handover floated and the founder
never answered; it is now a recommendation rather than a menu.

---

## 5. What this needs built, in order

Steps 1 and 3 of the order-of-operations doc are **done** — Push is enabled on
the App ID and the distribution profile was regenerated on 5 November.

| | | Whose |
| --- | --- | --- |
| 1 | **Deferred at the founder's request:** the APNs key, and `APNS_PRIVATE_KEY` / `APNS_KEY_ID` / `APNS_TEAM_ID` in Vercel (team `SMR55A2M96`). The `.p8` downloads **once**, never into the repo or a chat | his personal laptop |
| 2 | Give `buildApnsRequest` a message argument — it hardcodes `title: "Fero test"` today | code |
| 3 | The permission card above, wired to `requestPushPermissionFromUserAction({ userInitiated: true })`, which has no caller | code |
| 4 | The six switches, and a `notification_prefs` store | code + schema |
| 5 | Send on `add-log`, `reaction`, `log-comment-create`, `stream-send` in `api/lift-log.js`, with the collapse key and the quiet window | code |
| 6 | A scheduled job for types 5 and 6 | code |
| 7 | `PUSH_REGISTRATION_ENABLED=true`, build 13+, then one real notification to his own phone before anything is switched on for anyone else | both |

**2, 3 and 4 can all be built before the key exists**, which is what the founder
asked for. None of them can be *tested* end to end without it: a device token is
never stored until registration is on, and nothing can be sent without the key.
Say so rather than implying otherwise.

**The environment trap, repeated because it has already cost a session.**
TestFlight and App Store builds use **production** APNs. A sandbox token sent to
production APNs returns `BadDeviceToken`, which reads like an expired token and
is not. A physical Debug build needs
`VITE_APNS_ENVIRONMENT=sandbox npm run build` before `npx cap sync ios`.

---

## 6. One thing this design does not solve

The "For you" centre is **not** a server-side feed. `buildNotifications`
computes every row **in the client** from state the app already holds. A push has
to be sent from the server, at the moment the action is written. So the two
cannot share an implementation, only their wording — and keeping them agreeing
is ongoing work, not a one-off. Worth knowing before step 5 rather than
discovering it there.
