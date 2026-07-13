import React from "react";
const { useState, useMemo } = React;
import {
  WORKOUT_TYPES,
  DEFAULT_CURRENCY,
  NAMES,
  MIN_TARGET,
  CUR_MONTH,
  CUR_YEAR,
  curKey,
  MONTH_NAMES,
  calcPenalties,
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
import { Avatar, WorkoutTypeIcon, Card, AppIcon } from "../components/primitives.jsx";

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

const HistoryPage = ({group,logs,excused,monthHistory,groupSettings,navResetToken,currentUser}) => {
  const currency = groupSettings?.currency || DEFAULT_CURRENCY;
  const [showAllLeaderboard,setShowAllLeaderboard]=useState(false);

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

  const allTime=useMemo(()=>historicalNames.map(name=>{
    const participated=fullHistory.filter(m=>isJoinedForMonth(name, m.key) && !m.excused?.[name]);
    const activeMonths=participated.length;
    const total=participated.reduce((s,m)=>s+(m.counts[name]||0),0);
    const closedP=monthHistory.filter(m=>isJoinedForMonth(name, m.key) && !m.excused?.[name]);
    const closedTotal=closedP.reduce((s,m)=>s+(m.counts[name]||0),0);
    const avg=closedP.length?(closedTotal/closedP.length).toFixed(1):"—";
    let wins=0,moneyWon=0,moneyLost=0;
    monthHistory.forEach(m=>{
      if(!isJoinedForMonth(name, m.key)) return;
      if(m.excused?.[name]) return;
      const monthNames = getHistoricalMemberNamesForMonth(m, historicalNames);
      const ac=monthNames.filter(n=>isJoinedForMonth(n, m.key) && !m.excused?.[n]).map(n=>({name:n,count:m.counts[n]||0,target:m.memberTargets?.[n] || m.settings?.minTarget || MIN_TARGET}));
      const penalties = calcPenalties(ac, m.settings || {});
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

  const groupTypeBreakdown=useMemo(()=>{
    const c={};WORKOUT_TYPES.forEach(t=>c[t]=0);
    fullHistory.forEach(month=>{
      const monthNames = getHistoricalMemberNamesForMonth(month, historicalNames);
      monthNames.forEach(name=>{
        if(!isJoinedForMonth(name, month.key)) return;
        getCountedLogs(month.logsByUser?.[name] || []).forEach(log=>{
          if(c[log.type]!==undefined)c[log.type]++;
        });
      });
    });
    return c;
  },[fullHistory, historicalNames]);
  const totalGroupLogs=Object.values(groupTypeBreakdown).reduce((a,b)=>a+b,0);
  const maxTypeCount=Math.max(...Object.values(groupTypeBreakdown),1);
  const sortedAll=[...allTime].sort((a,b)=>b.total-a.total);
  const visibleLeaderboard=showAllLeaderboard?sortedAll:sortedAll.slice(0,5);
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
  const sortedWorkoutTypes=[...WORKOUT_TYPES].sort((a,b)=>(groupTypeBreakdown[b]||0)-(groupTypeBreakdown[a]||0)||WORKOUT_TYPES.indexOf(a)-WORKOUT_TYPES.indexOf(b));
  const legacyRows=[
    ["Started", earliestMonth ? cleanMonthLabel(earliestMonth.label, earliestMonth.key, true) : shortDate(group?.createdAt)],
    ["Months completed", completedMonths ? String(completedMonths) : "No closed months yet"],
    ["Total workouts logged", totalGroupLogs ? String(totalGroupLogs) : "—"],
    ["Money settled", totalSettled ? fmtCurrency(totalSettled,currency) : "—"],
    ["Members participated", participantCount ? String(participantCount) : "—"],
    ["Best month", highestMonth?.total ? `${cleanMonthLabel(highestMonth.label, highestMonth.key, true)} - ${highestMonth.total}` : "—"],
    ["Toughest month", toughestMonth?.total>=0 ? `${cleanMonthLabel(toughestMonth.label, toughestMonth.key, true)} - ${toughestMonth.total}` : "—"]
  ];
  const gradientText = gradient => ({
    background: gradient,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent"
  });

  return React.createElement('div',{style:{maxWidth:960,margin:"0 auto",padding:"16px",display:"flex",flexDirection:"column",gap:12}},
    React.createElement('div',{className:"fu",style:{textAlign:"center"}},
      React.createElement('div',{style:{fontSize:24,fontWeight:800,textAlign:"center"}},"History")
    ),
    HISTORY_FEATURES.summaryStats&&React.createElement('div',{className:"fu2",style:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}},
      [{label:"Total workouts",val:totalGroupLogs||"—",sub:"logged by the Bloc",gradient:"linear-gradient(135deg,#DFFFFC,#4ECDC4 52%,#1A8E88)"},
       {label:"Most wins",val:hasClosedHistory&&mostWins?.wins>0?mostWins.name:"—",sub:hasClosedHistory&&mostWins?.wins>0?`${mostWins.wins} win${mostWins.wins>1?"s":""}`:"no closed months yet",gradient:"linear-gradient(135deg,#FFE7A3,#F5A623 45%,#C47A18)"},
       {label:"Most consistent",val:hasClosedHistory&&mostConsistent?.avg!=="—"?mostConsistent.name:"—",sub:hasClosedHistory&&mostConsistent?.avg!=="—"?`${mostConsistent.avg} avg/mo`:"no closed months yet",gradient:"linear-gradient(135deg,#FFFFFF,#DDE7EE 52%,#94B7C7)"},
       {label:`Most ${currencyShortLabel(currency)} lost`,val:hasClosedHistory&&biggestLoser?.moneyLost>0?biggestLoser.name:"—",sub:hasClosedHistory&&biggestLoser?.moneyLost>0?`-${fmtCurrency(biggestLoser.moneyLost, currency)} total`:"no losses yet",gradient:"linear-gradient(135deg,#F7C8C0,#E95F45 52%,#A93A3A)"}
      ].map(x=>React.createElement(Card,{key:x.label,style:{padding:"8px 9px"}},
        React.createElement('span',{style:{display:"block",fontFamily:"'Outfit', sans-serif",fontSize:8,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3,textAlign:"center",width:"100%"}},x.label),
        React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:15,fontWeight:800,color:x.color,lineHeight:1.06,textAlign:"center",width:"100%",...(x.gradient?gradientText(x.gradient):{})}},x.val),
        React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:8.5,fontWeight:600,color:"var(--muted)",marginTop:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",textAlign:"center",width:"100%"}},x.sub)
      ))
    ),
    HISTORY_FEATURES.trailingWorkoutHistory&&React.createElement(Card,{className:"fu3",style:{padding:"11px 12px"}},
      React.createElement('div',{style:{fontWeight:800,fontSize:13,marginBottom:10}},"12-Month Workout History"),
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
    HISTORY_FEATURES.workoutMix&&React.createElement(Card,{className:"fu4",style:{padding:"11px 12px"}},
      React.createElement('div',{style:{fontWeight:800,fontSize:13,marginBottom:10}},"Workout Type Distribution"),
      totalGroupLogs===0
        ? React.createElement('div',{style:{color:"var(--muted)",fontSize:13,textAlign:"center",padding:"12px 0"}},"No workouts logged yet.")
        : React.createElement('div',{style:{display:"flex",gap:6,alignItems:"stretch"}},
            sortedWorkoutTypes.map(t=>{
              const count=groupTypeBreakdown[t];
              const rawPct=totalGroupLogs>0?(count/totalGroupLogs)*100:0;
              const pct=count>0?Math.max(1,Math.round(rawPct)):0;
              const barH=Math.max(count>0?6:0,Math.round((count/maxTypeCount)*56));
              const isTop = count === maxTypeCount && count > 0;
              return React.createElement('div',{key:t,style:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:0}},
                React.createElement('span',{style:{fontFamily:"'Outfit', sans-serif",fontSize:9.5,fontWeight:700,color:count>0?"var(--muted)":"var(--muted2)",height:16,display:"flex",alignItems:"center"}},count>0?`${pct}%`:""),
                React.createElement('div',{style:{width:"100%",height:56,display:"flex",alignItems:"flex-end"}},
                  React.createElement('div',{style:{width:"100%",height:barH,background:count>0?(isTop?"rgba(78, 205, 196, 0.5)":"#0D2828"):"var(--border)",borderRadius:"3px 3px 0 0",opacity:count>0?1:.3}})
                ),
            React.createElement('span',{style:{width:18,height:18,display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#4ECDC4"}},React.createElement(WorkoutTypeIcon,{type:t,size:16})),
                React.createElement('span',{style:{fontSize:10,color:"var(--muted)",fontWeight:600}},t),
                React.createElement('span',{className:"mono",style:{fontSize:11,fontWeight:700,color:count>0?"var(--text)":"var(--muted2)"}},count)
              );
            })
          )
    ),
    HISTORY_FEATURES.allTimeLeaderboard&&React.createElement(Card,{className:"fu5",style:{overflow:"hidden"}},
      React.createElement('div',{style:{padding:"11px 15px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}},
        React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontWeight:800,fontSize:14}},"All-Time Leaderboard"),
        React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:9,color:"var(--muted)",fontWeight:700,letterSpacing:".04em",textTransform:"uppercase"}},"Swipe →")
      ),
      React.createElement('div',{style:{position:"relative"}},
        React.createElement('div',{style:{position:"absolute",top:0,right:0,bottom:0,width:34,pointerEvents:"none",background:"linear-gradient(to right, rgba(8,15,15,0), #080F0F)",zIndex:1}}),
        React.createElement('div',{style:{overflowX:"auto",WebkitOverflowScrolling:"touch"}},
        React.createElement('div',{style:{minWidth:632,padding:"8px"}},
          React.createElement('div',{style:{display:"grid",gridTemplateColumns:"24px 30px 1fr 58px 52px 58px 46px 68px 68px 16px",padding:"7px 10px",borderBottom:"1px solid rgba(255,255,255,.055)",gap:6,fontFamily:"'Outfit', sans-serif",fontSize:9,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".06em",fontWeight:800}},
            ["#","","Name","Total","AVG","Months","Wins",null,null,""].map((h,i)=>React.createElement('div',{key:i,style:{textAlign:i>2?"right":"left",display:"flex",alignItems:"center",justifyContent:i>2?"flex-end":"flex-start",gap:3}},
              i===7||i===8
                ? React.createElement(React.Fragment,null,React.createElement(AppIcon,{name:"money-bag",size:10,stroke:"rgba(214,226,224,.72)"}),React.createElement('span',null,i===7?"Won":"Lost"))
                : h
            ))
          ),
          React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:6,marginTop:6}},
          visibleLeaderboard.map((u,i)=>React.createElement('div',{key:u.name,
            style:{display:"grid",gridTemplateColumns:"24px 30px 1fr 58px 52px 58px 46px 68px 68px 16px",padding:"9px 10px",gap:6,alignItems:"center",background:u.name===currentUser?"rgba(78,205,196,.055)":"rgba(255,255,255,.018)",border:`0.5px solid ${u.name===currentUser?"rgba(78,205,196,.22)":"rgba(255,255,255,.055)"}`,borderRadius:9,boxShadow:"inset 0 1px 0 rgba(255,255,255,0.045)",textAlign:"left",fontFamily:"'Outfit', sans-serif"}},
            React.createElement('div',{style:{fontSize:11,fontWeight:700,color:"var(--muted)",textAlign:"center"}},`#${i+1}`),
            React.createElement(Avatar,{name:u.name,size:24}),
            React.createElement('div',{style:{fontWeight:600,fontSize:14,display:"flex",alignItems:"baseline",gap:6,flexWrap:"wrap",color:"var(--text)"}},u.name,u.name===currentUser&&React.createElement('span',{className:"mono",style:{fontSize:8,color:"#3d5e59"}},"you")),
            React.createElement('span',{style:{fontSize:14,fontWeight:700,textAlign:"right",color:"var(--text)"}},u.total||"—"),
            React.createElement('span',{style:{fontSize:11,fontWeight:700,color:"var(--muted)",textAlign:"right"}},u.avg),
            React.createElement('span',{style:{fontSize:11,fontWeight:700,color:"var(--muted)",textAlign:"right"}},u.activeMonths||"—"),
            React.createElement('span',{style:{fontSize:11,fontWeight:700,textAlign:"right",color:hasClosedHistory&&u.wins>0?"var(--gold)":"var(--muted)",display:"inline-flex",alignItems:"center",justifyContent:"flex-end",gap:4}},
              hasClosedHistory&&u.wins>0 ? u.wins : "—"
            ),
            React.createElement('span',{style:{fontSize:11,fontWeight:700,textAlign:"right",color:hasClosedHistory&&u.moneyWon>0?"var(--green)":"var(--muted)"}},hasClosedHistory&&u.moneyWon>0?`+${fmtCurrency(u.moneyWon, currency)}`:"—"),
            React.createElement('span',{style:{fontSize:11,fontWeight:700,textAlign:"right",color:hasClosedHistory&&u.moneyLost>0?"var(--red)":"var(--muted)"}},hasClosedHistory&&u.moneyLost>0?`-${fmtCurrency(u.moneyLost, currency)}`:"—"),
            React.createElement('span',null)
          )))
        ),
        sortedAll.length>5&&React.createElement('button',{type:"button",onClick:()=>setShowAllLeaderboard(v=>!v),style:{width:"100%",minWidth:632,margin:"6px 8px 8px",padding:"10px",background:"transparent",border:"1px solid var(--border)",borderRadius:8,color:"var(--text)",fontSize:12,fontWeight:800,textAlign:"center"}},
          showAllLeaderboard?"Show Less":`Show ${sortedAll.length-5} More`
        )
      ))
    ),
    HISTORY_FEATURES.blocLegacy&&React.createElement(Card,{className:"fu6",style:{overflow:"hidden"}},
      React.createElement('div',{style:{padding:"11px 15px",borderBottom:"1px solid var(--border)",fontWeight:800,fontSize:14}},"Bloc Legacy"),
      React.createElement('div',{style:{display:"flex",flexDirection:"column"}},
        legacyRows.map((row,i)=>React.createElement('div',{key:row[0],style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"10px 15px",borderBottom:i<legacyRows.length-1?"1px solid rgba(255,255,255,.055)":"none"}},
          React.createElement('span',{style:{fontSize:12,color:"var(--muted)",fontWeight:700}},row[0]),
          React.createElement('span',{style:{fontSize:12,color:"var(--text)",fontWeight:530,textAlign:"right"}},row[1])
        ))
      )
    )
  );
};

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export { HistoryPage };
