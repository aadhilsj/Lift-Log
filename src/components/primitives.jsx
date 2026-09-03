import React from "react";
import { createPortal } from "react-dom";
const { useState, useEffect, useMemo, useCallback, useRef } = React;
import {
  WORKOUT_TYPES,
  avatarColor,
  resolveAvatarPhotoUrl,
  resolveStorageImageUrl
} from "../lib/appState.js";
import {
  isMobile
} from "../lib/utils.js";
import { getWorkoutIcon } from "../lib/workoutIcons.js";
import { PlayerProfile } from "../pages/PlayerProfile.jsx";
import { TodayPage } from "../pages/TodayPage.jsx";
import { App } from "../App.jsx";

const Avatar = ({name,size=32,muted=false,userId="",photoUrl=""}) => {
  const resolvedPhotoUrl = String(photoUrl || resolveAvatarPhotoUrl(name, userId) || "").trim();
  const displayPhotoUrl = resolveStorageImageUrl(resolvedPhotoUrl);
  const label = String(name || "?").trim() || "?";
  const commonStyle = {
    width:size,
    height:size,
    borderRadius:"50%",
    background:muted?"var(--s3)":avatarColor(label, userId),
    display:"flex",
    alignItems:"center",
    justifyContent:"center",
    fontFamily:"'Outfit',sans-serif",
    fontWeight:800,
    fontSize:size*.38,
    color:muted?"var(--muted)":"#fff",
    flexShrink:0,
    overflow:"hidden"
  };
  if (resolvedPhotoUrl && !muted) {
    return React.createElement('div',{style:commonStyle},
      React.createElement('img',{src:displayPhotoUrl,alt:"",loading:"eager",decoding:"async",style:{width:"100%",height:"100%",objectFit:"cover",display:"block"}})
    );
  }
  return React.createElement('div',{style:commonStyle},label[0]);
};


const CategoryIcon = ({category,size=22,color="#4ECDC4"}) => {
  // Artwork comes from the shared table in lib/workoutIcons.js, which the share sticker
  // renders from too. Adding a workout type means adding one entry there — this component
  // needs no change. (These used to be two hand-maintained copies, and they had drifted.)
  const spec = getWorkoutIcon(category);
  if (!spec) return null;
  const [minX,minY,vbW,vbH] = spec.vb;
  const shape = (sh,i) => sh.circle
    ? React.createElement('circle',{key:i,cx:sh.circle[0],cy:sh.circle[1],r:sh.circle[2]})
    : React.createElement('path',{key:i,d:sh.d});
  const props = spec.kind === "stroke"
    ? { fill:"none", stroke:color, strokeWidth:String(spec.w), strokeLinecap:"round", strokeLinejoin:"round" }
    : { fill:color };
  return React.createElement('svg',Object.assign({
    width:size, height:size,
    viewBox:`${minX} ${minY} ${vbW} ${vbH}`,
    xmlns:"http://www.w3.org/2000/svg"
  },props), spec.shapes.map(shape));
};


const WorkoutTypeIcon = ({type,size=16,color="currentColor"}) => (
  React.createElement(CategoryIcon,{category:type,size,color})
);


const ChevronRightIcon = ({size=10,color="#3d5e59"}) => (
  React.createElement('svg',{
    width:size,
    height:size,
    viewBox:"0 0 24 24",
    fill:"none",
    stroke:color,
    strokeWidth:"2.2",
    strokeLinecap:"round",
    strokeLinejoin:"round",
    'aria-hidden':"true"
  },
    React.createElement('path',{d:"M9 6l6 6l-6 6"})
  )
);


// Every inline member label - Training, Solo, Prorated month - in one place.
// The spec is StatusBadge's: Outfit 700 at 9px, the app's label voice. These
// used to be JetBrains Mono pills asking for weight 800, which index.html does
// not load, so the browser faked the bold. Mono is the data font here (counts,
// amounts, ranks); labels are Outfit, and the colour carries the meaning
// without needing a border around it.
const MEMBER_TAG_TONES = {
  training: "#f5c842",
  solo: "#4ECDC4",
  prorated: "var(--muted)"
};

const MemberTag = ({tone="prorated",children}) => React.createElement('span',{
  style:{
    fontFamily:"'Outfit',sans-serif",
    fontSize:8,
    fontWeight:700,
    letterSpacing:".04em",
    textTransform:"uppercase",
    color:MEMBER_TAG_TONES[tone] || MEMBER_TAG_TONES.prorated,
    whiteSpace:"nowrap",
    flexShrink:0
  }
}, children);

// Training and Solo marks. Filled silhouettes with no interior gaps, because a
// hollow or dashed shape at 13px is just a smudge - and hollow-versus-filled is
// already the shield's own language, which these must never borrow.
//
// Each is scaled so its drawn area covers roughly the same share of the 24x24
// box as the shield does. Drawn at their natural size they filled about 30% to
// the shield's 56%, and sitting beside it they read as undersized.
const TrainingSproutIcon = ({size=13,color="#f5c842"}) => React.createElement('svg',{
  width:size, height:size, viewBox:"0 0 24 24", role:"img", "aria-label":"Training wheels",
  style:{flexShrink:0,display:"block"}
},
  React.createElement('g',{transform:"translate(12,11.5) scale(1.35) translate(-12,-12)"},
    React.createElement('path',{d:"M12 21 V12.4",fill:"none",stroke:color,strokeWidth:"1.9",strokeLinecap:"round"}),
    React.createElement('path',{d:"M11.6 13.2 C8.2 13.2 6.2 11 6.2 7.7 C9.6 7.7 11.6 9.9 11.6 13.2 Z",fill:color}),
    React.createElement('path',{d:"M12.4 11.6 C12.4 8.3 14.4 6.1 17.8 6.1 C17.8 9.4 15.8 11.6 12.4 11.6 Z",fill:color})
  )
);

const SoloFlagIcon = ({size=13,color="#4ECDC4"}) => React.createElement('svg',{
  width:size, height:size, viewBox:"0 0 24 24", role:"img", "aria-label":"Solo mode",
  style:{flexShrink:0,display:"block"}
},
  React.createElement('g',{transform:"translate(12,12) scale(1.34) translate(-12,-12)"},
    React.createElement('path',{d:"M7.4 20.4 V4.4",fill:"none",stroke:color,strokeWidth:"1.9",strokeLinecap:"round"}),
    React.createElement('path',{d:"M8.6 5 H18.4 l-2.6 3.6 2.6 3.6 H8.6 Z",fill:color})
  )
);

// Redemption mark. Hollow red is a month still owed an answer; filled gold is
// the answer given. One silhouette in two states, so the flip teaches itself.
const RedemptionShieldIcon = ({size=14,redeemed=false}) => {
  const color = redeemed ? "#f5c842" : "#D44A4A";
  return React.createElement('svg',{
    width:size,
    height:size,
    viewBox:"0 0 24 24",
    role:"img",
    "aria-label":redeemed ? "Redeemed" : "Redemption",
    style:{flexShrink:0,display:"block"}
  },
    React.createElement('path',{
      d:"M12 2.4 20.4 6.1 V12 c0 5.1 -5.6 8.6 -8.4 9.6 C9.2 20.6 3.6 17.1 3.6 12 V6.1 Z",
      fill:redeemed ? color : "none",
      stroke:color,
      strokeWidth:"1.7",
      strokeLinejoin:"round"
    }),
    redeemed && React.createElement('path',{
      d:"M8.6 12.2 11 14.6 15.6 9.9",
      fill:"none",
      stroke:"#0A1212",
      strokeWidth:"2.1",
      strokeLinecap:"round",
      strokeLinejoin:"round"
    })
  );
};

const TargetHitHexIcon = ({size=22,color="#4ECDC4"}) => (
  React.createElement('svg',{
    width:size,
    height:size,
    viewBox:"0 0 24 24",
    fill:"none",
    stroke:color,
    strokeWidth:"2",
    strokeLinecap:"round",
    strokeLinejoin:"round",
    'aria-hidden':"true"
  },
    React.createElement('polygon',{points:"12 2.6 19.8 7.1 19.8 16.9 12 21.4 4.2 16.9 4.2 7.1"}),
    React.createElement('polygon',{points:"12 6.7 16.2 9.1 16.2 14.9 12 17.3 7.8 14.9 7.8 9.1"}),
    React.createElement('circle',{cx:"12",cy:"12",r:"1.8",fill:color,stroke:"none"})
  )
);


const StatusBadge = ({status}) => {
  const map={
    "locked-in":["linear-gradient(90deg, rgba(203,213,225,.08) 0%, rgba(203,213,225,.35) 100%)","#E2E8F0","#2a2d31"],
    "cruising":["rgba(203,213,225,.10)","#CBD5E1","#1a1d21"],
    "starting-soon":["rgba(143,174,170,.10)","#8FAEAA","#1B2C2C"],
    "on-track":["rgba(90,191,90,.14)","#5ABF5A","#17351d"],
    "at-risk":["#1E1808","#D4A843","#3D3010"],
    "behind":["rgba(212,120,67,.14)","#D47843","#3E2416"],
    "cooked":["rgba(212,74,74,.14)","#D44A4A","#3B1818"]
  };
  const [bg,fg]=map[status]||map.behind;
  const labels={"locked-in":"Cleared","cruising":"Cruising","starting-soon":"Early","on-track":"On Track","at-risk":"At Risk","behind":"Behind","cooked":"Cooked"};
  const border = map[status]?.[2] || `${fg}40`;
  return React.createElement('span',{style:{background:bg,color:fg,border:`0.5px solid ${border}`,padding:"1px 7px",borderRadius:999,fontSize:9,fontFamily:"'Outfit',sans-serif",fontWeight:700,letterSpacing:".04em",textTransform:"uppercase",whiteSpace:"nowrap"}},labels[status]);
};


const RankIcon = ({rank}) => {
  if(rank===1) return React.createElement(MedalIcon,{place:1,size:16});
  return React.createElement('span',{style:{fontSize:11,color:"var(--muted)",minWidth:20,display:"inline-block",textAlign:"center",fontFamily:"'Outfit',sans-serif",fontWeight:800,letterSpacing:0}},`#${rank}`);
};


const TrophyIcon = ({size=18,color="#F5A623"}) => React.createElement('svg',{
  width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:color,strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"
},
  React.createElement('path',{d:"M8 4h8v3a4 4 0 0 1-8 0V4z"}),
  React.createElement('path',{d:"M8 5H5a2 2 0 0 0 2 2"}),
  React.createElement('path',{d:"M16 5h3a2 2 0 0 1-2 2"}),
  React.createElement('path',{d:"M12 11v4"}),
  React.createElement('path',{d:"M9 19h6"}),
  React.createElement('path',{d:"M8 22h8"})
);


const MedalIcon = ({place=1,size=16}) => {
  const palette = place===1 ? {metal:"#F5A623",ribbon:"#E85A5A"} : place===2 ? {metal:"#C0C0C0",ribbon:"#6EA8FF"} : {metal:"#CD7F32",ribbon:"#E85A5A"};
  return React.createElement('svg',{
    width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:"none"
  },
    React.createElement('path',{d:"M8 3h3l1 4H9L8 3z",fill:palette.ribbon,opacity:.95}),
    React.createElement('path',{d:"M13 3h3l-1 4h-3l1-4z",fill:palette.ribbon,opacity:.95}),
  React.createElement('circle',{cx:"12",cy:"14",r:"5.5",fill:palette.metal}),
  React.createElement('circle',{cx:"12",cy:"14",r:"4.1",stroke:"rgba(7,7,10,.28)",strokeWidth:"1"}),
  React.createElement('text',{x:"12",y:"16.6",textAnchor:"middle",fontSize:"6.8",fontWeight:"800",fontFamily:"Outfit, sans-serif",fill:"#071010"},String(place))
  );
};


const UploadPhotoIcon = ({size=15,color="currentColor"}) => React.createElement('svg',{
  width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:color,strokeWidth:"1.9",strokeLinecap:"round",strokeLinejoin:"round"
},
  React.createElement('path',{d:"M9 6.5l1.2-1.7h3.6L15 6.5h2.6c1.1 0 2 .9 2 2v8.1c0 1.1-.9 2-2 2H6.4c-1.1 0-2-.9-2-2V8.5c0-1.1.9-2 2-2H9z"}),
  React.createElement('circle',{cx:"12",cy:"12.7",r:"3.2"}),
  React.createElement('path',{d:"M17 9.2h.01"})
);


const Bar = ({value,max,color="var(--green)",h=2}) => React.createElement('div',{style:{background:"var(--border)",borderRadius:99,height:h,overflow:"hidden",minWidth:0,flexShrink:0}},
  React.createElement('div',{style:{width:`${Math.min(100,max?Math.round(value/max*100):0)}%`,height:"100%",background:color,borderRadius:99,transition:"width .5s cubic-bezier(.4,0,.2,1)"}})
);


const Card = ({children,style={},className="",...props}) => React.createElement('div',{className:`card ${className}`,style,...props},children);


const AppIcon = ({name,size=18,stroke="currentColor"}) => {
  const common = { width:size, height:size, viewBox:"0 0 24 24", fill:"none", stroke, strokeWidth:"1.8", strokeLinecap:"round", strokeLinejoin:"round" };
  if (name==="today") return React.createElement('svg',common,
    React.createElement('path',{d:"M12 3v18"}),
    React.createElement('path',{d:"M7 8l5-5 5 5"}),
    React.createElement('path',{d:"M7 16l5 5 5-5"})
  );
  // Share: a sheet with an arrow leaving it, matching the platform idiom.
  if (name==="share") return React.createElement('svg',common,
    React.createElement('path',{d:"M12 15V4"}),
    React.createElement('path',{d:"M8.5 7.5L12 4l3.5 3.5"}),
    React.createElement('path',{d:"M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"})
  );
  if (name==="activity") return React.createElement('svg',common,
    React.createElement('path',{d:"M4 15h3l2-6 4 10 2-6h5"})
  );
  if (name==="results") return React.createElement('svg',common,
    React.createElement('path',{d:"M5 19h14"}),
    React.createElement('path',{d:"M7 16V9"}),
    React.createElement('path',{d:"M12 16V5"}),
    React.createElement('path',{d:"M17 16v-3"})
  );
  if (name==="history") return React.createElement('svg',common,
    React.createElement('path',{d:"M4 12a8 8 0 1 0 2.3-5.7"}),
    React.createElement('path',{d:"M4 4v4h4"}),
    React.createElement('path',{d:"M12 8v5l3 2"})
  );
  if (name==="plus") return React.createElement('svg',common,
    React.createElement('path',{d:"M12 5v14"}),
    React.createElement('path',{d:"M5 12h14"})
  );
  if (name==="settings") return React.createElement('svg',common,
    React.createElement('circle',{cx:"12",cy:"12",r:"3.2"}),
    React.createElement('path',{d:"M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1 1 0 0 1 0 1.4l-1.1 1.1a1 1 0 0 1-1.4 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1 1 0 0 1-1 1h-1.6a1 1 0 0 1-1-1v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a1 1 0 0 1-1.4 0l-1.1-1.1a1 1 0 0 1 0-1.4l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1 1 0 0 1-1-1v-1.6a1 1 0 0 1 1-1h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a1 1 0 0 1 0-1.4l1.1-1.1a1 1 0 0 1 1.4 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a1 1 0 0 1 1-1h1.6a1 1 0 0 1 1 1v.2a1 1 0 0 0 .7.9 1 1 0 0 0 1.1-.2l.1-.1a1 1 0 0 1 1.4 0l1.1 1.1a1 1 0 0 1 0 1.4l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a1 1 0 0 1 1 1v1.6a1 1 0 0 1-1 1h-.2a1 1 0 0 0-.9.7z"})
  );
  if (name==="refresh") return React.createElement('svg',common,
    React.createElement('path',{d:"M20 5v5h-5"}),
    React.createElement('path',{d:"M4 19v-5h5"}),
    React.createElement('path',{d:"M7 9a7 7 0 0 1 11.2-2.1L20 10"}),
    React.createElement('path',{d:"M17 15A7 7 0 0 1 5.8 17.1L4 14"})
  );
  if (name==="trophy") return React.createElement('svg',common,
    React.createElement('path',{d:"M8 4h8v3a4 4 0 0 1-8 0z"}),
    React.createElement('path',{d:"M9 14h6"}),
    React.createElement('path',{d:"M12 11v6"}),
    React.createElement('path',{d:"M8 20h8"}),
    React.createElement('path',{d:"M16 5h3a2 2 0 0 1-2 2h-1"}),
    React.createElement('path',{d:"M8 5H5a2 2 0 0 0 2 2h1"})
  );
  if (name==="target") return React.createElement('svg',common,
    React.createElement('circle',{cx:"12",cy:"12",r:"7"}),
    React.createElement('circle',{cx:"12",cy:"12",r:"3"}),
    React.createElement('path',{d:"M12 2v2"}),
    React.createElement('path',{d:"M12 20v2"}),
    React.createElement('path',{d:"M2 12h2"}),
    React.createElement('path',{d:"M20 12h2"})
  );
  if (name==="trend") return React.createElement('svg',common,
    React.createElement('path',{d:"M4 16l5-5 4 4 7-7"}),
    React.createElement('path',{d:"M14 8h6v6"})
  );
  if (name==="profile") return React.createElement('svg',common,
    React.createElement('circle',{cx:"12",cy:"8",r:"3.2"}),
    React.createElement('path',{d:"M5.5 19.2c1.5-3 4-4.7 6.5-4.7s5 1.7 6.5 4.7"})
  );
  if (name==="group") return React.createElement('svg',common,
    React.createElement('circle',{cx:"9",cy:"8.5",r:"2.8"}),
    React.createElement('circle',{cx:"16.5",cy:"9.5",r:"2.2"}),
    React.createElement('path',{d:"M3.8 19c1.2-2.7 3-4.1 5.2-4.1s4 1.4 5.2 4.1"}),
    React.createElement('path',{d:"M13.8 15.2c1.9.2 3.4 1.4 4.4 3.8"})
  );
  if (name==="message-circle") return React.createElement('svg',common,
    React.createElement('path',{d:"M4 19.5l1.2-3.6A8 8 0 1 1 8.4 18.3L4 19.5"})
  );
  if (name==="money-bag") return React.createElement('svg',common,
    React.createElement('path',{d:"M9 5.5h6"}),
    React.createElement('path',{d:"M10 5.5 8.5 3.5h7L14 5.5"}),
    React.createElement('path',{d:"M8.5 8.5c-2 1.7-3 4-3 6.4 0 3.3 2.5 5.1 6.5 5.1s6.5-1.8 6.5-5.1c0-2.4-1-4.7-3-6.4"}),
    React.createElement('path',{d:"M9.2 8.5h5.6"}),
    React.createElement('path',{d:"M12 11.2v5.1"}),
    React.createElement('path',{d:"M10.2 12.2c.4-.6 1-.9 1.8-.9 1 0 1.8.5 1.8 1.3 0 1.9-3.6.9-3.6 2.8 0 .8.8 1.3 1.8 1.3.8 0 1.5-.3 1.9-.9"})
  );
  if (name==="home") return React.createElement('svg',common,
    React.createElement('path',{d:"M4 11.5 12 5l8 6.5"}),
    React.createElement('path',{d:"M6.5 10.5V20h11v-9.5"}),
    React.createElement('path',{d:"M10 20v-5h4v5"})
  );
  if (name==="calendar") return React.createElement('svg',common,
    React.createElement('rect',{x:"3.5",y:"5",width:"17",height:"16",rx:"2"}),
    React.createElement('path',{d:"M3.5 9.5h17"}),
    React.createElement('path',{d:"M8 3v3"}),
    React.createElement('path',{d:"M16 3v3"})
  );
  if (name==="calendar-plus") return React.createElement('svg',common,
    React.createElement('rect',{x:"3.5",y:"5",width:"17",height:"16",rx:"2"}),
    React.createElement('path',{d:"M3.5 9.5h17"}),
    React.createElement('path',{d:"M8 3v3"}),
    React.createElement('path',{d:"M16 3v3"}),
    React.createElement('path',{d:"M12 12v5"}),
    React.createElement('path',{d:"M9.5 14.5h5"})
  );
  if (name==="clock") return React.createElement('svg',common,
    React.createElement('circle',{cx:"12",cy:"12",r:"8"}),
    React.createElement('path',{d:"M12 8v4l2.5 1.5"})
  );
  if (name==="reply") return React.createElement('svg',common,
    React.createElement('polyline',{points:"9 7 4 12 9 17"}),
    React.createElement('path',{d:"M4 12h9a6 6 0 0 1 6 6v1"})
  );
  if (name==="edit") return React.createElement('svg',common,
    React.createElement('path',{d:"M4 20h4l10.5-10.5a1.9 1.9 0 0 0-4-4L4 16v4z"}),
    React.createElement('path',{d:"M13 6.5l4 4"})
  );
  if (name==="chevron-left") return React.createElement('svg',common,
    React.createElement('path',{d:"M15 6l-6 6 6 6"})
  );
  if (name==="chevron-right") return React.createElement('svg',common,
    React.createElement('path',{d:"M9 6l6 6-6 6"})
  );
  if (name==="flame") return React.createElement('svg',common,
    React.createElement('path',{d:"M12 21c3.4 0 6-2.4 6-5.8 0-2.3-1.1-4.1-3.3-5.7.1 1.6-.5 2.8-1.6 3.7.2-2.9-1-5.2-3.5-7.2.1 2.7-1.1 4.2-2.2 5.5A5.8 5.8 0 0 0 6 15.2C6 18.6 8.6 21 12 21z"}),
    React.createElement('path',{d:"M12 18c1.3 0 2.3-.9 2.3-2.2 0-.9-.5-1.7-1.5-2.4 0 .8-.3 1.4-.8 1.8.1-1.2-.4-2.2-1.4-3.1.1 1.2-.5 1.9-1 2.5-.3.4-.5.8-.5 1.2 0 1.3 1 2.2 2.9 2.2z"})
  );
  if (name==="sparkles") return React.createElement('svg',common,
    React.createElement('path',{d:"M12 3l1.2 4.1L17 8.5l-3.8 1.4L12 14l-1.2-4.1L7 8.5l3.8-1.4z"}),
    React.createElement('path',{d:"M5 14l.7 2.2L8 17l-2.3.8L5 20l-.7-2.2L2 17l2.3-.8z"}),
    React.createElement('path',{d:"M18.5 13l.5 1.6 1.5.6-1.5.6-.5 1.6-.5-1.6-1.5-.6 1.5-.6z"})
  );
  return React.createElement('svg',common,React.createElement('circle',{cx:"12",cy:"12",r:"8"}));
};


const AnteWordmark = ({size=56,stacked=false,subtle=false}) => React.createElement('div',{
  style:{
    fontFamily:"'Raleway', sans-serif",
    fontWeight:800,
    fontSize:size,
    lineHeight:1,
    letterSpacing:"-.05em",
    color:subtle?"var(--text-soft)":"var(--text)",
    whiteSpace:"nowrap",
    display:"inline-flex",
    alignItems:"baseline"
  }
},
  React.createElement(React.Fragment,null,"FER",React.createElement('span',{style:{color:"var(--cyan)"}},"O"))
);


const Spinner = ({label="Loading Fero..."}) => React.createElement('div',{style:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",gap:16}},
  React.createElement('div',{className:"spinner"}),
  React.createElement('div',{style:{color:"var(--muted)",fontSize:13,fontFamily:"'JetBrains Mono',monospace"}},label)
);

// Shown on a cold open instead of a spinner on blank, for a member we already
// know is signed in. It mirrors Today's mobile layout — the day line, four
// stat cards, the leaderboard — so the real screen arrives into the shape
// that is already there rather than snapping in from nothing.
//
// Only for a returning member: someone who is signed out would be shown the
// frame of a screen they are not about to see. The caller decides.
const TodayScreenSkeleton = () => {
  const bar = (w, h = 10, extra = {}) => React.createElement('div',{className:"skel",style:{width:w,height:h,...extra}});
  const statCardStyle = {
    background:"linear-gradient(180deg, #080F0F 0%, #0A1314 100%)",
    border:"0.5px solid #152827",
    boxShadow:"inset 0 1px 0 rgba(255,255,255,.025)",
    padding:"8px 10px",
    minHeight:74,
    display:"flex",
    flexDirection:"column",
    alignItems:"center",
    gap:9
  };
  return React.createElement('div',{
    style:{minHeight:"100vh",backgroundColor:"#070C0C",background:"var(--bg-gradient)",backgroundImage:"var(--bg-radial-hint), var(--bg-gradient)"}
  },
    React.createElement('div',{style:{padding:"12px 14px 0",display:"flex",flexDirection:"column",gap:12,maxWidth:640,margin:"0 auto"}},
      bar(118, 9),
      React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:6,paddingBottom:2}},
        [0,1,2,3].map(i => React.createElement(Card,{key:i,style:statCardStyle},
          bar("72%", 7), bar("46%", 15), bar("84%", 6)
        ))
      ),
      React.createElement(Card,null,
        React.createElement('div',{style:{padding:"11px 14px",borderBottom:"1px solid var(--border)"}}, bar(112, 12)),
        React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:4,padding:8}},
          [0,1,2,3,4,5].map(i => React.createElement('div',{key:i,style:{
            width:"100%",background:"#080F0F",border:"0.5px solid #0D1F1E",borderRadius:8,
            padding:"8px 10px",boxShadow:"inset 0 1px 0 rgba(255,255,255,0.04)",
            display:"flex",alignItems:"center",gap:8
          }},
            bar(20, 9),
            bar(22, 22, {borderRadius:999, flexShrink:0}),
            React.createElement('div',{style:{flex:1,minWidth:0}}, bar(`${[62,54,70,48,58,44][i]}%`, 10)),
            bar(16, 12),
            bar(52, 14, {borderRadius:999})
          ))
        )
      )
    ),
    React.createElement('span',{style:{position:"absolute",width:1,height:1,overflow:"hidden",clip:"rect(0 0 0 0)"}},"Opening Fero")
  );
};

// The other cold-open landing. Which of the two a member gets is decided by
// whether the app remembers a Bloc, so the skeleton has to be chosen the same
// way — a Today outline in front of the switcher would be the wrong promise.
//
// The wordmark and "Your Blocs" are drawn for real: they are fixed furniture,
// not data, and greying them out would hide something already known.
const BlocSwitcherSkeleton = () => {
  const bar = (w, h = 10, extra = {}) => React.createElement('div',{className:"skel",style:{width:w,height:h,...extra}});
  const blocCard = key => React.createElement('div',{key,style:{
    background:"linear-gradient(180deg,rgba(13,22,22,.99),rgba(7,12,12,.99))",
    border:"1px solid rgba(22,44,44,.94)",
    boxShadow:"inset 0 1px 0 rgba(255,255,255,.07), 0 16px 34px rgba(0,0,0,.2)",
    borderRadius:15, padding:"12px 10px 12px 14px", display:"grid", gap:10
  }},
    React.createElement('div',{style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}},
      bar(116, 17), bar(54, 11)
    ),
    React.createElement('div',{style:{display:"grid",gap:6}},
      React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}},
        bar(84, 8), bar(58, 8)
      ),
      React.createElement('div',{style:{display:"flex",gap:5}},
        [0,1,2,3].map(i => bar(28, 28, {borderRadius:999, flexShrink:0, key:i}))
      )
    ),
    React.createElement('div',{style:{paddingTop:8,borderTop:"1px solid rgba(18,36,36,.92)",display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:5,alignItems:"end"}},
      [0,1,2].map(i => React.createElement('div',{key:i,style:{display:"grid",gap:4}}, bar("70%", 7), bar("52%", 13)))
    )
  );
  return React.createElement('div',{
    style:{minHeight:"100vh",backgroundColor:"#070C0C",background:"var(--bg-gradient)",backgroundImage:"var(--bg-radial-hint), var(--bg-gradient)",display:"flex",flexDirection:"column",alignItems:"center",padding:"calc(env(safe-area-inset-top) + 16px) 16px 28px"}
  },
    React.createElement('div',{style:{width:"100%",maxWidth:744,display:"flex",alignItems:"center",justifyContent:"flex-end",marginBottom:10}},
      bar(30, 30, {borderRadius:999})
    ),
    React.createElement('div',{style:{width:"100%",display:"grid",justifyItems:"center",textAlign:"center",marginTop:-30,marginBottom:18,maxWidth:560}},
      React.createElement('div',{style:{margin:"2px 0 8px"}},React.createElement(AnteWordmark,{size:38})),
      React.createElement('span',{style:{fontFamily:"'Outfit',sans-serif",fontSize:10,fontWeight:800,color:"var(--cyan)",letterSpacing:".12em",textTransform:"uppercase"}},"Your Blocs")
    ),
    React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(228px,1fr))",gap:10,width:"100%",maxWidth:744}},
      [0,1].map(blocCard)
    ),
    React.createElement('span',{style:{position:"absolute",width:1,height:1,overflow:"hidden",clip:"rect(0 0 0 0)"}},"Loading your Blocs")
  );
};

class PlayerProfileErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("PlayerProfile render failed", error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.profileName !== this.props.profileName && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return React.createElement('div',{style:{maxWidth:740,margin:"0 auto",padding:"16px",display:"grid",gap:12}},
      React.createElement(Card,{style:{padding:"18px 16px",display:"grid",gap:10}},
        React.createElement('div',{style:{fontSize:18,fontWeight:800,color:"var(--text)"}},"Profile couldn't be opened"),
        React.createElement('div',{style:{fontSize:13,color:"var(--muted)",lineHeight:1.5}},
          this.props.profileName ? `${this.props.profileName}'s profile hit a rendering error.` : "This profile hit a rendering error."
        ),
        React.createElement('div',{className:"mono",style:{fontSize:10,color:"var(--red)",whiteSpace:"pre-wrap",wordBreak:"break-word"}},String(this.state.error?.message || this.state.error || "Unknown error")),
        React.createElement('div',null,
          React.createElement('button',{onClick:this.props.onBack,style:{background:"var(--s2)",border:"1px solid var(--border)",color:"var(--text)",padding:"10px 12px",borderRadius:10,fontSize:13,fontWeight:700}},"Back")
        )
      )
    );
  }
}

// Every in-Bloc page mounts at once inside the swipe track, so an unguarded
// page can blank the whole app from a tab the user is not even looking at.
// See "Blank Screen When Opening A Bloc" in docs/recurring-debugging-playbook.md.
// Renders children untouched when there is no error, so it adds no DOM and no
// layout of its own.
class InBlocPageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`${this.props.pageLabel || "In-Bloc"}Page render failed`, error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    const label = this.props.pageLabel || "This";
    return React.createElement('div',{style:{maxWidth:740,margin:"0 auto",padding:"16px",display:"grid",gap:12}},
      React.createElement(Card,{style:{padding:"18px 16px",display:"grid",gap:10}},
        React.createElement('div',{style:{fontSize:18,fontWeight:800,color:"var(--text)"}},`${label} screen hit an error`),
        React.createElement('div',{style:{fontSize:13,color:"var(--muted)",lineHeight:1.5}},`The ${label} view crashed while rendering.`),
        React.createElement('div',{className:"mono",style:{fontSize:10,color:"var(--red)",whiteSpace:"pre-wrap",wordBreak:"break-word"}},String(this.state.error?.message || this.state.error || "Unknown error"))
      )
    );
  }
}

// Kept as a named wrapper so the Today call site and its wording are unchanged.
const TodayPageErrorBoundary = ({resetKey,children}) => React.createElement(
  InBlocPageErrorBoundary,{pageLabel:"Today",resetKey},children
);


// The note behind the redemption mark. A mark can carry a meaning but never
// explain one, so tapping it says the sentence out loud. Dismissed by the
// close control or by tapping the backdrop - there is nothing to acknowledge
// here, so there is no confirm button to press.
// The shell every status note shares. Portalled to document.body on purpose:
// PlayerProfile's root carries a translateX for its back-swipe, and Safari
// treats any transform as the containing block for fixed descendants, so
// rendered in place a note lands wherever the profile surface happens to be
// rather than in the middle of the screen.
//
// Nothing behind it may scroll while it is open. overflow:hidden on the body
// is not enough on its own - the profile layer owns its own scroll container -
// so this mirrors the capture-phase touchmove block the auth surface uses.
const StatusNoteModal = ({icon,title,tone="#4ECDC4",body,onClose}) => {
  useEffect(() => {
    const bodyEl = document.body;
    const root = document.documentElement;
    const previous = {
      bodyOverflow: bodyEl.style.overflow,
      rootOverflow: root.style.overflow,
      bodyTouch: bodyEl.style.touchAction,
      bodyOverscroll: bodyEl.style.overscrollBehavior
    };
    const blockScroll = event => {
      if (event.cancelable) event.preventDefault();
    };
    bodyEl.style.overflow = "hidden";
    root.style.overflow = "hidden";
    bodyEl.style.touchAction = "none";
    bodyEl.style.overscrollBehavior = "none";
    document.addEventListener("touchmove", blockScroll, { passive:false, capture:true });
    document.addEventListener("wheel", blockScroll, { passive:false, capture:true });
    return () => {
      document.removeEventListener("touchmove", blockScroll, { capture:true });
      document.removeEventListener("wheel", blockScroll, { capture:true });
      bodyEl.style.overflow = previous.bodyOverflow;
      root.style.overflow = previous.rootOverflow;
      bodyEl.style.touchAction = previous.bodyTouch;
      bodyEl.style.overscrollBehavior = previous.bodyOverscroll;
    };
  }, []);

  return createPortal(React.createElement('div',{
    onClick:onClose,
    onTouchMove:e=>e.preventDefault(),
    style:{
      position:"fixed",
      inset:0,
      zIndex:1100,
      display:"flex",
      alignItems:"center",
      justifyContent:"center",
      padding:"16px",
      // Lighter than the app's standard overlay: this is a footnote, not a
      // decision, so the screen behind stays legible under the blur.
      background:"rgba(4,9,9,.42)",
      backdropFilter:"blur(6px)",
      WebkitBackdropFilter:"blur(6px)",
      overscrollBehavior:"contain",
      animation:"fadeIn .16s ease"
    }
  },
    React.createElement('div',{
      className:"modal",
      onClick:e=>e.stopPropagation(),
      style:{position:"relative",maxWidth:292,padding:"18px 16px 16px",textAlign:"center"}
    },
      React.createElement('button',{
        type:"button",
        onClick:onClose,
        "aria-label":"Close",
        style:{position:"absolute",top:9,right:11,background:"transparent",border:"none",padding:5,lineHeight:1,color:"var(--muted2)",fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:600}
      },"\u2715"),
      React.createElement('div',{style:{display:"grid",placeItems:"center",marginBottom:9}}, icon),
      React.createElement('div',{style:{fontFamily:"'Raleway',sans-serif",fontSize:16,fontWeight:800,marginBottom:6,color:tone}}, title),
      React.createElement('div',{style:{fontSize:12.5,color:"var(--text-soft, #b8becc)",lineHeight:1.5}}, body)
    )
  ), document.body);
};

const RedemptionNoteModal = ({redeemed=false,memberName="",isSelf=false,monthName="",onClose}) => {
  const who = isSelf ? "You" : (memberName || "They");
  const slowLine = monthName ? `had a slow ${monthName}` : "had a slow month";
  const body = redeemed
    ? (isSelf ? `You ${slowLine}. You redeemed it this month.` : `${who} ${slowLine}, and redeemed it this month.`)
    : (isSelf ? `You ${slowLine}. This month is your chance to redeem it.` : `${who} ${slowLine}. This month is their chance to redeem it.`);
  return React.createElement(StatusNoteModal,{
    icon: React.createElement(RedemptionShieldIcon,{size:30,redeemed}),
    title: redeemed ? "Redeemed" : "Out for redemption",
    tone: redeemed ? "#f5c842" : "#D44A4A",
    body,
    onClose
  });
};

// Two states, because a Bloc's own opening month is not the same story as one
// person arriving late into a running Bloc.
const TrainingNoteModal = ({memberName="",isSelf=false,blocOpening=false,onClose}) => {
  const body = blocOpening
    ? "The Bloc started this month. Everyone settles in \u2014 penalties kick off next month."
    : isSelf
      ? "You joined the Bloc this month. Settle in \u2014 penalties kick off next month."
      : `${memberName || "They"} joined the Bloc this month. Settling in \u2014 penalties kick off next month.`;
  return React.createElement(StatusNoteModal,{
    icon: React.createElement(TrainingSproutIcon,{size:30}),
    title: blocOpening ? "Opening month" : "First month",
    tone: "#f5c842",
    body,
    onClose
  });
};

const SoloNoteModal = ({memberName="",isSelf=false,monthName="",target=null,onClose}) => {
  const when = monthName ? ` this ${monthName}` : "";
  const targetPart = Number.isFinite(Number(target)) && Number(target) > 0
    ? `, with a personal target of ${Math.round(Number(target))}`
    : "";
  const body = isSelf
    ? `You're on solo mode${when}${targetPart}. No penalty either way.`
    : `${memberName || "They"} is on solo mode${when}${targetPart}. No penalty either way.`;
  return React.createElement(StatusNoteModal,{
    icon: React.createElement(SoloFlagIcon,{size:30}),
    title: "Solo mode",
    tone: "#4ECDC4",
    body,
    onClose
  });
};

const InstallBanner = ({installReady,onInstall,onDismiss,showIosHint}) => (
  React.createElement('div',{className:"install-banner"},
    React.createElement('div',{className:"install-card pi",style:{padding:isMobile()?"12px 14px":"14px 16px",borderRadius:isMobile()?14:16}},
      React.createElement('div',{style:{display:"flex",alignItems:"center",gap:12}},
        React.createElement('div',{style:{width:isMobile()?36:42,height:isMobile()?36:42,borderRadius:12,background:"linear-gradient(135deg,#101820,#1fce65)",display:"flex",alignItems:"center",justifyContent:"center",color:"#08110f",flexShrink:0}},React.createElement(AppIcon,{name:"today",size:isMobile()?18:20,stroke:"#08110f"})),
        React.createElement('div',null,
          React.createElement('div',{style:{fontWeight:800,fontSize:15}},"Install Fero"),
          React.createElement('div',{style:{fontSize:12,color:"var(--muted)",marginTop:3,lineHeight:1.45}},
            installReady
              ? "Add Fero to your home screen for a full-screen app experience and faster reloads."
              : "On iPhone, tap Share and choose Add to Home Screen to install Fero."
          )
        )
      ),
      React.createElement('div',{className:"install-actions",style:isMobile()?{marginTop:10}:{}} ,
        installReady && React.createElement('button',{className:"install-btn primary",onClick:onInstall},"Install App"),
        showIosHint && React.createElement('button',{className:"install-btn secondary",onClick:onDismiss},"Hide Tip"),
        installReady && React.createElement('button',{className:"install-btn secondary",onClick:onDismiss},"Maybe Later")
      )
    )
  )
);

// ─── WHO ARE YOU ──────────────────────────────────────────────────────────────

const WorkoutCategorySelector = ({selected,onToggle,compact=false}) => React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:compact?6:8}},
  WORKOUT_TYPES.map(type=>{
    const active = selected.includes(type);
    return React.createElement('button',{key:type,type:"button",onClick:()=>onToggle(type),style:{
      minHeight:compact?62:74,
      borderRadius:compact?10:12,
      background:active?"rgba(78,205,196,.08)":"var(--s2)",
      border:`1px solid ${active?"#4ECDC4":"var(--border)"}`,
      color:active?"var(--cyan)":"var(--muted)",
      display:"flex",
      flexDirection:"column",
      alignItems:"center",
      justifyContent:"center",
      gap:compact?4:6,
      padding:compact?"8px 3px":"10px 4px"
    }},
      React.createElement('span',{style:{width:compact?24:28,height:compact?24:28,display:"inline-flex",alignItems:"center",justifyContent:"center"}},React.createElement(WorkoutTypeIcon,{type,size:compact?18:20})),
      React.createElement('span',{style:{fontSize:compact?10:11,fontWeight:700}},type)
    );
  })
);


const SettingsField = ({title,description,children,compact=false}) => React.createElement('div',{style:{marginBottom:compact?8:18}},
  React.createElement('div',{style:{fontSize:compact?11:14,fontWeight:800,color:"var(--text)",marginBottom:compact?1:4}},title),
  description && React.createElement('div',{style:{fontSize:compact?11:12,color:compact?"#1E4040":"var(--muted)",marginBottom:compact?4:8,lineHeight:1.35}},description),
  children
);


const SelectField = ({value,onChange,options,width,maxWidth,compact=false,arrowColor,textAlign,inputStyle}) => (
  React.createElement('div',{style:{position:"relative",width:width || "100%",maxWidth:maxWidth || "100%" }},
    React.createElement('select',{
      value,
      onChange,
      style:{
        ...inputShellStyle,
        width:"100%",
        appearance:"none",
        WebkitAppearance:"none",
        MozAppearance:"none",
        paddingRight:compact?28:32,
        padding:compact?"8px 28px 8px 10px":inputShellStyle.padding,
        fontSize:compact?12:inputShellStyle.fontSize,
        borderRadius:compact?8:inputShellStyle.borderRadius,
        textAlign:textAlign || "left",
        textAlignLast:textAlign || "left",
        outline:"none",
        boxShadow:"none",
        ...(inputStyle || {})
      }
    },
      options.map(option=>React.createElement('option',{key:option.value,value:option.value},option.label))
    ),
    React.createElement('span',{
      "aria-hidden":"true",
      style:{
        position:"absolute",
        right:compact?9:12,
        top:"50%",
        transform:"translateY(-50%)",
        pointerEvents:"none",
        color:arrowColor || "var(--muted)",
        fontSize:compact?7:11,
        lineHeight:1
      }
    },"▼")
  )
);


const inputShellStyle = {
  background:"var(--s2)",
  border:"1px solid var(--border)",
  borderRadius:10,
  padding:"12px 13px",
  color:"var(--text)",
  fontSize:14,
  outline:"none"
};


const StepperField = ({value,onChange,min=1,max=Infinity,compact=false,suffix=null}) => {
  const normalizedValue = value === null || value === undefined ? "" : value;
  const adjust = delta => {
    const current = Number(normalizedValue || 0);
    const next = Math.min(max, Math.max(min, current + delta));
    onChange(String(next));
  };
  const stepper = React.createElement('div',{style:{display:"grid",gridTemplateColumns:`${compact?26:36}px minmax(0,1fr) ${compact?26:36}px`,alignItems:"stretch",width:compact?96:120,borderRadius:compact?8:10,overflow:"hidden",border:"1px solid var(--border)",background:"var(--s2)"}},
    React.createElement('button',{type:"button",className:"stepper-btn",onClick:()=>adjust(-1),style:{background:"transparent",borderRight:"1px solid var(--border)",color:"var(--text)",fontSize:compact?16:20,fontWeight:700,transition:"transform .12s ease, background .12s ease, color .12s ease"}},"−"),
    React.createElement('input',{type:"number",min,value:normalizedValue,onChange:e=>onChange(e.target.value),style:{background:"transparent",border:"0",borderRadius:0,padding:compact?"7px 7px":"12px 10px",color:"var(--text)",fontSize:compact?12:15,outline:"none",textAlign:"center",width:"100%"}}),
    React.createElement('button',{type:"button",className:"stepper-btn",onClick:()=>adjust(1),style:{background:"transparent",borderLeft:"1px solid var(--border)",color:"var(--text)",fontSize:compact?16:20,fontWeight:700,transition:"transform .12s ease, background .12s ease, color .12s ease"}},"+")
  );
  if (!suffix) return stepper;
  return React.createElement('div',{style:{display:"inline-flex",alignItems:"center",gap:7}},
    stepper,
    React.createElement('span',{style:{fontSize:compact?10:11,color:"var(--muted)",fontFamily:"'JetBrains Mono',monospace",letterSpacing:".08em",textTransform:"uppercase"}},suffix)
  );
};


const PrimaryActionButton = ({label,onClick,secondary=false}) => React.createElement('button',{
  type:"button",
  onClick,
  style:{
    minHeight:46,
    padding:"0 18px",
    borderRadius:12,
    background:secondary?"var(--s2)":"var(--green)",
    border:secondary?"1px solid var(--border)":"1px solid transparent",
    color:secondary?"var(--text)":"#04110a",
    fontSize:14,
    fontWeight:800
  }
},label);


export { Avatar, CategoryIcon, WorkoutTypeIcon, ChevronRightIcon, TargetHitHexIcon, RedemptionShieldIcon, MemberTag, RedemptionNoteModal, StatusNoteModal, TrainingNoteModal, SoloNoteModal, TrainingSproutIcon, SoloFlagIcon, StatusBadge, RankIcon, TrophyIcon, MedalIcon, UploadPhotoIcon, Bar, Card, AppIcon, AnteWordmark, Spinner, TodayScreenSkeleton, BlocSwitcherSkeleton, InstallBanner, WorkoutCategorySelector, SettingsField, SelectField, inputShellStyle, StepperField, PrimaryActionButton, PlayerProfileErrorBoundary, TodayPageErrorBoundary, InBlocPageErrorBoundary };
