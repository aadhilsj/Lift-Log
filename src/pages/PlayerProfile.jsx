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
  isSoloForMonth,
  getSoloTargetForMonth,
  fmtCurrency,
  getCountedLogs,
  getMonthPartsFromKey,
  getCountedLogCount,
  isJoinedForMonth
} from "../lib/appState.js";
import {
  isMobile
} from "../lib/utils.js";
import { Avatar, WorkoutTypeIcon, Bar, Card, TargetHitHexIcon, AppIcon } from "../components/primitives.jsx";
import { DeleteModal } from "../modals/modals.jsx";
import { ProfileStatsPanel } from "../components/ProfileStatsPanel.jsx";
import { ShareSticker } from "../components/ShareSticker.jsx";
import { buildStickerData } from "../lib/shareSticker.js";
import { fetchProfileStatsData } from "../lib/api.js";
import {
  cancelSwipeFrame,
  releaseSwipeBack,
  releaseSwipeForward
} from "../lib/swipeRelease.js";

const PLAYER_PROFILE_PREMIUM_GATE = false; // Built now; flip to true when premium gating is wired.
const FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const profileMonthLabel = month => month ? `${FULL_MONTH_NAMES[month.month] || MONTH_NAMES[month.month]} ${month.year}` : "—";
const profileMonthOptionLabel = month => month ? `${MONTH_NAMES[month.month]} '${String(month.year).slice(2)}` : "—";

const PlayerProfile = ({name,logs,excused,monthHistory,onBack,onSwipeRevealChange,groupSettings,onDeleteLog,initialMonthKey,memberUserId,currentUserId,visibleGroups,accountCreatedAt,profilePhotoUrl}) => {
  const compactMobile = isMobile();
  const [deleteTarget,setDeleteTarget]=useState(null);
  const [deleteChoices,setDeleteChoices]=useState(null);
  const [sparkDetailKey,setSparkDetailKey]=useState(null);
  const [dragging,setDragging]=useState(false);
  const swipeRef=useRef({sx:0,sy:0,active:false,mode:null});
  const surfaceRef=useRef(null);
  const dragXRef=useRef(0);
  const frameRef=useRef(null);
  const currency = groupSettings?.currency || DEFAULT_CURRENCY;
  const [selMonthIdx,setSelMonthIdx]=useState(null); // null = current month
  const [profileTab,setProfileTab]=useState("bloc");
  const [showShareSticker,setShowShareSticker]=useState(false);
  const [feroStats,setFeroStats]=useState(null);
  const [feroStatsState,setFeroStatsState]=useState("idle"); // idle | loading | ready | error
  const [feroStatsAttempt,setFeroStatsAttempt]=useState(0);
  // Guards one request per member. Deliberately a ref, not state: putting the
  // status in the effect's dependencies made the status change re-run the
  // effect, whose cleanup then cancelled the in-flight request, so the result
  // was discarded and the tab skeletoned forever.
  const feroStatsRequestedFor = useRef("");
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
  useEffect(()=>{
    if (!sparkDetailKey) return;
    const clearTrendDetail = event => {
      if (!event.target?.closest?.('[data-workout-trend-dot="true"]')) {
        setSparkDetailKey(null);
      }
    };
    document.addEventListener("pointerdown", clearTrendDetail);
    return ()=>document.removeEventListener("pointerdown", clearTrendDetail);
  },[sparkDetailKey]);
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
      const memberIsSolo = isSoloForMonth(m, name, m.key);
      closedTotal+=m.counts[name]||0;
      if (memberIsSolo) return;
      const ac=monthNames.filter(n=>isJoinedForMonth(n, m.key) && !m.excused?.[n] && !isSoloForMonth(m, n, m.key)).map(n=>({name:n,count:m.counts[n]||0,target:m.memberTargets?.[n] || m.settings?.minTarget || MIN_TARGET}));
      const penalties = calcPenalties(ac, m.settings || {});
      const {winners,losers,perWinner}=penalties;
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
        target:getSoloTargetForMonth(m, name, m.key) || m.memberTargets?.[name] || m.settings?.minTarget || MIN_TARGET,
        stakesTarget:m.memberTargets?.[name] || m.settings?.minTarget || MIN_TARGET,
        settings:m.settings || {},
        counts:m.counts || {},
        memberTargets:m.memberTargets || {},
        excused:m.excused || {},
        solo:m.solo || {},
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
          stakesTarget:getCurrentMemberTarget(name, curKey, MIN_TARGET),
          settings:groupSettings || {},
          counts:{[name]:getCountedLogCount(logs[name] || [])},
          excused:{},
          solo:{},
          closed:false
        }]
      : [];
    return [...closed, ...current].sort((a,b)=>a.key.localeCompare(b.key));
  },[name,monthHistory,historicalNames,logs,excused,groupSettings]);

  const perfectMonthStats = useMemo(()=>{
    const perfectMonths = profileMonths.filter(m=>{
      if (!m.closed) return false;
      if (isSoloForMonth(m, name, m.key)) return false;
      const monthNames = getHistoricalMemberNamesForMonth(m, historicalNames);
      const activeCounts = monthNames
        .filter(n=>isJoinedForMonth(n, m.key) && !m.excused?.[n] && !isSoloForMonth(m, n, m.key))
        .map(n=>({name:n,count:Number(m.counts?.[n] || 0),target:m.memberTargets?.[n] || m.settings?.minTarget || MIN_TARGET}));
      const { losers } = calcPenalties(activeCounts, m.settings || {});
      return Number(m.count || 0) >= Number(m.stakesTarget || MIN_TARGET) && !losers.some(l=>l.name===name);
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
  const firstDay=(new Date(selYear, selMonthNum, 1).getDay()+6)%7;
  const calDays=[...Array(firstDay).fill(null),...Array.from({length:selDaysInMonth},(_,i)=>i+1)];
  const logsByDay={};
  selLogs.forEach(l=>{
    const d = Number(String(l?.date || "").split("-")[2]);
    if (Number.isFinite(d)) logsByDay[d]=[...(logsByDay[d] || []),l];
  });
  const selLabel=isCurMonth?`${MONTH_NAMES[CUR_MONTH]} ${CUR_YEAR}`:profileMonthLabel(selHistMonth);

  // Months step one tap at a time rather than through a dropdown, which took
  // two. visibleHistoryMonths is newest-first and null is the current month,
  // so older means a higher index and newer means a lower one.
  const olderIdx = selMonthIdx === null ? (visibleHistoryMonths.length ? 0 : null) : (selMonthIdx + 1 < visibleHistoryMonths.length ? selMonthIdx + 1 : null);
  const newerIdx = selMonthIdx === null ? undefined : (selMonthIdx === 0 ? null : selMonthIdx - 1);
  const stepMonth = target => { if (target !== undefined) setSelMonthIdx(target); };
  const monthArrow = (direction, target, label) => React.createElement('button',{
    type:"button",
    onClick:()=>stepMonth(target),
    disabled:target === undefined,
    "aria-label":label,
    style:{
      // A real tap target rather than a bare glyph: 28px square with a visible
      // surface, so it reads as a button and is comfortable on a phone.
      width:28,height:28,flexShrink:0,
      display:"inline-flex",alignItems:"center",justifyContent:"center",
      borderRadius:8,padding:0,
      background: target === undefined ? "transparent" : "rgba(78,205,196,.1)",
      border: target === undefined ? "1px solid transparent" : "1px solid rgba(78,205,196,.28)",
      color: target === undefined ? "rgba(120,150,145,.3)" : "#4ECDC4",
      cursor: target === undefined ? "default" : "pointer",
      fontFamily:"'Outfit',sans-serif",fontSize:15,fontWeight:800,lineHeight:1,
      WebkitTapHighlightColor:"transparent"
    }
  }, direction);
  const monthSelector = React.createElement('div',{style:{display:"inline-flex",alignItems:"center",gap:6,justifySelf:"end"}},
    monthArrow("\u2039", olderIdx === null ? undefined : olderIdx, "Previous month"),
    // Sized to the longest label rather than padded out, so the arrows sit
    // beside the month instead of drifting away from it.
    React.createElement('span',{style:{
      textAlign:"center",fontFamily:"'Outfit',sans-serif",fontSize:12.5,fontWeight:800,
      color:"var(--text)",whiteSpace:"nowrap"
    }}, isCurMonth ? "This Month" : profileMonthOptionLabel(selHistMonth)),
    monthArrow("\u203a", newerIdx, "Next month")
  );

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
    {label:"Perfect Months",val:perfectMonthStats.count||"—",sub:null,color:"var(--text)"},
    {label:"Months Won",val:hasHistory?(closedStats.wins||"—"):"—",sub:null,color:hasHistory&&closedStats.wins>0?"var(--gold)":"var(--muted)"},
    {label:"Net",val:hasHistory?(netPL===0?fmtCurrency(0,currency):`${netPL>0?"+":"-"}${fmtCurrency(Math.abs(netPL),currency)}`):"—",sub:null,color:hasHistory?(netPL>0?"var(--green)":netPL<0?"var(--red)":"var(--muted)"):"var(--muted)"},
  ];
  // Viewing yourself needs no request at all: your client already holds every
  // Bloc you are in, so the local aggregation is already the complete answer.
  const isSelf = Boolean(memberUserId) && memberUserId === currentUserId;

  // Fetch a member's genuine cross-Bloc stats when the tab is first opened.
  // Deferred rather than fetched on mount so opening a profile stays cheap;
  // a prefetch on Bloc open usually means this resolves from cache instantly.
  useEffect(() => {
    if (isSelf || profileTab !== "alltime" || !memberUserId) return undefined;
    const requestKey = `${memberUserId}:${feroStatsAttempt}`;
    if (feroStatsRequestedFor.current === requestKey) return undefined;
    feroStatsRequestedFor.current = requestKey;
    let cancelled = false;
    setFeroStatsState("loading");
    fetchProfileStatsData(memberUserId).then(result => {
      if (cancelled) return;
      if (result?.ok && result.stats?.ok) { setFeroStats(result.stats); setFeroStatsState("ready"); }
      else setFeroStatsState("error");
    }).catch(() => { if (!cancelled) setFeroStatsState("error"); });
    return () => { cancelled = true; };
  }, [isSelf, profileTab, memberUserId, feroStatsAttempt]);

  const retryFeroStats = () => {
    setFeroStats(null);
    setFeroStatsState("idle");
    setFeroStatsAttempt(n => n + 1);
  };

  // All-time panel — the exact same component the account profile renders, so
  // the two never diverge visually.
  //
  // SCOPE: readable state is scoped per viewer, so the client only holds the
  // viewer's own Blocs. These numbers therefore cover the Blocs the viewer
  // SHARES with this member, not their whole history. For your own profile
  // that is every Bloc you are in, matching the account profile exactly.
  const sharedGroups = (visibleGroups || []).filter(g =>
    memberUserId ? Object.values(g.memberships || {}).some(m => m.userId === memberUserId) : false
  );
  const allTimePanel = !memberUserId
    ? React.createElement(Card,{style:{padding:"20px 16px",textAlign:"center",color:"var(--muted)",fontSize:12.5,fontFamily:"'Outfit',sans-serif"}},
        `All-time stats aren't available for ${name}.`)
    : isSelf
      // Your own profile: every Bloc is already on the client, so render at once.
      // No ownerName: headings read "Your Heatmap" rather than your own name
      // back at you. No scope note either — your own profile spans everything
      // by definition, so saying so is noise.
      ? React.createElement(ProfileStatsPanel,{
          groups:visibleGroups || [],
          userId:memberUserId,
          accountCreatedAt
        })
      : feroStatsState === "error"
        // Fail plainly. Falling back to shared-Bloc figures under an "all time"
        // heading would state a smaller number as if it were the whole story.
        ? React.createElement(Card,{style:{padding:"20px 16px",display:"grid",gap:11,justifyItems:"center",textAlign:"center"}},
            React.createElement('div',{style:{fontSize:12.5,color:"var(--muted)",lineHeight:1.5,fontFamily:"'Outfit',sans-serif",maxWidth:250}},
              `Couldn't load ${name}'s history.`
            ),
            React.createElement('button',{
              type:"button",
              onClick:retryFeroStats,
              style:{padding:"8px 16px",borderRadius:9,border:"1px solid rgba(78,205,196,.35)",background:"rgba(78,205,196,.08)",color:"#4ECDC4",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}
            },"Try again")
          )
        : React.createElement(ProfileStatsPanel,{
            groups:sharedGroups,
            userId:memberUserId,
            ownerName:name,
            serverStats:feroStats,
            loading: !feroStats
          });

  // Share is offered on your own closed months only. The sticker is a record of
  // a finished month, and it is your own record to share.
  const canShareMonth = isSelf && !isCurMonth && !!selHistMonth;
  const shareStickerData = React.useMemo(() => {
    if (!canShareMonth) return null;
    const counted = getCountedLogs(selHistMonth?.logsByUser?.[name] || []);
    if (!counted.length) return null;
    const parts = getMonthPartsFromKey(selHistMonth.key);
    if (!parts) return null;
    return buildStickerData(counted, parts.year, parts.monthIndex);
  }, [canShareMonth, selHistMonth, name]);

  const startSwipeBack=e=>{
    e.stopPropagation();
    const t=e.touches?.[0];
    if(!t||t.clientX>72) return;
    swipeRef.current={sx:t.clientX,sy:t.clientY,st:performance.now(),active:true,mode:null};
  };
  const applySwipeTransform=(x=dragXRef.current,isDragging=dragging)=>{
    const el=surfaceRef.current;
    if(!el) return;
    el.style.transform=x?`translateX(${x}px)`:"translateX(0)";
    el.style.transition=isDragging?"none":"transform .08s ease-out";
    el.style.boxShadow=x?"-18px 0 34px rgba(0,0,0,.28)":"none";
    el.style.willChange=isDragging||x?"transform":"auto";
  };
  const scheduleSwipeTransform=(x,isDragging=dragging)=>{
    dragXRef.current=x;
    if(frameRef.current) return;
    frameRef.current=requestAnimationFrame(()=>{
      frameRef.current=null;
      applySwipeTransform(dragXRef.current,isDragging);
    });
  };
  const resetSwipeTransform=()=>{
    dragXRef.current=0;
    cancelSwipeFrame(frameRef);
    applySwipeTransform(0,false);
  };
  useEffect(()=>{
    swipeRef.current={sx:0,sy:0,active:false,mode:null};
    dragXRef.current=0;
    cancelSwipeFrame(frameRef);
    setDragging(false);
    onSwipeRevealChange?.(false);
    requestAnimationFrame(()=>applySwipeTransform(0,false));
    return ()=>{
      cancelSwipeFrame(frameRef);
      onSwipeRevealChange?.(false);
    };
  },[name]);
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
    if(s.mode==="back") scheduleSwipeTransform(Math.max(0,Math.min(dx,window.innerWidth||420)),true);
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
    if(shouldClose){
      releaseSwipeForward({
        dragRef:dragXRef,
        frameRef,
        finalX:screenWidth,
        transitionMs:45,
        setDragging,
        applyTransform:applySwipeTransform,
        commit:()=>onBack?.()
      });
    }else{
      onSwipeRevealChange?.(false);
      releaseSwipeBack({
        dragRef:dragXRef,
        frameRef,
        transitionMs:80,
        setDragging,
        applyTransform:applySwipeTransform
      });
    }
  };

  const labelStyle = {fontFamily:"'Outfit',sans-serif",fontSize:8.2,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".075em",lineHeight:1.08};
  const backButton = React.createElement('button',{onClick:onBack,style:{display:"inline-flex",alignItems:"center",gap:3,background:"transparent",border:"none",color:"#1E4040",padding:"2px 0",borderRadius:0,fontSize:13,fontFamily:"'Outfit',sans-serif",fontWeight:700,lineHeight:1.1}},
    React.createElement(AppIcon,{name:"chevron-left",size:13,stroke:"#1E4040"}),
    "Back"
  );
  const renderStatCard = x => React.createElement(Card,{key:x.label,style:{padding:"6px 7px",minWidth:0,textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:x.sub||x.subNote?3:5,background:"radial-gradient(circle at 18% 0%, rgba(255,255,255,.026), transparent 36%), radial-gradient(circle at 86% 100%, rgba(78,205,196,.035), transparent 42%), linear-gradient(180deg, rgba(10,19,19,.985), rgba(7,14,14,.985))",border:"0.5px solid rgba(31,70,66,.72)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.028), 0 4px 10px rgba(0,0,0,.10)"}},
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
    const y = 112 - (Math.min(Number(m.count || 0), TREND_AXIS_MAX)/TREND_AXIS_MAX)*96;
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
      React.createElement(Card,{style:{padding:"14px 12px 13px",textAlign:"center",background:"radial-gradient(circle at 16% 0%, rgba(255,255,255,.032), transparent 34%), radial-gradient(circle at 92% 100%, rgba(78,205,196,.052), transparent 42%), linear-gradient(180deg, rgba(10,19,19,.99), rgba(7,14,14,.99))",boxShadow:"inset 0 1px 0 rgba(255,255,255,.04), 0 8px 18px rgba(0,0,0,.14)"}},
        React.createElement('span',{style:{...labelStyle,fontSize:9,display:"block",textAlign:"center",marginBottom:10}},"Workout Trend: 2026"),
        sparkMonths.length
          ? React.createElement(React.Fragment,null,
              React.createElement('div',{style:{display:"grid",gridTemplateColumns:"20px minmax(0,1fr)",gap:8,alignItems:"stretch"}},
                React.createElement('div',{style:{display:"grid",gridTemplateRows:"repeat(5,1fr)",alignItems:"center",justifyItems:"end",height:122,padding:"0 0 18px",fontFamily:"'Outfit',sans-serif",fontSize:8.5,color:"var(--muted)"}},
                  trendTicks.map(t=>React.createElement('span',{key:t},t))
                ),
                React.createElement('div',{style:{position:"relative"}},
              React.createElement('svg',{width:"100%",height:128,viewBox:"0 0 100 124",preserveAspectRatio:"none",style:{display:"block",overflow:"visible"}},
                React.createElement('line',{x1:0,y1:112,x2:100,y2:112,stroke:"rgba(78,205,196,.18)",strokeWidth:1,vectorEffect:"non-scaling-stroke"}),
                React.createElement('line',{x1:0,y1:16,x2:0,y2:112,stroke:"rgba(78,205,196,.18)",strokeWidth:1,vectorEffect:"non-scaling-stroke"}),
                React.createElement('polyline',{points:sparkPoints,fill:"none",stroke:"#4ECDC4",strokeWidth:2.2,strokeLinecap:"round",strokeLinejoin:"round",vectorEffect:"non-scaling-stroke"})
              ),
              sparkCoords.map(p=>React.createElement('button',{key:p.month.key,type:"button","data-workout-trend-dot":"true",onClick:()=>setSparkDetailKey(k=>k===p.month.key?null:p.month.key),style:{position:"absolute",left:`${p.x}%`,top:`${(p.y/124)*128}px`,width:24,height:24,transform:"translate(-50%,-50%)",border:"none",background:"transparent",padding:0,display:"inline-flex",alignItems:"center",justifyContent:"center",cursor:"pointer",touchAction:"manipulation"}},
                React.createElement('span',{style:{width:p.month.key===sparkDetailKey?6:5,height:p.month.key===sparkDetailKey?6:5,borderRadius:999,background:p.month.key===sparkDetailKey?"#FFFFFF":"rgba(255,255,255,.86)",border:"1px solid rgba(5,12,12,.95)",boxShadow:p.month.key===sparkDetailKey?"0 1px 5px rgba(255,255,255,.36)":"0 1px 3px rgba(255,255,255,.24)",display:"block"}})
              )),
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

  return React.createElement('div',{ref:surfaceRef,onTouchStart:startSwipeBack,onTouchMove:moveSwipeBack,onTouchEnd:endSwipeBack,onTouchCancel:e=>{e.stopPropagation();swipeRef.current={sx:0,sy:0,active:false,mode:null};onSwipeRevealChange?.(false);setDragging(false);resetSwipeTransform();},style:{minHeight:"100dvh",background:"var(--bg-gradient)",backgroundImage:"var(--bg-radial-hint), var(--bg-gradient)",transform:dragXRef.current?`translateX(${dragXRef.current}px)`:"translateX(0)",transition:dragging?"none":"transform .08s ease-out",boxShadow:dragXRef.current?"-18px 0 34px rgba(0,0,0,.28)":"none",willChange:dragging||dragXRef.current?"transform":"auto",touchAction:"pan-y",overscrollBehavior:"contain"}},
    showShareSticker && shareStickerData && React.createElement(ShareSticker,{
      data:shareStickerData,
      monthLabel:selLabel,
      onClose:()=>setShowShareSticker(false)
    }),
    deleteTarget && React.createElement(DeleteModal,{log:deleteTarget,onClose:()=>setDeleteTarget(null),onConfirm:async()=>{ const log = deleteTarget; setDeleteTarget(null); await onDeleteLog(log); }}),
    deleteChoices && React.createElement('div',{className:"overlay center-mobile",onClick:()=>setDeleteChoices(null)},
      React.createElement('div',{className:"modal pi",onClick:e=>e.stopPropagation(),style:{textAlign:"center",maxWidth:300,padding:"15px 14px"}},
        React.createElement('div',{style:{fontWeight:800,fontSize:14,marginBottom:4}},"Choose a workout"),
        React.createElement('div',{style:{color:"var(--muted)",fontSize:10.5,marginBottom:11}},"Select the workout you want to delete."),
        React.createElement('div',{style:{display:"grid",gap:7}},
          deleteChoices.map((log,index)=>React.createElement('button',{key:log.id,type:"button",onClick:()=>{setDeleteChoices(null);setDeleteTarget(log);},style:{width:"100%",display:"flex",alignItems:"center",gap:9,textAlign:"left",background:"var(--s2)",border:"1px solid var(--border)",borderRadius:9,padding:"9px 10px",color:"var(--text)"}},
            React.createElement('span',{style:{width:25,height:25,borderRadius:999,display:"inline-flex",alignItems:"center",justifyContent:"center",background:"rgba(78,205,196,.08)",color:"#4ECDC4",flexShrink:0}},React.createElement(WorkoutTypeIcon,{type:log.type,size:15})),
            React.createElement('span',{style:{display:"grid",gap:2,minWidth:0}},
              React.createElement('span',{style:{fontSize:12,fontWeight:800}},`${index+1}. ${log.type}`),
              log.note && React.createElement('span',{style:{fontSize:10,color:"var(--muted)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},log.note)
            )
          ))
        ),
        React.createElement('button',{type:"button",onClick:()=>setDeleteChoices(null),style:{width:"100%",marginTop:9,background:"transparent",border:"1px solid var(--border)",color:"var(--muted)",padding:"8px",borderRadius:8,fontSize:11,fontWeight:700}},"Cancel")
      )
    ),
    React.createElement('div',{style:{maxWidth:740,margin:"0 auto",padding:"16px",display:"flex",flexDirection:"column",gap:12}},
    // Header row
		    React.createElement('div',{className:"fu",style:{display:"grid",gridTemplateColumns:"72px minmax(0,1fr) auto",alignItems:"center",gap:8}},
	      React.createElement('div',{style:{justifySelf:"start"}},backButton),
	      React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"center",gap:8,minWidth:0,textAlign:"center"}},
		        React.createElement(Avatar,{name,size:24}),
		        React.createElement('div',{style:{minWidth:0,fontFamily:"'Outfit',sans-serif",fontSize:16,fontWeight:800,lineHeight:1.08,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},name)
	      ),
	      React.createElement('div',{style:{justifySelf:"end"}},monthSelector)
	    ),
	    // Bloc / All time tabs. The Bloc tab is this Bloc's month view; All time
	    // shows the cross-Bloc stats that used to be reachable only from the
	    // account profile outside a Bloc.
	    React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:5,padding:3,borderRadius:12,background:"rgba(8,20,19,.76)",border:"0.5px solid rgba(22,61,54,.72)"}},
	      [["bloc","This Bloc"],["alltime","All time"]].map(([value,label])=>React.createElement('button',{
	        key:value,type:"button",onClick:()=>setProfileTab(value),
	        style:{minHeight:31,borderRadius:9,border:"none",cursor:"pointer",background:profileTab===value?"rgba(78,205,196,.12)":"transparent",color:profileTab===value?"#4ECDC4":"var(--muted)",fontFamily:"'Outfit',sans-serif",fontSize:9.5,fontWeight:900,textTransform:"uppercase",letterSpacing:".055em"}
	      },label))
	    ),
	    profileTab==="alltime"
	      ? allTimePanel
	      : React.createElement(React.Fragment,null,
	    // Sit out banner
	    notJoinedBanner || sitOutBanner,
	    // Stats — always show summary cards
	    isJoinedThisMonth&&!isExcusedThisMonth&&React.createElement('div',{className:"fu2",style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}},
	      stats.map(renderStatCard)
	    ),
		    isJoinedThisMonth&&!isExcusedThisMonth&&React.createElement(Card,{className:"fu4",style:{padding:"13px 14px",background:"radial-gradient(circle at 12% 0%, rgba(255,255,255,.032), transparent 34%), radial-gradient(circle at 88% 100%, rgba(78,205,196,.052), transparent 42%), linear-gradient(180deg, rgba(10,19,19,.98), rgba(7,14,14,.98))",boxShadow:"inset 0 1px 0 rgba(255,255,255,.035), 0 7px 16px rgba(0,0,0,.12)"}},
	      React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12}},
	        React.createElement('div',{style:{fontWeight:800,fontSize:14}},`${selLabel} · Log`),
	        shareStickerData ? React.createElement('button',{
	          type:"button",
	          onClick:()=>setShowShareSticker(true),
	          "aria-label":`Share ${selLabel}`,
	          title:"Share this month",
	          style:{display:"inline-flex",alignItems:"center",gap:5,flexShrink:0,padding:"6px 11px",borderRadius:999,cursor:"pointer",background:"rgba(78,205,196,.1)",border:"1px solid rgba(78,205,196,.32)",color:"#4ECDC4",fontSize:11,fontWeight:800,fontFamily:"'Outfit',sans-serif"}
	        },
	          React.createElement(AppIcon,{name:"share",size:12,stroke:"#4ECDC4"}),
	          "Share"
	        ) : null
	      ),
	      React.createElement('div',{style:{maxWidth:compactMobile?318:380,margin:"0 auto"}},
	      React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}},
	        ["M","T","W","T","F","S","S"].map((d,i)=>React.createElement('div',{key:i,className:"mono",style:{textAlign:"center",fontSize:9,color:"var(--muted2)",padding:"1px 0"}},d))
	      ),
	      React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}},
	        calDays.map((day,i)=>{
	          if(!day) return React.createElement('div',{key:`e${i}`});
	          const isToday=isCurMonth&&day===DAY_OF_MON,dayLogs=logsByDay[day]||[],log=dayLogs[0]||null,isFuture=isCurMonth&&day>DAY_OF_MON;
	          const canDelete = dayLogs.length > 0 && isCurMonth && !!onDeleteLog;
	          return React.createElement('div',{key:day, onClick: canDelete ? ()=>dayLogs.length===1?setDeleteTarget(log):setDeleteChoices(dayLogs) : undefined, style:{aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:5,fontSize:log?11:9,fontFamily:log?"inherit":"'JetBrains Mono',monospace",fontWeight:log?700:400,background:log?"#1A2E4A":isToday?"var(--s2)":"transparent",color:log?"#4ECDC4":isFuture?"var(--muted2)":isToday?"var(--text)":"var(--muted)",border:isToday&&!log?"1px solid var(--border2)":"1px solid transparent",cursor:canDelete?"pointer":"default"}},log?React.createElement('span',{style:{position:"relative",width:19,height:19,display:"inline-flex",alignItems:"center",justifyContent:"center"}},React.createElement(WorkoutTypeIcon,{type:log.type,size:15}),dayLogs.length>1&&React.createElement('span',{style:{position:"absolute",right:-5,top:-5,minWidth:12,height:12,padding:"0 2px",borderRadius:999,display:"inline-flex",alignItems:"center",justifyContent:"center",background:"#4ECDC4",border:"1px solid #1A2E4A",color:"#071010",fontFamily:"'Outfit',sans-serif",fontSize:7.5,fontWeight:900,lineHeight:1}},Math.min(dayLogs.length,2))):day);
	        })
	      )
	      )
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
	    premiumSection
	      )
	  ));
};

// ─── TODAY PAGE ───────────────────────────────────────────────────────────────

export { PlayerProfile };
