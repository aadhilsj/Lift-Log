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
  calcPenalties,
  addStandardSoloPenalties,
  isStandardPenaltySoloForMonth,
  getLoserAmount,
  getMemberTargetInfoForMonth,
  isSoloForMonth,
  isTrainingForMonth,
  getSoloTargetForMonth,
  fmtCurrency,
  getCountedLogCount,
  isJoinedForMonth,
  DAYS_IN_MON
} from "../lib/appState.js";
import { Avatar, PlayerProfileErrorBoundary } from "../components/primitives.jsx";
import {
  MonthDial, LoopReadout, LoopCaption, loopCaption, loopTotals, useTapOutside, LOOP_FONTS,
  perDayCounts, clearDayOf, bestWeekOf, personalBestOf, trackRecordOf, sameDayLastMonth,
  trackRecordParts, PanelCard, personalBestCard, smallUnit, monthName, shortMonthName,
  perfectMonthRun, PerfectRunPill
} from "../components/MonthLoop.jsx";
import { PlayerProfile } from "../pages/PlayerProfile.jsx";
import { SettlementScreen } from "../pages/SettlementScreen.jsx";

const FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const MonthPage = ({group,logs,excused,monthHistory,groupSettings,currentUser,currentUserId,initialSelIdx,onStartNextMonth,onSettlementClaimPaid,onSettlementConfirmPaid,onOpenToday,profiles,onOpenAccount,navResetToken,onTrackUsage,currentPaymentMethods,onSavePayment,savingPayment,paymentError}) => {
  const [selIdx,setSelIdx]=useState(initialSelIdx ?? null); // null = current month
  const [viewPlayer,setViewPlayer]=useState(null);
  const [focus,setFocus]=useState(null);
  const clearFocus=useCallback(()=>setFocus(null),[]);
  useTapOutside(!!focus, clearFocus);
  useEffect(()=>{ setViewPlayer(null); setFocus(null); },[navResetToken]);
  useEffect(()=>{ setFocus(null); },[selIdx]);
  useEffect(()=>{
    if(viewPlayer) window.scrollTo({top:0,left:0,behavior:"auto"});
  },[viewPlayer]);

  const histReversed=[...monthHistory].reverse();
  // A requested closed month can outlive the Bloc it was requested for: the
  // "results are in" banner sets the index app-wide, so opening a Bloc with
  // fewer (or zero) closed months would otherwise read past the end of the
  // list. Fall back to the current month instead of rendering a missing one.
  const selMonth=selIdx===null?null:histReversed[selIdx]||null;
  const isCurrent=!selMonth;

  const relevantNames = NAMES.filter(name => isJoinedForMonth(name, isCurrent ? curKey : selMonth.key));
  const counts=isCurrent
    ? relevantNames.map(n=>{
        const { target, joinDay=1, proratedDays, prorationSource } = getMemberTargetInfoForMonth(group, n, curKey);
        const count = getCountedLogCount(logs[n]||[]);
        const isOut = excused[n]?.[curKey]||false;
        const isSolo = isSoloForMonth(group, n, curKey);
        const soloTarget = getSoloTargetForMonth(group, n, curKey);
        const activeTarget = isSolo && soloTarget ? soloTarget : target;
        let memberDiffLabel = null;
        if (!isOut && proratedDays) {
          const daysActive = Math.max(0, DAY_OF_MON - joinDay + 1);
          const exp = Math.floor((activeTarget / proratedDays) * daysActive);
          const d = count - exp;
          memberDiffLabel = d > 0 ? `+${d} ahead of pace` : d < 0 ? `${d} behind pace` : "on pace";
        }
        const isTraining = isTrainingForMonth(group, n, curKey);
        // Match Today's label exactly: joining during the month alone does not
        // make someone prorated. Their own target must actually be lower.
        const prorated = !isSolo && Number(target) < Number(MIN_TARGET) && prorationSource === "member";
        return { name:n, count, isOut, isSolo, isTraining, target:activeTarget, soloTarget, memberDiffLabel, joinDay, proratedDays, prorated };
      })
    : relevantNames.map(n=>({name:n,count:selMonth.counts[n]||0,isOut:selMonth.excused?.[n]||false,isSolo:isSoloForMonth(selMonth,n,selMonth.key),isTraining:isTrainingForMonth(selMonth,n,selMonth.key),soloTarget:getSoloTargetForMonth(selMonth,n,selMonth.key),target:getSoloTargetForMonth(selMonth,n,selMonth.key) || selMonth.memberTargets?.[n] || selMonth.settings?.minTarget || MIN_TARGET}));

  const activeCounts=counts.filter(u=>!u.isOut&&!u.isSolo&&!u.isTraining);
  const monthSettings = isCurrent ? groupSettings || {} : selMonth?.settings || {};
  const soloMisses = counts.filter(u=>u.isSolo&&!u.isOut&&!u.isTraining&&u.soloTarget&&u.count<u.soloTarget&&isStandardPenaltySoloForMonth(isCurrent?group:selMonth,u.name,isCurrent?curKey:selMonth.key));
  const penalties = addStandardSoloPenalties(calcPenalties(activeCounts, monthSettings), soloMisses, monthSettings);
  const {winners,losers,perWinner}=penalties;
  const resultsCurrency = (isCurrent ? groupSettings : selMonth?.settings)?.currency || DEFAULT_CURRENCY;
  const hasQualifiedWinner = winners.some(w => (w.count || 0) >= (w.target || MIN_TARGET));
  const wouldMoveMoney = hasQualifiedWinner && losers.length > 0 && perWinner > 0;
  const expandMonthLabel = label => String(label || "").replace(/^([A-Z][a-z]{2})\s+'(\d{2})$/, (_, shortName, year) => `${FULL_MONTH_NAMES[MONTH_NAMES.indexOf(shortName)] || shortName} '${year}`);
  // One tap per month: the left arrow goes back a month, the right arrow forward.
  // histReversed is newest first, so "older" means a bigger index.
  const olderIdx = isCurrent ? (histReversed.length ? 0 : null) : (selIdx + 1 < histReversed.length ? selIdx + 1 : null);
  const newerIdx = isCurrent ? undefined : (selIdx === 0 ? null : selIdx - 1);
  const stepperArrow = (dir, enabled, onClick) => React.createElement('button',{
    type:"button", onClick: enabled ? onClick : undefined, disabled: !enabled,
    "aria-label": dir === "prev" ? "Previous month" : "Next month",
    style:{width:28,height:26,display:"inline-flex",alignItems:"center",justifyContent:"center",background:"transparent",border:"none",padding:0,cursor:enabled?"pointer":"default",color:"#4ECDC4",opacity:enabled?1:.25}
  },
    React.createElement('svg',{width:7,height:11,viewBox:"0 0 7 11","aria-hidden":true},
      React.createElement('path',{d:dir === "prev" ? "M5.6 1.2L1.6 5.5l4 4.3" : "M1.4 1.2l4 4.3-4 4.3",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round",strokeLinejoin:"round"})
    )
  );
  const monthStepper = right => React.createElement('div',{style:{position:"relative",display:"flex",justifyContent:"center",alignItems:"center"}},
    React.createElement('div',{style:{display:"inline-flex",alignItems:"center",border:"0.5px solid rgba(78,205,196,.22)",background:"rgba(8,15,15,.48)",borderRadius:999,height:28}},
      stepperArrow("prev", olderIdx !== null, () => setSelIdx(olderIdx)),
      React.createElement('span',{style:{minWidth:88,textAlign:"center",fontFamily:LOOP_FONTS.body,fontSize:11,fontWeight:700,color:"var(--text)",whiteSpace:"nowrap"}},isCurrent ? `${FULL_MONTH_NAMES[CUR_MONTH]} '${String(CUR_YEAR).slice(-2)}` : expandMonthLabel(selMonth.label)),
      stepperArrow("next", !isCurrent, () => setSelIdx(newerIdx))
    ),
    right ? React.createElement('span',{style:{position:"absolute",right:4,top:"50%",transform:"translateY(-50%)",fontFamily:LOOP_FONTS.mono,fontSize:9,color:"#6B9690",letterSpacing:".04em",textTransform:"uppercase",whiteSpace:"nowrap"}},right) : null
  );

  if(viewPlayer) {
    const profileName = typeof viewPlayer === "string" ? viewPlayer : viewPlayer?.name;
    const profileMonthKey = typeof viewPlayer === "string" ? null : viewPlayer?.monthKey;
    return React.createElement('div',{style:{maxWidth:840,margin:"0 auto"}},
      React.createElement(PlayerProfileErrorBoundary,{profileName,onBack:()=>setViewPlayer(null)},
        React.createElement(PlayerProfile,{group:group,name:profileName,logs,excused,monthHistory,onBack:()=>setViewPlayer(null),groupSettings,initialMonthKey:profileMonthKey,onTrackUsage,isOwnProfile:profileName===currentUser})
      )
    );
  }

  // ── Closed month → settlement screen ───────────────────────────────────────
  if (!isCurrent && selMonth && currentUser) {
    return React.createElement('div',{style:{position:"relative",maxWidth:840,margin:"0 auto",padding:`${STEPPER_TOP}px 12px 16px`,display:"flex",flexDirection:"column",gap:6,background:"radial-gradient(ellipse 95% 72% at 50% 62%, rgba(78,205,196,.075), rgba(78,205,196,.025) 46%, transparent 76%)",borderRadius:16}},
      // The switcher sits one line higher than before; the results below it keep their place.
      React.createElement('div',{style:{marginBottom:36-STEPPER_TOP}}, monthStepper(null)),
      React.createElement(SettlementScreen,{
        group, month:selMonth, currentUser, currentUserId, monthHistory, profiles, onOpenAccount, onSettlementClaimPaid, onSettlementConfirmPaid, onTrackUsage,
        currentPaymentMethods, onSavePayment, savingPayment, paymentError,
        onViewProfileMonth: (name, monthKey)=>{if(name) onTrackUsage?.(name === currentUser ? "own_block_profile_opened" : "other_profile_opened"); setViewPlayer({name, monthKey})},
        onStartNextMonth: onStartNextMonth ? ()=>{ setSelIdx(null); onStartNextMonth(); } : null
      })
    );
  }

  // ── Current month → the perfect-month loop ─────────────────────────────────
  const userIdFor = name => Object.entries(group?.memberships || {}).find(([, m]) => m?.displayName === name)?.[0] || "";
  const loopMembers = counts.map(u => {
    // A Solo member's slice is the size of their normal target; only the Solo
    // target can fill it.
    const info = getMemberTargetInfoForMonth(group, u.name, curKey);
    const fullTarget = Math.max(1, Number(info?.target || u.target || MIN_TARGET));
    return {
      name: u.name, userId: userIdFor(u.name), isMe: u.name === currentUser,
      isOut: !!u.isOut, isSolo: !!u.isSolo, isTraining: !!u.isTraining,
      target: fullTarget, fillable: u.isSolo && u.soloTarget ? u.soloTarget : fullTarget,
      count: u.count, joinDay: info?.joinDay || 1, prorated: !!u.prorated
    };
  });
  const totals = loopTotals(loopMembers);
  const focusMember = focus ? loopMembers.find(m => m.name === focus && !m.isOut) : null;
  const toggleFocus = name => {
    // Only a selection counts. Tapping the focused slice again clears it, and
    // that is a dismissal, not another look at someone's month. Tracked out
    // here rather than inside the setFocus updater: React may run an updater
    // more than once, which would double-count the tap.
    if (name && focus !== name) onTrackUsage?.(name === currentUser ? "month_own_slice_opened" : "month_other_slice_opened");
    setFocus(prev => prev === name ? null : name);
  };
  // A Solo month (or too few in the month) can't be perfect. Say so in the
  // middle, muted, where the percentage would be.
  const readoutLine = !totals.canBePerfect ? "Can't be perfect" : totals.done === 0 && DAY_OF_MON === 1 ? "Day one" : `${Math.round(totals.done / Math.max(1, totals.total) * 100)}% to a perfect month`;
  const daysLeft = getDaysLeft();
  const perfectRun = perfectMonthRun(monthHistory);

  const labelStyle = { fontFamily: LOOP_FONTS.body, fontSize: 8.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#6B9690" };
  const noteRow = (key, label, member, text) => React.createElement('div', { key, style: { display: "flex", alignItems: "center", gap: 10, fontFamily: LOOP_FONTS.body, fontSize: 12, color: "#B8C7C4" } },
    React.createElement('b', { style: { ...labelStyle, color: "#7DB8B1", minWidth: 78 } }, label),
    React.createElement(Avatar, { name: member.name, userId: member.userId, size: 20 }),
    text
  );

  const noteRows = [
    ...loopMembers.filter(m => m.isOut).map(m => noteRow(`out-${m.name}`, "Sitting out", m, m.name)),
    ...loopMembers.filter(m => m.isSolo && !m.isOut).map(m => noteRow(`solo-${m.name}`, "On Solo", m, `${m.name}, aiming for ${m.fillable}`)),
    ...loopMembers.filter(m => m.prorated && !m.isOut).map(m => noteRow(`pro-${m.name}`, "Prorated", m, `${m.name}, ${m.target} after joining on the ${ordinalDay(m.joinDay)}`))
  ];
  const hasNotes = noteRows.length > 0;
  // With no notes, the caption sits two lines lower and the hint a line and a
  // half higher, so the space between them reads as meant.
  const renderNotes = () => React.createElement(React.Fragment, null,
    hasNotes && React.createElement('div', { style: { padding: "0 6px", display: "flex", flexDirection: "column", gap: 8 } }, noteRows),
    React.createElement('div', { style: { fontFamily: LOOP_FONTS.body, fontSize: 9, fontWeight: 500, lineHeight: "12px", color: "#6B9690", opacity: .8, textAlign: "center", marginTop: hasNotes ? 26 : 0, paddingBottom: hasNotes ? 0 : 22 } }, "Tap a slice to see someone's month")
  );
  // A small row of ticks, echoing the ring, between the caption and what's under it.
  const separator = React.createElement('div', { "aria-hidden": true, style: { display: "flex", justifyContent: "center", alignItems: "center", gap: 4, height: 6 } },
    [0, 1, 2, 3, 4, 5, 6].map(i => React.createElement('span', { key: i, style: { width: 1, height: i === 3 ? 6 : 4, background: i === 3 ? "rgba(78,205,196,.45)" : "#2A3B38" } }))
  );

  const renderPanel = m => {
    const perDay = perDayCounts(logs[m.name] || [], CUR_YEAR, CUR_MONTH);
    const clearDay = clearDayOf(perDay, m.fillable);
    const days = DAYS_IN_MON;
    let running = 0;
    const columns = perDay.map((n, d) => {
      const segs = [];
      for (let k = 0; k < n; k += 1) { segs.push(React.createElement('b', { key: k, style: { display: "block", height: 15, background: running < m.fillable ? "#4ECDC4" : "#E8F6F3" } })); running += 1; }
      const future = d + 1 > DAY_OF_MON;
      return React.createElement('div', { key: d, style: { display: "flex", flexDirection: "column-reverse", gap: 2, height: "100%" } },
        segs.length ? segs : React.createElement('span', { style: { display: "block", height: future ? 1 : 2, background: future ? "#162321" : "#22302E" } })
      );
    });
    const endOf = d => `calc(${d} * (100% + 3px) / ${days} - 1.5px)`;
    const midOf = d => `calc(${d - .5} * (100% + 3px) / ${days} - 1.5px)`;
    const monthShort = shortMonthName(CUR_MONTH).toUpperCase();
    const chart = React.createElement('div', { style: { position: "relative", paddingTop: 14 } },
      React.createElement('div', { style: { display: "grid", gridTemplateColumns: `repeat(${days},1fr)`, gap: 3, height: 40, alignItems: "end", borderBottom: "0.5px solid #1F3432" } }, columns),
      clearDay && React.createElement('div', { style: { position: "absolute", top: 0, bottom: 0, left: endOf(clearDay), width: 0, borderLeft: "1px solid #4ECDC4" } },
        React.createElement('span', { style: { position: "absolute", top: -1, [clearDay > 17 ? "right" : "left"]: 4, fontFamily: LOOP_FONTS.mono, fontSize: 8, fontWeight: 700, color: "#4ECDC4", letterSpacing: ".08em", whiteSpace: "nowrap" } }, `CLEARED · ${monthShort} ${clearDay}`)
      ),
      React.createElement('div', { style: { position: "absolute", bottom: -7, left: midOf(DAY_OF_MON), width: 0, height: 0, borderLeft: "3px solid transparent", borderRight: "3px solid transparent", borderBottom: "4px solid #6B9690", transform: "translateX(-3px)" } }),
      React.createElement('div', { style: { display: "grid", gridTemplateColumns: `repeat(${days},1fr)`, gap: 3, fontFamily: LOOP_FONTS.mono, fontSize: 8.5, color: "#6B9690", marginTop: 9 } },
        [1, 8, 15, 22, 29].filter(d => d <= days).map(d => React.createElement('span', { key: d, style: { gridColumn: d, gridRow: 1, whiteSpace: "nowrap" } }, d))
      )
    );

    const best = personalBestOf(monthHistory, m.name, curKey);
    const pb = personalBestCard(best, m.count, { firstMonth: !best });
    const week = bestWeekOf(perDay, CUR_YEAR, CUR_MONTH);
    const weekCard = week.n
      ? { big: React.createElement(React.Fragment, null, week.n, smallUnit(week.n === 1 ? "workout" : "workouts")), small: `${shortMonthName(CUR_MONTH)} ${week.a} to ${week.b}` }
      : { big: "—", small: "Nothing logged yet" };

    const last = sameDayLastMonth(monthHistory, m.name, curKey, DAY_OF_MON);
    const rail = (n, target, on) => React.createElement('div', { style: { display: "flex", gap: 3 } },
      Array.from({ length: target }, (_, k) => React.createElement('i', { key: k, style: { flex: 1, height: 10, background: k < n ? on : "#1D2A29" } })),
      Array.from({ length: Math.min(Math.max(0, n - target), target * 2) }, (_, k) => React.createElement('i', { key: `x${k}`, style: { flex: "0 0 2px", marginLeft: -1, height: 10, background: "#E8F6F3" } }))
    );
    const railLabel = text => React.createElement('span', { style: { fontFamily: LOOP_FONTS.mono, fontSize: 9, color: "#6B9690", letterSpacing: ".06em", textTransform: "uppercase" } }, text);
    const diff = last ? m.count - last.count : 0;
    const lastCard = last && React.createElement(PanelCard, {
      label: "Same day last month",
      extraStyle: { gridColumn: "1 / -1" },
      small: React.createElement('div', { style: { display: "grid", gridTemplateColumns: "44px 1fr", gap: "7px 10px", alignItems: "center", marginTop: 2 } },
        railLabel(`${shortMonthName(last.monthIndex)} ${last.day}`), rail(last.count, last.target, "#3C5C58"),
        railLabel(`${shortMonthName(CUR_MONTH)} ${DAY_OF_MON}`), rail(m.count, m.fillable, "#4ECDC4"),
        React.createElement('div', { style: { gridColumn: "1 / -1", fontFamily: LOOP_FONTS.body, fontSize: 11.5, fontWeight: 600, color: "#B8C7C4", paddingTop: 2 } },
          diff === 0 ? `Level with ${monthName(last.monthIndex)}`
            : React.createElement(React.Fragment, null,
                React.createElement('b', { style: { color: diff > 0 ? "#4ECDC4" : "#E0874A" } }, `${Math.abs(diff)} ${diff > 0 ? "ahead" : "behind"}`),
                `${diff > 0 ? " of where" : " where"} ${m.isMe ? "you were" : "they were"} in ${monthName(last.monthIndex)}`)
        )
      )
    });

    const record = trackRecordOf(monthHistory, m.name, curKey);
    const rec = trackRecordParts({ months: record, firstMonth: !record.length });
    const recordRow = React.createElement('div', { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "2px 2px 0" } },
      React.createElement('span', { style: rec.label }, "Track record"),
      record.length ? rec.rings : null,
      React.createElement('span', { style: { fontFamily: LOOP_FONTS.body, fontSize: 11, fontWeight: 600, color: "#B8C7C4", textAlign: "right" } }, rec.summary)
    );

    let endedToday = null;
    if (m.isMe) {
      const owe = losers.some(l => l.name === m.name) ? getLoserAmount(penalties, m.name) : 0;
      const owed = wouldMoveMoney && winners.some(w => w.name === m.name) ? perWinner : 0;
      endedToday = React.createElement(PanelCard, {
        label: "If the month ended today", extraStyle: { gridColumn: "1 / -1" },
        small: owe ? React.createElement(React.Fragment, null, "You'd owe ", React.createElement('b', null, fmtCurrency(owe, resultsCurrency)))
          : owed ? React.createElement(React.Fragment, null, "You'd be owed ", React.createElement('b', null, fmtCurrency(owed, resultsCurrency)))
          : "Nothing to pay"
      });
    }

    return React.createElement('div', { "data-loop-keep": "1", style: { display: "flex", flexDirection: "column", gap: 12 } },
      React.createElement('div', { style: { display: "flex", alignItems: "center", gap: 9 } },
        React.createElement(Avatar, { name: m.name, userId: m.userId, size: 24 }),
        React.createElement('h3', { style: { margin: 0, fontFamily: LOOP_FONTS.display, fontSize: 15, fontWeight: 800, color: "var(--text)" } }, `${m.isMe ? "Your" : `${m.name}'s`} ${monthName(CUR_MONTH)}`)
      ),
      chart,
      React.createElement('div', { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 } },
        React.createElement(PanelCard, { label: "Personal best", big: pb.big, small: pb.small }),
        React.createElement(PanelCard, { label: "Best week", big: weekCard.big, small: weekCard.small }),
        lastCard,
        endedToday
      ),
      recordRow
    );
  };

  // The app already leaves room for the floating nav under every page, so the
  // Month page adds none of its own: with a person open it ends right after
  // their track record, like Today and Activity. With nobody open it fills the
  // screen exactly, so the hint sits just above the nav with no scroll.
  const restingView = !focusMember;
  const captionLow = restingView && !hasNotes;
  return React.createElement('div',{style:{position:"relative",background:"radial-gradient(ellipse 95% 72% at 50% 62%, rgba(78,205,196,.055), rgba(78,205,196,.018) 46%, transparent 76%)"}},
  React.createElement('div',{style:{
    maxWidth:840,margin:"0 auto",padding:`${STEPPER_TOP}px 12px 0`,display:"flex",flexDirection:"column",gap:6,background:"transparent",borderRadius:16,boxSizing:"border-box",
    ...(restingView ? { minHeight: RESTING_MIN_HEIGHT, marginBottom: RESTING_OVERLAP } : null)
  }},
    monthStepper(`${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`),
    // The ring grew; this keeps its centre where it was.
    React.createElement('div',{style:{marginTop:4}},
      React.createElement(MonthDial,{
        members: loopMembers, perfect: false, focus, onToggle: toggleFocus, live: true,
        readout: React.createElement(LoopReadout,{ focusMember, perfect:false, done: totals.done, total: totals.total, line: readoutLine, lineMuted: !totals.canBePerfect })
      })
    ),
    React.createElement('div',{style:{marginTop:captionLow ? 30 : 0,transition:"margin-top .3s cubic-bezier(.16,1,.3,1)"}},
      React.createElement(LoopCaption,{ lines: loopCaption(loopMembers, { ended:false, dayOne: DAY_OF_MON === 1 }) })
    ),
    // What the Bloc is protecting this month, under the caption. Nothing to show
    // until they have one behind them.
    perfectRun > 0 && React.createElement('div',{style:{marginTop:8}}, React.createElement(PerfectRunPill,{ run: perfectRun })),
    React.createElement('div',{style:restingView
      // The gap gives way when the run pill or a long note list needs the room,
      // so the resting page still fits the screen exactly.
      ? { flex: "1 1 auto", minHeight: 24, display: "flex", alignItems: "center", justifyContent: "center" }
      : { padding: "14px 0 12px" }}, separator),
    React.createElement('div',{style:{padding:restingView ? 0 : "0 6px",display:"flex",flexDirection:"column",gap:8}},
      focusMember ? renderPanel(focusMember) : renderNotes()
    )
  )
  );
};

// The month switcher's distance from the top of the page, shared by the live
// month and the results so the switcher never moves when you change month.
const STEPPER_TOP = 20;
// The resting Month page fills the screen down to just above the floating nav:
// the viewport, less the Bloc header (45px + the top safe area) and the nav with
// its plus button and a small gap (105px + the bottom safe area). The app pads
// every page by 108px + the bottom safe area, inside a scroller that is
// 100dvh - 64px tall (inBlocViewportHeight in App.jsx). Overlapping that padding
// by 22px makes the resting page fit the scroller exactly, so it never scrolls.
const RESTING_MIN_HEIGHT = "calc(100dvh - 150px - env(safe-area-inset-top) - env(safe-area-inset-bottom))";
const RESTING_OVERLAP = -22;

const ordinalDay = n => { const s = ["th","st","nd","rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

// ─── HISTORY PAGE ─────────────────────────────────────────────────────────────

export { MonthPage };
