import React from "react";
const { useState, useRef, useEffect } = React;
import {
  DEFAULT_CURRENCY,
  MIN_TARGET,
  WORKOUT_TYPES,
  calcPenalties,
  getLoserAmount,
  getCountedLogs,
  fmtCurrency
} from "../lib/appState.js";
import { Avatar, Card, AppIcon, WorkoutTypeIcon } from "../components/primitives.jsx";

// Premium block (everything under the "Premium" divider). Built fully
// & shown to everyone now. Flip this to add the paywall later without a rebuild —
// the single switch point, mirroring the History screen.
const PROFILE_PREMIUM_GATE = false; // eslint-disable-line no-unused-vars

const FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WD_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const isoOf = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const dayIso = s => { const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(s || "")); return m ? m[1] : null; };
const sinceLabel = ts => {
  const d = ts ? new Date(ts) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${FULL_MONTH_NAMES[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
};
const shortSinceLabel = ts => {
  const d = ts ? new Date(ts) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${FULL_MONTH_NAMES[d.getMonth()].slice(0,3)} '${String(d.getFullYear()).slice(2)}`;
};

// Brand font system: inherited sans-serif, two weights only — 400 and 500.
const REG = 400, MED = 500;

const ProfilePage = ({ visibleGroups = [], currentUserId, displayName, email, accountCreatedAt, onBack, onEditName, onSignOut, onDeleteAccount }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [sel, setSel] = useState(null); // tapped heatmap day { iso, count }
  const heatScrollRef = useRef(null);
  // Open the heatmap scrolled to today (data's most relevant end), not the join date.
  useEffect(() => { const el = heatScrollRef.current; if (el) el.scrollLeft = el.scrollWidth; }, []);

  const myGroups = (visibleGroups || []).map(g => {
    const mem = Object.values(g.memberships || {}).find(m => m.userId === currentUserId);
    return mem ? { group: g, myName: mem.displayName, joinedAt: mem.joinedAt, currency: g.settings?.currency || DEFAULT_CURRENCY } : null;
  }).filter(Boolean);

  const agg = (() => {
    let blocWins = 0, earliestJoined = null, earliestWorkout = null;
    const pnlByCurrency = {}, dayTypeMax = {};
    myGroups.forEach(({ group, myName, currency, joinedAt }) => {
      const jt = Date.parse(joinedAt || "");
      if (Number.isFinite(jt) && (earliestJoined === null || jt < earliestJoined)) earliestJoined = jt;
      // Per-day, per-type counts WITHIN this Bloc (real workouts, incl. 2-a-days).
      const groupDayType = {};
      const tally = logs => logs.forEach(l => {
        const iso = dayIso(l.date); if (!iso) return;
        const ts = Date.parse(`${iso}T00:00:00`);
        if (Number.isFinite(ts) && (earliestWorkout === null || ts < earliestWorkout)) earliestWorkout = ts;
        const t = l.type || "Other";
        if (!groupDayType[iso]) groupDayType[iso] = {};
        groupDayType[iso][t] = (groupDayType[iso][t] || 0) + 1;
      });
      const curLogs = getCountedLogs(group.logs?.[myName] || []);
      tally(curLogs);
      let groupNet = 0;
      (group.monthHistory || []).forEach(m => {
        const histLogs = getCountedLogs(m.logsByUser?.[myName] || []);
        tally(histLogs);
        const activeCounts = Object.keys(m.counts || {})
          .filter(n => !m.excused?.[n])
          .map(n => ({ name: n, count: Number(m.counts[n] || 0), target: m.memberTargets?.[n] || m.settings?.minTarget || MIN_TARGET }));
        const penalties = calcPenalties(activeCounts, m.settings || {});
        if (penalties.winners.find(w => w.name === myName)) { blocWins += 1; groupNet += penalties.perWinner; }
        if (penalties.losers.find(l => l.name === myName)) { groupNet -= getLoserAmount(penalties, myName); }
      });
      // Merge into the cross-Bloc max: the same session logged in several Blocs
      // collapses (max), while genuine multiple workouts on a day survive.
      Object.entries(groupDayType).forEach(([iso, types]) => {
        if (!dayTypeMax[iso]) dayTypeMax[iso] = {};
        Object.entries(types).forEach(([t, c]) => { dayTypeMax[iso][t] = Math.max(dayTypeMax[iso][t] || 0, c); });
      });
      pnlByCurrency[currency] = (pnlByCurrency[currency] || 0) + groupNet;
    });

    const logsByDate = {}, weekday = [0,0,0,0,0,0,0], typeMix = {};
    WORKOUT_TYPES.forEach(t => { typeMix[t] = 0; });
    let workoutsLogged = 0;
    Object.entries(dayTypeMax).forEach(([iso, types]) => {
      const n = Object.values(types).reduce((a, b) => a + b, 0);
      logsByDate[iso] = n;
      workoutsLogged += n;
      weekday[new Date(`${iso}T00:00:00`).getDay()] += n;
      Object.entries(types).forEach(([t, c]) => { typeMix[t] = (typeMix[t] || 0) + c; });
    });

    const anyLogs = Object.keys(logsByDate).length > 0;
    const wmax = Math.max(...weekday), wmin = Math.min(...weekday);
    const bestIdx = anyLogs && wmax > 0 ? weekday.indexOf(wmax) : -1;
    const worstIdx = anyLogs && wmax > wmin ? weekday.indexOf(wmin) : -1;
    const favType = Object.entries(typeMix).sort((a, b) => b[1] - a[1])[0];
    return { workoutsLogged, blocWins, earliestJoined, earliestWorkout, pnlByCurrency, weekday,
      bestIdx, worstIdx, typeMix, favType: favType && favType[1] > 0 ? favType[0] : "—",
      logsByDate, anyLogs };
  })();

  const profileStartTs = agg.earliestWorkout || agg.earliestJoined || Date.parse(accountCreatedAt || "") || null;
  const since = sinceLabel(profileStartTs);
  const sinceShort = shortSinceLabel(profileStartTs);

  // ── heatmap — Mon→Sun rows, from the join date through today (multi-year). ──
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
        if (cursor.getDate() === 1) monthCols.push({ col, label: FULL_MONTH_NAMES[cursor.getMonth()].slice(0, 3) });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
      col += 1;
    }
    if (!monthCols.length || monthCols[0].col > 0) monthCols.unshift({ col: 0, label: FULL_MONTH_NAMES[start.getMonth()].slice(0, 3) });
    return { weeks, monthCols, yearCols };
  })();
  const dayDetail = (() => {
    if (!sel) return null;
    const d = new Date(`${sel.iso}T00:00:00`);
    const lbl = d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
    return `${lbl} · ${sel.count} ${sel.count === 1 ? "workout" : "workouts"}`;
  })();
  const dowMax = Math.max(...agg.weekday, 1);

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

  // ── lifetime take (hero; per-currency, no FX blend, no zero amounts) ────────
  const money = (net, cur) => fmtCurrency(Math.abs(net), cur);
  const moneyColor = net => net > 0 ? "var(--green)" : net < 0 ? "var(--red)" : "var(--text)";
  const pnlNonzero = Object.entries(agg.pnlByCurrency).filter(([, n]) => n !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const hasPnl = pnlNonzero.length > 0;
  const [primCur, primNet] = hasPnl ? pnlNonzero[0] : [null, 0];
  const secondaryPnl = pnlNonzero.slice(1);

  // ── workout mix (all-time, cross-Bloc) ─────────────────────────────────────
  const mixSorted = [...WORKOUT_TYPES].sort((a, b) => (agg.typeMix[b] || 0) - (agg.typeMix[a] || 0) || WORKOUT_TYPES.indexOf(a) - WORKOUT_TYPES.indexOf(b));
  const mixTotal = WORKOUT_TYPES.reduce((s, t) => s + (agg.typeMix[t] || 0), 0);
  const mixMax = Math.max(...WORKOUT_TYPES.map(t => agg.typeMix[t] || 0), 1);

  const accountRows = [
    { label: "Email", value: email || "—", kind: "display" },
    { label: "Sign Out", kind: "action", tone: "muted", onClick: onSignOut },
    { label: "Delete Account", kind: "action", tone: "red", onClick: () => { setDeleteError(""); setConfirmDelete(true); } }
  ];

  return React.createElement('div', { style: { maxWidth: 640, margin: "0 auto", padding: "10px 14px 40px", display: "flex", flexDirection: "column", gap: 14 } },
    // Header
    React.createElement('div', { style: { position: "relative", display: "flex", alignItems: "center", justifyContent: "center", height: 40, marginBottom: 2 } },
      React.createElement('button', { type: "button", onClick: onBack, "aria-label": "Back", style: { position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "var(--text)", cursor: "pointer", padding: 0 } },
        React.createElement(AppIcon, { name: "chevron-left", size: 20, stroke: "var(--text)" })),
      React.createElement('div', { style: { fontSize: 16, fontWeight: MED } }, "Profile")
    ),

    // Identity block — horizontal: avatar left, name + since stacked right
    React.createElement('div', { style: { display: "flex", alignItems: "center", gap: 14, padding: "2px 2px 4px" } },
      React.createElement(Avatar, { name: displayName || "?", size: 56 }),
      React.createElement('div', { style: { minWidth: 0 } },
        React.createElement('button', { type: "button", onClick: onEditName, style: { display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "var(--text)", maxWidth: "100%" } },
          React.createElement('span', { style: { fontSize: 20, fontWeight: MED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, displayName || "—"),
          React.createElement(AppIcon, { name: "edit", size: 14, stroke: "var(--muted)" })
        ),
        since ? React.createElement('div', { style: { fontSize: 12.5, fontWeight: REG, color: "var(--muted)", marginTop: 2 } }, `Ante-ing since ${since}`) : null
      )
    ),

    // Free tier — three stat cards, single row
    React.createElement('div', { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 } },
      statCard("Workouts", React.createElement('div', { style: statVal({ color: "#4ECDC4" }) }, agg.workoutsLogged || 0), null, { elevated: true, icon: React.createElement(WorkoutTypeIcon, { type: "Gym", size: 12 }) }),
      statCard("Groups", React.createElement('div', { style: statVal({ color: "var(--text)" }) }, myGroups.length), null, { elevated: true, icon: React.createElement(AppIcon, { name: "group", size: 12, stroke: "currentColor" }) }),
      statCard("Wins", React.createElement('div', { style: statVal({ color: "var(--text)" }) }, agg.blocWins || 0), null, { elevated: true, icon: React.createElement(AppIcon, { name: "trophy", size: 12, stroke: "currentColor" }) })
    ),

    // Lifetime balance — free card
    React.createElement(Card, { style: { padding: "14px 15px" } },
      React.createElement('span', { style: { display: "block", fontSize: 8.5, fontWeight: MED, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 7 } }, "Balance"),
      hasPnl
        ? React.createElement('div', { style: { fontSize: 14, fontWeight: REG, color: "var(--text)", lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } },
            primNet > 0
              ? React.createElement(React.Fragment, null, "Won ", React.createElement('span', { style: { color: moneyColor(primNet), fontWeight: MED } }, money(primNet, primCur)), " all-time.")
              : React.createElement(React.Fragment, null, "Down ", React.createElement('span', { style: { color: moneyColor(primNet), fontWeight: MED } }, money(primNet, primCur)), " all-time."),
            secondaryPnl.length
              ? React.createElement('div', { style: { fontSize: 11, fontWeight: REG, color: "var(--muted2)", marginTop: 5, lineHeight: 1.35 } }, secondaryPnl.map(([c, n]) => `${n > 0 ? "Won" : "Lost"} ${money(n, c)}`).join(" · "))
              : null
          )
        : React.createElement('div', { style: { fontSize: 14, fontWeight: REG, color: "var(--text)", lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, "Even all-time.")
    ),

    // ── Premium block (PROFILE_PREMIUM_GATE) — all built & visible now ─────────
    React.createElement('div', { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 4 } },
      React.createElement('div', { style: { height: 1, flex: 1, background: "rgba(245,166,35,.18)" } }),
      React.createElement('span', { style: { fontSize: 9.5, fontWeight: MED, color: "#F5A623", textTransform: "uppercase", letterSpacing: ".12em" } }, "Premium"),
      React.createElement('div', { style: { height: 1, flex: 1, background: "rgba(245,166,35,.18)" } })
    ),

    // Heatmap card
    React.createElement(Card, { style: { padding: "12px 13px" } },
      React.createElement('div', { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: dayDetail ? 6 : 10 } },
        React.createElement('div', { style: { fontSize: 14, fontWeight: MED } }, "Workout Heat Map")
      ),
      dayDetail ? React.createElement('div', { style: { fontSize: 11.5, fontWeight: REG, color: "var(--text)", marginBottom: 9 } }, dayDetail) : null,
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
                React.createElement('div', { style: { display: "flex", gap: HEAT_GAP } },
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

    // Workouts by day — best day cyan, worst day muted red, rest neutral
    React.createElement(Card, { style: { padding: "12px 14px" } },
      React.createElement('div', { style: { fontSize: 13, fontWeight: MED, marginBottom: 10 } }, "Workouts by Day"),
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
      React.createElement('div', { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 } },
        React.createElement('div', { style: { fontSize: 13, fontWeight: MED } }, "Workout Mix"),
        agg.favType !== "—" ? React.createElement('div', { style: { fontSize: 11, fontWeight: REG, color: "var(--muted)" } }, `Most: ${agg.favType}`) : null
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
    ),

    // Account section
    React.createElement('div', { style: { marginTop: 4 } },
      React.createElement('div', { style: { fontSize: 10, fontWeight: MED, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8, paddingLeft: 2 } }, "Account"),
      React.createElement(Card, { style: { overflow: "hidden" } },
        confirmDelete
          ? React.createElement('div', { style: { padding: "13px 15px" } },
              React.createElement('div', { style: { fontSize: 12.5, fontWeight: REG, color: "rgba(220,170,170,.85)", marginBottom: 12, lineHeight: 1.55 } }, "This will permanently delete your account and remove you from all Blocs. This cannot be undone."),
              deleteError ? React.createElement('div', { style: { fontSize: 11, fontWeight: REG, color: "var(--red)", marginBottom: 8 } }, deleteError) : null,
              React.createElement('div', { style: { display: "flex", gap: 8 } },
                React.createElement('button', { type: "button", onClick: () => { setConfirmDelete(false); setDeleteError(""); }, style: { flex: 1, background: "var(--s2)", border: "1px solid var(--border)", color: "var(--muted)", padding: "10px", borderRadius: 9, fontSize: 12, fontWeight: MED, cursor: "pointer" } }, "Cancel"),
                React.createElement('button', { type: "button", disabled: deleting, onClick: async () => { setDeleting(true); setDeleteError(""); const r = await onDeleteAccount?.(); if (r && !r.ok) { setDeleteError(r.error || "Unable to delete account"); setDeleting(false); } }, style: { flex: 1, background: "var(--red-dim)", border: "1px solid rgba(212,74,74,.35)", color: "var(--red)", padding: "10px", borderRadius: 9, fontSize: 12, fontWeight: MED, cursor: "pointer" } }, deleting ? "Deleting..." : "Delete Account")
              )
            )
          : accountRows.map((row, i) => {
              const border = i < accountRows.length - 1 ? "1px solid rgba(255,255,255,.055)" : "none";
              const valueColor = row.tone === "red" ? "rgba(212,74,74,.9)" : row.tone === "muted" ? "rgba(220,100,100,.7)" : "var(--muted)";
              if (row.kind === "display") {
                return React.createElement('div', { key: row.label, style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 15px", borderBottom: border } },
                  React.createElement('span', { style: { fontSize: 12.5, color: "var(--muted)", fontWeight: MED } }, row.label),
                  React.createElement('span', { style: { fontSize: 12.5, color: "var(--text)", fontWeight: REG, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, row.value)
                );
              }
              return React.createElement('button', { key: row.label, type: "button", onClick: row.onClick, style: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 15px", borderBottom: border, background: "transparent", border: "none", cursor: "pointer", textAlign: "left" } },
                React.createElement('span', { style: { fontSize: 13, color: valueColor, fontWeight: MED } }, row.label),
                React.createElement(AppIcon, { name: "chevron-right", size: 14, stroke: "var(--muted2)" })
              );
            })
      )
    )
  );
};

export { ProfilePage };
