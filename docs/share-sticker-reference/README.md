# Share sticker reference

**`png/` is ground truth.** Any change to `src/lib/shareSticker.js` is checked
against these twelve renders (3 styles × 4 fixtures).

## History

- **1 August 2026** — design locked. `sticker-core.js` and `sticker-style.css`
  are the HTML/CSS mock-up that produced the original twelve PNGs.
- **1 October 2026** — redesigned by the founder. The twelve PNGs were
  re-rendered from `src/lib/shareSticker.js` and replaced. Three changes:
  1. **Grid and Bare icons** have a solid navy (`#1A2E4A`) outline that sits
     mostly outside the silhouette and slightly into it, replacing the faint
     half-transparent edge, so icons stay visible on light and busy photos.
     The founder's own design is in `founder-design-2026-10-01/` — the app
     draws with anti-aliasing, so its edges are softer than those hand-edited
     files, with the same amount of navy (within 5%).
  2. **"ACTIVITIES" → "SESSIONS"** in the header, on all three styles.
  3. **The month name is one size larger** (17 → 18 authoring px), on all
     three styles. The header re-centres itself; nothing below it moves.

  Solid's icons are unchanged. `sticker-core.js` and `sticker-style.css` were
  **not** updated and no longer match the PNGs on these three points.
