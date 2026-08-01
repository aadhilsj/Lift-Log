# Recurring Debugging Playbook

This file records fixes for bugs that have repeated during the Fero preview branch work. Read this before re-fixing one of these symptoms.

## Swipe Navigation Contract

This is the current intended behavior for swipe navigation. If swipe regressions come back, preserve this contract before changing thresholds or animation code.

Surfaces:
- Main in-Bloc tabs swipe horizontally in this order: Today -> Activity -> Month -> History, and back in reverse.
- Today can swipe right out to the Bloc switcher.
- Account Profile swipes right back to the Bloc switcher.
- In-Bloc Player Profile swipes right back to the entry screen, either Today or History.
- Log comment screens and settings screens have their own back-swipe surfaces; keep them separate from the main tab swipe.

Interaction rules:
- A half-swipe must show both screens at once and track the finger directly.
- The destination/source screen behind the moving surface must already be mounted, static, and visually ready. It should not generate after the swipe finishes.
- Swiping must not reset scroll position. Explicit tab taps may still use `navResetToken`/intentional resets, but horizontal swipe navigation must preserve where the user was.
- The release must always snap to either the origin or destination. It must never get stuck mid-swipe.
- No flicker, white flash, background flash, or previous-screen flash should appear during release.
- Horizontal swipes should win over tiny initial vertical jitter. Do not lock into scroll from the first few pixels unless there is a clear vertical signal.

Implementation rules:
- Main tab dragging in `src/App.jsx` uses refs plus `requestAnimationFrame`, not React state updates on every `touchmove`.
- `pageDragXRef` and direct DOM transforms drive the frame-by-frame movement.
- React state should update at gesture start/end only: target selection, dragging state, and final page commit.
- `src/lib/swipeRelease.js` owns the release handoff. Keep the sequence: cancel RAF, set the drag ref to the final value, apply the final transform, commit destination state, then cleanup after the handoff.
- Do not apply generic `translateX(0)` cleanup to the outgoing screen before React has committed the destination state.
- At rest, active swipe surfaces must use `transform: none`, not `translateX(0)`. Safari treats even `translateX(0)` as a transformed containing block and that breaks fixed children.
- For main tab gestures, the classifier in `movePageSwipe(...)` waits for either a clear horizontal or clear vertical signal. This prevents Today -> Activity from intermittently being stolen by tiny vertical jitter:
  - horizontal: `absDx > 5 && absDx > absDy * 0.72`
  - vertical: `absDy > 9 && absDy > absDx * 1.08`
  - if neither is clear, keep waiting rather than choosing scroll too early.

Mounted-page rules:
- Main tab pages are rendered in the same swipe track so adjacent pages can be visible during drag.
- Do not key active and preview versions differently in a way that remounts a page on arrival.
- Do not let `swipePreview` drive component identity. It can disable interaction for inactive pages, but it must not create a new page instance on release.
- Keep Activity/History/Month data derivation tied to actual data changes, not tab activation.

Mobile nav indicator:
- The bottom nav active highlight is one moving element, `.mobile-tab-indicator`, not separate backgrounds on each tab.
- `src/pages/Nav.jsx` maps pages to slots: Today `0`, Activity `1`, Month `3`, History `4`; slot `2` is the center log button.
- The indicator moves by changing `--mobile-active-slot`; tab buttons only change text/icon color.
- Do not tie the moving nav indicator to drag position unless explicitly redesigning that interaction. Current behavior animates on page commit only.

## Swipe And Fixed-Layer Flicker

Symptoms:
- Returning from an in-Bloc player profile to Today or History flickers or briefly regenerates the source screen.
- Swiping from Today back to the Bloc switcher flashes the Today screen or shakes during the settle.
- A fixed profile layer appears under the app header, shows the source screen at the top, or locks the wrong scroll container.

Fix rules:
- Keep the source screen mounted behind profile layers. Do not replace Today/History with `PlayerProfile`.
- Keep the source screen in a stable wrapper while the profile layer opens and closes. Changing the parent DOM shape on close can remount the source screen and cause a visible flicker.
- The active in-Bloc page must have `transform: none` at rest. `transform: translateX(0)` still creates a transformed containing block in Safari and breaks `position: fixed` descendants such as `.in-bloc-profile-layer`.
- During a completed swipe, do not clear/reset the outgoing surface before React has committed the destination state. For Today -> Bloc switcher, the active Bloc surface unmounts after `persistGroupSelection(null)`, so there is no need to clear its inline transform during the handoff.
- For cancelled swipes, animate back to `0` and only clear target state after the snap-back transition.

Known-good files/patterns:
- `src/App.jsx`: `applyPageTransforms(...)` uses `"none"` at rest, not `"translateX(0)"`.
- `src/App.jsx`: completed Today -> Bloc switcher swipe keeps the final transform until the group selection is cleared.
- `src/pages/TodayPage.jsx` and `src/pages/HistoryPage.jsx`: source content remains mounted in a stable wrapper, with the profile layer rendered as a fixed sibling.
- `src/lib/swipeRelease.js`: release helpers cancel RAF, set the drag ref to the final value, apply the final transform, then commit state.
- `src/pages/PlayerProfile.jsx`: on successful profile swipe-out, keep `profileRevealActive` true until the profile unmounts. Turning it false before the close animation finishes makes the fixed layer opaque and causes a background flash before Today/History is revealed.

## In-Bloc Profile Layering

See also `docs/in-bloc-profile-swipe-layering-note-2026-07-16.md`.

Required contract:
- `.in-bloc-profile-layer` stays fixed below the Bloc header and extends behind the translucent bottom nav.
- Profile layer z-index stays below the header and bottom nav.
- The profile layer owns vertical scroll and gets the iOS top/bottom boundary guard.
- Slow horizontal swipe can temporarily make the profile layer transparent, but normal scrolling must keep it opaque.

## Expanded Activity Photo Overlay

Symptoms:
- The app header appears inside the expanded photo view.
- The close button disappears behind app chrome.
- Tapping outside the image does not close the overlay.

Fix rules:
- Render the expanded photo overlay with `createPortal(..., document.body)` so it escapes app-level stacking contexts.
- Give the overlay a high z-index above app chrome.
- The overlay background click closes the image; image content and reaction controls call `stopPropagation()`.

## Reaction Flicker And Lag

Symptoms:
- Rapid reactions appear, disappear, then reappear.
- Removing a reaction briefly shows a `0` count.
- Several reactions on several logs overwrite each other out of order.

Fix rules:
- Apply reaction changes optimistically immediately.
- Track pending per-log reaction overrides and merge refetched server state through those overrides.
- Delete empty reaction overrides so unreacting hides the chip immediately.
- Do not serialize reactions through the global destructive log mutation queue. Use reaction-specific ordering so unrelated logs/reactions do not block each other.
- Backend remains canonical-authoritative; frontend prevents stale refetches from overwriting local intent while writes are in flight.

## Stale Or Left Blocs Reappearing After Mutations

Symptoms:
- Old test Blocs that a user already left briefly reappear in the Bloc switcher after actions like create Bloc, log workout, reactions, settings saves, or profile updates.
- Refreshing the app removes them again.
- The canonical read path does not show the old Blocs, but a mutation response can still reintroduce them.

Root cause:
- Writes still hydrate from the blob compatibility shell so legacy gaps are preserved during mutation.
- If a user-facing mutation response returns the raw persisted blob state, stale/blob-only groups can be sent back to the client even though the canonical readable projection would suppress them.
- This is especially risky when `BLOB_MIRROR_SKIP_ACTIONS` is empty or missing an action in production.

Fix rules:
- Do not use `fetchReadableCurrentState()` as the base for mutation writes.
- Do persist the mutation through the existing blob/canonical mirror path.
- Before returning app state to an authenticated client, re-read the canonical readable projection and scope it through `scopeReadableStateForUser(...)`.
- Preserve response envelopes (`{ state, createdGroupId }`, `{ state, joinedGroupId }`, `{ ok, state }`) so frontend contracts do not change.
- The intended helper is `persistAndScopeReadableStateForUser(...)` in `api/lift-log.js`.

Known-good response pattern:
- `leave-bloc` was already safe: persist/mirror first, then `fetchReadableCurrentState()`, then `scopeReadableStateForUser(...)`.
- Other authenticated full-state mutation responses should follow the same pattern.
