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
  getCurrentMemberTargetInfo,
  isSoloForMonth,
  isTrainingForMonth,
  getSoloTargetForMonth,
  fmtCurrency,
  getCountedLogCount,
  isJoinedForMonth,
  DAYS_IN_MON
} from "../lib/appState.js";
import {
  isMobile
} from "../lib/utils.js";
import { Avatar, SelectField, PlayerProfileErrorBoundary } from "../components/primitives.jsx";
import {
  MonthDial, LoopReadout, LoopCaption, loopCaption, loopTotals, useTapOutside, LOOP_FONTS,
  perDayCounts, clearDayOf, bestWeekOf, personalBestOf, trackRecordOf, sameDayLastMonth,
  trackRecordParts, PanelCard, personalBestCard, smallUnit, monthName, shortMonthName
} from "../components/MonthLoop.jsx";
import { PlayerProfile } from "../pages/PlayerProfile.jsx";
import { SettlementScreen } from "../pages/SettlementScreen.jsx";

const FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const MonthPage = ({group,logs,excused,monthHistory,groupSettings,currentUser,currentUserId,initialSelIdx,onStartNextMonth,onSettlementClaimPaid,onSettlementConfirmPaid,onOpenToday,profiles,onOpenAccount,navResetToken,onTrackUsage}) => {
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
        const { target, joinDay=1, proratedDays } = getCurrentMemberTargetInfo(n, curKey, MIN_TARGET);
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
        return { name:n, count, isOut, isSolo, isTraining, target:activeTarget, soloTarget, memberDiffLabel, joinDay, proratedDays };
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
  const expandMonthFullYear = (label, key) => {
    const fromLabel = /^([A-Z][a-z]{2})\s+'?(\d{2})$/.exec(String(label || "").trim());
    if (fromLabel) return `${FULL_MONTH_NAMES[MONTH_NAMES.indexOf(fromLabel[1])] || fromLabel[1]} 20${fromLabel[2]}`;
    const [year, month] = String(key || "").split("-").map(Number);
    return Number.isFinite(year) && Number.isFinite(month) ? `${FULL_MONTH_NAMES[month] || MONTH_NAMES[month] || "Month"} ${year}` : expandMonthLabel(label);
  };
  const monthLabel=isCurrent?`${FULL_MONTH_NAMES[CUR_MONTH] || MONTH_NAMES[CUR_MONTH]} ${CUR_YEAR}`:expandMonthFullYear(selMonth.label, selMonth.key);
  const monthSelector=React.createElement(SelectField,{
    value:isCurrent?"":selIdx,
    onChange:e=>{
      const selectEl = e.currentTarget;
      setSelIdx(e.target.value===""?null:Number(e.target.value));
      requestAnimationFrame(()=>selectEl.blur());
    },
    width:isMobile()?"102px":"114px",
    compact:true,
    arrowColor:"#4ECDC4",
    textAlign:"center",
    inputStyle:{
      background:"rgba(8,15,15,.48)",
      border:"1px solid rgba(78,205,196,.18)",
      color:"var(--text)",
      fontFamily:"'Outfit', sans-serif",
      fontWeight:700,
      fontSize:11,
      outline:"none",
      boxShadow:"none",
      textAlign:"center",
      paddingLeft:10,
      paddingRight:16
    },
    options:[
      {value:"",label:"This Month"},
      ...histReversed.map((m,i)=>({value:String(i),label:expandMonthLabel(m.label)}))
    ]
  });

  if(viewPlayer) {
    const profileName = typeof viewPlayer === "string" ? viewPlayer : viewPlayer?.name;
    const profileMonthKey = typeof viewPlayer === "string" ? null : viewPlayer?.monthKey;
    return React.createElement('div',{style:{maxWidth:840,margin:"0 auto"}},
      React.createElement(PlayerProfileErrorBoundary,{profileName,onBack:()=>setViewPlayer(null)},
        React.createElement(PlayerProfile,{group:group,name:profileName,logs,excused,monthHistory,onBack:()=>setViewPlayer(null),groupSettings,initialMonthKey:profileMonthKey})
      )
    );
  }

  // ── Closed month → settlement screen ───────────────────────────────────────
  if (!isCurrent && selMonth && currentUser) {
    return React.createElement('div',{style:{position:"relative",maxWidth:840,margin:"0 auto",padding:"12px 12px 16px",display:"flex",flexDirection:"column",gap:12,background:"radial-gradient(ellipse 95% 72% at 50% 62%, rgba(78,205,196,.075), rgba(78,205,196,.025) 46%, transparent 76%)",borderRadius:16}},
      React.createElement('div',{style:{position:"relative",display:"flex",alignItems:"center",justifyContent:"flex-end",minHeight:38,gap:10}},
      React.createElement('div',{style:{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",textAlign:"center",pointerEvents:"none",whiteSpace:"nowrap"}},
        React.createElement('div',{style:{fontSize:19,fontWeight:800}},monthLabel)
      ),
        monthSelector
      ),
      React.createElement(SettlementScreen,{
        group, month:selMonth, currentUser, currentUserId, monthHistory, profiles, onOpenAccount, onSettlementClaimPaid, onSettlementConfirmPaid, onTrackUsage,
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
    const info = getCurrentMemberTargetInfo(u.name, curKey, MIN_TARGET);
    const fullTarget = Math.max(1, Number(info?.target || u.target || MIN_TARGET));
    return {
      name: u.name, userId: userIdFor(u.name), isMe: u.name === currentUser,
      isOut: !!u.isOut, isSolo: !!u.isSolo, isTraining: !!u.isTraining,
      target: fullTarget, fillable: u.isSolo && u.soloTarget ? u.soloTarget : fullTarget,
      count: u.count, joinDay: info?.joinDay || 1, prorated: !!info?.proratedDays
    };
  });
  const totals = loopTotals(loopMembers);
  const focusMember = focus ? loopMembers.find(m => m.name === focus && !m.isOut) : null;
  const toggleFocus = name => setFocus(prev => prev === name ? null : name);
  const readoutLine = !totals.canBePerfect ? null : totals.done === 0 && DAY_OF_MON === 1 ? "Day one" : `${Math.round(totals.done / Math.max(1, totals.total) * 100)}% to a perfect month`;
  const daysLeft = getDaysLeft();

  const labelStyle = { fontFamily: LOOP_FONTS.body, fontSize: 8.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#6B9690" };
  const noteRow = (key, label, member, text) => React.createElement('div', { key, style: { display: "flex", alignItems: "center", gap: 10, fontFamily: LOOP_FONTS.body, fontSize: 12, color: "#B8C7C4" } },
    React.createElement('b', { style: { ...labelStyle, color: "#7DB8B1", minWidth: 78 } }, label),
    React.createElement(Avatar, { name: member.name, userId: member.userId, size: 20 }),
    text
  );

  const renderNotes = () => {
    const rows = [
      ...loopMembers.filter(m => m.isOut).map(m => noteRow(`out-${m.name}`, "Sitting out", m, m.name)),
      ...loopMembers.filter(m => m.isSolo && !m.isOut).map(m => noteRow(`solo-${m.name}`, "On Solo", m, `${m.name}, aiming for ${m.fillable}`)),
      ...loopMembers.filter(m => m.prorated && !m.isOut).map(m => noteRow(`pro-${m.name}`, "Prorated", m, `${m.name}, ${m.target} after joining on the ${ordinalDay(m.joinDay)}`))
    ];
    return React.createElement(React.Fragment, null,
      rows,
      React.createElement('div', { style: { fontFamily: LOOP_FONTS.body, fontSize: 9, fontWeight: 500, color: "#6B9690", opacity: .8 } }, "Tap a slice to see someone's month")
    );
  };

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

  // Extra room at the bottom: the track record is the last row and must clear the floating nav.
  return React.createElement('div',{style:{position:"relative",minHeight:"calc(100vh - 136px)",padding:"0 0 72px",background:"radial-gradient(ellipse 95% 72% at 50% 62%, rgba(78,205,196,.055), rgba(78,205,196,.018) 46%, transparent 76%)"}},
  React.createElement('div',{style:{maxWidth:840,margin:"0 auto",padding:"12px 12px 16px",display:"flex",flexDirection:"column",gap:12,background:"transparent",borderRadius:16}},
    React.createElement('div',{style:{position:"relative",display:"flex",alignItems:"center",justifyContent:"flex-end",minHeight:38,gap:10}},
      React.createElement('div',{style:{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",textAlign:"center",pointerEvents:"none",whiteSpace:"nowrap"}},
        React.createElement('div',{style:{fontSize:19,fontWeight:800}},monthLabel)
      ),
      monthSelector
    ),
    React.createElement('div',{style:{display:"flex",justifyContent:"flex-end",padding:"0 6px",fontFamily:LOOP_FONTS.mono,fontSize:10,color:"#6B9690",letterSpacing:".06em",textTransform:"uppercase"}},`${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`),
    React.createElement(MonthDial,{
      members: loopMembers, perfect: false, focus, onToggle: toggleFocus,
      readout: React.createElement(LoopReadout,{ focusMember, perfect:false, done: totals.done, total: totals.total, line: readoutLine })
    }),
    React.createElement(LoopCaption,{ lines: loopCaption(loopMembers, { ended:false, dayOne: DAY_OF_MON === 1 }) }),
    React.createElement('div',{style:{borderTop:"0.5px solid #0D1F1E",padding:"12px 6px 0",display:"flex",flexDirection:"column",gap:8,minHeight:118}},
      focusMember ? renderPanel(focusMember) : renderNotes()
    )
  )
  );
};

const ordinalDay = n => { const s = ["th","st","nd","rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

// ─── HISTORY PAGE ─────────────────────────────────────────────────────────────

export { MonthPage };
