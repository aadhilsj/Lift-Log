# Handover — 30 October 2026 — design: elevation, not redesign

**Status: open.** Docs only. Nothing in the app changed.

---

## What this session was

The founder asked how to go about changing Fero's colour palette — how to
research it, how to decide, and whether a redesign was needed at all. It ended
somewhere more useful than it started: **no redesign. An elevation of what is
already there, in a fixed order, judged one change at a time.**

The reasoning, the evidence and the order are in
[`design-elevation-audit-2026-10-30.md`](design-elevation-audit-2026-10-30.md).
That file is the reference; this one is the record of the session.

---

## What happened, in order

1. **Read the current palette** out of `src/styles/app.css` — near-black with a
   green tint, one cyan accent `#4ecdc4`, warm colours rationed for warnings.
   Found that colour is not centralised: 905 hardcoded hex values across 35
   files, plus 267 inline cyan `rgba()`.

2. **Ran the app in the sandbox** (`npm run build`, `npm run sandbox`, already
   seeded) and captured the real screens at 375×812 as Tariq, the admin of the
   seeded Sunday Warriors Bloc — Today, Activity, Month, Profile, the log
   sheet, Bloc Settings, onboarding and sign-in. The sandbox was stopped
   afterwards by PID on port 3000.

3. **Mocked up a proposed warm-ink palette** across Today, Month and Profile,
   as a design canvas:
   https://claude.ai/artifact/8FCjsjuY2guSTdqujQFCyG
   The founder set it aside — see "What was dropped".

4. **Read the palette study** the founder pointed to: Google Slides, "Fero
   palette study — 32 screen comparison", ten options A–J across four screens
   each. He preferred none of them to what is live.

5. **Counted what actually reads as generated** (table in the audit doc). The
   conclusion: the tells are gradients, pills, tracked capitals, glow, and the
   Outfit typeface — not the colour. That is why none of the ten palettes felt
   like an upgrade.

6. **Installed the Anthropic Design plugin** (`design-critique`,
   `design-system`) plus `frontend-design`, so the critique is structured
   rather than one agent's taste.

---

## Where it stopped, and why

Plugin skills only load when a session starts. Both plugins are enabled on the
account but **were installed mid-session, so `design-critique` is not reachable
in the session that wrote this.** That is the only reason this session ended
here. A fresh session picks the skills up.

---

## What the next session does

1. Read [`design-elevation-audit-2026-10-30.md`](design-elevation-audit-2026-10-30.md).
2. Run `design-critique` against the live screens. If it adds nothing beyond
   the counts already in the audit, **say so plainly and move on** — do not pad
   the process.
3. Do **step 1 only**: gradients and glows out of the Today screen. Nothing
   else touched. Show the founder before/after at 375×812 and wait.

Steps 2–6 are listed in the audit doc. They happen one at a time, each
approved before the next starts.

---

## What was dropped

- The warm-ink palette proposal (item 3 above). It was a reasonable direction
  and the founder did not want it. It is not part of the plan; the canvas is
  kept only as a record of what was considered.
- An Activity-screen mockup, written but never published, after the founder
  narrowed the request to three screens.

---

## Rules this work must keep

- **Layout is a hard lock.** Card size, padding and photo placement are not in
  scope and must not move. If a step would shrink a row, the height goes back.
- **The share stickers are locked** (`docs/share-sticker-reference/`). If the
  app's look moves, whether the stickers follow is a separate decision the
  founder makes.
- **One step at a time, one question at a time.** The founder has said he
  cannot direct this himself and does not want to take an agent's taste on
  trust. The method is designed around that: he only ever judges a two-up
  comparison of a single change.

---

## Careful: Codex is in the same area

`codex/fero-screen-palette-preview-2026-10-29` is an active branch with two
palette handovers on it, not merged as of 30 October:

- `handover-2026-10-29-fero-inside-bloc-palette.md`
- `handover-2026-10-29-fero-matte-blue-refinement.md`

It also edits `docs/HANDOVERS.md`, so expect a small conflict there when it
merges. Do not touch that branch or its worktree
(`/Users/aadhilsj/Developer/FERO/fero-screen-palette-preview-2026-10-29`).

---

## State at the start of this session

- `main` at `7dddab5`, shared folder level with `origin/main`, nothing ahead or
  behind.
- Live production deployment is `7dddab5` — everything merged is deployed.
- Untracked `.dmg` backups sit in the repo root, as before. Not touched.

---

## Commits

| Commit | What |
| --- | --- |
| _this one_ | The audit, this handover, and their two index lines. Docs only — no app code, no SQL, no data change. |

**Nothing else was modified.**
