import React from "react";
import { createPortal } from "react-dom";

// The notification centre sheet. Same shape as the Settlement Reminders sheet
// so it reads as a part of the app rather than a new pattern: centred panel,
// scrim, title and a count, scrolls once there is more than a screenful.

const FONTS = { display: "'Raleway', sans-serif", body: "'Outfit', sans-serif" };

const TONES = {
  ask:      { edge: "rgba(78,205,196,.34)",  wash: "rgba(78,205,196,.05)",  glyph: "#4ECDC4" },
  money:    { edge: "rgba(224,98,90,.28)",   wash: "rgba(224,98,90,.045)",  glyph: "#E0625A" },
  reaction: { edge: "#17302D",               wash: "transparent",           glyph: "#B8C7C4" },
  comment:  { edge: "#17302D",               wash: "transparent",           glyph: "#B8C7C4" }
};

// Drawn in the app's own line style, like AppIcon, rather than a platform
// emoji: comments are the app speaking, and an iOS glyph looks borrowed.
const CommentMark = ({ size = 12 }) => React.createElement('svg', {
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round"
}, React.createElement('path', { d: "M20 14a3 3 0 01-3 3H8l-4 3V6a3 3 0 013-3h10a3 3 0 013 3z" }));

const MoneyMark = ({ size = 12, incoming }) => React.createElement('svg', {
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round",
  style: incoming ? { transform: "scaleX(-1)" } : undefined
}, React.createElement('path', { d: "M4 12h15" }), React.createElement('path', { d: "M14 7l5 5-5 5" }));

const AskMark = ({ size = 12 }) => React.createElement('svg', {
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round"
}, React.createElement('path', { d: "M4 20l4-1 10-10a2.5 2.5 0 10-3.5-3.5L4.5 15.5z" }));

const Row = ({ item, onAct }) => {
  const tone = TONES[item.kind] || TONES.reaction;
  const tappable = !!item.opens;
  return React.createElement('button', {
    type: "button",
    disabled: !tappable,
    onClick: tappable ? () => onAct(item) : undefined,
    style: {
      width: "100%", textAlign: "left", cursor: tappable ? "pointer" : "default",
      border: `0.5px solid ${tone.edge}`, background: tone.wash === "transparent" ? "#0C1716" : tone.wash,
      borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 10,
      fontFamily: FONTS.body
    }
  },
    React.createElement('span', { "aria-hidden": true, style: {
      width: 22, height: 22, flex: "none", borderRadius: 999, display: "grid", placeItems: "center",
      fontSize: 11, color: tone.glyph, background: "rgba(255,255,255,.04)"
    } },
      item.kind === "comment" ? React.createElement(CommentMark, null)
      : item.kind === "money" ? React.createElement(MoneyMark, { incoming: !item.pinned })
      : item.kind === "ask" ? React.createElement(AskMark, null)
      : item.glyph
    ),
    React.createElement('span', { style: { minWidth: 0, flex: 1, display: "grid", gap: 2 } },
      React.createElement('span', { style: { fontSize: 12.5, fontWeight: 600, color: "var(--text)", lineHeight: 1.3 } }, item.title),
      item.body && React.createElement('span', { style: { fontSize: 11, color: "#89A39E", lineHeight: 1.35 } }, item.body),
      item.meta && React.createElement('span', { style: { fontSize: 9.5, color: "#6B9690" } }, item.meta)
    ),
    item.pinned && React.createElement('span', { style: {
      flex: "none", fontSize: 8, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase",
      color: tone.glyph, paddingTop: 3
    } }, item.kind === "ask" ? "Do this" : "Open")
  );
};

export const NotificationCentre = ({ items = [], onClose, onAct }) => {
  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    const body = document.body;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    const onKey = event => { if (event.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => { body.style.overflow = previous; document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const pinned = items.filter(item => item.pinned);
  const rest = items.filter(item => !item.pinned);

  const panel = React.createElement('div', {
    className: "overlay center-mobile",
    onClick: onClose,
    style: { zIndex: 150 }
  },
    React.createElement('div', {
      onClick: event => event.stopPropagation(),
      style: {
        width: "100%", maxWidth: 360, maxHeight: "min(80vh, 640px)", display: "flex", flexDirection: "column",
        background: "var(--s1)", border: "0.5px solid var(--border2, #173332)", borderRadius: 20, overflow: "hidden"
      }
    },
      React.createElement('div', { style: {
        padding: "14px 16px 11px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10
      } },
        React.createElement('span', { style: { fontFamily: FONTS.display, fontSize: 15, fontWeight: 800, color: "var(--text)" } }, "For you"),
        React.createElement('button', {
          type: "button", onClick: onClose, "aria-label": "Close",
          style: { background: "transparent", border: "none", color: "#6B9690", fontSize: 16, cursor: "pointer", padding: "0 2px", lineHeight: 1 }
        }, "✕")
      ),
      React.createElement('div', { ref: scrollRef, style: { padding: "12px 14px 16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 } },
        items.length === 0 && React.createElement('div', { style: {
          fontFamily: FONTS.body, fontSize: 12, color: "#6B9690", textAlign: "center", padding: "26px 8px", lineHeight: 1.5
        } }, "Nothing for you right now.", React.createElement('br'), "Reactions, comments and anything you owe land here."),
        pinned.length > 0 && React.createElement('span', { style: {
          fontSize: 8.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#7DB8B1"
        } }, "Needs you"),
        pinned.map(item => React.createElement(Row, { key: item.id, item, onAct })),
        rest.length > 0 && pinned.length > 0 && React.createElement('span', { style: {
          fontSize: 8.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#6B9690", marginTop: 4
        } }, "Earlier"),
        rest.map(item => React.createElement(Row, { key: item.id, item, onAct }))
      )
    )
  );

  // Portalled: the pages sit inside a transformed swipe surface, and Safari
  // makes any transform the containing block for fixed children.
  return typeof document === "undefined" ? panel : createPortal(panel, document.body);
};
