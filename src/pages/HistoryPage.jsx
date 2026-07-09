import React from "react";
const { useState, useEffect, useMemo, useCallback, useRef } = React;
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
  getCountedLogs,
  getCountedLogCount,
  isJoinedForMonth
} from "../lib/appState.js";
import { Avatar, WorkoutTypeIcon, ChevronRightIcon, RankIcon, TrophyIcon, Card } from "../components/primitives.jsx";
import { PlayerProfile } from "../pages/PlayerProfile.jsx";

const HistoryPage = ({logs,excused,monthHistory,groupSettings,navResetToken,currentUser}) => {
  const currency = groupSettings?.currency || DEFAULT_CURRENCY;
  const [selected,setSelected]=useState(null);
  useEffect(()=>{ setSelected(null); },[navResetToken]);
  useEffect(()=>{
    if(selected) window.scrollTo({top:0,left:0,behavior:"auto"});
  },[selected]);

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
    return {name,total,avg,wins,moneyWon,moneyLost};
  }),[fullHistory, monthHistory, historicalNames]);

  const groupMonthlyAvg=useMemo(()=>{
    return fullHistory.map(m=>{
      const monthNames = getHistoricalMemberNamesForMonth(m, historicalNames);
      const active=monthNames.filter(n=>isJoinedForMonth(n, m.key) && !m.excused?.[n]);
      const vals=active.map(n=>m.counts[n]||0);
      const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
      return {label:m.label||m.key,avg,isCurrent:!!m.isCurrent};
    });
  },[fullHistory, historicalNames]);

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
  const maxTotal=Math.max(...sortedAll.map(u=>u.total),1);
  const maxAvg=Math.max(...groupMonthlyAvg.map(m=>m.avg),1);
  const hasClosedHistory=monthHistory.length>0;
  const mostWins=[...allTime].sort((a,b)=>b.wins-a.wins)[0];
  const mostConsistent=[...allTime].filter(u=>u.avg!=="—").sort((a,b)=>Number(b.avg)-Number(a.avg))[0];
  const biggestLoser=[...allTime].sort((a,b)=>b.moneyLost-a.moneyLost)[0];

  if(selected) return React.createElement(PlayerProfileErrorBoundary,{profileName:selected,onBack:()=>setSelected(null)},
    React.createElement(PlayerProfile,{name:selected,logs,excused,monthHistory,onBack:()=>setSelected(null),groupSettings})
  );

  return React.createElement('div',{style:{maxWidth:960,margin:"0 auto",padding:"16px",display:"flex",flexDirection:"column",gap:12}},
    React.createElement('div',{className:"fu"},
      React.createElement('div',{style:{fontSize:24,fontWeight:800}},"History")
    ),
    // Summary cards — 2x2 on mobile, 4 on desktop
    React.createElement('div',{className:"fu2",style:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}},
      [{label:"Bloc Total",val:totalGroupLogs||"—",sub:"workouts logged",color:"#4ECDC4"},
       {label:"Most Wins",val:hasClosedHistory&&mostWins?.wins>0?mostWins.name:"—",sub:hasClosedHistory&&mostWins?.wins>0?`${mostWins.wins} win${mostWins.wins>1?"s":""}`:"-",color:"#F5A623"},
       {label:"Most Consistent",val:hasClosedHistory&&mostConsistent?.avg!=="—"?mostConsistent.name:"—",sub:hasClosedHistory&&mostConsistent?.avg!=="—"?`${mostConsistent.avg} avg/mo`:"no closed months yet",color:"#FFFFFF"},
       {label:"Most Lost",val:hasClosedHistory&&biggestLoser?.moneyLost>0?biggestLoser.name:"—",sub:hasClosedHistory&&biggestLoser?.moneyLost>0?`-${fmtCurrency(biggestLoser.moneyLost, currency)} total`:"no losers yet",color:"#D44A4A"},
      ].map(x=>React.createElement(Card,{key:x.label,style:{padding:"11px 12px"}},
        React.createElement('span',{className:"lbl",style:{fontSize:10,marginBottom:2}},x.label),
        React.createElement('div',{style:{fontSize:18,fontWeight:800,color:x.color,lineHeight:1.08}},x.val),
        React.createElement('div',{style:{fontSize:10,color:"var(--muted)",marginTop:3}},x.sub)
      ))
    ),
    // Group avg chart
    React.createElement(Card,{className:"fu3",style:{padding:"16px"}},
      React.createElement('div',{style:{fontWeight:800,fontSize:14,marginBottom:16}},"Bloc Avg Workouts / Month"),
      groupMonthlyAvg.every(m=>m.avg===0)
        ? React.createElement('div',{style:{color:"var(--muted)",fontSize:13,textAlign:"center",padding:"20px 0"}},"Data will appear here as the month progresses.")
        : React.createElement('div',{style:{overflowX:"auto",paddingBottom:4}},
            React.createElement('div',{style:{display:"flex",alignItems:"flex-end",gap:8,height:130,minWidth:"max-content"}},
              groupMonthlyAvg.map((m,i)=>{
                const h=Math.max(4,Math.round((m.avg/maxAvg)*88));
                const isHighlighted = m.avg === maxAvg && maxAvg > 0;
                return React.createElement('div',{key:m.label,style:{flex:"0 0 auto",minWidth:44,display:"flex",flexDirection:"column",alignItems:"center",gap:0}},
                  React.createElement('span',{className:"mono",style:{fontSize:11,fontWeight:700,color:isHighlighted?"#4ECDC4":"#1E4040",background:"var(--s3)",padding:"2px 6px",borderRadius:4,marginBottom:4,display:"block"}},m.avg.toFixed(1)),
                  React.createElement('div',{style:{width:"100%",height:h,background:m.isCurrent?"rgba(78, 205, 196, 0.5)":"#0D2828",borderRadius:"3px 3px 0 0"}}),
                  React.createElement('span',{className:"mono",style:{fontSize:9,color:isHighlighted?"#4ECDC4":"#1E4040",textAlign:"center",lineHeight:1.3,marginTop:4}},m.label)
                );
              })
            )
          )
    ),
    // Workout mix
    React.createElement(Card,{className:"fu4",style:{padding:"16px"}},
      React.createElement('div',{style:{fontWeight:800,fontSize:14,marginBottom:16}},"Bloc Workout Mix"),
      totalGroupLogs===0
        ? React.createElement('div',{style:{color:"var(--muted)",fontSize:13,textAlign:"center",padding:"12px 0"}},"No workouts logged yet.")
        : React.createElement('div',{style:{display:"flex",gap:6,alignItems:"stretch"}},
            WORKOUT_TYPES.map(t=>{
              const count=groupTypeBreakdown[t];
              const pct=totalGroupLogs>0?Math.round((count/totalGroupLogs)*100):0;
              const barH=Math.max(count>0?6:0,Math.round((count/maxTypeCount)*68));
              const isTop = count === maxTypeCount && count > 0;
              return React.createElement('div',{key:t,style:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:0}},
                React.createElement('span',{className:"mono",style:{fontSize:10,color:count>0?"var(--muted)":"var(--muted2)",height:16,display:"flex",alignItems:"center"}},count>0?`${pct}%`:""),
                React.createElement('div',{style:{width:"100%",height:68,display:"flex",alignItems:"flex-end"}},
                  React.createElement('div',{style:{width:"100%",height:barH,background:count>0?(isTop?"rgba(78, 205, 196, 0.5)":"#0D2828"):"var(--border)",borderRadius:"3px 3px 0 0",opacity:count>0?1:.3}})
                ),
            React.createElement('span',{style:{width:18,height:18,display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#4ECDC4"}},React.createElement(WorkoutTypeIcon,{type:t,size:16})),
                React.createElement('span',{style:{fontSize:10,color:"var(--muted)",fontWeight:600}},t),
                React.createElement('span',{className:"mono",style:{fontSize:11,fontWeight:700,color:count>0?"var(--text)":"var(--muted2)"}},count)
              );
            })
          )
    ),
    // All-time leaderboard — scrollable on mobile
    React.createElement(Card,{className:"fu5",style:{overflow:"hidden"}},
      React.createElement('div',{style:{padding:"11px 15px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}},
        React.createElement('div',{style:{fontWeight:800,fontSize:14}},"All-Time Leaderboard")
      ),
      React.createElement('div',{style:{position:"relative"}},
        React.createElement('div',{style:{position:"absolute",top:0,right:0,bottom:0,width:26,pointerEvents:"none",background:"linear-gradient(to right, rgba(8,15,15,0), #080F0F)",zIndex:1}}),
        React.createElement('div',{style:{overflowX:"auto",WebkitOverflowScrolling:"touch"}},
        React.createElement('div',{style:{minWidth:504,padding:"8px"}},
          React.createElement('div',{style:{display:"grid",gridTemplateColumns:"24px 30px 1fr 58px 52px 46px 60px 60px",padding:"7px 15px",borderBottom:"1px solid var(--border)",gap:6,fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".08em"}},
            ["#","","Name","Total","Avg","Wins","Won","Lost"].map((h,i)=>React.createElement('div',{key:i,style:{textAlign:i>2?"right":"left"}},h))
          ),
          React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:4,marginTop:4}},
          sortedAll.map((u,i)=>React.createElement('button',{key:u.name,type:"button",onClick:()=>setSelected(u.name),
            style:{display:"grid",gridTemplateColumns:"24px 30px 1fr 58px 52px 46px 60px 60px 16px",padding:"8px 10px",gap:6,alignItems:"center",cursor:"pointer",background:"#080F0F",border:`0.5px solid ${u.name===currentUser?"#163d36":"#0D1F1E"}`,borderRadius:8,boxShadow:"inset 0 1px 0 rgba(255,255,255,0.04)",textAlign:"left"},
            onMouseEnter:e=>e.currentTarget.style.borderColor=u.name===currentUser?"#1c4a43":"#15302c",onMouseLeave:e=>e.currentTarget.style.borderColor=u.name===currentUser?"#163d36":"#0D1F1E"},
            React.createElement('div',null,React.createElement(RankIcon,{rank:i+1})),
            React.createElement(Avatar,{name:u.name,size:24}),
            React.createElement('div',{style:{fontWeight:600,fontSize:14,display:"flex",alignItems:"baseline",gap:6,flexWrap:"wrap",color:"var(--text)"}},u.name,u.name===currentUser&&React.createElement('span',{className:"mono",style:{fontSize:8,color:"#3d5e59"}},"you")),
            React.createElement('span',{className:"mono",style:{fontSize:14,fontWeight:700,textAlign:"right",color:"var(--text)"}},u.total||"—"),
            React.createElement('span',{className:"mono",style:{fontSize:11,color:"var(--muted)",textAlign:"right"}},u.avg),
            React.createElement('span',{className:"mono",style:{fontSize:11,textAlign:"right",color:hasClosedHistory&&u.wins>0?"var(--gold)":"var(--muted)",display:"inline-flex",alignItems:"center",justifyContent:"flex-end",gap:4}},
              hasClosedHistory&&u.wins>0
                ? React.createElement(React.Fragment,null,
                    React.createElement(TrophyIcon,{size:12,color:"#F5A623"}),
                    React.createElement('span',null,u.wins)
                  )
                : "—"
            ),
            React.createElement('span',{className:"mono",style:{fontSize:11,textAlign:"right",color:hasClosedHistory&&u.moneyWon>0?"var(--green)":"var(--muted)"}},hasClosedHistory&&u.moneyWon>0?`+${fmtCurrency(u.moneyWon, currency)}`:"—"),
            React.createElement('span',{className:"mono",style:{fontSize:11,textAlign:"right",color:hasClosedHistory&&u.moneyLost>0?"var(--red)":"var(--muted)"}},hasClosedHistory&&u.moneyLost>0?`-${fmtCurrency(u.moneyLost, currency)}`:"—"),
            React.createElement('span',{style:{display:"inline-flex",justifyContent:"flex-end",alignItems:"center"}},React.createElement(ChevronRightIcon,null))
          )))
        )
      ))
    )
  );
};

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export { HistoryPage };
