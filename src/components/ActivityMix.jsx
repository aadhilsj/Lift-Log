import React from "react";
import { WorkoutTypeIcon, Bar, ModalScrim } from "./primitives.jsx";
import { ACTIVITIES } from "../lib/activities.js";
import { WORKOUT_TYPES } from "../lib/appState.js";

const { useState } = React;

const VISIBLE_ACTIVITIES = 5;

// Per-activity counts as a five-column bar chart, with "See All" opening every
// logged activity. Shared by the profile Workout Mix and the History page
// distribution; `variant` keeps each one's existing look.
const VARIANTS = {
  profile: {
    pct: { fontSize: 9.5, fontWeight: 400 },
    topBar: "#4ECDC4",
    restBar: "rgba(78,205,196,.28)",
    label: { fontSize: 10, fontWeight: 400 },
    count: { fontSize: 11, fontWeight: 500 },
    countClass: undefined,
    empty: { fontWeight: 400 }
  },
  history: {
    pct: { fontFamily: "'Outfit', sans-serif", fontSize: 9.5, fontWeight: 700 },
    topBar: "rgba(78, 205, 196, 0.5)",
    restBar: "#0D2828",
    label: { fontSize: 10, fontWeight: 600 },
    count: { fontSize: 11, fontWeight: 700 },
    countClass: "mono",
    empty: {}
  }
};

// Activities in list order; older category-only names (Sports) after them.
const listOrder = name => {
  const index = ACTIVITIES.findIndex(activity => activity.name === name);
  return index === -1 ? ACTIVITIES.length + WORKOUT_TYPES.indexOf(name) : index;
};

function sortActivityCounts(counts) {
  return Object.keys(counts || {})
    .filter(name => (counts[name] || 0) > 0)
    .sort((a, b) => (counts[b] - counts[a]) || (listOrder(a) - listOrder(b)));
}

const ActivityMix = ({ title, counts, variant = "profile", titleStyle = {} }) => {
  const [showAll, setShowAll] = useState(false);
  const look = VARIANTS[variant] || VARIANTS.profile;
  const all = sortActivityCounts(counts);
  const total = all.reduce((sum, name) => sum + counts[name], 0);
  const max = Math.max(...all.map(name => counts[name]), 1);
  const pctOf = count => total > 0 && count > 0 ? Math.max(1, Math.round((count / total) * 100)) : 0;
  const hasMore = all.length > VISIBLE_ACTIVITIES;

  return React.createElement(React.Fragment, null,
    // "See All" sits on the title line so it adds no height to the card.
    React.createElement('div', { style: { position: "relative", marginBottom: 10, textAlign: "center" } },
      React.createElement('div', { style: { fontSize: 13, ...titleStyle } }, title),
      hasMore ? React.createElement('button', {
        type: "button",
        onClick: () => setShowAll(true),
        style: { position: "absolute", right: -4, top: "50%", transform: "translateY(-50%)", padding: "4px 6px", background: "transparent", border: "none", color: "#4ECDC4", fontSize: 10.5, fontWeight: 600, lineHeight: 1 }
      }, "See All") : null
    ),
    total === 0
      ? React.createElement('div', { style: { color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "12px 0", ...look.empty } }, "No workouts logged yet.")
      : React.createElement('div', { style: { display: "flex", gap: 6, alignItems: "stretch", justifyContent: "center" } },
          all.slice(0, VISIBLE_ACTIVITIES).map(name => {
            const count = counts[name];
            const barH = Math.max(6, Math.round((count / max) * 56));
            return React.createElement('div', { key: name, style: { flex: `0 0 calc((100% - ${6 * (VISIBLE_ACTIVITIES - 1)}px) / ${VISIBLE_ACTIVITIES})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 } },
              React.createElement('span', { style: { ...look.pct, color: "var(--muted)", height: 16, display: "flex", alignItems: "center" } }, `${pctOf(count)}%`),
              React.createElement('div', { style: { width: "100%", height: 56, display: "flex", alignItems: "flex-end" } },
                React.createElement('div', { style: { width: "100%", height: barH, background: count === max ? look.topBar : look.restBar, borderRadius: "3px 3px 0 0" } })
              ),
              React.createElement('span', { style: { width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#4ECDC4" } }, React.createElement(WorkoutTypeIcon, { type: name, size: 16 })),
              React.createElement('span', { style: { ...look.label, color: "var(--muted)", maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, name),
              React.createElement('span', { className: look.countClass, style: { ...look.count, color: "var(--text)" } }, count)
            );
          })
        ),
    showAll ? React.createElement(ModalScrim, { onClose: () => setShowAll(false) },
      React.createElement('div', {
        className: "modal pi",
        role: "dialog",
        "aria-label": title,
        onClick: event => event.stopPropagation(),
        style: { width: "min(360px, calc(100vw - 32px))", maxHeight: "min(72vh, 560px)", display: "flex", flexDirection: "column", padding: "16px 14px 14px" }
      },
        React.createElement('div', { style: { textAlign: "center", marginBottom: 12 } },
          React.createElement('div', { style: { fontSize: 15, fontWeight: 800 } }, title),
          React.createElement('div', { style: { fontSize: 11, color: "var(--muted)", marginTop: 2 } }, `${total} workout${total === 1 ? "" : "s"} · ${all.length} activities`)
        ),
        React.createElement('div', { style: { overflowY: "auto", display: "grid", gap: 9, paddingRight: 2 } },
          all.map((name, index) => React.createElement('div', { key: name, style: { display: "grid", gridTemplateColumns: "22px 100px minmax(0,1fr) auto", alignItems: "center", columnGap: 10 } },
            React.createElement('span', { style: { width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#4ECDC4" } }, React.createElement(WorkoutTypeIcon, { type: name, size: 16 })),
            React.createElement('span', { style: { fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, name),
            React.createElement(Bar, { value: counts[name], max, color: index === 0 ? "#4ECDC4" : "#1E4040", h: 4 }),
            React.createElement('span', { style: { display: "inline-flex", alignItems: "baseline", gap: 6, justifyContent: "flex-end", minWidth: 58 } },
              React.createElement('span', { style: { fontSize: 13, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" } }, counts[name]),
              React.createElement('span', { style: { fontSize: 10.5, color: "var(--muted)", fontVariantNumeric: "tabular-nums", minWidth: 28, textAlign: "right" } }, `${pctOf(counts[name])}%`)
            )
          ))
        ),
        React.createElement('button', {
          type: "button",
          onClick: () => setShowAll(false),
          style: { marginTop: 14, width: "100%", padding: "9px", borderRadius: 10, background: "var(--s2)", border: "1px solid var(--border)", color: "var(--muted)", fontSize: 12, fontWeight: 700 }
        }, "Close")
      )
    ) : null
  );
};

export { ActivityMix, sortActivityCounts };
