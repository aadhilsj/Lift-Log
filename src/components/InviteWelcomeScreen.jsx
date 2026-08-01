import React from "react";
import { MIN_TARGET, getCountedLogCount } from "../lib/appState.js";
import { Avatar, AnteWordmark } from "./primitives.jsx";

const statusMeta = {
  "locked-in": { label:"CLEARED", color:"#E9EEF5", bg:"rgba(233,238,245,.16)", border:"rgba(233,238,245,.18)" },
  "on-track": { label:"ON TRACK", color:"#61D36A", bg:"rgba(97,211,106,.12)", border:"rgba(97,211,106,.18)" },
  "at-risk": { label:"AT RISK", color:"var(--amber)", bg:"rgba(255,177,66,.12)", border:"rgba(255,177,66,.18)" },
  cooked: { label:"COOKED", color:"var(--red)", bg:"rgba(255,91,91,.12)", border:"rgba(255,91,91,.18)" },
  new: { label:"NEW", color:"#050909", bg:"#4ECDC4", border:"rgba(78,205,196,.55)" }
};

const resolveStatus = (count, target) => {
  if (count >= target) return "locked-in";
  if (count >= Math.ceil(target * 0.65)) return "on-track";
  if (count >= Math.ceil(target * 0.35)) return "at-risk";
  return "cooked";
};

const StatusPill = ({status}) => {
  const meta = statusMeta[status] || statusMeta["on-track"];
  return React.createElement('span',{
    style:{
      display:"inline-flex",
      alignItems:"center",
      justifyContent:"center",
      minWidth:56,
      padding:"4px 8px",
      borderRadius:999,
      background:meta.bg,
      border:`0.5px solid ${meta.border}`,
      color:meta.color,
      fontFamily:"'Outfit', sans-serif",
      fontSize:9.5,
      fontWeight:900,
      letterSpacing:".08em",
      lineHeight:1,
      whiteSpace:"nowrap"
    }
  }, meta.label);
};

const getMemberRows = ({group, currentUserId, profilePhotoByUserId}) => {
  const target = Number(group?.settings?.minTarget || group?.target || MIN_TARGET);
  const memberships = Object.values(group?.memberships || {}).filter(member => String(member?.displayName || "").trim());
  return memberships
    .filter(member => member.userId !== currentUserId)
    .map(member => {
    const name = member.displayName;
    const count = getCountedLogCount(group?.logs?.[name] || []);
    return {
      userId: member.userId || "",
      name,
      count,
      status: resolveStatus(count, target),
      photoUrl: profilePhotoByUserId?.[member.userId]?.profilePhotoUrl || ""
    };
  })
    .sort((a,b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 3);
};

const InviteWelcomeScreen = ({group, currentUserId, profilePhotoByUserId, onContinue}) => {
  const target = Number(group?.settings?.minTarget || group?.target || MIN_TARGET);
  const rows = getMemberRows({group, currentUserId, profilePhotoByUserId});

  return React.createElement('main',{
    style:{
      minHeight:"100vh",
      padding:"calc(env(safe-area-inset-top) + 24px) 24px calc(env(safe-area-inset-bottom) + 28px)",
      display:"flex",
      flexDirection:"column",
      justifyContent:"center",
      background:"var(--bg-gradient)",
      backgroundImage:"var(--bg-radial-hint), var(--bg-gradient)",
      color:"var(--text)"
    }
  },
    React.createElement('section',{
      style:{width:"100%",maxWidth:420,margin:"0 auto",display:"grid",gap:20}
    },
      React.createElement('div',{style:{display:"grid",gap:13,justifyItems:"center",textAlign:"center"}},
        React.createElement(AnteWordmark,{size:70}),
        React.createElement('h1',{style:{margin:0,fontFamily:"'Raleway', sans-serif",fontSize:32,fontWeight:900,lineHeight:1,letterSpacing:".02em",color:"#4ECDC4",textTransform:"uppercase"}},
          "YOU'RE IN"
        ),
        React.createElement('p',{style:{margin:0,maxWidth:340,fontFamily:"'Outfit', sans-serif",fontSize:12,fontWeight:800,lineHeight:1.42,color:"var(--text-soft)",textAlign:"center"}},
          React.createElement('span',{style:{display:"block"}},`Your Bloc's target: ${target} workouts`),
          React.createElement('span',{style:{display:"block"}}, "Log your first one and get on the board.")
        )
      ),
      React.createElement('div',{
        style:{
          borderRadius:18,
          overflow:"hidden",
          background:"rgba(8,15,15,.88)",
          border:"0.5px solid rgba(78,205,196,.2)",
          boxShadow:"0 20px 54px rgba(0,0,0,.32), 0 0 28px rgba(78,205,196,.07)"
        }
      },
        React.createElement('div',{style:{padding:"12px 15px",borderBottom:"0.5px solid rgba(78,205,196,.14)",fontFamily:"'Outfit', sans-serif",fontSize:10,fontWeight:900,letterSpacing:".12em",color:"#4ECDC4",textAlign:"left"}},
          "BLOC LEADERBOARD"
        ),
        rows.map((row, index) => React.createElement('div',{
          key:`${row.userId || row.name}-${index}`,
          style:{
            display:"grid",
            gridTemplateColumns:"24px 32px minmax(0,1fr) auto 28px",
            alignItems:"center",
            gap:9,
            padding:"11px 14px",
            background:"transparent",
            borderBottom:index < rows.length - 1 ? "0.5px solid rgba(78,205,196,.1)" : "none"
          }
        },
          React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:12,fontWeight:900,color:"var(--muted)",textAlign:"right"}},`#${index + 1}`),
          React.createElement(Avatar,{name:row.name,userId:row.userId,photoUrl:row.photoUrl,size:31}),
          React.createElement('div',{style:{minWidth:0,fontFamily:"'Outfit', sans-serif",fontSize:15,fontWeight:900,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},row.name),
          React.createElement(StatusPill,{status:row.status}),
          React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:16,fontWeight:900,color:"#4ECDC4",textAlign:"right"}},row.count)
        ))
      ),
      React.createElement('button',{
        type:"button",
        className:"setup-press",
        onClick:onContinue,
        style:{
          width:"100%",
          minHeight:54,
          borderRadius:16,
          background:"#4ECDC4",
          color:"#050909",
          fontFamily:"'Outfit', sans-serif",
          fontSize:16,
          fontWeight:900,
          boxShadow:"0 18px 44px rgba(78,205,196,.24)"
        }
      },"Go To Bloc")
    )
  );
};

export { InviteWelcomeScreen };
