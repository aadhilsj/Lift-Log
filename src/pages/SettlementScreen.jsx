import React from "react";
const { useState, useEffect, useMemo, useCallback, useRef } = React;
import {
  MIN_TARGET,
  CUR_MONTH,
  DAY_OF_MON,
  MONTH_NAMES,
  avatarColor,
  calcPenalties,
  getLoserAmount,
  buildSettlementPairState,
  fmtCurrency,
  getUserMASStreak,
  getUserWinsThisYear,
  ordinal
} from "../lib/appState.js";
import { WorkoutTypeIcon, TrophyIcon } from "../components/primitives.jsx";

const SettlementScreen = ({group, month, currentUser, currentUserId, monthHistory, onSettlementClaimPaid, onSettlementConfirmPaid, onStartNextMonth}) => {
  const [activeTab, setActiveTab] = React.useState("leaderboard");
  const [settlementBusy, setSettlementBusy] = React.useState(null);

  // ── Derive core data ────────────────────────────────────────────────────────
  const relevantNames = Object.keys(month.counts || {});
  const activeCounts = relevantNames
    .filter(name => !month.excused?.[name])
    .map(name => ({name, count: Number(month.counts[name] || 0), target: month.memberTargets?.[name] || month.settings?.minTarget || MIN_TARGET}));
  const penalties = calcPenalties(activeCounts, month.settings);
  const {winners, losers, perWinner} = penalties;
  const isPerfectMonth = losers.length === 0;
  const hasWinnerPayout = losers.length > 0 && perWinner > 0;

  const userCount = month.counts?.[currentUser] || 0;
  const userIsWinner = winners.some(w => w.name === currentUser);
  const userIsLoser  = losers.some(l => l.name === currentUser);
  const outcome = userIsWinner ? "winner" : userIsLoser ? "missed" : "hit_mas";

  const sortedActive = [...activeCounts].sort((a,b) => b.count - a.count);
  const userRank = sortedActive.findIndex(m => m.name === currentUser) + 1 || 1;

  const streak       = getUserMASStreak(monthHistory, currentUser);
  const winsThisYear = getUserWinsThisYear(monthHistory, currentUser, month.year);
  const workoutLogsByDay = Object.fromEntries(((month.logsByUser?.[currentUser]) || []).map(log => [Number(String(log.date || "").split("-")[2]), log]));

  const currency = month.settings?.currency || "USD";
  const mas      = month.memberTargets?.[currentUser] || month.settings?.minTarget || MIN_TARGET;

  // Calendar — month.month is 0-indexed (matches JS Date)
  const daysInMonth  = new Date(month.year, month.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(month.year, month.month, 1).getDay();
  const calOffset    = (firstDayOfWeek + 6) % 7; // Monday-first

  // Leaderboard rows
  const leaderboard = sortedActive.map((m, i) => {
    const isWin  = winners.some(w => w.name === m.name);
    const isLose = losers.some(l => l.name === m.name);
    return {name: m.name, workouts: m.count, outcome: isWin ? "winner" : isLose ? "missed" : "hit_mas", amount: isWin ? perWinner : isLose ? getLoserAmount(penalties, m.name) : 0, rank: i + 1};
  });

  const winnerNames = winners.map(w => w.name);
  const winnerNamesText = winnerNames.length <= 2
    ? winnerNames.join(" and ")
    : `${winnerNames.slice(0, -1).join(", ")}, and ${winnerNames[winnerNames.length - 1]}`;
  const streakSupportCopy = streak >= 2
    ? `${streak} perfect months in a row. Keep the streak alive.`
    : "Build on it next month.";

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
      if (!result?.ok) {
        window.alert(result?.error || "Unable to update settlement");
      }
    } finally {
      setSettlementBusy(null);
    }
  };

  // ── Design tokens for this screen ──────────────────────────────────────────
  const C = {
    greenText: "#2a7a3b", greenBg: "#e6f4ea",
    redText:   "#b93232", redBg:   "#fdecea",
    neutralText: "var(--muted)", neutralBg: "var(--s2)",
    pill: {padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:600, display:"inline-block"},
    card: {background:"var(--s1)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden"},
    sectionLabel: {fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:".12em", color:"var(--muted)", fontFamily:"'JetBrains Mono',monospace"},
    stat: {background:"var(--s1)", border:"1px solid var(--border)", borderRadius:12, padding:"14px 12px", textAlign:"center"},
  };

  const outcomeColor = outcome === "winner" ? C.greenText : outcome === "missed" ? C.redText : "var(--text)";

  // ── Sub-renders ─────────────────────────────────────────────────────────────

  const renderHero = () => {
    if (outcome === "winner") {
      if (hasWinnerPayout) {
        return React.createElement('div',{style:{textAlign:"center", padding:"28px 0 20px"}},
          React.createElement('span',{style:{...C.pill, background:C.greenBg, color:C.greenText, marginBottom:14, display:"inline-flex",alignItems:"center",gap:6}},
            React.createElement(TrophyIcon,{size:14,color:"#F5A623"}),
            React.createElement('span',null,"Winner · 1st place")
          ),
          React.createElement('div',{style:{fontSize:48, fontWeight:700, color:C.greenText, lineHeight:1.1, marginBottom:8}},
            `+${fmtCurrency(perWinner, currency)}`
          ),
          React.createElement('div',{style:{fontSize:22, fontWeight:600, marginBottom:6}},
            `${losers.length} are paying this month.`
          ),
          React.createElement('div',{style:{fontSize:14, color:"var(--muted)"}},
            `${userCount} workouts. Top of the bloc.`
          )
        );
      }
      return React.createElement('div',{style:{textAlign:"center", padding:"28px 0 20px"}},
        React.createElement('span',{style:{...C.pill, background:C.greenBg, color:C.greenText, marginBottom:14, display:"inline-flex",alignItems:"center",gap:6}},
          React.createElement(TrophyIcon,{size:14,color:"#F5A623"}),
          React.createElement('span',null,"Winner · 1st place")
        ),
        React.createElement('div',{style:{fontSize:26, fontWeight:700, marginBottom:6}},
          "You topped the bloc."
        ),
        React.createElement('div',{style:{fontSize:14, color:"var(--muted)", marginBottom:6}},
          `${userCount} workouts. First place finish.`
        ),
        React.createElement('div',{style:{fontSize:14, color:C.greenText}},
          "Perfect month for the bloc. Everyone hit their MAS."
        )
      );
    }

    if (outcome === "missed") return React.createElement('div',{style:{textAlign:"center", padding:"28px 0 20px"}},
      React.createElement('span',{style:{...C.pill, background:C.redBg, color:C.redText, marginBottom:14, display:"inline-block"}}, `Missed MAS · ${ordinal(userRank)} place`),
      React.createElement('div',{style:{fontSize:48, fontWeight:700, color:C.redText, lineHeight:1.1, marginBottom:8}},
        `-${fmtCurrency(getLoserAmount(penalties, currentUser), currency)}`
      ),
      React.createElement('div',{style:{fontSize:22, fontWeight:600, marginBottom:6}},
        `${userCount} workouts. You needed ${mas}.`
      ),
      React.createElement('div',{style:{fontSize:14, color:"var(--muted)"}},
        winnerNames.length ? `You owe ${winnerNamesText} for this month.` : "You missed the target this month."
      )
    );

    // hit_mas
    return React.createElement('div',{style:{textAlign:"center", padding:"28px 0 20px"}},
      React.createElement('span',{style:{...C.pill, background:C.neutralBg, color:C.neutralText, marginBottom:14, display:"inline-block"}},`MAS hit · ${ordinal(userRank)} place`),
      React.createElement('div',{style:{fontSize:26, fontWeight:700, marginBottom:6}},
        React.createElement('span',{style:{display:"inline-block",fontSize:"clamp(22px, 5vw, 26px)",whiteSpace:"nowrap",maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis"}},
          `Solid month. ${userCount} workouts done.`
        )
      ),
      React.createElement('div',{style:{fontSize:14, fontWeight:500, color:isPerfectMonth ? "var(--muted)" : "#4ECDC4"}},
        streakSupportCopy
      ),
      isPerfectMonth && React.createElement('div',{style:{fontSize:14, color:C.greenText, marginTop:6}},
        "Bloc went perfect. Everyone hit their MAS."
      )
    );
  };

  const renderStats = () => {
    let items;
    if (outcome === "winner" && hasWinnerPayout) {
      items = [
        {label:"Workouts", value: userCount, color:"var(--text)"},
        {label:"You collect", value: `+${fmtCurrency(perWinner, currency)}`, color: C.greenText},
        {label:"Wins this year", value: winsThisYear, color: C.greenText},
      ];
    } else if (outcome === "winner") {
      items = [
        {label:"Workouts", value: userCount, color:"var(--text)"},
        {label:"Month streak", value: streak, color: streak >= 2 ? C.greenText : "var(--text)"},
        {label:"Wins this year", value: winsThisYear, color: C.greenText},
      ];
    } else if (outcome === "missed") {
      items = [
        {label:"Workouts", value: userCount, color:"var(--text)"},
        {label:"Short of MAS", value: `−${mas - userCount}`, color: C.redText},
        {label:"You owe", value: fmtCurrency(getLoserAmount(penalties, currentUser), currency), color: C.redText},
      ];
    } else {
      items = [
        {label:"Workouts", value: userCount, color:"var(--text)"},
        {label:"Month streak", value: streak, color: streak >= 2 ? C.greenText : "var(--text)"},
        {label:"Rank", value: ordinal(userRank), color:"var(--text)"},
      ];
    }
    return React.createElement('div',{style:{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8}},
      items.map(item => React.createElement('div',{key:item.label, style:C.stat},
        React.createElement('div',{style:{...C.sectionLabel, marginBottom:8}},item.label),
        React.createElement('div',{style:{fontSize:20, fontWeight:700, color:item.color, lineHeight:1}},item.value)
      ))
    );
  };

  const renderCalendar = () => {
    const days = ["M","T","W","T","F","S","S"];
    const cells = [...Array(calOffset).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];
    return React.createElement('div',{style:{...C.card}},
      React.createElement('div',{style:{padding:"14px 14px 4px"}},
        React.createElement('div',{style:{...C.sectionLabel, marginBottom:10}},`${month.label} · Your workouts`)
      ),
      React.createElement('div',{style:{padding:"0 14px 14px"}},
        React.createElement('div',{style:{display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:4}},
          days.map((d,i) => React.createElement('div',{key:i, style:{textAlign:"center", ...C.sectionLabel, letterSpacing:0, padding:"2px 0"}},d))
        ),
        React.createElement('div',{style:{display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3}},
          cells.map((day, i) => {
            if (!day) return React.createElement('div',{key:`e${i}`});
            const dayLog = workoutLogsByDay[day];
            const hasWorkout = !!dayLog;
            return React.createElement('div',{key:day, style:{
              aspectRatio:"1", display:"flex", alignItems:"center", justifyContent:"center",
              borderRadius:8, fontSize:hasWorkout?13:10, fontFamily:hasWorkout?"inherit":"'JetBrains Mono',monospace",
              background: hasWorkout ? "#1A2E4A" : "#0A1414",
              color: hasWorkout ? "#4ECDC4" : "var(--muted2)",
              fontWeight: hasWorkout ? 700 : 400,
            }},hasWorkout ? React.createElement(WorkoutTypeIcon,{type:dayLog.type,size:18}) : day);
          })
        )
      )
    );
  };

  const renderLeaderboard = () => React.createElement('div',{style:C.card},
    leaderboard.map((row, i) => {
      const isMe = row.name === currentUser;
      const initials = row.name.split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase();
      return React.createElement('div',{key:row.name, style:{
        display:"flex", alignItems:"center", gap:10, padding:"12px 14px",
        borderBottom: i < leaderboard.length - 1 ? "1px solid var(--border)" : "none",
        background: isMe ? "rgba(91,141,239,.06)" : "transparent",
      }},
        React.createElement('div',{style:{fontSize:11, color:"var(--muted)", width:20, textAlign:"right", flexShrink:0, fontFamily:"'JetBrains Mono',monospace"}},row.rank),
        React.createElement('div',{style:{width:32, height:32, borderRadius:999, background:avatarColor(row.name), color:"#FFFFFF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, flexShrink:0}},initials),
        React.createElement('div',{style:{flex:1, minWidth:0}},
          React.createElement('div',{style:{fontWeight: isMe ? 700 : 500, fontSize:14, color:"var(--text)"}}, row.name + (isMe ? " (you)" : "")),
          React.createElement('div',{style:{fontSize:11, color:"var(--muted)", marginTop:1}},`${row.workouts} workouts`)
        ),
        row.outcome === "winner" && losers.length > 0
          ? React.createElement('span',{style:{fontWeight:700, fontSize:14, color:C.greenText}}, `+${fmtCurrency(row.amount, currency)}`)
          : row.outcome === "missed"
            ? React.createElement('span',{style:{fontWeight:700, fontSize:14, color:C.redText}}, `-${fmtCurrency(row.amount, currency)}`)
            : React.createElement('span',{style:{...C.pill, background:C.neutralBg, color:C.neutralText, fontSize:10}}, "✓ safe")
      );
    })
  );

  const renderPaymentTab = () => {
    if (outcome === "hit_mas") {
      const oweText = losers.length
        ? `${losers.map(l=>l.name).join(" and ")} owe${losers.length === 1 ? "s" : ""} ${winnerNames.join(" & ")}.`
        : "No payments this month — everyone hit the MAS.";
      return React.createElement('div',{style:{...C.card, padding:"16px 14px"}},
        React.createElement('div',{style:{fontSize:14, fontWeight:600, marginBottom:8}}, "You're not involved."),
        React.createElement('div',{style:{fontSize:13, color:"var(--muted)", lineHeight:1.6, marginBottom:12}}, oweText + " Nothing to do on your end."),
        React.createElement('div',{style:{...C.sectionLabel}}, "Via Vipps, Revolut, or bank transfer")
      );
    }

    if (outcome === "winner") {
      const allSettled = losers.every(loser => {
        const state = buildSettlementPairState(group, month.key, loser.name, currentUser, currentUserId, currentUser);
        return state.confirmed;
      });
      return React.createElement('div',{style:{display:"flex", flexDirection:"column", gap:8}},
        losers.map(loser => {
          const amount = getLoserAmount(penalties, loser.name);
          const key = `${month.key}:${loser.name}:${currentUser}`;
          const state = buildSettlementPairState(group, month.key, loser.name, currentUser, currentUserId, currentUser);
          const statusText = state.confirmed
            ? `Settled ${String(state.confirmedAt || "").slice(0, 10)}`
            : state.pending
              ? "Pending confirmation"
              : "Outstanding";
          const statusColor = state.confirmed ? C.greenText : "var(--amber)";
          return React.createElement('div',{key:loser.name, style:{...C.card, padding:"12px 14px"}},
            React.createElement('div',{style:{display:"flex", alignItems:"center", justifyContent:"space-between", gap:10}},
              React.createElement('div',{style:{display:"flex", alignItems:"center", gap:10}},
                React.createElement('div',{style:{fontSize:13, fontWeight:600}}, loser.name),
                React.createElement('span',null,"→"),
                React.createElement('div',{style:{fontSize:13, fontWeight:600, color:C.greenText}}, "You")
              ),
              React.createElement('div',{style:{fontSize:14, fontWeight:700, color:C.greenText}}, `+${fmtCurrency(amount, currency)}`)
            ),
            React.createElement('div',{style:{marginTop:10, display:"flex", alignItems:"center", justifyContent:"space-between"}},
              React.createElement('span',{style:{...C.sectionLabel, color: statusColor}}, statusText),
              state.pending && state.isReceiver && React.createElement('button',{
                onClick:()=>handleSettlementAction({ key, kind:"confirm", payerDisplayName: loser.name, receiverDisplayName: currentUser, amount }),
                disabled:settlementBusy===key,
                style:{fontSize:11, fontWeight:700, padding:"5px 10px", borderRadius:8, background:"transparent", border:"1px solid var(--amber)", color:"var(--amber)"}
              }, settlementBusy===key ? "Saving..." : "Confirm")
            )
          );
        }),
        React.createElement('div',{style:{...C.card, padding:"12px 14px", display:"flex", justifyContent:"space-between", alignItems:"center"}},
          React.createElement('span',{style:C.sectionLabel}, "Total incoming"),
          React.createElement('span',{style:{fontWeight:700, fontSize:15, color:C.greenText}}, `+${fmtCurrency(perWinner, currency)}`)
        ),
        React.createElement('div',{style:{...C.sectionLabel, paddingTop:4}}, "Via Vipps, Revolut, or bank transfer"),
        allSettled && React.createElement('div',{style:{fontSize:12, color:C.greenText, fontFamily:"'JetBrains Mono',monospace"}}, "✓ All settled")
      );
    }

    // missed
    const amount = getLoserAmount(penalties, currentUser);
    const receiverDisplayName = winnerNames[0] || "Winner";
    const key = `${month.key}:${currentUser}:${receiverDisplayName}`;
    const state = buildSettlementPairState(group, month.key, currentUser, receiverDisplayName, currentUserId, currentUser);
    const statusText = state.confirmed
      ? `Settled ${String(state.confirmedAt || "").slice(0, 10)}`
      : state.pending
        ? "Pending confirmation"
        : "Outstanding";
    return React.createElement('div',{style:{display:"flex", flexDirection:"column", gap:8}},
      React.createElement('div',{style:{...C.card, padding:"12px 14px"}},
        React.createElement('div',{style:{display:"flex", alignItems:"center", justifyContent:"space-between", gap:10}},
          React.createElement('div',{style:{display:"flex", alignItems:"center", gap:10}},
            React.createElement('div',{style:{fontSize:13, fontWeight:600, color:C.redText}}, "You"),
            React.createElement('span',null,"→"),
            React.createElement('div',{style:{fontSize:13, fontWeight:600}}, winnerNames.join(" & ") || "Winner")
          ),
          React.createElement('div',{style:{fontSize:14, fontWeight:700, color:C.redText}}, `-${fmtCurrency(amount, currency)}`)
        )
      ),
      React.createElement('div',{style:{...C.card, padding:"12px 14px", display:"flex", justifyContent:"space-between", alignItems:"center"}},
        React.createElement('span',{style:{...C.sectionLabel, color: state.confirmed ? C.greenText : "var(--amber)"}}, statusText),
        React.createElement('span',{style:{fontWeight:700, fontSize:15, color:C.redText}}, `-${fmtCurrency(amount, currency)}`)
      ),
      !state.confirmed && React.createElement('div',{style:{display:"flex",justifyContent:"flex-end"}},
        React.createElement('button',{
          onClick:()=>handleSettlementAction({ key, kind:"claim", payerDisplayName: currentUser, receiverDisplayName, amount }),
          disabled:settlementBusy===key || state.pending || winnerNames.length !== 1,
          style:{
            background:state.pending || winnerNames.length !== 1 ? "var(--s3)" : "var(--red-dim)",
            border:`1px solid ${state.pending || winnerNames.length !== 1 ? "var(--border)" : "rgba(224,80,32,.35)"}`,
            color:state.pending ? "var(--muted)" : "#e05020",
            padding:"7px 10px",
            borderRadius:8,
            fontSize:11,
            fontWeight:800
          }
        }, settlementBusy===key ? "Saving..." : state.pending ? "Waiting for confirmation" : "Mark as paid")
      ),
      React.createElement('div',{style:{...C.sectionLabel, paddingTop:4}}, "Via Vipps, Revolut, or bank transfer")
    );
  };

  const paymentTabLabel = outcome === "winner" ? "Who pays you" : outcome === "missed" ? "What you owe" : "Settlement";

  const shareText = outcome === "winner"
    ? `Won ${month.label} with ${userCount} workouts. ${fmtCurrency(perWinner, currency)} incoming. #Ante`
    : outcome === "missed"
      ? `Taking the L this month — ${userCount}/${mas} workouts. Owe ${fmtCurrency(getLoserAmount(penalties, currentUser), currency)}. Back next month. #Ante`
      : `${streak >= 2 ? `${streak} months in a row ✅` : `Hit MAS — ${userCount} workouts in ${month.label}`} #Ante`;

  const handleShare = () => {
    if (navigator.share) navigator.share({text: shareText}).catch(()=>{});
    else navigator.clipboard?.writeText(shareText).then(()=>window.alert("Copied to clipboard!")).catch(()=>{});
  };

  const liveMonthName = MONTH_NAMES[CUR_MONTH];
  const ctaLabel = DAY_OF_MON <= 2 ? `Start ${liveMonthName} →` : `Go to ${liveMonthName} →`;

  // ── Main render ─────────────────────────────────────────────────────────────
  return React.createElement('div',{style:{maxWidth:440, margin:"0 auto", padding:"0 0 32px"}},
    React.createElement('div',{style:{...C.sectionLabel, textAlign:"center", paddingTop:4, marginBottom:0}},
      `${month.label.toUpperCase()} · FINAL RESULTS`
    ),
    renderHero(),
    React.createElement('div',{style:{display:"flex", flexDirection:"column", gap:10}},
      renderStats(),
      renderCalendar(),
      // Tabs
      React.createElement('div',{style:{display:"flex", gap:0, background:"var(--s2)", borderRadius:10, border:"1px solid var(--border)", overflow:"hidden"}},
        ["leaderboard", "payment"].map(tab =>
          React.createElement('button',{key:tab, onClick:()=>setActiveTab(tab), style:{
            flex:1, padding:"10px 8px", fontSize:12, fontWeight:700, border:"none",
            background: activeTab===tab ? "var(--s1)" : "transparent",
            color: activeTab===tab ? "var(--text)" : "var(--muted)",
            borderBottom: activeTab===tab ? "2px solid "+outcomeColor : "2px solid transparent",
          }}, tab === "leaderboard" ? "Leaderboard" : paymentTabLabel)
        )
      ),
      activeTab === "leaderboard" ? renderLeaderboard() : renderPaymentTab(),
      // Buttons
      React.createElement('div',{style:{display:"flex", gap:8, paddingTop:4}},
        React.createElement('button',{onClick:handleShare, style:{flex:1, padding:"13px", borderRadius:10, background:"var(--s2)", border:"1px solid var(--border)", color:"var(--text)", fontSize:13, fontWeight:700}},
          outcome==="winner" ? "Rub it in" : outcome==="missed" ? "Take the L publicly" : "Share your streak"
        ),
        onStartNextMonth && React.createElement('button',{onClick:onStartNextMonth, style:{flex:1, padding:"13px", borderRadius:10, background:"var(--green)", border:"none", color:"#000", fontSize:13, fontWeight:700}},
          ctaLabel
        )
      )
    )
  );
};

// ─── MONTH PAGE ───────────────────────────────────────────────────────────────

export { SettlementScreen };
