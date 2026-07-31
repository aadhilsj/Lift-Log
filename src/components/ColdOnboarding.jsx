import React from "react";
import { AppIcon, AnteWordmark, WorkoutTypeIcon } from "./primitives.jsx";

const { useMemo, useRef, useState } = React;

const ONBOARDING_SCREENS = [
  {
    headline: "For the group that keeps you showing up.",
    subtext: "A monthly goal. Your people. Something real on the line."
  },
  {
    headline: "Pick your people.",
    subtext: "You hold each other to it."
  },
  {
    headline: "Set a target. Set a penalty.",
    subtext: "Miss it, and you owe. Hit it, and you don't."
  },
  {
    headline: "Show up together. Or pay up.",
    subtext: "Start a Bloc. Invite your people. Consistency's a group sport."
  }
];

const statusStyles = {
  "AT RISK": { bg:"#1E1808", fg:"#D4A843", border:"#3D3010" },
  "ON TRACK": { bg:"rgba(90,191,90,.14)", fg:"#5ABF5A", border:"rgba(90,191,90,.35)" },
  "LOCKED IN": { bg:"linear-gradient(90deg, rgba(203,213,225,.08) 0%, rgba(203,213,225,.35) 100%)", fg:"#E2E8F0", border:"#2a2d31" }
};

const cardShell = {
  width:"100%",
  border:"0.5px solid rgba(22,61,54,.9)",
  borderRadius:18,
  background:"radial-gradient(circle at 78% 0%, rgba(78,205,196,.08), transparent 34%), rgba(6,16,14,.96)",
  boxShadow:"inset 0 1px 0 rgba(255,255,255,.05), 0 18px 42px rgba(0,0,0,.26)",
  overflow:"hidden"
};

const previewLabel = {
  fontFamily:"'Outfit',sans-serif",
  fontSize:10,
  fontWeight:900,
  letterSpacing:".12em",
  textTransform:"uppercase",
  color:"rgba(78,205,196,.7)"
};

const StatusTag = ({label}) => {
  const style = statusStyles[label] || statusStyles["AT RISK"];
  return React.createElement('span',{
    style:{
      display:"inline-flex",
      alignItems:"center",
      justifyContent:"center",
      minWidth:70,
      padding:"3px 8px",
      borderRadius:999,
      background:style.bg,
      border:`0.5px solid ${style.border}`,
      color:style.fg,
      fontFamily:"'Outfit',sans-serif",
      fontSize:9,
      fontWeight:900,
      letterSpacing:".06em",
      textTransform:"uppercase",
      whiteSpace:"nowrap"
    }
  }, label);
};

const PreviewAvatar = ({name,color}) => React.createElement('div',{
  style:{
    width:30,
    height:30,
    borderRadius:999,
    display:"inline-flex",
    alignItems:"center",
    justifyContent:"center",
    flexShrink:0,
    background:color,
    color:"#fff",
    fontFamily:"'Outfit',sans-serif",
    fontSize:12,
    fontWeight:900
  }
}, name[0]);

const LeaderboardPreview = () => {
  const rows = [
    { name:"Aysha", status:"LOCKED IN", color:"#D94D68", count:14 },
    { name:"Kisal", status:"ON TRACK", color:"#F2A83A", count:10 },
    { name:"Rishane", status:"AT RISK", color:"#8A78D6", count:7 }
  ];
  return React.createElement('div',{style:cardShell},
    React.createElement('div',{style:{padding:"16px 16px 10px",borderBottom:"0.5px solid rgba(22,61,54,.7)"}},
      React.createElement('div',{style:previewLabel},"SUNDAY WARRIORS · BLOC LEADERBOARD")
    ),
    React.createElement('div',{style:{padding:"8px 10px"}},
      rows.map((row,index)=>React.createElement('div',{
        key:row.name,
        style:{
          display:"grid",
          gridTemplateColumns:"24px 30px minmax(0,1fr) auto 30px",
          alignItems:"center",
          gap:10,
          padding:"10px 6px",
          borderBottom:index<rows.length-1?"0.5px solid rgba(22,61,54,.5)":"none"
        }
      },
        React.createElement('span',{style:{fontFamily:"'Outfit',sans-serif",fontSize:12,fontWeight:900,color:"var(--muted)",textAlign:"center"}},`#${index+1}`),
        React.createElement(PreviewAvatar,{name:row.name,color:row.color}),
        React.createElement('span',{style:{minWidth:0,fontSize:16,fontWeight:900,color:"#f5f7ff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},row.name),
        React.createElement(StatusTag,{label:row.status}),
        React.createElement('span',{style:{fontFamily:"'Outfit',sans-serif",fontSize:18,fontWeight:900,color:"#4ECDC4",textAlign:"right"}},row.count)
      ))
    )
  );
};

const ActivityPreview = () => {
  const rows = [
    { name:"Nishara", type:"Gym", color:"#8CA4C6" },
    { name:"Varun", type:"Run", color:"#8A78D6" },
    { name:"Biankovic", type:"Sports", color:"#D94D68" }
  ];
  return React.createElement('div',{style:cardShell},
    React.createElement('div',{style:{padding:"16px",borderBottom:"0.5px solid rgba(22,61,54,.7)"}},
      React.createElement('div',{style:previewLabel},"ACTIVITY FEED")
    ),
    React.createElement('div',{style:{padding:"10px 14px"}},
      rows.map((row,index)=>React.createElement('div',{
        key:row.name,
        style:{
          display:"flex",
          alignItems:"center",
          gap:11,
          padding:"11px 0",
          borderBottom:index<rows.length-1?"0.5px solid rgba(22,61,54,.5)":"none"
        }
      },
        React.createElement(PreviewAvatar,{name:row.name,color:row.color}),
        React.createElement('div',{style:{minWidth:0,flex:1}},
          React.createElement('div',{style:{fontSize:15,fontWeight:900,color:"#f5f7ff",lineHeight:1.15}},row.name),
          React.createElement('div',{style:{display:"flex",alignItems:"center",gap:7,marginTop:4,color:"var(--muted)",fontSize:12,fontWeight:700}},
            React.createElement('span',{style:{color:"#4ECDC4",display:"inline-flex"}},React.createElement(WorkoutTypeIcon,{type:row.type,size:13})),
            React.createElement('span',null,`${row.type} logged`)
          )
        ),
        React.createElement('span',{style:{fontFamily:"'Outfit',sans-serif",fontSize:11,fontWeight:800,color:"rgba(143,174,170,.65)"}},"today")
      ))
    )
  );
};

const SettlementPreview = () => {
  const month = useMemo(() => new Date().toLocaleString("en-US", { month:"long" }).toUpperCase(), []);
  const rows = [
    "Rishane owes Kisal $25",
    "Aysha owes Nishara $15",
    "You owe $0"
  ];
  return React.createElement('div',{style:cardShell},
    React.createElement('div',{style:{padding:"16px",borderBottom:"0.5px solid rgba(22,61,54,.7)"}},
      React.createElement('div',{style:previewLabel},`THE SETTLEMENT · ${month}`)
    ),
    React.createElement('div',{style:{padding:"12px 14px",display:"grid",gap:9}},
      rows.map((row,index)=>React.createElement('div',{
        key:row,
        style:{
          display:"flex",
          alignItems:"center",
          justifyContent:"space-between",
          gap:12,
          border:"0.5px solid rgba(22,61,54,.62)",
          borderRadius:12,
          background:index===2?"rgba(78,205,196,.08)":"rgba(8,15,15,.9)",
          padding:"10px 12px"
        }
      },
        React.createElement('span',{style:{fontSize:14,fontWeight:800,color:index===2?"#4ECDC4":"#f5f7ff"}},row),
        React.createElement('span',{style:{fontFamily:"'Outfit',sans-serif",fontSize:11,fontWeight:900,color:"rgba(143,174,170,.7)",letterSpacing:".08em",textTransform:"uppercase"}},index===2?"Clear":"Due")
      ))
    )
  );
};

const BlocStarterPreview = ({blocName,setBlocName}) => {
  return React.createElement('div',{style:{...cardShell,padding:16,boxSizing:"border-box"}},
    React.createElement('label',{style:{display:"block",marginBottom:16}},
      React.createElement('div',{style:{...previewLabel,marginBottom:8}},"BLOC NAME"),
      React.createElement('input',{
        value:blocName,
        onChange:event=>setBlocName(event.target.value),
        placeholder:"Sunday Warriors",
        style:{
          width:"100%",
          boxSizing:"border-box",
          height:50,
          borderRadius:16,
          background:"#10151d",
          border:"0.5px solid rgba(78,205,196,.32)",
          boxShadow:"0 0 0 3px rgba(78,205,196,.06)",
          color:"#f5f7ff",
          fontSize:17,
          fontWeight:800,
          outline:"none",
          padding:"0 15px"
        }
      })
    ),
    React.createElement('div',{style:{...previewLabel,marginBottom:10}},"INVITE SLOTS"),
    React.createElement('div',{style:{display:"flex",alignItems:"center",gap:10}},
      [0,1,2,3,4].map(index=>React.createElement('div',{
        key:index,
        style:{
          width:44,
          height:44,
          borderRadius:999,
          display:"inline-flex",
          alignItems:"center",
          justifyContent:"center",
          flexShrink:0,
          background:index===0?"rgba(78,205,196,.16)":"rgba(8,15,15,.5)",
          border:index===0?"0.5px solid rgba(78,205,196,.5)":"0.5px dashed rgba(78,205,196,.35)",
          color:index===0?"#4ECDC4":"rgba(78,205,196,.55)",
          fontFamily:"'Outfit',sans-serif",
          fontSize:index===0?10:18,
          fontWeight:900,
          letterSpacing:index===0?".06em":0
        }
      }, index===0?"YOU":"+"))
    )
  );
};

const ProgressControls = ({index,onNext}) => React.createElement('div',{
  style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,width:"100%",marginTop:22}
},
  React.createElement('div',{style:{display:"flex",alignItems:"center",gap:7}},
    ONBOARDING_SCREENS.map((_,dotIndex)=>React.createElement('span',{
      key:dotIndex,
      style:{
        width:dotIndex===index?20:7,
        height:7,
        borderRadius:999,
        background:dotIndex===index?"#4ECDC4":"rgba(143,174,170,.28)",
        transition:"width .18s ease, background .18s ease"
      }
    }))
  ),
  index < ONBOARDING_SCREENS.length - 1 && React.createElement('button',{
    type:"button",
    onClick:onNext,
    style:{
      width:48,
      height:48,
      borderRadius:999,
      display:"inline-flex",
      alignItems:"center",
      justifyContent:"center",
      background:"#4ECDC4",
      color:"#04100f",
      border:"none",
      boxShadow:"0 12px 28px rgba(78,205,196,.22)",
      cursor:"pointer"
    },
    "aria-label":"Next onboarding screen"
  }, React.createElement(AppIcon,{name:"chevron-right",size:22,stroke:"currentColor"}))
);

const ColdOnboarding = ({onCreate,onJoin}) => {
  const [index,setIndex] = useState(0);
  const [blocName,setBlocName] = useState("");
  const touchRef = useRef({sx:0,sy:0,active:false});
  const screen = ONBOARDING_SCREENS[index];
  const goNext = () => setIndex(current => Math.min(ONBOARDING_SCREENS.length - 1, current + 1));
  const goPrev = () => setIndex(current => Math.max(0, current - 1));
  const handleTouchStart = event => {
    const touch = event.touches?.[0];
    if (!touch) return;
    touchRef.current = { sx:touch.clientX, sy:touch.clientY, active:true };
  };
  const handleTouchEnd = event => {
    if (!touchRef.current.active) return;
    const touch = event.changedTouches?.[0];
    const sx = touchRef.current.sx;
    const sy = touchRef.current.sy;
    touchRef.current.active = false;
    if (!touch) return;
    const dx = touch.clientX - sx;
    const dy = touch.clientY - sy;
    if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  const preview = index === 0
    ? React.createElement(LeaderboardPreview)
    : index === 1
      ? React.createElement(ActivityPreview)
      : index === 2
        ? React.createElement(SettlementPreview)
        : React.createElement(BlocStarterPreview,{blocName,setBlocName});

  return React.createElement('main',{
    onTouchStart:handleTouchStart,
    onTouchEnd:handleTouchEnd,
    style:{
      minHeight:"100vh",
      boxSizing:"border-box",
      padding:"calc(env(safe-area-inset-top) + 22px) 22px calc(env(safe-area-inset-bottom) + 28px)",
      background:"radial-gradient(circle at 72% 12%, rgba(78,205,196,.13), transparent 32%), var(--bg-gradient)",
      backgroundImage:"radial-gradient(circle at 72% 12%, rgba(78,205,196,.13), transparent 32%), var(--bg-gradient)",
      display:"flex",
      flexDirection:"column",
      color:"#f5f7ff",
      overflow:"hidden"
    }
  },
    React.createElement('div',{style:{display:"flex",justifyContent:"flex-start",alignItems:"center",marginBottom:34}},
      React.createElement(AnteWordmark,{size:32})
    ),
    React.createElement('section',{
      key:index,
      className:"fu",
      style:{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",maxWidth:520,width:"100%",margin:"0 auto",animation:"fadeUp .22s ease both"}
    },
      React.createElement('div',{style:{marginBottom:22}},
        React.createElement('h1',{style:{margin:0,fontSize:38,lineHeight:1.02,letterSpacing:0,fontWeight:900,color:"#f5f7ff"}},screen.headline),
        React.createElement('p',{style:{margin:"12px 0 0",fontSize:16,lineHeight:1.45,fontWeight:600,color:"rgba(214,226,224,.72)"}},screen.subtext)
      ),
      preview,
      index === 3 && React.createElement('div',{style:{display:"grid",gap:10,marginTop:18}},
        React.createElement('button',{
          type:"button",
          onClick:()=>onCreate?.({ blocName }),
          style:{
            width:"100%",
            height:52,
            borderRadius:16,
            border:"none",
            background:"#4ECDC4",
            color:"#04100f",
            fontSize:16,
            fontWeight:900,
            boxShadow:"0 16px 34px rgba(78,205,196,.22)",
            cursor:"pointer"
          }
        },"Create your Bloc"),
        React.createElement('button',{
          type:"button",
          onClick:onJoin,
          style:{
            width:"100%",
            height:42,
            borderRadius:14,
            border:"none",
            background:"transparent",
            color:"rgba(78,205,196,.92)",
            fontSize:14,
            fontWeight:800,
            cursor:"pointer"
          }
        },"Join a Bloc instead")
      ),
      React.createElement(ProgressControls,{index,onNext:goNext})
    )
  );
};

export { ColdOnboarding };
