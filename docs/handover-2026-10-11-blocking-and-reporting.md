# Handover — 11 October 2026: blocking and reporting

**Status: open.** Bringing the September UGC safety work back to life on today's
`main`, redesigned to the founder's instructions, plus the two pieces that were
never built.

## Why this session exists

Apple's guideline 1.2 requires four things of any app with user-generated
content: a filter, a way to report, the ability to block, and published contact
details. The contact details went live on 10 October with the Support page.

The other three were all built in September on `codex/app-store-readiness` and
never shipped. The database half is **already applied to production** — the
tables `ante_core.user_blocks` and `ante_core.content_reports` and six
functions exist and are correctly locked to `service_role` only. Both tables
have zero rows. Only the app code is missing.

That branch cannot be merged: it predates all of October and would revert the
Profile tab, the Today redesign and the month close. So the eight relevant
commits are being ported instead.

## What the founder asked for, 11 October

1. The sheet's heading becomes just the person's name, not "Safety options for".
2. Wording follows the conventions of Instagram, Facebook and Strava.
3. **Every pop-up is centred on the screen, not a sheet from the bottom.**
4. Blocking also stops the blocked person commenting on or reacting to the
   blocker's workouts. (Added after the review below.)

## The finding that changed the design

`read_ante_core_user_blocks` returns only the people *you* blocked, and the
filtering happens in the client. Fero's block is therefore **one-way**: you
stop seeing them, they carry on seeing you.

That is weaker than it sounds. A blocked member could keep commenting on the
blocker's workouts, visible to everyone else in the Bloc, while the blocker
cannot see it happening.

Two-way invisibility is impossible here — a Bloc shares one leaderboard, and
hiding a member from it breaks the product. So the agreed middle ground is:
one-way for *seeing*, plus a server-side guard that stops a blocked member
*interacting* with the blocker. That also answers Apple's wording, "the ability
to block abusive users from the service", far better than hiding alone.

Apple does not state a required direction for blocking, and reviewer practice
is inconsistent, so this cannot be made certain — only more defensible.

## Plan

- Port the eight commits onto `main`, re-attaching the controls to the screens
  as they look now.
- Replace the bottom sheet with the app's existing centred `ModalScrim`, which
  already portals to `document.body` per the playbook.
- Two steps, Instagram-style: a short menu, then either a block confirm or a
  reason list.
- Build the Blocked list, reachable from the Account pop-up. Nothing today can
  undo a block.
- Add the interaction guard: one new reverse-direction database function and
  guards on the three write paths (`log-comment-create`,
  `log-comment-reaction`, `reaction`).
- Record the three already-applied migrations in `supabase/migrations`.

## Verified before publishing

Filled in as the session runs.

## Commits

| Commit | What |
| --- | --- |
| (this one) | Open the handover before the first change |
