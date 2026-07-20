import React from "react";
const { useEffect, useMemo, useRef, useState } = React;
import { Avatar, AppIcon, WorkoutTypeIcon } from "./primitives.jsx";
import {
  createLogCommentData,
  listLogCommentsData,
  toggleLogCommentReactionData
} from "../lib/api.js";
import { QUICK_REACTIONS } from "../lib/appState.js";
import { formatShortDate } from "../lib/utils.js";

function normalizeComment(comment) {
  return {
    id: String(comment?.id || ""),
    logId: String(comment?.logId || ""),
    commenterUserId: String(comment?.commenterUserId || ""),
    commenterName: String(comment?.commenterName || "Member"),
    body: String(comment?.body || ""),
    reactions: comment?.reactions && typeof comment.reactions === "object" && !Array.isArray(comment.reactions)
      ? Object.fromEntries(
          Object.entries(comment.reactions)
            .map(([emoji, users]) => [emoji, Array.isArray(users) ? Array.from(new Set(users.map(String).filter(Boolean))) : []])
            .filter(([, users]) => users.length > 0)
        )
      : {},
    createdAt: String(comment?.createdAt || "")
  };
}

const inputStyle = {
  flex: 1,
  minWidth: 0,
  minHeight: 40,
  maxHeight: 92,
  boxSizing: "border-box",
  display: "block",
  background: "#080F0F",
  border: "1px solid #0D1F1E",
  borderRadius: 20,
  padding: "10px 14px 9px",
  color: "var(--text)",
  fontSize: 13.5,
  lineHeight: 1.25,
  outline: "none",
  fontFamily: "'Outfit', sans-serif",
  resize: "none",
  caretColor: "#4ECDC4",
  pointerEvents: "auto",
  touchAction: "manipulation",
  WebkitUserSelect: "text",
  userSelect: "text"
};

function LogThumb({ log }) {
  if (log?.photoUrl) {
    return React.createElement('img', {
      src: log.photoUrl,
      alt: `${log.owner || "Member"} ${log.type || "workout"}`,
      style: { width: "100%", height: "auto", maxHeight: 160, borderRadius: 12, objectFit: "cover", background: "#050507", flexShrink: 0, display: "block", border: "1px solid rgba(255,255,255,.08)" }
    });
  }
  return React.createElement('div', {
    style: { height: 116, borderRadius: 12, background: "#0D1F1E", border: "0.5px solid #163d36", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ECDC4", flexShrink: 0 }
  }, React.createElement(WorkoutTypeIcon, { type: log?.type, size: 36 }));
}

function LogHeader({ log }) {
  return React.createElement('div', {
    style: { position: "sticky", top: 0, zIndex: 2, display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px 11px", background: "rgba(8,15,15,.98)", borderBottom: "1px solid rgba(22,61,54,.9)", backdropFilter: "blur(8px)" }
  },
    React.createElement(LogThumb, { log }),
    React.createElement('div', { style: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minWidth: 0 } },
      React.createElement('div', { style: { display: "flex", alignItems: "center", gap: 7, minWidth: 0, flex: 1 } },
        React.createElement(Avatar, { name: log?.owner || "Member", size: 20 }),
        React.createElement('span', { style: { fontSize: 12.5, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, log?.owner || "Member")
      ),
      React.createElement('div', { style: { display: "flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 10.5, minWidth: 0, flexShrink: 0 } },
        React.createElement('span', { style: { display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0 } },
          React.createElement('span', { style: { color: "#4ECDC4", display: "inline-flex" } }, React.createElement(WorkoutTypeIcon, { type: log?.type, size: 11 })),
          React.createElement('span', { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80 } }, log?.type || "Workout")
        ),
        React.createElement('span', { className: "mono", style: { fontSize: 8.5, color: "var(--muted2)", flexShrink: 0 } }, formatShortDate(log?.date || log?.workoutDate || ""))
      )
    )
  );
}

function LogCommentThread({ open, groupId, log, currentUserId, currentUserName, onClose, onCommentCountChange }) {
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [reactionTarget, setReactionTarget] = useState(null);
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
      commenterUserId: currentUserId || "",
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

  const toggleReaction = async (commentId, emoji) => {
    const normalizedCommentId = String(commentId || "");
    if (!normalizedCommentId || normalizedCommentId.startsWith("tmp_")) return;
    const isAdding = !comments
      .find(comment => comment.id === normalizedCommentId)
      ?.reactions?.[emoji]?.includes(currentUserId);
    setComments(current => current.map(comment => {
      if (comment.id !== normalizedCommentId) return comment;
      const reactions = { ...(comment.reactions || {}) };
      const members = Array.isArray(reactions[emoji]) ? reactions[emoji].filter(Boolean) : [];
      const withoutMe = members.filter(id => id !== currentUserId);
      if (isAdding && currentUserId) reactions[emoji] = [...withoutMe, currentUserId];
      else if (withoutMe.length > 0) reactions[emoji] = withoutMe;
      else delete reactions[emoji];
      return { ...comment, reactions };
    }));
    setReactionTarget(null);
    const result = await toggleLogCommentReactionData({
      groupId,
      commentId: normalizedCommentId,
      emoji,
      isAdding
    });
    if (!result.ok) {
      setError(result.error || "Unable to update reaction");
      await refresh();
    }
  };

  const renderCommentReactions = comment => {
    const active = Object.entries(comment.reactions || {})
      .filter(([, users]) => Array.isArray(users) && users.length > 0)
      .sort((a, b) => b[1].length - a[1].length || QUICK_REACTIONS.indexOf(a[0]) - QUICK_REACTIONS.indexOf(b[0]));
    return React.createElement('div', { style: { position: "relative", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginTop: 5 } },
      active.map(([emoji, users]) => {
        const mine = currentUserId && users.includes(currentUserId);
        return React.createElement('button', {
          key: emoji,
          type: "button",
          onClick: () => toggleReaction(comment.id, emoji),
          style: { height: 19, padding: "0 6px", borderRadius: 999, background: mine ? "rgba(78,205,196,.14)" : "#0D1F1E", border: `1px solid ${mine ? "rgba(78,205,196,.36)" : "#163d36"}`, color: mine ? "#4ECDC4" : "var(--muted)", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, lineHeight: 1 }
        }, emoji, React.createElement('span', { className: "mono", style: { fontSize: 8.5 } }, users.length));
      }),
      React.createElement('button', {
        type: "button",
        onClick: () => setReactionTarget(reactionTarget === comment.id ? null : comment.id),
        style: { height: 19, width: 24, borderRadius: 999, background: "#0D1F1E", border: "1px solid #163d36", color: "var(--muted)", fontSize: 11, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }
      }, "+"),
      reactionTarget === comment.id && React.createElement('div', { style: { position: "absolute", left: 0, bottom: "calc(100% + 5px)", zIndex: 5, display: "flex", gap: 4, padding: "5px 7px", borderRadius: 999, background: "rgba(8,15,15,.97)", border: "1px solid rgba(78,205,196,.16)", boxShadow: "0 12px 28px rgba(0,0,0,.32)" } },
        QUICK_REACTIONS.map(emoji => React.createElement('button', {
          key: emoji,
          type: "button",
          onClick: () => toggleReaction(comment.id, emoji),
          style: { width: 23, height: 23, borderRadius: 999, background: "var(--s2)", border: "1px solid var(--border)", fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }
        }, emoji))
      )
    );
  };

  if (!open) return null;

  return React.createElement('div', {
    onClick: onClose,
    style: { position: "fixed", inset: 0, zIndex: 12000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "calc(env(safe-area-inset-top) + 50px)", paddingBottom: "calc(96px + env(safe-area-inset-bottom))", boxSizing: "border-box", background: "rgba(0,0,0,.58)" }
  },
    React.createElement('div', {
      onClick: event => event.stopPropagation(),
      style: { width: "100%", maxWidth: 640, height: "calc(100dvh - env(safe-area-inset-top) - 146px)", maxHeight: "calc(100dvh - env(safe-area-inset-top) - 146px)", background: "#080F0F", border: "1px solid #163d36", borderBottom: "none", borderRadius: "14px 14px 0 0", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 -4px 44px rgba(0,0,0,.45)" }
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
          : React.createElement('div', { style: { display: "flex", flexDirection: "column", gap: 9, padding: "12px 12px 18px" } },
              comments.map(comment => {
                const isOwn = currentUserId && comment.commenterUserId === currentUserId;
                return React.createElement('div', { key: comment.id, style: { display: "flex", alignItems: "flex-end", justifyContent: isOwn ? "flex-end" : "flex-start", gap: 7 } },
                  !isOwn ? React.createElement(Avatar, { name: comment.commenterName, userId: comment.commenterUserId, size: 24 }) : null,
                  React.createElement('div', { style: { minWidth: 0, maxWidth: "78%", display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start" } },
                    !isOwn ? React.createElement('div', { style: { color: "#3d5e59", fontSize: 9.5, fontWeight: 700, lineHeight: 1.2, margin: "0 0 3px 4px" } }, comment.commenterName) : null,
                    React.createElement('div', { style: { color: "#fff", fontSize: 12.5, lineHeight: 1.34, whiteSpace: "pre-wrap", wordBreak: "break-word", background: isOwn ? "linear-gradient(135deg, #116B65, #0D4642)" : "#0D1F1E", border: `1px solid ${isOwn ? "rgba(78,205,196,.28)" : "#163d36"}`, borderRadius: isOwn ? "13px 4px 13px 13px" : "4px 13px 13px 13px", padding: "8px 10px" } }, comment.body),
                    renderCommentReactions(comment)
                  ),
                  isOwn ? React.createElement('div', { style: { width: 24, flexShrink: 0 } }) : null
                )
              })
            )
      ),
      React.createElement('form', { onSubmit: event => { event.preventDefault(); submit(); }, style: { position: "sticky", bottom: 0, zIndex: 4, flexShrink: 0, minHeight: 62, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px max(12px, env(safe-area-inset-bottom))", borderTop: "1px solid rgba(22,61,54,.72)", background: "rgba(5,9,10,.96)", backdropFilter: "blur(8px)", boxSizing: "border-box" } },
        React.createElement('textarea', {
          ref: inputRef,
          value: draft,
          onChange: event => setDraft(event.target.value),
          onKeyDown: event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } },
          placeholder: "Add a comment",
          rows: 1,
          style: inputStyle
        }),
        React.createElement('button', {
          type: "submit",
          disabled: !draft.trim() || sending,
          onMouseDown: event => event.preventDefault(),
          style: { width: 40, height: 40, borderRadius: 999, background: draft.trim() && !sending ? "#4ECDC4" : "#0D1F1E", border: `1px solid ${draft.trim() && !sending ? "#4ECDC4" : "#163d36"}`, color: draft.trim() && !sending ? "#04110e" : "#3d5e59", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }
        }, React.createElement(AppIcon, { name: "chevron-right", size: 18, stroke: "currentColor" }))
      )
    )
  );
}

export { LogCommentThread };
