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
- At rest, only the active main-tab page is visible. Reveal another page only when it becomes the current swipe target or a staged tab-tap transition participant; otherwise a stale inline transform can make multiple pages overlap after an active-tab reselect.
- Active-tab reselect must restore every mounted layer to the selected page's coordinates. Do not blank every layer's transform: React may see unchanged style props and leave the blanked DOM styles in place.
- Tab taps and finger swipes have different motion lifecycles. A tab tap must stage source and target with transitions disabled, move them a single viewport with both visible, and hide the source only after the target reaches `x=0`. Never animate a non-adjacent tab through multiple viewport widths.
- Do not key active and preview versions differently in a way that remounts a page on arrival.
- Do not let `swipePreview` drive component identity. It can disable interaction for inactive pages, but it must not create a new page instance on release.
- Keep Activity/History/Month data derivation tied to actual data changes, not tab activation.
- Every gesture callback that reads `page` must include `page` in its hook dependencies. A stale Today closure can incorrectly keep the left-edge guard active on Month and History, making rightward back-swipes appear disabled.
- Horizontal-scroll regions such as the all-time leaderboard use the swipe-priority marker to contain horizontal drags, but their CSS touch action must still include `pan-y` so a vertical drag can scroll the parent page.

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

## Left Members Appearing In New Month Or Settlement

Symptoms:
- A member who already left a Bloc appears in the next month summary, settlement, furthest-behind card, or all-time/history views.
- Removing that member would change the previous month from a penalty month to a perfect/cleared month.
- Canonical `bloc_members.left_at` is null or the legacy blob still has the member in `memberships`/`memberOrder`.

Root cause:
- The rollover canonical sync wrote one `season_member_status` row per name in the closed blob snapshot and always sent `joined_for_month: true`.
- If a departed member survived in legacy snapshot data, canonical history later treated them as a real participant for that closed month.
- Separately, the legacy leave path was clearing the `leftMemberNames` marker for auth-linked users, so stale blob fallback did not have a suppression signal.

Fix rules:
- On departure, legacy compatibility state must add the display name to `leftMemberNames`; rejoin/join flows are responsible for removing it.
- On closed-month canonical sync, only send `joined_for_month: true` for members that are still active in `group.memberships`. For legacy-only groups with no membership ids, fall back to excluding names in `leftMemberNames`.
- Do not globally delete a departed member's old historical participation. Preserve months they actually joined, but mark them left for current/future membership and exclude them from months they did not participate in.
- If data is already bad, repair both canonical membership (`bloc_members.left_at`) and the legacy blob active membership/member order for that specific Bloc/member.

## Blank Screen When Opening A Bloc

Symptoms:
- Opening one particular Bloc from the switcher shows a blank screen, not an error card.
- It is intermittent, and only ever that Bloc.
- Restarting the app clears it every time; nothing else does.
- First seen 2026-09-02 on a newly created Bloc with no closed months yet.

Root cause:
- `monthInitialIdx` in `src/App.jsx` is app-wide state, not per-Bloc. The Today "results are in" banner and the Bloc Stream season-closed card both set it to `0`.
- It was cleared only in `handleNavSelect`, so leaving a Bloc by swipe or by the header Bloc name carried the value into the next Bloc.
- `MonthPage` then read `histReversed[selIdx]` on a Bloc with fewer (or zero) closed months and dereferenced `undefined`.
- Every in-Bloc page mounts together in the swipe track, so Month threw before Today ever painted, even though Month was not the visible tab.
- Only `TodayPage` had an error boundary, and there is no boundary at the root in `src/main.jsx`, so the throw unmounted the whole React tree.

Fix rules:
- App-wide screen state that names a Bloc-specific thing must be cleared when the Bloc changes. Clear it in the switcher's `onOpenGroup`, not in a blanket effect on `selectedGroupId` — a blanket effect breaks the Bloc Stream season-closed jump, which deliberately sets the Bloc and the month together.
- Never index into `monthHistory` without a fallback. A missing entry means "show the current month", never a crash.
- Every in-Bloc page is wrapped in `InBlocPageErrorBoundary`. Keep it that way when adding a page: because all pages mount at once, an unguarded page can blank the app from a tab the user is not even looking at.
- Zero closed months is a normal state for a new Bloc, not an edge case. Test new Blocs against Month, History and settlement views before shipping anything that reads `monthHistory`.

Diagnosis note:
- A blank screen with no error card means the throw was outside a boundary. A small error card means it was inside one. That distinction narrows the search immediately.

## Modals Opened From The Player Profile

Symptoms:
- A modal opens near the bottom of the screen, close to the nav bar, instead of centred.
- The backdrop is flat black rather than the blurred app behind it.
- The page keeps scrolling behind the modal.
- First seen 2026-09-08 on the delete-log modal, opened from the profile calendar.

Root cause:
- `PlayerProfile`'s root carries a `transform` for the back-swipe, and Safari treats **any** transform as the containing block for `position: fixed` descendants. A modal rendered inside that subtree is positioned against the profile's box, not the viewport.
- This is the same rule already recorded above for `.in-bloc-profile-layer` and the expanded photo overlay. It has now caught three separate surfaces.

Fix rules:
- Any modal that can be opened from inside a transformed screen must portal to `document.body`. Use `ModalScrim` from `src/components/primitives.jsx` — it portals, centres, blurs, and locks page scroll, and `StatusNoteModal` is built on the same piece so the two cannot drift.
- Scroll lock is part of the contract, not a nicety: restore `overflow`, `touchAction` and `overscrollBehavior` on unmount, or the page stays frozen after the modal closes.
- `className="overlay center-mobile"` alone is not enough. It works from untransformed screens and fails from the profile, which is why this keeps coming back on new modals rather than old ones.

## Derived Stream Moments Must Retract, Not Only Announce

Symptoms:
- The Bloc Stream says "X hit target" while X is below target.
- Deleting a workout leaves the congratulation in place.
- First seen 2026-09-08 in StavanGang: nine of ten, with a moment claiming ten.

Root cause:
- `buildTargetHitMoment` fires on `add-log` when the count crosses the target. Nothing removed it when a deletion crossed back the other way.
- `delete-log` did not touch the stream at all. The retraction machinery existed — `buildWorkoutLogDerivedMoments` returns `deleteKeys` — but only `add-log` ever called `syncWorkoutLogDerivedStreamMoments`.

Fix rules:
- Every derived moment needs both directions written in the same change. A moment that can be announced by a mutation can be falsified by its inverse.
- Retractions are keyed to the **subject** of the moment, not the actor. An admin deleting another member's workout must retract that member's moment; keying on the caller retracts the wrong one and leaves the wrong one standing.
- The idempotency key is the handle. Build it with the same expression that created it, or the delete silently matches nothing.

## Signing In Lands On The Onboarding Screen

Symptoms:
- A member signs in from cold onboarding screen 4, sees the progress bar finish, and is dropped back on screen 4 — signed in, session held, looking at the intro.
- Intermittent, and never reproducible from a fresh browser.
- Reported twice before it was caught: 2026-09-04 and again 2026-09-08.

Root cause:
- `closeAuth` sets `replayColdOnboarding` and `coldOnboardingInitialIndex = 3` so a **cancelled** sign-in returns to screen 4. That part is correct.
- Nothing cleared the flag again. `resetAuthFlow()` does not touch it, and only sign-out and `completeColdOnboarding()` do — neither of which a successful sign-in called.
- So the flag survived the cancel, the modal closed on success, and `shouldShowColdOnboarding` was still true.

Fix rules:
- A flag set on the cancel path must be cleared on the success path, in the same change. `resetAuthFlow()` clears the auth modal's own state and nothing outside it — do not assume it resets navigation intent.
- Signing in successfully is the end of onboarding. Clear `replayColdOnboarding`, `coldOnboardingInitialIndex` and `returnToColdOnboardingOnSignInCancel` when a verified session lands in the app.

Diagnosis note:
- **Test the second attempt, not just the first.** Every sign-in test until 2026-09-08 went fresh browser → clean sign-in, and all of them passed. The bug lived two taps off that path: cancel once, then sign in. Any flow with a cancel, a back, or a retry needs the retry exercised, not just the happy path.
- A related trap when reproducing this: `?onboarding=1` forces the intro **and keeps forcing it after a successful sign-in**, because nothing clears `coldOnboardingPreviewDismissed` on that path. It makes a working sign-in look broken. Use a private window instead.

## An Empty Result Is Not An Answer

Symptoms:
- An existing member finishes signing in and is asked "What should your Bloc call you?"
- Saving a name there renames them across every Bloc and rewrites the counts inside already-closed months.

Root cause:
- After the one-time code is verified, the client fetches the account. On failure `verifyOtpData` returned `ok:true` with `state:null`, and the caller read a missing state as `needsProfileSetup = true`.
- Nothing distinguished "the fetch failed" from "this person is new". A genuinely new member's sync **succeeds** and says so; only a broken one returns nothing.

Fix rules:
- This is the client-side twin of the rule in `AGENTS.md` §6: empty means "no data", never "the answer is no". On the client it must also never mean "the answer is yes".
- When a fetch fails, hold what you have and offer to try again. Do not infer state from its absence — especially where the inference leads to a write.
- The error was already being returned and thrown away. If a failure path carries a reason, read it: that reason is what tells a rate limit apart from a missing account.

Related, same family:
- The sign-in screen replaced **every** send failure with "No Fero account found for that email", so a 429 rate limit told a member with six Blocs that they did not exist. Only Supabase's `otp_disabled` means no account. `npm run test:otp-errors` guards this.
- A countdown that decrements once per timer tick loses whatever time a throttled or backgrounded tab does not give it — measured at roughly 0.6x real speed. Derive the number from a deadline and the clock, never by counting down.
