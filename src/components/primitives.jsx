import React from "react";
const { useState, useEffect, useMemo, useCallback, useRef } = React;
import {
  WORKOUT_TYPES,
  avatarColor
} from "../lib/appState.js";
import {
  isMobile
} from "../lib/utils.js";
import { PlayerProfile } from "../pages/PlayerProfile.jsx";
import { TodayPage } from "../pages/TodayPage.jsx";
import { App } from "../App.jsx";

const Avatar = ({name,size=32,muted=false,userId=""}) => (
  React.createElement('div',{style:{width:size,height:size,borderRadius:"50%",background:muted?"var(--s3)":avatarColor(name, userId),display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:size*.38,color:muted?"var(--muted)":"#fff",flexShrink:0}},name[0])
);


const CategoryIcon = ({category,size=22,color="#4ECDC4"}) => {
  const props = { width:size, height:size, fill:color, viewBox:"0 0 256 256", xmlns:"http://www.w3.org/2000/svg" };
  switch (category?.toLowerCase()) {
    case "gym":
      return React.createElement('svg',{
        width:size,
        height:size,
        viewBox:"0 0 24 24",
        fill:"none",
        stroke:color,
        strokeWidth:"2.1",
        strokeLinecap:"round",
        strokeLinejoin:"round",
        xmlns:"http://www.w3.org/2000/svg"
      },
        React.createElement('path',{d:"M2.5 9.5v5"}),
        React.createElement('path',{d:"M5.5 8.2v7.6"}),
        React.createElement('path',{d:"M8.2 10.1v3.8"}),
        React.createElement('path',{d:"M15.8 10.1v3.8"}),
        React.createElement('path',{d:"M18.5 8.2v7.6"}),
        React.createElement('path',{d:"M21.5 9.5v5"}),
        React.createElement('path',{d:"M8.2 12h7.6"})
      );
    case "run":
      return React.createElement('svg',{
        width:size,height:size,viewBox:"-1 0 24 24",
        fill:color,xmlns:"http://www.w3.org/2000/svg"
      },
        React.createElement('path',{d:"M13.5,5.5C14.59,5.5 15.5,4.58 15.5,3.5C15.5,2.38 14.59,1.5 13.5,1.5C12.39,1.5 11.5,2.38 11.5,3.5C11.5,4.58 12.39,5.5 13.5,5.5M9.89,19.38L10.89,15L13,17V23H15V15.5L12.89,13.5L13.5,10.5C14.79,12 16.79,13 19,13V11C17.09,11 15.5,10 14.69,8.58L13.69,7C13.29,6.38 12.69,6 12,6C11.69,6 11.5,6.08 11.19,6.08L6,8.28V13H8V9.58L9.79,8.88L8.19,17L3.29,16L2.89,18L9.89,19.38Z"})
      );
    case "pilates":
      return React.createElement('svg',{
        width:size,height:size,viewBox:"0 0 399.421 399.421",
        fill:color,xmlns:"http://www.w3.org/2000/svg"
      },
        React.createElement('path',{d:"M390.421,90.522h-25.905c-0.123-0.003-0.249-0.003-0.372,0h-25.901c-4.971,0-9,4.029-9,9s4.029,9,9,9h17.087v19.085l-170.319,64.885H95.949l-22.765-31.203h14.013c4.971,0,9-4.029,9-9s-4.029-9-9-9H55.684c-0.144-0.004-0.287-0.004-0.431,0H35.021c-4.971,0-9,4.029-9,9s4.029,9,9,9h15.882l22.765,31.203H9c-4.971,0-9,4.029-9,9v98.409c0,4.971,4.029,9,9,9h42.09c4.971,0,9-4.029,9-9v-47.32h253.151v47.32c0,4.971,4.029,9,9,9h42.09c4.971,0,9-4.029,9-9v-98.409c0-0.063,0-0.127-0.002-0.191v-67.284c0.003-0.139,0.003-0.278,0-0.418v-25.076h17.091c4.971,0,9-4.029,9-9S395.392,90.522,390.421,90.522z M355.33,146.869v45.623H235.572L355.33,146.869z M42.09,290.901H18v-38.32h24.09V290.901z M355.332,290.901h-24.09v-38.32h24.09V290.901z M355.332,234.581h-33.09H18v-24.089h73.28c0.068,0.001,0.135,0.001,0.203,0h94.981c0.137,0.003,0.273,0.003,0.41,0h168.458V234.581z"})
      );
    case "sports":
      return React.createElement('svg',{
        width:size,height:size,viewBox:"0 0 24 24",fill:"none",
        stroke:color,strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round",
        xmlns:"http://www.w3.org/2000/svg"
      },
        React.createElement('path',{d:"M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"}),
        React.createElement('path',{d:"M12 7l4.76 3.45l-1.76 5.55h-6l-1.76 -5.55l4.76 -3.45"}),
        React.createElement('path',{d:"M12 7v-4m3 13l2.5 3m-.74 -8.55l3.74 -1.45m-11.44 7.05l-2.56 2.95m.74 -8.55l-3.74 -1.45"})
      );
    case "other":
      return React.createElement('svg',{
        width:size,height:size,viewBox:"0 0 256 256",
        fill:color,xmlns:"http://www.w3.org/2000/svg"
      },
        React.createElement('circle',{cx:"60",cy:"60",r:"22"}),
        React.createElement('circle',{cx:"128",cy:"60",r:"22"}),
        React.createElement('circle',{cx:"196",cy:"60",r:"22"}),
        React.createElement('circle',{cx:"60",cy:"128",r:"22"}),
        React.createElement('circle',{cx:"128",cy:"128",r:"22"}),
        React.createElement('circle',{cx:"196",cy:"128",r:"22"}),
        React.createElement('circle',{cx:"60",cy:"196",r:"22"}),
        React.createElement('circle',{cx:"128",cy:"196",r:"22"}),
        React.createElement('circle',{cx:"196",cy:"196",r:"22"})
      );
    default:
      return null;
  }
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
  const labels={"locked-in":"Locked In","cruising":"Cruising","starting-soon":"Early","on-track":"On Track","at-risk":"At Risk","behind":"Behind","cooked":"Cooked"};
  const border = map[status]?.[2] || `${fg}40`;
  return React.createElement('span',{style:{background:bg,color:fg,border:`0.5px solid ${border}`,padding:"1px 7px",borderRadius:999,fontSize:9,fontFamily:"'Outfit',sans-serif",fontWeight:700,letterSpacing:".04em",textTransform:"uppercase",whiteSpace:"nowrap"}},labels[status]);
};


const RankIcon = ({rank}) => {
  if(rank===1) return React.createElement(MedalIcon,{place:1,size:16});
  return React.createElement('span',{className:"mono",style:{fontSize:11,color:"var(--muted)",minWidth:20,display:"inline-block",textAlign:"center"}},`#${rank}`);
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
  width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:color,strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"
},
  React.createElement('rect',{x:"3.5",y:"6.5",width:"17",height:"13",rx:"3"}),
  React.createElement('path',{d:"M8.5 14.5l2.5-2.5 2.3 2.3 3.2-3.3 2 2"}),
  React.createElement('circle',{cx:"9",cy:"10",r:"1.2"}),
  React.createElement('path',{d:"M12 3.5v5"}),
  React.createElement('path',{d:"M9.8 5.7L12 3.5l2.2 2.2"})
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
  if (name==="chevron-left") return React.createElement('svg',common,
    React.createElement('path',{d:"M15 6l-6 6 6 6"})
  );
  if (name==="chevron-right") return React.createElement('svg',common,
    React.createElement('path',{d:"M9 6l6 6-6 6"})
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
  React.createElement(React.Fragment,null,"ANT",React.createElement('span',{style:{color:"var(--cyan)"}},"É"))
);


const Spinner = ({label="Loading Antè..."}) => React.createElement('div',{style:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",gap:16}},
  React.createElement('div',{className:"spinner"}),
  React.createElement('div',{style:{color:"var(--muted)",fontSize:13,fontFamily:"'JetBrains Mono',monospace"}},label)
);

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

class TodayPageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("TodayPage render failed", error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return React.createElement('div',{style:{maxWidth:740,margin:"0 auto",padding:"16px",display:"grid",gap:12}},
      React.createElement(Card,{style:{padding:"18px 16px",display:"grid",gap:10}},
        React.createElement('div',{style:{fontSize:18,fontWeight:800,color:"var(--text)"}},"Today screen hit an error"),
        React.createElement('div',{style:{fontSize:13,color:"var(--muted)",lineHeight:1.5}},"The Today view crashed while rendering."),
        React.createElement('div',{className:"mono",style:{fontSize:10,color:"var(--red)",whiteSpace:"pre-wrap",wordBreak:"break-word"}},String(this.state.error?.message || this.state.error || "Unknown error"))
      )
    );
  }
}


const InstallBanner = ({installReady,onInstall,onDismiss,showIosHint}) => (
  React.createElement('div',{className:"install-banner"},
    React.createElement('div',{className:"install-card pi",style:{padding:isMobile()?"12px 14px":"14px 16px",borderRadius:isMobile()?14:16}},
      React.createElement('div',{style:{display:"flex",alignItems:"center",gap:12}},
        React.createElement('div',{style:{width:isMobile()?36:42,height:isMobile()?36:42,borderRadius:12,background:"linear-gradient(135deg,#101820,#1fce65)",display:"flex",alignItems:"center",justifyContent:"center",color:"#08110f",flexShrink:0}},React.createElement(AppIcon,{name:"today",size:isMobile()?18:20,stroke:"#08110f"})),
        React.createElement('div',null,
          React.createElement('div',{style:{fontWeight:800,fontSize:15}},"Install Antè"),
          React.createElement('div',{style:{fontSize:12,color:"var(--muted)",marginTop:3,lineHeight:1.45}},
            installReady
              ? "Add Antè to your home screen for a full-screen app experience and faster reloads."
              : "On iPhone, tap Share and choose Add to Home Screen to install Antè."
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
    React.createElement('button',{type:"button",onClick:()=>adjust(-1),style:{background:"transparent",borderRight:"1px solid var(--border)",color:"var(--text)",fontSize:compact?16:20,fontWeight:700}},"−"),
    React.createElement('input',{type:"number",min,value:normalizedValue,onChange:e=>onChange(e.target.value),style:{background:"transparent",border:"0",borderRadius:0,padding:compact?"7px 7px":"12px 10px",color:"var(--text)",fontSize:compact?12:15,outline:"none",textAlign:"center",width:"100%"}}),
    React.createElement('button',{type:"button",onClick:()=>adjust(1),style:{background:"transparent",borderLeft:"1px solid var(--border)",color:"var(--text)",fontSize:compact?16:20,fontWeight:700}},"+")
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


export { Avatar, CategoryIcon, WorkoutTypeIcon, ChevronRightIcon, TargetHitHexIcon, StatusBadge, RankIcon, TrophyIcon, MedalIcon, UploadPhotoIcon, Bar, Card, AppIcon, AnteWordmark, Spinner, InstallBanner, WorkoutCategorySelector, SettingsField, SelectField, inputShellStyle, StepperField, PrimaryActionButton, PlayerProfileErrorBoundary, TodayPageErrorBoundary };
