# Handover — motion, haptics and the Claude/Codex build loop (29 September 2026)

Continues `docs/handover-2026-09-29-ios-polish-and-swipe.md`. Read `AGENTS.md`
first, then `docs/recurring-debugging-playbook.md` before touching swipe code.

This session ran from TestFlight build 5 to build 9. Everything in it is
motion, feel and haptics. **Nothing touched month-close logic**, and 1 October
is two days out — see §9.

---

## 1. Where things stand

| | State |
| --- | --- |
| `main` | `2ddc545` — untouched all session. No app code went to main |
| Claude's branch | `ios-header-and-nav-polish` at **`b88db37`**, pushed, rebased onto `main` |
| Codex's branch | `codex/testflight-build-2` at `6838640` (build 8) |
| TestFlight | Builds 5→8 shipped and tested. **Build 9 requested**, carrying `b88db37` |
| Revert point | tag `pre-swipe-work-2026-09-29` (`a207382`) |
| iOS simulator | iPhone 17 `547363ED-CC0B-41AF-8F9A-A475279B5FDF`, left running |
| Production RLS | Already ON (server-only lockdown). Nothing to fix |

**Aadhil is waiting on build 9.** When it lands he will test and come back with
notes. Expect the next session to open with his verdict.

---

## 2. How this session actually worked — the loop to repeat

This is the split that worked, and it is not the one in AGENTS.md §5.

- **Claude owns app code.** Works in its own worktree on
  `ios-header-and-nav-polish`, commits, pushes.
- **Codex owns the App Store side.** Merges Claude's branch into
  `codex/testflight-build-2`, archives in Xcode with Aadhil's signing, uploads.
- **`main` is the website** (lift-log-nu.vercel.app). Pushing there does
  nothing for the phone. Aadhil had to point this out; do not confuse them.
- **Aadhil relays messages between the two agents by hand.** So every handoff
  to Codex has to be a complete, self-contained message he can paste. Write it
  for Codex, not for him.

Each round: Claude builds and verifies → Claude writes the Codex message →
Aadhil pastes it → Codex cuts a build → Aadhil tests on his iPhone → notes come
back. Do not push to the branch between sending a message and the build landing:
Codex merges a named SHA and moving the tip invalidates it.

**Verifying on the simulator.** Claude's branch has no iOS shell. To test the
real packaged app:

```
git worktree add --detach ~/Documents/FERO/fero-simN origin/codex/testflight-build-2
cd ~/Documents/FERO/fero-simN
ln -s ~/Documents/FERO/fero-testflight-build-2/node_modules node_modules   # shared node_modules has NO @capacitor/*
git merge --no-edit <claude-sha>       # or git apply a diff for uncommitted work
npm run build && npx cap sync ios
```
then build with the iOS simulator tool against
`ios/App/App.xcodeproj`, scheme `App`. Remove the worktree afterwards, deleting
the `node_modules` symlink **first**.

This also rehearses Codex's merge, which is how the double-buzz trap in §5 was
caught before it shipped.

`simctl install` sometimes times out through the tool; fall back to
`xcrun simctl install <udid> <app>` then `xcrun simctl launch <udid> com.aadhilsj.fero`,
then `attach`.

---

## 3. The swipe settle — solved, and two confident wrong answers

Aadhil after build 5: *"the swipe itself is fine its the transitioning between
screens that feels laggy"*.

**Both dead ends were plausible. Record them so nobody re-derives them.**

### Dead end 1 — two competing transitions (the lead in the last handover)

Real, but inert. React's inline `transition: .08s ease-out` genuinely did
overwrite the imperative 260ms from `applyBlocTransforms`. But **CSS does not
re-time a transition that is already running**, so it never took effect.
Position measured frame-by-frame, before and after fixing it:

| ms after release | before | after |
| --- | --- | --- |
| 84 | 544.7 | 544.7 |
| 167 | 588.3 | 588.3 |
| 250 | 594.9 | 595 |

Identical. Fixed anyway — one constant now drives both — but it was not the lag.

### Dead end 2 — the end-of-animation tree swap

Also wrong. `persistGroupSelection(null)` unmounts ~730 nodes and mounts the
switcher, which looks expensive and is not:

| ms | frame gap | DOM nodes |
| --- | --- | --- |
| 251 | 17.6ms | 820 |
| **268** | **17.7ms** | **90** |
| 284 | 15.6ms | 90 |

One normal frame. On-device instrumentation later reported `swap 0ms`. A
restructure was proposed to Aadhil and then withdrawn on this evidence.

### The actual cause — the release re-render

Instrumenting the packaged app on the simulator with Aadhil's real five Blocs:

- build 5 baseline: `maxgap 63ms @63ms` — **the worst frame is the first one
  after touchend.** The settle's opening frames were never drawn.
- cause: `setBlocDragging(false)` and `setSwitcherRevealInteractive(true)` fired
  as the finger lifted, re-rendering a very large tree exactly as the transition
  began.
- after folding those into the commit render: `65ms @333ms`, then `50ms @297ms`.
  Same work, now after the screen has arrived.

Landed in `8fecd10`. Aadhil on build 6: *"so much smoother"*.

**How to measure this again.** Temporarily wrap `releaseSwipeForward` in
`src/lib/swipeRelease.js` with a rAF loop recording max frame gap and its
offset, and paint the result into a fixed div. Build to the simulator, swipe,
read it off a screenshot. The browser pane is far too fast to show it and cannot
reach the packaged app.

---

## 4. Motion: every rule now in force

### One settle for every screen change

There were three different motions, which is why moving between screens read as
abrupt and inconsistent:

| | originally | now |
| --- | --- | --- |
| tab swipe | 80ms ease-out | `SCREEN_SETTLE_MS` |
| tab tap | 180ms `cubic-bezier(.22,.61,.36,1)` | `SCREEN_SETTLE_MS` |
| Bloc back-swipe | 260ms `cubic-bezier(.32,.72,0,1)` | `SCREEN_SETTLE_MS` |

`SCREEN_SETTLE_MS` is **200ms** (was 260; Aadhil asked for faster),
`SCREEN_SETTLE_EASING` is `cubic-bezier(.32,.72,0,1)`.
`BLOC_SWIPE_SETTLE_MS` / `BLOC_SWIPE_EASING` keep their names and point at the
shared pair. The playbook's rule still holds: **the CSS duration and the commit
delay must come from the same constant.**

`TAB_LIFT_MS` is `SCREEN_SETTLE_MS * 0.8`, deliberately shorter so the nav lift
lands just *before* the screen. Aadhil: *"as soon as or even slightly before you
land on the screen. That's very intuitive."*

### Nothing may set React state at swipe release

This is the rule the whole session turns on. A re-render at the moment the
finger lifts eats the settle's first frames. Both gestures now fold their state
updates into the commit render, guarded by `blocReleasingRef` /
`pageReleasingRef` so a stray re-render mid-settle cannot write
`transition:none` over a running glide. Every exit path clears those flags:
commit, cancelled swipe, reset, and a tab tap that interrupts a settle.

### Anything that must move *with* the gesture is written to the DOM by hand

React state is too late. Written imperatively at release:

- the nav pill's slot (`--mobile-active-slot` on `tabIndicatorRef`)
- the tab lift (`--lift-y`, `--lift-scale` on each `.mobile-tab`, via
  `applyTabLift`)

`applyTabLift(null)` clears the inline values and hands control back to the
`.on` class. **It must be called from `cleanup`, not `commit`** — clearing
before React's commit render hands the lift back to the *old* active tab for a
frame.

The lift was fixed in two goes: `1417d87` moved the pill but left the lift on
the class, so the pill led and the icon chased. `b88db37` fixed the lift itself.

### The shadow strip — the "shudder"

Aadhil on build 6: *"when the log switcher screen lands, the right side
shudders a little bit"*.

The leaving surface carries `-18px 0 34px`, and CSS draws a negative-x shadow to
the **left** of the element. Parked at exactly `screenWidth` the shadow stayed
on screen — roughly `screenWidth-35` to `screenWidth-1`, a dark strip hugging
the right edge — then vanished in one frame when the surface unmounted.
`BLOC_SWIPE_SHADOW_CLEARANCE = 40` sends it far enough that the shadow clears
too.

**The in-Bloc tab track has the same geometry** (`-18px 0 34px rgba(0,0,0,.24)`
on the active page). Not reported, not changed, and it cannot be fixed by
extending distance without misaligning the track — it needs the shadow on a
child faded with opacity.

### The cross-fade

Aadhil compared the tabs to Instagram: *"very high speed, but the gracefulness
isn't there."* Sliding was the only thing happening. Pages now dim as they
travel — `PAGE_FADE_DEPTH = 0.72`, so 0.28 at a full screen away — and come back
up as they arrive. It stops short of transparent so the Bloc background never
shows through as a hole. A tab tap uses the same fade over its own duration.
**The active page at rest must be opacity 1**; verified as 1 / 0.28 / 0.28 /
0.28 across the four layers.

### The Lift

Chosen by Aadhil from three motions mocked up side by side against the real nav
bar (artifact: `https://claude.ai/artifact/36KGAZwFBPEfrtB8rFAMAv`). The active
tab's icon and label scale to 1.16 and rise 1.5px.

Rejected, with reasons worth keeping: **Bloom** (same move with an overshoot)
reads as toy-like on a tab pressed daily; **Trail** (the leaving icon leaning
toward the swipe) animates the tab you are leaving, pulling the eye backwards
exactly as the new screen arrives.

Layout is untouched and was measured rather than assumed — at 375x812, before
and after: nav height 57, nav top 735, tab heights `[46,46,46,46]`, tab tops all
`740.5`. Only a transform moves.

### Scroll clearance

Reported on Month, Today and History; one cause. Content cleared the nav bar by
11px, but the scrim — the fade above the bar — starts 124px up, so the last card
came to rest 36px **inside** the fade: clear of the bar, visibly dimmed,
impossible to scroll free of.

`--bottom-scroll-clearance` (offset + 116px) is for scrolling content.
`--bottom-nav-clearance` (offset + 68px) is unchanged and still positions chrome
such as the install banner, which should sit near the bar rather than above the
fade. **Do not merge these two back together.**

### The switcher card stagger

The fifth Bloc card finished at 510ms — matching Aadhil's "half a second"
exactly. Arriving **by swipe** already suppresses the intro (verified: computed
`animation` is `none`), so what he saw was the other route in, tapping the Bloc
name. Now 20ms per card over 280ms, capped at the fifth, so the last card lands
at 360ms however many Blocs exist.

---

## 5. Haptics

### The timing rule was reversed mid-session

**Old rule (recorded 29 Sep):** fire only after the API confirms, never on an
optimistic update.
**New rule (29 Sep, after Aadhil felt it on a real phone):** fire the instant
the button is pressed. *"as soon as somebody presses log workout... boom, it
happened."* Waiting for the server makes it feel late and disconnected.

One buzz per action still holds: six Blocs is still one buzz.

### The line Aadhil agreed

**A buzz means something changed or committed, never that you navigated.**

| Buzzes | Silent |
| --- | --- |
| Logging a workout (`tapMedium`, in `doLog`) | Chat, notifications, settings icons |
| Deleting a workout (`warning`, in `deleteOwnLog`) | Tapping a day in the calendar |
| Month stepper (`tapLight`; disabled arrow stays silent) | Opening someone's profile |
| Tab change, tap and swipe (`tapLight`) | Reselecting the tab you are on |
| Entering and leaving a Bloc (`tapLight`) | |

Put the buzz in the **funnel every branch reaches**, never on one branch:
`doLog` in TodayPage, not `handleSave` or `handleMultiLog`; `deleteOwnLog`, not
the three delete buttons. Putting it on one branch is how it stayed unreachable
for multi-Bloc members for a week.

`warning` rather than `tapMedium` for deletes, so a destructive confirm does not
feel like a successful log.

### The merge trap — check on every future merge

Codex's original example call site was `import { tapMedium }` at `src/App.jsx`
line 2 plus `void tapMedium();` inside `handleSave`'s `if(saved?.ok &&
saved.data)` branch. Claude's buzz is in `src/pages/TodayPage.jsx`. **Git merges
these cleanly with no conflict** — confirmed by running the merge locally — and
the result buzzes twice for a single-Bloc log.

Codex removed it correctly for build 7; verified on their branch, `tapMedium`
no longer appears in `App.jsx` at all. Re-check after any future merge with:

```
grep -n "tapMedium\|tapLight" src/App.jsx src/pages/TodayPage.jsx
```
Expect `tapLight` only in `App.jsx`, `tapMedium` only in `TodayPage.jsx`.

---

## 6. Things that will bite you

- **The sandbox log button looks broken and is not.** `canSubmit` in
  `src/modals/modals.jsx` requires `photoUrl`; that Bloc makes photos
  mandatory, so the button is inert until one is attached. An hour went into
  chasing this as a regression. It is not one.
- **Two buttons read "Log workout"** — the Today page's opener and the sheet's
  submit. A `querySelector` that takes the first visible one takes the wrong
  one, and the click silently does nothing.
- **`getComputedStyle` inside a release probe changes the answer.** Reading
  style synchronously after `touchend` forces a recalc before React commits,
  which made a 260ms transition appear where the app would really have used
  80ms. Sample from rAF only, never between release and React's commit.
- **The browser pane serves stale screenshots.** Several times a screenshot
  showed the old screen seconds after a committed transition. Confirm state
  structurally (`getBoundingClientRect`, computed styles, DOM text) before
  believing a screenshot.
- **Synthetic touch events rarely commit the tab gesture.** They work for the
  Bloc back-swipe and not reliably for the in-Bloc track. Verify tab motion on
  the simulator with real gestures.
- **`env(safe-area-inset-bottom)` is 0 in the browser pane** and ~34px on the
  phone, so anything tuned against it must be checked on the simulator. This is
  the same trap that produced the original bottom-nav drift.
- The sandbox logs `WebSocket ... 54321/realtime` errors constantly. Harmless,
  pre-existing.
- iCloud keeps duplicating files in worktrees under `~/Documents`
  (`node_modules 2`, `config 2.xml`). Stage by explicit path, never `git add -A`.
- The shared `node_modules` in `Codex Space/Fero` has **no `@capacitor/*`**.
- The simulator drops injected input for minutes at a time. Retry; it recovers.

---

## 7. Verification standard used all session

Before every handoff: `npm run lint`, `npm run build`, and **all 24 `test:*`
scripts**. All 24 passed every time — note that the previous handover's claim
that `test:auth-edge-flows` and `test:mobile-navigation` fail on clean `main` did
not reproduce once.

Beware a crude pass/fail grep: `test:otp-errors` contains the word "error" in
its test *names* and reads as a failure. Match on `^ *(FAIL|✗|✖)|tests? failed`.

Then the affected gestures on the simulator, on a build merged the way Codex
will merge it. For layout claims, measure before and after rather than eyeball.

---

## 8. Open, deliberately not done

1. **The cancelled Bloc back-swipe** still calls `setBlocDragging(false)` at
   release via `releaseSwipeBack` and has the same stall shape the committed
   swipe had. Left out of every commit rather than widening one. It has no
   commit callback to fold into, so it needs a timeout — its own small change.
2. **The in-Bloc tab shadow strip** (§4), if Aadhil ever reports it.
3. **Aadhil still owes a decision** on when Fero asks for notification
   permission. iOS only asks once. Do not pick this for him.
4. `PAGE_FADE_DEPTH = 0.72` is Claude's judgement of "graceful without showing a
   hole" and has not had a second opinion. One number if Aadhil wants it
   different.

---

## 9. The thing nobody has looked at

**1 October is two days away.** Builds 6 through 9 are entirely motion, feel and
haptics. Month close is the riskiest logic in the app and no one has been near
it this session. Once build 9 is judged, that is where the next session should
go — not more polish.

`docs/READ-BEFORE-ANALYSING-FERO-NUMBERS.md` first, before any numbers.
