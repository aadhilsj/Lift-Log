import React from "react";
import { AppIcon, AnteWordmark, WorkoutTypeIcon } from "./primitives.jsx";

const { useRef, useState } = React;

const ONBOARDING_SCREENS = [
  {
    headlineLines: ["For the Bloc that", "keeps you showing up."],
    subtextLines: ["A monthly target.", "A live leaderboard.", "Progress everyone can see."]
  },
  {
    headlineLines: ["Pick your people."],
    subtext: "Hold each other accountable."
  },
  {
    headlineLines: ["Set a target. Set a penalty."],
    subtext: "Miss it, and you owe. Hit it, and you're cleared."
  },
  {
    headlineLines: ["Show up together.", "Or pay up."],
    subtext: "Start a Bloc. Bring your mates in.",
    highlight: "Consistency's a group sport."
  }
];

const statusStyles = {
  "AT RISK": { bg:"#1E1808", fg:"#D4A843", border:"#3D3010" },
  "ON TRACK": { bg:"rgba(90,191,90,.14)", fg:"#5ABF5A", border:"rgba(90,191,90,.35)" },
  "CLEARED": { bg:"linear-gradient(90deg, rgba(203,213,225,.08) 0%, rgba(203,213,225,.35) 100%)", fg:"#E2E8F0", border:"#2a2d31" },
  "COOKED": { bg:"rgba(212,74,74,.14)", fg:"#D44A4A", border:"#3B1818" }
};

const cardShell = {
  width:"100%",
  border:"0.5px solid rgba(22,61,54,.9)",
  borderRadius:18,
  background:"radial-gradient(circle at 78% 0%, rgba(78,205,196,.08), transparent 34%), rgba(6,16,14,.96)",
  boxShadow:"inset 0 1px 0 rgba(255,255,255,.06), 0 18px 46px rgba(0,0,0,.32), 0 0 0 1px rgba(78,205,196,.025)",
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

const PreviewAvatar = ({name,color,src}) => React.createElement('div',{
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
    fontWeight:900,
    overflow:"hidden",
    boxShadow:"inset 0 1px 0 rgba(255,255,255,.12), 0 4px 10px rgba(0,0,0,.18)"
  }
}, src
  ? React.createElement('img',{src,alt:"",loading:"lazy",referrerPolicy:"no-referrer",style:{width:"100%",height:"100%",objectFit:"cover",display:"block"}})
  : name[0]
);

const FakePhoto = ({src,label}) => {
  return React.createElement('div',{
    style:{
      width:78,
      height:78,
      borderRadius:14,
      background:"#0D1F1E",
      border:"0.5px solid rgba(255,255,255,.12)",
      boxShadow:"inset 0 1px 0 rgba(255,255,255,.08)",
      overflow:"hidden",
      flexShrink:0,
      position:"relative"
    }
  },
    React.createElement('img',{src,alt:"",loading:"lazy",style:{width:"100%",height:"100%",objectFit:"cover",display:"block"}}),
    React.createElement('div',{style:{position:"absolute",inset:0,background:"linear-gradient(180deg,transparent,rgba(0,0,0,.22))"}}),
    React.createElement('div',{style:{position:"absolute",left:8,bottom:7,fontSize:9,fontWeight:900,color:"rgba(255,255,255,.78)",letterSpacing:".08em",textTransform:"uppercase"}},label)
  );
};

const LeaderboardPreview = () => {
  const rows = [
    { name:"Tariq", status:"CLEARED", color:"#D94D68", count:14, avatar:"https://images.unsplash.com/photo-1659355750585-91f409e492eb?auto=format&fit=crop&w=96&h=96&q=80" },
    { name:"Hana", status:"ON TRACK", color:"#F2A83A", count:10, avatar:"https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=96&h=96&q=80" },
    { name:"Noah", status:"AT RISK", color:"#8A78D6", count:7, avatar:"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=96&h=96&q=80" },
    { name:"Eli", status:"COOKED", color:"#C17F5A", count:3, avatar:"https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=96&h=96&q=80" }
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
          padding:"9px 6px",
          borderBottom:index<rows.length-1?"0.5px solid rgba(22,61,54,.5)":"none"
        }
      },
        React.createElement('span',{style:{fontFamily:"'Outfit',sans-serif",fontSize:12,fontWeight:900,color:"var(--muted)",textAlign:"center"}},`#${index+1}`),
        React.createElement(PreviewAvatar,{name:row.name,color:row.color,src:row.avatar}),
        React.createElement('span',{style:{minWidth:0,fontSize:16,fontWeight:900,color:"#f5f7ff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},row.name),
        React.createElement(StatusTag,{label:row.status}),
        React.createElement('span',{style:{fontFamily:"'Outfit',sans-serif",fontSize:18,fontWeight:900,color:"#4ECDC4",textAlign:"right"}},row.count)
      ))
    )
  );
};

const ActivityPreview = () => {
  const rows = [
    { name:"Axel", type:"Gym", color:"#8CA4C6", avatar:"https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?auto=format&fit=crop&w=96&h=96&q=80", photo:"https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=240&q=80", time:"2h", note:"Chest day done" },
    { name:"Monica", type:"Run", color:"#8A78D6", avatar:"https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=96&h=96&q=80", photo:"https://images.unsplash.com/photo-1502904550040-7534597429ae?auto=format&fit=crop&w=240&q=80", time:"5h", note:"5K this morning" },
    { name:"Mina", type:"Sports", color:"#D94D68", avatar:"https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=96&h=96&q=80", photo:"https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=240&q=80", time:"8h", note:"Pickup hoops" }
  ];
  return React.createElement('div',{style:cardShell},
    React.createElement('div',{style:{padding:"16px",borderBottom:"0.5px solid rgba(22,61,54,.7)"}},
      React.createElement('div',{style:previewLabel},"ACTIVITY FEED")
    ),
    React.createElement('div',{style:{padding:"10px 12px"}},
      rows.map((row,index)=>React.createElement('div',{
        key:row.name,
        style:{
          display:"grid",
          gridTemplateColumns:"30px minmax(0,1fr) 78px",
          alignItems:"center",
          gap:10,
          padding:"10px 0",
          borderBottom:index<rows.length-1?"0.5px solid rgba(22,61,54,.5)":"none"
        }
      },
        React.createElement(PreviewAvatar,{name:row.name,color:row.color,src:row.avatar}),
        React.createElement('div',{style:{minWidth:0,alignSelf:"stretch",display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"2px 0"}},
          React.createElement('div',null,
            React.createElement('div',{style:{display:"flex",alignItems:"center",gap:7,minWidth:0}},
              React.createElement('span',{style:{fontSize:15,fontWeight:900,color:"#f5f7ff",lineHeight:1.15,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},row.name),
              React.createElement('span',{style:{color:"#4ECDC4",display:"inline-flex",flexShrink:0}},React.createElement(WorkoutTypeIcon,{type:row.type,size:12})),
              React.createElement('span',{style:{fontSize:12,fontWeight:700,color:"rgba(143,174,170,.78)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},row.type)
            ),
            React.createElement('div',{style:{fontSize:12,fontWeight:700,color:"rgba(214,226,224,.65)",marginTop:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},row.note)
          ),
          React.createElement('div',{style:{display:"flex",alignItems:"center",gap:7}},
            React.createElement('span',{style:{height:24,padding:"0 9px",borderRadius:999,border:"0.5px solid rgba(78,205,196,.35)",background:"rgba(78,205,196,.08)",display:"inline-flex",alignItems:"center",gap:5,fontSize:12,color:"#4ECDC4",fontWeight:800}},"🔥",index+1),
            React.createElement('span',{style:{width:24,height:24,borderRadius:999,border:"0.5px solid rgba(22,61,54,.9)",display:"inline-flex",alignItems:"center",justifyContent:"center",color:"rgba(143,174,170,.75)",fontSize:16,lineHeight:1}},"+")
          )
        ),
        React.createElement('div',{style:{position:"relative"}},
          React.createElement('span',{style:{position:"absolute",left:-26,top:4,fontFamily:"'Outfit',sans-serif",fontSize:10,fontWeight:800,color:"rgba(143,174,170,.68)"}},row.time),
          React.createElement(FakePhoto,{src:row.photo,label:row.type})
        )
      ))
    )
  );
};

const SettlementResultCard = ({tone,tag,stat,line,rows}) => {
  const winner = tone === "winner";
  const heroStyle = winner
    ? {background:"rgba(57,168,90,.11)",border:"1px solid rgba(57,168,90,.24)"}
    : {background:"rgba(185,50,50,.07)",border:"1px solid rgba(185,50,50,.18)"};
  const labelGradient = winner
    ? "linear-gradient(135deg, #DDFDE9, #39A85A 54%, #1E7C3D)"
    : "linear-gradient(135deg, #FFD8D8, #E65A5A 50%, #A92F2F)";
  const statColor = winner ? "#39A85A" : "#E65A5A";
  return React.createElement('div',{
    style:{
      ...heroStyle,
      borderRadius:15,
      padding:"14px 13px",
      textAlign:"center",
      boxShadow:"inset 0 1px 0 rgba(255,255,255,.05)"
    }
  },
    React.createElement('div',{style:{display:"inline-block",fontFamily:"'Outfit',sans-serif",fontSize:10,fontWeight:900,letterSpacing:".08em",textTransform:"uppercase",background:labelGradient,WebkitBackgroundClip:"text",backgroundClip:"text",color:"transparent"}},tag),
    React.createElement('div',{style:{fontFamily:"'Outfit',sans-serif",fontSize:34,lineHeight:1,fontWeight:900,color:statColor,marginTop:5}},stat),
    React.createElement('div',{style:{fontSize:12,fontWeight:700,color:"rgba(214,226,224,.72)",lineHeight:1.3,marginTop:5}},line),
    React.createElement('div',{style:{width:"44%",height:1,margin:"10px auto 8px",background:"linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent)"}}),
    React.createElement('div',{style:{display:"grid",gap:5}},
      rows.map(row=>React.createElement('div',{key:row.name,style:{display:"flex",alignItems:"center",justifyContent:"center",gap:8,minWidth:0}},
        React.createElement('span',{style:{fontSize:12,fontWeight:900,color:"#f5f7ff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:116}},row.name),
        React.createElement('span',{style:{fontFamily:"'Outfit',sans-serif",fontSize:12,fontWeight:900,color:statColor,whiteSpace:"nowrap"}},row.amount)
      ))
    )
  );
};

const SettlementPreview = () => {
  return React.createElement('div',{style:cardShell},
    React.createElement('div',{style:{padding:"16px",borderBottom:"0.5px solid rgba(22,61,54,.7)"}},
      React.createElement('div',{style:previewLabel},"THE SETTLEMENT")
    ),
    React.createElement('div',{style:{padding:"12px 14px",display:"grid",gap:12}},
      React.createElement(SettlementResultCard,{
        tone:"winner",
        tag:"Winner",
        stat:"+$25",
        line:"Top of the Bloc. Maya and Leo pay you.",
        rows:[
          { name:"Maya", amount:"+$15" },
          { name:"Leo", amount:"+$10" }
        ]
      }),
      React.createElement('div',{style:{height:1,width:"58%",justifySelf:"center",background:"linear-gradient(90deg, transparent, rgba(143,174,170,.22), transparent)"}}),
      React.createElement(SettlementResultCard,{
        tone:"missed",
        tag:"Tough Month",
        stat:"-$20",
        line:"You missed the target. Bounce back next month.",
        rows:[
          { name:"You owe Noah", amount:"-$20" }
        ]
      })
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
        placeholder:"Type your Bloc name",
        style:{
          width:"100%",
          boxSizing:"border-box",
          height:50,
          borderRadius:16,
          background:"linear-gradient(180deg, rgba(18,27,34,.98), rgba(12,22,24,.98))",
          border:"0.5px solid rgba(78,205,196,.52)",
          boxShadow:"0 0 0 3px rgba(78,205,196,.1), inset 0 1px 0 rgba(255,255,255,.08), 0 12px 24px rgba(0,0,0,.2)",
          color:"#f5f7ff",
          caretColor:"#4ECDC4",
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
          background:index===0?"rgba(78,205,196,.16)":"rgba(8,15,15,.42)",
          border:index===0?"0.5px solid rgba(78,205,196,.5)":"0.5px dashed rgba(143,174,170,.28)",
          color:index===0?"#4ECDC4":"rgba(143,174,170,.42)",
          fontFamily:"'Outfit',sans-serif",
          fontSize:index===0?10:14,
          fontWeight:900,
          letterSpacing:index===0?".06em":0,
          pointerEvents:"none"
        }
      }, index===0?"YOU":React.createElement('span',{style:{transform:"translateY(-1px)",opacity:.62}},"+")))
    )
  );
};

const RoundNavButton = ({direction,onClick,disabled=false,hidden=false}) => React.createElement('button',{
  type:"button",
  onClick,
  disabled:disabled || hidden,
  style:{
    width:42,
    height:42,
    borderRadius:999,
    display:"inline-flex",
    alignItems:"center",
    justifyContent:"center",
    background:direction==="next"?"#4ECDC4":"rgba(13,31,30,.86)",
    color:direction==="next"?"#04100f":"#4ECDC4",
    border:direction==="next"?"none":"0.5px solid rgba(78,205,196,.25)",
    boxShadow:direction==="next"?"0 10px 24px rgba(78,205,196,.18)":"inset 0 1px 0 rgba(255,255,255,.04)",
    cursor:disabled||hidden?"default":"pointer",
    opacity:hidden ? 0 : (disabled ? .45 : 1),
    pointerEvents:hidden?"none":"auto"
  },
  "aria-label":direction==="next"?"Next onboarding screen":"Previous onboarding screen"
}, React.createElement(AppIcon,{name:direction==="next"?"chevron-right":"chevron-left",size:18,stroke:"currentColor"}));

const ProgressControls = ({index,onNext,onPrev}) => React.createElement('div',{
  style:{display:"grid",gridTemplateColumns:"42px 1fr 42px",alignItems:"center",gap:16,width:"100%"}
},
  React.createElement(RoundNavButton,{direction:"prev",onClick:onPrev,disabled:index===0}),
  React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"center",gap:7}},
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
  React.createElement(RoundNavButton,{direction:"next",onClick:onNext,hidden:index>=ONBOARDING_SCREENS.length-1})
);

const ColdOnboarding = ({onCreate,onJoin}) => {
  const [index,setIndex] = useState(0);
  const [blocName,setBlocName] = useState("");
  const touchRef = useRef({sx:0,sy:0,active:false});
  const suppressTapRef = useRef(false);
  const screen = ONBOARDING_SCREENS[index];
  const goNext = () => setIndex(current => Math.min(ONBOARDING_SCREENS.length - 1, current + 1));
  const goPrev = () => setIndex(current => Math.max(0, current - 1));
  const handleTapNav = event => {
    if (suppressTapRef.current) {
      suppressTapRef.current = false;
      return;
    }
    if (event.defaultPrevented) return;
    if (event.target?.closest?.("button,input,textarea,select,a,label")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const leftZone = bounds.width * .42;
    const rightZone = bounds.width * .58;
    if (x <= leftZone) goPrev();
    if (x >= rightZone) goNext();
  };
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
    suppressTapRef.current = true;
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
  const moveSubtextBelowPreview = index === 1 || index === 2;
  const headlineFontSize = index === 2 ? "clamp(23px, 7.25vw, 29px)" : 34;
  const renderSubtext = (options = {}) => React.createElement('p',{
    style:{
      margin:options.below ? "16px 0 0" : "12px 0 0",
      textAlign:"center",
      fontSize:16,
      lineHeight:1.45,
      fontWeight:600,
      color:"rgba(214,226,224,.72)"
    }
  },
    screen.subtextLines
      ? screen.subtextLines.map(line=>React.createElement('span',{key:line,style:{display:"block"}},line))
      : screen.subtext,
    screen.highlight && React.createElement('span',{style:{display:"block",marginTop:4,fontWeight:900,color:"transparent",background:"linear-gradient(90deg,#E2E8F0 0%,#4ECDC4 42%,#F5A623 76%,#E2E8F0 100%)",WebkitBackgroundClip:"text",backgroundClip:"text",textShadow:"0 0 18px rgba(78,205,196,.12)"}},screen.highlight)
  );

  return React.createElement('main',{
    onClick:handleTapNav,
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
      style:{flex:1,minHeight:0,display:"flex",flexDirection:"column",justifyContent:"center",maxWidth:520,width:"100%",margin:"0 auto",animation:"fadeUp .22s ease both"}
    },
      React.createElement('div',{style:{marginBottom:index===0?16:22}},
        React.createElement('h1',{style:{margin:0,textAlign:"center",fontSize:headlineFontSize,lineHeight:1.02,letterSpacing:0,fontWeight:900,color:"#f5f7ff"}},
          (screen.headlineLines || [screen.headline]).map(line=>React.createElement('span',{key:line,style:{display:"block",whiteSpace:"nowrap"}},line))
        ),
        index !== 0 && !moveSubtextBelowPreview && renderSubtext()
      ),
      preview,
      moveSubtextBelowPreview && renderSubtext({ below:true, center:true }),
      index === 0 && React.createElement('p',{style:{margin:"16px 0 0",textAlign:"center",fontSize:15,lineHeight:1.42,fontWeight:700,color:"rgba(214,226,224,.72)"}},
        React.createElement('span',{style:{display:"block",whiteSpace:"nowrap"}},"A monthly target. A live leaderboard."),
        React.createElement('span',{style:{display:"block",whiteSpace:"nowrap"}},"Progress everyone can see.")
      ),
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
        },"Join an existing Bloc instead")
      )
    ),
    React.createElement('div',{style:{maxWidth:520,width:"100%",margin:"22px auto 0",flexShrink:0}},
      React.createElement(ProgressControls,{index,onNext:goNext,onPrev:goPrev})
    )
  );
};

export { ColdOnboarding };
