# Bloc Stream — Handover (2026-07-11)

Frontend feature build, running in parallel with Codex's backend/migration work.

## Where this runs

- **Worktree:** `/Users/opera_user/Documents/Codex Space/Lift Log Extraction`
  (separate git worktree so Codex's main checkout is untouched)
- **Branch:** `feature/chat`, cut from `codex/create-group-canonical-first`
- **HEAD at handover:** `f025032`
- Working tree clean, all commits pushed to `origin/feature/chat`.

## What Bloc Stream is

A Bloc-scoped messaging layer opened from a header icon (left of the gear) as a
slide-up modal over the current tab. Spec source of truth:
`/Users/opera_user/Downloads/codex_metaprompt_bloc_stream.md`. Build the stages
in order, screenshot/confirm each before the next, add nothing beyond spec.

## Build approach (important)

**Frontend-first against an id-keyed in-memory mock; real backend is a separate
coordinated batch.** Decided with the user. So:
- All UI stages are built and testable now with zero database and zero live-app
  risk.
- The mock is `src/lib/blocStream.js` — it is the seam the real backend swaps
  into later. Keep the contract **id-keyed** (`bloc_id`, `author_id` = auth
  user id, message id, reactions = `{emoji: [userId]}`). Do NOT introduce
  display-name-keyed identity (display names are resolved at render time from
  membership only).

## Coordination rules (do not break)

- Stay in `src/` (frontend). Do NOT touch `api/lift-log.js`, SQL/migration
  files, or write-cutover logic — that's Codex's lane.
- New chat backend (tables `bloc_messages` / `bloc_message_reactions`, RLS,
  Realtime, and the system-moment triggers) is the coordinated batch — do not
  create tables solo; it touches the shared DB and ties to the still-open
  "refresh the stale dev Supabase project" decision.

## Files

- `src/pages/BlocStream.jsx` — the modal: header, message list, text bubbles,
  system-moment cards, reaction chips, input bar + `+` action sheet.
- `src/lib/blocStream.js` — temporary in-memory data layer: `listMessages`,
  `sendMessage`, `toggleReaction`. Sample seed messages/system moments are
  opt-in only via `localStorage.ll_bloc_stream_sample_seeds = "1"` so production
  previews and live builds do not show fake content inside real Blocs.
- `src/lib/api.js` / `api/lift-log.js` — API-backed Stream actions:
  `stream-list`, `stream-send`, `stream-create-event`, `stream-rsvp`,
  `stream-reaction`, `stream-mark-read`, and `stream-unread-count`.
- `supabase/ante-core-bloc-stream-schema.sql` — canonical private Stream tables.
- `supabase/ante-core-bloc-stream-rpcs.sql` — service-role-only Stream RPCs.
- `src/pages/Nav.jsx` — `StreamIconButton` added left of the gear (desktop +
  mobile headers), unread-dot prop-driven.
- `src/components/primitives.jsx` — added `message-circle` icon to `AppIcon`.
- `src/App.jsx` — `showStream` state + `<BlocStream>` render; passes
  `blocId / currentUserId / members` (id-keyed).
- `docs/bloc-stream-system-moments-rulebook-2026-07-19.md` — source of truth
  for real backend-generated system moment triggers, idempotency keys, payloads,
  and non-goals.

## Stages: done vs remaining

- **Stage 1 (done):** header icon + slide-up modal shell.
- **Stage 2 (data model) — DEFERRED:** this is the backend batch (tables +
  Realtime). Not done on this branch by design. Note the metaprompt's schema
  references `users(id)`/`seasons(id)`; the real canonical schema has no `users`
  table (it's `ante_core.profiles` + auth users, `ante_core.seasons`,
  `ante_core.blocs`) — reconcile before any tables are created.
- **Stage 3 (done):** text bubbles (own right / received left, avatars, labels).
- **Stage 4 (done):** input bar, Send, `+` action sheet. "Send a message"
  focuses the input; **"Suggest an event" is a placeholder no-op** until Stage 6.
- **Stage 5 (done):** system moment cards (distinct centered cards, amber=warning
  / cyan=positive tone, eyebrow label, sub-text) + reaction chips (toggle +
  quick-react picker). The UI supports all six trigger types (cooked, 7-day
  inactivity, MAS-early, comeback, season-close settlement, new member), but
  fake seeded examples must remain disabled unless explicitly testing locally.
- **System moment backend rules (defined):** see
  `docs/bloc-stream-system-moments-rulebook-2026-07-19.md`. Real moments must
  be canonical-write-generated, idempotent, and stored as actual stream rows.
- **Backend persistence (started):** production Supabase project `Lift Log`
  (`bpvvvqjsfwmmfjvvijkd`) has migration `add_bloc_stream_backend` applied.
  It created `ante_core.bloc_messages`, `ante_core.bloc_message_reactions`,
  `ante_core.bloc_message_reads`, plus seven service-role-only RPCs. Verified
  on 2026-07-19: all tables exist, all seven RPCs exist, and the read RPC
  returns a JSON array for an active member.
- **Unread badge (done):** production Supabase migration
  `add_bloc_stream_unread_count` added
  `public.read_ante_core_bloc_stream_unread_count(text, text)`. Verified on
  2026-07-19: function exists and returns an integer for an active member. The
  nav badge now reads from this backend count and clears after opening Stream.
- **Direct system moments (partially wired):** real, idempotent moments now
  emit for member joined, member left, member removed, target hit, settings
  changed, sit-out requested, sit-out approved, settlement paid, and settlement
  confirmed.
- **Derived workout-log moments (started):** workout logging now evaluates
  canonical before/after member pace. It deletes stale `cooked` moments when
  active-month backfilled logs make a member no longer cooked, and emits
  `comeback` only for `behind -> on-track`. It does not emit comeback for
  `at-risk -> on-track` or `cooked -> on-track`.
- **Stage 6 event cards (done/backend-backed):** "Suggest an event" creates a
  persisted `message_type='event'` row with activity/date/location and RSVP
  state. Do NOT build message type 4 (workout-log comments) until its schema and
  product contract are defined.

## Design decisions locked with the user (keep these)

- Palette was brightened off the too-dim spec hexes, then dialed back down two
  notches. Current values live in the `C` constant at the top of
  `BlocStream.jsx`. User approved current level.
- Panel background: dark vertical gradient + a cyan radial glow, with the glow
  dropped BELOW the header so the header reads as its own bar.
- Header + input are translucent blurred bars (bracket the gradient); header has
  a faint cyan divider.
- Eyebrow labels ("BLOC STREAM", system-card labels) use **Outfit 700 uppercase
  letter-spaced** (matches app stat labels like "WEEK'S MVP"), NOT JetBrains
  Mono. Sender names use Outfit too. (The app's `.mono` class is only right for
  a subset of labels — do not use it for names/these eyebrows.)
- Scroll lock: body is pinned `position:fixed` while open (iOS-proof), scroll
  restored on close.
- Auto-scroll-to-bottom fires ONLY on open + on own send. It must NOT be keyed
  on `members`/`currentUserId` in effects (fresh identity each render → the 3s
  poll was yanking the user back down). See the open-effect comment.
- Send keeps the keyboard open (Send button `onMouseDown preventDefault` +
  refocus input).

## How to test locally (the seeding trick)

Bloc Stream lives inside a group, which requires auth. Locally the app can't
reach real data, so:
1. `cd` into the worktree; ensure `.env.local` exists (copy from the main repo
   if a fresh worktree — it's gitignored and doesn't travel).
2. Set `ENABLE_LOCAL_PREVIEW_AUTH=true` in `.env.local` (default is `false`;
   flip it for local testing, restore after).
3. `npm run build`, then serve the built app + API via
   `node scripts/local-dev-server.mjs` (serves `dist/` + proxies `/api`).
4. In the browser, seed `localStorage` with a cached state + a preview session,
   then reload. Key detail: the app's preview user id is
   `local-preview:<slug>` (e.g. `local-preview:aadhil`) — the seeded
   membership `userId` must match that or own/received attribution breaks.
   Preview stores `ll_preview_auth` as `{previewDisplayName}` only.

## How the user tests (preferred)

Push `feature/chat` → Vercel builds a preview. The stable branch alias is:
`lift-log-git-feature-chat-aadhilshahjahan11-1221s-projects.vercel.app`
It runs on the user's **real account/groups** (production data) but is an
isolated deployment that does NOT affect the live app. Chat is mock-backed so it
behaves fully. After each stage: push, wait for the deploy to go Ready
(`vercel ls lift-log`), hand the user that URL.

## Environment notes

- Git author identity is now set globally to `aadhilsj <aadhil101@gmail.com>`
  (was unset → commits showed `opera_user@MacBookPro.home`, which Vercel
  couldn't match → "GitHub user not found"). New commits attribute correctly;
  old ones keep the machine author (cosmetic, left as-is).
- Every commit ends with the `Co-Authored-By: Claude` trailer.
- Preview deployments are SSO-protected but open for the repo owner in a browser
  already logged into Vercel.
- The extraction that this branch sits on top of (monolith → Vite build) is
  documented in `docs/extraction-record-2026-07-09.md`.

## Immediate next action

Build **Stage 6 (event cards + RSVP)** against the mock, then push and give the
user the preview URL. After Stage 6, the whole Bloc Stream UI is spec-complete
on the frontend and the next milestone is the coordinated backend batch with
Codex.
