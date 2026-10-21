# Concept — settlement notes, and "the chooser"

Written 23 September 2026, from a conversation between Aadhil and Claude the
same day. **Nothing here is built.** This is a parked idea, kept so it can be
picked up properly later.

Background: Aadhil spent about 90 minutes at **iHub** (an incubator at the
science park) on 23 September. The advisor's framing was that **community is
Fero's moat** — competition matters at the individual level, but what separates
Fero from Strava is that it is your actual friends. Her suggestion was to push
every feature toward the people, including the penalty.

---

## What the penalty does today

- Everyone below their own target **and** below the top count pays the fine.
- That total is split among whoever trained the most.
- It settles as person-to-person debts, with claim → confirm → dispute.

Three things about that shape came up as problems:

1. **The money goes to whoever needed it least** — the top performer collects.
2. **Most of the Bloc has no stake.** In a seven-person month, one person wins,
   three or four quietly clear and get nothing at all, the rest pay.
3. **The money is abstract**, and abstract money is easy to leave unpaid — which
   is why the reminder cards, the "N unpaid" nudges and the claim/confirm flow
   exist in the first place.

---

## Part one: the note (being mocked up now)

Whoever is owed writes one line saying what the money is going toward — "new
climbing shoes", "physio I keep putting off". The person paying sees it on the
settlement card.

Why it is worth doing on its own:

- It turns a number into a thing, which is **harder to leave sitting for three
  weeks**. This is a settlement-rate argument, not just a mood one.
- It is small: one text field for the receiver, one line on the payer's card. No
  change to any calculation, no new screen.

---

## Part two: the chooser — PARKED

**Aadhil's decision on 23 September: hold this, get feedback from the existing
user base and the team first, then decide.** He likes it; he wants evidence
before committing.

The idea, as it ended up:

- **Everyone who clears writes a note** about what they would put the money
  toward.
- **The person who missed picks which note to fund**, instead of the money going
  automatically to the top trainer.

Why this shape and not an earlier one: picking a *person* means four friends
find out they were not chosen, every month. Picking a **thing to fund** means
nobody was snubbed — someone's shoes just won. That reframing was Aadhil's, and
it is what makes the mechanic warm instead of pointed.

What it would change:

- **Clearing your target gains an upside for the first time.** Today, clearing
  without being top earns you nothing at all.
- **One person stops collecting every month**, which is what makes the money feel
  pointless to everyone else.
- It adds the first human moment in the whole penalty flow.

The cost: winning is less lucrative. The winner still has the ring, the top of
the Bloc and the awards.

### Guardrails — the conclusion was "start with none"

The worry was one popular person being funded every month. Where it landed:

- **The choices are independent.** Three people who missed make three separate
  picks, and the notes change every month, so piling up on one person takes
  repeated coincidence.
- **A lockout creates a worse problem**, which Aadhil spotted himself: telling
  someone "you were funded last month, you're out" means their clear does not
  count this month.
- **If it happens, the founder dashboard will show it**, and a rule can then be
  written to fit the real pattern instead of an imagined one.

If something lighter than a rule is wanted: show, beside each note, who has not
been funded in a while ("Sofie hasn't been funded this year"). Information, not
enforcement. Nobody is ever blocked.

### It must fall back cleanly

If nobody writes a note, or the person paying does not choose, it settles
**exactly as it does today** — straight to the top trainer. Nothing waits on
anybody, and a Bloc that ignores the feature never notices it exists.

---

## Ideas considered and rejected on the way

- **Commercial partners on the penalty money.** Rejected: the moment money flows
  to a company instead of between friends, the thing that makes it feel fair
  breaks, and it drags Fero into payments licensing.
- **Making Activity the landing screen.** Rejected: Today is where people *act*.
  Moving the door pushes logging — the action the product depends on — further
  away. Bring community into Today instead, which the Bloc streak and Bloc Loop
  cards already do.
- **A Bloc kitty the group decides on.** Rejected: it needs a monthly group
  decision, with no answer for "what if nobody decides".
- **The winner "hosts" the pot.** Rejected: the app would be narrating something
  it cannot make happen.
- **The open loop** — a month ending short stays open seven days and the Bloc
  closes it in workouts. Parked separately, see below.
- **A non-financial forfeit** (a mark on your avatar for a month). Rejected by
  Aadhil: there is nothing to lose, so everybody would take it. This produced a
  useful rule of thumb: **only money and effort have real cost.** Anything
  softer, people accept for free.
- **Money follows improvement rather than dominance.** Raised with a warning —
  Biggest Turnaround was already removed from the awards, so this family of idea
  has been rejected once.

## Also parked: the open loop

A month that ends short stays open for the first seven days of the next month,
carrying a debt in workouts rather than money. Clear it and nothing settles.

It was parked because the first version was broken and the fix made it something
else:

- **Broken version:** every workout counted toward both the debt and the logger's
  new target, so an active Bloc closed it by accident by about day four, and the
  chronic misser was carried forever. Aadhil caught this.
- **Fixed version:** only people who fell short can clear their own shortfall,
  and those workouts do not count toward their new month.
- **Then the spiral:** miss eight, and next month you need eight on top of
  fourteen. You fail again, owe more, and it compounds until you leave.
- **The version that survives:** offered only to near-misses (short by 1–3), it
  never carries into a second month, and short by 4 or more means you simply pay.

At which point it is **no longer a community idea at all** — it is a personal
second chance. Which is why it is parked rather than pursued.

---

## Next step

Mock up the note, using the app as it looks today, whole screens. Then gather
feedback on the chooser before deciding anything.
