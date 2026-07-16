import React from "react";
const { useState, useEffect, useMemo, useCallback } = React;
import {
  NAMES,
  MIN_TARGET,
  CUR_MONTH,
  CUR_YEAR,
  DAYS_IN_MON,
  DAY_OF_MON,
  TODAY_ISO,
  curKey,
  MONTH_NAMES,
  getDaysLeft,
  toISODate,
  getExpected,
  resolvePaceStatus,
  getStatus,
  isEarlyMonthNeutralWindow,
  getLeaderboardDisplayStatus,
  getLeaderboardDiffText,
  getPaceCheckMessage,
  lastWorkout,
  getSeasonOverrideForMonth,
  getMemberTargetInfoForMonth,
  getCurrentSitOutRequest,
  getRecentSitOutCount,
  getCurrentMonthSummary,
  buildSettlementReminderCards,
  buildSettlementPreviewCards,
  fmtCurrency,
  buildNormalizedSettings,
  getCountedLogs,
  getCountedLogCount,
  getMonthKeyFromISO,
  isJoinedForMonth,
  rebuildMonthSnapshot,
  getCurrentGroupMemberNames
} from "../lib/appState.js";
import {
  getGroupCloseMeta,
  groupStatusColor,
  leaderboardRowTint,
  buildLocalLeaderboardComparisonRows,
  formatWeeklyMvpLeaderText,
  formatWeekRangeLabel,
  buildLocalWeeklyMvpPreview
} from "../lib/utils.js";
import { Avatar, WorkoutTypeIcon, ChevronRightIcon, TargetHitHexIcon, StatusBadge, RankIcon, Bar, Card, PlayerProfileErrorBoundary } from "../components/primitives.jsx";
import { LogModal, DeleteModal, SitOutModal } from "../modals/modals.jsx";
import { PlayerProfile } from "../pages/PlayerProfile.jsx";

const FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const TodayPage = ({user,currentUserId,currentGroupId,groups,logs,excused,monthHistory,saving,onSave,onMultiLog,onLogMutation,clockTick,onViewLastMonth,onSitOutRequest,onSettlementClaimPaid,onSettlementConfirmPaid,onSettlementDisputePaid,navResetToken,showLog,setShowLog}) => {
  const [showExcuse,setShowExcuse]=useState(false);
  const [sitOutSubmitting,setSitOutSubmitting]=useState(false);
  const [sitOutError,setSitOutError]=useState("");
  const [viewPlayer,setViewPlayer]=useState(null);
  const [deleteTarget,setDeleteTarget]=useState(null);
  const [statDetail,setStatDetail]=useState(null);
  const [settlementCardBusy,setSettlementCardBusy]=useState(null);
  const [settlementConfirmPromptCard,setSettlementConfirmPromptCard]=useState(null);
  const [settlementDisputePromptCard,setSettlementDisputePromptCard]=useState(null);
  useEffect(()=>{ setViewPlayer(null); },[navResetToken]);
  useEffect(()=>{
    if(viewPlayer) window.scrollTo({top:0,left:0,behavior:"auto"});
  },[viewPlayer]);
  const currentGroup = groups.find(group => group.id === currentGroupId) || null;
  const closeMeta = currentGroup ? getGroupCloseMeta(currentGroup, new Date(clockTick)) : null;
  const closePillClass = `close-pill${closeMeta?.tone === "urgent" ? " urgent" : closeMeta?.tone === "critical" ? " critical" : ""}`;
  const groupSettings = currentGroup?.settings || buildNormalizedSettings({});
  const monthSummary = currentGroup ? getCurrentMonthSummary(currentGroup) : null;
  const currentSitOutRequest = currentGroup ? getCurrentSitOutRequest(currentGroup, user, curKey) : null;
  const recentSitOutCount = currentGroup ? getRecentSitOutCount(currentGroup, user, curKey) : 0;
  const currentMonthOverride = currentGroup ? getSeasonOverrideForMonth(currentGroup, curKey) : null;
  const isGroupAdmin = currentGroup?.adminName === user;
  const { target: myTarget, joinDay: myJoinDay = 1, proratedDays: myProratedDays } = currentGroup
    ? getMemberTargetInfoForMonth(currentGroup, user, curKey)
    : { target: MIN_TARGET };

  const myLogs=logs[user]||[];
  const countedMyLogs = getCountedLogs(myLogs);
  const isExcused=excused[user]?.[curKey]||false;
  const expected = myProratedDays
    ? Math.floor((myTarget / myProratedDays) * Math.max(0, DAY_OF_MON - myJoinDay + 1))
    : getExpected(myTarget);
  const myDaysActive = myProratedDays ? Math.max(0, DAY_OF_MON - myJoinDay + 1) : DAY_OF_MON;
  const sitOutMode = currentSitOutRequest?.status === "pending"
    ? null
    : (recentSitOutCount >= 1 ? "exceptional" : ((monthSummary?.day || DAY_OF_MON) <= 5 ? "instant" : "request"));

  const board=NAMES.filter(name=>isJoinedForMonth(name, curKey)).map(name=>{
    const count=getCountedLogCount(logs[name]||[]);
    const isOut=excused[name]?.[curKey]||false;
    const { target, joinDay=1, proratedDays, prorationSource } = currentGroup ? getMemberTargetInfoForMonth(currentGroup, name, curKey) : { target: MIN_TARGET };
    let status, memberDiffLabel;
    if (isOut) {
      status = "excused";
      memberDiffLabel = null;
    } else if (proratedDays) {
      const daysActive = Math.max(0, DAY_OF_MON - joinDay + 1);
      const expected = Math.floor((target / proratedDays) * daysActive);
      status = resolvePaceStatus({ count, target, expected, daysLeft: getDaysLeft() });
      const d = count - expected;
      memberDiffLabel = d > 0 ? `+${d} ahead of pace` : d < 0 ? `${d} behind pace` : "on pace";
    } else {
      status = getStatus(count, target);
      memberDiffLabel = null;
    }
    return {name,count,isOut,target,status,memberDiffLabel,prorated:prorationSource === "member"};
  }).sort((a,b)=>{if(a.isOut&&!b.isOut)return 1;if(!a.isOut&&b.isOut)return -1;return b.count-a.count||a.name.localeCompare(b.name);});

  let activeRank=0;
  const boardRanked=board.map(u=>{if(!u.isOut)activeRank++;return {...u,rank:u.isOut?null:activeRank};});
  const leaderboardRows = buildLocalLeaderboardComparisonRows(currentGroup, boardRanked) || boardRanked;
  const me=boardRanked.find(u=>u.name===user) || { count:0, rank:null, status:"behind", target:myTarget };
  const paceCheckMessage = getPaceCheckMessage({
    status: me.status,
    count: me.count,
    expected,
    target: myTarget,
    isFirstActiveDay: myDaysActive <= 1
  });
  const needed=Math.max(0,myTarget-me.count);

  let streak=0;
  for(let d=DAY_OF_MON;d>=1;d--){
    const iso=`${CUR_YEAR}-${String(CUR_MONTH+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    if(countedMyLogs.some(l=>l.date===iso))streak++;else break;
  }

  const doLog=async ({ workoutType, isoDate, targetGroupIds, note, photoUrl })=>{
    if (Array.isArray(targetGroupIds) && targetGroupIds.length) {
      setShowLog(false);
      const result = await onMultiLog({ workoutType, isoDate, targetGroupIds, note, photoUrl });
      return;
    }
    const newLog={date:isoDate,type:workoutType,id:String(Date.now()),note,photoUrl,createdAt:new Date().toISOString(),verifiedVia:"photo",reactions:{},flagStatus:null,flagReason:"",flagResponse:"",flaggedBy:null,decisionBy:null,decisionAt:null};
    const targetKey = getMonthKeyFromISO(isoDate);
    if (targetKey !== curKey) {
      const monthIndex = monthHistory.findIndex(month => month.key === targetKey);
      if (monthIndex === -1) {
        window.alert("That month is already closed and no editable snapshot was found.");
        return;
      }
      const targetMonth = monthHistory[monthIndex];
      const nextMonthLogs = [...(targetMonth.logsByUser?.[user] || []), newLog];
      const nextMonthHistory = [...monthHistory];
      nextMonthHistory[monthIndex] = rebuildMonthSnapshot(targetMonth, {
        ...(targetMonth.logsByUser || {}),
        [user]: nextMonthLogs
      });
      setShowLog(false);
      onSave({actor:user,logs,excused,monthHistory:nextMonthHistory,lastMonth:curKey});
      return;
    }
    const newLogs={...logs,[user]:[...(logs[user]||[]),newLog]};
    setShowLog(false);
    onSave({actor:user,logs:newLogs,excused,monthHistory,lastMonth:curKey});
  };

  const submitSitOut = async (reason) => {
    if (!onSitOutRequest || !sitOutMode) return;
    setSitOutSubmitting(true);
    setSitOutError("");
    const result = await onSitOutRequest({
      reason,
      exceptional: sitOutMode === "exceptional"
    });
    setSitOutSubmitting(false);
    if (!result?.ok) {
      setSitOutError(result?.error || "Unable to submit sit-out request.");
      return;
    }
    setShowExcuse(false);
  };

  const [previewSettlementCards, setPreviewSettlementCards] = useState([]);

  useEffect(() => {
    if (!currentGroup?.settlementConfirmationsPreviewMode) {
      setPreviewSettlementCards([]);
      return;
    }
    setPreviewSettlementCards(buildSettlementPreviewCards(user));
  }, [currentGroup?.id, currentGroup?.settlementConfirmationsPreviewMode, user]);

  const runSettlementCardAction = async (card, actionKind = card?.action?.kind) => {
    if (!card || !actionKind) return;
    if (currentGroup?.settlementConfirmationsPreviewMode) {
      setPreviewSettlementCards(cards => {
        if (actionKind === "claim") {
          return cards.map(entry => entry.key !== card.key ? entry : {
            ...entry,
            pending: true,
            label: "PENDING CONFIRMATION",
            labelColor: "#EF9F27",
            body: `Waiting for ${entry.receiverDisplayName} to confirm`,
            amountColor: "#EF9F27",
            statusTag: null,
            secondaryAction: null,
            action: null
          });
        }
        if (actionKind === "confirm") {
          return cards.filter(entry => entry.key !== card.key);
        }
        if (actionKind === "dispute") {
          return cards.map(entry => {
            if (
              entry.monthKey === card.monthKey
              && entry.payerDisplayName === card.payerDisplayName
              && entry.receiverDisplayName === card.receiverDisplayName
            ) {
              return {
                ...entry,
                pending: false,
                label: `OWED TO YOU${entry.monthKey !== curKey ? ` · ${entry.monthLabel.toUpperCase()}` : ""}`,
                labelColor: "#1a6b3a",
                body: `${entry.payerDisplayName} owes you`,
                amountColor: "#2ecc71",
                secondaryAction: null,
                action: null
              };
            }
            return entry;
          });
        }
        return cards;
      });
      return;
    }
    setSettlementCardBusy(card.key);
    const result = actionKind === "claim"
      ? await onSettlementClaimPaid?.({
          monthKey: card.monthKey,
          payerDisplayName: card.payerDisplayName,
          receiverDisplayName: card.receiverDisplayName,
          amount: card.amount,
          currency: card.currency
        })
      : actionKind === "confirm"
        ? await onSettlementConfirmPaid?.({
            monthKey: card.monthKey,
            payerDisplayName: card.payerDisplayName,
            receiverDisplayName: card.receiverDisplayName
          })
        : await onSettlementDisputePaid?.({
            monthKey: card.monthKey,
            payerDisplayName: card.payerDisplayName,
            receiverDisplayName: card.receiverDisplayName
          });
    setSettlementCardBusy(null);
    if (!result?.ok) {
      window.alert(result?.error || "Unable to update settlement");
    }
  };

  const handleSettlementCardAction = async (card, actionKind = card?.action?.kind) => {
    if (!card || !actionKind) return;
    if (actionKind === "dispute") {
      setSettlementDisputePromptCard(card);
      return;
    }
    if (actionKind === "confirm") {
      setSettlementConfirmPromptCard(card);
      return;
    }
    await runSettlementCardAction(card, actionKind);
  };

  const barColor=s=>s==="cruising"?"#CBD5E1":s==="on-track"?"#5ABF5A":s==="at-risk"?"#D4A843":s==="behind"?"#D47843":"#D44A4A";
  const monthHistoryByKey = useMemo(() => {
    const map = new Map();
    monthHistory.forEach(month => {
      if (month?.key) map.set(month.key, month);
    });
    return map;
  }, [monthHistory]);
  const currentMonthLogMap = useMemo(() => {
    const map = new Map();
    Object.entries(logs || {}).forEach(([memberName, memberLogs]) => {
      (memberLogs || []).forEach(log => {
        if (log?.date) map.set(`${memberName}:${log.date}`, log);
      });
    });
    return map;
  }, [logs]);
  const currentWeekStart = useMemo(() => {
    const start = new Date(CUR_YEAR, CUR_MONTH, DAY_OF_MON);
    const mondayIndex = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayIndex);
    start.setHours(0,0,0,0);
    return start;
  }, [CUR_YEAR, CUR_MONTH, DAY_OF_MON]);
  const currentWeekEnd = useMemo(() => {
    const end = new Date(currentWeekStart);
    end.setDate(currentWeekStart.getDate() + 6);
    end.setHours(23,59,59,999);
    return end;
  }, [currentWeekStart]);
  const currentWeekDays = useMemo(() =>
    Array.from({length:7}, (_, index) => {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + index);
      return date;
    }),
  [currentWeekStart]);
  const currentMonthKey = `${CUR_YEAR}-${CUR_MONTH}`;
  const currentMonthLabel = `${FULL_MONTH_NAMES[CUR_MONTH] || MONTH_NAMES[CUR_MONTH]} '${String(CUR_YEAR).slice(-2)}`;
  const todayHeaderMonthName = FULL_MONTH_NAMES[CUR_MONTH] || MONTH_NAMES[CUR_MONTH];
  const expandMonthLabel = label => String(label || "").replace(/^([A-Z][a-z]{2})\s+'(\d{2})$/, (_, shortName, year) => `${FULL_MONTH_NAMES[MONTH_NAMES.indexOf(shortName)] || shortName} '${year}`);
  const blocMonthHistoryRows = useMemo(() => {
    const closedRows = [...monthHistory]
      .filter(month => month?.key && month.key !== currentMonthKey)
      .sort((a,b)=>b.key.localeCompare(a.key))
      .map(month => ({
        key: month.key,
        label: expandMonthLabel(month.label),
        total: Object.values(month.counts || {}).reduce((sum, count) => sum + (Number(count) || 0), 0),
        isCurrent: false
      }));
    const rows = [
      {
        key: currentMonthKey,
        label: currentMonthLabel,
        total: Object.values(logs || {}).reduce((sum, memberLogs) => sum + getCountedLogCount(memberLogs), 0),
        isCurrent: true
      },
      ...closedRows
    ];
    const maxTotal = rows.reduce((max, month) => Math.max(max, month.total), 0) || 1;
    return rows.map((month, index) => {
      const olderMonth = rows[index + 1] || null;
      const delta = !month.isCurrent && olderMonth ? month.total - olderMonth.total : null;
      return {
        ...month,
        delta,
        barWidth: `${Math.max(8, Math.round((month.total / maxTotal) * 100))}%`
      };
    });
  }, [monthHistory, currentMonthKey, currentMonthLabel, logs]);

  const lastClosedMonth = monthHistory.length ? [...monthHistory].sort((a,b)=>b.key.localeCompare(a.key))[0] : null;
  const showLastMonthBanner = (monthSummary?.day || DAY_OF_MON) <= 5;
  const lastMonthBanner = showLastMonthBanner && lastClosedMonth && onViewLastMonth
    ? React.createElement('button',{onClick:onViewLastMonth,style:{width:"100%",textAlign:"left",background:"radial-gradient(circle at top right, rgba(78,205,196,.10) 0%, transparent 45%), linear-gradient(135deg, rgba(8,20,20,1) 0%, rgba(6,13,13,1) 55%, rgba(7,10,14,1) 100%)",border:"0.5px solid #0D2828",borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}},
        React.createElement('div',null,
          React.createElement('div',{style:{fontSize:9,color:"#4ECDC4",textTransform:"uppercase",letterSpacing:".12em",marginBottom:3,fontFamily:"'Outfit',sans-serif",fontWeight:700}},"Last month"),
          React.createElement('div',{style:{fontSize:14,fontWeight:700,color:"var(--text)"}},`${lastClosedMonth.label} results are in`),
          React.createElement('div',{style:{fontSize:12,color:"var(--muted)",marginTop:2}},"See how you finished.")
        ),
        React.createElement('span',{style:{fontSize:18,color:"#4ECDC4"}},"→")
      )
    : null;
  const settlementReminderCards = currentGroup?.settlementConfirmationsPreviewMode
    ? previewSettlementCards
    : (currentGroup ? buildSettlementReminderCards(currentGroup, currentUserId, user) : []);
  const showSettlementReminderSlot = !showLastMonthBanner && settlementReminderCards.length > 0;
  const leaderboardRowBaseStyle = {
    width:"100%",
    background:"#080F0F",
    border:"0.5px solid #0D1F1E",
    borderRadius:8,
    padding:"8px 10px",
    boxShadow:"inset 0 1px 0 rgba(255,255,255,0.04)",
    cursor:"pointer"
  };
  const leaderboardRowBackground = status => {
    const tint = leaderboardRowTint(status);
    return `radial-gradient(circle at 10% 0%, rgba(255,255,255,.018), transparent 34%), radial-gradient(circle at 94% 0%, rgba(78,205,196,.018), transparent 40%), linear-gradient(180deg, rgba(255,255,255,.014), rgba(0,0,0,.018)), ${tint}`;
  };
  const leaderboardRowShadow = "inset 0 1px 0 rgba(255,255,255,.045), 0 3px 8px rgba(0,0,0,.055)";

  const competitionStatusBody = isExcused
    ? React.createElement('div',{style:{display:"grid",gap:4}},
        React.createElement('div',{style:{fontSize:13,color:"var(--text)",fontWeight:600}},`You're sitting out ${MONTH_NAMES[CUR_MONTH]}.`),
        React.createElement('div',{style:{fontSize:12,color:"var(--muted)"}},"You won't pay or collect anything.")
      )
    : currentSitOutRequest?.status === "pending"
      ? React.createElement('div',{style:{fontSize:13,color:"var(--muted)",lineHeight:1.45}},
          currentSitOutRequest.exceptional
            ? "Exceptional sit-out requested. Awaiting approval from the bloc admin."
            : "Sit-out requested. Awaiting approval from the bloc admin."
        )
      : currentSitOutRequest?.status === "declined"
        ? React.createElement('div',{style:{fontSize:13,color:"var(--muted)",lineHeight:1.45}},"Your sit-out request was declined.")
        : React.createElement('div',{style:{fontSize:13,color:"var(--muted)",lineHeight:1.45}},"If you're injured, traveling, or need this month off, you can sit out.");

  const competitionAction = isExcused || currentSitOutRequest?.status === "pending"
    ? null
    : React.createElement('button',{
        onClick:()=>{ setSitOutError(""); setShowExcuse(true); },
        style:{
          background:currentSitOutRequest?.status === "declined"?"var(--s2)":"var(--s3)",
          border:`1px solid ${currentSitOutRequest?.status === "declined"?"var(--border)":"var(--border2)"}`,
          color:"var(--muted)",
          padding:"7px 12px",
          borderRadius:8,
          fontSize:12,
          fontWeight:700,
          whiteSpace:"nowrap"
        }
      },currentSitOutRequest?.status === "declined"?"Request again":"Sit out");

  const paceDelta = me.count - expected;
  const earlyMonthPaceQuiet = isEarlyMonthNeutralWindow() && me.count === 0;
  const paceDeltaText = earlyMonthPaceQuiet ? "—" : (paceDelta > 0 ? `+${paceDelta} ahead` : (paceDelta < 0 ? `${paceDelta} behind` : "on pace"));
  const paceDeltaColor = earlyMonthPaceQuiet ? "var(--muted)" : (paceDelta >= 0 ? "#4ECDC4" : "#D47843");
  const todayTargetText = earlyMonthPaceQuiet ? "month just started" : `${expected} by today`;
  const paceValueStyle = !earlyMonthPaceQuiet
    ? {
        fontSize:paceDelta === 0 ? "clamp(11px, 1.45vw, 17px)" : "clamp(10px, 1.25vw, 14px)",
        fontWeight:700,
        letterSpacing:"0.01em",
        whiteSpace:"nowrap"
      }
    : null;
  const targetCardMeta = (currentMonthOverride?.prorated || myTarget !== MIN_TARGET) ? "prorated" : null;

  const blocMonthCount = Object.values(logs || {}).reduce((total, memberLogs) => total + getCountedLogCount(memberLogs), 0);
  const getMemberLogForIso = (memberName, isoDate) => {
    if (!memberName || !isoDate) return null;
    const currentMonthMatch = currentMonthLogMap.get(`${memberName}:${isoDate}`);
    if (currentMonthMatch) return currentMonthMatch;
    const month = monthHistoryByKey.get(getMonthKeyFromISO(isoDate));
    if (!month?.logsByUser?.[memberName]) return null;
    return (month.logsByUser[memberName] || []).find(log => log?.date === isoDate) || null;
  };
  const weeklySourceNames = currentGroup ? getCurrentGroupMemberNames(currentGroup) : Object.keys(logs || {});
  const weeklyCounts = weeklySourceNames.map(memberName => ({
    name: memberName,
    count: currentWeekDays.reduce((total, date) => {
      const iso = toISODate(date);
      return total + (getMemberLogForIso(memberName, iso) ? 1 : 0);
    }, 0)
  }));
  const topWeeklyCount = weeklyCounts.reduce((max, member) => Math.max(max, member.count), 0);
  const weeklyLeaders = weeklyCounts.filter(member => member.count === topWeeklyCount && member.count > 0);
  const weeklyMvpValue = topWeeklyCount === 0
    ? "—"
    : weeklyLeaders.length === 1
      ? weeklyLeaders[0].name
      : weeklyLeaders.length === 2
        ? "Tied"
        : `${weeklyLeaders.length}-way tie`;
  const renderMonthLogCalendar = ({memberName, title, year, monthIndex, logsByDay}) => {
    const firstDay = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const calDays = [...Array(firstDay).fill(null), ...Array.from({length: daysInMonth}, (_, i) => i + 1)];
    return React.createElement(Card,{style:{padding:15}},
      React.createElement('span',{className:"lbl"},title),
      React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:6,marginTop:8}},
        ["S","M","T","W","T","F","S"].map((d, i)=>React.createElement('div',{key:`${memberName}-head-${d}-${i}`,className:"mono",style:{fontSize:10,color:"var(--muted)",textAlign:"center"}},d)),
        calDays.map((day,index)=>{
          const log = day ? logsByDay[day] : null;
          const isToday = year === CUR_YEAR && monthIndex === CUR_MONTH && day === DAY_OF_MON;
          return React.createElement('div',{key:`${memberName}-day-${index}`,style:{
            aspectRatio:"1 / 1",
            minHeight:34,
            borderRadius:10,
            border:log?"1px solid rgba(78,205,196,.2)":`1px solid ${isToday ? "rgba(78,205,196,.28)" : "var(--border)"}`,
            background:log?"#1A2E4A":"var(--s2)",
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            color:log?"#4ECDC4":isToday?"#4ECDC4":"var(--muted)",
            fontSize:11,
            fontWeight:log?700:500
          }},
            !day
              ? null
              : log
                ? React.createElement(WorkoutTypeIcon,{type:log.type,size:16})
                : day
          );
        })
      )
    );
  };
  const weeklyStripLeaders = topWeeklyCount === 0
    ? []
    : weeklyLeaders.map(leader => ({
        name: leader.name,
        logsByIso: currentWeekDays.reduce((acc, date) => {
          const iso = toISODate(date);
          const log = getMemberLogForIso(leader.name, iso);
          if (log) acc[iso] = log;
          return acc;
        }, {})
      }));
  const weeklyMvpHistoryRows = useMemo(() => {
    const monthStart = new Date(CUR_YEAR, CUR_MONTH, 1);
    const monthEnd = new Date(CUR_YEAR, CUR_MONTH + 1, 0);
    const todayDate = new Date(CUR_YEAR, CUR_MONTH, DAY_OF_MON);
    const firstWeekStart = new Date(monthStart);
    const firstWeekMondayIndex = (firstWeekStart.getDay() + 6) % 7;
    firstWeekStart.setDate(firstWeekStart.getDate() - firstWeekMondayIndex);
    firstWeekStart.setHours(0,0,0,0);
    const rows = [];
    let bucketStart = new Date(firstWeekStart);
    let weekIndex = 1;
    while (bucketStart <= monthEnd) {
      const bucketEnd = new Date(bucketStart);
      bucketEnd.setDate(bucketStart.getDate() + 6);
      bucketEnd.setHours(23,59,59,999);
      const isCurrentBucket = todayDate >= bucketStart && todayDate <= bucketEnd;
      if (!isCurrentBucket) {
        const bucketDays = Array.from({length: 7}, (_, index) => {
          const date = new Date(bucketStart);
          date.setDate(bucketStart.getDate() + index);
          return date;
        });
        const counts = weeklySourceNames.map(memberName => ({
          name: memberName,
          count: bucketDays.reduce((total, date) => {
            const iso = toISODate(date);
            return total + (getMemberLogForIso(memberName, iso) ? 1 : 0);
          }, 0)
        }));
        const topCount = counts.reduce((max, entry) => Math.max(max, entry.count), 0);
        if (topCount > 0) {
          const leaders = counts.filter(entry => entry.count === topCount).map(entry => entry.name);
          rows.push({
            key: `week-${weekIndex}`,
            label: `Week ${weekIndex}`,
            rangeLabel: formatWeekRangeLabel(bucketStart, bucketEnd),
            leaders,
            count: topCount,
            isTie: leaders.length > 1
          });
        }
      }
      bucketStart = new Date(bucketEnd);
      bucketStart.setDate(bucketStart.getDate() + 1);
      weekIndex += 1;
    }
    return rows;
  }, [CUR_YEAR, CUR_MONTH, DAY_OF_MON, currentMonthLogMap, monthHistoryByKey, weeklySourceNames]);
  const localWeeklyMvpPreview = buildLocalWeeklyMvpPreview(currentGroup, currentWeekDays);
  const weeklyMvpDisplayValue = localWeeklyMvpPreview?.currentWeekValue || weeklyMvpValue;
  const weeklyMvpDisplayLeaders = localWeeklyMvpPreview?.currentWeekLeaders || weeklyStripLeaders;
  const weeklyMvpDisplayHistory = localWeeklyMvpPreview?.previousWeeks || weeklyMvpHistoryRows;
  const currentWeekRangeLabel = formatWeekRangeLabel(currentWeekStart, currentWeekEnd);
  const weeklyMvpValueStyle = {
    fontSize: weeklyMvpDisplayValue.length > 11 ? 10.5 : weeklyMvpDisplayValue.length > 8 ? 11.5 : 12,
    lineHeight: 1.05,
    whiteSpace: "nowrap",
    justifyContent: "center",
    textAlign: "center",
    width: "100%",
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    minWidth: 0
  };
  const blocMonthValueStyle = {
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1,
    justifyContent: "center",
    textAlign: "center",
    width: "100%",
    fontFamily: "'Outfit', sans-serif"
  };
  const mobileStatLabelStyle = {fontSize:8,marginBottom:0,whiteSpace:"nowrap",letterSpacing:".07em",fontWeight:700,color:"#8FAEAA",fontFamily:"'Outfit', sans-serif",textAlign:"center",width:"100%"};
  const desktopStatLabelStyle = {fontSize:9,marginBottom:0,whiteSpace:"nowrap",letterSpacing:".07em",fontWeight:700,color:"#8FAEAA",fontFamily:"'Outfit', sans-serif",textAlign:"center",width:"100%"};
  const mobileStatSubStyle = {fontSize:8.5,color:"var(--muted)",marginTop:3,lineHeight:1.15,minHeight:20,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",fontFamily:"'Outfit', sans-serif",width:"100%",whiteSpace:"nowrap"};
  const desktopStatSubStyle = {fontSize:10,color:"var(--muted)",marginTop:4,lineHeight:1.15,minHeight:24,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",fontFamily:"'Outfit', sans-serif",width:"100%",whiteSpace:"nowrap"};
  const statCardSurfaceStyle = {
    background:"linear-gradient(180deg, #080F0F 0%, #0A1314 100%)",
    border:"0.5px solid #152827",
    boxShadow:"inset 0 1px 0 rgba(255,255,255,.025)",
    display:"flex",
    flexDirection:"column",
    alignItems:"center",
    textAlign:"center",
    cursor:"pointer"
  };
  const mobileStatCardStyle = {...statCardSurfaceStyle,padding:"8px 10px",minHeight:74};
  const desktopStatCardStyle = {...statCardSurfaceStyle,padding:"10px 12px",minHeight:106};

  const statCards = [
    needed === 0
      ? {kind:"target",label:"Target",valueNode:React.createElement(TargetHitHexIcon,{size:22}),sub:"target hit!",meta:targetCardMeta}
      : {kind:"target",label:"Target",val:needed,sub:"more to go",meta:targetCardMeta,color:"#4ECDC4"},
    {kind:"pace",label:"Pace Check",val:paceDeltaText,sub:todayTargetText,color:paceDeltaColor,valueStyle:paceValueStyle},
    {kind:"week-mvp",label:"Week's MVP",val:weeklyMvpDisplayValue,sub:"most logs this week",color:"var(--text)",valueStyle:weeklyMvpValueStyle},
    {kind:"bloc-month",label:"Bloc Month",val:blocMonthCount,sub:"workouts logged",color:"var(--text)",valueStyle:blocMonthValueStyle}
  ];
  const desktopLogsByDay = {};
  (logs[user] || []).forEach(log => {
    const day = Number(String(log.date || "").split("-")[2]);
    if (Number.isFinite(day)) desktopLogsByDay[day] = log;
  });
  const desktopCalendarCard = !isExcused && renderMonthLogCalendar({
    memberName: user,
    title: `${MONTH_NAMES[CUR_MONTH]} · Your Log`,
    year: CUR_YEAR,
    monthIndex: CUR_MONTH,
    logsByDay: desktopLogsByDay
  });
  const settlementReminderSlot = showSettlementReminderSlot && React.createElement(Card,{style:{padding:"9px 10px",display:"flex",flexDirection:"column",gap:6,background:"#0A1412",border:"0.5px solid #163d36",boxShadow:"inset 0 1px 0 rgba(78,205,196,.03)"}},
    React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}},
      React.createElement('span',{className:"lbl",style:{fontSize:8,marginBottom:0,color:"#7DB8B1",fontFamily:"'Outfit', sans-serif",fontWeight:700}},"Settlement reminders"),
      React.createElement('span',{style:{fontSize:9,color:"#6B9690",fontFamily:"'Outfit', sans-serif",fontWeight:500}},`${settlementReminderCards.length} unpaid`)
    ),
    settlementReminderCards.map(card => React.createElement('div',{key:card.key,style:{border:"0.5px solid #0D1F1E",borderRadius:9,padding:"6px 10px",display:"grid",gap:2,background:"#080F0F",fontFamily:"'Outfit', sans-serif",position:"relative"}},
      React.createElement('div',{style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}},
        React.createElement('div',{style:{minWidth:0,flex:1,display:"grid",gap:1}},
          React.createElement('div',{style:{fontSize:8,color:"#89A39E",letterSpacing:".12em",textTransform:"uppercase",fontFamily:"'Outfit', sans-serif",fontWeight:600}},card.monthLabel || card.month || card.label),
        )
      ),
      React.createElement('div',{style:{minWidth:0,flex:1,fontSize:11,color:"var(--text)",lineHeight:1.25,fontFamily:"'Outfit', sans-serif",fontWeight:500}},card.body),
      React.createElement('div',{style:{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center",gap:8,flexShrink:0}},
        React.createElement('div',{style:{fontSize:12,fontWeight:600,color:card.amountColor,whiteSpace:"nowrap",fontFamily:"'Outfit', sans-serif"}},fmtCurrency(card.amount, card.currency)),
        card.secondaryAction && React.createElement('button',{
          onClick:()=>handleSettlementCardAction(card, card.secondaryAction.kind),
          disabled:settlementCardBusy===card.key,
          style:{
            fontSize:8,
            fontWeight:800,
            lineHeight:1,
            padding:"3px 6px",
            borderRadius:999,
            background:"transparent",
            border:"1px solid rgba(123,142,139,.42)",
            color:"#6B9690",
            whiteSpace:"nowrap",
            fontFamily:"'Outfit', sans-serif"
          }
        }, card.secondaryAction.label),
        card.action && React.createElement('button',{
          onClick:()=>handleSettlementCardAction(card, card.action.kind),
          disabled:settlementCardBusy===card.key,
          style:{
            fontSize:8,
            fontWeight:800,
            lineHeight:1,
            padding:"4px 8px",
            borderRadius:999,
            background:card.action.kind === "confirm" ? "rgba(239,159,39,.10)" : "rgba(224,80,32,.035)",
            border:`1px solid ${card.action.kind === "confirm" ? "rgba(239,159,39,.32)" : "rgba(224,80,32,.12)"}`,
            color:card.action.kind === "confirm" ? "rgba(239,176,75,.82)" : "rgba(240,109,67,.58)",
            whiteSpace:"nowrap",
            fontFamily:"'Outfit', sans-serif"
          }
        }, settlementCardBusy===card.key ? "Saving..." : card.action.label)
      )
    ))
  );
  const settlementDisputePrompt = settlementDisputePromptCard && React.createElement('div',{className:"overlay center-mobile",onClick:()=>setSettlementDisputePromptCard(null)},
    React.createElement('div',{className:"modal pi",onClick:e=>e.stopPropagation(),style:{maxWidth:320,padding:"18px 16px",textAlign:"center"}},
      React.createElement('div',{style:{fontSize:18,fontWeight:800,color:"var(--text)",marginBottom:8}},"Dispute this payment?"),
      React.createElement('div',{style:{display:"flex",gap:10,marginTop:16}},
        React.createElement('button',{
          onClick:()=>setSettlementDisputePromptCard(null),
          style:{
            flex:1,
            padding:"10px 12px",
            borderRadius:12,
            border:"1px solid var(--border)",
            background:"var(--s2)",
            color:"var(--muted)",
            fontWeight:700
          }
        },"Cancel"),
        React.createElement('button',{
          onClick:async()=>{
            const card = settlementDisputePromptCard;
            setSettlementDisputePromptCard(null);
            await runSettlementCardAction(card, "dispute");
          },
          style:{
            flex:1,
            padding:"10px 12px",
            borderRadius:12,
            border:"1px solid rgba(224,80,32,.42)",
            background:"rgba(224,80,32,.14)",
            color:"#F06D43",
            fontWeight:800
          }
        },"Dispute")
      )
    )
  );
  const settlementConfirmPrompt = settlementConfirmPromptCard && React.createElement('div',{className:"overlay center-mobile",onClick:()=>setSettlementConfirmPromptCard(null)},
    React.createElement('div',{className:"modal pi",onClick:e=>e.stopPropagation(),style:{maxWidth:320,padding:"18px 16px",textAlign:"center"}},
      React.createElement('div',{style:{fontSize:18,fontWeight:800,color:"var(--text)",marginBottom:8}},"Confirm this payment?"),
      React.createElement('div',{style:{display:"flex",gap:10,marginTop:16}},
        React.createElement('button',{
          onClick:()=>setSettlementConfirmPromptCard(null),
          style:{
            flex:1,
            padding:"10px 12px",
            borderRadius:12,
            border:"1px solid var(--border)",
            background:"var(--s2)",
            color:"var(--muted)",
            fontWeight:700
          }
        },"Cancel"),
        React.createElement('button',{
          onClick:async()=>{
            const card = settlementConfirmPromptCard;
            setSettlementConfirmPromptCard(null);
            await runSettlementCardAction(card, "confirm");
          },
          style:{
            flex:1,
            padding:"10px 12px",
            borderRadius:12,
            border:"1px solid rgba(239,159,39,.45)",
            background:"rgba(239,159,39,.14)",
            color:"#EFB04B",
            fontWeight:800
          }
        },"Confirm")
      )
    )
  );
  const renderWeeklyStrip = (memberName, logsByIso) => React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:4,marginTop:4}},
    currentWeekDays.map((date, index) => {
      const iso = toISODate(date);
      const log = logsByIso?.[iso] || null;
      const isToday = iso === TODAY_ISO;
      return React.createElement('div',{key:`${memberName}-${iso}`,style:{display:"grid",gap:4,justifyItems:"center"}},
        React.createElement('span',{className:"mono",style:{fontSize:8,color:isToday ? "#4ECDC4" : "var(--muted2)"}},["M","T","W","T","F","S","S"][index]),
        React.createElement('div',{style:{display:"grid",justifyItems:"center",rowGap:4}},
          log
            ? React.createElement('div',{style:{
                width:30,
                minHeight:34,
                borderRadius:9,
                border:isToday ? "1px solid rgba(78,205,196,.55)" : "1px solid rgba(78,205,196,.32)",
                background:"rgba(78,205,196,.08)",
                display:"grid",
                gridTemplateRows:"auto 1fr",
                alignItems:"center",
                justifyItems:"center",
                padding:"2px 2px 3px",
                color:"#4ECDC4",
                boxShadow:isToday ? "0 0 0 1px rgba(78,205,196,.08) inset" : "none"
              }},
                React.createElement('span',{className:"mono",style:{fontSize:8,color:isToday ? "#8EE7DF" : "var(--muted)",lineHeight:1}},date.getDate()),
                React.createElement('span',{style:{width:16,height:16,display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#4ECDC4"}},React.createElement(WorkoutTypeIcon,{type:log.type,size:13}))
              )
            : React.createElement('div',{style:{
                width:30,
                minHeight:34,
                display:"flex",
                alignItems:"center",
                justifyContent:"center",
                color:"rgba(255,255,255,.38)"
              }},
                React.createElement('span',{className:"mono",style:{fontSize:8,lineHeight:1}},date.getDate())
              ),
          React.createElement('span',{style:{
            width:4,
            height:4,
            borderRadius:999,
            background:"#4ECDC4",
            opacity:isToday ? 1 : 0
          }})
        )
      );
    })
  );
  const statDetailOverlay = statDetail && React.createElement('div',{className:"overlay center-mobile",onClick:()=>setStatDetail(null)},
    React.createElement('div',{className:"modal pi",onClick:e=>e.stopPropagation(),style:{width:"min(680px, calc(100vw - 28px))",maxHeight:"min(80vh, 760px)",overflow:"auto",padding:"18px 16px 16px",display:"grid",gap:14}},
      React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}},
        React.createElement('div',{style:{fontSize:18,fontWeight:800,color:"var(--text)"}},
          statDetail.kind === "pace"
            ? "Pace Detail"
            : statDetail.kind === "target"
              ? `${MONTH_NAMES[CUR_MONTH]} · Your Log`
              : statDetail.kind === "week-mvp"
                ? "Week's MVP"
                : "Bloc Month History"
        ),
        React.createElement('button',{
          onClick:()=>setStatDetail(null),
          style:{background:"var(--s2)",border:"1px solid var(--border)",borderRadius:10,color:"var(--muted)",padding:"7px 10px",fontSize:12,fontWeight:700}
        },"Close")
      ),
      statDetail.kind === "pace" && React.createElement(React.Fragment,null,
        React.createElement(Bar,{value:me.count,max:Math.max(expected,1),color:barColor(me.status),h:5}),
        React.createElement('div',{style:{fontSize:15,fontWeight:800,color:groupStatusColor(me.status)}},paceCheckMessage),
        React.createElement('div',{style:{display:"grid",gap:6,fontSize:13,color:"var(--muted)"}},
          React.createElement('div',null,`Target by today: ${expected}`),
          React.createElement('div',null,`${getDaysLeft()} days left`)
        )
      ),
      statDetail.kind === "target" && renderMonthLogCalendar({
        memberName: user,
        title: `${MONTH_NAMES[CUR_MONTH]} · Your Log`,
        year: CUR_YEAR,
        monthIndex: CUR_MONTH,
        logsByDay: desktopLogsByDay
      }),
      statDetail.kind === "week-mvp" && React.createElement('div',{style:{display:"grid",gap:12}},
        React.createElement('div',{style:{display:"grid",gap:8}},
          React.createElement('div',{style:{display:"flex",alignItems:"baseline",gap:6,flexWrap:"wrap"}},
            React.createElement('div',{style:{fontSize:9,color:"#8FAEAA",textTransform:"uppercase",letterSpacing:".12em",fontFamily:"'Outfit',sans-serif",fontWeight:700}},"This week"),
            currentWeekRangeLabel && React.createElement('span',{style:{fontSize:10,color:"var(--muted2)",fontFamily:"'Outfit',sans-serif",fontWeight:400,whiteSpace:"nowrap"}},`(${currentWeekRangeLabel})`)
          ),
          weeklyMvpDisplayLeaders.length
            ? weeklyMvpDisplayLeaders.map(entry => React.createElement(Card,{key:entry.name,style:{padding:"10px 12px",background:"#080F0F",border:"0.5px solid #122424"}},
                React.createElement('div',{style:{display:"grid",justifyItems:"center",gap:2,marginBottom:6}},
                  React.createElement('div',{style:{fontSize:15,fontWeight:700,color:"var(--text)",fontFamily:"'Outfit',sans-serif",textAlign:"center"}},entry.name),
                  React.createElement('div',{style:{fontSize:12,fontWeight:500,color:"#4ECDC4",opacity:.85,fontFamily:"'Outfit',sans-serif",textAlign:"center"}},
                    `${Object.keys(entry.logsByIso || {}).length} workout${Object.keys(entry.logsByIso || {}).length === 1 ? "" : "s"} this week`
                  )
                ),
                renderWeeklyStrip(entry.name, entry.logsByIso)
              ))
            : React.createElement(Card,{style:{padding:14}},
                React.createElement('div',{style:{fontSize:14,color:"var(--muted)"}},"No workouts logged this week")
              )
        ),
        weeklyMvpDisplayHistory.length > 0 && React.createElement('div',{style:{display:"grid",gap:8}},
          React.createElement('div',{style:{fontSize:9,color:"#8FAEAA",textTransform:"uppercase",letterSpacing:".12em",fontFamily:"'Outfit',sans-serif",fontWeight:700,paddingTop:2}},"Earlier this month"),
          React.createElement(Card,{style:{padding:"10px 12px",background:"#080F0F",border:"0.5px solid #122424",display:"grid",gap:10}},
            weeklyMvpDisplayHistory.map((entry, index) => React.createElement('div',{key:entry.key || entry.label,style:{
              display:"grid",
              gridTemplateColumns:"minmax(0,1fr) auto",
              columnGap:12,
              rowGap:3,
              alignItems:"center",
              paddingBottom:index < weeklyMvpDisplayHistory.length - 1 ? 10 : 0,
              borderBottom:index < weeklyMvpDisplayHistory.length - 1 ? "0.5px solid #122424" : "none"
            }},
              React.createElement(React.Fragment,null,
                React.createElement('div',{style:{display:"flex",alignItems:"baseline",gap:6,gridColumn:"1",gridRow:"1",minWidth:0}},
                  React.createElement('span',{style:{fontSize:10,color:"#8FAEAA",textTransform:"uppercase",letterSpacing:".1em",fontFamily:"'Outfit',sans-serif",fontWeight:700}},entry.label),
                  entry.rangeLabel && React.createElement('span',{style:{fontSize:10,color:"var(--muted2)",fontFamily:"'Outfit',sans-serif",fontWeight:400,whiteSpace:"nowrap"}},`(${entry.rangeLabel})`)
                ),
                React.createElement('div',{style:{fontSize:14,color:"var(--text)",fontFamily:"'Outfit',sans-serif",fontWeight:400,gridColumn:"1",gridRow:"2"}},
                  formatWeeklyMvpLeaderText(entry.leaders)
                ),
                React.createElement('div',{style:{fontSize:13,color:"var(--muted)",fontFamily:"'Outfit',sans-serif",fontWeight:400,whiteSpace:"nowrap",textAlign:"right",gridColumn:"2",gridRow:"1 / span 2"}},
                  `${entry.count} workout${entry.count === 1 ? "" : "s"}`
                )
              )
            ))
          )
        )
      ),
      statDetail.kind === "bloc-month" && React.createElement(Card,{style:{padding:0,overflow:"hidden"}},
        blocMonthHistoryRows.length
          ? blocMonthHistoryRows.map((month, index) => React.createElement('div',{key:month.key,style:{
              position:"relative",
              display:"flex",
              alignItems:"center",
              justifyContent:"space-between",
              gap:12,
              padding:"14px 14px",
              borderBottom:index < blocMonthHistoryRows.length - 1 ? "1px solid var(--border)" : "none",
              background:month.isCurrent ? "rgba(78,205,196,.06)" : "transparent",
              boxShadow:month.isCurrent ? "inset 2px 0 0 #4ECDC4" : "none"
            }},
              React.createElement('span',{style:{fontSize:14,fontWeight:600,color:"var(--text)",position:"relative",zIndex:1}},month.label),
              React.createElement('div',{style:{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,position:"relative",zIndex:1}},
                React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8}},
                  React.createElement('span',{className:"mono",style:{fontSize:13,color:month.isCurrent ? "#8EE7DF" : "var(--muted)"}},month.total),
                  month.delta !== null && React.createElement('span',{className:"mono",style:{
                    fontSize:11,
                    color:month.delta > 0 ? "#4ECDC4" : month.delta < 0 ? "#6B9690" : "var(--muted2)"
                  }},
                    month.delta > 0 ? "↑" : month.delta < 0 ? "↓" : "→"
                  )
                ),
                React.createElement('span',{style:{fontSize:10,color:"var(--muted2)",whiteSpace:"nowrap"}},"workouts logged")
              )
            ))
          : React.createElement('div',{style:{padding:"14px 16px",fontSize:13,color:"var(--muted)"}},"No previous months yet")
      )
    )
  );

  const mobileView = React.createElement('div',{className:"mobile-only",style:{padding:"12px 14px 0",display:"flex",flexDirection:"column",gap:12}},
    React.createElement('div',{style:{display:"grid",gap:10}},
      React.createElement('div',{style:{minWidth:0,flex:1}},
        React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:9,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".12em"}},`${todayHeaderMonthName} · Day ${DAY_OF_MON}/${DAYS_IN_MON}`),
      ),
    ),
    lastMonthBanner,
!isExcused&&React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:6,paddingBottom:2}},
  statCards.map(s=>React.createElement(Card,{key:s.label,onClick:()=>setStatDetail({kind:s.kind}),style:mobileStatCardStyle},
    React.createElement('span',{className:"lbl",style:mobileStatLabelStyle},s.label),
    React.createElement('div',{style:{width:"100%",display:"flex",flexDirection:"column",alignItems:"center",paddingTop:8}},
      React.createElement('div',{style:Object.assign({fontSize:16,fontWeight:800,color:s.color || "#4ECDC4",lineHeight:1,minHeight:16,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",whiteSpace:"nowrap",width:"100%",fontFamily:"'Outfit', sans-serif"}, s.valueStyle || {})},s.valueNode || s.val),
      React.createElement('div',{style:mobileStatSubStyle},s.sub),
      s.meta && React.createElement('div',{className:"mono",style:{fontSize:7,color:"#4ECDC4",marginTop:1,textTransform:"uppercase",letterSpacing:".1em"}},s.meta)
    )
  ))
),
    settlementReminderSlot,
    React.createElement(Card,null,
      React.createElement('div',{style:{padding:"11px 14px",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center"}},
        React.createElement('div',{style:{fontWeight:600,fontSize:15}},"Bloc Leaderboard")
      ),
      React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:4,padding:"8px"}},
      leaderboardRows.map(u=>{
        const isMe=u.name===user;
        const displayStatus = getLeaderboardDisplayStatus(u.status, u.count);
        const earlyMonthQuiet = !u.isOut && isEarlyMonthNeutralWindow() && u.count === 0;
        const aArr=leaderboardRows.filter(x=>!x.isOut);
        const aIdx=aArr.findIndex(x=>x.name===u.name);
        return React.createElement('button',{key:u.key || u.name,type:"button",onClick:()=>setViewPlayer(u.name),
          style:{...leaderboardRowBaseStyle,borderColor:isMe&&!u.isOut?"#163d36":"#0D1F1E",background:leaderboardRowBackground(displayStatus),boxShadow:leaderboardRowShadow,opacity:u.isOut?.55:1}},
          React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}},
            React.createElement('div',{style:{flex:1,minWidth:0,display:"flex",alignItems:"center",alignSelf:"stretch"}},
              React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8,width:"100%"}},
                React.createElement('div',{style:{minWidth:20}},u.isOut?React.createElement('span',{style:{fontSize:12,color:"#2A4040"}},"💤"):React.createElement(RankIcon,{rank:aIdx+1})),
                React.createElement(Avatar,{name:u.name,size:22,muted:u.isOut}),
                React.createElement('div',{style:{flex:1,minWidth:0,textAlign:"left",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"inline-flex",alignItems:"center",gap:6,fontWeight:600,fontSize:13,color:u.isOut?"#2A4040":"var(--text)"}},
                  React.createElement('span',null,u.name),
                  isMe&&React.createElement('span',{className:"mono",style:{fontSize:8,color:"#3d5e59",marginLeft:6}},"you"),
                  u.prorated&&!u.isOut&&React.createElement('span',{className:"mono",style:{fontSize:8,color:"var(--muted)",marginLeft:6,textTransform:"uppercase",letterSpacing:".08em"}},"joined mid-month")
                )
              )
            ),
            u.isOut
              ? React.createElement('div',{style:{display:"flex",alignItems:"center",gap:6,alignSelf:"center"}},
                  React.createElement('span',{style:{fontSize:11,color:"#1E3535",fontFamily:"'Outfit',sans-serif"}},"Sitting out"),
                  React.createElement('span',{style:{display:"inline-flex",alignItems:"center"}},React.createElement(ChevronRightIcon,null))
                )
              : earlyMonthQuiet
                ? React.createElement('div',{style:{display:"grid",gridTemplateColumns:"minmax(92px, auto) auto",columnGap:7,alignItems:"center",justifyContent:"flex-end",alignSelf:"stretch"}},
                    React.createElement('span',{style:{fontSize:9,fontWeight:700,color:"#C97B2E",fontFamily:"'Outfit',sans-serif",minWidth:92,textAlign:"right",alignSelf:"center"}},"no logs yet"),
                    React.createElement('span',{style:{display:"inline-flex",alignItems:"center",justifyContent:"flex-end",alignSelf:"center"}},React.createElement(ChevronRightIcon,null))
                  )
              : React.createElement('div',{style:{display:"grid",gridTemplateColumns:"auto minmax(92px, auto)",gridTemplateRows:"1fr auto",columnGap:6,rowGap:4,alignItems:"center",alignSelf:"stretch"}},
                  React.createElement('span',{style:{fontSize:16,fontWeight:700,color:u.status==="locked-in"?"#4ECDC4":"var(--text)",minWidth:20,textAlign:"right",display:"inline-block",fontFamily:"'Outfit',sans-serif",gridRow:"1 / span 2",alignSelf:"center"}},u.count),
                  React.createElement('span',{style:{display:"inline-flex",alignItems:"center",gap:7,minWidth:92,justifyContent:"flex-end",gridColumn:"2",gridRow:"1"}},
                      React.createElement(StatusBadge,{status:displayStatus}),
                      React.createElement(ChevronRightIcon,null)
                    ),
                  React.createElement('span',{style:{fontSize:8,fontWeight:700,color:lastWorkout(logs[u.name])==='today'?'var(--green)':lastWorkout(logs[u.name])==='1 day ago'?'var(--amber)':'#C97B2E',fontFamily:"'Outfit',sans-serif",minWidth:92,textAlign:"center",gridColumn:"2",gridRow:"2"}},lastWorkout(logs[u.name])?`last: ${lastWorkout(logs[u.name])}`:"no logs")
                )
          )
        );
      }))
    ),
    React.createElement(Card,{style:{padding:14}},
      React.createElement('span',{className:"lbl"},"Competition Status"),
      React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}},
        competitionStatusBody,
        competitionAction
      )
    )
  );

  const desktopView = React.createElement('div',{className:"desktop-only",style:{maxWidth:1060,margin:"0 auto",padding:"20px 16px 0",display:"flex",flexDirection:"column",gap:14}},
    React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}},
      React.createElement('div',null,
        React.createElement('span',{style:{fontFamily:"'Outfit', sans-serif",fontSize:10,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".14em",display:"block"}},`${todayHeaderMonthName} ${CUR_YEAR} · Day ${DAY_OF_MON}/${DAYS_IN_MON}`)
      ),
      isExcused
        ? React.createElement('div',{style:{display:"flex",alignItems:"center",gap:10,background:"var(--amber-dim)",border:"1px solid #f0a50030",borderRadius:10,padding:"10px 16px"}},
            React.createElement('span',{style:{fontSize:18}},"💤"),
            React.createElement('div',null,
              React.createElement('div',{style:{fontWeight:700,fontSize:13,color:"var(--amber)"}},"Sitting out this month"),
              React.createElement('div',{style:{fontSize:12,color:"var(--muted)"}},"You won't pay or collect anything.")
            )
          )
        : React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:10,marginLeft:"auto"}},
            React.createElement('button',{onClick:()=>setShowLog(true),style:{background:"var(--green)",color:"#000",padding:"11px 24px",borderRadius:10,fontSize:14,fontWeight:800,border:"none",animation:"glow 2.5s infinite"},onMouseEnter:e=>e.currentTarget.style.transform="translateY(-1px)",onMouseLeave:e=>e.currentTarget.style.transform="translateY(0)"},"+ Log Workout")
          )
    ),
    lastMonthBanner,
!isExcused&&React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}},
  statCards.map(s=>React.createElement(Card,{key:s.label,onClick:()=>setStatDetail({kind:s.kind}),style:desktopStatCardStyle,
    onMouseEnter:e=>e.currentTarget.style.transform="translateY(-1px)",
    onMouseLeave:e=>e.currentTarget.style.transform="translateY(0)"},
    React.createElement('span',{className:"lbl",style:desktopStatLabelStyle},s.label),
    React.createElement('div',{style:{width:"100%",display:"flex",flexDirection:"column",alignItems:"center",paddingTop:10}},
      React.createElement('div',{style:Object.assign({fontSize:26,fontWeight:800,color:s.color || "#4ECDC4",lineHeight:1,minHeight:26,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",whiteSpace:"nowrap",width:"100%",fontFamily:"'Outfit', sans-serif"}, s.valueStyle || {})},s.valueNode || s.val),
      React.createElement('div',{style:desktopStatSubStyle},s.sub),
      s.meta && React.createElement('div',{className:"mono",style:{fontSize:8,color:"#4ECDC4",marginTop:2,textTransform:"uppercase",letterSpacing:".1em"}},s.meta)
    )
  ))
),
    settlementReminderSlot,
    React.createElement('div',{style:{display:"grid",gridTemplateColumns:"1fr 280px",gap:12,alignItems:"start"}},
      React.createElement(Card,null,
        React.createElement('div',{style:{padding:"12px 15px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}},
          React.createElement('div',{style:{fontWeight:600,fontSize:13}},"Bloc leaderboard")
        ),
        React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:4,padding:"8px"}},
        leaderboardRows.map(u=>{
          const isMe=u.name===user;
          const displayStatus = getLeaderboardDisplayStatus(u.status, u.count);
          const earlyMonthQuiet = !u.isOut && isEarlyMonthNeutralWindow() && u.count === 0;
          const aArr=leaderboardRows.filter(x=>!x.isOut);
          const aIdx=aArr.findIndex(x=>x.name===u.name);
          return React.createElement('button',{key:u.key || u.name,type:"button",onClick:()=>setViewPlayer(u.name),style:{...leaderboardRowBaseStyle,borderColor:isMe&&!u.isOut?"#163d36":"#0D1F1E",background:leaderboardRowBackground(displayStatus),boxShadow:leaderboardRowShadow,opacity:u.isOut?.55:1},
            onMouseEnter:e=>e.currentTarget.style.borderColor=isMe&&!u.isOut?"#1c4a43":"#15302c",onMouseLeave:e=>e.currentTarget.style.borderColor=isMe&&!u.isOut?"#163d36":"#0D1F1E"},
            React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}},
              React.createElement('div',{style:{flex:1,minWidth:0,display:"flex",alignItems:"center",alignSelf:"stretch"}},
                React.createElement('div',{style:{display:"flex",alignItems:"center",gap:9,width:"100%"}},
                  React.createElement('div',{style:{minWidth:22}},u.isOut?React.createElement('span',{style:{fontSize:13,color:"#2A4040"}},"💤"):React.createElement(RankIcon,{rank:aIdx+1})),
                  React.createElement(Avatar,{name:u.name,size:24,muted:u.isOut}),
                  React.createElement('div',{style:{flex:1,minWidth:0,textAlign:"left",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"inline-flex",alignItems:"center",gap:7,fontWeight:600,fontSize:14,color:u.isOut?"#2A4040":"var(--text)"}},
                    React.createElement('span',null,u.name),
                    isMe&&React.createElement('span',{className:"mono",style:{fontSize:8,color:"#3d5e59",marginLeft:7}},"you"),
                    u.prorated&&!u.isOut&&React.createElement('span',{className:"mono",style:{fontSize:8,color:"var(--muted)",marginLeft:6,textTransform:"uppercase",letterSpacing:".08em"}},"joined mid-month")
                  )
                )
              ),
              u.isOut
                ? React.createElement('div',{style:{display:"flex",alignItems:"center",gap:6,alignSelf:"center"}},
                    React.createElement('span',{style:{fontSize:11,color:"#1E3535",fontFamily:"'Outfit',sans-serif"}},"Sitting out"),
                    React.createElement('span',{style:{display:"inline-flex",alignItems:"center"}},React.createElement(ChevronRightIcon,null))
                  )
                : earlyMonthQuiet
                  ? React.createElement('div',{style:{display:"grid",gridTemplateColumns:"minmax(98px, auto) auto",columnGap:7,alignItems:"center",justifyContent:"flex-end",alignSelf:"stretch"}},
                      React.createElement('span',{style:{fontSize:9,fontWeight:700,color:"#C97B2E",fontFamily:"'Outfit',sans-serif",minWidth:98,textAlign:"right",alignSelf:"center"}},"no logs yet"),
                      React.createElement('span',{style:{display:"inline-flex",alignItems:"center",justifyContent:"flex-end",alignSelf:"center"}},React.createElement(ChevronRightIcon,null))
                    )
                : React.createElement('div',{style:{display:"grid",gridTemplateColumns:"auto minmax(98px, auto)",gridTemplateRows:"1fr auto",columnGap:6,rowGap:4,alignItems:"center",alignSelf:"stretch"}},
                    React.createElement('span',{style:{fontSize:18,fontWeight:700,minWidth:28,textAlign:"right",color:u.status==="locked-in"?"#4ECDC4":"var(--text)",display:"inline-block",fontFamily:"'Outfit',sans-serif",gridRow:"1 / span 2",alignSelf:"center"}},u.count),
                    React.createElement('span',{style:{display:"inline-flex",alignItems:"center",gap:7,minWidth:98,justifyContent:"flex-end",gridColumn:"2",gridRow:"1"}},
                        React.createElement(StatusBadge,{status:displayStatus}),
                        React.createElement(ChevronRightIcon,null)
                      ),
                    React.createElement('span',{style:{fontSize:8,fontWeight:700,color:lastWorkout(logs[u.name])==='today'?'var(--green)':lastWorkout(logs[u.name])==='1 day ago'?'var(--amber)':'#C97B2E',fontFamily:"'Outfit',sans-serif",minWidth:98,textAlign:"center",gridColumn:"2",gridRow:"2"}},lastWorkout(logs[u.name])?`last: ${lastWorkout(logs[u.name])}`:"no logs yet")
                  )
            )
          );
        }))
      ),
      React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:10}},
        React.createElement(Card,{style:{padding:15}},
          React.createElement('span',{className:"lbl"},"Month Status"),
          React.createElement('div',{style:{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:12}},
            competitionStatusBody,
            competitionAction
          )
        ),
        desktopCalendarCard
      )
    )
  );

  return React.createElement('div',{style:{position:"relative",minHeight:"calc(100vh - 44px)",background:"transparent"}},
    viewPlayer&&React.createElement('div',{style:{position:"absolute",inset:0,zIndex:30,overflowY:"auto",WebkitOverflowScrolling:"touch",background:"transparent"}},
      React.createElement(PlayerProfileErrorBoundary,{profileName:viewPlayer,onBack:()=>setViewPlayer(null)},
        React.createElement(PlayerProfile,{name:viewPlayer,logs,excused,monthHistory,onBack:()=>setViewPlayer(null),groupSettings,onDeleteLog:viewPlayer===user?async(log)=>{ await onLogMutation({action:"delete-log",groupId:currentGroupId,actor:user,owner:viewPlayer,logId:log.id}); }:undefined})
      )
    ),
    showLog&&React.createElement(LogModal,{user,currentGroupId,groups,onConfirm:doLog,onClose:()=>setShowLog(false)}),
    deleteTarget && React.createElement(DeleteModal,{log:deleteTarget,onClose:()=>setDeleteTarget(null),onConfirm:async()=>{ const logId = deleteTarget.id; setDeleteTarget(null); await onLogMutation({action:"delete-log",groupId:currentGroupId,actor:user,owner:user,logId}); }}),
    showExcuse && sitOutMode && React.createElement(SitOutModal,{mode:sitOutMode,monthName:monthSummary ? MONTH_NAMES[monthSummary.month] : MONTH_NAMES[CUR_MONTH],onClose:()=>{setShowExcuse(false);setSitOutError("");},onSubmit:submitSitOut,submitting:sitOutSubmitting,error:sitOutError}),
    settlementDisputePrompt,
    settlementConfirmPrompt,
    statDetailOverlay,
    mobileView,
    desktopView
  );
};


export { TodayPage };
