# Recurring Debugging Playbook

This file records fixes for bugs that have repeated during the Fero preview branch work. Read this before re-fixing one of these symptoms.

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
