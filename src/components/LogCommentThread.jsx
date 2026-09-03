import React from "react";
const { useEffect, useMemo, useRef, useState } = React;
import { Avatar, AppIcon, WorkoutTypeIcon } from "./primitives.jsx";
import { ReactionChip } from "./ReactionRoster.jsx";
import {
  createLogCommentData,
  listLogCommentsData,
  toggleLogCommentReactionData
} from "../lib/api.js";
import { QUICK_REACTIONS, resolveStorageImageUrl } from "../lib/appState.js";
import { formatShortDate } from "../lib/utils.js";

// Skeleton bubbles while a thread loads. We already know how many comments
// the log has, so the placeholder is that many (capped) rather than an
// arbitrary number — the thread settles into the height it was drawn at.
// Alternating sides mirrors the real conversation layout.
const CommentThreadSkeleton = ({ count = 3 }) => {
  const rows = Math.max(1, Math.min(count || 3, 6));
  return React.createElement('div', { style: { display: "flex", flexDirection: "column", gap: 10, padding: "12px 12px 18px" } },
    Array.from({ length: rows }, (unused, index) => {
      const isOwn = index % 3 === 1;
      const width = [72, 58, 84, 64, 76, 52][index % 6];
      return React.createElement('div', { key: index, style: { display: "flex", alignItems: "flex-end", justifyContent: isOwn ? "flex-end" : "flex-start", gap: 7 } },
        !isOwn ? React.createElement('div', { className: "skel", style: { width: 22, height: 22, borderRadius: 999, flexShrink: 0 } }) : null,
        React.createElement('div', { className: "skel", style: { width: `${width}%`, maxWidth: "76%", height: 34, borderRadius: 14 } })
      );
    }),
    React.createElement('span', { style: { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" } }, "Loading comments")
  );
};

const logCommentThreadCache = new Map();

function resizeComposer(input) {
  if (!input) return;
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  input.style.overflowY = input.scrollHeight > 120 ? "auto" : "hidden";
}

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
  const [imageExpired, setImageExpired] = useState(false);
  if (log?.photoUrl) {
    if (imageExpired) {
      return React.createElement('div', {
        style: { width: "100%", aspectRatio: "1 / 1", maxHeight: 178, borderRadius: 12, overflow: "hidden", background: "rgba(13,31,30,.72)", flexShrink: 0, display: "flex", flexDirection: "column", gap: 7, alignItems: "center", justifyContent: "center", border: "1px solid rgba(78,205,196,.18)", color: "#6f918c", textAlign: "center", padding: 16, boxSizing: "border-box" }
      },
        React.createElement('div', { style: { fontSize: 12, fontWeight: 700, color: "var(--text-soft)" } }, "Image expired"),
        React.createElement('div', { style: { fontSize: 10.5, lineHeight: 1.35 } }, "The workout and its comments are still here.")
      );
    }
    const displayPhotoUrl = resolveStorageImageUrl(log.photoUrl);
    return React.createElement('div', {
      style: { width: "100%", aspectRatio: "1 / 1", maxHeight: 178, borderRadius: 12, overflow: "hidden", background: "rgba(13,31,30,.72)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,.08)" }
    },
      React.createElement('img', {
        src: displayPhotoUrl,
        alt: `${log.owner || "Member"} ${log.type || "workout"}`,
        onError: () => setImageExpired(true),
        style: { width: "100%", height: "100%", objectFit: "contain", display: "block" }
      })
    );
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

function LogCommentThread({ groupId, log, currentUserId, currentUserName, onClose, onCommentCountChange, onTrackUsage }) {
  const [comments, setComments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [reactionTarget, setReactionTarget] = useState(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const commentGestureRef = useRef(new Map());
  const pendingCommentsRef = useRef(new Map());
  const pendingReactionOverridesRef = useRef(new Map());
  const inputRef = useRef(null);
  const swipeRef = useRef({ sx: 0, sy: 0, st: 0, active: false, mode: null });
  const logId = String(log?.id || "");
  const cacheKey = groupId && logId ? `${groupId}:${logId}` : "";
  const knownCommentCount = Number.isFinite(Number(log?.commentCount)) ? Math.max(0, Number(log.commentCount)) : 0;
  const count = Math.max(comments.length, knownCommentCount);
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
    const serverComments = result.comments.map(normalizeComment).filter(comment => comment.id);
    const serverIds = new Set(serverComments.map(comment => comment.id));
    const now = Date.now();
    pendingCommentsRef.current.forEach((entry, commentId) => {
      if (serverIds.has(commentId) || entry.until <= now) pendingCommentsRef.current.delete(commentId);
    });
    const pendingComments = [...pendingCommentsRef.current.values()]
      .map(entry => entry.comment)
      .filter(comment => comment.id && !serverIds.has(comment.id));
    const nextComments = [...serverComments, ...pendingComments]
      .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
    const pendingReactions = pendingReactionOverridesRef.current;
    const nextWithPendingReactions = nextComments.map(comment => {
      const pending = pendingReactions.get(comment.id);
      if (!pending) return comment;
      if (pending.until <= now) {
        pendingReactions.delete(comment.id);
        setError("Reaction wasn't saved. Please try again.");
        return comment;
      }
      if (JSON.stringify(comment.reactions || {}) === JSON.stringify(pending.reactions)) {
        pendingReactions.delete(comment.id);
        return comment;
      }
      return { ...comment, reactions: pending.reactions };
    });
    setComments(nextWithPendingReactions);
    setLoaded(true);
    if (cacheKey) logCommentThreadCache.set(cacheKey, nextWithPendingReactions);
    onCommentCountChange?.(logId, Math.max(serverComments.length, nextWithPendingReactions.length));
    if (!pendingReactions.size) setError("");
  };

  useEffect(() => {
    if (!groupId || !logId) return undefined;
    const cached = cacheKey ? logCommentThreadCache.get(cacheKey) : null;
    setComments(Array.isArray(cached) ? cached : []);
    setLoaded(Array.isArray(cached));
    setError("");
    refresh();
    const id = window.setInterval(refresh, 3000);
    return () => window.clearInterval(id);
  }, [groupId, logId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    resizeComposer(inputRef.current);
  }, [draft]);

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
    pendingCommentsRef.current.set(temp.id, { comment: temp, until: Date.now() + 10000 });
    setComments(current => {
      const next = [...current, temp];
      if (cacheKey) logCommentThreadCache.set(cacheKey, next);
      return next;
    });
    setLoaded(true);
    onCommentCountChange?.(logId, count + 1);
    const result = await createLogCommentData({ groupId, logId, body });
    if (!result.ok) {
      setComments(current => {
        const next = current.filter(comment => comment.id !== temp.id);
        if (cacheKey) logCommentThreadCache.set(cacheKey, next);
        return next;
      });
      onCommentCountChange?.(logId, count);
      setError(result.error || "Unable to add comment");
      setSending(false);
      return;
    }
    const savedComment = normalizeComment(result.comment || {});
    if (savedComment.id) {
      pendingCommentsRef.current.delete(temp.id);
      pendingCommentsRef.current.set(savedComment.id, { comment: savedComment, until: Date.now() + 10000 });
      setComments(current => {
        const next = current.map(comment => comment.id === temp.id ? savedComment : comment);
        if (cacheKey) logCommentThreadCache.set(cacheKey, next);
        return next;
      });
    }
    if (Number.isFinite(Number(result.commentCount))) {
      onCommentCountChange?.(logId, Math.max(0, Number(result.commentCount)));
    }
    setSending(false);
    inputRef.current?.focus?.();
  };

  const toggleReaction = async (commentId, emoji) => {
    const normalizedCommentId = String(commentId || "");
    if (!normalizedCommentId || normalizedCommentId.startsWith("tmp_")) return;
    const targetComment = comments.find(comment => comment.id === normalizedCommentId);
    const isAdding = !targetComment?.reactions?.[emoji]?.includes(currentUserId);
    const expectedReactions = { ...(targetComment?.reactions || {}) };
    const currentMembers = Array.isArray(expectedReactions[emoji]) ? expectedReactions[emoji].filter(Boolean) : [];
    const withoutMe = currentMembers.filter(id => id !== currentUserId);
    if (isAdding && currentUserId) expectedReactions[emoji] = [...withoutMe, currentUserId];
    else if (withoutMe.length > 0) expectedReactions[emoji] = withoutMe;
    else delete expectedReactions[emoji];
    setComments(current => {
      const next = current.map(comment => {
      if (comment.id !== normalizedCommentId) return comment;
      const reactions = { ...(comment.reactions || {}) };
      const members = Array.isArray(reactions[emoji]) ? reactions[emoji].filter(Boolean) : [];
      const withoutMe = members.filter(id => id !== currentUserId);
      if (isAdding && currentUserId) reactions[emoji] = [...withoutMe, currentUserId];
      else if (withoutMe.length > 0) reactions[emoji] = withoutMe;
      else delete reactions[emoji];
      return { ...comment, reactions };
      });
      if (cacheKey) logCommentThreadCache.set(cacheKey, next);
      return next;
    });
    pendingReactionOverridesRef.current.set(normalizedCommentId, { reactions: expectedReactions, until: Date.now() + 10000 });
    setReactionTarget(null);
    const result = await toggleLogCommentReactionData({
      groupId,
      commentId: normalizedCommentId,
      emoji,
      isAdding
    });
    if (!result.ok) {
      pendingReactionOverridesRef.current.delete(normalizedCommentId);
      setError(result.error || "Unable to update reaction");
      await refresh();
      return;
    }
    await refresh();
  };

  // Keep comment double-tap and long-press behavior in lockstep with the
  // Bloc Stream's Reactable surface. In particular, the same 26px movement
  // tolerance and 300ms second-tap window keep it deliberate on phone.
  const clearCommentLongPress = commentId => {
    const gesture = commentGestureRef.current.get(commentId);
    if (gesture?.lp) window.clearTimeout(gesture.lp);
    if (gesture) gesture.lp = null;
  };
  const startCommentGesture = (event, comment, isOwn) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    clearCommentLongPress(comment.id);
    const previous = commentGestureRef.current.get(comment.id) || {};
    const gesture = {
      ...previous,
      sx: touch.clientX,
      sy: touch.clientY,
      st: Date.now(),
      maxDist: 0,
      suppress: false,
      lastTouch: Date.now(),
      lp: null
    };
    gesture.lp = window.setTimeout(() => {
      gesture.suppress = true;
      try { navigator.vibrate?.(10); } catch (_) {}
      onTrackUsage?.("reaction_picker_opened");
      setReactionTarget({ id: comment.id, isOwn, y: touch.clientY || 180 });
    }, 500);
    commentGestureRef.current.set(comment.id, gesture);
  };
  const moveCommentGesture = (event, commentId) => {
    const gesture = commentGestureRef.current.get(commentId);
    const touch = event.touches?.[0];
    if (!gesture || !touch) return;
    gesture.maxDist = Math.max(gesture.maxDist || 0, Math.hypot(touch.clientX - gesture.sx, touch.clientY - gesture.sy));
    if (gesture.maxDist > 10) clearCommentLongPress(commentId);
  };
  const endCommentGesture = (event, commentId) => {
    const gesture = commentGestureRef.current.get(commentId);
    if (!gesture) return;
    clearCommentLongPress(commentId);
    gesture.lastTouch = Date.now();
    if (gesture.suppress) return;
    if ((gesture.maxDist || 0) < 26 && Date.now() - gesture.st < 550) {
      if (Date.now() - (gesture.lastTap || 0) < 300) {
        gesture.lastTap = 0;
        toggleReaction(commentId, "❤️");
      } else {
        gesture.lastTap = Date.now();
      }
    }
  };
  const renderReactionPicker = () => reactionTarget && React.createElement('div', {
    "data-comment-reaction-picker": "true",
    style: {
      position: "fixed",
      top: Math.max(96, Math.min((window.innerHeight || 720) - 140, Number(reactionTarget.y || 180) - 48)),
      left: reactionTarget.isOwn ? 16 : "auto",
      right: reactionTarget.isOwn ? "auto" : 16,
      zIndex: 13000,
      display: "flex",
      gap: 5,
      padding: "6px 8px",
      borderRadius: 999,
      background: "rgba(8,15,15,.98)",
      border: "1px solid rgba(78,205,196,.18)",
      boxShadow: "0 14px 32px rgba(0,0,0,.38)"
    }
  },
    QUICK_REACTIONS.map(emoji => React.createElement('button', {
      key: emoji,
      type: "button",
      onClick: () => toggleReaction(reactionTarget.id, emoji),
      style: { width: 25, height: 25, borderRadius: 999, background: "var(--s2)", border: "1px solid var(--border)", fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }
    }, emoji))
  );
  const renderCommentReactions = (comment, isOwnComment) => {
    const active = Object.entries(comment.reactions || {})
      .filter(([, users]) => Array.isArray(users) && users.length > 0)
      .sort((a, b) => b[1].length - a[1].length || QUICK_REACTIONS.indexOf(a[0]) - QUICK_REACTIONS.indexOf(b[0]));
    if (!active.length) return null;
    const nameFor = userId => comments.find(entry => entry.commenterUserId === userId)?.commenterName || (userId === currentUserId ? currentUserName || "You" : "Member");
    return React.createElement('div', { style: { position: "absolute", left: isOwnComment ? -7 : "auto", right: isOwnComment ? "auto" : -7, bottom: -9, zIndex: 3, display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" } },
      active.map(([emoji, users]) => {
        return React.createElement(ReactionChip, { key: emoji, emoji, users, nameFor, compact: true });
      })
    );
  };

  if (!logId) return null;
  const resetSwipe = () => {
    swipeRef.current = { sx: 0, sy: 0, st: 0, active: false, mode: null };
    setDragging(false);
    setDragX(0);
  };
  const startSwipeBack = event => {
    const touch = event.touches?.[0];
    if (!touch || touch.clientX > 72 || event.target?.closest?.("textarea,input,button")) return;
    swipeRef.current = { sx: touch.clientX, sy: touch.clientY, st: performance.now(), active: true, mode: null };
  };
  const moveSwipeBack = event => {
    const state = swipeRef.current;
    const touch = event.touches?.[0];
    if (!state.active || !touch) return;
    const dx = touch.clientX - state.sx;
    const dy = touch.clientY - state.sy;
    if (!state.mode && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      state.mode = dx > 0 && Math.abs(dx) > Math.abs(dy) ? "back" : "scroll";
      setDragging(state.mode === "back");
    }
    if (state.mode === "back") setDragX(Math.max(0, Math.min(dx, window.innerWidth || 420)));
  };
  const endSwipeBack = event => {
    const state = swipeRef.current;
    const touch = event.changedTouches?.[0];
    swipeRef.current = { sx: 0, sy: 0, st: 0, active: false, mode: null };
    if (!state.active || !touch) return;
    const dx = touch.clientX - state.sx;
    const dy = touch.clientY - state.sy;
    const screenWidth = window.innerWidth || 420;
    const elapsed = Math.max(1, performance.now() - (state.st || performance.now()));
    const fastEdgeFlick = dx > 24 && elapsed < 260 && dx / elapsed > 0.22 && dx > Math.abs(dy);
    const dominantDrag = dx > screenWidth / 2 && Math.abs(dy) < 100 && dx > Math.abs(dy);
    const shouldClose = state.mode === "back" && (fastEdgeFlick || dominantDrag);
    setDragging(false);
    if (shouldClose) {
      setDragX(screenWidth);
      window.setTimeout(() => onClose?.(), 45);
    } else {
      setDragX(0);
    }
  };

  return React.createElement('div', {
    onPointerDownCapture: event => {
      if (reactionTarget && !event.target?.closest?.('[data-comment-reaction-picker="true"]')) setReactionTarget(null);
    },
    onTouchStart: startSwipeBack,
    onTouchMove: moveSwipeBack,
    onTouchEnd: endSwipeBack,
    onTouchCancel: resetSwipe,
    style: {
      minHeight: "100dvh",
      height: "100dvh",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      background: "var(--bg-gradient)",
      backgroundImage: "var(--bg-radial-hint), var(--bg-gradient)",
      color: "var(--text)",
      transform: dragX ? `translateX(${dragX}px)` : "none",
      transition: dragging ? "none" : "transform .08s ease-out",
      boxShadow: dragX ? "-18px 0 34px rgba(0,0,0,.28)" : "none",
      willChange: dragging || dragX ? "transform" : "auto",
      touchAction: "pan-y"
    }
  },
    React.createElement('div', {
      style: {
        flexShrink: 0,
        display: "grid",
        gridTemplateColumns: "44px 1fr 44px",
        alignItems: "center",
        gap: 6,
        padding: "calc(env(safe-area-inset-top) + 8px) 10px 10px",
        background: "rgba(5,9,10,.94)",
        borderBottom: "1px solid rgba(22,61,54,.72)",
        backdropFilter: "blur(8px)"
      }
    },
      React.createElement('button', {
        type: "button",
        onClick: onClose,
        "aria-label": "Back",
        style: { width: 38, height: 38, borderRadius: 999, background: "transparent", border: "none", color: "#4ECDC4", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }
      }, React.createElement(AppIcon, { name: "chevron-left", size: 24, stroke: "currentColor" })),
      React.createElement('div', { style: { fontSize: 15, fontWeight: 800, color: "var(--text)", textAlign: "center" } }, count === 1 ? "1 comment" : `${count} comments`),
      React.createElement('div')
    ),
    React.createElement('div', {
      style: {
        flex: 1,
        minHeight: 0,
        width: "100%",
        maxWidth: 640,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#080F0F",
        borderLeft: "1px solid rgba(22,61,54,.72)",
        borderRight: "1px solid rgba(22,61,54,.72)"
      }
    },
      React.createElement('div', { style: { flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" } },
        React.createElement(LogHeader, { log: normalizedLog }),
        error && React.createElement('div', { style: { margin: 14, padding: "9px 11px", borderRadius: 10, background: "rgba(232,69,69,.08)", border: "1px solid rgba(232,69,69,.22)", color: "#ffd7d7", fontSize: 12 } }, error),
        comments.length === 0 && !loaded && knownCommentCount > 0
          ? React.createElement(CommentThreadSkeleton, { count: knownCommentCount })
          : comments.length === 0
          ? React.createElement('div', { style: { padding: "22px 14px", color: "var(--muted2)", fontSize: 13, textAlign: "center" } }, "No comments yet")
          : React.createElement('div', { style: { display: "flex", flexDirection: "column", gap: 6, padding: "12px 12px 18px" } },
              comments.map((comment, index) => {
                const isOwn = Boolean((currentUserId && comment.commenterUserId === currentUserId) || (!currentUserId && currentUserName && comment.commenterName === currentUserName));
                const previous = comments[index - 1];
                const showName = !isOwn && previous?.commenterUserId !== comment.commenterUserId;
                const previousIsDifferentUser = Boolean(previous && previous.commenterUserId !== comment.commenterUserId);
                return React.createElement('div', { key: comment.id, style: { display: "flex", alignItems: "flex-end", justifyContent: isOwn ? "flex-end" : "flex-start", gap: 7, marginTop: previousIsDifferentUser ? 7 : 0 } },
                  !isOwn ? React.createElement(Avatar, { name: comment.commenterName, userId: comment.commenterUserId, size: 22 }) : null,
                  React.createElement('div', { style: { minWidth: 0, maxWidth: "76%", display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start" } },
                    showName ? React.createElement('div', { style: { color: "#3d5e59", fontSize: 9, fontWeight: 700, lineHeight: 1.2, margin: "0 0 2px 4px" } }, comment.commenterName) : null,
                    React.createElement('div', {
                      onDoubleClick: () => {
                        const gesture = commentGestureRef.current.get(comment.id);
                        if (!gesture || Date.now() - (gesture.lastTouch || 0) > 800) toggleReaction(comment.id, "❤️");
                      },
                      onContextMenu: event => {
                        event.preventDefault();
                        onTrackUsage?.("reaction_picker_opened");
                        setReactionTarget({ id: comment.id, isOwn, y: event.clientY || 180 });
                      },
                      onTouchStart: event => startCommentGesture(event, comment, isOwn),
                      onTouchMove: event => moveCommentGesture(event, comment.id),
                      onTouchEnd: event => endCommentGesture(event, comment.id),
                      onTouchCancel: () => clearCommentLongPress(comment.id),
                      style: { position: "relative", color: "#fff", fontSize: 12, lineHeight: 1.32, whiteSpace: "pre-wrap", wordBreak: "break-word", background: isOwn ? "linear-gradient(135deg, #116B65, #0D4642)" : "#0D1F1E", border: `1px solid ${isOwn ? "rgba(78,205,196,.28)" : "#163d36"}`, borderRadius: isOwn ? "12px 4px 12px 12px" : "4px 12px 12px 12px", padding: "7px 9px", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", touchAction: "manipulation" }
                    }, comment.body, renderCommentReactions(comment, isOwn))
                  ),
                  null
                )
              })
            )
      ),
      React.createElement('form', { onSubmit: event => { event.preventDefault(); submit(); }, style: { flexShrink: 0, display: "flex", alignItems: "flex-end", gap: 8, padding: "10px 12px calc(28px + env(safe-area-inset-bottom))", borderTop: "1px solid rgba(78,205,196,.18)", background: "rgba(5,9,10,.96)", backdropFilter: "blur(8px)", boxSizing: "border-box" } },
        React.createElement('textarea', {
          ref: inputRef,
          value: draft,
          onFocus: () => onTrackUsage?.("comment_composer_opened"),
          onChange: event => {
            setDraft(event.target.value);
            resizeComposer(event.currentTarget);
          },
          onKeyDown: event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } },
          placeholder: "Add a comment",
          enterKeyHint: "send",
          autoComplete: "off",
          autoCorrect: "off",
          spellCheck: false,
          rows: 1,
          style: inputStyle
        }),
        React.createElement('button', {
          type: "submit",
          disabled: !draft.trim() || sending,
          onMouseDown: event => event.preventDefault(),
          style: { width: 40, height: 40, borderRadius: 999, background: draft.trim() && !sending ? "#4ECDC4" : "#0D1F1E", border: `1px solid ${draft.trim() && !sending ? "#4ECDC4" : "#163d36"}`, color: draft.trim() && !sending ? "#04110e" : "#3d5e59", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }
        }, React.createElement(AppIcon, { name: "chevron-right", size: 18, stroke: "currentColor" }))
      ),
      renderReactionPicker()
    )
  );
}

export { LogCommentThread };
