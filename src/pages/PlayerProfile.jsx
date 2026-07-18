import React from "react";
const { useState, useEffect, useMemo, useRef } = React;
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
  calcPenalties,
  getLoserAmount,
  normalizeSeasonOverrides,
  getCurrentMemberTarget,
  getCurrentMemberTargetInfo,
  getHistoricalMemberNamesForMonth,
  getHistoricalGroupMemberNames,
  fmtCurrency,
  getCountedLogs,
  getCountedLogCount,
  isJoinedForMonth
} from "../lib/appState.js";
import {
  isMobile
} from "../lib/utils.js";
import { Avatar, WorkoutTypeIcon, Bar, Card, SelectField, TargetHitHexIcon, AppIcon } from "../components/primitives.jsx";
import { DeleteModal } from "../modals/modals.jsx";

const PLAYER_PROFILE_PREMIUM_GATE = false; // Built now; flip to true when premium gating is wired.
const FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const profileMonthLabel = month => month ? `${FULL_MONTH_NAMES[month.month] || MONTH_NAMES[month.month]} ${month.year}` : "—";
const profileMonthOptionLabel = month => month ? `${MONTH_NAMES[month.month]} '${String(month.year).slice(2)}` : "—";

const PlayerProfile = ({name,logs,excused,monthHistory,onBack,onSwipeRevealChange,groupSettings,onDeleteLog,initialMonthKey}) => {
  const compactMobile = isMobile();
  const [deleteTarget,setDeleteTarget]=useState(null);
  const [sparkDetailKey,setSparkDetailKey]=useState(null);
  const [dragX,setDragX]=useState(0);
  const [dragging,setDragging]=useState(false);
  const swipeRef=useRef({sx:0,sy:0,active:false,mode:null});
  const currency = groupSettings?.currency || DEFAULT_CURRENCY;
  const [selMonthIdx,setSelMonthIdx]=useState(null); // null = current month
  const appliedInitialMonthKeyRef = useRef(null);
  const histReversed=[...monthHistory].reverse();
  const historicalNames=useMemo(
    ()=>getHistoricalGroupMemberNames(monthHistory, logs, excused, NAMES),
    [monthHistory, logs, excused]
  );
  const visibleHistoryMonths=histReversed.filter(m=>getHistoricalMemberNamesForMonth(m, historicalNames).includes(name));
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
  const isJoinedThisMonth = isCurMonth
    ? isJoinedForMonth(name, selectedMonthKey)
    : !!selHistMonth && getHistoricalMemberNamesForMonth(selHistMonth, historicalNames).includes(name);
  const currentTargetInfo = isCurMonth ? getCurrentMemberTargetInfo(name, curKey, MIN_TARGET) : null;
  const currentMonthOverride = isCurMonth ? (normalizeSeasonOverrides(ACTIVE_SEASON_OVERRIDES)?.[curKey] || null) : null;

  // Closed month all-time stats
  const closedStats=useMemo(()=>{
    let wins=0,moneyWon=0,moneyLost=0,closedTotal=0;
    monthHistory.forEach(m=>{
      const monthNames = getHistoricalMemberNamesForMonth(m, historicalNames);
      if(!monthNames.includes(name)) return;
      if(m.excused?.[name]) return;
      const ac=monthNames.filter(n=>isJoinedForMonth(n, m.key) && !m.excused?.[n]).map(n=>({name:n,count:m.counts[n]||0,target:m.memberTargets?.[n] || m.settings?.minTarget || MIN_TARGET}));
      const penalties = calcPenalties(ac, m.settings || {});
      const {winners,losers,perWinner}=penalties;
      closedTotal+=m.counts[name]||0;
      if(winners.find(w=>w.name===name)){wins++;moneyWon+=perWinner;}
      if(losers.find(l=>l.name===name)){moneyLost+=getLoserAmount(penalties, name);}
    });
    const participated=monthHistory.filter(m=>getHistoricalMemberNamesForMonth(m, historicalNames).includes(name) && !m.excused?.[name]);
    const avg=participated.length?(closedTotal/participated.length).toFixed(1):"—";
	    return {wins,moneyWon,moneyLost,avg};
	  },[name,monthHistory,historicalNames]);

  const profileMonths = useMemo(()=>{
    const closed = monthHistory
      .filter(m=>getHistoricalMemberNamesForMonth(m, historicalNames).includes(name) && !m.excused?.[name])
      .map(m=>({
        key:m.key,
        label:m.label,
        month:m.month,
        year:m.year,
        count:Number(m.counts?.[name] || 0),
        target:m.memberTargets?.[name] || m.settings?.minTarget || MIN_TARGET,
        settings:m.settings || {},
        counts:m.counts || {},
        memberTargets:m.memberTargets || {},
        excused:m.excused || {},
        closed:true
      }));
    const current = isJoinedForMonth(name, curKey) && !excused?.[name]?.[curKey]
      ? [{
          key:curKey,
          label:`${MONTH_NAMES[CUR_MONTH]} '${String(CUR_YEAR).slice(2)}`,
          month:CUR_MONTH,
          year:CUR_YEAR,
          count:getCountedLogCount(logs[name] || []),
          target:getCurrentMemberTarget(name, curKey, MIN_TARGET),
          settings:groupSettings || {},
          counts:{[name]:getCountedLogCount(logs[name] || [])},
          excused:{},
          closed:false
        }]
      : [];
    return [...closed, ...current].sort((a,b)=>a.key.localeCompare(b.key));
  },[name,monthHistory,historicalNames,logs,excused,groupSettings]);

  const perfectMonthStats = useMemo(()=>{
    const perfectMonths = profileMonths.filter(m=>{
      if (!m.closed) return false;
      const monthNames = getHistoricalMemberNamesForMonth(m, historicalNames);
      const activeCounts = monthNames
        .filter(n=>isJoinedForMonth(n, m.key) && !m.excused?.[n])
        .map(n=>({name:n,count:Number(m.counts?.[n] || 0),target:m.memberTargets?.[n] || m.settings?.minTarget || MIN_TARGET}));
      const { losers } = calcPenalties(activeCounts, m.settings || {});
      return Number(m.count || 0) >= Number(m.target || MIN_TARGET) && !losers.some(l=>l.name===name);
    });
    const perfectKeys = new Set(perfectMonths.map(m=>m.key));
    let activeStreak = 0;
    const closedMonths = profileMonths.filter(m=>m.closed).sort((a,b)=>b.key.localeCompare(a.key));
    for (const m of closedMonths) {
      if (!perfectKeys.has(m.key)) break;
      activeStreak += 1;
    }
    return { count:perfectMonths.length, activeStreak };
  },[name,profileMonths,historicalNames]);

  const bestBlocMonth = useMemo(()=>{
    const eligible = profileMonths.filter(m=>Number.isFinite(Number(m.count)));
    if (!eligible.length) return null;
    return eligible.reduce((best,m)=>Number(m.count) > Number(best.count) ? m : best, eligible[0]);
  },[profileMonths]);

  const sparkMonths = profileMonths.slice(-8);
  const sparkMax = Math.max(1, ...sparkMonths.map(m=>Number(m.count || 0)));

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
  const workoutBreakdownRows = WORKOUT_TYPES.filter(t=>tBreak[t] > 0);
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
  const selLabel=isCurMonth?`${MONTH_NAMES[CUR_MONTH]} ${CUR_YEAR}`:profileMonthLabel(selHistMonth);

  const monthSelector = React.createElement(SelectField,{
    value:selMonthIdx??"",
    onChange:e=>setSelMonthIdx(e.target.value===""?null:Number(e.target.value)),
    width:96,
    compact:true,
    arrowColor:"#4ECDC4",
    textAlign:"center",
    inputStyle:{background:"rgba(8,15,15,.48)",border:"1px solid rgba(78,205,196,.18)",color:"var(--text)",fontFamily:"'Outfit',sans-serif",fontSize:10.5,fontWeight:700,letterSpacing:0,padding:"6px 20px 6px 8px",textAlign:"center",boxShadow:"none"},
    options:[
      {value:"",label:"This Month"},
      ...visibleHistoryMonths.map((m,i)=>({value:i,label:profileMonthOptionLabel(m)}))
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
    {label:"Workouts",val:selCount||"—",sub:null,color:"var(--text)"},
    {label:"Average",val:closedStats.avg,sub:null,color:"var(--text)"},
    {label:"Target",valueNode:needed===0?React.createElement(TargetHitHexIcon,{size:22}):needed,sub:needed===0?"target hit!":`more to go`,subNote:isCurMonth&&currentTargetInfo?.prorationSource==="member"?"joined mid-month":isCurMonth&&currentMonthOverride?.prorated?"prorated":null,color:"#4ECDC4"},
    {label:"Perfect Month",val:perfectMonthStats.count||"—",sub:null,color:"var(--text)"},
    {label:"Months Won",val:hasHistory?(closedStats.wins||"—"):"—",sub:null,color:hasHistory&&closedStats.wins>0?"var(--gold)":"var(--muted)"},
    {label:"Keeping Score",val:hasHistory?(netPL===0?fmtCurrency(0,currency):`${netPL>0?"+":"-"}${fmtCurrency(Math.abs(netPL),currency)}`):"—",sub:null,color:hasHistory?(netPL>0?"var(--green)":netPL<0?"var(--red)":"var(--muted)"):"var(--muted)"},
  ];
  const startSwipeBack=e=>{
    e.stopPropagation();
    const t=e.touches?.[0];
    if(!t||t.clientX>72) return;
    swipeRef.current={sx:t.clientX,sy:t.clientY,st:performance.now(),active:true,mode:null};
  };
  const moveSwipeBack=e=>{
    e.stopPropagation();
    const s=swipeRef.current,t=e.touches?.[0];
    if(!s.active||!t) return;
    const dx=t.clientX-s.sx,dy=t.clientY-s.sy;
    if(!s.mode&&(Math.abs(dx)>4||Math.abs(dy)>4)){
      s.mode=dx>0&&Math.abs(dx)>Math.abs(dy)?"back":"scroll";
      setDragging(s.mode==="back");
      onSwipeRevealChange?.(s.mode==="back");
    }
    if(s.mode==="back") setDragX(Math.max(0,Math.min(dx,window.innerWidth||420)));
  };
  const endSwipeBack=e=>{
    e.stopPropagation();
    const s=swipeRef.current,t=e.changedTouches?.[0];
    swipeRef.current={sx:0,sy:0,active:false,mode:null};
    if(!s.active||!t) return;
    const dx=t.clientX-s.sx,dy=t.clientY-s.sy,screenWidth=window.innerWidth||420;
    const elapsed=Math.max(1,performance.now()-(s.st||performance.now()));
    const fastEdgeFlick=dx>24&&elapsed<260&&dx/elapsed>0.22&&dx>Math.abs(dy);
    const dominantDrag=dx>screenWidth/2&&Math.abs(dy)<100&&dx>Math.abs(dy);
    const shouldClose=s.mode==="back"&&(fastEdgeFlick||dominantDrag);
    setDragging(false);
    if(shouldClose){
      setDragX(screenWidth);
      window.setTimeout(()=>onBack?.(),45);
    }else{
      onSwipeRevealChange?.(false);
      setDragX(0);
    }
  };

  const labelStyle = {fontFamily:"'Outfit',sans-serif",fontSize:9,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".08em",lineHeight:1.1};
  const backButton = React.createElement('button',{onClick:onBack,style:{display:"inline-flex",alignItems:"center",gap:3,background:"transparent",border:"none",color:"#1E4040",padding:"2px 0",borderRadius:0,fontSize:13,fontFamily:"'Outfit',sans-serif",fontWeight:700,lineHeight:1.1}},
    React.createElement(AppIcon,{name:"chevron-left",size:13,stroke:"#1E4040"}),
    "Back"
  );
  const renderStatCard = x => React.createElement(Card,{key:x.label,style:{padding:"7px 8px",minWidth:0,textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:x.sub||x.subNote?4:6}},
    React.createElement('span',{style:{...labelStyle,display:"flex",alignItems:"center",justifyContent:"center",gap:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",textAlign:"center",width:"100%"}},
      x.icon,
      x.label
    ),
    React.createElement('div',{style:{fontFamily:"'Outfit',sans-serif",fontSize:15,fontWeight:800,color:x.color,lineHeight:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",display:"flex",alignItems:"center",justifyContent:"center"}},x.valueNode||x.val),
    x.sub&&React.createElement('div',{style:{fontFamily:"'Outfit',sans-serif",fontSize:x.subSize||10,color:x.subColor||"var(--muted)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",textAlign:"center"}},x.sub),
    x.subNote&&React.createElement('div',{style:{fontFamily:"'Outfit',sans-serif",fontSize:8,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".08em",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},x.subNote)
  );
  const TREND_AXIS_MAX = 20;
  const trendTicks = [20, 15, 10, 5, 0];
  const sparkCoords = sparkMonths.map((m,i)=>{
    const x = sparkMonths.length === 1 ? 50 : (i/(sparkMonths.length-1))*100;
    const y = 36 - (Math.min(Number(m.count || 0), TREND_AXIS_MAX)/TREND_AXIS_MAX)*30;
    return { month:m, x, y };
  });
  const sparkPoints = sparkCoords.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const selectedSparkMonth = sparkMonths.find(m=>m.key===sparkDetailKey);
  const premiumSection = !PLAYER_PROFILE_PREMIUM_GATE && isJoinedThisMonth&&!isExcusedThisMonth && React.createElement(React.Fragment,null,
    React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:2}},
      React.createElement(AppIcon,{name:"sparkles",size:12,stroke:"#EF9F27"}),
      React.createElement('span',{style:{fontFamily:"'Outfit',sans-serif",fontSize:9.5,color:"#EF9F27",letterSpacing:".1em",textTransform:"uppercase",fontWeight:700}},"Premium · This Bloc")
    ),
    React.createElement('div',{className:"fu2",style:{display:"grid",gridTemplateColumns:compactMobile?"1fr":"repeat(2,1fr)",gap:8}},
      React.createElement(Card,{style:{padding:"13px 12px",textAlign:"center"}},
        React.createElement('span',{style:{...labelStyle,fontSize:9,display:"block",textAlign:"center",marginBottom:8}},"Best Month"),
        React.createElement('div',{style:{fontFamily:"'Outfit',sans-serif",fontSize:18,fontWeight:800,lineHeight:1,color:"var(--text)",marginBottom:7}},bestBlocMonth ? profileMonthLabel(bestBlocMonth) : "—"),
        React.createElement('div',{style:{fontFamily:"'Outfit',sans-serif",fontSize:11,color:"var(--muted)"}},bestBlocMonth ? `${bestBlocMonth.count} workouts` : "No workouts yet")
      ),
      React.createElement(Card,{style:{padding:"11px 12px",textAlign:"center"}},
        React.createElement('span',{style:{...labelStyle,fontSize:9,display:"block",textAlign:"center",marginBottom:8}},"Workout Trend: 2026"),
        sparkMonths.length
          ? React.createElement(React.Fragment,null,
              React.createElement('div',{style:{display:"grid",gridTemplateColumns:"18px minmax(0,1fr)",gap:7,alignItems:"stretch"}},
                React.createElement('div',{style:{display:"grid",gridTemplateRows:"repeat(5,1fr)",alignItems:"center",justifyItems:"end",padding:"0 0 12px",fontFamily:"'Outfit',sans-serif",fontSize:8.5,color:"var(--muted)"}},
                  trendTicks.map(t=>React.createElement('span',{key:t},t))
                ),
                React.createElement('div',null,
              React.createElement('svg',{width:"100%",height:46,viewBox:"0 0 100 42",preserveAspectRatio:"none",style:{display:"block",overflow:"visible"}},
                React.createElement('line',{x1:0,y1:36,x2:100,y2:36,stroke:"rgba(78,205,196,.18)",strokeWidth:1,vectorEffect:"non-scaling-stroke"}),
                React.createElement('line',{x1:0,y1:6,x2:0,y2:36,stroke:"rgba(78,205,196,.18)",strokeWidth:1,vectorEffect:"non-scaling-stroke"}),
                React.createElement('polyline',{points:sparkPoints,fill:"none",stroke:"#4ECDC4",strokeWidth:2.2,strokeLinecap:"round",strokeLinejoin:"round",vectorEffect:"non-scaling-stroke"}),
                sparkCoords.map(p=>React.createElement('circle',{key:p.month.key,cx:p.x,cy:p.y,r:p.month.key===sparkDetailKey?2.4:2,fill:p.month.key===sparkDetailKey?"#FFFFFF":"#4ECDC4",stroke:"rgba(5,12,12,.95)",strokeWidth:1,style:{cursor:"pointer",filter:"drop-shadow(0 1px 2px rgba(78,205,196,.36))"},onClick:()=>setSparkDetailKey(k=>k===p.month.key?null:p.month.key)}))
              ),
              React.createElement('div',{style:{display:"grid",gridTemplateColumns:`repeat(${sparkMonths.length},1fr)`,gap:2,marginTop:3}},
                sparkMonths.map(m=>React.createElement('span',{key:m.key,style:{fontFamily:"'Outfit',sans-serif",fontSize:8.5,color:"var(--muted)",textAlign:"center"}},MONTH_NAMES[m.month]?.slice(0,3)||"—"))
              )
                )
              ),
              selectedSparkMonth&&React.createElement('div',{style:{fontFamily:"'Outfit',sans-serif",fontSize:11,color:"var(--text)",marginTop:7,textAlign:"center"}},`${profileMonthLabel(selectedSparkMonth)} · ${selectedSparkMonth.count} workouts`)
            )
          : React.createElement('div',{style:{fontSize:12,color:"var(--muted)",padding:"9px 0",textAlign:"center"}},"No monthly data yet.")
      )
    )
  );

  return React.createElement('div',{onTouchStart:startSwipeBack,onTouchMove:moveSwipeBack,onTouchEnd:endSwipeBack,onTouchCancel:e=>{e.stopPropagation();swipeRef.current={sx:0,sy:0,active:false,mode:null};onSwipeRevealChange?.(false);setDragging(false);setDragX(0);},style:{minHeight:"100dvh",background:"var(--bg-gradient)",backgroundImage:"var(--bg-radial-hint), var(--bg-gradient)",transform:dragX?`translateX(${dragX}px)`:"translateX(0)",transition:dragging?"none":"transform .08s ease-out",boxShadow:dragX?"-18px 0 34px rgba(0,0,0,.28)":"none",willChange:"transform",touchAction:"pan-y",overscrollBehavior:"contain"}},
    deleteTarget && React.createElement(DeleteModal,{log:deleteTarget,onClose:()=>setDeleteTarget(null),onConfirm:async()=>{ const log = deleteTarget; setDeleteTarget(null); await onDeleteLog(log); }}),
    React.createElement('div',{style:{maxWidth:740,margin:"0 auto",padding:"16px",display:"flex",flexDirection:"column",gap:12}},
    // Header row
		    React.createElement('div',{className:"fu",style:{display:"grid",gridTemplateColumns:"96px minmax(0,1fr) 96px",alignItems:"center",gap:8}},
	      React.createElement('div',{style:{justifySelf:"start"}},backButton),
	      React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"center",gap:8,minWidth:0,textAlign:"center"}},
		        React.createElement(Avatar,{name,size:24}),
		        React.createElement('div',{style:{minWidth:0,fontFamily:"'Outfit',sans-serif",fontSize:16,fontWeight:800,lineHeight:1.08,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},name)
	      ),
	      React.createElement('div',{style:{justifySelf:"end"}},monthSelector)
	    ),
	    // Sit out banner
	    notJoinedBanner || sitOutBanner,
	    // Stats — always show summary cards
	    isJoinedThisMonth&&!isExcusedThisMonth&&React.createElement('div',{className:"fu2",style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}},
	      stats.map(renderStatCard)
	    ),
	    isJoinedThisMonth&&!isExcusedThisMonth&&React.createElement(Card,{className:"fu3",style:{padding:"16px"}},
		      React.createElement('div',{style:{fontWeight:800,fontSize:14,marginBottom:14}},"Workout Breakdown"),
	      !hasDetailedLogs
	        ? React.createElement('div',{style:{color:"var(--muted)",fontSize:13,textAlign:"center",padding:"8px 0"}},"Detailed logs were not saved for this month.")
	      : selCount===0
	        ? React.createElement('div',{style:{color:"var(--muted)",fontSize:13,textAlign:"center",padding:"8px 0"}},"No workouts logged yet.")
	        : workoutBreakdownRows.map(t=>React.createElement('div',{key:t,style:{display:"flex",alignItems:"center",gap:10,marginBottom:9}},
	            React.createElement('span',{style:{width:22,minWidth:22,height:22,display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#dbe8ff"}},React.createElement(WorkoutTypeIcon,{type:t,size:16})),
	            React.createElement('div',{style:{minWidth:40,fontSize:13,fontWeight:600}},t),
	            React.createElement('div',{style:{flex:1}},React.createElement(Bar,{value:tBreak[t],max:maxT,color:t==="Gym"?"#4ECDC4":"#1E4040"})),
	            React.createElement('span',{className:"mono",style:{fontSize:13,fontWeight:700,minWidth:18,textAlign:"right",color:tBreak[t]>0?"var(--text)":"var(--muted2)"}},tBreak[t])
	          ))
	    ),
		    isJoinedThisMonth&&!isExcusedThisMonth&&React.createElement(Card,{className:"fu4",style:{padding:"13px 14px",background:"radial-gradient(circle at 12% 0%, rgba(255,255,255,.032), transparent 34%), radial-gradient(circle at 88% 100%, rgba(78,205,196,.052), transparent 42%), linear-gradient(180deg, rgba(10,19,19,.98), rgba(7,14,14,.98))",boxShadow:"inset 0 1px 0 rgba(255,255,255,.035), 0 7px 16px rgba(0,0,0,.12)"}},
	      React.createElement('div',{style:{fontWeight:800,fontSize:14,marginBottom:12}},`${selLabel} · Log`),
	      React.createElement('div',{style:{maxWidth:compactMobile?318:380,margin:"0 auto"}},
	      React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}},
	        ["S","M","T","W","T","F","S"].map((d,i)=>React.createElement('div',{key:i,className:"mono",style:{textAlign:"center",fontSize:9,color:"var(--muted2)",padding:"1px 0"}},d))
	      ),
	      React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}},
	        calDays.map((day,i)=>{
	          if(!day) return React.createElement('div',{key:`e${i}`});
	          const isToday=isCurMonth&&day===DAY_OF_MON,log=logsByDay[day],isFuture=isCurMonth&&day>DAY_OF_MON;
	          const canDelete = !!log && isCurMonth && !!onDeleteLog;
	          return React.createElement('div',{key:day, onClick: canDelete ? ()=>setDeleteTarget(log) : undefined, style:{aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:5,fontSize:log?11:9,fontFamily:log?"inherit":"'JetBrains Mono',monospace",fontWeight:log?700:400,background:log?"#1A2E4A":isToday?"var(--s2)":"transparent",color:log?"#4ECDC4":isFuture?"var(--muted2)":isToday?"var(--text)":"var(--muted)",border:isToday&&!log?"1px solid var(--border2)":"1px solid transparent",cursor:canDelete?"pointer":"default"}},log?React.createElement(WorkoutTypeIcon,{type:log.type,size:15}):day);
	        })
	      )
	      )
	    ),
	    premiumSection
	  ));
};

// ─── TODAY PAGE ───────────────────────────────────────────────────────────────

export { PlayerProfile };
