# Handover — the swipe settle, the shudder, and haptics (29 September 2026)

Continues `docs/handover-2026-09-29-ios-polish-and-swipe.md`. Read `AGENTS.md`
first, then `docs/recurring-debugging-playbook.md` before touching swipe code.

---

## 1. Where things stand

| | State |
| --- | --- |
| `main` | `2ddc545` — unchanged this session, no app code went to main |
| Claude's branch | `ios-header-and-nav-polish` at **`3b525da`**, pushed, rebased onto `main` |
| Codex's branch | `codex/testflight-build-2` at `7a70c3e` (build 6) |
| TestFlight | **Build 6 tested and approved by Aadhil.** Build 7 requested from Codex |
| Revert point | tag `pre-swipe-work-2026-09-29` (`a207382`) |
| iOS simulator | iPhone 17 `547363ED-CC0B-41AF-8F9A-A475279B5FDF`, left running |

**Do not push to `ios-header-and-nav-polish` until build 7 is up.** Codex was
sent a message naming `3b525da` exactly; moving the tip mid-merge invalidates it.

---

## 2. The swipe settle — solved, and two confident wrong answers on the way

Aadhil after build 5: *"the swipe itself is fine its the transitioning between
screens that feels laggy"*.

**Record the dead ends, because both were plausible enough to be re-derived.**

### Dead end 1 — the two competing transitions (the lead in the last handover)

Real, but inert. React's inline `transition: .08s ease-out` genuinely did
overwrite the imperative 260ms written by `applyBlocTransforms`. But **CSS does
not re-time a transition that is already running**, so the `.08s` never took
effect. Measured position frame-by-frame before and after fixing it:

| ms after release | before | after |
| --- | --- | --- |
| 84 | 544.7 | 544.7 |
| 167 | 588.3 | 588.3 |
| 250 | 594.9 | 595 |

Identical. Fixed anyway — one constant now drives both, which is what the
playbook asks — but it was never the lag.

### Dead end 2 — the end-of-animation tree swap

Also wrong. At commit, `persistGroupSelection(null)` unmounts ~730 nodes and
mounts the switcher. It looks expensive. It is not:

| ms | frame gap | DOM nodes |
| --- | --- | --- |
| 251 | 17.6ms | 820 |
| **268** | **17.7ms** | **90** |
| 284 | 15.6ms | 90 |

One normal frame. On-device instrumentation later reported `swap 0ms`. A
restructure was proposed to Aadhil and then withdrawn on this evidence.

### The actual cause — the release re-render

Instrumenting the packaged app on the simulator with Aadhil's real five Blocs:

- build 6 baseline: `maxgap 63ms @63ms` — **the worst frame is the first one
  after touchend.** The settle's opening frames were never drawn.
- cause: `setBlocDragging(false)` and `setSwitcherRevealInteractive(true)` fired
  as the finger lifted, re-rendering a very large tree exactly as the transition
  started.
- after folding those into the commit render: `maxgap 65ms @333ms`, then
  `50ms @297ms`. Same work, now after the screen has arrived.

Landed in `8fecd10`. Aadhil on build 6: *"so much smoother"*.

**How to measure this again.** Temporarily wrap `releaseSwipeForward` in
`src/lib/swipeRelease.js` with a rAF loop recording max frame gap and its
offset, and paint the result into a fixed div. Build to the simulator, swipe,
read it off a screenshot. The browser pane is too fast to show it and cannot
reach the packaged app.

---

## 3. The shudder — the shadow, not the animation

Aadhil on build 6: *"when the log switcher screen lands, the right side shudders
a little bit"*.

The leaving surface carries `-18px 0 34px rgba(0,0,0,.28)`, and CSS draws a
shadow with a negative x-offset to the **left** of the element. Parked at
exactly `screenWidth`, the shadow did not leave with it: roughly
`screenWidth-35` to `screenWidth-1` stayed on screen as a dark strip hugging the
right edge, which then vanished in a single frame when the surface unmounted.

Fix: `BLOC_SWIPE_SHADOW_CLEARANCE = 40`, so `finalX` is `screenWidth + 40` and
the shadow clears the viewport too.

**The same geometry applies to the in-Bloc tab track**, which uses
`-18px 0 34px rgba(0,0,0,.24)` on the active page. A rightward tab swipe parks
the outgoing page one viewport right, leaving the same strip. Not reported, not
changed, and it cannot be fixed by extending the distance without misaligning
the track — it needs the shadow on a child that fades with opacity. Left alone
deliberately.

---

## 4. One settle for every screen change

There were three different motions, which is why moving between screens read as
abrupt and inconsistent:

| | was | now |
| --- | --- | --- |
| tab swipe | 80ms ease-out | 260ms `cubic-bezier(.32,.72,0,1)` |
| tab tap | 180ms `cubic-bezier(.22,.61,.36,1)` | same as above |
| Bloc back-swipe | 260ms `cubic-bezier(.32,.72,0,1)` | unchanged |

All now come from `SCREEN_SETTLE_MS` / `SCREEN_SETTLE_EASING` /
`SCREEN_SETTLE_TRANSITION`, defined before `applyInBlocPageTransforms` because
that helper is the first user. `BLOC_SWIPE_SETTLE_MS` and `BLOC_SWIPE_EASING`
keep their names and point at the shared pair, so nothing else had to move.

The tab swipe also got the `8fecd10` release fix: `setPageDragging(false)` no
longer fires at release, and `pageReleasingRef` guards the inline style the same
way `blocReleasingRef` does. Every exit path clears it — commit, cancelled
swipe, `resetPageSwipe`, and a tab tap that interrupts a settle.

**Unverified judgement call:** 260ms was chosen for tab swipes purely for
consistency with the Bloc gesture Aadhil approved. Tabs are switched far more
often and it may feel sluggish. It is one constant if he wants it snappier.

---

## 5. Haptics — the timing rule was reversed

Aadhil felt build 6's haptic and changed the rule.

**Old rule (29 Sep, recorded in the previous handover):** fire only after the
API confirms, never on an optimistic update.
**New rule (29 Sep, after feeling it):** fire the instant the button is pressed.
*"as soon as somebody presses log workout... boom, it happened."*

One buzz per action still holds. The buzz lives in `doLog` in
`src/pages/TodayPage.jsx`, the single funnel both the single-Bloc and multi-Bloc
branches pass through, before either. That also fixes the reachability bug from
the previous handover, where the only haptic sat on `handleSave` and a member of
several Blocs never reached it.

Tab changes buzz with `tapLight`, on both the nav tap (`handleNavSelect`,
silent when reselecting the current tab) and the swipe (at release, not in
commit). Workout logging uses `tapMedium`.

`src/lib/haptics.js` was brought across **byte-identical** to the copy on
`codex/testflight-build-2` so the two merge without conflict.

### The merge trap — check this on every future merge

Codex's original example call site is still on their branch:
`src/App.jsx` line 2 `import { tapMedium }` and `void tapMedium();` inside
`handleSave`'s `if(saved?.ok && saved.data)` branch. **Git merges this cleanly
with no conflict** — verified by performing the merge locally — and the result
buzzes twice for a single-Bloc log: once on press, once on the server reply.
Both lines must be deleted during the merge. Afterwards
`grep -n "tapMedium\|tapLight" src/App.jsx src/pages/TodayPage.jsx` should show
only `tapLight` in `App.jsx` and `tapMedium` in `TodayPage.jsx`.

---

## 6. Things that will bite you

- **The sandbox log button looks broken and is not.** `canSubmit` in
  `src/modals/modals.jsx` requires `photoUrl`; this Bloc makes photos
  mandatory, so the button is inert until one is attached. An hour went into
  chasing this as a regression. It is not one.
- **Two buttons read "Log workout"** — the Today page's opener and the sheet's
  submit. A `querySelector` that picks the first visible one picks the wrong
  one and the click silently does nothing.
- **`getComputedStyle` inside a release probe changes the answer.** Reading
  style synchronously after `touchend` forces a recalc before React commits,
  which made a 260ms transition appear where the app would really have used
  80ms. Sample from rAF only, never between the release and React's commit.
- The sandbox logs `WebSocket ... 54321/realtime` errors constantly. Harmless,
  pre-existing.
- iCloud is still duplicating files in worktrees under `~/Documents`. A
  `node_modules 2` symlink appeared again. Stage by explicit path.
- The shared `node_modules` in `Codex Space/Fero` has **no `@capacitor/*`**.
  Symlink to `fero-testflight-build-2/node_modules` instead when building
  anything that imports haptics.

---

## 7. Next actions, in order

1. **Wait for build 7.** Aadhil tests the press-time haptic, tab haptics, the
   shudder and the new 260ms transitions.
2. If 260ms is sluggish on tabs, change `SCREEN_SETTLE_MS` only for the tab
   path — it would need splitting back into two constants, both still driving
   CSS and commit together.
3. **The cancelled Bloc back-swipe** still calls `setBlocDragging(false)` at
   release via `releaseSwipeBack` and has the same stall shape as the committed
   one had. Deliberately left out of `8fecd10` and `3b525da` rather than
   widening them. It has no commit callback to fold into, so it needs a
   timeout — its own small change.
4. The in-Bloc tab shadow strip in §3, if Aadhil ever reports it.
5. **Aadhil still owes a decision** on when Fero asks for notification
   permission. iOS only asks once. Do not pick this for him.
