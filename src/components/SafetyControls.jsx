import React from "react";
const { useCallback, useEffect, useState } = React;
import { ModalScrim } from "./primitives.jsx";
import {
  getSafetyStatusData,
  setUserBlockData,
  createContentReportData
} from "../lib/api.js";

// Report and Block, shared by every surface that shows someone else's content:
// the activity feed, the Bloc Stream, workout comments, and member profiles.
// One component rather than four copies, because the wording is a compliance
// commitment and four copies drift.
//
// Every pop-up here renders inside ModalScrim, which portals to document.body
// and centres on the visible screen. Do not reintroduce a bottom sheet: the
// surfaces these open from carry transforms during swipe, and a sheet anchored
// to the bottom lands in the wrong place (see the recurring debugging
// playbook).

const REPORT_REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate_or_discrimination", label: "Hate or discrimination" },
  { value: "threat_or_safety", label: "Threat or safety concern" },
  { value: "sexual_or_inappropriate", label: "Sexual or inappropriate" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Something else" }
];

// What the person is reporting, used in the pop-up's heading.
const CONTENT_NOUNS = {
  workout_log: "workout",
  workout_comment: "comment",
  stream_message: "message",
  profile: "profile"
};

const modalStyle = { textAlign:"center" };
const titleStyle = { fontWeight:800, fontSize:17, marginBottom:7 };
const bodyStyle = { fontSize:12.5, lineHeight:1.55, color:"var(--muted)", marginBottom:17 };
const menuRowStyle = {
  width:"100%", background:"var(--s2)", border:"1px solid var(--border)", borderRadius:10,
  padding:12, fontSize:13.5, fontWeight:700, color:"var(--text)", fontFamily:"inherit", cursor:"pointer"
};
const quietRowStyle = { ...menuRowStyle, background:"transparent", borderColor:"transparent", color:"var(--muted)" };
const pairStyle = { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 };
const ghostStyle = {
  border:"1px solid var(--border)", borderRadius:10, padding:11, background:"var(--s2)",
  color:"var(--muted)", fontWeight:700, fontSize:13, fontFamily:"inherit", cursor:"pointer"
};
const dangerStyle = {
  border:"1px solid rgba(212,74,74,.35)", borderRadius:10, padding:11, background:"var(--red-dim)",
  color:"#ff9c9c", fontWeight:800, fontSize:13, fontFamily:"inherit", cursor:"pointer"
};
const primaryStyle = {
  border:0, borderRadius:10, padding:11, background:"var(--cyan)", color:"#04110e",
  fontWeight:800, fontSize:13, fontFamily:"inherit", cursor:"pointer"
};
const errorStyle = { color:"#ffd4d4", fontSize:11, marginBottom:10 };

// Step one. Deliberately short and unexplained, the way Instagram's is: the
// consequences belong on the confirm, not here.
const SafetyMenu = ({ name, contentType, onReport, onBlock, onClose }) =>
  React.createElement(ModalScrim, { onClose, zIndex:1300 },
    React.createElement('div', { className:"modal", onClick:e => e.stopPropagation(), style:{ ...modalStyle, maxWidth:360 } },
      React.createElement('div', { style:titleStyle }, name || "This member"),
      React.createElement('div', { style:{ display:"grid", gap:7, marginTop:4 } },
        React.createElement('button', { type:"button", onClick:onReport, style:menuRowStyle },
          `Report ${CONTENT_NOUNS[contentType] || "content"}`),
        React.createElement('button', { type:"button", onClick:onBlock, style:{ ...menuRowStyle, color:"#ffb4b4" } }, "Block"),
        React.createElement('button', { type:"button", onClick:onClose, style:quietRowStyle }, "Cancel")
      )
    )
  );

// Step two, block. The wording follows Instagram and Facebook - say what
// happens, say they are not told, say it is reversible - but it must stay true
// to what Fero actually does. Fero's block is one-way for seeing, so this must
// never claim they cannot see you. It does say they cannot reach you, which
// the server enforces.
const BlockConfirm = ({ name, busy, error, onConfirm, onCancel }) =>
  React.createElement(ModalScrim, { onClose:busy ? () => {} : onCancel, zIndex:1300 },
    React.createElement('div', { className:"modal", onClick:e => e.stopPropagation(), style:{ ...modalStyle, maxWidth:360 } },
      React.createElement('div', { style:titleStyle }, `Block ${name || "this member"}?`),
      React.createElement('div', { style:bodyStyle },
        "You won't see their workouts, comments or messages, and they won't be able to comment on or react to yours. They won't be told. They stay in the Bloc and their workouts still count towards it. You can unblock them any time."),
      error && React.createElement('div', { role:"alert", style:errorStyle }, error),
      React.createElement('div', { style:pairStyle },
        React.createElement('button', { type:"button", onClick:onCancel, disabled:busy, style:ghostStyle }, "Cancel"),
        React.createElement('button', { type:"button", onClick:onConfirm, disabled:busy, style:dangerStyle }, busy ? "Blocking…" : "Block")
      )
    )
  );

// Step two, report. A tap list rather than a dropdown, the way Instagram and
// Strava do it - a dropdown on a phone is a needless extra gesture.
const ReportDialog = ({ name, contentType, busy, error, onSend, onCancel }) => {
  const [reason, setReason] = useState("harassment");
  const [details, setDetails] = useState("");
  const noun = CONTENT_NOUNS[contentType] || "content";
  return React.createElement(ModalScrim, { onClose:busy ? () => {} : onCancel, zIndex:1300 },
    React.createElement('div', { className:"modal", onClick:e => e.stopPropagation(), style:{ ...modalStyle, maxWidth:380, padding:"22px 20px" } },
      React.createElement('div', { style:titleStyle }, `Report ${noun}`),
      React.createElement('div', { style:{ ...bodyStyle, marginBottom:13 } },
        `Only the Fero team sees this. ${name || "They"} won't be told who reported it.`),
      React.createElement('div', { style:{ display:"grid", gap:6, textAlign:"left", marginBottom:12 } },
        REPORT_REASONS.map(option => {
          const on = option.value === reason;
          return React.createElement('button', {
            key:option.value,
            type:"button",
            disabled:busy,
            onClick:() => setReason(option.value),
            style:{
              display:"flex", alignItems:"center", gap:9,
              background:on ? "rgba(78,205,196,.09)" : "var(--s2)",
              border:`1px solid ${on ? "var(--cyan)" : "var(--border)"}`,
              borderRadius:10, padding:"11px 12px", fontSize:13, fontWeight:600,
              color:on ? "var(--text)" : "var(--text-soft)", fontFamily:"inherit", cursor:"pointer"
            }
          },
            React.createElement('span', { style:{
              width:15, height:15, borderRadius:999, flex:"0 0 auto",
              border:`1.5px solid ${on ? "var(--cyan)" : "var(--muted2)"}`,
              background:on ? "var(--cyan)" : "transparent"
            } }),
            option.label
          );
        })
      ),
      React.createElement('textarea', {
        value:details,
        onChange:e => setDetails(e.target.value),
        disabled:busy,
        maxLength:1000,
        rows:3,
        placeholder:"Add anything that would help (optional)",
        style:{
          width:"100%", boxSizing:"border-box", border:"1px solid var(--border)",
          background:"var(--s2)", borderRadius:10, padding:10, color:"var(--text)",
          fontSize:12, fontFamily:"inherit", resize:"none", marginBottom:12
        }
      }),
      error && React.createElement('div', { role:"alert", style:errorStyle }, error),
      React.createElement('div', { style:pairStyle },
        React.createElement('button', { type:"button", onClick:onCancel, disabled:busy, style:ghostStyle }, "Cancel"),
        React.createElement('button', { type:"button", onClick:() => onSend(reason, details), disabled:busy, style:primaryStyle },
          busy ? "Sending…" : "Send report")
      )
    )
  );
};

// The whole flow for one target. `target` is null when nothing is open.
// `onBlocked` lets the surface hide that member's content straight away rather
// than waiting for a refetch.
// `target.step` lets a caller open straight on Report or Block. The hold menu
// does that: it already asked which one, so repeating the question would be a
// pointless extra tap. Without it the flow still starts on its own menu.
const SafetyFlow = ({ target, groupId, onBlocked, onClose }) => {
  const [step, setStep] = useState("menu");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (target) { setStep(target.step === "report" || target.step === "block" ? target.step : "menu"); setBusy(false); setError(""); }
  }, [target]);

  if (!target) return null;
  const { userId, name, contentType, contentId } = target;

  const close = () => { if (!busy) onClose(); };

  const block = async () => {
    if (busy) return;
    setBusy(true); setError("");
    const result = await setUserBlockData(userId, true);
    setBusy(false);
    if (!result.ok) { setError(result.error || "Unable to block this member."); return; }
    onBlocked?.(String(userId));
    onClose();
  };

  const report = async (reason, details) => {
    if (busy) return;
    setBusy(true); setError("");
    const result = await createContentReportData({
      groupId, reportedUserId:userId, contentType, contentId, reason, details
    });
    setBusy(false);
    if (!result.ok) { setError(result.error || "Unable to submit your report."); return; }
    onClose();
  };

  if (step === "block") {
    return React.createElement(BlockConfirm, { name, busy, error, onConfirm:block, onCancel:close });
  }
  if (step === "report") {
    return React.createElement(ReportDialog, { name, contentType, busy, error, onSend:report, onCancel:close });
  }
  return React.createElement(SafetyMenu, {
    name, contentType, onClose:close,
    onReport:() => { setError(""); setStep("report"); },
    onBlock:() => { setError(""); setStep("block"); }
  });
};

// Who this member has blocked, so a surface can hide their content. Empty is a
// normal answer, never an error, and a failure leaves the list empty rather
// than hiding anything.
const useBlockedUserIds = () => {
  const [blockedUserIds, setBlockedUserIds] = useState([]);
  useEffect(() => {
    let cancelled = false;
    getSafetyStatusData()
      .then(result => { if (!cancelled && result.ok) setBlockedUserIds(result.blockedUserIds.map(String)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const addBlockedUserId = useCallback(userId => {
    setBlockedUserIds(current => [...new Set([...current, String(userId)])]);
  }, []);
  return { blockedUserIds, addBlockedUserId };
};

export { SafetyFlow, useBlockedUserIds, REPORT_REASONS };
