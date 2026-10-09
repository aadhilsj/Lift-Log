import { createPortal } from "react-dom";
import React from "react";
const { useState, useEffect, useMemo, useRef } = React;
import { ProfilePhotoCropModal, readFileAsDataUrl } from "./ProfilePage.jsx";
import {
  WORKOUT_TYPES,
  DEFAULT_CURRENCY,
  NAMES,
  MIN_TARGET,
  CUR_MONTH,
  CUR_YEAR,
  DAY_OF_MON,
  curKey,
  MONTH_NAMES,
  calcPenalties,
  addStandardSoloPenalties,
  getStandardSoloMisses,
  isStandardPenaltySoloForMonth,
  getLoserAmount,
  getCurrentMemberTarget,
  getHistoricalMemberNamesForMonth,
  getHistoricalGroupMemberNames,
  isSoloForMonth,
  isTrainingForMonth,
  getSoloTargetForMonth,
  isYearlyAllowanceMonth,
  getYearlyAllowanceUsage,
  SIT_OUTS_PER_YEAR,
  SOLO_MONTHS_PER_YEAR,
  getLeagueMonthSummaryForTimestamp,
  isExemptFromStakes,
  getRedemptionMark,
  getClosedMonthBefore,
  fmtCurrency,
  getCountedLogs,
  getMonthPartsFromKey,
  getCountedLogCount,
  isJoinedForMonth,
  findWorkoutCopiesInOtherBlocs
} from "../lib/appState.js";
import {
  isMobile
} from "../lib/utils.js";
import { Avatar, WorkoutTypeIcon, Bar, Card, AppIcon , RedemptionShieldIcon, RedemptionNoteModal, TrainingSproutIcon, SoloFlagIcon, TrainingNoteModal, SoloNoteModal, ModalScrim } from "../components/primitives.jsx";
import { DeleteModal } from "../modals/modals.jsx";
import { ProfileStatsPanel } from "../components/ProfileStatsPanel.jsx";
import { ACTIVITIES, getLogDisplayActivity } from "../lib/activities.js";
import { ShareSticker } from "../components/ShareSticker.jsx";
import { buildStickerData } from "../lib/shareSticker.js";
import { fetchProfileStatsData } from "../lib/api.js";
import {
  cancelSwipeFrame,
  releaseSwipeBack,
  releaseSwipeForward
} from "../lib/swipeRelease.js";

const PLAYER_PROFILE_PREMIUM_GATE = false; // Built now; flip to true when premium gating is wired.
const FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const profileMonthLabel = month => month ? `${FULL_MONTH_NAMES[month.month] || MONTH_NAMES[month.month]} ${month.year}` : "—";

// The shared MONTH_NAMES list is the short form used in compact labels. The
// redemption note is a sentence, so it needs the month spelled out.
const PROFILE_FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
// The header photo and the gap to its right. The column beside the photo is
// padded by exactly these, so the name centres over the buttons.
const PROFILE_PHOTO_SIZE = 68;
const PROFILE_PHOTO_GAP = 14;

const formatWorkoutDetailDate = isoDate => {
  const [year,month,day] = String(isoDate || "").split("-").map(Number);
  if (!year || !month || !day) return String(isoDate || "");
  return `${day} ${PROFILE_FULL_MONTH_NAMES[month - 1]} ${year}`;
};

const PlayerProfile = ({group,name,logs,excused,monthHistory,onBack,onSwipeRevealChange,groupSettings,onDeleteLog,initialMonthKey,memberUserId,currentUserId,visibleGroups,accountCreatedAt,profilePhotoUrl,onTrackUsage,isOwnProfile=false,asTab=false,onUpdateProfilePhoto}) => {
  // As the Profile tab this page is one screen among others, so it sizes to its
  // content and paints no background of its own. Opened from a leaderboard it
  // is still a full screen that slides in over the one behind it.
  //
  // Tapping your own photo adds or changes it, through the same crop screen and
  // the same save path as the account screen.
  const photoInputRef = useRef(null);
  const [cropSource, setCropSource] = useState("");
  const [localPhoto, setLocalPhoto] = useState("");
  const canEditPhoto = isOwnProfile && typeof onUpdateProfilePhoto === "function";
  const ownPhoto = localPhoto || profilePhotoUrl || "";
  const compactMobile = isMobile();
  const [deleteTarget,setDeleteTarget]=useState(null);
  const [deleteChoices,setDeleteChoices]=useState(null);
  const [workoutDetail,setWorkoutDetail]=useState(null);
  const [workoutChoices,setWorkoutChoices]=useState(null);
  const [dragging,setDragging]=useState(false);
  const swipeRef=useRef({sx:0,sy:0,active:false,mode:null});
  const surfaceRef=useRef(null);
  const dragXRef=useRef(0);
  const frameRef=useRef(null);
  const currency = groupSettings?.currency || DEFAULT_CURRENCY;
  const [selMonthIdx,setSelMonthIdx]=useState(null); // null = current month
  const [profileTab,setProfileTab]=useState("bloc");
  const [showShareSticker,setShowShareSticker]=useState(false);
  const [feroStats,setFeroStats]=useState(null);
  const [feroStatsState,setFeroStatsState]=useState("idle"); // idle | loading | ready | error
  const [feroStatsAttempt,setFeroStatsAttempt]=useState(0);
  // Guards one request per member. Deliberately a ref, not state: putting the
  // status in the effect's dependencies made the status change re-run the
  // effect, whose cleanup then cancelled the in-flight request, so the result
  // was discarded and the tab skeletoned forever.
  const feroStatsRequestedFor = useRef("");
  const appliedInitialMonthKeyRef = useRef(null);
  const histReversed=[...monthHistory].reverse();
  const historicalNames=useMemo(
    ()=>getHistoricalGroupMemberNames(monthHistory, logs, excused, NAMES),
    [monthHistory, logs, excused]
  );
  const visibleHistoryMonths=histReversed.filter(m=>getHistoricalMemberNamesForMonth(m, historicalNames).includes(name));
  useEffect(()=>{
    const selectionKey = initialMonthKey ? `${name}:${initialMonthKey}` : "";
    if (!initialMonthKey || appliedInitialMonthKeyRef.current === selectionKey) return;
    const idx = visibleHistoryMonths.findIndex(m => m?.key === initialMonthKey);
    if (idx >= 0) {
      setSelMonthIdx(idx);
      appliedInitialMonthKeyRef.current = selectionKey;
    }
  }, [name, initialMonthKey, visibleHistoryMonths]);
  const isCurMonth=selMonthIdx===null;
  const selHistMonth=isCurMonth?null:visibleHistoryMonths[selMonthIdx];
  const selectedMonthKey = isCurMonth ? curKey : selHistMonth?.key;
  const isJoinedThisMonth = isCurMonth
    ? isJoinedForMonth(name, selectedMonthKey)
    : !!selHistMonth && getHistoricalMemberNamesForMonth(selHistMonth, historicalNames).includes(name);
  // Closed month all-time stats
  const closedStats=useMemo(()=>{
    let wins=0,moneyWon=0,moneyLost=0,closedTotal=0;
    monthHistory.forEach(m=>{
      const monthNames = getHistoricalMemberNamesForMonth(m, historicalNames);
      if(!monthNames.includes(name)) return;
      if(m.excused?.[name]) return;
      // Exempt is exempt whichever way it was granted: a training month must
      // no more count towards this member's money than a solo month does.
      const memberIsExempt = isExemptFromStakes(m, name, m.key);
      closedTotal+=m.counts[name]||0;
      // A new-rules Solo miss is the one exempt case that still costs money.
      if (memberIsExempt && !isStandardPenaltySoloForMonth(m, name, m.key)) return;
      const ac=monthNames.filter(n=>isJoinedForMonth(n, m.key) && !m.excused?.[n] && !isExemptFromStakes(m, n, m.key)).map(n=>({name:n,count:m.counts[n]||0,target:m.memberTargets?.[n] || m.settings?.minTarget || MIN_TARGET}));
      const soloMisses = getStandardSoloMisses(m, monthNames.filter(n=>isJoinedForMonth(n, m.key)));
      const penalties = addStandardSoloPenalties(calcPenalties(ac, m.settings || {}), soloMisses, m.settings || {});
      const {winners,losers,perWinner}=penalties;
      if(winners.find(w=>w.name===name)){wins++;moneyWon+=perWinner;}
      if(losers.find(l=>l.name===name)){moneyLost+=getLoserAmount(penalties, name);}
    });
    const participated=monthHistory.filter(m=>getHistoricalMemberNamesForMonth(m, historicalNames).includes(name) && !m.excused?.[name]);
    const avg=participated.length?(closedTotal/participated.length).toFixed(1):"—";
	    return {wins,moneyWon,moneyLost,avg};
	  },[name,monthHistory,historicalNames]);

  const profileMonths = useMemo(()=>{
    const closed = monthHistory
      .filter(m=>getHistoricalMemberNamesForMonth(m, historicalNames).includes(name) && !m.excused?.[name])
      .map(m=>({
        key:m.key,
        label:m.label,
        month:m.month,
        year:m.year,
        count:Number(m.counts?.[name] || 0),
        target:getSoloTargetForMonth(m, name, m.key) || m.memberTargets?.[name] || m.settings?.minTarget || MIN_TARGET,
        stakesTarget:m.memberTargets?.[name] || m.settings?.minTarget || MIN_TARGET,
        settings:m.settings || {},
        counts:m.counts || {},
        memberTargets:m.memberTargets || {},
        excused:m.excused || {},
        solo:m.solo || {},
        training:m.training || {},
        closed:true
      }));
    const current = isJoinedForMonth(name, curKey) && !excused?.[name]?.[curKey]
      ? [{
          key:curKey,
          label:`${MONTH_NAMES[CUR_MONTH]} '${String(CUR_YEAR).slice(2)}`,
          month:CUR_MONTH,
          year:CUR_YEAR,
          count:getCountedLogCount(logs[name] || []),
          target:getCurrentMemberTarget(name, curKey, MIN_TARGET),
          stakesTarget:getCurrentMemberTarget(name, curKey, MIN_TARGET),
          settings:groupSettings || {},
          counts:{[name]:getCountedLogCount(logs[name] || [])},
          excused:{},
          solo:{},
          closed:false
        }]
      : [];
    return [...closed, ...current].sort((a,b)=>a.key.localeCompare(b.key));
  },[name,monthHistory,historicalNames,logs,excused,groupSettings]);

  const perfectMonthStats = useMemo(()=>{
    const perfectMonths = profileMonths.filter(m=>{
      if (!m.closed) return false;
      if (isExemptFromStakes(m, name, m.key)) return false;
      const monthNames = getHistoricalMemberNamesForMonth(m, historicalNames);
      const activeCounts = monthNames
        .filter(n=>isJoinedForMonth(n, m.key) && !m.excused?.[n] && !isExemptFromStakes(m, n, m.key))
        .map(n=>({name:n,count:Number(m.counts?.[n] || 0),target:m.memberTargets?.[n] || m.settings?.minTarget || MIN_TARGET}));
      const { losers } = calcPenalties(activeCounts, m.settings || {});
      return Number(m.count || 0) >= Number(m.stakesTarget || MIN_TARGET) && !losers.some(l=>l.name===name);
    });
    const perfectKeys = new Set(perfectMonths.map(m=>m.key));
    let activeStreak = 0;
    const closedMonths = profileMonths.filter(m=>m.closed).sort((a,b)=>b.key.localeCompare(a.key));
    for (const m of closedMonths) {
      if (!perfectKeys.has(m.key)) break;
      activeStreak += 1;
    }
    return { count:perfectMonths.length, activeStreak };
  },[name,profileMonths,historicalNames]);

  // Selected month data
  const selCount = isCurMonth
    ? getCountedLogCount(logs[name]||[])
    : (selHistMonth?.counts[name]||0);
  const isExcusedThisMonth = isCurMonth
    ? (excused[name]?.[curKey]||false)
    : (selHistMonth?.excused?.[name]||false);

  // Logs for selected period
  const selLogs = isCurMonth ? (logs[name]||[]) : (selHistMonth?.logsByUser?.[name] || []);
  const visibleSelLogs = getCountedLogs(selLogs);
  const hasDetailedLogs = isCurMonth || Boolean(selHistMonth?.logsByUser);
  const hasHistory=monthHistory.length>0;
  const netPL=closedStats.moneyWon-closedStats.moneyLost;
  // Solo replaces the Bloc target for this person's selected month. The
  // profile summary must therefore use the same target as the leaderboard.
  const selectedTarget = getSoloTargetForMonth(isCurMonth ? group : selHistMonth, name, selectedMonthKey)
    || (isCurMonth
      ? getCurrentMemberTarget(name, curKey, MIN_TARGET)
      : (selHistMonth?.memberTargets?.[name] || selHistMonth?.settings?.minTarget || MIN_TARGET));
  const needed=Math.max(0,selectedTarget-selCount);
  // Per activity. Logs from before activities fall under their category name,
  // so an old Sports log counts as "Sports".
  const tBreak={};
  visibleSelLogs.forEach(l=>{const a=getLogDisplayActivity(l);tBreak[a]=(tBreak[a]||0)+1;});
  const maxT=Math.max(...Object.values(tBreak),1);
  const breakdownOrder = name => { const i = ACTIVITIES.findIndex(activity => activity.name === name); return i === -1 ? ACTIVITIES.length + WORKOUT_TYPES.indexOf(name) : i; };
  const workoutBreakdownRows = Object.keys(tBreak).filter(t=>tBreak[t] > 0).sort((a,b)=>(tBreak[b]-tBreak[a])||(breakdownOrder(a)-breakdownOrder(b)));
  const selYear = isCurMonth ? CUR_YEAR : (selHistMonth?.year ?? CUR_YEAR);
  const selMonthNum = isCurMonth ? CUR_MONTH : (selHistMonth?.month ?? CUR_MONTH);
  const selDaysInMonth = new Date(selYear, selMonthNum + 1, 0).getDate();
  const firstDay=(new Date(selYear, selMonthNum, 1).getDay()+6)%7;
  const calDays=[...Array(firstDay).fill(null),...Array.from({length:selDaysInMonth},(_,i)=>i+1)];
  const logsByDay={};
  selLogs.forEach(l=>{
    const d = Number(String(l?.date || "").split("-")[2]);
    if (Number.isFinite(d)) logsByDay[d]=[...(logsByDay[d] || []),l];
  });
  // Keep the calendar heading readable and consistent: the open month should
  // use the same full month label as archived months.
  const selLabel=isCurMonth
    ? profileMonthLabel({month:CUR_MONTH,year:CUR_YEAR})
    : profileMonthLabel(selHistMonth);
  // The one place the mark gets its name. Kept off the leaderboard rows, where
  // the shield alone has to sit beside a name without crowding it.
  const [showRedemptionNote,setShowRedemptionNote]=useState(false);
  const [openStatusNote,setOpenStatusNote]=useState(null);
  // The selected month's own exemptions. A closed month carries its own maps in
  // the snapshot; the open month is only knowable from the live group.
  const selMonthSource = isCurMonth ? group : selHistMonth;
  const selIsTraining = !!(selectedMonthKey && isTrainingForMonth(selMonthSource, name, selectedMonthKey));
  const selIsSolo = !!(selectedMonthKey && isSoloForMonth(selMonthSource, name, selectedMonthKey));
  const selSoloTarget = selIsSolo ? getSoloTargetForMonth(selMonthSource, name, selectedMonthKey) : null;
  // A Bloc created in the month being viewed is in its own opening month, so
  // every training grant there belongs to the Bloc rather than to one arrival.
  const selBlocOpening = (() => {
    if (!selIsTraining || !group?.createdAt || !selectedMonthKey) return false;
    const created = getLeagueMonthSummaryForTimestamp(group.createdAt, group?.settings?.timeZone);
    return created?.monthKey === selectedMonthKey;
  })();

  const selMonthKey = isCurMonth ? curKey : selHistMonth?.key;
  const selRedemptionMark = getRedemptionMark(
    monthHistory,
    name,
    selMonthKey,
    selCount >= selectedTarget
  );
  // The shield is about the month that was MISSED, which is the closed month
  // before the one on screen — not the one on screen. Naming the displayed
  // month told a member viewing September that they had a slow September, when
  // the shield was there because of August.
  //
  // Taken from the same helper the mark itself uses rather than subtracting
  // one from the calendar: the prior closed month is not always last month. A
  // Bloc with a gap in its history would otherwise be told the wrong month
  // with total confidence.
  const redemptionMonthName = (() => {
    const prior = getClosedMonthBefore(monthHistory, selMonthKey);
    if (!prior) return "";
    const monthIndex = Number(prior.month);
    return Number.isInteger(monthIndex) ? (PROFILE_FULL_MONTH_NAMES[monthIndex] || "") : "";
  })();

  // This year's Solo and Sit out allowance in this Bloc, visible to everyone.
  // Same dots as the Status tab: filled = still available, hollow = used.
  const renderAllowanceLine = () => {
    if (!group || !isYearlyAllowanceMonth(curKey)) return null;
    const usage = getYearlyAllowanceUsage({ ...group, monthHistory: monthHistory || group.monthHistory }, name, curKey);
    const dots = (left, total, color) => React.createElement('span',{style:{display:"inline-flex",alignItems:"center",gap:3}},
      Array.from({length:total}).map((_,i)=>React.createElement('span',{key:i,style:i < left
        ? {width:6,height:6,borderRadius:"50%",background:color}
        : {width:6,height:6,borderRadius:"50%",border:"1px solid #3a5651",boxSizing:"border-box"}}))
    );
    const leftLabel = left => left > 0 ? `${left} left` : "None left";
    return React.createElement('div',{className:"fu2",style:{display:"flex",alignItems:"center",gap:7,padding:"8px 11px",borderRadius:10,background:"#0a1513",border:"1px solid #1b332e",fontFamily:"'Outfit',sans-serif",fontSize:11,color:"var(--muted)",whiteSpace:"nowrap",overflow:"hidden"}},
      React.createElement('span',{style:{fontSize:10,fontWeight:800,letterSpacing:".06em"}},`${String(curKey).split("-")[0]}:`),
      React.createElement('span',{style:{flex:1}}),
      "Solo", dots(usage.soloLeft, SOLO_MONTHS_PER_YEAR, "#4ECDC4"), leftLabel(usage.soloLeft),
      React.createElement('span',{style:{color:"#2c4541"}},"·"),
      "Sit out", dots(usage.sitOutsLeft, SIT_OUTS_PER_YEAR, "#4ECDC4"), leftLabel(usage.sitOutsLeft)
    );
  };

  // One tap a month, the same pill the Month screen uses: 28px tall, 11px
  // label. The dropdown it replaces made you aim at a list to step back one
  // month. Index 0 is the most recent closed month, so the left arrow goes
  // back in time and null is the open month.
  const atEarliestMonth = (selMonthIdx??-1) >= visibleHistoryMonths.length-1;
  const atLatestMonth = selMonthIdx == null;
  const monthSelector = React.createElement('div',{style:{display:"flex",justifyContent:"center"}},
    React.createElement('div',{style:{display:"inline-flex",alignItems:"center",height:28,borderRadius:999,background:"rgba(8,15,15,.48)",border:"0.5px solid rgba(78,205,196,.22)"}},
      React.createElement('button',{type:"button","aria-label":"Earlier month",disabled:atEarliestMonth,onClick:()=>setSelMonthIdx(i=>i==null?0:Math.min(visibleHistoryMonths.length-1,i+1)),style:{background:"none",border:0,padding:"0 9px",height:28,color:atEarliestMonth?"#24403c":"#4ECDC4",fontSize:14,cursor:atEarliestMonth?"default":"pointer"}},"\u2039"),
      React.createElement('span',{style:{minWidth:88,textAlign:"center",fontFamily:"'Outfit',sans-serif",fontSize:11,fontWeight:700,color:"var(--text)",whiteSpace:"nowrap"}},String(selLabel).replace(/ (\d{2})(\d{2})$/," '$2")),
      React.createElement('button',{type:"button","aria-label":"Later month",disabled:atLatestMonth,onClick:()=>setSelMonthIdx(i=>i==null||i===0?null:i-1),style:{background:"none",border:0,padding:"0 9px",height:28,color:atLatestMonth?"#24403c":"#4ECDC4",fontSize:14,cursor:atLatestMonth?"default":"pointer"}},"\u203a")
    )
  );

  const sitOutBanner = isExcusedThisMonth
    ? React.createElement('div',{style:{background:"rgba(101,101,122,.12)",border:"1px solid var(--border2)",borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:10}},
        React.createElement('span',{style:{fontSize:18}},"💤"),
        React.createElement('div',{style:{fontSize:13,color:"var(--muted)",marginLeft:4}},isCurMonth?"Sitting out this month":"Sat out this month")
      )
    : null;

  const notJoinedBanner = !isJoinedThisMonth
    ? React.createElement('div',{style:{background:"rgba(101,101,122,.12)",border:"1px solid var(--border2)",borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:10}},
        React.createElement('span',{style:{fontSize:18}},"⏳"),
        React.createElement('div',{style:{fontSize:13,color:"var(--muted)",marginLeft:4}},"Not joined")
      )
    : null;

  // Viewing yourself needs no request at all: your client already holds every
  // Bloc you are in, so the local aggregation is already the complete answer.
  const isSelf = Boolean(memberUserId) && memberUserId === currentUserId;

  // Fetch a member's genuine cross-Bloc stats when the tab is first opened.
  // Deferred rather than fetched on mount so opening a profile stays cheap;
  // a prefetch on Bloc open usually means this resolves from cache instantly.
  useEffect(() => {
    if (isSelf || profileTab !== "alltime" || !memberUserId) return undefined;
    const requestKey = `${memberUserId}:${feroStatsAttempt}`;
    if (feroStatsRequestedFor.current === requestKey) return undefined;
    feroStatsRequestedFor.current = requestKey;
    let cancelled = false;
    setFeroStatsState("loading");
    fetchProfileStatsData(memberUserId).then(result => {
      if (cancelled) return;
      if (result?.ok && result.stats?.ok) { setFeroStats(result.stats); setFeroStatsState("ready"); }
      else setFeroStatsState("error");
    }).catch(() => { if (!cancelled) setFeroStatsState("error"); });
    return () => { cancelled = true; };
  }, [isSelf, profileTab, memberUserId, feroStatsAttempt]);

  const retryFeroStats = () => {
    setFeroStats(null);
    setFeroStatsState("idle");
    setFeroStatsAttempt(n => n + 1);
  };

  // All-time panel — the exact same component the account profile renders, so
  // the two never diverge visually.
  //
  // SCOPE: readable state is scoped per viewer, so the client only holds the
  // viewer's own Blocs. These numbers therefore cover the Blocs the viewer
  // SHARES with this member, not their whole history. For your own profile
  // that is every Bloc you are in, matching the account profile exactly.
  const sharedGroups = (visibleGroups || []).filter(g =>
    memberUserId ? Object.values(g.memberships || {}).some(m => m.userId === memberUserId) : false
  );
  const allTimePanel = !memberUserId
    ? React.createElement(Card,{style:{padding:"20px 16px",textAlign:"center",color:"var(--muted)",fontSize:12.5,fontFamily:"'Outfit',sans-serif"}},
        `All-time stats aren't available for ${name}.`)
    : isSelf
      // Your own profile: every Bloc is already on the client, so render at once.
      // No ownerName: headings read "Your Heatmap" rather than your own name
      // back at you. No scope note either — your own profile spans everything
      // by definition, so saying so is noise.
      ? React.createElement(ProfileStatsPanel,{
          groups:visibleGroups || [],
          userId:memberUserId,
          accountCreatedAt
        })
      : feroStatsState === "error"
        // Fail plainly. Falling back to shared-Bloc figures under an "all time"
        // heading would state a smaller number as if it were the whole story.
        ? React.createElement(Card,{style:{padding:"20px 16px",display:"grid",gap:11,justifyItems:"center",textAlign:"center"}},
            React.createElement('div',{style:{fontSize:12.5,color:"var(--muted)",lineHeight:1.5,fontFamily:"'Outfit',sans-serif",maxWidth:250}},
              `Couldn't load ${name}'s history.`
            ),
            React.createElement('button',{
              type:"button",
              onClick:retryFeroStats,
              style:{padding:"8px 16px",borderRadius:9,border:"1px solid rgba(78,205,196,.35)",background:"rgba(78,205,196,.08)",color:"#4ECDC4",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}
            },"Try again")
          )
        : React.createElement(ProfileStatsPanel,{
            groups:sharedGroups,
            userId:memberUserId,
            ownerName:name,
            serverStats:feroStats,
            loading: !feroStats
          });

  // Share is offered on your own closed months only. The sticker is a record of
  // a finished month, and it is your own record to share.
  const canShareMonth = isSelf && !isCurMonth && !!selHistMonth;
  const shareStickerData = React.useMemo(() => {
    if (!canShareMonth) return null;
    const counted = getCountedLogs(selHistMonth?.logsByUser?.[name] || []);
    if (!counted.length) return null;
    const parts = getMonthPartsFromKey(selHistMonth.key);
    if (!parts) return null;
    return buildStickerData(counted, parts.year, parts.monthIndex);
  }, [canShareMonth, selHistMonth, name]);

  const startSwipeBack=e=>{
    e.stopPropagation();
    const t=e.touches?.[0];
    if(!t||t.clientX>72) return;
    swipeRef.current={sx:t.clientX,sy:t.clientY,st:performance.now(),active:true,mode:null};
  };
  const applySwipeTransform=(x=dragXRef.current,isDragging=dragging)=>{
    const el=surfaceRef.current;
    if(!el) return;
    el.style.transform=x?`translateX(${x}px)`:"translateX(0)";
    el.style.transition=isDragging?"none":"transform .08s ease-out";
    el.style.boxShadow=x?"-18px 0 34px rgba(0,0,0,.28)":"none";
    el.style.willChange=isDragging||x?"transform":"auto";
  };
  const scheduleSwipeTransform=(x,isDragging=dragging)=>{
    dragXRef.current=x;
    if(frameRef.current) return;
    frameRef.current=requestAnimationFrame(()=>{
      frameRef.current=null;
      applySwipeTransform(dragXRef.current,isDragging);
    });
  };
  const resetSwipeTransform=()=>{
    dragXRef.current=0;
    cancelSwipeFrame(frameRef);
    applySwipeTransform(0,false);
  };
  useEffect(()=>{
    swipeRef.current={sx:0,sy:0,active:false,mode:null};
    dragXRef.current=0;
    cancelSwipeFrame(frameRef);
    setDragging(false);
    onSwipeRevealChange?.(false);
    requestAnimationFrame(()=>applySwipeTransform(0,false));
    return ()=>{
      cancelSwipeFrame(frameRef);
      onSwipeRevealChange?.(false);
    };
  },[name]);
  const moveSwipeBack=e=>{
    e.stopPropagation();
    const s=swipeRef.current,t=e.touches?.[0];
    if(!s.active||!t) return;
    const dx=t.clientX-s.sx,dy=t.clientY-s.sy;
    if(!s.mode&&(Math.abs(dx)>4||Math.abs(dy)>4)){
      s.mode=dx>0&&Math.abs(dx)>Math.abs(dy)?"back":"scroll";
      setDragging(s.mode==="back");
      onSwipeRevealChange?.(s.mode==="back");
    }
    if(s.mode==="back") scheduleSwipeTransform(Math.max(0,Math.min(dx,window.innerWidth||420)),true);
  };
  const endSwipeBack=e=>{
    e.stopPropagation();
    const s=swipeRef.current,t=e.changedTouches?.[0];
    swipeRef.current={sx:0,sy:0,active:false,mode:null};
    if(!s.active||!t) return;
    const dx=t.clientX-s.sx,dy=t.clientY-s.sy,screenWidth=window.innerWidth||420;
    const elapsed=Math.max(1,performance.now()-(s.st||performance.now()));
    const fastEdgeFlick=dx>24&&elapsed<260&&dx/elapsed>0.22&&dx>Math.abs(dy);
    const dominantDrag=dx>screenWidth/2&&Math.abs(dy)<100&&dx>Math.abs(dy);
    const shouldClose=s.mode==="back"&&(fastEdgeFlick||dominantDrag);
    if(shouldClose){
      releaseSwipeForward({
        dragRef:dragXRef,
        frameRef,
        finalX:screenWidth,
        transitionMs:45,
        setDragging,
        applyTransform:applySwipeTransform,
        commit:()=>onBack?.()
      });
    }else{
      onSwipeRevealChange?.(false);
      releaseSwipeBack({
        dragRef:dragXRef,
        frameRef,
        transitionMs:80,
        setDragging,
        applyTransform:applySwipeTransform
      });
    }
  };

  const backButton = React.createElement('button',{onClick:onBack,style:{display:"inline-flex",alignItems:"center",gap:3,background:"transparent",border:"none",color:"#1E4040",padding:"2px 0",borderRadius:0,fontSize:13,fontFamily:"'Outfit',sans-serif",fontWeight:700,lineHeight:1.1}},
    React.createElement(AppIcon,{name:"chevron-left",size:13,stroke:"#1E4040"}),
    "Back"
  );
  return React.createElement('div',{ref:surfaceRef,onTouchStart:startSwipeBack,onTouchMove:moveSwipeBack,onTouchEnd:endSwipeBack,onTouchCancel:e=>{e.stopPropagation();swipeRef.current={sx:0,sy:0,active:false,mode:null};onSwipeRevealChange?.(false);setDragging(false);resetSwipeTransform();},style:{minHeight:asTab?"auto":"100dvh",background:asTab?"none":"var(--bg-gradient)",backgroundImage:asTab?"none":"var(--bg-radial-hint), var(--bg-gradient)",transform:dragXRef.current?`translateX(${dragXRef.current}px)`:"translateX(0)",transition:dragging?"none":"transform .08s ease-out",boxShadow:dragXRef.current?"-18px 0 34px rgba(0,0,0,.28)":"none",willChange:dragging||dragXRef.current?"transform":"auto",touchAction:"pan-y",overscrollBehavior:"contain"}},
    openStatusNote === "training" && React.createElement(TrainingNoteModal,{
      memberName: name,
      isSelf: currentUserId ? memberUserId === currentUserId : false,
      blocOpening: selBlocOpening,
      onClose: ()=>setOpenStatusNote(null)
    }),
    openStatusNote === "solo" && React.createElement(SoloNoteModal,{
      memberName: name,
      isSelf: currentUserId ? memberUserId === currentUserId : false,
      monthName: PROFILE_FULL_MONTH_NAMES[selMonthNum] || "",
      target: selSoloTarget,
      standardPenalty: selIsSolo && isStandardPenaltySoloForMonth(selMonthSource, name, selectedMonthKey),
      onClose: ()=>setOpenStatusNote(null)
    }),
    showRedemptionNote && React.createElement(RedemptionNoteModal,{
      redeemed: selRedemptionMark === "redeemed",
      memberName: name,
      isSelf: currentUserId ? memberUserId === currentUserId : false,
      monthName: redemptionMonthName,
      onClose: ()=>setShowRedemptionNote(false)
    }),
    showShareSticker && shareStickerData && React.createElement(ShareSticker,{
      data:shareStickerData,
      monthLabel:selLabel,
      onClose:()=>setShowShareSticker(false)
    }),
    deleteTarget && React.createElement(DeleteModal,{log:deleteTarget,otherBlocNames:[...new Set(findWorkoutCopiesInOtherBlocs(visibleGroups, group?.id, currentUserId, deleteTarget).map(copy => copy.groupName))],onClose:()=>setDeleteTarget(null),onConfirm:async(options)=>{ const log = deleteTarget; setDeleteTarget(null); await onDeleteLog(log, options); }}),
    deleteChoices && React.createElement(ModalScrim,{onClose:()=>setDeleteChoices(null)},
      React.createElement('div',{className:"modal pi",onClick:e=>e.stopPropagation(),style:{textAlign:"center",maxWidth:300,padding:"15px 14px"}},
        React.createElement('div',{style:{fontWeight:800,fontSize:14,marginBottom:4}},"Choose a workout"),
        React.createElement('div',{style:{color:"var(--muted)",fontSize:10.5,marginBottom:11}},"Select the workout you want to delete."),
        React.createElement('div',{style:{display:"grid",gap:7}},
          deleteChoices.map((log,index)=>React.createElement('button',{key:log.id,type:"button",onClick:()=>{setDeleteChoices(null);setDeleteTarget(log);},style:{width:"100%",display:"flex",alignItems:"center",gap:9,textAlign:"left",background:"var(--s2)",border:"1px solid var(--border)",borderRadius:9,padding:"9px 10px",color:"var(--text)"}},
            React.createElement('span',{style:{width:25,height:25,borderRadius:999,display:"inline-flex",alignItems:"center",justifyContent:"center",background:"rgba(78,205,196,.08)",color:"#4ECDC4",flexShrink:0}},React.createElement(WorkoutTypeIcon,{type:getLogDisplayActivity(log),size:15})),
            React.createElement('span',{style:{display:"grid",gap:2,minWidth:0}},
              React.createElement('span',{style:{fontSize:12,fontWeight:800}},`${index+1}. ${getLogDisplayActivity(log)}`),
              log.note && React.createElement('span',{style:{fontSize:10,color:"var(--muted)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},log.note)
            )
          ))
        ),
        React.createElement('button',{type:"button",onClick:()=>setDeleteChoices(null),style:{width:"100%",marginTop:9,background:"transparent",border:"1px solid var(--border)",color:"var(--muted)",padding:"8px",borderRadius:8,fontSize:11,fontWeight:700}},"Cancel")
      )
    ),
    workoutChoices && React.createElement(ModalScrim,{onClose:()=>setWorkoutChoices(null)},
      React.createElement('div',{className:"modal pi",onClick:e=>e.stopPropagation(),style:{textAlign:"center",maxWidth:300,padding:"15px 14px"}},
        React.createElement('div',{style:{fontWeight:800,fontSize:14,marginBottom:4}},"Choose a workout"),
        React.createElement('div',{style:{color:"var(--muted)",fontSize:10.5,marginBottom:11}},"Select a workout to view its details."),
        React.createElement('div',{style:{display:"grid",gap:7}},
          workoutChoices.map((log,index)=>React.createElement('button',{key:log.id,type:"button",onClick:()=>{setWorkoutChoices(null);setWorkoutDetail(log);},style:{width:"100%",display:"flex",alignItems:"center",gap:9,textAlign:"left",background:"var(--s2)",border:"1px solid var(--border)",borderRadius:9,padding:"9px 10px",color:"var(--text)"}},
            React.createElement('span',{style:{width:25,height:25,borderRadius:999,display:"inline-flex",alignItems:"center",justifyContent:"center",background:"rgba(78,205,196,.08)",color:"#4ECDC4",flexShrink:0}},React.createElement(WorkoutTypeIcon,{type:getLogDisplayActivity(log),size:15})),
            React.createElement('span',{style:{display:"grid",gap:2,minWidth:0}},
              React.createElement('span',{style:{fontSize:12,fontWeight:800}},`${index+1}. ${getLogDisplayActivity(log)}`),
              log.note && React.createElement('span',{style:{fontSize:10,color:"var(--muted)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},log.note)
            )
          ))
        ),
        React.createElement('button',{type:"button",onClick:()=>setWorkoutChoices(null),style:{width:"100%",marginTop:9,background:"transparent",border:"1px solid var(--border)",color:"var(--muted)",padding:"8px",borderRadius:8,fontSize:11,fontWeight:700}},"Close")
      )
    ),
    workoutDetail && React.createElement(ModalScrim,{onClose:()=>setWorkoutDetail(null)},
      React.createElement('div',{className:"modal pi",onClick:e=>e.stopPropagation(),style:{textAlign:"center",maxWidth:320,padding:"18px 16px"}},
        React.createElement('span',{style:{width:34,height:34,borderRadius:999,display:"inline-flex",alignItems:"center",justifyContent:"center",background:"rgba(78,205,196,.1)",color:"#4ECDC4",marginBottom:9}},React.createElement(WorkoutTypeIcon,{type:getLogDisplayActivity(workoutDetail),size:20})),
        React.createElement('div',{style:{fontWeight:800,fontSize:15,marginBottom:4}},getLogDisplayActivity(workoutDetail)),
        React.createElement('div',{className:"mono",style:{fontSize:11,color:"var(--muted)",marginBottom:workoutDetail.note?13:16}},formatWorkoutDetailDate(workoutDetail.date)),
        workoutDetail.note && React.createElement('div',{style:{fontSize:12,lineHeight:1.5,color:"var(--muted)",whiteSpace:"pre-wrap",margin:"0 auto 16px",maxWidth:270}},workoutDetail.note),
        React.createElement('button',{type:"button",onClick:()=>setWorkoutDetail(null),style:{width:"100%",background:"var(--s2)",border:"1px solid var(--border)",color:"var(--text)",padding:"9px",borderRadius:8,fontSize:11,fontWeight:750}},"Close")
      )
    ),
    React.createElement('div',{style:{maxWidth:740,margin:"0 auto",padding:"16px",display:"flex",flexDirection:"column",gap:12}},
    // Header: the photo on the left, level with the This Bloc / All Blocs
    // buttons, and the name centred over those buttons. The photo centres on
    // the buttons' own wrapper, so no offset is hard-coded, and the column's
    // bottom padding keeps the part of the photo that hangs below the buttons
    // clear of what follows. "Back" takes its own line above, because the
    // photo now owns the top-left corner. The month switcher moved into This
    // Bloc as a one-tap pill.
    !asTab && React.createElement('div',{className:"fu",style:{marginBottom:-4}},backButton),
    React.createElement('div',{className:"fu",style:{position:"relative",display:"flex",flexDirection:"column",alignItems:"stretch",gap:7,paddingTop:asTab?2:6,paddingLeft:PROFILE_PHOTO_SIZE+PROFILE_PHOTO_GAP,paddingBottom:22}},
      React.createElement('div',{style:{maxWidth:"100%",fontFamily:"'Outfit',sans-serif",fontSize:18,fontWeight:800,lineHeight:1.15,textAlign:"center",overflowWrap:"anywhere"}},name),
      React.createElement('div',{style:{position:"relative"}},
        React.createElement('div',{style:{position:"absolute",right:`calc(100% + ${PROFILE_PHOTO_GAP}px)`,top:"50%",transform:"translateY(-50%)",lineHeight:0}},
          canEditPhoto
            ? React.createElement('button',{type:"button",onClick:()=>photoInputRef.current?.click(),"aria-label":ownPhoto?"Change your profile photo":"Add a profile photo",style:{position:"relative",flexShrink:0,width:PROFILE_PHOTO_SIZE,height:PROFILE_PHOTO_SIZE,borderRadius:999,padding:0,border:0,background:"none",cursor:"pointer"}},
                ownPhoto
                  ? React.createElement(Avatar,{name,size:PROFILE_PHOTO_SIZE,photoUrl:ownPhoto})
                  : React.createElement('span',{style:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",width:PROFILE_PHOTO_SIZE,height:PROFILE_PHOTO_SIZE,borderRadius:999,border:"1.5px dashed rgba(78,205,196,.55)",background:"rgba(78,205,196,.06)",color:"#4ECDC4"}},
                      React.createElement('span',{style:{fontSize:20,lineHeight:1,fontWeight:500}},"+"),
                      React.createElement('span',{style:{fontFamily:"'Outfit',sans-serif",fontSize:7.5,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginTop:1}},"Photo")
                    ),
                ownPhoto && React.createElement('span',{style:{position:"absolute",right:-2,bottom:-2,width:18,height:18,borderRadius:999,background:"#4ECDC4",color:"#041312",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,border:"2px solid #070C0C"}},"+")
              )
            : React.createElement(Avatar,{name,size:PROFILE_PHOTO_SIZE,userId:memberUserId,photoUrl:profilePhotoUrl||""}),
          canEditPhoto && React.createElement('input',{ref:photoInputRef,type:"file",accept:"image/*",style:{display:"none"},onChange:async e=>{const file=e.target.files?.[0]; e.target.value=""; if(!file) return; setCropSource(await readFileAsDataUrl(file));}})
        ),
	    // This Bloc / All Blocs tabs. The pair differs by scope, not by time:
	    // the left tab is this Bloc's month, the right one the cross-Bloc stats
	    // that used to be reachable only from the account profile outside a
	    // Bloc. The value stays "alltime" so stored state keeps working.
	    React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:4,padding:2,borderRadius:10,width:"100%",background:"rgba(8,20,19,.76)",border:"0.5px solid rgba(22,61,54,.72)"}},
	      [["bloc","This Bloc"],["alltime","All Blocs"]].map(([value,label])=>React.createElement('button',{
	        key:value,type:"button",onClick:()=>{
	          // Own and other are separate counts: the founder wants to know
	          // whether people check their own cross-Bloc record or other
	          // people's. isOwnProfile comes from the caller, which already
	          // knows -- memberUserId is not passed on every route.
	          if (value === "alltime" && profileTab !== "alltime") onTrackUsage?.(isOwnProfile ? "own_profile_all_blocs_opened" : "other_profile_all_blocs_opened");
	          setProfileTab(value);
	        },
	        style:{minHeight:24,borderRadius:8,border:"none",cursor:"pointer",background:profileTab===value?"rgba(78,205,196,.12)":"transparent",color:profileTab===value?"#4ECDC4":"var(--muted)",fontFamily:"'Outfit',sans-serif",fontSize:8.5,fontWeight:900,textTransform:"uppercase",letterSpacing:".055em"}
	      },label))
	    )
      )
    ),
    cropSource && createPortal(React.createElement(ProfilePhotoCropModal,{imageSrc:cropSource,onCancel:()=>setCropSource(""),onConfirm:async dataUrl=>{setCropSource(""); setLocalPhoto(dataUrl); const saved=await onUpdateProfilePhoto(dataUrl); if(saved?.profilePhotoUrl) setLocalPhoto(saved.profilePhotoUrl);}}), document.body),
	    profileTab==="alltime"
	      ? allTimePanel
	      : React.createElement(React.Fragment,null,
	    monthSelector,
	    // Sit out banner
	    notJoinedBanner || sitOutBanner,
	    // The month as a ring: where you are, and what is left. An ended month
	    // you missed says by how much; any month over target says how far over.
	    isJoinedThisMonth&&!isExcusedThisMonth&&React.createElement(Card,{className:"fu2",style:{padding:"10px 14px"}},
	      React.createElement('div',{style:{display:"flex",alignItems:"center",gap:12}},
	        React.createElement('div',{style:{position:"relative",width:50,height:50,flexShrink:0}},
	          React.createElement('svg',{width:50,height:50,viewBox:"0 0 44 44",style:{transform:"rotate(-90deg)"}},
	            React.createElement('circle',{cx:22,cy:22,r:18,fill:"none",stroke:"rgba(255,255,255,.07)",strokeWidth:4}),
	            React.createElement('circle',{cx:22,cy:22,r:18,fill:"none",stroke:needed===0?"#E2E8F0":"#58EBE1",strokeWidth:4,strokeLinecap:"round",strokeDasharray:113.1,strokeDashoffset:113.1*(1-Math.min(1,selectedTarget?selCount/selectedTarget:0))})
	          ),
	          React.createElement('div',{style:{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Outfit',sans-serif",fontSize:13,fontWeight:800,color:"var(--text)"}},selCount||0)
	        ),
	        React.createElement('div',{style:{minWidth:0,fontFamily:"'Outfit',sans-serif"}},
	          React.createElement('div',{style:{fontSize:14,fontWeight:700,color:"var(--text)"}},(!isCurMonth || selCount>selectedTarget) ? `${selCount||0} workout${selCount===1?"":"s"}` : `${selCount||0} of ${selectedTarget} workouts`),
	          React.createElement('div',{style:{fontSize:12,fontWeight:600,marginTop:2,color:selCount>selectedTarget?"#4ECDC4":needed===0?"#E2E8F0":isCurMonth?"#4ECDC4":"#E89A9A"}},selCount>selectedTarget?`${selCount-selectedTarget} ahead of target`:needed===0?"Target hit":isCurMonth?`${needed} to target`:`Missed by ${needed}`)
	        )
	      )
	    ),
	    isJoinedThisMonth&&!isExcusedThisMonth&&React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:6}},
	      [["Average",closedStats.avg,"var(--text)"],["Perfect months",perfectMonthStats.count||"\u2014","var(--text)"],["Months won",hasHistory?(closedStats.wins||"\u2014"):"\u2014",hasHistory&&closedStats.wins>0?"var(--gold)":"var(--text)"]].map(([label,val,color])=>
	        React.createElement(Card,{key:label,style:{position:"relative",padding:"7px 7px 8px",display:"flex",flexDirection:"column",alignItems:"center",overflow:"hidden",boxShadow:"0 12px 24px rgba(0,0,0,.26), 0 2px 10px rgba(78,205,196,.07)"}},
	          React.createElement('div',{style:{position:"absolute",left:9,right:9,top:0,height:1,background:"rgba(115,232,223,.42)"}}),
	          React.createElement('span',{style:{display:"block",fontSize:8.5,fontWeight:500,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:4,textAlign:"center"}},label),
	          React.createElement('div',{style:{fontSize:15.5,fontWeight:500,lineHeight:1.02,color}},val)
	        ))
	    ),
	    // Money stays out of the foreground: one quiet line, and only when there
	    // is something to say.
	    isJoinedThisMonth&&!isExcusedThisMonth&&hasHistory&&netPL!==0&&React.createElement('div',{style:{textAlign:"center",fontFamily:"'Outfit',sans-serif",fontSize:11.5,color:"var(--muted)",marginTop:-2}},
	      "Net in this Bloc: ",React.createElement('span',{style:{fontWeight:700,color:netPL>0?"var(--green)":"var(--red)"}},`${netPL>0?"+":"-"}${fmtCurrency(Math.abs(netPL),currency)}`)
	    ),
	    isJoinedThisMonth&&!isExcusedThisMonth&&React.createElement(Card,{className:"fu4",style:{padding:"13px 14px",background:"radial-gradient(circle at 12% 0%, rgba(255,255,255,.032), transparent 34%), radial-gradient(circle at 88% 100%, rgba(78,205,196,.052), transparent 42%), linear-gradient(180deg, rgba(10,19,19,.98), rgba(7,14,14,.98))",boxShadow:"inset 0 1px 0 rgba(255,255,255,.035), 0 7px 16px rgba(0,0,0,.12)"}},
	      React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12}},
	        React.createElement('div',{style:{display:"flex",alignItems:"center",gap:7,minWidth:0}},
          React.createElement('div',{style:{fontWeight:800,fontSize:14}},selLabel),
	          selIsTraining&&React.createElement('button',{
	            type:"button",
	            onClick:()=>setOpenStatusNote("training"),
	            "aria-label":"About this first month",
	            style:{display:"inline-flex",alignItems:"center",flexShrink:0,padding:0,background:"transparent",border:"none"}
	          }, React.createElement(TrainingSproutIcon,{size:13})),
	          selIsSolo&&React.createElement('button',{
	            type:"button",
	            onClick:()=>setOpenStatusNote("solo"),
	            "aria-label":"About solo mode",
	            style:{display:"inline-flex",alignItems:"center",flexShrink:0,padding:0,background:"transparent",border:"none"}
	          }, React.createElement(SoloFlagIcon,{size:13})),
	          selRedemptionMark&&React.createElement('button',{
	            type:"button",
	            onClick:()=>setShowRedemptionNote(true),
	            "aria-label":selRedemptionMark === "redeemed" ? "About this redeemed month" : "About this redemption",
	            style:{display:"inline-flex",alignItems:"center",gap:5,flexShrink:0,padding:0,background:"transparent",border:"none",
	              color:selRedemptionMark === "redeemed" ? "#f5c842" : "#D44A4A"}
	          },
	            React.createElement(RedemptionShieldIcon,{size:12,redeemed:selRedemptionMark === "redeemed"}),
	            React.createElement('span',{style:{fontFamily:"'Outfit',sans-serif",fontSize:9,fontWeight:700,letterSpacing:".04em",textTransform:"uppercase"}},
	              selRedemptionMark === "redeemed" ? "Redeemed" : "Redemption")
	          )
	        ),
	        shareStickerData ? React.createElement('button',{
	          type:"button",
	          onClick:()=>setShowShareSticker(true),
	          "aria-label":`Share ${selLabel}`,
	          title:"Share this month",
	          style:{display:"inline-flex",alignItems:"center",gap:5,flexShrink:0,padding:"6px 11px",borderRadius:999,cursor:"pointer",background:"rgba(78,205,196,.1)",border:"1px solid rgba(78,205,196,.32)",color:"#4ECDC4",fontSize:11,fontWeight:800,fontFamily:"'Outfit',sans-serif"}
	        },
	          React.createElement(AppIcon,{name:"share",size:12,stroke:"#4ECDC4"}),
	          "Share"
	        ) : null
	      ),
	      React.createElement('div',{style:{maxWidth:compactMobile?318:380,margin:"0 auto"}},
	      React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}},
	        ["M","T","W","T","F","S","S"].map((d,i)=>React.createElement('div',{key:i,className:"mono",style:{textAlign:"center",fontSize:9,color:"var(--muted2)",padding:"1px 0"}},d))
	      ),
	      React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}},
	        calDays.map((day,i)=>{
	          if(!day) return React.createElement('div',{key:`e${i}`});
	          const isToday=isCurMonth&&day===DAY_OF_MON,dayLogs=logsByDay[day]||[],log=dayLogs[0]||null,isFuture=isCurMonth&&day>DAY_OF_MON;
          const canDelete = dayLogs.length > 0 && isCurMonth && !!onDeleteLog;
          const canInspect = dayLogs.length > 0;
          const openDayLog = () => {
            if (canDelete) { dayLogs.length === 1 ? setDeleteTarget(log) : setDeleteChoices(dayLogs); return; }
            dayLogs.length === 1 ? setWorkoutDetail(log) : setWorkoutChoices(dayLogs);
          };
          return React.createElement('div',{key:day, onClick: canInspect ? openDayLog : undefined, style:{aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:5,fontSize:log?11:9,fontFamily:log?"inherit":"'JetBrains Mono',monospace",fontWeight:log?700:400,background:log?"#1A2E4A":isToday?"var(--s2)":"transparent",color:log?"#4ECDC4":isFuture?"var(--muted2)":isToday?"var(--text)":"var(--muted)",border:isToday&&!log?"1px solid var(--border2)":"1px solid transparent",cursor:canInspect?"pointer":"default"}},log?React.createElement('span',{style:{position:"relative",width:19,height:19,display:"inline-flex",alignItems:"center",justifyContent:"center"}},React.createElement(WorkoutTypeIcon,{type:getLogDisplayActivity(log),size:15}),dayLogs.length>1&&React.createElement('span',{style:{position:"absolute",right:-5,top:-5,minWidth:12,height:12,padding:"0 2px",borderRadius:999,display:"inline-flex",alignItems:"center",justifyContent:"center",background:"#4ECDC4",border:"1px solid #1A2E4A",color:"#071010",fontFamily:"'Outfit',sans-serif",fontSize:7.5,fontWeight:900,lineHeight:1}},Math.min(dayLogs.length,2))):day);
	        })
	      )
	      )
	    ),
	    isJoinedThisMonth&&!isExcusedThisMonth&&React.createElement(Card,{className:"fu3",style:{padding:"16px"}},
		      React.createElement('div',{style:{fontWeight:800,fontSize:14,marginBottom:14}},"Workout Breakdown"),
	      !hasDetailedLogs
	        ? React.createElement('div',{style:{color:"var(--muted)",fontSize:13,textAlign:"center",padding:"8px 0"}},"Detailed logs were not saved for this month.")
	      : selCount===0
	        ? React.createElement('div',{style:{color:"var(--muted)",fontSize:13,textAlign:"center",padding:"8px 0"}},"No workouts logged yet.")
	        : workoutBreakdownRows.map(t=>React.createElement('div',{key:t,style:{display:"flex",alignItems:"center",gap:10,marginBottom:9}},
	            React.createElement('span',{style:{width:22,minWidth:22,height:22,display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#dbe8ff"}},React.createElement(WorkoutTypeIcon,{type:t,size:16})),
	            React.createElement('div',{style:{minWidth:40,fontSize:13,fontWeight:600}},t),
	            React.createElement('div',{style:{flex:1}},React.createElement(Bar,{value:tBreak[t],max:maxT,color:t==="Gym"?"#4ECDC4":"#1E4040"})),
	            React.createElement('span',{className:"mono",style:{fontSize:13,fontWeight:700,minWidth:18,textAlign:"right",color:tBreak[t]>0?"var(--text)":"var(--muted2)"}},tBreak[t])
	          ))
	    ),
    // A past sit-out month is historical context only. Its banner is the whole
    // story; today's yearly allowance belongs on the active month instead.
    (isCurMonth || !isExcusedThisMonth) && renderAllowanceLine()
	      )
	  ));
};

// ─── TODAY PAGE ───────────────────────────────────────────────────────────────

export { PlayerProfile };
