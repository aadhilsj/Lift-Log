import React from "react";
const { useState, useEffect, useRef } = React;
import { Avatar } from "../components/primitives.jsx";
import { listMessages, seedIfEmpty, sendMessage } from "../lib/blocStream.js";

// Bloc Stream — Bloc-scoped messaging, opened as a slide-up modal over the
// current tab. Stages 1/3/4: shell, text bubbles, input bar. System moments
// and event cards follow. Data is mock-backed until the coordinated backend.

// Palette — brightened from the original spec hexes (which read too dim on
// device) while staying on-brand with the app's teal/green language.
const C = {
  ownBg: "#123026", ownBorder: "#234d42",
  rcvBg: "#0e1a19", rcvBorder: "#223e38",
  meta: "#6f958e",
  inputBg: "#0e1a19", inputBorder: "#223e38",
  accent: "#4ECDC4",
  sheetBg: "#0a1413", sheetBorder: "#223e38"
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

const BlocStream = ({ open, groupName, blocId, currentUserId, members = [], onClose }) => {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [showPlus, setShowPlus] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const nameFor = id => (members.find(m => m.id === id)?.name) || "Member";

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

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
  }, [open, blocId, currentUserId, members]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSend = () => {
    const sent = sendMessage(blocId, { authorId: currentUserId, body: draft });
    if (!sent) return;
    setMessages(listMessages(blocId));
    setDraft("");
    scrollToBottom();
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
        background: "var(--bg)", borderTop: "1px solid var(--border)",
        borderRadius: "16px 16px 0 0", height: "92dvh", display: "flex", flexDirection: "column",
        transform: mounted ? "translateY(0)" : "translateY(100%)", transition: "transform .28s cubic-bezier(.22,.61,.36,1)",
        overflow: "hidden", boxShadow: "0 -12px 40px rgba(0,0,0,.5)"
      }
    },
      // Stream header
      React.createElement('div', {
        style: {
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "16px 18px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0
        }
      },
        React.createElement('div', { style: { minWidth: 0 } },
          React.createElement('div', {
            className: "mono",
            style: { fontSize: 10, color: C.meta, letterSpacing: ".18em", textTransform: "uppercase" }
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
          : messages.map(msg => React.createElement(TextBubble, {
              key: msg.id, msg, isOwn: msg.author_id === currentUserId, authorName: nameFor(msg.author_id)
            }))
      ),
      // Input bar
      React.createElement('div', {
        style: {
          position: "relative", flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
          padding: "10px 12px calc(10px + env(safe-area-inset-bottom))", borderTop: "1px solid var(--border)", background: "var(--bg)"
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
            onClick: () => setShowPlus(false),
            style: { textAlign: "left", background: "transparent", border: "none", color: "var(--muted)", fontSize: 14, fontWeight: 500, padding: "10px 12px", borderRadius: 8, cursor: "pointer" }
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
          style: { flexShrink: 0, background: draft.trim() ? C.accent : C.inputBg, color: draft.trim() ? "#04110e" : "var(--muted2)", border: `1px solid ${draft.trim() ? C.accent : C.inputBorder}`, borderRadius: 20, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: draft.trim() ? "pointer" : "default" }
        }, "Send")
      )
    )
  );
};

export { BlocStream };
