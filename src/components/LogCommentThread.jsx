import React from "react";
const { useEffect, useMemo, useRef, useState } = React;
import { Avatar, AppIcon, WorkoutTypeIcon } from "./primitives.jsx";
import {
  createLogCommentData,
  listLogCommentsData
} from "../lib/api.js";
import { formatShortDate } from "../lib/utils.js";

function normalizeComment(comment) {
  return {
    id: String(comment?.id || ""),
    logId: String(comment?.logId || ""),
    commenterUserId: String(comment?.commenterUserId || ""),
    commenterName: String(comment?.commenterName || "Member"),
    body: String(comment?.body || ""),
    createdAt: String(comment?.createdAt || "")
  };
}

const inputStyle = {
  flex: 1,
  minWidth: 0,
  background: "#080F0F",
  border: "1px solid #0D1F1E",
  borderRadius: 20,
  padding: "10px 14px",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
  fontFamily: "'Outfit', sans-serif"
};

function LogThumb({ log }) {
  if (log?.photoUrl) {
    return React.createElement('img', {
      src: log.photoUrl,
      alt: `${log.owner || "Member"} ${log.type || "workout"}`,
      style: { width: 44, height: 44, borderRadius: 8, objectFit: "cover", background: "#050507", flexShrink: 0 }
    });
  }
  return React.createElement('div', {
    style: { width: 44, height: 44, borderRadius: 8, background: "#0D1F1E", border: "0.5px solid #163d36", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ECDC4", flexShrink: 0 }
  }, React.createElement(WorkoutTypeIcon, { type: log?.type, size: 20 }));
}

function LogHeader({ log }) {
  return React.createElement('div', {
    style: { position: "sticky", top: 0, zIndex: 2, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "rgba(8,15,15,.98)", borderBottom: "1px solid rgba(22,61,54,.9)", backdropFilter: "blur(8px)" }
  },
    React.createElement(LogThumb, { log }),
    React.createElement('div', { style: { minWidth: 0, flex: 1 } },
      React.createElement('div', { style: { display: "flex", alignItems: "center", gap: 7, minWidth: 0 } },
        React.createElement(Avatar, { name: log?.owner || "Member", size: 24 }),
        React.createElement('span', { style: { fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, log?.owner || "Member")
      ),
      React.createElement('div', { style: { marginTop: 3, display: "flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 11.5, minWidth: 0 } },
        React.createElement('span', { style: { display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0 } },
          React.createElement('span', { style: { color: "#4ECDC4", display: "inline-flex" } }, React.createElement(WorkoutTypeIcon, { type: log?.type, size: 12 })),
          React.createElement('span', { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, log?.type || "Workout")
        ),
        React.createElement('span', { className: "mono", style: { fontSize: 9, color: "var(--muted2)", flexShrink: 0 } }, formatShortDate(log?.date || log?.workoutDate || ""))
      )
    )
  );
}

function LogCommentThread({ open, groupId, log, currentUserName, onClose, onCommentCountChange }) {
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const logId = String(log?.id || "");
  const count = comments.length;
  const normalizedLog = useMemo(() => ({
    id: logId,
    owner: log?.owner || log?.ownerDisplayName || "Member",
    type: log?.type || log?.workoutType || "Workout",
    date: log?.date || log?.workoutDate || "",
    photoUrl: log?.photoUrl || ""
  }), [log, logId]);

  const refresh = async () => {
    if (!groupId || !logId) return;
    const result = await listLogCommentsData(groupId, logId);
    if (!result.ok) {
      setError(result.error || "Unable to load comments");
      return;
    }
    const nextComments = result.comments.map(normalizeComment).filter(comment => comment.id);
    setComments(nextComments);
    onCommentCountChange?.(logId, nextComments.length);
    setError("");
  };

  useEffect(() => {
    if (!open) return undefined;
    refresh();
    const id = window.setInterval(refresh, 3000);
    requestAnimationFrame(() => inputRef.current?.focus?.());
    return () => window.clearInterval(id);
  }, [open, groupId, logId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || sending || !groupId || !logId) return;
    const temp = normalizeComment({
      id: `tmp_${Date.now().toString(36)}`,
      logId,
      commenterName: currentUserName || "You",
      body,
      createdAt: new Date().toISOString()
    });
    setSending(true);
    setDraft("");
    setComments(current => [...current, temp]);
    onCommentCountChange?.(logId, count + 1);
    const result = await createLogCommentData({ groupId, logId, body });
    if (!result.ok) {
      setComments(current => current.filter(comment => comment.id !== temp.id));
      onCommentCountChange?.(logId, count);
      setError(result.error || "Unable to add comment");
      setSending(false);
      return;
    }
    await refresh();
    setSending(false);
    inputRef.current?.focus?.();
  };

  if (!open) return null;

  return React.createElement('div', {
    onClick: onClose,
    style: { position: "fixed", inset: 0, zIndex: 360, display: "flex", alignItems: "flex-end", background: "rgba(0,0,0,.58)" }
  },
    React.createElement('div', {
      onClick: event => event.stopPropagation(),
      style: { width: "100%", maxHeight: "88dvh", minHeight: "48dvh", background: "#080F0F", borderTop: "1px solid #163d36", borderRadius: "16px 16px 0 0", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 -18px 44px rgba(0,0,0,.45)" }
    },
      React.createElement('div', { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderBottom: "1px solid rgba(22,61,54,.72)", flexShrink: 0 } },
        React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: "var(--text)" } }, count === 1 ? "1 comment" : `${count} comments`),
        React.createElement('button', { type: "button", onClick: onClose, style: { width: 30, height: 30, borderRadius: 999, background: "transparent", border: "none", color: "#4ECDC4", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 } }, "✕")
      ),
      React.createElement('div', { style: { flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" } },
        React.createElement(LogHeader, { log: normalizedLog }),
        error && React.createElement('div', { style: { margin: 14, padding: "9px 11px", borderRadius: 10, background: "rgba(232,69,69,.08)", border: "1px solid rgba(232,69,69,.22)", color: "#ffd7d7", fontSize: 12 } }, error),
        comments.length === 0
          ? React.createElement('div', { style: { padding: "22px 14px", color: "var(--muted2)", fontSize: 13, textAlign: "center" } }, "No comments yet")
          : React.createElement('div', { style: { display: "flex", flexDirection: "column", gap: 12, padding: "14px 14px 18px" } },
              comments.map(comment => React.createElement('div', { key: comment.id, style: { display: "flex", alignItems: "flex-start", gap: 9 } },
                React.createElement(Avatar, { name: comment.commenterName, userId: comment.commenterUserId, size: 24 }),
                React.createElement('div', { style: { minWidth: 0, flex: 1 } },
                  React.createElement('div', { style: { color: "#3d5e59", fontSize: 10, fontWeight: 700, lineHeight: 1.2 } }, comment.commenterName),
                  React.createElement('div', { style: { color: "#fff", fontSize: 13, lineHeight: 1.38, whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 2 } }, comment.body)
                )
              ))
            )
      ),
      React.createElement('div', { style: { flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px calc(10px + env(safe-area-inset-bottom))", borderTop: "1px solid rgba(22,61,54,.72)", background: "rgba(5,9,10,.72)", backdropFilter: "blur(8px)" } },
        React.createElement('input', {
          ref: inputRef,
          value: draft,
          onChange: event => setDraft(event.target.value),
          onKeyDown: event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } },
          placeholder: "Add a comment",
          style: inputStyle
        }),
        React.createElement('button', {
          type: "button",
          disabled: !draft.trim() || sending,
          onClick: submit,
          onMouseDown: event => event.preventDefault(),
          style: { width: 40, height: 40, borderRadius: 999, background: draft.trim() && !sending ? "#4ECDC4" : "#0D1F1E", border: `1px solid ${draft.trim() && !sending ? "#4ECDC4" : "#163d36"}`, color: draft.trim() && !sending ? "#04110e" : "#3d5e59", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }
        }, React.createElement(AppIcon, { name: "chevron-right", size: 18, stroke: "currentColor" }))
      )
    )
  );
}

export { LogCommentThread };
