# In-Bloc Profile Swipe And Layering Note

Current working setup on `feature/chat` as of 2026-07-16. Do not change this profile/swipe layering unless the user explicitly asks.

## Entry Points

- Today screen opens member profiles from `src/pages/TodayPage.jsx`.
- History screen opens member profiles from `src/pages/HistoryPage.jsx`.
- Both render `PlayerProfile` from `src/pages/PlayerProfile.jsx`.

## Layering Contract

- The Bloc header and bottom nav must remain visible while viewing an in-Bloc player profile.
- The profile content must not sit underneath the header or bottom nav.
- The profile scroll area is `.in-bloc-profile-layer` in `src/styles/app.css`.
- `.in-bloc-profile-layer` is positioned below the mobile header and above the mobile bottom nav:
  - mobile top: `calc(env(safe-area-inset-top) + 44px)`
  - mobile bottom: `calc(86px + env(safe-area-inset-bottom))`
  - z-index: `90`, intentionally below `.mobile-nav-shell` (`100`) and `.mobile-bottom-nav` (`140`)

## Swipe Behavior

- `PlayerProfile` owns the horizontal swipe-back gesture.
- Swipe timing and threshold are intentionally sensitive/fast:
  - close delay: `45ms`
  - transform transition: `.08s ease-out`
- During a horizontal back-swipe, `PlayerProfile` calls `onSwipeRevealChange(true)`.
- Today/History use `profileRevealActive` to make `.in-bloc-profile-layer` transparent only during that active swipe, so the source screen is visible behind the moving profile.
- During normal vertical scrolling, the layer stays opaque with the app gradient background.

## Scroll Behavior

- The profile layer has its own scroll container via `.in-bloc-profile-layer`.
- Today/History attach a top/bottom touch boundary guard to `profileLayerRef` to prevent iOS/Safari rubber-band snap.
- On open, Today/History call `profileLayerRef.current.scrollTo({ top: 0, left: 0, behavior: "auto" })`.
- The underlying Today/History screen remains mounted while the profile layer is open so returning from the profile does not regenerate or auto-scroll the source screen.

## Things That Regressed Before

- Raising the profile above all nav (`z-index: 160`) hid the Bloc header, which the user does not want.
- Making the layer opaque all the time broke slow-swipe reveal.
- Replacing the source page with the profile caused return flicker and scroll jumps.
- Letting the profile content start at `top: 0` caused the profile header row to sit underneath the Bloc header.
