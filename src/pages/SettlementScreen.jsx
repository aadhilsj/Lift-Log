import React from "react";
import {
  MIN_TARGET,
  CUR_MONTH,
  DAY_OF_MON,
  MONTH_NAMES,
  calcPenalties,
  addStandardSoloPenalties,
  getStandardSoloMisses,
  getSoloTargetForMonth,
  getLoserAmount,
  buildSettlementPairsForMonth,
  buildSettlementPairState,
  fmtCurrency,
  isTrainingForMonth,
  isExemptFromStakes,
  ordinal,
  workoutsLabel,
  getCountedLogs,
  getMonthPartsFromKey
} from "../lib/appState.js";
import { Avatar, TrophyIcon } from "../components/primitives.jsx";
import { ShareSticker } from "../components/ShareSticker.jsx";
import { MonthCalendarCard } from "../components/MonthCalendarCard.jsx";
import { buildStickerData } from "../lib/shareSticker.js";
import { buildPaymentTargets } from "../lib/paymentLinks.js";
import { createPortal } from "react-dom";
import { PaymentHandleSection } from "../components/PaymentHandleSection.jsx";
import {
  MonthDial, LoopReadout, LoopCaption, loopCaption, loopTotals, useTapOutside, LOOP_FONTS,
  closedMonthMember, perDayCounts, clearDayOf, bestWeekOf, personalBestOf, trackRecordOf,
  trackRecordParts, PanelCard, personalBestCard, shortMonthName
} from "../components/MonthLoop.jsx";

const FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const SettlementScreen = ({group, month, currentUser, currentUserId, monthHistory, profiles, onOpenAccount, onSettlementClaimPaid, onSettlementConfirmPaid, onStartNextMonth, onViewProfileMonth, onTrackUsage, currentPaymentMethods = [], onSavePayment, savingPayment = false, paymentError = ""}) => {
  const [copiedKey, setCopiedKey] = React.useState(null);
  const [settlementBusy, setSettlementBusy] = React.useState(null);
  const [focus, setFocus] = React.useState(null);
  const [othersOpen, setOthersOpen] = React.useState(false);
  const [showLinkPayment, setShowLinkPayment] = React.useState(false);
  const clearFocus = React.useCallback(() => setFocus(null), []);
  useTapOutside(!!focus, clearFocus);
  const [claimPrompt, setClaimPrompt] = React.useState(null);
  const [showSticker, setShowSticker] = React.useState(false);
  const ledgerRef = React.useRef(null);

  const relevantNames = Object.keys(month.counts || {});
  const blocTargetFor = name => month.memberTargets?.[name] || month.settings?.minTarget || MIN_TARGET;
  const userOnTraining = !!(currentUser && isTrainingForMonth(month, currentUser, month.key));
  const activeCounts = relevantNames
    .filter(name => !month.excused?.[name] && !isExemptFromStakes(month, name, month.key))
    .map(name => ({
      name,
      count: Number(month.counts[name] || 0),
      target: blocTargetFor(name)
    }));
  const penalties = addStandardSoloPenalties(calcPenalties(activeCounts, month.settings), getStandardSoloMisses(month, relevantNames), month.settings);
  const {winners, losers, perWinner} = penalties;
  const settlementPairs = buildSettlementPairsForMonth(month);
  // The frozen loop for this month. Perfect uses the loop's rule, agreed with
  // the founder on 2026-09-22: every member in the month clears their own
  // target; sitting out removes you from the loop; any Solo means the loop
  // can't close; at least 75% of the Bloc must be in the month.
  const userIdFor = name => Object.entries(group?.memberships || {}).find(([, m]) => m?.displayName === name)?.[0] || "";
  const loopMembers = relevantNames
    .map(name => closedMonthMember(month, name))
    .filter(Boolean)
    .map(member => ({ ...member, userId: userIdFor(member.name), isMe: member.name === currentUser }));
  const loop = loopTotals(loopMembers);
  const isBlocPerfect = loop.perfect;

  const userCount = month.counts?.[currentUser] || 0;
  const userSatOut = !!(currentUser && month.excused?.[currentUser]);
  const userIsWinner = winners.some(w => w.name === currentUser);
  const userIsLoser = losers.some(l => l.name === currentUser);
  const outcome = userIsWinner ? "winner" : userIsLoser ? "missed" : "hit_mas";
  const sortedActive = [...activeCounts].sort((a,b) => b.count - a.count || a.name.localeCompare(b.name));
  const userRank = sortedActive.findIndex(m => m.name === currentUser) + 1 || 1;
  const currency = month.settings?.currency || "USD";
  const mas = getSoloTargetForMonth(month, currentUser, month.key) || month.memberTargets?.[currentUser] || month.settings?.minTarget || MIN_TARGET;
  const userOwes = getLoserAmount(penalties, currentUser);

  const incomingRows = settlementPairs.filter(pair => pair.receiverDisplayName === currentUser);

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
    if (!memberName || !snapshot || snapshot.excused?.[memberName] || isExemptFromStakes(snapshot, memberName, snapshot.key)) return false;
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
    // Asked before any money question. Every other branch below decides by
    // whether you lost money, so someone exempt used to fall through to
    // "Target Hit" and be congratulated for a month they sat out.
    if (userSatOut) {
      return {
        tag: "Sat Out",
        stat: "Month off",
        line: `You sat ${selectedMonthName} out. Back in it next month.`,
        tone: "neutral"
      };
    }
    // Exempt but present: they logged, they ranked, they simply could not be
    // charged. Without this they fall into the "did not lose money" branch and
    // get congratulated for a target they missed.
    if (userOnTraining) {
      const target = blocTargetFor(currentUser);
      return {
        tag: "First Month",
        stat: workoutsLabel(userCount),
        line: userCount >= target
          ? "Target hit. No penalty either way \u2014 but you hit it."
          // Not "next month counts": this month counted too. They logged, they
          // ranked, they appear. The only thing absent was the penalty.
          : `Target was ${target}. No penalty yet \u2014 penalties kick off from next month.`,
        tone: "training"
      };
    }
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
      // With nothing in the pot, "+£ 0" reads as a bug in celebration type.
      // The win still stands, so the headline shows the work instead and the
      // line is the one every winner sees. Money is never raised when no
      // money is involved.
      const hasPot = perWinner > 0;
      return {
        tag: "Winner",
        stat: hasPot ? `+${fmtCurrency(perWinner, currency)}` : workoutsLabel(userCount),
        topLine: "Top of the Bloc.",
        line: hasPot ? `${workoutsLabel(userCount)}.` : "",
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

  const heroColor = hero.tone === "winner" ? C.greenText : hero.tone === "missed" ? C.redText : hero.tone === "training" ? "#f5c842" : hero.tone === "neutral" ? "#D7E2E1" : "var(--text)";
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

  const mvpCount = sortedActive[0]?.count || 0;
  const mvpNames = sortedActive.filter(member => member.count === mvpCount && mvpCount > 0).map(member => member.name);
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

  const monthParts = monthKeyParts(month.key);
  const perDayFor = name => monthParts ? perDayCounts(month.logsByUser?.[name] || [], monthParts.year, monthParts.monthIndex) : [];
  const joinNames = list => list.map(entry => entry.name).join(" & ");
  const firstToClear = (() => {
    const clears = loopMembers
      .filter(member => !member.isOut)
      .map(member => ({ name: member.name, day: clearDayOf(perDayFor(member.name), member.fillable) }))
      .filter(entry => entry.day);
    if (!clears.length) return null;
    const earliest = Math.min(...clears.map(entry => entry.day));
    return { names: clears.filter(entry => entry.day === earliest), day: earliest };
  })();
  const ironWeek = (() => {
    if (!monthParts) return null;
    const weeks = loopMembers
      .filter(member => !member.isOut)
      .map(member => ({ name: member.name, ...bestWeekOf(perDayFor(member.name), monthParts.year, monthParts.monthIndex) }))
      .filter(entry => entry.n > 0);
    if (!weeks.length) return null;
    const top = Math.max(...weeks.map(entry => entry.n));
    const winnersOfWeek = weeks.filter(entry => entry.n === top);
    return { names: winnersOfWeek, n: top, a: winnersOfWeek[0].a, b: winnersOfWeek[0].b };
  })();
  const monthShort = shortMonthName(monthParts?.monthIndex);
  const awardCards = [
    // Bloc Champ gold and Most Diverse violet are the original award colours;
    // First to Clear takes the loop's cyan, Iron Week a soft brushed steel.
    { title: "Bloc Champ", name: mvpNames.length ? mvpNames.join(" & ") : "No one", detail: mvpNames.length ? workoutsLabel(mvpCount) : "No workouts", trophy: true, gradient: "linear-gradient(135deg, rgba(245,166,35,.13), rgba(255,224,132,.048))" },
    { title: "First to Clear", name: firstToClear ? joinNames(firstToClear.names) : "No one", detail: firstToClear ? `cleared on ${monthShort} ${firstToClear.day}` : "Nobody cleared", gradient: "linear-gradient(135deg, rgba(78,205,196,.115), rgba(71,118,230,.048))" },
    { title: "Most Diverse", name: mostDiverse ? mostDiverse.name : "No one", detail: mostDiverse ? `${mostDiverse.variety} different activities` : "One kind of workout", gradient: "linear-gradient(135deg, rgba(135,113,255,.13), rgba(78,112,205,.056))" },
    { title: "Iron Week", name: ironWeek ? joinNames(ironWeek.names) : "No one", detail: ironWeek ? `${ironWeek.n} in a week, ${monthShort} ${ironWeek.a} to ${ironWeek.b}` : "No workouts", gradient: "linear-gradient(135deg, rgba(170,186,204,.12), rgba(96,112,138,.05))" }
  ];
  const renderAwards = () => React.createElement('div',{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
    awardCards.map(award => React.createElement('div',{
      key: award.title,
      style: { border: "0.5px solid rgba(255,255,255,.07)", background: award.gradient, borderRadius: 10, padding: 11, display: "flex", flexDirection: "column", gap: 6, minWidth: 0, color: "var(--text)" }
    },
      React.createElement('span',{style:{display:"flex",alignItems:"center",gap:6,fontFamily:LOOP_FONTS.body,fontSize:8.5,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"#8FA9A5"}},
        award.trophy && React.createElement(TrophyIcon,{size:12,color:C.gold}),
        award.title
      ),
      React.createElement('strong',{style:{fontFamily:LOOP_FONTS.body,fontSize:14.5,fontWeight:800,lineHeight:1.1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},award.name),
      React.createElement('em',{style:{fontStyle:"normal",fontFamily:LOOP_FONTS.body,fontSize:11,fontWeight:500,color:"#B8C7C4",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},award.detail)
    ))
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
    // Preserved from the text-only share this replaced: a missed month sends you to the
    // ledger instead, because what you need then is what you owe, not a trophy.
    if (outcome === "missed") {
      ledgerRef.current?.scrollIntoView({behavior:"smooth", block:"center"});
      return;
    }
    // Counted only when something is actually shared. This used to fire on the
    // ledger jump too, which inflated the figure with taps that shared nothing.
    onTrackUsage?.("share_month_clicked");
    setShowSticker(true);
  };

  // ── The frozen ring ──────────────────────────────────────────────────────
  const focusMember = focus ? loopMembers.find(member => member.name === focus && !member.isOut) : null;
  const ringReadout = React.createElement(LoopReadout, {
    focusMember, perfect: isBlocPerfect, done: loop.done, total: loop.total,
    line: "Month ended", lineMuted: true
  });
  const payerTotal = name => settlementPairs.filter(pair => pair.payerDisplayName === name).reduce((sum, pair) => sum + Number(pair.amount || 0), 0);
  const receiverTotal = name => settlementPairs.filter(pair => pair.receiverDisplayName === name).reduce((sum, pair) => sum + Number(pair.amount || 0), 0);
  // Tapping someone shows their result and nothing else, except when it's news.
  const renderFocusPlate = () => {
    if (!focusMember) return null;
    const pays = payerTotal(focusMember.name), gets = receiverTotal(focusMember.name);
    const chip = focusMember.isTraining ? ["First month", "#F5C842"]
      : pays ? [`Owes ${fmtCurrency(pays, currency)}`, "#E86A45"]
      : gets ? [`+${fmtCurrency(gets, currency)}`, "#2ECC71"]
      : focusMember.count >= focusMember.fillable ? ["Cleared", "#4ECDC4"]
      : focusMember.isSolo ? ["On Solo", "#7DB8B1"]
      : ["Not cleared", "#6B9690"];
    const best = personalBestOf(monthHistory, focusMember.name, month.key);
    const newBest = best && focusMember.count > best.count;
    return React.createElement('div',{ "data-loop-keep": "1", style:{border:"0.5px solid #163d36",background:"#0A1412",borderRadius:14,padding:14,display:"grid",gridTemplateColumns:"auto 1fr auto",gap:10,alignItems:"center"}},
      React.createElement(Avatar,{name:focusMember.name,userId:focusMember.userId,size:26}),
      React.createElement('div',{style:{minWidth:0}},
        React.createElement('div',{style:{fontFamily:LOOP_FONTS.display,fontSize:15,fontWeight:800,lineHeight:1.1,color:"var(--text)"}},focusMember.isMe ? "You" : focusMember.name),
        newBest && React.createElement('div',{style:{fontFamily:LOOP_FONTS.body,fontSize:11,fontWeight:500,color:"#B8C7C4",marginTop:3}},"New best month")
      ),
      React.createElement('span',{style:{fontFamily:LOOP_FONTS.body,fontSize:8.5,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",padding:"6px 8px",borderRadius:999,border:"0.5px solid #163d36",whiteSpace:"nowrap",color:chip[1]}},chip[0])
    );
  };

  // ── Your report ──────────────────────────────────────────────────────────
  const heroTagColor = hero.tone === "perfect" ? "#4ECDC4" : hero.tone === "winner" ? C.greenText : hero.tone === "missed" ? "#E65A5A" : hero.tone === "training" ? "#F5C842" : "#D7E2E1";
  const heroLines = (() => {
    if (hero.tone === "winner") return [hero.topLine, [hero.line, hero.keepLine].filter(Boolean).join(" ")].filter(Boolean);
    if (hero.tone === "perfect") return [perfectLine, ...(Array.isArray(hero.footerLine) ? hero.footerLine : hero.footerLine ? [`${hero.footerLine.emphasis}${hero.footerLine.rest}`] : [])];
    const line = String(hero.line || "");
    // Two whole thoughts on two lines, e.g. "3 consistent months in a row." / "Keep it going."
    const split = line.match(/^(.*?\.)\s+(.+)$/);
    return split ? [split[1], split[2]] : line ? [line] : [];
  })();
  const myBest = personalBestOf(monthHistory, currentUser, month.key);
  const pbBody = personalBestCard(myBest, userCount, { satOut: userSatOut });
  const myRecord = trackRecordOf(monthHistory, currentUser, month.key, { includeKey: true });
  const recordParts = trackRecordParts({ months: myRecord, highlightLast: true, compact: true, firstMonth: myRecord.length <= 1 && !myBest });
  // Someone who wasn't in this month (joined later) has no report to show.
  const userInMonth = !!currentUser && Object.prototype.hasOwnProperty.call(month.counts || {}, currentUser);
  const renderReport = () => !userInMonth ? null : React.createElement('div',{style:{border:"0.5px solid #163d36",background:"#0A1412",borderRadius:14,padding:"14px 14px 12px",display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",gap:6}},
    React.createElement('div',{style:{fontFamily:LOOP_FONTS.body,fontSize:11,fontWeight:900,letterSpacing:".14em",textTransform:"uppercase",color:heroTagColor}},hero.tag),
    React.createElement('div',{style:{fontFamily:LOOP_FONTS.body,fontSize:"clamp(26px, 7.5vw, 32px)",fontWeight:900,lineHeight:1.05,color:hero.tone === "neutral" ? "var(--text)" : heroColor,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}},hero.stat),
    heroLines.length > 0 && React.createElement('div',{style:{fontFamily:LOOP_FONTS.body,fontSize:12,fontWeight:500,lineHeight:1.45,color:"#B8C7C4"}},
      heroLines.map((line, index) => React.createElement('span',{key:index,style:{display:"block"}},line))
    ),
    React.createElement('div',{style:{width:"100%",borderTop:"0.5px solid #0D1F1E",margin:"6px 0 2px"}}),
    React.createElement('div',{style:{width:"100%",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,textAlign:"left"}},
      React.createElement(PanelCard,{label:"Personal best",big:pbBody.big,small:pbBody.small}),
      React.createElement('div',{style:{border:"0.5px solid #0D1F1E",background:"#080F0F",borderRadius:10,padding:"10px 11px",display:"flex",flexDirection:"column",gap:6,minWidth:0}},
        React.createElement('span',{style:recordParts.label},"Track record"),
        recordParts.rings,
        React.createElement('em',{style:{fontStyle:"normal",fontFamily:LOOP_FONTS.body,fontSize:11,fontWeight:500,color:"#B8C7C4"}},recordParts.summary)
      )
    )
  );

  // ── Settlements: your own payments open, everyone else's folded ──────────
  const plateStyle = {border:"0.5px solid #163d36",background:"#0A1412",borderRadius:12,padding:"10px 12px",display:"flex",flexDirection:"column",gap:7};
  const plateHead = (title, meta) => React.createElement('div',{style:{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10}},
    React.createElement('b',{style:{fontFamily:LOOP_FONTS.body,fontSize:8.5,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"#7DB8B1"}},title),
    meta && React.createElement('span',{style:{fontFamily:LOOP_FONTS.body,fontSize:9.5,fontWeight:600,color:"#6B9690"}},meta)
  );
  const pairKey = pair => `${month.key}:${pair.payerDisplayName}:${pair.receiverDisplayName}`;
  const pairState = pair => statusForPair(pair).state;
  const smallBtn = (label, onClick, kind, key) => React.createElement('button',{
    type:"button", onClick, disabled: settlementBusy === key,
    style:{fontFamily:LOOP_FONTS.body,fontSize:8.5,fontWeight:800,lineHeight:1,padding:"4px 8px",borderRadius:999,cursor:"pointer",whiteSpace:"nowrap",
      background: kind === "confirm" ? "#4ECDC4" : "rgba(226,235,232,.10)",
      border: `1px solid ${kind === "confirm" ? "#4ECDC4" : "rgba(226,235,232,.26)"}`,
      color: kind === "confirm" ? "#061110" : "#DCE8E5"}
  }, settlementBusy === key ? "Saving..." : label);
  const renderPairRow = pair => {
    const key = pairKey(pair), state = pairState(pair);
    const youPay = pair.payerDisplayName === currentUser, youGet = pair.receiverDisplayName === currentUser;
    const nameNode = name => name === currentUser
      ? React.createElement('span',{style:{fontWeight:700,color:"var(--text)"}},"You")
      : name;
    const amountColor = state.pending && !state.confirmed ? "#EF9F27" : youPay ? "#E86A45" : youGet ? "#2ECC71" : "#6B9690";
    const statusText = (text, color) => React.createElement('span',{style:{fontFamily:LOOP_FONTS.body,fontSize:9.5,fontWeight:500,lineHeight:1.3,color:color || "#6B9690"}},text);
    let status, actions = null;
    if (state.confirmed) status = statusText("Paid, confirmed", "#4ECDC4");
    else if (youPay && state.pending) status = statusText(`Waiting for ${pair.receiverDisplayName} to confirm`, "#EF9F27");
    else if (youPay) {
      status = statusText("You haven't paid yet");
      actions = React.createElement('span',{style:{display:"inline-flex",alignItems:"center",gap:6}},
        renderPayControl(pair, key),
        smallBtn("Mark as paid", () => requestSettlementAction({key,kind:"claim",payerDisplayName:pair.payerDisplayName,receiverDisplayName:pair.receiverDisplayName,amount:pair.amount}), "claim", key)
      );
    } else if (youGet && state.pending) {
      status = statusText(`${pair.payerDisplayName} says they paid you`, "#EF9F27");
      actions = smallBtn("Confirm", () => requestSettlementAction({key,kind:"confirm",payerDisplayName:pair.payerDisplayName,receiverDisplayName:pair.receiverDisplayName,amount:pair.amount}), "confirm", key);
    } else if (state.pending) status = statusText(`Paid, waiting for ${pair.receiverDisplayName} to confirm`, "#EF9F27");
    else status = statusText("Not paid yet");
    return React.createElement('div',{key,style:{display:"grid",gridTemplateColumns:"1fr auto",gap:"3px 10px",alignItems:"center",padding:"6px 0",borderTop:"0.5px solid #0D1F1E"}},
      React.createElement('div',{style:{display:"flex",alignItems:"center",gap:6,minWidth:0,fontFamily:LOOP_FONTS.body,fontSize:11.5,fontWeight:500,color:"#B8C7C4"}},
        nameNode(pair.payerDisplayName),
        React.createElement('span',{style:{fontFamily:LOOP_FONTS.mono,fontSize:11,color:"#6B9690"}},"→"),
        nameNode(pair.receiverDisplayName)
      ),
      React.createElement('div',{style:{fontFamily:LOOP_FONTS.body,fontSize:11.5,fontWeight:600,textAlign:"right",fontVariantNumeric:"tabular-nums",color:amountColor}},fmtCurrency(pair.amount, currency)),
      React.createElement('div',{style:{gridColumn:"1 / -1",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,minHeight:18}},status,actions)
    );
  };
  // Someone owed money with no way to be paid gets the same nudge Today gives,
  // decided the same way Today decides it (every saved method, not just the
  // original single one) and opening the same window.
  const needsPaymentMethod = incomingRows.length > 0 && !!onSavePayment && !!currentUserId && buildPaymentTargets(profiles?.[currentUserId]).length === 0;
  const isPhoneLayout = typeof window !== "undefined" && !!window.matchMedia?.("(max-width: 768px)").matches;
  const linkPaymentBody = showLinkPayment && onSavePayment && React.createElement('div',{className:"overlay center-mobile",onClick:()=>setShowLinkPayment(false),style:isPhoneLayout ? {background:"rgba(2,3,6,.58)"} : undefined},
    React.createElement('div',{className:"modal pi",onClick:e=>e.stopPropagation(),style:{maxWidth:340,padding:"16px 15px",textAlign:"left"}},
      React.createElement(PaymentHandleSection,{currentPaymentMethods,onSavePayment,savingPayment,paymentError})
    )
  );
  // Portalled on the phone, like Today's: the Month page sits inside a swipe surface.
  const linkPaymentModal = linkPaymentBody && isPhoneLayout ? createPortal(linkPaymentBody, document.body) : linkPaymentBody;
  const renderSettlements = () => {
    if (!settlementPairs.length) {
      return React.createElement('div',{style:plateStyle},
        plateHead("Settlements", "None"),
        React.createElement('div',{style:{fontFamily:LOOP_FONTS.body,fontSize:12,fontWeight:700,color:"var(--text)",textAlign:"center",padding:"6px 0 2px"}},"Nothing to settle.")
      );
    }
    const mine = settlementPairs.filter(pair => pair.payerDisplayName === currentUser || pair.receiverDisplayName === currentUser);
    const others = settlementPairs.filter(pair => !mine.includes(pair));
    const openCount = list => list.filter(pair => !pairState(pair).confirmed).length;
    const allOpen = openCount(settlementPairs);
    const foldLabel = mine.length ? "Everyone else" : `Settlements – ${allOpen ? `${allOpen} Open` : "All settled"}`;
    return React.createElement('div',{style:mine.length ? plateStyle : {...plateStyle,padding:"9px 12px"}},
      mine.length > 0 && plateHead(mine[0].payerDisplayName === currentUser ? "You owe" : "Owed to you", `${openCount(mine)} Open`),
      mine.length > 0 && needsPaymentMethod && React.createElement('div',{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,border:"0.5px solid rgba(78,205,196,.3)",borderRadius:9,padding:"7px 10px",background:"rgba(78,205,196,.05)"}},
        React.createElement('span',{style:{fontFamily:LOOP_FONTS.body,fontSize:10.5,fontWeight:500,lineHeight:1.35,color:"#B8C7C4"}},"People can't pay you in one tap yet."),
        React.createElement('button',{type:"button",onClick:()=>setShowLinkPayment(true),style:{background:"none",border:"none",padding:0,cursor:"pointer",fontFamily:LOOP_FONTS.body,fontSize:10.5,fontWeight:700,color:"#4ECDC4",whiteSpace:"nowrap"}},"Link a payment option +")
      ),
      mine.length > 0 && React.createElement('div',{style:{display:"flex",flexDirection:"column",marginTop:-8}},mine.map(renderPairRow)),
      others.length > 0 && React.createElement('button',{type:"button","aria-expanded":othersOpen,onClick:()=>setOthersOpen(v => !v),style:{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",background:"transparent",border:"none",padding:"2px 0",cursor:"pointer",fontFamily:LOOP_FONTS.body,fontSize:11.5,fontWeight:600,color:"#B8C7C4"}},
        React.createElement('span',null,foldLabel),
        React.createElement('span',{style:{color:"#6B9690",fontSize:15}},othersOpen ? "−" : "+")
      ),
      others.length > 0 && othersOpen && React.createElement('div',{style:{display:"flex",flexDirection:"column",marginTop:-6}},others.map(renderPairRow))
    );
  };

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
    React.createElement('div',{style:{width:"100%",maxWidth:"100%",margin:"0 auto",padding:"0 0 48px",display:"flex",flexDirection:"column",gap:14,fontFamily:LOOP_FONTS.body}},
      React.createElement(MonthDial,{ members: loopMembers, perfect: isBlocPerfect, focus, onToggle: name => setFocus(prev => prev === name ? null : name), readout: ringReadout }),
      React.createElement(LoopCaption,{ lines: loopCaption(loopMembers, { ended: true }) }),
      React.createElement('div',{style:{fontFamily:LOOP_FONTS.body,fontSize:9,fontWeight:500,color:"#6B9690",opacity:.8,textAlign:"center",marginTop:-8}},"Tap a slice to see that person"),
      renderFocusPlate(),
      renderReport(),
      React.createElement('div',{style:{border:"0.5px solid #163d36",background:"#0A1412",borderRadius:14,padding:14,display:"flex",flexDirection:"column",gap:12}},
        plateHead(`${selectedMonthName}'s awards`),
        renderAwards()
      ),
      reportCalendar ? React.createElement(MonthCalendarCard,{
        title:stickerMonthLabel,
        logsByDay:reportCalendar.logsByDay,
        year:reportCalendar.year,
        monthIndex:reportCalendar.monthIndex,
        daysInMonth:reportCalendar.daysInMonth,
        firstWeekdayOffset:reportCalendar.firstWeekdayOffset,
        onShare:handleShare
      }) : null,
      React.createElement('div',{ref:ledgerRef},renderSettlements())
    ),
    claimConfirmation,
    linkPaymentModal,
    showSticker && stickerData && React.createElement(ShareSticker,{
      data: stickerData,
      monthLabel: stickerMonthLabel,
      onClose: () => setShowSticker(false)
    })
  );
};

export { SettlementScreen };
