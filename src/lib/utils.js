import {
  LEGACY_GROUP_ID,
  WORKOUT_TYPES,
  DEFAULT_GROUP_TIME_ZONE,
  LEAGUE_CUTOFF_HOUR,
  DAYS_IN_MON,
  DAY_OF_MON,
  curKey,
  MONTH_NAMES,
  ACTIVE_SESSION_USER_ID,
  getDaysLeft,
  getTimeContextForGroup,
  fmtISO,
  toISODate,
  getLeaderboardDisplayStatus,
  getEffectiveJoinedMonthForMember,
  getMemberTargetForMonth,
  getMemberTargetInfoForMonth,
  normalizeWorkoutType,
  compareMonthKeys,
  getCurrentGroupMemberNames,
  flattenFeedPosts
} from "./appState.js";
import {
  isLocalDevEnvironment,
  getSupabaseAuthClient
} from "./api.js";

function getAcceptedWorkoutTypes(group) {
  const accepted = group?.settings?.acceptedWorkoutTypes;
  const base = Array.isArray(accepted) && accepted.length ? accepted : [...WORKOUT_TYPES];
  // Always sort by canonical WORKOUT_TYPES order so stored legacy ordering never shows through.
  return [...base].sort((a, b) => WORKOUT_TYPES.indexOf(a) - WORKOUT_TYPES.indexOf(b));
}

function groupCountsWorkoutType(group, workoutType) {
  return getAcceptedWorkoutTypes(group).includes(normalizeWorkoutType(workoutType));
}

function getTimeZoneAbbreviation(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short"
    }).formatToParts(new Date());
    return parts.find(part => part.type === "timeZoneName")?.value || timeZone;
  } catch {
    return timeZone;
  }
}

function getTimeZoneOffsetMs(timeZone, date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const year = Number(parts.find(part => part.type === "year").value);
  const month = Number(parts.find(part => part.type === "month").value);
  const day = Number(parts.find(part => part.type === "day").value);
  const hour = Number(parts.find(part => part.type === "hour").value);
  const minute = Number(parts.find(part => part.type === "minute").value);
  const second = Number(parts.find(part => part.type === "second").value);
  return Date.UTC(year, month - 1, day, hour, minute, second) - date.getTime();
}

function zonedDateToUtc(timeZone, year, month, day, hour = 0, minute = 0, second = 0) {
  const approxUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return new Date(approxUtc.getTime() - getTimeZoneOffsetMs(timeZone, approxUtc));
}

function formatCountdown(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2,"0")}m`;
}

function formatGmtOffset(timeZone, date) {
  const offsetMs = getTimeZoneOffsetMs(timeZone, date);
  const totalMinutes = Math.round(offsetMs / 60000);
  const sign = totalMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(totalMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return minutes === 0
    ? `GMT${sign}${hours}`
    : `GMT${sign}${hours}:${String(minutes).padStart(2,"0")}`;
}

function getGroupCloseMeta(group, now = new Date()) {
  const timeZone = group?.settings?.timeZone || DEFAULT_GROUP_TIME_ZONE;
  const context = getTimeContextForGroup(group);
  const nextMonth = context.month === 11 ? 1 : context.month + 2;
  const nextYear = context.month === 11 ? context.year + 1 : context.year;
  const cutoff = zonedDateToUtc(timeZone, nextYear, nextMonth, 1, LEAGUE_CUTOFF_HOUR, 0, 0);
  const remainingMs = cutoff.getTime() - now.getTime();
  const closeDate = cutoff.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone });
  const closeTime = cutoff.toLocaleTimeString("en-US", {
    timeZone,
    hour: "numeric",
    hour12: true
  });
  const offsetLabel = formatGmtOffset(timeZone, cutoff);
  const isCountdown = remainingMs > 0 && remainingMs < 24 * 60 * 60 * 1000;
  const tone = !isCountdown ? "normal" : remainingMs < 6 * 60 * 60 * 1000 ? "critical" : "urgent";
  return {
    label: isCountdown
      ? `Closes in ${formatCountdown(remainingMs)}`
      : `Closes ${closeTime} · ${closeDate} · ${offsetLabel}`,
    compactLabel: isCountdown
      ? `Closes in ${formatCountdown(remainingMs)}`
      : `Closes ${closeTime} · ${offsetLabel}`,
    timeZoneAbbr: getTimeZoneAbbreviation(timeZone),
    offsetLabel,
    closeDate,
    closeTime,
    remainingMs,
    isCountdown,
    tone
  };
}

function formatShortDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T12:00:00");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function formatRelativeTime(value) {
  if (!value) return "";
  const diffMs = Date.now() - new Date(value).getTime();
  if (diffMs < 0) return "";
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return fmtISO(value.slice(0, 10));
}

function formatCompactRelativeTime(value) {
  if (!value) return "";
  const diffMs = Date.now() - new Date(value).getTime();
  if (diffMs < 0) return "";
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return formatShortDate(value.slice(0, 10));
}

function isRecentPastTimestamp(value, now = Date.now()) {
  const diffMs = now - new Date(value).getTime();
  return Number.isFinite(diffMs) && diffMs >= 0 && diffMs < 86400000;
}

async function compressImageFile(file, maxSize = 1280, quality = 0.82) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function compressImageDataUrl(dataUrl, maxSize = 720, quality = 0.72) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

function estimateDataUrlBytes(dataUrl) {
  const normalized = String(dataUrl || "");
  const commaIndex = normalized.indexOf(",");
  const base64 = commaIndex >= 0 ? normalized.slice(commaIndex + 1) : normalized;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

async function uploadPhotoToStorage(dataUrl) {
  const userId = ACTIVE_SESSION_USER_ID;
  if (!userId) throw new Error("Not signed in");
  // Convert data URL to Blob via fetch (works in all modern browsers)
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${userId}/${Date.now()}.jpg`;
  const client = await getSupabaseAuthClient();
  const { error } = await client.storage
    .from("workout-photos")
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  const { data } = client.storage.from("workout-photos").getPublicUrl(path);
  return data.publicUrl;
}

// (flattenFeedPosts moved to appState.js)

function isJoinedForGroupMonth(group, userName, monthKey) {
  const joinedMonth = getEffectiveJoinedMonthForMember(group, userName, monthKey);
  return !joinedMonth || compareMonthKeys(monthKey, joinedMonth) >= 0;
}

function getGroupOverview(group) {
  if (!group) return null;
  const monthKey = curKey;
  const sourceNames = Array.isArray(group.activeMemberOrder) && group.activeMemberOrder.length
    ? group.activeMemberOrder
    : group.memberOrder;
  const activeMembers = sourceNames.filter(name => isJoinedForGroupMonth(group, name, monthKey) && !group.excused?.[name]?.[monthKey]);
  const totalLogged = activeMembers.reduce((sum, name) => sum + ((group.logs?.[name] || []).length), 0);
  const memberTargets = Object.fromEntries(activeMembers.map(name => [name, getMemberTargetForMonth(group, name, monthKey)]));
  const totalTarget = activeMembers.reduce((sum, name) => sum + (memberTargets[name] || 0), 0);
  const totalExpected = activeMembers.reduce((sum, name) => sum + Math.floor(((memberTargets[name] || 0) / DAYS_IN_MON) * DAY_OF_MON), 0);
  const totalPossible = totalLogged + (activeMembers.length * getDaysLeft());
  let status = "behind";
  if (activeMembers.length === 0) status = "excused";
  else if (totalPossible < totalTarget) status = "cooked";
  else if (totalLogged - totalExpected >= Math.max(2, activeMembers.length)) status = "cruising";
  else if (totalLogged >= totalExpected) status = "on-track";
  else if (totalLogged >= totalExpected - Math.max(3, activeMembers.length * 2)) status = "at-risk";
  status = getLeaderboardDisplayStatus(status, totalLogged, DAY_OF_MON);
  return {
    status,
    activeMembers: activeMembers.length,
    totalLogged,
    totalTarget,
    totalExpected,
    totalRemaining: Math.max(0, totalTarget - totalLogged)
  };
}

function getGroupMemberPreview(group, userName) {
  const sourceNames = Array.isArray(group?.activeMemberOrder) && group.activeMemberOrder.length
    ? group.activeMemberOrder
    : (group?.memberOrder || []);
  if (!group || !userName || !sourceNames.includes(userName)) return null;
  const context = getTimeContextForGroup(group);
  const monthKey = context.monthKey;
  if (!isJoinedForGroupMonth(group, userName, monthKey)) return null;
  const count = (group.logs?.[userName] || []).length;
  const isOut = group.excused?.[userName]?.[monthKey] || false;
  const { target: minTarget, joinDay = 1, proratedDays } = getMemberTargetInfoForMonth(group, userName, monthKey);
  if (isOut) return { count, status: "excused", needed: Math.max(0, minTarget - count) };
  const activeDays = proratedDays || context.daysInMonth;
  const daysActive = Math.max(0, context.day - joinDay + 1);
  const expected = Math.floor((minTarget / activeDays) * daysActive);
  const daysLeft = context.daysInMonth - context.day + 1;
  let status = "behind";
  if (count + daysLeft < minTarget) status = "cooked";
  else if (count - expected >= 2) status = "cruising";
  else if (count >= expected) status = "on-track";
  else if (count >= expected - 2) status = "at-risk";
  status = getLeaderboardDisplayStatus(status, count, context.day);
  return { count, status, needed: Math.max(0, minTarget - count) };
}

// (getCurrentGroupMemberNames moved to appState.js)

function groupStatusLabel(status) {
  return status === "on-track" ? "On track"
    : status === "locked-in" ? "Locked in"
    : status === "cruising" ? "Cruising"
    : status === "starting-soon" ? "Starting soon"
    : status === "at-risk" ? "At risk"
    : status === "cooked" ? "Cooked"
    : status === "excused" ? "Excused"
    : "Behind";
}

function groupStatusColor(status) {
  return status === "locked-in" ? "#E2E8F0"
    : status === "cruising" ? "#CBD5E1"
    : status === "starting-soon" ? "#8FAEAA"
    : status === "on-track" ? "#5ABF5A"
    : status === "at-risk" ? "#D4A843"
    : status === "behind" ? "#D47843"
    : status === "excused" ? "var(--muted)"
    : "#D44A4A";
}

function leaderboardRowTint(status) {
  return status === "locked-in" ? "linear-gradient(90deg, rgba(203,213,225,.10) 0%, rgba(203,213,225,.20) 100%)"
    : status === "cruising" ? "rgba(203,213,225,.08)"
    : status === "starting-soon" ? "rgba(143,174,170,.06)"
    : status === "on-track" ? "rgba(90,191,90,.09)"
    : status === "at-risk" ? "rgba(212,168,67,.10)"
    : status === "behind" ? "rgba(212,120,67,.08)"
    : status === "cooked" ? "rgba(212,74,74,.10)"
    : "transparent";
}

function getDisplayBlocPerfectStreak(group, fallback = 0) {
  if (isLocalDevEnvironment() && group?.id === LEGACY_GROUP_ID) return 3;
  return fallback;
}

function buildLocalLeaderboardComparisonRows(group, sourceRows = []) {
  if (!isLocalDevEnvironment() || group?.id !== LEGACY_GROUP_ID) return null;
  return [
    { key:"compare-aadhil-locked", name:"Aadhil", count:14, isOut:false, target:12, status:"locked-in", memberDiffLabel:"+4 ahead of pace", rank:1, prorated:false },
    { key:"compare-kisal-locked", name:"Kisal", count:13, isOut:false, target:12, status:"locked-in", memberDiffLabel:"+3 ahead of pace", rank:2, prorated:false },
    { key:"compare-nishara-cruising", name:"Nishara", count:11, isOut:false, target:12, status:"cruising", memberDiffLabel:"+3 ahead of pace", rank:3, prorated:false },
    { key:"compare-rahul-cruising", name:"Rahul", count:10, isOut:false, target:12, status:"cruising", memberDiffLabel:"+2 ahead of pace", rank:4, prorated:false },
    { key:"compare-deyhan-track", name:"Deyhan", count:8, isOut:false, target:12, status:"on-track", memberDiffLabel:"on pace", rank:5, prorated:false },
    { key:"compare-aysha-track", name:"Aysha", count:8, isOut:false, target:12, status:"on-track", memberDiffLabel:"on pace", rank:6, prorated:false },
    { key:"compare-abhishek-risk", name:"Abhishek", count:6, isOut:false, target:12, status:"at-risk", memberDiffLabel:"-2 behind pace", rank:7, prorated:false },
    { key:"compare-isira-risk", name:"Isira", count:5, isOut:false, target:12, status:"at-risk", memberDiffLabel:"-3 behind pace", rank:8, prorated:false },
    { key:"compare-monika-behind", name:"Monika", count:4, isOut:false, target:12, status:"behind", memberDiffLabel:"-4 behind pace", rank:9, prorated:false },
    { key:"compare-varun-behind", name:"Varun", count:3, isOut:false, target:12, status:"behind", memberDiffLabel:"-5 behind pace", rank:10, prorated:false },
    { key:"compare-giang-cooked", name:"Giang", count:2, isOut:false, target:12, status:"cooked", memberDiffLabel:"target out of reach", rank:11, prorated:false },
    { key:"compare-rodri-cooked", name:"Rodri", count:1, isOut:false, target:12, status:"cooked", memberDiffLabel:"target out of reach", rank:12, prorated:false }
  ];
}

function formatWeeklyMvpLeaderText(names = []) {
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} + ${names[1]}`;
  return `${names[0]} + ${names.length - 1} more`;
}

function formatWeekRangeLabel(startDate, endDate) {
  if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime()) || !(endDate instanceof Date) || Number.isNaN(endDate.getTime())) return "";
  const startMonth = MONTH_NAMES[startDate.getMonth()].slice(0, 3);
  const endMonth = MONTH_NAMES[endDate.getMonth()].slice(0, 3);
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  return startMonth === endMonth
    ? `${startMonth} ${startDay}-${endDay}`
    : `${startMonth} ${startDay}-${endMonth} ${endDay}`;
}

function buildLocalWeeklyMvpPreview(group, currentWeekDays) {
  if (!isLocalDevEnvironment() || group?.id !== LEGACY_GROUP_ID || !Array.isArray(currentWeekDays) || !currentWeekDays.length) return null;
  const makeLogsByIso = (type, indexes) => Object.fromEntries(
    indexes.map(index => {
      const iso = toISODate(currentWeekDays[index]);
      return [iso, { date: iso, type }];
    })
  );
  return {
    currentWeekValue: "Monika",
    currentWeekLeaders: [
      { name:"Monika", logsByIso: makeLogsByIso("gym", [0, 2, 4]) }
    ],
    previousWeeks: [
      { key:"preview-week-1", label:"Week 1", rangeLabel:"Jun 30-Jul 6", leaders:["Rahul"], count:4, isTie:false },
      { key:"preview-week-2", label:"Week 2", rangeLabel:"Jul 7-13", leaders:["Monika"], count:3, isTie:false },
      { key:"preview-week-3", label:"Week 3", rangeLabel:"Jul 14-20", leaders:["Aadhil", "Kisal"], count:5, isTie:true }
    ]
  };
}

function acceptedTypesLabel(types) {
  if (!types?.length) return "Counts all workout types";
  return `Counts: ${types.join(", ")}`;
}

// ─── ATOMS ────────────────────────────────────────────────────────────────────
// (React hooks destructure moved to app.jsx)

const isMobile = () => window.innerWidth <= 768;

const copyToClipboard = async (text, btn) => {
  const succeed = () => {
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = "Copied!";
    btn.style.color = "var(--green)";
    setTimeout(() => { btn.textContent = orig; btn.style.color = ""; }, 1600);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try { await navigator.clipboard.writeText(text); succeed(); return; } catch {}
  }
  // Fallback for non-HTTPS / iOS Safari
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try { document.execCommand("copy"); succeed(); } catch {}
  document.body.removeChild(ta);
};
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const isSafari = () => /^((?!chrome|android).)*safari/i.test(window.navigator.userAgent);
const formatSyncTime = date => date
  ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  : "";


export {
  getAcceptedWorkoutTypes,
  groupCountsWorkoutType,
  getTimeZoneAbbreviation,
  getTimeZoneOffsetMs,
  zonedDateToUtc,
  formatCountdown,
  formatGmtOffset,
  getGroupCloseMeta,
  formatShortDate,
  formatRelativeTime,
  formatCompactRelativeTime,
  isRecentPastTimestamp,
  compressImageFile,
  compressImageDataUrl,
  estimateDataUrlBytes,
  uploadPhotoToStorage,
  isJoinedForGroupMonth,
  getGroupOverview,
  getGroupMemberPreview,
  groupStatusLabel,
  groupStatusColor,
  leaderboardRowTint,
  getDisplayBlocPerfectStreak,
  buildLocalLeaderboardComparisonRows,
  formatWeeklyMvpLeaderText,
  formatWeekRangeLabel,
  buildLocalWeeklyMvpPreview,
  acceptedTypesLabel,
  isMobile,
  copyToClipboard,
  isStandalone,
  isIos,
  isSafari,
  formatSyncTime
};
