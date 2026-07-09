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
  normalizeFeeModel,
  getCountedLogCount,
  isJoinedForMonth
} from "../lib/appState.js";
import {
  isMobile
} from "../lib/utils.js";
import { Avatar, RankIcon, TrophyIcon, Card, SelectField, PlayerProfileErrorBoundary } from "../components/primitives.jsx";
import { PlayerProfile } from "../pages/PlayerProfile.jsx";
import { SettlementScreen } from "../pages/SettlementScreen.jsx";

const MonthPage = ({group,logs,excused,monthHistory,groupSettings,currentUser,currentUserId,initialSelIdx,onStartNextMonth,onSettlementClaimPaid,onSettlementConfirmPaid,navResetToken}) => {
  const [selIdx,setSelIdx]=useState(initialSelIdx ?? null); // null = current month
  const [viewPlayer,setViewPlayer]=useState(null);
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
  const atRisk=isCurrent?activeCounts.filter(u=>{
    const isWinner=winners.find(w=>w.name===u.name);
    const isLoser=losers.find(l=>l.name===u.name);
    let status;
    if (u.proratedDays) {
      const daysActive = Math.max(0, DAY_OF_MON - (u.joinDay||1) + 1);
      const exp = Math.floor((u.target / u.proratedDays) * daysActive);
      const daysLeft = getDaysLeft();
      if (u.count + daysLeft < u.target) status = "cooked";
      else if (u.count - exp >= 2) status = "cruising";
      else if (u.count >= exp) status = "on-track";
      else if (u.count >= exp - 2) status = "at-risk";
      else status = "behind";
    } else {
      status = getStatus(u.count, u.target);
    }
    const displayStatus = getLeaderboardDisplayStatus(status, u.count);
    return !isWinner&&!isLoser&&displayStatus==="at-risk";
  }):[];

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
          React.createElement('span',{className:"mono",style:{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".12em",display:"block",marginBottom:3}},"Monthly Results"),
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
        React.createElement('span',{className:"mono",style:{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".12em",display:"block",marginBottom:3}},"Monthly Results"),
        React.createElement('div',{style:{fontSize:20,fontWeight:800}},monthLabel)
      ),
      monthSelector
    ),
    isCurrent&&React.createElement('div',{style:{background:"#080F0F",border:"1px solid #0D1F1E",borderLeft:"3px solid #F5A623",borderRadius:9,padding:"9px 14px",fontSize:12,color:"#F5A623",fontFamily:"'JetBrains Mono',monospace"}},`⚠ Month in progress — ${getDaysLeft()} days remaining`),
    hasActivity&&winners.length>0
      ? React.createElement(Card,{style:{padding:"10px 14px",background:"#080F0F",border:"0.5px solid #0D1F1E",display:"flex",alignItems:"center",gap:10}},
          React.createElement('span',{style:{display:"inline-flex",color:"#F5A623",flexShrink:0}},React.createElement(TrophyIcon,{size:20,color:"#F5A623"})),
          React.createElement('div',{style:{flex:1,minWidth:0}},
            React.createElement('span',{className:"mono",style:{fontSize:8,color:"var(--text-soft)",textTransform:"uppercase",letterSpacing:".12em",display:"block",marginBottom:3}},winners.length>1?"CO-LEADERS":"LEADING"),
            React.createElement('div',{style:{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:2}},
              winners.map(w=>React.createElement('div',{key:w.name,style:{display:"flex",alignItems:"center",gap:6}},React.createElement(Avatar,{name:w.name,size:22}),React.createElement('span',{style:{fontSize:winners.length>1?16:20,fontWeight:800,color:"var(--text)"}},w.name)))
            ),
            React.createElement('span',{className:"mono",style:{fontSize:10,color:"var(--muted)"}},`${winners[0].count} workouts`)
          ),
          losers.length>0&&React.createElement('div',{style:{textAlign:"right",flexShrink:0}},
            React.createElement('span',{className:"mono",style:{fontSize:8,color:"var(--muted)",display:"block",marginBottom:2}},
              currentLeaderQualified
                ? (winners.length>1 ? "each collect" : "collects")
                : "no winner yet"
            ),
            React.createElement('div',{style:{fontSize:26,fontWeight:800,color:"#4ECDC4"}},currentLeaderQualified ? fmtCurrency(perWinner, resultsCurrency) : "—"),
            winners.length>1&&currentLeaderQualified&&React.createElement('span',{className:"mono",style:{fontSize:8,color:"var(--muted)"}},`pot: ${fmtCurrency(totalPot, resultsCurrency)}`)
          )
        )
      : React.createElement(Card,{style:{padding:"18px 22px",background:"var(--s2)"}},
          React.createElement('div',{style:{textAlign:"center",color:"var(--muted)",fontSize:14}},"No workouts logged yet.")
        ),
    losers.length>0
      ? React.createElement(Card,{style:{padding:"18px 22px",background:"#080F0F",border:"0.5px solid #0D1F1E",borderLeft:"2px solid #3D1010"}},
          React.createElement('span',{className:"mono",style:{fontSize:9,color:"var(--red)",textTransform:"uppercase",letterSpacing:".12em",display:"block",marginBottom:12}},`LOSERS — ${losers.length} ${losers.length===1?"is":"are"} failing to hit their target`),
          React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:8,marginBottom:14}},
            losers.map(l=>React.createElement('div',{key:l.name,style:{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#080F0F",border:"0.5px solid #0D1F1E",borderRadius:9,padding:"11px 13px"}},
              React.createElement('div',{style:{display:"flex",alignItems:"center",gap:10}},
                React.createElement(Avatar,{name:l.name,size:28}),
                React.createElement('div',null,React.createElement('div',{style:{fontWeight:700,fontSize:14}},l.name),React.createElement('span',{className:"mono",style:{fontSize:10,color:"var(--muted)"}},`${l.count} workouts · ${Math.max(0,(l.target || MIN_TARGET)-l.count)} short`))
              ),
              React.createElement('div',{style:{textAlign:"right"}},
                React.createElement('span',{className:"mono",style:{fontSize:9,color:"var(--red)",display:"block",marginBottom:1}},isCurrent?"on track to owe":"currently owes"),
                React.createElement('div',{style:{fontSize:24,fontWeight:800,color:"var(--red)"}},currentLeaderQualified ? fmtCurrency(getLoserAmount(penalties, l.name), resultsCurrency) : "—")
              )
            ))
          ),
          React.createElement('div',{style:{background:"var(--s1)",border:"1px solid var(--border)",borderRadius:8,padding:"9px 12px",fontSize:12,color:"var(--muted)",display:"grid",gap:4}},
            React.createElement('div',null,
              normalizeFeeModel((isCurrent ? groupSettings : selMonth?.settings)?.feeModel)==="flat"
                ? `Flat fine: ${fmtCurrency(Number((isCurrent ? groupSettings : selMonth?.settings)?.fineAmount || DEFAULT_FINE_AMOUNT), resultsCurrency)} each`
                : `Escalating: ${fmtCurrency(Number((isCurrent ? groupSettings : selMonth?.settings)?.fineAmount || DEFAULT_FINE_AMOUNT), resultsCurrency)} base, +${fmtCurrency(Number((isCurrent ? groupSettings : selMonth?.settings)?.escalationStepAmount || 0), resultsCurrency)} per loser`
            ),
            React.createElement('div',null,
              currentLeaderQualified
                ? `${losers.length} losers this month → ${fmtCurrency(perLoser, resultsCurrency)} each`
                : `${losers.length} losers this month → no one owes yet`
            )
          )
        )
      : hasActivity&&React.createElement(Card,{style:{padding:"14px 22px",background:"#080F0F",border:"0.5px solid #0D1F1E"}},
          React.createElement('span',{className:"mono",style:{fontSize:13,color:"#4ECDC4"}},"✓ No losers — everyone on track.")
        ),
    atRisk.length>0&&isCurrent&&React.createElement(Card,{style:{padding:"18px 22px",background:"rgba(240,165,0,.05)",border:"1px solid rgba(240,165,0,.2)"}},
      React.createElement('span',{className:"mono",style:{fontSize:9,color:"var(--amber)",textTransform:"uppercase",letterSpacing:".12em",display:"block",marginBottom:12}},
        `AT RISK — ${atRisk.length} within striking distance of falling behind`
      ),
      React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:8}},
        atRisk.map(u=>React.createElement('div',{key:u.name,style:{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(240,165,0,.06)",borderRadius:9,padding:"10px 13px"}},
          React.createElement('div',{style:{display:"flex",alignItems:"center",gap:10}},
            React.createElement(Avatar,{name:u.name,size:26}),
            React.createElement('div',null,
              React.createElement('div',{style:{fontWeight:700,fontSize:14}},u.name),
              React.createElement('span',{className:"mono",style:{fontSize:10,color:"var(--muted)"}},`${u.count} workouts`)
            )
          ),
          React.createElement('div',{style:{textAlign:"right"}},
            React.createElement('div',{style:{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:700,color:"var(--amber)"}},getLeaderboardDiffText(u)),
            React.createElement('div',{style:{fontSize:11,color:"var(--muted)",marginTop:2}},`${Math.max(0,(u.target || MIN_TARGET)-u.count)} needed`)
          )
        ))
      )
    )
    )
  );
};

// ─── HISTORY PAGE ─────────────────────────────────────────────────────────────

export { MonthPage };
