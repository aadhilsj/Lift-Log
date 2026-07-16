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
  isJoinedForMonth,
  workoutsLabel
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
  const expandMonthFullYear = (label, key) => {
    const fromLabel = /^([A-Z][a-z]{2})\s+'?(\d{2})$/.exec(String(label || "").trim());
    if (fromLabel) return `${FULL_MONTH_NAMES[MONTH_NAMES.indexOf(fromLabel[1])] || fromLabel[1]} 20${fromLabel[2]}`;
    const [year, month] = String(key || "").split("-").map(Number);
    return Number.isFinite(year) && Number.isFinite(month) ? `${FULL_MONTH_NAMES[month] || MONTH_NAMES[month] || "Month"} ${year}` : expandMonthLabel(label);
  };
  const monthLabel=isCurrent?`${FULL_MONTH_NAMES[CUR_MONTH] || MONTH_NAMES[CUR_MONTH]} ${CUR_YEAR}`:expandMonthFullYear(selMonth.label, selMonth.key);
  const monthSelector=React.createElement(SelectField,{
    value:selIdx??"",
    onChange:e=>{
      const selectEl = e.currentTarget;
      setSelIdx(e.target.value===""?null:Number(e.target.value));
      requestAnimationFrame(()=>selectEl.blur());
    },
    width:isMobile()?"126px":"138px",
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
      paddingLeft:12,
      paddingRight:18
    },
    options:[
      {value:"",label:"This Month"},
      ...histReversed.map((m,i)=>({value:String(i),label:expandMonthLabel(m.label)}))
    ]
  });

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
    return React.createElement('div',{style:{position:"relative",maxWidth:840,margin:"0 auto",padding:"12px 12px 16px",display:"flex",flexDirection:"column",gap:12,background:"radial-gradient(ellipse 95% 72% at 50% 62%, rgba(78,205,196,.075), rgba(78,205,196,.025) 46%, transparent 76%)",borderRadius:16}},
      React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}},
      React.createElement('div',{style:{textAlign:"center"}},
        React.createElement('div',{style:{fontSize:19,fontWeight:800}},monthLabel)
      ),
        monthSelector
      ),
      React.createElement(SettlementScreen,{
        group, month:selMonth, currentUser, currentUserId, monthHistory, onSettlementClaimPaid, onSettlementConfirmPaid,
        onViewProfileMonth: (name, monthKey)=>setViewPlayer({name, monthKey}),
        onStartNextMonth: onStartNextMonth ? ()=>{ setSelIdx(null); onStartNextMonth(); } : null
      }),
      viewPlayer&&React.createElement('div',{style:{position:"absolute",inset:0,zIndex:30,overflowY:"auto",WebkitOverflowScrolling:"touch",background:"transparent"}},
        React.createElement(PlayerProfileErrorBoundary,{profileName:typeof viewPlayer === "string" ? viewPlayer : viewPlayer?.name,onBack:()=>setViewPlayer(null)},
          React.createElement(PlayerProfile,{name:typeof viewPlayer === "string" ? viewPlayer : viewPlayer?.name,logs,excused,monthHistory,onBack:()=>setViewPlayer(null),groupSettings,initialMonthKey:typeof viewPlayer === "string" ? null : viewPlayer?.monthKey})
        )
      )
    );
  }

  // "This time last month" — personal-only pace check vs the same day-of-month
  // of the last closed month. Only shown when the member was joined on/before
  // day D of that month (otherwise the baseline would be misleadingly low).
  const lastMonthCompare = (() => {
    if (!isCurrent || !currentUser) return null;
    const priorMonth = histReversed[0];
    if (!priorMonth || !priorMonth.key) return null;
    if (!isJoinedForMonth(currentUser, priorMonth.key)) return null;
    const priorInfo = getCurrentMemberTargetInfo(currentUser, priorMonth.key, priorMonth.settings?.minTarget || MIN_TARGET);
    if ((priorInfo.joinDay || 1) > DAY_OF_MON) return null; // joined after day D last month → skip
    const dayOf = d => { const m = /^\d{4}-\d{2}-(\d{2})/.exec(String(d || "")); return m ? Number(m[1]) : NaN; };
    const priorLogs = priorMonth.logsByUser?.[currentUser] || [];
    const priorCount = getCountedLogCount(priorLogs.filter(l => { const day = dayOf(l.date); return Number.isFinite(day) && day <= DAY_OF_MON; }));
    const thisCount = counts.find(u => u.name === currentUser)?.count ?? getCountedLogCount(logs[currentUser] || []);
    const diff = thisCount - priorCount;
    const keyMonth = Number(String(priorMonth.key || "").split("-")[1]);
    const priorMonthName = FULL_MONTH_NAMES[priorMonth.month ?? (Number.isFinite(keyMonth) ? keyMonth : 0)] || "last month";
    return {
      thisCount, priorCount,
      tone: diff > 0 ? "ahead" : diff < 0 ? "behind" : "even",
      takeaway: diff > 0 ? `Ahead of where you were in ${priorMonthName}` : diff < 0 ? `Behind where you were in ${priorMonthName}` : `Right on pace with ${priorMonthName}`
    };
  })();

  const lastMonthCard = lastMonthCompare && (() => {
    const { thisCount, priorCount, tone, takeaway } = lastMonthCompare;
    const maxC = Math.max(thisCount, priorCount, 1);
    const barH = n => n > 0 ? Math.max(4, Math.round(42 * n / maxC)) : 0;
    const takeawayColor = tone === "ahead" ? "#4ECDC4" : tone === "behind" ? "#F5A623" : "var(--muted)";
    const bar = (label, n, color, numColor) => React.createElement('div', { key: label, style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: 52 } },
      React.createElement('div', { style: { fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 800, color: numColor, lineHeight: 1 } }, n),
      React.createElement('div', { style: { width: 24, height: 42, display: "flex", alignItems: "flex-end" } },
        React.createElement('div', { style: { width: "100%", height: barH(n), background: color, borderRadius: "4px 4px 0 0" } })
      ),
      React.createElement('div', { style: { fontSize: 9.5, color: "var(--muted)", whiteSpace: "nowrap" } }, label)
    );
    return React.createElement('div', { style: { border: "1px solid rgba(78,205,196,.16)", borderRadius: 10, background: "linear-gradient(135deg, rgba(78,205,196,.075), rgba(8,15,15,.58) 48%, rgba(78,205,196,.035))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.035), 0 10px 28px rgba(78,205,196,.045)", padding: "12px 15px", display: "flex", flexDirection: "column", gap: 10 } },
      React.createElement('div', { style: { fontFamily: "'Outfit', sans-serif", fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--muted)", textAlign: "center" } }, "This time last month"),
      React.createElement('div', { style: { display: "flex", alignItems: "center", gap: 20 } },
        React.createElement('div', { style: { display: "flex", alignItems: "flex-end", gap: 16, flexShrink: 0 } },
          bar("This month", thisCount, "#4ECDC4", "var(--text)"),
          bar("Last month", priorCount, "rgba(124,150,145,.5)", "var(--muted)")
        ),
        React.createElement('div', { style: { flex: 1, minWidth: 0, fontSize: 11, fontWeight: 700, color: takeawayColor, lineHeight: 1.3, display: "flex", alignItems: "center", alignSelf: "stretch" } }, takeaway)
      )
    );
  })();

  return React.createElement('div',{style:{position:"relative",minHeight:"calc(100vh - 136px)",padding:"0 0 28px",background:"radial-gradient(ellipse 125% 44% at 50% 0%, rgba(78,205,196,.09), rgba(78,205,196,.035) 42%, rgba(78,205,196,.014) 68%, transparent 100%), linear-gradient(180deg, rgba(78,205,196,.018) 0%, rgba(78,205,196,.012) 42%, rgba(78,205,196,.006) 72%, transparent 100%)"}},
  React.createElement('div',{style:{maxWidth:840,margin:"0 auto",padding:"12px 12px 16px",display:"flex",flexDirection:"column",gap:12,background:"transparent",borderRadius:16}},
    React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}},
      React.createElement('div',{style:{textAlign:"center"}},
        React.createElement('div',{style:{fontSize:19,fontWeight:800}},monthLabel)
      ),
      monthSelector
    ),
    React.createElement(Card,{style:{padding:"18px 18px 16px",background:"linear-gradient(135deg, rgba(245,166,35,.16), rgba(245,210,105,.08) 48%, rgba(8,15,15,.92))",border:"1px solid rgba(245,166,35,.28)",display:"flex",flexDirection:"column",gap:14,fontFamily:"'Outfit', sans-serif"}},
      React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}},
        React.createElement('span',{style:{fontFamily:"'Outfit', sans-serif",fontSize:11,fontWeight:800,color:"#F5A623",textTransform:"uppercase",letterSpacing:".08em"}},"Month in progress"),
        React.createElement('span',{style:{fontFamily:"'Outfit', sans-serif",fontSize:11,fontWeight:700,color:"var(--muted)"}},`${getDaysLeft()} days remaining`)
      ),
      hasActivity&&winners.length>0
        ? React.createElement('div',{style:{display:"flex",alignItems:"center",gap:10}},
            React.createElement('span',{style:{display:"inline-flex",color:"#F5A623",flexShrink:0}},React.createElement(TrophyIcon,{size:18,color:"#F5A623"})),
            React.createElement('div',{style:{flex:1,minWidth:0}},
              React.createElement('div',{style:{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:2}},
                winners.map(w=>React.createElement('div',{key:w.name,style:{display:"flex",alignItems:"center",gap:5}},React.createElement(Avatar,{name:w.name,size:16}),React.createElement('span',{style:{fontSize:winners.length>1?11:12,fontWeight:700,color:"var(--text)",lineHeight:1.1,maxWidth:86,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},w.name),React.createElement('span',{style:{fontFamily:"'Outfit', sans-serif",fontSize:7.5,fontWeight:500,color:"rgba(245,166,35,.7)",textTransform:"uppercase",letterSpacing:".045em",whiteSpace:"nowrap",paddingTop:1,marginLeft:4}},"current leader")))
              ),
              React.createElement('span',{style:{fontFamily:"'Outfit', sans-serif",fontSize:11,fontWeight:500,color:"var(--muted)",letterSpacing:0}},workoutsLabel(winners[0].count))
            )
          )
        : React.createElement('div',{style:{fontSize:18,fontWeight:800,color:"var(--text)"}},"No leader yet"),
      currentUser&&React.createElement('div',{style:{background:"rgba(8,17,17,.24)",border:"1px solid rgba(245,166,35,.13)",borderRadius:8,padding:"12px 13px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,boxShadow:"inset 0 1px 0 rgba(255,255,255,.035)",backdropFilter:"blur(3px)"}},
        React.createElement('div',null,
          React.createElement('div',{style:{fontSize:13,fontWeight:700,color:"var(--text)"}},"Your month so far"),
          React.createElement('div',{style:{fontSize:12,color:"var(--muted)",marginTop:2}},counts.find(u=>u.name===currentUser)?.memberDiffLabel || getLeaderboardDiffText(counts.find(u=>u.name===currentUser) || {count:0,target:MIN_TARGET}))
        ),
        React.createElement('div',{style:{textAlign:"right"}},
          React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:18,fontWeight:800,color:losers.some(l=>l.name===currentUser)?"var(--red)":"#4ECDC4"}},`${counts.find(u=>u.name===currentUser)?.count ?? 0}/${counts.find(u=>u.name===currentUser)?.target ?? MIN_TARGET}`),
          React.createElement('div',{style:{fontSize:11,color:"var(--muted)"}},"logged")
        )
      )
    ),
    React.createElement('div',{style:{height:1,width:"100%",background:"linear-gradient(90deg, transparent, rgba(78,205,196,.2), rgba(255,255,255,.12), rgba(78,205,196,.2), transparent)",margin:"1px 0"}}),
    lastMonthCard,
    lastMonthCard&&React.createElement('div',{style:{height:1,width:"100%",background:"linear-gradient(90deg, transparent, rgba(78,205,196,.2), rgba(255,255,255,.12), rgba(78,205,196,.2), transparent)",margin:"1px 0"}}),
    React.createElement('div',{style:{border:"1px solid rgba(78,205,196,.17)",borderRadius:10,overflow:"hidden",background:"linear-gradient(135deg, rgba(78,205,196,.055), rgba(8,15,15,.74) 52%, rgba(78,205,196,.025))",boxShadow:"inset 0 1px 0 rgba(255,255,255,.035), 0 10px 26px rgba(78,205,196,.04)"}},
      React.createElement('button',{type:"button",onClick:()=>setShowStandings(v=>!v),style:{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 15px",background:"transparent",border:"none",color:"var(--text)",fontSize:13,fontWeight:800,cursor:"pointer"}},
        React.createElement('span',null,"If the Month Ended Today"),
        React.createElement('span',{style:{color:"var(--muted)",fontSize:14,lineHeight:1}},showStandings?"↑":"↓")
      ),
      showStandings&&renderCurrentFinancialSnapshot()
    ),
    viewPlayer&&React.createElement('div',{style:{position:"absolute",inset:0,zIndex:30,overflowY:"auto",WebkitOverflowScrolling:"touch",background:"transparent"}},
      React.createElement(PlayerProfileErrorBoundary,{profileName:typeof viewPlayer === "string" ? viewPlayer : viewPlayer?.name,onBack:()=>setViewPlayer(null)},
        React.createElement(PlayerProfile,{name:typeof viewPlayer === "string" ? viewPlayer : viewPlayer?.name,logs,excused,monthHistory,onBack:()=>setViewPlayer(null),groupSettings,initialMonthKey:typeof viewPlayer === "string" ? null : viewPlayer?.monthKey})
      )
    )
    )
  );
};

// ─── HISTORY PAGE ─────────────────────────────────────────────────────────────

export { MonthPage };
