import { createPortal } from "react-dom";
import React from "react";
const { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } = React;
import {
  DEFAULT_CURRENCY,
  NAMES,
  MIN_TARGET,
  CUR_MONTH,
  CUR_YEAR,
  curKey,
  MONTH_NAMES,
  calcPenalties,
  addStandardSoloPenalties,
  getStandardSoloMisses,
  isExemptFromStakes,
  isStandardPenaltySoloForMonth,
  getLoserAmount,
  getCurrentMemberTarget,
  getHistoricalMemberNamesForMonth,
  getHistoricalGroupMemberNames,
  fmtCurrency,
  buildMonthLogsSnapshot,
  buildNormalizedSettings,
  buildSettlementPairsForMonth,
  getCountedLogs,
  getCountedLogCount,
  isJoinedForMonth
} from "../lib/appState.js";
import { Avatar, Card, AppIcon, PlayerProfileErrorBoundary } from "../components/primitives.jsx";
import { PlayerProfile } from "../pages/PlayerProfile.jsx";
import { ActivityMix } from "../components/ActivityMix.jsx";
import { getLogDisplayActivity } from "../lib/activities.js";

const HISTORY_FEATURES = {
  summaryStats: true,
  trailingWorkoutHistory: true,
  workoutMix: true,
  allTimeLeaderboard: true,
  blocLegacy: true
};

const FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const shortDate = value => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
};
const currencyShortLabel = currency => {
  const symbols = {USD:"$",EUR:"€",GBP:"£",NOK:"kr",SEK:"kr",DKK:"kr",AUD:"A$",CAD:"C$",CHF:"CHF",INR:"₹",SGD:"S$",NZD:"NZ$",LKR:"LKR"};
  return symbols[currency] || currency || DEFAULT_CURRENCY;
};
const cleanMonthLabel = (label, key = "", fullYear = false) => {
  const fromLabel = /^([A-Z][a-z]{2})\s+'?(\d{2})$/.exec(String(label || "").trim());
  if (fromLabel) {
    const monthName = FULL_MONTH_NAMES[MONTH_NAMES.indexOf(fromLabel[1])] || fromLabel[1];
    return `${monthName} ${fullYear ? `20${fromLabel[2]}` : fromLabel[2]}`;
  }
  const [year, month] = String(key || label || "").split("-").map(Number);
  if (Number.isFinite(year) && Number.isFinite(month)) return `${FULL_MONTH_NAMES[month] || MONTH_NAMES[month] || "Month"} ${fullYear ? year : String(year).slice(2)}`;
  return String(label || "—").replace(/\s+'(\d{2})$/, " $1");
};
const compactMonthLabel = (label, key = "") => {
  const fromLabel = /^([A-Z][a-z]{2})\s+'?(\d{2})$/.exec(String(label || "").trim());
  if (fromLabel) return `${fromLabel[1]} ${fromLabel[2]}`;
  const [year, month] = String(key || label || "").split("-").map(Number);
  if (Number.isFinite(year) && Number.isFinite(month)) return `${MONTH_NAMES[month] || "Mon"} ${String(year).slice(2)}`;
  return String(label || "—").replace(/\s+'(\d{2})$/, " $1");
};
const monthOrder = key => {
  const [year, month] = String(key || "").split("-").map(Number);
  return Number.isFinite(year) && Number.isFinite(month) ? year * 12 + month : Infinity;
};
const buildRankMap = rows => {
  const totals = {};
  rows.forEach(month => {
    Object.entries(month.counts || {}).forEach(([name, count]) => {
      if (!isJoinedForMonth(name, month.key) || month.excused?.[name]) return;
      totals[name] = (totals[name] || 0) + (Number(count) || 0);
    });
  });
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return Object.fromEntries(sorted.map(([name], index) => [name, index + 1]));
};

const HistoryPage = ({group,logs,excused,monthHistory,groupSettings,navResetToken,currentUser,groups,currentUserId,accountCreatedAt,onTrackUsage}) => {
  const currency = groupSettings?.currency || DEFAULT_CURRENCY;
  const [showFullLeaderboard,setShowFullLeaderboard]=useState(false);
  const [viewPlayer,setViewPlayer]=useState(null);
  const profileLayerRef = useRef(null);
  const [profileRevealActive,setProfileRevealActive]=useState(false);
  useEffect(()=>{ setViewPlayer(null); },[navResetToken]);
  useEffect(() => {
    const el = profileLayerRef.current;
    if (!viewPlayer || !el) return undefined;
    let startX = 0;
    let startY = 0;
    const handleTouchStart = event => {
      const touch = event.touches?.[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
    };
    const handleTouchMove = event => {
      const touch = event.touches?.[0];
      if (!touch || !event.cancelable) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) >= Math.abs(dy)) return;
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((dy > 0 && atTop) || (dy < 0 && atBottom)) event.preventDefault();
    };
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
    };
  },[viewPlayer]);
  useLayoutEffect(()=>{
    if(!viewPlayer) return;
    profileLayerRef.current?.scrollTo?.({top:0,left:0,behavior:"auto"});
    requestAnimationFrame(()=>profileLayerRef.current?.scrollTo?.({top:0,left:0,behavior:"auto"}));
  },[viewPlayer]);
  const openPlayerProfile = useCallback(name => {
    setProfileRevealActive(false);
    setViewPlayer(name);
  },[]);
  const closePlayerProfile = useCallback(() => {
    setProfileRevealActive(false);
    setViewPlayer(null);
  },[]);

  const currentMonthSnapshot = useMemo(() => ({
    key: curKey,
    label: `${MONTH_NAMES[CUR_MONTH]} '${String(CUR_YEAR).slice(2)}`,
    counts: Object.fromEntries(NAMES.filter(name=>isJoinedForMonth(name, curKey)).map(name => [name, getCountedLogCount(logs[name]||[])])),
    excused: Object.fromEntries(NAMES.filter(name=>isJoinedForMonth(name, curKey)).map(name => [name, excused[name]?.[curKey]||false])),
    memberTargets: Object.fromEntries(NAMES.filter(name=>isJoinedForMonth(name, curKey)).map(name => [name, getCurrentMemberTarget(name, curKey, MIN_TARGET)])),
    logsByUser: buildMonthLogsSnapshot(logs),
    settings: buildNormalizedSettings(groupSettings || { minTarget: MIN_TARGET }),
    isCurrent: true
  }), [logs, excused, groupSettings]);

  const fullHistory = useMemo(() => [...monthHistory, currentMonthSnapshot], [monthHistory, currentMonthSnapshot]);
  const historicalNames = useMemo(
    () => getHistoricalGroupMemberNames(fullHistory, logs, excused, NAMES),
    [fullHistory, logs, excused]
  );

  const isActualParticipant = (month, name) =>
    getHistoricalMemberNamesForMonth(month, historicalNames).includes(name) && !month?.excused?.[name];

  const allTime=useMemo(()=>historicalNames.map(name=>{
    const participated=fullHistory.filter(m=>isActualParticipant(m, name));
    const activeMonths=participated.length;
    const total=participated.reduce((s,m)=>s+(m.counts[name]||0),0);
    const closedP=monthHistory.filter(m=>isActualParticipant(m, name));
    const closedTotal=closedP.reduce((s,m)=>s+(m.counts[name]||0),0);
    const avg=closedP.length?(closedTotal/closedP.length).toFixed(1):"—";
    let wins=0,moneyWon=0,moneyLost=0;
    monthHistory.forEach(m=>{
      const monthNames = getHistoricalMemberNamesForMonth(m, historicalNames);
      if(!monthNames.includes(name)) return;
      if(m.excused?.[name]) return;
      // Solo and Training Wheels keep a member out of the money, exactly as
      // the in-Bloc profile already does. This loop used to check only
      // `excused`, so an exempt member was billed here while their own
      // profile showed them clear -- the same figure computed two ways.
      // A new-rules Solo miss is the one exempt case that still costs money.
      const memberIsExempt = isExemptFromStakes(m, name, m.key);
      if (memberIsExempt && !isStandardPenaltySoloForMonth(m, name, m.key)) return;
      const ac=monthNames.filter(n=>isJoinedForMonth(n, m.key) && !m.excused?.[n] && !isExemptFromStakes(m, n, m.key)).map(n=>({name:n,count:m.counts[n]||0,target:m.memberTargets?.[n] || m.settings?.minTarget || MIN_TARGET}));
      const soloMisses = getStandardSoloMisses(m, monthNames.filter(n=>isJoinedForMonth(n, m.key)));
      const penalties = addStandardSoloPenalties(calcPenalties(ac, m.settings || {}), soloMisses, m.settings || {});
      const {winners,losers,perWinner}=penalties;
      if(winners.find(w=>w.name===name)){wins++;moneyWon+=perWinner;}
      if(losers.find(l=>l.name===name)){moneyLost+=getLoserAmount(penalties, name);}
    });
    return {name,total,avg,activeMonths,wins,moneyWon,moneyLost};
  }),[fullHistory, monthHistory, historicalNames]);

  const groupMonthlyAvg=useMemo(()=>{
    return fullHistory.map(m=>{
      const monthNames = getHistoricalMemberNamesForMonth(m, historicalNames);
      const active=monthNames.filter(n=>isJoinedForMonth(n, m.key) && !m.excused?.[n]);
      const vals=active.map(n=>m.counts[n]||0);
      const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
      const total=vals.reduce((a,b)=>a+b,0);
      return {label:m.label||m.key,avg,total,isCurrent:!!m.isCurrent,key:m.key,month:m.month};
    });
  },[fullHistory, historicalNames]);
  const trailingMonthlyAvg=useMemo(()=>groupMonthlyAvg.slice(-12),[groupMonthlyAvg]);

  // Per activity; logs from before activities count under their category.
  const groupTypeBreakdown=useMemo(()=>{
    const c={};
    fullHistory.forEach(month=>{
      const monthNames = getHistoricalMemberNamesForMonth(month, historicalNames);
      monthNames.forEach(name=>{
        if(!isJoinedForMonth(name, month.key)) return;
        getCountedLogs(month.logsByUser?.[name] || []).forEach(log=>{
          const activity=getLogDisplayActivity(log);
          c[activity]=(c[activity]||0)+1;
        });
      });
    });
    return c;
  },[fullHistory, historicalNames]);
  const totalGroupLogs=Object.values(groupTypeBreakdown).reduce((a,b)=>a+b,0);
  const rankDeltas=useMemo(()=>{
    const closed = [...monthHistory].filter(m => m?.key).sort((a,b)=>monthOrder(a.key)-monthOrder(b.key));
    if (closed.length < 2) return {};
    const latestRanks = buildRankMap(closed);
    const previousRanks = buildRankMap(closed.slice(0,-1));
    return Object.fromEntries(Object.keys(latestRanks).map(name => {
      const previous = previousRanks[name];
      return [name, previous ? previous - latestRanks[name] : 0];
    }));
  },[monthHistory]);
  const sortedAll=[...allTime].sort((a,b)=>b.total-a.total);
  // The page shows the top three plus your own row when you are outside it;
  // the full screen shows everyone.
  const leaderboardSnapshot=(()=>{
    const rows=sortedAll.slice(0,3).map((member,rank)=>({member,rank}));
    const myRank=sortedAll.findIndex(u=>u.name===currentUser);
    if (myRank>2) rows.push({member:sortedAll[myRank],rank:myRank});
    return rows;
  })();
  const maxChartTotal=Math.max(...trailingMonthlyAvg.map(m=>m.total),1);
  const hasClosedHistory=monthHistory.length>0;
  const mostWins=[...allTime].sort((a,b)=>b.wins-a.wins)[0];
  const mostConsistent=[...allTime].filter(u=>u.avg!=="—").sort((a,b)=>Number(b.avg)-Number(a.avg))[0];
  const biggestLoser=[...allTime].sort((a,b)=>b.moneyLost-a.moneyLost)[0];
  const totalSettled=useMemo(()=>monthHistory.reduce((sum,m)=>sum+buildSettlementPairsForMonth(m).reduce((s,p)=>s+(p.amount||0),0),0),[monthHistory]);
  const completedMonths=monthHistory.length;
  const participantCount=historicalNames.length;
  const highestMonth=[...groupMonthlyAvg].sort((a,b)=>b.total-a.total)[0];
  const earliestMonth=[...fullHistory].filter(m=>m?.key).sort((a,b)=>monthOrder(a.key)-monthOrder(b.key))[0];
  const closedMonthlyTotals=monthHistory.map(m=>{
    const monthNames=getHistoricalMemberNamesForMonth(m,historicalNames);
    const active=monthNames.filter(n=>isJoinedForMonth(n,m.key)&&!m.excused?.[n]);
    const total=active.reduce((sum,n)=>sum+(m.counts[n]||0),0);
    return {...m,total,activeCount:active.length};
  });
  const toughestMonth=[...closedMonthlyTotals].filter(m=>m.activeCount>0).sort((a,b)=>a.total-b.total)[0];
  const startedLabel = earliestMonth ? cleanMonthLabel(earliestMonth.label, earliestMonth.key, true) : shortDate(group?.createdAt);
  const legacyRows=[
    ["Months active", completedMonths ? String(completedMonths) : "—"],
    ["Money settled", totalSettled ? fmtCurrency(totalSettled,currency) : "—"],
    ["Best month", highestMonth?.total ? `${cleanMonthLabel(highestMonth.label, highestMonth.key, true)}: ${highestMonth.total}` : "—"],
    ["Toughest month", toughestMonth?.total>=0 ? `${cleanMonthLabel(toughestMonth.label, toughestMonth.key, true)}: ${toughestMonth.total}` : "—"]
  ];
  const rankDeltaNode = delta => {
    const value = Number(delta || 0);
    const color = value > 0 ? "#7FE7A2" : value < 0 ? "#E98585" : "rgba(214,226,224,.38)";
    const label = value > 0 ? `↑${value}` : value < 0 ? `↓${Math.abs(value)}` : "–";
    return React.createElement('span',{style:{display:"inline-flex",alignItems:"center",justifyContent:"center",minWidth:20,fontSize:8.5,fontWeight:800,color,lineHeight:1}},label);
  };

  const historyContent = React.createElement('div',{style:{maxWidth:960,margin:"0 auto",padding:"16px",display:"flex",flexDirection:"column",gap:12}},
    // Inside the Month tab the toggle already says where you are, so the page
    // carries no heading of its own -- one line instead.
    React.createElement('div',{className:"fu",style:{textAlign:"center",fontFamily:"'Outfit', sans-serif",fontSize:11.5,color:"var(--muted)"}},
      `Since ${startedLabel} \u00b7 `, React.createElement('b',{style:{color:"#4ECDC4",fontWeight:700}},totalGroupLogs||0), " workouts logged"
    ),
    // Three awards, in the same style as the profile's All Blocs cards.
    HISTORY_FEATURES.summaryStats&&React.createElement('div',{className:"fu2",style:{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:6}},
      [["Most wins",hasClosedHistory&&mostWins?.wins>0?mostWins.name:"\u2014",hasClosedHistory&&mostWins?.wins>0?`${mostWins.wins} win${mostWins.wins>1?"s":""}`:""],
       ["Most consistent",hasClosedHistory&&mostConsistent?.avg!=="\u2014"?mostConsistent.name:"\u2014",hasClosedHistory&&mostConsistent?.avg!=="\u2014"?`${mostConsistent.avg} avg/mo`:""],
       [`Most ${currencyShortLabel(currency)} lost`,hasClosedHistory&&biggestLoser?.moneyLost>0?biggestLoser.name:"\u2014",hasClosedHistory&&biggestLoser?.moneyLost>0?`-${fmtCurrency(biggestLoser.moneyLost,currency)}`:""]
      ].map(([label,val,sub])=>React.createElement(Card,{key:label,style:{position:"relative",padding:"7px 6px 8px",display:"flex",flexDirection:"column",alignItems:"center",overflow:"hidden",minWidth:0,boxShadow:"0 12px 24px rgba(0,0,0,.26), 0 2px 10px rgba(78,205,196,.07)"}},
        React.createElement('div',{style:{position:"absolute",left:9,right:9,top:0,height:1,background:"rgba(115,232,223,.42)"}}),
        React.createElement('span',{style:{display:"block",fontSize:8,fontWeight:500,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:4,textAlign:"center",whiteSpace:"nowrap",maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis"}},label),
        React.createElement('div',{style:{fontSize:14,fontWeight:600,lineHeight:1.05,color:"var(--text)",maxWidth:"100%",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},val),
        sub && React.createElement('div',{style:{fontSize:8.5,color:"var(--muted)",marginTop:3,whiteSpace:"nowrap"}},sub)
      ))
    ),
    // A snapshot on the page -- the top three, plus your own row when you are
    // outside it -- and the full table one tap away. Swiping columns on the
    // page itself fought the page swipe and hid most members behind a
    // "Show more" button.
    HISTORY_FEATURES.allTimeLeaderboard&&React.createElement(Card,{className:"fu5",style:{padding:"11px 12px"}},
      React.createElement('div',{style:{fontWeight:800,fontSize:13,textAlign:"center",marginBottom:8}},"All-Time Leaderboard"),
      React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:4}},
        leaderboardSnapshot.map(({member,rank})=>React.createElement('div',{key:member.name,style:{display:"grid",gridTemplateColumns:"26px 24px minmax(0,1fr) auto",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:10,background:rank===0?"radial-gradient(circle at 8% 0%, rgba(245,166,35,.075), transparent 42%), #0A1413":"#0A1413",border:member.name===currentUser?"0.5px solid rgba(78,205,196,.35)":"0.5px solid #10201F"}},
          React.createElement('span',{style:{fontSize:10,fontWeight:700,color:"var(--muted)",textAlign:"center"}},`#${rank+1}`),
          React.createElement(Avatar,{name:member.name,size:22}),
          React.createElement('span',{style:{fontSize:12.5,fontWeight:700,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},member.name,member.name===currentUser&&React.createElement('span',{className:"mono",style:{fontSize:7.5,color:"#3d5e59",marginLeft:6}},"you")),
          React.createElement('span',{style:{fontSize:12,fontWeight:700,color:"var(--text)",whiteSpace:"nowrap"}},member.total||"\u2014",React.createElement('span',{style:{fontSize:9,color:"var(--muted)",fontWeight:600,marginLeft:4}},"workouts"))
        ))
      ),
      React.createElement('button',{type:"button",onClick:()=>{onTrackUsage?.("all_time_leaderboard_opened");setShowFullLeaderboard(true);},style:{display:"block",width:"100%",marginTop:9,padding:0,background:"none",border:0,cursor:"pointer",textAlign:"center",fontFamily:"'Outfit', sans-serif",fontSize:11.5,fontWeight:700,color:"#4ECDC4"}},"See full leaderboard \u203a")
    ),
    // The full table, portalled so no transformed ancestor can move it.
    showFullLeaderboard&&createPortal(React.createElement('div',{style:{position:"fixed",inset:0,zIndex:1100,background:"rgba(4,9,9,.96)",display:"flex",flexDirection:"column",padding:"calc(14px + env(safe-area-inset-top)) 12px calc(14px + env(safe-area-inset-bottom))"}},
      React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10}},
        React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontWeight:800,fontSize:16,color:"var(--text)"}},"All-Time Leaderboard"),
        React.createElement('button',{type:"button",onClick:()=>setShowFullLeaderboard(false),"aria-label":"Close",style:{width:30,height:30,borderRadius:999,background:"var(--s2)",border:"0.5px solid var(--border2)",color:"var(--text)",cursor:"pointer",flexShrink:0}},"\u2715")
      ),
      React.createElement('div',{style:{overflowY:"auto",flex:1}},
        React.createElement(Card,{style:{overflow:"hidden"}},
          React.createElement('div',{style:{position:"relative"}},
            React.createElement('div',{style:{position:"absolute",top:0,right:0,bottom:0,width:28,pointerEvents:"none",background:"linear-gradient(to right, rgba(8,15,15,0), #080F0F)",zIndex:1}}),
            React.createElement('div',{"data-page-swipe-priority":"horizontal-scroll",style:{overflowX:"auto",WebkitOverflowScrolling:"touch",touchAction:"pan-x pan-y"}},
            React.createElement('div',{style:{minWidth:550,padding:"7px"}},
              React.createElement('div',{style:{display:"grid",gridTemplateColumns:"21px 24px 150px 44px 38px 46px 34px 56px 56px",padding:"6px 8px",borderBottom:"1px solid rgba(255,255,255,.055)",gap:5,fontFamily:"'Outfit', sans-serif",fontSize:8,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".055em",fontWeight:800}},
                ["#","","Name","Total","AVG","Months","Wins",null,null].map((h,i)=>React.createElement('div',{key:i,style:{textAlign:i>2?"right":"left",display:"flex",alignItems:"center",justifyContent:i>2?"flex-end":"flex-start",gap:3}},
                  i===7||i===8
                    ? React.createElement(React.Fragment,null,React.createElement(AppIcon,{name:"money-bag",size:10,stroke:"rgba(214,226,224,.72)"}),React.createElement('span',null,i===7?"Won":"Lost"))
                    : h
                ))
              ),
              React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:5,marginTop:5}},
              sortedAll.map((u,i)=>{
                const isMe = u.name === currentUser;
                const rankGlow = i === 0 ? "rgba(245,166,35,.075)" : i === 1 ? "rgba(214,226,224,.055)" : i === 2 ? "rgba(78,205,196,.045)" : "rgba(255,255,255,.02)";
                return React.createElement('button',{key:u.name,type:"button",onClick:()=>{setShowFullLeaderboard(false);openPlayerProfile(u.name);},
                style:{display:"grid",gridTemplateColumns:"21px 24px 150px 44px 38px 46px 34px 56px 56px",width:"100%",padding:"8px 8px",gap:5,alignItems:"center",background:`radial-gradient(circle at 8% 0%, ${rankGlow}, transparent 42%), radial-gradient(circle at 92% 0%, rgba(78,205,196,.045), transparent 38%), linear-gradient(180deg, rgba(18,31,31,.82), rgba(8,15,15,.62))`,border:`0.5px solid ${isMe?"rgba(78,205,196,.24)":"rgba(255,255,255,.065)"}`,borderRadius:9,boxShadow:`inset 0 1px 0 rgba(255,255,255,.055), 0 8px 18px rgba(0,0,0,.16)${isMe?", 0 0 0 1px rgba(78,205,196,.035)":""}`,textAlign:"left",fontFamily:"'Outfit', sans-serif",color:"var(--text)",cursor:"pointer"}},
                React.createElement('div',{style:{fontSize:10,fontWeight:700,color:"var(--muted)",textAlign:"center"}},`#${i+1}`),
                React.createElement(Avatar,{name:u.name,size:21}),
                React.createElement('div',{style:{fontWeight:700,fontSize:12.5,display:"flex",alignItems:"baseline",gap:5,flexWrap:"nowrap",color:"var(--text)",minWidth:0,whiteSpace:"nowrap"}},
                  React.createElement('span',null,u.name),
                  rankDeltaNode(rankDeltas[u.name]),
                  isMe&&React.createElement('span',{className:"mono",style:{fontSize:7.5,color:"#3d5e59",flexShrink:0}},"you")
                ),
                React.createElement('span',{style:{fontSize:12,fontWeight:700,textAlign:"right",color:"var(--text)"}},u.total||"—"),
                React.createElement('span',{style:{fontSize:10,fontWeight:700,color:"var(--muted)",textAlign:"right"}},u.avg),
                React.createElement('span',{style:{fontSize:10,fontWeight:700,color:"var(--muted)",textAlign:"right"}},u.activeMonths||"—"),
                React.createElement('span',{style:{fontSize:10,fontWeight:700,textAlign:"right",color:hasClosedHistory&&u.wins>0?"var(--gold)":"var(--muted)",display:"inline-flex",alignItems:"center",justifyContent:"flex-end",gap:4}},
                  hasClosedHistory&&u.wins>0 ? u.wins : "—"
                ),
                React.createElement('span',{style:{fontSize:10,fontWeight:700,textAlign:"right",color:hasClosedHistory&&u.moneyWon>0?"var(--green)":"var(--muted)"}},hasClosedHistory&&u.moneyWon>0?`+${fmtCurrency(u.moneyWon, currency)}`:"—"),
                React.createElement('span',{style:{fontSize:10,fontWeight:700,textAlign:"right",color:hasClosedHistory&&u.moneyLost>0?"var(--red)":"var(--muted)"}},hasClosedHistory&&u.moneyLost>0?`-${fmtCurrency(u.moneyLost, currency)}`:"—")
              )})
            ),
            ))
          )
        )
      )
    ), document.body),
    HISTORY_FEATURES.trailingWorkoutHistory&&React.createElement(Card,{className:"fu3",style:{padding:"11px 12px",background:"radial-gradient(circle at 12% 0%, rgba(255,255,255,.032), transparent 34%), radial-gradient(circle at 88% 100%, rgba(78,205,196,.052), transparent 42%), linear-gradient(180deg, rgba(12,22,22,.98), rgba(8,15,15,.98))",boxShadow:"inset 0 1px 0 rgba(255,255,255,.035), 0 7px 16px rgba(0,0,0,.12)"}},
      React.createElement('div',{style:{fontWeight:800,fontSize:13,marginBottom:10,textAlign:"center"}},"Last 12 Months"),
      trailingMonthlyAvg.every(m=>m.total===0)
        ? React.createElement('div',{style:{color:"var(--muted)",fontSize:13,textAlign:"center",padding:"20px 0"}},"Data will appear here as the month progresses.")
        : React.createElement('div',{style:{overflowX:"auto",paddingBottom:4}},
            React.createElement('div',{style:{display:"flex",alignItems:"flex-end",justifyContent:"flex-start",gap:8,height:104,minWidth:"max-content"}},
              trailingMonthlyAvg.map((m,i)=>{
                const h=Math.max(4,Math.round((m.total/maxChartTotal)*66));
                const isHighlighted = !!m.isCurrent;
                return React.createElement('div',{key:m.key||m.label,style:{flex:"0 0 auto",width:34,display:"flex",flexDirection:"column",alignItems:"center",gap:0}},
                  React.createElement('span',{className:"mono",style:{fontSize:10,fontWeight:700,color:isHighlighted?"#4ECDC4":"var(--muted)",marginBottom:4,display:"block"}},m.total),
                  React.createElement('div',{style:{width:18,height:h,background:isHighlighted?"rgba(78,205,196,.72)":"#0D2828",borderRadius:"3px 3px 0 0"}}),
                  React.createElement('span',{style:{fontFamily:"'Outfit', sans-serif",fontSize:7.5,fontWeight:700,color:isHighlighted?"#4ECDC4":"#1E4040",textAlign:"center",lineHeight:1,marginTop:4,whiteSpace:"nowrap"}},compactMonthLabel(m.label, m.key))
                );
              })
            )
          )
    ),
    HISTORY_FEATURES.workoutMix&&React.createElement(Card,{className:"fu4",style:{padding:"11px 12px",background:"radial-gradient(circle at 88% 0%, rgba(255,255,255,.03), transparent 34%), radial-gradient(circle at 16% 100%, rgba(78,205,196,.05), transparent 42%), linear-gradient(180deg, rgba(12,22,22,.98), rgba(8,15,15,.98))",boxShadow:"inset 0 1px 0 rgba(255,255,255,.035), 0 7px 16px rgba(0,0,0,.12)"}},
      React.createElement(ActivityMix,{title:"Workout Type Distribution",counts:groupTypeBreakdown,variant:"history",titleStyle:{fontWeight:800}})
    ),
    HISTORY_FEATURES.blocLegacy&&React.createElement(Card,{className:"fu6",style:{overflow:"hidden",padding:"10px 12px 11px"}},
      React.createElement('div',{style:{fontFamily:"'Outfit',sans-serif",fontSize:9,fontWeight:900,letterSpacing:".07em",textTransform:"uppercase",color:"var(--muted)",marginBottom:8}},"Bloc Details"),
      React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",columnGap:10,rowGap:9}},
        legacyRows.map(row=>React.createElement('div',{key:row[0],style:{minWidth:0}},
          React.createElement('div',{style:{fontFamily:"'Outfit',sans-serif",fontSize:8.5,fontWeight:800,letterSpacing:".055em",textTransform:"uppercase",color:"var(--muted)"}},row[0]),
          React.createElement('div',{style:{fontFamily:"'Outfit',sans-serif",fontSize:12,fontWeight:700,color:"var(--text)",marginTop:2,overflowWrap:"anywhere"}},row[1])
        ))
      )
    )
  );

  return React.createElement(React.Fragment,null,
    React.createElement('div',{"aria-hidden":viewPlayer?true:undefined,style:{pointerEvents:viewPlayer?"none":"auto"}},historyContent),
    viewPlayer&&React.createElement('div',{key:`profile-layer-${viewPlayer}`,ref:profileLayerRef,className:"in-bloc-profile-layer",style:{backgroundColor:"#070C0C",background:profileRevealActive?"transparent":"var(--bg-gradient)",backgroundImage:profileRevealActive?"none":"var(--bg-radial-hint), var(--bg-gradient)",overflowY:"auto",overflowX:"hidden",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain",touchAction:"pan-y"}},
      React.createElement(PlayerProfileErrorBoundary,{profileName:viewPlayer,onBack:closePlayerProfile},
        // The same identity props Today passes. Without memberUserId the All
        // Blocs tab has no member to look up and says the stats are not
        // available, even though opening the very same profile from Today
        // loads them.
        React.createElement(PlayerProfile,{group:group,name:viewPlayer,logs,excused,monthHistory,onBack:closePlayerProfile,onSwipeRevealChange:setProfileRevealActive,groupSettings,memberUserId:Object.values(group?.memberships||{}).find(m=>m?.displayName===viewPlayer)?.userId||"",currentUserId,visibleGroups:groups,accountCreatedAt,onTrackUsage,isOwnProfile:viewPlayer===currentUser})
      )
    )
  );
};

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export { HistoryPage };
