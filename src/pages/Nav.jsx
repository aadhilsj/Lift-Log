import React from "react";
const { useState, useEffect, useMemo, useCallback, useRef } = React;
import { AppIcon, AnteWordmark } from "../components/primitives.jsx";

const StreamIconButton = ({ onOpenStream, hasUnread, size }) =>
  React.createElement('button', {
    onClick: onOpenStream, className: "icon-btn", title: "Bloc Stream",
    style: { position: "relative", ...(size ? { width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" } : {}) }
  },
    React.createElement(AppIcon, { name: "message-circle", size: size ? 18 : 14, stroke: hasUnread ? "#4ECDC4" : "#6B9690" }),
    hasUnread && React.createElement('span', {
      style: { position: "absolute", top: -1, right: -1, width: 8, height: 8, borderRadius: 999, background: "#4ECDC4" }
    })
  );

const Nav = ({page,setPage,user,groupName,canEditGroup,onOpenSettings,onOpenProfile,onOpenStream,streamHasUnread=false,onSwitchUser,onSwitchGroup,onOpenLog,syncing,lastSyncedAt,syncError,onRefresh,showJustSynced,activityAlertCount=0}) => {
  const navItems = [["today","Today","today"],["activity","Activity","activity"],["month","Results","results"],["history","History","history"]];
  return React.createElement(React.Fragment,null,
  React.createElement('nav',{className:"desktop-only",style:{background:"var(--s1)",borderBottom:"1px solid var(--border)",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52,position:"sticky",top:0,zIndex:100}},
    React.createElement('div',{style:{display:"flex",alignItems:"center",minWidth:0,lineHeight:1}},
      React.createElement(AnteWordmark,{size:24})
    ),
    React.createElement('div',{style:{display:"flex",alignItems:"center",gap:10}},
      React.createElement('div',{style:{display:"flex",gap:2}},
        navItems.map(([id,label,icon])=>
          React.createElement('button',{key:id,onClick:()=>setPage(id),className:`tab${page===id?" on":""}`,style:{padding:"8px 10px 10px"}},
            React.createElement('span',{className:"nav-label"},label),
            React.createElement('span',{className:"nav-icon",style:{fontSize:16}},React.createElement(AppIcon,{name:icon,size:16})),
            id==="activity" && activityAlertCount>0 && React.createElement('span',{className:"mono",style:{marginLeft:6,padding:"1px 6px",borderRadius:999,background:"rgba(232,69,69,.16)",border:"1px solid rgba(232,69,69,.28)",fontSize:9,color:"#ff9c9c",lineHeight:1.5}},activityAlertCount)
          )
        )
      )
    ),
    React.createElement('div',{style:{display:"flex",alignItems:"center",gap:6}},
      React.createElement(StreamIconButton,{onOpenStream,hasUnread:streamHasUnread}),
      React.createElement('button',{onClick:onOpenSettings,className:"icon-btn",title:"Bloc settings"},React.createElement(AppIcon,{name:"settings",size:14})),
      React.createElement('button',{onClick:onOpenProfile,className:"icon-btn",title:"Account",
        onMouseEnter:e=>e.currentTarget.style.borderColor="var(--border2)",onMouseLeave:e=>e.currentTarget.style.borderColor="var(--border)"},
        React.createElement(AppIcon,{name:"profile",size:14})
      )
    )
  ),
  React.createElement('div',{className:"desktop-only",style:{background:"var(--s1)",borderBottom:"1px solid var(--border)",padding:"10px 16px 12px",display:"flex",justifyContent:"center"}},
    React.createElement('button',{type:"button",onClick:onSwitchGroup,style:{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 18px",borderRadius:999,background:"rgba(78,205,196,.12)",border:"1px solid rgba(78,205,196,.2)",color:"#4ECDC4",fontSize:14,fontWeight:700}},
      groupName,
      React.createElement('span',{style:{fontSize:11,opacity:.85}},"▾")
    )
  ),
  React.createElement('div',{className:"mobile-only mobile-nav-shell"},
    React.createElement('div',{style:{height:44,padding:"0 10px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,position:"relative"}},
      React.createElement('div',{style:{display:"flex",alignItems:"center",minWidth:0,flexShrink:0}},
        React.createElement(AnteWordmark,{size:20})
      ),
      React.createElement('button',{type:"button",onClick:onSwitchGroup,style:{position:"absolute",left:"50%",transform:"translateX(-50%)",padding:0,background:"transparent",color:"#4ECDC4",fontSize:13,fontWeight:500,fontFamily:"'Outfit', sans-serif",lineHeight:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"calc(100% - 132px)",display:"inline-flex",alignItems:"center",gap:4}},
        groupName,
        React.createElement('span',{style:{fontSize:10,lineHeight:1,opacity:.85}},"▾")
      ),
      React.createElement('div',{style:{display:"flex",alignItems:"center",gap:2,flexShrink:0}},
        React.createElement(StreamIconButton,{onOpenStream,hasUnread:streamHasUnread,size:28}),
        React.createElement('button',{onClick:onOpenSettings,className:"icon-btn",title:"Bloc settings",style:{width:28,height:28,display:"inline-flex",alignItems:"center",justifyContent:"center"}},React.createElement(AppIcon,{name:"settings",size:18})),
        React.createElement('button',{onClick:onOpenProfile,className:"icon-btn",title:"Account",style:{width:28,height:28,display:"inline-flex",alignItems:"center",justifyContent:"center"}},React.createElement(AppIcon,{name:"profile",size:18}))
      )
    )
  ),
  React.createElement('div',{className:"mobile-only mobile-bottom-nav"},
    React.createElement('div',{className:"mobile-bottom-nav-grid"},
      [
        ["today","Today","today"],
        ["activity","Activity","activity"],
        ["log","","plus"],
        ["month","Results","results"],
        ["history","History","history"]
      ].map(([id,label,icon])=>
        id === "log"
          ? React.createElement('div',{key:id,className:"mobile-plus-tab-wrap"},
              React.createElement('button',{type:"button",onClick:onOpenLog,className:"mobile-plus-tab",title:"Log workout","aria-label":"Log workout"},
                React.createElement(AppIcon,{name:icon,size:24,stroke:"#FFFFFF"})
              )
            )
          : React.createElement('button',{key:id,onClick:()=>setPage(id),className:`mobile-tab${page===id?" on":""}`},
          React.createElement('div',{style:{position:"relative",display:"inline-flex",alignItems:"center",justifyContent:"center"}},
            React.createElement('span',{style:{fontSize:18,lineHeight:1,display:"inline-flex"}},React.createElement(AppIcon,{name:icon,size:18})),
            id==="activity" && activityAlertCount>0 && React.createElement('span',{className:"mono",style:{position:"absolute",top:-6,right:-14,minWidth:18,height:18,padding:"0 5px",borderRadius:999,background:"rgba(232,69,69,.18)",border:"1px solid rgba(232,69,69,.28)",fontSize:9,color:"#ff9c9c",display:"inline-flex",alignItems:"center",justifyContent:"center"}},activityAlertCount)
          ),
          React.createElement('span',{style:{fontSize:11,fontWeight:700}},label)
        )
      )
    )
  )
);};


export { Nav };
