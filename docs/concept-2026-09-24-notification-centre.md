# Concept — the notification centre

From Aadhil, 24 September 2026. **Nothing is built.** This captures the idea
while it is fresh, so it can be designed properly in its own session.

## What it is

A **bell in the top right**, beside the Bloc Stream and settings buttons. It
opens **everything that involves you** — one place, personal to you, that the
Bloc's shared surfaces do not give you today.

## What goes in it

Anything where somebody else's action touched you:

- Somebody **reacted** to one of your logs.
- Somebody **commented** on one of your logs.
- Somebody **tagged you** in the Bloc Stream.
- Somebody **tagged you** in a comment thread.
- **Payment reminders from the system** — "this is still outstanding" — repeating
  on a slow cadence, every two or three weeks, not daily.
- **"Leave a note"** — the system asking whoever is owed to say what the money is
  going toward. (See the settlement-note concept from 23 September.)

## How items behave

- Most rows are **information**: this person liked your log, this person
  commented.
- Tapping a row should take you to **the thing itself** — the log in Activity,
  the comment thread, or the Bloc Stream scrolled to the message you were tagged
  in. Aadhil was explicit that this is the preference but not a hard
  requirement: a purely static list that you only read would also be acceptable
  for a first version.
- Some rows are **actionable and should stay at the top** — starred or pinned —
  **until they are done, reviewed or dismissed.** "Leave a note" is the example:
  it sits at the top until the note is written. The principle he stated is that
  it must be **very easy to act on**.

## Why this is the right home for two things already floating

1. **The settlement note prompt.** Asking the person who is owed to write their
   note does not belong on the Today reminder card — that card is already
   carrying the month, who owes whom, the shortfall, a payment link and the
   amount, and adding to it made it unreadable (tested 23–24 September). A
   personal, actionable, dismissible prompt is exactly what a notification
   centre is for.
2. **Payment reminders.** Today these live as persistent red cards on Today. A
   slow, personal nudge in a notification centre is a gentler instrument than a
   permanent red card on the home screen.

## What exists already, and what does not

Worth checking before designing:

- The **Bloc Stream** already has system moments (`SYSTEM_KIND_META` in
  `src/pages/BlocStream.jsx`): member joined, target hit, month closed, awards,
  settlement paid, settlement confirmed, and more. Some of these are Bloc-wide,
  not personal — a notification centre is a *different* cut of the data: filtered
  to you.
- Nav already carries an **unread count** for the stream (`streamUnreadCount`)
  and an **activity alert count** (`activityAlertCount`), so the idea of a badge
  is established.
- Reactions and comments exist on logs, with counts.
- **Tagging/mentions** exist in the stream (there is mention-matching in
  `BlocStream.jsx`).

Unknown and needs proper work: whether there is any per-user "seen" state to
build read/unread on, and where that would be stored.

## Open questions for the design session

- Read/unread, and where that state lives.
- How far back the list goes, and whether it is grouped by day.
- Whether the bell replaces the existing activity alert badge or sits beside it.
- Whether anything here should ever become a real push notification.

## Status

Aadhil: *"I think that's a good place and I think that's a cool thing that we
should look to build anyway."* A direction, not yet a commitment to build.
