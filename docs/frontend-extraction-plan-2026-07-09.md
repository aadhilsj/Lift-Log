# Frontend Extraction Plan — 2026-07-09

This note defines the recommended extraction path after the production auth
gate landed on branch `codex/create-group-canonical-first` at commit
`455c0b1`.

The goal is not "modernize for its own sake". The goal is:

1. remove runtime Babel before App Store work
2. split the 7k+ line monolith into file-disjoint surfaces
3. unlock parallel work between frontend feature/UI changes and backend
   migration work

## Current Frontend Reality

The repo still has no real frontend build system.

Current shell:

- [`index.html`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/index.html)
  - includes CDN React
  - includes CDN ReactDOM
  - includes CDN Supabase browser client
  - includes runtime Babel
  - contains inline CSS
  - contains the entire app script in one `<script type="text/babel">`
- [`sw.js`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/sw.js)
  - caches `./index.html`
  - caches CDN React / ReactDOM / Supabase / Babel
  - excludes `/api/*`

This means extraction is coupled to shell caching. It is not just a JSX
rewrite.

## Good News

The monolith is large but not shapeless.

The app already has a usable internal segmentation:

- shared constants and state helpers near the top
- auth/bootstrap and data fetch helpers
- shared primitives/icons
- modal components
- page components
- root `App`

That makes extraction much safer than a truly tangled inline app.

## Component Map From Current `index.html`

Shared UI / primitives:

- `Avatar`
- `CategoryIcon`
- `WorkoutTypeIcon`
- `ChevronRightIcon`
- `TargetHitHexIcon`
- `StatusBadge`
- `RankIcon`
- `TrophyIcon`
- `MedalIcon`
- `UploadPhotoIcon`
- `Bar`
- `Card`
- `AppIcon`
- `AnteWordmark`
- `Spinner`
- `InstallBanner`
- `WorkoutCategorySelector`
- `SettingsField`
- `SelectField`
- `StepperField`
- `PrimaryActionButton`

Auth / identity / shell modals:

- `PreviewLanding`
- `ProfileModal`
- `JoinGroupModal`
- `AuthFlowModal`
- `IdentitySetup`
- `GroupHome`
- `WhoAreYou`
- `GroupAccessNotice`
- `LocalDevImpersonationBar`

Bloc / lifecycle / logging modals:

- `GroupCreateModal`
- `GroupSettingsFields`
- `GroupSettingsModal`
- `CropModal`
- `LogModal`
- `DeleteModal`
- `SitOutModal`
- `ProrationChoiceModal`
- `TextEntryModal`
- `NoticeModal`
- `ImageLightbox`
- `PinModal`

Page-level components:

- `Nav`
- `ActivityFeed`
- `PlayerProfile`
- `TodayPage`
- `ActivityPage`
- `SettlementScreen`
- `MonthPage`
- `HistoryPage`
- `App`

## Hidden Coupling That Must Be Preserved

These are the things most likely to break a naive extraction:

### 1. Auth bootstrap

Current flow depends on:

- public `GET /api/lift-log?config=auth`
- Supabase browser client bootstrap
- auth session hydration
- `auth-sync`
- signed-in state fetch via `GET /api/lift-log`

This is the highest-risk runtime boundary.

### 2. Service worker shell caching

Current service worker explicitly caches:

- `./index.html`
- CDN assets including Babel

Once extraction lands, `sw.js` has to stop assuming:

- a single HTML-driven shell
- CDN React assets as durable shell dependencies
- Babel exists at all

### 3. PWA install / mobile shell behavior

The app relies on:

- `manifest.webmanifest`
- `navigator.serviceWorker.register("./sw.js")`
- cached shell offline-ish behavior

This must stay stable through extraction because the live user experience is
phone/PWA-heavy.

### 4. Local preview auth mode

The app has a local preview auth branch wired through auth bootstrap. That
must keep working in preview/dev after extraction.

## Recommended Extraction Architecture

Use Vite with React.

Recommended target structure:

- `package.json`
- `vite.config.js`
- `src/main.jsx`
- `src/App.jsx`
- `src/styles/app.css`
- `src/lib/`
- `src/components/`
- `src/pages/`
- `src/modals/`

Do **not** change the backend app contract during extraction.

Keep:

- `api/lift-log.js`
- `./api/lift-log?config=auth`
- current normalized app-state shape
- current POST/PUT action contracts

The extraction should be a frontend packaging refactor first, not a behavior
rewrite.

## Recommended Cut Order

One agent should own this end-to-end.

### Phase 1 — Build shell bootstrap

Create the build system without changing behavior:

- add `package.json`
- add Vite config
- add `src/main.jsx`
- move inline CSS into a stylesheet
- move inline app script into source files

Success condition:

- app still renders identically in preview
- no runtime Babel remains

### Phase 2 — Lift the root app and data layer

Extract first:

- app constants
- fetch/auth helpers
- state normalization helpers
- `App`

This gives the rest of the component tree a stable import surface.

### Phase 3 — Extract by surface, not by line count

Recommended order:

1. shared icons / primitives
2. auth shell + identity surfaces
3. modal stack
4. page components
5. service worker update

Avoid mixing random components from different layers in the same step.

### Phase 4 — PWA / cache cleanup

Update [`sw.js`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/sw.js)
to cache the built shell instead of:

- runtime Babel
- CDN React dependencies

This is the required closeout step, not an optional polish pass.

## What Should *Not* Happen During Extraction

Avoid bundling these changes into the same PR/branch slice:

- backend read/write migration changes
- data-model changes
- display-name de-keying
- new chat feature work
- moderation feature work
- Capacitor shell work

Those can follow after the extraction unlocks file-disjoint parallelism.

## Recommended Ownership Split After Extraction

If parallel mode starts immediately after extraction:

- backend / migration owner:
  - `api/lift-log.js`
  - SQL / Supabase migration work
  - auth boundary work
  - blob retirement
  - display-name de-keying
- frontend / feature owner:
  - `src/components/*`
  - `src/pages/*`
  - chat UI
  - redesigns / polish
  - App Store-facing interface work that does not alter backend contracts

## Acceptance Checklist

Extraction is only "done enough" when all of these are true:

- app boots from a real build, not runtime Babel
- sign-in / sign-out still work
- signed-in state refresh still works
- create / join bloc still work
- logging, reactions, flagging, settlements still work
- history/results/today all render correctly
- service worker still behaves correctly after deploy
- preview and production PWA do not get stuck on stale shell assets

## Immediate Recommendation

The next move should be:

1. keep the auth gate as landed
2. start a dedicated extraction branch/worktree
3. let one agent own extraction completely
4. do not resume mixed frontend feature work inside `index.html`

That is the cleanest path to unlock safe parallelism without dropping
migration discipline.
