import React from "react";
import { WorkoutTypeIcon, Card, AppIcon } from "./primitives.jsx";

// A month's workouts as a calendar grid, with an optional share affordance.
//
// This is the same shape as the share sticker: buildStickerData maps days to
// workout types and the sticker draws exactly that. Rendering it beside the
// share button means people can see what they are about to share instead of
// sharing something unseen.
//
// `compact` shrinks it for the settlement report, where it sits among other
// cards rather than being the focus.
const MonthCalendarCard = ({ title, logsByDay = {}, year, monthIndex, daysInMonth, firstWeekdayOffset, todayDay = null, compact = false, onShare, onDayClick }) => {
  const cell = compact ? 26 : 34;
  const gap = compact ? 2 : 3;
  const dayFont = compact ? 8.5 : 9;
  const iconSize = compact ? 12 : 15;

  const blanks = Array.from({ length: firstWeekdayOffset }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return React.createElement(Card, { style: { padding: compact ? "11px 12px" : "13px 14px" } },
    React.createElement('div', { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: compact ? 9 : 12 } },
      React.createElement('div', { style: { fontWeight: 800, fontSize: compact ? 12 : 14, fontFamily: "'Outfit',sans-serif" } }, title),
      onShare ? React.createElement('button', {
        type: "button",
        onClick: onShare,
        "aria-label": "Share this month",
        title: "Share this month",
        style: {
          display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
          padding: compact ? "5px 9px" : "6px 11px", borderRadius: 999, cursor: "pointer",
          background: "rgba(78,205,196,.1)", border: "1px solid rgba(78,205,196,.32)",
          color: "#4ECDC4", fontSize: compact ? 10 : 11, fontWeight: 800, fontFamily: "'Outfit',sans-serif"
        }
      },
        React.createElement(AppIcon, { name: "share", size: compact ? 11 : 12, stroke: "#4ECDC4" }),
        "Share"
      ) : null
    ),
    React.createElement('div', { style: { maxWidth: compact ? 274 : 336, margin: "0 auto" } },
      React.createElement('div', { style: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap, marginBottom: 4 } },
        ["M","T","W","T","F","S","S"].map((label, i) => React.createElement('div', {
          key: `${label}${i}`,
          style: { textAlign: "center", fontSize: dayFont, color: "var(--muted2)", fontFamily: "'Outfit',sans-serif", fontWeight: 600 }
        }, label))
      ),
      React.createElement('div', { style: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap } },
        blanks.map(i => React.createElement('div', { key: `b${i}` })),
        days.map(day => {
          const dayLogs = logsByDay[day] || [];
          const log = dayLogs[0] || null;
          const isToday = todayDay === day;
          return React.createElement('div', {
            key: day,
            onClick: onDayClick && dayLogs.length ? () => onDayClick(day, dayLogs) : undefined,
            style: {
              aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 5, fontSize: log ? dayFont + 2 : dayFont,
              fontFamily: log ? "inherit" : "'JetBrains Mono',monospace", fontWeight: log ? 700 : 400,
              background: log ? "#1A2E4A" : isToday ? "var(--s2)" : "transparent",
              color: log ? "#4ECDC4" : isToday ? "var(--text)" : "var(--muted)",
              border: isToday && !log ? "1px solid var(--border2)" : "1px solid transparent",
              cursor: onDayClick && dayLogs.length ? "pointer" : "default"
            }
          },
            log
              ? React.createElement('span', { style: { position: "relative", width: iconSize + 4, height: iconSize + 4, display: "inline-flex", alignItems: "center", justifyContent: "center" } },
                  React.createElement(WorkoutTypeIcon, { type: log.type, size: iconSize }),
                  dayLogs.length > 1 ? React.createElement('span', {
                    style: { position: "absolute", right: -4, top: -4, minWidth: 11, height: 11, padding: "0 2px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#4ECDC4", border: "1px solid #1A2E4A", color: "#071010", fontFamily: "'Outfit',sans-serif", fontSize: 7, fontWeight: 900, lineHeight: 1 }
                  }, Math.min(dayLogs.length, 2)) : null
                )
              : day
          );
        })
      )
    )
  );
};

export { MonthCalendarCard };
