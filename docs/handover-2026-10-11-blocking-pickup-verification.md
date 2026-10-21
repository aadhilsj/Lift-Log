# Handover — 11 October 2026: picking up the blocking branch, and verifying it

**Status: open, and handed on deliberately.** The founder stopped this session
part-way to continue in another one. Nothing is half-finished on disk: no code
was changed, and the branch is exactly as the session before left it, plus two
documentation commits.

## Why this session exists

The previous session — the one that wrote the blocking and reporting work —
ran out of credits mid-flight. It had committed all six commits but had
verified **nothing**: the "Verified before publishing" and "Commits" sections
of its own handover were still blank placeholders.

The founder asked this session to find that work and finish it if it was safe
to do so. It was safe to verify. It was **not** safe to ship, for one specific
reason recorded below.

## Where the work is

| | |
| --- | --- |
| Branch | `claude/blocking-and-reporting-2026-10-11` |
| Worktree | `/Users/opera_user/Developer/FERO/blocking-2026-10-11` |
| Ahead of `origin/main` | 6 commits of work + 2 of documentation |
| `origin/main` an ancestor? | Yes — nothing to rebase |
| Pushed? | **No.** |
| Live? | **No.** |

The full account of the feature itself — the design, the four instructions of
11 October, the one-way-blocking finding and the plan — is in
[`handover-2026-10-11-blocking-and-reporting.md`](handover-2026-10-11-blocking-and-reporting.md).
Read that one first. This file only records the pickup and what was checked.

## What was verified, and how

Lint and build are clean. `test:content-safety`, `test:two-workouts`,
`test:identity` and `test:founder-dashboard` all pass.

Every new screen was loaded in a browser at 375x812 against the sandbox,
signed in as `riley@local.test`, with no console errors on any of them:

- the **Safety -> Blocked** row on the account screen, sitting between Account
  and Delete account;
- the **Blocked** panel, with its empty state;
- the centred **report-or-block** menu, opened from a post in the Activity
  Feed;
- the **report reason** dialog, and a report sent without error;
- the **block confirm**, and blocking Jo, after which her posts left the feed
  immediately.

All four of the founder's instructions of 11 October are met on screen: the
heading is just the person's name, the wording follows Instagram, every pop-up
is centred rather than a bottom sheet, and the block confirm states the
interaction guard in words.

## Two things that look like failures and are not

Both were chased down rather than assumed, because reporting either as a bug
would have been wrong.

**The Blocked list reads empty right after you block someone.** That is the
sandbox, not the code. `scripts/sandbox-supabase.mjs:179` answers every
`/rest/v1/rpc/` address with `200 []`, so the write appears to succeed and the
read back finds nothing. The feed still hides the person because the client
holds that in state.

**`test:mobile-navigation` fails.** It has nothing to do with this branch,
which touches no seed or rollover code. The test signs in as
`seed-invite@local.test` and waits for "Your Blocs"; in the current sandbox
blob that address was never onboarded, so it gets the display-name screen
instead. Re-seeding from scratch does not help: the seed's rollover step dies
with `canonical logs empty for 2026-7 while blob counted 30`, the same
documented sandbox limitation.

**What this means:** whether a block or a report actually *persists* is still
unproven. It cannot be proven in a plain sandbox. It needs the restored-copy
route in the 2026-09-16 handover, or production.

## The blocker — read this before shipping anything

`supabase/migrations/20261011090000_add_block_interaction_guard.sql` has
**not** been applied to production. Schema goes first as a matter of course,
but here the two halves of the guard behave differently if the code lands
first, so the order matters more than usual:

- `isInteractionBlockedByTarget` wraps its lookup in try/catch and fails open
  on purpose. Comments on workouts, and reactions to workouts, are safe either
  way — the guard simply would not bite.
- `readWorkoutLogCommentAuthorFromCanonical`, called bare at
  `api/lift-log.js:10070`, is **not** wrapped. `supabaseFetch` throws on any
  non-2xx, PostgREST answers 404 for a function that does not exist, and the
  outermost handler at `api/lift-log.js:11406` passes that 404 to the client.
  Shipping the code before the migration therefore **breaks adding a reaction
  to a comment, for everyone.** Removing one is unaffected: the guard only
  runs when `isAdding === true`.

This session could not apply the migration. It has no Supabase MCP and no
production credentials — the worktree's `.env.local` points at the local
sandbox only. Applying it needs a session that has them.

## Where to pick up

Three things are open, in order.

1. **Apply the migration to production**, then verify it the usual way: the
   two functions exist, and `anon` and `authenticated` cannot execute either
   of them. The migration already revokes both and grants only `service_role`.
2. **Decide on the hardening.** Wrapping the author lookup at
   `api/lift-log.js:10070` the way its sibling is wrapped is a small change
   that makes the deploy order stop mattering at all. It was recommended and
   **not made** — the founder had not answered when the session was handed on,
   so no code was touched. It is his call.
3. **Then decide where it goes** — preview or straight to `main` — and only
   then push and deploy. Since 2026-09-17 the answer has usually been `main`,
   but it has not been asked for this change.

Worth knowing: block and report persistence should be confirmed on production
once the migration is in, since the sandbox can never show it.

## Housekeeping done

The previous session's sandbox was still running from the night before. It was
stopped by PID — not `pkill` — and restarted, and is up on ports 3000 and
54321 serving this branch's build. Its data file was backed up to the
scratchpad before being touched, and the original blob was restored, so the
Bloc of Riley, Jo and Sam is intact. The browser viewport was reset.

## Commits

| Commit | What |
| --- | --- |
| 0775a3c | Fill in the previous session's blank "Verified" and "Commits" sections, and record the migration that must go first |
| (this one) | This pickup handover |

Both are documentation only. **No line of the feature work was changed by this
session**, and nothing has been pushed.
