
const LEGACY_GROUP_ID = "legacy-group";
const DEFAULT_GROUP_NAME = "Fero OG";
const DEFAULT_NAMES = ["Aadhil","Isira","Rahul","Kisal","Rishane","Deyhan","Aysha","Nishara","Abhishek"];
const WORKOUT_TYPES = ["Gym","Run","Sports","Pilates","Other"];
const DEFAULT_MIN_TARGET = 12;
const DEFAULT_GROUP_TIME_ZONE = "Europe/Oslo";
const LEAGUE_CUTOFF_HOUR = 3;
const DEFAULT_FINE_AMOUNT = 20;
const DEFAULT_FEE_MODEL = "escalating";
const DEFAULT_ESCALATION_STEP_AMOUNT = null;
const DEFAULT_CURRENCY = "NOK";
const DEFAULT_MIN_RUN_DISTANCE = 3;
const DEFAULT_DISTANCE_UNIT = "km";
const DEFAULT_STRAVA_ENABLED = true;
const UNFLAGGED_IMAGE_RETENTION_MS = 72 * 60 * 60 * 1000;
const RESOLVED_IMAGE_RETENTION_MS = 24 * 60 * 60 * 1000;
const DEFAULT_JOINED_MONTH_BY_NAME = { Abhishek: "2026-4" };
let GROUP_NAME = DEFAULT_GROUP_NAME;
let NAMES = [...DEFAULT_NAMES];
let MIN_TARGET = DEFAULT_MIN_TARGET;
let JOINED_MONTH_BY_NAME = { ...DEFAULT_JOINED_MONTH_BY_NAME };
let ACTIVE_MEMBER_JOINED_AT_BY_NAME = {};
let ACTIVE_LOGS_BY_NAME = {};
let ACTIVE_MONTH_HISTORY = [];
let ACTIVE_SEASON_OVERRIDES = {};
let ACTIVE_GROUP_CREATED_AT = null;
let ACTIVE_ADMIN_NAME = "";
let ACTIVE_GROUP_TIME_ZONE = DEFAULT_GROUP_TIME_ZONE;
let LEAGUE_TODAY = null;
let CUR_MONTH = 0;
let CUR_YEAR = 0;
let DAYS_IN_MON = 0;
let DAY_OF_MON = 0;
let TODAY_ISO = "";
let curKey = "";
let EARLIEST_LOG_DATE = "";

const getLeagueDateParts = (timeZone = ACTIVE_GROUP_TIME_ZONE) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const year = Number(parts.find(part => part.type === "year").value);
  const month = Number(parts.find(part => part.type === "month").value);
  const day = Number(parts.find(part => part.type === "day").value);
  const hour = Number(parts.find(part => part.type === "hour").value);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (hour < LEAGUE_CUTOFF_HOUR) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
};
const MONTH_NAMES   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const AVATAR_COLORS = [
  "#C84B68","#9B50D0","#4870D0","#C44A7A","#5A7AAF",
  "#D44A50","#6055D4","#BF5A45","#A06090","#3A78C0",
  "#B055D0","#C85040","#7A8FAF","#8A7AC8","#BF4A90",
  "#3A6EAF","#D45060","#7A50CC","#A05070","#5A6FD4"
];
let ACTIVE_SESSION_USER_ID = "";
let ACTIVE_NAME_TO_USER_ID = {};
let ACTIVE_PROFILE_PHOTO_BY_USER_ID = {};
let ACTIVE_PROFILE_PHOTO_BY_NAME = {};
function hashString(value) {
  const input = String(value || "");
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  return Math.abs(hash);
}
const resolveAvatarUserId = name => ACTIVE_NAME_TO_USER_ID?.[name] || "";
const resolveAvatarPhotoUrl = (name, explicitUserId = "") => {
  const userId = explicitUserId || resolveAvatarUserId(name);
  return (userId && ACTIVE_PROFILE_PHOTO_BY_USER_ID?.[userId]) || ACTIVE_PROFILE_PHOTO_BY_NAME?.[name] || "";
};
const avatarColor = (name, explicitUserId = "") => {
  const userId = explicitUserId || resolveAvatarUserId(name) || String(name || "");
  if (ACTIVE_SESSION_USER_ID && userId === ACTIVE_SESSION_USER_ID) return "#E8A23A";
  return AVATAR_COLORS[hashString(userId) % AVATAR_COLORS.length];
};
const WORKOUT_TYPE_ALIASES = {
  Sport: "Sports",
  Hike: "Other",
  Hiking: "Other"
};
const CURRENCY_OPTIONS = [
  { code:"NOK", label:"Norwegian Krone" },
  { code:"USD", label:"US Dollar" },
  { code:"EUR", label:"Euro" },
  { code:"GBP", label:"British Pound" },
  { code:"LKR", label:"Sri Lankan Rupee" },
  { code:"INR", label:"Indian Rupee" },
  { code:"CAD", label:"Canadian Dollar" },
  { code:"AUD", label:"Australian Dollar" }
];
const DISTANCE_UNIT_OPTIONS = [
  { value:"km", label:"Kilometers" },
  { value:"mi", label:"Miles" }
];
const QUICK_REACTIONS = ["💪","🔥","👀","👏","😤","🏃","🦍","😂"];
const COMMON_TIME_ZONES = [
  "Europe/Oslo","Europe/London","Europe/Paris","Europe/Berlin","Europe/Madrid",
  "America/New_York","America/Chicago","America/Denver","America/Los_Angeles","America/Toronto",
  "Asia/Colombo","Asia/Dubai","Asia/Kolkata","Asia/Singapore","Asia/Tokyo",
  "Australia/Sydney","Pacific/Auckland"
];
const STATUS_COLORS = {
  cruising: "#CBD5E1",
  "on-track": "#5ABF5A",
  "at-risk": "#D4A843",
  behind: "#D47843",
  cooked: "#D44A4A"
};

const localISO = d => {
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
};
const INSTALL_DISMISSED_KEY = "ll_pwa_install_dismissed";
const LOCAL_CACHE_KEY = "ll_cached_data_v2";
const LOCAL_GROUP_KEY = "ll_group_id";
const LOCAL_PREVIEW_AUTH_KEY = "ll_preview_auth";
const LOCAL_DEV_IMPERSONATION_KEY = "ll_dev_impersonation_user_id";
const SYNC_POLL_INTERVAL_MS = 6000;
const getDaysLeft = () => DAYS_IN_MON - DAY_OF_MON + 1;

function refreshActiveTimeContext(timeZone = DEFAULT_GROUP_TIME_ZONE) {
  ACTIVE_GROUP_TIME_ZONE = timeZone || DEFAULT_GROUP_TIME_ZONE;
  LEAGUE_TODAY = getLeagueDateParts(ACTIVE_GROUP_TIME_ZONE);
  CUR_MONTH = LEAGUE_TODAY.month - 1;
  CUR_YEAR = LEAGUE_TODAY.year;
  DAYS_IN_MON = new Date(CUR_YEAR, CUR_MONTH + 1, 0).getDate();
  DAY_OF_MON = LEAGUE_TODAY.day;
  TODAY_ISO = `${CUR_YEAR}-${String(CUR_MONTH + 1).padStart(2,"0")}-${String(DAY_OF_MON).padStart(2,"0")}`;
  curKey = `${CUR_YEAR}-${CUR_MONTH}`;
  EARLIEST_LOG_DATE = `${CUR_YEAR}-${String(CUR_MONTH + 1).padStart(2,"0")}-01`;
}

function getTimeContextForGroup(group) {
  const timeZone = group?.settings?.timeZone || DEFAULT_GROUP_TIME_ZONE;
  const today = getLeagueDateParts(timeZone);
  const month = today.month - 1;
  const year = today.year;
  return {
    timeZone,
    today,
    year,
    month,
    day: today.day,
    daysInMonth: new Date(year, month + 1, 0).getDate(),
    todayIso: `${year}-${String(month + 1).padStart(2,"0")}-${String(today.day).padStart(2,"0")}`,
    monthKey: `${year}-${month}`,
    earliestIso: `${year}-${String(month + 1).padStart(2,"0")}-01`
  };
}

function getLeagueMonthKey(timeZone = DEFAULT_GROUP_TIME_ZONE) {
  const { year, month } = getLeagueDateParts(timeZone || DEFAULT_GROUP_TIME_ZONE);
  return `${year}-${month - 1}`;
}

refreshActiveTimeContext(DEFAULT_GROUP_TIME_ZONE);

const fmtISO = iso => {
  if (iso instanceof Date) {
    if (Number.isNaN(iso.getTime())) return "";
    return iso.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});
  }
  if (typeof iso === "string") {
    const [y,m,d] = iso.split("-").map(Number);
    if ([y,m,d].every(Number.isFinite)) {
      return new Date(y,m-1,d).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});
    }
  }
  return "";
};

const toISODate = value => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? value : "";
  }
  return "";
};

const getExpected = (target = MIN_TARGET) => Math.floor((target / DAYS_IN_MON) * DAY_OF_MON);
const resolvePaceStatus = ({ count, target = MIN_TARGET, expected = getExpected(target), daysLeft = getDaysLeft() }) => {
  if (count >= target) return "locked-in";
  const diff = count - expected;
  if (count + daysLeft < target) return "cooked";
  if (diff >= 2) return "cruising";
  if (diff >= 0) return "on-track";
  if (diff >= -2) return "at-risk";
  return "behind";
};
const getStatus   = (n, target = MIN_TARGET) => resolvePaceStatus({ count: n, target });
const getDiff     = (n, target = MIN_TARGET) => n - getExpected(target); // positive = ahead, negative = behind
const diffLabel   = (n, target = MIN_TARGET) => { const d=getDiff(n, target); return d>0?`+${d} ahead of pace`:d<0?`${d} behind pace`:"on pace"; };
const isEarlyMonthNeutralWindow = (day = DAY_OF_MON) => day <= 3;
const getLeaderboardDisplayStatus = (status, count, day = DAY_OF_MON) => {
  if (isEarlyMonthNeutralWindow(day) && count === 0 && (status === "at-risk" || status === "behind" || status === "on-track")) {
    return "starting-soon";
  }
  return status;
};
const getLeaderboardDiffText = ({ status, count, target = MIN_TARGET, memberDiffLabel = null, day = DAY_OF_MON }) => {
  const displayStatus = getLeaderboardDisplayStatus(status, count, day);
  if (displayStatus === "starting-soon") return "month just started";
  if (status === "cooked") return "target out of reach";
  return memberDiffLabel || diffLabel(count, target);
};
function getPaceCheckMessage({ status, count, expected, target, isFirstActiveDay }) {
  if (status === "cooked") {
    return `✕ Even perfect attendance from here won't get you to ${target}`;
  }
  if (isFirstActiveDay && count < expected) {
    return "Log a workout today to stay on track";
  }
  if (status === "cruising") {
    const ahead = count - expected;
    return `⬆ You are cruising at ${ahead} workout${ahead !== 1 ? "s" : ""} ahead of pace`;
  }
  if (count >= expected) {
    const ahead = count - expected;
    return ahead === 0
      ? "✓ You are on pace"
      : `✓ You are ${ahead} workout${ahead !== 1 ? "s" : ""} ahead of pace`;
  }
  const behind = expected - count;
  return behind === 1
    ? "Log a workout today to stay on track"
    : `⚠ You are ${behind} workout${behind !== 1 ? "s" : ""} behind pace`;
}
const lastWorkout = (userLogs) => {
  const counted = getCountedLogs(userLogs);
  if(!counted.length) return null;
  const sorted=[...counted].sort((a,b)=>b.date.localeCompare(a.date));
  const last=sorted[0].date;
  const [y,m,d]=last.split("-").map(Number);
  const lastDate=new Date(y,m-1,d);
  const todayDate=new Date(CUR_YEAR,CUR_MONTH,DAY_OF_MON);
  const diff=Math.round((todayDate-lastDate)/(1000*60*60*24));
  if(diff===0) return "today";
  if(diff===1) return "1 day ago";
  return `${diff} days ago`;
};

function calcPenalties(activeCounts, settings = {}) {
  if(!activeCounts.length) return {winners:[],losers:[],perLoser:0,totalPot:0,perWinner:0,loserAmounts:{}};
  const minTarget = Number(settings?.minTarget || MIN_TARGET);
  const sorted=[...activeCounts].sort((a,b)=>b.count-a.count);
  const topCount=sorted[0].count;
  if(topCount===0) return {winners:[],losers:[],perLoser:0,totalPot:0,perWinner:0,loserAmounts:{}};
  const winners=sorted.filter(u=>u.count===topCount);
  const losers=activeCounts.filter(u=>u.count < (Number(u?.target) || minTarget) && u.count<topCount);
  const n=losers.length;
  const baseFine = Number(settings?.fineAmount || DEFAULT_FINE_AMOUNT);
  const feeModel = normalizeFeeModel(settings?.feeModel);
  const escalationStepAmount = Number(settings?.escalationStepAmount || 0);
  const sharedLoserAmount = n===0 ? 0 : feeModel==="flat"
    ? baseFine
    : baseFine + (escalationStepAmount * Math.max(0, n - 1));
  const loserAmounts = n===0 ? {} : Object.fromEntries(losers.map(loser => [loser.name, sharedLoserAmount]));
  const perLoser = sharedLoserAmount;
  const totalPot=Object.values(loserAmounts).reduce((sum, amount) => sum + amount, 0);
  const perWinner=winners.length>0&&totalPot>0?Math.floor(totalPot/winners.length):0;
  return {winners,losers,perLoser,totalPot,perWinner,loserAmounts};
}

function getLoserAmount(penalties, loserName) {
  return penalties?.loserAmounts?.[loserName] ?? penalties?.perLoser ?? 0;
}

function normalizeSeasonOverrides(seasonOverrides) {
  if (!seasonOverrides || typeof seasonOverrides !== "object") return {};
  return Object.fromEntries(
    Object.entries(seasonOverrides)
      .map(([monthKey, override]) => {
        if (!monthKey || !override) return null;
        const proratedMas = Number(override?.proratedMas);
        return [monthKey, {
          prorated: !!override?.prorated,
          proratedMas: Number.isFinite(proratedMas) ? Math.max(1, Math.round(proratedMas)) : null,
          chosenAt: override?.chosenAt || null,
          chosenBy: override?.chosenBy || null
        }];
      })
      .filter(Boolean)
  );
}

function normalizeSitOutRequests(sitOutRequests) {
  if (!sitOutRequests || typeof sitOutRequests !== "object") return {};
  return Object.fromEntries(
    Object.entries(sitOutRequests)
      .map(([monthKey, requests]) => {
        if (!monthKey || !requests || typeof requests !== "object") return null;
        return [monthKey, Object.fromEntries(
          Object.entries(requests)
            .map(([memberName, request]) => {
              if (!memberName || !request) return null;
              return [memberName, {
                memberName,
                monthKey,
                status: request?.status || "pending",
                reason: typeof request?.reason === "string" ? request.reason : "",
                exceptional: !!request?.exceptional,
                requestedAt: request?.requestedAt || null,
                requestedBy: request?.requestedBy || memberName,
                requestedByUserId: request?.requestedByUserId || null,
                targetApproverName: request?.targetApproverName || null,
                targetApproverUserId: request?.targetApproverUserId || null,
                decidedAt: request?.decidedAt || null,
                decidedBy: request?.decidedBy || null,
                decidedByUserId: request?.decidedByUserId || null,
                autoApproved: !!request?.autoApproved
              }];
            })
            .filter(Boolean)
        )];
      })
      .filter(Boolean)
  );
}

function pruneSitOutRequestsForRead(sitOutRequests, monthKey) {
  if (!monthKey) return {};
  const normalized = normalizeSitOutRequests(sitOutRequests);
  return normalized[monthKey] ? { [monthKey]: normalized[monthKey] } : {};
}

function getSeasonOverrideForMonth(group, monthKey) {
  return normalizeSeasonOverrides(group?.seasonOverrides)?.[monthKey] || null;
}

function getEffectiveTargetForMonth(group, monthKey, settingsOverride = null) {
  const baseTarget = Number(settingsOverride?.minTarget || group?.settings?.minTarget || DEFAULT_MIN_TARGET);
  const override = getSeasonOverrideForMonth(group, monthKey);
  return override?.prorated && Number.isFinite(Number(override?.proratedMas))
    ? Math.max(1, Math.round(Number(override.proratedMas)))
    : baseTarget;
}

function getSeasonProrationSummaryForMonth(group, monthKey, settingsOverride = null) {
  const override = getSeasonOverrideForMonth(group, monthKey);
  if (!override?.prorated || !Number.isFinite(Number(override?.proratedMas))) return null;
  const timeZone = settingsOverride?.timeZone || group?.settings?.timeZone || DEFAULT_GROUP_TIME_ZONE;
  const chosenSummary = getLeagueMonthSummaryForTimestamp(override?.chosenAt, timeZone);
  if (!chosenSummary || chosenSummary.monthKey !== monthKey) return null;
  return chosenSummary;
}

function getJoinedTargetInfo(baseTarget, joinedSummary, prorationSummary = null) {
  if (!joinedSummary || joinedSummary.day <= 1) return { target: baseTarget, joinDay: 1 };
  const joinDay = joinedSummary.daysInMonth - joinedSummary.daysRemaining + 1;
  if (!prorationSummary) {
    return {
      target: Math.max(1, Math.round((joinedSummary.daysRemaining / joinedSummary.daysInMonth) * baseTarget)),
      joinDay,
      proratedDays: joinedSummary.daysRemaining
    };
  }
  if (joinedSummary.day <= prorationSummary.day) {
    return {
      target: baseTarget,
      joinDay: prorationSummary.day,
      proratedDays: prorationSummary.daysRemaining
    };
  }
  return {
    target: Math.max(1, Math.round((joinedSummary.daysRemaining / prorationSummary.daysRemaining) * baseTarget)),
    joinDay,
    proratedDays: joinedSummary.daysRemaining
  };
}

function getLeagueMonthSummaryForTimestamp(value, timeZone = DEFAULT_GROUP_TIME_ZONE) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false
  }).formatToParts(date);
  const year = Number(parts.find(part => part.type === "year")?.value);
  const month = Number(parts.find(part => part.type === "month")?.value);
  const day = Number(parts.find(part => part.type === "day")?.value);
  const hour = Number(parts.find(part => part.type === "hour")?.value);
  if (![year, month, day, hour].every(Number.isFinite)) return null;

  const leagueDate = new Date(Date.UTC(year, month - 1, day));
  if (hour < LEAGUE_CUTOFF_HOUR) leagueDate.setUTCDate(leagueDate.getUTCDate() - 1);
  const leagueYear = leagueDate.getUTCFullYear();
  const leagueMonthIndex = leagueDate.getUTCMonth();
  const daysInMonth = new Date(leagueYear, leagueMonthIndex + 1, 0).getDate();
  const leagueDay = leagueDate.getUTCDate();
  return {
    monthKey: `${leagueYear}-${leagueMonthIndex}`,
    day: leagueDay,
    daysInMonth,
    daysRemaining: Math.max(1, daysInMonth - leagueDay + 1)
  };
}

function getCreatorMonthContext(group, displayName, monthKey, settingsOverride = null) {
  const membership = Object.values(group?.memberships || {}).find(entry => entry?.displayName === displayName) || null;
  if (!membership || membership.role !== "admin" || group?.adminName !== displayName) return null;
  const timeZone = settingsOverride?.timeZone || group?.settings?.timeZone || DEFAULT_GROUP_TIME_ZONE;
  const joinedSummary = getLeagueMonthSummaryForTimestamp(membership?.joinedAt, timeZone);
  const createdSummary = getLeagueMonthSummaryForTimestamp(group?.createdAt, timeZone);
  if (!joinedSummary || !createdSummary) return null;
  if (joinedSummary.monthKey !== monthKey || createdSummary.monthKey !== monthKey) return null;
  return { joinedSummary, createdSummary };
}

function getEffectiveJoinedMonthForMember(group, displayName, monthKey, settingsOverride = null) {
  const explicitJoinedMonth = group?.joinedMonthByName?.[displayName];
  const membership = Object.values(group?.memberships || {}).find(entry => entry?.displayName === displayName) || null;
  const creatorContext = getCreatorMonthContext(group, displayName, monthKey, settingsOverride);
  if (creatorContext && explicitJoinedMonth === monthKey) return null;
  if (explicitJoinedMonth) return explicitJoinedMonth;
  if (shouldInferJoinedMonthFromMembership(group, displayName, monthKey, membership, settingsOverride)) return monthKey;
  return null;
}

function getMemberTargetForMonth(group, displayName, monthKey, settingsOverride = null) {
  return getMemberTargetInfoForMonth(group, displayName, monthKey, settingsOverride).target;
}

function getMemberTargetInfoForMonth(group, displayName, monthKey, settingsOverride = null) {
  const baseTarget = getEffectiveTargetForMonth(group, monthKey, settingsOverride);
  const joinedMonth = getEffectiveJoinedMonthForMember(group, displayName, monthKey, settingsOverride);
  const prorationSummary = getSeasonProrationSummaryForMonth(group, monthKey, settingsOverride);
  if (joinedMonth && joinedMonth === monthKey) {
    const membership = Object.values(group?.memberships || {}).find(entry => entry?.displayName === displayName);
    const joinedSummary = getLeagueMonthSummaryForTimestamp(membership?.joinedAt, group?.settings?.timeZone || DEFAULT_GROUP_TIME_ZONE);
    if (!joinedSummary || joinedSummary.monthKey !== monthKey) return { target: baseTarget, joinDay: 1, prorationSource: "none" };
    return getJoinedTargetInfo(baseTarget, joinedSummary, prorationSummary);
  }
  const creatorContext = getCreatorMonthContext(group, displayName, monthKey, settingsOverride);
  if (creatorContext && prorationSummary) {
    return {
      target: baseTarget,
      joinDay: prorationSummary.day,
      proratedDays: prorationSummary.daysRemaining,
      prorationSource: "group"
    };
  }
  return { target: baseTarget, joinDay: 1, prorationSource: "none" };
}

function getActiveJoinedMonthForMember(displayName, monthKey) {
  const explicitJoinedMonth = JOINED_MONTH_BY_NAME?.[displayName];
  const joinedAt = ACTIVE_MEMBER_JOINED_AT_BY_NAME?.[displayName];
  const isCreator = (() => {
    if (!joinedAt || ACTIVE_ADMIN_NAME !== displayName) return false;
    const joinedSummary = getLeagueMonthSummaryForTimestamp(joinedAt, ACTIVE_GROUP_TIME_ZONE);
    const createdSummary = getLeagueMonthSummaryForTimestamp(ACTIVE_GROUP_CREATED_AT, ACTIVE_GROUP_TIME_ZONE);
    if (!joinedSummary || !createdSummary) return false;
    return joinedSummary.monthKey === monthKey && createdSummary.monthKey === monthKey;
  })();
  if (isCreator && explicitJoinedMonth === monthKey) return null;
  if (explicitJoinedMonth) return explicitJoinedMonth;
  if (shouldInferActiveJoinedMonth(displayName, monthKey, joinedAt)) return monthKey;
  return null;
}

function getCurrentMemberTarget(displayName, monthKey = curKey, baseTarget = MIN_TARGET) {
  return getCurrentMemberTargetInfo(displayName, monthKey, baseTarget).target;
}

function getCurrentMemberTargetInfo(displayName, monthKey = curKey, baseTarget = MIN_TARGET) {
  const joinedMonth = getActiveJoinedMonthForMember(displayName, monthKey);
  const chosenSummary = (() => {
    const override = normalizeSeasonOverrides(ACTIVE_SEASON_OVERRIDES)?.[monthKey];
    if (!override?.prorated || !Number.isFinite(Number(override?.proratedMas))) return null;
    const summary = getLeagueMonthSummaryForTimestamp(override?.chosenAt, ACTIVE_GROUP_TIME_ZONE);
    return summary?.monthKey === monthKey ? summary : null;
  })();
  if (joinedMonth && joinedMonth === monthKey) {
    const joinedSummary = getLeagueMonthSummaryForTimestamp(ACTIVE_MEMBER_JOINED_AT_BY_NAME?.[displayName], ACTIVE_GROUP_TIME_ZONE);
    if (!joinedSummary || joinedSummary.monthKey !== monthKey) return { target: baseTarget, joinDay: 1, prorationSource: "none" };
    return getJoinedTargetInfo(baseTarget, joinedSummary, chosenSummary);
  }
  const isCreator = (() => {
    const joinedAt = ACTIVE_MEMBER_JOINED_AT_BY_NAME?.[displayName];
    if (!joinedAt || ACTIVE_ADMIN_NAME !== displayName) return false;
    const joinedSummary = getLeagueMonthSummaryForTimestamp(joinedAt, ACTIVE_GROUP_TIME_ZONE);
    const createdSummary = getLeagueMonthSummaryForTimestamp(ACTIVE_GROUP_CREATED_AT, ACTIVE_GROUP_TIME_ZONE);
    if (!joinedSummary || !createdSummary) return false;
    return joinedSummary.monthKey === monthKey && createdSummary.monthKey === monthKey;
  })();
  if (isCreator && chosenSummary) {
    return {
      target: baseTarget,
      joinDay: chosenSummary.day,
      proratedDays: chosenSummary.daysRemaining,
      prorationSource: "group"
    };
  }
  return { target: baseTarget, joinDay: 1, prorationSource: "none" };
}

function getCurrentSitOutRequest(group, memberName, monthKey = curKey) {
  return normalizeSitOutRequests(group?.sitOutRequests)?.[monthKey]?.[memberName] || null;
}

function getMonthKeyWindow(monthKey, count) {
  const [year, month] = String(monthKey || "").split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return [];
  const keys = [];
  for (let i = 1; i <= count; i++) {
    let y = year;
    let m = month - i;
    while (m < 0) {
      m += 12;
      y -= 1;
    }
    keys.push(`${y}-${m}`);
  }
  return keys;
}

function getRecentSitOutCount(group, memberName, monthKey = curKey) {
  const priorKeys = getMonthKeyWindow(monthKey, 3);
  return priorKeys.reduce((sum, key) => (
    sum + (group?.excused?.[memberName]?.[key] ? 1 : 0)
  ), 0);
}

function getDeputyAdmin(group) {
  const memberships = Object.values(group?.memberships || {})
    .filter(membership => membership?.role !== "admin" && membership?.displayName);
  const sorted = memberships.sort((a, b) => {
    const aTime = Date.parse(a.joinedAt || "") || 0;
    const bTime = Date.parse(b.joinedAt || "") || 0;
    if (aTime !== bTime) return aTime - bTime;
    return String(a.displayName).localeCompare(String(b.displayName));
  });
  return sorted[0] || null;
}

function getCurrentMonthSummary(group) {
  const context = getTimeContextForGroup(group);
  return {
    monthKey: context.monthKey,
    monthName: MONTH_NAMES[context.month],
    year: context.year,
    day: context.day,
    daysInMonth: context.daysInMonth,
    daysRemaining: Math.max(1, context.daysInMonth - context.day + 1)
  };
}

function shouldPromptProration(group, actorUserId) {
  if (!group || !actorUserId) return false;
  if (group.adminUserId && group.adminUserId !== actorUserId) return false;
  const summary = getCurrentMonthSummary(group);
  if (summary.day <= 1) return false;
  return !getSeasonOverrideForMonth(group, summary.monthKey);
}

function buildSettlementMap(counts, excusedByName, settings = {}, memberTargets = {}) {
  const activeCounts = NAMES
    .filter(name => Object.prototype.hasOwnProperty.call(counts || {}, name))
    .filter(name => !excusedByName?.[name])
    .map(name => ({ name, count: counts?.[name] || 0, target: memberTargets?.[name] || Number(settings?.minTarget || MIN_TARGET) }));
  const { losers } = calcPenalties(activeCounts, settings);
  return Object.fromEntries(
    losers.map(loser => [
      loser.name,
      { status: "outstanding", settledAt: null, updatedAt: null }
    ])
  );
}

function getMonthSettlements(month) {
  return month?.settlements || buildSettlementMap(month?.counts || {}, month?.excused || {}, month?.settings || {}, month?.memberTargets || {});
}

function buildSettlementPairsForMonth(month) {
  if (!month) return [];
  const counts = month?.counts || {};
  const excused = month?.excused || {};
  const settings = month?.settings || {};
  const memberTargets = month?.memberTargets || {};
  const memberAuthUserIds = month?.memberAuthUserIds || {};
  const relevantNames = Object.keys(counts);
  const activeCounts = relevantNames
    .filter(name => !excused?.[name])
    .map(name => ({ name, count: counts?.[name] || 0, target: memberTargets?.[name] || Number(settings?.minTarget || MIN_TARGET) }));
  const penalties = calcPenalties(activeCounts, settings);
  const { winners, losers } = penalties;
  if (!winners.length || !losers.length) return [];
  return losers.flatMap((loser, loserIndex) => winners
    .filter(winner => winner.name !== loser.name)
    .map((winner, winnerIndex) => {
      const loserAmount = getLoserAmount(penalties, loser.name);
      const basePairAmount = winners.length > 0 ? Math.floor(loserAmount / winners.length) : 0;
      const remainder = winners.length > 0 ? loserAmount % winners.length : 0;
      const pairAmount = basePairAmount + (((winnerIndex + loserIndex) % winners.length) < remainder ? 1 : 0);
      if (pairAmount <= 0) return null;
      return {
        monthKey: month.key,
        monthLabel: month.label || formatMonthLabelFromKey(month.key) || month.key,
        payerDisplayName: loser.name,
        receiverDisplayName: winner.name,
        payerAuthUserId: memberAuthUserIds?.[loser.name] || null,
        receiverAuthUserId: memberAuthUserIds?.[winner.name] || null,
        amount: pairAmount,
        currency: settings?.currency || DEFAULT_CURRENCY
      };
    }))
    .filter(Boolean);
}

function getHistoricalMemberNamesForMonth(month, fallbackNames = []) {
  return deriveHistoricalMemberNamesForMonth(month, fallbackNames);
}

function getHistoricalGroupMemberNames(monthHistory, currentLogs = {}, currentExcused = {}, fallbackNames = []) {
  const monthNames = (Array.isArray(monthHistory) ? monthHistory : []).flatMap(month => getHistoricalMemberNamesForMonth(month, fallbackNames));
  return uniqueNames([
    ...fallbackNames,
    ...Object.keys(currentLogs || {}),
    ...Object.keys(currentExcused || {}),
    ...monthNames
  ]);
}

function buildSettlementReminderCards(group, currentUserId, currentUserName) {
  if (!group?.settlementConfirmationsEnabled) return [];
  const activeMemberNames = new Set(getCurrentGroupMemberNames(group));
  const activeMemberUserIds = new Set(
    Object.values(group?.memberships || {})
      .map(membership => membership?.userId)
      .filter(Boolean)
  );
  const membershipByName = Object.fromEntries(
    Object.values(group?.memberships || {})
      .filter(membership => membership?.displayName)
      .map(membership => [membership.displayName, membership])
  );
  const confirmationByNameKey = new Map(
    (group?.settlementConfirmations || []).map(row => [
      `${row.monthKey}:${row.payerDisplayName}:${row.receiverDisplayName}`,
      row
    ])
  );
  return [...(group?.monthHistory || [])]
    .sort((a, b) => compareMonthKeys(b.key, a.key))
    .flatMap(month => buildSettlementPairsForMonth(month).map(pair => {
      const payerIsActive = pair.payerAuthUserId
        ? activeMemberUserIds.has(pair.payerAuthUserId)
        : activeMemberNames.has(pair.payerDisplayName);
      const receiverIsActive = pair.receiverAuthUserId
        ? activeMemberUserIds.has(pair.receiverAuthUserId)
        : activeMemberNames.has(pair.receiverDisplayName);
      if (!payerIsActive || !receiverIsActive) return null;
      const showMonthLabel = pair.monthKey !== curKey;
      const monthSuffix = showMonthLabel ? ` · ${pair.monthLabel.toUpperCase()}` : "";
      const payerMembership = membershipByName[pair.payerDisplayName] || null;
      const receiverMembership = membershipByName[pair.receiverDisplayName] || null;
      const confirmation = confirmationByNameKey.get(`${pair.monthKey}:${pair.payerDisplayName}:${pair.receiverDisplayName}`) || null;
      const legacySettlement = confirmation ? null : (month?.settlements?.[pair.payerDisplayName] || null);
      if (confirmation?.confirmedAt) return null;
      if (legacySettlement?.status === "settled") return null;
      const pending = !!confirmation?.payerClaimedAt && !confirmation?.confirmedAt;
      const payerAuthUserId = confirmation?.payerAuthUserId || pair.payerAuthUserId || payerMembership?.userId || null;
      const receiverAuthUserId = confirmation?.receiverAuthUserId || pair.receiverAuthUserId || receiverMembership?.userId || null;
      const isPayer = currentUserId
        ? (payerAuthUserId ? payerAuthUserId === currentUserId : pair.payerDisplayName === currentUserName)
        : pair.payerDisplayName === currentUserName;
      const isReceiver = currentUserId
        ? (receiverAuthUserId ? receiverAuthUserId === currentUserId : pair.receiverDisplayName === currentUserName)
        : pair.receiverDisplayName === currentUserName;

      let label = "";
      let body = "";
      let labelColor = "#89A39E";
      let amountColor = "#6B9690";
      let action = null;
      let secondaryAction = null;

      if (pending && isReceiver) {
        label = "PENDING CONFIRMATION";
        body = `${pair.payerDisplayName} says they paid you`;
        labelColor = "#EF9F27";
        amountColor = "#EF9F27";
        secondaryAction = {
          kind: "dispute",
          label: "✕"
        };
        action = {
          kind: "confirm",
          label: "Confirm"
        };
      } else if (pending && isPayer) {
        label = "PENDING CONFIRMATION";
        body = `Waiting for ${pair.receiverDisplayName} to confirm`;
        labelColor = "#EF9F27";
        amountColor = "#EF9F27";
      } else if (pending) {
        label = "PENDING";
        body = `${pair.payerDisplayName} paid ${pair.receiverDisplayName} · awaiting confirmation`;
        labelColor = "#EF9F27";
        amountColor = "#6B9690";
      } else if (isPayer) {
        label = `YOU OWE${monthSuffix}`;
        body = `You owe ${pair.receiverDisplayName}`;
        labelColor = "#7A4B46";
        amountColor = "#e05020";
        action = {
          kind: "claim",
          label: "Mark as paid"
        };
      } else if (isReceiver) {
        label = `OWED TO YOU${monthSuffix}`;
        body = `${pair.payerDisplayName} owes you`;
        labelColor = "#1a6b3a";
        amountColor = "#2ecc71";
      } else {
        label = `UNPAID${monthSuffix}`;
        body = `${pair.payerDisplayName} owes ${pair.receiverDisplayName}`;
        labelColor = "#6B9690";
        amountColor = "#6B9690";
      }

      return {
        key: `${pair.monthKey}:${pair.payerDisplayName}:${pair.receiverDisplayName}`,
        monthKey: pair.monthKey,
        monthLabel: pair.monthLabel,
        payerDisplayName: pair.payerDisplayName,
        receiverDisplayName: pair.receiverDisplayName,
        payerAuthUserId,
        receiverAuthUserId,
        amount: pair.amount,
        currency: group?.settings?.currency || pair.currency,
        pending,
        label,
        labelColor,
        body,
        amountColor,
        secondaryAction,
        action
      };
    }))
    .filter(Boolean);
}

function getSettlementConfirmationForPair(group, monthKey, payerDisplayName, receiverDisplayName) {
  return (group?.settlementConfirmations || []).find(row =>
    row?.monthKey === monthKey
    && row?.payerDisplayName === payerDisplayName
    && row?.receiverDisplayName === receiverDisplayName
  ) || null;
}

function getLegacySettlementForPair(group, monthKey, payerDisplayName) {
  const month = (group?.monthHistory || []).find(row => row?.key === monthKey);
  return month?.settlements?.[payerDisplayName] || null;
}

function buildSettlementPairState(group, monthKey, payerDisplayName, receiverDisplayName, currentUserId, currentUserName) {
  const membershipByName = Object.fromEntries(
    Object.values(group?.memberships || {})
      .filter(membership => membership?.displayName)
      .map(membership => [membership.displayName, membership])
  );
  const confirmation = getSettlementConfirmationForPair(group, monthKey, payerDisplayName, receiverDisplayName);
  const legacySettlement = confirmation ? null : getLegacySettlementForPair(group, monthKey, payerDisplayName);
  const payerMembership = membershipByName[payerDisplayName] || null;
  const receiverMembership = membershipByName[receiverDisplayName] || null;
  const payerAuthUserId = confirmation?.payerAuthUserId || payerMembership?.userId || null;
  const receiverAuthUserId = confirmation?.receiverAuthUserId || receiverMembership?.userId || null;
  const isPayer = currentUserId
    ? (payerAuthUserId ? payerAuthUserId === currentUserId : payerDisplayName === currentUserName)
    : payerDisplayName === currentUserName;
  const isReceiver = currentUserId
    ? (receiverAuthUserId ? receiverAuthUserId === currentUserId : receiverDisplayName === currentUserName)
    : receiverDisplayName === currentUserName;
  return {
    confirmation,
    confirmedAt: confirmation?.confirmedAt || (legacySettlement?.status === "settled" ? (legacySettlement?.settledAt || null) : null),
    payerAuthUserId,
    receiverAuthUserId,
    isPayer,
    isReceiver,
    pending: !!confirmation?.payerClaimedAt && !confirmation?.confirmedAt,
    confirmed: !!confirmation?.confirmedAt || legacySettlement?.status === "settled"
  };
}

function buildSettlementPreviewCards(currentUserName) {
  const receiverName = currentUserName || "You";
  return [
    {
      key: "preview-you-owe",
      monthKey: "2026-3",
      monthLabel: "Apr '26",
      payerDisplayName: receiverName,
      receiverDisplayName: "Rahul",
      payerAuthUserId: null,
      receiverAuthUserId: null,
      amount: 20,
      currency: "USD",
      pending: false,
      label: "YOU OWE · APR '26",
      labelColor: "#7A4B46",
      body: "You owe Rahul",
      amountColor: "#e05020",
      statusTag: null,
      action: { kind: "claim", label: "Mark as paid" }
    },
    {
      key: "preview-pending-confirm",
      monthKey: "2026-2",
      monthLabel: "Mar '26",
      payerDisplayName: "Isira",
      receiverDisplayName: receiverName,
      payerAuthUserId: null,
      receiverAuthUserId: null,
      amount: 20,
      currency: "USD",
      pending: true,
      label: "PENDING CONFIRMATION",
      labelColor: "#EF9F27",
      body: "Isira says they paid you",
      amountColor: "#EF9F27",
      statusTag: null,
      secondaryAction: { kind: "dispute", label: "✕" },
      action: { kind: "confirm", label: "Confirm" }
    },
    {
      key: "preview-owed-to-you",
      monthKey: "2026-1",
      monthLabel: "Feb '26",
      payerDisplayName: "Rishane",
      receiverDisplayName: receiverName,
      payerAuthUserId: null,
      receiverAuthUserId: null,
      amount: 20,
      currency: "USD",
      pending: false,
      label: "OWED TO YOU · FEB '26",
      labelColor: "#1a6b3a",
      body: "Rishane owes you",
      amountColor: "#2ecc71",
      action: null
    },
    {
      key: "preview-third-party",
      monthKey: "2025-11",
      monthLabel: "Dec '25",
      payerDisplayName: "Adil",
      receiverDisplayName: "Nishara",
      payerAuthUserId: null,
      receiverAuthUserId: null,
      amount: 20,
      currency: "USD",
      pending: true,
      label: "PENDING",
      labelColor: "#EF9F27",
      body: "Adil paid Nishara · awaiting confirmation",
      amountColor: "#6B9690",
      action: null
    },
    {
      key: "preview-third-party-unpaid",
      monthKey: "2025-10",
      monthLabel: "Nov '25",
      payerDisplayName: "Kisal",
      receiverDisplayName: "Aysha",
      payerAuthUserId: null,
      receiverAuthUserId: null,
      amount: 20,
      currency: "USD",
      pending: false,
      label: "UNPAID · NOV '25",
      labelColor: "#6B9690",
      body: "Kisal owes Aysha",
      amountColor: "#6B9690",
      action: null
    }
  ];
}

function fmtCurrency(amount, currency) {
  const symbols = {USD:"$",EUR:"€",GBP:"£",NOK:"kr",SEK:"kr",DKK:"kr",AUD:"A$",CAD:"C$",CHF:"CHF",INR:"₹",SGD:"S$",NZD:"NZ$",LKR:"Rs"};
  const sym = symbols[currency] || currency || DEFAULT_CURRENCY;
  return `${sym} ${amount}`;
}

function getUserMASStreak(monthHistory, userName) {
  const sorted = [...monthHistory].sort((a, b) => a.key.localeCompare(b.key));
  let streak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const m = sorted[i];
    if (m.counts?.[userName] === undefined) break;
    const activeCounts = Object.entries(m.counts)
      .filter(([name]) => !m.excused?.[name])
      .map(([name, count]) => ({name, count, target: m.memberTargets?.[name] || m.settings?.minTarget || MIN_TARGET}));
    const {losers} = calcPenalties(activeCounts, m.settings);
    if (losers.some(l => l.name === userName)) break;
    streak++;
  }
  return streak;
}

function getBlocPerfectMonthStreak(monthHistory) {
  const sorted = [...monthHistory].sort((a, b) => a.key.localeCompare(b.key));
  let streak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const m = sorted[i];
    const activeCounts = Object.entries(m.counts || {})
      .filter(([name]) => !m.excused?.[name])
      .map(([name, count]) => ({name, count, target: m.memberTargets?.[name] || m.settings?.minTarget || MIN_TARGET}));
    if (!activeCounts.length) break;
    const { losers } = calcPenalties(activeCounts, m.settings);
    if (losers.length > 0) break;
    streak++;
  }
  return streak;
}

function getUserWinsThisYear(monthHistory, userName, year) {
  return monthHistory.filter(m => {
    if (m.year !== year) return false;
    const activeCounts = Object.entries(m.counts || {})
      .filter(([name]) => !m.excused?.[name])
      .map(([name, count]) => ({name, count, target: m.memberTargets?.[name] || m.settings?.minTarget || MIN_TARGET}));
    const {winners} = calcPenalties(activeCounts, m.settings);
    return winners.some(w => w.name === userName);
  }).length;
}

function getWorkoutDaysForMonth(logsByUser, userName) {
  return [...new Set(
    (logsByUser?.[userName] || [])
      .filter(l => l.counted !== false)
      .map(l => parseInt(l.date.split("-")[2]))
      .filter(Boolean)
  )];
}

function ordinal(n) {
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v-20)%10]||s[v]||s[0]);
}

// "1 workout" / "3 workouts" — singular/plural count label.
function workoutsLabel(n) {
  const count = Number(n) || 0;
  return `${count} workout${count === 1 ? "" : "s"}`;
}

function buildMonthLogsSnapshot(logsByName) {
  return Object.fromEntries(
    NAMES.map(name => [name, [...(logsByName?.[name] || [])].map(log => normalizeLogEntry({ ...log, photoUrl: "" }))])
  );
}

function uniqueNames(values) {
  const seen = new Set();
  const result = [];
  values.forEach(value => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(trimmed);
  });
  return result;
}

function normalizeWorkoutType(type) {
  const normalized = WORKOUT_TYPE_ALIASES[type] || type;
  return WORKOUT_TYPES.includes(normalized) ? normalized : "Other";
}

function normalizeLoggedWorkoutType(type, logDate = "") {
  const normalized = normalizeWorkoutType(type);
  if (normalized === "Pilates" && typeof logDate === "string" && logDate && logDate < "2026-06-06") return "Other";
  return normalized;
}

function normalizeReactions(reactions) {
  if (!reactions || typeof reactions !== "object") return {};
  return Object.fromEntries(
    Object.entries(reactions)
      .map(([emoji, members]) => [String(emoji || "").trim(), uniqueNames(Array.isArray(members) ? members : [])])
      .filter(([emoji, members]) => emoji && members.length)
  );
}

function normalizeFlagStatus(status) {
  return ["flagged","approved","rejected"].includes(status) ? status : null;
}

function shouldKeepLogPhoto(log) {
  const photoUrl = typeof log?.photoUrl === "string" ? log.photoUrl : "";
  if (!photoUrl) return false;
  const status = normalizeFlagStatus(log?.flagStatus);
  if (status === "flagged") return true;
  const createdAtMs = Date.parse(log?.createdAt || "");
  if (status === "approved" || status === "rejected") {
    const resolvedAtMs = Date.parse(log?.decisionAt || "") || createdAtMs;
    return Number.isFinite(resolvedAtMs) ? (Date.now() - resolvedAtMs) < RESOLVED_IMAGE_RETENTION_MS : false;
  }
  return Number.isFinite(createdAtMs) ? (Date.now() - createdAtMs) < UNFLAGGED_IMAGE_RETENTION_MS : false;
}

function countApprovedFlagsForActor(group, actor) {
  if (!group || !actor) return 0;
  return Object.values(group.logs || {}).reduce((sum, logs) => (
    sum + (Array.isArray(logs) ? logs.filter(log => log?.flaggedBy === actor && normalizeFlagStatus(log?.flagStatus) === "approved").length : 0)
  ), 0);
}

function getActivityAlertCount(group, actor) {
  if (!group || !actor) return 0;
  const isAdmin = group.adminName === actor;
  return flattenFeedPosts(group).filter(post => {
    if (isAdmin) return post.flagStatus === "flagged";
    return post.owner === actor && post.flagStatus === "flagged";
  }).length;
}

function resolveLogCreatedAt(log) {
  const rawCreatedAt = typeof log?.createdAt === "string" ? log.createdAt : "";
  const parsedCreatedAt = Date.parse(rawCreatedAt);
  if (Number.isFinite(parsedCreatedAt) && parsedCreatedAt <= Date.now()) {
    return new Date(parsedCreatedAt).toISOString();
  }
  if (typeof log?.date === "string" && log.date) return `${log.date}T00:00:00.000Z`;
  return new Date().toISOString();
}

function normalizeLogEntry(log) {
  const photoUrl = typeof log?.photoUrl === "string" ? log.photoUrl : "";
  return {
    ...log,
    id: log?.id || `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: normalizeLoggedWorkoutType(log?.type, log?.date),
    note: typeof log?.note === "string" ? log.note.slice(0,280) : "",
    photoUrl: shouldKeepLogPhoto(log) ? photoUrl : "",
    createdAt: resolveLogCreatedAt(log),
    verifiedVia: log?.verifiedVia === "strava" ? "strava" : "photo",
    commentCount: Number.isFinite(Number(log?.commentCount)) ? Math.max(0, Number(log.commentCount)) : 0,
    reactions: normalizeReactions(log?.reactions),
    flagStatus: normalizeFlagStatus(log?.flagStatus),
    flagReason: typeof log?.flagReason === "string" ? log.flagReason.slice(0,280) : "",
    flagResponse: typeof log?.flagResponse === "string" ? log.flagResponse.slice(0,280) : "",
    flaggedBy: typeof log?.flaggedBy === "string" ? log.flaggedBy : null,
    decisionBy: typeof log?.decisionBy === "string" ? log.decisionBy : null,
    decisionAt: typeof log?.decisionAt === "string" ? log.decisionAt : null
  };
}

function normalizeDeletedCurrentLogIds(value) {
  return uniqueNames(Array.isArray(value) ? value.map(id => String(id || "")) : []).slice(-200);
}

function normalizeAcceptedWorkoutTypes(types) {
  if (!Array.isArray(types) || !types.length) return [...WORKOUT_TYPES];
  const normalized = uniqueNames(types.map(normalizeWorkoutType)).filter(type => WORKOUT_TYPES.includes(type));
  return normalized.length ? normalized : [...WORKOUT_TYPES];
}

function normalizeFeeModel(value) {
  return value === "flat" ? "flat" : DEFAULT_FEE_MODEL;
}

function clampFineAmount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_FINE_AMOUNT;
  return Math.round(numeric);
}

function normalizeEscalationStepAmount(value) {
  if (value === "" || value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return null;
  return Math.round(numeric);
}

function normalizeCurrency(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : DEFAULT_CURRENCY;
}

function normalizeDistanceUnit(value) {
  return String(value || "").trim().toLowerCase() === "mi" ? "mi" : DEFAULT_DISTANCE_UNIT;
}

function normalizeTimeZone(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return DEFAULT_GROUP_TIME_ZONE;
  try {
    Intl.DateTimeFormat("en-GB", { timeZone: normalized }).format(new Date());
    return normalized;
  } catch {
    return DEFAULT_GROUP_TIME_ZONE;
  }
}

function clampRunDistance(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_MIN_RUN_DISTANCE;
  return Math.max(0.5, Math.round(numeric * 10) / 10);
}

function buildNormalizedSettings(settings) {
  return {
    minTarget: Number.isFinite(Number(settings?.minTarget)) ? Math.min(30, Math.max(6, Math.round(Number(settings.minTarget)))) : DEFAULT_MIN_TARGET,
    acceptedWorkoutTypes: normalizeAcceptedWorkoutTypes(settings?.acceptedWorkoutTypes),
    timeZone: normalizeTimeZone(settings?.timeZone),
    fineAmount: clampFineAmount(settings?.fineAmount),
    escalationStepAmount: normalizeEscalationStepAmount(settings?.escalationStepAmount),
    currency: normalizeCurrency(settings?.currency),
    feeModel: normalizeFeeModel(settings?.feeModel),
    minRunDistance: clampRunDistance(settings?.minRunDistance ?? settings?.minDurationMinutes),
    distanceUnit: normalizeDistanceUnit(settings?.distanceUnit),
    stravaEnabled: settings?.stravaEnabled !== false
  };
}

function isCountedLog(log) {
  return normalizeFlagStatus(log?.flagStatus) !== "rejected";
}

function getCountedLogs(logs) {
  return (Array.isArray(logs) ? logs : []).filter(isCountedLog);
}

function getCountedLogCount(logs) {
  return getCountedLogs(logs).length;
}

function getMonthPartsFromKey(key) {
  const [year, monthIndex] = String(key || "").split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return null;
  return { year, monthIndex };
}

function formatMonthLabelFromKey(key) {
  const parts = getMonthPartsFromKey(key);
  if (!parts || !MONTH_NAMES[parts.monthIndex]) return null;
  return `${MONTH_NAMES[parts.monthIndex]} '${String(parts.year).slice(2)}`;
}

function deriveMonthKeyFromLogs(logsByUser) {
  const keys = Object.values(logsByUser || {})
    .flatMap(logs => (Array.isArray(logs) ? logs : []))
    .map(log => getMonthKeyFromISO(log?.date))
    .filter(Boolean)
    .sort(compareMonthKeys);
  return keys[0] || null;
}

function isLegacyPlaceholderMonthSettings(monthSettings) {
  if (!monthSettings) return true;
  const normalized = buildNormalizedSettings(monthSettings);
  return normalized.fineAmount === 100 && normalized.currency === "NOK" && normalized.escalationStepAmount === null;
}

function resolveHistoricalMonthSettings(monthSettings, groupSettings) {
  const normalizedGroupSettings = buildNormalizedSettings(groupSettings);
  if (isLegacyPlaceholderMonthSettings(monthSettings)) return normalizedGroupSettings;
  const normalizedMonthSettings = buildNormalizedSettings(monthSettings || groupSettings);
  if (
    normalizedGroupSettings.feeModel === "escalating" &&
    normalizedMonthSettings.feeModel === "flat" &&
    normalizedMonthSettings.escalationStepAmount === null &&
    normalizedMonthSettings.fineAmount === normalizedGroupSettings.fineAmount
  ) {
    return normalizedGroupSettings;
  }
  return normalizedMonthSettings;
}

function deriveHistoricalMemberNamesForMonth(month, fallbackMemberOrder = []) {
  const monthMembershipNames = Object.values(month?.memberships || {}).map(membership => membership?.displayName || "");
  const localNames = uniqueNames([
    ...Object.keys(month?.counts || {}),
    ...Object.keys(month?.logsByUser || {}),
    ...Object.keys(month?.excused || {}),
    ...Object.keys(month?.memberTargets || {}),
    ...Object.keys(month?.settlements || {}),
    ...monthMembershipNames
  ]);
  return localNames.length ? localNames : uniqueNames(fallbackMemberOrder);
}

function normalizeMonthHistoryState(monthHistory, memberOrder, joinedMonthByName, settings) {
  const currentMonthKey = getLeagueMonthKey(settings?.timeZone || DEFAULT_GROUP_TIME_ZONE);
  return (Array.isArray(monthHistory) ? monthHistory : []).map(month => {
    const historicalNames = deriveHistoricalMemberNamesForMonth(month, memberOrder);
    const logsByUser = Object.fromEntries(
      historicalNames.map(name => [name, [...(month?.logsByUser?.[name] || [])].map(log => normalizeLogEntry({ ...log, photoUrl: "" }))])
    );
    const derivedMonthKey = deriveMonthKeyFromLogs(logsByUser) || month?.key || null;
    if (derivedMonthKey && derivedMonthKey === currentMonthKey) return null;
    const monthKey = derivedMonthKey || month?.key;
    const monthParts = getMonthPartsFromKey(monthKey);
    const relevantNames = historicalNames.filter(name => {
      const joinedMonth = joinedMonthByName?.[name];
      return !joinedMonth || compareMonthKeys(monthKey, joinedMonth) >= 0;
    });
    const counts = Object.fromEntries(
      relevantNames.map(name => [name, Number(month?.counts?.[name] || getCountedLogCount(logsByUser[name]))])
    );
    const excused = Object.fromEntries(
      relevantNames.map(name => [name, !!month?.excused?.[name]])
    );
    const monthSettings = resolveHistoricalMonthSettings(month?.settings, settings);
    const monthGroup = {
      settings,
      memberships: month?.memberships || {},
      joinedMonthByName,
      seasonOverrides: month?.seasonOverrides || {}
    };
    const memberTargets = Object.fromEntries(
      relevantNames.map(name => [
        name,
        month?.memberTargets?.[name] || getMemberTargetForMonth(monthGroup, name, monthKey, monthSettings)
      ])
    );
    return {
      ...month,
      key: monthKey,
      year: monthParts?.year ?? month?.year,
      month: monthParts?.monthIndex ?? month?.month,
      label: formatMonthLabelFromKey(monthKey) || month?.label,
      counts,
      excused,
      logsByUser,
      memberTargets,
      settings: monthSettings,
      settlements: month?.settlements || buildSettlementMap(counts, excused, monthSettings, memberTargets)
    };
  }).filter(Boolean).sort((a, b) => compareMonthKeys(a.key, b.key));
}

function deriveActiveMemberOrder(rawMemberOrder, memberships, adminName, leftMemberNames, historicalFallback = []) {
  const canonicalActiveMembers = uniqueNames([
    ...Object.values(memberships || {}).map(membership => membership?.displayName || ""),
    String(adminName || "").trim()
  ]);

  if (canonicalActiveMembers.length > 0) return canonicalActiveMembers;

  const blobActiveMembers = uniqueNames([
    ...(Array.isArray(rawMemberOrder) ? rawMemberOrder : []),
    String(adminName || "").trim()
  ]).filter(name => !leftMemberNames.has(name));

  if (blobActiveMembers.length > 0) return blobActiveMembers;

  return uniqueNames(historicalFallback).filter(name => !leftMemberNames.has(name));
}

function normalizeGroupState(group) {
  const logs = group?.logs && typeof group.logs === "object" ? group.logs : {};
  const monthHistory = Array.isArray(group?.monthHistory) ? group.monthHistory : [];
  const leftMemberNames = new Set(Array.isArray(group?.leftMemberNames) ? group.leftMemberNames : []);
  const rawMemberships = group?.memberships && typeof group?.memberships === "object" ? group.memberships : {};
  const memberOrder = uniqueNames([
    ...(Array.isArray(group?.memberOrder) ? group.memberOrder : []),
    ...Object.keys(logs),
    ...monthHistory.flatMap(month => Object.keys(month?.counts || {})),
    ...monthHistory.flatMap(month => Object.keys(month?.logsByUser || {}))
  ].filter(n => !leftMemberNames.has(n)));
  const activeMemberOrder = deriveActiveMemberOrder(
    group?.memberOrder,
    rawMemberships,
    group?.adminName,
    leftMemberNames,
    memberOrder
  );
  const normalizedLogs = Object.fromEntries(
    memberOrder.map(name => [
      name,
      Array.isArray(logs[name])
        ? logs[name].map(normalizeLogEntry)
        : []
    ])
  );
  const excused = {};
  memberOrder.forEach(name => {
    excused[name] = group?.excused?.[name] && typeof group.excused[name] === "object" ? group.excused[name] : {};
  });
  const memberships = normalizeMemberships(rawMemberships, memberOrder, group?.adminName, group?.adminUserId);
  return {
    id: group?.id,
    name: String(group?.name || "Untitled Group").trim(),
    adminName: String(group?.adminName || memberOrder[0] || "").trim(),
    adminUserId: typeof group?.adminUserId === "string" ? group.adminUserId : null,
    inviteCode: String(group?.inviteCode || "").trim().toUpperCase(),
    createdAt: group?.createdAt || new Date().toISOString(),
    memberOrder,
    activeMemberOrder,
    memberships,
    joinedMonthByName: group?.joinedMonthByName && typeof group.joinedMonthByName === "object" ? group.joinedMonthByName : {},
    leftMemberNames: [...leftMemberNames],
    settings: buildNormalizedSettings(group?.settings),
    logs: normalizedLogs,
    deletedCurrentLogIds: normalizeDeletedCurrentLogIds(group?.deletedCurrentLogIds),
    excused,
    seasonOverrides: normalizeSeasonOverrides(group?.seasonOverrides),
    sitOutRequests: pruneSitOutRequestsForRead(group?.sitOutRequests, group?.lastMonth || curKey),
    settlementConfirmationsEnabled: !!group?.settlementConfirmationsEnabled,
    settlementConfirmationsPreviewMode: !!group?.settlementConfirmationsPreviewMode,
    settlementConfirmations: normalizeSettlementConfirmations(group?.settlementConfirmations),
    monthHistory: normalizeMonthHistoryState(monthHistory, memberOrder, group?.joinedMonthByName, group?.settings),
    lastMonth: group?.lastMonth || curKey
  };
}

function buildLegacyGroupState(data) {
  return normalizeGroupState({
    id: LEGACY_GROUP_ID,
    name: DEFAULT_GROUP_NAME,
    adminName: DEFAULT_NAMES[0],
    inviteCode: "OGGROUP",
    createdAt: resolveStateUpdatedAt(data) || new Date().toISOString(),
    memberOrder: [...DEFAULT_NAMES],
    joinedMonthByName: { ...DEFAULT_JOINED_MONTH_BY_NAME },
    settings: buildNormalizedSettings({ minTarget: DEFAULT_MIN_TARGET, acceptedWorkoutTypes: [...WORKOUT_TYPES], timeZone: DEFAULT_GROUP_TIME_ZONE }),
    logs: data?.logs || {},
    excused: data?.excused || {},
    monthHistory: data?.monthHistory || [],
    lastMonth: data?.lastMonth || curKey
  });
}

function buildEmptyAppState() {
  return {
    version: 2,
    groups: {},
    groupOrder: [],
    defaultGroupId: null,
    profiles: {},
    meta: { revision: 0, updatedAt: null }
  };
}

function deriveDefaultGroupId(groupOrder) {
  return Array.isArray(groupOrder) && groupOrder.length ? groupOrder[0] : null;
}

function resolveStateRevision(data) {
  const revision = data?.meta?.revision ?? data?.revision;
  return Number.isFinite(Number(revision)) ? Number(revision) : 0;
}

function resolveStateUpdatedAt(data) {
  return data?.meta?.updatedAt ?? data?.updatedAt ?? null;
}

function normalizeAppState(data) {
  if (!data) return buildEmptyAppState();
  if (data.version === 2) {
    const groups = {};
    const sourceGroups = data.groups && typeof data.groups === "object" ? data.groups : {};
    const groupOrder = Array.isArray(data.groupOrder) ? [...data.groupOrder] : [];
    Object.entries(sourceGroups).forEach(([groupId, group]) => {
      groups[groupId] = normalizeGroupState({ ...group, id: group.id || groupId });
      if (!groupOrder.includes(groupId)) groupOrder.push(groupId);
    });
    const filteredOrder = groupOrder.filter(id => groups[id]);
    return {
      version: 2,
      groups,
      groupOrder: filteredOrder,
      defaultGroupId: deriveDefaultGroupId(filteredOrder),
      profiles: normalizeProfiles(data?.profiles),
      meta: {
        revision: resolveStateRevision(data),
        updatedAt: resolveStateUpdatedAt(data)
      }
    };
  }

  const legacyGroup = buildLegacyGroupState(data);
  return {
    version: 2,
    groups: { [legacyGroup.id]: legacyGroup },
    groupOrder: [legacyGroup.id],
    defaultGroupId: legacyGroup.id,
    profiles: normalizeProfiles(data?.profiles),
    meta: {
      revision: resolveStateRevision(data),
      updatedAt: resolveStateUpdatedAt(data)
    }
  };
}

function normalizeProfiles(profiles) {
  if (!profiles || typeof profiles !== "object") return {};
  return Object.fromEntries(
    Object.entries(profiles)
      .map(([userId, profile]) => {
        const id = String(profile?.id || userId || "").trim();
        const email = String(profile?.email || "").trim().toLowerCase();
        if (!id || !email) return null;
        return [id, {
          id,
          email,
          displayName: String(profile?.displayName || "").trim(),
          profilePhotoUrl: String(profile?.profilePhotoUrl || "").trim(),
          createdAt: profile?.createdAt || null
        }];
      })
      .filter(Boolean)
  );
}

function normalizeSettlementConfirmations(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map(row => {
      if (!row || typeof row !== "object") return null;
      const monthKey = String(row?.monthKey || row?.month_key || "").trim();
      const payerDisplayName = String(row?.payerDisplayName || row?.payer_display_name || "").trim();
      const receiverDisplayName = String(row?.receiverDisplayName || row?.receiver_display_name || "").trim();
      if (!monthKey || !payerDisplayName || !receiverDisplayName) return null;
      const amount = Number(row?.amount);
      return {
        id: row?.id || `${monthKey}:${payerDisplayName}:${receiverDisplayName}`,
        monthKey,
        monthLabel: row?.monthLabel || row?.month_label || null,
        payerAuthUserId: row?.payerAuthUserId || row?.payer_auth_user_id || null,
        receiverAuthUserId: row?.receiverAuthUserId || row?.receiver_auth_user_id || null,
        payerDisplayName,
        receiverDisplayName,
        amount: Number.isFinite(amount) ? amount : 0,
        currency: String(row?.currency || DEFAULT_CURRENCY).trim().toUpperCase() || DEFAULT_CURRENCY,
        payerClaimedAt: row?.payerClaimedAt || row?.payer_claimed_at || null,
        confirmedAt: row?.confirmedAt || row?.confirmed_at || null,
        createdAt: row?.createdAt || row?.created_at || null,
        updatedAt: row?.updatedAt || row?.updated_at || null
      };
    })
    .filter(Boolean);
}

function normalizeMemberships(memberships, memberOrder, adminName, adminUserId) {
  if (!memberships || typeof memberships !== "object") return {};
  const normalized = {};
  Object.entries(memberships).forEach(([userId, membership]) => {
    const id = String(membership?.userId || userId || "").trim();
    const displayName = String(membership?.displayName || "").trim();
    if (!id || !displayName) return;
    if (!memberOrder.includes(displayName)) memberOrder.push(displayName);
    normalized[id] = {
      userId: id,
      displayName,
      role: membership?.role === "admin" ? "admin" : "member",
      joinedAt: membership?.joinedAt || null
    };
  });
  if (adminUserId && normalized[adminUserId]) normalized[adminUserId].role = "admin";
  if (!adminUserId && adminName) {
    const adminMembership = Object.values(normalized).find(membership => membership.displayName === adminName);
    if (adminMembership) adminMembership.role = "admin";
  }
  return normalized;
}

function getProfileForSession(appState, session) {
  if (!session?.userId) return null;
  if (appState?.profiles?.[session.userId]) return appState.profiles[session.userId];
  if (session?.localPreview && session?.previewDisplayName) {
    return {
      id: session.userId,
      email: session.email || "",
      displayName: session.previewDisplayName,
      profilePhotoUrl: "",
      createdAt: new Date().toISOString()
    };
  }
  const normalizedEmail = String(session?.email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;
  return Object.values(appState?.profiles || {}).find(profile => profile?.email === normalizedEmail) || null;
}

function getMembershipForUser(group, session, profile) {
  if (!group || !session?.userId) return null;
  if (group.memberships?.[session.userId]) return group.memberships[session.userId];
  const activeNames = Array.isArray(group.activeMemberOrder) && group.activeMemberOrder.length
    ? group.activeMemberOrder
    : (group.memberOrder || []);
  if (profile?.displayName && activeNames.includes(profile.displayName)) {
    return {
      userId: session.userId,
      displayName: profile.displayName,
      role: group.adminName === profile.displayName ? "admin" : "member"
    };
  }
  return null;
}

function getDisplayNameForGroup(group, session, profile) {
  return getMembershipForUser(group, session, profile)?.displayName || "";
}

function syncActiveGroupGlobals(group) {
  GROUP_NAME = group?.name || DEFAULT_GROUP_NAME;
  const activeNames = Array.isArray(group?.activeMemberOrder) && group.activeMemberOrder.length
    ? group.activeMemberOrder
    : group?.memberOrder;
  NAMES = Array.isArray(activeNames) && activeNames.length ? [...activeNames] : [...DEFAULT_NAMES];
  ACTIVE_GROUP_CREATED_AT = group?.createdAt || null;
  ACTIVE_ADMIN_NAME = group?.adminName || "";
  ACTIVE_MEMBER_JOINED_AT_BY_NAME = Object.fromEntries(
    Object.values(group?.memberships || {})
      .filter(membership => membership?.displayName)
      .map(membership => [membership.displayName, membership.joinedAt || null])
  );
  ACTIVE_LOGS_BY_NAME = group?.logs && typeof group.logs === "object" ? { ...group.logs } : {};
  ACTIVE_MONTH_HISTORY = Array.isArray(group?.monthHistory) ? [...group.monthHistory] : [];
  ACTIVE_SEASON_OVERRIDES = group?.seasonOverrides && typeof group.seasonOverrides === "object"
    ? { ...group.seasonOverrides }
    : {};
  ACTIVE_NAME_TO_USER_ID = Object.fromEntries(
    Object.values(group?.memberships || {})
      .filter(membership => membership?.displayName && membership?.userId)
      .map(membership => [membership.displayName, membership.userId])
  );
  ACTIVE_PROFILE_PHOTO_BY_USER_ID = {};
  ACTIVE_PROFILE_PHOTO_BY_NAME = {};
  JOINED_MONTH_BY_NAME = group?.joinedMonthByName && typeof group.joinedMonthByName === "object"
    ? { ...group.joinedMonthByName }
    : { ...DEFAULT_JOINED_MONTH_BY_NAME };
  refreshActiveTimeContext(group?.settings?.timeZone || DEFAULT_GROUP_TIME_ZONE);
  MIN_TARGET = getEffectiveTargetForMonth(group, curKey);
}

function syncActiveProfileGlobals(profiles) {
  const entries = Object.entries(profiles || {}).filter(([, profile]) => profile?.profilePhotoUrl);
  ACTIVE_PROFILE_PHOTO_BY_USER_ID = Object.fromEntries(
    entries.map(([userId, profile]) => [userId, profile.profilePhotoUrl])
  );
  ACTIVE_PROFILE_PHOTO_BY_NAME = Object.fromEntries(
    entries
      .filter(([, profile]) => profile?.displayName)
      .map(([, profile]) => [profile.displayName, profile.profilePhotoUrl])
  );
}

function getMonthKeyFromISO(iso) {
  const [year, month] = String(iso || "").split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  return `${year}-${month - 1}`;
}

function compareMonthKeys(a, b) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  if (ay !== by) return ay - by;
  return am - bm;
}

function hasActiveParticipationBeforeMonth(displayName, monthKey) {
  if (!displayName || !monthKey) return false;
  const currentMonthLogs = Array.isArray(ACTIVE_LOGS_BY_NAME?.[displayName]) ? ACTIVE_LOGS_BY_NAME[displayName] : [];
  if (currentMonthLogs.some(log => {
    const logMonthKey = getMonthKeyFromISO(log?.date);
    return logMonthKey && compareMonthKeys(logMonthKey, monthKey) < 0;
  })) return true;
  return ACTIVE_MONTH_HISTORY.some(month => {
    if (!month?.key || compareMonthKeys(month.key, monthKey) >= 0) return false;
    if ((month?.counts?.[displayName] || 0) > 0) return true;
    if ((month?.logsByUser?.[displayName] || []).length > 0) return true;
    if (month?.excused?.[displayName]) return true;
    if (month?.settlements?.[displayName]) return true;
    if (Object.prototype.hasOwnProperty.call(month?.memberTargets || {}, displayName)) return true;
    return false;
  });
}

function shouldInferActiveJoinedMonth(displayName, monthKey, joinedAt) {
  if (!displayName || !monthKey || !joinedAt) return false;
  const joinedSummary = getLeagueMonthSummaryForTimestamp(joinedAt, ACTIVE_GROUP_TIME_ZONE);
  if (!joinedSummary || joinedSummary.monthKey !== monthKey) return false;
  return !hasActiveParticipationBeforeMonth(displayName, monthKey);
}

function shouldInferJoinedMonthFromMembership(group, displayName, monthKey, membership, settingsOverride = null) {
  if (!membership?.joinedAt) return false;
  const timeZone = settingsOverride?.timeZone || group?.settings?.timeZone || DEFAULT_GROUP_TIME_ZONE;
  const joinedSummary = getLeagueMonthSummaryForTimestamp(membership.joinedAt, timeZone);
  if (!joinedSummary || joinedSummary.monthKey !== monthKey) return false;
  return !((group?.monthHistory || []).some(month => {
    if (!month?.key || compareMonthKeys(month.key, monthKey) >= 0) return false;
    if ((month?.counts?.[displayName] || 0) > 0) return true;
    if ((month?.logsByUser?.[displayName] || []).length > 0) return true;
    if (month?.excused?.[displayName]) return true;
    if (month?.settlements?.[displayName]) return true;
    if (Object.prototype.hasOwnProperty.call(month?.memberTargets || {}, displayName)) return true;
    return false;
  }) || (Array.isArray(group?.logs?.[displayName]) && group.logs[displayName].some(log => {
    const logMonthKey = getMonthKeyFromISO(log?.date);
    return logMonthKey && compareMonthKeys(logMonthKey, monthKey) < 0;
  })));
}

function isJoinedForMonth(name, monthKey) {
  const joinedMonth = getActiveJoinedMonthForMember(name, monthKey);
  return !joinedMonth || compareMonthKeys(monthKey, joinedMonth) >= 0;
}

function rebuildMonthSnapshot(month, logsByUser) {
  const monthKey = month?.key;
  const relevantNames = NAMES.filter(name => isJoinedForMonth(name, monthKey));
  const nextLogsByUser = buildMonthLogsSnapshot(logsByUser);
  const counts = Object.fromEntries(
    relevantNames.map(name => [name, getCountedLogCount(nextLogsByUser[name])])
  );
  const excused = month?.excused || Object.fromEntries(relevantNames.map(name => [name, false]));
  const settings = buildNormalizedSettings(month?.settings || {});
  const monthGroup = {
    settings,
    memberships: Object.fromEntries(
      Object.entries(ACTIVE_NAME_TO_USER_ID || {})
        .map(([displayName, userId]) => [userId, { userId, displayName, joinedAt: ACTIVE_MEMBER_JOINED_AT_BY_NAME?.[displayName] || null }])
    ),
    joinedMonthByName: JOINED_MONTH_BY_NAME,
    seasonOverrides: {}
  };
  const memberTargets = Object.fromEntries(
    relevantNames.map(name => [name, getMemberTargetForMonth(monthGroup, name, monthKey, settings)])
  );
  const defaultSettlements = buildSettlementMap(counts, excused, settings, memberTargets);
  const previousSettlements = month?.settlements || {};
  const settlements = Object.fromEntries(
    Object.entries(defaultSettlements).map(([name, settlement]) => {
      const previous = previousSettlements[name];
      if (!previous) return [name, settlement];
      return [name, {
        status: previous?.status === "settled" ? "settled" : "outstanding",
        settledAt: previous?.status === "settled" ? (previous?.settledAt || null) : null,
        updatedAt: previous?.updatedAt || null
      }];
    })
  );
  return {
    ...month,
    counts,
    excused,
    logsByUser: nextLogsByUser,
    memberTargets,
    settings,
    settlements
  };
}

// ─── AUTO ROLLOVER ────────────────────────────────────────────────────────────
function checkRollover(data) {
  const { logs, excused, monthHistory, lastMonth } = data;
  // lastMonth stored as "year-month" string
  const expectedKey = curKey;
  if (!lastMonth || lastMonth === expectedKey) return null; // no rollover needed

  // Parse last stored month
  const [ly, lm] = lastMonth.split("-").map(Number);
  const lastDate = new Date(ly, lm, 1);
  const curDate  = new Date(CUR_YEAR, CUR_MONTH, 1);
  if (lastDate >= curDate) return null; // already current

  // Build snapshot of the previous month
  const prevYear  = ly;
  const prevMonth = lm;
  const prevKey   = `${prevYear}-${prevMonth}`;
  const label     = `${MONTH_NAMES[prevMonth]} '${String(prevYear).slice(2)}`;

  const relevantNames = NAMES.filter(name => isJoinedForMonth(name, prevKey));
  const counts  = Object.fromEntries(relevantNames.map(n => [n, getCountedLogCount(logs[n]||[])]));
  const exc     = Object.fromEntries(relevantNames.map(n => [n, excused[n]?.[prevKey]||false]));
  const settings = buildNormalizedSettings({ minTarget: MIN_TARGET });
  const memberTargets = Object.fromEntries(relevantNames.map(name => [name, getCurrentMemberTarget(name, prevKey, settings.minTarget)]));

  const snapshot = {
    key: prevKey,
    label,
    year: prevYear,
    month: prevMonth,
    counts,
    excused: exc,
    logsByUser: buildMonthLogsSnapshot(logs),
    memberTargets,
    settings,
    settlements: buildSettlementMap(counts, exc, settings, memberTargets)
  };
  const newHistory = [...(monthHistory||[]), snapshot];

  // Clear current logs and excused for new month
  const newLogs    = {};
  const newExcused = {};

  return { logs: newLogs, excused: newExcused, monthHistory: newHistory, lastMonth: expectedKey };
}

// ─── API SYNC ─────────────────────────────────────────────────────────────────

// Relocated from the pre-split utils section (verbatim):
function getCurrentGroupMemberNames(group) {
  if (!group) return [];
  if (Array.isArray(group.activeMemberOrder) && group.activeMemberOrder.length) return group.activeMemberOrder;
  return Array.isArray(group.memberOrder) ? group.memberOrder : [];
}

function flattenFeedPosts(group) {
  if (!group) return [];
  const sourceNames = getCurrentGroupMemberNames(group);
  return sourceNames.flatMap(name =>
    (group.logs?.[name] || []).map(log => {
      const normalizedLog = normalizeLogEntry(log);
      return {
        ...normalizedLog,
        owner: name
      };
    })
  ).sort((a, b) => {
    const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
    if (dateCompare !== 0) return dateCompare;
    const aKey = a.createdAt || `${a.date}T00:00:00.000Z`;
    const bKey = b.createdAt || `${b.date}T00:00:00.000Z`;
    return bKey.localeCompare(aKey);
  });
}

function setActiveSessionUserId(value) {
  ACTIVE_SESSION_USER_ID = value;
}


export {
  LEGACY_GROUP_ID,
  DEFAULT_GROUP_NAME,
  DEFAULT_NAMES,
  WORKOUT_TYPES,
  DEFAULT_MIN_TARGET,
  DEFAULT_GROUP_TIME_ZONE,
  LEAGUE_CUTOFF_HOUR,
  DEFAULT_FINE_AMOUNT,
  DEFAULT_FEE_MODEL,
  DEFAULT_ESCALATION_STEP_AMOUNT,
  DEFAULT_CURRENCY,
  DEFAULT_MIN_RUN_DISTANCE,
  DEFAULT_DISTANCE_UNIT,
  DEFAULT_STRAVA_ENABLED,
  UNFLAGGED_IMAGE_RETENTION_MS,
  RESOLVED_IMAGE_RETENTION_MS,
  DEFAULT_JOINED_MONTH_BY_NAME,
  GROUP_NAME,
  NAMES,
  MIN_TARGET,
  JOINED_MONTH_BY_NAME,
  ACTIVE_MEMBER_JOINED_AT_BY_NAME,
  ACTIVE_LOGS_BY_NAME,
  ACTIVE_MONTH_HISTORY,
  ACTIVE_SEASON_OVERRIDES,
  ACTIVE_GROUP_CREATED_AT,
  ACTIVE_ADMIN_NAME,
  ACTIVE_GROUP_TIME_ZONE,
  LEAGUE_TODAY,
  CUR_MONTH,
  CUR_YEAR,
  DAYS_IN_MON,
  DAY_OF_MON,
  TODAY_ISO,
  curKey,
  EARLIEST_LOG_DATE,
  getLeagueDateParts,
  MONTH_NAMES,
  AVATAR_COLORS,
  ACTIVE_SESSION_USER_ID,
  ACTIVE_NAME_TO_USER_ID,
  ACTIVE_PROFILE_PHOTO_BY_USER_ID,
  ACTIVE_PROFILE_PHOTO_BY_NAME,
  hashString,
  resolveAvatarUserId,
  resolveAvatarPhotoUrl,
  avatarColor,
  WORKOUT_TYPE_ALIASES,
  CURRENCY_OPTIONS,
  DISTANCE_UNIT_OPTIONS,
  QUICK_REACTIONS,
  COMMON_TIME_ZONES,
  STATUS_COLORS,
  localISO,
  INSTALL_DISMISSED_KEY,
  LOCAL_CACHE_KEY,
  LOCAL_GROUP_KEY,
  LOCAL_PREVIEW_AUTH_KEY,
  LOCAL_DEV_IMPERSONATION_KEY,
  SYNC_POLL_INTERVAL_MS,
  getDaysLeft,
  refreshActiveTimeContext,
  getTimeContextForGroup,
  getLeagueMonthKey,
  fmtISO,
  toISODate,
  getExpected,
  resolvePaceStatus,
  getStatus,
  getDiff,
  diffLabel,
  isEarlyMonthNeutralWindow,
  getLeaderboardDisplayStatus,
  getLeaderboardDiffText,
  getPaceCheckMessage,
  lastWorkout,
  calcPenalties,
  getLoserAmount,
  normalizeSeasonOverrides,
  normalizeSitOutRequests,
  pruneSitOutRequestsForRead,
  getSeasonOverrideForMonth,
  getEffectiveTargetForMonth,
  getSeasonProrationSummaryForMonth,
  getJoinedTargetInfo,
  getLeagueMonthSummaryForTimestamp,
  getCreatorMonthContext,
  getEffectiveJoinedMonthForMember,
  getMemberTargetForMonth,
  getMemberTargetInfoForMonth,
  getActiveJoinedMonthForMember,
  getCurrentMemberTarget,
  getCurrentMemberTargetInfo,
  getCurrentSitOutRequest,
  getMonthKeyWindow,
  getRecentSitOutCount,
  getDeputyAdmin,
  getCurrentMonthSummary,
  shouldPromptProration,
  buildSettlementMap,
  getMonthSettlements,
  buildSettlementPairsForMonth,
  getHistoricalMemberNamesForMonth,
  getHistoricalGroupMemberNames,
  buildSettlementReminderCards,
  getSettlementConfirmationForPair,
  getLegacySettlementForPair,
  buildSettlementPairState,
  buildSettlementPreviewCards,
  fmtCurrency,
  getUserMASStreak,
  getBlocPerfectMonthStreak,
  getUserWinsThisYear,
  getWorkoutDaysForMonth,
  ordinal,
  workoutsLabel,
  buildMonthLogsSnapshot,
  uniqueNames,
  normalizeWorkoutType,
  normalizeLoggedWorkoutType,
  normalizeReactions,
  normalizeFlagStatus,
  shouldKeepLogPhoto,
  countApprovedFlagsForActor,
  getActivityAlertCount,
  resolveLogCreatedAt,
  normalizeLogEntry,
  normalizeAcceptedWorkoutTypes,
  normalizeFeeModel,
  clampFineAmount,
  normalizeEscalationStepAmount,
  normalizeCurrency,
  normalizeDistanceUnit,
  normalizeTimeZone,
  clampRunDistance,
  buildNormalizedSettings,
  isCountedLog,
  getCountedLogs,
  getCountedLogCount,
  getMonthPartsFromKey,
  formatMonthLabelFromKey,
  deriveMonthKeyFromLogs,
  isLegacyPlaceholderMonthSettings,
  resolveHistoricalMonthSettings,
  deriveHistoricalMemberNamesForMonth,
  normalizeMonthHistoryState,
  deriveActiveMemberOrder,
  normalizeGroupState,
  buildLegacyGroupState,
  buildEmptyAppState,
  deriveDefaultGroupId,
  resolveStateRevision,
  resolveStateUpdatedAt,
  normalizeAppState,
  normalizeProfiles,
  normalizeSettlementConfirmations,
  normalizeMemberships,
  getProfileForSession,
  getMembershipForUser,
  getDisplayNameForGroup,
  syncActiveGroupGlobals,
  syncActiveProfileGlobals,
  getMonthKeyFromISO,
  compareMonthKeys,
  hasActiveParticipationBeforeMonth,
  shouldInferActiveJoinedMonth,
  shouldInferJoinedMonthFromMembership,
  isJoinedForMonth,
  rebuildMonthSnapshot,
  checkRollover,
  getCurrentGroupMemberNames,
  flattenFeedPosts,
  setActiveSessionUserId
};
