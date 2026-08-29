import React from "react";
import {
  MIN_TARGET,
  CUR_MONTH,
  DAY_OF_MON,
  MONTH_NAMES,
  calcPenalties,
  getLoserAmount,
  buildSettlementPairsForMonth,
  buildSettlementPairState,
  fmtCurrency,
  isSoloForMonth,
  ordinal,
  workoutsLabel,
  getCountedLogs,
  getMonthPartsFromKey
} from "../lib/appState.js";
import { Avatar, TrophyIcon } from "../components/primitives.jsx";
import { ShareSticker } from "../components/ShareSticker.jsx";
import { MonthCalendarCard } from "../components/MonthCalendarCard.jsx";
import { buildStickerData } from "../lib/shareSticker.js";
import { buildPaymentTarget, buildPaymentTargets } from "../lib/paymentLinks.js";

const FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const SettlementScreen = ({group, month, currentUser, currentUserId, monthHistory, profiles, onOpenAccount, onSettlementClaimPaid, onSettlementConfirmPaid, onStartNextMonth, onViewProfileMonth, onTrackUsage}) => {
  const [copiedKey, setCopiedKey] = React.useState(null);
  const [settlementBusy, setSettlementBusy] = React.useState(null);
  const [showStandings, setShowStandings] = React.useState(false);
  const [claimPrompt, setClaimPrompt] = React.useState(null);
  const [showSticker, setShowSticker] = React.useState(false);
  const ledgerRef = React.useRef(null);

  const relevantNames = Object.keys(month.counts || {});
  const soloNames = relevantNames.filter(name => isSoloForMonth(month, name, month.key));
  const activeCounts = relevantNames
    .filter(name => !month.excused?.[name] && !isSoloForMonth(month, name, month.key))
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
    sectionLabel: {fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:".07em", color:"var(--muted)", fontFamily:"'Outfit', sans-serif"}
  };

  const monthKeyParts = key => {
    const [year, monthIndex] = String(key || "").split("-").map(Number);
    return Number.isFinite(year) && Number.isFinite(monthIndex) ? { year, monthIndex } : null;
  };
  const monthOrder = key => {
    const parts = monthKeyParts(key);
    return parts ? (parts.year * 12) + parts.monthIndex : -Infinity;
  };
  const hitTargetForMonth = (memberName, snapshot) => {
    if (!memberName || !snapshot || snapshot.excused?.[memberName] || isSoloForMonth(snapshot, memberName, snapshot.key)) return false;
    const target = snapshot.memberTargets?.[memberName] || snapshot.settings?.minTarget || MIN_TARGET;
    return (Number(snapshot.counts?.[memberName] || 0) >= target);
  };
  const consistentStreak = (() => {
    const months = [...(monthHistory || [])].filter(m => m?.key && monthOrder(m.key) <= monthOrder(month.key)).sort((a,b) => monthOrder(a.key) - monthOrder(b.key));
    let streak = 0;
    for (let i = months.length - 1; i >= 0; i -= 1) {
      if (!hitTargetForMonth(currentUser, months[i])) break;
      streak += 1;
    }
    return streak;
  })();
  const streakLine = consistentStreak >= 2 ? `${consistentStreak} consistent months in a row. Keep it going.` : "Build on it next month.";
  const selectedMonthName = FULL_MONTH_NAMES[month.month ?? monthKeyParts(month.key)?.monthIndex ?? 0] || MONTH_NAMES[month.month ?? monthKeyParts(month.key)?.monthIndex ?? 0] || "month";
  const perfectLine = `Everyone hit the target this ${selectedMonthName}.`;
  const perfectFooterLine = consistentStreak >= 2
    ? { emphasis: `${consistentStreak} consistent months in a row for you.`, rest: " Keep it going." }
    : ["Keep it going."];

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

  const requestSettlementAction = payload => {
    if (payload?.kind === "claim") {
      setClaimPrompt(payload);
      return;
    }
    handleSettlementAction(payload);
  };

  const hero = (() => {
    if (userIsWinner && isBlocPerfect) {
      return {
        tag: "PERFECT BLOC MONTH",
        stat: workoutsLabel(userCount),
        line: perfectLine,
        footerLine: perfectFooterLine,
        tone: "perfect"
      };
    }
    if (userIsWinner) {
      return {
        tag: "Winner",
        stat: `+${fmtCurrency(perWinner, currency)}`,
        topLine: "Top of the Bloc.",
        line: `${workoutsLabel(userCount)}.`,
        keepLine: "Keep it going.",
        tone: "winner"
      };
    }
    if (isBlocPerfect) {
      return {
        tag: "PERFECT BLOC MONTH",
        stat: workoutsLabel(userCount),
        line: perfectLine,
        footerLine: perfectFooterLine,
        tone: "perfect"
      };
    }
    if (!userIsLoser) {
      return {
        tag: "Target Hit",
        stat: workoutsLabel(userCount),
        line: streakLine,
        tone: "neutral"
      };
    }
    return {
      tag: "Tough Month",
      stat: workoutsLabel(userCount),
      line: `You needed ${mas}. Bounce back next month.`,
      tone: "missed"
    };
  })();

  const heroStyle = hero.tone === "perfect"
    ? {background:"linear-gradient(135deg, rgba(78,205,196,.2), rgba(215,226,225,.12) 48%, rgba(58,168,90,.2))", border:"1px solid rgba(78,205,196,.3)"}
    : hero.tone === "winner"
      ? {background:"rgba(57,168,90,.11)", border:"1px solid rgba(57,168,90,.24)"}
      : hero.tone === "missed"
        ? {background:"rgba(185,50,50,.07)", border:"1px solid rgba(185,50,50,.18)"}
        : {background:"linear-gradient(135deg, rgba(235,242,241,.18), rgba(185,199,198,.11) 54%, rgba(78,205,196,.025))", border:"1px solid rgba(235,242,241,.22)"};
  const heroColor = hero.tone === "winner" ? C.greenText : hero.tone === "missed" ? C.redText : hero.tone === "neutral" ? "#D7E2E1" : "var(--text)";
  const heroLabelGradients = {
    neutral: "linear-gradient(135deg, #FFFFFF, #D7E2E1 55%, #9DB4B3)",
    perfect: "linear-gradient(135deg, #FFFFFF, #DDFDE9 42%, #63D989)",
    winner: "linear-gradient(135deg, #DDFDE9, #39A85A 54%, #1E7C3D)",
    missed: "linear-gradient(135deg, #FFD8D8, #E65A5A 50%, #A92F2F)"
  };
  const heroPillStyle = {
    alignSelf:"center",
    display:"inline-block",
    fontFamily:"'Outfit', sans-serif",
    fontSize:11,
    lineHeight:1.05,
    fontWeight:900,
    letterSpacing:".06em",
    textTransform:"uppercase",
    background:heroLabelGradients[hero.tone] || heroLabelGradients.neutral,
    WebkitBackgroundClip:"text",
    backgroundClip:"text",
    color:"transparent"
  };
  const isStreakLine = text => /\bconsistent months in a row\b/.test(String(text || ""));
  const renderHeroLine = () => {
    if (!hero.line) return null;
    if (hero.tone === "winner") {
      return React.createElement('div',{style:{fontSize:13,color:"var(--muted)",fontWeight:500,lineHeight:1.35}},
        React.createElement('span',{style:{fontWeight:800,color:"var(--muted)"}},hero.topLine),
        " ",
        hero.line,
        " ",
        hero.keepLine
      );
    }
    if (isStreakLine(hero.line)) {
      const [first, ...rest] = String(hero.line).split(". ");
      return React.createElement('div',{style:{fontSize:12,color:"var(--muted)",fontWeight:500,lineHeight:1.35,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},
        React.createElement('span',{style:{fontWeight:800}},first),
        rest.length ? `. ${rest.join(". ")}` : ""
      );
    }
    if (hero.tone === "perfect") {
      return React.createElement('div',{style:{fontSize:13,color:"var(--muted)",fontWeight:500,lineHeight:1.35}},
        React.createElement('span',{style:{fontWeight:800}},"Everyone"),
        ` hit the target this ${selectedMonthName}.`
      );
    }
    return React.createElement('div',{style:{fontSize:hero.tone==="neutral"||hero.tone==="missed"?12:13,color:"var(--muted)",fontWeight:500,lineHeight:1.35,whiteSpace:hero.tone==="neutral"||hero.tone==="missed"?"nowrap":"normal",overflow:"hidden",textOverflow:"ellipsis"}},hero.line);
  };

  const renderPerfectRoster = () => isBlocPerfect && React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(132px,1fr))",gap:7}},
    sortedActive.map(member => React.createElement('button',{key:member.name,type:"button",onClick:()=>onViewProfileMonth?.(member.name, month.key),style:{display:"flex",alignItems:"center",gap:7,background:"rgba(5,24,21,.68)",border:"1px solid rgba(78,205,196,.23)",borderRadius:8,padding:"6px 8px",minWidth:0,textAlign:"left",cursor:onViewProfileMonth?"pointer":"default",fontFamily:"'Outfit', sans-serif",color:"var(--text)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.05), 0 6px 14px rgba(0,0,0,.13)",backdropFilter:"blur(3px)"}},
      React.createElement(Avatar,{name:member.name,size:24}),
      React.createElement('div',{style:{minWidth:0,flex:1}},
        React.createElement('div',{style:{fontSize:11,fontWeight:800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},member.name),
        React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:8.5,fontWeight:600,color:"var(--muted)"}},`${member.count} workout${member.count===1?"":"s"}`)
      ),
      React.createElement('span',{style:{color:C.cyan,fontWeight:900,fontSize:12}},"✓")
    ))
  );

  // Resolve a member's payment handle by display name. Membership is the
  // authoritative display-name record, so go name -> userId -> profile rather
  // than matching on profile display names, which are not unique.
  const paymentTargetFor = displayName => {
    const name = String(displayName || "").trim();
    if (!name || !profiles) return null;
    const entry = Object.entries(group?.memberships || {})
      .find(([, membership]) => String(membership?.displayName || "").trim() === name);
    if (!entry) return null;
    return buildPaymentTargets(profiles[entry[0]]);
  };

  // Opening a payment link never changes settlement state. Fero does not know
  // whether the transfer happened; only the payer and receiver do.
  // One tappable app icon per method the receiver accepts, so the payer picks
  // whichever they can actually use. Opening a link never changes settlement
  // state: only the payer and receiver know whether money moved.
  const renderPayControl = (pair, key) => {
    const targets = paymentTargetFor(pair.receiverDisplayName) || [];
    if (!targets.length) return null;
    const tile = (target, index) => {
      const brand = target.brand || "#4ECDC4";
      const label = target.mode === "link"
        ? `Pay ${pair.receiverDisplayName} with ${target.label}`
        : `Copy ${pair.receiverDisplayName}'s ${target.label} details`;
      const style = {
        display:"inline-flex",alignItems:"center",justifyContent:"center",
        width:19,height:19,borderRadius:5,flexShrink:0,
        background:target.iconBg||brand,color:"#FFFFFF",
        border:"none",padding:0,cursor:"pointer",textDecoration:"none",
        boxShadow:"0 1px 4px rgba(0,0,0,.28)"
      };
      const glyph = React.createElement('span',{
        "aria-hidden":true,
        style:{display:"inline-flex",width:"58%",height:"58%",alignItems:"center",justifyContent:"center"},
        dangerouslySetInnerHTML:{__html:target.appIcon}
      });
      if (target.mode === "link") {
        return React.createElement('a',{
          key:`${key}:pay:${index}`, href:target.url, target:"_blank", rel:"noopener noreferrer",
          "aria-label":label, title:label, style
        }, glyph);
      }
      const copyKey = `${key}:${index}`;
      return React.createElement('button',{
        key:`${key}:pay:${index}`, type:"button", "aria-label":label,
        title: copiedKey === copyKey ? "Copied" : label,
        onClick:async()=>{
          try { await navigator.clipboard.writeText(target.copyText); setCopiedKey(copyKey); setTimeout(()=>setCopiedKey(null),1600); }
          catch { setCopiedKey(null); }
        },
        style:{...style, opacity: copiedKey === copyKey ? 0.55 : 1}
      }, glyph);
    };
    return React.createElement('span',{key:`${key}:pay`,style:{display:"inline-flex",alignItems:"center",gap:5}},
      targets.map(tile)
    );
  };

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

  // Signpost: payment setup lives on the account surface, but the moment you
  // realise you need it is here. Only shown to someone who owes and has not
  // set a handle.
  const renderPaymentSetupHint = () => {
    if (!onOpenAccount || outcome === "winner" || !outgoingRows.length) return null;
    const mine = currentUserId ? profiles?.[currentUserId] : null;
    if (buildPaymentTarget(mine)) return null;
    return React.createElement('button',{
      type:"button", onClick:onOpenAccount,
      style:{
        display:"block",margin:"6px auto 0",background:"transparent",border:"none",
        color:"rgba(78,205,196,.7)",fontSize:9,fontWeight:700,cursor:"pointer",
        textDecoration:"underline",textUnderlineOffset:"2px",
        fontFamily:"'Outfit', sans-serif"
      }
    },"Set up how people pay you");
  };

  const renderLedger = () => {
    if (isBlocPerfect && soloNames.length === 0) return null;
    if (!incomingRows.length && !outgoingRows.length && soloNames.length === 0) return null;

    const rows = outcome === "winner" ? incomingRows : outgoingRows;
    const title = outcome === "winner" ? `${rows.length} to pay:` : "You owe:";
    const totalColor = outcome === "winner" ? C.greenText : C.redText;

    return React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:outcome==="winner"?2:4,width:"100%",maxWidth:outcome==="winner"?190:280,margin:"0 auto"}},
      rows.length > 0 && React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"center",gap:10,textAlign:"center"}},
        React.createElement('div',{style:{...C.sectionLabel,fontSize:8,letterSpacing:".04em"}},title)
      ),
      rows.map((pair, index) => {
        const {state} = statusForPair(pair);
        const key = `${month.key}:${pair.payerDisplayName}:${pair.receiverDisplayName}`;
        const action = outcome === "winner"
          ? state.pending && state.isReceiver && React.createElement('button',{
              type:"button",
              onClick:()=>requestSettlementAction({key,kind:"confirm",payerDisplayName:pair.payerDisplayName,receiverDisplayName:pair.receiverDisplayName,amount:pair.amount}),
              disabled:settlementBusy===key,
              style:{fontSize:11,fontWeight:800,padding:"6px 10px",borderRadius:8,background:"transparent",border:"1px solid var(--amber)",color:"var(--amber)"}
            }, settlementBusy===key ? "Saving..." : "Confirm received")
          : !state.confirmed && !state.pending && React.createElement('button',{
              type:"button",
              onClick:()=>requestSettlementAction({key,kind:"claim",payerDisplayName:pair.payerDisplayName,receiverDisplayName:pair.receiverDisplayName,amount:pair.amount}),
              disabled:settlementBusy===key,
              style:{display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,lineHeight:1,padding:"4px 6px",borderRadius:999,background:"rgba(224,80,32,.035)",border:"1px solid rgba(224,80,32,.12)",color:"rgba(240,109,67,.68)",whiteSpace:"nowrap",fontFamily:"'Outfit', sans-serif"}
            }, settlementBusy===key ? "Saving..." : "Mark as paid");
        const payControl = outcome !== "winner" && !state.confirmed && !state.pending
          ? renderPayControl(pair, key)
          : null;
        return outcome==="winner"
          ? React.createElement(React.Fragment,{key:key},
              index>0&&React.createElement('div',{style:{height:1,width:"34%",margin:"2px auto",background:"linear-gradient(90deg, transparent, rgba(255,255,255,.12), transparent)"}}),
              React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"center",gap:7,minHeight:22,textAlign:"center",padding:"2px 0"}},
                React.createElement('div',{style:{fontSize:12,fontWeight:800,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",minWidth:0}},pair.payerDisplayName),
                React.createElement('div',{style:{fontSize:12,fontWeight:900,color:totalColor,whiteSpace:"nowrap"}},`+${fmtCurrency(pair.amount, currency)}`)
              )
            )
          : React.createElement(React.Fragment,{key:key},
              index>0&&React.createElement('div',{style:{height:1,width:"34%",margin:"2px auto",background:"linear-gradient(90deg, transparent, rgba(255,255,255,.12), transparent)"}}),
              React.createElement('div',{style:{minHeight:26,display:"grid",gridTemplateColumns:action?"58px minmax(0,1fr) 58px":"1fr",alignItems:"center",padding:"2px 0",textAlign:"center"}},
                action && React.createElement('div',null),
                React.createElement('div',{style:{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,minWidth:0,maxWidth:"100%"}},
                  React.createElement('div',{style:{fontSize:12,fontWeight:800,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",minWidth:0,maxWidth:120}},pair.receiverDisplayName),
                  React.createElement('div',{style:{fontSize:12,fontWeight:900,color:totalColor,whiteSpace:"nowrap"}},`-${fmtCurrency(pair.amount, currency)}`)
                ),
                action && React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"flex-end"}},action)
              ),
              payControl && React.createElement('div',{style:{display:"flex",justifyContent:"center",paddingBottom:3}},payControl)
            );
      }),
      renderPaymentSetupHint(),
      soloNames.length > 0 && React.createElement('div',{style:{display:"grid",gap:3,marginTop:rows.length?7:0,paddingTop:rows.length?7:0,borderTop:rows.length?"1px solid rgba(78,205,196,.12)":"none"}},
        soloNames.map(name => React.createElement('div',{key:`solo-${name}`,style:{fontSize:10,color:"var(--muted)",fontWeight:700,textAlign:"center",lineHeight:1.35}},
          `${name} — not in stakes this month.`
        ))
      )
    );
  };

  const mvpCount = sortedActive[0]?.count || 0;
  const mvpNames = sortedActive.filter(member => member.count === mvpCount && mvpCount > 0).map(member => member.name);
  const behindRows = activeCounts.map(member => ({...member, miss: Math.max(0, member.target - member.count)})).sort((a,b) => b.miss - a.miss || a.name.localeCompare(b.name));
  const furthestBehind = behindRows[0]?.miss > 0 ? behindRows[0] : null;
  // Most Diverse: how many different kinds of training someone did, not how
  // much. Replaces "Most Consistent", which was never computed — it simply
  // named whoever came second on workout count, which is why it always went
  // to the same person.
  const mostDiverse = (() => {
    const scored = activeCounts.map(member => {
      const types = new Set(
        getCountedLogs(month.logsByUser?.[member.name] || [])
          .map(log => String(log?.type || "").trim())
          .filter(Boolean)
      );
      return { name: member.name, variety: types.size, count: member.count };
    }).filter(member => member.variety > 1);
    // A single type is not variety, so nobody wins by default. Ties break on
    // total workouts, then name, so the result is stable between renders.
    return scored.sort((a, b) => b.variety - a.variety || b.count - a.count || a.name.localeCompare(b.name))[0] || null;
  })();

  // Biggest Turnaround: the largest improvement on the member's own previous
  // month. Also previously uncomputed — it named whoever came third.
  const biggestTurnaround = (() => {
    const ordered = [...(monthHistory || [])]
      .filter(m => m?.key)
      .sort((a, b) => monthOrder(a.key) - monthOrder(b.key));
    const index = ordered.findIndex(m => m.key === month.key);
    const previous = index > 0 ? ordered[index - 1] : null;
    if (!previous) return null;
    const gains = activeCounts
      .map(member => {
        // Only members present and counted last month can have improved on it.
        if (previous.excused?.[member.name]) return null;
        const before = Number(previous.counts?.[member.name] ?? NaN);
        if (!Number.isFinite(before)) return null;
        return { name: member.name, gain: member.count - before, before, after: member.count };
      })
      .filter(entry => entry && entry.gain > 0);
    return gains.sort((a, b) => b.gain - a.gain || a.name.localeCompare(b.name))[0] || null;
  })();

  const awardCards = [
    {title:"Bloc Champ", name:mvpNames.length ? mvpNames.join(" & ") : "No winner", detail:mvpNames.length ? workoutsLabel(mvpCount) : "No workouts", tone:"gold", gradient:"linear-gradient(135deg, rgba(245,166,35,.13), rgba(255,224,132,.048))"},
    {title:"Most Diverse", name:mostDiverse ? mostDiverse.name : "No one", detail:mostDiverse ? `${mostDiverse.variety} kinds of training` : "One kind of training", tone:"violet", gradient:"linear-gradient(135deg, rgba(135,113,255,.13), rgba(78,112,205,.056))"},
    {title:"Biggest Turnaround", name:biggestTurnaround ? biggestTurnaround.name : "No one", detail:biggestTurnaround ? `${biggestTurnaround.before} to ${biggestTurnaround.after} workouts` : "No previous month", tone:"cyan", gradient:"linear-gradient(135deg, rgba(78,205,196,.115), rgba(71,118,230,.048))"},
    {title:"Furthest Behind", name:furthestBehind ? furthestBehind.name : "No one", detail:furthestBehind ? `${furthestBehind.miss} short of target` : "Everyone hit target", tone:furthestBehind ? "red" : "silver", gradient:"linear-gradient(135deg, rgba(185,50,50,.115), rgba(245,166,35,.045))"}
  ];

  const renderAwards = () => React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(138px,1fr))",gap:7}},
    awardCards.map(award => React.createElement('div',{key:award.title,style:{...C.card,background:award.gradient,padding:"10px 10px 9px",minHeight:72}},
      React.createElement('div',{style:{display:"flex",alignItems:"center",gap:6,marginBottom:6}},
        award.tone==="gold" && React.createElement(TrophyIcon,{size:13,color:C.gold}),
        React.createElement('div',{style:{...C.sectionLabel,fontSize:9,letterSpacing:".06em"}},award.title)
      ),
      React.createElement('div',{style:{fontSize:14,fontWeight:900,color:award.tone==="red"?C.redText:"var(--text)",lineHeight:1.18,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},award.name),
      React.createElement('div',{style:{fontSize:11,color:"var(--muted)",marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},award.detail)
    ))
  );
  const sectionSeparator = React.createElement('div',{style:{height:1,width:"100%",background:"linear-gradient(90deg, transparent, rgba(78,205,196,.2), rgba(255,255,255,.12), rgba(78,205,196,.2), transparent)",margin:"2px 0"}});

  const renderLeaderboard = () => React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:6,padding:"7px",background:"rgba(8,15,15,.32)",borderTop:"1px solid rgba(255,255,255,.05)"}},
    sortedActive.map((row, i) => {
      const isMe = row.name === currentUser;
      const isWinner = winners.some(w => w.name === row.name);
      const isLoser = losers.some(l => l.name === row.name);
      const moneyTint = isWinner && losers.length > 0 ? "rgba(57,168,90,.075)" : isLoser ? "rgba(185,50,50,.08)" : null;
      return React.createElement('div',{key:row.name,style:{display:"flex",alignItems:"center",gap:9,padding:"9px 10px",border:"1px solid rgba(255,255,255,.055)",borderRadius:8,background:moneyTint || (isMe?"rgba(78,205,196,.06)":"rgba(255,255,255,.018)")}},
        React.createElement('div',{className:"mono",style:{fontSize:10,color:"var(--muted)",width:18,textAlign:"right",flexShrink:0}},i+1),
        React.createElement(Avatar,{name:row.name,size:26}),
        React.createElement('div',{style:{flex:1,minWidth:0}},
          React.createElement('div',{style:{fontSize:13,fontWeight:isMe?900:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},row.name + (isMe ? " (you)" : "")),
          React.createElement('div',{style:{fontSize:10,color:"var(--muted)",marginTop:1}},workoutsLabel(row.count))
        ),
        isWinner && losers.length > 0
          ? React.createElement('span',{style:{fontSize:12,fontWeight:900,color:C.greenText}},`+${fmtCurrency(perWinner,currency)}`)
          : isLoser
            ? React.createElement('span',{style:{fontSize:12,fontWeight:900,color:C.redText}},`-${fmtCurrency(getLoserAmount(penalties,row.name),currency)}`)
            : React.createElement('span',{style:{...C.pill,background:"rgba(78,205,196,.075)",color:"#8EE7DF",fontSize:9,padding:"2px 8px"}},"Target hit")
      );
    })
  );

  // Sticker data for the signed-in member's month. getCountedLogs is the same rule the
  // rest of the app counts by — it drops rejected logs — so the number on the sticker can
  // never disagree with the number on this screen.
  const stickerData = React.useMemo(() => {
    const counted = getCountedLogs(month.logsByUser?.[currentUser] || []);
    if (!counted.length) return null;
    const parts = getMonthPartsFromKey(month.key);
    const year = parts?.year ?? month.year;
    const monthIndex = parts?.monthIndex ?? month.month;
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return null;
    return buildStickerData(counted, year, monthIndex);
  }, [month.logsByUser, month.key, month.year, month.month, currentUser]);

  const stickerMonthLabel = `${selectedMonthName} ${stickerData?.year ?? ""}`.trim();

  // The report's own calendar, from the same counted logs the sticker draws,
  // so the share button sits beside a preview of what it shares rather than
  // asking someone to share something unseen.
  const reportCalendar = React.useMemo(() => {
    if (!stickerData) return null;
    const logsByDay = {};
    for (const log of getCountedLogs(month.logsByUser?.[currentUser] || [])) {
      const day = Number(String(log?.date || "").split("-")[2]);
      if (!Number.isFinite(day)) continue;
      logsByDay[day] = [...(logsByDay[day] || []), log];
    }
    const year = stickerData.year;
    const monthIndex = stickerData.monthIndex;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    // Monday-first grid, matching the calendar elsewhere in the app.
    const firstWeekdayOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
    return { logsByDay, year, monthIndex, daysInMonth, firstWeekdayOffset };
  }, [stickerData, month.logsByUser, currentUser]);


  const handleShare = () => {
    onTrackUsage?.("share_month_clicked");
    // Preserved from the text-only share this replaced: a missed month sends you to the
    // ledger instead, because what you need then is what you owe, not a trophy.
    if (outcome === "missed") {
      ledgerRef.current?.scrollIntoView({behavior:"smooth", block:"center"});
      return;
    }
    setShowSticker(true);
  };

  const heroStatSize = String(hero.stat).includes("workouts")
    ? "clamp(31px, 8vw, 42px)"
    : "clamp(36px, 10vw, 52px)";

  const claimConfirmation = claimPrompt && React.createElement('div',{className:"overlay center-mobile",onClick:()=>setClaimPrompt(null)},
    React.createElement('div',{className:"modal pi",onClick:e=>e.stopPropagation(),style:{maxWidth:320,padding:"18px 16px",textAlign:"center"}},
      React.createElement('div',{style:{fontSize:18,fontWeight:800,color:"var(--text)",marginBottom:8}},"Mark as paid?"),
      React.createElement('div',{style:{fontSize:12,color:"var(--muted)",lineHeight:1.45,fontFamily:"'Outfit', sans-serif",fontWeight:600}},"This tells the receiver you paid them."),
      React.createElement('div',{style:{display:"flex",gap:10,marginTop:16}},
        React.createElement('button',{type:"button",onClick:()=>setClaimPrompt(null),style:{flex:1,padding:"10px 12px",borderRadius:12,border:"1px solid var(--border)",background:"var(--s2)",color:"var(--muted)",fontWeight:700}},"Cancel"),
        React.createElement('button',{type:"button",onClick:async()=>{const payload = claimPrompt; setClaimPrompt(null); await handleSettlementAction(payload);},style:{flex:1,padding:"10px 12px",borderRadius:12,border:"1px solid rgba(224,80,32,.34)",background:"rgba(224,80,32,.10)",color:"#F06D43",fontWeight:800}},"Mark Paid")
      )
    )
  );

  return React.createElement(React.Fragment,null,
    React.createElement('div',{style:{width:"100%",maxWidth:"100%",margin:"0 auto",padding:"0 0 32px",display:"flex",flexDirection:"column",gap:12,fontFamily:"'Outfit', sans-serif"}},
    React.createElement('div',{style:{...heroStyle,borderRadius:12,padding:"18px 18px 16px",textAlign:"center",display:"flex",flexDirection:"column",gap:10}},
      React.createElement('span',{style:heroPillStyle},hero.tag),
      React.createElement('div',{style:{fontSize:heroStatSize,fontWeight:900,lineHeight:1.05,color:heroColor,letterSpacing:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},hero.stat),
      renderHeroLine(),
      renderPerfectRoster(),
      hero.footerLine&&React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:2,fontSize:13,color:"var(--muted)",fontWeight:500,lineHeight:1.32}},
        (Array.isArray(hero.footerLine) ? hero.footerLine : [hero.footerLine]).map((line, index) =>
          line && typeof line === "object"
            ? React.createElement('div',{key:`footer-${index}`,style:{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},
                React.createElement('span',{style:{fontWeight:800}},line.emphasis),
                React.createElement('span',{style:{fontWeight:500}},line.rest)
              )
            : React.createElement('div',{key:line,style:{fontWeight:isStreakLine(line)?800:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},line)
        )
      )
    ),
    React.createElement('div',{ref:ledgerRef},renderLedger()),
    sectionSeparator,
    renderAwards(),
    sectionSeparator,
    reportCalendar ? React.createElement(MonthCalendarCard,{
      title:`${stickerMonthLabel} · Your month`,
      logsByDay:reportCalendar.logsByDay,
      year:reportCalendar.year,
      monthIndex:reportCalendar.monthIndex,
      daysInMonth:reportCalendar.daysInMonth,
      firstWeekdayOffset:reportCalendar.firstWeekdayOffset,
      onShare:handleShare
    }) : null,
      showStandings&&renderLeaderboard()
    ),
    React.createElement('div',{style:{border:"1px solid rgba(78,205,196,.15)",borderRadius:10,overflow:"hidden",background:"linear-gradient(135deg, rgba(78,205,196,.045), rgba(8,15,15,.78) 52%, rgba(255,255,255,.018))",boxShadow:"inset 0 1px 0 rgba(255,255,255,.03), 0 10px 26px rgba(78,205,196,.035)"}},
      React.createElement('button',{type:"button",onClick:()=>{onTrackUsage?.("monthly_summary_card_clicked");setShowStandings(v=>!v)},style:{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 15px",background:"transparent",border:"none",color:"var(--text)",fontSize:13,fontWeight:800,cursor:"pointer"}},
        React.createElement('span',null,"Month Summary"),
        React.createElement('span',{style:{color:"var(--muted)",fontSize:16}},showStandings?"−":"+")
      ),
    React.createElement('div',{style:{display:"flex",gap:8,paddingTop:2}},
      React.createElement('button',{onClick:handleShare,disabled:outcome!=="missed"&&!stickerData,style:{flex:1,padding:"13px",borderRadius:10,background:"var(--s2)",border:"1px solid var(--border)",color:"var(--text)",fontSize:13,fontWeight:800,opacity:(outcome!=="missed"&&!stickerData)?.5:1}},
        outcome === "missed" ? "View the settlement" : "Share this month"
      )
    )
    ),
    claimConfirmation,
    showSticker && stickerData && React.createElement(ShareSticker,{
      data: stickerData,
      monthLabel: stickerMonthLabel,
      onClose: () => setShowSticker(false)
    })
  );
};

export { SettlementScreen };
