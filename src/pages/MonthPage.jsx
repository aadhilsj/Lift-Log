import React from "react";
const { useState, useEffect, useMemo, useCallback, useRef } = React;
import {
  DEFAULT_FINE_AMOUNT,
  DEFAULT_CURRENCY,
  NAMES,
  MIN_TARGET,
  CUR_MONTH,
  CUR_YEAR,
  DAY_OF_MON,
  curKey,
  MONTH_NAMES,
  getDaysLeft,
  getStatus,
  getLeaderboardDisplayStatus,
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
  const {winners,losers,perLoser,totalPot,perWinner}=penalties;
  const currentLeaderQualified = !isCurrent || ((winners[0]?.count || 0) >= (winners[0]?.target || MIN_TARGET));
  const hasActivity=activeCounts.some(u=>u.count>0);
  const resultsCurrency = (isCurrent ? groupSettings : selMonth?.settings)?.currency || DEFAULT_CURRENCY;
  // At Risk = active, not a loser, not a winner, and currently tagged at-risk.
  const monthLabel=isCurrent?`${MONTH_NAMES[CUR_MONTH]} ${CUR_YEAR}`:selMonth.label;

  const monthSelector=React.createElement(SelectField,{
    value:selIdx??"",
    onChange:e=>setSelIdx(e.target.value===""?null:Number(e.target.value)),
    width:isMobile()?"176px":"188px",
    options:[
      {value:"",label:"Current Month"},
      ...histReversed.map((m,i)=>({value:String(i),label:m.label}))
    ]
  });

  if(viewPlayer) return React.createElement('div',{style:{maxWidth:740,margin:"0 auto"}},
    React.createElement(PlayerProfileErrorBoundary,{profileName:viewPlayer,onBack:()=>setViewPlayer(null)},
      React.createElement(PlayerProfile,{name:viewPlayer,logs,excused,monthHistory,onBack:()=>setViewPlayer(null),groupSettings})
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
          u.isOut?"—":isWin&&losers.length>0?`+${fmtCurrency(perWinner, resultsCurrency)}`:isLose?`-${fmtCurrency(getLoserAmount(penalties, u.name), resultsCurrency)}`:fmtCurrency(0, resultsCurrency))
      );
    })
  );

  // ── Closed month → settlement screen ───────────────────────────────────────
  if (!isCurrent && selMonth && currentUser) {
    return React.createElement('div',{style:{maxWidth:680,margin:"0 auto",padding:"16px",display:"flex",flexDirection:"column",gap:16}},
      React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}},
        React.createElement('div',null,
          React.createElement('span',{className:"mono",style:{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".12em",display:"block",marginBottom:3}},"Month"),
          React.createElement('div',{style:{fontSize:20,fontWeight:800}},selMonth.label)
        ),
        monthSelector
      ),
      React.createElement(SettlementScreen,{
        group, month:selMonth, currentUser, currentUserId, monthHistory, onSettlementClaimPaid, onSettlementConfirmPaid,
        onStartNextMonth: onStartNextMonth ? ()=>{ setSelIdx(null); onStartNextMonth(); } : null
      })
    );
  }

  return React.createElement(React.Fragment,null,
  React.createElement('div',{style:{maxWidth:680,margin:"0 auto",padding:"16px",display:"flex",flexDirection:"column",gap:12}},
    React.createElement('div',{style:{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:10}},
      React.createElement('div',null,
        React.createElement('span',{className:"mono",style:{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".12em",display:"block",marginBottom:3}},"Month"),
        React.createElement('div',{style:{fontSize:20,fontWeight:800}},monthLabel)
      ),
      monthSelector
    ),
    React.createElement(Card,{style:{padding:"18px 18px 16px",background:"#080F0F",border:"1px dashed rgba(245,166,35,.55)",display:"flex",flexDirection:"column",gap:14}},
      React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}},
        React.createElement('span',{className:"mono",style:{fontSize:10,color:"#F5A623",textTransform:"uppercase",letterSpacing:".12em"}},"Month in progress"),
        React.createElement('span',{className:"mono",style:{fontSize:11,color:"var(--muted)"}},`${getDaysLeft()} days remaining`)
      ),
      hasActivity&&winners.length>0
        ? React.createElement('div',{style:{display:"flex",alignItems:"center",gap:12}},
            React.createElement('span',{style:{display:"inline-flex",color:"#F5A623",flexShrink:0}},React.createElement(TrophyIcon,{size:22,color:"#F5A623"})),
            React.createElement('div',{style:{flex:1,minWidth:0}},
              React.createElement('div',{style:{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:3}},
                winners.map(w=>React.createElement('div',{key:w.name,style:{display:"flex",alignItems:"center",gap:7}},React.createElement(Avatar,{name:w.name,size:24}),React.createElement('span',{style:{fontSize:winners.length>1?17:22,fontWeight:800,color:"var(--text)"}},w.name)))
              ),
              React.createElement('span',{className:"mono",style:{fontSize:11,color:"var(--muted)"}},`${winners[0].count} workouts`)
            )
          )
        : React.createElement('div',{style:{fontSize:18,fontWeight:800,color:"var(--text)"}},"No leader yet"),
      currentUser&&React.createElement('div',{style:{background:"var(--s1)",border:"1px solid var(--border)",borderRadius:8,padding:"12px 13px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}},
        React.createElement('div',null,
          React.createElement('div',{style:{fontSize:13,fontWeight:700,color:"var(--text)"}},`${currentUser}'s projection`),
          React.createElement('div',{style:{fontSize:12,color:"var(--muted)",marginTop:2}},counts.find(u=>u.name===currentUser)?.memberDiffLabel || getLeaderboardDiffText(counts.find(u=>u.name===currentUser) || {count:0,target:MIN_TARGET}))
        ),
        React.createElement('div',{style:{textAlign:"right"}},
          React.createElement('div',{className:"mono",style:{fontSize:18,fontWeight:800,color:losers.some(l=>l.name===currentUser)?"var(--red)":winners.some(w=>w.name===currentUser)?"#4ECDC4":"var(--text)"}},`${counts.find(u=>u.name===currentUser)?.count ?? 0}/${counts.find(u=>u.name===currentUser)?.target ?? MIN_TARGET}`),
          React.createElement('div',{style:{fontSize:11,color:"var(--muted)"}},"workouts")
        )
      ),
      React.createElement('div',{style:{fontSize:12,color:"var(--muted)",lineHeight:1.5}},"Projection is not final until the month closes."),
      React.createElement('button',{type:"button",onClick:onOpenToday,style:{alignSelf:"flex-start",background:"transparent",border:"none",padding:0,color:"#4ECDC4",fontSize:13,fontWeight:800,cursor:"pointer"}},"See live leaderboard")
    ),
    React.createElement('div',{style:{border:"1px solid var(--border)",borderRadius:10,overflow:"hidden",background:"var(--s1)"}},
      React.createElement('button',{type:"button",onClick:()=>setShowStandings(v=>!v),style:{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 15px",background:"transparent",border:"none",color:"var(--text)",fontSize:13,fontWeight:800,cursor:"pointer"}},
        React.createElement('span',null,`Full bloc standings · ${activeCounts.length} members`),
        React.createElement('span',{style:{color:"var(--muted)",fontSize:16}},showStandings?"−":"+")
      ),
      showStandings&&renderStandings()
    )
    )
  );
};

// ─── HISTORY PAGE ─────────────────────────────────────────────────────────────

export { MonthPage };
