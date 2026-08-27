# Monthly share sticker — implementation plan

**Date:** 2026-08-01
**Status:** design locked, ready to build
**Audience:** implementer (Codex)

The design is finished and signed off. Six configurations are approved — three visual
styles × single-log and multi-log. This document specifies exactly what to build.

---

## 0. The locked set — read this first

The design went through many rounds. Several superseded variants still exist on the
author's machine, and some of those folders contain a *mixture* of approved and rejected
files for the same style. **Do not source anything from `~/Downloads`.**

Everything approved is committed here:

```
docs/share-sticker-reference/
  sticker-core.js      reference implementation — markup + geometry + icon paths
  sticker-style.css    reference implementation — all styling
  png/                 12 approved reference renders
```

The two source files are the working HTML/CSS implementation that **produced** the twelve
PNGs. They are the ground truth for every number in this document. Where prose here and
those files disagree, the files win. Your job is to port them to canvas (§2), not to
reinterpret them.

All twelve PNGs were re-exported from a single run of that code and verified
**byte-identical** (SHA-1) to the individually approved files. They are internally
consistent — there is no mixing.

### The twelve

| Style | Single log | Multi log |
|---|---|---|
| **Solid** | `fero-solid-single-22.png` · `fero-solid-single-8.png` | `fero-solid-multi-27.png` · `fero-solid-multi-10.png` |
| **Grid** | `fero-grid-single-22.png` · `fero-grid-single-8.png` | `fero-grid-multi-27.png` · `fero-grid-multi-10.png` |
| **Bare** | `fero-bare-single-22.png` · `fero-bare-single-8.png` | `fero-bare-multi-27.png` · `fero-bare-multi-10.png` |

Each style has a dense month and a quiet month, in both single- and multi-log form.
Single-log fixtures are 22 and 8 activities. Multi-log fixtures are 27 activities across
22 days and 10 across 8 days — the multi fixtures deliberately use the *same days* as the
single ones, so the only difference is the badges.

### Approved design, stated once

- Header is one centred line: `July 2026 : 22 ACTIVITIES`
- The word is **ACTIVITIES** — not "sessions", not "workouts"
- Count is **cyan**, 44px. The **colon is cyan**. Everything else is white
- **FERO is white** — the `O` is *not* cyan
- No verdict, no money, no target, anywhere
- Multi-log: **first-logged icon**, numeral badge **from 2 upward only**
- Badge is **cyan in Grid and Bare**, **navy in Solid**, and its offset differs per style

### Explicitly superseded — do not use

These were real intermediate states and will actively mislead if picked up:

- **The cyan theme.** An entire cyan-tiled style was designed and then abandoned. Deleted
  from the reference code. If you see cyan calendar tiles anywhere, it is stale.
- **Outcome labels** — `TOP OF THE BLOC`, `TARGET HIT`, `MISSED TARGET`, `+£45`, `−£30`.
  Removed from the design entirely.
- **`SESSIONS`** as the label word. Renamed to `ACTIVITIES`.
- **Two-line headers** — an earlier layout put the month and count on separate lines, and
  an earlier one still put the wordmark top-left with the month top-right. Both replaced by
  the single centred line.
- **Cyan badge in Solid.** Rejected — it washes out on the white tile. Solid uses navy.
- **Badge at `top −7, right −9` in Grid or Solid.** That is the **Bare** offset. In the
  other two it lands exactly on the cell border, which is why it was changed.
- **The bloc heatmap** (top-3 podium). Out of scope, see §9.

---

## 1. What the sticker is

A transparent PNG, 1080px wide, that the user copies to their clipboard and pastes onto
an Instagram story over their own photo. No card, no plate, no vignette, no drop shadows
anywhere. Every element sits flat on the photo.

Layout, top to bottom, all centred on one axis:

```
            July 2026  :  22 ACTIVITIES

         M    T    W    T    F    S    S
                  [ 7-column grid ]

                     FERO
```

- **Month** titles it. **Count** shares the same line, separated by a cyan colon.
- **Grid** is 5 rows × 7 columns, Monday-first, one cell per day.
- A logged day shows an icon for its activity type. A rest day shows an outline or
  nothing, depending on style.
- **FERO** signs off at the bottom, alone.
- No verdict, no money, no target. The sticker says "here is my month" and nothing else.

### The three styles

One axis: how much presence the calendar has. Maps to how busy the photo is.

| Style | Logged day | Rest day | Icon ink |
|---|---|---|---|
| `solid` | white gradient tile | outlined box | navy `#1A2E4A` |
| `grid` | outlined box only | outlined box | silver gradient |
| `bare` | nothing but the icon | nothing at all | silver gradient |

`grid` is the default. `solid` is for noisy photos, `bare` for clean skies.

---

## 2. Rendering approach — draw to canvas

**This is the most important decision in the document. Do not substitute an alternative
without reading this section.**

### Do not use html2canvas or dom-to-image

The design depends on `-webkit-text-stroke` and `paint-order: stroke fill` for the
hairline outlines on type and icons. **html2canvas supports neither.** Output would be
missing the outlines entirely, which is the difference between legible and illegible on
a bright photo.

### Do not rasterise an SVG via `<img>`

An SVG used as an image source is forbidden from loading external resources, **including
fonts**. Outfit and JetBrains Mono would silently fall back to a system font and every
metric in this spec would be wrong. The workaround — base64-embedding the woff2 files
into each render — adds 100–200KB per share and is avoidable.

### Do use the Canvas 2D API directly

- Canvas draws with fonts already loaded in the document, so no embedding.
- `ctx.strokeText()` followed by `ctx.fillText()` reproduces `paint-order: stroke fill`
  exactly — stroke underneath, fill on top, letterforms keep full weight.
- Icons become `Path2D` objects from the path data already in this document.
- Zero new dependencies. The project currently has only React and supabase-js; keep it
  that way.

### One renderer, used twice

The in-app **preview is the canvas element itself**, scaled down with CSS. The exported
PNG is that same canvas via `toBlob()`. Do not build a separate DOM preview — a second
implementation will drift from the first, and the whole point of the spec below is that
there is exactly one source of truth for the pixels.

---

## 3. Files to add

```
src/lib/shareSticker.js      pure renderer: (canvas, data, opts) => void
src/components/ShareSticker.jsx   modal: preview + style picker + copy/share
```

Both are new. `shareSticker.js` must have no React import and no DOM dependency beyond
the canvas it is handed, so it stays testable in isolation.

---

## 4. Renderer spec

All numbers below are **authoring units** at a 320px-wide sticker. Multiply everything by
`SCALE = 1080 / 320 = 3.375` when drawing. Do not round intermediate values; round only
the final canvas dimensions.

### Canvas setup

```js
const W = 320, SCALE = 1080 / 320;
canvas.width  = Math.ceil(W * SCALE);          // 1080
canvas.height = Math.ceil(layoutHeight * SCALE);
ctx.scale(SCALE, SCALE);                       // then draw in authoring units
```

Height is **computed from the layout**, not hardcoded. The current layout comes to 334.2
authoring units (1128px exported), but it must fall out of the measurements, because a
month that ends early trims a row in `bare` (see §4.6).

### 4.1 Fonts

```js
await document.fonts.ready;
await Promise.all([
  document.fonts.load('900 44px Outfit'),
  document.fonts.load('800 17px Outfit'),
  document.fonts.load('700 12px Outfit'),
  document.fonts.load('500 10px "JetBrains Mono"'),
]);
```

`document.fonts.ready` alone is not sufficient — it resolves when pending loads finish,
but a face never yet requested is not pending. Explicitly `load()` each weight/family
combination used, or the first render on a cold page silently draws in a fallback font
with different metrics.

### 4.2 Hairline outlines

Base for all copy: `0.28px` of `rgba(2,26,24,.42)`.

`-webkit-text-stroke` and `ctx.lineWidth` are both centred on the glyph outline, and in
both cases the fill covers the inner half. **The CSS value maps 1:1 to `ctx.lineWidth`** —
no doubling.

```js
ctx.lineWidth = 0.28;
ctx.strokeStyle = 'rgba(2,26,24,.42)';
ctx.strokeText(text, x, y);     // stroke first — this is paint-order:stroke fill
ctx.fillText(text, x, y);
```

Per-element overrides — the stroke does **not** scale with font size automatically, and
the count needs a proportionally larger one or it reads as unedged:

| Element | lineWidth | Colour |
|---|---|---|
| Count number | `0.75` | `rgba(2,26,24,.5)` |
| `ACTIVITIES` | `0.4` | `rgba(2,26,24,.5)` |
| Weekday letters | `0.34` | `rgba(2,26,24,.5)` |
| Month, year, FERO | `0.28` | `rgba(2,26,24,.42)` |
| Multi badge (grid/bare) | `0.4` | `rgba(2,26,24,.55)` |
| Multi badge (solid) | **none** | — |

### 4.3 Header line

Centred as a unit. Horizontal gap `10` between the three parts, `margin-bottom: 17`.

| Part | Font | Size | Weight | Colour | Notes |
|---|---|---|---|---|---|
| Month | Outfit | 17 | 800 | `#FFFFFF` | e.g. `July` |
| Year | JetBrains Mono | 10 | 500 | `#FFFFFF` @ .72 alpha | letter-spacing `.16em`, `4` left of month |
| Colon | Outfit | 17 | 600 | `#4ECDC4` @ .85 | literal `:` |
| Count | Outfit | 44 | 900 | `#4ECDC4` | letter-spacing `-.035em` |
| `ACTIVITIES` | Outfit | 12 | 700 | `#FFFFFF` @ .88 | letter-spacing `.15em`, uppercase, `8` right of count |

The count and its label are **vertically centred against each other**, not baseline
aligned. Compute the count's cap-height box and centre `ACTIVITIES` on its midpoint.

Canvas has no letter-spacing property in older Safari. Draw letterspaced strings
character by character, advancing by `measureText(ch).width + spacing`.

**Width check:** the longest realistic line is `September 2026 : 22 ACTIVITIES` at ~290
authoring units against a 320 sticker — 91%, fits with ~15 units clear each side. Do not
increase the count size above 44 or September will run to the edge.

### 4.4 Weekday row

7 columns, gap `7`, `margin-bottom: 7`. Letters `M T W T F S S`, centred per column.
JetBrains Mono, `8.5px`, weight 500, `#FFFFFF` @ .85, letter-spacing `.04em`.

These define the columns and in `bare` they are the *only* thing doing so. They must not
be the first element to disappear — hence the heavier `0.34` stroke.

### 4.5 The grid

- 7 columns, gap `7`, cell is square.
- Cell size = `(320 - 4 padding - 6 × 7 gap) / 7` = **39.14**
- Corner radius `10`. Use `ctx.roundRect` where available; **Safari below 16.4 lacks it**,
  so include a manual arc-based fallback.
- July 2026 starts on a Wednesday → Monday-first offset of 2 leading blank cells.
  Compute per month; do not hardcode.

Per style:

**`solid`** — logged cell:
```
fill:   linear-gradient 155°, rgba(255,255,255,.73) 0% → rgba(255,255,255,.49) 48%
                            → rgba(228,240,238,.26) 100%
border: 1px rgba(2,30,28,.24)
inner highlight: 1px line of rgba(255,255,255,.3) along the top edge
```
rest cell: `border 1.5px rgba(255,255,255,.5)`, `inset ring 1px rgba(0,0,0,.1)`, no fill.

**`grid`** — logged and rest cells are identical:
`border 1.5px rgba(255,255,255,.28)`, `inset ring 1px rgba(0,0,0,.05)`, no fill.
The box is deliberately faint: it should be *sensed*, not seen. On a busy photo it washes
out and the result reads like `bare`, which is intended behaviour.

**`bare`** — no box at all, in either state. Only icons are drawn.

> **CSS gradient angles do not map directly to canvas.** A CSS `155deg` linear gradient is
> measured clockwise from "to top" and its line is sized so the gradient covers the box
> corners. `createLinearGradient` takes raw endpoints. Convert properly — do not pass the
> box corners and hope. Getting this wrong makes the Solid tiles subtly flat.

### 4.6 Trailing-row trim — `bare` only

In `bare` an unused day draws nothing, so a trailing row with no logged days is pure
void, and the gap above FERO would change size month to month depending on which weekday
the month ended on.

```js
const lastRow = Math.max(...loggedDays.map(d => Math.floor((offset + d - 1) / 7)));
const slots = style === 'bare' ? (lastRow + 1) * 7 : offset + daysInMonth;
```

`solid` and `grid` keep every row — there the empty boxes *are* the calendar, and trimming
would make the month look like it ended early.

This is a no-op for most months. It matters for a month whose last activity falls before
the final week.

### 4.7 Icons

21px, centred in the cell. Path data, viewBox and stroke widths:

| Type | viewBox | Kind | Stroke width |
|---|---|---|---|
| Gym | `0 0 24 24` | stroke | 2.1 |
| Run | `-1 0 24 24` | fill | — |
| Sports | `0 0 24 24` | stroke | 1.7 |
| Pilates | `0 0 399.421 399.421` | fill | — |
| Other | `0 0 256 256` | fill | — |

Copy the exact `d` strings from `src/components/primitives.jsx` → `CategoryIcon`. They are
already in the codebase; do not retype them.

Scale each path from its viewBox to 21px and translate to the cell centre.

**Icon hairline edge.** Same idea as the type, and it is what makes the icons survive a
bright photo. Edge colour `rgba(2,26,24,.5)`, width `viewBoxExtent / 53` in viewBox units
so it reads identically across the wildly different viewBox scales.

- *Stroke icons* (Gym, Sports) cannot be outlined by an outer stroke — the drawing **is**
  a stroke. Draw the path **twice**: first at `baseWidth + 2 × edge` in the edge colour,
  then at `baseWidth` in the ink colour.
- *Fill icons* (Run, Pilates, Other) stroke at `2 × edge` then fill — canvas's natural
  stroke-then-fill order gives the paint-order behaviour for free.

**Silver gradient** (`grid` and `bare` only; `solid` uses flat navy `#1A2E4A`):

```
0%   #FFFFFF
34%  #FBFDFD
62%  #E2EAED
82%  #F8FBFC
100% #FFFFFF
```
Diagonal across the icon box: `(0,0) → (extent × 0.85, extent)`.

> **Historic bug, do not reintroduce.** In the SVG version this gradient had to be
> `gradientUnits="userSpaceOnUse"`. Under the default `objectBoundingBox` units the Gym
> icon vanished entirely, because it is drawn from vertical strokes whose bounding box
> width is exactly zero, and a bounding-box gradient collapses on a zero-area box. In
> canvas, `createLinearGradient` is already in user space, so this is handled — but do not
> "optimise" it into a per-path bounding-box calculation.

### 4.8 Multi-activity badge

A day holds an array of activities. **The icon drawn is the first logged.** The badge
appears **only from 2 upward** — never a `1`, or every cell picks up noise and the marker
stops meaning anything.

Font: Outfit, weight 800. Positioned relative to the **icon box**, not the cell — in
`bare` the cell is invisible, and a badge parked at the corner of nothing reads as
detached.

| Style | Size | Offset from icon's top-right | Colour |
|---|---|---|---|
| `bare` | 10 | `top −7, right −9` | `#4ECDC4` |
| `grid` | 8.5 | `top −4, right −4` | `#4ECDC4` |
| `solid` | 8.5 | `top −5, right −5` | `#1A2E4A` |

**Why solid differs.** It is the only style where the badge sits on a *known* background —
the white tile. Cyan on white is ~2:1 contrast and washes out; navy is ~12:1. Cyan is the
right choice for `grid` and `bare` precisely because there the backdrop is an unpredictable
photo. Solid's badge is also pushed one unit further out so two navy shapes never overlap
and merge, and it carries no hairline: the stroke exists to define light glyphs against
unknown backdrops, and here it only thickens an 8.5px numeral that already has all the
contrast it needs.

Verified clearances at true 320px authoring width: solid `4.1` from the cell border with
`−0.1` icon overlap; grid `5.1` and `0.9`.

### 4.9 Brand

`FERO` — Outfit, 20px, weight 900, letter-spacing `.09em`, `#FFFFFF`, `margin-top: 12`.
Centred. The `O` is **white**, not cyan — the single hit of brand colour lives on the
count, deliberately, so the sticker reads as being about the person rather than the app.

---

## 5. Data

**No backend work. No schema change. Everything needed is already client-side.**

### Getting the logs

| Case | Source |
|---|---|
| Current month | `logs[name]` |
| Closed month | `monthHistory[i].logsByUser[name]` |

Filter with `getCountedLogs()` from `src/lib/appState.js` — it drops logs whose
`flagStatus` is `rejected`, which is the same rule the rest of the app counts by. The
sticker's number must never disagree with the app's number.

### Shape

```js
{ date: "2026-07-14", type: "Gym", createdAt: "...", flagStatus: ... }
```

### Building the day map

```js
const byDay = {};                                  // dayOfMonth -> [types]
for (const log of getCountedLogs(rawLogs)) {
  const day = Number(log.date.split('-')[2]);
  (byDay[day] ||= []).push(log);
}
// first logged = earliest createdAt
for (const d in byDay) {
  byDay[d].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
const total = getCountedLogs(rawLogs).length;      // header count
```

**Multi-log already works with today's data.** The raw arrays contain one entry per
activity with its own date — it is only the app's *display* that collapses them
(`PlayerProfile.jsx:208` and `TodayPage.jsx:605` both assign `logsByDay[day] = log`, so a
second activity on a day overwrites the first). The sticker reads the raw array, so it
supports multi-activity days before the rest of the app does. Nothing to wait for.

### Month and year

`getMonthPartsFromKey(key)` → `{ year, monthIndex }`, and `MONTH_NAMES[monthIndex]` for
the label. Both already exported from `appState.js`. Derive the Monday-first offset and
days-in-month from those; do not hardcode July.

---

## 6. Copy and share

The target flow is Strava's: most people tap **Copy**, switch to Instagram, add their own
photo, and paste.

```js
// Copy — construct ClipboardItem synchronously inside the tap handler.
// Safari rejects it if you await the blob first; pass it the promise.
await navigator.clipboard.write([
  new ClipboardItem({ 'image/png': canvasToBlob(canvas) })
]);

// Share sheet
const file = new File([blob], 'fero-july-2026.png', { type: 'image/png' });
if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
```

Show both buttons, **Copy first** — it is the one people will use.

Later, not now: iOS supports `instagram-stories://share`, which opens Instagram with the
sticker already placed. That is the true Strava mechanic but it needs native code and a
registered Facebook App ID. Clipboard covers it with zero native work, and it survives the
Capacitor wrap unchanged.

---

## 7. UI

A modal, following the existing pattern in `src/modals/modals.jsx` — fixed overlay at
`rgba(0,0,0,0.7)` `z-index 999`, centred panel at `z-index 1000`, `max-width 424`.

Contents, top to bottom:

1. The `<canvas>` at `width: 100%` (it renders at 1080 internally and scales down).
2. Three style options — `Solid` · `Grid` · `Bare`. Default **Grid**. Re-render on change;
   it is fast enough to do synchronously.
3. `Copy sticker` (primary) and `Share` (secondary).

Render the canvas on open and on style change only.

### Entry points

**Primary — `src/pages/SettlementScreen.jsx:342`.** There is already a share button there
doing text-only sharing (`"Won July with 22 workouts. #Fero"` via `navigator.share({text})`).
Replace that with the sticker modal. This is an upgrade to an existing affordance, not a
new one, and it sits at the natural emotional peak: the month is closed and the number is
final.

Note the existing button has a second behaviour — when `outcome === "missed"` it scrolls
to the ledger instead of sharing. Preserve that branch; only replace the share path.

**Secondary — `src/pages/PlayerProfile.jsx`.** The month view already renders this calendar
with these icons. A share icon there lets someone pull up any past month, not just the one
that just ended.

**The actual growth lever — month rollover.** Most people will never hunt for a share
button. Strava surfaces the share the instant an activity is saved; our equivalent is the
moment the month rolls over, which is already a real event (`onStartNextMonth`). A
one-time card saying "Your July is ready" with the styles and a Copy button will drive far
more posts than either button above. Worth doing, but land the renderer first.

### Growth hypothesis

The sticker is not successful merely because an image was rendered. It should turn a
real emotional product moment into a path toward a new activated Bloc:

- prioritize target hits, last-minute saves, meaningful status/leaderboard changes, and
  finalized month results;
- preserve enough Fero/Bloc context that a viewer understands this is social workout
  accountability, not a generic fitness calendar;
- pair outbound content with a working create/join path and campaign attribution;
- measure asset creation, successful copy/share, attributable invite visits/joins, and
  activated Blocs using `docs/product-growth-measurement.md`;
- treat views, likes, and raw downloads as creative diagnostics, not the final outcome.

The social change is the hook; the calendar/stat is evidence. Do not add synthetic drama
or money language solely to make the asset more viral.

---

## 8. Verification

1. **Compare against the twelve reference PNGs** in `docs/share-sticker-reference/png/`.
   Feed the renderer the same fixtures — 22 and 8 for single log, 27-across-22-days and
   10-across-8-days for multi — and the output should be visually identical for all three
   styles. This is the acceptance test. The fixtures are defined at the top of
   `sticker-core.js` as `DENSE`, `SPARSE`, `MULTI` and `MULTI_SPARSE`; port them as test
   fixtures so the comparison is exact rather than approximate.
2. **Cold-load font check.** Hard-reload and share immediately. If the type looks wrong,
   §4.1 was not followed.
3. **All five icon types** render, including Gym — it is the one that has broken before.
4. **Multi-badge** shows at 2 and 3, never at 1.
5. **Transparency** — corner pixels have alpha 0. Verify by decoding the PNG, not by eye:
   an image viewer composites transparency against white or black and both look plausible.
6. **A month ending mid-week** trims the trailing row in `bare` and not in the other two.
7. **September** — the longest header line does not touch the sticker edges.
8. **On device**: copy, paste into an Instagram story, confirm the alpha survived. Do not
   test by emailing the PNG to yourself; some mail paths flatten alpha onto white and you
   will chase a bug that is not in your code.

---

## 9. Out of scope

- **Bloc heatmap sticker** (the top-3 podium). Designed and dropped from this round. It is
  a different object and still carries money language that has been removed everywhere
  else.
- **Outcome labels** — `TOP OF THE BLOC`, `TARGET HIT`, `MISSED TARGET`, and all money
  figures. Deliberately removed. May return later as an option.
- **In-app compositing.** A sticker cannot blur what it sits on, because at render time
  the photo does not exist yet. Rendering onto a photo chosen inside Fero would allow a
  real backdrop blur and would look considerably better — but it forces the user to upload
  their photo to the app, which is exactly the friction the clipboard flow avoids. Parked.
- **`instagram-stories://` deep link.** See §6.

---

## 10. Unrelated bug worth fixing while you are in here

`index.html` and `public/manifest.webmanifest` both spell the app **"Firo"**. Every other
reference in the codebase — `App.jsx:1630`, `authShell.jsx`, `primitives.jsx`,
`ProfilePage.jsx:522`, `SettlementScreen.jsx:337`, and `DEFAULT_GROUP_NAME = "Fero OG"` —
spells it **"Fero"**.

The wrong spelling is in the page title, the PWA `name` and `short_name`, and
`apple-mobile-web-app-title`. That is the browser tab, the install name and the
home-screen label, so the app currently installs under the wrong brand. Six strings across
two files. Worth doing before the App Store push.
