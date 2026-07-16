import React from "react";
const { useState, useEffect, useMemo, useCallback, useRef } = React;
import {
  WORKOUT_TYPES,
  DEFAULT_CURRENCY,
  NAMES,
  MIN_TARGET,
  ACTIVE_SEASON_OVERRIDES,
  CUR_MONTH,
  CUR_YEAR,
  DAY_OF_MON,
  curKey,
  MONTH_NAMES,
  fmtISO,
  calcPenalties,
  getLoserAmount,
  normalizeSeasonOverrides,
  getCurrentMemberTarget,
  getCurrentMemberTargetInfo,
  fmtCurrency,
  getCountedLogs,
  getCountedLogCount,
  isJoinedForMonth
} from "../lib/appState.js";
import {
  isMobile
} from "../lib/utils.js";
import { Avatar, WorkoutTypeIcon, Bar, Card, SelectField } from "../components/primitives.jsx";
import { DeleteModal } from "../modals/modals.jsx";

const PlayerProfile = ({name,logs,excused,monthHistory,onBack,groupSettings,onDeleteLog,initialMonthKey}) => {
  const compactMobile = isMobile();
  const [deleteTarget,setDeleteTarget]=useState(null);
  const [dragX,setDragX]=useState(0);
  const [dragging,setDragging]=useState(false);
  const swipeRef=useRef({sx:0,sy:0,active:false,mode:null});
  const currency = groupSettings?.currency || DEFAULT_CURRENCY;
  const [selMonthIdx,setSelMonthIdx]=useState(null); // null = current month
  const appliedInitialMonthKeyRef = useRef(null);
  const histReversed=[...monthHistory].reverse();
  const visibleHistoryMonths=histReversed.filter(m=>isJoinedForMonth(name, m?.key));
  useEffect(()=>{
    const selectionKey = initialMonthKey ? `${name}:${initialMonthKey}` : "";
    if (!initialMonthKey || appliedInitialMonthKeyRef.current === selectionKey) return;
    const idx = visibleHistoryMonths.findIndex(m => m?.key === initialMonthKey);
    if (idx >= 0) {
      setSelMonthIdx(idx);
      appliedInitialMonthKeyRef.current = selectionKey;
    }
  }, [name, initialMonthKey, visibleHistoryMonths]);
  const isCurMonth=selMonthIdx===null;
  const selHistMonth=isCurMonth?null:visibleHistoryMonths[selMonthIdx];
  const selectedMonthKey = isCurMonth ? curKey : selHistMonth?.key;
  const isJoinedThisMonth = isJoinedForMonth(name, selectedMonthKey);
  const currentTargetInfo = isCurMonth ? getCurrentMemberTargetInfo(name, curKey, MIN_TARGET) : null;
  const currentMonthOverride = isCurMonth ? (normalizeSeasonOverrides(ACTIVE_SEASON_OVERRIDES)?.[curKey] || null) : null;

  // Closed month all-time stats
  const closedStats=useMemo(()=>{
    let wins=0,moneyWon=0,moneyLost=0,closedTotal=0;
    monthHistory.forEach(m=>{
      if(!isJoinedForMonth(name, m.key)) return;
      if(m.excused?.[name]) return;
      const ac=NAMES.filter(n=>isJoinedForMonth(n, m.key) && !m.excused?.[n]).map(n=>({name:n,count:m.counts[n]||0,target:m.memberTargets?.[n] || m.settings?.minTarget || MIN_TARGET}));
      const penalties = calcPenalties(ac, m.settings || {});
      const {winners,losers,perWinner}=penalties;
      closedTotal+=m.counts[name]||0;
      if(winners.find(w=>w.name===name)){wins++;moneyWon+=perWinner;}
      if(losers.find(l=>l.name===name)){moneyLost+=getLoserAmount(penalties, name);}
    });
    const participated=monthHistory.filter(m=>isJoinedForMonth(name, m.key) && !m.excused?.[name]);
    const avg=participated.length?(closedTotal/participated.length).toFixed(1):"—";
    return {wins,moneyWon,moneyLost,avg};
  },[name,monthHistory]);

  // Selected month data
  const selCount = isCurMonth
    ? getCountedLogCount(logs[name]||[])
    : (selHistMonth?.counts[name]||0);
  const isExcusedThisMonth = isCurMonth
    ? (excused[name]?.[curKey]||false)
    : (selHistMonth?.excused?.[name]||false);

  // Logs for selected period
  const selLogs = isCurMonth ? (logs[name]||[]) : (selHistMonth?.logsByUser?.[name] || []);
  const visibleSelLogs = getCountedLogs(selLogs);
  const hasDetailedLogs = isCurMonth || Boolean(selHistMonth?.logsByUser);
  const hasHistory=monthHistory.length>0;
  const netPL=closedStats.moneyWon-closedStats.moneyLost;
  const selectedTarget = isCurMonth
    ? getCurrentMemberTarget(name, curKey, MIN_TARGET)
    : (selHistMonth?.memberTargets?.[name] || selHistMonth?.settings?.minTarget || MIN_TARGET);
  const needed=Math.max(0,selectedTarget-selCount);
  const tBreak={};WORKOUT_TYPES.forEach(t=>tBreak[t]=0);
  visibleSelLogs.forEach(l=>{if(tBreak[l.type]!==undefined)tBreak[l.type]++;});
  const maxT=Math.max(...Object.values(tBreak),1);
  const selYear = isCurMonth ? CUR_YEAR : (selHistMonth?.year ?? CUR_YEAR);
  const selMonthNum = isCurMonth ? CUR_MONTH : (selHistMonth?.month ?? CUR_MONTH);
  const selDaysInMonth = new Date(selYear, selMonthNum + 1, 0).getDate();
  const firstDay=new Date(selYear, selMonthNum, 1).getDay();
  const calDays=[...Array(firstDay).fill(null),...Array.from({length:selDaysInMonth},(_,i)=>i+1)];
  const logsByDay={};
  selLogs.forEach(l=>{
    const d = Number(String(l?.date || "").split("-")[2]);
    if (Number.isFinite(d)) logsByDay[d]=l;
  });
  const selLabel=isCurMonth?`${MONTH_NAMES[CUR_MONTH]} '${String(CUR_YEAR).slice(2)}`:selHistMonth?.label;

  const monthSelector = React.createElement(SelectField,{
    value:selMonthIdx??"",
    onChange:e=>setSelMonthIdx(e.target.value===""?null:Number(e.target.value)),
    width:156,
    compact:true,
    arrowColor:"#4ECDC4",
    options:[
      {value:"",label:`${MONTH_NAMES[CUR_MONTH]} '${String(CUR_YEAR).slice(2)} (Current)`},
      ...visibleHistoryMonths.map((m,i)=>({value:i,label:m.label}))
    ]
  });

  const sitOutBanner = isExcusedThisMonth
    ? React.createElement('div',{style:{background:"rgba(101,101,122,.12)",border:"1px solid var(--border2)",borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:10}},
        React.createElement('span',{style:{fontSize:18}},"💤"),
        React.createElement('div',{style:{fontSize:13,color:"var(--muted)",marginLeft:4}},isCurMonth?"Sitting out this month":"Sat out this month")
      )
    : null;

  const notJoinedBanner = !isJoinedThisMonth
    ? React.createElement('div',{style:{background:"rgba(101,101,122,.12)",border:"1px solid var(--border2)",borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:10}},
        React.createElement('span',{style:{fontSize:18}},"⏳"),
        React.createElement('div',{style:{fontSize:13,color:"var(--muted)",marginLeft:4}},"Not joined")
      )
    : null;

  const stats=[
    {label:"Workouts",val:selCount||"—",sub:selLabel,color:"var(--text)"},
    {label:"Monthly Avg",val:closedStats.avg,sub:"per closed month",subColor:"#1E4040",subSize:11,color:"var(--text)"},
    {label:"Need",val:needed===0?"✓":needed,sub:needed===0?"target hit!":`to hit ${selectedTarget}`,subNote:isCurMonth&&currentTargetInfo?.prorationSource==="member"?"joined mid-month":isCurMonth&&currentMonthOverride?.prorated?"prorated":null,color:"#4ECDC4"},
    {label:"Wins",val:hasHistory?(closedStats.wins||"—"):"—",sub:hasHistory?"months won":"end of month",color:hasHistory&&closedStats.wins>0?"var(--gold)":"var(--muted)"},
    {label:"Net P&L",val:hasHistory?(netPL===0?fmtCurrency(0,currency):`${netPL>0?"+":"-"}${fmtCurrency(Math.abs(netPL),currency)}`):"—",sub:hasHistory?"won minus lost":"end of month",color:hasHistory?(netPL>0?"var(--green)":netPL<0?"var(--red)":"var(--muted)"):"var(--muted)"},
  ];
  const startSwipeBack=e=>{
    e.stopPropagation();
    const t=e.touches?.[0];
    if(!t||t.clientX>48) return;
    swipeRef.current={sx:t.clientX,sy:t.clientY,active:true,mode:null};
  };
  const moveSwipeBack=e=>{
    e.stopPropagation();
    const s=swipeRef.current,t=e.touches?.[0];
    if(!s.active||!t) return;
    const dx=t.clientX-s.sx,dy=t.clientY-s.sy;
    if(!s.mode&&(Math.abs(dx)>8||Math.abs(dy)>8)){
      s.mode=dx>0&&Math.abs(dx)>Math.abs(dy)*1.2?"back":"scroll";
      setDragging(s.mode==="back");
    }
    if(s.mode==="back") setDragX(Math.max(0,Math.min(dx,window.innerWidth||420)));
  };
  const endSwipeBack=e=>{
    e.stopPropagation();
    const s=swipeRef.current,t=e.changedTouches?.[0];
    swipeRef.current={sx:0,sy:0,active:false,mode:null};
    if(!s.active||!t) return;
    const dx=t.clientX-s.sx,dy=t.clientY-s.sy,screenWidth=window.innerWidth||420;
    const shouldClose=s.mode==="back"&&dx>screenWidth/2&&Math.abs(dy)<90&&dx>Math.abs(dy)*1.15;
    setDragging(false);
    if(shouldClose){
      setDragX(screenWidth);
      window.setTimeout(()=>onBack?.(),115);
    }else{
      setDragX(0);
    }
  };

  return React.createElement('div',{onTouchStart:startSwipeBack,onTouchMove:moveSwipeBack,onTouchEnd:endSwipeBack,onTouchCancel:e=>{e.stopPropagation();swipeRef.current={sx:0,sy:0,active:false,mode:null};setDragging(false);setDragX(0);},style:{minHeight:"100vh",background:"var(--bg)",transform:dragX?`translateX(${dragX}px)`:"translateX(0)",transition:dragging?"none":"transform .14s ease",boxShadow:dragX?"-18px 0 34px rgba(0,0,0,.28)":"none",willChange:"transform",touchAction:"pan-y"}},
    deleteTarget && React.createElement(DeleteModal,{log:deleteTarget,onClose:()=>setDeleteTarget(null),onConfirm:async()=>{ const log = deleteTarget; setDeleteTarget(null); await onDeleteLog(log); }}),
    React.createElement('div',{style:{maxWidth:740,margin:"0 auto",padding:"16px",display:"flex",flexDirection:"column",gap:12}},
    // Header row
    compactMobile
      ? React.createElement('div',{className:"fu",style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:14}},
          React.createElement('div',{style:{display:"flex",alignItems:"center",gap:11,minWidth:0,flex:1}},
            React.createElement(Avatar,{name,size:36}),
            React.createElement('div',{style:{minWidth:0}},
              React.createElement('span',{className:"lbl"},"Player Profile"),
              React.createElement('div',{style:{fontSize:22,fontWeight:800,lineHeight:1.1}},name)
            )
          ),
          React.createElement('div',{style:{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8,flexShrink:0}},
            React.createElement('button',{onClick:onBack,style:{background:"var(--s2)",border:"1px solid var(--border)",color:"var(--muted)",padding:"5px 10px",borderRadius:7,fontSize:13,fontFamily:"'JetBrains Mono',monospace",lineHeight:1.1}},"← Back"),
            monthSelector
          )
        )
      : React.createElement('div',{className:"fu",style:{display:"grid",gridTemplateColumns:"1fr auto 1fr",gridTemplateRows:"auto auto",alignItems:"start",rowGap:10,columnGap:16}},
          React.createElement('div',{style:{gridColumn:"1 / 2",gridRow:"1 / 2",justifySelf:"start",alignSelf:"center"}},
            React.createElement('button',{onClick:onBack,style:{background:"var(--s2)",border:"1px solid var(--border)",color:"var(--muted)",padding:"5px 10px",borderRadius:7,fontSize:13,fontFamily:"'JetBrains Mono',monospace",lineHeight:1.1}},"← Back")
          ),
          React.createElement('div',{style:{gridColumn:"2 / 3",gridRow:"1 / 2",display:"flex",alignItems:"center",gap:11,minWidth:0,justifySelf:"center",textAlign:"center"}},
            React.createElement(Avatar,{name,size:36}),
            React.createElement('div',{style:{minWidth:0}},
              React.createElement('span',{className:"lbl"},"Player Profile"),
              React.createElement('div',{style:{fontSize:22,fontWeight:800,lineHeight:1.1}},name)
            )
          ),
          React.createElement('div',{style:{gridColumn:"3 / 4",gridRow:"1 / 2",justifySelf:"end",alignSelf:"center"}},
            monthSelector
          )
        ),
    // Sit out banner
    notJoinedBanner || sitOutBanner,
    // Stats — always show summary cards
    isJoinedThisMonth&&!isExcusedThisMonth&&React.createElement('div',{className:"fu2",style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}},
      stats.slice(0,3).map(x=>React.createElement(Card,{key:x.label,style:{padding:"7px 9px"}},
        React.createElement('span',{className:"lbl",style:{fontSize:9,marginBottom:2}},x.label),
        React.createElement('div',{style:{fontSize:17,fontWeight:800,color:x.color,lineHeight:1}},x.val),
        React.createElement('div',{style:{fontSize:x.subSize||10,color:x.subColor||"var(--muted)",marginTop:2}},x.sub),
        x.subNote&&React.createElement('div',{className:"mono",style:{fontSize:8,color:"var(--muted)",marginTop:2,textTransform:"uppercase",letterSpacing:".08em"}},x.subNote)
      ))
    ),
    isJoinedThisMonth&&!isExcusedThisMonth&&React.createElement('div',{className:"fu2",style:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}},
      stats.slice(3).map(x=>React.createElement(Card,{key:x.label,style:{padding:"7px 9px"}},
        React.createElement('span',{className:"lbl",style:{fontSize:9,marginBottom:2}},x.label),
        React.createElement('div',{style:{fontSize:16,fontWeight:800,color:x.color,lineHeight:1}},x.val),
        React.createElement('div',{style:{fontSize:x.subSize||10,color:x.subColor||"var(--muted)",marginTop:2}},x.sub)
      ))
    ),
    isJoinedThisMonth&&!isExcusedThisMonth&&React.createElement(Card,{className:"fu3",style:{padding:"16px"}},
      React.createElement('div',{style:{fontWeight:800,fontSize:14,marginBottom:14}},`Workout Breakdown — ${selLabel}`),
      !hasDetailedLogs
        ? React.createElement('div',{style:{color:"var(--muted)",fontSize:13,textAlign:"center",padding:"8px 0"}},"Detailed logs were not saved for this month.")
        : selCount===0
        ? React.createElement('div',{style:{color:"var(--muted)",fontSize:13,textAlign:"center",padding:"8px 0"}},"No workouts logged yet.")
        : WORKOUT_TYPES.map(t=>React.createElement('div',{key:t,style:{display:"flex",alignItems:"center",gap:10,marginBottom:9}},
            React.createElement('span',{style:{width:22,minWidth:22,height:22,display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#dbe8ff"}},React.createElement(WorkoutTypeIcon,{type:t,size:16})),
            React.createElement('div',{style:{minWidth:40,fontSize:13,fontWeight:600}},t),
            React.createElement('div',{style:{flex:1}},React.createElement(Bar,{value:tBreak[t],max:maxT,color:tBreak[t]===0?"#0D2828":t==="Gym"?"#4ECDC4":"#1E4040"})),
            React.createElement('span',{className:"mono",style:{fontSize:13,fontWeight:700,minWidth:18,textAlign:"right",color:tBreak[t]>0?"var(--text)":"var(--muted2)"}},tBreak[t])
          ))
    ),
    isJoinedThisMonth&&!isExcusedThisMonth&&React.createElement(Card,{className:"fu4",style:{padding:16}},
      React.createElement('div',{style:{fontWeight:800,fontSize:14,marginBottom:12}},`${selLabel} · Log`),
      React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:5}},
        ["S","M","T","W","T","F","S"].map((d,i)=>React.createElement('div',{key:i,className:"mono",style:{textAlign:"center",fontSize:9,color:"var(--muted2)",padding:"1px 0"}},d))
      ),
      React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}},
        calDays.map((day,i)=>{
          if(!day) return React.createElement('div',{key:`e${i}`});
          const isToday=isCurMonth&&day===DAY_OF_MON,log=logsByDay[day],isFuture=isCurMonth&&day>DAY_OF_MON;
          const canDelete = !!log && isCurMonth && !!onDeleteLog;
          return React.createElement('div',{key:day, onClick: canDelete ? ()=>setDeleteTarget(log) : undefined, style:{aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:6,fontSize:log?13:10,fontFamily:log?"inherit":"'JetBrains Mono',monospace",fontWeight:log?700:400,background:log?"#1A2E4A":isToday?"var(--s2)":"transparent",color:log?"#4ECDC4":isFuture?"var(--muted2)":isToday?"var(--text)":"var(--muted)",border:isToday&&!log?"1px solid var(--border2)":"1px solid transparent",cursor:canDelete?"pointer":"default"}},log?React.createElement(WorkoutTypeIcon,{type:log.type,size:18}):day);
        })
      ),
      hasDetailedLogs&&visibleSelLogs.length>0&&React.createElement('div',{style:{marginTop:14,borderTop:"1px solid var(--border)",paddingTop:12}},
        React.createElement('span',{className:"lbl",style:{marginBottom:8}},"All Logs"),
        ([...selLogs]).sort((a,b)=>String(b?.date || "").localeCompare(String(a?.date || ""))).map((l,i,arr)=>
          React.createElement('div',{key:l.id,style:{display:"flex",alignItems:"center",gap:10,paddingBottom:7,marginBottom:7,borderBottom:i<arr.length-1?"1px solid var(--border)":"none"}},
            React.createElement('span',{style:{width:20,height:20,display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#dbe8ff"}},React.createElement(WorkoutTypeIcon,{type:l.type,size:15})),
            React.createElement('div',{style:{flex:1,fontWeight:600,fontSize:14}},l.type),
            React.createElement('span',{className:"mono",style:{fontSize:11,color:"var(--muted)"}},fmtISO(l.date))
          )
        )
      )
    )
  ));
};

// ─── TODAY PAGE ───────────────────────────────────────────────────────────────

export { PlayerProfile };
