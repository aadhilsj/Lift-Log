# Fero — working agreement for Codex

Fero is a group fitness accountability app. Members join a **Bloc**, commit to a
monthly workout target (**MAS**), and pay into a pot when they miss it.
React + Vite frontend, Supabase (Postgres) backend, Vercel hosting.

Read this file before doing anything else. Every rule here exists because the
same correction was repeated across many sessions.

Glossary — define these on first use, never assume them:

- **blob** — the single big JSON document in `public.lift_log_state.state` that
  used to hold all app state.
- **canonical** — the real, structured tables in the `ante_core` schema that are
  replacing the blob.
- **cutover** — switching one feature from reading the blob to reading canonical.
- **Bloc** — a group of members competing in one monthly season.
- **season** — one month of one Bloc.
- **MAS** — the monthly workout target a member must hit.

---

## 1. How this person works

They are the founder and product owner. They are **not** a developer — they say
so directly and often. They test everything themselves on a phone, and they
notice single pixels.

- **Plain English first, always.** Lead with a 2–3 sentence summary a
  non-technical person can act on. Technical detail comes after, only if needed.
- **No unexplained jargon.** "wdym?" and "explain this simply" appear dozens of
  times. If you must use a term like *promote*, *cutover*, *overlay*,
  *canonical*, *blob*, define it in one line the first time it appears.
- **One step at a time.** Do not hand over six numbered steps and ask for six
  screenshots. Give step one, wait for the reply, then give step two. Their exact
  words: *"if you give me all the steps and then ask me to do it one by one,
  that's kind of confusing."*
- **Everything copy-pasteable, in the chat.** Never say "the SQL is in the file"
  or point at a doc. Paste the exact SQL or command inline, ready to run, with
  every value already filled in. Do not leave placeholders for them to complete.
- **Never ask more than one question at a time.** *"You're asking me too many
  things"* and *"you're giving me too many options here"* are recurring
  complaints. Recommend one path. Do not present a menu.

---

## 2. Scope discipline — the biggest single source of friction

The most repeated complaint in the entire history is that a requested fix came
with unrequested changes attached, or fixed one thing and broke another.

Their words, verbatim:

> "We fix it, you mess it up. We fix it, you mess it up. How many times are we
> gonna go back and forth?"

> "Who told you to remove that bar? You're doing things that I never asked you
> to do."

> "Why did you all of a sudden revert the code when nobody asked you to do that?
> You just did it silently in the background."

Rules:

- **Change only what was asked. Nothing else.** Not adjacent cleanup, not a
  rename, not a "while I was in there" improvement.
- **Never silently revert or rewrite existing work.** If something must be
  undone to proceed, stop and say so first.
- **Never change a layout constraint they did not raise.** Card size, padding,
  and photo placement are frequently declared off-limits — *"the size of the card
  cannot change under any circumstance"*. Treat those as hard locks.
- **State what you did NOT touch.** End every change with the exact file list and
  a one-line "nothing else was modified."
- If the fix seems to require going wider, stop and ask. Do not widen on your
  own judgement.
- **Plan and implement are separate turns.** When they ask for a plan, produce
  the plan and stop. Do not start editing.
- Never propose a full rename or schema-wide migration as a bug fix. Offer the
  tactical fix first; list the broader migration as an optional follow-up they
  can decline.

---

## 3. Verify before handing it over

They have repeatedly been asked to test something that was never going to work.

> "Why don't you test the whole flow yourself before asking me to test it?
> Because we keep getting ahead one step, and then the next step is blocked."

- Run the flow end to end yourself before saying it is ready.
- **A blank screen has reached production more than once**, from an un-imported
  identifier or a syntax slip. Before any deploy: run `npm run lint` (correctness
  only — `no-undef` catches exactly this) and `npm run build`, and load the
  affected screen.
- They set an explicit bar: **only act autonomously if you are 90%+ confident**.
  Below that, stop and say you are not confident rather than guessing.
- *"Please stop guessing"* is a real instruction they have had to give. If you do
  not know, say so and ask for the specific evidence you need.

---

## 4. Deployment rules

- **Ask at the start of every implementation session:** should this change go to a preview branch first, or directly to `main`? Context matters; the founder's answer for that session controls the release workflow.
- **Preview first, then they promote.** Build on a branch, push a Vercel preview,
  let them test, and let them promote to production. Never push straight to
  production unless they explicitly say to.
- **They run all Supabase SQL themselves.** *"I would prefer to run things on
  Supabase myself, so don't do anything on Supabase yourself."* Hand them the
  exact SQL; do not execute it.
- **Back up before anything destructive.** They asked to be reminded of this and
  it is now a standing rule — take or confirm a fresh backup before any data
  change.
- Say clearly, every time, whether something is on preview or live. Confusion
  about which is which has cost many rounds.

---

## 5. Another agent shares this repo

Claude Code works in the same worktree, sometimes at the same time.

- **Never `git add -A` or `git commit -a`.** Stage by explicit path only.
- **Never switch branches** — the other agent may be mid-task.
- Files changing that you did not touch is normal. HEAD moving under you is
  normal. Do not "fix" it.
- Before committing, diff exactly what you intend to stage and confirm it
  contains only your work.

Historically the user has run these two as **Codex = planner/reviewer/safety
gate, Claude = operator**, pasting output between them. If they ask for that
mode, the job is to write strict bounded prompts for Claude and review what comes
back — not to do the editing yourself.

---

## 6. Database

**Read `docs/SCHEMA.md` before writing any SQL. Do not guess JSONB paths.**

- `workout_logs.id` is **text**, not uuid. Cast explicitly (`::text`, `::uuid`).
- Blob members are addressed **by display name**. `group.memberOrder` is a flat
  array of name strings. `group.memberships` is keyed by *membership id*, not
  user id — going from name to user id means scanning `Object.values()`.
- `state.profiles` is keyed by legacy user id, not email.
- `monthHistory` is an **array**, not keyed by month.
- Seasons store a frozen settings snapshot; never use current Bloc settings to
  compute a closed month.

**Blob wins on doubt.** When merging canonical `ante_core` rows with legacy blob
state, canonical must never unconditionally win. Only overlay when the canonical
result is non-empty AND the period already exists in the blob. Canonical must
never invent months or replace valid data with partial data.

**Empty is not an error.** Zero rows means "no data". It never means the RPC
failed, and is never a reason to blank existing data.

**Mutation responses must be re-scoped.** Never return raw persisted blob state
to a client after a write — stale and left Blocs leak back in. Persist through
the mirror path, then re-read the canonical readable projection and scope it with
`scopeReadableStateForUser(...)`. The helper is
`persistAndScopeReadableStateForUser(...)` in `api/lift-log.js`.

Local Postgres: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
Local Studio: `http://127.0.0.1:54323`

---

## 7. Bug fixes

- **Inventory first.** Values here are computed in more than one place — pace,
  prorated target, MAS, membership counts, settlement amounts. Grep every call
  site and say which ones you checked before editing.
- **Read `docs/recurring-debugging-playbook.md` first.** Swipe navigation,
  fixed-layer flicker, reaction lag, stale Blocs, and left-member bugs have all
  recurred and already have documented fix rules. Re-deriving them has wasted
  entire sessions.
- Reaction lag and swipe/scroll behaviour have each been "fixed" and re-broken
  several times, most painfully after branch merges. After any merge, re-verify
  both against the playbook before declaring done.

---

## 8. Product rules that look like bugs

- **Two workouts per day is a deliberate cap**, enforced atomically in the
  database. It rewards consistency over intensity. Do not "fix" it.
- **Share stickers have a locked design.** The PNGs in
  `docs/share-sticker-reference/` are ground truth. Match them; do not redesign.
- The app is **Fero**. A group is a **Bloc** (not "block"). In code it appears as
  `groups` in the legacy blob and `blocs` in `ante_core`.

---

## 9. Secrets

Do not ask them to paste tokens, keys, or PINs into the chat, and do not repeat
any that appear there. If a credential is needed, tell them where to set it as an
environment variable themselves. Several GitHub tokens and the admin PIN have
already been pasted into chat logs in the past — treat that as a thing to avoid
repeating, not a precedent.

---

## 10. Running the app

```bash
npm run dev:api   # API + env on port 3000
npm run dev       # Vite on 5173, proxies /api to 3000
npm run lint      # correctness-only ESLint — run before every deploy
```

Prod-like: `npm run build`, then `npm run dev:api`, open `http://localhost:3000`.
A fresh worktree does not carry `.env.local` — copy it in first.

Test scripts live in `package.json`: `test:identity`, `test:two-workouts`,
`test:auth-edge-flows`, `test:founder-dashboard`, `test:mobile-navigation`,
`test:profile-photo-storage`, and others.

**After any file split or symbol extraction**, load the affected route in the
browser before claiming completion, and verify every moved symbol has a matching
import. An un-imported identifier has shipped a blank screen more than once.

---

## 11. Handover docs

`docs/` holds 60+ dated handover, audit, and plan documents. Before starting work
on an area, read the most recent handover on that topic instead of re-deriving
state. When a session gets long, write the next handover — they rely on these to
carry context between chats.
