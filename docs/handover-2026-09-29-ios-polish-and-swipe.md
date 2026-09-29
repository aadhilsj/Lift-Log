# Handover — iOS polish, activity feed, and the swipe settle (29 September 2026)

**Pick this up and keep going.** Read `AGENTS.md` first, then
`docs/recurring-debugging-playbook.md` before touching any swipe code.

Aadhil is reviewing Fero on his own iPhone through TestFlight. He is not a
developer, wants plain English, one step at a time, and notices single pixels.

---

## 1. Where things stand

| | State |
| --- | --- |
| `main` | `2ddc545` — Capacitor deps landed late in the session |
| Claude's branch | `ios-header-and-nav-polish`, 10 commits, pushed. **Rebase onto `main` first — it moved** |
| Revert point | tag `pre-swipe-work-2026-09-29` (`a207382`) |
| Codex's branch | `codex/testflight-build-2`, pushed |
| TestFlight | **Build 5 is live and installed on his iPhone 14** |
| iOS simulator | iPhone 17 `547363ED-CC0B-41AF-8F9A-A475279B5FDF` — leave it running |
| Production RLS | **Already ON** (server-only lockdown). See §6 |

Everything in §2 has been reviewed and approved by Aadhil in the simulator, and
all of it is in build 5.

---

## 2. What shipped this session

All on `ios-header-and-nav-polish`, each commit lint- and build-clean:

- **Header rebuilt.** Icon buttons 28pt → 42pt. The wordmark left the mobile
  header so the Bloc name could take the left edge, aligned to the same 14px
  column the page content starts on. FERO still fronts the Bloc switcher.
- **Bloc name never truncates.** It auto-shrinks 19pt → 12pt to fit, and a
  24-character cap is enforced in the create form, cold onboarding, the rename
  field and the API. Nothing capped Bloc names before. 24 is what still fits a
  375pt iPhone SE at the smallest size; the longest real name is 19.
- **Bottom nav regression fixed.** `23px + env(safe-area-inset-bottom)` and
  `108px + ...` were tuned while the inset resolved to 0. Four drifting call
  sites now share `--bottom-nav-offset` / `--bottom-nav-clearance`, and a scrim
  fades content out behind the bar.
- **Account screen safe area.** Its whole 40pt header row — back button and
  "Profile" title — was drawn *underneath* the Dynamic Island and unreachable.
  The button was never missing. Arrow is now muted, per Aadhil.
- **Switcher wordmark** moved onto the top row, absolutely centred so the
  Dashboard button cannot shove it off centre.
- **Founder Dashboard moved** from the Bloc switcher into the account screen,
  so the switcher header is identical for founders and members.
- **Activity feed controls 22pt → 28pt**, matching the 28pt avatar. 34pt was
  tried and rejected: a control must never outweigh the person's face.
- **Activity card layout fixed.** The right column was pinned
  `alignItems:flex-start` with a hard-coded 72×72 photo, so a taller card left
  dead space and the comment chip drifted up out of line with the reactions.

Desktop was not touched anywhere. Fero ships mobile only.

---

## 3. THE OPEN PROBLEM — the swipe settle

**This is the work in progress.** Aadhil's words after testing build 5:

> "the swipe still doesn't feel super smooth. especially when swiping out of
> today into bloc switcher. the swipe in itself is fine its the transitioning
> between screens that feels laggy and not super smooth"

Read that carefully: **the finger-tracking is fine.** The problem is the settle
*after release*. That is a different fault from the one already fixed.

### Already fixed (in build 5, and it did help)

Three faults in the Today → Bloc switcher gesture:
- the classifier committed to a mode after 4px on a naive `absDx > absDy`, so a
  few pixels of downward drift locked it into "scroll" and the gesture died.
  This broke the playbook contract. Now uses the `movePageSwipe` thresholds
  (5 / 0.72 horizontal, 9 / 1.08 vertical) and waits when neither is clear.
- the commit threshold was **half** the screen width. Now `0.32`.
- the settle was 80ms. Now `BLOC_SWIPE_SETTLE_MS = 260` on
  `cubic-bezier(.32,.72,0,1)`.

### THE LEAD — two competing transitions on the same element

**Strong hypothesis, not yet confirmed. Start here.**

The in-Bloc surface gets its transition from **two places**:

- `src/App.jsx:3437` — React's inline style: `transition: blocDragging ? "none"
  : "transform .08s ease-out"`
- `src/App.jsx:1795` — `applyBlocTransforms` imperatively:
  `transform ${BLOC_SWIPE_SETTLE_MS}ms ${BLOC_SWIPE_EASING}` (260ms)

`releaseSwipeForward` calls `setDragging(false)` **and then**
`applyTransform(finalX,false)`. The state change schedules a React re-render,
and when React re-renders it writes `.08s` back over the 260ms.

If that is what happens, the surface slides in **80ms** and then sits still for
**180ms** before `persistGroupSelection(null)` swaps the screen — which would
feel exactly like "the swipe is fine, the transition is laggy".

**Verify before fixing.** Instrument or inspect the live computed
`transition-duration` on that element at the moment of release. Do not assume.

### Other suspects, in order

1. **The commit is one big synchronous React tree swap.** At the 260ms mark
   `persistGroupSelection(null)` unmounts the entire Bloc tree (Nav, Today,
   leaderboard) and mounts the switcher in a single commit. That is expensive
   and lands exactly at the end of the animation.
2. **Is the switcher actually mounted and ready behind the moving surface?**
   The playbook is explicit: *"The destination/source screen behind the moving
   surface must already be mounted, static, and visually ready. It should not
   generate after the swipe finishes."* This was being checked when the session
   was interrupted — `switcherRevealInteractive` (`App.jsx:446, 3435`) is the
   thread to pull.
3. **`setDragging(false)` at release re-renders the whole App tree** right as
   the animation starts. `App.jsx` is very large.

### Rules you must not break while fixing it

- `transform: none` at rest, never `translateX(0)` — Safari treats even
  `translateX(0)` as a transformed containing block and it breaks fixed children.
- Do **not** touch the main tab gesture. Its pages animate in 80ms via
  `applyInBlocPageTransforms`. Raising only its commit delay stalls every tab
  swipe for 180ms — this was nearly shipped this session and caught before build.
- Keep the `swipeRelease.js` sequence: cancel RAF, set drag ref, apply final
  transform, commit destination state, cleanup after the handoff.
- The CSS duration and `transitionMs` must stay driven by one constant.

---

## 4. The haptic bug — diagnosed, not fixed, BLOCKED

Aadhil feels **no buzz** when logging a workout in build 5.

**Cause found.** `src/pages/TodayPage.jsx:241` dispatches on `targetGroupIds`:
anything with a Bloc list goes to `onMultiLog` → `handleMultiLog`. Codex's
haptic is on `handleSave`, the *other* branch. A member of several Blocs — which
Aadhil is — never reaches it. The haptic is correct but unreachable.

This was Claude's placement call, not Codex's error; Codex was told to add one
example and leave placement to Claude.

**Agreed rule, decided 29 Sep: one buzz per user action, never one per Bloc.**
Six Blocs → one buzz. Partial success → still one buzz. Nothing saved → no buzz.
Fire only after the API confirms, never on an optimistic update.

**The blocker cleared at the end of the session.** `main` is now `2ddc545`,
which carries `@capacitor/core` and `@capacitor/haptics`. Rebase onto `main`,
confirm `src/lib/haptics.js` came with it (if only the dependencies landed, the
helper still lives on `codex/testflight-build-2` and must be brought across),
then add the haptic to `handleMultiLog` on success. Nothing else stands in the
way.

Also still wanted, same blocker: **haptics on tab changes** (Today → Activity
etc.), on both swipe and nav-bar tap.

---

## 5. Codex's work — reviewed and passed

Two plumbing tasks on `codex/testflight-build-2`:

- **Haptics.** `src/lib/haptics.js` with five named intents, guarded on
  `isNativePlatform()` and plugin availability, everything in try/catch. One
  example call site. Verified: fires only after `saved?.ok && saved.data`.
- **Push notification foundation.** Device-token table, four server-only RPCs,
  APNs sender, registration endpoint. **No UI, no bell behaviour, no badges, no
  triggers** — those are Claude's, deliberately.

Independently verified by Claude, not taken on trust:
- no `APNS_*` or `SERVICE_ROLE` anywhere in `src/`; `server/push.js` is never
  imported by client code
- the permission prompt is genuinely dormant — only tests call it
- `ante_core.push_devices`: `service_role` only; `anon` and `authenticated` have
  no privileges

**Still undecided by Aadhil:** when to ask for notification permission. iOS only
asks once. Codex proposed after the first successful workout log. Do not pick
this for him.

Build 5 was signed **without** the push entitlement (the existing distribution
profile does not permit push). Approved as a one-off so the swipe test could
happen; the push foundation is untouched in source.

---

## 6. Production RLS — the docs were wrong, this is settled

Verified directly on `bpvvvqjsfwmmfjvvijkd` on 29 Sep: `ante_core.profiles`,
`blocs`, `bloc_members` and `public.lift_log_state` all have
`rowsecurity = true` with **zero policies**, and `anon` / `authenticated` hold
**no table privileges at all**.

That is the intended **server-only lockdown**, already applied. The app works
because every read goes through the API on the service role. **Nothing to fix.**

Older docs saying "Production RLS is still OFF" are stale; Codex has corrected
them. What remains pending after the 1 October close is the **policy-based** RLS
for direct client reads — a different piece of work.

---

## 7. Things that will bite you

- **iCloud is duplicating files inside live git worktrees.** `authShell 2.jsx`,
  `ProfilePage 2.jsx` and `config 2.xml` all appeared this session. The FERO
  worktrees live under `~/Documents`, which syncs. Stage by explicit path, never
  `git add -A`, and consider moving the worktrees out of iCloud.
- **Two browser tests fail and it is not your fault.** `test:auth-edge-flows`
  and `test:mobile-navigation` fail identically on clean `main` — verified by
  stashing everything and re-running. Pre-existing.
- **Capacitor does not give more rendering resources.** It is WKWebView, the
  same engine as Safari. What it genuinely unlocks: native haptics, disabling
  the WebView's own bounce/overscroll, and controlling the system edge-swipe
  that competes with the Today → switcher gesture at the left edge.
- **The `compact` flag in `ActivityFeed.jsx` is used by the feed itself**, not
  only the lightbox — photo posts and text posts take different branches. Size
  both or the same screen shows two button sizes.
- **Check which code path actually runs before believing a feature works.** The
  haptic in §4 was correct and unreachable for a week's worth of testing.

---

## 8. Next actions, in order

1. **Verify the two-competing-transitions lead in §3**, then fix the settle.
2. **When `2ddc545` lands on main:** add the haptic to `handleMultiLog`
   (one buzz), then wire tab-change haptics.
3. Aadhil to decide the notification permission moment; then Claude designs the
   invitation and Codex wires the trigger.
4. Apple APNs key setup — Aadhil at his own keyboard. Never ask him to paste the
   `.p8` into chat.
