import React from "react";
const { useCallback, useEffect, useState } = React;
import { Avatar } from "./primitives.jsx";
import { getBlockedMembersData, setUserBlockData } from "../lib/api.js";

// The Blocked list, and the only way to undo a block. Everything else in Fero
// can only add one, so without this a block is permanent.

const useBlockedMembers = () => {
  const [members, setMembers] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => {
    let cancelled = false;
    getBlockedMembersData()
      .then(result => {
        if (cancelled) return;
        // An empty list is a normal answer, never an error.
        if (result.ok) setMembers(result.members);
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => reload(), [reload]);

  // Drop the row straight away rather than waiting for a refetch, so the list
  // never sits there showing someone who has just been unblocked.
  const removeMember = useCallback(userId => {
    setMembers(current => current.filter(member => String(member.userId) !== String(userId)));
  }, []);

  return { members, loaded, reload, removeMember };
};

const BlockedMembersPanel = ({ members, loaded, onUnblocked, onBack }) => {
  const [busyUserId, setBusyUserId] = useState("");
  const [error, setError] = useState("");

  const unblock = async userId => {
    if (busyUserId) return;
    setBusyUserId(String(userId));
    setError("");
    const result = await setUserBlockData(userId, false);
    setBusyUserId("");
    if (!result.ok) { setError(result.error || "Unable to unblock. Try again."); return; }
    onUnblocked?.(userId);
  };

  return React.createElement(React.Fragment, null,
    React.createElement('button', {
      type: "button",
      onClick: onBack,
      // The host screen is a flex column, so without alignSelf the button
      // stretches and its label centres.
      style: { alignSelf: "flex-start", textAlign: "left", background: "transparent", border: "none", color: "var(--muted)", fontSize: 13, fontWeight: 700, padding: "0 0 10px", fontFamily: "inherit", cursor: "pointer" }
    }, "‹ Account"),
    React.createElement('div', { style: { fontWeight: 800, fontSize: 18, marginBottom: 3 } }, "Blocked"),
    React.createElement('div', { style: { fontSize: 12, color: "var(--muted)", lineHeight: 1.5, marginBottom: 14 } },
      "You won't see their workouts, comments or messages, and they can't comment on or react to yours. They stay in the Bloc, and their workouts still count towards it."),
    error && React.createElement('div', { role: "alert", style: { color: "#ffd4d4", fontSize: 11, marginBottom: 10 } }, error),
    !loaded
      ? React.createElement('div', { style: { padding: "18px 2px", fontSize: 12.5, color: "var(--muted2)" } }, "Loading…")
      : members.length === 0
      ? React.createElement('div', { style: { padding: "18px 2px", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 } },
          "You haven't blocked anyone. You can block someone from their profile, or from anything they post.")
      : React.createElement('div', { style: { background: "var(--s1)", border: ".5px solid var(--border)", borderRadius: 14 } },
          members.map((member, index) => React.createElement('div', {
            key: member.userId,
            style: {
              display: "flex", alignItems: "center", gap: 11, padding: "11px 12px",
              borderBottom: index === members.length - 1 ? "none" : ".5px solid var(--border)"
            }
          },
            React.createElement(Avatar, { name: member.displayName, userId: member.userId, photoUrl: member.profilePhotoUrl, size: 30 }),
            React.createElement('div', { style: { minWidth: 0, fontSize: 13.5, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, member.displayName),
            React.createElement('button', {
              type: "button",
              disabled: busyUserId === String(member.userId),
              onClick: () => unblock(member.userId),
              style: {
                marginLeft: "auto", flexShrink: 0, background: "transparent",
                border: "1px solid var(--border2)", color: "var(--cyan)", borderRadius: 999,
                padding: "6px 13px", fontSize: 11.5, fontWeight: 800, fontFamily: "inherit", cursor: "pointer"
              }
            }, busyUserId === String(member.userId) ? "…" : "Unblock")
          ))
        )
  );
};

export { BlockedMembersPanel, useBlockedMembers };
