# Fero — working agreement

Fero is a group fitness accountability app. Members join a **Bloc**, commit to a
monthly workout target, and pay into a pot when they miss it. React + Vite
frontend, Supabase (Postgres) backend, deployed on Vercel.

Read this file before doing anything else. It exists because the same
corrections kept getting repeated across sessions.

---

## Communication Style

- Plain language first, jargon second.
- Never use internal shorthand — **promote**, **cutover**, **overlay**,
  **canonical**, **blob** — without a one-line definition the first time it
  appears in a session.
- Lead every audit, status report, or diagnosis with a 2–3 sentence
  plain-English summary before any technical detail.
- If the user says "wdym?" or asks for simpler terms, that is a signal the
  default register is too technical — drop it for the rest of the session.

Quick glossary:

- **blob** — the single big JSON document in `public.lift_log_state.state`
  that used to hold all app state.
- **canonical** — the real, properly-structured tables in the `ante_core`
  schema that are replacing the blob.
- **cutover** — switching one feature from reading the blob to reading
  canonical tables.
- **Bloc** — a group of members competing in one monthly season.
- **season** — one month of one Bloc.
- **MAS** — the monthly workout target a member must hit.

---

## Data Safety Rules

These are non-negotiable. Each one is here because it shipped as a bug.

**Blob wins on doubt.** When merging canonical rows with legacy blob state,
canonical must NEVER unconditionally win. Only overlay a canonical row when:

1. the canonical result is non-empty, AND
2. the corresponding period/entity already exists in the blob.

Canonical must never invent months that the blob does not have, and never
replace valid blob data with partial canonical data.

**Empty is not an error.** An empty canonical result set means "no data". It
does NOT mean the RPC failed, and it is never a reason to blank existing data.
Distinguish a thrown error from a zero-row result explicitly.

**Back up before promoting.** Never promote code or data from local to live
without taking a fresh backup of live data first. See `docs/local-dev.md`.

**Mutation responses must be re-scoped.** Do not return raw persisted blob
state to a client after a write — stale/left Blocs leak back in. Persist
through the mirror path, then re-read the canonical readable projection and
scope it with `scopeReadableStateForUser(...)`. The helper is
`persistAndScopeReadableStateForUser(...)` in `api/lift-log.js`.

---

## Bug Fixes

Before declaring anything fixed:

1. **Inventory first.** Grep for every call site that computes or displays the
   same value (pace, target, membership count, settlement amount). State
   explicitly which paths you checked and which you patched.
2. Values in this app are frequently computed in more than one place — a
   prorated-pace fix once patched one path and the leaderboard still showed the
   wrong number.
3. Verify in the browser preview before reporting done. Do not report a fix as
   verified unless you actually saw it.
4. Check `docs/recurring-debugging-playbook.md` first — swipe navigation,
   fixed-layer flicker, reaction lag, stale Blocs, and left-member bugs have all
   recurred and already have documented fix rules.

---

## Scope Discipline

- Default to the smallest safe change.
- Never propose a full rename, schema-wide migration, or broad refactor as a bug
  fix. Offer the tactical fix first; list the broader migration as an optional
  follow-up the user can decline.
- Plan and implement are separate turns. When the user asks for a plan, produce
  the plan and stop — do not start editing.
- Work in narrow, individually-approvable slices.

---

## Refactors

After any file split or symbol extraction, run the app in preview and load the
affected route before claiming completion. Verify every moved symbol has a
matching import — an un-imported identifier once shipped a blank screen.

---

## Database / Supabase

**Read `docs/SCHEMA.md` before writing any SQL.** It documents the `ante_core`
tables and the exact key paths inside the JSONB blob. Do not guess JSONB paths.

- Cast IDs explicitly in `WHERE` clauses (`::uuid`, `::text`). `workout_logs.id`
  is `text`, not `uuid`.
- Local Postgres: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Local Studio: `http://127.0.0.1:54323`

---

## Running the app

Dev with hot reload (two processes):

```bash
npm run dev:api   # API + env on port 3000
npm run dev       # Vite on 5173, proxies /api to 3000
```

Prod-like: `npm run build`, then `npm run dev:api`, open `http://localhost:3000`.

A fresh git worktree does not carry `.env.local` — copy it in first.

Test scripts live in `package.json` (`test:identity`, `test:two-workouts`,
`test:auth-edge-flows`, `test:founder-dashboard`, and others).

## Linting

`npm run lint` runs ESLint over `src`, `api`, and `scripts`. It is configured
for **correctness only**, not style — the main rule is `no-undef`, which catches
un-imported identifiers before they reach the browser.

A `PostToolUse` hook in `.claude/settings.json` runs ESLint automatically on
every `.js` / `.jsx` / `.mjs` file after it is edited. If it reports something,
fix it before moving on. The baseline is clean — any output is a new problem.

---

## Product rules that look like bugs

- **Two workouts per day is a deliberate cap**, enforced atomically in the
  database. It rewards consistency over intensity. Do not "fix" it.
- **Share stickers have a locked design.** The PNGs in
  `docs/share-sticker-reference/` are ground truth. Match them; do not redesign.

---

## Handover docs

`docs/` holds 60+ dated handover, audit, and plan documents. Before starting
work on an area, check for the most recent handover on that topic rather than
re-deriving state from scratch.
