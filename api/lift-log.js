const DEFAULT_MIN_TARGET = 12;
const WORKOUT_TYPES = ["Gym", "Run", "Pilates", "Sports", "Other"];
const WORKOUT_TYPE_ALIASES = { Sport: "Sports", Hike: "Other" };
const DEFAULT_GROUP_TIME_ZONE = "Europe/Oslo";
const LEAGUE_CUTOFF_HOUR = 5;
const DEFAULT_FINE_AMOUNT = 100;
const DEFAULT_FEE_MODEL = "escalating";
const DEFAULT_ESCALATION_STEP_AMOUNT = null;
const DEFAULT_CURRENCY = "NOK";
const DEFAULT_MIN_RUN_DISTANCE = 3;
const DEFAULT_DISTANCE_UNIT = "km";
const DEFAULT_STRAVA_ENABLED = true;
const UNFLAGGED_IMAGE_RETENTION_MS = 72 * 60 * 60 * 1000;
const RESOLVED_IMAGE_RETENTION_MS = 24 * 60 * 60 * 1000;
const LEGACY_GROUP_ID = "legacy-group";
const LEGACY_GROUP_NAME = "Lift Log OG";
const DEFAULT_MEMBER_NAMES = ["Aadhil", "Isira", "Rahul", "Kisal", "Rishane", "Deyhan", "Aysha", "Nishara", "Abhishek"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DEFAULT_JOINED_MONTH_BY_NAME = { Abhishek: "2026-4" };
const OTP_TTL_MS = 15 * 60 * 1000;

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function normalizeState(data) {
  if (data?.version === 2) {
    const groups = {};
    const groupOrder = Array.isArray(data?.groupOrder) ? data.groupOrder.filter(id => typeof id === "string" && data.groups?.[id]) : [];
    const sourceGroups = data?.groups && typeof data.groups === "object" ? data.groups : {};

    for (const [groupId, group] of Object.entries(sourceGroups)) {
      groups[groupId] = normalizeGroup({ ...group, id: group.id || groupId });
      if (!groupOrder.includes(groupId)) groupOrder.push(groupId);
    }

    return {
      version: 2,
      groups,
      groupOrder,
      defaultGroupId: groupOrder.includes(data?.defaultGroupId) ? data.defaultGroupId : (groupOrder[0] || null),
      profiles: normalizeProfiles(data?.profiles),
      pendingOtps: normalizePendingOtps(data?.pendingOtps),
      meta: {
        revision: Number.isFinite(Number(data?.meta?.revision)) ? Number(data.meta.revision) : 0,
        updatedAt: data?.meta?.updatedAt || null
      }
    };
  }

  const legacyGroup = normalizeLegacyGroup(data || {});
  return {
    version: 2,
    groups: { [legacyGroup.id]: legacyGroup },
    groupOrder: [legacyGroup.id],
    defaultGroupId: legacyGroup.id,
    profiles: {},
    pendingOtps: {},
    meta: {
      revision: Number.isFinite(Number(data?.meta?.revision)) ? Number(data.meta.revision) : 0,
      updatedAt: data?.meta?.updatedAt || null
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
          createdAt: profile?.createdAt || new Date().toISOString()
        }];
      })
      .filter(Boolean)
  );
}

function normalizePendingOtps(pendingOtps) {
  if (!pendingOtps || typeof pendingOtps !== "object") return {};
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(pendingOtps)
      .map(([email, entry]) => {
        const normalizedEmail = String(email || "").trim().toLowerCase();
        const code = String(entry?.code || "").trim();
        const expiresAt = entry?.expiresAt || null;
        if (!normalizedEmail || !code || !expiresAt) return null;
        if (new Date(expiresAt).getTime() <= now) return null;
        return [normalizedEmail, {
          code,
          expiresAt,
          userId: String(entry?.userId || "").trim() || null
        }];
      })
      .filter(Boolean)
  );
}

function findProfileEntryByEmail(profiles, email) {
  if (!profiles || !email) return null;
  return Object.entries(profiles).find(([, profile]) => profile?.email === email) || null;
}

function migrateAuthIdentity(base, nextUserId, email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedUserId = String(nextUserId || "").trim();
  if (!normalizedEmail || !normalizedUserId) return { state: base, profile: null, changed: false };

  const directProfile = base.profiles?.[normalizedUserId] || null;
  if (directProfile) {
    return { state: base, profile: directProfile, changed: false };
  }

  const profileEntry = findProfileEntryByEmail(base.profiles, normalizedEmail);
  if (!profileEntry) return { state: base, profile: null, changed: false };

  const [legacyUserId, legacyProfile] = profileEntry;
  if (legacyUserId === normalizedUserId) {
    return { state: base, profile: legacyProfile, changed: false };
  }

  const nextProfiles = { ...(base.profiles || {}) };
  delete nextProfiles[legacyUserId];
  nextProfiles[normalizedUserId] = {
    ...legacyProfile,
    id: normalizedUserId,
    email: normalizedEmail
  };

  const nextGroups = Object.fromEntries(
    Object.entries(base.groups || {}).map(([groupId, group]) => {
      const memberships = { ...(group.memberships || {}) };
      const legacyMembership = memberships[legacyUserId];
      if (legacyMembership) {
        delete memberships[legacyUserId];
        memberships[normalizedUserId] = {
          ...legacyMembership,
          userId: normalizedUserId
        };
      }

      const nextSitOutRequests = Object.fromEntries(
        Object.entries(group.sitOutRequests || {}).map(([monthKey, requests]) => [
          monthKey,
          Object.fromEntries(
            Object.entries(requests || {}).map(([memberName, request]) => [
              memberName,
              {
                ...request,
                requestedByUserId: request?.requestedByUserId === legacyUserId ? normalizedUserId : request?.requestedByUserId || null,
                targetApproverUserId: request?.targetApproverUserId === legacyUserId ? normalizedUserId : request?.targetApproverUserId || null,
                decidedByUserId: request?.decidedByUserId === legacyUserId ? normalizedUserId : request?.decidedByUserId || null
              }
            ])
          )
        ])
      );

      return [groupId, normalizeGroup({
        ...group,
        adminUserId: group.adminUserId === legacyUserId ? normalizedUserId : group.adminUserId,
        memberships,
        sitOutRequests: nextSitOutRequests
      })];
    })
  );

  return {
    state: {
      ...base,
      groups: nextGroups,
      profiles: nextProfiles,
      meta: {
        revision: base.meta.revision + 1,
        updatedAt: new Date().toISOString()
      }
    },
    profile: nextProfiles[normalizedUserId],
    changed: true
  };
}

function normalizeLegacyGroup(data) {
  return normalizeGroup({
    id: LEGACY_GROUP_ID,
    name: LEGACY_GROUP_NAME,
    adminName: DEFAULT_MEMBER_NAMES[0],
    inviteCode: "OGGROUP",
    createdAt: data?.meta?.updatedAt || new Date().toISOString(),
    memberOrder: [...DEFAULT_MEMBER_NAMES],
    joinedMonthByName: { ...DEFAULT_JOINED_MONTH_BY_NAME },
    settings: buildNormalizedSettings({ minTarget: DEFAULT_MIN_TARGET, acceptedWorkoutTypes: [...WORKOUT_TYPES], timeZone: DEFAULT_GROUP_TIME_ZONE }),
    logs: data?.logs || {},
    excused: data?.excused || {},
    monthHistory: data?.monthHistory || [],
    lastMonth: data?.lastMonth || null
  });
}

function normalizeGroup(group) {
  const logs = group?.logs && typeof group.logs === "object" ? group.logs : {};
  const monthHistory = Array.isArray(group?.monthHistory) ? group.monthHistory : [];
  const inferredMembers = [
    ...(Array.isArray(group?.memberOrder) ? group.memberOrder : []),
    ...Object.keys(logs),
    ...monthHistory.flatMap(month => Object.keys(month?.counts || {})),
    ...monthHistory.flatMap(month => Object.keys(month?.logsByUser || {}))
  ];
  const memberOrder = uniqueNames(inferredMembers);
  const joinedMonthByName = group?.joinedMonthByName && typeof group.joinedMonthByName === "object" ? group.joinedMonthByName : {};
  const normalizedLogs = Object.fromEntries(
    memberOrder.map(name => [
      name,
      Array.isArray(logs[name]) ? logs[name].map(normalizeLogEntry) : []
    ])
  );
  const normalizedExcused = normalizeExcused(group?.excused, memberOrder);
  const memberships = normalizeMemberships(group?.memberships, memberOrder, group?.adminName, group?.adminUserId);
  const adminUserId = normalizeAdminUserId(group?.adminUserId, memberships, group?.adminName);
  const normalized = {
    id: typeof group?.id === "string" && group.id ? group.id : `group-${Date.now()}`,
    name: typeof group?.name === "string" && group.name.trim() ? group.name.trim() : "Untitled Group",
    adminName: String(group?.adminName || memberOrder[0] || "").trim(),
    adminUserId,
    inviteCode: typeof group?.inviteCode === "string" && group.inviteCode.trim() ? group.inviteCode.trim().toUpperCase() : generateInviteCode(),
    createdAt: group?.createdAt || new Date().toISOString(),
    memberOrder,
    memberships,
    joinedMonthByName,
    settings: buildNormalizedSettings(group?.settings),
    logs: normalizedLogs,
    excused: normalizedExcused,
    seasonOverrides: normalizeSeasonOverrides(group?.seasonOverrides),
    sitOutRequests: normalizeSitOutRequests(group?.sitOutRequests),
    monthHistory: normalizeMonthHistory(monthHistory, memberOrder, joinedMonthByName, buildNormalizedSettings(group?.settings)),
    lastMonth: group?.lastMonth || getLeagueMonthKey(group?.settings?.timeZone)
  };
  return normalized;
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
          chosenBy: override?.chosenBy || null,
          chosenByUserId: override?.chosenByUserId || null
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

function normalizeMemberships(memberships, memberOrder, adminName, adminUserId) {
  if (!memberships || typeof memberships !== "object") return {};
  const normalized = {};
  for (const [userId, membership] of Object.entries(memberships)) {
    const id = String(membership?.userId || userId || "").trim();
    const displayName = String(membership?.displayName || "").trim();
    if (!id || !displayName) continue;
    if (!memberOrder.includes(displayName)) memberOrder.push(displayName);
    normalized[id] = {
      userId: id,
      displayName,
      role: membership?.role === "admin" ? "admin" : "member",
      joinedAt: membership?.joinedAt || new Date().toISOString()
    };
  }
  if (adminUserId && normalized[adminUserId]) normalized[adminUserId].role = "admin";
  if (!adminUserId && adminName) {
    const adminMembership = Object.values(normalized).find(membership => membership.displayName === adminName);
    if (adminMembership) adminMembership.role = "admin";
  }
  return normalized;
}

function normalizeAdminUserId(adminUserId, memberships, adminName) {
  const direct = String(adminUserId || "").trim();
  if (direct && memberships[direct]) return direct;
  const inferred = Object.values(memberships).find(membership => membership.role === "admin" || membership.displayName === adminName);
  return inferred?.userId || null;
}

function normalizeWorkoutType(type) {
  const normalized = WORKOUT_TYPE_ALIASES[type] || type;
  return WORKOUT_TYPES.includes(normalized) ? normalized : "Other";
}

function normalizeLogEntry(log) {
  const photoUrl = typeof log?.photoUrl === "string" ? log.photoUrl : "";
  return {
    ...log,
    id: log?.id || `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: normalizeWorkoutType(log?.type),
    note: typeof log?.note === "string" ? log.note.slice(0, 280) : "",
    photoUrl: shouldKeepLogPhoto(log) ? photoUrl : "",
    createdAt: log?.createdAt || new Date().toISOString(),
    verifiedVia: log?.verifiedVia === "strava" ? "strava" : "photo",
    reactions: normalizeReactions(log?.reactions),
    flagStatus: normalizeFlagStatus(log?.flagStatus),
    flagReason: typeof log?.flagReason === "string" ? log.flagReason.slice(0, 280) : "",
    flagResponse: typeof log?.flagResponse === "string" ? log.flagResponse.slice(0, 280) : "",
    flaggedBy: typeof log?.flaggedBy === "string" ? log.flaggedBy : null,
    decisionBy: typeof log?.decisionBy === "string" ? log.decisionBy : null,
    decisionAt: typeof log?.decisionAt === "string" ? log.decisionAt : null
  };
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
  return ["flagged", "approved", "rejected"].includes(status) ? status : null;
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

function normalizeAcceptedWorkoutTypes(types) {
  if (!Array.isArray(types) || !types.length) return [...WORKOUT_TYPES];
  const normalized = uniqueNames(types.map(normalizeWorkoutType)).filter(type => WORKOUT_TYPES.includes(type));
  return normalized.length ? normalized : [...WORKOUT_TYPES];
}

function buildNormalizedSettings(settings) {
  return {
    minTarget: clampTarget(settings?.minTarget),
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

function normalizeCurrency(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : DEFAULT_CURRENCY;
}

function normalizeDistanceUnit(value) {
  return String(value || "").trim().toLowerCase() === "mi" ? "mi" : DEFAULT_DISTANCE_UNIT;
}

function normalizeTimeZone(timeZone) {
  const value = String(timeZone || "").trim();
  if (!value) return DEFAULT_GROUP_TIME_ZONE;
  try {
    Intl.DateTimeFormat("en-GB", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return DEFAULT_GROUP_TIME_ZONE;
  }
}

function normalizeExcused(excused, memberOrder) {
  const normalized = {};
  for (const name of memberOrder) {
    normalized[name] = excused?.[name] && typeof excused[name] === "object" ? excused[name] : {};
  }
  return normalized;
}

function normalizeMonthHistory(monthHistory, memberOrder, joinedMonthByName, settings) {
  return monthHistory.map(month => {
    const relevantNames = memberOrder.filter(name => isJoinedForMonth(joinedMonthByName, name, month?.key));
    const logsByUser = buildMonthLogsSnapshot(month?.logsByUser || {}, memberOrder);
    const counts = Object.fromEntries(relevantNames.map(name => [name, Number(month?.counts?.[name] || getCountedLogCount(logsByUser[name]) || 0)]));
    const excused = month?.excused || Object.fromEntries(relevantNames.map(name => [name, false]));
    const monthSettings = buildNormalizedSettings(month?.settings || settings);
    return {
      ...month,
      counts,
      excused,
      logsByUser,
      settings: monthSettings,
      settlements: month?.settlements || buildDefaultSettlements({ counts, excused, key: month?.key }, relevantNames, monthSettings)
    };
  });
}

function getLeagueDateParts(timeZone = DEFAULT_GROUP_TIME_ZONE) {
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
}

function getLeagueMonthKey(timeZone = DEFAULT_GROUP_TIME_ZONE) {
  const today = getLeagueDateParts(timeZone);
  return `${today.year}-${today.month - 1}`;
}

function getMonthKeyFromISO(isoDate) {
  const [year, month] = String(isoDate || "").split("-").map(Number);
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

function isJoinedForMonth(joinedMonthByName, name, monthKey) {
  const joinedMonth = joinedMonthByName?.[name];
  return !joinedMonth || compareMonthKeys(monthKey, joinedMonth) >= 0;
}

function calcPenalties(activeCounts, settings) {
  const minTarget = Number(settings?.minTarget || DEFAULT_MIN_TARGET);
  if (!activeCounts.length) return { winners: [], losers: [], perLoser: 0, totalPot: 0, perWinner: 0, loserAmounts: {} };
  const sorted = [...activeCounts].sort((a, b) => b.count - a.count);
  const topCount = sorted[0].count;
  if (topCount === 0) return { winners: [], losers: [], perLoser: 0, totalPot: 0, perWinner: 0, loserAmounts: {} };
  const winners = sorted.filter(user => user.count === topCount);
  const losers = activeCounts.filter(user => user.count < minTarget && user.count < topCount);
  const n = losers.length;
  const baseFine = Number(settings?.fineAmount || DEFAULT_FINE_AMOUNT);
  const feeModel = normalizeFeeModel(settings?.feeModel);
  const escalationStepAmount = Number(settings?.escalationStepAmount || 0);
  const sharedLoserAmount = n === 0 ? 0 : feeModel === "flat"
    ? baseFine
    : baseFine + (escalationStepAmount * Math.max(0, n - 1));
  const loserAmounts = n === 0 ? {} : Object.fromEntries(losers.map(loser => [loser.name, sharedLoserAmount]));
  const perLoser = sharedLoserAmount;
  const totalPot = Object.values(loserAmounts).reduce((sum, amount) => sum + amount, 0);
  const perWinner = winners.length > 0 && totalPot > 0 ? Math.floor(totalPot / winners.length) : 0;
  return { winners, losers, perLoser, totalPot, perWinner, loserAmounts };
}

function buildDefaultSettlements(month, relevantNames, settings) {
  const activeCounts = relevantNames
    .filter(name => !(month.excused?.[name]))
    .map(name => ({ name, count: month.counts?.[name] || 0 }));
  const { losers } = calcPenalties(activeCounts, settings);
  return Object.fromEntries(
    losers.map(loser => [
      loser.name,
      {
        status: "outstanding",
        settledAt: null,
        updatedAt: null
      }
    ])
  );
}

function buildMonthLogsSnapshot(logsByName, memberOrder) {
  return Object.fromEntries(
    memberOrder.map(name => [name, [...(logsByName?.[name] || [])].map(log => normalizeLogEntry({ ...log, photoUrl: "" }))])
  );
}

function rebuildMonthSnapshot(group, month, logsByUser) {
  const monthKey = month?.key;
  const relevantNames = group.memberOrder.filter(name => isJoinedForMonth(group.joinedMonthByName, name, monthKey));
  const nextLogsByUser = buildMonthLogsSnapshot(logsByUser, group.memberOrder);
  const counts = Object.fromEntries(
    relevantNames.map(name => [name, getCountedLogCount(nextLogsByUser[name])])
  );
  const excused = month?.excused || Object.fromEntries(relevantNames.map(name => [name, false]));
  const settings = buildNormalizedSettings(month?.settings || group.settings);
  return {
    ...month,
    counts,
    excused,
    logsByUser: nextLogsByUser,
    settings,
    settlements: buildDefaultSettlements({ counts, excused }, relevantNames, settings)
  };
}

function rolloverGroupIfNeeded(group) {
  const expectedKey = getLeagueMonthKey(group?.settings?.timeZone);
  if (!group.lastMonth || group.lastMonth === expectedKey) return group;

  const [ly, lm] = group.lastMonth.split("-").map(Number);
  const [cy, cm] = expectedKey.split("-").map(Number);
  const lastDate = new Date(ly, lm, 1);
  const curDate = new Date(cy, cm, 1);
  if (lastDate >= curDate) return group;

  const label = `${MONTH_NAMES[lm]} '${String(ly).slice(2)}`;
  const relevantNames = group.memberOrder.filter(name => isJoinedForMonth(group.joinedMonthByName, name, group.lastMonth));
  const counts = Object.fromEntries(
    relevantNames.map(name => [name, getCountedLogCount(group.logs?.[name] || [])])
  );
  const excused = Object.fromEntries(
    relevantNames.map(name => [name, group.excused?.[name]?.[group.lastMonth] || false])
  );
  const snapshot = {
    key: group.lastMonth,
    label,
    year: ly,
    month: lm,
    counts,
    excused,
    logsByUser: buildMonthLogsSnapshot(group.logs, group.memberOrder),
    settings: buildNormalizedSettings(group.settings),
    settlements: buildDefaultSettlements({ counts, excused }, relevantNames, group.settings)
  };

  return normalizeGroup({
    ...group,
    logs: {},
    excused: {},
    monthHistory: [...group.monthHistory, snapshot],
    lastMonth: expectedKey
  });
}

function rolloverStateIfNeeded(data) {
  const base = normalizeState(data);
  let changed = false;
  const groups = {};
  for (const [groupId, group] of Object.entries(base.groups)) {
    const nextGroup = rolloverGroupIfNeeded(group);
    groups[groupId] = nextGroup;
    if (JSON.stringify(nextGroup) !== JSON.stringify(group)) changed = true;
  }

  if (!changed) return base;

  return {
    ...base,
    groups,
    meta: {
      revision: base.meta.revision + 1,
      updatedAt: new Date().toISOString()
    }
  };
}

async function fetchCurrentState() {
  return await fetchCurrentStateFromSupabase();
}

async function persistState(nextState, reason) {
  return await persistStateToSupabase(nextState, reason);
}

async function fetchCurrentStateFromSupabase() {
  assertSupabaseConfigured();
  const response = await supabaseFetch("/rest/v1/lift_log_state?id=eq.true&select=state", {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return rolloverStateIfNeeded({});
  }
  return rolloverStateIfNeeded(rows[0]?.state || {});
}

async function persistStateToSupabase(nextState, reason) {
  assertSupabaseConfigured();
  const safeState = normalizeState(nextState);
  await createSupabaseBackup(safeState, reason);

  const response = await supabaseFetch("/rest/v1/lift_log_state?id=eq.true", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      state: safeState,
      revision: safeState.meta.revision,
      updated_at: safeState.meta.updatedAt || new Date().toISOString()
    })
  });

  const rows = await response.json();
  if (Array.isArray(rows) && rows.length > 0) {
    return rolloverStateIfNeeded(rows[0]?.state || safeState);
  }

  await supabaseFetch("/rest/v1/lift_log_state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation,resolution=merge-duplicates"
    },
    body: JSON.stringify([{
      id: true,
      state: safeState,
      revision: safeState.meta.revision,
      updated_at: safeState.meta.updatedAt || new Date().toISOString()
    }])
  });

  return safeState;
}

async function createSupabaseBackup(state, reason) {
  await supabaseFetch("/rest/v1/lift_log_backups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      state_revision: state.meta.revision,
      state,
      reason
    })
  });
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...options.headers
    }
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || "Supabase request failed");
    error.status = response.status;
    throw error;
  }
  return response;
}

function assertSupabaseConfigured() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const error = new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
    error.status = 500;
    throw error;
  }
}

function getClientAuthConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const error = new Error("SUPABASE_URL or SUPABASE_ANON_KEY is missing");
    error.status = 500;
    throw error;
  }
  return {
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY
  };
}

function readBearerToken(req, payload) {
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization || "";
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const token = typeof payload?.accessToken === "string" ? payload.accessToken.trim() : "";
  return token || "";
}

async function fetchAuthenticatedUser(accessToken) {
  if (!accessToken) {
    const error = new Error("You need to sign in again");
    error.status = 401;
    throw error;
  }
  assertSupabaseConfigured();
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!response.ok) {
    const error = new Error("Your session is no longer valid. Sign in again.");
    error.status = 401;
    throw error;
  }
  const user = await response.json();
  const userId = String(user?.id || "").trim();
  const email = String(user?.email || "").trim().toLowerCase();
  if (!userId || !email) {
    const error = new Error("Authenticated user is missing an email address");
    error.status = 401;
    throw error;
  }
  return { id: userId, email, raw: user };
}

async function requireAuthenticatedContext(req, payload, current) {
  const accessToken = readBearerToken(req, payload);
  const user = await fetchAuthenticatedUser(accessToken);
  const migrated = migrateAuthIdentity(rolloverStateIfNeeded(current), user.id, user.email);
  const state = migrated.state;
  const profile = state.profiles?.[user.id] || migrated.profile || null;
  return {
    state,
    user,
    profile,
    needsPersist: migrated.changed
  };
}

function resolveDisplayNameForUser(state, groupId, userId, email) {
  const group = groupId ? state.groups?.[groupId] : null;
  if (group?.memberships?.[userId]?.displayName) return group.memberships[userId].displayName;
  const profile = state.profiles?.[userId] || findProfileEntryByEmail(state.profiles, email)?.[1] || null;
  if (profile?.displayName) return profile.displayName;
  return "";
}

function applyAuthSync(current, user) {
  const migrated = migrateAuthIdentity(rolloverStateIfNeeded(current), user.id, user.email);
  const profile = migrated.state.profiles?.[user.id] || null;
  return {
    state: migrated.state,
    changed: migrated.changed,
    session: {
      userId: user.id,
      email: user.email,
      needsProfileSetup: !profile?.displayName
    }
  };
}

function mergeState(current, incoming) {
  const actor = incoming?.actor || null;
  const groupId = incoming?.groupId || null;
  if (!actor || !groupId) {
    const error = new Error("Actor and groupId are required");
    error.status = 400;
    throw error;
  }

  const base = rolloverStateIfNeeded(current);
  const baseGroup = base.groups[groupId];
  if (!baseGroup) {
    const error = new Error("Bloc not found");
    error.status = 404;
    throw error;
  }

  const nextGroup = normalizeGroup({ ...baseGroup, ...(incoming?.group || {}), id: groupId });
  const leagueMonthKey = getLeagueMonthKey(baseGroup.settings?.timeZone);
  const incomingMonthKey = nextGroup.lastMonth || null;
  if (incomingMonthKey && incomingMonthKey !== leagueMonthKey) {
    const error = new Error("Month changed. Refresh before logging.");
    error.status = 409;
    throw error;
  }

  const mergedGroup = normalizeGroup({
    ...baseGroup,
    logs: {
      ...baseGroup.logs,
      ...(Object.prototype.hasOwnProperty.call(nextGroup.logs, actor) ? { [actor]: nextGroup.logs[actor] || [] } : {})
    },
    excused: {
      ...baseGroup.excused,
      ...(Object.prototype.hasOwnProperty.call(nextGroup.excused, actor) ? { [actor]: nextGroup.excused[actor] || {} } : {})
    },
    monthHistory: Array.isArray(nextGroup.monthHistory) && nextGroup.monthHistory.length
          ? normalizeMonthHistory(baseGroup.monthHistory, baseGroup.memberOrder, baseGroup.joinedMonthByName, baseGroup.settings).map(baseMonth => {
          const incomingMonth = nextGroup.monthHistory.find(month => month.key === baseMonth.key);
          if (!incomingMonth?.logsByUser || !Object.prototype.hasOwnProperty.call(incomingMonth.logsByUser, actor)) {
            return baseMonth;
          }
          return rebuildMonthSnapshot(baseGroup, baseMonth, {
            ...(baseMonth.logsByUser || {}),
            [actor]: incomingMonth.logsByUser[actor] || []
          });
        })
      : baseGroup.monthHistory,
    lastMonth: baseGroup.lastMonth
  });

  return {
    ...base,
    groups: {
      ...base.groups,
      [groupId]: mergedGroup
    },
    meta: {
      revision: base.meta.revision + 1,
      updatedAt: new Date().toISOString()
    }
  };
}

function applySettlementUpdate(current, payload) {
  const adminPin = process.env.ADMIN_PIN;
  if (!adminPin) {
    const error = new Error("ADMIN_PIN is not configured");
    error.status = 500;
    throw error;
  }
  if (payload?.pin !== adminPin) {
    const error = new Error("Invalid admin PIN");
    error.status = 401;
    throw error;
  }

  const groupId = payload?.groupId;
  const base = rolloverStateIfNeeded(current);
  const group = base.groups[groupId];
  if (!group) {
    const error = new Error("Bloc not found");
    error.status = 404;
    throw error;
  }

  const monthHistory = normalizeMonthHistory(group.monthHistory, group.memberOrder, group.joinedMonthByName, group.settings);
  const monthIndex = monthHistory.findIndex(month => month.key === payload?.monthKey);
  if (monthIndex === -1) {
    const error = new Error("Month not found");
    error.status = 404;
    throw error;
  }

  const month = monthHistory[monthIndex];
  const settlements = { ...(month.settlements || buildDefaultSettlements(month, group.memberOrder, month.settings || group.settings)) };
  if (!Object.prototype.hasOwnProperty.call(settlements, payload?.player)) {
    const error = new Error("Settlement target is not eligible");
    error.status = 400;
    throw error;
  }

  settlements[payload.player] = {
    status: payload?.settled ? "settled" : "outstanding",
    settledAt: payload?.settled ? new Date().toISOString().slice(0, 10) : null,
    updatedAt: new Date().toISOString()
  };

  monthHistory[monthIndex] = { ...month, settlements };

  return {
    ...base,
    groups: {
      ...base.groups,
      [groupId]: normalizeGroup({ ...group, monthHistory })
    },
    meta: {
      revision: base.meta.revision + 1,
      updatedAt: new Date().toISOString()
    }
  };
}

function applyCreateGroup(current, payload) {
  const groupName = String(payload?.groupName || "").trim();
  const actorUserId = String(payload?.actorUserId || "").trim();
  const profiles = current?.profiles || {};
  const creatorProfile = actorUserId ? profiles[actorUserId] : null;
  const creatorName = String(payload?.creatorName || creatorProfile?.displayName || "").trim();
  const extraMembers = parseExtraMembers(payload?.extraMembers);
  const settings = buildNormalizedSettings({
    minTarget: payload?.minTarget,
    acceptedWorkoutTypes: payload?.acceptedWorkoutTypes,
    timeZone: payload?.groupTimeZone,
    fineAmount: payload?.fineAmount,
    escalationStepAmount: payload?.escalationStepAmount,
    currency: payload?.currency,
    feeModel: payload?.feeModel,
    minRunDistance: payload?.minRunDistance,
    distanceUnit: payload?.distanceUnit,
    stravaEnabled: payload?.stravaEnabled
  });

  if (!groupName || !creatorName) {
    const error = new Error("Group name and creator name are required");
    error.status = 400;
    throw error;
  }
  if (settings.feeModel === "escalating" && settings.escalationStepAmount === null) {
    const error = new Error("Set a step amount to continue.");
    error.status = 400;
    throw error;
  }

  const base = rolloverStateIfNeeded(current);
  const id = generateGroupId(groupName);
  const group = normalizeGroup({
    id,
    name: groupName,
    adminName: creatorName,
    adminUserId: actorUserId || null,
    inviteCode: generateInviteCode(),
    createdAt: new Date().toISOString(),
    memberOrder: uniqueNames([creatorName, ...extraMembers]),
    memberships: actorUserId ? {
      [actorUserId]: {
        userId: actorUserId,
        displayName: creatorName,
        role: "admin",
        joinedAt: new Date().toISOString()
      }
    } : {},
    joinedMonthByName: {},
    settings,
    logs: {},
    excused: {},
    monthHistory: [],
    lastMonth: getLeagueMonthKey(settings.timeZone)
  });

  return {
    state: {
      ...base,
      groups: {
        ...base.groups,
        [id]: group
      },
      groupOrder: [...base.groupOrder, id],
      meta: {
        revision: base.meta.revision + 1,
        updatedAt: new Date().toISOString()
      }
    },
    createdGroupId: id
  };
}

function applyMultiLog(current, payload) {
  const actor = String(payload?.actor || "").trim();
  const sourceGroupId = String(payload?.sourceGroupId || "").trim();
  const workoutType = normalizeWorkoutType(payload?.workoutType);
  const date = String(payload?.date || "").trim();
  const note = typeof payload?.note === "string" ? payload.note.slice(0, 280) : "";
  const photoUrl = typeof payload?.photoUrl === "string" ? payload.photoUrl : "";
  const targetGroupIds = Array.isArray(payload?.targetGroupIds) ? payload.targetGroupIds.filter(Boolean) : [];

  if (!actor || !sourceGroupId || !date || !targetGroupIds.length || !photoUrl) {
    const error = new Error("actor, sourceGroupId, date, workoutType, photoUrl, and targetGroupIds are required");
    error.status = 400;
    throw error;
  }
  if (workoutType === "Other" && !note.trim()) {
    const error = new Error("A note is required for Other workouts");
    error.status = 400;
    throw error;
  }
  const sourceGroup = current?.groups?.[sourceGroupId] || rolloverStateIfNeeded(current).groups?.[sourceGroupId];
  const sourceTimeZone = sourceGroup?.settings?.timeZone || DEFAULT_GROUP_TIME_ZONE;
  if (getMonthKeyFromISO(date) !== getLeagueMonthKey(sourceTimeZone)) {
    const error = new Error("Cross-group logging is only supported for the current month");
    error.status = 400;
    throw error;
  }

  const base = rolloverStateIfNeeded(current);
  const logId = Date.now();
  const updatedGroups = { ...base.groups };

  for (const groupId of targetGroupIds) {
    const group = updatedGroups[groupId];
    if (!group) continue;
    if (!group.memberOrder.includes(actor)) continue;
    const accepted = group.settings?.acceptedWorkoutTypes || WORKOUT_TYPES;
    if (!accepted.includes(workoutType)) continue;

    const existingLogs = group.logs?.[actor] || [];
    if (existingLogs.some(log => log?.date === date)) continue;

    updatedGroups[groupId] = normalizeGroup({
      ...group,
      logs: {
        ...group.logs,
        [actor]: [...existingLogs, {
          id: groupId === sourceGroupId ? String(logId) : `${logId}-${groupId}`,
          date,
          type: workoutType,
          note,
          photoUrl,
          createdAt: new Date().toISOString(),
          verifiedVia: "photo",
          reactions: {},
          flagStatus: null,
          flagReason: "",
          flagResponse: "",
          flaggedBy: null,
          decisionBy: null,
          decisionAt: null
        }]
      }
    });
  }

  return {
    ...base,
    groups: updatedGroups,
    meta: {
      revision: base.meta.revision + 1,
      updatedAt: new Date().toISOString()
    }
  };
}

function applyUpdateSettings(current, payload) {
  const actor = String(payload?.actor || "").trim();
  const actorUserId = String(payload?.actorUserId || "").trim();
  const groupId = String(payload?.groupId || "").trim();
  const base = rolloverStateIfNeeded(current);
  const group = base.groups[groupId];
  if (!group) {
    const error = new Error("Bloc not found");
    error.status = 404;
    throw error;
  }
  const actorIsAdmin = group.adminUserId
    ? group.adminUserId === actorUserId
    : group.adminName && group.adminName === actor;
  if (!actorIsAdmin) {
    const error = new Error("Only the Bloc admin can update settings");
    error.status = 403;
    throw error;
  }
  const nextSettings = buildNormalizedSettings({
    ...group.settings,
    ...payload?.settings
  });
  if (nextSettings.feeModel === "escalating" && nextSettings.escalationStepAmount === null) {
    const error = new Error("Set a step amount to continue.");
    error.status = 400;
    throw error;
  }
  const nextGroup = normalizeGroup({
    ...group,
    name: String(payload?.groupName || group.name).trim() || group.name,
    settings: nextSettings
  });
  return {
    ...base,
    groups: {
      ...base.groups,
      [groupId]: nextGroup
    },
    meta: {
      revision: base.meta.revision + 1,
      updatedAt: new Date().toISOString()
    }
  };
}

function applySeasonProrationChoice(current, payload) {
  const actor = String(payload?.actor || "").trim();
  const actorUserId = String(payload?.actorUserId || "").trim();
  const groupId = String(payload?.groupId || "").trim();
  const choice = payload?.choice === "prorate" ? "prorate" : "keep";
  const base = rolloverStateIfNeeded(current);
  const group = base.groups[groupId];
  if (!group) {
    const error = new Error("Bloc not found");
    error.status = 404;
    throw error;
  }
  const actorIsAdmin = group.adminUserId ? group.adminUserId === actorUserId : group.adminName === actor;
  if (!actorIsAdmin) {
    const error = new Error("Only the Bloc admin can choose the first-month target");
    error.status = 403;
    throw error;
  }
  const summary = getCurrentMonthSummary(group.settings?.timeZone);
  const existing = normalizeSeasonOverrides(group.seasonOverrides)[summary.monthKey];
  if (existing) return base;
  if (summary.day <= 1) return base;
  const fullMas = Number(group.settings?.minTarget || DEFAULT_MIN_TARGET);
  const proratedMas = Math.max(1, Math.round((summary.daysRemaining / summary.daysInMonth) * fullMas));
  const nextGroup = normalizeGroup({
    ...group,
    seasonOverrides: {
      ...(group.seasonOverrides || {}),
      [summary.monthKey]: {
        prorated: choice === "prorate",
        proratedMas: choice === "prorate" ? proratedMas : fullMas,
        chosenAt: new Date().toISOString(),
        chosenBy: actor,
        chosenByUserId: actorUserId || null
      }
    }
  });
  return {
    ...base,
    groups: { ...base.groups, [groupId]: nextGroup },
    meta: { revision: base.meta.revision + 1, updatedAt: new Date().toISOString() }
  };
}

function applySitOutRequest(current, payload) {
  const actor = String(payload?.actor || "").trim();
  const actorUserId = String(payload?.actorUserId || "").trim();
  const groupId = String(payload?.groupId || "").trim();
  const reason = typeof payload?.reason === "string" ? payload.reason.slice(0, 280) : "";
  const exceptional = !!payload?.exceptional;
  const base = rolloverStateIfNeeded(current);
  const group = base.groups[groupId];
  if (!group) {
    const error = new Error("Bloc not found");
    error.status = 404;
    throw error;
  }
  const month = getCurrentMonthSummary(group.settings?.timeZone);
  const existingRequests = normalizeSitOutRequests(group.sitOutRequests);
  if (group.excused?.[actor]?.[month.monthKey]) {
    const error = new Error("You're already sitting out this month");
    error.status = 400;
    throw error;
  }
  const recentCount = getRecentSitOutCount(group, actor, month.monthKey);
  if (recentCount >= 1 && !exceptional) {
    const error = new Error(`You've already sat out recently. Your next sit-out is available in ${MONTH_NAMES[(month.month + 3) % 12]}.`);
    error.status = 403;
    throw error;
  }
  const deputy = getDeputyAdmin(group);
  const actorIsAdmin = group.adminUserId ? group.adminUserId === actorUserId : group.adminName === actor;
  const targetApprover = actorIsAdmin ? deputy : (group.adminUserId ? group.memberships?.[group.adminUserId] : null);
  const shouldAutoApprove = month.day <= 5 && !exceptional && !actorIsAdmin && recentCount < 1;
  const nextExcused = { ...(group.excused || {}) };
  if (shouldAutoApprove) {
    nextExcused[actor] = { ...(nextExcused[actor] || {}), [month.monthKey]: true };
  }
  const nextGroup = normalizeGroup({
    ...group,
    excused: nextExcused,
    sitOutRequests: {
      ...existingRequests,
      [month.monthKey]: {
        ...(existingRequests[month.monthKey] || {}),
        [actor]: {
          memberName: actor,
          monthKey: month.monthKey,
          status: shouldAutoApprove ? "approved" : "pending",
          reason,
          exceptional,
          requestedAt: new Date().toISOString(),
          requestedBy: actor,
          requestedByUserId: actorUserId || null,
          targetApproverName: targetApprover?.displayName || null,
          targetApproverUserId: targetApprover?.userId || null,
          decidedAt: shouldAutoApprove ? new Date().toISOString() : null,
          decidedBy: shouldAutoApprove ? actor : null,
          decidedByUserId: shouldAutoApprove ? (actorUserId || null) : null,
          autoApproved: shouldAutoApprove
        }
      }
    }
  });
  return {
    ...base,
    groups: { ...base.groups, [groupId]: nextGroup },
    meta: { revision: base.meta.revision + 1, updatedAt: new Date().toISOString() }
  };
}

function applySitOutReview(current, payload) {
  const actor = String(payload?.actor || "").trim();
  const actorUserId = String(payload?.actorUserId || "").trim();
  const groupId = String(payload?.groupId || "").trim();
  const memberName = String(payload?.memberName || "").trim();
  const monthKey = String(payload?.monthKey || "").trim();
  const decision = payload?.decision === "approve" ? "approved" : payload?.decision === "decline" ? "declined" : null;
  if (!decision) {
    const error = new Error("A valid review decision is required");
    error.status = 400;
    throw error;
  }
  const base = rolloverStateIfNeeded(current);
  const group = base.groups[groupId];
  if (!group) {
    const error = new Error("Bloc not found");
    error.status = 404;
    throw error;
  }
  const request = normalizeSitOutRequests(group.sitOutRequests)?.[monthKey]?.[memberName];
  if (!request || request.status !== "pending") {
    const error = new Error("Sit-out request not found");
    error.status = 404;
    throw error;
  }
  const actorIsAdmin = group.adminUserId ? group.adminUserId === actorUserId : group.adminName === actor;
  const deputy = getDeputyAdmin(group);
  const canReview = actorIsAdmin || (request.targetApproverUserId && request.targetApproverUserId === actorUserId) || (request.targetApproverName && request.targetApproverName === actor) || (memberName === group.adminName && deputy?.userId === actorUserId);
  if (!canReview) {
    const error = new Error("You can't review this sit-out request");
    error.status = 403;
    throw error;
  }
  const nextExcused = { ...(group.excused || {}) };
  if (decision === "approved") {
    nextExcused[memberName] = { ...(nextExcused[memberName] || {}), [monthKey]: true };
  }
  const requests = normalizeSitOutRequests(group.sitOutRequests);
  const nextGroup = normalizeGroup({
    ...group,
    excused: nextExcused,
    sitOutRequests: {
      ...requests,
      [monthKey]: {
        ...(requests[monthKey] || {}),
        [memberName]: {
          ...request,
          status: decision,
          decidedAt: new Date().toISOString(),
          decidedBy: actor,
          decidedByUserId: actorUserId || null
        }
      }
    }
  });
  return {
    ...base,
    groups: { ...base.groups, [groupId]: nextGroup },
    meta: { revision: base.meta.revision + 1, updatedAt: new Date().toISOString() }
  };
}

function updateGroupLog(current, payload, updater, reasonPrefix) {
  const actor = String(payload?.actor || "").trim();
  const groupId = String(payload?.groupId || "").trim();
  const owner = String(payload?.owner || "").trim();
  const logId = String(payload?.logId || "").trim();
  const base = rolloverStateIfNeeded(current);
  const group = base.groups[groupId];
  if (!group) {
    const error = new Error("Bloc not found");
    error.status = 404;
    throw error;
  }
  const ownerLogs = [...(group.logs?.[owner] || [])];
  const logIndex = ownerLogs.findIndex(log => String(log?.id) === logId);
  if (logIndex === -1) {
    const error = new Error("Workout not found");
    error.status = 404;
    throw error;
  }
  const updatedLog = updater({ group, actor, owner, log: ownerLogs[logIndex] });
  ownerLogs[logIndex] = normalizeLogEntry(updatedLog);
  return {
    updated: {
      ...base,
      groups: {
        ...base.groups,
        [groupId]: normalizeGroup({
          ...group,
          logs: {
            ...group.logs,
            [owner]: ownerLogs
          }
        })
      },
      meta: {
        revision: base.meta.revision + 1,
        updatedAt: new Date().toISOString()
      }
    },
    reason: `${reasonPrefix}:${groupId}:${owner}:${logId}:${actor}`
  };
}

function applyDeleteLog(current, payload) {
  const actor = String(payload?.actor || "").trim();
  const groupId = String(payload?.groupId || "").trim();
  const logId = String(payload?.logId || "").trim();
  const base = rolloverStateIfNeeded(current);
  const group = base.groups[groupId];
  if (!group) { const e = new Error("Bloc not found"); e.status = 404; throw e; }
  if (!group.memberOrder.includes(actor)) { const e = new Error("Not a member"); e.status = 403; throw e; }
  const ownerLogs = group.logs?.[actor] || [];
  const logIndex = ownerLogs.findIndex(log => String(log?.id) === logId);
  if (logIndex === -1) { const e = new Error("Workout not found"); e.status = 404; throw e; }
  const updatedLogs = ownerLogs.filter((_, i) => i !== logIndex);
  return {
    updated: {
      ...base,
      groups: {
        ...base.groups,
        [groupId]: normalizeGroup({
          ...group,
          logs: { ...group.logs, [actor]: updatedLogs }
        })
      },
      meta: { revision: base.meta.revision + 1, updatedAt: new Date().toISOString() }
    },
    reason: `delete-log:${groupId}:${actor}:${logId}`
  };
}

function applyToggleReaction(current, payload) {
  const emoji = String(payload?.emoji || "").trim();
  if (!emoji) {
    const error = new Error("Emoji is required");
    error.status = 400;
    throw error;
  }
  return updateGroupLog(current, payload, ({ actor, log }) => {
    const reactions = normalizeReactions(log.reactions);
    const currentUsers = reactions[emoji] || [];
    reactions[emoji] = currentUsers.includes(actor)
      ? currentUsers.filter(name => name !== actor)
      : [...currentUsers, actor];
    if (!reactions[emoji].length) delete reactions[emoji];
    return { ...log, reactions };
  }, "reaction");
}

function applyFlagLog(current, payload) {
  const reason = typeof payload?.reason === "string" ? payload.reason.slice(0, 280) : "";
  return updateGroupLog(current, payload, ({ group, actor, owner, log }) => {
    if (owner === actor) {
      const error = new Error("You cannot flag your own workout");
      error.status = 400;
      throw error;
    }
    if (!group.memberOrder.includes(actor)) {
      const error = new Error("Only Bloc members can flag workouts");
      error.status = 403;
      throw error;
    }
    if (log.verifiedVia === "strava") {
      const error = new Error("Strava verified workouts cannot be flagged");
      error.status = 400;
      throw error;
    }
    if (countApprovedFlagsForActor(group, actor) >= 3) {
      const error = new Error("You've had three workout flags overturned this month, so you can't flag again until next month.");
      error.status = 403;
      throw error;
    }
    return {
      ...log,
      flagStatus: "flagged",
      flagReason: reason,
      flaggedBy: actor,
      decisionBy: null,
      decisionAt: null
    };
  }, "flag");
}

function applyRespondToFlag(current, payload) {
  const response = typeof payload?.response === "string" ? payload.response.slice(0, 280) : "";
  return updateGroupLog(current, payload, ({ actor, owner, log }) => {
    if (owner !== actor) {
      const error = new Error("Only the workout owner can respond to a flag");
      error.status = 403;
      throw error;
    }
    if (log.flagStatus !== "flagged") {
      const error = new Error("Workout is not currently flagged");
      error.status = 400;
      throw error;
    }
    return { ...log, flagResponse: response };
  }, "flag-response");
}

function applyReviewFlag(current, payload) {
  const decision = payload?.decision === "approve" ? "approved" : payload?.decision === "reject" ? "rejected" : null;
  if (!decision) {
    const error = new Error("Decision must be approve or reject");
    error.status = 400;
    throw error;
  }
  return updateGroupLog(current, payload, ({ group, actor, log }) => {
    const actorUserId = String(payload?.actorUserId || "").trim();
    const actorIsAdmin = group.adminUserId ? group.adminUserId === actorUserId : group.adminName === actor;
    if (!actorIsAdmin) {
      const error = new Error("Only the Bloc admin can review flagged workouts");
      error.status = 403;
      throw error;
    }
    if (log.flagStatus !== "flagged") {
      const error = new Error("Workout is not currently flagged");
      error.status = 400;
      throw error;
    }
    return {
      ...log,
      flagStatus: decision,
      decisionBy: actor,
      decisionAt: new Date().toISOString()
    };
  }, "flag-review");
}

function applySendOtp(current, payload) {
  const email = String(payload?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    const error = new Error("A valid email is required");
    error.status = 400;
    throw error;
  }
  const base = rolloverStateIfNeeded(current);
  const existingProfile = Object.values(base.profiles || {}).find(profile => profile.email === email);
  const userId = existingProfile?.id || `user_${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const code = String(Math.floor(100000 + Math.random() * 900000));
  return {
    state: {
      ...base,
      pendingOtps: {
        ...(base.pendingOtps || {}),
        [email]: {
          code,
          expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
          userId
        }
      },
      meta: {
        revision: base.meta.revision + 1,
        updatedAt: new Date().toISOString()
      }
    },
    email,
    code
  };
}

function applyVerifyOtp(current, payload) {
  const email = String(payload?.email || "").trim().toLowerCase();
  const code = String(payload?.code || "").trim();
  const base = rolloverStateIfNeeded(current);
  const pending = base.pendingOtps?.[email];
  if (!pending || !code || pending.code !== code) {
    const error = new Error("That code didn’t match. Try again.");
    error.status = 401;
    throw error;
  }
  if (new Date(pending.expiresAt).getTime() <= Date.now()) {
    const error = new Error("That code expired. Request a new one.");
    error.status = 401;
    throw error;
  }
  const nextPending = { ...(base.pendingOtps || {}) };
  delete nextPending[email];
  const profile = base.profiles?.[pending.userId] || null;
  return {
    state: {
      ...base,
      pendingOtps: nextPending,
      meta: {
        revision: base.meta.revision + 1,
        updatedAt: new Date().toISOString()
      }
    },
    session: {
      userId: pending.userId,
      email,
      needsProfileSetup: !profile?.displayName
    }
  };
}

function applyUpsertProfile(current, payload) {
  const userId = String(payload?.userId || "").trim();
  const email = String(payload?.email || "").trim().toLowerCase();
  const displayName = String(payload?.displayName || "").trim();
  if (!userId || !email || !displayName) {
    const error = new Error("userId, email, and display name are required");
    error.status = 400;
    throw error;
  }
  const base = rolloverStateIfNeeded(current);
  const existing = base.profiles?.[userId] || {};
  return {
    ...base,
    profiles: {
      ...(base.profiles || {}),
      [userId]: {
        id: userId,
        email,
        displayName,
        createdAt: existing.createdAt || new Date().toISOString()
      }
    },
    meta: {
      revision: base.meta.revision + 1,
      updatedAt: new Date().toISOString()
    }
  };
}

function resolveGroupByInvite(base, payload) {
  const explicitGroupId = String(payload?.groupId || "").trim();
  if (explicitGroupId && base.groups[explicitGroupId]) return base.groups[explicitGroupId];
  const inviteCode = String(payload?.inviteCode || "").trim().toUpperCase();
  if (!inviteCode) return null;
  return Object.values(base.groups).find(group => group.inviteCode === inviteCode) || null;
}

function applyJoinGroup(current, payload) {
  const userId = String(payload?.userId || "").trim();
  const base = rolloverStateIfNeeded(current);
  const profile = base.profiles?.[userId];
  if (!profile?.displayName) {
    const error = new Error("Finish setting up your profile before joining a Bloc");
    error.status = 400;
    throw error;
  }
  const group = resolveGroupByInvite(base, payload);
  if (!group) {
    const error = new Error("Bloc invite not found");
    error.status = 404;
    throw error;
  }
  if (group.memberships?.[userId]) {
    return { state: base, joinedGroupId: group.id };
  }
  const MAX_MEMBERS = 20;
  const currentMemberCount = Object.keys(group.memberships || {}).length || group.memberOrder.length;
  if (currentMemberCount >= MAX_MEMBERS) {
    const error = new Error("This Bloc is full. Maximum 20 members allowed.");
    error.status = 403;
    throw error;
  }
  const nextGroup = normalizeGroup({
    ...group,
    memberOrder: uniqueNames([...group.memberOrder, profile.displayName]),
    memberships: {
      ...(group.memberships || {}),
      [userId]: {
        userId,
        displayName: profile.displayName,
        role: "member",
        joinedAt: new Date().toISOString()
      }
    }
  });
  return {
    state: {
      ...base,
      groups: {
        ...base.groups,
        [group.id]: nextGroup
      },
      meta: {
        revision: base.meta.revision + 1,
        updatedAt: new Date().toISOString()
      }
    },
    joinedGroupId: group.id
  };
}

function applyKickMember(current, payload) {
  const actorUserId = String(payload?.actorUserId || "").trim();
  const targetUserId = String(payload?.targetUserId || "").trim();
  const targetDisplayName = String(payload?.targetDisplayName || "").trim();
  const groupId = String(payload?.groupId || "").trim();
  const base = rolloverStateIfNeeded(current);
  const group = base.groups?.[groupId];
  if (!group) {
    const error = new Error("Bloc not found");
    error.status = 404;
    throw error;
  }
  // Support legacy groups where adminUserId may not be set
  const actorDisplayName = String(payload?.actorDisplayName || "").trim();
  const actorResolvedName = Object.values(group.memberships||{}).find(m=>m.userId===actorUserId)?.displayName || actorDisplayName;
  const actorIsAdmin = group.adminUserId
    ? group.adminUserId === actorUserId
    : group.adminName === actorResolvedName;
  if (!actorIsAdmin) {
    const error = new Error("Only the admin can remove members");
    error.status = 403;
    throw error;
  }
  // Resolve target by userId or displayName fallback
  const targetMembership = targetUserId
    ? group.memberships?.[targetUserId]
    : Object.values(group.memberships||{}).find(m=>m.displayName===targetDisplayName);
  const resolvedDisplayName = targetMembership?.displayName || targetDisplayName;
  if (!resolvedDisplayName || !group.memberOrder.includes(resolvedDisplayName)) {
    const error = new Error("Member not found in this Bloc");
    error.status = 404;
    throw error;
  }
  if (targetMembership?.userId === actorUserId || resolvedDisplayName === group.adminName) {
    const error = new Error("Admin cannot remove themselves — leave the Bloc instead");
    error.status = 400;
    throw error;
  }
  const nextMemberships = { ...(group.memberships || {}) };
  if (targetUserId) delete nextMemberships[targetUserId];
  else if (targetMembership?.userId) delete nextMemberships[targetMembership.userId];
  const nextMemberOrder = group.memberOrder.filter(n => n !== resolvedDisplayName);
  const nextGroup = normalizeGroup({
    ...group,
    memberOrder: nextMemberOrder,
    memberships: nextMemberships
  });
  return {
    ...base,
    groups: { ...base.groups, [groupId]: nextGroup },
    meta: { revision: base.meta.revision + 1, updatedAt: new Date().toISOString() }
  };
}

function applyLeaveBloc(current, payload) {
  const userId = String(payload?.userId || "").trim();
  const groupId = String(payload?.groupId || "").trim();
  const base = rolloverStateIfNeeded(current);
  const group = base.groups?.[groupId];
  if (!group) {
    const error = new Error("Bloc not found");
    error.status = 404;
    throw error;
  }
  const membership = group.memberships?.[userId];
  if (!membership) {
    const error = new Error("You are not a member of this Bloc");
    error.status = 404;
    throw error;
  }
  const isAdmin = group.adminUserId === userId;
  const displayName = membership.displayName;
  const nextMemberships = { ...(group.memberships || {}) };
  delete nextMemberships[userId];
  const nextMemberOrder = group.memberOrder.filter(n => n !== displayName);

  // If no remaining members, delete the Bloc entirely
  if (Object.keys(nextMemberships).length === 0) {
    const nextGroups = { ...base.groups };
    delete nextGroups[groupId];
    return {
      ...base,
      groups: nextGroups,
      meta: { revision: base.meta.revision + 1, updatedAt: new Date().toISOString() }
    };
  }

  let nextAdminUserId = group.adminUserId;
  let nextAdminName = group.adminName;
  if (isAdmin) {
    // Transfer to longest-standing member (earliest joinedAt)
    const remaining = Object.values(nextMemberships).sort((a, b) => {
      const aTime = Date.parse(a.joinedAt || "") || 0;
      const bTime = Date.parse(b.joinedAt || "") || 0;
      return aTime - bTime;
    });
    const newAdmin = remaining[0];
    nextAdminUserId = newAdmin.userId;
    nextAdminName = newAdmin.displayName;
  }

  const nextGroup = normalizeGroup({
    ...group,
    adminUserId: nextAdminUserId,
    adminName: nextAdminName,
    memberOrder: nextMemberOrder,
    memberships: nextMemberships
  });
  return {
    ...base,
    groups: { ...base.groups, [groupId]: nextGroup },
    meta: { revision: base.meta.revision + 1, updatedAt: new Date().toISOString() }
  };
}

function applyDeleteAccount(current, payload) {
  const userId = String(payload?.userId || "").trim();
  if (!userId) {
    const error = new Error("userId is required");
    error.status = 400;
    throw error;
  }

  const base = rolloverStateIfNeeded(current);
  const profile = base.profiles?.[userId];
  // Resolve the user's display name from profile or any membership
  let displayName = profile?.displayName || "";
  if (!displayName) {
    for (const group of Object.values(base.groups || {})) {
      const m = group.memberships?.[userId];
      if (m?.displayName) { displayName = m.displayName; break; }
    }
  }

  // Verify user exists
  if (!profile && !displayName) {
    const error = new Error("Account not found");
    error.status = 404;
    throw error;
  }

  let nextGroups = { ...base.groups };
  const nextGroupOrder = [...(base.groupOrder || [])];

  for (const [groupId, group] of Object.entries(base.groups || {})) {
    const membership = group.memberships?.[userId];
    if (!membership) continue; // user not in this group

    const dn = membership.displayName || displayName;
    const nextMemberships = { ...group.memberships };
    delete nextMemberships[userId];
    const remainingCount = Object.keys(nextMemberships).length;

    // If sole member, delete the group entirely
    if (remainingCount === 0) {
      delete nextGroups[groupId];
      const idx = nextGroupOrder.indexOf(groupId);
      if (idx !== -1) nextGroupOrder.splice(idx, 1);
      continue;
    }

    // Transfer admin if needed
    let nextAdminUserId = group.adminUserId;
    let nextAdminName = group.adminName;
    if (group.adminUserId === userId) {
      const remaining = Object.values(nextMemberships).sort((a, b) => {
        const aTime = Date.parse(a.joinedAt || "") || 0;
        const bTime = Date.parse(b.joinedAt || "") || 0;
        return aTime - bTime;
      });
      const newAdmin = remaining[0];
      nextAdminUserId = newAdmin.userId;
      nextAdminName = newAdmin.displayName;
    }

    // Remove member from memberOrder
    const nextMemberOrder = group.memberOrder.filter(n => n !== dn);

    // Remove their logs
    const nextLogs = { ...(group.logs || {}) };
    delete nextLogs[dn];

    // Scrub their name from all reaction arrays on remaining logs
    const scrubbedLogs = {};
    for (const [owner, ownerLogs] of Object.entries(nextLogs)) {
      scrubbedLogs[owner] = (Array.isArray(ownerLogs) ? ownerLogs : []).map(log => {
        if (!log?.reactions) return log;
        const nextReactions = {};
        for (const [emoji, reactors] of Object.entries(log.reactions)) {
          const filtered = reactors.filter(r => r !== dn);
          if (filtered.length > 0) nextReactions[emoji] = filtered;
        }
        return { ...log, reactions: nextReactions };
      });
    }

    // Clear flaggedBy on any log flagged by this user
    const finalLogs = {};
    for (const [owner, ownerLogs] of Object.entries(scrubbedLogs)) {
      finalLogs[owner] = (Array.isArray(ownerLogs) ? ownerLogs : []).map(log => {
        if (log?.flaggedBy === dn) return { ...log, flaggedBy: null, flagReason: "", flagResponse: "", flagStatus: null };
        return log;
      });
    }

    // Remove sit-out requests by this user
    const nextSitOutRequests = {};
    for (const [monthKey, monthRequests] of Object.entries(group.sitOutRequests || {})) {
      const filtered = { ...monthRequests };
      delete filtered[dn];
      if (Object.keys(filtered).length > 0) nextSitOutRequests[monthKey] = filtered;
    }

    nextGroups[groupId] = normalizeGroup({
      ...group,
      adminUserId: nextAdminUserId,
      adminName: nextAdminName,
      memberOrder: nextMemberOrder,
      memberships: nextMemberships,
      logs: finalLogs,
      sitOutRequests: nextSitOutRequests
    });
  }

  // Remove profile and any pending OTPs
  const nextProfiles = { ...base.profiles };
  delete nextProfiles[userId];
  const nextPendingOtps = { ...(base.pendingOtps || {}) };
  for (const [email, otp] of Object.entries(nextPendingOtps)) {
    if (otp?.userId === userId || (profile?.email && email === profile.email)) {
      delete nextPendingOtps[email];
    }
  }

  return {
    ...base,
    groups: nextGroups,
    groupOrder: nextGroupOrder,
    profiles: nextProfiles,
    pendingOtps: nextPendingOtps,
    meta: { revision: base.meta.revision + 1, updatedAt: new Date().toISOString() }
  };
}

function getInviteContext(current, payload) {
  const group = resolveGroupByInvite(current, payload);
  if (!group) {
    const error = new Error("Bloc invite not found");
    error.status = 404;
    throw error;
  }
  return {
    groupId: group.id,
    groupName: group.name,
    inviteCode: group.inviteCode,
    memberCount: group.memberOrder.length,
    minTarget: group.settings?.minTarget || DEFAULT_MIN_TARGET
  };
}

async function readJson(req) {
  if (typeof req.body === "object" && req.body !== null) return req.body;
  if (typeof req.body === "string" && req.body.length) return JSON.parse(req.body);

  return await new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => { raw += chunk; });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "GET") {
      const url = new URL(req.url || "/", "http://localhost");
      if (url.searchParams.get("config") === "auth") {
        return res.status(200).json(getClientAuthConfig());
      }
      const current = await fetchCurrentState();
      return res.status(200).json(current);
    }

    if (req.method === "PUT") {
      const payload = await readJson(req);
      const current = await fetchCurrentState();
      const auth = await requireAuthenticatedContext(req, payload, current);
      const actor = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
      const merged = mergeState(auth.state, { ...payload, actor });
      const persisted = await persistState(merged, `player-update:${payload.groupId}:${actor || auth.user.id}`);
      return res.status(200).json(persisted);
    }

    if (req.method === "POST") {
      const payload = await readJson(req);
      const current = await fetchCurrentState();

      if (payload?.action === "auth-sync") {
        const authUser = await fetchAuthenticatedUser(readBearerToken(req, payload));
        const synced = applyAuthSync(current, authUser);
        const state = synced.changed ? await persistState(synced.state, `auth-sync:${authUser.id}`) : synced.state;
        return res.status(200).json({ ok: true, state, session: synced.session });
      }

      if (payload?.action === "settlement") {
        await requireAuthenticatedContext(req, payload, current);
        const updated = applySettlementUpdate(current, payload);
        const persisted = await persistState(updated, `settlement:${payload.groupId}:${payload.monthKey}:${payload.player}`);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "create-group") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const creatorName = auth.profile?.displayName || String(payload?.creatorName || "").trim();
        const created = applyCreateGroup(auth.state, { ...payload, actorUserId: auth.user.id, creatorName });
        const persisted = await persistState(created.state, `create-group:${created.createdGroupId}`);
        return res.status(200).json({ state: persisted, createdGroupId: created.createdGroupId });
      }

      if (payload?.action === "auth-send-otp") {
        const sent = applySendOtp(current, payload);
        const persisted = await persistState(sent.state, `auth-send-otp:${sent.email}`);
        return res.status(200).json({ ok: true, state: persisted, devCode: sent.code });
      }

      if (payload?.action === "auth-verify-otp") {
        const verified = applyVerifyOtp(current, payload);
        const persisted = await persistState(verified.state, `auth-verify-otp:${verified.session.userId}`);
        return res.status(200).json({ ok: true, state: persisted, session: verified.session });
      }

      if (payload?.action === "upsert-profile") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const updated = applyUpsertProfile(auth.state, { ...payload, userId: auth.user.id, email: auth.user.email });
        const persisted = await persistState(updated, `profile:${auth.user.id}`);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "join-group") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const joined = applyJoinGroup(auth.state, { ...payload, userId: auth.user.id });
        const persisted = await persistState(joined.state, `join-group:${joined.joinedGroupId}:${auth.user.id}`);
        return res.status(200).json({ state: persisted, joinedGroupId: joined.joinedGroupId });
      }

      if (payload?.action === "invite-context") {
        return res.status(200).json(getInviteContext(current, payload));
      }

      if (payload?.action === "kick-member") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actorDisplayName = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const updated = applyKickMember(auth.state, { ...payload, actorUserId: auth.user.id, actorDisplayName });
        const persisted = await persistState(updated, `kick-member:${payload.groupId}:${payload.targetUserId}`);
        return res.status(200).json({ ok: true, state: persisted });
      }

      if (payload?.action === "leave-bloc") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const updated = applyLeaveBloc(auth.state, { ...payload, userId: auth.user.id });
        const persisted = await persistState(updated, `leave-bloc:${payload.groupId}:${auth.user.id}`);
        return res.status(200).json({ ok: true, state: persisted, leftGroupId: payload.groupId });
      }

      if (payload?.action === "multi-log") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.sourceGroupId, auth.user.id, auth.user.email);
        const updated = applyMultiLog(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const persisted = await persistState(updated, `multi-log:${actor || auth.user.id}:${payload.date}:${payload.workoutType}`);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "update-settings") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const updated = applyUpdateSettings(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const persisted = await persistState(updated, `settings:${payload.groupId}:${actor || auth.user.id}`);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "season-proration-choice") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const updated = applySeasonProrationChoice(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const persisted = await persistState(updated, `season-proration:${payload.groupId}:${payload.choice}`);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "sitout-request") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const updated = applySitOutRequest(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const persisted = await persistState(updated, `sitout-request:${payload.groupId}:${actor || auth.user.id}`);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "sitout-review") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const updated = applySitOutReview(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const persisted = await persistState(updated, `sitout-review:${payload.groupId}:${payload.memberName}:${payload.decision}`);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "reaction") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const result = applyToggleReaction(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const persisted = await persistState(result.updated, result.reason);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "flag") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const result = applyFlagLog(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const persisted = await persistState(result.updated, result.reason);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "flag-response") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const result = applyRespondToFlag(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const persisted = await persistState(result.updated, result.reason);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "flag-review") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const result = applyReviewFlag(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const persisted = await persistState(result.updated, result.reason);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "delete-log") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const result = applyDeleteLog(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const persisted = await persistState(result.updated, result.reason);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "delete-account") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const updated = applyDeleteAccount(auth.state, { ...payload, userId: auth.user.id });
        const persisted = await persistState(updated, `delete-account:${auth.user.id}`);
        return res.status(200).json({ ok: true, state: persisted });
      }

      return res.status(400).json({ error: "Unsupported POST action" });
    }

    res.setHeader("Allow", "GET, PUT, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(error?.status || 500).json({
      error: "Anté sync proxy failed",
      status: error?.status || 500,
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

function uniqueNames(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function parseExtraMembers(value) {
  if (Array.isArray(value)) return uniqueNames(value);
  if (typeof value !== "string") return [];
  return uniqueNames(value.split(","));
}

function clampTarget(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_MIN_TARGET;
  return Math.min(30, Math.max(6, Math.round(numeric)));
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

function normalizeFeeModel(value) {
  return value === "flat" ? "flat" : DEFAULT_FEE_MODEL;
}

function clampRunDistance(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_MIN_RUN_DISTANCE;
  return Math.max(0.5, Math.round(numeric * 10) / 10);
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

function getRecentSitOutCount(group, memberName, monthKey) {
  return getMonthKeyWindow(monthKey, 3).reduce((sum, key) => (
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

function getCurrentMonthSummary(timeZone = DEFAULT_GROUP_TIME_ZONE) {
  const monthKey = getLeagueMonthKey(timeZone);
  const [year, month] = monthKey.split("-").map(Number);
  const now = getLeagueDateParts(timeZone);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = now.day;
  return {
    monthKey,
    year,
    month,
    day,
    daysInMonth,
    daysRemaining: Math.max(1, daysInMonth - day + 1)
  };
}

function isCountedLog(log) {
  return normalizeFlagStatus(log?.flagStatus) !== "rejected";
}

function getCountedLogCount(logs) {
  return (Array.isArray(logs) ? logs : []).filter(isCountedLog).length;
}

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function generateGroupId(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "group";
  return `${slug}-${Math.random().toString(36).slice(2, 8)}`;
}
