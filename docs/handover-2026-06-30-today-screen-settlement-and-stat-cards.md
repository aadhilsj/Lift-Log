# Handover — 2026-06-30

This document is the restart point for the next Codex chat.

It captures:

- the current migration context
- what was built and verified for settlement confirmations
- what was changed on the Today screen
- what is green now
- what is still intentionally not shipped to live
- the recommended path from here

---

## 1. Branch / Repo Context

Workspace:

- `/Users/opera_user/Documents/Codex Space/Lift Log`

Current git branch:

- `codex/membership-safety-fixes`

Important operating context:

- migration is **paused**, not complete
- the live app has real users
- changes have been made conservatively, slice by slice
- user strongly prefers SQL pasted directly into chat whenever DB steps are
  needed
- there are unrelated dirty/untracked files in the worktree; do not touch or
  stage them accidentally

Primary migration pause checkpoint:

- [docs/handover-2026-06-28-migration-pause-checkpoint.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-06-28-migration-pause-checkpoint.md)

Other migration context that should still be treated as active background:

- [docs/handover-2026-06-26-blob-retirement-audit.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-06-26-blob-retirement-audit.md)
- [docs/handover-2026-06-24-read-composition-audit.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-06-24-read-composition-audit.md)
- [docs/handover-2026-06-24-mutation-audit.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-06-24-mutation-audit.md)
- [docs/relational-cutover-plan.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/relational-cutover-plan.md)

Default stance for the next chat:

- migration remains paused
- settlement / Today-screen polish has been the active product track
- do not assume this work has been pushed to production

---

## 2. Executive Summary

This session did three major things:

1. finished the canonical settlement-confirmation feature to the point where
   the **real functional flow is green on the Supabase preview branch**
2. reworked large parts of the **Today screen mobile UX**, including:
   - replacing the old greeting/button layout
   - adding the centered floating mobile plus button
   - replacing the old four stat cards with the new `PACE`, `TARGET`,
     `WEEK'S MVP`, `BLOC MONTH` cards
   - adding stat-card popovers / detail reveals
3. refined the settlement reminder cards and added a receiver-side
   **dispute action**

The current state is:

- local / preview behavior is working
- preview-branch settlement claim / confirm / dispute mechanics are in place
- user is broadly happy with the direction
- **this is not yet considered ready to push live**

The next chat should treat this as:

- a stabilized working branch
- with a still-open “final product polish + live rollout plan” phase

---

## 3. Settlement Feature Architecture

Settlement confirmations were built to align with the long-term migration plan:

- canonical SQL is the source of truth
- no new settlement-confirmation state is written back into the blob
- the server overlays canonical settlement confirmation rows into the readable
  app state
- the client derives settlement reminder cards from:
  - closed-month `monthHistory`
  - canonical `settlementConfirmations`

That means this feature is intentionally **migration-compatible**.

It should survive future blob-retirement / canonical-first migration work with
less rework than a blob-based implementation would require.

Earlier implementation docs:

- [docs/settlement-cards-implementation-2026-06-28.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/settlement-cards-implementation-2026-06-28.md)
- [docs/settlement-audit-2026-06-29-preview-branch.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/settlement-audit-2026-06-29-preview-branch.md)
- [docs/settlement-investigation-2026-06-28.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/settlement-investigation-2026-06-28.md)

---

## 4. Settlement Backend Status

### 4.1 SQL / canonical pieces added

Relevant SQL files now in the repo:

- [supabase/ante-core-settlement-confirmations-schema.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-schema.sql)
- [supabase/ante-core-settlement-confirmations-read-rpc.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-read-rpc.sql)
- [supabase/ante-core-settlement-confirmations-write-rpcs.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-write-rpcs.sql)
- [supabase/ante-core-settlement-confirmations-rls.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-rls.sql)
- [supabase/ante-core-settlement-confirmations-local-apply.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-local-apply.sql)

### 4.2 Preview branch

Hosted Supabase preview branch used for real testing:

- branch name: `settlement-test`
- preview project ref: `pukarpxsrmbnkbagyidg`

This branch was used because the live project could not be used for risky
testing, and local Supabase state was not a reliable full canonical baseline.

### 4.3 Real flow verification achieved

The real branch-backed settlement flow was explicitly tested and is currently
green:

- payer can mark settlement as paid
- receiver can confirm payment
- third parties see the intermediate pending state
- confirmed settlement disappears for all bloc members
- unpaid history can be seeded and re-tested on preview

This is the key point: the settlement-confirmation **mechanism** is not merely
mocked anymore. It has been verified against the preview branch.

### 4.4 Dispute behavior now added

Receiver-pending cards now have:

- a small secondary `X` action next to `Confirm`
- tapping `X` opens a confirmation prompt:
  - `Dispute`
  - `Cancel`

If dispute is confirmed:

- payer card reverts from pending back to `YOU OWE`
- receiver card reverts from pending back to `OWED TO YOU`
- third-party card reverts from pending back to unpaid

This applies immediately across the bloc through the same canonical settlement
overlay path.

### 4.5 What is green vs not fully proven

Green:

- canonical settlement table / RLS / read RPC / write RPC shape
- preview-branch claim flow
- preview-branch confirm flow
- preview-branch dispute flow
- realtime/overlay card disappearance after confirmation

Not yet fully proven:

- final live-environment rollout behavior
- production auth/session behavior in combination with this feature
- broader regression surface across all real blocs / edge cases
- final product placement for month-status / sit-out CTA after PACE CHECK was
  removed from standalone Today placement

---

## 5. Settlement UI Status

### 5.1 Reminder cards

Settlement reminders on Today were iterated heavily and are now visually close
to the approved direction.

Current implemented card states:

- payer unpaid
- payer pending
- receiver unpaid
- receiver pending
- third-party unpaid
- third-party pending

Current copy / visual shape includes:

- compact card sizing
- inline right-side amounts / actions
- refined section container treatment
- color-coded labels and amounts
- `5 unpaid` style header count
- no redundant sub-labels like `UNPAID` / `PENDING` below the body line
- third-party pending copy:
  - `[Name] paid [Name] · awaiting confirmation`

Additional receiver-pending dispute modal was also visually approved.

### 5.2 Refresh-delay issue

An earlier issue existed where the reminder would briefly disappear on refresh
and then appear after a short delay.

That was addressed by returning the correctly overlaid readable state from the
auth-sync path rather than the raw blob-backed sync state.

Practical current understanding:

- the severe glitch is no longer treated as a blocker
- if it reappears, re-audit the auth-sync / hydration overlay path first

### 5.3 Results screen consistency

Closed-month Results rows were moved to read canonical settlement-confirmation
state rather than relying on the old blob-only settlement toggle logic.

This is important because Today and Results should not drift into two separate
truth systems.

Results should continue to read from the same canonical settlement overlay.

---

## 6. Today Screen Changes Completed

### 6.1 Greeting removal

The old `Hey, [Name]` greeting area was removed from mobile. Desktop was left
alone intentionally for later.

### 6.2 Mobile nav plus button

The `Log Workout` action was moved into the mobile nav as a centered floating
cyan plus button.

Important constraint:

- desktop navbar was intentionally **not** changed
- desktop still keeps its older behavior for now

The plus button went through multiple sizing / offset passes. The approved
current direction is:

- larger floating circular button
- protrudes upward from the nav bar
- no label under it
- same action as the old workout-log CTA

### 6.3 Stat cards replaced

The old four cards:

- `WORKOUTS`
- `RANK`
- `NEED`
- `STREAK`

were replaced with:

- `PACE`
- `TARGET`
- `WEEK'S MVP`
- `BLOC MONTH`

The row layout and visual shell were kept close to the old compact card row,
but content logic was replaced.

### 6.4 Stat card content now

#### PACE

- shows delta vs required pace
- reuses the same pace logic already used in the old PACE CHECK section
- subtext shows target-by-today style info

#### TARGET

- shows remaining-to-target if target not hit
- shows target-hit state if MAS already reached
- old checkmark was removed
- replaced with a custom geometric target-hit icon
- prorated tag treatment was refined

#### WEEK'S MVP

- shows the member with the most logs in the current Monday-Sunday calendar
  week
- tie handling:
  - `Tied` for two-way
  - `N-way tie` for 3+
  - `—` if nobody logged this week

#### BLOC MONTH

- shows bloc total workouts for the current calendar month

### 6.5 Stat card visual cleanup

Several visual passes were done:

- labels are now more emphasized
- content is centered better
- label row is aligned consistently
- oversized value/name weights were reduced
- overflow on names / tie states was fixed with ellipsis/truncation behavior
- long label wrapping was corrected

The current stat card row is considered visually acceptable by the user.

---

## 7. Stat Card Tap / Popover Behavior

The four new stat cards now open details.

### 7.1 PACE

Tapping `PACE` opens the pace-detail popover using the existing pace-check
content.

Important:

- the standalone PACE CHECK section that used to live below the leaderboard was
  removed from that old location
- only the pace-detail content moved
- the old bundled month-status / sit-out functionality was **not** fully
  re-homed yet

This means there is still a product follow-up:

- where should month status / sit-out now live on Today?

Do not assume that problem is solved.

### 7.2 TARGET

Tapping `TARGET` opens the user’s month calendar view using the same general
calendar rendering logic that already existed elsewhere.

### 7.3 WEEK'S MVP

Tapping `WEEK'S MVP` opens a popover with:

- one member strip if there is a single winner
- multiple stacked member cards if tied

Each member section includes:

- the person’s name
- a Monday-Sunday strip
- day numbers
- workout icons in the day boxes
- today highlight

There was an important bug here:

- boxes initially rendered blank because date-display formatting was being used
  as data lookup keys

That was fixed by separating:

- human display formatting
- canonical `YYYY-MM-DD` lookup formatting

New helper added in code:

- `toISODate(...)`

This is important if the next chat touches weekly or calendar box rendering.

### 7.4 BLOC MONTH

Tapping `BLOC MONTH` opens a scrollable bloc month-history popover.

Current behavior:

- includes current calendar month at the top
- current month is visually highlighted
- months are most-recent first
- old horizontal activity bars were removed
- trend is shown with a small arrow only
- current month and oldest month do not show trend arrows
- rows now include small companion copy:
  - `workouts logged`

That was the last tweak from this chat before the handover request.

---

## 8. Blank Screen / Broken Interaction Bugs Fixed

Two critical UI issues happened during this work and were fixed.

### 8.1 Blank screen after stat-card popovers

Root cause:

- date formatting intended for display was being reused as a data lookup key
  inside the weekly MVP strip logic

Fix:

- preserve display formatting in `fmtISO(...)`
- add `toISODate(...)` for data-key usage
- use ISO keys for weekly strip log lookups

### 8.2 Stat cards not opening

Root cause:

- shared `Card` component did not forward click handlers

Fix:

The component now forwards remaining props:

```js
const Card = ({children,style={},className="",...props}) =>
  React.createElement('div',{className:`card ${className}`,style,...props},children);
```

That fix is important if the next chat sees “card taps do nothing.”

---

## 9. Files Most Relevant To This Work

### Main app surface

- [index.html](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/index.html)

This file contains the bulk of the Today-screen / popover / settlement UI
logic.

### Server / auth-sync / settlement overlay path

- [api/lift-log.js](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js)

### SQL

- [supabase/ante-core-settlement-confirmations-schema.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-schema.sql)
- [supabase/ante-core-settlement-confirmations-read-rpc.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-read-rpc.sql)
- [supabase/ante-core-settlement-confirmations-write-rpcs.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-write-rpcs.sql)
- [supabase/ante-core-settlement-confirmations-rls.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-rls.sql)

### Existing docs still relevant

- [docs/settlement-cards-implementation-2026-06-28.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/settlement-cards-implementation-2026-06-28.md)
- [docs/settlement-audit-2026-06-29-preview-branch.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/settlement-audit-2026-06-29-preview-branch.md)

---

## 10. Preview / Local Testing Pattern Used

There are two distinct test modes that were used.

### 10.1 Real preview-branch flow testing

This was used to prove the actual settlement mechanism.

Pattern:

1. point local app at preview branch
2. use localhost-only identity override
3. switch between payer / receiver / third-party member identities
4. run:
   - mark as paid
   - confirm
   - dispute
5. verify cross-view changes

This tested the real branch-backed flow.

### 10.2 Visual-only mock stack

For pure copy / spacing / color iteration, we also used the local preview mock
settlement stack.

That was useful when:

- no active unpaid cards existed
- user only wanted to inspect visuals
- no backend retest was needed

The next chat should keep these two modes separate:

- visual mock mode
- real preview-branch functional mode

Do not confuse them.

---

## 11. What The User Is Happy With Right Now

Broadly approved / accepted:

- settlement reminder visual direction
- receiver dispute modal
- mobile floating plus button direction
- current stat card row content and overall look
- stat-card popover system
- bloc month history shape
- settlement backend preview flow

The user explicitly said the settlement mechanism looked good after re-testing,
including:

- payer view
- receiver view
- third-party view
- pending state
- confirmation clearing

They also approved the recent dispute-modal visuals.

---

## 12. What Is Still Open / Not Final

### 12.1 Not yet pushed live

This work has **not** been treated as ready for production rollout.

Reasons:

- user is not fully done iterating
- at least one more Today/leaderboard-related product tweak was mentioned
- production rollout should be deliberate, not casual

### 12.2 Month status / sit-out placement

Because the old standalone PACE CHECK section was removed as a visible block,
its bundled month-status / sit-out affordance still needs a final home on
Today.

This should be flagged before shipping, not silently dropped.

### 12.3 Possible further Today / leaderboard polish

The user said they likely want at least one more Today leaderboard change
before considering a live push.

So the next chat should assume:

- Today screen is still under active product iteration

### 12.4 Desktop parity

Several changes were intentionally mobile-first:

- mobile plus button
- greeting removal behavior

Desktop is not fully caught up and should be considered a later pass.

---

## 13. Recommended Live Rollout Plan

When the user eventually wants to move this toward production, the safest path
is:

1. freeze product changes for the settlement / Today-screen slice
2. re-run preview-branch QA for:
   - payer
   - receiver
   - third-party
   - confirm
   - dispute
   - current-month and previous-month card display
   - stat-card popovers
3. verify there is a final answer for:
   - month-status / sit-out placement on Today
   - any remaining leaderboard tweak
4. review DB rollout status:
   - settlement confirmation schema
   - read RPC
   - write RPCs
   - RLS
   - any helper baseline assumptions
5. decide whether live should be:
   - directly enabled
   - hidden behind env flag first
6. only then ship to live in a controlled pass

Important:

- do not assume “works in preview” means “ship immediately”
- re-verify production-safe SQL order before any live apply

---

## 14. Suggested Restart Plan For The Next Chat

The next chat should begin by reading:

1. [docs/handover-2026-06-28-migration-pause-checkpoint.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-06-28-migration-pause-checkpoint.md)
2. [docs/settlement-cards-implementation-2026-06-28.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/settlement-cards-implementation-2026-06-28.md)
3. [docs/settlement-audit-2026-06-29-preview-branch.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/settlement-audit-2026-06-29-preview-branch.md)
4. this doc

Then:

1. inspect [index.html](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/index.html) and [api/lift-log.js](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js)
2. assume settlement/backend flow is green on preview unless new evidence shows
   otherwise
3. treat the next task as likely being:
   - more Today-screen product polish, or
   - planning the eventual live rollout

---

## 15. Practical Bottom Line

The key state at handoff is:

- migration work is still paused
- settlement confirmations are no longer just a mock idea; the real branch flow
  has been validated
- Today screen has been significantly redesigned
- most active work now is product polish and rollout discipline, not core
  settlement mechanism invention

If the next chat needs a single sentence summary:

> The settlement-confirmation system is functionally green on the preview
> branch, the Today screen has been heavily reworked and mostly approved, but
> this is still a pre-live polish phase and should not be treated as fully
> production-ready yet.
