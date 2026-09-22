import React from "react";
import {
  MIN_TARGET,
  getCountedLogs,
  getMonthPartsFromKey,
  getSoloTargetForMonth,
  isSoloForMonth,
  isTrainingForMonth
} from "../lib/appState.js";
import { Avatar } from "./primitives.jsx";

// The "perfect month" loop. One ring for the whole Bloc: every workout a member
// owes is one tick, grouped into that member's slice, so bigger targets take a
// bigger share. Workouts past a target land on an outer track and never count
// toward the loop. Rules agreed with the founder on 2026-09-22:
//   - a perfect month is every member in the month clearing their own target
//   - sitting out removes you from the loop (no slice)
//   - Solo keeps a full-size slice, but only the Solo target can fill, so the
//     loop cannot close; nothing on screen names them for it
//   - first-month members count like everyone else
//   - at least 75% of the Bloc must be in the month

const FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT_MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CYAN = "#4ECDC4";
const CHALK = "#E8F6F3";
const TICK_EMPTY = "#1D2A29";
export const LOOP_FONTS = {
  display: "'Raleway', sans-serif",
  body: "'Outfit', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, Menlo, monospace"
};

// ─── Month data ────────────────────────────────────────────────────────────────

export const monthName = monthIndex => FULL_MONTH_NAMES[monthIndex] || "";
export const shortMonthName = monthIndex => SHORT_MONTH_NAMES[monthIndex] || "";
export const daysInMonthOf = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();

const dayOfDate = (date, year, monthIndex) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date || ""));
  if (!match) return null;
  if (Number(match[1]) !== year || Number(match[2]) !== monthIndex + 1) return null;
  return Number(match[3]);
};

// Counted workouts per day of the month, index 0 = the 1st.
export function perDayCounts(logs, year, monthIndex) {
  const days = daysInMonthOf(year, monthIndex);
  const perDay = Array(days).fill(0);
  for (const log of getCountedLogs(logs)) {
    const day = dayOfDate(log?.date, year, monthIndex);
    if (day && day <= days) perDay[day - 1] += 1;
  }
  return perDay;
}

// The day someone reached `goal`, or null.
export function clearDayOf(perDay, goal) {
  if (!goal) return null;
  let running = 0;
  for (let d = 0; d < perDay.length; d += 1) {
    running += perDay[d];
    if (running >= goal) return d + 1;
  }
  return null;
}

// Monday-to-Sunday weeks inside the month.
export function monthWeeks(year, monthIndex) {
  const days = daysInMonthOf(year, monthIndex);
  const weeks = [];
  let start = 1;
  for (let day = 1; day <= days; day += 1) {
    const weekday = (new Date(year, monthIndex, day).getDay() + 6) % 7; // Monday = 0
    if (weekday === 6 || day === days) { weeks.push([start, day]); start = day + 1; }
  }
  return weeks;
}

export function bestWeekOf(perDay, year, monthIndex) {
  const weeks = monthWeeks(year, monthIndex).map(([a, b]) => ({ a, b, n: perDay.slice(a - 1, b).reduce((sum, x) => sum + x, 0) }));
  return weeks.reduce((best, week) => (week.n > best.n ? week : best), weeks[0] || { a: 1, b: 1, n: 0 });
}

const monthOrder = key => {
  const parts = getMonthPartsFromKey(key);
  return parts ? parts.year * 12 + parts.monthIndex : -Infinity;
};

// A member's frozen result in one closed month, or null if they weren't in it.
export function closedMonthMember(month, name) {
  if (!month || !name || !Object.prototype.hasOwnProperty.call(month.counts || {}, name)) return null;
  const blocTarget = Number(month.memberTargets?.[name] || month.settings?.minTarget || MIN_TARGET);
  const isSolo = isSoloForMonth(month, name, month.key);
  const soloTarget = isSolo ? getSoloTargetForMonth(month, name, month.key) : null;
  return {
    name,
    count: Number(month.counts?.[name] || 0),
    target: blocTarget,
    fillable: isSolo && soloTarget ? soloTarget : blocTarget,
    isOut: !!month.excused?.[name],
    isSolo,
    isTraining: isTrainingForMonth(month, name, month.key)
  };
}

const sortedHistory = monthHistory => [...(monthHistory || [])].filter(m => m?.key).sort((a, b) => monthOrder(a.key) - monthOrder(b.key));

// Best closed month strictly before `beforeKey`, counting months they took part in.
export function personalBestOf(monthHistory, name, beforeKey) {
  let best = null;
  for (const month of sortedHistory(monthHistory)) {
    if (monthOrder(month.key) >= monthOrder(beforeKey)) continue;
    const entry = closedMonthMember(month, name);
    if (!entry || entry.isOut) continue;
    const parts = getMonthPartsFromKey(month.key);
    // Ties go to the more recent month, which is the one people remember.
    if (!best || entry.count >= best.count) best = { count: entry.count, monthName: monthName(parts?.monthIndex) };
  }
  return best;
}

// The six most recent finished months the member was part of, oldest first.
// `throughKey` is included when given (the results screen), excluded otherwise.
export function trackRecordOf(monthHistory, name, key, { includeKey = false } = {}) {
  const limit = monthOrder(key);
  return sortedHistory(monthHistory)
    .filter(month => (includeKey ? monthOrder(month.key) <= limit : monthOrder(month.key) < limit))
    .map(month => {
      const entry = closedMonthMember(month, name);
      if (!entry) return null;
      const parts = getMonthPartsFromKey(month.key);
      const state = entry.isOut ? "out" : entry.count >= entry.fillable ? "ok" : "miss";
      return { key: month.key, label: shortMonthName(parts?.monthIndex), state, frac: Math.min(1, entry.count / Math.max(1, entry.fillable)) };
    })
    .filter(Boolean)
    .slice(-6);
}

// Count by the same day of the most recent closed month before `key`.
export function sameDayLastMonth(monthHistory, name, key, day) {
  const prior = sortedHistory(monthHistory).filter(m => monthOrder(m.key) < monthOrder(key)).pop();
  if (!prior) return null;
  const entry = closedMonthMember(prior, name);
  if (!entry || entry.isOut) return null;
  const parts = getMonthPartsFromKey(prior.key);
  const perDay = perDayCounts(prior.logsByUser?.[name] || [], parts.year, parts.monthIndex);
  const upTo = Math.min(day, perDay.length);
  return {
    count: perDay.slice(0, upTo).reduce((sum, x) => sum + x, 0),
    target: entry.fillable,
    monthIndex: parts.monthIndex,
    day: upTo
  };
}

// Loop totals and the perfect-month rule, from a list of month members.
export function loopTotals(members) {
  const inLoop = members.filter(m => !m.isOut);
  const total = inLoop.reduce((sum, m) => sum + m.target, 0);
  const done = inLoop.reduce((sum, m) => sum + Math.min(m.count, m.fillable), 0);
  const regulars = inLoop.filter(m => !m.isSolo);
  const cleared = regulars.filter(m => m.count >= m.target);
  const open = regulars.filter(m => m.count < m.target);
  const eligible = members.length > 0 && inLoop.length / members.length >= 0.75;
  const anySolo = inLoop.some(m => m.isSolo);
  const allClear = regulars.length > 0 && open.length === 0;
  return {
    inLoop, total, done, regulars, cleared, open, eligible, anySolo,
    // Whether the loop CAN close this month, and whether it did.
    canBePerfect: eligible && !anySolo,
    perfect: eligible && !anySolo && allClear,
    stillNeeded: regulars.reduce((sum, m) => sum + Math.max(0, m.target - m.count), 0)
  };
}

// The two lines under the ring. Names only appear when 3 or fewer are left.
export function loopCaption(members, { ended, dayOne }) {
  const t = loopTotals(members);
  const clearedLine = [{ strong: `${t.cleared.length} of ${t.regulars.length}` }, " slices cleared."];
  if (t.perfect) return [["Every slice cleared."], ["Nobody left the loop open."]];
  if (ended) return [clearedLine, [{ strong: String(t.stillNeeded) }, " workouts from a perfect month."]];
  if (!t.eligible) return [["Only ", { strong: `${t.inLoop.length} of ${members.length}` }, " are in this month."], ["The loop still counts, but it can't be perfect."]];
  if (dayOne && t.done === 0) return [["A fresh loop."], ["The Bloc needs ", { strong: String(t.stillNeeded) }, " workouts."]];
  const needs = m => `${m.target - m.count} more`;
  if (t.open.length === 1) return [clearedLine, ["It's down to ", { strong: t.open[0].name }, `: ${needs(t.open[0])}.`]];
  if (t.open.length <= 3) {
    const parts = [];
    t.open.forEach((m, i) => { if (i) parts.push(", "); parts.push({ strong: m.name }, ` ${needs(m)}`); });
    parts.push(".");
    return [clearedLine, parts];
  }
  return [clearedLine, ["The Bloc needs ", { strong: String(t.stillNeeded) }, " more workouts."]];
}

const renderLine = (line, key) => React.createElement('span', { key, style: { display: "block" } },
  line.map((part, i) => typeof part === "string" ? part : React.createElement('strong', { key: i, style: { color: "var(--text)", fontWeight: 600 } }, part.strong))
);

export const LoopCaption = ({ lines }) => React.createElement('div', {
  style: { fontFamily: LOOP_FONTS.body, fontSize: "clamp(11px, 3.4vw, 12.5px)", color: "var(--text-soft, #B8C7C4)", textAlign: "center", lineHeight: 1.5, minHeight: 38 }
}, lines.map(renderLine));

// ─── The dial ──────────────────────────────────────────────────────────────────

const C = 200, R_ARC = 124, R_T1 = 134, R_T2 = 147, R_X1 = 153, R_X2 = 159, R_ROW = 8, MAX_ROWS = 2, R_FACE = 179, GAP = 4.2;
const pt = (r, deg) => { const a = (deg - 90) * Math.PI / 180; return [C + r * Math.cos(a), C + r * Math.sin(a)]; };
const arcPath = (r, a0, a1) => { const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1); return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
const wedge = (r0, r1, a0, a1) => {
  const [a, b] = pt(r1, a0), [c, d] = pt(r1, a1), [e, f] = pt(r0, a1), [g, h] = pt(r0, a0), L = a1 - a0 > 180 ? 1 : 0;
  return `M${a} ${b} A${r1} ${r1} 0 ${L} 1 ${c} ${d} L${e} ${f} A${r0} ${r0} 0 ${L} 0 ${g} ${h} Z`;
};

// members: [{ name, userId, isMe, isOut, isSolo, target, fillable, count }]
// readout: React node for the middle. `focus` dims everyone else.
export const MonthDial = ({ members, perfect, focus, onToggle, readout }) => {
  const inLoop = members.filter(m => !m.isOut);
  const total = inLoop.reduce((sum, m) => sum + m.target, 0) || 1;
  const usable = 360 - GAP * inLoop.length;
  const [glow, setGlow] = React.useState(false);
  React.useEffect(() => {
    if (!perfect) { setGlow(false); return undefined; }
    const id = requestAnimationFrame(() => setGlow(true));
    return () => cancelAnimationFrame(id);
  }, [perfect]);

  let angle = GAP / 2;
  const slices = inLoop.map(m => {
    const span = usable * m.target / total, step = span / m.target;
    const counted = Math.min(m.count, m.fillable), extra = Math.max(0, m.count - m.fillable);
    const cleared = counted >= m.fillable;
    const faceR = R_FACE + (extra > m.target ? R_ROW : 0);
    const slice = { m, a0: angle, span, step, counted, extra, cleared, faceR, mid: angle + span / 2 };
    angle += span + GAP;
    return slice;
  });

  const dim = name => focus && focus !== name;
  const svg = React.createElement('svg', { viewBox: "0 0 400 400", role: "img", "aria-label": "The Bloc's loop this month", style: { position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" } },
    React.createElement('defs', null,
      React.createElement('radialGradient', { id: "fero-loop-fill", cx: "50%", cy: "50%", r: "50%" },
        React.createElement('stop', { offset: "0%", stopColor: CYAN, stopOpacity: 0.30 }),
        React.createElement('stop', { offset: "70%", stopColor: CYAN, stopOpacity: 0.10 }),
        React.createElement('stop', { offset: "100%", stopColor: CYAN, stopOpacity: 0.02 })
      )
    ),
    React.createElement('circle', { cx: C, cy: C, r: R_ARC - 4, fill: "url(#fero-loop-fill)", opacity: perfect && glow ? 1 : 0, style: { transition: "opacity .9s cubic-bezier(.16,1,.3,1)" } }),
    React.createElement('circle', { cx: C, cy: C, r: R_ARC, fill: "none", stroke: "#0F1C1B", strokeWidth: 6 }),
    slices.map(({ m, a0, span, step, counted, extra, cleared, faceR }) =>
      React.createElement('g', {
        key: m.name, "data-loop-keep": "1",
        onClick: e => { e.stopPropagation(); onToggle?.(m.name); },
        style: { cursor: onToggle ? "pointer" : "default", opacity: dim(m.name) ? 0.22 : 1, transition: "opacity .25s ease" }
      },
        Array.from({ length: m.target }, (_, k) => {
          const a = a0 + step * (k + 0.5); const [x1, y1] = pt(R_T1, a), [x2, y2] = pt(R_T2, a);
          // Solo's places beyond their Solo target are outlines that can never fill.
          return k >= m.fillable
            ? React.createElement('line', { key: k, x1, y1, x2, y2, stroke: "#2B3D3B", strokeWidth: 1.3, strokeDasharray: "2 2" })
            : React.createElement('line', { key: k, x1, y1, x2, y2, stroke: k < counted ? CYAN : TICK_EMPTY, strokeWidth: 1.4 });
        }),
        counted > 0 && React.createElement('path', { d: arcPath(R_ARC, a0, a0 + step * counted), fill: "none", stroke: cleared ? CYAN : "rgba(78,205,196,.55)", strokeWidth: cleared ? (perfect ? 7 : 6) : 4 }),
        Array.from({ length: Math.min(extra, m.target * MAX_ROWS) }, (_, k) => {
          const row = Math.floor(k / m.target), a = a0 + step * ((k % m.target) + 0.5);
          const [x1, y1] = pt(R_X1 + row * R_ROW, a), [x2, y2] = pt(R_X2 + row * R_ROW, a);
          return React.createElement('line', { key: `x${k}`, x1, y1, x2, y2, stroke: CHALK, strokeWidth: 1.4 });
        }),
        React.createElement('path', { d: wedge(R_ARC - 14, faceR + 13, a0 - GAP / 2, a0 + span + GAP / 2), fill: "transparent" })
      )
    )
  );

  // Faces are real avatars (photos included) laid over the drawing.
  const faces = slices.map(({ m, mid, faceR, cleared }) => {
    const [x, y] = pt(faceR, mid);
    return React.createElement('button', {
      key: `face-${m.name}`, type: "button", "data-loop-keep": "1",
      "aria-label": `${m.name}'s month`,
      onClick: e => { e.stopPropagation(); onToggle?.(m.name); },
      style: {
        position: "absolute", left: `${x / 4}%`, top: `${y / 4}%`, transform: "translate(-50%,-50%)",
        width: 24, height: 24, padding: 0, border: "none", borderRadius: "50%", background: "transparent",
        cursor: onToggle ? "pointer" : "default", opacity: dim(m.name) ? 0.22 : 1, transition: "opacity .25s ease",
        boxShadow: cleared && !m.isSolo ? `0 0 0 1.5px ${CYAN}` : "0 0 0 1.5px #0A1412"
      }
    }, React.createElement(Avatar, { name: m.name, userId: m.userId || "", size: 24 }));
  });

  return React.createElement('div', { style: { width: "100%", maxWidth: 380, margin: "0 auto", aspectRatio: "1 / 1", position: "relative" } },
    svg,
    React.createElement('div', { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", textAlign: "center" } }, readout),
    faces
  );
};

// The middle of the ring.
export const LoopReadout = ({ focusMember, perfect, done, total, line, lineMuted }) => {
  const mono = { fontFamily: LOOP_FONTS.mono, fontVariantNumeric: "tabular-nums" };
  if (focusMember) {
    return React.createElement(React.Fragment, null,
      React.createElement('div', { style: { fontFamily: LOOP_FONTS.body, fontSize: 15, fontWeight: 600, marginBottom: 6, color: "var(--text)" } }, focusMember.isMe ? "You" : focusMember.name),
      React.createElement('div', { style: { ...mono, fontSize: 46, fontWeight: 700, lineHeight: 1, letterSpacing: "-.02em", color: "var(--text)" } }, focusMember.count),
      React.createElement('div', { style: { ...mono, fontSize: 10.5, color: "#6B9690", letterSpacing: ".14em", textTransform: "uppercase", marginTop: 7 } }, `of ${focusMember.fillable}`),
      focusMember.isSolo && React.createElement('div', { style: { fontFamily: LOOP_FONTS.body, fontSize: 9, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: CYAN, marginTop: 12 } }, "On Solo")
    );
  }
  if (perfect) {
    return React.createElement(React.Fragment, null,
      React.createElement('div', { style: { fontFamily: LOOP_FONTS.display, fontSize: 27, fontWeight: 900, lineHeight: 0.98, letterSpacing: ".03em", textTransform: "uppercase", color: "var(--text)", textShadow: "0 0 22px rgba(78,205,196,.45)" } }, "Perfect", React.createElement('br'), "month"),
      React.createElement('div', { style: { ...mono, fontSize: 12, fontWeight: 700, color: CYAN, letterSpacing: ".14em", textTransform: "uppercase", marginTop: 12 } }, `${done} of ${total}`)
    );
  }
  return React.createElement(React.Fragment, null,
    React.createElement('div', { style: { ...mono, fontSize: 46, fontWeight: 700, lineHeight: 1, letterSpacing: "-.02em", color: "var(--text)" } }, done),
    React.createElement('div', { style: { ...mono, fontSize: 10.5, color: "#6B9690", letterSpacing: ".14em", textTransform: "uppercase", marginTop: 7 } }, `of ${total}`),
    line && React.createElement('div', { style: { fontFamily: LOOP_FONTS.body, fontSize: 9, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: lineMuted ? "#6B9690" : CYAN, marginTop: 12 } }, line)
  );
};

// Close the focused slice when someone taps anywhere that isn't the ring or the panel.
export function useTapOutside(active, onOutside) {
  React.useEffect(() => {
    if (!active) return undefined;
    const handler = event => {
      if (event.target?.closest?.('[data-loop-keep]')) return;
      onOutside();
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [active, onOutside]);
}

// ─── Small shared pieces ───────────────────────────────────────────────────────

export const MiniRing = ({ state, frac = 0.6 }) => {
  const r = 7, c = 2 * Math.PI * r;
  const fill = state === "ok" ? 1 : state === "miss" ? Math.max(0.15, frac) : 0;
  return React.createElement('svg', { width: 18, height: 18, viewBox: "0 0 18 18", "aria-hidden": true },
    React.createElement('circle', { cx: 9, cy: 9, r, fill: "none", stroke: TICK_EMPTY, strokeWidth: 2.2, strokeDasharray: state === "out" ? "2 2" : undefined }),
    fill > 0 && React.createElement('circle', { cx: 9, cy: 9, r, fill: "none", stroke: state === "ok" ? CYAN : "#3C5C58", strokeWidth: 2.2, strokeDasharray: `${fill * c} ${c}`, transform: "rotate(-90 9 9)" })
  );
};

// Returns the pieces (label style, the row of rings, a one-line summary) so each screen can lay them out.
export function trackRecordParts({ months, highlightLast = false, firstMonth = false, compact = false }) {
  const clearedCount = months.filter(m => m.state === "ok").length;
  const label = { fontFamily: LOOP_FONTS.body, fontSize: 8.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#6B9690" };
  const rings = React.createElement('div', { style: { display: "flex", gap: compact ? 6 : 9, alignItems: "flex-end" } },
    months.map((m, i) => React.createElement('figure', { key: m.key, style: { margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: compact ? 3 : 4 } },
      React.createElement(MiniRing, { state: m.state, frac: m.frac }),
      React.createElement('figcaption', { style: { fontFamily: LOOP_FONTS.mono, fontSize: compact ? 7.5 : 8, color: highlightLast && i === months.length - 1 ? "var(--text)" : "#6B9690", textTransform: "uppercase" } }, m.label)
    ))
  );
  const summary = firstMonth || !months.length ? "First month in the Bloc" : `Cleared ${clearedCount} of ${months.length}`;
  return { label, rings, summary };
}

export const PanelCard = ({ label, big, small, extraStyle }) => React.createElement('div', {
  style: { border: "0.5px solid #0D1F1E", background: "#080F0F", borderRadius: 10, padding: "10px 11px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0, ...(extraStyle || {}) }
},
  React.createElement('span', { style: { fontFamily: LOOP_FONTS.body, fontSize: 8.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#6B9690" } }, label),
  big && React.createElement('strong', { style: { fontFamily: LOOP_FONTS.body, fontSize: 17, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: "var(--text)" } }, big),
  small && React.createElement('em', { style: { fontStyle: "normal", fontFamily: LOOP_FONTS.body, fontSize: 11, fontWeight: 500, lineHeight: 1.3, color: "#B8C7C4" } }, small)
);

export const smallUnit = text => React.createElement('small', { style: { fontFamily: LOOP_FONTS.body, fontSize: 11, fontWeight: 500, color: "#6B9690", marginLeft: 4 } }, text);

// Personal best card body for someone's month so far.
export function personalBestCard(best, count, { firstMonth = false, satOut = false } = {}) {
  if (firstMonth || !best) return { big: "First month", small: "this one sets the mark" };
  if (satOut) return { big: React.createElement(React.Fragment, null, best.count, smallUnit(`in ${best.monthName}`)), small: "still stands" };
  if (count > best.count) return { big: React.createElement('span', { style: { color: CHALK } }, "New best"), small: `past ${best.monthName}'s ${best.count}` };
  if (count === best.count) return { big: "Level", small: `with ${best.monthName}'s ${best.count}` };
  return { big: React.createElement(React.Fragment, null, best.count, smallUnit(`in ${best.monthName}`)), small: `${best.count - count} to beat it` };
}
