# Read this before analysing Fero's numbers or writing a report

Written 2026-09-24. Applies to **every** future session that is asked for a
report, an analysis, a metric, or "how are we doing". Read it before running a
single query. It exists because a session on 24 Sep produced three confident,
wrong conclusions in a row, each from skipping something written below.

---

## 1. The business context that changes what the numbers mean

**Fero has not launched.** As of September 2026 it is deliberately in soft
launch:

- **No marketing. No public launch. No app store listing yet.** Nothing has
  been posted on socials.
- Everyone using it was personally told about it by the founder.
- The plan is: get on the App Store, keep refining with this early user base,
  then **launch publicly on socials in December 2026**.

**Therefore: flat growth is not a finding. It is the plan working.**

Do not present flat or slow user growth as a problem, a risk, or something to
investigate. Nobody is trying to grow yet, and there is no channel through
which growth could happen. A session on 24 Sep flagged "you're flat, not
growing" as a concern and had to retract it. The founder's words: *"growth
right now isn't something we're focusing on. We're not doing anything at all
about growth. It's not out there."*

The right question before December is **"is the product good enough to
launch?"**, not "why aren't we bigger".

**The user base is several unrelated friend groups, not one.** Basketball
teammates, work colleagues, friends from back home, friends in Norway, and
those people's own friends. This matters when reading retention: loyalty to
the founder explains a single tight circle, but it explains much less across
five or six groups who don't all know each other. Do not describe it as "one
friend group" — that undersells the result and the founder has corrected it
once already.

Still say plainly that these are warm contacts and post-launch numbers may
differ. That caveat is honest. "One friend group" is not.

---

## 2. Query rules — every one of these has already caused a wrong answer

### Filter `left_at`, always

`ante_core.bloc_members` keeps a row after somebody leaves, with `left_at`
set. **A count without `where left_at is null` includes people who left.**

This produced a whole table of inflated Bloc sizes on 24 Sep. Ctrl Alt De-feat
was reported as having 11 members when it has 9 — Tri left in June, Gregorio
in September. Seven departures exist across the data; five Blocs that look
occupied actually have **zero** current members.

```sql
-- wrong
select count(*) from ante_core.bloc_members where bloc_id = $1;
-- right
select count(*) from ante_core.bloc_members where bloc_id = $1 and left_at is null;
```

### Count "not logging" per person, never per Bloc

Members can belong to several Blocs, and a workout is attributed to the Bloc
it was logged in. Someone in two Blocs who logs in one of them looks inactive
in the other.

This made **Tri** — 54 workouts, logging regularly in OSI H3 — appear as a
non-logger in Ctrl Alt De-feat. Tri is one of the stronger members.

Ask "has this person logged anywhere", then attribute.

### The founder is excluded from some metrics and not others

He is `display_name = 'Aadhil'`, profile `768de245-5b17-4292-b91c-804daaa3b217`.

| Metric | Includes him? |
|---|---|
| Workout uploads | **yes** — his training is real |
| Active Users | **yes** — counts a person once a day |
| Feature Engagement | **yes** — counts people, not taps |
| Usage events (screen opens, taps) | **no** |
| App Opens | **one per day only** |

His 4,019 historical usage events were moved to
`ante_core.app_usage_events_archive` on 24 Sep. The live table is members
only. Writes from his account are blocked at the API. See
`handover-2026-09-24-founder-excluded-from-analytics.md`.

He genuinely opens the app every day — 28 active days out of 28 since tracking
began — so the one-per-day figure is a true floor, not a fudge.

### Exclude test Blocs

`Test`, `Test 7000`, `Test Bloc`, `test` are the founder's. They have no
members and no workouts. **There is no delete-a-Bloc feature in Fero**, so
they cannot simply be removed; filter them out of any analysis instead. A
proper delete feature is planned.

`Gym gal`, `FIMctive` and `Lazy no more` are **not** test Blocs — they are real
people's Blocs that never got going. Do not lump them in.

### Know when each metric became trustworthy

| Metric | Trustworthy from | Before that |
|---|---|---|
| Workout uploads | 2026-06-05 | — |
| Active Users | 2026-08-28 | not tracked |
| Usage events | **2026-09-24** | a floor — swipe navigation recorded nothing, so screen opens were undercounted by roughly half |
| App Opens | **2026-09-24** | one open per active person per day, backfilled |

**Do not compare usage volumes across 24 September.** The Users columns were
always roughly honest; the *Uses* columns were not.

---

## 3. Member context a query cannot tell you

Keep this updated. It is the difference between a number and an explanation.

- **Cutie pie** — off sick. That is why she stopped logging after 20 August.
  Not churn.
- **Randy** — the CEO, busy. Opens the app, does not log. Not a activation
  problem.
- **Gregorio** — left his only Bloc on 4 September and is in none now. He is
  gone, not lapsed. Do not count him as a drop-off.
- **Tim** — created FIMctive on 3 August and **has never opened the app**, not
  once. A sign-up problem, not an engagement one.
- **Emma** — signed up 2 September, opened the app once, in the same second
  her account was created, and never returned.
- **Tri** — active in OSI H3. Left Ctrl Alt De-feat in June.

Always check whether a "lapsed" member is actually sick, busy, or departed
before putting them in a report.

---

## 4. Where things stood on 24 September 2026

Members only, the founder's testing removed.

- 46 accounts, **42 active in September** (91%)
- ~19–20 people open Fero on a given day — a **47% daily-to-monthly ratio**
- **83.8% weekly retention**, 80% activation
- 387 workouts in September; median member logged **10**, top logger 28
- **Top five members are only 28% of all workouts** — unusually flat. In most
  social products the top five are 60–80%. The accountability mechanic appears
  to lift the middle rather than create heroes. This is the strongest single
  finding so far.
- 17 Blocs: **9 active, 8 dormant** — but five dormant ones have no members at
  all, and four of those are test Blocs
- **Six of the nine active Blocs have 100% participation.** Ctrl Alt De-feat is
  8 of 9 and the one exception is off sick.

**The open question for December:** only 18 of 42 active members reacted or
commented in September — 194 reactions, 51 comments. **57% are silent.** For a
product whose moat is community, that is the number to move before a public
launch. Retention is already excellent; participation is not.

---

## 5. Working notes

- A full report was requested for **around 28 September 2026**, for the
  founder to share with his team.
- Always run read-only SQL through the Supabase MCP (project
  `bpvvvqjsfwmmfjvvijkd`) and check a function only reads before calling it.
- Give plain-English conclusions first. The founder is not a developer and
  will act on what is written, so a wrong confident sentence costs more than a
  hedged accurate one.
- When a number looks surprising, check the query before believing the number.
  All three mistakes on 24 Sep looked like interesting findings.
