import React from "react";
const { useState, useEffect, useRef } = React;
import { Avatar, AppIcon } from "../components/primitives.jsx";
import { listMessages, seedIfEmpty, sendMessage, toggleReaction, createEvent, setRsvp } from "../lib/blocStream.js";

// Long-press / hold reveals these (Instagram-style quick bar). Heart leads and
// is also the double-tap default. The full emoji keyboard is deferred to the
// native (App Store) build — on web we can't open the OS emoji picker.
const QUICK_REACTS = ["❤️", "🔥", "💪", "👏", "😤"];
const DOUBLE_TAP_EMOJI = "❤️";

// Bloc Stream — Bloc-scoped messaging, opened as a slide-up modal over the
// current tab. Text bubbles, system moments, event cards; reactions
// (double-tap / long-press), swipe-to-reply, and @mentions. Data is
// mock-backed until the coordinated backend.

// Palette — brightened from the original spec hexes (which read too dim on
// device) while staying on-brand with the app's teal/green language.
const C = {
  ownBg: "#0f2620", ownBorder: "#1c4038",
  rcvBg: "#0b1413", rcvBorder: "#1b332e",
  meta: "#5f817b",
  inputBg: "#0b1413", inputBorder: "#1b332e",
  accent: "#4ECDC4",
  sheetBg: "#081110", sheetBorder: "#1b332e",
  sysBg: "#0a1513", sysBorder: "#243f38",
  evtBg: "#08201d",
  warning: "#EF9F27", positive: "#4ECDC4",
  chipBg: "#0b1413", chipBorder: "#1b332e", chipOnBg: "rgba(78,205,196,0.14)", chipOnBorder: "rgba(78,205,196,0.4)",
  quote: "rgba(78,205,196,0.06)"
};

function formatStamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return time;
  const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${date} · ${time}`;
}

// Two timestamps fall in the same clock minute (used to collapse timestamps on
// back-to-back messages from the same sender).
const sameMinute = (a, b) => Math.floor(new Date(a).getTime() / 60000) === Math.floor(new Date(b).getTime() / 60000);

const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// One-line preview of a message for reply banners / quoted blocks.
function msgSnippet(m) {
  if (!m) return "";
  if (m.message_type === "event") return `📅 ${(m.payload && m.payload.activity) || "Event"}`;
  if (m.message_type === "system") return m.body || m.label || "Moment";
  return m.body || "";
}

// Render a text body with @mentions of known members highlighted (id-keyed
// mentions live on the message; here we colour the @Name tokens for display).
function renderBody(body, members) {
  if (!body) return body;
  const names = members.map(m => m.name).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!names.length) return body;
  const re = new RegExp("@(" + names.map(escapeRegex).join("|") + ")(?!\\w)", "g");
  const out = [];
  let last = 0, m, i = 0;
  while ((m = re.exec(body))) {
    if (m.index > last) out.push(body.slice(last, m.index));
    out.push(React.createElement('span', { key: `mt${i++}`, style: { color: C.accent, fontWeight: 600 } }, m[0]));
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push(body.slice(last));
  return out.length ? out : body;
}

// Floating quick-react bar, shown above a message on long-press / right-click.
const ReactBar = ({ align, onPick, onClose }) => {
  const pos = align === "right" ? { right: 6 } : align === "center" ? { left: "50%", transform: "translateX(-50%)" } : { left: 6 };
  return React.createElement(React.Fragment, null,
    React.createElement('div', { onClick: onClose, onTouchStart: onClose, style: { position: "fixed", inset: 0, zIndex: 30 } }),
    React.createElement('div', {
      style: { position: "absolute", bottom: "calc(100% - 4px)", zIndex: 31, display: "flex", gap: 2, background: C.sheetBg, border: `1px solid ${C.sheetBorder}`, borderRadius: 22, padding: "4px 6px", boxShadow: "0 10px 26px rgba(0,0,0,.55)", ...pos }
    },
      QUICK_REACTS.map(emoji => React.createElement('button', {
        key: emoji, onMouseDown: e => e.preventDefault(), onClick: () => onPick(emoji),
        style: { background: "transparent", border: "none", fontSize: 22, lineHeight: 1, padding: "3px 5px", cursor: "pointer", borderRadius: 12 }
      }, emoji))
    )
  );
};

// A small floating list of members (who reacted / who RSVP'd), anchored above
// the trigger. Reused by reaction chips and the event RSVP counts.
const RosterPopover = ({ title, ids, nameFor, onClose, align = "left" }) => {
  const pos = align === "right" ? { right: 0 } : align === "center" ? { left: "50%", transform: "translateX(-50%)" } : { left: 0 };
  return React.createElement(React.Fragment, null,
    React.createElement('div', { onClick: onClose, onTouchStart: onClose, style: { position: "fixed", inset: 0, zIndex: 40 } }),
    React.createElement('div', {
      style: { position: "absolute", bottom: "calc(100% + 6px)", zIndex: 41, minWidth: 150, maxWidth: 240, maxHeight: 210, overflowY: "auto", background: C.sheetBg, border: `1px solid ${C.sheetBorder}`, borderRadius: 12, padding: "9px 11px", boxShadow: "0 10px 26px rgba(0,0,0,.55)", ...pos }
    },
      title && React.createElement('div', { style: { fontFamily: "'Outfit', sans-serif", fontSize: 9.5, fontWeight: 700, color: C.meta, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 7 } }, title),
      ids.length === 0
        ? React.createElement('div', { style: { fontSize: 12.5, color: "var(--muted2)" } }, "No one yet")
        : React.createElement('div', { style: { display: "flex", flexDirection: "column", gap: 8 } },
            ids.map(id => React.createElement('div', { key: id, style: { display: "flex", alignItems: "center", gap: 8 } },
              React.createElement(Avatar, { name: nameFor(id), userId: id, size: 22 }),
              React.createElement('span', { style: { fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "var(--text)", whiteSpace: "nowrap" } }, nameFor(id))
            ))
          )
    )
  );
};

// One reaction chip: tap toggles your reaction; press-and-hold (or right-click)
// reveals who reacted, Discord-style. Pointer events + a movement guard keep tap
// and long-press from fighting; user-select/callout are off so nothing selects.
const ReactionChip = ({ emoji, users, mine, onToggle, nameFor, align }) => {
  const [who, setWho] = useState(false);
  const p = useRef({ lp: null, moved: false, sup: false, sx: 0, sy: 0 });
  const clear = () => { if (p.current.lp) { clearTimeout(p.current.lp); p.current.lp = null; } };
  return React.createElement('span', { style: { position: "relative", display: "inline-flex" } },
    React.createElement('button', {
      onPointerDown: e => { const s = p.current; s.moved = false; s.sup = false; s.sx = e.clientX; s.sy = e.clientY; clear(); s.lp = setTimeout(() => { s.sup = true; setWho(true); try { navigator.vibrate && navigator.vibrate(8); } catch (_) {} }, 420); },
      onPointerMove: e => { const s = p.current; if (Math.abs(e.clientX - s.sx) > 8 || Math.abs(e.clientY - s.sy) > 8) { s.moved = true; clear(); } },
      onPointerUp: () => { clear(); if (!p.current.sup && !p.current.moved) onToggle(); },
      onPointerLeave: () => clear(),
      onContextMenu: e => { e.preventDefault(); setWho(true); },
      style: { display: "inline-flex", alignItems: "center", gap: 4, background: mine ? C.chipOnBg : C.chipBg, border: `1px solid ${mine ? C.chipOnBorder : C.chipBorder}`, borderRadius: 16, padding: "1px 7px", fontSize: 12.5, color: "var(--text)", cursor: "pointer", lineHeight: 1.7, userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", touchAction: "manipulation" }
    }, emoji, React.createElement('span', { style: { fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "var(--muted)", fontWeight: 600 } }, users.length)),
    who && React.createElement(RosterPopover, { title: `${emoji} · ${users.length}`, ids: users, nameFor, onClose: () => setWho(false), align })
  );
};

// Compact reaction chips row. `showAdd` renders a "+" that opens the react bar
// (kept for system moments; text bubbles add via double-tap / long-press).
const ReactionChips = ({ msg, currentUserId, onReact, nameFor, align, showAdd, onAdd }) => {
  const active = Object.entries(msg.reactions || {}).filter(([, u]) => (u || []).length > 0);
  if (!active.length && !showAdd) return null;
  const justify = align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start";
  return React.createElement('div', {
    style: { display: "flex", flexWrap: "wrap", gap: 4, justifyContent: justify, marginTop: 5, paddingLeft: align === "left" ? 36 : 0 }
  },
    active.map(([emoji, users]) => React.createElement(ReactionChip, {
      key: emoji, emoji, users, mine: users.includes(currentUserId), onToggle: () => onReact(msg.id, emoji), nameFor, align
    })),
    showAdd && React.createElement('button', {
      onClick: onAdd, onMouseDown: e => e.preventDefault(),
      style: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 22, borderRadius: 16, background: C.chipBg, border: `1px solid ${C.chipBorder}`, color: "var(--muted)", fontSize: 13, cursor: "pointer", userSelect: "none", WebkitUserSelect: "none" }
    }, "+")
  );
};

// Gesture wrapper: press-and-hold (or right-click) opens the react bar,
// double-tap drops a heart, and (when swipeEnabled) a right-swipe past
// threshold replies. Tap detection is displacement+time based (not tied to the
// scroll/swipe mode) so a plain double-tap registers reliably. user-select and
// the iOS touch-callout are disabled so holding a message never selects text.
const Reactable = ({ msg, currentUserId, onReact, onReply, nameFor, align = "left", swipeEnabled = false, showAdd = false, children }) => {
  const [swipeX, setSwipeX] = useState(0);
  const [showBar, setShowBar] = useState(false);
  const g = useRef({ sx: 0, sy: 0, st: 0, mode: null, lp: null, lastTap: 0, suppress: false, maxDist: 0, swipe: 0, lastTouch: 0 });

  const clearLP = () => { if (g.current.lp) { clearTimeout(g.current.lp); g.current.lp = null; } };

  const start = (x, y) => {
    const s = g.current;
    s.sx = x; s.sy = y; s.st = Date.now(); s.mode = null; s.suppress = false; s.maxDist = 0; s.swipe = 0; s.lastTouch = Date.now();
    clearLP();
    s.lp = setTimeout(() => { s.mode = "long"; s.suppress = true; setShowBar(true); try { navigator.vibrate && navigator.vibrate(10); } catch (_) {} }, 500);
  };
  const move = (x, y) => {
    const s = g.current;
    const dx = x - s.sx, dy = y - s.sy;
    const dist = Math.hypot(dx, dy);
    if (dist > s.maxDist) s.maxDist = dist;
    if (s.mode == null && dist > 10) {
      clearLP();
      s.mode = (swipeEnabled && dx > 0 && Math.abs(dx) > Math.abs(dy)) ? "swipe" : "scroll";
    }
    if (s.mode === "swipe") {
      s.swipe = Math.max(0, Math.min(96, dx));
      setSwipeX(s.swipe);
    }
  };
  // Fire the heart, dedupe rapid repeats, and remember the moment so the
  // browser-synthesized dblclick that follows a touch double-tap is ignored.
  const fireHeart = () => { g.current.lastTap = 0; g.current.lastHeart = Date.now(); onReact(msg.id, DOUBLE_TAP_EMOJI); };
  const end = () => {
    const s = g.current;
    clearLP();
    s.lastTouch = Date.now();
    if (s.suppress) { s.mode = null; setSwipeX(0); return; } // long-press already opened the bar
    // Tap detection is movement+time based (independent of scroll/swipe mode) so
    // a plain double-tap registers even with a little finger jitter. Generous
    // 26px slop and a 600ms window keep it forgiving for slow or quick taps.
    if (s.maxDist < 26 && Date.now() - s.st < 550) {
      if (Date.now() - s.lastTap < 600) fireHeart();
      else s.lastTap = Date.now();
      setSwipeX(0); s.mode = null; return;
    }
    if (s.mode === "swipe" && s.swipe >= 56 && onReply) onReply(msg);
    setSwipeX(0); s.mode = null;
  };

  return React.createElement('div', { style: { position: "relative" } },
    swipeEnabled && React.createElement('div', {
      style: { position: "absolute", top: 0, bottom: 0, left: 14, display: "flex", alignItems: "center", opacity: Math.min(1, swipeX / 56), pointerEvents: "none" }
    }, React.createElement(AppIcon, { name: "reply", size: 18, stroke: C.accent })),
    React.createElement('div', {
      onTouchStart: e => start(e.touches[0].clientX, e.touches[0].clientY),
      onTouchMove: e => move(e.touches[0].clientX, e.touches[0].clientY),
      onTouchEnd: end,
      // Mouse double-click is the desktop path; ignore the dblclick that a touch
      // double-tap synthesizes (touchend just ran) so the heart isn't toggled twice.
      onDoubleClick: () => { if (Date.now() - g.current.lastTouch > 800) onReact(msg.id, DOUBLE_TAP_EMOJI); },
      onContextMenu: e => { e.preventDefault(); setShowBar(true); },
      style: { transform: swipeX ? `translateX(${swipeX}px)` : "none", transition: g.current.mode === "swipe" ? "none" : "transform .18s ease", touchAction: swipeEnabled ? "pan-y" : "auto", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }
    }, children),
    showBar && React.createElement(ReactBar, { align, onClose: () => setShowBar(false), onPick: emoji => { onReact(msg.id, emoji); setShowBar(false); } }),
    React.createElement(ReactionChips, { msg, currentUserId, onReact, nameFor, align, showAdd, onAdd: () => setShowBar(true) })
  );
};

// WhatsApp-style grouping for runs of consecutive messages from one sender:
// `showName` (received only) on the first of a run, `showAvatar` on the last,
// and `showTime` only on the last message of a same-minute cluster. Own
// messages never show a name. The tail corner is only on the first bubble.
const TextBubble = ({ msg, isOwn, authorName, nameFor, members, replyToMsg, showName, showTime, showAvatar, firstInGroup }) => {
  const nameText = !isOwn && showName ? authorName : "";
  const timeText = showTime ? formatStamp(msg.created_at) : "";
  const radius = isOwn
    ? (firstInGroup ? "12px 3px 12px 12px" : "12px 12px 12px 12px")
    : (firstInGroup ? "3px 12px 12px 12px" : "12px 12px 12px 12px");
  return React.createElement('div', {
    style: { display: "flex", gap: 8, alignItems: "flex-end", justifyContent: isOwn ? "flex-end" : "flex-start" }
  },
    !isOwn && (showAvatar
      ? React.createElement('div', { style: { flexShrink: 0 } }, React.createElement(Avatar, { name: authorName, size: 28 }))
      : React.createElement('div', { style: { width: 28, flexShrink: 0 } })),
    React.createElement('div', { style: { maxWidth: "76%", display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start" } },
      nameText && React.createElement('div', {
        style: { fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 500, color: C.meta, margin: "0 0 3px 4px" }
      }, nameText),
      React.createElement('div', {
        style: {
          background: isOwn ? C.ownBg : C.rcvBg,
          border: `1px solid ${isOwn ? C.ownBorder : C.rcvBorder}`,
          borderRadius: radius,
          padding: "9px 12px", color: "var(--text)", fontSize: 14.5, lineHeight: 1.4, wordBreak: "break-word"
        }
      },
        replyToMsg && React.createElement('div', {
          style: { borderLeft: `2px solid ${C.accent}`, background: C.quote, borderRadius: 6, padding: "3px 8px", marginBottom: 5 }
        },
          React.createElement('div', {
            style: { fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 700, color: C.accent }
          }, replyToMsg.author_id ? nameFor(replyToMsg.author_id) : "Moment"),
          React.createElement('div', {
            style: { fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }
          }, msgSnippet(replyToMsg))
        ),
        React.createElement('span', null, renderBody(msg.body, members))
      ),
      timeText && React.createElement('div', {
        style: { fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 500, color: C.meta, margin: isOwn ? "3px 4px 0 0" : "3px 0 0 4px" }
      }, timeText)
    )
  );
};

// Filled 4-point sparkle (cyan) for the Perfect Month card.
const Sparkle = ({ size, opacity, pos }) => React.createElement('svg', {
  width: size, height: size, viewBox: "0 0 24 24", fill: C.accent, "aria-hidden": true,
  style: { position: "absolute", opacity, pointerEvents: "none", ...pos }
}, React.createElement('path', { d: "M12 0c.6 6.3 5.1 10.8 12 12-6.9 1.2-11.4 5.7-12 12-.6-6.3-5.1-10.8-12-12 6.9-1.2 11.4-5.7 12-12z" }));

const SystemCard = ({ msg, onSeasonClosedTap }) => {
  // Perfect Month — the rare "everyone hit target" moment. Sanctioned exception
  // to the no-gradients rule: a restrained radial glow + asymmetric sparkles.
  if (msg.system_kind === "perfect_month") {
    return React.createElement('div', { style: { display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 0" } },
      React.createElement('div', {
        style: {
          position: "relative", maxWidth: "94%", width: "fit-content",
          background: "radial-gradient(ellipse at 50% 0%, rgba(78,205,196,0.22) 0%, rgba(78,205,196,0.05) 55%, transparent 80%), #06100E",
          border: "0.5px solid #2a6b62", borderRadius: 14, padding: "22px 18px", textAlign: "center"
        }
      },
        React.createElement(Sparkle, { size: 14, opacity: 0.6, pos: { top: 10, left: 13 } }),
        React.createElement(Sparkle, { size: 10, opacity: 0.4, pos: { top: 14, right: 17 } }),
        React.createElement(Sparkle, { size: 9, opacity: 0.3, pos: { bottom: 13, left: 26 } }),
        React.createElement('div', {
          style: { fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 500, color: C.accent, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 9 }
        }, msg.label),
        React.createElement('div', {
          style: { fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 500, color: "#fff", lineHeight: 1.15 }
        }, msg.body)
      )
    );
  }

  // Awards — one combined card listing every seasonal award. Deliberately the
  // plainest card in the stream; the visual celebration lives on Results.
  if (msg.system_kind === "awards") {
    const awards = (msg.payload && msg.payload.awards) || [];
    return React.createElement('div', { style: { display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 0" } },
      React.createElement('div', {
        style: { maxWidth: "94%", width: "fit-content", background: C.sysBg, border: `1px solid ${C.sysBorder}`, borderRadius: 12, padding: "10px 14px", textAlign: "center" }
      },
        React.createElement('div', {
          style: { fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: C.meta, letterSpacing: ".09em", textTransform: "uppercase", marginBottom: 8 }
        }, msg.label),
        React.createElement('div', { style: { display: "flex", flexDirection: "column", gap: 4 } },
          awards.map((a, i) => React.createElement('div', {
            key: i, style: { fontSize: 14, fontWeight: 500, color: "var(--text)", lineHeight: 1.3 }
          }, `${a.title} — ${a.name}`))
        )
      )
    );
  }

  const toneColor = msg.tone === "warning" ? C.warning : msg.tone === "neutral" ? C.meta : C.positive;
  const tappable = msg.payload?.action === "season_results" && onSeasonClosedTap;
  const content = React.createElement(React.Fragment, null,
    React.createElement('div', {
      style: { fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: C.meta, letterSpacing: ".09em", textTransform: "uppercase", marginBottom: 4 }
    }, msg.label),
    React.createElement('div', {
      style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 13, fontWeight: 600, color: toneColor, lineHeight: 1.3 }
    },
      React.createElement('span', null, msg.body),
      tappable && React.createElement(AppIcon, { name: "chevron-right", size: 13, stroke: toneColor })
    ),
    msg.sub && React.createElement('div', {
      style: { fontSize: 11, color: C.meta, marginTop: 3, lineHeight: 1.3 }
    }, msg.sub)
  );
  return React.createElement('div', { style: { display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 0" } },
    tappable
      ? React.createElement('button', {
          onClick: e => { e.stopPropagation(); onSeasonClosedTap(msg); },
          style: { maxWidth: "94%", width: "fit-content", background: C.sysBg, border: `1px solid ${C.sysBorder}`, borderRadius: 11, padding: "8px 13px", textAlign: "center", cursor: "pointer" }
        }, content)
      : React.createElement('div', {
          style: { maxWidth: "94%", width: "fit-content", background: C.sysBg, border: `1px solid ${C.sysBorder}`, borderRadius: 11, padding: "8px 13px", textAlign: "center" }
        }, content)
  );
};

const AvatarStack = ({ ids, nameFor, size, muted, label, onClick }) => {
  if (!ids.length) return null;
  const shown = ids.slice(0, 3);
  const extra = ids.length - shown.length;
  return React.createElement('button', {
    onClick, onMouseDown: e => e.preventDefault(),
    // Sits above the roster popover's tap-outside catcher so tapping the other
    // count switches the list in place instead of closing + reopening it.
    style: { position: "relative", zIndex: onClick ? 45 : "auto", display: "inline-flex", alignItems: "center", background: "transparent", border: "none", padding: 0, cursor: onClick ? "pointer" : "default" }
  },
    React.createElement('div', { style: { display: "flex", alignItems: "center" } },
      shown.map((id, i) => React.createElement('div', {
        key: id, style: { marginLeft: i === 0 ? 0 : -7, borderRadius: "50%", boxShadow: `0 0 0 2px ${C.evtBg}`, opacity: muted ? 0.55 : 1, filter: muted ? "grayscale(0.6)" : "none" }
      }, React.createElement(Avatar, { name: nameFor(id), userId: id, size, muted })))
    ),
    React.createElement('span', {
      style: { fontFamily: "'Outfit', sans-serif", fontSize: 11.5, fontWeight: 600, color: C.meta, marginLeft: 6 }
    }, `${ids.length} ${label}${extra > 0 ? ` · +${extra}` : ""}`)
  );
};

const EventCard = ({ msg, currentUserId, authorName, nameFor, onRsvp }) => {
  const p = msg.payload || {};
  const rsvp = p.rsvp || {};
  const inIds = Object.keys(rsvp).filter(id => rsvp[id] === "in");
  const passIds = Object.keys(rsvp).filter(id => rsvp[id] === "pass");
  const mine = rsvp[currentUserId];
  const [roster, setRoster] = useState(null); // "in" | "pass" | null
  const detail = (icon, text) => text ? React.createElement('div', {
    style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text)", lineHeight: 1.25 }
  }, React.createElement('span', { style: { fontSize: 11.5, width: 14, textAlign: "center", flexShrink: 0 } }, icon), text) : null;
  return React.createElement('div', {
    style: {
      alignSelf: "stretch", background: C.evtBg, border: `1px solid ${C.accent}`,
      borderRadius: 10, padding: "8px 11px 9px", boxShadow: "0 0 0 1px rgba(78,205,196,0.08), 0 5px 15px rgba(0,0,0,.24)"
    }
  },
    React.createElement('div', {
      style: { fontFamily: "'Outfit', sans-serif", fontSize: 8.5, fontWeight: 700, color: C.accent, letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 5 }
    }, `${authorName} suggested an event`),
    React.createElement('div', {
      style: { fontFamily: "'Outfit', sans-serif", fontSize: 13.5, fontWeight: 600, color: "var(--text)", marginBottom: 5 }
    }, p.activity),
    React.createElement('div', { style: { display: "flex", flexDirection: "column", gap: 2, marginBottom: 8 } },
      detail("🗓", p.when),
      detail("📍", p.location)
    ),
    React.createElement('div', { style: { display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" } },
      React.createElement('div', { style: { position: "relative", display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, flexWrap: "wrap" } },
        inIds.length === 0 && passIds.length === 0
          ? React.createElement('span', { style: { fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: C.meta } }, "No RSVPs yet")
          : null,
        React.createElement(AvatarStack, { ids: inIds, nameFor, size: 20, muted: false, label: "in", onClick: () => setRoster(r => r === "in" ? null : "in") }),
        React.createElement(AvatarStack, { ids: passIds, nameFor, size: 20, muted: true, label: "pass", onClick: () => setRoster(r => r === "pass" ? null : "pass") }),
        roster && React.createElement(RosterPopover, {
          title: roster === "in" ? "Going" : "Passed",
          ids: roster === "in" ? inIds : passIds,
          nameFor, onClose: () => setRoster(null), align: "left"
        })
      ),
      React.createElement('div', { style: { display: "flex", gap: 6, flexShrink: 0 } },
        React.createElement('button', {
          onClick: () => onRsvp(msg.id, "in"),
          style: {
            background: mine === "in" ? C.accent : "transparent", color: mine === "in" ? "#04110e" : C.accent,
            border: `1px solid ${C.accent}`, borderRadius: 18, padding: "4px 11px",
            fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer"
          }
        }, "I'm in"),
        React.createElement('button', {
          onClick: () => onRsvp(msg.id, "pass"),
          style: {
            background: mine === "pass" ? C.chipOnBg : "transparent", color: mine === "pass" ? "var(--text)" : "var(--muted)",
            border: `1px solid ${mine === "pass" ? C.chipOnBorder : C.inputBorder}`, borderRadius: 18, padding: "4px 11px",
            fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer"
          }
        }, "Pass")
      )
    )
  );
};

// Build the human-readable `when` display string from the picker values
// (date = "YYYY-MM-DD", time = "HH:MM"). Either part may be empty.
function formatWhen(date, time) {
  const parts = [];
  if (date) {
    const d = new Date(`${date}T00:00`);
    if (!Number.isNaN(d.getTime())) parts.push(d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }));
  }
  if (time) {
    const [hh, mm] = time.split(":");
    const t = new Date();
    t.setHours(Number(hh), Number(mm), 0, 0);
    if (!Number.isNaN(t.getTime())) parts.push(t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
  }
  return parts.join(" · ");
}

const emptyEventDraft = () => ({ activity: "", date: "", time: "", location: "" });
const eventDraftHasData = draft => Boolean(
  String(draft?.activity || "").trim()
  || String(draft?.date || "").trim()
  || String(draft?.time || "").trim()
  || String(draft?.location || "").trim()
);

const EventSheet = ({ draft, onDraftChange, onClose, onCreate }) => {
  const activity = draft.activity || "";
  const date = draft.date || "";
  const time = draft.time || "";
  const location = draft.location || "";
  const firstRef = useRef(null);
  useEffect(() => { firstRef.current?.focus(); }, []);
  const setActivity = value => onDraftChange({ ...draft, activity: value });
  const setDate = value => onDraftChange({ ...draft, date: value });
  const setTime = value => onDraftChange({ ...draft, time: value });
  const setLocation = value => onDraftChange({ ...draft, location: value });
  const inputStyle = { width: "100%", boxSizing: "border-box", background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 10, padding: "11px 13px", color: "var(--text)", fontSize: 14.5, fontFamily: "'Outfit', sans-serif", outline: "none", colorScheme: "dark" };
  const field = (ref, value, setValue, placeholder) => React.createElement('input', {
    ref, value, onChange: e => setValue(e.target.value), placeholder, style: inputStyle
  });
  // Date/time fields: a styled shell matching the Activity/Location inputs
  // (icon + placeholder-or-value) with the native date/time control laid over
  // it transparently, so tapping opens the standard picker. Native inputs won't
  // show custom placeholder text, hence the overlay approach.
  const picker = (type, value, setValue, iconName, placeholder, display) =>
    React.createElement('label', {
      style: { position: "relative", flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, boxSizing: "border-box", background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 10, padding: "11px 13px", cursor: "pointer", overflow: "hidden" }
    },
      React.createElement(AppIcon, { name: iconName, size: 16, stroke: C.meta }),
      React.createElement('span', {
        style: { flex: 1, minWidth: 0, fontFamily: "'Outfit', sans-serif", fontSize: 14.5, color: value ? "var(--text)" : "var(--muted2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
      }, value ? display : placeholder),
      React.createElement('input', {
        type, value, "aria-label": placeholder,
        onChange: e => setValue(e.target.value),
        onClick: e => { try { e.currentTarget.showPicker(); } catch (_) {} },
        style: { position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, border: "none", margin: 0, padding: 0, cursor: "pointer", colorScheme: "dark" }
      })
    );
  return React.createElement('div', {
    onClick: e => { e.stopPropagation(); onClose(); },
    style: { position: "fixed", inset: 0, zIndex: 320, display: "flex", flexDirection: "column", justifyContent: "flex-end", background: "rgba(0,0,0,.5)" }
  },
    React.createElement('div', {
      onClick: e => e.stopPropagation(),
      style: {
        background: "linear-gradient(180deg, #0a1413 0%, #070f0e 100%)", borderTop: `1px solid ${C.accent}`,
        borderRadius: "16px 16px 0 0", padding: "18px 18px calc(18px + env(safe-area-inset-bottom))",
        display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 -12px 40px rgba(0,0,0,.5)"
      }
    },
      React.createElement('div', { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
        React.createElement('div', {
          style: { fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "#8faeaa", letterSpacing: ".1em", textTransform: "uppercase" }
        }, "Suggest an Event"),
        React.createElement('button', {
          onClick: onClose,
          style: { background: "transparent", border: "none", color: C.accent, fontSize: 14, fontWeight: 600, cursor: "pointer" }
        }, "Cancel")
      ),
      field(firstRef, activity, setActivity, "Activity — e.g. Saturday long run"),
      React.createElement('div', { style: { display: "flex", gap: 10 } },
        picker("date", date, setDate, "calendar", "Date", formatWhen(date, "")),
        picker("time", time, setTime, "clock", "Time", formatWhen("", time))
      ),
      field(null, location, setLocation, "Location — e.g. Marina Beach"),
      React.createElement('button', {
        onClick: () => { if (activity.trim()) onCreate({ activity, when: formatWhen(date, time), location }); },
        disabled: !activity.trim(),
        style: {
          background: activity.trim() ? C.accent : C.inputBg, color: activity.trim() ? "#04110e" : "var(--muted2)",
          border: `1px solid ${activity.trim() ? C.accent : C.inputBorder}`, borderRadius: 20, padding: "12px 16px",
          fontFamily: "'Outfit', sans-serif", fontSize: 14.5, fontWeight: 700, cursor: activity.trim() ? "pointer" : "default", marginTop: 2
        }
      }, "Post to Bloc")
    )
  );
};

// @mention picker — appears above the input as the user types "@…".
const MentionList = ({ items, onPick }) =>
  React.createElement('div', {
    style: { position: "absolute", left: 12, right: 12, bottom: "calc(100% + 6px)", background: C.sheetBg, border: `1px solid ${C.sheetBorder}`, borderRadius: 12, padding: 6, maxHeight: 210, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.5)", display: "flex", flexDirection: "column", gap: 2, zIndex: 12 }
  },
    items.map(m => React.createElement('button', {
      key: m.id, onMouseDown: e => e.preventDefault(), onClick: () => onPick(m),
      style: { display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: "transparent", border: "none", padding: "7px 8px", borderRadius: 8, cursor: "pointer", width: "100%" }
    },
      React.createElement(Avatar, { name: m.name, userId: m.id, size: 26 }),
      React.createElement('span', { style: { fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "var(--text)", fontWeight: 500 } }, m.name)
    ))
  );

const BlocStream = ({ open, groupName, blocId, currentUserId, members = [], streamBlocs = [], onSeasonClosedTap, onClose }) => {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [viewedBlocId, setViewedBlocId] = useState(blocId);
  const [draft, setDraft] = useState("");
  const [eventDraft, setEventDraft] = useState(emptyEventDraft);
  const [showPlus, setShowPlus] = useState(false);
  const [showEventSheet, setShowEventSheet] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [mention, setMention] = useState(null); // { query, start } while typing "@…"
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const streamStateRef = useRef(new Map());

  const fallbackBlocs = blocId ? [{ id: blocId, name: groupName, members }] : [];
  const availableBlocs = (streamBlocs.length ? streamBlocs : fallbackBlocs).filter(group => group?.id);
  const activeBloc = availableBlocs.find(group => group.id === viewedBlocId) || availableBlocs.find(group => group.id === blocId) || fallbackBlocs[0] || null;
  const activeBlocId = activeBloc?.id || blocId;
  const activeGroupName = activeBloc?.name || groupName;
  const activeMembers = activeBloc?.members || members;
  const canSwitchStreams = availableBlocs.length > 1;

  const nameFor = id => (activeMembers.find(m => m.id === id)?.name) || "Member";

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const saveCurrentStreamState = () => {
    if (!activeBlocId) return;
    const hasDraft = draft.trim().length > 0;
    const keepEventSheet = showEventSheet && eventDraftHasData(eventDraft);
    streamStateRef.current.set(activeBlocId, {
      draft,
      replyTarget: hasDraft ? replyTarget : null,
      eventDraft: keepEventSheet ? eventDraft : emptyEventDraft(),
      showEventSheet: keepEventSheet
    });
  };

  const restoreStreamState = nextBlocId => {
    const saved = streamStateRef.current.get(nextBlocId) || {};
    setDraft(saved.draft || "");
    setReplyTarget(saved.replyTarget || null);
    setEventDraft(saved.eventDraft || emptyEventDraft());
    setShowEventSheet(Boolean(saved.showEventSheet));
    setMention(null);
    setShowPlus(false);
  };

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setMounted(true));
      streamStateRef.current = new Map();
      setViewedBlocId(blocId);
      setDraft("");
      setEventDraft(emptyEventDraft());
      setShowPlus(false);
      setShowEventSheet(false);
      setReplyTarget(null);
      setMention(null);
      return () => cancelAnimationFrame(id);
    }
    setMounted(false);
    streamStateRef.current = new Map();
    setViewedBlocId(blocId);
    setDraft("");
    setEventDraft(emptyEventDraft());
    setShowPlus(false);
    setShowEventSheet(false);
    setReplyTarget(null);
    setMention(null);
  }, [open, blocId]);

  // Runs when the visible stream changes. Deliberately not keyed on the active
  // members array, which can be recreated by parent polling and would yank scroll.
  useEffect(() => {
    if (!open || !activeBlocId) return;
    seedIfEmpty(activeBlocId, { currentUserId, members: activeMembers });
    setMessages(listMessages(activeBlocId));
    scrollToBottom();
  }, [open, activeBlocId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bulletproof background scroll lock: pin the body in place (iOS Safari
  // leaks touch-scroll through a plain `overflow:hidden`, so fix the body and
  // restore the scroll position on close).
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key !== "Escape") return;
      if (showEventSheet) setShowEventSheet(false);
      else if (mention) setMention(null);
      else if (replyTarget) setReplyTarget(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, showEventSheet, mention, replyTarget]);

  if (!open) return null;

  const switchStream = direction => {
    if (!canSwitchStreams || !activeBlocId) return;
    const index = availableBlocs.findIndex(group => group.id === activeBlocId);
    const nextIndex = (index + direction + availableBlocs.length) % availableBlocs.length;
    const nextBlocId = availableBlocs[nextIndex]?.id;
    if (!nextBlocId || nextBlocId === activeBlocId) return;
    saveCurrentStreamState();
    setViewedBlocId(nextBlocId);
    restoreStreamState(nextBlocId);
  };

  const handleSend = () => {
    const mentions = activeMembers.filter(m => m.name && new RegExp("@" + escapeRegex(m.name) + "(?!\\w)").test(draft)).map(m => m.id);
    const sent = sendMessage(activeBlocId, { authorId: currentUserId, body: draft, replyTo: replyTarget?.id || null, mentions });
    if (!sent) return;
    streamStateRef.current.delete(activeBlocId);
    setMessages(listMessages(activeBlocId));
    setDraft("");
    setReplyTarget(null);
    setMention(null);
    scrollToBottom();
    inputRef.current?.focus(); // keep the keyboard open after sending
  };

  const handleReact = (messageId, emoji) => {
    toggleReaction(activeBlocId, messageId, emoji, currentUserId);
    setMessages(listMessages(activeBlocId));
  };

  const handleReply = (msg) => {
    setReplyTarget(msg);
    inputRef.current?.focus();
  };

  const handleCreateEvent = ({ activity, when, location }) => {
    const made = createEvent(activeBlocId, { authorId: currentUserId, activity, when, location });
    if (!made) return;
    streamStateRef.current.delete(activeBlocId);
    setMessages(listMessages(activeBlocId));
    setEventDraft(emptyEventDraft());
    setShowEventSheet(false);
    scrollToBottom();
  };

  const handleRsvp = (messageId, status) => {
    setRsvp(activeBlocId, messageId, currentUserId, status);
    setMessages(listMessages(activeBlocId));
  };

  // Detect the "@token" the caret currently sits in and open the mention list.
  const onDraftChange = e => {
    const val = e.target.value;
    setDraft(val);
    const caret = e.target.selectionStart ?? val.length;
    const m = val.slice(0, caret).match(/(?:^|\s)@([^\s@]*)$/);
    setMention(m ? { query: m[1].toLowerCase(), start: caret - m[1].length - 1 } : null);
  };

  const pickMention = (m) => {
    const before = draft.slice(0, mention.start);
    const after = draft.slice(mention.start).replace(/^@[^\s@]*/, "");
    const insert = `@${m.name} `;
    const next = before + insert + after;
    setDraft(next);
    setMention(null);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) { el.focus(); const pos = (before + insert).length; try { el.setSelectionRange(pos, pos); } catch (_) {} }
    });
  };

  const mentionItems = mention
    ? activeMembers.filter(m => m.id !== currentUserId && m.name && m.name.toLowerCase().includes(mention.query)).slice(0, 6)
    : [];

  return React.createElement('div', {
    onClick: onClose,
    style: {
      position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column",
      justifyContent: "flex-end", background: mounted ? "rgba(0,0,0,.5)" : "rgba(0,0,0,0)",
      transition: "background .25s ease"
    }
  },
    React.createElement('div', {
      onClick: e => e.stopPropagation(),
      style: {
        background: "radial-gradient(ellipse 95% 38% at 50% 16%, rgba(78,205,196,0.13), transparent 60%), linear-gradient(180deg, #080f0e 0%, #070f0e 38%, #05090a 100%)",
        borderTop: "1px solid var(--border)",
        borderRadius: "16px 16px 0 0", height: "92dvh", display: "flex", flexDirection: "column",
        transform: mounted ? "translateY(0)" : "translateY(100%)", transition: "transform .28s cubic-bezier(.22,.61,.36,1)",
        overflow: "hidden", overscrollBehavior: "contain", boxShadow: "0 -12px 40px rgba(0,0,0,.5)"
      }
    },
      // Stream header — two fully independent elements: a static, left-aligned
      // title block (which Bloc's stream is open) and an absolutely-centered
      // stream-switcher pill (blind ‹ › stepper). The close button is at right.
      React.createElement('div', {
        style: {
          display: "flex", alignItems: "center", justifyContent: "flex-start",
          padding: "15px 48px 13px 18px", borderBottom: "1px solid rgba(78,205,196,0.16)",
          background: "rgba(5,9,10,0.55)", backdropFilter: "blur(8px)", flexShrink: 0, position: "relative", zIndex: 1
        }
      },
        // Left: static title block
        React.createElement('div', { style: { minWidth: 0, maxWidth: "52%", display: "flex", flexDirection: "column", alignItems: "flex-start" } },
          React.createElement('div', {
            style: { fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "#3d5e59", letterSpacing: ".1em", textTransform: "uppercase" }
          }, "Bloc Stream"),
          React.createElement('div', {
            style: { fontSize: 15, fontWeight: 500, color: "var(--text)", marginTop: 3, maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
          }, activeGroupName || "")
        ),
        // Center: independent stream-switcher pill (blind stepper; hidden with one Bloc)
        canSwitchStreams && React.createElement('div', {
          style: { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", display: "inline-flex", alignItems: "center", gap: 4, background: "#0D1F1E", border: "0.5px solid #163d36", borderRadius: 20, padding: "4px 8px" }
        },
          React.createElement('button', {
            onClick: () => switchStream(-1), title: "Previous Bloc stream", "aria-label": "Previous Bloc stream",
            style: { display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: C.accent, cursor: "pointer", padding: "0 3px", lineHeight: 0 }
          }, React.createElement(AppIcon, { name: "chevron-left", size: 12, stroke: C.accent })),
          React.createElement('button', {
            onClick: () => switchStream(1), title: "Next Bloc stream", "aria-label": "Next Bloc stream",
            style: { display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: C.accent, cursor: "pointer", padding: "0 3px", lineHeight: 0 }
          }, React.createElement(AppIcon, { name: "chevron-right", size: 12, stroke: C.accent }))
        ),
        React.createElement('button', {
          onClick: onClose,
          "aria-label": "Close Bloc Stream",
          style: { position: "absolute", top: 13, right: 16, width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: C.accent, fontSize: 18, fontWeight: 500, padding: 0, cursor: "pointer", lineHeight: 1 }
        }, "✕")
      ),
      // Message list
      React.createElement('div', {
        ref: listRef,
        style: { flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", padding: "16px 16px 20px", display: "flex", flexDirection: "column", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }
      },
        messages.length === 0
          ? React.createElement('div', { style: { margin: "auto", color: "var(--muted2)", fontSize: 13 } }, "No messages yet")
          : messages.map((msg, i) => {
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const isText = msg.message_type !== "system" && msg.message_type !== "event";
              const sameAuthorPrev = isText && prev && prev.message_type !== "system" && prev.message_type !== "event" && prev.author_id === msg.author_id;
              const sameAuthorNext = isText && next && next.message_type !== "system" && next.message_type !== "event" && next.author_id === msg.author_id;
              const firstInGroup = isText && !sameAuthorPrev;
              // Tight spacing within a sender's run, larger between groups / cards.
              const marginTop = i === 0 ? 0 : (firstInGroup || !isText ? 12 : 3);
              const wrap = child => React.createElement('div', { key: msg.id, style: { marginTop } }, child);

              if (msg.message_type === "system") {
                return wrap(React.createElement(Reactable, { msg, currentUserId, onReact: handleReact, nameFor, align: "center", showAdd: true },
                  React.createElement(SystemCard, { msg, onSeasonClosedTap: () => onSeasonClosedTap?.(activeBlocId) })));
              }
              if (msg.message_type === "event") {
                return wrap(React.createElement(EventCard, { msg, currentUserId, authorName: nameFor(msg.author_id), nameFor, onRsvp: handleRsvp }));
              }
              const isOwn = msg.author_id === currentUserId;
              const replyToMsg = msg.reply_to ? messages.find(x => x.id === msg.reply_to) : null;
              // Time shows on the last message of a same-minute run from this sender.
              const showTime = !(sameAuthorNext && sameMinute(msg.created_at, next.created_at));
              return wrap(React.createElement(Reactable, { msg, currentUserId, onReact: handleReact, onReply: handleReply, nameFor, align: isOwn ? "right" : "left", swipeEnabled: true },
                React.createElement(TextBubble, { msg, isOwn, authorName: nameFor(msg.author_id), nameFor, members: activeMembers, replyToMsg, showName: firstInGroup, showTime, showAvatar: !sameAuthorNext, firstInGroup })));
            })
      ),
      // Input bar
      React.createElement('div', {
        style: {
          position: "relative", flexShrink: 0, display: "flex", flexDirection: "column",
          padding: "10px 12px calc(10px + env(safe-area-inset-bottom))", borderTop: "1px solid var(--border)", background: "rgba(5,9,10,0.55)", backdropFilter: "blur(8px)"
        }
      },
        // Reply banner
        replyTarget && React.createElement('div', {
          style: { display: "flex", alignItems: "center", gap: 8, padding: "2px 4px 8px" }
        },
          React.createElement('div', { style: { width: 2, alignSelf: "stretch", background: C.accent, borderRadius: 2, flexShrink: 0 } }),
          React.createElement('div', { style: { flex: 1, minWidth: 0 } },
            React.createElement('div', {
              style: { fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: ".04em" }
            }, `Replying to ${replyTarget.author_id ? nameFor(replyTarget.author_id) : "Moment"}`),
            React.createElement('div', {
              style: { fontSize: 12.5, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
            }, msgSnippet(replyTarget))
          ),
          React.createElement('button', {
            onClick: () => setReplyTarget(null), onMouseDown: e => e.preventDefault(),
            style: { background: "transparent", border: "none", color: "var(--muted)", fontSize: 16, cursor: "pointer", padding: 2, flexShrink: 0 }
          }, "✕")
        ),
        // + action sheet
        showPlus && React.createElement('div', {
          style: {
            position: "absolute", left: 12, bottom: "calc(100% + 6px)", background: C.sheetBg, border: `1px solid ${C.sheetBorder}`,
            borderRadius: 12, padding: 6, minWidth: 190, boxShadow: "0 8px 24px rgba(0,0,0,.5)", display: "flex", flexDirection: "column", gap: 2, zIndex: 12
          }
        },
          React.createElement('button', {
            onClick: () => { setShowPlus(false); inputRef.current?.focus(); },
            style: { textAlign: "left", background: "transparent", border: "none", color: "var(--text)", fontSize: 14, fontWeight: 500, padding: "10px 12px", borderRadius: 8, cursor: "pointer" }
          }, "Send a message"),
          React.createElement('button', {
            onClick: () => { setShowPlus(false); setShowEventSheet(true); },
            style: { textAlign: "left", background: "transparent", border: "none", color: "var(--text)", fontSize: 14, fontWeight: 500, padding: "10px 12px", borderRadius: 8, cursor: "pointer" }
          }, "Suggest an event")
        ),
        // @mention picker
        mention && mentionItems.length > 0 && React.createElement(MentionList, { items: mentionItems, onPick: pickMention }),
        // Input row
        React.createElement('div', { style: { display: "flex", alignItems: "center", gap: 8 } },
          React.createElement('button', {
            onClick: () => setShowPlus(v => !v),
            style: { flexShrink: 0, width: 36, height: 36, borderRadius: 999, background: C.inputBg, border: `1px solid ${C.inputBorder}`, color: C.accent, fontSize: 20, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }
          }, "+"),
          React.createElement('input', {
            ref: inputRef, value: draft, onChange: onDraftChange,
            onKeyDown: e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } },
            placeholder: "Message the Bloc",
            style: { flex: 1, minWidth: 0, background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 20, padding: "10px 14px", color: "var(--text)", fontSize: 14.5, fontFamily: "'Outfit', sans-serif", outline: "none" }
          }),
          React.createElement('button', {
            onClick: handleSend, disabled: !draft.trim(),
            onMouseDown: e => e.preventDefault(), // don't steal focus from the input (keeps keyboard open)
            style: { flexShrink: 0, background: draft.trim() ? C.accent : C.inputBg, color: draft.trim() ? "#04110e" : "var(--muted2)", border: `1px solid ${draft.trim() ? C.accent : C.inputBorder}`, borderRadius: 20, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: draft.trim() ? "pointer" : "default" }
          }, "Send")
        )
      )
    ),
    showEventSheet && React.createElement(EventSheet, {
      draft: eventDraft,
      onDraftChange: setEventDraft,
      onClose: () => setShowEventSheet(false),
      onCreate: handleCreateEvent
    })
  );
};

export { BlocStream };
