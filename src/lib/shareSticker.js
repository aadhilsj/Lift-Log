// Fero monthly share sticker — Canvas 2D renderer.
//
// Ported from docs/share-sticker-reference/sticker-core.js + sticker-style.css, which
// produced the twelve approved renders in docs/share-sticker-reference/png/. Those files
// are the ground truth for every number here.
//
// Canvas rather than html2canvas or an <img>-rasterised SVG, for two reasons that are not
// negotiable: the design depends on paint-order:stroke-fill hairlines (html2canvas
// supports neither -webkit-text-stroke nor paint-order), and an SVG in an <img> cannot
// load webfonts, which would silently swap Outfit for a system face and invalidate every
// metric below. See the plan, section 2.
//
// No React, no DOM access beyond the canvas passed in — so this stays testable in
// isolation and drives both the in-app preview and the exported PNG from one code path.

import { getWorkoutIcon } from "./workoutIcons.js";

// ── geometry, in authoring units at a 320-wide sticker ──────────────────────────
const W = 320;
const SCALE = 1080 / W;              // 3.375
const PAD = 2;
const GAP = 7;
const COLS = 7;
const CELL = (W - PAD * 2 - GAP * (COLS - 1)) / COLS;   // 39.142857…
const RADIUS = 10;
const ICON = 21;

// Vertical rhythm. The CSS these come from expresses several of these as line boxes,
// which canvas has no equivalent of, so the exact values were calibrated by measuring the
// ink bands of the approved PNGs and matching them. Total height for a 5-row month comes
// to 334.2 authoring units = 1128px exported, which is what the references are.
const HEADER_H = 39.6;               // count at 44px, line-height .9
const HEADER_MID = 21.93;            // centre line of the header's ink
const HEADER_MB = 17;
const WD_H = 12.216;                 // JetBrains Mono 8.5px line box
const WD_MB = 7;
const MARK_MT = 11.56;
const MARK_H = 20;
const PAD_BOTTOM = 1.11;

const CYAN = "#4ECDC4";
const NAVY = "#1A2E4A";
const EDGE_INK = "rgba(2,26,24,.5)";
const BASE_EDGE = "rgba(2,26,24,.42)";

const MONTH_NAMES_FULL = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];

const STYLES = {
  solid: { boxes: true,  fillLogged: true,  silverIcon: false,
           restEdge: "rgba(255,255,255,.5)",  restRing: "rgba(0,0,0,.1)",
           badge: { color: NAVY, size: 8.5, top: -5, right: -5, stroke: 0 } },
  grid:  { boxes: true,  fillLogged: false, silverIcon: true,
           restEdge: "rgba(255,255,255,.28)", restRing: "rgba(0,0,0,.05)",
           badge: { color: CYAN, size: 8.5, top: -4, right: -4, stroke: 0.4 } },
  bare:  { boxes: false, fillLogged: false, silverIcon: true,
           restEdge: null, restRing: null,
           badge: { color: CYAN, size: 10, top: -7, right: -9, stroke: 0.4 } }
};

// ── font loading ────────────────────────────────────────────────────────────────
// document.fonts.ready alone is NOT sufficient: it resolves when *pending* loads settle,
// and a face never yet requested is not pending. Each weight/family pair must be asked
// for explicitly or the first render on a cold page draws in a fallback with different
// metrics — and every position below is measured, so it would be subtly wrong everywhere.
const FONT_SPECS = [
  '900 44px Outfit', '800 17px Outfit', '700 12px Outfit', '800 10px Outfit',
  '900 20px Outfit', '500 10px "JetBrains Mono"', '500 8.5px "JetBrains Mono"'
];

async function ensureFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all(FONT_SPECS.map(spec => document.fonts.load(spec)));
    await document.fonts.ready;
  } catch { /* fall through and draw with whatever is available */ }
}

// ── small helpers ───────────────────────────────────────────────────────────────

// Safari below 16.4 has no ctx.roundRect.
function roundRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === "function") { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y,     x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x,     y + h, rr);
  ctx.arcTo(x,     y + h, x,     y,     rr);
  ctx.arcTo(x,     y,     x + w, y,     rr);
  ctx.closePath();
}

// A CSS linear-gradient angle is measured clockwise from "to top", and its line is sized
// so the gradient covers the box corners. createLinearGradient takes raw endpoints, so
// passing the box corners and hoping — the obvious shortcut — makes the Solid tiles flat.
function cssLinearGradient(ctx, w, h, deg, stops) {
  const rad = (deg * Math.PI) / 180;
  const dx = Math.sin(rad), dy = -Math.cos(rad);
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  const cx = w / 2, cy = h / 2, half = len / 2;
  const g = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  return g;
}

// Canvas has no letter-spacing in older Safari, so advance manually. CSS also adds the
// spacing after the final character, and that trailing space counts toward the measured
// width used for centring — so it is included here too.
function measureTracked(ctx, text, spacing) {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing;
  return w;
}

// stroke-then-fill is exactly paint-order:stroke fill — the stroke sits under the fill,
// so letterforms keep their full weight instead of being eaten into.
function drawTracked(ctx, text, x, y, spacing, fill, strokeW, strokeColor) {
  let cx = x;
  for (const ch of text) {
    if (strokeW > 0) {
      ctx.lineWidth = strokeW;
      ctx.strokeStyle = strokeColor;
      ctx.strokeText(ch, cx, y);
    }
    ctx.fillStyle = fill;
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

// Centre a text box on `midY` by its own ink box rather than its baseline — on one line,
// baseline-sitting makes ACTIVITIES look like it has fallen to the floor next to a 44px
// numeral.
function baselineForCentre(ctx, text, midY) {
  const m = ctx.measureText(text);
  const asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent;
  if (!Number.isFinite(asc) || !Number.isFinite(desc)) return midY;
  return midY + (asc - desc) / 2;
}

// ── icons ───────────────────────────────────────────────────────────────────────

function iconPath(spec) {
  const p = new Path2D();
  for (const shape of spec.shapes) {
    if (shape.circle) {
      const [cx, cy, r] = shape.circle;
      const c = new Path2D();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      p.addPath(c);
    } else {
      p.addPath(new Path2D(shape.d));
    }
  }
  return p;
}

// Brushed-silver ramp. MUST be in user space — under SVG's default objectBoundingBox
// units this collapsed on a zero-area bbox and the Gym icon vanished entirely, because it
// is drawn from vertical strokes whose bounding-box width is exactly 0. createLinearGradient
// is already user-space, so this is handled — do not "optimise" it into a per-path bbox.
function silverGradient(ctx, extent) {
  const g = ctx.createLinearGradient(0, 0, extent * 0.85, extent);
  g.addColorStop(0,    "#FFFFFF");
  g.addColorStop(0.34, "#FBFDFD");
  g.addColorStop(0.62, "#E2EAED");
  g.addColorStop(0.82, "#F8FBFC");
  g.addColorStop(1,    "#FFFFFF");
  return g;
}

// The hairline edge is what lets an icon survive a bright photo. Width scales with each
// icon's viewBox so it reads identically at every viewBox scale.
function drawIcon(ctx, type, cx, cy, style) {
  const spec = getWorkoutIcon(type);
  if (!spec) return;
  const [minX, minY, vbW, vbH] = spec.vb;
  const s = ICON / vbW;
  const edge = spec.extent / 53;

  ctx.save();
  ctx.translate(cx - ICON / 2, cy - ICON / 2);
  ctx.scale(s, ICON / vbH);
  ctx.translate(-minX, -minY);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const path = iconPath(spec);
  const ink = style.silverIcon ? silverGradient(ctx, spec.extent) : NAVY;

  if (spec.kind === "stroke") {
    // A stroke drawing cannot be outlined by an outer stroke — the drawing IS the stroke.
    // Lay the path down twice: a wider dark pass underneath, the ink pass on top.
    if (style.silverIcon) {
      ctx.strokeStyle = EDGE_INK;
      ctx.lineWidth = spec.w + edge * 2;
      ctx.stroke(path);
    }
    ctx.strokeStyle = ink;
    ctx.lineWidth = spec.w;
    ctx.stroke(path);
  } else {
    // Canvas's natural stroke-then-fill order gives paint-order behaviour for free.
    if (style.silverIcon) {
      ctx.strokeStyle = EDGE_INK;
      ctx.lineWidth = edge * 2;
      ctx.stroke(path);
    }
    ctx.fillStyle = ink;
    ctx.fill(path);
  }
  ctx.restore();
}

// ── cells ───────────────────────────────────────────────────────────────────────

// Cell edges are one authoring unit wide, drawn just inside the box.
//
// The CSS says `border:1.5px` plus `outline:1px` at `outline-offset:-1px`, which reads as
// two separate rings 1.5 units wide. The approved PNGs are not that: their edges measure
// one unit, with the border and the ring composited on top of each other. Painting white
// .28 and then black .05 over it at the same position reproduces the reference's exact
// pixels (alpha 80, rgb 214) — and Solid's white .5 over black .1 gives its 140/208. The
// PNGs are ground truth, so this matches them rather than the CSS.
const EDGE_W = 1;

function strokeEdge(ctx, x, y, size, color) {
  const inset = EDGE_W / 2;           // canvas strokes straddle the path; CSS borders sit inside
  ctx.save();
  roundRect(ctx, x + inset, y + inset, size - inset * 2, size - inset * 2, Math.max(0, RADIUS - inset));
  ctx.lineWidth = EDGE_W;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();
}

function drawCell(ctx, x, y, logged, style) {
  if (!style.boxes) return;                       // bare: no scaffolding at all

  if (logged && style.fillLogged) {
    ctx.save();
    ctx.translate(x, y);
    roundRect(ctx, 0, 0, CELL, CELL, RADIUS);
    ctx.fillStyle = cssLinearGradient(ctx, CELL, CELL, 155, [
      [0,    "rgba(255,255,255,.73)"],
      [0.48, "rgba(255,255,255,.49)"],
      [1,    "rgba(228,240,238,.26)"]
    ]);
    ctx.fill();
    ctx.restore();
    strokeEdge(ctx, x, y, CELL, "rgba(2,30,28,.24)");
    // Soft inner top highlight — keeps the cell feeling like glass, not a flat swatch.
    ctx.save();
    roundRect(ctx, x + 0.5, y + 0.5, CELL - 1, CELL - 1, RADIUS - 0.5);
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,.3)";
    ctx.fillRect(x + 1, y + 1, CELL - 2, 1);
    ctx.restore();
    return;
  }

  // Every other boxed case — Grid's identical logged/rest box, and Solid's rest day — is
  // the same two-tone edge: a light stroke with a dark ring composited over it, so the
  // cell reads as a HOLE rather than a filled block on any backdrop. Order matters; the
  // ring goes on top.
  strokeEdge(ctx, x, y, CELL, style.restEdge);
  strokeEdge(ctx, x, y, CELL, style.restRing);
}

// The badge is positioned against the ICON box, not the cell — in bare the cell is
// invisible, and a badge parked at the corner of nothing reads as detached.
function drawBadge(ctx, count, cx, cy, style) {
  if (count < 2) return;                          // never a 1, or the marker stops meaning anything
  const b = style.badge;
  const text = String(count);
  ctx.save();
  ctx.font = `800 ${b.size}px Outfit, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  const x = cx + ICON / 2 - b.right;
  const y = cy - ICON / 2 + b.top;
  if (b.stroke > 0) {
    ctx.lineWidth = b.stroke;
    ctx.strokeStyle = "rgba(2,26,24,.55)";
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = b.color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ── layout ──────────────────────────────────────────────────────────────────────

function mondayFirstOffset(year, monthIndex) {
  return (new Date(year, monthIndex, 1).getDay() + 6) % 7;   // Sun=0 → Mon-first
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// In bare an unused day draws nothing, so a trailing row with no logged days is pure void
// and the gap above FERO would change size month to month depending on which weekday the
// month ended on. Solid and Grid keep every row — there the empty boxes ARE the calendar,
// and trimming would make the month look like it ended early.
function rowCount(byDay, offset, days, styleName) {
  if (styleName !== "bare") return Math.ceil((offset + days) / 7);
  const logged = Object.keys(byDay).map(Number).filter(d => byDay[d] && byDay[d].length);
  if (!logged.length) return 1;
  const lastRow = Math.max(...logged.map(d => Math.floor((offset + d - 1) / 7)));
  return lastRow + 1;
}

function layoutHeight(rows) {
  const gridH = rows * CELL + (rows - 1) * GAP;
  return PAD + HEADER_H + HEADER_MB + WD_H + WD_MB + gridH + MARK_MT + MARK_H + PAD_BOTTOM;
}

// ── header ──────────────────────────────────────────────────────────────────────

function drawHeader(ctx, monthLabel, year, count, midY) {
  const yearText = String(year);
  const countText = String(count);
  const label = "ACTIVITIES";
  const yearLS = 10 * 0.16, countLS = 44 * -0.035, labelLS = 12 * 0.15;

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.font = "800 17px Outfit, sans-serif";
  const wMonth = ctx.measureText(monthLabel).width;
  ctx.font = '500 10px "JetBrains Mono", monospace';
  const wYear = measureTracked(ctx, yearText, yearLS);
  ctx.font = "600 17px Outfit, sans-serif";
  const wColon = ctx.measureText(":").width;
  ctx.font = "900 44px Outfit, sans-serif";
  const wCount = measureTracked(ctx, countText, countLS);
  ctx.font = "700 12px Outfit, sans-serif";
  const wLabel = measureTracked(ctx, label, labelLS);

  const total = wMonth + 4 + wYear + 10 + wColon + 10 + wCount + 8 + wLabel;
  let x = (W - total) / 2;

  ctx.font = "800 17px Outfit, sans-serif";
  drawTracked(ctx, monthLabel, x, baselineForCentre(ctx, monthLabel, midY), 0, "#FFFFFF", 0.28, BASE_EDGE);
  x += wMonth + 4;

  ctx.font = '500 10px "JetBrains Mono", monospace';
  drawTracked(ctx, yearText, x, baselineForCentre(ctx, yearText, midY), yearLS,
    "rgba(255,255,255,.72)", 0.28, BASE_EDGE);
  x += wYear + 10;

  ctx.font = "600 17px Outfit, sans-serif";
  drawTracked(ctx, ":", x, baselineForCentre(ctx, ":", midY), 0, "rgba(78,205,196,.85)", 0.28, BASE_EDGE);
  x += wColon + 10;

  ctx.font = "900 44px Outfit, sans-serif";
  drawTracked(ctx, countText, x, baselineForCentre(ctx, countText, midY), countLS,
    CYAN, 0.75, "rgba(2,26,24,.5)");
  x += wCount + 8;

  ctx.font = "700 12px Outfit, sans-serif";
  drawTracked(ctx, label, x, baselineForCentre(ctx, label, midY), labelLS,
    "rgba(255,255,255,.88)", 0.4, "rgba(2,26,24,.5)");
}

// ── the renderer ────────────────────────────────────────────────────────────────

// data: { monthIndex, year, byDay: { [dayOfMonth]: ["Gym", "Run", …] }, total }
// opts: { style: "solid" | "grid" | "bare" }
//
// The header count is data.total — the sum of ALL activities — which is deliberately
// allowed to differ from the number of marks on the grid, because a day can hold several.
function renderSticker(canvas, data, opts = {}) {
  const styleName = STYLES[opts.style] ? opts.style : "grid";
  const style = STYLES[styleName];
  const { monthIndex, year, byDay } = data;

  const offset = mondayFirstOffset(year, monthIndex);
  const days = daysInMonth(year, monthIndex);
  const rows = rowCount(byDay, offset, days, styleName);
  const height = layoutHeight(rows);

  canvas.width = Math.ceil(W * SCALE);
  canvas.height = Math.ceil(height * SCALE);

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);      // transparent, always
  ctx.save();
  ctx.scale(SCALE, SCALE);                               // draw in authoring units

  drawHeader(ctx, MONTH_NAMES_FULL[monthIndex], year, data.total, HEADER_MID);

  // Weekday row. In bare these are the only thing defining the columns, so they carry a
  // heavier stroke than their size would otherwise suggest — they must not be the first
  // element to disappear on a bright photo.
  const wdY = PAD + HEADER_H + HEADER_MB;
  const wdLS = 8.5 * 0.04;
  ctx.font = '500 8.5px "JetBrains Mono", monospace';
  ctx.textBaseline = "alphabetic";
  const wdBaseline = baselineForCentre(ctx, "M", wdY + WD_H / 2);
  ["M", "T", "W", "T", "F", "S", "S"].forEach((d, i) => {
    const colMid = PAD + i * (CELL + GAP) + CELL / 2;
    const w = measureTracked(ctx, d, wdLS);
    drawTracked(ctx, d, colMid - w / 2, wdBaseline, wdLS, "rgba(255,255,255,.85)", 0.34, "rgba(2,26,24,.5)");
  });

  // Grid.
  const gridTop = wdY + WD_H + WD_MB;
  const slots = rows * 7;
  for (let d = 1; d <= days && offset + d - 1 < slots; d++) {
    const i = offset + d - 1;
    const x = PAD + (i % 7) * (CELL + GAP);
    const y = gridTop + Math.floor(i / 7) * (CELL + GAP);
    const day = byDay[d];
    const logged = !!(day && day.length);
    drawCell(ctx, x, y, logged, style);
    if (logged) {
      const cx = x + CELL / 2, cy = y + CELL / 2;
      drawIcon(ctx, day[0], cx, cy, style);        // the icon drawn is the first logged
      drawBadge(ctx, day.length, cx, cy, style);
    }
  }

  // FERO signs off alone. All white — the O is NOT cyan.
  const gridH = rows * CELL + (rows - 1) * GAP;
  const markMid = gridTop + gridH + MARK_MT + MARK_H / 2;
  const markLS = 20 * 0.09;
  ctx.font = "900 20px Outfit, sans-serif";
  const wMark = measureTracked(ctx, "FERO", markLS);
  drawTracked(ctx, "FERO", (W - wMark) / 2, baselineForCentre(ctx, "FERO", markMid), markLS,
    "#FFFFFF", 0.28, BASE_EDGE);

  ctx.restore();
  return { width: canvas.width, height: canvas.height };
}

// ── data ────────────────────────────────────────────────────────────────────────

// Build the day map from already-counted logs (callers apply getCountedLogs from
// appState.js first, so the sticker's number can never disagree with the app's).
//
// Multi-activity days already work with today's data: the raw arrays hold one entry per
// activity with its own date. It is only the app's *display* that collapses them, in
// PlayerProfile and TodayPage, by assigning logsByDay[day] = log. Reading the raw array
// means the sticker supports multi-activity days before the rest of the app does.
function buildDayMap(countedLogs) {
  const byDay = {};
  for (const log of countedLogs || []) {
    const day = Number(String(log?.date || "").split("-")[2]);
    if (!Number.isFinite(day)) continue;
    (byDay[day] ||= []).push(log);
  }
  for (const d in byDay) {
    // The icon shown is the first logged, so order by createdAt.
    byDay[d].sort((a, b) => (Date.parse(a?.createdAt) || 0) - (Date.parse(b?.createdAt) || 0));
    byDay[d] = byDay[d].map(l => l?.type).filter(Boolean);
  }
  return byDay;
}

function buildStickerData(countedLogs, year, monthIndex) {
  const byDay = buildDayMap(countedLogs);
  return { year, monthIndex, byDay, total: (countedLogs || []).length };
}

// The four fixtures from sticker-core.js, ported verbatim so verification against the
// twelve approved PNGs is exact rather than approximate. July 2026: offset 2, 31 days.
const one = t => [t];
const DENSE = {1:one("Gym"),2:one("Run"),4:one("Gym"),5:one("Sports"),6:one("Gym"),
  8:one("Run"),9:one("Gym"),10:one("Pilates"),11:one("Sports"),13:one("Gym"),
  14:one("Run"),15:one("Gym"),17:one("Sports"),18:one("Gym"),19:one("Run"),
  20:one("Gym"),22:one("Pilates"),23:one("Gym"),25:one("Run"),26:one("Sports"),
  28:one("Gym"),30:one("Run")};
const SPARSE = {2:one("Gym"),6:one("Run"),9:one("Gym"),14:one("Sports"),17:one("Gym"),
  21:one("Run"),26:one("Gym"),29:one("Other")};
const MULTI = Object.assign({}, DENSE, {
  4:["Gym","Run"], 9:["Gym","Sports"], 17:["Sports","Gym"], 25:["Run","Gym","Pilates"]
});
const MULTI_SPARSE = Object.assign({}, SPARSE, {
  6:["Run","Gym"], 17:["Gym","Sports"]
});
const totalActivities = byDay => Object.values(byDay).reduce((n, a) => n + a.length, 0);
const fixture = byDay => ({ year: 2026, monthIndex: 6, byDay, total: totalActivities(byDay) });
const FIXTURES = {
  dense: fixture(DENSE), sparse: fixture(SPARSE),
  multi: fixture(MULTI), "multi-sparse": fixture(MULTI_SPARSE)
};

async function renderStickerAsync(canvas, data, opts) {
  await ensureFonts();
  return renderSticker(canvas, data, opts);
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
}

export { renderSticker, renderStickerAsync, ensureFonts, canvasToBlob,
  buildDayMap, buildStickerData, FIXTURES, STYLES, W, SCALE, CELL };
