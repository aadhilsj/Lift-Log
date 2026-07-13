import React from "react";
import {
  MIN_TARGET,
  CUR_MONTH,
  DAY_OF_MON,
  MONTH_NAMES,
  avatarColor,
  calcPenalties,
  getLoserAmount,
  buildSettlementPairsForMonth,
  buildSettlementPairState,
  fmtCurrency,
  ordinal
} from "../lib/appState.js";
import { TrophyIcon } from "../components/primitives.jsx";

const SettlementScreen = ({group, month, currentUser, currentUserId, monthHistory, onSettlementClaimPaid, onSettlementConfirmPaid, onStartNextMonth}) => {
  const [settlementBusy, setSettlementBusy] = React.useState(null);
  const [showStandings, setShowStandings] = React.useState(false);
  const ledgerRef = React.useRef(null);

  const relevantNames = Object.keys(month.counts || {});
  const activeCounts = relevantNames
    .filter(name => !month.excused?.[name])
    .map(name => ({
      name,
      count: Number(month.counts[name] || 0),
      target: month.memberTargets?.[name] || month.settings?.minTarget || MIN_TARGET
    }));
  const penalties = calcPenalties(activeCounts, month.settings);
  const {winners, losers, perWinner} = penalties;
  const settlementPairs = buildSettlementPairsForMonth(month);
  const isBlocPerfect = activeCounts.length > 0 && activeCounts.every(member => member.count >= member.target);

  const userCount = month.counts?.[currentUser] || 0;
  const userIsWinner = winners.some(w => w.name === currentUser);
  const userIsLoser = losers.some(l => l.name === currentUser);
  const outcome = userIsWinner ? "winner" : userIsLoser ? "missed" : "hit_mas";
  const sortedActive = [...activeCounts].sort((a,b) => b.count - a.count || a.name.localeCompare(b.name));
  const userRank = sortedActive.findIndex(m => m.name === currentUser) + 1 || 1;
  const currency = month.settings?.currency || "USD";
  const mas = month.memberTargets?.[currentUser] || month.settings?.minTarget || MIN_TARGET;
  const userOwes = getLoserAmount(penalties, currentUser);

  const incomingRows = settlementPairs.filter(pair => pair.receiverDisplayName === currentUser);
  const outgoingRows = settlementPairs.filter(pair => pair.payerDisplayName === currentUser);

  const C = {
    greenText: "#39A85A",
    greenBg: "#e6f4ea",
    redText: "#b93232",
    redBg: "#fdecea",
    neutralText: "var(--muted)",
    neutralBg: "var(--s2)",
    cyan: "#4ECDC4",
    gold: "#F5A623",
    pill: {padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:700, display:"inline-block"},
    card: {background:"var(--s1)", border:"1px solid var(--border)", borderRadius:10, overflow:"hidden"},
    sectionLabel: {fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:".12em", color:"var(--muted)", fontFamily:"'JetBrains Mono',monospace"}
  };

  const initialsFor = name => name.split(" ").map(part => part[0]).join("").slice(0,2).toUpperCase();

  const handleSettlementAction = async ({ key, kind, payerDisplayName, receiverDisplayName, amount }) => {
    setSettlementBusy(key);
    try {
      const result = kind === "claim"
        ? await onSettlementClaimPaid?.({
            monthKey: month.key,
            payerDisplayName,
            receiverDisplayName,
            amount,
            currency
          })
        : await onSettlementConfirmPaid?.({
            monthKey: month.key,
            payerDisplayName,
            receiverDisplayName
          });
      if (!result?.ok) window.alert(result?.error || "Unable to update settlement");
    } finally {
      setSettlementBusy(null);
    }
  };

  const hero = (() => {
    if (userIsWinner && isBlocPerfect) {
      return {
        tag: "1st · PERFECT BLOC",
        stat: `${userCount} workouts`,
        line: "Everyone hit their MAS. You led the way.",
        tone: "perfect"
      };
    }
    if (userIsWinner) {
      return {
        tag: "Winner · 1st Place",
        stat: `+${fmtCurrency(perWinner, currency)}`,
        line: `${userCount} workouts. Top of the bloc.`,
        tone: "winner"
      };
    }
    if (isBlocPerfect) {
      return {
        tag: "PERFECT BLOC",
        stat: `${userCount} workouts`,
        line: "Everyone hit their MAS this month.",
        tone: "perfect"
      };
    }
    if (!userIsLoser) {
      return {
        tag: `MAS Hit · ${ordinal(userRank)} Place`,
        stat: `${userCount} workouts`,
        line: "Solid month. Build on it next month.",
        tone: "neutral"
      };
    }
    return {
      tag: `Fold · ${ordinal(userRank)} Place`,
      stat: `-${fmtCurrency(userOwes, currency)}`,
      line: `${userCount} workouts. You needed ${mas}.`,
      tone: "missed"
    };
  })();

  const heroStyle = hero.tone === "perfect"
    ? {background:"linear-gradient(135deg, rgba(78,205,196,.2), rgba(215,226,225,.12) 48%, rgba(58,168,90,.2))", border:"1px solid rgba(78,205,196,.3)"}
    : hero.tone === "winner"
      ? {background:"rgba(57,168,90,.11)", border:"1px solid rgba(57,168,90,.24)"}
      : hero.tone === "missed"
        ? {background:"rgba(185,50,50,.07)", border:"1px solid rgba(185,50,50,.18)"}
        : {background:"linear-gradient(135deg, rgba(215,226,225,.1), rgba(78,205,196,.045))", border:"1px solid rgba(215,226,225,.16)"};
  const heroColor = hero.tone === "winner" ? C.greenText : hero.tone === "missed" ? C.redText : hero.tone === "neutral" ? "#D7E2E1" : "var(--text)";

  const renderPerfectRoster = () => isBlocPerfect && React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}},
    sortedActive.map(member => React.createElement('div',{key:member.name,style:{display:"flex",alignItems:"center",gap:8,background:"rgba(78,205,196,.075)",border:"1px solid rgba(78,205,196,.16)",borderRadius:8,padding:"8px 10px",minWidth:0}},
      React.createElement('div',{style:{width:26,height:26,borderRadius:999,background:avatarColor(member.name),color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0}},initialsFor(member.name)),
      React.createElement('div',{style:{minWidth:0,flex:1}},
        React.createElement('div',{style:{fontSize:12,fontWeight:800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},member.name),
        React.createElement('div',{className:"mono",style:{fontSize:10,color:"var(--muted)"}},`${member.count}/${member.target}`)
      ),
      React.createElement('span',{style:{color:C.cyan,fontWeight:900,fontSize:13}},"✓")
    ))
  );

  const statusForPair = pair => {
    const state = buildSettlementPairState(group, month.key, pair.payerDisplayName, pair.receiverDisplayName, currentUserId, currentUser);
    return {
      state,
      text: state.confirmed
        ? "Confirmed"
        : state.pending
          ? "Pending confirmation"
          : "Outstanding"
    };
  };

  const renderLedger = () => {
    if (isBlocPerfect) return null;
    if (!incomingRows.length && !outgoingRows.length) return null;

    const rows = outcome === "winner" ? incomingRows : outgoingRows;
    const title = outcome === "winner" ? "Collecting from" : "You owe";
    const totalColor = outcome === "winner" ? C.greenText : C.redText;

    return React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:8,width:"100%",maxWidth:outcome==="winner"?340:"100%",margin:outcome==="winner"?"0 auto":"0"}},
      React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}},
        React.createElement('div',{style:C.sectionLabel},title),
        outcome !== "winner" && React.createElement('div',{style:{fontSize:14,fontWeight:900,color:totalColor}},`-${fmtCurrency(rows.reduce((sum, row) => sum + row.amount, 0), currency)}`)
      ),
      rows.map(pair => {
        const {state, text} = statusForPair(pair);
        const key = `${month.key}:${pair.payerDisplayName}:${pair.receiverDisplayName}`;
        const action = outcome === "winner"
          ? state.pending && state.isReceiver && React.createElement('button',{
              type:"button",
              onClick:()=>handleSettlementAction({key,kind:"confirm",payerDisplayName:pair.payerDisplayName,receiverDisplayName:pair.receiverDisplayName,amount:pair.amount}),
              disabled:settlementBusy===key,
              style:{fontSize:11,fontWeight:800,padding:"6px 10px",borderRadius:8,background:"transparent",border:"1px solid var(--amber)",color:"var(--amber)"}
            }, settlementBusy===key ? "Saving..." : "Confirm received")
          : !state.confirmed && React.createElement('button',{
              type:"button",
              onClick:()=>handleSettlementAction({key,kind:"claim",payerDisplayName:pair.payerDisplayName,receiverDisplayName:pair.receiverDisplayName,amount:pair.amount}),
              disabled:settlementBusy===key || state.pending,
              style:{fontSize:11,fontWeight:800,padding:"6px 10px",borderRadius:8,background:state.pending?"var(--s3)":"var(--red-dim)",border:`1px solid ${state.pending?"var(--border)":"rgba(224,80,32,.35)"}`,color:state.pending?"var(--muted)":"#e05020"}
            }, settlementBusy===key ? "Saving..." : state.pending ? "Waiting" : "Mark as paid");
        return React.createElement('div',{key:key,style:{...C.card,padding:"9px 11px"}},
          React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,minHeight:28}},
            outcome==="winner"
              ? React.createElement('div',{style:{fontSize:13,fontWeight:800,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},pair.payerDisplayName)
              : React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8,minWidth:0}},
                  React.createElement('div',{style:{fontSize:13,fontWeight:800,color:C.redText,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},"You"),
                  React.createElement('span',{style:{color:"var(--muted)"}},"→"),
                  React.createElement('div',{style:{fontSize:13,fontWeight:800,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},pair.receiverDisplayName)
                ),
            React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8,flexShrink:0}},
              outcome!=="winner" && React.createElement('span',{style:{fontSize:11,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",color:state.confirmed?C.greenText:"var(--amber)",whiteSpace:"nowrap"}},text),
              React.createElement('div',{style:{fontSize:14,fontWeight:900,color:totalColor}},`${outcome === "winner" ? "+" : "-"}${fmtCurrency(pair.amount, currency)}`),
              outcome!=="winner" && action
            )
          )
        );
      })
    );
  };

  const mvpCount = sortedActive[0]?.count || 0;
  const mvpNames = sortedActive.filter(member => member.count === mvpCount && mvpCount > 0).map(member => member.name);
  const behindRows = activeCounts.map(member => ({...member, miss: Math.max(0, member.target - member.count)})).sort((a,b) => b.miss - a.miss || a.name.localeCompare(b.name));
  const furthestBehind = behindRows[0]?.miss > 0 ? behindRows[0] : null;
  const fallbackAwardNames = sortedActive.map(member => member.name).filter(Boolean);
  const awardCards = [
    {title:"Bloc MVP", name:mvpNames.length ? mvpNames.join(" & ") : "No winner", detail:mvpNames.length ? `${mvpCount} workouts` : "No workouts", tone:"gold", gradient:"linear-gradient(135deg, rgba(245,166,35,.16), rgba(255,224,132,.06))"},
    {title:"Most Consistent", name:fallbackAwardNames[1] || fallbackAwardNames[0] || "Isira", detail:"Steady all month", tone:"violet", gradient:"linear-gradient(135deg, rgba(135,113,255,.16), rgba(78,112,205,.07))"},
    {title:"Comeback", name:fallbackAwardNames[2] || fallbackAwardNames[0] || "Rahul", detail:"Finished strong", tone:"cyan", gradient:"linear-gradient(135deg, rgba(78,205,196,.14), rgba(71,118,230,.06))"},
    {title:"Furthest Behind", name:furthestBehind ? furthestBehind.name : "No one", detail:furthestBehind ? `${furthestBehind.miss} short of MAS` : "Everyone hit MAS", tone:furthestBehind ? "red" : "silver", gradient:"linear-gradient(135deg, rgba(185,50,50,.14), rgba(245,166,35,.055))"}
  ];

  const renderAwards = () => React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(138px,1fr))",gap:7}},
    awardCards.map(award => React.createElement('div',{key:award.title,style:{...C.card,background:award.gradient,padding:"10px 10px 9px",minHeight:72}},
      React.createElement('div',{style:{display:"flex",alignItems:"center",gap:6,marginBottom:6}},
        award.tone==="gold" && React.createElement(TrophyIcon,{size:13,color:C.gold}),
        React.createElement('div',{style:{...C.sectionLabel,fontSize:9,letterSpacing:".1em"}},award.title)
      ),
      React.createElement('div',{style:{fontSize:14,fontWeight:900,color:award.tone==="red"?C.redText:"var(--text)",lineHeight:1.18,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},award.name),
      React.createElement('div',{style:{fontSize:11,color:"var(--muted)",marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},award.detail)
    ))
  );

  const renderLeaderboard = () => React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:6,padding:"7px",background:"rgba(8,15,15,.32)",borderTop:"1px solid rgba(255,255,255,.05)"}},
    sortedActive.map((row, i) => {
      const isMe = row.name === currentUser;
      const isWinner = winners.some(w => w.name === row.name);
      const isLoser = losers.some(l => l.name === row.name);
      return React.createElement('div',{key:row.name,style:{display:"flex",alignItems:"center",gap:9,padding:"9px 10px",border:"1px solid rgba(255,255,255,.055)",borderRadius:8,background:isMe?"rgba(78,205,196,.06)":"rgba(255,255,255,.018)"}},
        React.createElement('div',{className:"mono",style:{fontSize:10,color:"var(--muted)",width:18,textAlign:"right",flexShrink:0}},i+1),
        React.createElement('div',{style:{width:26,height:26,borderRadius:999,background:avatarColor(row.name),color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0}},initialsFor(row.name)),
        React.createElement('div',{style:{flex:1,minWidth:0}},
          React.createElement('div',{style:{fontSize:13,fontWeight:isMe?900:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},row.name + (isMe ? " (you)" : "")),
          React.createElement('div',{style:{fontSize:10,color:"var(--muted)",marginTop:1}},`${row.count} workouts`)
        ),
        isWinner && losers.length > 0
          ? React.createElement('span',{style:{fontSize:12,fontWeight:900,color:C.greenText}},`+${fmtCurrency(perWinner,currency)}`)
          : isLoser
            ? React.createElement('span',{style:{fontSize:12,fontWeight:900,color:C.redText}},`-${fmtCurrency(getLoserAmount(penalties,row.name),currency)}`)
            : React.createElement('span',{style:{...C.pill,background:"rgba(215,226,225,.07)",color:"#AAB6B5",fontSize:9,padding:"2px 8px"}},"safe")
      );
    })
  );

  const shareText = outcome === "missed"
    ? `Taking the L this month — ${userCount}/${mas} workouts. Owe ${fmtCurrency(userOwes, currency)}. Back next month. #Ante`
    : userIsWinner
      ? `Won ${month.label} with ${userCount} workouts. #Ante`
      : `Hit MAS — ${userCount} workouts in ${month.label}. #Ante`;

  const handleShare = () => {
    if (outcome === "missed") {
      ledgerRef.current?.scrollIntoView({behavior:"smooth", block:"center"});
      return;
    }
    if (navigator.share) navigator.share({text: shareText}).catch(()=>{});
    else navigator.clipboard?.writeText(shareText).then(()=>window.alert("Copied to clipboard!")).catch(()=>{});
  };

  const liveMonthName = MONTH_NAMES[CUR_MONTH];
  const ctaLabel = DAY_OF_MON <= 2 ? `Start ${liveMonthName} →` : `Go to ${liveMonthName} →`;
  const heroStatSize = String(hero.stat).includes("workouts")
    ? "clamp(31px, 8vw, 42px)"
    : "clamp(36px, 10vw, 52px)";

  return React.createElement('div',{style:{width:"100%",maxWidth:"100%",margin:"0 auto",padding:"0 0 32px",display:"flex",flexDirection:"column",gap:12,fontFamily:"'Outfit', sans-serif"}},
    React.createElement('div',{style:{...heroStyle,borderRadius:12,padding:"18px 18px 16px",textAlign:"center",display:"flex",flexDirection:"column",gap:10}},
      React.createElement('span',{style:{...C.pill,alignSelf:"center",background:hero.tone==="missed"?C.redBg:hero.tone==="neutral"?C.neutralBg:"rgba(78,205,196,.14)",color:hero.tone==="missed"?C.redText:hero.tone==="neutral"?C.neutralText:C.greenText,fontWeight:900}},hero.tag),
      React.createElement('div',{style:{fontSize:heroStatSize,fontWeight:900,lineHeight:1.05,color:heroColor,letterSpacing:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},hero.stat),
      React.createElement('div',{style:{fontSize:14,color:"var(--muted)",lineHeight:1.45}},hero.line),
      renderPerfectRoster()
    ),
    React.createElement('div',{ref:ledgerRef},renderLedger()),
    React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:8}},
      React.createElement('div',{style:C.sectionLabel},"Awards"),
      renderAwards()
    ),
    React.createElement('div',{style:{border:"1px solid var(--border)",borderRadius:10,overflow:"hidden",background:"var(--s1)"}},
      React.createElement('button',{type:"button",onClick:()=>setShowStandings(v=>!v),style:{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 15px",background:"transparent",border:"none",color:"var(--text)",fontSize:13,fontWeight:800,cursor:"pointer"}},
        React.createElement('span',null,"Full Ranked Standings"),
        React.createElement('span',{style:{color:"var(--muted)",fontSize:16}},showStandings?"−":"+")
      ),
      showStandings&&renderLeaderboard()
    ),
    React.createElement('div',{style:{display:"flex",gap:8,paddingTop:2}},
      React.createElement('button',{onClick:handleShare,style:{flex:1,padding:"13px",borderRadius:10,background:"var(--s2)",border:"1px solid var(--border)",color:"var(--text)",fontSize:13,fontWeight:800}},
        outcome === "missed" ? "View the settlement" : "Share this month"
      ),
      onStartNextMonth && React.createElement('button',{onClick:onStartNextMonth,style:{flex:1,padding:"13px",borderRadius:10,background:"var(--green)",border:"none",color:"#000",fontSize:13,fontWeight:800}},
        ctaLabel
      )
    )
  );
};

export { SettlementScreen };
