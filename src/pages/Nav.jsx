import React from "react";
const { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } = React;
import { AppIcon, AnteWordmark, Avatar } from "../components/primitives.jsx";

// Follows Apple's badge convention: a red oval with white text, sitting at the
// top-right. The centre is placed on the button circle's 45° diagonal so it
// hugs the corner instead of floating over the glyph, and the numeral is sized
// to fill the oval rather than swim in it.
const UnreadBadge = ({ count }) => React.createElement('span', {
  style: { position:"absolute", top:-4, right:-4, minWidth:18, height:18, padding:"0 4.5px", borderRadius:999, background:"#D44A4A", color:"#FFFFFF", fontFamily:"'Outfit', sans-serif", fontSize:12.5, fontWeight:600, letterSpacing:"-.01em", lineHeight:1, display:"inline-flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 0 2px #0a1514" }
}, count > 9 ? "9+" : count);

const StreamIconButton = ({ onOpenStream, unreadCount = 0, size }) => {
  const hasUnread = unreadCount > 0;
  return React.createElement('button', {
    onClick: onOpenStream, className: `icon-btn ${size ? "nav-glass-btn" : "live-icon-btn"}`, title: "Bloc Stream",
    style: { position: "relative", ...(size ? { width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" } : {}) }
  },
    React.createElement(AppIcon, { name: "message-circle", size: size ? 26 : 14, stroke: "currentColor" }),
    hasUnread && (size
      ? React.createElement(UnreadBadge, { count: unreadCount })
      : React.createElement('span', {
          style: { position: "absolute", top: -4, left: -5, minWidth: 12, height: 12, padding: "0 2.5px", borderRadius: 999, background: "#4ECDC4", color: "#04110e", fontFamily: "'Outfit', sans-serif", fontSize: 7, fontWeight: 700, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 1.5px var(--s1)" }
        }, unreadCount > 9 ? "9+" : unreadCount))
  );
};

const BLOC_NAME_MAX_FONT = 19;
const BLOC_NAME_MIN_FONT = 12;

const BlocNameButton = ({ groupName, onSwitchGroup }) => {
  const textRef = useRef(null);
  const [fontSize, setFontSize] = useState(BLOC_NAME_MAX_FONT);

  useLayoutEffect(() => {
    const fit = () => {
      const el = textRef.current;
      if (!el) return;
      let size = BLOC_NAME_MAX_FONT;
      el.style.fontSize = `${size}px`;
      // Step down a point at a time until the name fits its own box.
      while (size > BLOC_NAME_MIN_FONT && el.scrollWidth > el.clientWidth + 0.5) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
      setFontSize(size);
    };
    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
    };
  }, [groupName]);

  return React.createElement('button',{type:"button",onClick:onSwitchGroup,style:{minWidth:0,maxWidth:"100%",background:"transparent",border:"none",padding:"6px 0",display:"inline-flex",alignItems:"center",gap:3,color:"#4ECDC4",fontFamily:"'Outfit', sans-serif",fontWeight:700,lineHeight:1,textAlign:"left"}},
    React.createElement('span',{ref:textRef,style:{minWidth:0,fontSize,overflow:"hidden",whiteSpace:"nowrap"}},groupName),
    // Nudged down to the centre of the lowercase letters; box-centred it lines up with the capitals and reads high.
    React.createElement('span',{style:{display:"inline-flex",flexShrink:0,transform:"translateY(.1em)"}},React.createElement(AppIcon,{name:"chevron-down",size:18,stroke:"#4ECDC4",strokeWidth:"2.4"}))
  );
};

// Slot 2 is the centre log button, so Month and History sit at 3 and 4. App.jsx
// moves the indicator imperatively at swipe release and needs the same map.
const MOBILE_PAGE_SLOTS = { today: 0, activity: 1, month: 3, history: 4 };

const SettingsDot = () => React.createElement('span',{style:{position:"absolute",top:2,right:2,width:7,height:7,borderRadius:999,background:"#4ECDC4",boxShadow:"0 0 0 1.5px #050909"}});

const Nav = ({page,setPage,user,groupName,canEditGroup,onOpenSettings,settingsAlert=false,onOpenProfile,onOpenStream,streamUnreadCount=0,onSwitchUser,onSwitchGroup,onOpenLog,syncing,lastSyncedAt,syncError,onRefresh,showJustSynced,activityAlertCount=0,hideMobileBottomNav=false,onlyMobileBottomNav=false,mobileBottomDragX=0,mobileBottomDragging=false,mobileBottomNavRef=null,mobileBottomSettle="transform .08s ease-out",mobileTabIndicatorRef=null,mobileTabIndicatorSettle=null,currentUserId="",profilePhotoUrl=""}) => {
  const navItems = [["today","Today","today"],["activity","Activity","activity"],["month","Month","results"],["history","History","history"]];
  const mobileActiveSlot = MOBILE_PAGE_SLOTS[page] ?? 0;
  const mobileBottomNavBar = React.createElement('div',{ref:mobileBottomNavRef,className:"mobile-only mobile-bottom-nav",style:{transform:mobileBottomDragX?`translateX(${mobileBottomDragX}px)`:"none",transition:mobileBottomDragging?"none":mobileBottomSettle,willChange:mobileBottomDragging||mobileBottomDragX?"transform":"auto"}},
    React.createElement('div',{className:"mobile-bottom-nav-grid"},
      React.createElement('div',{ref:mobileTabIndicatorRef,className:"mobile-tab-indicator",style:{"--mobile-active-slot":mobileActiveSlot,transition:mobileTabIndicatorSettle||undefined}}),
      [
        ["today","Today","today"],
        ["activity","Activity","activity"],
        ["log","","plus"],
        ["month","Month","results"],
        ["history","History","history"]
      ].map(([id,label,icon])=>
        id === "log"
          ? React.createElement('div',{key:id,className:"mobile-plus-tab-wrap"},
              React.createElement('button',{type:"button",onClick:onOpenLog,className:"mobile-plus-tab",title:"Log workout","aria-label":"Log workout"},
                React.createElement(AppIcon,{name:icon,size:24,stroke:"#FFFFFF"})
              )
            )
          : React.createElement('button',{key:id,onClick:()=>setPage(id),className:`mobile-tab${page===id?" on":""}`,"aria-current":page===id?"page":undefined},
          React.createElement('div',{style:{position:"relative",display:"inline-flex",alignItems:"center",justifyContent:"center"}},
            React.createElement('span',{style:{fontSize:18,lineHeight:1,display:"inline-flex"}},React.createElement(AppIcon,{name:icon,size:18})),
            id==="activity" && activityAlertCount>0 && React.createElement('span',{className:"mono",style:{position:"absolute",top:-6,right:-14,minWidth:18,height:18,padding:"0 5px",borderRadius:999,background:"rgba(232,69,69,.18)",border:"1px solid rgba(232,69,69,.28)",fontSize:9,color:"#ff9c9c",display:"inline-flex",alignItems:"center",justifyContent:"center"}},activityAlertCount)
          ),
          React.createElement('span',{style:{fontSize:11,fontWeight:700}},label)
        )
      )
    )
  );
  // The bar floats, so content used to scroll visibly beneath it. This fades
  // the page into the background colour behind the bar instead.
  const mobileBottomNav = React.createElement(React.Fragment,null,
    React.createElement('div',{className:"mobile-only mobile-bottom-scrim"}),
    mobileBottomNavBar
  );
  if (onlyMobileBottomNav) return mobileBottomNav;
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
    React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8}},
      React.createElement(StreamIconButton,{onOpenStream,unreadCount:streamUnreadCount}),
      React.createElement('button',{onClick:onOpenSettings,className:"icon-btn live-icon-btn",title:"Bloc settings",style:{position:"relative"}},React.createElement(AppIcon,{name:"settings",size:14}),settingsAlert&&React.createElement(SettingsDot,null)),
      // The in-Bloc account button was removed: account settings live on the
      // Bloc Switcher, and your own profile is reached by tapping yourself on
      // the leaderboard. Keeping it here duplicated both.
      null
    )
  ),
  React.createElement('div',{className:"desktop-only",style:{background:"var(--s1)",borderBottom:"1px solid var(--border)",padding:"10px 16px 12px",display:"flex",justifyContent:"center"}},
    React.createElement('button',{type:"button",onClick:onSwitchGroup,style:{display:"inline-flex",alignItems:"center",gap:5,padding:"10px 18px",borderRadius:999,background:"rgba(78,205,196,.12)",border:"1px solid rgba(78,205,196,.2)",color:"#4ECDC4",fontSize:14,fontWeight:700}},
      React.createElement(AppIcon,{name:"home",size:16,stroke:"#4ECDC4"}),
      groupName
    )
  ),
  React.createElement('div',{className:"mobile-only mobile-nav-shell"},
    React.createElement('div',{style:{height:58,padding:"0 10px 0 14px",display:"flex",alignItems:"flex-start",gap:8}},
      // The wordmark is gone from here on purpose: it was eating ~70pt that the
      // Bloc name needs. The name must never truncate, and FERO still fronts
      // the Bloc switcher, so the brand is not lost.
      React.createElement('div',{style:{display:"flex",alignItems:"center",height:52,marginTop:6,minWidth:0,flex:"1 1 auto"}},
        React.createElement(BlocNameButton,{groupName,onSwitchGroup})
      ),
      React.createElement('div',{style:{display:"flex",alignItems:"center",height:42,marginTop:6,gap:10,flexShrink:0}},
        React.createElement(StreamIconButton,{onOpenStream,unreadCount:streamUnreadCount,size:42}),
        // Notification centre — MOCK ONLY, deliberately does nothing. It is here
        // so the header is spaced for three buttons and is not reworked when the
        // real thing lands. See docs/concept-2026-09-24-notification-centre.md.
        React.createElement('button',{type:"button",className:"icon-btn nav-glass-btn",title:"Notifications","aria-hidden":"true",tabIndex:-1,style:{width:42,height:42,display:"inline-flex",alignItems:"center",justifyContent:"center",position:"relative"}},React.createElement(AppIcon,{name:"bell",size:26})),
        React.createElement('button',{onClick:onOpenSettings,className:"icon-btn nav-glass-btn",title:"Bloc settings",style:{width:42,height:42,display:"inline-flex",alignItems:"center",justifyContent:"center",position:"relative"}},React.createElement(AppIcon,{name:"settings",size:26}),settingsAlert&&React.createElement(SettingsDot,null)),
        null
      )
    )
  ),
  !hideMobileBottomNav && mobileBottomNav
);};


export { Nav, MOBILE_PAGE_SLOTS };
