import React from "react";
import { createPortal } from "react-dom";
import { Avatar } from "./primitives.jsx";

const { useRef, useState } = React;

const POPOVER_GUTTER = 10;

function getPopoverPosition(rect, memberCount) {
  const viewportWidth = Math.max(0, window.innerWidth || 0);
  const viewportHeight = Math.max(0, window.innerHeight || 0);
  const width = Math.min(176, Math.max(132, viewportWidth - POPOVER_GUTTER * 2));
  const estimatedHeight = Math.min(154, 28 + Math.min(memberCount, 5) * 26);
  const left = Math.max(POPOVER_GUTTER, Math.min(rect.left, viewportWidth - width - POPOVER_GUTTER));
  const fitsAbove = rect.top - estimatedHeight - 6 >= POPOVER_GUTTER;
  return {
    width,
    left,
    top: fitsAbove
      ? Math.max(POPOVER_GUTTER, rect.top - estimatedHeight - 6)
      : Math.max(POPOVER_GUTTER, Math.min(viewportHeight - estimatedHeight - POPOVER_GUTTER, rect.bottom + 6))
  };
}

function ReactorRoster({ emoji, ids, nameFor, photoFor, anchorRect, onClose, compact = false }) {
  const position = getPopoverPosition(anchorRect, ids.length);
  const avatarSize = compact ? 16 : 18;
  return createPortal(
    React.createElement(React.Fragment, null,
      React.createElement('button', {
        type: "button",
        "aria-label": "Close reactions",
        onClick: onClose,
        style: { position: "fixed", inset: 0, zIndex: 13000, background: "transparent", border: "none", padding: 0 }
      }),
      React.createElement('div', {
        role: "dialog",
        "aria-label": `People who reacted ${emoji}`,
        style: {
          position: "fixed", zIndex: 13001, left: position.left, top: position.top, width: position.width,
          maxHeight: 154, overflowY: "auto", background: "#080F0F", border: "1px solid rgba(78,205,196,.22)",
          borderRadius: 10, padding: compact ? "6px 7px" : "7px 8px", boxSizing: "border-box",
          boxShadow: "0 12px 28px rgba(0,0,0,.48)"
        }
      },
        React.createElement('div', { style: { color: "#638b86", fontSize: compact ? 8 : 9, fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 4 } }, `${emoji} · ${ids.length}`),
        React.createElement('div', { style: { display: "flex", flexDirection: "column", gap: compact ? 4 : 5 } },
          ids.map(id => React.createElement('div', { key: id, style: { minHeight: avatarSize, display: "flex", alignItems: "center", gap: 6 } },
            React.createElement(Avatar, { name: nameFor(id), userId: id, photoUrl: photoFor?.(id), size: avatarSize }),
            React.createElement('span', { style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'Outfit', sans-serif", fontSize: compact ? 11 : 11.5, color: "var(--text)" } }, nameFor(id))
          ))
        )
      )
    ),
    document.body
  );
}

function ReactionChip({ emoji, users, nameFor, photoFor, compact = false }) {
  const [anchorRect, setAnchorRect] = useState(null);
  const rootRef = useRef(null);
  const gesture = useRef({ moved: false, x: 0, y: 0 });
  const open = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) setAnchorRect({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
  };
  return React.createElement(React.Fragment, null,
    React.createElement('button', {
      ref: rootRef, type: "button", onContextMenu: event => event.preventDefault(),
      onPointerDown: event => { gesture.current = { moved: false, x: event.clientX, y: event.clientY }; },
      onPointerMove: event => { if (Math.abs(event.clientX - gesture.current.x) > 8 || Math.abs(event.clientY - gesture.current.y) > 8) gesture.current.moved = true; },
      onPointerUp: () => { if (!gesture.current.moved) open(); },
      style: { height: compact ? 17 : 19, minWidth: compact ? 28 : 31, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 2, padding: compact ? "0 5px" : "0 6px", borderRadius: 999, background: "#182120", border: "1px solid rgba(255,255,255,.08)", color: "var(--text)", fontSize: compact ? 9.5 : 10.5, lineHeight: 1, cursor: "pointer", touchAction: "manipulation", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", boxShadow: "0 5px 11px rgba(0,0,0,.24)" }
    }, emoji, React.createElement('span', { style: { fontFamily: "'Outfit', sans-serif", fontSize: compact ? 8.5 : 9, fontWeight: 800, color: "rgba(255,255,255,.84)" } }, users.length)),
    anchorRect && React.createElement(ReactorRoster, { emoji, ids: users, nameFor, photoFor, anchorRect, onClose: () => setAnchorRect(null), compact })
  );
}

export { ReactionChip };
