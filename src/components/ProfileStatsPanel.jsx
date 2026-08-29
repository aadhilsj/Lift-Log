import React from "react";
import { WORKOUT_TYPES } from "../lib/appState.js";
import { Card, AppIcon, WorkoutTypeIcon } from "./primitives.jsx";
import { buildProfileStats } from "../lib/profileStats.js";

const { useState, useRef, useEffect } = React;

const REG = 400, MED = 500;
const WD_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const sinceLabel = ts => {
  const d = ts ? new Date(ts) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${FULL_MONTH_NAMES[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
};
const isoOf = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

// The all-time stats panel: stat cards, heatmap, hit rate, workouts by day and
// workout mix. Extracted from ProfilePage so the in-Bloc member profile renders
// exactly the same visuals rather than a second, diverging implementation.
//
// `groups` must already be scoped by the caller. ProfilePage passes every Bloc
// the viewer is in; the in-Bloc member profile passes only the Blocs shared
// with that member, because readable state never contains anyone else's Blocs.
// The server returns raw aggregates; the panel also needs a few derived values
// the client aggregation computes. Rebuild them here so both paths render
// identically.
function mergeServerStats(localAgg, stats) {
  const weekday = Array.isArray(stats.weekday) && stats.weekday.length === 7 ? stats.weekday : localAgg.weekday;
  const counts = weekday.map(Number);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  const bestIdx = max > 0 ? counts.indexOf(max) : -1;
  const worstIdx = max > 0 && min !== max ? counts.indexOf(min) : -1;
  const logsByDate = stats.logsByDate && typeof stats.logsByDate === "object" ? stats.logsByDate : localAgg.logsByDate;
  const bestMonth = stats.bestMonth
    ? {
        key: stats.bestMonth.key,
        count: stats.bestMonth.count,
        label: FULL_MONTH_NAMES[Number(String(stats.bestMonth.key).slice(5, 7)) - 1] || ""
      }
    : null;
  return {
    ...localAgg,
    workoutsLogged: Number(stats.workoutsLogged || 0),
    blocWins: Number(stats.blocWins || 0),
    targetHitMonths: Number(stats.targetHitMonths || 0),
    targetEligibleMonths: Number(stats.targetEligibleMonths || 0),
    earliestJoined: stats.earliestJoined ?? localAgg.earliestJoined,
    earliestWorkout: stats.earliestWorkout ?? localAgg.earliestWorkout,
    weekday: counts,
    typeMix: stats.typeMix && typeof stats.typeMix === "object" ? stats.typeMix : localAgg.typeMix,
    logsByDate,
    anyLogs: Object.keys(logsByDate).length > 0,
    bestIdx,
    worstIdx,
    bestMonth
  };
}

const ProfileStatsPanel = ({ groups = [], userId, ownerName = "", accountCreatedAt = null, scopeNote = "", serverStats = null }) => {
  // Section headings are possessive: they read as the viewer's own on the
  // account profile, and as the member's name when viewing someone else.
  const owns = ownerName
    ? `${ownerName}${/s$/i.test(ownerName) ? "'" : "'s"}`
    : "Your";
  // Prefer server-computed stats: they span every Bloc the member is in, which
  // a client cannot see. The local aggregation stays as the fallback for the
  // account profile and for any moment the request has not resolved.
  const local = buildProfileStats({ groups, userId });
  const myGroups = local.myGroups;
  const agg = serverStats ? mergeServerStats(local.agg, serverStats) : local.agg;
  // Where the heatmap starts. Defined here rather than by the caller: the
  // heatmap lives in this component, so the value it depends on must too.
  const profileStartTs = agg.earliestWorkout || agg.earliestJoined || Date.parse(accountCreatedAt || "") || null;
  const [sel, setSel] = useState(null); // tapped heatmap day { iso, count }
  const heatScrollRef = useRef(null);
  // Open the heatmap scrolled to today (data's most relevant end).
  useEffect(() => { const el = heatScrollRef.current; if (el) el.scrollLeft = el.scrollWidth; }, []);

  const HEAT_CELL = 16, HEAT_GAP = 4, HEAT_PITCH = HEAT_CELL + HEAT_GAP, HEAT_WDCOL = 32;
  const monIdx = d => (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  const heatCell = c => c <= 0 ? "rgba(255,255,255,.05)" : c === 1 ? "rgba(88,235,225,.28)" : c === 2 ? "rgba(88,235,225,.54)" : c === 3 ? "rgba(88,235,225,.8)" : "#58EBE1";
  const heat = (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const joinTs = profileStartTs;
    const firstIso = Object.keys(agg.logsByDate).sort()[0];
    const firstTs = firstIso ? Date.parse(`${firstIso}T00:00:00`) : null;
    let startTs = joinTs;
    if (firstTs && (startTs === null || firstTs < startTs)) startTs = firstTs;
    const start = startTs !== null ? new Date(startTs) : new Date(today);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - monIdx(start)); // align to the Monday of that week
    const weeks = [], monthCols = [], yearCols = [];
    const cursor = new Date(start);
    let col = 0;
    let lastYear = null;
    while (cursor <= today) {
      if (cursor.getFullYear() !== lastYear) {
        yearCols.push({ col, label: String(cursor.getFullYear()) });
        lastYear = cursor.getFullYear();
      }
      const week = [];
      for (let d = 0; d < 7; d++) {
        const iso = isoOf(cursor);
        week.push({ iso, count: agg.logsByDate[iso] || 0, future: cursor > today });
        if (cursor.getDate() === 1) monthCols.push({ col, key: `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}`, label: FULL_MONTH_NAMES[cursor.getMonth()].slice(0, 3) });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
      col += 1;
    }
    if (!monthCols.length || monthCols[0].col > 0) monthCols.unshift({ col: 0, key: `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,"0")}`, label: FULL_MONTH_NAMES[start.getMonth()].slice(0, 3) });
    return { weeks, monthCols, yearCols };
  })();
  const dayDetail = (() => {
    if (!sel) return null;
    const d = new Date(`${sel.iso}T00:00:00`);
    const lbl = d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
    return `${lbl} · ${sel.count} ${sel.count === 1 ? "workout" : "workouts"}`;
  })();
  const heatCaption = agg.bestMonth
    ? `Best month: ${agg.bestMonth.label}, ${agg.bestMonth.count} ${agg.bestMonth.count === 1 ? "workout" : "workouts"}`
    : "";
  const dowMax = Math.max(...agg.weekday, 1);
  const hitRatePct = agg.targetEligibleMonths ? Math.round((agg.targetHitMonths / agg.targetEligibleMonths) * 100) : 0;
  const hitRateStroke = 2 * Math.PI * 18;

  // ── shared card bits ───────────────────────────────────────────────────────
  const statLabel = { display: "block", fontSize: 8.5, fontWeight: MED, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", textAlign: "left", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  const statVal = extra => ({ fontSize: 15.5, fontWeight: MED, lineHeight: 1.02, textAlign: "center", width: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...extra });
  const statCard = (label, valNode, sub, options = {}) => React.createElement(Card, { key: label, style: {
    position: "relative",
    padding: options.elevated ? "7px 7px 8px" : "9px 6px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    overflow: "hidden",
    boxShadow: options.elevated ? "0 12px 24px rgba(0,0,0,.26), 0 2px 10px rgba(78,205,196,.07)" : undefined
  } },
    options.elevated ? React.createElement('div', { style: { position: "absolute", left: 9, right: 9, top: 0, height: 1, background: "rgba(115,232,223,.42)" } }) : null,
    React.createElement('div', { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 4, width: "100%", marginBottom: 4, minWidth: 0 } },
      options.icon ? React.createElement('span', { style: { width: 15, height: 15, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#58EBE1", background: "rgba(88,235,225,.08)", border: "1px solid rgba(88,235,225,.16)", flexShrink: 0 } }, options.icon) : null,
      React.createElement('span', { style: statLabel }, label)
    ),
    valNode
  );


  // ── workout mix (all-time, cross-Bloc) ─────────────────────────────────────
  const mixSorted = [...WORKOUT_TYPES].sort((a, b) => (agg.typeMix[b] || 0) - (agg.typeMix[a] || 0) || WORKOUT_TYPES.indexOf(a) - WORKOUT_TYPES.indexOf(b));
  const mixTotal = WORKOUT_TYPES.reduce((s, t) => s + (agg.typeMix[t] || 0), 0);
  const mixMax = Math.max(...WORKOUT_TYPES.map(t => agg.typeMix[t] || 0), 1);

  // Only shown when viewing someone else. Your own profile already carries an
  // 'On Fero since' line in its header, and that one is derived differently,
  // so showing both would print two different dates for the same thing.
  const joinedLabel = ownerName ? sinceLabel(agg.earliestJoined) : null;

  return React.createElement(React.Fragment, null,
    // Every figure below is computed from the `groups` the caller passed, so
    // the scope note belongs at the top where it governs all of them, not as a
    // footnote under the last card.
    (scopeNote || joinedLabel) ? React.createElement('div', { style: { display: "grid", gap: 2, justifyItems: "center", textAlign: "center", marginBottom: 2 } },
      joinedLabel ? React.createElement('div', { style: { fontSize: 11.5, fontWeight: REG, color: "var(--muted)" } },
        `${ownerName} joined ${joinedLabel}`
      ) : null,
      scopeNote ? React.createElement('div', { style: { fontSize: 9.5, fontWeight: REG, color: "var(--muted2)", lineHeight: 1.35, maxWidth: 300 } }, scopeNote) : null
    ) : null,
    // Free tier — three stat cards, single row
    React.createElement('div', { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 } },
      statCard("Workouts", React.createElement('div', { style: statVal({ color: "#4ECDC4" }) }, agg.workoutsLogged || 0), null, { elevated: true, icon: React.createElement(WorkoutTypeIcon, { type: "Gym", size: 12 }) }),
      statCard("Blocs", React.createElement('div', { style: statVal({ color: "var(--text)" }) }, serverStats ? Number(serverStats.blocCount || 0) : myGroups.length), null, { elevated: true, icon: React.createElement(AppIcon, { name: "group", size: 12, stroke: "currentColor" }) }),
      statCard("Wins", React.createElement('div', { style: statVal({ color: "var(--text)" }) }, agg.blocWins || 0), null, { elevated: true, icon: React.createElement(AppIcon, { name: "trophy", size: 12, stroke: "currentColor" }) })
    ),

    // The lifetime money balance used to sit here, labelled "Accountability
    // Score". It was removed deliberately:
    //  - it summed nothing meaningful across Blocs in different currencies;
    //  - profiles are becoming visible to other members, and a public
    //    lifetime-loss figure punishes exactly the people the app is meant to
    //    help;
    //  - money is the commitment mechanism, not the achievement.
    // Per-Bloc settlement figures remain on the settlement and month screens,
    // where the currency and context are unambiguous.

    // ── Premium block (PROFILE_PREMIUM_GATE) — all built & visible now ─────────
    React.createElement('div', { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 4 } },
      React.createElement('div', { style: { height: 1, flex: 1, background: "rgba(245,166,35,.18)" } }),
      React.createElement('span', { style: { fontSize: 9.5, fontWeight: MED, color: "#F5A623", textTransform: "uppercase", letterSpacing: ".12em" } }, "Premium"),
      React.createElement('div', { style: { height: 1, flex: 1, background: "rgba(245,166,35,.18)" } })
    ),

    // Heatmap card
    React.createElement(Card, { style: { padding: "12px 13px" } },
      React.createElement('div', { style: { display: "grid", justifyItems: "center", gap: 3, marginBottom: dayDetail ? 6 : 10 } },
        React.createElement('div', { style: { fontSize: 14, fontWeight: MED, textAlign: "center" } }, `${owns} Heatmap`),
        heatCaption ? React.createElement('div', { style: { fontSize: 10.5, fontWeight: REG, color: "var(--muted)", textAlign: "center", lineHeight: 1.35 } }, heatCaption) : null
      ),
      dayDetail ? React.createElement('div', { style: { fontSize: 11.5, fontWeight: REG, color: "var(--text)", marginBottom: 9, textAlign: "center" } }, dayDetail) : null,
      !agg.anyLogs
        ? React.createElement('div', { style: { color: "var(--muted)", fontSize: 13, fontWeight: REG, textAlign: "center", padding: "16px 0" } }, "No workouts logged yet.")
        : React.createElement('div', { ref: heatScrollRef, style: { overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 4 } },
            React.createElement('div', { style: { minWidth: "max-content" } },
              heat.yearCols.length > 1 ? React.createElement('div', { style: { display: "flex" } },
                React.createElement('div', { style: { width: HEAT_WDCOL, flexShrink: 0 } }),
                React.createElement('div', { style: { position: "relative", height: 14, width: heat.weeks.length * HEAT_PITCH } },
                  heat.yearCols.map(yc => React.createElement('span', { key: `${yc.col}-${yc.label}`, style: { position: "absolute", left: yc.col * HEAT_PITCH, fontSize: 9.5, fontWeight: MED, color: "rgba(88,235,225,.85)" } }, yc.label))
                )
              ) : null,
              React.createElement('div', { style: { display: "flex" } },
                React.createElement('div', { style: { width: HEAT_WDCOL, flexShrink: 0 } }),
                React.createElement('div', { style: { position: "relative", height: 14, width: heat.weeks.length * HEAT_PITCH } },
                  heat.monthCols.map(mc => React.createElement('span', { key: `${mc.col}-${mc.label}`, style: { position: "absolute", left: mc.col * HEAT_PITCH, fontSize: 9, fontWeight: REG, color: "var(--muted)" } }, mc.label))
                )
              ),
              React.createElement('div', { style: { display: "flex" } },
                React.createElement('div', { style: { width: HEAT_WDCOL, flexShrink: 0, display: "flex", flexDirection: "column", gap: HEAT_GAP } },
                  WD_SHORT.map(lbl => React.createElement('div', { key: lbl, style: { height: HEAT_CELL, display: "flex", alignItems: "center", fontSize: 9, fontWeight: REG, color: "var(--muted)", lineHeight: 1 } }, lbl))
                ),
                React.createElement('div', { style: { position: "relative", display: "flex", gap: HEAT_GAP } },
                  heat.weeks.map((week, wi) => React.createElement('div', { key: wi, style: { display: "flex", flexDirection: "column", gap: HEAT_GAP } },
                    week.map(cell => {
                      const shadow = sel && sel.iso === cell.iso ? "0 0 0 1.5px #58EBE1" : "none";
                      return React.createElement('button', { key: cell.iso, type: "button",
                        onClick: cell.future ? undefined : () => setSel(s => s && s.iso === cell.iso ? null : { iso: cell.iso, count: cell.count }),
                        style: { width: HEAT_CELL, height: HEAT_CELL, borderRadius: 3, border: "none", padding: 0, cursor: cell.future ? "default" : "pointer", background: cell.future ? "transparent" : heatCell(cell.count), boxShadow: shadow } });
                    })
                  ))
                )
              )
            )
          )
    ),

    // Hit rate — premium visual
    React.createElement(Card, { style: { padding: "9px 12px" } },
      React.createElement('div', { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10 } },
        React.createElement('div', { style: { position: "relative", width: 46, height: 46, flexShrink: 0 } },
          React.createElement('svg', { width: 46, height: 46, viewBox: "0 0 44 44", style: { transform: "rotate(-90deg)" } },
            React.createElement('circle', { cx: 22, cy: 22, r: 18, fill: "none", stroke: "rgba(255,255,255,.07)", strokeWidth: 4 }),
            React.createElement('circle', { cx: 22, cy: 22, r: 18, fill: "none", stroke: "#58EBE1", strokeWidth: 4, strokeLinecap: "round", strokeDasharray: hitRateStroke, strokeDashoffset: hitRateStroke * (1 - (hitRatePct / 100)) })
          ),
          React.createElement('div', { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: MED, color: "var(--text)" } }, `${hitRatePct}%`)
        ),
        React.createElement('div', { style: { minWidth: 0, fontSize: 12, fontWeight: REG, color: "var(--text)", lineHeight: 1.3 } }, `Hit target in ${agg.targetHitMonths} of ${agg.targetEligibleMonths} months.`)
      )
    ),

    // Workouts by day — best day cyan, worst day muted red, rest neutral
    React.createElement(Card, { style: { padding: "12px 14px" } },
      React.createElement('div', { style: { fontSize: 13, fontWeight: MED, marginBottom: 10, textAlign: "center" } }, `${owns} Workouts by Day`),
      React.createElement('div', { style: { display: "flex", flexDirection: "column", gap: 7 } },
        [1,2,3,4,5,6,0].map((idx, i) => {
          const count = agg.weekday[idx];
          const pct = agg.anyLogs ? Math.max(count > 0 ? 3 : 0, Math.round((count / dowMax) * 100)) : 0;
          const fill = idx === agg.bestIdx ? "#4ECDC4" : idx === agg.worstIdx ? "rgba(212,74,74,.7)" : "rgba(120,150,145,.4)";
          return React.createElement('div', { key: idx, style: { display: "flex", alignItems: "center", gap: 10 } },
            React.createElement('span', { style: { width: 30, fontSize: 11, fontWeight: REG, color: "var(--muted)", flexShrink: 0 } }, WD_SHORT[i]),
            React.createElement('div', { style: { flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,.05)", overflow: "hidden" } },
              React.createElement('div', { style: { width: `${pct}%`, height: "100%", borderRadius: 4, background: fill } })
            ),
            React.createElement('span', { style: { width: 22, fontSize: 12, fontWeight: MED, color: "var(--text)", textAlign: "right", flexShrink: 0 } }, count)
          );
        })
      )
    ),

    // Workout mix — lifetime, cross-Bloc (History-style bars; favourite highlighted)
    React.createElement(Card, { style: { padding: "12px 13px" } },
      React.createElement('div', { style: { marginBottom: 10, textAlign: "center" } },
        React.createElement('div', { style: { fontSize: 13, fontWeight: MED } }, `${owns} Workout Mix`)
      ),
      mixTotal === 0
        ? React.createElement('div', { style: { color: "var(--muted)", fontSize: 13, fontWeight: REG, textAlign: "center", padding: "12px 0" } }, "No workouts logged yet.")
        : React.createElement('div', { style: { display: "flex", gap: 6, alignItems: "stretch" } },
            mixSorted.map(t => {
              const count = agg.typeMix[t] || 0;
              const pct = mixTotal > 0 ? (count > 0 ? Math.max(1, Math.round((count / mixTotal) * 100)) : 0) : 0;
              const barH = Math.max(count > 0 ? 6 : 0, Math.round((count / mixMax) * 56));
              const isTop = count === mixMax && count > 0;
              return React.createElement('div', { key: t, style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 } },
                React.createElement('span', { style: { fontSize: 9.5, fontWeight: REG, color: count > 0 ? "var(--muted)" : "var(--muted2)", height: 16, display: "flex", alignItems: "center" } }, count > 0 ? `${pct}%` : ""),
                React.createElement('div', { style: { width: "100%", height: 56, display: "flex", alignItems: "flex-end" } },
                  React.createElement('div', { style: { width: "100%", height: barH, background: count > 0 ? (isTop ? "#4ECDC4" : "rgba(78,205,196,.28)") : "var(--border)", borderRadius: "3px 3px 0 0", opacity: count > 0 ? 1 : .3 } })
                ),
                React.createElement('span', { style: { width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#4ECDC4" } }, React.createElement(WorkoutTypeIcon, { type: t, size: 16 })),
                React.createElement('span', { style: { fontSize: 10, fontWeight: REG, color: "var(--muted)" } }, t),
                React.createElement('span', { style: { fontSize: 11, fontWeight: MED, color: count > 0 ? "var(--text)" : "var(--muted2)" } }, count)
              );
            })
          )
    )
  );
};

export { ProfileStatsPanel };
