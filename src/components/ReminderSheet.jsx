import React from "react";
import { createPortal } from "react-dom";

const { useEffect, useRef } = React;

const DISPLAY_FONT = "'Raleway', sans-serif";

// The full settlement reminder list, opened from "N unpaid" on Today. Centred,
// like every other pop-up in the app; placement="bottom" gives the slide-up
// version the founder also tried.
//
// Portalled to document.body: Today sits inside a transformed swipe surface,
// and Safari treats any transform as the containing block for position:fixed
// children (recurring-debugging-playbook, "Modal lands by the nav bar").
//
// Not built on ModalScrim, because ModalScrim blocks every touchmove on the
// page and this list must scroll once a Bloc has many unpaid months. The page
// behind is locked the same way; only moves that start inside the list are let
// through.
//
// z-index 150 sits over the bottom nav (140) and under .overlay (200). Today
// portals its prompts to document.body while this sheet is open, so they land
// above it at the same root level.
function ReminderSheet({ title, count, onClose, children, placement = "center", panelHidden = false }) {
  const bottom = placement === "bottom";
  const scrollRef = useRef(null);
  const panelHiddenRef = useRef(panelHidden);
  panelHiddenRef.current = panelHidden;
  useEffect(() => {
    const bodyEl = document.body;
    const root = document.documentElement;
    const previous = {
      bodyOverflow: bodyEl.style.overflow,
      rootOverflow: root.style.overflow,
      bodyOverscroll: bodyEl.style.overscrollBehavior
    };
    const blockOutsideScroll = event => {
      if (scrollRef.current && scrollRef.current.contains(event.target)) return;
      if (event.cancelable) event.preventDefault();
    };
    bodyEl.style.overflow = "hidden";
    root.style.overflow = "hidden";
    bodyEl.style.overscrollBehavior = "none";
    document.addEventListener("touchmove", blockOutsideScroll, { passive:false, capture:true });
    document.addEventListener("wheel", blockOutsideScroll, { passive:false, capture:true });
    const onKey = event => { if (event.key === "Escape" && !panelHiddenRef.current) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("touchmove", blockOutsideScroll, { capture:true });
      document.removeEventListener("wheel", blockOutsideScroll, { capture:true });
      document.removeEventListener("keydown", onKey);
      bodyEl.style.overflow = previous.bodyOverflow;
      root.style.overflow = previous.rootOverflow;
      bodyEl.style.overscrollBehavior = previous.bodyOverscroll;
    };
  }, [onClose]);

  return createPortal(
    React.createElement('div',{
      onClick:onClose,
      style:{
        position:"fixed",inset:0,zIndex:150,
        // Dark and heavily blurred, but the page still shows through faintly.
        background:"rgba(2,3,6,.58)",backdropFilter:"blur(18px)",WebkitBackdropFilter:"blur(18px)",
        display:"flex",alignItems:bottom ? "flex-end" : "center",justifyContent:"center",
        padding:bottom ? 0 : "16px 12px",boxSizing:"border-box",
        animation:"fadeIn .18s ease"
      }
    },
      React.createElement('div',{
        role:"dialog","aria-modal":true,"aria-label":title,
        onClick:e=>e.stopPropagation(),
        style:{
          width:"100%",maxWidth:bottom ? 480 : 400,maxHeight:bottom ? "82vh" : "min(78vh, 620px)",display:"flex",flexDirection:"column",
          background:"#0A1412",border:"0.5px solid #163d36",borderBottom:bottom ? "none" : "0.5px solid #163d36",
          borderRadius:bottom ? "20px 20px 0 0" : 20,boxShadow:bottom ? "0 -18px 42px rgba(0,0,0,.45)" : "0 24px 60px rgba(0,0,0,.5)",
          paddingBottom:bottom ? "env(safe-area-inset-bottom)" : 0,boxSizing:"border-box",overflow:"hidden",
          // While a prompt opened from the sheet is up, only the panel steps
          // aside; the backdrop stays, so nothing behind flashes through.
          opacity:panelHidden ? 0 : 1,pointerEvents:panelHidden ? "none" : "auto",transition:"opacity .15s ease"
        }
      },
        bottom && React.createElement('div',{style:{display:"flex",justifyContent:"center",paddingTop:8}},
          React.createElement('span',{"aria-hidden":true,style:{width:36,height:4,borderRadius:999,background:"rgba(125,184,177,.22)"}})
        ),
        React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:bottom ? "12px 18px 12px" : "18px 18px 12px"}},
          React.createElement('div',{style:{minWidth:0}},
            React.createElement('div',{style:{fontFamily:DISPLAY_FONT,fontSize:18,fontWeight:800,color:"var(--text)",lineHeight:1.15}},title),
            React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:11.5,fontWeight:600,color:"#E0624A",marginTop:3}},`${count} unpaid`)
          ),
          React.createElement('button',{
            type:"button",onClick:onClose,"aria-label":"Close",
            style:{
              width:30,height:30,borderRadius:999,flexShrink:0,display:"inline-flex",alignItems:"center",justifyContent:"center",
              background:"rgba(255,255,255,.04)",border:"0.5px solid rgba(125,184,177,.2)",color:"#7DB8B1",padding:0,cursor:"pointer"
            }
          },
            React.createElement('svg',{width:12,height:12,viewBox:"0 0 12 12","aria-hidden":true},
              React.createElement('path',{d:"M2 2l8 8M10 2l-8 8",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round"})
            )
          )
        ),
        React.createElement('div',{
          ref:scrollRef,
          style:{overflowY:"auto",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain",padding:bottom ? "2px 14px 20px" : "2px 14px 16px",display:"flex",flexDirection:"column",gap:14}
        }, children)
      )
    ),
    document.body
  );
}

export { ReminderSheet };
