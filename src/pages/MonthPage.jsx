import React from "react";
const { useState, useEffect, useMemo, useCallback, useRef } = React;
import {
  DEFAULT_CURRENCY,
  NAMES,
  MIN_TARGET,
  CUR_MONTH,
  CUR_YEAR,
  DAY_OF_MON,
  curKey,
  MONTH_NAMES,
  getDaysLeft,
  getLeaderboardDiffText,
  calcPenalties,
  getLoserAmount,
  getCurrentMemberTargetInfo,
  fmtCurrency,
  getCountedLogCount,
  isJoinedForMonth
} from "../lib/appState.js";
import {
  isMobile
} from "../lib/utils.js";
import { Avatar, RankIcon, TrophyIcon, Card, SelectField, PlayerProfileErrorBoundary } from "../components/primitives.jsx";
import { PlayerProfile } from "../pages/PlayerProfile.jsx";
import { SettlementScreen } from "../pages/SettlementScreen.jsx";

const FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const MonthPage = ({group,logs,excused,monthHistory,groupSettings,currentUser,currentUserId,initialSelIdx,onStartNextMonth,onSettlementClaimPaid,onSettlementConfirmPaid,onOpenToday,navResetToken}) => {
  const [selIdx,setSelIdx]=useState(initialSelIdx ?? null); // null = current month
  const [viewPlayer,setViewPlayer]=useState(null);
  const [showStandings,setShowStandings]=useState(false);
  useEffect(()=>{ setViewPlayer(null); },[navResetToken]);
  useEffect(()=>{
    if(viewPlayer) window.scrollTo({top:0,left:0,behavior:"auto"});
  },[viewPlayer]);

  const isCurrent=selIdx===null;
  const histReversed=[...monthHistory].reverse();
  const selMonth=isCurrent?null:histReversed[selIdx];

  const relevantNames = NAMES.filter(name => isJoinedForMonth(name, isCurrent ? curKey : selMonth.key));
  const counts=isCurrent
    ? relevantNames.map(n=>{
        const { target, joinDay=1, proratedDays } = getCurrentMemberTargetInfo(n, curKey, MIN_TARGET);
        const count = getCountedLogCount(logs[n]||[]);
        const isOut = excused[n]?.[curKey]||false;
        let memberDiffLabel = null;
        if (!isOut && proratedDays) {
          const daysActive = Math.max(0, DAY_OF_MON - joinDay + 1);
          const exp = Math.floor((target / proratedDays) * daysActive);
          const d = count - exp;
          memberDiffLabel = d > 0 ? `+${d} ahead of pace` : d < 0 ? `${d} behind pace` : "on pace";
        }
        return { name:n, count, isOut, target, memberDiffLabel, joinDay, proratedDays };
      })
    : relevantNames.map(n=>({name:n,count:selMonth.counts[n]||0,isOut:selMonth.excused?.[n]||false,target:selMonth.memberTargets?.[n] || selMonth.settings?.minTarget || MIN_TARGET}));

  const activeCounts=counts.filter(u=>!u.isOut);
  const sorted=[...counts].sort((a,b)=>{if(a.isOut&&!b.isOut)return 1;if(!a.isOut&&b.isOut)return -1;return b.count-a.count;});
  const penalties = calcPenalties(activeCounts, isCurrent ? groupSettings || {} : selMonth?.settings || {});
  const {winners,losers,perWinner}=penalties;
  const hasActivity=activeCounts.some(u=>u.count>0);
  const resultsCurrency = (isCurrent ? groupSettings : selMonth?.settings)?.currency || DEFAULT_CURRENCY;
  const hasQualifiedWinner = winners.some(w => (w.count || 0) >= (w.target || MIN_TARGET));
  const wouldMoveMoney = hasQualifiedWinner && losers.length > 0 && perWinner > 0;
  const expandMonthLabel = label => String(label || "").replace(/^([A-Z][a-z]{2})\s+'(\d{2})$/, (_, shortName, year) => `${FULL_MONTH_NAMES[MONTH_NAMES.indexOf(shortName)] || shortName} '${year}`);
  const monthLabel=isCurrent?`${FULL_MONTH_NAMES[CUR_MONTH] || MONTH_NAMES[CUR_MONTH]} '${String(CUR_YEAR).slice(2)}`:expandMonthLabel(selMonth.label);
  const monthSelector=React.createElement(SelectField,{
    value:selIdx??"",
    onChange:e=>{
      const selectEl = e.currentTarget;
      setSelIdx(e.target.value===""?null:Number(e.target.value));
      requestAnimationFrame(()=>selectEl.blur());
    },
    width:isMobile()?"132px":"144px",
    compact:true,
    arrowColor:"#4ECDC4",
    textAlign:"center",
    inputStyle:{
      background:"rgba(8,15,15,.48)",
      border:"1px solid rgba(78,205,196,.18)",
      color:"var(--text)",
      fontFamily:"'Outfit', sans-serif",
      fontWeight:700,
      outline:"none",
      boxShadow:"none",
      textAlign:"center",
      paddingLeft:14,
      paddingRight:20
    },
    options:[
      {value:"",label:"This Month"},
      ...histReversed.map((m,i)=>({value:String(i),label:expandMonthLabel(m.label)}))
    ]
  });

  if(viewPlayer) return React.createElement('div',{style:{maxWidth:740,margin:"0 auto"}},
    React.createElement(PlayerProfileErrorBoundary,{profileName:typeof viewPlayer === "string" ? viewPlayer : viewPlayer?.name,onBack:()=>setViewPlayer(null)},
      React.createElement(PlayerProfile,{name:typeof viewPlayer === "string" ? viewPlayer : viewPlayer?.name,logs,excused,monthHistory,onBack:()=>setViewPlayer(null),groupSettings,initialMonthKey:typeof viewPlayer === "string" ? null : viewPlayer?.monthKey})
    )
  );

  const renderStandings=()=>React.createElement(Card,{style:{overflow:"hidden"}},
    React.createElement('div',{style:{padding:"11px 15px",borderBottom:"1px solid var(--border)",fontWeight:800,fontSize:14}},isCurrent?"Full Standings":"Final Standings"),
    sorted.map((u,i)=>{
      const activeOnly=sorted.filter(x=>!x.isOut);
      const aRank=activeOnly.findIndex(x=>x.name===u.name);
      const isWin=winners.find(w=>w.name===u.name);
      const isLose=losers.find(l=>l.name===u.name);
      return React.createElement('div',{key:u.name,style:{display:"flex",alignItems:"center",padding:"11px 15px",borderBottom:i<sorted.length-1?"1px solid var(--border)":"none",background:isWin?"rgba(245,200,66,.03)":isLose?"rgba(232,69,69,.03)":"transparent",opacity:u.isOut?.4:1}},
        React.createElement('div',{style:{minWidth:26}},u.isOut?React.createElement('span',{style:{fontSize:13}},"💤"):React.createElement(RankIcon,{rank:aRank+1})),
        React.createElement('button',{onClick:()=>setViewPlayer(u.name),
          style:{display:"flex",alignItems:"center",gap:8,background:"transparent",padding:"0",cursor:"pointer",flexShrink:0},
          onMouseEnter:e=>e.currentTarget.style.opacity=".7",onMouseLeave:e=>e.currentTarget.style.opacity="1"},
          React.createElement(Avatar,{name:u.name,size:24,muted:u.isOut}),
          React.createElement('span',{style:{fontWeight:700,fontSize:14,color:u.isOut?"var(--muted)":"var(--text)",marginLeft:6,textDecoration:"underline",textDecorationColor:"rgba(255,255,255,.15)"}},u.name)
        ),
        u.isOut&&React.createElement('span',{className:"mono",style:{fontSize:9,color:"var(--muted2)",marginLeft:6}},"excused"),
        React.createElement('div',{style:{flex:1}}),
        React.createElement('span',{className:"mono",style:{fontSize:17,fontWeight:700,marginRight:12,color:u.isOut?"var(--muted)":"var(--text)"}},u.isOut?"—":u.count),
        React.createElement('span',{className:"mono",style:{fontSize:12,minWidth:74,textAlign:"right",color:isWin&&losers.length>0?"#4ECDC4":isLose?"var(--red)":"var(--muted)"}},
          u.isOut?"—":isCurrent?getLeaderboardDiffText(u):isWin&&losers.length>0?`+${fmtCurrency(perWinner, resultsCurrency)}`:isLose?`-${fmtCurrency(getLoserAmount(penalties, u.name), resultsCurrency)}`:fmtCurrency(0, resultsCurrency))
      );
    })
  );

  const renderCurrentFinancialSnapshot=()=>React.createElement('div',{style:{padding:"13px 15px",borderTop:"1px solid var(--border)",display:"flex",flexDirection:"column",gap:12}},
    React.createElement('div',{style:{fontSize:12,color:"var(--muted)",lineHeight:1.5}},
      wouldMoveMoney
        ? "If the month ended today, these would be the money movements. This is not final."
        : hasQualifiedWinner
          ? "If the month ended today, no money would move because nobody would owe."
          : "If the month ended today, no money would move because nobody has hit target yet."
    ),
    wouldMoveMoney&&winners.length>0&&React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:7}},
      React.createElement('div',{className:"mono",style:{fontSize:9,color:"#4ECDC4",textTransform:"uppercase",letterSpacing:".12em"}},"Would collect"),
      winners.map(w=>React.createElement('div',{key:`win-${w.name}`,style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,background:"rgba(78,205,196,.06)",border:"1px solid rgba(78,205,196,.14)",borderRadius:8,padding:"9px 10px"}},
        React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8,minWidth:0}},
          React.createElement(Avatar,{name:w.name,size:24}),
          React.createElement('span',{style:{fontSize:13,fontWeight:800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},w.name)
        ),
        React.createElement('span',{className:"mono",style:{fontSize:13,fontWeight:800,color:"#4ECDC4",flexShrink:0}},`+${fmtCurrency(perWinner, resultsCurrency)}`)
      ))
    ),
    wouldMoveMoney&&losers.length>0&&React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:7}},
      React.createElement('div',{className:"mono",style:{fontSize:9,color:"var(--red)",textTransform:"uppercase",letterSpacing:".12em"}},"Would pay"),
      losers.map(l=>React.createElement('div',{key:`lose-${l.name}`,style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,background:"rgba(232,69,69,.055)",border:"1px solid rgba(232,69,69,.14)",borderRadius:8,padding:"9px 10px"}},
        React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8,minWidth:0}},
          React.createElement(Avatar,{name:l.name,size:24}),
          React.createElement('span',{style:{fontSize:13,fontWeight:800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},l.name)
        ),
        React.createElement('span',{className:"mono",style:{fontSize:13,fontWeight:800,color:"var(--red)",flexShrink:0}},`-${fmtCurrency(getLoserAmount(penalties, l.name), resultsCurrency)}`)
      ))
    ),
    hasQualifiedWinner&&!wouldMoveMoney&&React.createElement('div',{style:{fontSize:13,fontWeight:800,color:"#4ECDC4"}},"Everyone active would keep their money. No one would pay.")
  );

  // ── Closed month → settlement screen ───────────────────────────────────────
  if (!isCurrent && selMonth && currentUser) {
    return React.createElement('div',{style:{maxWidth:840,margin:"0 auto",padding:"12px 12px 16px",display:"flex",flexDirection:"column",gap:12,background:"radial-gradient(ellipse 95% 72% at 50% 62%, rgba(78,205,196,.075), rgba(78,205,196,.025) 46%, transparent 76%)",borderRadius:16}},
      React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}},
      React.createElement('div',{style:{textAlign:"center"}},
        React.createElement('div',{style:{fontSize:20,fontWeight:800}},monthLabel)
      ),
        monthSelector
      ),
      React.createElement(SettlementScreen,{
        group, month:selMonth, currentUser, currentUserId, monthHistory, onSettlementClaimPaid, onSettlementConfirmPaid,
        onViewProfileMonth: (name, monthKey)=>setViewPlayer({name, monthKey}),
        onStartNextMonth: onStartNextMonth ? ()=>{ setSelIdx(null); onStartNextMonth(); } : null
      })
    );
  }

  return React.createElement(React.Fragment,null,
  React.createElement('div',{style:{maxWidth:840,margin:"0 auto",padding:"12px 12px 16px",display:"flex",flexDirection:"column",gap:12,background:"radial-gradient(ellipse 105% 90% at 50% 58%, rgba(78,205,196,.075), rgba(78,205,196,.028) 52%, transparent 88%), radial-gradient(ellipse 120% 72% at 50% 100%, rgba(78,205,196,.04), transparent 72%)",borderRadius:16}},
    React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}},
      React.createElement('div',{style:{textAlign:"center"}},
        React.createElement('div',{style:{fontSize:20,fontWeight:800}},monthLabel)
      ),
      monthSelector
    ),
    React.createElement(Card,{style:{padding:"18px 18px 16px",background:"linear-gradient(135deg, rgba(245,166,35,.16), rgba(245,210,105,.08) 48%, rgba(8,15,15,.92))",border:"1px solid rgba(245,166,35,.28)",display:"flex",flexDirection:"column",gap:14,fontFamily:"'Outfit', sans-serif"}},
      React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}},
        React.createElement('span',{style:{fontFamily:"'Outfit', sans-serif",fontSize:11,fontWeight:800,color:"#F5A623",textTransform:"uppercase",letterSpacing:".08em"}},"Month in progress"),
        React.createElement('span',{style:{fontFamily:"'Outfit', sans-serif",fontSize:11,fontWeight:700,color:"var(--muted)"}},`${getDaysLeft()} days remaining`)
      ),
      hasActivity&&winners.length>0
        ? React.createElement('div',{style:{display:"flex",alignItems:"center",gap:12}},
            React.createElement('span',{style:{display:"inline-flex",color:"#F5A623",flexShrink:0}},React.createElement(TrophyIcon,{size:22,color:"#F5A623"})),
            React.createElement('div',{style:{flex:1,minWidth:0}},
              React.createElement('div',{style:{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:3}},
                winners.map(w=>React.createElement('div',{key:w.name,style:{display:"flex",alignItems:"center",gap:10}},React.createElement(Avatar,{name:w.name,size:22}),React.createElement('span',{style:{fontSize:winners.length>1?15:18,fontWeight:800,color:"var(--text)",lineHeight:1.12}},w.name),React.createElement('span',{style:{fontFamily:"'Outfit', sans-serif",fontSize:8,fontWeight:500,color:"rgba(245,166,35,.7)",textTransform:"uppercase",letterSpacing:".05em",whiteSpace:"nowrap",paddingTop:2,marginLeft:2}},"current leader")))
              ),
              React.createElement('span',{className:"mono",style:{fontSize:11,color:"var(--muted)"}},`${winners[0].count} workouts`)
            )
          )
        : React.createElement('div',{style:{fontSize:18,fontWeight:800,color:"var(--text)"}},"No leader yet"),
      currentUser&&React.createElement('div',{style:{background:"rgba(8,17,17,.24)",border:"1px solid rgba(245,166,35,.13)",borderRadius:8,padding:"12px 13px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,boxShadow:"inset 0 1px 0 rgba(255,255,255,.035)",backdropFilter:"blur(3px)"}},
        React.createElement('div',null,
          React.createElement('div',{style:{fontSize:13,fontWeight:700,color:"var(--text)"}},"Your month so far"),
          React.createElement('div',{style:{fontSize:12,color:"var(--muted)",marginTop:2}},counts.find(u=>u.name===currentUser)?.memberDiffLabel || getLeaderboardDiffText(counts.find(u=>u.name===currentUser) || {count:0,target:MIN_TARGET}))
        ),
        React.createElement('div',{style:{textAlign:"right"}},
          React.createElement('div',{className:"mono",style:{fontSize:18,fontWeight:800,color:losers.some(l=>l.name===currentUser)?"var(--red)":"#4ECDC4"}},`${counts.find(u=>u.name===currentUser)?.count ?? 0}/${counts.find(u=>u.name===currentUser)?.target ?? MIN_TARGET}`),
          React.createElement('div',{style:{fontSize:11,color:"var(--muted)"}},"logged")
        )
      ),
      React.createElement('button',{type:"button",onClick:onOpenToday,style:{alignSelf:"flex-start",background:"transparent",border:"none",padding:0,color:"var(--text)",fontSize:13,fontWeight:800,cursor:"pointer"}},"See Leaderboard")
    ),
    React.createElement('div',{style:{height:1,width:"100%",background:"linear-gradient(90deg, transparent, rgba(78,205,196,.2), rgba(255,255,255,.12), rgba(78,205,196,.2), transparent)",margin:"1px 0"}}),
    React.createElement('div',{style:{border:"1px solid rgba(78,205,196,.13)",borderRadius:10,overflow:"hidden",background:"rgba(8,15,15,.68)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.025)"}},
      React.createElement('button',{type:"button",onClick:()=>setShowStandings(v=>!v),style:{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 15px",background:"transparent",border:"none",color:"var(--text)",fontSize:13,fontWeight:800,cursor:"pointer"}},
        React.createElement('span',null,"If the month ended today"),
        React.createElement('span',{style:{color:"var(--muted)",fontSize:16}},showStandings?"−":"+")
      ),
      showStandings&&renderCurrentFinancialSnapshot()
    )
    )
  );
};

// ─── HISTORY PAGE ─────────────────────────────────────────────────────────────

export { MonthPage };
