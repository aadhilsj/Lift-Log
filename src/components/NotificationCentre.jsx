import React from "react";
import { createPortal } from "react-dom";

// The notification centre sheet. Same shape as the Settlement Reminders sheet
// so it reads as a part of the app rather than a new pattern: centred panel,
// scrim, title and a count, scrolls once there is more than a screenful.

const FONTS = { display: "'Raleway', sans-serif", body: "'Outfit', sans-serif" };

const TONES = {
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
    } }, "Open")
  );
};

export const NotificationCentre = ({ items = [], onClose, onAct }) => {
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

  // A full screen, not a card in the middle. The list is the whole point of
  // the screen, and a centred panel caps it at 80vh while leaving a strip of
  // the Bloc showing behind, which reads as a pop-up over the page rather than
  // a place you went to.
  const panel = React.createElement('div', {
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "For you",
    style: {
      position: "fixed", inset: 0, zIndex: 150,
      display: "flex", flexDirection: "column",
      // The app's own background, by its own tokens — the same two layers every
      // other screen paints, so this reads as part of the app rather than a
      // surface laid over it.
      //
      // It is deliberately NOT the Bloc Stream's background. That one centres
      // its teal glow at 16% down the screen, which on a full screen shows as
      // a bright band at the top fading to near-black at the bottom. The app's
      // own hint is centred at -10%, above the screen, so only its soft lower
      // edge is ever visible and the wash stays even.
      backgroundColor: "var(--bg-primary)",
      backgroundImage: "var(--bg-radial-hint), var(--bg-gradient)",
      // The notch on an installed PWA, and the home indicator at the bottom.
      paddingTop: "env(safe-area-inset-top)",
      paddingBottom: "env(safe-area-inset-bottom)",
      overscrollBehavior: "contain"
    }
  },
    React.createElement('div', { style: {
      padding: "15px 16px 13px", borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexShrink: 0
    } },
      React.createElement('span', { style: { fontFamily: FONTS.display, fontSize: 19, fontWeight: 800, color: "var(--text)" } }, "For you"),
      // 44px of target, without the glyph growing to match.
      React.createElement('button', {
        type: "button", onClick: onClose, "aria-label": "Close",
        style: {
          background: "transparent", border: "none", color: "#6B9690", fontSize: 18, cursor: "pointer",
          width: 44, height: 44, marginRight: -11, display: "inline-flex", alignItems: "center",
          justifyContent: "center", lineHeight: 1, padding: 0
        }
      }, "✕")
    ),
    React.createElement('div', { style: {
      flex: 1, minHeight: 0, padding: "14px 16px 24px", overflowY: "auto",
      WebkitOverflowScrolling: "touch", display: "flex", flexDirection: "column", gap: 8
    } },
      items.length === 0 && React.createElement('div', { style: {
        fontFamily: FONTS.body, fontSize: 13, color: "#6B9690", textAlign: "center",
        margin: "auto", padding: "0 16px", lineHeight: 1.5
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
  );

  // Portalled: the pages sit inside a transformed swipe surface, and Safari
  // makes any transform the containing block for fixed children.
  return typeof document === "undefined" ? panel : createPortal(panel, document.body);
};
