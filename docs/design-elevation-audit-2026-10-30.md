# Fero design — what makes it look generated, and what to do about it

**30 October 2026.** Read this before changing anything visual in Fero.

This is the first half of the design scheme Fero does not yet have. It records
a decision the founder made on 30 October: **Fero is not getting a redesign.
It is getting an elevation.** Everything below is the evidence for that, and
the order the work happens in.

---

## 1. The decision, in one paragraph

The founder likes how Fero looks and says so plainly. What bothers him is that
parts of it read as "AI generic". That instinct is right, and the cause is not
the colour. It is a set of specific habits that AI-assisted UI work falls into,
all of which Fero has, and none of which a new palette would fix.

A ten-option palette study exists (Google Slides, "Fero palette study — 32
screen comparison", linked from Codex's two palette handovers on
`codex/fero-screen-palette-preview-2026-10-29`). The founder looked at all ten
and did not prefer any of them to what is live. That is the correct reaction:
every one of the ten changes the hue and keeps all five tells below.

**So: keep the palette for now. Fix the tells first. Revisit colour last, by
which point the cyan may only need tuning rather than replacing.**

---

## 2. The evidence

Counted in `src/` on 30 October 2026, at `7dddab5`. Every count is
reproducible — the commands are here so nobody re-derives them or argues from
memory.

| Tell | Count | Command |
| --- | --- | --- |
| Gradients | 112 | `grep -ro "gradient(" src --include='*.jsx' --include='*.js' --include='*.css' \| wc -l` |
| Full pill radius (999) | 119 | `grep -roE "border-?[Rr]adius[\"']?: ?[\"']?999" src \| wc -l` |
| Letter-spaced labels | 131 | `grep -ro "letterSpacing" src --include='*.jsx' \| wc -l` |
| Uppercase labels | 93 | `grep -ro "textTransform" src --include='*.jsx' \| wc -l` |
| Blurs | 28 | `grep -ro "blur(" src --include='*.jsx' --include='*.js' --include='*.css' \| wc -l` |
| Glows / shadows | 23 | `grep -ro "box-shadow" src --include='*.jsx' --include='*.js' --include='*.css' \| wc -l` |

Typefaces, from `index.html:16`: **Outfit** (400–900), **Raleway** (800),
**JetBrains Mono** (400/500/700).

---

## 3. The five tells, worst first

**1. The typeface.** Outfit carries nearly all of Fero's text. It is a good
geometric sans and it is also one of the most-used fonts in AI-generated
interfaces, for the same reasons it was picked here: free, safe, modern. It is
the loudest "this was generated" signal in the app — louder than the colours —
and it is the cheapest thing in the codebase to change, being two lines in
`index.html` plus the family name.

**2. Gradients, 112 of them.** The page background gradient, the radial cyan
hint at the top, and gradient fills throughout. Flat surfaces are what
distinguishes a designed product from a generated one. The founder raised this
himself before any analysis.

**3. Pills, 119 of them.** Status pills, the nav bar, the Month/All Time
toggle, buttons, chips, the invite row. When every element is fully rounded,
nothing reads as more important than anything else, and the eye has no
hierarchy to follow. Fero should have two or three deliberate radii, not one.

**4. Spaced-out capitals, 131 + 93 of them.** `SETTLEMENT REMINDERS`,
`WORKOUT TYPES`, `OF 60`, `4 DAYS LEFT`, `THIS BLOC`. Tracked small caps are a
dashboard tic: convincing on two screens, filler on twenty.

**5. Glow and blur, 51 between them.** The cyan bloom under the `+` button,
the halo on the active tab, blurred overlays. These are the decorative effects
that read as "theme" rather than as design.

---

## 4. One structural problem underneath all of it

Colour is not centralised. Tokens exist in `src/styles/app.css` (lines 3–52)
but most screens bypass them: **905 hardcoded hex values across 35 files**,
plus **267 inline `rgba(78,205,196, …)`** cyan values. Worst offenders:
`TodayPage.jsx` (119), `SettlementScreen.jsx` (76), `BlocSettingsScreen.jsx`
(64).

One trap worth naming: `app.css:51` sets `--green: var(--cyan)`. The brand
accent and the "on track" colour are literally the same value, so any accent
change silently changes the meaning of every success state.

Until colour routes through tokens, any palette change is a thousand hand-edits
with screens left behind. **The routing work has to happen before the colour
decision, whatever the colour decision turns out to be.**

---

## 5. The order the work happens in

Biggest signal first. One step per commit, each reversible, each judged on its
own before moving on.

1. **Surfaces** — gradients and glows out, flat surfaces in.
2. **Shape** — stop defaulting to pills; settle two or three radii.
3. **Type** — one distinctive typeface replacing Outfit.
4. **Labels** — fewer tracked capitals, more sentence case.
5. **Tokens** — route all colour through `app.css`.
6. **Colour** — only now, and possibly only as a tune of the current cyan.

---

## 6. How a step gets approved

The founder is not a designer and should not be asked to judge a whole look —
that is what failed with the palette study. Each step is judged as **one
change, on one screen, before and after, at phone size (375×812)**, on his own
phone. He says which side is better. That is the entire skill required of him,
and if a side-by-side does not show a clear improvement, the step is not worth
shipping.

Nothing in this process asks him to trust an agent's taste. It asks him to
trust his own eyes on a two-up comparison.

---

## 7. What is deliberately NOT decided here

- Which typeface. That is step 3 and needs its own side-by-side.
- The final palette. Deferred to step 6.
- Whether the share stickers change. Their design is locked
  (`docs/share-sticker-reference/`); if the app's look moves, the stickers are
  a separate, explicit decision.
- Any layout, card size, padding or photo placement. Those are hard locks and
  this work does not touch them.

---

## 8. What is still missing

The second half of the scheme — the rules file that says *these* are the
surfaces, *these* are the three state colours, *this* is the type scale,
*these* are the radii, and nothing else is allowed. It is the output of the
steps above, not an input, and it is also what stops the app drifting again the
next time an agent touches it.

---

## Related

- `codex/fero-screen-palette-preview-2026-10-29` —
  `handover-2026-10-29-fero-inside-bloc-palette.md` and
  `handover-2026-10-29-fero-matte-blue-refinement.md`, Codex's palette preview
  work. Not merged as of 30 October.
- `handover-2026-10-30-design-elevation.md` — the session this came from.
