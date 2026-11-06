# Push notifications — the design — 6 November 2026

> **Revised the same day, after the founder pushed back, and he was right.**
> The first version of this doc dropped "notify me when my blocmates work out"
> down to an off-by-default daily digest. His answer:
> *"it is important to be notified when your blocmates log a workout. That's
> the whole like motivation and accountability factor. It's like when you're
> being lazy on a Sunday and you get notification saying three of your buddies
> have logged a workout. That's what pushes you to go do your own workout."*
> He also supplied the fix — a threshold, possibly a percentage, because a flat
> count breaks a three-person Bloc. Measured, that works: it is now **type 1,
> on by default**, at **11 notifications a month**. §1A is the whole design.
> My original mistake was treating "too many" as "do not send", when the real
> problem was only *one per event*.

**Status: a proposal, nothing built.** The founder asked which moments deserve a
notification, how they bundle, what the types are, and when to ask permission.
This answers all four. It does **not** change code. The APNs key is deliberately
last: it needs his personal laptop and he asked to leave it until the end.

Mockup of every notification below, in Fero's own styling, with the exact copy:
the Design canvas titled **Fero push notifications** (five artboards — the seven
types, type 1 in full, bundling, the permission moment, and the measured
volume).

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

**But the conclusion is not "do not send it".** The problem is *one per event*,
not the subject. §1A is the rule that keeps the motivation and loses the volume.

**Caveat that belongs on every Fero number:** the app has not launched. October
is six real Blocs of friends, not a market. The *ratio* between the two columns
holds at any size; the absolute figures will move.
(`docs/READ-BEFORE-ANALYSING-FERO-NUMBERS.md`.)

---

## 1A. Type 1 — "your Bloc is moving and you haven't"

> **Superseded 7 November by §2E.** The founder dropped the threshold and the
> workout count. The measurement below stands; the rule it argued for does not.

The founder's lazy-Sunday case. **Not one push per workout — one a day at
17:00, and only if you have not logged yet.** That condition does all the work:
it removes every notification that could not change anything, and it is what
takes the rule from unusable to 11 a month.

> **Sarandawgs**
> Hana, Noah and Tariq have logged today.
> You're on 7 of 12.

One person: *"Hana has logged today. You're on 7 of 12."*
Two Blocs at once: *"5 of your blocmates have logged today."*
Already hit your target: **nothing**.

It names people, and it names your own standing, because the standing is the
stake. Both halves matter: the names are the social proof, the "7 of 12" is why
you care.

### The threshold is a third of the others, not a flat count

The founder raised this himself and the data settles it. Notifications per
member per month, October 2026, with the "and you have not logged today"
condition applied:

| Bloc | Size | "2+ people" | "3+ people" | A third of the others |
| --- | --- | --- | --- | --- |
| Go To Da Gym | 10 | 17.5 | 11.1 | 11.1 |
| Ctrl Alt De-feat | 8 | 13.9 | 9.4 | 9.4 |
| Sarandawgs | 8 | 13.8 | 5.5 | 5.5 |
| OSI H3 | 7 | 10.4 | 8.3 | 10.4 |
| StavanGang | 7 | 11.0 | 6.7 | 11.0 |
| Sweat Equity | 7 | 14.3 | 7.9 | 14.3 |
| Sunday Warriors | 6 | 2.5 | 2.5 | 2.5 |
| **Curke** | **3** | **1.3** | **0.0** | **8.0** |

**Curke is the whole argument.** A flat "3 people" can **never** fire in a
three-member Bloc — there are only two other people in it. A flat "2 people"
fires 1.3 times a month, which is also nothing. A third of the others fires 8
times, which is the point of the feature.

**The rule: a third of the other members, rounded up, minimum one.** 1 of 2,
2 of 6, 3 of 7, 7 of 19. It self-adjusts and needs no special case.

Across every Bloc of three or more, the measured totals were: ≥1 other 19.2 a
month, ≥2 others 14.5, ≥3 others 8.8, a third 11.3, half 5.9. **A third is the
one that is generous in a small Bloc and restrained in a large one.**

### 17:00, and why that exact hour

From when workouts are actually logged — the share of a day's workouts already
in by each hour, October 2026:

| 09:00 | 12:00 | 15:00 | **17:00** | 19:00 | 21:00 |
| --- | --- | --- | --- | --- | --- |
| 23% | 37% | 55% | **65%** | 80% | 97% |

By 17:00 two-thirds of your Bloc's day has happened, so the number in the
message is real rather than premature — **and a third of all logging is still
ahead of you**, so you can act on it. Earlier and it has nothing to report;
later and it is a reproach rather than a nudge. 17:00 in the member's own time
zone, which `ante_core.blocs.time_zone` already stores.

### Per-Bloc, with one hard cap across all of them

The message names people, so it is built per Bloc. But **at most one of these a
day per member**: where two Blocs both qualify, they merge into the "5 of your
blocmates" form. On October's data the cap trims 519 fires to 468 — small today,
because members average 1.2 Blocs and only 8 of 51 are in more than one, and the
thing that stops this compounding as people join more.

### On by default

Alone among the seven. This is the accountability loop rather than a courtesy,
and an accountability app whose accountability is opt-in does not work. It still
gets its own switch.

---

## 2. The types

> **Twelve since 7 November** — see §2E for 10, 11 and 12.

The Bloc name is always the iOS **title**, because members belong to more than
one and "who reacted" is useless without "where". The **body** is the same
sentence the bell already writes, so the two can never disagree — including
`describeWorkout`'s "your Gym Log" capitalisation and `nameList`'s
"Hana, Noah and 2 others".

| # | Type | Title | Body | Timing | Default |
| --- | --- | --- | --- | --- | --- |
| 1 | **Your Bloc is moving** | Sarandawgs | `Hana, Noah and Tariq have logged today. You're on 7 of 12.` | 17:00, only if you have not logged | **on** |
| 2 | Reaction on your workout | Sarandawgs | `Hana and Noah reacted to your Run Log 🔥` | instant, bundled | on |
| 3 | Comment on your workout | Sarandawgs | `Noah commented on your Gym Log` + the comment | instant, bundled | on |
| 4 | Reply in a thread you are in | Sarandawgs | `Tariq replied on Leo's Run Log` + the comment | instant, bundled | on |
| 5 | Mentioned in the Bloc Stream | Sarandawgs | `Eli mentioned you in the Bloc Stream` + the message | instant | on |
| 6 | Pace nudge | Sarandawgs | `3 days left. You're 2 workouts off 12.` | scheduled, once a month | on |
| 7 | Month closed | Sarandawgs | one of seven outcomes, §2B | scheduled, once a month | on |
| 8 | **Money claimed or confirmed** | Sarandawgs | `Tariq says he's sent you £10. Confirm it arrived.` | when the other person taps | **on** |
| 9 | **Bloc streak at risk** | Sarandawgs | `23-day Bloc streak at risk. One workout keeps it going.` | 19:00, only if nobody has logged | **on** |

Types 2 to 5 are exactly the four kinds the "For you" centre already builds
(`reaction`, `comment`, thread `comment`, `mention` in
`src/lib/notificationCentre.js`). Nothing new is invented, which is the point:
the bell's wording has already been through the founder.

**One deliberate omission.**

- **Being owed money is not a push.** You cannot act on it. The bell already
  draws this line: `alwaysUnread` is true only for money you owe, with the
  comment *"a badge you cannot clear is just nagging"*. Push inherits it.

**Types 1, 6 and 7 do not exist anywhere yet**, and types 1 and 6 are the two
that can change the month's outcome rather than report it. Both need a scheduled
job and the member's own time zone, which `ante_core.blocs.time_zone` already
stores — so they are one piece of work, not two.

Type 1 and type 6 must not both land on the same day: where they would, type 6
wins, because "3 days left" is the more urgent fact. One scheduled job, one
notification.

**Correction, same day.** This table said *seven* types and I summarised it to
the founder in chat with a different seven — I dropped "reply in a thread" and
added "money" as a type of its own. The chat list was wrong about the numbering
and right about the gap: **money does need its own type**, because the
settlement handshake happens days after the month-close notification and has
states of its own. Types 8 and 9 are the result. Nothing the founder approved
has been renumbered.

---

## 2A. Type 8 — money is a handshake, not an announcement

A debt closes with two taps that already exist on the settlement screen: the
payer taps **Claim paid**, the receiver taps **Confirm** or disputes it
(`payerClaimedAt` / `confirmedAt` in `appState.js`). Each tap leaves the other
person waiting, so each tap is a push.

| To | When | Body |
| --- | --- | --- |
| Receiver | payer claims paid | `Tariq says he's sent you £10. Confirm it arrived.` |
| Payer | receiver confirms | `Leo confirmed your £10. Settled.` |
| Payer | receiver disputes | `Leo says the £10 hasn't arrived.` |
| Payer | 7 days after close, **once** | `You still owe Leo £10 for October.` |
| Receiver | last debt of the month closes | `Everyone's settled for October. £30 in.` |

**Never sent: "Leo still owes you £10."** You cannot act on being owed. The bell
already draws exactly this line — `alwaysUnread` is true only for money you owe,
with the comment *"a badge you cannot clear is just nagging"*. Push inherits it.

The dispute copy is blunt on purpose. A dispute is a real problem between two
friends, and softening it hides it.

---

## 2B. Type 7 — the seven month-close outcomes

Not new words. `SettlementScreen.jsx` already sorts every member into exactly
one result, checked in this order, first match wins. The push says the same
thing in one line so the two can never disagree.

| Result | Body |
| --- | --- |
| Sat out | `October closed. You sat it out — back in it next month.` |
| First month | `October closed. Target was 12. No penalty yet — those start next month.` |
| Perfect Bloc month | `October closed. Everyone hit the target — perfect Bloc month.` |
| Winner, pot | `October closed. Top of the Bloc — £30 coming your way.` |
| Winner, no pot | `October closed. Top of the Bloc with 18 workouts.` |
| Target hit | `October closed. Target hit — 14 workouts.` (+ `3 months cleared in a row.` from two) |
| Tough month | `October closed. You needed 12. You owe Leo £10.` |

The order matters and is the screen's own: "sat out" is asked before any money
question, because someone exempt used to fall through and be congratulated for
a month they sat out. The push never names who came last.

---

## 2C. Type 9 — the Bloc streak at risk

The founder asked for this. **The rule is already written**:
`src/lib/blocStreak.js` counts the days in a row somebody in the Bloc logged,
shows a card from `BLOC_STREAK_MIN_DAYS = 10`, and marks it at risk when nobody
has logged and the Bloc's clock is past `BLOC_STREAK_WARN_HOUR = 19`. **The
notification must call `blocStreakView` itself**, not re-derive the rule — the
same reason `moneyItems` reuses the reminder cards.

- Between 00:00 and 03:00 the card names **3am**, not midnight, because a Fero
  day ends at 3am. The push has to match or it lies about the deadline.
- **It goes to the whole Bloc, and no filter is needed.** If the streak is at
  risk then by definition nobody has logged, so every member is eligible.
- **It can never collide with type 1.** Type 1 fires when a third of the Bloc
  *has* logged; this fires when *nobody* has. Opposite conditions, no tie-break.
- It *can* collide with the pace nudge, and the pace nudge wins.

Measured over September–October, per member per month:

| Bloc | Days broken in 66 | At 19:00 | At 21:00 |
| --- | --- | --- | --- |
| Go To Da Gym | 1 | 3.6 | 2.7 |
| OSI H3 | 1 | 4.1 | 1.8 |
| Sweat Equity | 2 | 4.5 | 2.7 |
| Ctrl Alt De-feat | 2 | 5.0 | 3.2 |
| Sarandawgs | 6 | 8.6 | 6.8 |
| **StavanGang** | 2 | **14.1** | 9.1 |

StavanGang is the outlier, and not because their streak is fragile — they train
late, so a 19:00 warning is often simply wrong about them. Moving the hour to
21:00 only takes them to 9 and costs every other Bloc the time to act. The
better fix is a per-Bloc hour, later. **Keep 19:00 for v1**, matching the card.

---

## 2D. Members in more than one Bloc

**One workout can be posted to several Blocs at once.** It becomes one row per
Bloc sharing a session key (`getWorkoutSessionKey`, `appState.js:1412`).
Measured for October:

| | |
| --- | --- |
| Workouts posted to >1 Bloc | **103 of 547** — nearly one in five; 19 went to all six |
| Members in >1 Bloc | 8 of 51 — seven in two, one in six |

**This breaks type 2 if push copies the bell.** The bell keys a reaction row on
`log.id`, which is per-Bloc. Keyed that way, the founder's own October would
have been **51 reaction pushes for 17 workouts**. Keyed on the session: 17.

| Owner | Keyed on the row | Keyed on the session |
| --- | --- | --- |
| Aadhil | 51 | 17 |
| Isira | 23 | 16 |
| Kisal | 16 | 9 |

So **push keys reactions and comments on `getWorkoutSessionKey` + owner**, not
on the log id, and uses that as the APNs `apns-collapse-id`. When a workout
spans Blocs the title becomes the count — `6 Blocs` — because no single Bloc
owns it.

**Type 1** is judged per Bloc (a third of Curke's two others is not a third of
Go To Da Gym's nine) but delivered once: the existing one-a-day cap merges two
qualifying Blocs into `2 Blocs are moving / 5 of your blocmates have logged
today.` The "you're on 7 of 12" line then shows **the Bloc you are furthest
behind in**, since that is the one the nudge is for.

---

## 2E. Founder decisions, 7 November 2026

He reviewed every variation and changed four things. **These supersede §1A and
parts of §2 above** — they are not open questions any more.

### Type 1 loses the threshold and the count

The "a third of the others" rule is **dropped**. His words: a fixed time is a
promise you can explain, a fraction is not. The rule is now:

> Every day at **18:00**, however many blocmates have logged by then.
> Only if **you** have not logged today. One a day across all Blocs.

- **The "7 of 12" count is gone.** Targets differ between Blocs (12, 15, 10),
  so the number is meaningless once merged and misleading before that.
- **The "already hit target" filter is gone.** He wants it anyway: *"it would
  still be cool to get a notification when your blocmates have logged, even
  after you've hit your target."*
- Measured cost: **21 a month**, against 11.3 for the threshold version.
  Accepted knowingly — every one of the 21 still lands on a day he has not
  trained, and the rule fits in a sentence.

### Time zone: per member, not per Bloc — a new column

He asked whose 18:00 it is, and he was right to. **`ante_core` has a
`time_zone` on `blocs` and `seasons` and nowhere else** — there is no member
time zone at all. Production: 11 Blocs on `Europe/Oslo`, 1 `Europe/Berlin`,
1 `Asia/Colombo`, so 18:00 in the Colombo Bloc is 14:00 for its Oslo members.

`profiles` needs a `time_zone` column, filled from the device. The app already
reads `Intl.DateTimeFormat().resolvedOptions().timeZone` at `App.jsx:3918`, but
only as the default when creating a Bloc — it is never saved for a person.

**This blocks types 1, 6, 7 and 9**, all four being scheduled. It ships first.

Note the split: *who logged today* is still counted on the **Bloc's** day
(a Fero day ends at 3am Bloc time); only the **delivery hour** is the member's.

### Tapping a notification — the app cannot do this today

`handleNotificationAct` (`src/App.jsx:2704`) resolves every row against
`currentGroup` and **never switches Bloc**. That is safe for the bell, which
only ever shows the Bloc already open. It is wrong for push, which arrives
cold and may concern any of six Blocs.

**Fix before shipping:** `setSelectedGroupId` (available, `App.jsx:752`) must
run before the screen change. Then:

| Notification | Opens |
| --- | --- |
| About one Bloc | switch to that Bloc, then its screen |
| Reaction / comment | the workout in the feed, highlighted |
| Mention | the Bloc Stream, on the message |
| Money | that Bloc's settlement screen |
| Streak / Bloc moving | that Bloc's Today screen |
| **Merged across Blocs** | **nothing exists to open** |

**Correction, 7 November.** I first wrote that a merged notification could open
the notification centre because it "already splits into one row per Bloc". It
does not. `buildNotifications` is fed `group: currentGroup` (`App.jsx:2613`)
and `buildSettlementReminderCards(currentGroup, …)` (`App.jsx:2609`), so the
centre shows **one Bloc — the one already open** — money included. No screen in
Fero spans Blocs except the Bloc switcher. The founder caught this.

**So merging needs a cross-Bloc notification centre built first.** Five of the
twelve types merge (1, 2, 6, 7, 9) and all five need the same destination, so
it is built once. The alternative is not merging — six Blocs closing sends six
notifications — which is what the founder objected to. Recommended, but it is
the largest item on the list and he decides whether push waits for it.

### Merging types 6 and 7

- **Type 6 does not merge below four Blocs** — the message *is* the number, and
  six Blocs means six targets and six deadlines. It only goes to Blocs he is
  behind in. From four: `3 Blocs need 2 more workouts each. 1 needs 5.`
- **Type 7 merges from four**: `Hit 4 of 6 targets. You owe £20 in two Blocs.`,
  or `All 6 targets hit. Nothing owed anywhere.`

### Three new types, taking the set to twelve

Approved from the "no notification yet" list:

| # | Type | Note |
| --- | --- | --- |
| 10 | Sit-out or Solo **requested** | to the admin; `sitout-review` / `solo-review` blocks the member until they act |
| 11 | Sit-out or Solo **approved or declined** | to the member |
| 12 | **The last workout of a perfect Bloc month** | his idea; does not exist as an event yet |

Rejected: `target_hit` (112 rows — recreates the per-workout volume already
rejected), `member_joined`, `settings_changed`, `member_removed`.

Type 12 needs its own detection and a second-person variant for the member who
logged the workout that completed it.

**Mentions inside comments** he also approved; the feature does not exist yet
(`notificationCentre.js:18` says so), so it is a dependency of type 5's second
form, not of the other eleven.

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
5. **Each type switchable off**, nine switches on the account screen. A member who
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
| 0a | **`profiles.time_zone`**, filled from the device — blocks every scheduled type (§2E) | code + schema |
| 0b | **Switch Bloc on notification tap** in `handleNotificationAct` — wrong Bloc opens today (§2E) | code |
| 1 | **Deferred at the founder's request:** the APNs key, and `APNS_PRIVATE_KEY` / `APNS_KEY_ID` / `APNS_TEAM_ID` in Vercel (team `SMR55A2M96`). The `.p8` downloads **once**, never into the repo or a chat | his personal laptop |
| 2 | Give `buildApnsRequest` a message argument — it hardcodes `title: "Fero test"` today | code |
| 3 | The permission card above, wired to `requestPushPermissionFromUserAction({ userInitiated: true })`, which has no caller | code |
| 4 | The nine switches, and a `notification_prefs` store | code + schema |
| 5 | Send on `add-log`, `reaction`, `log-comment-create`, `stream-send` and the settlement claim/confirm/dispute handlers in `api/lift-log.js`, keyed on **`getWorkoutSessionKey` + owner**, not `log.id` (§2D) | code |
| 6 | **One scheduled job** for types 1, 6, 7 and 9 — the threshold, the 17:00 and 19:00 local sends, the one-a-day cap, and the pace nudge winning a collision. `ante_core.notification_jobs` already exists for exactly this: `job_type`, `scheduled_for`, `status`, `payload` | code |
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
