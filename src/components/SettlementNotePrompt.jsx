import React from "react";

// The settlement note, shown the way a dating app shows a prompt: the question
// is the app's, small and fixed, and the answer underneath is the person's, in
// their own words and given the room to be read.
//
// This is deliberately NOT squeezed into the Today reminder card. That card
// already carries the month, who owes whom, the shortfall, a payment link and
// the amount; a sixth thing made it unreadable.

export const SETTLEMENT_NOTE_QUESTION = "What's it going toward?";

const FONTS = {
  display: "'Raleway', sans-serif",
  body: "'Outfit', sans-serif"
};

// `answer` empty + `canWrite` renders the invitation instead of the answer.
export const SettlementNotePrompt = ({ answer = "", author = "", canWrite = false, onEdit = null, compact = false }) => {
  const has = !!String(answer || "").trim();
  if (!has && !canWrite) return null;
  return React.createElement('div',{
    onClick: canWrite && onEdit ? onEdit : undefined,
    style:{
      border:"0.5px solid #17302D",
      background:"linear-gradient(160deg, #0C1817, #0A1312)",
      borderRadius:12,
      padding: compact ? "8px 10px" : "9px 12px",
      display:"flex",
      flexDirection:"column",
      gap:5,
      cursor: canWrite && onEdit ? "pointer" : "default",
      position:"relative"
    }
  },
    React.createElement('div',{style:{
      fontFamily:FONTS.body, fontSize:7.5, fontWeight:700, letterSpacing:".14em",
      textTransform:"uppercase", color:"#6B9690"
    }}, SETTLEMENT_NOTE_QUESTION),
    has
      ? React.createElement('div',{style:{
          fontFamily:FONTS.display, fontSize: compact ? 11.5 : 12.5, fontWeight:700,
          lineHeight:1.3, color:"var(--text)", overflowWrap:"anywhere"
        }}, answer)
      : React.createElement('div',{style:{
          fontFamily:FONTS.body, fontSize:10.5, fontWeight:500, lineHeight:1.35, color:"#4E6C68"
        }}, "Tap to say what it’s for"),
    // Whose answer it is. Only worth saying when the money is going to them and
    // somebody else is reading it.
    has && author && React.createElement('div',{style:{
      fontFamily:FONTS.body, fontSize:9, fontWeight:600, color:"#6B9690"
    }}, `— ${author}`),
    canWrite && has && React.createElement('span',{style:{
      position:"absolute", right:11, top:10,
      fontFamily:FONTS.body, fontSize:8.5, fontWeight:700, color:"#7DB8B1"
    }}, "Edit")
  );
};
