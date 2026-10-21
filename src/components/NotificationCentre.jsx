import React from "react";
import { createPortal } from "react-dom";
import { Avatar, WorkoutTypeIcon } from "./primitives.jsx";
import { resolveStorageImageUrl } from "../lib/appState.js";
import { groupNotifications } from "../lib/notificationCentre.js";

// The notification centre: a full screen, not a card in the middle. The list is
// the whole point of the screen.
//
// A row reads left to right as "who, then what": the member's face, badged with
// the emoji they used, then the sentence, then the workout itself on the right.
// Nearly every row will say "<someone> reacted to your <something> Log", so the
// face and the badge are what tell two rows apart at a glance — not the text.

const FONTS = { display: "'Raleway', sans-serif", body: "'Outfit', sans-serif" };

const TONES = {
  pay:      { edge: "rgba(224,98,90,.28)",   wash: "rgba(224,98,90,.045)",  ink: "#E0625A" },
  owed:     { edge: "rgba(46,204,113,.20)",  wash: "rgba(46,204,113,.035)", ink: "#2ecc71" },
  plain:    { edge: "#173332",               wash: "#0C1716",               ink: "#B8C7C4" }
};

const CommentMark = ({ size = 15 }) => React.createElement('svg', {
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round"
}, React.createElement('path', { d: "M20 14a3 3 0 01-3 3H8l-4 3V6a3 3 0 013-3h10a3 3 0 013 3z" }));

// The emoji that badges the face. It sits on the avatar rather than beside the
// text so it reads as "what they did", not as decoration.
const Badge = ({ children }) => React.createElement('span', {
  "aria-hidden": true,
  style: {
    position: "absolute", right: -3, bottom: -3, width: 18, height: 18, borderRadius: 999,
    background: "#0C1716", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 10, lineHeight: 1, boxShadow: "0 0 0 1.5px #0C1716, 0 0 0 2.5px rgba(255,255,255,.05)",
    // "@" is a letter rather than an emoji, so it needs the app's own face.
    fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: "#4ECDC4"
  }
}, children);

// One face, or two overlapping when more than one person reacted.
const Faces = ({ people = [], badge }) => {
  if (people.length > 1) {
    return React.createElement('span', { style: { width: 38, height: 38, flex: "none", position: "relative" } },
      React.createElement('span', { style: { position: "absolute", left: 0, top: 0, borderRadius: 999, boxShadow: "0 0 0 2px #0C1716", lineHeight: 0 } },
        React.createElement(Avatar, { name: people[0].name, userId: people[0].userId, size: 26 })),
      React.createElement('span', { style: { position: "absolute", right: 0, bottom: 0, borderRadius: 999, boxShadow: "0 0 0 2px #0C1716", lineHeight: 0 } },
        React.createElement(Avatar, { name: people[1].name, userId: people[1].userId, size: 26 })),
      badge && React.createElement('span', { style: { position: "absolute", right: -4, bottom: -4, zIndex: 2 } }, React.createElement(Badge, null, badge))
    );
  }
  const person = people[0];
  return React.createElement('span', { style: { width: 38, height: 38, flex: "none", position: "relative", lineHeight: 0 } },
    person
      ? React.createElement(Avatar, { name: person.name, userId: person.userId, size: 38 })
      : React.createElement('span', { style: {
          width: 38, height: 38, borderRadius: 999, display: "flex", alignItems: "center",
          justifyContent: "center", background: "rgba(255,255,255,.04)", color: "#7DB8B1"
        } }, React.createElement(CommentMark, null)),
    badge && React.createElement(Badge, null, badge)
  );
};

// The square on the right: the workout's own photo while it still exists, the
// activity icon once it does not. Photos are deleted after 72 hours, so the
// icon is the normal case and the photo is the recent exception.
const Thumb = ({ photoUrl, type }) => {
  const [failed, setFailed] = React.useState(false);
  const src = photoUrl && !failed ? resolveStorageImageUrl(photoUrl) : "";
  return React.createElement('span', { style: {
    width: 40, height: 40, flex: "none", borderRadius: 8, overflow: "hidden",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "#0F1E1C", border: "0.5px solid var(--border)"
  } },
    src
      ? React.createElement('img', {
          src, alt: "", loading: "lazy", decoding: "async",
          onError: () => setFailed(true),
          style: { width: "100%", height: "100%", objectFit: "cover", display: "block" }
        })
      : React.createElement(WorkoutTypeIcon, { type, size: 20, color: "#7DB8B1" })
  );
};

const Row = ({ item, onAct }) => {
  const tone = item.kind === "money" ? (TONES[item.direction] || TONES.plain) : TONES.plain;
  const tappable = !!item.opens;
  return React.createElement('button', {
    type: "button",
    disabled: !tappable,
    onClick: tappable ? () => onAct(item) : undefined,
    style: {
      width: "100%", textAlign: "left", cursor: tappable ? "pointer" : "default",
      border: `0.5px solid ${tone.edge}`, background: tone.wash,
      borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 11,
      fontFamily: FONTS.body
    }
  },
    React.createElement(Faces, { people: item.people, badge: item.badge }),
    React.createElement('span', { style: { minWidth: 0, flex: 1, display: "grid", gap: 2 } },
      React.createElement('span', { style: { fontSize: 12.5, fontWeight: 600, color: "var(--text)", lineHeight: 1.3 } }, item.title),
      // What the comment actually said, or the message you were tagged in.
      // Clamped to two lines so one chatty comment cannot make a row twice the
      // height of the ones around it.
      item.body && React.createElement('span', { style: {
        fontSize: 11.5, color: "#89A39E", lineHeight: 1.35,
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden"
      } }, item.body),
      item.meta && React.createElement('span', { style: { fontSize: 9.5, color: "#6B9690" } }, item.meta)
    ),
    item.kind === "money"
      ? React.createElement('span', { style: {
          flex: "none", fontSize: 8, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase",
          color: tone.ink, opacity: item.direction === "pay" ? 1 : .85
        } }, item.direction === "pay" ? "Pay" : "Owed")
      // A mention is a Stream message, not a workout, so there is nothing to
      // put in the square and an empty one would just look broken.
      : item.kind === "mention"
        ? null
        : React.createElement(Thumb, { photoUrl: item.thumbPhotoUrl, type: item.thumbType })
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

  const sections = groupNotifications(items);

  const panel = React.createElement('div', {
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "For you",
    style: {
      position: "fixed", inset: 0, zIndex: 150,
      display: "flex", flexDirection: "column",
      // The app's own background, by its own tokens — the same two layers every
      // other screen paints, so this reads as part of the app rather than a
      // surface laid over it. Deliberately NOT the Bloc Stream's background,
      // whose glow is centred inside the screen and bands across the top.
      backgroundColor: "var(--bg-primary)",
      backgroundImage: "var(--bg-radial-hint), var(--bg-gradient)",
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
      sections.map((section, index) => React.createElement(React.Fragment, { key: section.key },
        React.createElement('span', { style: {
          fontSize: 8.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase",
          color: index === 0 ? "#7DB8B1" : "#6B9690", marginTop: index === 0 ? 0 : 4
        } }, section.label),
        section.items.map(item => React.createElement(Row, { key: item.id, item, onAct }))
      ))
    )
  );

  // Portalled: the pages sit inside a transformed swipe surface, and Safari
  // makes any transform the containing block for fixed children.
  return typeof document === "undefined" ? panel : createPortal(panel, document.body);
};
