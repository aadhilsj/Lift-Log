# Handover — the 29 September 2026 session (Codex and Claude)

**This is the single handover for this session. There is no separate Claude
document; the Claude side is appended from "Claude's side" onwards.**

Codex wrote §1–§9 as the operator. Claude worked after Codex's session ended and
has corrected the parts that went stale, marked inline. Where this file and any
older dated handover disagree, this file wins; where this file and
`docs/WHATS-LIVE.md` disagree, **WHATS-LIVE.md wins**, because it is kept current.

Claude is the lead reviewer/instructor; Codex is the operator.

## Read and coordinate first

Read `AGENTS.md` first. Before touching swipe code, read the **Swipe Navigation Contract** in `docs/recurring-debugging-playbook.md`.

Then read these topic handovers for context (some contain earlier, now-stale snapshots; this document records the later state of the work described here):

- `docs/handover-2026-09-29-ios-polish-and-swipe.md`
- `docs/handover-2026-09-29-swipe-settle-and-haptics.md`
- `docs/handover-2026-09-29-reactions-comments-and-pwa-parity.md`
- For native/TestFlight work, also read `docs/handover-2026-09-28-codex-testflight-session.md` and the build-specific 29 September handover in the `fero-testflight-build-2` worktree.
- Read other historical handovers only when the requested work touches their area. Do not treat old status tables as current without checking Git/Vercel.

The founder asked for a new Codex and Claude session working in tandem: Claude is the reviewer/instructor and Codex is the operator. Wait for Claude's bounded instruction, implement only that scope, and return the exact diff and verification for Claude's review. Do not infer approval for another deployment from these completed releases; the user's approvals here applied to the two commits below.

## Current result

Two separate commits were pushed to `main` and each received its own Ready Production deployment:

1. `76770cc` — `Align tab feedback and paint the page canvas`.
2. `b43d70f` — `Prioritize vertical intent on Today edge swipes`.

The separation was deliberate and preserved: Aadhil reviewed the first release before authorizing continuation to the swipe release. The first changed the visual fixes; the second changed only the Today/Bloc-switch swipe classifier.

At the final fetch while Codex wrote this handover, `origin/main` was `4cd7b59`. **It has since advanced well past that** — see "Claude's side" below and `docs/WHATS-LIVE.md`. The three commits after `b43d70f` were `c20b715` and `ad64bb0` (documentation), then Claude's `4cd7b59` code follow-up. They are descendants of the two Codex releases. The latest Vercel Production deployment was Ready for `4cd7b59`. The Codex worktree below remained at `b43d70f`, clean and three commits behind `origin/main`; do not force-push or reset it. Fetch and inspect current state before continuing.

## Workspace map

The folder `/Users/aadhilsj/Documents/FERO` is a collection of worktrees, not itself a Git checkout.

- Codex worktree used for this work: `/Users/aadhilsj/Documents/FERO/fero-stream-bottom-strip`, branch `fix/pwa-stream-bottom-strip`, `HEAD b43d70f` at handover time. The two shipped commits are in its history. No uncommitted source changes remained. The `node_modules` symlink used for checks was removed afterward.
- Claude's worktree at handover time: `/Users/aadhilsj/Documents/FERO/fero-header-handoff`, branch `ios-header-and-nav-polish`, at `4cd7b59`. Claude was actively working there. Its status showed an untracked `node_modules` symlink; do not remove it or clean that worktree. Do not edit that worktree unless Claude/Aadhil explicitly directs you.
- Native packaging worktree: `/Users/aadhilsj/Documents/FERO/fero-testflight-build-2`, branch `codex/testflight-build-2`, last observed at `7363442` (build 9 handover). This PWA work did not touch it. Do not upload a TestFlight build without a fresh request.
- The worktree at `/Users/aadhilsj/Documents/Codex Space/Fero` was on an older `main` checkout (`6f36627`) when inventoried. Do not assume it is current `main`.

The worktree inventory also contained several other project-specific branches. Preserve them; do not switch branches or clean them up as part of unrelated work.

## What changed

Only these source files were changed across the two commits:

- `src/App.jsx`
- `src/styles/app.css`

No API, database, SQL, push-notification, TestFlight, or notification-permission code changed in this work.

### Release 1: UI feedback and white bottom strip (`76770cc`)

- The tab lift duration remains derived from the common 200ms screen settle and changed from a `0.3` ratio (60ms) to `0.15` (30ms). `TAB_LIFT_EASING` was left alone. The comment now records that the first two shipped durations still felt late and that the front-loaded curve mattered as much as duration.
- `.mobile-tab` now uses `--tab-ink`; `applyTabLift` writes the destination bright ink and outgoing dim ink at swipe release alongside the lift values, then removes the inline ink in the existing `targetPage === null` cleanup branch. The existing `.16s` color transition is unchanged. Tap handling is unchanged because its `.on` class still updates on the immediate `setPage` render.
- The initial Codex fix added `html { background:var(--bg-primary); }`. `--bg-primary` is defined as `#070C0C`; it painted the otherwise uncovered canvas dark. The supplied iPhone screenshots showed a 141px band in 3× pixels, i.e. 47pt, below the app content. The stream composer already included bottom safe-area padding, so its layout was not changed.
- No nav geometry, lift values, easing, pill timing, stream sheet size/radius, composer size/layout, header, or bottom-nav geometry changed.

Production verification for this commit:

- Vercel deployment `dpl_Fdu7ts3gGQuA7iW2j4tDiqFf2xuF`, Ready / Production for exact SHA `76770ccf3d8667bd3f3763e0bc4c6113cb49f4ff`.
- The live bundle had `SCREEN_SETTLE_MS = 200` and `Math.round(200 * .15)` (30ms), no old 60ms lift, `--tab-ink`, and the HTML canvas background. Root page and assets returned HTTP 200.
- Aadhil later said he was happy and authorized continuing to the separate swipe release. This is approval to continue, not a record of a device-by-device checklist. Codex did not capture a post-fix iPhone screenshot.

### Claude follow-up (`4cd7b59`) — SUPERSEDED, both parts reverted

**This section described work that has since been undone. It is kept only so
that nobody reapplies it.**

Claude pushed `4cd7b59`, which anchored the Stream sheet with
`position:absolute; left:0; right:0; bottom:0` and changed the canvas from the
flat `--bg-primary` to `var(--bg-gradient)`. **Both were wrong and both are
reverted.**

- The sheet anchor did not change the symptom. Build 9 does not have it.
- `background: var(--bg-gradient)` is a **shorthand**: it sets
  `background-image` and resets `background-color` to `transparent`, and a
  transparent canvas paints **white**. It brought the white strip back.
  Confirmed by reading `getComputedStyle(document.documentElement)` on the live
  page: `rgba(0, 0, 0, 0)` with a gradient image set.

**The live state is now the flat colour again**, as a longhand
(`html { background-color:var(--bg-primary); }`), plus a guard that stops the
bottom nav and its scrim mounting under a full-screen sheet. Codex's earlier
note "do not reapply the old flat background over Claude's gradient" is
**reversed**: the flat colour is correct, the gradient is not.

### Release 2: Today left-edge scroll classification (`b43d70f`)

Diagnosis came from the current source plus the date history, and was recorded in Claude's `handover-2026-09-29-reactions-comments-and-pwa-parity.md`:

- `movePageSwipe` (the in-Bloc tab track) already gives a clear vertical signal priority.
- `moveBlocSwitchSwipe` (Today → Bloc switcher) checked horizontal first, even when both predicates were true. Example: 10px across / 13px down satisfies both horizontal and vertical thresholds, so it was incorrectly treated as a back navigation in the 72px left-edge band on Today.
- This is not OS-specific code. iOS's system edge-swipe intercepts many touches in that strip; Android does not, so the collision is encountered more often on Android.
- The swipe-start guard remains `page === "today"` and the 72px strip is unchanged.

The change is only the order of the existing checks in `moveBlocSwitchSwipe`: vertical scroll now wins first; otherwise the existing horizontal path still runs. Thresholds remain horizontal `absDx > 5 && absDx > absDy * 0.72`, vertical `absDy > 9 && absDy > absDx * 1.08`. `movePageSwipe`, touch-start guards, transforms, settle/release logic, scroll position, and all other screens were not changed.

Aadhil reviewed these expected cases and confirmed the intended trade:

| Movement | Result |
| --- | --- |
| 10px across / 13px down | scroll (reported bug) |
| 30px across / 3px down | back-swipe |
| 30px across / 20px down | back-swipe |
| 12px across / 13px down | scroll (deliberate trade when both predicates apply) |

Codex also ran a small local arithmetic/classifier check: 10×13 and 4×10 resolve to scroll; 30×3 and 13×6 resolve to back. No threshold was tuned.

**Device status: explicitly unverified on both iOS and Android.** No Android device was available/attachable. The iOS simulator and desktop browser cannot prove real Android touch behavior, and Codex did not claim they could. Aadhil explicitly authorized shipping the separate swipe fix for feedback despite this limitation. An Android member who reported the issue must confirm it on a real Android device. Aadhil should separately check the iOS half on his iPhone. Do not soften this limitation or report the fix as device-verified.

Production verification for this commit:

- Vercel deployment `dpl_EYANJ5LT9aYU2yMvKQx4TPLY4ENg`, Ready / Production for exact SHA `b43d70f7d2f8afd95aa7175657d3deab2f1763aa`.
- The live PWA bundle contained the vertical-first condition before the horizontal branch. Page, JavaScript and CSS returned HTTP 200. A later fetch after the two docs-only commits still showed the same live vertical-first classifier.
- Vercel's last-hour runtime error scan reported no runtime errors. This is not a browser console scan and is not device testing.

## Verification ledger

After the code change, `npm run lint` and `npm run build` passed. All 23 runnable `test:*` scripts passed by exit code:

`test:stream-moments`, `test:month-awards`, `test:system-health`, `test:rollover-isolation`, `test:month-close-canonical`, `test:open-season-month`, `test:profile-stats-cache`, `test:fero-profile-stats`, `test:remirror`, `test:month-sit-out-card`, `test:identity`, `test:profile-photo-storage`, `test:account-deletion`, `test:auth-outage`, `test:two-workouts`, `test:bloc-streak`, `test:solo-sitout-exclusion`, `test:solo-standard-penalty`, `test:yearly-allowance`, `test:activities`, `test:training-wheels`, `test:founder-dashboard`, and `test:otp-errors`.

`test:auth-edge-flows` and `test:mobile-navigation` were **not run**, because they require an app on `127.0.0.1:3000`. Keep reporting these as not-run rather than passing unless the required app is running and the scripts are actually executed.

## Wider project context carried into this handover

- Fero is live on the PWA and on TestFlight. This session made two web deployments only; it did not cut or upload a TestFlight build.
- Build 9 was previously authorized with a one-off signing override without the push entitlement. The push foundation remains in source, but there is no APNs key or wired permission prompt. The notification permission moment is still Aadhil's decision. Do not set up the Apple key or choose the permission moment without him.
- The notification bell's prior inert state was a deliberate product constraint in older handovers; later main history says the bell was connected to a “coming soon” destination. Do not infer additional notification-centre scope from that. Read the current Claude handover before touching it.
- Production RLS is already enabled with a server-only lockdown, according to the recent handovers. The later direct-client policy-based RLS work is separate. Do not alter RLS or run SQL as part of this UI/swipe task.
- Other recently addressed live bugs include reaction overlay selection (`e9ea4cd`) and a retryable failure state for comment loading (`e9b7704`). Those are separate tasks; do not re-investigate or edit them without a request.
- Rollback reference supplied by Aadhil: tag `pre-pwa-merge-2026-09-29`. Do not roll back without approval.

## Recommended opening sequence for the next Codex session

1. Read `AGENTS.md`, this handover, and `docs/recurring-debugging-playbook.md` before touching swipe code.
2. Inspect `git status`, fetch `origin`, inspect `origin/main`, current Vercel Production, and the current Claude worktree. At the last observation, Claude's worktree was at `4cd7b59` and this Codex worktree was at `b43d70f`, three commits behind. Preserve Claude's work; do not assume those refs are still current.
3. Confirm with Aadhil/Claude which active task they want operated. The immediate open verification is feedback from a real Android user and Aadhil's iPhone review of the shared PWA behavior. No additional swipe tuning was authorized; if the back-swipe feels too hard to trigger, report the observation and ask before changing thresholds.
4. If asked to change anything, make a separate, narrowly scoped commit; lint, build, run tests by exit code, inspect the exact diff, and only ship with explicit current-session approval.

## Copy-paste starter for the new Codex session

```text
Continue Fero as the operator; Claude Code is the lead reviewer/instructor. First read AGENTS.md, then docs/handover-2026-09-29-codex-pwa-and-android-scroll.md in full, then docs/recurring-debugging-playbook.md before touching any swipe code. Read the three 29 September topic handovers linked inside the Codex handover. Inspect git status, fetch origin, compare worktrees and origin/main, and check current Vercel Production before acting. Do not overwrite or edit Claude's active worktree. Two separate production releases are already complete: 76770cc (30ms lift/tab ink/dark canvas) and b43d70f (vertical-first Today edge-swipe classifier). The second is live but unverified on both iOS and Android; an Android member must confirm it. Do not claim device verification, tune swipe thresholds, change unrelated code, touch push/APNs/RLS/TestFlight, or deploy anything else without fresh explicit direction. Wait for Claude's bounded instruction, implement only that scope, and return the precise diff and checks for Claude's review.
```

---
---

# Claude's side

Written after Codex's session ended. Everything above this line is Codex's
record, with the corrections marked inline. Everything below is the Claude side
of the same session.

## 10. The one thing still broken — read this first

**The band at the bottom of the Bloc Stream on the installed PWA is NOT fixed.**
Four attempts failed. The full account, with every eliminated cause, is the
playbook entry **"A Band At The Bottom Of A Full-Screen Sheet, PWA Only"** in
`docs/recurring-debugging-playbook.md`. Read it before attempting a fifth.

The single most useful finding:

> **The band's colour is always whatever the page canvas is painted.** Unpainted
> it is white; painted dark it is a dark slab; painted with a gradient via the
> `background` shorthand it is white again. So the band is **a region that
> nothing covers**. Stop painting it. Find what should be covering it and is not.

Eliminated, with evidence — do not re-derive:

1. **Not a code difference from build 9.** Diffed TestFlight build 9 (`dfc5b4e`,
   correct) against `main` for `BlocStream.jsx`, `LogCommentThread.jsx` and
   `app.css`. After the reverts, the only remaining difference is
   `LogCommentThread`'s error-state logic, which has no geometry. **Same code:
   native right, PWA wrong.** Copying build 9 cannot fix it — it is already
   copied.
2. Not the sheet's alignment (`position:absolute; bottom:0` changed nothing).
3. Not `.mobile-bottom-scrim` alone — it *is* new in the merge and *was*
   mounting under the sheet with a `backdrop-filter`, and it is now guarded by
   `!showStream && !logCommentScreen`. That removed the blur artifact but not
   the band.
4. Not the viewport meta — identical before and after the merge.
5. Not a transformed ancestor — `BlocStream` is a **sibling** of the transformed
   Bloc surface, not a descendant.
6. Not the rest of the merge — the only other files it touched are icons.

**What nobody has done:** reproduce it in a real installed iOS PWA and measure
it. Build the site, open it in the iOS Simulator's Safari, Add to Home Screen,
open from the home screen, attach Web Inspector, and answer one question: **does
`position:fixed; inset:0` reach the bottom of the screen there?** If not, that is
the whole bug and every full-screen overlay has it.

The founder's own lead is the strongest and is not exhausted: **it did not happen
before the merge.** Suspects 3–6 are eliminated; the merge diff is small enough
to read line by line.

## 11. What Claude shipped after Codex's releases

| | |
| --- | --- |
| `4cd7b59` | Sheet anchor + gradient canvas — **reverted**, see the correction above |
| `b8909cc` | Bottom nav and scrim no longer mount under a full-screen sheet; the two failed attempts reverted |
| `644d451` | Canvas repainted as a **longhand** `background-color`, restoring the half that actually removes the white |
| `f463267` | Five playbook entries |
| `f484b96` → this file | Handovers |

Earlier in the session, before Codex's releases, Claude also shipped the big
merge (`80629b5`) that put a month of iPhone app work onto the website for the
first time, wired the notification bell to Codex's placeholder, and shipped the
nav lift at 100ms and then 30ms.

## 12. Two bugs worth understanding, not just knowing

**Reactions "deleted" and comments never loading were one outage.** Supabase,
16:31–16:45 UTC: every endpoint 504/500, 346 and 56 in that hour, every other
hour clean. **The writes succeeded and the reads failed** — all four reactions
written at 16:30–16:34 are in `ante_core.workout_reactions`. Nothing was lost,
and there was no server bug to find. Now a playbook entry; third time this
family has appeared.

**Android could not scroll Today because two handlers disagreed.** Covered in
Codex's §"Release 2". The diagnosis came from dating the handler
(`d9844b0`, 16 July) against when the complaints started.

## 13. Month close, 1 October — checked and green

- All 18 Blocs agree on the open month across both stores.
- Every September workout matches between blob and canonical, **both
  directions**, zero discrepancies.
- No departed member is still countable; no deleted log is.
- **A dry run against real production data with the clock faked to
  2026-10-01T12:00:00Z: 18 of 18 Blocs rolled, 0 rebuild failures, every frozen
  count identical to the canonical rebuild.**
- The safety guard was tested: canonical empty + blob counting 3 → the close
  **refuses** rather than freezing zeros.

Re-run §7 and §8 of `handover-2026-09-29-reactions-comments-and-pwa-parity.md`
on 30 September. The sandbox cannot be used for this — it answers every canonical
RPC with `[]`, which makes a healthy close look catastrophic.

## 14. RLS — one gap nobody had caught

The migration is written and rehearsed on staging; **not applied to production**,
scheduled 2–3 October after the close. Verified independently.

**`ante_core.push_devices` is missing from it.** Created 28 September, two days
after the migration was written. The migration names eight tables; production has
nine without RLS. Applying as-is leaves push tokens uncovered **and makes the
migration's own verification query report a failure on the day.**

Deveen's fresh active handover is `docs/handover-2026-09-29-for-deveen-active.md`.
`fero-staging` is still running at ~$9.68/month; delete it once the migration is
on production, not before.

## 15. Mistakes made, so they are not repeated

- **"All 24 tests pass" was wrong.** The grep-based recipe counts a Playwright
  script that dies with a Node stack trace as a pass. Use exit codes — the
  recipe is in the playbook. An older handover had been right about this and the
  29 September one wrongly "corrected" it.
- **A confident wrong diagnosis reached production.** Reactions were said to be
  vanishing because two Blocs had duplicate open seasons. They do not — the code
  defines "open" by `status`, not `closed_at`. The instruction was sent before it
  was withdrawn; the resulting no-op commit `e9ea4cd` is on production, is
  harmless, and is deliberately left. **It fixed nothing.**
- **Four fixes were shipped for the bottom band without reproducing it once.**
  The founder asked for a build-9-versus-main diff two rounds before it was run.
  **Do the comparison the founder asks for, first.**
- **Both agents pushed to `main` in the same evening**, diverging the branch
  twice. Route pushes through one agent.

## 16. Decisions the founder made

- **One codebase for the PWA and the app. No deliberate fork.** Haptics are
  already a silent no-op on web (`Capacitor.isNativePlatform()` guards every
  buzz), and the header resolves to identical padding in a Safari tab.
- **Members stay on the PWA and move once, to the App Store** — not onto
  TestFlight. Separate installs; TestFlight builds expire after 90 days.
- **Notification permission timing is undecided and is his alone.** iOS asks
  once.
- **Codex operates, Claude reviews**, for the week ending Sunday 4 October.

## 17. Still open

| | Owner |
| --- | --- |
| **The PWA bottom band** | next session — playbook entry first |
| TestFlight build 10 | Codex. The phone is several deploys behind |
| The emoji picker (top 5 + more, three surfaces) | next session; a feature |
| iOS confirmation of the Android swipe fix | Aadhil |
| Android confirmation of it | an Android member who reported it |
| Staging click-through before 2 Oct | Aadhil |
| RLS to production, with `push_devices` added | Deveen, 2–3 Oct |
| `fero-staging` teardown | after that |
| Re-run the month-close checks | 30 Sep |
| Bloc entry speed | parked — there is no entry animation; it is mount cost, and it touches the swipe track |

## 18. Housekeeping

- Branch `ios-header-and-nav-polish` and `main` are the same content.
- Rollback tag for the big merge: `pre-pwa-merge-2026-09-29` at `e9b7704`.
- The iOS simulator (iPhone 17, `547363ED-CC0B-41AF-8F9A-A475279B5FDF`) runs
  build 9 — the known-good visual reference.
- Codex's worktree `/Users/aadhilsj/Documents/FERO/fero-stream-bottom-strip` is
  behind and still holds the pre-revert canvas fill. Do not treat it as current.
