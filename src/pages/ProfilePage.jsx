import React from "react";
const { useState } = React;
import {
  DEFAULT_CURRENCY,
  MIN_TARGET,
  calcPenalties,
  getLoserAmount,
  getCountedLogs,
  fmtCurrency
} from "../lib/appState.js";
import { Avatar, Card, AppIcon } from "../components/primitives.jsx";

// Premium block (P&L card, heatmap, day-of-week distribution, second stat row).
// Built fully & shown to everyone now. Flip this to add the paywall later
// without a rebuild — the single switch point, mirroring the History screen.
const PROFILE_PREMIUM_GATE = false; // eslint-disable-line no-unused-vars

const FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const isoOf = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const dayIso = s => { const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(s || "")); return m ? m[1] : null; };
const sinceLabel = ts => {
  const d = ts ? new Date(ts) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${FULL_MONTH_NAMES[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
};

// Brand font system: inherited sans-serif, two weights only — 400 and 500.
const REG = 400, MED = 500;

const ProfilePage = ({ visibleGroups = [], currentUserId, displayName, email, accountCreatedAt, onBack, onEditName, onSignOut, onDeleteAccount }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const myGroups = (visibleGroups || []).map(g => {
    const mem = Object.values(g.memberships || {}).find(m => m.userId === currentUserId);
    return mem ? { group: g, myName: mem.displayName, joinedAt: mem.joinedAt, currency: g.settings?.currency || DEFAULT_CURRENCY } : null;
  }).filter(Boolean);

  const agg = (() => {
    let workoutsLogged = 0, blocWins = 0, bestMonthEver = 0, earliestJoined = null;
    const pnlByCurrency = {}, logsByDate = {}, weekday = [0,0,0,0,0,0,0], groupTotals = [];
    const addDates = logs => logs.forEach(l => {
      const iso = dayIso(l.date);
      if (!iso) return;
      logsByDate[iso] = (logsByDate[iso] || 0) + 1;
      const wd = new Date(`${iso}T00:00:00`).getDay();
      if (wd >= 0 && wd <= 6) weekday[wd] += 1;
    });
    myGroups.forEach(({ group, myName, currency, joinedAt }) => {
      const jt = Date.parse(joinedAt || "");
      if (Number.isFinite(jt) && (earliestJoined === null || jt < earliestJoined)) earliestJoined = jt;
      const curLogs = getCountedLogs(group.logs?.[myName] || []);
      workoutsLogged += curLogs.length;
      addDates(curLogs);
      bestMonthEver = Math.max(bestMonthEver, curLogs.length);
      let groupTotal = curLogs.length, groupNet = 0;
      (group.monthHistory || []).forEach(m => {
        const histLogs = getCountedLogs(m.logsByUser?.[myName] || []);
        workoutsLogged += histLogs.length;
        groupTotal += histLogs.length;
        addDates(histLogs);
        bestMonthEver = Math.max(bestMonthEver, Number(m.counts?.[myName] || histLogs.length) || 0);
        const activeCounts = Object.keys(m.counts || {})
          .filter(n => !m.excused?.[n])
          .map(n => ({ name: n, count: Number(m.counts[n] || 0), target: m.memberTargets?.[n] || m.settings?.minTarget || MIN_TARGET }));
        const penalties = calcPenalties(activeCounts, m.settings || {});
        if (penalties.winners.find(w => w.name === myName)) { blocWins += 1; groupNet += penalties.perWinner; }
        if (penalties.losers.find(l => l.name === myName)) { groupNet -= getLoserAmount(penalties, myName); }
      });
      pnlByCurrency[currency] = (pnlByCurrency[currency] || 0) + groupNet;
      groupTotals.push({ name: group.name, total: groupTotal });
    });

    const topBloc = groupTotals.slice().sort((a, b) => b.total - a.total)[0];
    const anyLogs = Object.keys(logsByDate).length > 0;
    const bestDay = anyLogs ? WEEKDAYS[weekday.indexOf(Math.max(...weekday))] : "—";
    const worstDay = anyLogs ? WEEKDAYS[weekday.indexOf(Math.min(...weekday))] : "—";

    return { workoutsLogged, blocWins, bestMonthEver, earliestJoined, pnlByCurrency, weekday,
      topBloc: topBloc?.total ? topBloc.name : "—", bestDay, worstDay, logsByDate, anyLogs };
  })();

  const since = sinceLabel(accountCreatedAt) || sinceLabel(agg.earliestJoined);

  // ── heatmap (interim — a redesign is pending) ──────────────────────────────
  const heatCell = c => c <= 0 ? "rgba(255,255,255,.045)" : c === 1 ? "rgba(78,205,196,.3)" : c === 2 ? "rgba(78,205,196,.52)" : c === 3 ? "rgba(78,205,196,.74)" : "#4ECDC4";
  const heat = (() => {
    const isoKeys = Object.keys(agg.logsByDate).sort();
    if (!isoKeys.length) return { weeks: [], monthCols: [] };
    const start = new Date(`${isoKeys[0]}T00:00:00`);
    start.setDate(start.getDate() - start.getDay());
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weeks = [], monthCols = [];
    const cursor = new Date(start);
    let col = 0, lastMonth = -1;
    while (cursor <= today) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const iso = isoOf(cursor);
        week.push({ iso, count: agg.logsByDate[iso] || 0, future: cursor > today });
        if (cursor.getDate() <= 7 && cursor.getMonth() !== lastMonth) { monthCols.push({ col, label: FULL_MONTH_NAMES[cursor.getMonth()].slice(0, 3) }); lastMonth = cursor.getMonth(); }
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
      col += 1;
    }
    return { weeks, monthCols };
  })();

  // ── shared card bits ───────────────────────────────────────────────────────
  const statLabel = { display: "block", fontSize: 8.5, fontWeight: MED, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3, textAlign: "center", width: "100%" };
  const statVal = extra => ({ fontSize: 17, fontWeight: MED, lineHeight: 1.06, textAlign: "center", width: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...extra });
  const statSub = { fontSize: 8.5, fontWeight: REG, color: "var(--muted)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "center", width: "100%" };
  const statCard = (label, valNode, sub) => React.createElement(Card, { key: label, style: { padding: "9px 6px", display: "flex", flexDirection: "column", alignItems: "center" } },
    React.createElement('span', { style: statLabel }, label),
    valNode,
    sub ? React.createElement('div', { style: statSub }, sub) : null
  );

  // ── lifetime P&L (per-currency, no FX blend) ───────────────────────────────
  const pnlEntries = Object.entries(agg.pnlByCurrency);
  const sortedPnl = pnlEntries.slice().sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const singleCurrency = pnlEntries.length <= 1;
  const soleCur = pnlEntries[0]?.[0] || myGroups[0]?.currency || DEFAULT_CURRENCY;
  const soleNet = pnlEntries[0]?.[1] || 0;
  const money = (net, cur) => net === 0 ? fmtCurrency(0, cur) : `${net > 0 ? "+" : "-"}${fmtCurrency(Math.abs(net), cur)}`;
  const moneyColor = net => net > 0 ? "var(--green)" : net < 0 ? "var(--red)" : "var(--text)";

  const accountRows = [
    { label: "Email", value: email || "—", kind: "display" },
    { label: "Sign out", kind: "action", tone: "muted", onClick: onSignOut },
    { label: "Delete account", kind: "action", tone: "red", onClick: () => { setDeleteError(""); setConfirmDelete(true); } }
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
      statCard("Workouts", React.createElement('div', { style: statVal({ color: "#4ECDC4" }) }, agg.workoutsLogged || 0), "logged all-time"),
      statCard("Blocs", React.createElement('div', { style: statVal({ color: "var(--text)" }) }, myGroups.length), "joined"),
      statCard("Bloc wins", React.createElement('div', { style: statVal({ color: "var(--text)" }) }, agg.blocWins || 0), "months won")
    ),

    // ── Premium block (PROFILE_PREMIUM_GATE) — all built & visible now ─────────
    React.createElement('div', { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 4 } },
      React.createElement('div', { style: { height: 1, flex: 1, background: "rgba(245,166,35,.18)" } }),
      React.createElement('span', { style: { fontSize: 9.5, fontWeight: MED, color: "#F5A623", textTransform: "uppercase", letterSpacing: ".12em" } }, "Premium · All-time"),
      React.createElement('div', { style: { height: 1, flex: 1, background: "rgba(245,166,35,.18)" } })
    ),

    // Lifetime P&L — own full-width card
    React.createElement(Card, { style: { padding: "13px 15px" } },
      React.createElement('span', { style: { display: "block", fontSize: 8.5, fontWeight: MED, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: singleCurrency ? 6 : 9 } }, "Lifetime P&L"),
      singleCurrency
        ? React.createElement('div', { style: { fontSize: 26, fontWeight: MED, color: moneyColor(soleNet) } }, money(soleNet, soleCur))
        : React.createElement('div', { style: { display: "flex", flexDirection: "column", gap: 7 } },
            sortedPnl.map(([cur, net]) => React.createElement('div', { key: cur, style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 } },
              React.createElement('span', { style: { fontSize: 12.5, fontWeight: REG, color: "var(--muted)" } }, cur),
              React.createElement('span', { style: { fontSize: 16, fontWeight: MED, color: moneyColor(net) } }, money(net, cur))
            ))
          )
    ),

    // Heatmap card (interim — redesign pending)
    React.createElement(Card, { style: { padding: "12px 13px" } },
      React.createElement('div', { style: { fontSize: 13, fontWeight: MED, marginBottom: 10 } }, "Workout heatmap"),
      !agg.anyLogs
        ? React.createElement('div', { style: { color: "var(--muted)", fontSize: 13, fontWeight: REG, textAlign: "center", padding: "16px 0" } }, "No workouts logged yet.")
        : React.createElement('div', { style: { overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 4 } },
            React.createElement('div', { style: { minWidth: "max-content" } },
              React.createElement('div', { style: { position: "relative", height: 12, marginBottom: 3 } },
                heat.monthCols.map(mc => React.createElement('span', { key: `${mc.col}-${mc.label}`, style: { position: "absolute", left: mc.col * 14, fontSize: 8.5, fontWeight: REG, color: "var(--muted)" } }, mc.label))
              ),
              React.createElement('div', { style: { display: "flex", gap: 3 } },
                heat.weeks.map((week, wi) => React.createElement('div', { key: wi, style: { display: "flex", flexDirection: "column", gap: 3 } },
                  week.map(cell => React.createElement('div', { key: cell.iso, title: `${cell.iso}: ${cell.count}`, style: { width: 11, height: 11, borderRadius: 2, background: cell.future ? "transparent" : heatCell(cell.count) } }))
                ))
              )
            )
          )
    ),

    // Second stat row — four cards, single row
    React.createElement('div', { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 } },
      statCard("Best month", React.createElement('div', { style: statVal({ color: "var(--text)" }) }, agg.bestMonthEver || 0), "workouts"),
      statCard("Top Bloc", React.createElement('div', { style: statVal({ color: "var(--text)", fontSize: 13 }) }, agg.topBloc), "most logged"),
      statCard("Best day", React.createElement('div', { style: statVal({ color: "var(--text)", fontSize: 13 }) }, agg.bestDay), "most logs"),
      statCard("Worst day", React.createElement('div', { style: statVal({ color: "var(--text)", fontSize: 13 }) }, agg.worstDay), "fewest logs")
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
                React.createElement('button', { type: "button", disabled: deleting, onClick: async () => { setDeleting(true); setDeleteError(""); const r = await onDeleteAccount?.(); if (r && !r.ok) { setDeleteError(r.error || "Unable to delete account"); setDeleting(false); } }, style: { flex: 1, background: "var(--red-dim)", border: "1px solid rgba(212,74,74,.35)", color: "var(--red)", padding: "10px", borderRadius: 9, fontSize: 12, fontWeight: MED, cursor: "pointer" } }, deleting ? "Deleting..." : "Delete account")
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
