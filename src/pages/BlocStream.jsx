import React from "react";
const { useState, useEffect, useRef } = React;
import { Avatar } from "../components/primitives.jsx";
import { listMessages, seedIfEmpty, sendMessage, toggleReaction, createEvent, setRsvp } from "../lib/blocStream.js";

const QUICK_REACTS = ["🔥", "💪", "👏", "😤"];

// Bloc Stream — Bloc-scoped messaging, opened as a slide-up modal over the
// current tab. Stages 1/3/4: shell, text bubbles, input bar. System moments
// and event cards follow. Data is mock-backed until the coordinated backend.

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
  chipBg: "#0b1413", chipBorder: "#1b332e", chipOnBg: "rgba(78,205,196,0.14)", chipOnBorder: "rgba(78,205,196,0.4)"
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

const TextBubble = ({ msg, isOwn, authorName }) =>
  React.createElement('div', {
    style: { display: "flex", gap: 8, alignItems: "flex-end", justifyContent: isOwn ? "flex-end" : "flex-start" }
  },
    !isOwn && React.createElement('div', { style: { flexShrink: 0 } }, React.createElement(Avatar, { name: authorName, size: 28 })),
    React.createElement('div', { style: { maxWidth: "76%", display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start" } },
      React.createElement('div', {
        style: { fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 500, color: C.meta, margin: isOwn ? "0 4px 3px 0" : "0 0 3px 4px" }
      }, `${authorName} · ${formatStamp(msg.created_at)}`),
      React.createElement('div', {
        style: {
          background: isOwn ? C.ownBg : C.rcvBg,
          border: `1px solid ${isOwn ? C.ownBorder : C.rcvBorder}`,
          borderRadius: isOwn ? "12px 3px 12px 12px" : "3px 12px 12px 12px",
          padding: "9px 12px", color: "var(--text)", fontSize: 14.5, lineHeight: 1.4, wordBreak: "break-word"
        }
      }, msg.body)
    )
  );

const ReactionChips = ({ msg, currentUserId, onReact }) => {
  const reactions = msg.reactions || {};
  const [showPicker, setShowPicker] = useState(false);
  const active = Object.entries(reactions).filter(([, users]) => (users || []).length > 0);
  return React.createElement('div', { style: { display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 8, position: "relative" } },
    active.map(([emoji, users]) => {
      const mine = users.includes(currentUserId);
      return React.createElement('button', {
        key: emoji, onClick: () => onReact(msg.id, emoji),
        style: { display: "inline-flex", alignItems: "center", gap: 5, background: mine ? C.chipOnBg : C.chipBg, border: `1px solid ${mine ? C.chipOnBorder : C.chipBorder}`, borderRadius: 20, padding: "3px 10px", fontSize: 13, color: "var(--text)", cursor: "pointer" }
      }, emoji, React.createElement('span', { style: { fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "var(--muted)", fontWeight: 600 } }, users.length));
    }),
    React.createElement('button', {
      onClick: () => setShowPicker(v => !v),
      style: { width: 26, height: 26, borderRadius: 20, background: C.chipBg, border: `1px solid ${C.chipBorder}`, color: "var(--muted)", fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }
    }, "+"),
    showPicker && React.createElement('div', {
      style: { display: "flex", gap: 4, background: C.sheetBg, border: `1px solid ${C.sheetBorder}`, borderRadius: 20, padding: "4px 6px", position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", boxShadow: "0 8px 24px rgba(0,0,0,.5)" }
    },
      QUICK_REACTS.map(emoji => React.createElement('button', {
        key: emoji, onClick: () => { onReact(msg.id, emoji); setShowPicker(false); },
        style: { background: "transparent", border: "none", fontSize: 17, padding: "2px 4px", cursor: "pointer" }
      }, emoji))
    )
  );
};

const SystemCard = ({ msg, currentUserId, onReact }) => {
  const toneColor = msg.tone === "warning" ? C.warning : C.positive;
  return React.createElement('div', { style: { display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 0" } },
    React.createElement('div', {
      style: { maxWidth: "94%", width: "fit-content", background: C.sysBg, border: `1px solid ${C.sysBorder}`, borderRadius: 11, padding: "8px 13px", textAlign: "center" }
    },
      React.createElement('div', {
        style: { fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, color: "#8faeaa", letterSpacing: ".09em", textTransform: "uppercase", marginBottom: 4 }
      }, msg.label),
      React.createElement('div', {
        style: { fontSize: 13, fontWeight: 600, color: toneColor, lineHeight: 1.3 }
      }, msg.body),
      msg.sub && React.createElement('div', {
        style: { fontSize: 11, color: C.meta, marginTop: 3, lineHeight: 1.3 }
      }, msg.sub)
    ),
    React.createElement(ReactionChips, { msg, currentUserId, onReact })
  );
};

const AvatarStack = ({ ids, nameFor, size, muted, label }) => {
  if (!ids.length) return null;
  const shown = ids.slice(0, 3);
  const extra = ids.length - shown.length;
  return React.createElement('div', { style: { display: "inline-flex", alignItems: "center" } },
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
  const detail = (icon, text) => text ? React.createElement('div', {
    style: { display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--text)", lineHeight: 1.3 }
  }, React.createElement('span', { style: { fontSize: 12, width: 15, textAlign: "center", flexShrink: 0 } }, icon), text) : null;
  return React.createElement('div', {
    style: {
      alignSelf: "stretch", background: C.evtBg, border: `1px solid ${C.accent}`,
      borderRadius: 11, padding: "10px 13px 11px", boxShadow: "0 0 0 1px rgba(78,205,196,0.08), 0 6px 18px rgba(0,0,0,.28)"
    }
  },
    React.createElement('div', {
      style: { fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, color: C.accent, letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 6 }
    }, `${authorName} suggested an event`),
    React.createElement('div', {
      style: { fontFamily: "'Outfit', sans-serif", fontSize: 14.5, fontWeight: 600, color: "var(--text)", marginBottom: 6 }
    }, p.activity),
    React.createElement('div', { style: { display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 } },
      detail("🗓", p.when),
      detail("📍", p.location)
    ),
    React.createElement('div', { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
      React.createElement('div', { style: { display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, flexWrap: "wrap" } },
        inIds.length === 0 && passIds.length === 0
          ? React.createElement('span', { style: { fontFamily: "'Outfit', sans-serif", fontSize: 11.5, fontWeight: 600, color: C.meta } }, "No RSVPs yet")
          : null,
        React.createElement(AvatarStack, { ids: inIds, nameFor, size: 22, muted: false, label: "in" }),
        React.createElement(AvatarStack, { ids: passIds, nameFor, size: 22, muted: true, label: "pass" })
      ),
      React.createElement('div', { style: { display: "flex", gap: 6, flexShrink: 0 } },
        React.createElement('button', {
          onClick: () => onRsvp(msg.id, "in"),
          style: {
            background: mine === "in" ? C.accent : "transparent", color: mine === "in" ? "#04110e" : C.accent,
            border: `1px solid ${C.accent}`, borderRadius: 20, padding: "5px 13px",
            fontFamily: "'Outfit', sans-serif", fontSize: 12.5, fontWeight: 700, cursor: "pointer"
          }
        }, "I'm in"),
        React.createElement('button', {
          onClick: () => onRsvp(msg.id, "pass"),
          style: {
            background: mine === "pass" ? C.chipOnBg : "transparent", color: mine === "pass" ? "var(--text)" : "var(--muted)",
            border: `1px solid ${mine === "pass" ? C.chipOnBorder : C.inputBorder}`, borderRadius: 20, padding: "5px 13px",
            fontFamily: "'Outfit', sans-serif", fontSize: 12.5, fontWeight: 600, cursor: "pointer"
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

const EventSheet = ({ onClose, onCreate }) => {
  const [activity, setActivity] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const firstRef = useRef(null);
  useEffect(() => { firstRef.current?.focus(); }, []);
  const inputStyle = { width: "100%", boxSizing: "border-box", background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 10, padding: "11px 13px", color: "var(--text)", fontSize: 14.5, fontFamily: "'Outfit', sans-serif", outline: "none", colorScheme: "dark" };
  const field = (ref, value, setValue, placeholder) => React.createElement('input', {
    ref, value, onChange: e => setValue(e.target.value), placeholder, style: inputStyle
  });
  const picker = (type, value, setValue, ariaLabel) => React.createElement('input', {
    type, value, "aria-label": ariaLabel, onChange: e => setValue(e.target.value), style: inputStyle
  });
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
        React.createElement('div', { style: { flex: 1, minWidth: 0 } }, picker("date", date, setDate, "Date")),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } }, picker("time", time, setTime, "Time"))
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

const BlocStream = ({ open, groupName, blocId, currentUserId, members = [], onClose }) => {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [showPlus, setShowPlus] = useState(false);
  const [showEventSheet, setShowEventSheet] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const nameFor = id => (members.find(m => m.id === id)?.name) || "Member";

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  // Runs only when the stream opens (or the Bloc changes) — deliberately NOT
  // keyed on `members`/`currentUserId`, which get fresh array/identity on every
  // parent re-render (e.g. the 3s poll). Keying on them re-ran this effect and
  // yanked the scroll back to the bottom a second after the user scrolled up.
  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setMounted(true));
      seedIfEmpty(blocId, { currentUserId, members });
      setMessages(listMessages(blocId));
      scrollToBottom();
      return () => cancelAnimationFrame(id);
    }
    setMounted(false);
    setShowPlus(false);
    setShowEventSheet(false);
  }, [open, blocId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (showEventSheet) setShowEventSheet(false); else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, showEventSheet]);

  if (!open) return null;

  const handleSend = () => {
    const sent = sendMessage(blocId, { authorId: currentUserId, body: draft });
    if (!sent) return;
    setMessages(listMessages(blocId));
    setDraft("");
    scrollToBottom();
    inputRef.current?.focus(); // keep the keyboard open after sending
  };

  const handleReact = (messageId, emoji) => {
    toggleReaction(blocId, messageId, emoji, currentUserId);
    setMessages(listMessages(blocId));
  };

  const handleCreateEvent = ({ activity, when, location }) => {
    const made = createEvent(blocId, { authorId: currentUserId, activity, when, location });
    if (!made) return;
    setMessages(listMessages(blocId));
    setShowEventSheet(false);
    scrollToBottom();
  };

  const handleRsvp = (messageId, status) => {
    setRsvp(blocId, messageId, currentUserId, status);
    setMessages(listMessages(blocId));
  };

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
      // Stream header
      React.createElement('div', {
        style: {
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "16px 18px 14px", borderBottom: "1px solid rgba(78,205,196,0.16)",
          background: "rgba(5,9,10,0.55)", backdropFilter: "blur(8px)", flexShrink: 0, position: "relative", zIndex: 1
        }
      },
        React.createElement('div', { style: { minWidth: 0 } },
          React.createElement('div', {
            style: { fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "#8faeaa", letterSpacing: ".1em", textTransform: "uppercase" }
          }, "Bloc Stream"),
          React.createElement('div', {
            style: { fontSize: 15, fontWeight: 500, color: "var(--text)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
          }, groupName || "")
        ),
        React.createElement('button', {
          onClick: onClose,
          style: { background: "transparent", border: "none", color: C.accent, fontSize: 14, fontWeight: 600, padding: "2px 2px", flexShrink: 0, cursor: "pointer" }
        }, "✕ close")
      ),
      // Message list
      React.createElement('div', {
        ref: listRef,
        style: { flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", padding: "16px 16px 20px", display: "flex", flexDirection: "column", gap: 12 }
      },
        messages.length === 0
          ? React.createElement('div', { style: { margin: "auto", color: "var(--muted2)", fontSize: 13 } }, "No messages yet")
          : messages.map(msg => msg.message_type === "system"
              ? React.createElement(SystemCard, { key: msg.id, msg, currentUserId, onReact: handleReact })
              : msg.message_type === "event"
                ? React.createElement(EventCard, { key: msg.id, msg, currentUserId, authorName: nameFor(msg.author_id), nameFor, onRsvp: handleRsvp })
                : React.createElement(TextBubble, { key: msg.id, msg, isOwn: msg.author_id === currentUserId, authorName: nameFor(msg.author_id) }))
      ),
      // Input bar
      React.createElement('div', {
        style: {
          position: "relative", flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
          padding: "10px 12px calc(10px + env(safe-area-inset-bottom))", borderTop: "1px solid var(--border)", background: "rgba(5,9,10,0.55)", backdropFilter: "blur(8px)"
        }
      },
        showPlus && React.createElement('div', {
          style: {
            position: "absolute", left: 12, bottom: "calc(100% + 6px)", background: C.sheetBg, border: `1px solid ${C.sheetBorder}`,
            borderRadius: 12, padding: 6, minWidth: 190, boxShadow: "0 8px 24px rgba(0,0,0,.5)", display: "flex", flexDirection: "column", gap: 2
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
        React.createElement('button', {
          onClick: () => setShowPlus(v => !v),
          style: { flexShrink: 0, width: 36, height: 36, borderRadius: 999, background: C.inputBg, border: `1px solid ${C.inputBorder}`, color: C.accent, fontSize: 20, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }
        }, "+"),
        React.createElement('input', {
          ref: inputRef, value: draft, onChange: e => setDraft(e.target.value),
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
    ),
    showEventSheet && React.createElement(EventSheet, {
      onClose: () => setShowEventSheet(false),
      onCreate: handleCreateEvent
    })
  );
};

export { BlocStream };
