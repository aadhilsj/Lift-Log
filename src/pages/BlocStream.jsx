import React from "react";
const { useState, useEffect } = React;

// Bloc Stream — Bloc-scoped messaging, opened as a slide-up modal over the
// current tab (does not navigate away). Stage 1: shell only (header + empty
// body). Later stages add text bubbles, system moments, event cards. Data is
// mock-backed until the coordinated backend batch.
const BlocStream = ({ open, groupName, onClose }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(id);
    }
    setMounted(false);
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
      // Body (Stage 1: placeholder)
      React.createElement('div', {
        style: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, color: "var(--muted2)", fontSize: 13, textAlign: "center" }
      }, "Bloc Stream")
    )
  );
};

export { BlocStream };
