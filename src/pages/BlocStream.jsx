import React from "react";
const { useState, useEffect } = React;
import { Avatar } from "../components/primitives.jsx";
import { listMessages, seedIfEmpty } from "../lib/blocStream.js";

// Bloc Stream — Bloc-scoped messaging, opened as a slide-up modal over the
// current tab (does not navigate away). Stages 1+3: shell + text bubbles.
// Input, system moments, and event cards follow. Data is mock-backed until the
// coordinated backend batch.

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
        className: "mono",
        style: { fontSize: 10, color: "#3d5e59", margin: isOwn ? "0 4px 3px 0" : "0 0 3px 4px" }
      }, `${authorName} · ${formatStamp(msg.created_at)}`),
      React.createElement('div', {
        style: {
          background: isOwn ? "#0F2A22" : "#080F0F",
          border: `1px solid ${isOwn ? "#163d36" : "#0D1F1E"}`,
          borderRadius: isOwn ? "12px 3px 12px 12px" : "3px 12px 12px 12px",
          padding: "9px 12px", color: "var(--text)", fontSize: 14, lineHeight: 1.4, wordBreak: "break-word"
        }
      }, msg.body)
    )
  );

const BlocStream = ({ open, groupName, blocId, currentUserId, members = [], onClose }) => {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState([]);

  const nameFor = id => (members.find(m => m.id === id)?.name) || "Member";

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setMounted(true));
      seedIfEmpty(blocId, { currentUserId, members });
      setMessages(listMessages(blocId));
      return () => cancelAnimationFrame(id);
    }
    setMounted(false);
  }, [open, blocId, currentUserId, members]);

  // Lock background scroll while the modal is open, restore on close.
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
        borderRadius: "16px 16px 0 0", height: "92vh", display: "flex", flexDirection: "column",
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
            style: { fontSize: 10, color: "#3d5e59", letterSpacing: ".18em", textTransform: "uppercase" }
          }, "Bloc Stream"),
          React.createElement('div', {
            style: { fontSize: 15, fontWeight: 500, color: "var(--text)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
          }, groupName || "")
        ),
        React.createElement('button', {
          onClick: onClose,
          style: { background: "transparent", border: "none", color: "#4ECDC4", fontSize: 14, fontWeight: 600, padding: "2px 2px", flexShrink: 0, cursor: "pointer" }
        }, "✕ close")
      ),
      // Message list
      React.createElement('div', {
        style: { flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", padding: "16px 16px 20px", display: "flex", flexDirection: "column", gap: 12 }
      },
        messages.length === 0
          ? React.createElement('div', { style: { margin: "auto", color: "var(--muted2)", fontSize: 13 } }, "No messages yet")
          : messages.map(msg => React.createElement(TextBubble, {
              key: msg.id, msg, isOwn: msg.author_id === currentUserId, authorName: nameFor(msg.author_id)
            }))
      )
    )
  );
};

export { BlocStream };
