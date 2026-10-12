# Handover — 11 October 2026 (session 2): the blocking migration, and the app-opens figure

**Status: open.** Claude, operating. This is a live handover, updated as the
session goes.

Second session of 11 October. The first one's two docs
(`handover-2026-10-11-blocking-and-reporting.md` and
`handover-2026-10-11-blocking-pickup-verification.md`) are **not** written into
by this session.

Previous session: `handover-2026-10-11-blocking-pickup-verification.md` (open,
handed on deliberately).

---

## Where we stopped — read this first

1. **The blocking branch's one blocker does not exist.** The migration
   `20261011090000_add_block_interaction_guard.sql` **was already applied to
   production** before this session started. See §2.2. The previous session
   recorded it as unapplied and named it as the one thing that must happen
   before shipping; that is now corrected.
2. Nothing was changed, pushed or deployed by this session. No write SQL ran.
3. The branch `claude/blocking-and-reporting-2026-10-11` is still 8 commits
   ahead of `origin/main`, still unpushed, still not live.

---

## 1. Where things stood at the start

- Live website: `c897ac6`, bundle `index-ktU5fSot.js`, Vercel Production
  success. CI green on the last five runs on `main`. No open PRs.
- TestFlight still build 10.
- The shared checkout at `~/Documents/Codex Space/Lift Log` is **14 commits
  behind `origin/main`**. Everything in this session was read from
  `origin/main`, not from that disk.
- The blocking worktree at `~/Developer/FERO/blocking-2026-10-11` is clean
  (only an untracked `node_modules` symlink).
- A sandbox from the previous session is still up on ports 3000 and 54321
  (PIDs 1681, 1682).

## 2. What happened, in order

### 2.1 Catch-up performed, this handover opened

Read `docs/HANDOVERS.md` §1, `docs/WHATS-LIVE.md`, the 9 October active
handover in full, the 10 October legal-pages handover, and both of today's
blocking docs. Checked the workspace, remote refs, GitHub CI, Vercel
deployments and the live bundle. Nothing changed.

### 2.2 Correction: the block interaction guard is already in production

The founder approved applying the migration. Before applying it, the
before-state was recorded — and the work turns out to be done already.

Read-only checks against production (`bpvvvqjsfwmmfjvvijkd`):

| Check | Result |
| --- | --- |
| Both functions exist in `public`? | **Yes** — `read_ante_core_blockers_of(text)` and `read_ante_core_workout_log_comment_author(uuid)` |
| Do their bodies match the migration file? | **Yes, exactly** — compared via `pg_get_functiondef` against the file, character for character |
| Migration history | **`20261011010106 add_block_interaction_guard`**, applied 11 Oct ~01:01 |
| Grants | `{postgres=X/postgres,service_role=X/postgres}` on both — `anon` and `authenticated` **cannot** execute either |
| Row counts, untouched | `user_blocks` 0, `content_reports` 0, `workout_log_comments` 286, `profiles` 48 |

So the first session of today *did* apply it, and the pickup session that
followed concluded it had not — it checked the worktree's `.env.local` and its
own lack of credentials, but never the production migration history.

**Nothing was applied by this session.** `apply_migration` was not called;
there was nothing to apply. All five queries above are reads.

**What this changes:** the "one thing that must happen before this ships" is
already done. The 404-on-reaction-to-a-comment risk the previous session
described cannot happen, because the function it would 404 on exists. The
deploy-order hazard is gone.

Still open from that session, and still the founder's call: whether to wrap the
author lookup at `api/lift-log.js:10070` the way its sibling is wrapped (now a
belt-and-braces change, not a prerequisite), and whether the branch goes to a
preview or straight to `main`.

Still true: whether a block or a report **persists** has never been proven. The
sandbox answers every RPC `200 []`. It needs production.

### 2.3 Answered: average app opens per day

The founder asked for the all-time daily average. Read
`docs/READ-BEFORE-ANALYSING-FERO-NUMBERS.md` first, per §11, then read the
metric's own definition rather than inventing one: App Opens come from
`ante_core.app_daily_activity.open_count`
(`supabase/migrations/20260924120000_fix_founder_dashboard_metrics.sql:291`),
where returning after 30+ minutes counts as a new open.

**The honest window is 24 September onward.** Before that the table holds one
open per active person per day, backfilled — a floor, not a count. The all-time
average of 25.7/day therefore understates reality and was not quoted as the
answer.

| Window | Opens/day |
| --- | --- |
| 24 Sep – 11 Oct (exact) | **34.6** |
| 24 Sep – 10 Oct (excluding today, still in progress) | **35.1** |
| All time incl. backfilled floor — do not quote | 25.7 |

Supporting figures, same exact window: 622 opens over 18 days; ~21 people open
it on a given day; **1.65 opens per person per day**; 40 of 48 accounts opened
it at least once (83%); DAU/MAU **52%**.

Caveat recorded: the founder counts one open per day only in this metric, so the
true human total is marginally higher.

Observed and deliberately **not** presented as a trend: the last four days
(30, 26, 18, 25) sit below the 24 Sep – 1 Oct run (39–54), with 10 Oct the
lowest in the window at 18 opens from 14 people. Eighteen days is too short,
and the 1 October month close plus the September Recap banner is a plausible
cause of the earlier peak.

### 2.4 The week's plan, and Monday executed

The session ran past midnight; entries from here are **12 October**. The
founder asked for a week-by-week plan aimed at App Store submission this week,
one substantial task a day, and said to start on Monday's.

**The finding that shaped the plan: `main` has no `ios/` directory.** The
iPhone project exists only on `testflight-build-10`, `testflight-build-11`,
`codex/app-store-readiness`, `feat/safe-area` and
`claude/rls-correction-2026-09-30`. `testflight-build-11` is **63 commits
behind `main`**, so none of October's work has ever been compiled into the
app. Submitting means merging October into the TestFlight lineage and building
12 — the critical path, and the riskiest step of the week, because the
playbook records swipe and reactions breaking after merges.

**Xcode is not installed on this laptop** — only the Command Line Tools
(`xcode-select -p` is `/Library/Developer/CommandLineTools`, and there is no
`Xcode.app` anywhere). The build day cannot happen here.

The agreed week: Mon safety + the delete bug; Tue the profile header redesign
and removing photo-change from account settings, then **feature freeze**; Wed
the merge and build 12; Thu the reviewer environment; Fri screenshots, the
recording and App Review notes; Sat the final test matrix and **submit**; Sun
spare. Push notifications are deliberately out of scope for the week.

### 2.5 Monday: blocking and reporting are live — `c20fba6`

Pre-flight on the branch: `origin/main` an ancestor, worktree clean, lint and
build clean, **24 of 26 suites pass**. The two failures are
`test:auth-edge-flows` and `test:mobile-navigation`, the known pair that fails
on `main` too.

All four moderation migrations confirmed applied in production before pushing:
`add_ugc_moderation`, `add_founder_content_removal`,
`add_workout_post_moderation` and `add_block_interaction_guard`. All seven
moderation functions exist and carry `{postgres=X/postgres,service_role=X/postgres}` —
`anon` and `authenticated` cannot execute any of them.

Pushed `c897ac6..c20fba6` with `--force-with-lease`. Vercel Production
deployment `7010652066` success; live bundle `index-L815rw6m.js` contains
"Harassment or bullying", "Send report", "Threat or safety concern",
"Hate or discrimination" and "Unable to block this member."; the live site
loads with no console errors; CI green.

### 2.6 Monday: the legal pages describe blocking again, and the delete bug is fixed — `45d3fd2`

**Legal pages.** Three sentences restored, exactly the ones removed on
10 October: "blocks" back in the list of records Fero holds, "Reports and
blocks can affect visibility and moderation", and the Support page pointing at
"the report and block controls in the app for content or member-safety
concerns" rather than only the report control on an opened photo — reporting
now covers the activity feed, the Stream, comments and profiles. Nothing else
in the legal wording, colours or layout was touched. Verified live on both
`lift-log-nu.vercel.app` and `joinfero.app`.

**The delete bug.** A member reported that the Profile tab's calendar could not
delete a workout, while the same calendar reached from Today could.

The cause was not the calendar. `PlayerProfile` only offers delete when it is
given an `onDeleteLog` handler (`canDelete`, `src/pages/PlayerProfile.jsx:725`),
and that handler lived inside `TodayPage`. Rendered as the Profile tab from
`App.jsx:3553` it was never passed, so the tap fell through to the read-only
workout detail popup with nothing explaining why. **Month and All Time had the
same gap** and nobody had reported them.

Fixed by moving the deleter to `src/lib/ownLogDelete.js` as a factory, so there
is one implementation rather than four, and building it once in `App.jsx` for
the three screens that lacked it. `TodayPage` now uses the same factory; its
behaviour is unchanged, code for code.

**Also answered, no change made:** pressing "Delete workout" does **not** ask
again. The first pop-up is the confirmation. A second step exists only when the
same workout also sits in other Blocs, and that one asks about scope — "Delete
from your other Blocs too?" — not "are you sure". The founder thought a double
confirm had been built; it has not, and he has not asked for one.

**How the fix was verified.** The sandbox's seeded logs are August-dated and
not canonical, so deleting one returns 404 "Workout not found" — that is the
documented seed limitation, not the wiring. A clean workout was logged for
today through the real API instead (`add-log`, which also triggered the
documented rollover), and then deleted through the Profile tab: the centred
delete modal opened with the right workout ("Gym, Mon 12 Oct"), confirming it
removed the workout, and a read-back showed **zero logs for that date**.

**Not verified:** Month and All Time were wired the same way and pass lint and
build, but the sandbox UI could not be driven far enough to click through
either. They are unproven.

Lint, build and twelve suites clean. Pushed `c20fba6..45d3fd2`; Vercel
Production deployment `7011624626` success; live bundle `index-CPFNjcPW.js`;
no console errors; CI green.

**The one Monday item not done:** proving a block or a report persists on
production. Both tables still hold zero rows. Proving it means blocking one
real member with another real account, which was not something to do
unasked — it belongs with Thursday's seeded review accounts.

### 2.7 The Stream went blank for a few hours — my regression, fixed and live

**Reported by the founder**: opening the Bloc Stream gave an empty screen.

**Cause, and it was shipped by this session this morning.** In
`src/pages/BlocStream.jsx`, `visibleMessages` was computed *above* the
`useBlockedUserIds()` call that declares `blockedUserIds`. Reading a `const`
before its declaration throws — but the `filter` callback only runs when the
array has at least one element. So an **empty Stream worked and any Stream
with one message took the whole app down** with
`ReferenceError: Cannot access 'blockedUserIds' before initialization`.

**Why it got through.** The previous session verified every new screen in the
sandbox, and the sandbox Stream had no messages. The one case that does not
crash is the case that was tested. Lint does not catch it: the
correctness-only config has no `no-use-before-define`.

**Reproduced before fixing**, per §3 of the agreement: sending one message in
the sandbox collapsed `document.body.innerText` to empty with that exact error
through `Array.filter` in the console. After the fix, the same action leaves
the Stream and the app intact.

The fix moves the line below the hook, with a comment saying why it must stay
there. `ActivityFeed` and `LogCommentThread` use the same hook and **already
order it correctly** — both were checked and neither was changed.

**Known and deliberately not changed:** the empty state still tests
`messages.length === 0` rather than `visibleMessages.length === 0`, so blocking
every author would show an empty list instead of "No messages yet". Out of
scope for a crash fix; worth a decision later.

### 2.8 Vercel stopped deploying, and a stray project was created

`58c713c` was pushed at 11:00 UTC with CI green. **Vercel's GitHub integration
did not build it** — the last automatic build was 10:17 UTC for `b57ddfc`.
After ~15 minutes an empty commit (`974037f`) was pushed to nudge it; that did
not build either.

**A mistake worth recording.** `vercel --prod` was then run from the worktree
at `/Users/opera_user/Developer/FERO/blocking-2026-10-11`, which carries no
`.vercel` link. Instead of deploying `lift-log`, the CLI **created a new
Vercel project named after the folder**, `blocking-2026-10-11`, and deployed
there. It never touched the live site. The worktree was relinked to
`lift-log` by writing the correct `projectId`/`orgId` into
`.vercel/project.json`, and the stray project was deleted with the founder's
yes (`vercel project rm`). The remaining projects are unchanged and `lift-log`
still serves `joinfero.app`.

**Lesson for any future worktree:** a scratch worktree has no `.vercel`
directory. Copy it in alongside `.env.local`, or never run `vercel` from one.

**Live and verified.** Bundle `index-BeXozYvV.js` on
`lift-log-nu.vercel.app`; the minified Stream component now reads
`{blockedUserIds:_,...}=E0(),z=E.filter(...!_.includes(...))` — hook first,
filter second. `joinfero.app` and `lift-log-nu.vercel.app` both answer 200 and
the live site loads with no console errors.

**Still unknown:** whether Vercel's automatic deploys have recovered, or
whether the build that landed was the CLI one. **This matters before
Wednesday**, when the TestFlight build happens on the other MacBook.

### 2.9 Press and hold replaces the `...` — live at `94f1698`

The founder checked the live PWA, confirmed blocking and reporting all work,
and said the `...` looked wrong on the Stream and the Activity feed. He asked
for Instagram's interaction instead.

**Researched first, and the honest finding: there is no public Instagram
spec.** No credible teardown gives durations, easing or blur values. But the
interaction is not an Instagram invention — it is the **iOS context menu**
(`UIContextMenuInteraction`), which Instagram and Messages both use. That is
documented, so there is a correct thing to match rather than a guess.

Three rules from it, which are the whole feel:

1. The pressed thing stays **sharp** and lifts; everything else blurs and dims.
2. The menu is **anchored** to it and slides only enough to stay on screen.
3. Lift, blur and menu run off **one** transition — separate timelines are
   explicitly what makes a homemade copy feel wrong.

New `src/components/HoldMenu.jsx` with two exports: `HoldMenu` (the overlay)
and `HoldTarget` (a wrapper for anything that is one big element, used by the
feed). It portals to `document.body`, because the Stream and the profile sit
inside transformed parents — the playbook rule.

**Reactions appear on the Stream and not on the feed, deliberately.** The
founder pointed out every feed card already has a `+` for reactions, so
repeating the emoji row there was noise; on the Stream, holding is the only way
to react to a message. Holding your own content now opens nothing at all.

**Report and Block skip a step.** They used to open a `name / Report / Block`
sheet; the hold menu has already asked, so `SafetyFlow` takes an optional
opening step and goes straight to the reasons or the confirm.

**Haptics:** the hold fires `tapMedium`, so it is real on TestFlight and
silent on the PWA — like every other haptic in Fero. Recorded because the
founder will test on the PWA and feel nothing; that is expected, not a bug, and
not a reason to change the animation.

**A bug caught in review before shipping:** `HoldTarget` wrapped `onPick` in
its own arrow function, so `HoldMenu` always received a truthy handler and drew
the reaction row even where the caller wanted none. It now passes the handler
through only when one was given.

**How it was verified.** Both surfaces at 393x852 with real content: hold opens
the menu, a reaction lands on the post, tapping outside dismisses, moving the
finger scrolls instead, Report opens the reasons, Block opens the confirm, and
nothing opens on your own content.

**The Stream needed a harness.** The sandbox answers `stream-list` with an
empty list, which is why the Stream has never had messages locally. `fetch` was
stubbed **in the browser only** to return three messages — no app code was
changed for it. That is the technique to reuse; it also re-confirmed §2.7's
crash fix with messages present, which is the exact condition that broke.

Lint, build and **24 of 26** suites pass. The two failures are
`test:auth-edge-flows` and `test:mobile-navigation`, waiting on sign-in
fixtures (`Account already exists`, `Your Blocs`) — the known pair, nothing to
do with these screens.

Live at `94f1698`, Vercel deployment `7015352738` success, bundle
`index-_MsqEnjb.js`, no console errors. The live bundle still contains two
`Report or block` labels, and that is **correct**: the `...` on a member
profile and on a comment was not part of this request and was left alone.

---

## 3. Still open

Carried from the 9 October handover and today's first session, unchanged except
where noted:

- **The blocking branch** — verified, unpushed, not live. Migration done (§2.2).
  Two decisions outstanding: the optional hardening, and preview vs `main`.
- **The legal pages need blocking put back.** On 10 October every mention of
  blocking was removed from the Privacy and Support pages because the feature
  did not exist. When this branch ships, that wording has to return.
- **Block/report persistence unproven** — needs production or the restored-copy
  route.
- **TestFlight build 11** — never built; `main` is far past it.
- **1 November month close** — first since the `c9ce86a` fix.
- **Waiting on Deveen:** RLS production rollout unrecorded, `push_devices`
  missing from his migration, `fero-staging` still billing ~$9.68/month.
- `test:auth-edge-flows` and `test:mobile-navigation` broken on `main` too.
- The sandbox cannot close a month; a prorated target can exceed the full
  target; `read_ante_core_logs_for_month` has no test.
- Cleanup candidates: ~40 stale local branches, two August worktrees, the four
  August `.dmg` backups.

## 4. Commits this session

| Commit | What |
| --- | --- |
| `c20fba6` | Open the session-2 handover, and record that the migration was already applied |
| `c20fba6` | **Blocking and reporting live** — the branch's 8 commits pushed to `main` |
| `56350f6` | Put blocking back into the Privacy and Support pages |
| `45d3fd2` | Let the Profile tab, Month and All Time delete your own workout |
| `b57ddfc` | docs: what's live at 45d3fd2, and Monday's record |
| `58c713c` | **Fix the blank Stream** — the regression this session shipped hours earlier |
| `974037f` | chore: empty commit to retrigger a deploy Vercel had not picked up |
| `610fd94` | docs: the Stream regression and the Vercel trouble |
| `94f1698` | **Press and hold** replaces the `...` on the Stream and the feed |
| *(this one)* | Monday's record, and what's live |
