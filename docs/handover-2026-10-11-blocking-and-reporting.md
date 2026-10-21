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

The session that wrote the six commits below ran out of credits before it
verified anything. A second session picked the branch up on 11 October and
checked it without changing a line of the work.

**Clean:**

- `npm run lint` — no findings.
- `npm run build` — succeeds.
- `test:content-safety`, `test:two-workouts`, `test:identity`,
  `test:founder-dashboard` — all pass.
- Every new screen loads at 375x812 with no console errors: the Safety ->
  Blocked row on the account screen, the Blocked panel, the centred
  report-or-block menu, the report reason dialog and the block confirm.
- The four instructions of 11 October are all met on screen: the heading is
  just the person's name, the wording follows Instagram, every pop-up is
  centred rather than a bottom sheet, and the block confirm states the
  interaction guard in words.
- Blocking Jo removed her posts from the Activity Feed straight away, and the
  report submitted without an error.

**Not verified, and why:**

- *Whether a block or a report actually persists.* The sandbox answers every
  `/rest/v1/rpc/` address with `200 []`
  (`scripts/sandbox-supabase.mjs:179`), so the write appears to succeed and the
  Blocked list then reads back empty. That empty list is the sandbox, not a
  bug. Proving persistence needs the restored-copy route in the 2026-09-16
  handover, or production.
- `test:mobile-navigation` fails on this branch **and has nothing to do with
  it** — the branch touches no seed or rollover code. It signs in as
  `seed-invite@local.test` and waits for "Your Blocs"; in the current sandbox
  blob that address has never been onboarded, so the screen asks for a display
  name instead. Re-seeding from scratch does not fix it either: the seed's
  rollover step fails with "canonical logs empty for 2026-7 while blob counted
  30", the same documented sandbox limitation as above.

## The one thing that must happen before this ships

`supabase/migrations/20261011090000_add_block_interaction_guard.sql` has
**not** been applied to production. Schema goes first, as always — but here it
is sharper than usual, because the two halves of the guard behave differently
if the code arrives first.

`isInteractionBlockedByTarget` was deliberately written to fail open: its
lookup is wrapped in try/catch, so a missing function just means the guard
does not bite. Comments on workouts and reactions to workouts are therefore
safe either way.

`readWorkoutLogCommentAuthorFromCanonical`, at `api/lift-log.js:10070`, is
**not** wrapped. `supabaseFetch` throws on any non-2xx, and PostgREST answers
404 for a function that does not exist, so the outermost handler
(`api/lift-log.js:11406`) returns that 404 to the client. The effect, if the
code ships before the migration: **adding a reaction to a comment fails for
everyone.** Removing one is unaffected, because the guard only runs when
`isAdding === true`.

Two ways out, and they are not exclusive:

1. Apply the migration first, then deploy. This is the normal rule and it is
   sufficient.
2. Wrap the author lookup the way its sibling is wrapped, so the order stops
   mattering at all. One small change, inside the task, not yet made — the
   founder's call.

## Commits

| Commit | What |
| --- | --- |
| 2bc0ea8 | Open the handover before the first change |
| 3d27291 | db: record the September moderation schema, add the block interaction guard |
| 9c27372 | api: blocking, reporting, the moderation queue and the content filter |
| d913610 | Report and Block on the four surfaces that show other people's content |
| 95f80f0 | The Blocked list, and the report queue on the founder dashboard |
| 38cdcaa | Move Blocked onto the account screen, where people actually look |

All six are on `claude/blocking-and-reporting-2026-10-11` only. **Nothing is
live.** The branch sits 6 commits ahead of `origin/main` and `origin/main` is
an ancestor of it, so it is ready to push once the founder says where it goes
and the migration has been applied.
