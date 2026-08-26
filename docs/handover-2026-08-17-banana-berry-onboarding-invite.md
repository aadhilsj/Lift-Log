# Handover - 2026-08-17 Banana Berry, Onboarding, Invite Flow, Preview/Main Reconciliation

This handover is for the next Codex task. The current chat became very long, so start here, then read the linked docs and inspect the current code before touching anything.

## First Actions For The Next Chat

1. Run:
   - `git status --short`
   - `git branch --show-current`
   - `git log --oneline --decorate -8`
2. Read this file completely.
3. Read the active source-of-truth plan:
   - `docs/current-plan-2026-08-01-merge-to-app-store.md`
4. Read the recurring bugs/debugging docs:
   - `docs/solved-issues-log.md`
   - `docs/recurring-debugging-playbook.md`
5. Inspect the local journey capture source before giving any Banana Berry checklist:
   - `scripts/capture-onboarding-journeys.mjs`
6. If the user says `Banana Berry`, `bananaberry`, or `bananeberry`, send the Banana Berry checklist in this document. Do not improvise from memory.

## Current Workspace State At Handover

At the time this file was created:

- Workspace: `/Users/opera_user/Documents/Codex Space/Lift Log`
- Current branch: `main`
- Current date: 2026-08-17
- Important dirty files:
  - `src/components/ColdOnboarding.jsx`
  - `src/components/authShell.jsx`
- Important untracked docs/scripts:
  - `docs/current-plan-2026-08-01-merge-to-app-store.md`
  - `docs/user-journey-screenshots/`
  - `scripts/capture-onboarding-journeys.mjs`
  - `scripts/render-onboarding-journey-pack.mjs`

Do not assume the working tree is clean. Do not discard changes. These changes are part of the current onboarding/invite handoff context.

## Recent Source Drift Fix

The user found that the local Banana Berry preview had reverted to old onboarding UI:

- Screen 3 showed month pills such as June/July.
- Screen 4 showed invite slots and a `BLOC NAME` label.
- Invite preview had old fake members/CTAs.

This was source drift, not an intentional product decision. The current uncommitted patches restore the approved direction:

- `src/components/ColdOnboarding.jsx`
  - Removed month pills from the settlement cards.
  - Removed hardcoded `month: "June"` and `month: "July"` onboarding settlement props.
  - Removed the `BLOC NAME` label above the final Bloc name input.
  - Removed invite slot label and five invite-slot circles from onboarding screen 4.
- `src/components/authShell.jsx`
  - Removed old static preview members (`Kai`, `Jonah`, `Priya`, etc.).
  - Invite preview now uses real `inviteContext.leaderboardRows`, sorted by logged count, top three.
  - Preview header is the Bloc name only, plus target/member metadata.
  - Invite preview copy is `Welcome to the Bloc that keeps you showing up.`
  - Removed `See how Fero works`.
  - Removed `Create a Bloc` and `Already have an account? Sign in` from invite preview.
  - Invite preview leaves only `Join this Bloc`, or a full-Bloc blocked message when applicable.

Verification already run:

- `rg` showed no matches in the touched flow files for stale strings:
  - `PREVIEW_MEMBERS`
  - `See how Fero works`
  - `Sunday Runners Bloc`
  - `Already have an account? Sign in`
  - `INVITE SLOTS`
  - `BLOC NAME`
  - `month: "June"`
  - `month: "July"`
- `vite build` passed, with only the normal large chunk warning.
- Local API server responded at `http://192.168.1.224:3000`.

## What Has Been Built Or Fixed In This Long Thread

### Comment Threads And Bloc Stream Entry

- Comment thread was moved from pull-up modal to a dedicated screen.
- Swipe-out works from both entry points:
  - Activity Feed -> comment screen -> swipe back to Activity Feed.
  - Bloc Stream -> comment screen -> swipe back to Bloc Stream.
- Background screen stays visible/static during swipe.
- Composer/keyboard issues from the old modal were avoided by using a standalone screen.
- Bloc Stream open position was fixed:
  - If 0 unread, open at most recent messages.
  - If unread, open at oldest unread.
  - Avoid delayed regeneration/empty stream after returning from comments.

### Swipe Navigation

- Main screen swipe navigation was added:
  - Today <-> Activity <-> Month <-> History.
  - Today can swipe out to Bloc Switcher.
  - Profile screens can swipe out back to the originating screen.
- Major swipe diagnosis/fix:
  - Previous `pageDragX` state updates during `touchmove` caused re-renders.
  - Reworked drag to refs/requestAnimationFrame/direct DOM transform.
  - React state now changes only at gesture start/end where possible.
  - Stabilized page identity so preview/active pages do not remount on arrival.
  - Removed `swipePreview`-driven key remounts where they caused flicker.
  - Built shared release/snap behavior so release handoff is atomic.
  - Fixed stuck half-swipe and one-frame shake/flash on settle.
  - Preserved scroll position across swipe navigation.
- Important swipe rules:
  - Drag should track finger 1:1.
  - No screen should auto-scroll during a swipe.
  - The destination screen should already be mounted/rendered.
  - No `translateX(0)` cleanup should run on the old active page before destination state commits.
- Known/pending:
  - Android scroll bug report: Android user said scrolling did not work except in chat interface. User installed Android Studio but deferred emulator testing. Keep this in the App Store readiness plan.
  - History all-time leaderboard has its own horizontal gesture. Page swipe should not steal gestures from that leaderboard area unless the gesture is clearly intentional.

### Floating Nav Bar

- Bottom nav was redesigned into a smaller translucent floating bar.
- Bar was slightly brightened and moved upward for thumb reach.
- Plus button was enlarged.
- Active tab highlight was adjusted to move smoothly rather than disappear/reappear.
- Current behavior is approved enough for now.

### Activity Feed And Reactions

- Activity Feed reaction picker clipping bug:
  - First activity in a list could show a clipped emoji picker.
  - Fix was applied on preview.
  - Also fixed picker causing the activity card/container to expand after opening.
- Bloc Stream reaction changes:
  - Reaction badges attach to message bubble/card bottom edge instead of floating in a row.
  - Own message badge sits bottom-left of right-aligned bubble.
  - Other-user message badge sits bottom-right of left-aligned bubble.
  - Center/system cards have centered overlapping reaction badge.
  - Badge styling became smaller, Instagram-like, less translucent.
  - Tap reaction badge opens roster.
  - Long-press on reaction badge does nothing.
  - Long-press on the message itself still opens emoji picker.
  - Double-tap still quick-likes.
  - Roster placement flips for long received messages to avoid overflowing right edge.
  - System moment/reaction/message spacing was tuned.
  - Text timestamps are time-only, smaller, and grouped over a five-minute window.

### Image Viewer

- Workout image full-view issue was fixed:
  - Top app header should not appear inside the image viewer.
  - X should remain visible.
  - Tapping outside the image, excluding reaction controls, should close the viewer.

### Create Bloc, Settings, Log Workout

- Create Bloc modal:
  - Brand fonts audited and corrected.
  - Copy became `Start the Bloc now. Tune the rules after.`
  - Button hierarchy fixed: Create primary cyan, Cancel secondary outline/ghost.
  - Modal animate-in and interactive feedback were added.
  - Emoji/icon clutter was removed.
- Bloc Settings:
  - Header shortened.
  - Kept settings within the Bloc shell, not as a giant separate page.
  - Field labels capitalized.
  - Members tab is visible to non-admins but read-only.
  - Non-admins should not see `defaulted` tags for setup review defaults.
  - User requested `fine` be renamed to `penalty` everywhere: monthly penalty amount, penalty calculation, escalating penalty, etc. Verify this is fully implemented before merge.
  - Non-admin settings should show the escalating penalty increment row and show workout type icons/labels.
- Log Workout modal:
  - Removed subtitle.
  - Removed `Closes in...`.
  - Removed Date helper text.
  - Date picker should still enforce current month only.
  - Photo empty state uses compact Camera/Library controls.
  - Photo filled state shows thumbnail with two compact Camera/Library pills under it.
  - Also Log To changed from full rows to compact wrapping chips.
  - Cancel is outline/secondary and always tappable.
  - Buttons should sit naturally after content and stay above floating nav.
  - Modal opens centered and uses correct brand font.
  - X removed; Cancel handles dismissal.
  - Character counter moved inside note field bottom-right.

### Solo Mode

- Solo Mode was added inside a Bloc, not onboarding.
- Solo button lives next to Sit out in the compact Today section.
- After day 10, Solo remains visible but subdued/locked; clicking shows an in-app message:
  - Solo mode is locked for the month and only available in the first 10 days.
- First 10 days / preview override:
  - Opens a single `Go Solo for [Full Month]?` screen.
  - Full month names only, no short `Jul`.
  - Title includes a question mark.
  - No random `S` icon.
  - Helper line was increased to 11px.
  - Reason is mandatory and still present because the reason should appear in the system moment.
  - Reason examples use normal contexts like travel/busy month.
  - Solo target uses +/- stepper, not free text.
  - Solo target respects the agreed reduction limit.
  - First use in three months should be direct `Go Solo`.
  - Repeat within three months should become `Send request` with admin-approval explanatory copy.
  - Helper copy says the action cannot be undone.
- Live Solo RPC bug:
  - Friend saw `PGRST202` missing RPC for `upsert_ante_core_season_member_solo`.
  - RPC/migration was added properly and solo-only fix was pushed live.
  - Live app was confirmed good by the user.
  - Removed redundant post-activation card copy `Solo this month · target 6`.

### August Rollover And Live Data Correctness

August 1 rollover caused several live issues:

- Activity/Month/Bloc Switcher used stale July counts as August counts.
- Settlement reminders for the most recent closed month appeared too early.
- Older settlement reminders disappeared incorrectly.
- Departed member Isira appeared in OSI H3 July summary/settlement despite having left.
- Some old/left blocs briefly reappeared in Bloc Switcher after mutations.

Live/main fixes were made:

- Current month reads guard against stale previous-month canonical/blob data.
- Rollover hydrate/read path persists the correct month state.
- Settlement reminders:
  - older previous-month reminders remain visible;
  - most recent closed-month reminders stay hidden while the Last Month results card is active.
- Closed-month settlement/history filtering now excludes departed members who should not have been counted in that month.
- Stale mutation responses no longer reinsert left blocs into the visible Bloc Switcher.
- Isira was removed from OSI H3 July summary/history participation where he did not belong.

Important merge warning: do not overwrite these live/main rollover fixes with older preview code.

### Auth, Identity, Display Name

A serious identity bug was discovered:

- A new test email with the same display name as an existing user could attach to the existing account/profile.
- Root cause was display-name keyed identity in some auth/profile path.

Fix direction:

- Auth/profile identity must be keyed by auth user id/email, not display name.
- Display names can duplicate globally.
- Within the same Bloc, duplicate display names may be blocked with a friendly message to avoid confusion.
- Display name is no longer prefilled from email.
- Existing-email create-new-account attempts should be caught before OTP.
- Error should offer sign-in instead.

Modal/input fixes:

- Auth modals, OTP modals, join-code modal, and display-name screen needed tighter background lock and first-tap focus.
- First tap on modal inputs should work.
- Background behind modals must not scroll/click.

Optional profile photo:

- Added to display-name setup.
- Display name remains mandatory.
- Profile photo is optional.
- Upload should happen after profile/user identity exists.
- Upload should not block the core create/join flow.
- Ideally photo appears by the time the user lands in the Bloc, but slow/failing upload should not block entry.
- Add Photo UI should use a clear camera/image icon, text `Add Photo`, no `optional` copy.

### Cold Onboarding

Cold onboarding is only for a genuinely fresh, unauthenticated, no-Bloc user. Invite users must never see it.

Approved four-screen structure:

1. Screen 1
   - `FERO` wordmark.
   - Headline: `For the Bloc that keeps you showing up.`
   - Static leaderboard preview.
   - Supporting copy below: `A monthly target. A live leaderboard. Progress everyone can see.`
   - No three-line wrapping for the headline.
2. Screen 2
   - Headline: `Pick your people.`
   - Static real-looking activity feed preview with fake diverse names/images.
   - Supporting copy below: `Hold each other accountable.`
3. Screen 3
   - Headline: `Set a target. Set a penalty.`
   - Must stay on one line.
   - Settlement outcome visual.
   - Month pills/tags were rejected and must not return.
4. Screen 4
   - Headline: `Show up together. Or pay up.`
   - Typeable Bloc name field only.
   - `BLOC NAME` label was rejected and must not return.
   - Invite slots were rejected and must not return.
   - Copy includes `Start a Bloc. Bring your mates in. Consistency's a group sport.`
   - Link: `Join an existing Bloc instead.`

Navigation:

- Dots are centered.
- Left/right chevrons stay in the exact same position on all four screens.
- Chevrons/dots were moved upward for easier thumb reach.
- Tapping generous left/right screen zones should move backward/forward.

### Cold Create And Cold Join Flow

Cold Create:

- Onboarding -> type Bloc name -> Create Bloc modal prefilled -> auth -> OTP -> display name/photo -> progress -> land inside new Bloc.
- Must never show empty Bloc Switcher between OTP/display/progress/Bloc.
- If user cancels create modal, remain on onboarding screen 4.
- Setup review card appears in new Bloc.
- Tapping setup card opens Settings with defaulted fields highlighted.
- Tapping inside highlighted fields or saving rules clears highlight.
- Saving rules should close settings immediately and save in background.

Cold Join By Code:

- Onboarding -> join existing -> enter invite code before auth -> auth -> OTP -> display name/photo -> progress -> land inside joined Bloc.
- Must not show duplicate invite code modal after auth/display name.
- Must not show empty Bloc Switcher.

### Invite Link Flow

Invite link flow is separate from cold onboarding. Someone entering through an invite link should never see cold onboarding.

Current approved direction:

- Invite preview opens immediately from link, no Welcome Back flash.
- Preview uses the real target Bloc context:
  - real Bloc name;
  - target count;
  - member count;
  - top real leaderboard rows from invite context.
- Preview copy:
  - `FERO`
  - `Welcome to the Bloc that keeps you showing up.`
  - Bloc preview card heading should be Bloc name only, not `Join [Bloc]`.
- Preview CTAs:
  - only `Join this Bloc`.
  - no `Create a Bloc`.
  - no `Already have an account? Sign in`.
  - no `See how Fero works`.
- After auth/display-name:
  - no second invite-code confirmation modal.
  - no full `YOU'RE IN` screen.
  - land directly inside the real Bloc.
  - show a small top toast `You're in` for about two seconds.
- Download prompt:
  - only for invite-link web flow, not invite-code cold join flow.
  - nonblocking.
- Sign out after invite join:
  - should return to Welcome Back, not cold onboarding.

Pending native/App Store handoff:

- Step 6, web-to-native app handoff, is not fully built because it depends on universal/deep links/session-token decisions.
- Before App Store, build reliable handoff so a user who joined on web opens the native app directly into that Bloc and does not see cold onboarding or the invite welcome again.

## Banana Berry Meaning

When the user says `Banana Berry`, they want the exact local QA checklist for onboarding/invite flows, including URLs and expected positive results.

### Final Acceptance - 2026-08-26

Banana Berry is complete and user-approved on the local preview. The user manually verified every listed flow, including:

- profile-photo persistence from onboarding and from the main Profile screen;
- signed-in already-member invite entry without another OTP;
- accidental `Create new account` -> existing email -> `Sign in` -> OTP recovery into the existing account;
- invalid and full-invite states.

The matching identity, profile-photo storage, auth-edge, Bloc Stream moment, and production-build checks passed. Do not reopen Banana Berry as unfinished unless a regression is reproduced. Native universal/deep-link handoff remains separate App Store work.

Before sending the checklist, make sure the local server is running. If Safari says it cannot connect, start it:

```bash
HOST=0.0.0.0 PORT=3000 node scripts/local-dev-server.mjs
```

### 2026-08-24 Verified Local Startup

The Banana Berry build must come from the preview worktree, not `main` and not a temporary `/tmp` copy:

```text
/Users/opera_user/Documents/Codex Space/Lift Log Extraction
```

The checked-in/local `.env.local` placeholders currently have blank Supabase values during the laptop-migration work. The local Supabase containers still expose the correct local-only values through `supabase status`. Start port 3000 without printing or writing those values:

```bash
TASK_PREVIEW_ROOT="/Users/opera_user/Documents/Codex Space/Lift Log Extraction"
TASK_SUPABASE_ROOT="/Users/opera_user/Documents/Codex Space/Lift Log/supabase-local"
TASK_SUPABASE_BIN="/Users/opera_user/Documents/Codex Space/Lift Log/.codex-bin/supabase"
TASK_NODE_BIN="/Users/opera_user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"

eval "$("$TASK_SUPABASE_BIN" status -o env --workdir "$TASK_SUPABASE_ROOT" 2>/dev/null)"
export SUPABASE_URL="$API_URL"
export SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export ENABLE_LOCAL_DEV_OTP=true
export LOCAL_DEV_OTP_CODE=000000
# Banana Berry exercises the real email/OTP onboarding and invite paths. Keep
# fixture-profile mode off or invite/Welcome Back URLs are intercepted by the
# local "Pick your profile" screen.
export ENABLE_LOCAL_PREVIEW_AUTH=false
export HOST=0.0.0.0
export PORT=3000

cd "$TASK_PREVIEW_ROOT"
exec "$TASK_NODE_BIN" scripts/local-dev-server.mjs
```

Before handing URLs to the user, verify:

- port 3000 process working directory is `Lift Log Extraction`;
- local Supabase API is listening on 54321;
- `/api/lift-log?config=auth` reports local dev OTP enabled and local preview auth disabled;
- `ALHK05` resolves to `Join Flow Seed 191851`;
- resolve the current LAN address again before every handoff; do not reuse a prior day's address;
- a UI-selected profile photo persists in a fresh authenticated read and renders through the same-origin image proxy.

Verified on 2026-08-24:

- preview build and storage-response tests passed;
- real cold-create UI profile-photo upload persisted and rendered at 720 x 720 after landing;
- visual fixture flows 1-7 passed;
- invalid/full invite edge states passed;
- flow 8 still reproduced the documented signed-in local harness gap and must not be called approved;
- two nonblocking local 404s for optional `stream-unread-count` were observed after landing; they did not affect onboarding, profile saving, or navigation.

Verified and fixed on 2026-08-25:

- local OTP sessions now survive same-origin navigation to an invite link instead of being erased by Supabase's null initial browser-session event;
- signed-in `seed-invite@local.test` can open `ALHK05`, receive the already-member notice, and enter the Bloc without another OTP;
- an existing user who accidentally chooses `Create new account` can select `Sign in`, verify the OTP, and reach the existing account without being returned to the signup email screen;
- `scripts/test-auth-edge-flows.mjs` covers both regressions and passed against the local backend;
- identity, profile-photo storage, Bloc Stream derived-moment tests, and the production build also passed;
- flow 8's former local harness gap is resolved. Native universal/deep-link handoff still requires separate pre-App-Store verification in a development build or TestFlight.

Phone/LAN base URL used in this chat:

```text
http://192.168.1.224:3000
```

Dev OTP code:

```text
000000
```

Invite code:

```text
ALHK05
```

Use fake `@local.test` emails for repeat testing. The local harness is designed for repeated flow testing without real email cleanup.

### Banana Berry Checklist To Send

Use this checklist when asked.

#### 1. Cold Create Bloc

URL:

```text
http://192.168.1.224:3000/?onboarding=1&journey=cold-create
```

Test:

- Go through all four onboarding screens.
- Confirm screen 3 has no month pills/tags.
- Confirm screen 4 has only the Bloc name input, no invite slots and no `BLOC NAME` label.
- Type a Bloc name.
- Tap `Create your Bloc`.
- Confirm Create Bloc modal opens with the name prefilled.
- Complete modal.
- Enter a new fake email.
- Use OTP `000000`.
- Add display name and optional photo.
- Continue through progress.

Positive result:

- No empty Bloc Switcher flash.
- Lands directly inside the new Bloc.
- Profile photo appears if uploaded.
- Setup review card appears.
- Setup review opens settings and Save Rules closes immediately.

#### 2. Cold Join Existing Bloc By Code

URL:

```text
http://192.168.1.224:3000/?onboarding=1&journey=cold-join
```

Test:

- Go to screen 4.
- Tap `Join an existing Bloc instead`.
- Enter invite code `ALHK05`.
- Continue to auth.
- Use a new fake email and OTP `000000`.
- Add display name and optional photo.
- Continue through progress.

Positive result:

- Code is entered before auth.
- No background scroll/focus issues in modals.
- No duplicate invite-code modal after auth.
- No empty Bloc Switcher flash.
- Lands directly inside the joined Bloc.

#### 3. Invite Link New User

URL:

```text
http://192.168.1.224:3000/?invite=ALHK05&journey=invite-link
```

Test:

- Open the link.
- Confirm it lands immediately on invite preview, not Welcome Back first.
- Tap `Join this Bloc`.
- Auth with a new fake email and OTP `000000`.
- Add display name and optional photo.
- Continue through progress.

Positive result:

- No cold onboarding screens.
- Invite preview only has `Join this Bloc`.
- Preview card uses real invite Bloc leaderboard rows, not Kai/Jonah/Priya.
- No duplicate invite-code modal.
- No full `YOU'RE IN` screen.
- Lands inside the Bloc with a brief top `You're in` toast.
- Download prompt may appear and must be nonblocking.

#### 4. Welcome Back: Create New Account

URL:

```text
http://192.168.1.224:3000/?journey=welcome-back
```

Test:

- Confirm Welcome Back screen has only `Sign in` and `Create new account`.
- Tap `Create new account`.
- Use a new fake email and OTP `000000`.
- Confirm onboarding appears after OTP.
- Go through onboarding.
- Create Bloc.
- Add display name/photo only after choosing create/join path.

Positive result:

- Display-name/photo screen does not appear immediately after OTP before onboarding.
- Existing email is caught before OTP and offers sign-in instead.
- New account can complete onboarding and land inside a new Bloc.

#### 5. Welcome Back: Existing Sign-In

URL:

```text
http://192.168.1.224:3000/?journey=welcome-back-signin
```

Test:

- Tap `Sign in`.
- Use an existing local test email and OTP `000000`.

Positive result:

- Returns to existing account/Bloc Switcher.
- Can enter existing Bloc.
- No onboarding.
- No display-name setup.

#### 6. Invite Link: Existing User Joins New Bloc

URL:

```text
http://192.168.1.224:3000/?invite=ALHK05&journey=invite-existing
```

Test:

- Open invite preview.
- Use an existing fake account that is not already in the invited Bloc.
- Complete OTP.

Positive result:

- No display-name setup because account already has profile.
- No cold onboarding.
- Progress appears.
- Lands inside the newly joined Bloc.

#### 7. Invite Link: Already Member Signed Out

URL:

```text
http://192.168.1.224:3000/?invite=ALHK05&journey=already-member-signed-out
```

Test:

- Open invite preview while signed out.
- Enter the email of a user already in the invited Bloc.

Positive result:

- App recognizes membership before OTP where possible.
- Friendly screen/message says user is already in this Bloc.
- CTA lets user enter the Bloc.
- No duplicate membership error.
- No cold onboarding.

#### 8. Invite Link: Already Member Signed In

Test:

- Sign in as a user who already belongs to the invited Bloc.
- Open the invite link in the same browser/session.
- Tap `Join this Bloc` if the preview does not route immediately.

Positive result:

- The app recognizes the existing membership.
- No second OTP is required.
- The user sees the friendly already-member state and can enter the Bloc, or is routed directly into it.
- This passed local manual and automated verification on 2026-08-26.

#### 9. Invite Link Edge States

Invalid invite URL:

```text
http://192.168.1.224:3000/?invite=INVALID&journey=invalid-invite
```

Positive result:

- Dead screen says invite does not work.
- No sign-in CTA.

Full Bloc URL:

```text
http://192.168.1.224:3000/?invite=ALHK05&full=1&journey=full-invite
```

Positive result:

- Invite preview may load.
- Joining is blocked with `This Bloc is full. Maximum 20 members allowed.`
- Copy uses the correct brand font.

## Approved Flow Status

User has manually approved:

- Cold Create Bloc.
- Cold Join Existing Bloc by Code.
- Welcome Back Existing Sign-In.
- Welcome Back Create New Account.
- Invite Link New User.
- Invite Link Already Member Signed Out.
- Invite Link Already Member Signed In.
- Existing-account recovery after accidentally choosing Create New Account.
- Invalid invite edge state.
- Full Bloc edge state.
- Sign-out after invite link join returns Welcome Back.
- Profile-photo persistence from onboarding and the main Profile screen.

Not fully approved:

- Android scrolling on emulator/device.
- App Store web-to-native handoff.

## FigJam / Journey Board

FigJam board:

```text
https://www.figma.com/board/uFFg9GtkhuPAWOUCu5zkSZ/Welcome-to-FigJam?node-id=0-1&p=f&t=xvoLZnjEEoGYWfu4-0
```

The user manually corrected wrong screenshots after MCP/FigJam limits. As of screenshots sent on 2026-08-17:

- `01 Cold Create Bloc` looks corrected.
- `02 Cold Join Existing Bloc By Code` looks corrected.
- `03 Invite Link New User` looks corrected.
- `04 Welcome Back: Create New Account` looks corrected.
- `05 Welcome Back: Existing Sign-In` looks corrected.
- `06 Invite Link: Existing User Joins New Bloc` looks corrected.
- `07 Invite Link: Already Member (Signed Out)` looks corrected.
- `08 Invite Link: Already Member (Signed In)` remains marked as `Local Harness Gap`.
- `09 Invite Link Edge States` is present.

Do not claim tool-level confirmation unless the Figma connector works again. The last confirmation was visual, via user screenshots.

Local screenshot source:

- `docs/user-journey-screenshots/2026-08-14-real-app-extended-v8/`
- Generated by:
  - `scripts/capture-onboarding-journeys.mjs`
  - `scripts/render-onboarding-journey-pack.mjs`

## Main Vs Preview / Merge Plan

The active plan is `docs/current-plan-2026-08-01-merge-to-app-store.md`.

Core rule:

- Do not merge preview wholesale into `main`.
- `main` contains live data-correctness fixes from the August rollover incident.
- Preview/testing contains onboarding/invite/product polish.
- The final merge must deliberately reconcile preview flow work on top of current live fixes.

Live/main has critical fixes that must survive:

- August rollover correctness.
- Current month counts not stale.
- Settlement reminder timing.
- Departed-member filtering for closed months.
- Stale mutation response protection for left blocs.
- Today overscroll / Bloc Switcher bleed fix.
- Solo Mode live RPC fix.

Preview/testing has work that live may not yet have:

- Full cold onboarding and invite flow work.
- Optional profile photo in display-name setup.
- Local dev OTP harness.
- Journey capture scripts and FigJam screenshots.
- Activity Feed reaction picker clipping/expansion fix.
- Some product polish around setup review/auth modals/invite preview.

Before merge:

1. Start from current `main`.
2. Reapply/merge onboarding + invite flow changes carefully.
3. Preserve all live rollover/settlement/membership fixes.
4. Run Banana Berry checklist.
5. Run live data smoke tests for existing real blocs.
6. Run build.
7. Verify no stale onboarding UI returned:
   - no screen 3 month tags;
   - no screen 4 invite slots;
   - no old invite preview fake members/CTAs.

## Before App Store

These are pre-App Store blockers or near-blockers:

- Blob/canonical retirement audit:
  - Retire blob compatibility paths or prove remaining blob dependencies are inert.
  - Audit auth/profile repair, display-name shell repair, upsert profile mirror, delete account cleanup, sitout/solo/settlement compatibility, read fallbacks.
- Rebrand audit:
  - Browser tab/PWA/email still had old names in places: `Firo`, `Anté`, `NT`.
  - OTP email reportedly said `Your NT sign-in code`.
  - Web tab/PWA name reportedly `Firo`.
- Native deep-link handoff:
  - Universal/deep link/session-token handoff for invite-link users who install/open native app.
- Android QA:
  - Android scrolling bug report must be tested in Android Studio emulator or physical Android.
- Optional profile photo robustness:
  - Confirm upload failures do not block create/join.
- Signed-in already-member invite path:
  - Web/local session behavior is approved. Re-verify the corresponding native universal-link path once the app shell exists.

## Pending Ops Task

User asked to invite CTO:

- GitHub username: `Deveen-Harischandra`
- Email: `deveen2002@gmail.com`
- Needs push access to GitHub repo and access to Supabase and Vercel.

This was not completed in this chat. Do not claim it was done.

## Communication Notes

- User is highly sensitive to regressions and repeated bugs. If something was fixed before, search docs/source before changing it.
- Do not “silently revert” approved UI. If current source differs from approved screenshots, call it source drift and fix intentionally.
- For visual flow work, verify with the actual local preview, not mock approximations.
- For any final answer after continuing this handover, be explicit about:
  - what was changed;
  - what was tested;
  - what was not tested.
