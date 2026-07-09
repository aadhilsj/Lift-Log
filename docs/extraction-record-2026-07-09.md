# Frontend Extraction — Running Record

Branch: `extraction/vite-build` (worktree, off `codex/create-group-canonical-first` @ `b91b14c`)
Owner: Claude (frontend extraction end-to-end). Codex stays backend/migration-only.
Plan of record: `docs/frontend-extraction-plan-2026-07-09.md`

Rules in force: behavior-identical, no feature/redesign/chat work, no backend
contract changes, fonts stay CDN-backed, PWA behavior is load-bearing.

## Phase 1 — Build shell / bootstrap (2026-07-09)

### What changed

- `package.json` — new. React/ReactDOM pinned to `18.3.1` (exact version the
  UMD CDN tags resolved to), `@supabase/supabase-js@^2`, Vite 5 +
  `@vitejs/plugin-react`.
- `vite.config.js` — new. Dev-server proxy `/api` → `127.0.0.1:3000`
  (the existing `scripts/local-dev-server.mjs`).
- `vercel.json` — new. Explicit `framework: vite`, `buildCommand`,
  `outputDirectory: dist` so the Vercel project (previously configured as
  no-build static) builds deterministically regardless of dashboard settings.
- `index.html` — reduced to the Vite entry: original head metadata + manifest
  + Google Fonts links preserved verbatim; the four CDN `<script>` tags
  (React, ReactDOM, supabase-js, **Babel standalone**) removed; body is
  `#root` + module script.
- `src/styles/app.css` — the original `<style>` block, verbatim (lines 22–153
  of the old index.html).
- `src/app.jsx` — the original `<script type="text/babel">` body, **verbatim**
  (lines 159–7764). Not modularized yet — that is Phases 2–3.
- `src/globals.js` — compatibility shim: installs `window.React`,
  `window.ReactDOM.createRoot`, `window.supabase.createClient` from npm
  packages, because the verbatim app reads globals. Shrinks away in later
  phases.
- `src/main.jsx` — entry: globals → css → app (import order is load-bearing).
- `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `sw.js` →
  `public/` (Vite copies to dist root; same served URLs as before).
- `.gitignore` — `node_modules/`, `dist/`.

### Decisions / tradeoffs

1. **Verbatim-first**: Phase 1 moves code without editing it. The only
   mechanical delta is how React/supabase are provided (npm + global shim
   instead of CDN UMD). This keeps the Phase 1 diff reviewable and makes any
   behavior change a bug by definition.
2. **React stays global until Phase 2/3** — `const {useState,...} = React` at
   the top of app.jsx resolves via `window.React`. Real imports arrive when
   the file is split.
3. **sw.js untouched in Phase 1** (except relocation). It still pre-caches the
   now-unused CDN URLs (harmless waste) and `./index.html`. The SW is
   network-first for navigations, so clients pick up the new shell on next
   online open. Full rework is Phase 4.
4. **supabase-js pinned to ^2 via npm** — the CDN tag was unpinned `@2`, so
   npm gives the same major with a lockfile improving determinism.

### Verified locally

- `npm run build` passes: 622KB JS (165KB gz, React+supabase bundled),
  7.8KB CSS, no Babel anywhere.
- Vite dev server + local API server: app boots, PreviewLanding renders
  correctly (visual check), auth config fetch works through the proxy,
  email OTP modal renders and submits. Only console warning is the
  pre-existing double-GoTrueClient warning (also present in production;
  out of scope per behavior-identical rule — noted for post-extraction).

### Known observations for later phases (not fixed now)

- Two `window.supabase?.createClient` call sites create two GoTrueClient
  instances (pre-existing warning). Candidate cleanup in Phase 2 data-layer
  extraction — only if provably behavior-safe.
- `icon.svg` / `icon.svg.png` at repo root are unreferenced by the app;
  left in place.
- Local dev now requires two processes: `npm run dev:api` + `npm run dev`.
  `docs/local-dev.md` update pending (tracked with the QA-script task).

### Pending verification

- Vercel preview deployment build + smoke test (next step).

## Phase 2 — Root app + data layer extraction (2026-07-09)

### What changed

- `src/lib/appState.js` (~1,700 lines) — constants, mutable app context
  (`NAMES`, `curKey`, `ACTIVE_*`, …), time/league math, normalization,
  settlement/stat helpers, `syncActiveGroupGlobals`. Verbatim relocation of
  original lines 1–1677 plus two functions (`getCurrentGroupMemberNames`,
  `flattenFeedPosts`) moved up from the utils section because state helpers
  call them.
- `src/lib/api.js` — auth client bootstrap, session handling, `postApi`,
  every `*Data` mutation wrapper, local cache read/write (original 1678–2131).
- `src/lib/utils.js` — formatting, timezone, image compression/upload,
  platform detection (original 2132–2544).
- `src/app.jsx` — now components only (~5,100 lines) + App + createRoot,
  importing from the three lib modules.

### Mechanical deltas (the only non-relocation edits)

1. `setActiveSessionUserId()` added — ES modules forbid writing imported
   bindings; App's render-time write becomes a setter call.
2. `setSupabaseAuthClientPromise()` added — same reason (sign-out path reset).
3. React hooks destructure (`const { useState… } = React`) moved from the old
   utils region into app.jsx where the hooks are actually used.

Everything else is verbatim relocation + generated export/import lists
(unused exports retained deliberately — they document the module surface and
cost nothing).

### Verified

- `npm run build` green.
- Dev-server runtime: landing page renders, demo leaderboard correct,
  Join-a-Bloc → email auth modal opens; zero console errors.
- Live-binding reads (components reading `NAMES`/`curKey` mid-render after
  `syncActiveGroupGlobals`) work as before — writes happen inside the
  declaring module, reads cross module boundaries as live bindings.

## Phase 3 — Surface extraction (2026-07-09)

### Structure

- `src/components/primitives.jsx` — 22 shared primitives/icons/fields
- `src/components/authShell.jsx` — landing, auth flow, identity, group home
- `src/modals/modals.jsx` — all 14 modals + settings fields/defaults
- `src/pages/` — one file per page: Nav, ActivityFeed, PlayerProfile,
  TodayPage, ActivityPage, SettlementScreen, MonthPage, HistoryPage
- `src/App.jsx` — the App root only
- `src/main.jsx` — now owns `createRoot` (moved out of the verbatim tail so
  future HMR edits to App don't re-run root creation)

All 56 component/helper blocks relocated verbatim; imports/exports generated
by usage scan. Every file gets `import React` + hooks destructure header, so
components no longer rely on the window.React global (globals.js retained for
window.supabase, used by the api layer).

### Gotcha hit and fixed

- macOS case-insensitive filesystem: writing `App.jsx` while `app.jsx`
  existed silently overwrote it. Splitter now deletes the source first.

### Verified

- Build green. Fresh browser context: boot, landing render, interaction —
  zero console errors. (Mid-refactor HMR produced transient
  createRoot/Spinner errors in the accumulated log buffer; error count frozen
  across clean reloads confirms none occur in steady state.)

## Phase 4 — Service worker / PWA cleanup (2026-07-09)

Decision: **manual sw.js update, no workbox/vite-plugin-pwa dependency.**
The existing SW already runtime-caches same-origin GETs (cache-first with
background refresh), which is the correct policy for Vite's content-hashed
immutable /assets/ files — so a precache manifest adds machinery without
adding safety. Revisit the plugin only if offline-first requirements grow.

Changes:
- CACHE_NAME bumped ante-v50 → ante-v51 (activate handler deletes old caches,
  so existing devices drop the Babel/CDN-era cache on first online open)
- CDN React/ReactDOM/supabase/Babel removed from APP_SHELL precache
- Google Fonts stays precached (fonts remain CDN-backed by rule)
- navigations stay network-first: new deploys picked up on next online open;
  no stale-shell stranding

## Dev tooling (task alongside Phase 4)

- `scripts/local-dev-server.mjs` now serves `dist/` when present (repo-root
  index.html is the unbuildable Vite entry post-extraction); `/api` handling
  unchanged. `scripts/mobile-qa.mjs` (targets port 3000) works again via
  build + dev:api.
- `docs/local-dev.md` gained the two supported local flows.

## Extraction status: ALL PHASES CODE-COMPLETE

Remaining: preview-deploy smoke test of the final state (user), then merge
coordination with the backend branch.

## Phase 3 follow-up fix — class components missed by splitter (2026-07-09)

Symptom: signed-in, entering a Bloc → blank screen. Build was green and the
landing/auth path worked, so it passed the earlier gate; the crash was
render-time only.

Root cause: the Phase 3 splitter's declaration regex matched
`function|const|let` but NOT `class`. The two error-boundary classes
(`PlayerProfileErrorBoundary`, `TodayPageErrorBoundary`) were therefore never
registered as blocks — they rode along in `primitives.jsx` (glued to a
neighboring const) but were absent from its export list and from every
consumer's import list. Rollup treats an un-imported identifier as an implicit
global, so the bundle built cleanly and threw `ReferenceError` only when the
component actually mounted (i.e. on entering a group).

Fix: export both classes from `primitives.jsx`; import
`PlayerProfileErrorBoundary` into TodayPage/MonthPage/HistoryPage and
`TodayPageErrorBoundary` into App.jsx.

Completeness check: a full-tree scan (JSX `<Capitalized>` + `createElement`
targets vs. declared/imported/global names) now reports 0 unresolved
references. Only these two `class` declarations existed in the tree.

Verified in-browser (built bundle, local preview-auth + seeded cache):
Today, Results, and History all render with zero console errors — the exact
path that was blank now paints fully.

Lesson: green build ≠ working app for ES-module splits — implicit-global
fallback hides missing imports until render. Gate must include a signed-in
render of a page surface, not just landing.
