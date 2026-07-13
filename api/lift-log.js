const DEFAULT_MIN_TARGET = 12;
const WORKOUT_TYPES = ["Gym", "Run", "Sports", "Pilates", "Other"];
const WORKOUT_TYPE_ALIASES = { Sport: "Sports", Hike: "Other", Hiking: "Other" };
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
const STORAGE_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
const STORAGE_CLEANUP_FETCH_TIMEOUT_MS = 4000;
const STORAGE_CLEANUP_MAX_FOLDERS = 250;
const STORAGE_CLEANUP_MAX_FILES_PER_FOLDER = 250;
const LEGACY_GROUP_ID = "legacy-group";
const LEGACY_GROUP_NAME = "Lift Log OG";
const DEFAULT_MEMBER_NAMES = ["Aadhil", "Isira", "Rahul", "Kisal", "Rishane", "Deyhan", "Aysha", "Nishara", "Abhishek"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DEFAULT_JOINED_MONTH_BY_NAME = { Abhishek: "2026-4" };
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ENABLE_SETTLEMENT_CONFIRMATIONS = String(process.env.ENABLE_SETTLEMENT_CONFIRMATIONS || "").trim().toLowerCase() === "true";
const ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW = String(process.env.ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW || "").trim().toLowerCase() === "true";
const ENABLE_LOCAL_PREVIEW_AUTH = String(process.env.ENABLE_LOCAL_PREVIEW_AUTH || "").trim().toLowerCase() === "true";
const WRITE_HYDRATION_PARITY_PREVIEW_BRANCH = "codex/create-group-canonical-first";
const WRITE_HYDRATION_PARITY_DEFAULT_ACTIONS = [
  "update-settings",
  "season-proration-choice",
  "sitout-request",
  "sitout-review",
  "reaction",
  "flag",
  "flag-response",
  "flag-review",
  "delete-log"
];
const WRITE_HYDRATION_PARITY_ENV = String(process.env.WRITE_HYDRATION_PARITY_ACTIONS || "").trim();
const ENABLE_PREVIEW_WRITE_HYDRATION_PARITY = !WRITE_HYDRATION_PARITY_ENV
  && process.env.VERCEL_ENV === "preview"
  && process.env.VERCEL_GIT_COMMIT_REF === WRITE_HYDRATION_PARITY_PREVIEW_BRANCH;
const WRITE_HYDRATION_PARITY_ACTIONS = new Set(
  (WRITE_HYDRATION_PARITY_ENV || (ENABLE_PREVIEW_WRITE_HYDRATION_PARITY ? WRITE_HYDRATION_PARITY_DEFAULT_ACTIONS.join(",") : ""))
    .split(",")
    .map(action => action.trim())
    .filter(Boolean)
);

let storageCleanupInFlight = null;
let storageCleanupLastRunAt = 0;
let storageCleanupLastWarningAt = 0;

function deriveDefaultGroupId(groupOrder) {
  return Array.isArray(groupOrder) && groupOrder.length ? groupOrder[0] : null;
}

function resolveStateRevision(data, overrideRevision = undefined) {
  const revision = overrideRevision ?? data?.meta?.revision ?? data?.revision;
  return Number.isFinite(Number(revision)) ? Number(revision) : 0;
}

function resolveStateUpdatedAt(data, overrideUpdatedAt = undefined) {
  return overrideUpdatedAt ?? data?.meta?.updatedAt ?? data?.updatedAt ?? null;
}

function normalizeState(data, options = {}) {
  const revision = resolveStateRevision(data, options.revision);
  const updatedAt = resolveStateUpdatedAt(data, options.updatedAt);
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
      defaultGroupId: deriveDefaultGroupId(groupOrder),
      profiles: normalizeProfiles(data?.profiles),
      meta: {
        revision,
        updatedAt
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
    meta: {
      revision,
      updatedAt
    }
  };
}

function serializeStateForBlob(state) {
  const normalized = normalizeState(state);
  return {
    version: normalized.version,
    groups: normalized.groups,
    groupOrder: normalized.groupOrder,
    profiles: normalized.profiles
  };
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function valuesDiffer(a, b) {
  return stableStringify(a) !== stableStringify(b);
}

function collectWriteHydrationGroupMismatches(writableGroup, readableGroup, groupId) {
  if (!writableGroup && !readableGroup) return [];
  if (!writableGroup || !readableGroup) return [`groups.${groupId}`];
  return uniqueNames([
    ...Object.keys(writableGroup || {}),
    ...Object.keys(readableGroup || {})
  ])
    .filter(key => valuesDiffer(writableGroup?.[key], readableGroup?.[key]))
    .map(key => `groups.${groupId}.${key}`);
}

function findFirstNestedDifference(a, b, path = "") {
  if (!valuesDiffer(a, b)) return null;
  if (Array.isArray(a) || Array.isArray(b)) {
    const aArray = Array.isArray(a) ? a : [];
    const bArray = Array.isArray(b) ? b : [];
    const maxLength = Math.max(aArray.length, bArray.length);
    for (let i = 0; i < maxLength; i += 1) {
      const childPath = `${path}[${i}]`;
      const diff = findFirstNestedDifference(aArray[i], bArray[i], childPath);
      if (diff) return diff;
    }
    return { path, writable: a, canonical: b };
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = uniqueNames([...Object.keys(a), ...Object.keys(b)]).sort();
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      const diff = findFirstNestedDifference(a?.[key], b?.[key], childPath);
      if (diff) return diff;
    }
  }
  return { path, writable: a ?? null, canonical: b ?? null };
}

function collectWriteHydrationGroupMismatchDetails(writableGroup, canonicalGroup, groupId, mismatches) {
  return Object.fromEntries(
    mismatches.map(mismatch => {
      const prefix = `groups.${groupId}.`;
      const key = mismatch.startsWith(prefix) ? mismatch.slice(prefix.length) : "";
      const detail = key
        ? findFirstNestedDifference(writableGroup?.[key], canonicalGroup?.[key], mismatch)
        : findFirstNestedDifference(writableGroup, canonicalGroup, mismatch);
      return [mismatch, detail];
    })
  );
}

function pickCurrentMonthOnlyMap(monthMap, monthKey) {
  return Object.fromEntries(
    Object.entries(monthMap || {}).map(([name, entries]) => [
      name,
      entries?.[monthKey] ? { [monthKey]: entries[monthKey] } : {}
    ])
  );
}

function buildCurrentOpenComparisonGroup(group) {
  if (!group) return null;
  const monthKey = group.lastMonth || getLeagueMonthKey(group.settings?.timeZone);
  const seasonOverrides = normalizeSeasonOverrides(group.seasonOverrides);
  const sitOutRequests = normalizeSitOutRequests(group.sitOutRequests);
  return {
    id: group.id,
    name: group.name,
    adminName: group.adminName,
    adminUserId: group.adminUserId || null,
    inviteCode: group.inviteCode,
    activeMemberOrder: group.activeMemberOrder || [],
    memberships: group.memberships || {},
    joinedMonthByName: group.joinedMonthByName || {},
    settings: group.settings || {},
    logs: group.logs || {},
    excused: pickCurrentMonthOnlyMap(group.excused || {}, monthKey),
    seasonOverrides: seasonOverrides[monthKey] ? { [monthKey]: seasonOverrides[monthKey] } : {},
    sitOutRequests: sitOutRequests[monthKey] ? { [monthKey]: sitOutRequests[monthKey] } : {},
    settlementConfirmationsEnabled: !!group.settlementConfirmationsEnabled,
    settlementConfirmationsPreviewMode: !!group.settlementConfirmationsPreviewMode,
    lastMonth: monthKey
  };
}

function collectWriteHydrationCurrentOpenMismatches(writableGroup, canonicalGroup, groupId) {
  return collectWriteHydrationGroupMismatches(
    buildCurrentOpenComparisonGroup(writableGroup),
    buildCurrentOpenComparisonGroup(canonicalGroup),
    groupId
  );
}

function isWriteHydrationParityEnabled(action) {
  return WRITE_HYDRATION_PARITY_ACTIONS.has("*") || WRITE_HYDRATION_PARITY_ACTIONS.has(action);
}

function isCurrentOpenWriteHydrationAction(action) {
  return WRITE_HYDRATION_PARITY_DEFAULT_ACTIONS.includes(action)
    || action === "add-log"
    || action === "multi-log"
    || action === "kick-member"
    || action === "leave-bloc"
    || action === "create-group";
}

function assertAdminPin(payload) {
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
}

function redactWriteHydrationVolatileFields(value, inReactions = false) {
  const volatileKeys = new Set(["chosenAt", "requestedAt", "decidedAt", "decisionAt"]);
  if (Array.isArray(value)) {
    if (inReactions && value.every(entry => typeof entry === "string")) {
      return [...value].sort((a, b) => a.localeCompare(b));
    }
    return value.map(entry => redactWriteHydrationVolatileFields(entry, inReactions));
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "memberAuthUserIds")
      .map(([key, entry]) => [
        key,
        volatileKeys.has(key) && entry ? "<volatile>" : redactWriteHydrationVolatileFields(entry, inReactions || key === "reactions")
      ])
  );
}

function buildWriteHydrationParityBlob(state) {
  return redactWriteHydrationVolatileFields(serializeStateForBlob(state));
}

function redactGeneratedWorkoutLogFieldsForComparison(value) {
  if (Array.isArray(value)) {
    return value.map(entry => redactGeneratedWorkoutLogFieldsForComparison(entry));
  }
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value).map(([key, entry]) => {
    if (key === "logs" && entry && typeof entry === "object") {
      return [key, Object.fromEntries(
        Object.entries(entry).map(([owner, logs]) => [
          owner,
          Array.isArray(logs)
            ? logs.map(log => log && typeof log === "object"
              ? { ...log, id: log.id ? "<volatile>" : log.id, createdAt: log.createdAt ? "<volatile>" : log.createdAt }
              : log)
            : logs
        ])
      )];
    }
    return [key, redactGeneratedWorkoutLogFieldsForComparison(entry)];
  });
  return Object.fromEntries(entries);
}

function redactJoinGroupFieldsForComparison(value) {
  if (Array.isArray(value)) return value.map(entry => redactJoinGroupFieldsForComparison(entry));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (key === "memberships" && entry && typeof entry === "object") {
        return [key, Object.fromEntries(
          Object.entries(entry).map(([userId, membership]) => [
            userId,
            membership && typeof membership === "object"
              ? { ...membership, joinedAt: membership.joinedAt ? "<volatile>" : membership.joinedAt }
              : membership
          ])
        )];
      }
      return [key, redactJoinGroupFieldsForComparison(entry)];
    })
  );
}

function buildWriteHydrationComparisonBlob(state, action) {
  const blob = buildWriteHydrationParityBlob(state);
  if (action === "add-log" || action === "multi-log") {
    return redactGeneratedWorkoutLogFieldsForComparison(blob);
  }
  if (action === "join-group") {
    return redactJoinGroupFieldsForComparison(blob);
  }
  return blob;
}

function unwrapMutationState(result) {
  return result?.updated || result?.state || result;
}

function preferExistingTimestamp(existingTimestamp, canonicalTimestamp) {
  if (!existingTimestamp) return canonicalTimestamp || null;
  if (!canonicalTimestamp) return existingTimestamp;
  const existingTime = Date.parse(existingTimestamp);
  const canonicalTime = Date.parse(canonicalTimestamp);
  return Number.isFinite(existingTime) && Number.isFinite(canonicalTime) && existingTime === canonicalTime
    ? existingTimestamp
    : canonicalTimestamp;
}

function preserveBlobCompatibleLogFields(existingLog, canonicalLog) {
  if (!existingLog) return canonicalLog;
  const preserved = {
    ...canonicalLog,
    createdAt: preferExistingTimestamp(existingLog.createdAt, canonicalLog.createdAt),
    decisionAt: preferExistingTimestamp(existingLog.decisionAt, canonicalLog.decisionAt),
    reactions: normalizeReactions(existingLog.reactions)
  };
  if (!Object.prototype.hasOwnProperty.call(existingLog, "ownerDisplayName")) {
    delete preserved.ownerDisplayName;
  }
  return preserved;
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

function scopeReadableStateForUser(state, userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return {
      ...state,
      groups: {},
      groupOrder: [],
      defaultGroupId: null,
      profiles: {}
    };
  }

  const allowedGroupIds = new Set(
    Object.entries(state?.groups || {})
      .filter(([, group]) =>
        group?.memberships?.[normalizedUserId] ||
        group?.adminUserId === normalizedUserId
      )
      .map(([groupId]) => groupId)
  );

  const nextGroupOrder = (state?.groupOrder || []).filter(groupId => allowedGroupIds.has(groupId));
  const nextGroups = Object.fromEntries(
    nextGroupOrder
      .map(groupId => [groupId, state?.groups?.[groupId]])
      .filter(([, group]) => !!group)
  );

  const selfProfile = state?.profiles?.[normalizedUserId];
  const nextProfiles = selfProfile ? { [normalizedUserId]: selfProfile } : {};

  return {
    ...state,
    groups: nextGroups,
    groupOrder: nextGroupOrder,
    defaultGroupId: deriveDefaultGroupId(nextGroupOrder),
    profiles: nextProfiles
  };
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

function findProfileEntryByEmail(profiles, email) {
  if (!profiles || !email) return null;
  return Object.entries(profiles).find(([, profile]) => profile?.email === email) || null;
}

function needsLegacyMembershipBackfill(groups, userId, displayName) {
  return !!displayName && Object.values(groups || {}).some(group =>
    group.memberOrder?.includes(displayName) && !group.memberships?.[userId]
  );
}

function backfillLegacyMembershipForProfile(group, userId, displayName) {
  if (!group.memberOrder?.includes(displayName) || group.memberships?.[userId]) {
    return group;
  }
  const isAdmin = group.adminName === displayName;
  return normalizeGroup({
    ...group,
    adminUserId: isAdmin ? userId : (group.adminUserId || null),
    memberships: {
      ...group.memberships,
      [userId]: {
        userId,
        displayName,
        role: isAdmin ? "admin" : "member",
        joinedAt: null
      }
    }
  });
}

function rekeyAuthReference(value, legacyUserId, nextUserId) {
  return value === legacyUserId ? nextUserId : value || null;
}

function rekeySitOutRequestUserIds(sitOutRequests, legacyUserId, nextUserId) {
  return Object.fromEntries(
    Object.entries(sitOutRequests || {}).map(([monthKey, requests]) => [
      monthKey,
      Object.fromEntries(
        Object.entries(requests || {}).map(([memberName, request]) => [
          memberName,
          {
            ...request,
            requestedByUserId: rekeyAuthReference(request?.requestedByUserId, legacyUserId, nextUserId),
            targetApproverUserId: rekeyAuthReference(request?.targetApproverUserId, legacyUserId, nextUserId),
            decidedByUserId: rekeyAuthReference(request?.decidedByUserId, legacyUserId, nextUserId)
          }
        ])
      )
    ])
  );
}

function rekeyLegacyAuthIdentityInGroup(group, legacyUserId, nextUserId) {
  const memberships = { ...(group.memberships || {}) };
  const legacyMembership = memberships[legacyUserId];
  if (legacyMembership) {
    delete memberships[legacyUserId];
    memberships[nextUserId] = {
      ...legacyMembership,
      userId: nextUserId
    };
  }

  return normalizeGroup({
    ...group,
    adminUserId: group.adminUserId === legacyUserId ? nextUserId : group.adminUserId,
    memberships,
    sitOutRequests: rekeySitOutRequestUserIds(group.sitOutRequests, legacyUserId, nextUserId)
  });
}

function migrateAuthIdentity(base, nextUserId, email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedUserId = String(nextUserId || "").trim();
  if (!normalizedEmail || !normalizedUserId) return { state: base, profile: null, changed: false };

  const directProfile = base.profiles?.[normalizedUserId] || null;
  if (directProfile) {
    // Profile found — ensure the userId is wired into group memberships so the
    // primary lookup works (legacy groups have empty memberships objects).
    const displayName = directProfile.displayName || "";
    const needsMembership = needsLegacyMembershipBackfill(base.groups, normalizedUserId, displayName);
    if (!needsMembership) return { state: base, profile: directProfile, changed: false };

    const nextGroups = Object.fromEntries(
      Object.entries(base.groups || {}).map(([groupId, group]) => [
        groupId,
        backfillLegacyMembershipForProfile(group, normalizedUserId, displayName)
      ])
    );
    return {
      state: {
        ...base,
        groups: nextGroups,
        meta: { revision: base.meta.revision + 1, updatedAt: new Date().toISOString() }
      },
      profile: directProfile,
      changed: true
    };
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
    Object.entries(base.groups || {}).map(([groupId, group]) => [
      groupId,
      rekeyLegacyAuthIdentityInGroup(group, legacyUserId, normalizedUserId)
    ])
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
    createdAt: resolveStateUpdatedAt(data) || new Date().toISOString(),
    memberOrder: [...DEFAULT_MEMBER_NAMES],
    joinedMonthByName: { ...DEFAULT_JOINED_MONTH_BY_NAME },
    settings: buildNormalizedSettings({ minTarget: DEFAULT_MIN_TARGET, acceptedWorkoutTypes: [...WORKOUT_TYPES], timeZone: DEFAULT_GROUP_TIME_ZONE }),
    logs: data?.logs || {},
    excused: data?.excused || {},
    monthHistory: data?.monthHistory || [],
    lastMonth: data?.lastMonth || null
  });
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

function getCurrentMemberNamesForMonth(group, monthKey) {
  const sourceNames = Array.isArray(group?.activeMemberOrder) && group.activeMemberOrder.length
    ? group.activeMemberOrder
    : (Array.isArray(group?.memberOrder) ? group.memberOrder : []);
  return sourceNames.filter(name => {
    const joinedMonth = getEffectiveJoinedMonthForMember(group, name, monthKey);
    return !joinedMonth || compareMonthKeys(monthKey, joinedMonth) >= 0;
  });
}

function isCurrentGroupMember(group, displayName, authUserId = "") {
  const safeDisplayName = String(displayName || "").trim();
  const safeUserId = String(authUserId || "").trim();
  if (safeUserId) {
    const membership = group?.memberships?.[safeUserId];
    if (membership?.displayName) return membership.displayName === safeDisplayName;
  }
  if (!safeDisplayName) return false;
  const activeNames = Array.isArray(group?.activeMemberOrder) && group.activeMemberOrder.length
    ? group.activeMemberOrder
    : (Array.isArray(group?.memberOrder) ? group.memberOrder : []);
  return activeNames.includes(safeDisplayName);
}

function isGroupDisplayNameForActor(group, displayName, actorUserId = "", actorDisplayName = "") {
  const safeDisplayName = String(displayName || "").trim();
  const safeUserId = String(actorUserId || "").trim();
  const safeActorName = String(actorDisplayName || "").trim();
  if (safeUserId) {
    const membership = group?.memberships?.[safeUserId];
    if (membership?.displayName) return membership.displayName === safeDisplayName;
  }
  return !!safeDisplayName && safeDisplayName === safeActorName;
}

function resolveMembershipDisplayNameByUserId(group, userId, fallbackDisplayName = "") {
  const safeUserId = String(userId || "").trim();
  const safeFallback = String(fallbackDisplayName || "").trim();
  if (!safeUserId) return safeFallback;
  return Object.values(group?.memberships || {})
    .find(membership => membership?.userId === safeUserId)
    ?.displayName || safeFallback;
}

function isGroupAdminActor(group, actorUserId = "", actorDisplayName = "") {
  const safeUserId = String(actorUserId || "").trim();
  const safeDisplayName = String(actorDisplayName || "").trim();
  return group?.adminUserId
    ? group.adminUserId === safeUserId
    : !!group?.adminName && group.adminName === safeDisplayName;
}

function canReviewSitOutRequest(group, request, memberName, actorUserId = "", actorDisplayName = "") {
  const safeUserId = String(actorUserId || "").trim();
  const safeDisplayName = String(actorDisplayName || "").trim();
  if (isGroupAdminActor(group, safeUserId, safeDisplayName)) return true;
  if (request?.targetApproverUserId && request.targetApproverUserId === safeUserId) return true;
  if (request?.targetApproverName && request.targetApproverName === safeDisplayName) return true;
  const deputy = getDeputyAdmin(group);
  return memberName === group?.adminName && !!deputy?.userId && deputy.userId === safeUserId;
}

function updateLegacyLeftMemberNamesForDeparture(leftMemberNames, authUserId, displayName) {
  const safeDisplayName = String(displayName || "").trim();
  if (!safeDisplayName) return uniqueNames(Array.isArray(leftMemberNames) ? leftMemberNames : []);
  if (String(authUserId || "").trim()) {
    return (Array.isArray(leftMemberNames) ? leftMemberNames : [])
      .filter(name => name !== safeDisplayName);
  }
  return uniqueNames([...(Array.isArray(leftMemberNames) ? leftMemberNames : []), safeDisplayName]);
}

function resolveAdminAfterMemberDeparture(group, nextMemberships, departingUserId) {
  if (group.adminUserId !== departingUserId) {
    return {
      adminUserId: group.adminUserId,
      adminName: group.adminName
    };
  }
  const remaining = Object.values(nextMemberships).sort((a, b) => {
    const aTime = Date.parse(a.joinedAt || "") || 0;
    const bTime = Date.parse(b.joinedAt || "") || 0;
    return aTime - bTime;
  });
  const newAdmin = remaining[0];
  return {
    adminUserId: newAdmin.userId,
    adminName: newAdmin.displayName
  };
}

function resolveDeletedAccountDisplayName(profile, groups, userId) {
  if (profile?.displayName) return profile.displayName;
  for (const group of Object.values(groups || {})) {
    const membership = group.memberships?.[userId];
    if (membership?.displayName) return membership.displayName;
  }
  return "";
}

function removeMemberSitOutRequests(sitOutRequests, displayName) {
  const nextSitOutRequests = {};
  for (const [monthKey, monthRequests] of Object.entries(sitOutRequests || {})) {
    const filtered = { ...monthRequests };
    delete filtered[displayName];
    if (Object.keys(filtered).length > 0) nextSitOutRequests[monthKey] = filtered;
  }
  return nextSitOutRequests;
}

function removeLegacyLeftMemberName(leftMemberNames, displayName) {
  const safeDisplayName = String(displayName || "").trim();
  if (!safeDisplayName) return uniqueNames(Array.isArray(leftMemberNames) ? leftMemberNames : []);
  return (Array.isArray(leftMemberNames) ? leftMemberNames : [])
    .filter(name => name !== safeDisplayName);
}

function normalizeGroup(group) {
  const logs = group?.logs && typeof group.logs === "object" ? group.logs : {};
  const monthHistory = Array.isArray(group?.monthHistory) ? group.monthHistory : [];
  const leftMemberNames = new Set(Array.isArray(group?.leftMemberNames) ? group.leftMemberNames : []);
  const rawMemberships = group?.memberships && typeof group.memberships === "object" ? group.memberships : {};
  const inferredMembers = [
    ...(Array.isArray(group?.memberOrder) ? group.memberOrder : []),
    ...Object.keys(logs),
    ...monthHistory.flatMap(month => Object.keys(month?.counts || {})),
    ...monthHistory.flatMap(month => Object.keys(month?.logsByUser || {}))
  ].filter(n => !leftMemberNames.has(n));
  const memberOrder = uniqueNames(inferredMembers);
  const activeMemberOrder = deriveActiveMemberOrder(
    group?.memberOrder,
    rawMemberships,
    group?.adminName,
    leftMemberNames,
    memberOrder
  );
  const memberships = normalizeMemberships(rawMemberships, memberOrder, group?.adminName, group?.adminUserId);
  const joinedMonthByName = pruneJoinedMonthByNameForRead(
    { ...group, memberships, settings: buildNormalizedSettings(group?.settings) },
    group?.joinedMonthByName,
    group?.settings
  );
  const normalizedLogs = Object.fromEntries(
    memberOrder.map(name => [
      name,
      Array.isArray(logs[name]) ? logs[name].map(normalizeLogEntry) : []
    ])
  );
  const normalizedExcused = normalizeExcused(group?.excused, memberOrder);
  const adminUserId = normalizeAdminUserId(group?.adminUserId, memberships, group?.adminName);
  const normalized = {
    id: typeof group?.id === "string" && group.id ? group.id : `group-${Date.now()}`,
    name: typeof group?.name === "string" && group.name.trim() ? group.name.trim() : "Untitled Group",
    adminName: String(group?.adminName || memberOrder[0] || "").trim(),
    adminUserId,
    inviteCode: typeof group?.inviteCode === "string" && group.inviteCode.trim() ? group.inviteCode.trim().toUpperCase() : generateInviteCode(),
    createdAt: group?.createdAt || new Date().toISOString(),
    memberOrder,
    activeMemberOrder,
    memberships,
    joinedMonthByName,
    leftMemberNames: [...leftMemberNames],
    settings: buildNormalizedSettings(group?.settings),
    logs: normalizedLogs,
    excused: normalizedExcused,
    seasonOverrides: normalizeSeasonOverrides(group?.seasonOverrides),
    sitOutRequests: normalizeSitOutRequests(group?.sitOutRequests),
    settlementConfirmationsEnabled: !!group?.settlementConfirmationsEnabled,
    settlementConfirmationsPreviewMode: !!group?.settlementConfirmationsPreviewMode,
    settlementConfirmations: normalizeSettlementConfirmations(group?.settlementConfirmations),
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

function mergeSeasonOverridesPreservingMetadata(blobOverrides, canonicalOverrides) {
  const normalizedBlob = normalizeSeasonOverrides(blobOverrides);
  const normalizedCanonical = normalizeSeasonOverrides(canonicalOverrides);
  return Object.fromEntries(
    uniqueNames([...Object.keys(normalizedBlob), ...Object.keys(normalizedCanonical)])
      .map(monthKey => {
        const blobOverride = normalizedBlob[monthKey] || {};
        const canonicalOverride = normalizedCanonical[monthKey] || null;
        if (!canonicalOverride) return [monthKey, blobOverride];
        return [monthKey, {
          ...blobOverride,
          ...canonicalOverride,
          chosenAt: canonicalOverride.chosenAt || blobOverride.chosenAt || null,
          chosenBy: canonicalOverride.chosenBy || blobOverride.chosenBy || null,
          chosenByUserId: canonicalOverride.chosenByUserId || blobOverride.chosenByUserId || null
        }];
      })
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

function normalizeLoggedWorkoutType(type, logDate = "") {
  const normalized = normalizeWorkoutType(type);
  if (normalized === "Pilates" && typeof logDate === "string" && logDate && logDate < "2026-06-06") {
    return "Other";
  }
  return normalized;
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
    note: typeof log?.note === "string" ? log.note.slice(0, 280) : "",
    photoUrl: shouldKeepLogPhoto(log) ? photoUrl : "",
    createdAt: resolveLogCreatedAt(log),
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

function normalizeMonthHistory(monthHistory, memberOrder, joinedMonthByName, settings) {
  const currentMonthKey = getLeagueMonthKey(settings?.timeZone || DEFAULT_GROUP_TIME_ZONE);
  return monthHistory.map(month => {
    const monthMembershipNames = Object.values(month?.memberships || {}).map(membership => membership?.displayName || "");
    const historicalNames = uniqueNames([
      ...Object.keys(month?.counts || {}),
      ...Object.keys(month?.logsByUser || {}),
      ...Object.keys(month?.excused || {}),
      ...Object.keys(month?.memberTargets || {}),
      ...Object.keys(month?.settlements || {}),
      ...monthMembershipNames
    ]);
    const relevantShellNames = historicalNames.length ? historicalNames : memberOrder;
    const logsByUser = buildMonthLogsSnapshot(month?.logsByUser || {}, relevantShellNames);
    const derivedMonthKey = deriveMonthKeyFromLogs(logsByUser) || month?.key || null;
    if (derivedMonthKey && derivedMonthKey === currentMonthKey) return null;
    const monthKey = derivedMonthKey || month?.key;
    const monthParts = getMonthPartsFromKey(monthKey);
    const relevantNames = relevantShellNames.filter(name => isJoinedForMonth(joinedMonthByName, name, monthKey));
    const counts = Object.fromEntries(relevantNames.map(name => [name, Number(month?.counts?.[name] || getCountedLogCount(logsByUser[name]) || 0)]));
    const excused = Object.fromEntries(relevantNames.map(name => [name, !!month?.excused?.[name]]));
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
      settlements: month?.settlements || buildDefaultSettlements({ counts, excused, key: monthKey }, relevantNames, monthSettings, memberTargets)
    };
  }).filter(Boolean).sort((a, b) => compareMonthKeys(a.key, b.key));
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

function getSeasonOverrideForMonth(group, monthKey) {
  return normalizeSeasonOverrides(group?.seasonOverrides)?.[monthKey] || null;
}

function getSeasonProrationSummaryForMonth(group, monthKey, settingsOverride = null) {
  const override = getSeasonOverrideForMonth(group, monthKey);
  if (!override?.prorated || !Number.isFinite(Number(override?.proratedMas))) return null;
  const timeZone = settingsOverride?.timeZone || group?.settings?.timeZone || DEFAULT_GROUP_TIME_ZONE;
  const chosenSummary = getLeagueMonthSummaryForTimestamp(override?.chosenAt, timeZone);
  if (!chosenSummary || chosenSummary.monthKey !== monthKey) return null;
  return chosenSummary;
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

function pruneJoinedMonthByNameForRead(group, joinedMonthByName, settingsOverride = null) {
  if (!joinedMonthByName || typeof joinedMonthByName !== "object") return {};
  const timeZone = settingsOverride?.timeZone || group?.settings?.timeZone || DEFAULT_GROUP_TIME_ZONE;
  const membershipsByName = new Map(
    Object.values(group?.memberships || {})
      .filter(membership => membership?.displayName)
      .map(membership => [membership.displayName, membership])
  );
  return Object.fromEntries(
    Object.entries(joinedMonthByName).filter(([displayName, explicitJoinedMonth]) => {
      if (!displayName || !explicitJoinedMonth) return false;
      const membership = membershipsByName.get(displayName);
      if (!membership) return true;
      const joinedSummary = getLeagueMonthSummaryForTimestamp(membership.joinedAt, timeZone);
      if (!joinedSummary?.monthKey) return true;
      return joinedSummary.monthKey !== explicitJoinedMonth;
    })
  );
}

function getJoinedTargetInfo(baseTarget, joinedSummary, prorationSummary = null) {
  if (!joinedSummary || joinedSummary.day <= 1) return { target: baseTarget, joinDay: 1, prorationSource: "none" };
  const joinDay = joinedSummary.daysInMonth - joinedSummary.daysRemaining + 1;
  if (!prorationSummary) {
    return {
      target: Math.max(1, Math.round((joinedSummary.daysRemaining / joinedSummary.daysInMonth) * baseTarget)),
      joinDay,
      proratedDays: joinedSummary.daysRemaining,
      prorationSource: "member"
    };
  }
  if (joinedSummary.day <= prorationSummary.day) {
    return {
      target: baseTarget,
      joinDay: prorationSummary.day,
      proratedDays: prorationSummary.daysRemaining,
      prorationSource: "member"
    };
  }
  return {
    target: Math.max(1, Math.round((joinedSummary.daysRemaining / prorationSummary.daysRemaining) * baseTarget)),
    joinDay,
    proratedDays: joinedSummary.daysRemaining,
    prorationSource: "member"
  };
}

function getEffectiveTargetForMonth(group, monthKey, settingsOverride = null) {
  const baseTarget = Number(settingsOverride?.minTarget || group?.settings?.minTarget || DEFAULT_MIN_TARGET);
  const override = getSeasonOverrideForMonth(group, monthKey);
  return override?.prorated && Number.isFinite(Number(override?.proratedMas))
    ? Math.max(1, Math.round(Number(override.proratedMas)))
    : baseTarget;
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

function getMemberTargetsForMonth(group, relevantNames, monthKey, settingsOverride = null) {
  return Object.fromEntries(
    relevantNames.map(name => [name, getMemberTargetForMonth(group, name, monthKey, settingsOverride)])
  );
}

function buildCanonicalMonthHistoryForGroup(group, canonicalSeasons) {
  if (!Array.isArray(canonicalSeasons) || canonicalSeasons.length === 0) {
    return Array.isArray(group?.monthHistory) ? group.monthHistory : [];
  }

  const blobMonthsByKey = Object.fromEntries(
    (group.monthHistory || []).map(m => [m.key, m])
  );
  const canonicalMonths = {};

  for (const season of canonicalSeasons) {
    const monthKey = season.monthKey;
    if (!monthKey) continue;

    const blobMonth = blobMonthsByKey[monthKey];
    const membersByName = {};
    for (const m of season.members || []) {
      if (m?.display_name) membersByName[m.display_name] = m;
    }

    const blobCoverage = uniqueNames([
      ...Object.keys(blobMonth?.counts || {}),
      ...Object.keys(blobMonth?.logsByUser || {}).filter(name => ((blobMonth?.logsByUser || {})[name] || []).length > 0),
      ...Object.keys(blobMonth?.excused || {}).filter(name => !!blobMonth?.excused?.[name]),
      ...Object.keys(blobMonth?.settlements || {}),
      ...Object.keys(blobMonth?.memberTargets || {})
    ]).length;
    const canonicalCoverage = uniqueNames([
      ...Object.keys(membersByName),
      ...(season.logs || []).map(log => log?.owner_display_name).filter(Boolean)
    ]).length;
    if (canonicalCoverage < blobCoverage) continue;

    const historicalMemberNames = uniqueNames([
      ...Object.keys(blobMonth?.counts || {}),
      ...Object.keys(blobMonth?.logsByUser || {}),
      ...Object.keys(blobMonth?.settlements || {}),
      ...Object.keys(blobMonth?.memberTargets || {}),
      ...Object.keys(membersByName),
      ...(season.logs || []).map(log => log?.owner_display_name).filter(Boolean)
    ]);

    const canonicalSettings = buildNormalizedSettings({
      minTarget:            season.minTarget,
      fineAmount:           season.fineAmount,
      feeModel:             season.feeModel,
      escalationStepAmount: season.escalationStepAmount,
      currency:             season.currency,
      minRunDistance:       season.minRunDistance,
      distanceUnit:         season.distanceUnit,
      stravaEnabled:        season.stravaEnabled,
      timeZone:             season.timeZone,
      acceptedWorkoutTypes: season.acceptedWorkoutTypes
    });
    const relevantNames = historicalMemberNames.filter(
      name => membersByName[name]?.joined_for_month !== false
    );

    const counts = {};
    const excused = {};
    const memberAuthUserIds = {};
    for (const name of relevantNames) {
      const m = membersByName[name];
      counts[name] = m ? m.workout_count : 0;
      excused[name] = m ? !!m.excused : false;
      if (m?.auth_user_id) memberAuthUserIds[name] = m.auth_user_id;
    }

    const logsByUser = Object.fromEntries(historicalMemberNames.map(name => [name, []]));
    for (const log of season.logs || []) {
      const owner = log.owner_display_name;
      if (!logsByUser[owner]) continue;
      logsByUser[owner].push(normalizeLogEntry({
        id:           log.id,
        type:         log.workout_type,
        date:         log.workout_date,
        note:         log.note,
        photoUrl:     "",
        createdAt:    log.created_at,
        verifiedVia:  log.verified_via,
        flagStatus:   log.flag_status   || null,
        flagReason:   log.flag_reason   || "",
        flagResponse: log.flag_response || "",
        flaggedBy:    log.flagged_by    || null,
        decisionBy:   log.decision_by   || null,
        decisionAt:   log.decision_at   || null,
        reactions:    log.reactions     || {}
      }));
    }

    const settlements = {};
    for (const name of relevantNames) {
      const m = membersByName[name];
      if (m?.settlement_status) {
        settlements[name] = {
          status:    m.settlement_status,
          settledAt: m.settlement_settled_at || null,
          updatedAt: m.settlement_updated_at || null
        };
      }
    }

    canonicalMonths[monthKey] = {
      key:          monthKey,
      label:        season.label,
      year:         season.year,
      month:        season.monthIndex,
      counts,
      excused,
      memberAuthUserIds,
      logsByUser,
      settings:     canonicalSettings,
      settlements,
      memberTargets: getMemberTargetsForMonth(group, relevantNames, monthKey, canonicalSettings)
    };
  }

  return Object.values({ ...blobMonthsByKey, ...canonicalMonths })
    .sort((a, b) => compareMonthKeys(a.key, b.key));
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

function hasParticipationBeforeMonth(group, displayName, monthKey) {
  if (!group || !displayName || !monthKey) return false;
  const currentMonthLogs = Array.isArray(group?.logs?.[displayName]) ? group.logs[displayName] : [];
  if (currentMonthLogs.some(log => {
    const logMonthKey = getMonthKeyFromISO(log?.date);
    return logMonthKey && compareMonthKeys(logMonthKey, monthKey) < 0;
  })) return true;
  return (group?.monthHistory || []).some(month => {
    if (!month?.key || compareMonthKeys(month.key, monthKey) >= 0) return false;
    if ((month?.counts?.[displayName] || 0) > 0) return true;
    if ((month?.logsByUser?.[displayName] || []).length > 0) return true;
    if (month?.excused?.[displayName]) return true;
    if (month?.settlements?.[displayName]) return true;
    if (Object.prototype.hasOwnProperty.call(month?.memberTargets || {}, displayName)) return true;
    return false;
  });
}

function shouldInferJoinedMonthFromMembership(group, displayName, monthKey, membership, settingsOverride = null) {
  if (!membership?.joinedAt) return false;
  const timeZone = settingsOverride?.timeZone || group?.settings?.timeZone || DEFAULT_GROUP_TIME_ZONE;
  const joinedSummary = getLeagueMonthSummaryForTimestamp(membership.joinedAt, timeZone);
  if (!joinedSummary || joinedSummary.monthKey !== monthKey) return false;
  return !hasParticipationBeforeMonth(group, displayName, monthKey);
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
  const losers = activeCounts.filter(user => user.count < (Number(user?.target) || minTarget) && user.count < topCount);
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

function buildDefaultSettlements(month, relevantNames, settings, memberTargets = {}) {
  const activeCounts = relevantNames
    .filter(name => !(month.excused?.[name]))
    .map(name => ({ name, count: month.counts?.[name] || 0, target: memberTargets?.[name] || Number(settings?.minTarget || DEFAULT_MIN_TARGET) }));
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

function scrubDepartedMemberFromCurrentLogs(logsByName, departedDisplayName, options = {}) {
  const departedName = String(departedDisplayName || "").trim();
  if (!departedName) return logsByName && typeof logsByName === "object" ? { ...logsByName } : {};

  const {
    removeOwnedLogs = false
  } = options;

  const nextLogs = {};
  for (const [owner, ownerLogs] of Object.entries(logsByName || {})) {
    if (removeOwnedLogs && owner === departedName) continue;
    nextLogs[owner] = (Array.isArray(ownerLogs) ? ownerLogs : []).map(log => {
      const nextReactions = {};
      for (const [emoji, reactors] of Object.entries(log?.reactions || {})) {
        const filtered = (Array.isArray(reactors) ? reactors : []).filter(name => name !== departedName);
        if (filtered.length > 0) nextReactions[emoji] = filtered;
      }
      if (log?.flagStatus === "flagged" && log?.flaggedBy === departedName) {
        return {
          ...log,
          reactions: nextReactions,
          flaggedBy: null,
          flagReason: "",
          flagResponse: "",
          flagStatus: null,
          decisionBy: null,
          decisionAt: null
        };
      }
      return {
        ...log,
        reactions: nextReactions
      };
    });
  }
  return nextLogs;
}

function scrubCurrentLogsAgainstAllowedMembers(logsByName, allowedDisplayNames) {
  const allowedNames = new Set(uniqueNames(Array.isArray(allowedDisplayNames) ? allowedDisplayNames : []));
  const nextLogs = {};
  for (const [owner, ownerLogs] of Object.entries(logsByName || {})) {
    if (!allowedNames.has(owner)) continue;
    nextLogs[owner] = (Array.isArray(ownerLogs) ? ownerLogs : []).map(log => {
      const nextReactions = {};
      for (const [emoji, reactors] of Object.entries(log?.reactions || {})) {
        const filtered = (Array.isArray(reactors) ? reactors : []).filter(name => allowedNames.has(name));
        if (filtered.length > 0) nextReactions[emoji] = filtered;
      }
      if (log?.flagStatus === "flagged" && log?.flaggedBy && !allowedNames.has(log.flaggedBy)) {
        return {
          ...log,
          reactions: nextReactions,
          flaggedBy: null,
          flagReason: "",
          flagResponse: "",
          flagStatus: null,
          decisionBy: null,
          decisionAt: null
        };
      }
      return {
        ...log,
        reactions: nextReactions
      };
    });
  }
  return nextLogs;
}

function rebuildMonthSnapshot(group, month, logsByUser) {
  const monthKey = month?.key;
  const relevantNames = getCurrentMemberNamesForMonth(group, monthKey);
  const nextLogsByUser = buildMonthLogsSnapshot(logsByUser, relevantNames);
  const counts = Object.fromEntries(
    relevantNames.map(name => [name, getCountedLogCount(nextLogsByUser[name])])
  );
  const excused = month?.excused || Object.fromEntries(relevantNames.map(name => [name, false]));
  const settings = buildNormalizedSettings(month?.settings || group.settings);
  const memberTargets = getMemberTargetsForMonth(group, relevantNames, monthKey, settings);
  const defaultSettlements = buildDefaultSettlements({ counts, excused }, relevantNames, settings, memberTargets);
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

function rolloverGroupIfNeeded(group) {
  const expectedKey = getLeagueMonthKey(group?.settings?.timeZone);
  if (!group.lastMonth || group.lastMonth === expectedKey) return group;

  const [ly, lm] = group.lastMonth.split("-").map(Number);
  const [cy, cm] = expectedKey.split("-").map(Number);
  const lastDate = new Date(ly, lm, 1);
  const curDate = new Date(cy, cm, 1);
  if (lastDate >= curDate) return group;

  const label = `${MONTH_NAMES[lm]} '${String(ly).slice(2)}`;
  const relevantNames = getCurrentMemberNamesForMonth(group, group.lastMonth);
  const counts = Object.fromEntries(
    relevantNames.map(name => [name, getCountedLogCount(group.logs?.[name] || [])])
  );
  const excused = Object.fromEntries(
    relevantNames.map(name => [name, group.excused?.[name]?.[group.lastMonth] || false])
  );
  const memberTargets = getMemberTargetsForMonth(group, relevantNames, group.lastMonth, group.settings);
  const snapshot = {
    key: group.lastMonth,
    label,
    year: ly,
    month: lm,
    counts,
    excused,
    logsByUser: buildMonthLogsSnapshot(group.logs, relevantNames),
    memberTargets,
    settings: buildNormalizedSettings(group.settings),
    settlements: buildDefaultSettlements({ counts, excused }, relevantNames, group.settings, memberTargets)
  };

  return normalizeGroup({
    ...group,
    logs: {},
    excused: {},
    monthHistory: [...group.monthHistory, snapshot],
    lastMonth: expectedKey
  });
}

function rolloverStateIfNeeded(data, options = {}) {
  const base = normalizeState(data, options);
  let changed = false;
  const groups = {};
  const rollovers = [];
  const rolledAt = new Date().toISOString();
  for (const [groupId, group] of Object.entries(base.groups)) {
    const nextGroup = rolloverGroupIfNeeded(group);
    groups[groupId] = nextGroup;
    if (JSON.stringify(nextGroup) !== JSON.stringify(group)) {
      changed = true;
      // Record which month closed and which opened so persistState can
      // fire the canonical season syncs without re-deriving this info.
      rollovers.push({
        groupId,
        closedMonthKey: group.lastMonth,
        newMonthKey:    nextGroup.lastMonth,
        closedAt:       rolledAt
      });
    }
  }

  if (!changed) return base;

  // _rollovers is ephemeral metadata — normalizeState strips it before the
  // blob write, so it never reaches the database. persistState reads it first.
  return {
    ...base,
    groups,
    meta: {
      revision: base.meta.revision + 1,
      updatedAt: rolledAt
    },
    _rollovers: rollovers
  };
}

async function syncProfileToCanonical(userId, email, displayName, options = {}) {
  const { throwOnError = false } = options;
  try {
    await supabaseFetch("/rest/v1/rpc/upsert_ante_core_profile", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        p_auth_user_id: userId,
        p_email:        email,
        p_display_name: displayName
      })
    });
  } catch (err) {
    if (throwOnError) throw err;
    console.error("Canonical profile sync failed:", err?.message || err);
  }
}

async function deleteProfileFromCanonical(userId, options = {}) {
  const { throwOnError = false } = options;
  try {
    await supabaseFetch("/rest/v1/rpc/delete_ante_core_profile", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ p_auth_user_id: userId })
    });
  } catch (err) {
    if (throwOnError) throw err;
    console.error("Canonical profile delete failed:", err?.message || err);
  }
}

async function syncSeasonToCanonical(group, monthKey, status, closedAt = null, options = {}) {
  const { throwOnError = false } = options;
  if (!group || !monthKey) return;
  const parts = getMonthPartsFromKey(monthKey);
  if (!parts) return;
  const { year, monthIndex } = parts;
  const label = formatMonthLabelFromKey(monthKey);
  if (!label) return;
  // month_start: first day of the month as a date string (YYYY-MM-DD)
  const monthStart = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  try {
    await supabaseFetch("/rest/v1/rpc/upsert_ante_core_season", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        p_legacy_group_key:       group.id,
        p_month_key:              monthKey,
        p_month_start:            monthStart,
        p_label:                  label,
        p_year:                   year,
        p_month_index:            monthIndex,
        p_status:                 status,
        p_closed_at:              closedAt || null,
        p_min_target:             group.settings?.minTarget      ?? null,
        p_fine_amount:            group.settings?.fineAmount     ?? null,
        p_fee_model:              group.settings?.feeModel       ?? null,
        p_escalation_step_amount: group.settings?.escalationStepAmount ?? null,
        p_currency:               group.settings?.currency       ?? null,
        p_min_run_distance:       group.settings?.minRunDistance  ?? null,
        p_distance_unit:          group.settings?.distanceUnit   ?? null,
        p_time_zone:              group.settings?.timeZone       ?? DEFAULT_GROUP_TIME_ZONE,
        p_strava_enabled:         group.settings?.stravaEnabled  ?? true,
        p_accepted_workout_types: group.settings?.acceptedWorkoutTypes ?? []
      })
    });
  } catch (err) {
    if (throwOnError) throw err;
    // Silently skip if bloc not yet in canonical (legacy groups pre-dating blocs slice).
    // All other errors are logged.
    if (!/bloc not found/i.test(err?.message || "")) {
      console.error("Canonical season sync failed:", err?.message || err);
    }
  }
}

async function syncBlocToCanonical(group, adminUserId, sortOrder, options = {}) {
  const { throwOnError = false } = options;
  if (!group) return;
  try {
    await supabaseFetch("/rest/v1/rpc/upsert_ante_core_bloc", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        p_legacy_group_key:       group.id,
        p_name:                   group.name,
        p_admin_auth_user_id:     adminUserId || group.adminUserId || null,
        p_invite_code:            group.inviteCode,
        p_time_zone:              group.settings?.timeZone       ?? null,
        p_currency:               group.settings?.currency       ?? null,
        p_min_target:             group.settings?.minTarget      ?? null,
        p_fine_amount:            group.settings?.fineAmount     ?? null,
        p_fee_model:              group.settings?.feeModel       ?? null,
        p_escalation_step_amount: group.settings?.escalationStepAmount ?? null,
        p_min_run_distance:       group.settings?.minRunDistance  ?? null,
        p_distance_unit:          group.settings?.distanceUnit   ?? null,
        p_strava_enabled:         group.settings?.stravaEnabled  ?? true,
        p_accepted_workout_types: group.settings?.acceptedWorkoutTypes ?? [],
        p_sort_order:             typeof sortOrder === "number" ? sortOrder : null
      })
    });
  } catch (err) {
    if (throwOnError) throw err;
    console.error("Canonical bloc sync failed:", err?.message || err);
  }
}

async function syncBlocMemberToCanonical(group, authUserId, role, options = {}) {
  const { throwOnError = false } = options;
  if (!group || !authUserId) return;
  const membership = group.memberships?.[authUserId];
  const displayName = membership?.displayName;
  // No-op if the membership has no displayName — profile-less or legacy member.
  if (!displayName) return;
  const joinedAt       = membership?.joinedAt || null;
  const joinedMonthKey = group.joinedMonthByName?.[displayName] || null;
  const sortOrderIdx   = (group.memberOrder || []).indexOf(displayName);
  try {
    await supabaseFetch("/rest/v1/rpc/upsert_ante_core_bloc_member", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        p_legacy_group_key: group.id,
        p_auth_user_id:     authUserId,
        p_display_name:     displayName,
        p_role:             role,
        p_joined_at:        joinedAt,
        p_joined_month_key: joinedMonthKey,
        p_sort_order:       sortOrderIdx >= 0 ? sortOrderIdx : null
      })
    });
  } catch (err) {
    if (throwOnError) throw err;
    console.error("Canonical bloc member sync failed:", err?.message || err);
  }
}

async function repairDisplayNameSnapshotsInCanonical(legacyGroupKey, authUserId, oldDisplayName, newDisplayName, options = {}) {
  const { throwOnError = false } = options;
  if (!legacyGroupKey || !authUserId || !oldDisplayName || !newDisplayName || oldDisplayName === newDisplayName) return;
  try {
    await supabaseFetch("/rest/v1/rpc/repair_ante_core_display_name_snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        p_legacy_group_key: legacyGroupKey,
        p_auth_user_id: authUserId,
        p_old_display_name: oldDisplayName,
        p_new_display_name: newDisplayName
      })
    });
  } catch (err) {
    if (throwOnError) throw err;
    console.error("Canonical display-name repair failed:", err?.message || err);
  }
}

async function removeBlocMemberFromCanonical(legacyGroupKey, authUserId, options = {}) {
  const { throwOnError = false } = options;
  if (!legacyGroupKey || !authUserId) return;
  try {
    await supabaseFetch("/rest/v1/rpc/remove_ante_core_bloc_member", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        p_legacy_group_key: legacyGroupKey,
        p_auth_user_id:     authUserId
      })
    });
  } catch (err) {
    if (throwOnError) throw err;
    console.error("Canonical bloc member remove failed:", err?.message || err);
  }
}

async function deleteBlocFromCanonical(legacyGroupKey, options = {}) {
  const { throwOnError = false } = options;
  if (!legacyGroupKey) return;
  try {
    await supabaseFetch("/rest/v1/rpc/delete_ante_core_bloc", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        p_legacy_group_key: legacyGroupKey
      })
    });
  } catch (err) {
    if (throwOnError) throw err;
    console.error("Canonical bloc delete failed:", err?.message || err);
  }
}

async function updateBlocAdminInCanonical(legacyGroupKey, newAdminAuthUserId, options = {}) {
  const { throwOnError = false } = options;
  if (!legacyGroupKey || !newAdminAuthUserId) return;
  try {
    await supabaseFetch("/rest/v1/rpc/update_ante_core_bloc_admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        p_legacy_group_key:       legacyGroupKey,
        p_new_admin_auth_user_id: newAdminAuthUserId
      })
    });
  } catch (err) {
    if (throwOnError) throw err;
    console.error("Canonical bloc admin transfer failed:", err?.message || err);
  }
}

async function upsertSeasonMemberStatusToCanonical(group, closedMonthKey, displayName, authUserId, workoutCount, excused, options = {}) {
  const { throwOnError = false } = options;
  if (!group || !closedMonthKey || !displayName) return;
  try {
    await supabaseFetch("/rest/v1/rpc/upsert_ante_core_season_member_status", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        p_legacy_group_key: group.id,
        p_month_key:        closedMonthKey,
        p_display_name:     displayName,
        p_auth_user_id:     authUserId || null,
        p_workout_count:    workoutCount,
        p_excused:          excused,
        p_joined_for_month: true
      })
    });
  } catch (err) {
    if (throwOnError) throw err;
    console.error("Canonical season member status sync failed:", err?.message || err);
  }
}

async function seedOpenSeasonMemberStatusInCanonical(group, monthKey, displayName, authUserId, options = {}) {
  if (!group || !monthKey || !displayName) return;
  await upsertSeasonMemberStatusToCanonical(
    group,
    monthKey,
    displayName,
    authUserId || null,
    0,
    false,
    options
  );
}

async function updateSeasonMemberSettlementInCanonical(legacyGroupKey, monthKey, displayName, status, settledAt, options = {}) {
  if (!legacyGroupKey || !monthKey || !displayName || !status) return;
  const { throwOnError = false } = options;
  try {
    await supabaseFetch("/rest/v1/rpc/update_ante_core_season_member_settlement", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        p_legacy_group_key: legacyGroupKey,
        p_month_key:        monthKey,
        p_display_name:     displayName,
        p_status:           status,
        p_settled_at:       settledAt || null
      })
    });
  } catch (err) {
    if (throwOnError) throw err;
    console.error("Canonical settlement sync failed:", err?.message || err);
  }
}

function resolveSettlementConfirmationParticipants(group, payerDisplayName, receiverDisplayName) {
  if (!group || !payerDisplayName || !receiverDisplayName) return null;
  const memberships = Object.values(group.memberships || {});
  const payerMembership = memberships.find(membership => membership?.displayName === payerDisplayName) || null;
  const receiverMembership = memberships.find(membership => membership?.displayName === receiverDisplayName) || null;
  return {
    payerMembership,
    receiverMembership
  };
}

async function claimSettlementConfirmationInCanonical({
  legacyGroupKey,
  monthKey,
  payerAuthUserId,
  payerDisplayName,
  receiverAuthUserId,
  receiverDisplayName,
  amount,
  currency
}) {
  if (!legacyGroupKey || !monthKey || !payerAuthUserId || !receiverAuthUserId || !payerDisplayName || !receiverDisplayName) return;
  await supabaseFetch("/rest/v1/rpc/claim_ante_core_settlement_confirmation", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      p_legacy_group_key: legacyGroupKey,
      p_month_key: monthKey,
      p_payer_auth_user_id: payerAuthUserId,
      p_payer_display_name: payerDisplayName,
      p_receiver_auth_user_id: receiverAuthUserId,
      p_receiver_display_name: receiverDisplayName,
      p_amount: amount,
      p_currency: currency
    })
  });
}

async function confirmSettlementConfirmationInCanonical({
  legacyGroupKey,
  monthKey,
  payerAuthUserId,
  receiverAuthUserId
}) {
  if (!legacyGroupKey || !monthKey || !payerAuthUserId || !receiverAuthUserId) return;
  await supabaseFetch("/rest/v1/rpc/confirm_ante_core_settlement_confirmation", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      p_legacy_group_key: legacyGroupKey,
      p_month_key: monthKey,
      p_payer_auth_user_id: payerAuthUserId,
      p_receiver_auth_user_id: receiverAuthUserId
    })
  });
}

async function disputeSettlementConfirmationInCanonical({
  legacyGroupKey,
  monthKey,
  payerAuthUserId,
  receiverAuthUserId
}) {
  if (!legacyGroupKey || !monthKey || !payerAuthUserId || !receiverAuthUserId) return;
  await supabaseFetch("/rest/v1/rpc/dispute_ante_core_settlement_confirmation", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      p_legacy_group_key: legacyGroupKey,
      p_month_key: monthKey,
      p_payer_auth_user_id: payerAuthUserId,
      p_receiver_auth_user_id: receiverAuthUserId
    })
  });
}

async function ensureSettlementConfirmationPrereqs(state, groupId, monthKey, payerDisplayName, receiverDisplayName) {
  const group = state?.groups?.[groupId];
  if (!group || !monthKey || !payerDisplayName || !receiverDisplayName) return null;
  const participants = resolveSettlementConfirmationParticipants(group, payerDisplayName, receiverDisplayName);
  if (!participants?.payerMembership?.userId || !participants?.receiverMembership?.userId) return participants || null;

  const groupSortOrder = Array.isArray(state?.groupOrder) ? state.groupOrder.indexOf(groupId) : -1;
  await syncBlocToCanonical(group, group.adminUserId || null, groupSortOrder >= 0 ? groupSortOrder : null, { throwOnError: true });

  const payerProfile = state?.profiles?.[participants.payerMembership.userId] || null;
  const receiverProfile = state?.profiles?.[participants.receiverMembership.userId] || null;

  if (payerProfile?.email && payerProfile?.displayName) {
    await syncProfileToCanonical(participants.payerMembership.userId, payerProfile.email, payerProfile.displayName, { throwOnError: true });
  }
  if (receiverProfile?.email && receiverProfile?.displayName) {
    await syncProfileToCanonical(participants.receiverMembership.userId, receiverProfile.email, receiverProfile.displayName, { throwOnError: true });
  }

  await syncBlocMemberToCanonical(
    group,
    participants.payerMembership.userId,
    group.adminUserId === participants.payerMembership.userId ? "admin" : "member",
    { throwOnError: true }
  );
  await syncBlocMemberToCanonical(
    group,
    participants.receiverMembership.userId,
    group.adminUserId === participants.receiverMembership.userId ? "admin" : "member",
    { throwOnError: true }
  );

  const closedMonth = (group.monthHistory || []).find(month => month?.key === monthKey) || null;
  await syncSeasonToCanonical(group, monthKey, closedMonth ? "closed" : "open", closedMonth?.closedAt || null, { throwOnError: true });

  return participants;
}

async function upsertSeasonMemberExcusedInCanonical(legacyGroupKey, monthKey, displayName, authUserId, options = {}) {
  if (!legacyGroupKey || !monthKey || !displayName) return;
  const { throwOnError = false } = options;
  try {
    await supabaseFetch("/rest/v1/rpc/upsert_ante_core_season_member_excused", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        p_legacy_group_key: legacyGroupKey,
        p_month_key:        monthKey,
        p_display_name:     displayName,
        p_auth_user_id:     authUserId || null
      })
    });
  } catch (err) {
    if (throwOnError) throw err;
    console.error("Canonical excused sync failed:", err?.message || err);
  }
}

async function upsertSeasonOverrideInCanonical(legacyGroupKey, monthKey, prorated, proratedMas, chosenAt, chosenBy, chosenByUserId, options = {}) {
  if (!legacyGroupKey || !monthKey) return;
  const { throwOnError = false } = options;
  try {
    await supabaseFetch("/rest/v1/rpc/upsert_ante_core_season_override", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        p_legacy_group_key:   legacyGroupKey,
        p_month_key:          monthKey,
        p_prorated:           !!prorated,
        p_prorated_mas:       proratedMas ?? null,
        p_chosen_at:          chosenAt   || null,
        p_chosen_by:          chosenBy   || null,
        p_chosen_by_user_id:  chosenByUserId || null
      })
    });
  } catch (err) {
    if (throwOnError) throw err;
    console.error("Canonical season override sync failed:", err?.message || err);
  }
}

async function upsertSitOutRequestInCanonical(legacyGroupKey, monthKey, memberName, request, options = {}) {
  // memberName is passed explicitly from the blob map key — do not rely on request.memberName.
  if (!legacyGroupKey || !monthKey || !memberName) return;
  const { throwOnError = false } = options;
  try {
    await supabaseFetch("/rest/v1/rpc/upsert_ante_core_sit_out_request", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        p_legacy_group_key:        legacyGroupKey,
        p_month_key:               monthKey,
        p_display_name:            memberName,
        p_requested_by_user_id:    request?.requestedByUserId    || null,
        p_status:                  request?.status               || "pending",
        p_reason:                  request?.reason               || "",
        p_exceptional:             !!request?.exceptional,
        p_requested_at:            request?.requestedAt          || null,
        p_requested_by:            request?.requestedBy          || null,
        p_target_approver_name:    request?.targetApproverName   || null,
        p_target_approver_user_id: request?.targetApproverUserId || null,
        p_decided_at:              request?.decidedAt            || null,
        p_decided_by:              request?.decidedBy            || null,
        p_decided_by_user_id:      request?.decidedByUserId      || null,
        p_auto_approved:           !!request?.autoApproved
      })
    });
  } catch (err) {
    if (throwOnError) throw err;
    console.error("Canonical sit-out request sync failed:", err?.message || err);
  }
}

async function toggleWorkoutReactionInCanonical(logId, reactorAuthUserId, reactorDisplayName, emoji, isAdding, options = {}) {
  const { throwOnError = false } = options;
  if (!logId || !reactorDisplayName || !emoji) return;
  const rpc = isAdding
    ? "/rest/v1/rpc/upsert_ante_core_workout_reaction"
    : "/rest/v1/rpc/delete_ante_core_workout_reaction";
  try {
    await supabaseFetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(isAdding
        ? { p_workout_log_id: String(logId), p_reactor_auth_user_id: reactorAuthUserId || null,
            p_reactor_display_name: reactorDisplayName, p_emoji: emoji }
        : { p_workout_log_id: String(logId), p_reactor_display_name: reactorDisplayName, p_emoji: emoji }
      )
    });
  } catch (err) {
    if (throwOnError) throw err;
    console.error("Canonical workout reaction sync failed:", err?.message || err);
  }
}

async function upsertWorkoutLogToCanonical(group, monthKey, ownerDisplayName, ownerAuthUserId, log, options = {}) {
  const { throwOnError = false } = options;
  if (!group || !monthKey || !ownerDisplayName || !log?.id || !log?.date || !log?.type || !log?.createdAt || !log?.verifiedVia) return;
  try {
    await supabaseFetch("/rest/v1/rpc/upsert_ante_core_workout_log", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        p_id:                 String(log.id),
        p_legacy_group_key:   group.id,
        p_month_key:          monthKey,
        p_owner_display_name: ownerDisplayName,
        p_owner_auth_user_id: ownerAuthUserId || null,
        p_workout_date:       log.date,
        p_workout_type:       log.type,
        p_note:               log.note || "",
        p_photo_url:          log.photoUrl || "",
        p_created_at:         log.createdAt,
        p_verified_via:       log.verifiedVia,
        p_flag_status:        log.flagStatus,
        p_flag_reason:        log.flagReason || "",
        p_flag_response:      log.flagResponse || "",
        p_flagged_by:         log.flaggedBy || null,
        p_decision_by:        log.decisionBy || null,
        p_decision_at:        log.decisionAt || null
      })
    });
  } catch (err) {
    if (throwOnError) throw err;
    console.error("Canonical workout log sync failed:", err?.message || err);
  }
}

async function syncOpenWorkoutLogSnapshotToCanonical(group, ownerDisplayName, log, options = {}) {
  if (!group || !log) return;
  await syncSeasonToCanonical(group, group.lastMonth, "open", null, options);
  await upsertWorkoutLogToCanonical(
    group,
    group.lastMonth,
    ownerDisplayName,
    findAuthUserIdForDisplayName(group, ownerDisplayName),
    log,
    options
  );
}

async function deleteWorkoutLogFromCanonical(logId, options = {}) {
  const { throwOnError = false } = options;
  if (!logId) return;
  try {
    await supabaseFetch("/rest/v1/rpc/delete_ante_core_workout_log", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ p_id: String(logId) })
    });
  } catch (err) {
    if (throwOnError) throw err;
    console.error("Canonical workout log delete failed:", err?.message || err);
  }
}

function findAuthUserIdForDisplayName(group, displayName) {
  if (!group || !displayName) return null;
  for (const [userId, membership] of Object.entries(group.memberships || {})) {
    if (membership?.displayName === displayName) return userId;
  }
  return null;
}

async function fetchBlobRevision() {
  try {
    const response = await supabaseFetch("/rest/v1/lift_log_state?id=eq.true&select=revision", {
      method: "GET",
      headers: { Accept: "application/json" }
    });
    const rows = await response.json();
    const revision = Number(rows?.[0]?.revision);
    return Number.isFinite(revision) ? revision : null;
  } catch {
    return null;
  }
}

async function fetchAnteBlocs() {
  try {
    const response = await supabaseFetch("/rest/v1/rpc/read_ante_core_blocs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({})
    });
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    // Return a map keyed by legacy_group_key for O(1) lookup in the overlay.
    return Object.fromEntries(rows.map(row => [row.legacy_group_key, row]));
  } catch {
    return null;
  }
}

async function fetchCanonicalBlocByInviteCode(inviteCode) {
  const normalizedInviteCode = String(inviteCode || "").trim().toUpperCase();
  if (!normalizedInviteCode) return null;
  const anteBlocs = await fetchAnteBlocs();
  if (!anteBlocs) return null;
  return Object.values(anteBlocs).find(row =>
    String(row?.invite_code || "").trim().toUpperCase() === normalizedInviteCode
  ) || null;
}

async function fetchAnteSeasonOverrides() {
  try {
    const response = await supabaseFetch("/rest/v1/rpc/read_ante_core_season_overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({})
    });
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows.reduce((acc, row) => {
      const legacyGroupKey = typeof row?.legacy_group_key === "string" ? row.legacy_group_key : "";
      const monthKey = typeof row?.month_key === "string" ? row.month_key : "";
      if (!legacyGroupKey || !monthKey) return acc;
      if (!acc[legacyGroupKey]) acc[legacyGroupKey] = {};
      acc[legacyGroupKey][monthKey] = {
        prorated: !!row?.prorated,
        proratedMas: row?.prorated_mas ?? null,
        chosenAt: row?.chosen_at || null,
        chosenBy: row?.chosen_by || null,
        chosenByUserId: row?.chosen_by_user_id || null
      };
      return acc;
    }, {});
  } catch {
    return null;
  }
}

async function fetchAnteProfiles() {
  try {
    const response = await supabaseFetch("/rest/v1/rpc/read_ante_core_profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({})
    });
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const raw = Object.fromEntries(
      rows.map(row => [row.user_id, {
        id:          row.user_id,
        email:       row.email,
        displayName: row.display_name,
        createdAt:   row.created_at
      }])
    );
    const normalized = normalizeProfiles(raw);
    return Object.keys(normalized).length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

async function fetchAnteBlocMembers() {
  try {
    const response = await supabaseFetch("/rest/v1/rpc/read_ante_core_bloc_members", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({})
    });
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    // Group by legacy_group_key for O(1) lookup in the overlay.
    return rows.reduce((acc, row) => {
      const key = typeof row?.legacy_group_key === "string" ? row.legacy_group_key : "";
      if (!key || !row?.auth_user_id) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});
  } catch {
    return null;
  }
}

async function fetchAnteCurrentLogs() {
  try {
    const response = await supabaseFetch("/rest/v1/rpc/read_ante_core_current_logs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({})
    });
    const rows = await response.json();
    if (!Array.isArray(rows)) return null;
    // Group rows by legacy_group_key. Each row retains ownerDisplayName so the
    // overlay can index by name when building the per-member logs map.
    return rows.reduce((acc, row) => {
      const key = typeof row?.legacy_group_key === "string" ? row.legacy_group_key : "";
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        ownerDisplayName: row.owner_display_name,
        id:               row.id,
        type:             row.workout_type,
        date:             row.workout_date,
        note:             row.note,
        photoUrl:         row.photo_url,
        createdAt:        row.created_at,
        verifiedVia:      row.verified_via,
        flagStatus:       row.flag_status   || null,
        flagReason:       row.flag_reason   || "",
        flagResponse:     row.flag_response || "",
        flaggedBy:        row.flagged_by    || null,
        decisionBy:       row.decision_by   || null,
        decisionAt:       row.decision_at   || null,
        reactions:        row.reactions     || {}
      });
      return acc;
    }, {});
  } catch {
    return null;
  }
}

async function fetchAnteMonthHistory() {
  try {
    const response = await supabaseFetch("/rest/v1/rpc/read_ante_core_month_history", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({})
    });
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    // Group closed-season entries by legacy_group_key.
    return rows.reduce((acc, row) => {
      const key = typeof row?.legacy_group_key === "string" ? row.legacy_group_key : "";
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        monthKey:              row.month_key,
        label:                 row.label,
        year:                  row.year,
        monthIndex:            row.month_index,
        // Settings fields passed through to buildNormalizedSettings in the overlay.
        minTarget:             row.min_target,
        fineAmount:            row.fine_amount,
        feeModel:              row.fee_model,
        escalationStepAmount:  row.escalation_step_amount ?? null,
        currency:              row.currency,
        minRunDistance:        row.min_run_distance,
        distanceUnit:          row.distance_unit,
        stravaEnabled:         !!row.strava_enabled,
        timeZone:              row.time_zone,
        acceptedWorkoutTypes:  Array.isArray(row.accepted_workout_types) ? row.accepted_workout_types : [],
        members:               Array.isArray(row.members) ? row.members : [],
        logs:                  Array.isArray(row.logs) ? row.logs : []
      });
      return acc;
    }, {});
  } catch {
    return null;
  }
}

async function fetchAnteSettlementConfirmations() {
  if (!ENABLE_SETTLEMENT_CONFIRMATIONS) return null;
  try {
    const response = await supabaseFetch("/rest/v1/rpc/read_ante_core_settlement_confirmations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({})
    });
    const rows = await response.json();
    if (!Array.isArray(rows)) return null;
    return rows.reduce((acc, row) => {
      const key = typeof row?.legacy_group_key === "string" ? row.legacy_group_key : "";
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        id: row.id,
        monthKey: row.month_key,
        monthLabel: row.month_label,
        payerAuthUserId: row.payer_auth_user_id || null,
        receiverAuthUserId: row.receiver_auth_user_id || null,
        payerDisplayName: row.payer_display_name,
        receiverDisplayName: row.receiver_display_name,
        amount: row.amount,
        currency: row.currency,
        payerClaimedAt: row.payer_claimed_at || null,
        confirmedAt: row.confirmed_at || null,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null
      });
      return acc;
    }, {});
  } catch {
    return null;
  }
}

async function fetchAnteCurrentExcusedAndSitouts() {
  try {
    const response = await supabaseFetch("/rest/v1/rpc/read_ante_core_current_excused_and_sitouts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({})
    });
    const payload = await response.json();
    if (!payload || typeof payload !== "object") return null;
    const excusedRows     = Array.isArray(payload.excused) ? payload.excused : [];
    const sitoutRows      = Array.isArray(payload.sit_out_requests) ? payload.sit_out_requests : [];
    const openSeasonRows  = Array.isArray(payload.open_seasons) ? payload.open_seasons : [];
    // Do NOT early-return on empty rows — an empty canonical state is still a
    // valid successful fetch and must be applied to clear stale blob values.

    // Group excused rows by legacy_group_key.
    const excused = excusedRows.reduce((acc, row) => {
      const key = typeof row?.legacy_group_key === "string" ? row.legacy_group_key : "";
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        monthKey:    row.month_key,
        displayName: row.display_name,
        excused:     !!row.excused
      });
      return acc;
    }, {});

    // Group sit-out rows by legacy_group_key. status is already mapped to the
    // blob-facing 'declined' value in the RPC; the JS layer never sees 'denied'.
    const sitOutRequests = sitoutRows.reduce((acc, row) => {
      const key = typeof row?.legacy_group_key === "string" ? row.legacy_group_key : "";
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        monthKey:             row.month_key,
        displayName:          row.display_name,
        status:               row.status || "pending",
        reason:               typeof row.reason === "string" ? row.reason : "",
        exceptional:          !!row.exceptional,
        requestedAt:          row.requested_at || null,
        requestedBy:          row.requested_by || row.display_name,
        requestedByUserId:    row.requested_by_user_id || null,
        targetApproverName:   row.target_approver_name || null,
        targetApproverUserId: row.target_approver_user_id || null,
        decidedAt:            row.decided_at || null,
        decidedBy:            row.decided_by || null,
        decidedByUserId:      row.decided_by_user_id || null,
        autoApproved:         !!row.auto_approved
      });
      return acc;
    }, {});

    // Build a {groupKey: monthKey} map from open seasons. Used by the overlay
    // to identify the current month to clear even when excused/sitout rows are
    // absent (zero-row empty-state case).
    const openSeasonMonthKeys = openSeasonRows.reduce((acc, row) => {
      const key = typeof row?.legacy_group_key === "string" ? row.legacy_group_key : "";
      if (key && row.month_key) acc[key] = row.month_key;
      return acc;
    }, {});

    return { excused, sitOutRequests, openSeasonMonthKeys };
  } catch {
    return null;
  }
}

async function fetchReadableCurrentState() {
  const anteProfilesPromise        = fetchAnteProfiles();
  const anteBlocsPromise           = fetchAnteBlocs();
  const anteSeasonOverridesPromise = fetchAnteSeasonOverrides();
  const anteBlocMembersPromise     = fetchAnteBlocMembers();
  const anteCurrentLogsPromise     = fetchAnteCurrentLogs();
  const anteExcusedSitoutsPromise  = fetchAnteCurrentExcusedAndSitouts();
  const anteMonthHistoryPromise    = fetchAnteMonthHistory();
  const anteSettlementConfirmationsPromise = fetchAnteSettlementConfirmations();

  // Projection read path removed: read_lift_log_projection RPC timed out on
  // every call (~28-60s), causing loading screen hangs. All GETs read directly
  // from the blob, which is fast and always correct. Projection tables remain
  // intact for future use but are no longer consulted on read.
  const baseState = await fetchCurrentStateFromSupabase();

  // Overlay canonical bloc settings plus stable group shell metadata onto the
  // group shell. Canonical blocs now provide the readable group set. The only
  // blob-only fallback that still survives here is intentional legacy
  // compatibility for the historical single-group shell when no canonical row
  // exists for LEGACY_GROUP_ID. defaultGroupId is re-derived from the
  // canonical-backed ordering instead of surviving from the blob snapshot.
  const anteBlocs = await anteBlocsPromise;
  let state = baseState;
  if (anteBlocs && Object.keys(anteBlocs).length > 0) {
    const blobGroupOrder = Array.isArray(state.groupOrder) ? state.groupOrder : [];
    const canonicalOrderedGroupIds = uniqueNames(
      Object.entries(anteBlocs)
        .filter(([, bloc]) => Number.isInteger(bloc?.sort_order))
        .sort(([, a], [, b]) => a.sort_order - b.sort_order)
        .map(([groupId]) => groupId)
    );
    const compatibilityBlobGroupIds = uniqueNames(
      blobGroupOrder.filter(groupId =>
        groupId === LEGACY_GROUP_ID &&
        !anteBlocs[groupId] &&
        state.groups?.[groupId]
      )
    );
    const nextGroupOrder = uniqueNames([...canonicalOrderedGroupIds, ...compatibilityBlobGroupIds]);
    const readableGroupIds = uniqueNames([
      ...Object.keys(anteBlocs),
      ...compatibilityBlobGroupIds
    ]);
    const overlaidGroups = Object.fromEntries(
      readableGroupIds.map(groupId => {
        const group = state.groups?.[groupId];
        const bloc = anteBlocs[groupId];
        if (!bloc) return [groupId, group];
        const shell = normalizeGroup({
          ...(group || {}),
          id: groupId,
          name: bloc.name || group?.name,
          inviteCode: bloc.invite_code || group?.inviteCode,
          createdAt: bloc.created_at || group?.createdAt,
          settings: buildNormalizedSettings({
            ...group?.settings,
            timeZone:              bloc.time_zone              ?? group?.settings?.timeZone,
            currency:              bloc.currency               ?? group?.settings?.currency,
            minTarget:             bloc.min_target             ?? group?.settings?.minTarget,
            fineAmount:            bloc.fine_amount            ?? group?.settings?.fineAmount,
            feeModel:              bloc.fee_model              ?? group?.settings?.feeModel,
            escalationStepAmount:  bloc.escalation_step_amount ?? group?.settings?.escalationStepAmount,
            minRunDistance:        bloc.min_run_distance       ?? group?.settings?.minRunDistance,
            distanceUnit:          bloc.distance_unit          ?? group?.settings?.distanceUnit,
            stravaEnabled:         bloc.strava_enabled         ?? group?.settings?.stravaEnabled,
            acceptedWorkoutTypes:  bloc.accepted_workout_types ?? group?.settings?.acceptedWorkoutTypes
          })
        });
        return [groupId, shell];
      })
    );
    state = {
      ...state,
      groups: overlaidGroups,
      groupOrder: nextGroupOrder,
      defaultGroupId: deriveDefaultGroupId(nextGroupOrder)
    };
  }

  const anteSeasonOverrides = await anteSeasonOverridesPromise;
  if (anteSeasonOverrides && Object.keys(anteSeasonOverrides).length > 0) {
    const overlaidGroups = Object.fromEntries(
      Object.entries(state.groups || {}).map(([groupId, group]) => {
        const overrides = anteSeasonOverrides[groupId];
        if (!overrides) return [groupId, group];
        return [groupId, {
          ...group,
          seasonOverrides: mergeSeasonOverridesPreservingMetadata(group.seasonOverrides, overrides)
        }];
      })
    );
    state = { ...state, groups: overlaidGroups };
  }

  const anteBlocMembers = await anteBlocMembersPromise;
  if (anteBlocMembers && Object.keys(anteBlocMembers).length > 0) {
    const overlaidGroups = Object.fromEntries(
      Object.entries(state.groups || {}).map(([groupId, group]) => {
        const members = anteBlocMembers[groupId];
        if (!members || members.length === 0) return [groupId, group];
        // For pre-existing blob groups, only overlay canonical rows whose
        // auth_user_id already exists as a key in the blob memberships map.
        // This prevents a canonical active row from resurrecting a member who
        // was kicked from the blob but whose canonical soft-delete (left_at)
        // failed silently. For canonical-only readable shells (no blob group),
        // allow canonical members to seed the membership shell from scratch.
        const blobMembershipKeys = new Set(Object.keys(baseState.groups?.[groupId]?.memberships || {}));
        const blobMemberOrder = Array.isArray(group.memberOrder) ? group.memberOrder : [];
        const overlaidMemberships = { ...(group.memberships || {}) };
        const overlaidJoinedMonthByName = pruneJoinedMonthByNameForRead(group, group.joinedMonthByName, group.settings);
        const allowCanonicalShellCreation = blobMembershipKeys.size === 0;
        for (const m of members) {
          if (!allowCanonicalShellCreation && !blobMembershipKeys.has(m.auth_user_id)) continue;
          overlaidMemberships[m.auth_user_id] = {
            userId:      m.auth_user_id,
            displayName: m.display_name,
            role:        m.role,
            joinedAt:    m.joined_at || null
          };
          if (m.joined_month_key) overlaidJoinedMonthByName[m.display_name] = m.joined_month_key;
        }
        // Reconstruct memberOrder from canonical sort_order, but only promote
        // canonical authority when it fully covers the blob's active auth-linked
        // memberships. Blob-only legacy/profile-less names still survive via
        // fallback so edge-case rows are not dropped.
        const canonicalOrderedNames = uniqueNames(
          members
            .filter(m =>
              (allowCanonicalShellCreation || blobMembershipKeys.has(m.auth_user_id)) &&
              Number.isInteger(m.sort_order) &&
              typeof m.display_name === "string" &&
              m.display_name
            )
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(m => m.display_name)
        );
        const activeBlobMembershipNames = uniqueNames(
          Object.entries(group.memberships || {})
            .filter(([userId, membership]) =>
              blobMembershipKeys.has(userId) &&
              typeof membership?.displayName === "string" &&
              membership.displayName
            )
            .map(([, membership]) => membership.displayName)
        );
        const coveredNames = new Set(canonicalOrderedNames);
        const canonicalCoversActiveMemberships =
          activeBlobMembershipNames.length > 0 &&
          activeBlobMembershipNames.every(name => coveredNames.has(name));
        const activeBlobMembershipNameSet = new Set(activeBlobMembershipNames);
        const residualBlobNames = blobMemberOrder.filter(name => {
          if (coveredNames.has(name)) return false;
          if (!canonicalCoversActiveMemberships) return true;
          return !activeBlobMembershipNameSet.has(name);
        });
        const nextMemberOrder = uniqueNames([...canonicalOrderedNames, ...residualBlobNames]);
        // Derive adminUserId and adminName from the canonical admin row, but only
        // when that row also passed the blob-key guard (confirmed in overlaidMemberships).
        const canonicalAdminRow = members.find(m => m.role === "admin" && overlaidMemberships[m.auth_user_id]);
        return [groupId, {
          ...group,
          memberOrder:       nextMemberOrder,
          memberships:        overlaidMemberships,
          joinedMonthByName:  overlaidJoinedMonthByName,
          adminUserId: canonicalAdminRow ? canonicalAdminRow.auth_user_id : group.adminUserId,
          adminName:   canonicalAdminRow ? canonicalAdminRow.display_name  : group.adminName
        }];
      })
    );
    state = { ...state, groups: overlaidGroups };
  }

  // Overlay canonical current-month logs onto each blob-backed group.
  // The overlay keys group.logs by the current active member list, not the
  // broader historical member shell. Members in activeMemberOrder with no
  // canonical logs get []. Canonical log owners not in activeMemberOrder are
  // silently dropped (name-drift / departed-member guard).
  // If the fetch fails or returns null, blob logs are preserved unchanged.
  const anteExcusedSitouts = await anteExcusedSitoutsPromise;
  const openSeasonMonthKeys = anteExcusedSitouts?.openSeasonMonthKeys || null;

  const anteCurrentLogs = await anteCurrentLogsPromise;
  if (anteCurrentLogs && openSeasonMonthKeys && Object.keys(openSeasonMonthKeys).length > 0) {
    const overlaidGroups = Object.fromEntries(
      Object.entries(state.groups || {}).map(([groupId, group]) => {
        const openMonthKey = openSeasonMonthKeys[groupId];
        // Skip groups with no canonical open season — they have no canonical
        // current-month state to clear or replace.
        if (!openMonthKey) return [groupId, group];
        const canonicalLogs = anteCurrentLogs[groupId] || [];
        // Index canonical logs by ownerDisplayName for O(1) lookup below.
        const byOwner = {};
        for (const log of canonicalLogs) {
          const name = log.ownerDisplayName;
          if (!byOwner[name]) byOwner[name] = [];
          byOwner[name].push(log);
        }
        const activeMemberNames = Array.isArray(group.activeMemberOrder) && group.activeMemberOrder.length
          ? group.activeMemberOrder
          : (group.memberOrder || []);
        // Build the logs map keyed by active-member names only.
        const overlaidLogs = Object.fromEntries(
          activeMemberNames.map(name => [
            name,
            (byOwner[name] || []).map(normalizeLogEntry)
          ])
        );
        return [groupId, { ...group, logs: overlaidLogs }];
      })
    );
    state = { ...state, groups: overlaidGroups };
  }

  // Overlay canonical current-month excused + sit-out requests.
  // Both overlays are keyed by the current active member list, not the wider
  // historical member shell. Each canonical row carries its own month_key,
  // used as the inner/outer key so only the open-season month is touched.
  // Historical sit-out month keys in the blob are preserved.
  // status is already mapped to 'declined' in the RPC. If the fetch fails or
  // returns null, blob values are preserved unchanged.
  // openSeasonMonthKeys provides the current month_key for each group even when
  // excused/sit-out arrays are empty, enabling canonical to clear stale blob state.
  // Historical sit-out month keys in the blob are preserved; only the open-season
  // month key is replaced. The same canonical open-season month_key is also used
  // to override group.lastMonth for covered groups, reducing one more blob-only
  // read dependency without changing write authority. status is already mapped to
  // 'declined' in the RPC. If the fetch fails (returns null), blob values are
  // preserved unchanged.
  if (anteExcusedSitouts) {
    const excusedByGroup        = anteExcusedSitouts.excused || {};
    const sitoutsByGroup        = anteExcusedSitouts.sitOutRequests || {};
    const openSeasonMonthKeys   = anteExcusedSitouts.openSeasonMonthKeys || {};
    const overlaidGroups = Object.fromEntries(
      Object.entries(state.groups || {}).map(([groupId, group]) => {
        const openMonthKey = openSeasonMonthKeys[groupId];
        // Skip groups with no open season — they have no canonical current-month state.
        if (!openMonthKey) return [groupId, group];

        const activeMemberNames = Array.isArray(group.activeMemberOrder) && group.activeMemberOrder.length
          ? group.activeMemberOrder
          : (group.memberOrder || []);
        let nextGroup = group;

        // Excused overlay: replace group.excused wholesale, keyed by active members.
        // Applies even when canonical has zero excused rows for this group — a member
        // with no canonical excused entry correctly gets {} (not excused this month).
        const canonicalExcused = excusedByGroup[groupId] || [];
        const excusedByName = {};
        for (const row of canonicalExcused) {
          if (!excusedByName[row.displayName]) excusedByName[row.displayName] = {};
          if (row.excused) excusedByName[row.displayName][row.monthKey] = true;
        }
        nextGroup = {
          ...nextGroup,
          lastMonth: openMonthKey,
          excused: Object.fromEntries(activeMemberNames.map(name => [name, excusedByName[name] || {}]))
        };

        // Sit-out overlay: replace only the open-season month key, keyed by
        // active members. Preserve all other (historical) month keys from blob.
        // Uses openMonthKey as the authoritative current month so the overlay
        // fires even when canonical has zero sit-out rows for this group.
        const canonicalSitouts = sitoutsByGroup[groupId] || [];
        const sitoutByName = {};
        for (const row of canonicalSitouts) {
          sitoutByName[row.displayName] = row;
        }
        const monthRequests = {};
        for (const name of activeMemberNames) {
          const req = sitoutByName[name];
          if (!req) continue;
          monthRequests[name] = {
            memberName:           name,
            monthKey:             openMonthKey,
            status:               req.status,
            reason:               req.reason,
            exceptional:          req.exceptional,
            requestedAt:          req.requestedAt,
            requestedBy:          req.requestedBy,
            requestedByUserId:    req.requestedByUserId,
            targetApproverName:   req.targetApproverName,
            targetApproverUserId: req.targetApproverUserId,
            decidedAt:            req.decidedAt,
            decidedBy:            req.decidedBy,
            decidedByUserId:      req.decidedByUserId,
            autoApproved:         req.autoApproved
          };
        }
        nextGroup = {
          ...nextGroup,
          sitOutRequests: monthRequests && Object.keys(monthRequests).length > 0
            ? { [openMonthKey]: monthRequests }
            : {}
        };

        return [groupId, nextGroup];
      })
    );
    state = { ...state, groups: overlaidGroups };
  }

  // Month-history overlay: replace closed-season monthHistory entries with
  // canonical-composed versions. Only closed seasons are touched — the open
  // month is handled by the current-logs and excused/sitout overlays above.
  // Historical member shells are derived per month from canonical season rows
  // and canonical workout logs instead of being filtered through today's
  // group.memberOrder. Blob monthHistory entries whose month_key has no
  // canonical counterpart are preserved unchanged.
  // No normalization pass runs after this point — the overlay must produce
  // the final blob-shaped monthHistory[*] objects directly.
  // If the fetch fails or returns null, blob monthHistory survives unchanged.
  const anteMonthHistory = await anteMonthHistoryPromise;
  if (anteMonthHistory) {
    const overlaidGroups = Object.fromEntries(
      Object.entries(state.groups || {}).map(([groupId, group]) => {
        const canonicalSeasons = anteMonthHistory[groupId];
        if (!canonicalSeasons || canonicalSeasons.length === 0) return [groupId, group];
        return [groupId, { ...group, monthHistory: buildCanonicalMonthHistoryForGroup(group, canonicalSeasons) }];
      })
    );
    state = { ...state, groups: overlaidGroups };
  }

  const anteProfiles = await anteProfilesPromise;
  if (anteProfiles) {
    // Only overlay canonical profiles whose userId already exists in blob
    // state. If a user was deleted from the blob (delete-account), their row
    // may still be present in ante_core.profiles until canonical deletion is
    // implemented. Filtering here prevents stale canonical rows from
    // resurrecting a deleted user in the returned state.
    const blobProfileKeys = new Set(Object.keys(state.profiles || {}));
    const filtered = Object.fromEntries(
      Object.entries(anteProfiles).filter(([userId]) => blobProfileKeys.has(userId))
    );
    if (Object.keys(filtered).length > 0) {
      state = { ...state, profiles: { ...(state.profiles || {}), ...filtered } };
    }
  }
  const anteSettlementConfirmations = await anteSettlementConfirmationsPromise;
  if (ENABLE_SETTLEMENT_CONFIRMATIONS || ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW) {
    const overlaidGroups = Object.fromEntries(
      Object.entries(state.groups || {}).map(([groupId, group]) => [groupId, {
        ...group,
        settlementConfirmationsEnabled: true,
        settlementConfirmationsPreviewMode: ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW,
        // If the canonical fetch fails transiently (null), preserve the prior
        // readable slice instead of collapsing reminders to [] for one paint.
        // A successful canonical empty array still clears correctly.
        settlementConfirmations: anteSettlementConfirmations
          ? normalizeSettlementConfirmations(anteSettlementConfirmations[groupId] || [])
          : normalizeSettlementConfirmations(group?.settlementConfirmations || [])
      }])
    );
    state = { ...state, groups: overlaidGroups };
  }

  // Current-log membership scrub keyed off the composed current-member set.
  // This dissolves stale pending flags/reactions and removes logs owned by
  // users who are no longer current members, without depending on blob-only
  // `leftMemberNames` for the cleanup trigger.
  state = {
    ...state,
    groups: Object.fromEntries(
      Object.entries(state.groups || {}).map(([groupId, group]) => {
        const currentMonthKey = group?.lastMonth || getLeagueMonthKey(group?.settings?.timeZone);
        const allowedNames = getCurrentMemberNamesForMonth(group, currentMonthKey);
        const scrubbedLogs = scrubCurrentLogsAgainstAllowedMembers(group.logs || {}, allowedNames);
        return [groupId, {
          ...group,
          logs: scrubbedLogs,
          sitOutRequests: pruneSitOutRequestsForRead(group.sitOutRequests, currentMonthKey)
        }];
      })
    )
  };

  return {
    ...state,
    defaultGroupId: deriveDefaultGroupId(state.groupOrder)
  };
}

async function buildCanonicalWritableStateForGroup(groupId, baseStateOverride = null) {
  const safeGroupId = String(groupId || "").trim();
  if (!safeGroupId) return fetchWritableCurrentState();

  const [
    anteProfiles,
    anteBlocs,
    anteSeasonOverrides,
    anteBlocMembers,
    anteCurrentLogs,
    anteExcusedSitouts,
    anteMonthHistory
  ] = await Promise.all([
    fetchAnteProfiles(),
    fetchAnteBlocs(),
    fetchAnteSeasonOverrides(),
    fetchAnteBlocMembers(),
    fetchAnteCurrentLogs(),
    fetchAnteCurrentExcusedAndSitouts(),
    fetchAnteMonthHistory()
  ]);
  const baseState = baseStateOverride
    ? normalizeState(baseStateOverride)
    : await fetchCurrentStateFromSupabase();

  const baseGroup = baseState.groups?.[safeGroupId] || null;
  const bloc = anteBlocs?.[safeGroupId] || null;
  if (!baseGroup || !bloc) return baseState;

  const canonicalMemberRows = anteBlocMembers?.[safeGroupId] || [];
  const canonicalOrderedMembers = [...canonicalMemberRows]
    .filter(row => row?.auth_user_id && row?.display_name)
    .sort((a, b) => {
      const aSort = Number.isInteger(a.sort_order) ? a.sort_order : Number.MAX_SAFE_INTEGER;
      const bSort = Number.isInteger(b.sort_order) ? b.sort_order : Number.MAX_SAFE_INTEGER;
      if (aSort !== bSort) return aSort - bSort;
      return String(a.display_name).localeCompare(String(b.display_name));
    });
  const canonicalMemberOrder = uniqueNames(canonicalOrderedMembers.map(row => row.display_name));
  const canonicalRowsByUserId = new Map(canonicalOrderedMembers.map(row => [row.auth_user_id, row]));
  const baseMembershipEntries = Object.entries(baseGroup.memberships || {});
  const coveredBaseMembershipEntries = baseMembershipEntries
    .filter(([userId]) => canonicalRowsByUserId.has(userId))
    .map(([userId, existingMembership]) => {
      const row = canonicalRowsByUserId.get(userId);
      return [userId, {
        ...existingMembership,
        userId,
        displayName: row.display_name,
        role: row.role === "admin" ? "admin" : "member",
        joinedAt: preferExistingTimestamp(existingMembership?.joinedAt, row.joined_at)
      }];
    });
  const coveredBaseUserIds = new Set(coveredBaseMembershipEntries.map(([userId]) => userId));
  const newCanonicalMembershipEntries = canonicalOrderedMembers
    .filter(row => !coveredBaseUserIds.has(row.auth_user_id))
    .map(row => [
      row.auth_user_id,
      {
        userId: row.auth_user_id,
        displayName: row.display_name,
        role: row.role === "admin" ? "admin" : "member",
        joinedAt: row.joined_at || null
      }
    ]);
  const canonicalMemberships = Object.fromEntries([
    ...coveredBaseMembershipEntries,
    ...newCanonicalMembershipEntries
  ]);
  const canonicalAdminRow =
    canonicalOrderedMembers.find(row => row.role === "admin") ||
    canonicalOrderedMembers.find(row => row.auth_user_id === baseGroup.adminUserId) ||
    null;

  const settings = buildNormalizedSettings({
    ...baseGroup.settings,
    timeZone:             bloc.time_zone              ?? baseGroup.settings?.timeZone,
    currency:             bloc.currency               ?? baseGroup.settings?.currency,
    minTarget:            bloc.min_target             ?? baseGroup.settings?.minTarget,
    fineAmount:           bloc.fine_amount            ?? baseGroup.settings?.fineAmount,
    feeModel:             bloc.fee_model              ?? baseGroup.settings?.feeModel,
    escalationStepAmount: bloc.escalation_step_amount ?? baseGroup.settings?.escalationStepAmount,
    minRunDistance:       bloc.min_run_distance       ?? baseGroup.settings?.minRunDistance,
    distanceUnit:         bloc.distance_unit          ?? baseGroup.settings?.distanceUnit,
    stravaEnabled:        bloc.strava_enabled         ?? baseGroup.settings?.stravaEnabled,
    acceptedWorkoutTypes: bloc.accepted_workout_types ?? baseGroup.settings?.acceptedWorkoutTypes
  });

  const canonicalJoinedMonthByName = pruneJoinedMonthByNameForRead(
    { ...baseGroup, memberships: canonicalMemberships, settings },
    {
      ...(baseGroup.joinedMonthByName || {}),
      ...Object.fromEntries(
        canonicalOrderedMembers
          .filter(row => row.joined_month_key)
          .map(row => [row.display_name, row.joined_month_key])
      )
    },
    settings
  );

  const openMonthKey = anteExcusedSitouts?.openSeasonMonthKeys?.[safeGroupId] || baseGroup.lastMonth;
  const canonicalLogsByOwner = {};
  for (const log of anteCurrentLogs?.[safeGroupId] || []) {
    const owner = log.ownerDisplayName;
    if (!owner) continue;
    if (!canonicalLogsByOwner[owner]) canonicalLogsByOwner[owner] = [];
    canonicalLogsByOwner[owner].push(normalizeLogEntry(log));
  }
  const currentLogOwners = uniqueNames([
    ...Object.keys(baseGroup.logs || {}),
    ...canonicalMemberOrder,
    ...Object.keys(canonicalLogsByOwner)
  ]);
  const canonicalLogs = Object.fromEntries(
    currentLogOwners.map(name => {
      const canonicalOwnerLogs = canonicalLogsByOwner[name] || [];
      const canonicalById = new Map(canonicalOwnerLogs.map(log => [String(log?.id || ""), log]));
      const baseOwnerLogs = Array.isArray(baseGroup.logs?.[name]) ? baseGroup.logs[name] : [];
      const usedIds = new Set();
      const orderedLogs = baseOwnerLogs
        .map(existingLog => {
          const logId = String(existingLog?.id || "");
          const canonicalLog = canonicalById.get(logId);
          if (!canonicalLog) return null;
          usedIds.add(logId);
          return preserveBlobCompatibleLogFields(existingLog, canonicalLog);
        })
        .filter(Boolean);
      for (const canonicalLog of canonicalOwnerLogs) {
        const logId = String(canonicalLog?.id || "");
        if (!usedIds.has(logId)) orderedLogs.push(canonicalLog);
      }
      return [name, orderedLogs];
    })
  );

  const historicalExcused = { ...(baseGroup.excused || {}) };
  const currentExcusedRows = anteExcusedSitouts?.excused?.[safeGroupId] || [];
  const canonicalExcusedByName = {};
  for (const row of currentExcusedRows) {
    if (!row.displayName || !row.monthKey || !row.excused) continue;
    if (!canonicalExcusedByName[row.displayName]) canonicalExcusedByName[row.displayName] = {};
    canonicalExcusedByName[row.displayName][row.monthKey] = true;
  }
  const canonicalExcused = Object.fromEntries(
    uniqueNames([...Object.keys(historicalExcused), ...canonicalMemberOrder]).map(name => {
      const prior = { ...(historicalExcused[name] || {}) };
      if (openMonthKey) delete prior[openMonthKey];
      return [name, { ...prior, ...(canonicalExcusedByName[name] || {}) }];
    })
  );

  const historicalSitouts = { ...(baseGroup.sitOutRequests || {}) };
  if (openMonthKey) delete historicalSitouts[openMonthKey];
  const canonicalSitoutRows = anteExcusedSitouts?.sitOutRequests?.[safeGroupId] || [];
  const currentSitoutRequests = {};
  for (const row of canonicalSitoutRows) {
    if (!row.displayName) continue;
    currentSitoutRequests[row.displayName] = {
      memberName: row.displayName,
      monthKey: openMonthKey || row.monthKey,
      status: row.status || "pending",
      reason: row.reason || "",
      exceptional: !!row.exceptional,
      requestedAt: row.requestedAt || null,
      requestedBy: row.requestedBy || row.displayName,
      requestedByUserId: row.requestedByUserId || null,
      targetApproverName: row.targetApproverName || null,
      targetApproverUserId: row.targetApproverUserId || null,
      decidedAt: row.decidedAt || null,
      decidedBy: row.decidedBy || null,
      decidedByUserId: row.decidedByUserId || null,
      autoApproved: !!row.autoApproved
    };
  }
  const canonicalSitOutRequests = {
    ...historicalSitouts,
    ...(openMonthKey && Object.keys(currentSitoutRequests).length > 0
      ? { [openMonthKey]: currentSitoutRequests }
      : {})
  };

  const canonicalSeasonOverrides = mergeSeasonOverridesPreservingMetadata(
    baseGroup.seasonOverrides,
    anteSeasonOverrides?.[safeGroupId] || {}
  );
  const canonicalHistoryGroup = {
    ...baseGroup,
    memberships: canonicalMemberships,
    joinedMonthByName: canonicalJoinedMonthByName,
    settings,
    seasonOverrides: canonicalSeasonOverrides
  };
  const canonicalMonthHistory = buildCanonicalMonthHistoryForGroup(
    canonicalHistoryGroup,
    anteMonthHistory?.[safeGroupId]
  );

  const canonicalGroup = normalizeGroup({
    ...baseGroup,
    id: safeGroupId,
    name: bloc.name || baseGroup.name,
    inviteCode: bloc.invite_code || baseGroup.inviteCode,
    createdAt: preferExistingTimestamp(baseGroup.createdAt, bloc.created_at),
    adminName: canonicalAdminRow?.display_name || baseGroup.adminName,
    adminUserId: canonicalAdminRow?.auth_user_id || baseGroup.adminUserId,
    memberOrder: canonicalMemberOrder,
    memberships: canonicalMemberships,
    joinedMonthByName: canonicalJoinedMonthByName,
    settings,
    logs: canonicalLogs,
    excused: canonicalExcused,
    sitOutRequests: canonicalSitOutRequests,
    seasonOverrides: canonicalSeasonOverrides,
    monthHistory: canonicalMonthHistory,
    lastMonth: openMonthKey || baseGroup.lastMonth
  });

  return {
    ...baseState,
    groups: {
      ...(baseState.groups || {}),
      [safeGroupId]: canonicalGroup
    },
    profiles: anteProfiles
      ? { ...(baseState.profiles || {}), ...anteProfiles }
      : baseState.profiles
  };
}

async function buildCanonicalWritableStateForAllGroups(baseStateOverride = null) {
  const baseState = baseStateOverride
    ? normalizeState(baseStateOverride)
    : await fetchCurrentStateFromSupabase();
  const groupIds = Array.isArray(baseState.groupOrder) && baseState.groupOrder.length
    ? baseState.groupOrder
    : Object.keys(baseState.groups || {});
  let state = baseState;
  for (const groupId of groupIds) {
    state = await buildCanonicalWritableStateForGroup(groupId, state);
  }
  return state;
}

async function buildHistoricalShellReconciliationReport(baseState) {
  const canonicalState = await buildCanonicalWritableStateForAllGroups(baseState);
  const writableBlob = buildWriteHydrationComparisonBlob(baseState, "historical-shell");
  const canonicalBlob = buildWriteHydrationComparisonBlob(canonicalState, "historical-shell");
  const groupIds = uniqueNames([
    ...(Array.isArray(baseState.groupOrder) ? baseState.groupOrder : []),
    ...Object.keys(baseState.groups || {}),
    ...Object.keys(canonicalState.groups || {})
  ]);
  const groups = groupIds.map(groupId => {
    const writableGroup = writableBlob.groups?.[groupId] || null;
    const canonicalGroup = canonicalBlob.groups?.[groupId] || null;
    const writableMonthsByKey = Object.fromEntries((writableGroup?.monthHistory || []).map(month => [month.key, month]));
    const canonicalMonthsByKey = Object.fromEntries((canonicalGroup?.monthHistory || []).map(month => [month.key, month]));
    const monthKeys = uniqueNames([...Object.keys(writableMonthsByKey), ...Object.keys(canonicalMonthsByKey)]).sort(compareMonthKeys);
    const missingBlobMonthKeys = monthKeys.filter(monthKey => !writableMonthsByKey[monthKey] && canonicalMonthsByKey[monthKey]);
    const missingCanonicalMonthKeys = monthKeys.filter(monthKey => writableMonthsByKey[monthKey] && !canonicalMonthsByKey[monthKey]);
    const differingMonthKeys = monthKeys.filter(monthKey =>
      writableMonthsByKey[monthKey] &&
      canonicalMonthsByKey[monthKey] &&
      valuesDiffer(writableMonthsByKey[monthKey], canonicalMonthsByKey[monthKey])
    );
    const writableOverrides = normalizeSeasonOverrides(writableGroup?.seasonOverrides);
    const canonicalOverrides = normalizeSeasonOverrides(canonicalGroup?.seasonOverrides);
    const overrideMonthKeys = uniqueNames([...Object.keys(writableOverrides), ...Object.keys(canonicalOverrides)]).sort(compareMonthKeys);
    const missingBlobOverrideKeys = overrideMonthKeys.filter(monthKey => !writableOverrides[monthKey] && canonicalOverrides[monthKey]);
    const missingCanonicalOverrideKeys = overrideMonthKeys.filter(monthKey => writableOverrides[monthKey] && !canonicalOverrides[monthKey]);
    const differingOverrideKeys = overrideMonthKeys.filter(monthKey =>
      writableOverrides[monthKey] &&
      canonicalOverrides[monthKey] &&
      valuesDiffer(writableOverrides[monthKey], canonicalOverrides[monthKey])
    );
    return {
      groupId,
      name: canonicalGroup?.name || writableGroup?.name || "",
      blobMonthCount: Object.keys(writableMonthsByKey).length,
      canonicalMonthCount: Object.keys(canonicalMonthsByKey).length,
      missingBlobMonthKeys,
      missingCanonicalMonthKeys,
      differingMonthKeys,
      blobSeasonOverrideCount: Object.keys(writableOverrides).length,
      canonicalSeasonOverrideCount: Object.keys(canonicalOverrides).length,
      missingBlobOverrideKeys,
      missingCanonicalOverrideKeys,
      differingOverrideKeys,
      needsReconciliation:
        missingBlobMonthKeys.length > 0 ||
        missingCanonicalMonthKeys.length > 0 ||
        differingMonthKeys.length > 0 ||
        missingBlobOverrideKeys.length > 0 ||
        missingCanonicalOverrideKeys.length > 0 ||
        differingOverrideKeys.length > 0
    };
  });
  const groupsNeedingReconciliation = groups.filter(group => group.needsReconciliation);
  return {
    ok: groupsNeedingReconciliation.length === 0,
    checked: groups.length,
    needsReconciliation: groupsNeedingReconciliation.length,
    totals: {
      missingBlobMonths: groups.reduce((sum, group) => sum + group.missingBlobMonthKeys.length, 0),
      missingCanonicalMonths: groups.reduce((sum, group) => sum + group.missingCanonicalMonthKeys.length, 0),
      differingMonths: groups.reduce((sum, group) => sum + group.differingMonthKeys.length, 0),
      missingBlobOverrides: groups.reduce((sum, group) => sum + group.missingBlobOverrideKeys.length, 0),
      missingCanonicalOverrides: groups.reduce((sum, group) => sum + group.missingCanonicalOverrideKeys.length, 0),
      differingOverrides: groups.reduce((sum, group) => sum + group.differingOverrideKeys.length, 0)
    },
    groups: groupsNeedingReconciliation
  };
}

// Mutations must always hydrate from the blob source of truth.
// Projection reads are safe for GET optimization, but using a lagging or
// lossy projection snapshot as the base for writes can permanently erase
// data from the blob on the next persist.
async function fetchWritableCurrentState() {
  return fetchCurrentStateFromSupabase();
}

async function persistState(nextState, reason) {
  // Extract rollover metadata before persistStateToSupabase — normalizeState
  // strips _rollovers from the blob write, so we must read it here first.
  const rollovers = Array.isArray(nextState._rollovers) ? nextState._rollovers : [];
  const safeState = normalizeState(nextState);

  // Canonical-first rollover sync:
  // 1. use the exact post-rollover in-memory state to close/open seasons
  // 2. write the closed-month member snapshots canonically
  // 3. persist the blob only after canonical rollover writes succeed
  for (const { groupId, closedMonthKey, newMonthKey, closedAt } of rollovers) {
    const group = safeState.groups?.[groupId];
    if (!group) continue;
    // Close the old season first so season_member_status writes can resolve the
    // canonical season row deterministically.
    await syncSeasonToCanonical(group, closedMonthKey, "closed", closedAt, { throwOnError: true });
    // Open the new season.
    await syncSeasonToCanonical(group, newMonthKey, "open", null, { throwOnError: true });
    // Write one season_member_status row per relevant member for the closed month.
    // The closed-month snapshot was appended to monthHistory by rolloverGroupIfNeeded,
    // so it is already present in the exact post-rollover state at this point.
    const closedSnapshot = group.monthHistory?.find(m => m.key === closedMonthKey);
    if (closedSnapshot) {
      // Build a displayName → authUserId reverse map from group.memberships.
      const authUserIdByName = Object.fromEntries(
        Object.entries(group.memberships || {}).map(([uid, m]) => [m.displayName, uid])
      );
      for (const memberName of Object.keys(closedSnapshot.counts || {})) {
        const memberAuthUserId = authUserIdByName[memberName] || null;
        await upsertSeasonMemberStatusToCanonical(
          group,
          closedMonthKey,
          memberName,
          memberAuthUserId,
          closedSnapshot.counts[memberName] ?? 0,
          closedSnapshot.excused[memberName] ?? false,
          { throwOnError: true }
        );
      }
    }
    console.log(`Season rollover canonical sync fired: ${groupId} ${closedMonthKey} → ${newMonthKey}`);
  }

  const persisted = await persistStateToSupabase(safeState, reason);
  return persisted;
}

async function fetchCurrentStateFromSupabase() {
  assertSupabaseConfigured();
  const response = await supabaseFetch("/rest/v1/lift_log_state?id=eq.true&select=state,revision,updated_at", {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return rolloverStateIfNeeded({});
  }
  const row = rows[0] || {};
  return rolloverStateIfNeeded(row.state || {}, {
    revision: row.revision,
    updatedAt: row.updated_at || null
  });
}

function createTimeoutSignal(timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return { signal: undefined, cancel: () => {} };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer)
  };
}

function isTransientStorageCleanupError(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || error || "").toLowerCase();
  return error?.name === "AbortError"
    || status === 408
    || status === 429
    || status === 502
    || status === 503
    || status === 504
    || message.includes("timed out")
    || message.includes("timeout")
    || message.includes("gateway time-out")
    || message.includes("gateway timeout")
    || message.includes("fetch failed")
    || message.includes("socket hang up")
    || message.includes("econnreset");
}

function reportStorageCleanupFailure(error) {
  const now = Date.now();
  const message = error?.message || String(error || "unknown error");
  const transient = isTransientStorageCleanupError(error);
  if (transient) {
    if (now - storageCleanupLastWarningAt < STORAGE_CLEANUP_INTERVAL_MS) return;
    storageCleanupLastWarningAt = now;
    console.warn(`Storage cleanup skipped after transient storage failure: ${message}`);
    return;
  }
  console.error("Storage expiry cleanup failed:", message);
}

async function listStorageObjects(prefix) {
  const { signal, cancel } = createTimeoutSignal(STORAGE_CLEANUP_FETCH_TIMEOUT_MS);
  try {
    const response = await supabaseFetch("/storage/v1/object/list/workout-photos", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prefix,
        limit: prefix ? STORAGE_CLEANUP_MAX_FILES_PER_FOLDER : STORAGE_CLEANUP_MAX_FOLDERS,
        offset: 0
      })
    });
    return await response.json();
  } finally {
    cancel();
  }
}

async function deleteStoragePhotos(paths) {
  if (!paths.length) return;
  const { signal, cancel } = createTimeoutSignal(STORAGE_CLEANUP_FETCH_TIMEOUT_MS);
  try {
    await supabaseFetch("/storage/v1/object/workout-photos", {
      method: "DELETE",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: paths })
    });
  } finally {
    cancel();
  }
}

async function cleanupExpiredStoragePhotos() {
  // Files are stored as {userId}/{Date.now()}.jpg — parse the timestamp
  // from the filename to determine age. Delete anything older than 72h.
  try {
    const folders = await listStorageObjects("");
    if (!Array.isArray(folders)) return;

    const expiredPaths = [];
    for (const folder of folders) {
      // Folders have metadata: null; files have metadata: {...} — skip files at root
      if (!folder?.name || folder.metadata) continue;
      const files = await listStorageObjects(`${folder.name}/`);
      if (!Array.isArray(files)) continue;
      for (const file of files) {
        if (!file?.name) continue;
        const timestamp = parseInt(file.name, 10);
        if (Number.isFinite(timestamp) && Date.now() - timestamp > UNFLAGGED_IMAGE_RETENTION_MS) {
          expiredPaths.push(`${folder.name}/${file.name}`);
        }
      }
    }

    if (expiredPaths.length) {
      await deleteStoragePhotos(expiredPaths);
      console.log(`Storage cleanup: deleted ${expiredPaths.length} expired photo(s)`);
    }
  } catch (err) {
    reportStorageCleanupFailure(err);
  }
}

function scheduleStorageCleanup() {
  const now = Date.now();
  if (storageCleanupInFlight) return storageCleanupInFlight;
  if (now - storageCleanupLastRunAt < STORAGE_CLEANUP_INTERVAL_MS) return null;
  storageCleanupLastRunAt = now;
  storageCleanupInFlight = cleanupExpiredStoragePhotos()
    .catch(reportStorageCleanupFailure)
    .finally(() => {
      storageCleanupInFlight = null;
    });
  return storageCleanupInFlight;
}

async function persistStateToSupabase(nextState, reason) {
  assertSupabaseConfigured();
  const safeState = normalizeState(nextState);
  const serializedState = serializeStateForBlob(safeState);
  await createSupabaseBackup(serializedState, safeState.meta.revision, reason);

  const response = await supabaseFetch("/rest/v1/lift_log_state?id=eq.true", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      state: serializedState,
      revision: safeState.meta.revision,
      updated_at: safeState.meta.updatedAt || new Date().toISOString()
    })
  });

  const rows = await response.json();
  const persistedState = Array.isArray(rows) && rows.length > 0
    ? rolloverStateIfNeeded(rows[0]?.state || serializedState, {
      revision: rows[0]?.revision ?? safeState.meta.revision,
      updatedAt: rows[0]?.updated_at || safeState.meta.updatedAt || null
    })
    : null;

  if (!persistedState) {
    await supabaseFetch("/rest/v1/lift_log_state", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation,resolution=merge-duplicates"
      },
      body: JSON.stringify([{
        id: true,
        state: serializedState,
        revision: safeState.meta.revision,
        updated_at: safeState.meta.updatedAt || new Date().toISOString()
      }])
    });
  }

  // Best-effort: scan bucket and delete old temporary photos, but never let
  // this compete with normal writes on every request.
  scheduleStorageCleanup();

  return persistedState || safeState;
}

async function createSupabaseBackup(state, stateRevision, reason) {
  await supabaseFetch("/rest/v1/lift_log_backups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      state_revision: stateRevision,
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
    supabaseAnonKey: SUPABASE_ANON_KEY,
    enableLocalPreviewAuth: ENABLE_LOCAL_PREVIEW_AUTH
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

function readDevImpersonationUserId(req) {
  const header = req?.headers?.["x-dev-impersonate-user-id"]
    || req?.headers?.["X-Dev-Impersonate-User-Id"]
    || "";
  return String(header || "").trim();
}

function slugifyDevIdentity(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "local";
}

function isLocalDevRequest(req) {
  const host = String(req?.headers?.host || req?.headers?.Host || "").trim().toLowerCase();
  return host.startsWith("localhost:")
    || host === "localhost"
    || host.startsWith("127.0.0.1:")
    || host === "127.0.0.1"
    || /^192\.168\.\d{1,3}\.\d{1,3}:\d+$/.test(host)
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)
    || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(host)
    || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
    || /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}:\d+$/.test(host)
    || /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host);
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
  const authenticatedUser = await fetchAuthenticatedUser(accessToken);
  let user = authenticatedUser;
  const migrated = migrateAuthIdentity(rolloverStateIfNeeded(current), user.id, user.email);
  const state = migrated.state;
  const devImpersonationUserId = readDevImpersonationUserId(req);
  if (isLocalDevRequest(req) && devImpersonationUserId && payload?.groupId) {
    const membership = state.groups?.[payload.groupId]?.memberships?.[devImpersonationUserId] || null;
    if (membership?.userId) {
      const impersonatedProfile = state.profiles?.[membership.userId] || null;
      user = {
        id: membership.userId,
        email: impersonatedProfile?.email || `${slugifyDevIdentity(membership.displayName)}@local.test`,
        raw: authenticatedUser.raw,
        devImpersonatedByUserId: authenticatedUser.id
      };
    }
  }
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

async function buildCanonicalWritableStateForAuthenticatedMutation(auth, groupId) {
  const canonicalCurrent = await buildCanonicalWritableStateForGroup(groupId, auth.state);
  return migrateAuthIdentity(
    rolloverStateIfNeeded(canonicalCurrent),
    auth.user.id,
    auth.user.email
  ).state;
}

async function buildCanonicalWritableStateForAuthenticatedGlobalMutation(auth) {
  const canonicalCurrent = await buildCanonicalWritableStateForAllGroups(auth.state);
  return migrateAuthIdentity(
    rolloverStateIfNeeded(canonicalCurrent),
    auth.user.id,
    auth.user.email
  ).state;
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

  const updated = {
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

  return {
    updated,
    settlement: settlements[payload.player],
    reason: `settlement:${payload.groupId}:${payload.monthKey}:${payload.player}`
  };
}

function assertGroupAdmin(state, groupId, user, actorDisplayName) {
  const group = state.groups?.[groupId];
  if (!group) {
    const error = new Error("Bloc not found");
    error.status = 404;
    throw error;
  }

  const isAdmin = isGroupAdminActor(group, user.id, actorDisplayName);
  if (!isAdmin) {
    const error = new Error("Only the admin can rebuild the projection");
    error.status = 403;
    throw error;
  }

  return group;
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
  const now = payload?.createdAt || new Date().toISOString();
  const id = String(payload?.createdGroupId || "").trim() || generateGroupId(groupName);
  const group = normalizeGroup({
    id,
    name: groupName,
    adminName: creatorName,
    adminUserId: actorUserId || null,
    inviteCode: String(payload?.inviteCode || "").trim().toUpperCase() || generateInviteCode(),
    createdAt: now,
    memberOrder: uniqueNames([creatorName, ...extraMembers]),
    memberships: actorUserId ? {
      [actorUserId]: {
        userId: actorUserId,
        displayName: creatorName,
        role: "admin",
        joinedAt: now
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
        updatedAt: now
      }
    },
    createdGroupId: id
  };
}

function applyMultiLog(current, payload) {
  const actor = String(payload?.actor || "").trim();
  const actorUserId = String(payload?.actorUserId || "").trim();
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

  // Always include the source group — targetGroupIds only contains the additional blocs.
  const allTargetIds = [...new Set([sourceGroupId, ...targetGroupIds])];
  for (const groupId of allTargetIds) {
    const group = updatedGroups[groupId];
    if (!group) continue;
    if (!isCurrentGroupMember(group, actor, actorUserId)) continue;
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
  const actorIsAdmin = isGroupAdminActor(group, actorUserId, actor);
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

async function runWriteHydrationParityProbe(action, payload, auth, actor, writableUpdated, applyMutation) {
  if (!isWriteHydrationParityEnabled(action)) return;
  const groupId = String(payload?.groupId || "").trim();
  try {
    const canonicalCurrent = await buildCanonicalWritableStateForGroup(groupId, auth.state);
    const canonicalAuthState = migrateAuthIdentity(rolloverStateIfNeeded(canonicalCurrent), auth.user.id, auth.user.email).state;
    const canonicalActor = resolveDisplayNameForUser(canonicalAuthState, groupId, auth.user.id, auth.user.email) || actor;
    const canonicalMutationResult = applyMutation(canonicalAuthState, {
      ...payload,
      actor: canonicalActor,
      actorUserId: auth.user.id
    });
    const canonicalUpdated = unwrapMutationState(canonicalMutationResult);

    const writableBlob = buildWriteHydrationComparisonBlob(writableUpdated, action);
    const canonicalBlob = buildWriteHydrationComparisonBlob(canonicalUpdated, action);
    const mismatchCollector = isCurrentOpenWriteHydrationAction(action)
      ? collectWriteHydrationCurrentOpenMismatches
      : collectWriteHydrationGroupMismatches;
    const mismatches = mismatchCollector(
      writableBlob.groups?.[groupId],
      canonicalBlob.groups?.[groupId],
      groupId
    );

    if (mismatches.length) {
      console.warn("[write-hydration-parity] mismatch", JSON.stringify({
        action,
        groupId,
        mismatches,
        writableGroups: Object.keys(writableBlob.groups || {}).length,
        canonicalGroups: Object.keys(canonicalBlob.groups || {}).length
      }));
    }
  } catch (err) {
    console.warn("[write-hydration-parity] probe failed", JSON.stringify({
      action,
      groupId,
      message: err?.message || String(err)
    }));
  }
}

async function compareWriteHydrationMutation(action, groupId, writableInput, canonicalInput, payload, applyMutation, options = {}) {
  try {
    const writableUpdated = unwrapMutationState(applyMutation(writableInput, payload));
    const canonicalUpdated = unwrapMutationState(applyMutation(canonicalInput, payload));
    const writableBlob = buildWriteHydrationComparisonBlob(writableUpdated, action);
    const canonicalBlob = buildWriteHydrationComparisonBlob(canonicalUpdated, action);
    const mismatchCollector = options.scope === "current-open"
      ? collectWriteHydrationCurrentOpenMismatches
      : collectWriteHydrationGroupMismatches;
    const mismatches = mismatchCollector(writableBlob.groups?.[groupId], canonicalBlob.groups?.[groupId], groupId);
    return {
      action,
      groupId,
      ...(options.scope ? { scope: options.scope } : {}),
      ok: mismatches.length === 0,
      mismatches,
      ...(mismatches.length
        ? {
            details: collectWriteHydrationGroupMismatchDetails(
              writableBlob.groups?.[groupId],
              canonicalBlob.groups?.[groupId],
              groupId,
              mismatches
            )
          }
        : {})
    };
  } catch (err) {
    return {
      action,
      groupId,
      ok: false,
      error: err?.message || String(err)
    };
  }
}

async function compareWriteHydrationAction(action, baseState, groupId, payload, applyMutation, options = {}) {
  try {
    const canonicalBase = await buildCanonicalWritableStateForGroup(groupId, baseState);
    return compareWriteHydrationMutation(action, groupId, baseState, canonicalBase, payload, applyMutation, options);
  } catch (err) {
    return {
      action,
      groupId,
      ...(options.scope ? { scope: options.scope } : {}),
      ok: false,
      error: err?.message || String(err)
    };
  }
}

function collectActiveAuthMembers(group) {
  return Object.values(group?.memberships || {})
    .filter(member => member?.userId && member?.displayName && isCurrentGroupMember(group, member.displayName, member.userId));
}

function findFirstCurrentLogCandidate(group, options = {}) {
  const {
    ownerName = null,
    excludeOwnerName = null,
    requireNonStrava = false,
    requireUnflagged = false
  } = options;
  for (const [owner, logs] of Object.entries(group?.logs || {})) {
    if (ownerName && owner !== ownerName) continue;
    if (excludeOwnerName && owner === excludeOwnerName) continue;
    for (const log of logs || []) {
      if (!log?.id) continue;
      if (requireNonStrava && log.verifiedVia === "strava") continue;
      if (requireUnflagged && log.flagStatus) continue;
      return { owner, log };
    }
  }
  return null;
}

function findSitOutRequestCandidate(groupId, group) {
  const members = collectActiveAuthMembers(group);
  for (const member of members) {
    try {
      applySitOutRequest({ version: 2, groups: { [groupId]: group }, groupOrder: [groupId], profiles: {}, meta: { revision: 0, updatedAt: null } }, {
        groupId,
        actor: member.displayName,
        actorUserId: member.userId,
        reason: "Parity probe",
        exceptional: false
      });
      return member;
    } catch (_) {
      // Try another member; current data may make this action ineligible.
    }
  }
  return null;
}

function findSitOutReviewCandidate(group) {
  const requests = normalizeSitOutRequests(group?.sitOutRequests);
  for (const [monthKey, monthRequests] of Object.entries(requests || {})) {
    for (const [memberName, request] of Object.entries(monthRequests || {})) {
      if (request?.status !== "pending") continue;
      const reviewer = collectActiveAuthMembers(group).find(member =>
        canReviewSitOutRequest(group, request, memberName, member.userId, member.displayName)
      );
      if (reviewer) return { monthKey, memberName, reviewer };
    }
  }
  return null;
}

function findSyntheticSitOutReviewCandidate(group) {
  const members = collectActiveAuthMembers(group);
  const admin = members.find(member => isGroupAdminActor(group, member.userId, member.displayName));
  if (!admin) return null;
  const requester = members.find(member => !isGroupAdminActor(group, member.userId, member.displayName));
  if (!requester) return null;
  const monthKey = group?.lastMonth || getLeagueMonthKey(group?.settings?.timeZone);
  return { monthKey, requester, reviewer: admin };
}

function withSyntheticPendingSitOutReviewRequest(state, groupId, candidate) {
  const group = state?.groups?.[groupId];
  if (!group || !candidate?.monthKey || !candidate?.requester?.displayName) return state;
  const requests = normalizeSitOutRequests(group.sitOutRequests);
  const memberName = candidate.requester.displayName;
  const pendingRequest = {
    memberName,
    monthKey: candidate.monthKey,
    status: "pending",
    reason: "Parity probe",
    exceptional: true,
    requestedAt: "2026-07-12T00:00:00.000Z",
    requestedBy: memberName,
    requestedByUserId: candidate.requester.userId || null,
    targetApproverName: candidate.reviewer.displayName || null,
    targetApproverUserId: candidate.reviewer.userId || null,
    decidedAt: null,
    decidedBy: null,
    decidedByUserId: null,
    autoApproved: false
  };
  return {
    ...state,
    groups: {
      ...(state.groups || {}),
      [groupId]: normalizeGroup({
        ...group,
        sitOutRequests: {
          ...requests,
          [candidate.monthKey]: {
            ...(requests[candidate.monthKey] || {}),
            [memberName]: pendingRequest
          }
        }
      })
    }
  };
}

function buildProbeDateForGroup(group, preferredDay = 15) {
  const monthKey = group?.lastMonth || getLeagueMonthKey(group?.settings?.timeZone);
  const [year, zeroBasedMonth] = String(monthKey || "").split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(zeroBasedMonth)) {
    return new Date().toISOString().slice(0, 10);
  }
  const month = zeroBasedMonth + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(1, preferredDay), daysInMonth);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function chooseProbeWorkoutType(group) {
  const accepted = Array.isArray(group?.settings?.acceptedWorkoutTypes) && group.settings.acceptedWorkoutTypes.length
    ? group.settings.acceptedWorkoutTypes
    : WORKOUT_TYPES;
  return accepted.includes("Gym") ? "Gym" : accepted[0];
}

function findCurrentLogWriteCandidate(group) {
  const actor = collectActiveAuthMembers(group)[0] || null;
  if (!actor) return null;
  return {
    actor,
    date: buildProbeDateForGroup(group, 16),
    workoutType: chooseProbeWorkoutType(group)
  };
}

function findMultiLogCandidate(baseState, sourceGroupId, sourceGroup, actor) {
  if (!actor?.userId || !actor?.displayName) return null;
  const targetGroupIds = (baseState.groupOrder || Object.keys(baseState.groups || {}))
    .filter(groupId => groupId !== sourceGroupId)
    .filter(groupId => {
      const group = baseState.groups?.[groupId];
      if (!group) return false;
      if (!isCurrentGroupMember(group, actor.displayName, actor.userId)) return false;
      const accepted = Array.isArray(group.settings?.acceptedWorkoutTypes) && group.settings.acceptedWorkoutTypes.length
        ? group.settings.acceptedWorkoutTypes
        : WORKOUT_TYPES;
      return accepted.includes(chooseProbeWorkoutType(sourceGroup));
    });
  if (!targetGroupIds.length) return null;
  return {
    actor,
    targetGroupIds,
    date: buildProbeDateForGroup(sourceGroup, 17),
    workoutType: chooseProbeWorkoutType(sourceGroup)
  };
}

function findKickMemberCandidate(group) {
  const activeMembers = collectActiveAuthMembers(group);
  const admin = activeMembers.find(member => isGroupAdminActor(group, member.userId, member.displayName));
  if (!admin) return null;
  const target = activeMembers.find(member =>
    member.userId !== admin.userId && !isGroupAdminActor(group, member.userId, member.displayName)
  );
  return target ? { admin, target } : null;
}

function findLeaveBlocCandidate(group) {
  const activeMembers = collectActiveAuthMembers(group);
  if (!activeMembers.length) return null;
  return activeMembers.find(member => !isGroupAdminActor(group, member.userId, member.displayName)) || activeMembers[0];
}

function collectJoinGroupCandidates(state) {
  const profiles = Object.entries(state.profiles || {})
    .map(([userId, profile]) => ({
      userId,
      email: String(profile?.email || "").trim().toLowerCase(),
      displayName: String(profile?.displayName || "").trim()
    }))
    .filter(profile => profile.userId && profile.email && profile.displayName);
  const groupIds = Array.isArray(state.groupOrder) && state.groupOrder.length
    ? state.groupOrder
    : Object.keys(state.groups || {});
  const candidates = [];
  for (const groupId of groupIds) {
    const group = state.groups?.[groupId];
    if (!group) continue;
    const currentMemberCount = Array.isArray(group.activeMemberOrder) && group.activeMemberOrder.length
      ? group.activeMemberOrder.length
      : (Object.keys(group.memberships || {}).length || group.memberOrder?.length || 0);
    if (currentMemberCount >= 20) continue;
    const candidate = profiles.find(profile =>
      !group.memberships?.[profile.userId] &&
      !group.memberOrder?.includes(profile.displayName)
    );
    if (!candidate) continue;
    candidates.push({
      groupId,
      inviteCode: group.inviteCode,
      userId: candidate.userId,
      email: candidate.email,
      displayName: candidate.displayName
    });
  }
  return candidates;
}

async function compareWriteHydrationMultiLog(baseState, sourceGroupId, payload) {
  try {
    const canonicalBase = await buildCanonicalWritableStateForGroup(sourceGroupId, baseState);
    const writableUpdated = applyMultiLog(baseState, payload);
    const canonicalUpdated = applyMultiLog(canonicalBase, payload);
    const writableBlob = buildWriteHydrationComparisonBlob(writableUpdated, "multi-log");
    const canonicalBlob = buildWriteHydrationComparisonBlob(canonicalUpdated, "multi-log");
    const checkedGroupIds = [...new Set([sourceGroupId, ...(payload.targetGroupIds || [])])];
    const mismatches = checkedGroupIds.flatMap(groupId =>
      collectWriteHydrationGroupMismatches(
        writableBlob.groups?.[groupId],
        canonicalBlob.groups?.[groupId],
        groupId
      )
    );
    return {
      action: "multi-log",
      groupId: sourceGroupId,
      ok: mismatches.length === 0,
      targetGroupIds: payload.targetGroupIds || [],
      mismatches
    };
  } catch (err) {
    return {
      action: "multi-log",
      groupId: sourceGroupId,
      ok: false,
      error: err?.message || String(err)
    };
  }
}

async function compareWriteHydrationMultiLogCurrentOpen(baseState, sourceGroupId, payload) {
  try {
    const canonicalBase = await buildCanonicalWritableStateForGroup(sourceGroupId, baseState);
    const writableUpdated = applyMultiLog(baseState, payload);
    const canonicalUpdated = applyMultiLog(canonicalBase, payload);
    const writableBlob = buildWriteHydrationComparisonBlob(writableUpdated, "multi-log");
    const canonicalBlob = buildWriteHydrationComparisonBlob(canonicalUpdated, "multi-log");
    const checkedGroupIds = [...new Set([sourceGroupId, ...(payload.targetGroupIds || [])])];
    const mismatches = checkedGroupIds.flatMap(groupId =>
      collectWriteHydrationCurrentOpenMismatches(
        writableBlob.groups?.[groupId],
        canonicalBlob.groups?.[groupId],
        groupId
      )
    );
    return {
      action: "multi-log",
      groupId: sourceGroupId,
      scope: "current-open",
      ok: mismatches.length === 0,
      targetGroupIds: payload.targetGroupIds || [],
      mismatches
    };
  } catch (err) {
    return {
      action: "multi-log",
      groupId: sourceGroupId,
      scope: "current-open",
      ok: false,
      error: err?.message || String(err)
    };
  }
}

function collectProfileRenameCandidates(state) {
  return Object.entries(state.profiles || {})
    .map(([userId, profile]) => {
      const email = String(profile?.email || "").trim().toLowerCase();
      const displayName = String(profile?.displayName || "").trim();
      if (!userId || !email || !displayName) return null;
      const oldNames = collectProfileRenameOldNames(state.groups || {}, userId, displayName);
      if (oldNames.size === 0) return null;
      return { userId, email, displayName, groupIds: [...oldNames.keys()] };
    })
    .filter(Boolean);
}

function collectCreateGroupCandidates(state) {
  return Object.entries(state.profiles || {})
    .map(([userId, profile]) => {
      const email = String(profile?.email || "").trim().toLowerCase();
      const displayName = String(profile?.displayName || "").trim();
      if (!userId || !email || !displayName) return null;
      return { userId, email, displayName };
    })
    .filter(Boolean);
}

function collectDeleteAccountCandidates(state) {
  return Object.entries(state.profiles || {})
    .map(([userId, profile]) => {
      const email = String(profile?.email || "").trim().toLowerCase();
      const displayName = String(profile?.displayName || "").trim();
      if (!userId || (!email && !displayName)) return null;
      const groupIds = Object.entries(state.groups || {})
        .filter(([, group]) => group?.memberships?.[userId])
        .map(([groupId]) => groupId);
      return { userId, email, displayName, groupIds };
    })
    .filter(Boolean);
}

function collectDeleteAccountTouchedGroupIds(writableInput, canonicalInput, userId) {
  const writableProfile = writableInput.profiles?.[userId] || null;
  const canonicalProfile = canonicalInput.profiles?.[userId] || null;
  const displayNames = uniqueNames([
    resolveDeletedAccountDisplayName(writableProfile, writableInput.groups, userId),
    resolveDeletedAccountDisplayName(canonicalProfile, canonicalInput.groups, userId)
  ].filter(Boolean));
  const groupIds = uniqueNames([
    ...Object.keys(writableInput.groups || {}),
    ...Object.keys(canonicalInput.groups || {})
  ]);
  return groupIds.filter(groupId => {
    const writableGroup = writableInput.groups?.[groupId] || null;
    const canonicalGroup = canonicalInput.groups?.[groupId] || null;
    if (writableGroup?.memberships?.[userId] || canonicalGroup?.memberships?.[userId]) return true;
    return displayNames.some(displayName =>
      writableGroup?.logs?.[displayName] ||
      canonicalGroup?.logs?.[displayName]
    );
  });
}

function buildSyntheticCreateGroupPayload(candidate) {
  const suffix = String(candidate.userId || "").slice(0, 8)
    || String(candidate.displayName || "user").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 8)
    || "user";
  const groupName = `Parity Create ${suffix}`;
  const createdGroupId = `parity-create-${suffix}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  return {
    groupName,
    creatorName: candidate.displayName,
    actorUserId: candidate.userId,
    createdGroupId,
    inviteCode: `P${suffix}`.replace(/[^A-Z0-9]/gi, "").slice(0, 8).toUpperCase().padEnd(6, "X"),
    createdAt: "2026-07-13T00:00:00.000Z",
    minTarget: DEFAULT_MIN_TARGET,
    fineAmount: DEFAULT_FINE_AMOUNT,
    feeModel: "flat",
    escalationStepAmount: null,
    currency: DEFAULT_CURRENCY,
    groupTimeZone: DEFAULT_GROUP_TIME_ZONE,
    acceptedWorkoutTypes: [...WORKOUT_TYPES],
    minRunDistance: DEFAULT_MIN_RUN_DISTANCE,
    distanceUnit: DEFAULT_DISTANCE_UNIT,
    stravaEnabled: DEFAULT_STRAVA_ENABLED,
    extraMembers: ""
  };
}

function buildSyntheticProfileRenameDisplayName(state, currentDisplayName, userId) {
  const base = `${currentDisplayName} Rename Probe`.trim();
  const usedNames = new Set(
    Object.values(state.groups || {})
      .flatMap(group => Array.isArray(group?.memberOrder) ? group.memberOrder : [])
      .filter(Boolean)
  );
  if (!usedNames.has(base)) return base;
  return `${base} ${String(userId || "").slice(0, 8) || "user"}`;
}

function compareCreateGroupResult(writableUpdated, canonicalUpdated, createdGroupId) {
  const writableBlob = buildWriteHydrationComparisonBlob(writableUpdated, "create-group");
  const canonicalBlob = buildWriteHydrationComparisonBlob(canonicalUpdated, "create-group");
  const mismatches = collectWriteHydrationCurrentOpenMismatches(
    writableBlob.groups?.[createdGroupId],
    canonicalBlob.groups?.[createdGroupId],
    createdGroupId
  );
  return {
    action: "create-group",
    scope: "current-open",
    groupId: createdGroupId,
    ok: mismatches.length === 0,
    mismatches,
    ...(mismatches.length
      ? {
          details: collectWriteHydrationGroupMismatchDetails(
            writableBlob.groups?.[createdGroupId],
            canonicalBlob.groups?.[createdGroupId],
            createdGroupId,
            mismatches
          )
        }
      : {})
  };
}

async function compareWriteHydrationCreateGroup(baseState, canonicalBase, candidate) {
  const payload = buildSyntheticCreateGroupPayload(candidate);
  try {
    const writableUpdated = applyCreateGroup(baseState, payload);
    const canonicalUpdated = applyCreateGroup(canonicalBase, payload);
    return compareCreateGroupResult(writableUpdated.state, canonicalUpdated.state, payload.createdGroupId);
  } catch (err) {
    return {
      action: "create-group",
      scope: "current-open",
      groupId: payload.createdGroupId,
      ok: false,
      error: err?.message || String(err)
    };
  }
}

async function compareWriteHydrationDeleteAccount(baseState, canonicalBase, candidate) {
  const payload = { userId: candidate.userId };
  try {
    const writableUpdated = applyDeleteAccount(baseState, payload);
    const canonicalUpdated = applyDeleteAccount(canonicalBase, payload);
    const writableBlob = buildWriteHydrationComparisonBlob(writableUpdated, "delete-account");
    const canonicalBlob = buildWriteHydrationComparisonBlob(canonicalUpdated, "delete-account");
    const touchedGroupIds = collectDeleteAccountTouchedGroupIds(baseState, canonicalBase, candidate.userId);
    const profileMismatches = valuesDiffer(
      writableBlob.profiles?.[candidate.userId] || null,
      canonicalBlob.profiles?.[candidate.userId] || null
    )
      ? [`profiles.${candidate.userId}`]
      : [];
    const orderMismatches = valuesDiffer(writableBlob.groupOrder || [], canonicalBlob.groupOrder || [])
      ? ["groupOrder"]
      : [];
    const groupMismatches = touchedGroupIds.flatMap(groupId =>
      collectWriteHydrationCurrentOpenMismatches(
        writableBlob.groups?.[groupId],
        canonicalBlob.groups?.[groupId],
        groupId
      )
    );
    const mismatches = [...profileMismatches, ...orderMismatches, ...groupMismatches];
    return {
      action: "delete-account",
      scope: "global-account-current-open",
      userId: candidate.userId,
      groupIds: touchedGroupIds,
      ok: mismatches.length === 0,
      mismatches,
      ...(mismatches.length
        ? {
            details: Object.fromEntries(
              mismatches.map(mismatch => {
                if (mismatch === "groupOrder") {
                  return [mismatch, findFirstNestedDifference(writableBlob.groupOrder, canonicalBlob.groupOrder, mismatch)];
                }
                if (mismatch === `profiles.${candidate.userId}`) {
                  return [mismatch, findFirstNestedDifference(
                    writableBlob.profiles?.[candidate.userId] || null,
                    canonicalBlob.profiles?.[candidate.userId] || null,
                    mismatch
                  )];
                }
                const groupId = mismatch.match(/^groups\.([^.]+)\./)?.[1] || "";
                return [mismatch, collectWriteHydrationGroupMismatchDetails(
                  writableBlob.groups?.[groupId],
                  canonicalBlob.groups?.[groupId],
                  groupId,
                  [mismatch]
                )[mismatch]];
              })
            )
          }
        : {})
    };
  } catch (err) {
    return {
      action: "delete-account",
      scope: "global-account-current-open",
      userId: candidate.userId,
      groupIds: candidate.groupIds || [],
      ok: false,
      error: err?.message || String(err)
    };
  }
}

function collectProfileRenameTouchedGroupIds(writableInput, canonicalInput, userId, existingDisplayName) {
  return uniqueNames([
    ...collectProfileRenameOldNames(writableInput.groups || {}, userId, existingDisplayName).keys(),
    ...collectProfileRenameOldNames(canonicalInput.groups || {}, userId, existingDisplayName).keys()
  ]);
}

function compareProfileEntryMismatch(writableProfile, canonicalProfile, userId) {
  const comparableWritable = writableProfile ? { ...writableProfile, createdAt: "<ignored>" } : writableProfile;
  const comparableCanonical = canonicalProfile ? { ...canonicalProfile, createdAt: "<ignored>" } : canonicalProfile;
  return valuesDiffer(comparableWritable, comparableCanonical) ? [`profiles.${userId}`] : [];
}

function summarizeReportMismatchField(mismatch) {
  if (mismatch.startsWith("profiles.")) return "profiles.*";
  return mismatch.replace(/^groups\.[^.]+\./, "");
}

async function compareWriteHydrationProfileRename(baseState, canonicalBase, candidate, options = {}) {
  const payload = {
    userId: candidate.userId,
    email: candidate.email,
    displayName: buildSyntheticProfileRenameDisplayName(baseState, candidate.displayName, candidate.userId)
  };
  try {
    const writableUpdated = applyUpsertProfile(baseState, payload);
    const canonicalUpdated = applyUpsertProfile(canonicalBase, payload);
    const writableBlob = buildWriteHydrationComparisonBlob(writableUpdated, "upsert-profile");
    const canonicalBlob = buildWriteHydrationComparisonBlob(canonicalUpdated, "upsert-profile");
    const touchedGroupIds = collectProfileRenameTouchedGroupIds(baseState, canonicalBase, candidate.userId, candidate.displayName);
    const profileMismatches = compareProfileEntryMismatch(
      writableBlob.profiles?.[candidate.userId],
      canonicalBlob.profiles?.[candidate.userId],
      candidate.userId
    );
    const groupMismatchCollector = options.scope === "current-open"
      ? collectWriteHydrationCurrentOpenMismatches
      : collectWriteHydrationGroupMismatches;
    const groupMismatches = touchedGroupIds.flatMap(groupId =>
      groupMismatchCollector(
        writableBlob.groups?.[groupId],
        canonicalBlob.groups?.[groupId],
        groupId
      )
    );
    const mismatches = [...profileMismatches, ...groupMismatches];
    return {
      action: "upsert-profile",
      scope: options.scope || "identity-rename",
      userId: candidate.userId,
      groupIds: touchedGroupIds,
      ok: mismatches.length === 0,
      mismatches,
      ...(mismatches.length
        ? {
            details: Object.fromEntries(
              mismatches.map(mismatch => {
                if (mismatch === `profiles.${candidate.userId}`) {
                  return [mismatch, findFirstNestedDifference(
                    writableBlob.profiles?.[candidate.userId],
                    canonicalBlob.profiles?.[candidate.userId],
                    mismatch
                  )];
                }
                const groupId = mismatch.match(/^groups\.([^.]+)\./)?.[1] || "";
                return [mismatch, collectWriteHydrationGroupMismatchDetails(
                  writableBlob.groups?.[groupId],
                  canonicalBlob.groups?.[groupId],
                  groupId,
                  [mismatch]
                )[mismatch]];
              })
            )
          }
        : {})
    };
  } catch (err) {
    return {
      action: "upsert-profile",
      scope: options.scope || "identity-rename",
      userId: candidate.userId,
      groupIds: candidate.groupIds || [],
      ok: false,
      error: err?.message || String(err)
    };
  }
}

async function compareWriteHydrationJoinGroup(baseState, canonicalBase, candidate) {
  const payload = {
    groupId: candidate.groupId,
    inviteCode: candidate.inviteCode,
    userId: candidate.userId
  };
  try {
    const writableUpdated = unwrapMutationState(applyJoinGroup(baseState, payload));
    const canonicalUpdated = unwrapMutationState(applyJoinGroup(canonicalBase, payload));
    const writableBlob = buildWriteHydrationComparisonBlob(writableUpdated.state || writableUpdated, "join-group");
    const canonicalBlob = buildWriteHydrationComparisonBlob(canonicalUpdated.state || canonicalUpdated, "join-group");
    const mismatches = collectWriteHydrationCurrentOpenMismatches(
      writableBlob.groups?.[candidate.groupId],
      canonicalBlob.groups?.[candidate.groupId],
      candidate.groupId
    );
    return {
      action: "join-group",
      scope: "current-open",
      groupId: candidate.groupId,
      userId: candidate.userId,
      ok: mismatches.length === 0,
      mismatches,
      ...(mismatches.length
        ? {
            details: collectWriteHydrationGroupMismatchDetails(
              writableBlob.groups?.[candidate.groupId],
              canonicalBlob.groups?.[candidate.groupId],
              candidate.groupId,
              mismatches
            )
          }
        : {})
    };
  } catch (err) {
    return {
      action: "join-group",
      scope: "current-open",
      groupId: candidate.groupId,
      userId: candidate.userId,
      ok: false,
      error: err?.message || String(err)
    };
  }
}

async function buildWriteHydrationParityReport(baseState) {
  const results = [];
  const addSkipped = (action, groupId, reason, scope = null) => results.push({
    action,
    groupId,
    ...(scope ? { scope } : {}),
    ok: null,
    skipped: true,
    reason
  });

  const groupIds = Array.isArray(baseState.groupOrder) && baseState.groupOrder.length
    ? baseState.groupOrder
    : Object.keys(baseState.groups || {});
  for (const groupId of groupIds) {
    const group = baseState.groups?.[groupId];
    if (!group) continue;
    const activeMembers = collectActiveAuthMembers(group);
    const admin = activeMembers.find(member => isGroupAdminActor(group, member.userId, member.displayName));

    if (admin) {
      results.push(await compareWriteHydrationAction("update-settings", baseState, groupId, {
        groupId,
        groupName: group.name,
        settings: group.settings || {},
        actor: admin.displayName,
        actorUserId: admin.userId
      }, applyUpdateSettings));
      results.push(await compareWriteHydrationAction("season-proration-choice", baseState, groupId, {
        groupId,
        choice: "keep",
        actor: admin.displayName,
        actorUserId: admin.userId
      }, applySeasonProrationChoice));

      const kickCandidate = findKickMemberCandidate(group);
      if (kickCandidate) {
        const kickPayload = {
          groupId,
          targetUserId: kickCandidate.target.userId,
          targetDisplayName: kickCandidate.target.displayName,
          actorDisplayName: kickCandidate.admin.displayName,
          actorUserId: kickCandidate.admin.userId
        };
        results.push(await compareWriteHydrationAction("kick-member", baseState, groupId, kickPayload, applyKickMember));
        results.push(await compareWriteHydrationAction("kick-member", baseState, groupId, kickPayload, applyKickMember, { scope: "current-open" }));
      } else {
        addSkipped("kick-member", groupId, "no active non-admin target candidate");
        addSkipped("kick-member", groupId, "no active non-admin target candidate", "current-open");
      }
    } else {
      addSkipped("update-settings", groupId, "no active admin candidate");
      addSkipped("season-proration-choice", groupId, "no active admin candidate");
      addSkipped("kick-member", groupId, "no active admin candidate");
      addSkipped("kick-member", groupId, "no active admin candidate", "current-open");
    }

    const actor = activeMembers[0];
    if (!actor) {
      addSkipped("reaction", groupId, "no active member candidate");
      addSkipped("delete-log", groupId, "no active member candidate");
      addSkipped("sitout-request", groupId, "no active member candidate");
      addSkipped("add-log", groupId, "no active member candidate");
      addSkipped("multi-log", groupId, "no active member candidate");
      addSkipped("leave-bloc", groupId, "no active member candidate");
      addSkipped("leave-bloc", groupId, "no active member candidate", "current-open");
      continue;
    }

    const addLogCandidate = findCurrentLogWriteCandidate(group);
    if (addLogCandidate) {
      const addLogPayload = {
        groupId,
        date: addLogCandidate.date,
        workoutType: addLogCandidate.workoutType,
        note: "Parity probe",
        photoUrl: "https://example.com/parity-probe.jpg",
        actor: addLogCandidate.actor.displayName,
        actorUserId: addLogCandidate.actor.userId
      };
      results.push(await compareWriteHydrationAction("add-log", baseState, groupId, addLogPayload, applyAddLog));
      results.push(await compareWriteHydrationAction("add-log", baseState, groupId, addLogPayload, applyAddLog, { scope: "current-open" }));
    } else {
      addSkipped("add-log", groupId, "no current log writer candidate");
      addSkipped("add-log", groupId, "no current log writer candidate", "current-open");
    }

    const multiLogCandidate = findMultiLogCandidate(baseState, groupId, group, actor);
    if (multiLogCandidate) {
      const multiLogPayload = {
        sourceGroupId: groupId,
        targetGroupIds: multiLogCandidate.targetGroupIds,
        date: multiLogCandidate.date,
        workoutType: multiLogCandidate.workoutType,
        note: "Parity probe",
        photoUrl: "https://example.com/parity-probe.jpg",
        actor: multiLogCandidate.actor.displayName,
        actorUserId: multiLogCandidate.actor.userId
      };
      results.push(await compareWriteHydrationMultiLog(baseState, groupId, multiLogPayload));
      results.push(await compareWriteHydrationMultiLogCurrentOpen(baseState, groupId, multiLogPayload));
    } else {
      addSkipped("multi-log", groupId, "no shared-member target bloc candidate");
      addSkipped("multi-log", groupId, "no shared-member target bloc candidate", "current-open");
    }

    const leaveCandidate = findLeaveBlocCandidate(group);
    if (leaveCandidate) {
      const leavePayload = {
        groupId,
        userId: leaveCandidate.userId
      };
      results.push(await compareWriteHydrationAction("leave-bloc", baseState, groupId, leavePayload, applyLeaveBloc));
      results.push(await compareWriteHydrationAction("leave-bloc", baseState, groupId, leavePayload, applyLeaveBloc, { scope: "current-open" }));
    } else {
      addSkipped("leave-bloc", groupId, "no active leave candidate");
      addSkipped("leave-bloc", groupId, "no active leave candidate", "current-open");
    }

    const anyLog = findFirstCurrentLogCandidate(group);
    if (anyLog) {
      results.push(await compareWriteHydrationAction("reaction", baseState, groupId, {
        groupId,
        owner: anyLog.owner,
        logId: anyLog.log.id,
        emoji: "👍",
        actor: actor.displayName,
        actorUserId: actor.userId
      }, applyToggleReaction));
    } else {
      addSkipped("reaction", groupId, "no current workout log candidate");
    }

    const ownLog = findFirstCurrentLogCandidate(group, { ownerName: actor.displayName });
    if (ownLog) {
      results.push(await compareWriteHydrationAction("delete-log", baseState, groupId, {
        groupId,
        owner: actor.displayName,
        logId: ownLog.log.id,
        actor: actor.displayName,
        actorUserId: actor.userId
      }, applyDeleteLog));
    } else {
      addSkipped("delete-log", groupId, "no current log owned by sampled member");
    }

    const flagActor = activeMembers.find(member => findFirstCurrentLogCandidate(group, {
      excludeOwnerName: member.displayName,
      requireNonStrava: true,
      requireUnflagged: true
    }));
    const flagCandidate = flagActor
      ? findFirstCurrentLogCandidate(group, {
          excludeOwnerName: flagActor.displayName,
          requireNonStrava: true,
          requireUnflagged: true
        })
      : null;
    if (flagActor && flagCandidate) {
      try {
        const canonicalBase = await buildCanonicalWritableStateForGroup(groupId, baseState);
        const flagPayload = {
          groupId,
          owner: flagCandidate.owner,
          logId: flagCandidate.log.id,
          reason: "Parity probe",
          actor: flagActor.displayName,
          actorUserId: flagActor.userId
        };
        results.push(await compareWriteHydrationMutation("flag", groupId, baseState, canonicalBase, flagPayload, applyFlagLog));

        const writableFlagged = unwrapMutationState(applyFlagLog(baseState, flagPayload));
        const canonicalFlagged = unwrapMutationState(applyFlagLog(canonicalBase, flagPayload));
        const ownerMember = activeMembers.find(member => member.displayName === flagCandidate.owner);
        if (ownerMember) {
          results.push(await compareWriteHydrationMutation("flag-response", groupId, writableFlagged, canonicalFlagged, {
            groupId,
            owner: flagCandidate.owner,
            logId: flagCandidate.log.id,
            response: "Parity response",
            actor: ownerMember.displayName,
            actorUserId: ownerMember.userId
          }, applyRespondToFlag));
        } else {
          addSkipped("flag-response", groupId, "flag owner has no active auth membership candidate");
        }
        if (admin) {
          results.push(await compareWriteHydrationMutation("flag-review", groupId, writableFlagged, canonicalFlagged, {
            groupId,
            owner: flagCandidate.owner,
            logId: flagCandidate.log.id,
            decision: "reject",
            actor: admin.displayName,
            actorUserId: admin.userId
          }, applyReviewFlag));
        } else {
          addSkipped("flag-review", groupId, "no active admin candidate");
        }
      } catch (err) {
        const error = err?.message || String(err);
        results.push({ action: "flag", groupId, ok: false, error });
        results.push({ action: "flag-response", groupId, ok: false, error });
        results.push({ action: "flag-review", groupId, ok: false, error });
      }
    } else {
      addSkipped("flag", groupId, "no safe non-Strava cross-member log candidate");
      addSkipped("flag-response", groupId, "no safe non-Strava cross-member log candidate");
      addSkipped("flag-review", groupId, "no safe non-Strava cross-member log candidate");
    }

    const sitOutActor = findSitOutRequestCandidate(groupId, group);
    if (sitOutActor) {
      results.push(await compareWriteHydrationAction("sitout-request", baseState, groupId, {
        groupId,
        reason: "Parity probe",
        exceptional: false,
        actor: sitOutActor.displayName,
        actorUserId: sitOutActor.userId
      }, applySitOutRequest));
    } else {
      addSkipped("sitout-request", groupId, "no eligible current sit-out requester");
    }

    const reviewCandidate = findSitOutReviewCandidate(group);
    if (reviewCandidate) {
      results.push(await compareWriteHydrationAction("sitout-review", baseState, groupId, {
        groupId,
        monthKey: reviewCandidate.monthKey,
        memberName: reviewCandidate.memberName,
        decision: "decline",
        actor: reviewCandidate.reviewer.displayName,
        actorUserId: reviewCandidate.reviewer.userId
      }, applySitOutReview));
    } else {
      const syntheticCandidate = findSyntheticSitOutReviewCandidate(group);
      if (syntheticCandidate) {
        try {
          const canonicalBase = await buildCanonicalWritableStateForGroup(groupId, baseState);
          const writableSynthetic = withSyntheticPendingSitOutReviewRequest(baseState, groupId, syntheticCandidate);
          const canonicalSynthetic = withSyntheticPendingSitOutReviewRequest(canonicalBase, groupId, syntheticCandidate);
          results.push(await compareWriteHydrationMutation("sitout-review", groupId, writableSynthetic, canonicalSynthetic, {
            groupId,
            monthKey: syntheticCandidate.monthKey,
            memberName: syntheticCandidate.requester.displayName,
            decision: "decline",
            actor: syntheticCandidate.reviewer.displayName,
            actorUserId: syntheticCandidate.reviewer.userId
          }, applySitOutReview));
        } catch (err) {
          results.push({
            action: "sitout-review",
            groupId,
            ok: false,
            error: err?.message || String(err)
          });
        }
      } else {
        addSkipped("sitout-review", groupId, "no pending or synthetic sit-out review candidate");
      }
    }
  }

  const createGroupCandidates = collectCreateGroupCandidates(baseState);
  if (createGroupCandidates.length > 0) {
    try {
      const canonicalGlobalBase = await buildCanonicalWritableStateForAllGroups(baseState);
      for (const candidate of createGroupCandidates.slice(0, 12)) {
        results.push(await compareWriteHydrationCreateGroup(baseState, canonicalGlobalBase, candidate));
      }
      if (createGroupCandidates.length > 12) {
        addSkipped("create-group", null, `${createGroupCandidates.length - 12} additional create candidates omitted`, "current-open");
      }
    } catch (err) {
      results.push({
        action: "create-group",
        scope: "current-open",
        groupId: null,
        ok: false,
        error: err?.message || String(err)
      });
    }
  } else {
    addSkipped("create-group", null, "no profile candidate", "current-open");
  }

  const profileRenameCandidates = collectProfileRenameCandidates(baseState);
  if (profileRenameCandidates.length > 0) {
    try {
      const canonicalGlobalBase = await buildCanonicalWritableStateForAllGroups(baseState);
      for (const candidate of profileRenameCandidates.slice(0, 12)) {
        results.push(await compareWriteHydrationProfileRename(baseState, canonicalGlobalBase, candidate));
        results.push(await compareWriteHydrationProfileRename(baseState, canonicalGlobalBase, candidate, { scope: "current-open" }));
      }
      if (profileRenameCandidates.length > 12) {
        addSkipped("upsert-profile", null, `${profileRenameCandidates.length - 12} additional identity rename candidates omitted`, "identity-rename");
        addSkipped("upsert-profile", null, `${profileRenameCandidates.length - 12} additional current/open rename candidates omitted`, "current-open");
      }
    } catch (err) {
      results.push({
        action: "upsert-profile",
        scope: "identity-rename",
        groupId: null,
        ok: false,
        error: err?.message || String(err)
      });
      results.push({
        action: "upsert-profile",
        scope: "current-open",
        groupId: null,
        ok: false,
        error: err?.message || String(err)
      });
    }
  } else {
    addSkipped("upsert-profile", null, "no profile rename candidate", "identity-rename");
    addSkipped("upsert-profile", null, "no profile rename candidate", "current-open");
  }

  const joinGroupCandidates = collectJoinGroupCandidates(baseState);
  if (joinGroupCandidates.length > 0) {
    try {
      const canonicalGlobalBase = await buildCanonicalWritableStateForAllGroups(baseState);
      for (const candidate of joinGroupCandidates.slice(0, 12)) {
        results.push(await compareWriteHydrationJoinGroup(baseState, canonicalGlobalBase, candidate));
      }
      if (joinGroupCandidates.length > 12) {
        addSkipped("join-group", null, `${joinGroupCandidates.length - 12} additional join candidates omitted`, "current-open");
      }
    } catch (err) {
      results.push({
        action: "join-group",
        scope: "current-open",
        groupId: null,
        ok: false,
        error: err?.message || String(err)
      });
    }
  } else {
    addSkipped("join-group", null, "no safe cross-bloc profile candidate", "current-open");
  }

  const deleteAccountCandidates = collectDeleteAccountCandidates(baseState);
  if (deleteAccountCandidates.length > 0) {
    try {
      const canonicalGlobalBase = await buildCanonicalWritableStateForAllGroups(baseState);
      for (const candidate of deleteAccountCandidates.slice(0, 12)) {
        results.push(await compareWriteHydrationDeleteAccount(baseState, canonicalGlobalBase, candidate));
      }
      if (deleteAccountCandidates.length > 12) {
        addSkipped("delete-account", null, `${deleteAccountCandidates.length - 12} additional account deletion candidates omitted`, "global-account-current-open");
      }
    } catch (err) {
      results.push({
        action: "delete-account",
        scope: "global-account-current-open",
        groupId: null,
        ok: false,
        error: err?.message || String(err)
      });
    }
  } else {
    addSkipped("delete-account", null, "no profile candidate", "global-account-current-open");
  }

  const failed = results.filter(result => result.ok === false);
  const skipped = results.filter(result => result.skipped);
  const summary = results.reduce((acc, result) => {
    const key = result.scope ? `${result.action}:${result.scope}` : result.action;
    const entry = acc[key] || { checked: 0, skipped: 0, failed: 0 };
    if (result.skipped) entry.skipped += 1;
    else {
      entry.checked += 1;
      if (result.ok === false) entry.failed += 1;
    }
    acc[key] = entry;
    return acc;
  }, {});
  const mismatchSummary = failed.reduce((acc, result) => {
    for (const mismatch of result.mismatches || []) {
      const field = summarizeReportMismatchField(mismatch);
      const entry = acc[field] || { count: 0, examplePath: null };
      entry.count += 1;
      if (!entry.examplePath) {
        entry.examplePath = result.details?.[mismatch]?.path?.replace(/^groups\.[^.]+\./, "") || field;
      }
      acc[field] = entry;
    }
    return acc;
  }, {});
  return {
    ok: failed.length === 0,
    checked: results.length - skipped.length,
    skipped: skipped.length,
    failed: failed.length,
    summary,
    mismatchSummary,
    excludedActions: [
      {
        action: "auth-sync",
        status: "blob-writable-by-design",
        reason: "Legacy identity repair can expose blob gaps that readable or canonical projections intentionally hide."
      },
      {
        action: "upsert-profile",
        status: "canonical-first-global-identity-report-covered",
        reason: "Global profile/name-key rewrite writes canonical first; identity-rename report coverage compares synthetic rename behavior without changing runtime."
      },
      {
        action: "delete-account",
        status: "canonical-first-global-account-report-covered",
        reason: "Global destructive account scope is covered by synthetic current/open report probes; runtime validates against the blob shell, then computes from canonical global input."
      },
      {
        action: "repair-display-name",
        status: "quarantined-admin-repair",
        reason: "Admin-only compatibility repair for legacy name-keyed data; not a normal product rename flow."
      },
      {
        action: "settlement",
        status: "canonical-first-historical-admin",
        reason: "Legacy admin historical settlement write touches closed month snapshots outside current/open report scope."
      }
    ],
    results
  };
}

function applyAddLog(current, payload) {
  const actor = String(payload?.actor || "").trim();
  const actorUserId = String(payload?.actorUserId || "").trim();
  const groupId = String(payload?.groupId || "").trim();
  const date = String(payload?.date || "").trim();
  const note = typeof payload?.note === "string" ? payload.note : "";
  const photoUrl = typeof payload?.photoUrl === "string" ? payload.photoUrl : "";
  const workoutType = normalizeLoggedWorkoutType(String(payload?.workoutType || "").trim(), date);
  if (!actor || !groupId || !date || !workoutType) {
    const error = new Error("groupId, actor, date, and workoutType are required");
    error.status = 400;
    throw error;
  }

  const base = rolloverStateIfNeeded(current);
  const group = base.groups?.[groupId];
  if (!group) {
    const error = new Error("Bloc not found");
    error.status = 404;
    throw error;
  }
  if (!isCurrentGroupMember(group, actor, actorUserId)) {
    const error = new Error("Not a member");
    error.status = 403;
    throw error;
  }

  const accepted = group.settings?.acceptedWorkoutTypes || WORKOUT_TYPES;
  if (!accepted.includes(workoutType)) {
    const error = new Error("Workout type is not accepted in this Bloc");
    error.status = 400;
    throw error;
  }

  const log = normalizeLogEntry({
    id: String(Date.now()),
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
  });

  const targetMonthKey = getMonthKeyFromISO(date);
  if (targetMonthKey !== group.lastMonth) {
    const error = new Error("You can't log to a closed month.");
    error.status = 400;
    throw error;
  }

  const nextGroup = normalizeGroup({
    ...group,
    logs: {
      ...group.logs,
      [actor]: [...(group.logs?.[actor] || []), log]
    }
  });

  return {
    updated: {
      ...base,
      groups: {
        ...base.groups,
        [groupId]: nextGroup
      },
      meta: {
        revision: base.meta.revision + 1,
        updatedAt: new Date().toISOString()
      }
    },
    log,
    monthKey: targetMonthKey,
    reason: `add-log:${groupId}:${actor}:${log.id}`
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
  const actorIsAdmin = isGroupAdminActor(group, actorUserId, actor);
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
  if (!isCurrentGroupMember(group, actor, actorUserId)) {
    const error = new Error("Only Bloc members can request a sit-out");
    error.status = 403;
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
  const actorIsAdmin = isGroupAdminActor(group, actorUserId, actor);
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
  if (!canReviewSitOutRequest(group, request, memberName, actorUserId, actor)) {
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
  const actorUserId = String(payload?.actorUserId || "").trim();
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
  const updatedLog = updater({ group, actor, actorUserId, owner, log: ownerLogs[logIndex] });
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
  const actorUserId = String(payload?.actorUserId || "").trim();
  const groupId = String(payload?.groupId || "").trim();
  const logId = String(payload?.logId || "").trim();
  const base = rolloverStateIfNeeded(current);
  const group = base.groups[groupId];
  if (!group) { const e = new Error("Bloc not found"); e.status = 404; throw e; }
  if (!isCurrentGroupMember(group, actor, actorUserId)) { const e = new Error("Not a member"); e.status = 403; throw e; }
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
  return updateGroupLog(current, payload, ({ group, actor, actorUserId, log }) => {
    if (!isCurrentGroupMember(group, actor, actorUserId)) {
      const error = new Error("Only Bloc members can react to workouts");
      error.status = 403;
      throw error;
    }
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
  return updateGroupLog(current, payload, ({ group, actor, actorUserId, owner, log }) => {
    if (isGroupDisplayNameForActor(group, owner, actorUserId, actor)) {
      const error = new Error("You cannot flag your own workout");
      error.status = 400;
      throw error;
    }
    if (!isCurrentGroupMember(group, actor, actorUserId)) {
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
  return updateGroupLog(current, payload, ({ group, actor, actorUserId, owner, log }) => {
    if (!isGroupDisplayNameForActor(group, owner, actorUserId, actor)) {
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
    const actorIsAdmin = isGroupAdminActor(group, actorUserId, actor);
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

function resolveProfileRenameOldName(group, userId, existingDisplayName) {
  const fromMembership = group.memberships?.[userId]?.displayName || null;
  if (fromMembership) return fromMembership;
  return existingDisplayName && group.memberOrder?.includes(existingDisplayName)
    ? existingDisplayName
    : null;
}

function collectProfileRenameOldNames(groups, userId, existingDisplayName) {
  return new Map(
    Object.entries(groups)
      .map(([groupId, group]) => [groupId, resolveProfileRenameOldName(group, userId, existingDisplayName)])
      .filter(([, name]) => name !== null)
  );
}

function groupDisplayNameBelongsToUser(group, displayName, userId) {
  if (!group || !displayName || !userId) return false;
  const activeMatch = Object.values(group.memberships || {}).some(membership =>
    membership?.userId === userId && membership?.displayName === displayName
  );
  if (activeMatch) return true;
  return (group.monthHistory || []).some(month =>
    month?.memberAuthUserIds?.[displayName] === userId
  );
}

function assertProfileRenameDoesNotCollide(groups, oldNames, displayName, userId = "") {
  for (const [groupId, group] of Object.entries(groups)) {
    const oldName = oldNames.get(groupId);
    if (!oldName || oldName === displayName) continue;
    const conflictingActiveMembership = Object.values(group.memberships || {}).find(membership =>
      membership?.displayName === displayName && membership?.userId !== userId
    );
    if (conflictingActiveMembership || (group.memberOrder.includes(displayName) && !groupDisplayNameBelongsToUser(group, displayName, userId) && Object.keys(group.memberships || {}).length === 0)) {
      const error = new Error(`That name is already taken in ${group.name || "a Bloc"}`);
      error.status = 409;
      throw error;
    }
  }
}

function renameGroupDisplayNameSurfaces(group, userId, oldName, displayName, options = {}) {
  const { createMissingMembership = true } = options;
  const nextMemberOrder = group.memberOrder.map(n => n === oldName ? displayName : n);

  const shouldRewriteMembership = !!group.memberships?.[userId] || createMissingMembership;
  const nextMemberships = shouldRewriteMembership
    ? {
        ...group.memberships,
        [userId]: { ...group.memberships[userId], displayName }
      }
    : group.memberships;

  const nextAdminName = group.adminName === oldName ? displayName : group.adminName;

  const nextMonthHistory = (Array.isArray(group.monthHistory) ? group.monthHistory : []).map(month => ({
    ...month,
    counts:      renameKey(month.counts      || {}, oldName, displayName),
    excused:     renameKey(month.excused     || {}, oldName, displayName),
    logsByUser:  renameKey(month.logsByUser  || {}, oldName, displayName),
    settlements: renameKey(month.settlements || {}, oldName, displayName),
    ...(month.memberTargets ? { memberTargets: renameKey(month.memberTargets, oldName, displayName) } : {}),
    ...(month.memberAuthUserIds ? { memberAuthUserIds: renameKey(month.memberAuthUserIds, oldName, displayName) } : {})
  }));

  const nextSitOutRequests = Object.fromEntries(
    Object.entries(group.sitOutRequests || {}).map(([monthKey, requests]) => [
      monthKey,
      renameKey(requests || {}, oldName, displayName)
    ])
  );
  const nextSettlementConfirmations = (group.settlementConfirmations || []).map(row => ({
    ...row,
    payerDisplayName: row?.payerAuthUserId === userId || row?.payerDisplayName === oldName
      ? displayName
      : row?.payerDisplayName,
    receiverDisplayName: row?.receiverAuthUserId === userId || row?.receiverDisplayName === oldName
      ? displayName
      : row?.receiverDisplayName
  }));

  return normalizeGroup({
    ...group,
    memberOrder:       nextMemberOrder,
    memberships:       nextMemberships,
    adminName:         nextAdminName,
    logs:              renameKey(group.logs              || {}, oldName, displayName),
    excused:           renameKey(group.excused           || {}, oldName, displayName),
    joinedMonthByName: renameKey(group.joinedMonthByName || {}, oldName, displayName),
    sitOutRequests:    nextSitOutRequests,
    settlementConfirmations: nextSettlementConfirmations,
    monthHistory:      nextMonthHistory
  });
}

function renameLegacyLeftMemberName(leftMemberNames, oldName, newName) {
  return uniqueNames(
    (Array.isArray(leftMemberNames) ? leftMemberNames : []).map(name =>
      name === oldName ? newName : name
    )
  );
}

function shouldRecordJoinedMonthForJoin(group, displayName, joinMonthKey) {
  const isNewToMemberOrder = !group.memberOrder.includes(displayName);
  return isNewToMemberOrder || !hasParticipationBeforeMonth(group, displayName, joinMonthKey);
}

function resolveKickTarget(group, targetUserId, targetDisplayName) {
  const targetMembership = targetUserId
    ? group.memberships?.[targetUserId]
    : Object.values(group.memberships || {}).find(membership => membership?.displayName === targetDisplayName);
  return {
    membership: targetMembership,
    displayName: targetMembership?.displayName || targetDisplayName
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
  const groups = base.groups || {};

  // Determine the old display name for each group this user is part of.
  // Primary source: memberships[userId].displayName — the authoritative record
  // for what name is currently keyed into group state for auth-linked members.
  // Fallback: existing.displayName (the pre-rename profile name) when no
  // memberships[userId] row exists yet — this covers legacy members present only
  // via memberOrder who have not yet had their membership record wired, and is
  // the same condition migrateAuthIdentity uses to wire a missing membership on
  // login. Note: if existing.displayName has already been changed to the new
  // name in a prior partial update, neither source can recover the old name;
  // those cases require a separate one-time repair.
  const oldNames = collectProfileRenameOldNames(groups, userId, existing.displayName);
  const isRename = [...oldNames.values()].some(oldName => oldName !== displayName);

  let nextGroups = groups;

  if (isRename) {
    // Reject if the new name collides with a different existing member in any bloc.
    assertProfileRenameDoesNotCollide(groups, oldNames, displayName, userId);

    nextGroups = Object.fromEntries(
      Object.entries(groups).map(([groupId, group]) => {
        const oldName = oldNames.get(groupId);
        if (!oldName || oldName === displayName) return [groupId, group];
        return [groupId, renameGroupDisplayNameSurfaces(group, userId, oldName, displayName)];
      })
    );
  }

  return {
    ...base,
    groups: nextGroups,
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

function applyRepairDisplayName(current, payload) {
  // This is an admin-only compatibility repair for already-broken legacy
  // display-name state inside one bloc. It is intentionally not treated as a
  // normal product rename flow or as proof that display names are cosmetic.
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

  const userId  = String(payload?.userId  || "").trim();
  const groupId = String(payload?.groupId || "").trim();
  const oldName = String(payload?.oldName || "").trim();
  const newName = String(payload?.newName || "").trim();
  if (!userId || !groupId || !oldName || !newName) {
    const error = new Error("userId, groupId, oldName, and newName are required");
    error.status = 400;
    throw error;
  }

  const base  = rolloverStateIfNeeded(current);
  const group = base.groups?.[groupId];
  if (!group) {
    const error = new Error("Bloc not found");
    error.status = 404;
    throw error;
  }
  if (!group.memberOrder.includes(oldName)) {
    const error = new Error(`"${oldName}" is not in memberOrder for this Bloc`);
    error.status = 400;
    throw error;
  }
  if (group.memberOrder.includes(newName) && newName !== oldName) {
    const error = new Error(`"${newName}" is already taken in this Bloc`);
    error.status = 409;
    throw error;
  }

  const nextGroup = normalizeGroup({
    ...renameGroupDisplayNameSurfaces(group, userId, oldName, newName, { createMissingMembership: false }),
    leftMemberNames: renameLegacyLeftMemberName(group.leftMemberNames, oldName, newName)
  });

  // Optionally update the profile display name (used when the profile itself
  // also needs correction, e.g. "Giang gangster" → "Giang").
  const profileDisplayName = String(payload?.profileDisplayName || "").trim();
  const nextProfiles = profileDisplayName
    ? {
        ...(base.profiles || {}),
        [userId]: { ...(base.profiles?.[userId] || {}), displayName: profileDisplayName }
      }
    : (base.profiles || {});

  return {
    ...base,
    groups:   { ...base.groups,   [groupId]: nextGroup },
    profiles: nextProfiles,
    meta: { revision: base.meta.revision + 1, updatedAt: new Date().toISOString() }
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
  const currentMemberCount = Array.isArray(group.activeMemberOrder) && group.activeMemberOrder.length
    ? group.activeMemberOrder.length
    : (Object.keys(group.memberships || {}).length || group.memberOrder.length);
  if (currentMemberCount >= MAX_MEMBERS) {
    const error = new Error("This Bloc is full. Maximum 20 members allowed.");
    error.status = 403;
    throw error;
  }
  // Record a join month for genuinely new members, including placeholder names
  // that were pre-seeded into memberOrder but had not actually participated yet.
  // Preserve joinedMonthByName only for true legacy relinks that already have
  // participation history before this month.
  const joinMonthKey = getLeagueMonthKey(group.settings?.timeZone);
  const shouldRecordJoinMonth = shouldRecordJoinedMonthForJoin(group, profile.displayName, joinMonthKey);
  // If this member was previously kicked or left, remove them from leftMemberNames
  // so normalizeGroup doesn't immediately filter them back out.
  const nextLeftMemberNames = removeLegacyLeftMemberName(group.leftMemberNames, profile.displayName);
  const nextGroup = normalizeGroup({
    ...group,
    memberOrder: uniqueNames([...group.memberOrder, profile.displayName]),
    joinedMonthByName: shouldRecordJoinMonth
      ? { ...(group.joinedMonthByName || {}), [profile.displayName]: joinMonthKey }
      : (group.joinedMonthByName || {}),
    memberships: {
      ...(group.memberships || {}),
      [userId]: {
        userId,
        displayName: profile.displayName,
        role: "member",
        joinedAt: new Date().toISOString()
      }
    },
    leftMemberNames: nextLeftMemberNames
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
  const actorResolvedName = resolveMembershipDisplayNameByUserId(group, actorUserId, actorDisplayName);
  const actorIsAdmin = isGroupAdminActor(group, actorUserId, actorResolvedName);
  if (!actorIsAdmin) {
    const error = new Error("Only the admin can remove members");
    error.status = 403;
    throw error;
  }
  // Resolve target by userId or displayName fallback
  const { membership: targetMembership, displayName: resolvedDisplayName } = resolveKickTarget(group, targetUserId, targetDisplayName);
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
  const nextLeftMemberNames = updateLegacyLeftMemberNamesForDeparture(
    group.leftMemberNames,
    targetMembership?.userId || targetUserId,
    resolvedDisplayName
  );
  const nextLogs = scrubDepartedMemberFromCurrentLogs(group.logs, resolvedDisplayName);
  const nextGroup = normalizeGroup({
    ...group,
    memberOrder: nextMemberOrder,
    memberships: nextMemberships,
    leftMemberNames: nextLeftMemberNames,
    logs: nextLogs
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

  const nextAdmin = resolveAdminAfterMemberDeparture(group, nextMemberships, userId);

  const nextLogs = scrubDepartedMemberFromCurrentLogs(group.logs, displayName);
  const nextGroup = normalizeGroup({
    ...group,
    adminUserId: nextAdmin.adminUserId,
    adminName: nextAdmin.adminName,
    memberOrder: nextMemberOrder,
    memberships: nextMemberships,
    leftMemberNames: removeLegacyLeftMemberName(group.leftMemberNames, displayName),
    logs: nextLogs
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
  const displayName = resolveDeletedAccountDisplayName(profile, base.groups, userId);

  // Verify user exists
  if (!profile && !displayName) {
    const error = new Error("Account not found");
    error.status = 404;
    throw error;
  }

  let nextGroups = { ...base.groups };
  const nextGroupOrder = [...(base.groupOrder || [])];

  for (const [groupId, group] of Object.entries(base.groups || {})) {
    const groupDisplayName = displayName || "";
    const membership = group.memberships?.[userId];
    const scrubbedLogs = groupDisplayName
      ? scrubDepartedMemberFromCurrentLogs(group.logs, groupDisplayName, { removeOwnedLogs: !!membership })
      : (group.logs || {});

    if (!membership) {
      if (JSON.stringify(scrubbedLogs) !== JSON.stringify(group.logs || {})) {
        nextGroups[groupId] = normalizeGroup({
          ...group,
          logs: scrubbedLogs
        });
      }
      continue; // user not an active member of this group
    }

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

    const nextAdmin = resolveAdminAfterMemberDeparture(group, nextMemberships, userId);

    // Remove member from memberOrder
    const nextMemberOrder = group.memberOrder.filter(n => n !== dn);

    const nextSitOutRequests = removeMemberSitOutRequests(group.sitOutRequests, dn);

    nextGroups[groupId] = normalizeGroup({
      ...group,
      adminUserId: nextAdmin.adminUserId,
      adminName: nextAdmin.adminName,
      memberOrder: nextMemberOrder,
      memberships: nextMemberships,
      leftMemberNames: removeLegacyLeftMemberName(group.leftMemberNames, dn),
      logs: scrubbedLogs,
      sitOutRequests: nextSitOutRequests
    });
  }

  // Remove profile
  const nextProfiles = { ...base.profiles };
  delete nextProfiles[userId];

  return {
    ...base,
    groups: nextGroups,
    groupOrder: nextGroupOrder,
    profiles: nextProfiles,
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
    memberCount: Array.isArray(group.activeMemberOrder) && group.activeMemberOrder.length
      ? group.activeMemberOrder.length
      : group.memberOrder.length,
    minTarget: group.settings?.minTarget || DEFAULT_MIN_TARGET
  };
}

async function getInviteContextCanonicalFirst(current, payload) {
  const canonicalBloc = await fetchCanonicalBlocByInviteCode(payload?.inviteCode);
  if (canonicalBloc?.legacy_group_key) {
    const group = current.groups?.[canonicalBloc.legacy_group_key];
    return {
      groupId: canonicalBloc.legacy_group_key,
      groupName: canonicalBloc.name || group?.name || "",
      inviteCode: canonicalBloc.invite_code || String(payload?.inviteCode || "").trim().toUpperCase(),
      memberCount: Array.isArray(group?.activeMemberOrder) && group.activeMemberOrder.length
        ? group.activeMemberOrder.length
        : (Object.keys(group?.memberships || {}).length || group?.memberOrder?.length || 0),
      minTarget: canonicalBloc.min_target ?? group?.settings?.minTarget ?? DEFAULT_MIN_TARGET
    };
  }
  return getInviteContext(current, payload);
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
      const authUser = await fetchAuthenticatedUser(readBearerToken(req));
      if (url.searchParams.get("revision") === "1") {
        const revision = await fetchBlobRevision();
        return res.status(200).json({ revision: revision ?? 0 });
      }
      const current = await fetchReadableCurrentState();
      return res.status(200).json(scopeReadableStateForUser(current, authUser.id));
    }

    if (req.method === "PUT") {
      return res.status(410).json({
        error: "Legacy whole-state save is retired. Use explicit log mutation actions."
      });
    }

    if (req.method === "POST") {
      const payload = await readJson(req);

      if (payload?.action === "auth-send-otp") {
        return res.status(410).json({
          error: "Legacy OTP send is disabled. Use Supabase Auth signInWithOtp from the client."
        });
      }

      if (payload?.action === "auth-verify-otp") {
        return res.status(410).json({
          error: "Legacy OTP verify is disabled. Use Supabase Auth verifyOtp from the client."
        });
      }

      let current = null;
      const getCurrent = async () => {
        if (!current) current = await fetchWritableCurrentState();
        return current;
      };
      let readableCurrent = null;
      const getReadableCurrent = async () => {
        if (!readableCurrent) readableCurrent = await fetchReadableCurrentState();
        return readableCurrent;
      };

      if (payload?.action === "auth-sync") {
        const authUser = await fetchAuthenticatedUser(readBearerToken(req, payload));
        const current = await getCurrent();
        const synced = applyAuthSync(current, authUser);
        if (synced.changed) {
          await persistState(synced.state, `auth-sync:${authUser.id}`);
        }
        // Always return the readable overlaid state here. Returning the raw
        // blob-backed auth-sync state can briefly wipe canonical overlays
        // (including settlement reminders) during app bootstrap until the next
        // background refresh lands.
        const state = await fetchReadableCurrentState();
        // Dual-write repaired auth identity to canonical if auth-sync changed
        // the writable blob state. These writes stay best-effort so bootstrap
        // remains a compatibility repair path instead of a canonical hard gate.
        // New users with no display name yet will trigger canonical sync when
        // they complete upsert-profile instead.
        const canonicalDisplayName = state.profiles?.[authUser.id]?.displayName || "";
        if (synced.changed && canonicalDisplayName) {
          await syncProfileToCanonical(authUser.id, authUser.email, canonicalDisplayName);
          for (const group of Object.values(synced.state.groups || {})) {
            const membership = group?.memberships?.[authUser.id];
            if (!membership?.displayName) continue;
            await syncBlocMemberToCanonical(group, authUser.id, membership.role || "member");
          }
        }
        return res.status(200).json({ ok: true, state, session: synced.session });
      }

      if (payload?.action === "invite-context") {
        const readable = await getReadableCurrent();
        return res.status(200).json(await getInviteContextCanonicalFirst(readable, payload));
      }

      if (payload?.action === "settlement-claim-paid") {
        if (!ENABLE_SETTLEMENT_CONFIRMATIONS) {
          return res.status(404).json({ error: "Settlement confirmations are disabled" });
        }
        const auth = await requireAuthenticatedContext(req, payload, await getReadableCurrent());
        const actorDisplayName = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const group = auth.state.groups?.[payload.groupId];
        if (!group) return res.status(404).json({ error: "Bloc not found" });
        if (actorDisplayName !== String(payload?.payerDisplayName || "").trim()) {
          return res.status(403).json({ error: "Only the payer can mark this as paid" });
        }
        const participants = await ensureSettlementConfirmationPrereqs(
          auth.state,
          payload.groupId,
          String(payload?.monthKey || "").trim(),
          String(payload?.payerDisplayName || "").trim(),
          String(payload?.receiverDisplayName || "").trim()
        );
        if (!participants?.payerMembership?.userId || !participants?.receiverMembership?.userId) {
          return res.status(400).json({ error: "Both settlement participants must have active bloc memberships" });
        }
        await claimSettlementConfirmationInCanonical({
          legacyGroupKey: payload.groupId,
          monthKey: String(payload?.monthKey || "").trim(),
          payerAuthUserId: participants.payerMembership.userId,
          payerDisplayName: participants.payerMembership.displayName,
          receiverAuthUserId: participants.receiverMembership.userId,
          receiverDisplayName: participants.receiverMembership.displayName,
          amount: Number(payload?.amount || 0),
          currency: String(payload?.currency || DEFAULT_CURRENCY).trim().toUpperCase() || DEFAULT_CURRENCY
        });
        const readable = await fetchReadableCurrentState();
        return res.status(200).json(readable);
      }

      if (payload?.action === "settlement-confirm-paid") {
        if (!ENABLE_SETTLEMENT_CONFIRMATIONS) {
          return res.status(404).json({ error: "Settlement confirmations are disabled" });
        }
        const auth = await requireAuthenticatedContext(req, payload, await getReadableCurrent());
        const actorDisplayName = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const group = auth.state.groups?.[payload.groupId];
        if (!group) return res.status(404).json({ error: "Bloc not found" });
        if (actorDisplayName !== String(payload?.receiverDisplayName || "").trim()) {
          return res.status(403).json({ error: "Only the receiver can confirm this payment" });
        }
        const participants = await ensureSettlementConfirmationPrereqs(
          auth.state,
          payload.groupId,
          String(payload?.monthKey || "").trim(),
          String(payload?.payerDisplayName || "").trim(),
          String(payload?.receiverDisplayName || "").trim()
        );
        if (!participants?.payerMembership?.userId || !participants?.receiverMembership?.userId) {
          return res.status(400).json({ error: "Both settlement participants must have active bloc memberships" });
        }
        await confirmSettlementConfirmationInCanonical({
          legacyGroupKey: payload.groupId,
          monthKey: String(payload?.monthKey || "").trim(),
          payerAuthUserId: participants.payerMembership.userId,
          receiverAuthUserId: participants.receiverMembership.userId
        });
        const readable = await fetchReadableCurrentState();
        return res.status(200).json(readable);
      }

      if (payload?.action === "settlement-dispute-paid") {
        if (!ENABLE_SETTLEMENT_CONFIRMATIONS) {
          return res.status(404).json({ error: "Settlement confirmations are disabled" });
        }
        const auth = await requireAuthenticatedContext(req, payload, await getReadableCurrent());
        const actorDisplayName = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const group = auth.state.groups?.[payload.groupId];
        if (!group) return res.status(404).json({ error: "Bloc not found" });
        if (actorDisplayName !== String(payload?.receiverDisplayName || "").trim()) {
          return res.status(403).json({ error: "Only the receiver can dispute this payment" });
        }
        const participants = await ensureSettlementConfirmationPrereqs(
          auth.state,
          payload.groupId,
          String(payload?.monthKey || "").trim(),
          String(payload?.payerDisplayName || "").trim(),
          String(payload?.receiverDisplayName || "").trim()
        );
        if (!participants?.payerMembership?.userId || !participants?.receiverMembership?.userId) {
          return res.status(400).json({ error: "Both settlement participants must have active bloc memberships" });
        }
        await disputeSettlementConfirmationInCanonical({
          legacyGroupKey: payload.groupId,
          monthKey: String(payload?.monthKey || "").trim(),
          payerAuthUserId: participants.payerMembership.userId,
          receiverAuthUserId: participants.receiverMembership.userId
        });
        const readable = await fetchReadableCurrentState();
        return res.status(200).json(readable);
      }

      if (payload?.action === "write-hydration-parity-report") {
        assertAdminPin(payload);
        const report = await buildWriteHydrationParityReport(await getCurrent());
        return res.status(200).json(report);
      }

      if (payload?.action === "historical-shell-reconciliation-report") {
        assertAdminPin(payload);
        const report = await buildHistoricalShellReconciliationReport(await getCurrent());
        return res.status(200).json(report);
      }

      // Writable mutation boundary:
      // actions below this point intentionally hydrate the blob-shaped writable
      // state before computing their compatibility payload. Do not replace this
      // with fetchReadableCurrentState() broadly; readable state is a composed
      // user-facing projection and can hide legacy blob gaps that these
      // mutations still need to preserve or repair.
      current = await getCurrent();

      if (payload?.action === "settlement") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const result = applySettlementUpdate(auth.state, payload);
        // Canonical-first settlement slice:
        // 1. compute the exact post-settlement blob-compatible month snapshot
        // 2. write canonical settlement status from that exact computed payload
        // 3. persist blob afterward as the compatibility mirror
        if (result.settlement) {
          await updateSeasonMemberSettlementInCanonical(
            payload.groupId,
            payload.monthKey,
            payload.player,
            result.settlement.status,
            result.settlement.settledAt || null,
            { throwOnError: true }
          );
        }
        const persisted = await persistState(result.updated, result.reason);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "create-group") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const creatorName = auth.profile?.displayName || String(payload?.creatorName || "").trim();
        const createPayload = {
          ...payload,
          actorUserId: auth.user.id,
          creatorName,
          createdGroupId: generateGroupId(String(payload?.groupName || "group")),
          inviteCode: generateInviteCode(),
          createdAt: new Date().toISOString()
        };
        applyCreateGroup(auth.state, createPayload);
        const canonicalState = await buildCanonicalWritableStateForAuthenticatedGlobalMutation(auth);
        const created = applyCreateGroup(canonicalState, createPayload);
        const newGroup = created.state.groups?.[created.createdGroupId];
        const newGroupSortOrder = (created.state.groupOrder || []).indexOf(created.createdGroupId);
        // Canonical writable-input cutover for create-group:
        // 1. authenticate/repair and validate against the blob shell
        // 2. compute the post-create result from the canonical global
        //    writable view using the same generated id/invite/timestamps
        // 3. write canonical state from that exact payload
        // 4. mirror blob only after the canonical writes succeed
        if (newGroup) {
          await syncProfileToCanonical(auth.user.id, auth.user.email, creatorName, { throwOnError: true });
          await syncBlocToCanonical(newGroup, auth.user.id, newGroupSortOrder >= 0 ? newGroupSortOrder : null, { throwOnError: true });
          await syncSeasonToCanonical(newGroup, newGroup?.lastMonth, "open", null, { throwOnError: true });
          await syncBlocMemberToCanonical(newGroup, auth.user.id, "admin", { throwOnError: true });
          await seedOpenSeasonMemberStatusInCanonical(newGroup, newGroup?.lastMonth, creatorName, auth.user.id, { throwOnError: true });
        }
        const persisted = await persistState(created.state, `create-group:${created.createdGroupId}`);
        return res.status(200).json({ state: persisted, createdGroupId: created.createdGroupId });
      }

      if (payload?.action === "upsert-profile") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const requestedDisplayName = String(payload?.displayName || "").trim();
        const shellOldNames = collectProfileRenameOldNames(
          auth.state.groups || {},
          auth.user.id,
          auth.state.profiles?.[auth.user.id]?.displayName
        );
        applyUpsertProfile(auth.state, { ...payload, userId: auth.user.id, email: auth.user.email });
        const canonicalState = await buildCanonicalWritableStateForAuthenticatedGlobalMutation(auth);
        const canonicalOldNames = collectProfileRenameOldNames(
          canonicalState.groups || {},
          auth.user.id,
          canonicalState.profiles?.[auth.user.id]?.displayName
        );
        const displayNameRepairs = new Map([...shellOldNames, ...canonicalOldNames]
          .filter(([, oldName]) => oldName && oldName !== requestedDisplayName));
        const updated = applyUpsertProfile(canonicalState, { ...payload, userId: auth.user.id, email: auth.user.email });
        // Canonical writable-input cutover for upsert-profile:
        // 1. authenticate/repair and validate against the blob shell
        // 2. compute the current/open profile rename from the canonical global
        //    writable view
        // 3. sync canonical profile, auth-scoped display-name snapshots, and
        //    active bloc-member display-name snapshots
        // 4. mirror blob only after canonical writes succeed
        await syncProfileToCanonical(
          auth.user.id,
          auth.user.email,
          requestedDisplayName,
          { throwOnError: true }
        );
        for (const [groupId, oldName] of displayNameRepairs) {
          await repairDisplayNameSnapshotsInCanonical(
            groupId,
            auth.user.id,
            oldName,
            requestedDisplayName,
            { throwOnError: true }
          );
        }
        for (const [, group] of Object.entries(updated.groups || {})) {
          if (!group.memberships?.[auth.user.id]) continue;
          const memberRole = group.memberships[auth.user.id].role || "member";
          await syncBlocMemberToCanonical(group, auth.user.id, memberRole, { throwOnError: true });
        }
        const persisted = await persistState(updated, `profile:${auth.user.id}`);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "join-group") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const canonicalBloc = !payload?.groupId && payload?.inviteCode
          ? await fetchCanonicalBlocByInviteCode(payload.inviteCode)
          : null;
        const joinPayload = {
          ...payload,
          userId: auth.user.id,
          ...(canonicalBloc?.legacy_group_key ? { groupId: canonicalBloc.legacy_group_key } : {})
        };
        applyJoinGroup(auth.state, joinPayload);
        const canonicalState = await buildCanonicalWritableStateForAuthenticatedGlobalMutation(auth);
        const joined = applyJoinGroup(canonicalState, joinPayload);
        const joinedGroup = joined.state.groups?.[joined.joinedGroupId];
        const joinedDisplayName = joinedGroup?.memberships?.[auth.user.id]?.displayName || auth.profile?.displayName || null;
        const joinedGroupSortOrder = (joined.state.groupOrder || []).indexOf(joined.joinedGroupId);
        // Canonical writable-input cutover for join-group:
        // 1. authenticate/repair and validate against the blob shell
        // 2. compute the post-join result from the canonical global writable view
        // 3. write canonical profile/member/open-season state from that payload
        // 4. mirror blob only after the canonical writes succeed
        if (joinedGroup) {
          await syncProfileToCanonical(auth.user.id, auth.user.email, joinedDisplayName, { throwOnError: true });
          await syncBlocToCanonical(joinedGroup, joinedGroup.adminUserId || null, joinedGroupSortOrder >= 0 ? joinedGroupSortOrder : null, { throwOnError: true });
          await syncBlocMemberToCanonical(joinedGroup, auth.user.id, "member", { throwOnError: true });
          await syncSeasonToCanonical(joinedGroup, joinedGroup?.lastMonth, "open", null, { throwOnError: true });
          await seedOpenSeasonMemberStatusInCanonical(joinedGroup, joinedGroup?.lastMonth, joinedDisplayName, auth.user.id, { throwOnError: true });
        }
        const persisted = await persistState(joined.state, `join-group:${joined.joinedGroupId}:${auth.user.id}`);
        return res.status(200).json({ state: persisted, joinedGroupId: joined.joinedGroupId });
      }

      if (payload?.action === "kick-member") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actorDisplayName = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        applyKickMember(auth.state, { ...payload, actorUserId: auth.user.id, actorDisplayName });
        const canonicalState = await buildCanonicalWritableStateForAuthenticatedMutation(auth, payload.groupId);
        const canonicalActorDisplayName = resolveDisplayNameForUser(canonicalState, payload.groupId, auth.user.id, auth.user.email) || actorDisplayName;
        const updated = applyKickMember(canonicalState, { ...payload, actorUserId: auth.user.id, actorDisplayName: canonicalActorDisplayName });
        // Canonical writable-input cutover for kick-member:
        // 1. authenticate/repair against the blob shell, then compute the
        //    post-kick current/open state from the canonical writable view
        // 2. remove the canonical active membership first for auth-linked members
        // 3. mirror blob only after the canonical removal succeeds
        // Name-only legacy members still have no canonical membership row, so
        // their removal remains blob-only compatibility behavior.
        if (payload.targetUserId) {
          await removeBlocMemberFromCanonical(payload.groupId, payload.targetUserId, { throwOnError: true });
        }
        const persisted = await persistState(updated, `kick-member:${payload.groupId}:${payload.targetUserId}`);
        return res.status(200).json({ ok: true, state: persisted });
      }

      if (payload?.action === "leave-bloc") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        applyLeaveBloc(auth.state, { ...payload, userId: auth.user.id });
        const canonicalState = await buildCanonicalWritableStateForAuthenticatedMutation(auth, payload.groupId);
        const updated = applyLeaveBloc(canonicalState, { ...payload, userId: auth.user.id });
        const nextGroup = updated.groups?.[payload.groupId] || null;

        // Canonical writable-input cutover for leave-bloc:
        // - authenticate/repair against the blob shell, then compute the
        //   current/open departure result from the canonical writable view
        // - if the bloc survives, canonical member removal becomes authoritative
        // - if admin changes, canonical admin transfer must also succeed first
        // - only after those writes succeed do we mirror the blob state
        if (nextGroup) {
          await removeBlocMemberFromCanonical(payload.groupId, auth.user.id, { throwOnError: true });
          const nextAdminUserId = nextGroup.adminUserId || null;
          if (nextAdminUserId && nextAdminUserId !== auth.user.id) {
            await updateBlocAdminInCanonical(payload.groupId, nextAdminUserId, { throwOnError: true });
          }
          const persisted = await persistState(updated, `leave-bloc:${payload.groupId}:${auth.user.id}`);
          return res.status(200).json({ ok: true, state: persisted, leftGroupId: payload.groupId });
        }

        // Last-member deletion:
        // delete the canonical bloc first so all dependent ante_core rows cascade
        // away together, then mirror the blob-side bloc removal.
        await deleteBlocFromCanonical(payload.groupId, { throwOnError: true });
        const persisted = await persistState(updated, `leave-bloc:${payload.groupId}:${auth.user.id}`);
        return res.status(200).json({ ok: true, state: persisted, leftGroupId: payload.groupId });
      }

      if (payload?.action === "multi-log") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.sourceGroupId, auth.user.id, auth.user.email);
        const allTargetIds = [...new Set([payload.sourceGroupId, ...(Array.isArray(payload.targetGroupIds) ? payload.targetGroupIds.filter(Boolean) : [])])];
        applyMultiLog(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const canonicalState = await buildCanonicalWritableStateForAuthenticatedMutation(auth, payload.sourceGroupId);
        const canonicalActor = resolveDisplayNameForUser(canonicalState, payload.sourceGroupId, auth.user.id, auth.user.email) || actor;
        const beforeLogIdsByGroup = Object.fromEntries(
          allTargetIds.map(groupId => [
            groupId,
            new Set((canonicalState.groups?.[groupId]?.logs?.[canonicalActor] || []).map(log => String(log?.id)))
          ])
        );
        const updated = applyMultiLog(canonicalState, { ...payload, actor: canonicalActor, actorUserId: auth.user.id });
        const pendingLogsByGroup = Object.fromEntries(
          allTargetIds.map(groupId => {
            const group = updated.groups?.[groupId];
            if (!group) return [groupId, []];
            const beforeIds = beforeLogIdsByGroup[groupId] || new Set();
            const ownerLogs = group.logs?.[canonicalActor] || [];
            return [groupId, ownerLogs.filter(log => !beforeIds.has(String(log?.id)))];
          })
        );
        // Canonical writable-input cutover for multi-log:
        // 1. authenticate/repair against the blob shell, then compute the
        //    post-log state from the source bloc's canonical writable view
        // 2. ensure canonical bloc/open-season rows exist for each target bloc
        // 3. upsert the exact new logs canonically from that in-memory payload
        // 4. persist blob afterward as the compatibility mirror
        // The target blocs still use their existing blob-shaped shells here;
        // the current/open parity report covers the mixed-source behavior.
        for (const groupId of allTargetIds) {
          const group = updated.groups?.[groupId];
          if (!group) continue;
          const newLogs = pendingLogsByGroup[groupId] || [];
          if (!newLogs.length) continue;
          const groupSortOrder = (updated.groupOrder || []).indexOf(groupId);
          await syncBlocToCanonical(group, group.adminUserId || null, groupSortOrder >= 0 ? groupSortOrder : null, { throwOnError: true });
          await syncSeasonToCanonical(group, group.lastMonth, "open", null, { throwOnError: true });
          for (const log of newLogs) {
            await upsertWorkoutLogToCanonical(group, group.lastMonth, canonicalActor, auth.user.id, log, { throwOnError: true });
          }
        }
        const persisted = await persistState(updated, `multi-log:${canonicalActor || actor || auth.user.id}:${payload.date}:${payload.workoutType}`);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "add-log") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        applyAddLog(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const canonicalState = await buildCanonicalWritableStateForAuthenticatedMutation(auth, payload.groupId);
        const canonicalActor = resolveDisplayNameForUser(canonicalState, payload.groupId, auth.user.id, auth.user.email) || actor;
        const result = applyAddLog(canonicalState, { ...payload, actor: canonicalActor, actorUserId: auth.user.id });
        const group = result.updated.groups?.[payload.groupId];
        const groupSortOrder = (result.updated.groupOrder || []).indexOf(payload.groupId);
        const targetMonth = (group?.monthHistory || []).find(month => month?.key === result.monthKey) || null;
        // Canonical writable-input cutover for add-log:
        // authenticate/repair against the blob shell, compute the new workout
        // from the canonical writable constructor, then mirror blob afterward.
        if (group) {
          await syncBlocToCanonical(group, group.adminUserId || null, groupSortOrder >= 0 ? groupSortOrder : null, { throwOnError: true });
          await syncSeasonToCanonical(group, result.monthKey, targetMonth ? "closed" : "open", targetMonth?.closedAt || null, { throwOnError: true });
          await upsertWorkoutLogToCanonical(group, result.monthKey, canonicalActor, auth.user.id, result.log, { throwOnError: true });
        }
        const persisted = await persistState(result.updated, result.reason);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "update-settings") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const shadowBlobUpdated = applyUpdateSettings(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const canonicalState = await buildCanonicalWritableStateForAuthenticatedMutation(auth, payload.groupId);
        const canonicalActor = resolveDisplayNameForUser(canonicalState, payload.groupId, auth.user.id, auth.user.email) || actor;
        const updated = applyUpdateSettings(canonicalState, { ...payload, actor: canonicalActor, actorUserId: auth.user.id });
        await runWriteHydrationParityProbe("update-settings", payload, auth, actor, shadowBlobUpdated, applyUpdateSettings);
        const settingsGroup = updated.groups?.[payload.groupId];
        const settingsSortOrder = (updated.groupOrder || []).indexOf(payload.groupId);
        // Canonical writable-input cutover for settings:
        // 1. authenticate/repair against the blob shell, then compute the
        //    mutation from the canonical writable constructor
        // 2. sync canonical bloc settings/name from that exact payload
        // 3. sync the canonical open-season snapshot from the same payload
        // 4. mirror blob state afterward without changing the response contract
        if (settingsGroup) {
          await syncBlocToCanonical(settingsGroup, auth.user.id, settingsSortOrder, { throwOnError: true });
          await syncSeasonToCanonical(settingsGroup, settingsGroup?.lastMonth, "open", null, { throwOnError: true });
        }
        const persisted = await persistState(updated, `settings:${payload.groupId}:${canonicalActor || actor || auth.user.id}`);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "season-proration-choice") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const shadowBlobUpdated = applySeasonProrationChoice(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const canonicalState = await buildCanonicalWritableStateForAuthenticatedMutation(auth, payload.groupId);
        const canonicalActor = resolveDisplayNameForUser(canonicalState, payload.groupId, auth.user.id, auth.user.email) || actor;
        const updated = applySeasonProrationChoice(canonicalState, { ...payload, actor: canonicalActor, actorUserId: auth.user.id });
        await runWriteHydrationParityProbe("season-proration-choice", payload, auth, actor, shadowBlobUpdated, applySeasonProrationChoice);
        const overrideGroup = updated.groups?.[payload.groupId];
        const overrideMonthKey = overrideGroup?.lastMonth;
        const nextOverride = overrideMonthKey
          ? overrideGroup?.seasonOverrides?.[overrideMonthKey]
          : null;
        // Canonical writable-input cutover for proration:
        // 1. authenticate/repair against the blob shell, then compute the
        //    override from the canonical writable constructor
        // 2. upsert canonical from that exact payload
        // 3. mirror the same result into blob immediately after
        if (overrideGroup && overrideMonthKey && nextOverride) {
          await syncSeasonToCanonical(overrideGroup, overrideMonthKey, "open", null, { throwOnError: true });
          await upsertSeasonOverrideInCanonical(
            payload.groupId,
            overrideMonthKey,
            nextOverride.prorated,
            nextOverride.proratedMas,
            nextOverride.chosenAt,
            nextOverride.chosenBy,
            nextOverride.chosenByUserId || null,
            { throwOnError: true }
          );
        }
        const persisted = await persistState(updated, `season-proration:${payload.groupId}:${payload.choice}`);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "sitout-request") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const shadowBlobUpdated = applySitOutRequest(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const canonicalState = await buildCanonicalWritableStateForAuthenticatedMutation(auth, payload.groupId);
        const canonicalActor = resolveDisplayNameForUser(canonicalState, payload.groupId, auth.user.id, auth.user.email) || actor;
        const updated = applySitOutRequest(canonicalState, { ...payload, actor: canonicalActor, actorUserId: auth.user.id });
        await runWriteHydrationParityProbe("sitout-request", payload, auth, actor, shadowBlobUpdated, applySitOutRequest);
        const sitOutGroup = updated.groups?.[payload.groupId];
        const sitOutMonthKey = sitOutGroup?.lastMonth;
        const nextRequest = sitOutMonthKey
          ? sitOutGroup?.sitOutRequests?.[sitOutMonthKey]?.[canonicalActor]
          : null;
        // Canonical writable-input cutover for sit-out requests:
        // 1. authenticate/repair against the blob shell, then compute the
        //    request/excused result from the canonical writable constructor
        // 2. ensure the open season exists canonically
        // 3. upsert canonical sit-out + excused side-effect from that exact payload
        // 4. mirror the same result into blob immediately after
        if (sitOutGroup && sitOutMonthKey && nextRequest) {
          await syncSeasonToCanonical(sitOutGroup, sitOutMonthKey, "open", null, { throwOnError: true });
          await upsertSitOutRequestInCanonical(payload.groupId, sitOutMonthKey, canonicalActor, nextRequest, { throwOnError: true });
          if (nextRequest.status === "approved" && nextRequest.autoApproved) {
            await upsertSeasonMemberExcusedInCanonical(payload.groupId, sitOutMonthKey, canonicalActor, auth.user.id, { throwOnError: true });
          }
        }
        const persisted = await persistState(updated, `sitout-request:${payload.groupId}:${canonicalActor || actor || auth.user.id}`);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "sitout-review") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const shadowBlobUpdated = applySitOutReview(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const canonicalState = await buildCanonicalWritableStateForAuthenticatedMutation(auth, payload.groupId);
        const canonicalActor = resolveDisplayNameForUser(canonicalState, payload.groupId, auth.user.id, auth.user.email) || actor;
        const updated = applySitOutReview(canonicalState, { ...payload, actor: canonicalActor, actorUserId: auth.user.id });
        await runWriteHydrationParityProbe("sitout-review", payload, auth, actor, shadowBlobUpdated, applySitOutReview);
        const reviewGroup = updated.groups?.[payload.groupId];
        const reviewedRequest = payload.memberName && payload.monthKey
          ? reviewGroup?.sitOutRequests?.[payload.monthKey]?.[payload.memberName]
          : null;
        // Canonical writable-input cutover for sit-out review:
        // authenticate/repair against the blob shell, compute the review result
        // from the canonical writable constructor, then mirror blob afterward.
        if (reviewGroup && payload.monthKey && payload.memberName && reviewedRequest) {
          await syncSeasonToCanonical(reviewGroup, payload.monthKey, "open", null, { throwOnError: true });
          await upsertSitOutRequestInCanonical(payload.groupId, payload.monthKey, payload.memberName, reviewedRequest, { throwOnError: true });
          if (reviewedRequest.status === "approved") {
            await upsertSeasonMemberExcusedInCanonical(
              payload.groupId,
              payload.monthKey,
              payload.memberName,
              reviewedRequest.requestedByUserId || null,
              { throwOnError: true }
            );
          }
        }
        const persisted = await persistState(updated, `sitout-review:${payload.groupId}:${payload.memberName}:${payload.decision}`);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "reaction") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        // Normalize emoji the same way applyToggleReaction does so the blob lookup
        // and the canonical RPC call use the same key.
        const emoji = String(payload?.emoji || "").trim();
        const shadowBlobResult = applyToggleReaction(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const canonicalState = await buildCanonicalWritableStateForAuthenticatedMutation(auth, payload.groupId);
        const canonicalActor = resolveDisplayNameForUser(canonicalState, payload.groupId, auth.user.id, auth.user.email) || actor;
        const result = applyToggleReaction(canonicalState, { ...payload, actor: canonicalActor, actorUserId: auth.user.id });
        await runWriteHydrationParityProbe("reaction", payload, auth, actor, shadowBlobResult.updated, applyToggleReaction);
        const reactionGroup = result.updated.groups?.[payload.groupId];
        const reactionLog = reactionGroup?.logs?.[payload.owner]
          ?.find(e => String(e?.id) === String(payload.logId));
        if (reactionGroup && reactionLog) {
          // Canonical writable-input cutover for reactions:
          // 1. authenticate/repair against the blob shell, then compute the
          //    post-toggle state from the canonical writable constructor
          // 2. ensure the parent canonical workout log exists from that payload
          // 3. apply the exact reaction direction canonically
          // 4. persist blob afterward as the compatibility mirror
          await syncOpenWorkoutLogSnapshotToCanonical(reactionGroup, payload.owner, reactionLog, { throwOnError: true });
          const isAdding = (reactionLog.reactions?.[emoji] || []).includes(canonicalActor);
          await toggleWorkoutReactionInCanonical(payload.logId, auth.user.id, canonicalActor, emoji, isAdding, { throwOnError: true });
        }
        const persisted = await persistState(result.updated, result.reason);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "flag") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const shadowBlobResult = applyFlagLog(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const canonicalState = await buildCanonicalWritableStateForAuthenticatedMutation(auth, payload.groupId);
        const canonicalActor = resolveDisplayNameForUser(canonicalState, payload.groupId, auth.user.id, auth.user.email) || actor;
        const result = applyFlagLog(canonicalState, { ...payload, actor: canonicalActor, actorUserId: auth.user.id });
        await runWriteHydrationParityProbe("flag", payload, auth, actor, shadowBlobResult.updated, applyFlagLog);
        const group = result.updated.groups?.[payload.groupId];
        const log = group?.logs?.[payload.owner]?.find(entry => String(entry?.id) === String(payload.logId));
        if (group && log) {
          await syncOpenWorkoutLogSnapshotToCanonical(group, payload.owner, log, { throwOnError: true });
        }
        const persisted = await persistState(result.updated, result.reason);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "flag-response") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const shadowBlobResult = applyRespondToFlag(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const canonicalState = await buildCanonicalWritableStateForAuthenticatedMutation(auth, payload.groupId);
        const canonicalActor = resolveDisplayNameForUser(canonicalState, payload.groupId, auth.user.id, auth.user.email) || actor;
        const result = applyRespondToFlag(canonicalState, { ...payload, actor: canonicalActor, actorUserId: auth.user.id });
        await runWriteHydrationParityProbe("flag-response", payload, auth, actor, shadowBlobResult.updated, applyRespondToFlag);
        const group = result.updated.groups?.[payload.groupId];
        const log = group?.logs?.[payload.owner]?.find(entry => String(entry?.id) === String(payload.logId));
        if (group && log) {
          await syncOpenWorkoutLogSnapshotToCanonical(group, payload.owner, log, { throwOnError: true });
        }
        const persisted = await persistState(result.updated, result.reason);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "flag-review") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const shadowBlobResult = applyReviewFlag(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const canonicalState = await buildCanonicalWritableStateForAuthenticatedMutation(auth, payload.groupId);
        const canonicalActor = resolveDisplayNameForUser(canonicalState, payload.groupId, auth.user.id, auth.user.email) || actor;
        const result = applyReviewFlag(canonicalState, { ...payload, actor: canonicalActor, actorUserId: auth.user.id });
        await runWriteHydrationParityProbe("flag-review", payload, auth, actor, shadowBlobResult.updated, applyReviewFlag);
        const group = result.updated.groups?.[payload.groupId];
        const log = group?.logs?.[payload.owner]?.find(entry => String(entry?.id) === String(payload.logId));
        if (group && log) {
          await syncOpenWorkoutLogSnapshotToCanonical(group, payload.owner, log, { throwOnError: true });
        }
        const persisted = await persistState(result.updated, result.reason);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "delete-log") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        const actor = resolveDisplayNameForUser(auth.state, payload.groupId, auth.user.id, auth.user.email);
        const shadowBlobResult = applyDeleteLog(auth.state, { ...payload, actor, actorUserId: auth.user.id });
        const canonicalState = await buildCanonicalWritableStateForAuthenticatedMutation(auth, payload.groupId);
        const canonicalActor = resolveDisplayNameForUser(canonicalState, payload.groupId, auth.user.id, auth.user.email) || actor;
        const result = applyDeleteLog(canonicalState, { ...payload, actor: canonicalActor, actorUserId: auth.user.id });
        await runWriteHydrationParityProbe("delete-log", payload, auth, actor, shadowBlobResult.updated, applyDeleteLog);
        await deleteWorkoutLogFromCanonical(payload.logId, { throwOnError: true });
        const persisted = await persistState(result.updated, result.reason);
        return res.status(200).json(persisted);
      }

      if (payload?.action === "delete-account") {
        const auth = await requireAuthenticatedContext(req, payload, current);
        applyDeleteAccount(auth.state, { ...payload, userId: auth.user.id });
        const canonicalState = await buildCanonicalWritableStateForAuthenticatedGlobalMutation(auth);
        const updated = applyDeleteAccount(canonicalState, { ...payload, userId: auth.user.id });

        // Canonical-first account deletion slice:
        // 1. authenticate/repair and validate against the blob shell
        // 2. compute the exact post-delete blob-compatible state from the
        //    canonical global writable constructor
        // 3. delete canonical blocs first for any sole-member blocs
        // 4. transfer canonical admin first for any surviving admin-owned blocs
        // 5. delete the canonical profile so dependent memberships cascade away
        // 6. persist blob afterward as the compatibility mirror
        for (const [groupId, group] of Object.entries(canonicalState.groups || {})) {
          const survivingGroup = updated.groups?.[groupId];
          if (!group.memberships?.[auth.user.id]) continue;
          if (!survivingGroup) {
            await deleteBlocFromCanonical(groupId, { throwOnError: true });
            continue;
          }
          if (group.adminUserId !== auth.user.id) continue;
          if (!survivingGroup.adminUserId || survivingGroup.adminUserId === auth.user.id) continue;
          await updateBlocAdminInCanonical(groupId, survivingGroup.adminUserId, { throwOnError: true });
        }
        await deleteProfileFromCanonical(auth.user.id, { throwOnError: true });
        const persisted = await persistState(updated, `delete-account:${auth.user.id}`);
        return res.status(200).json({ ok: true, state: persisted });
      }

      if (payload?.action === "repair-display-name") {
        // Quarantined compatibility tool:
        // - repairs one bloc's blob-shaped historical/name-keyed state
        // - repairs canonical display-name snapshots for that same bloc
        // - refreshes the active canonical membership row when one still exists
        // - should not be expanded into a general rename authority-transfer
        //   path before full display-name de-keying exists
        const updated = applyRepairDisplayName(current, payload);
        const repairedGroup = updated.groups?.[payload.groupId];
        const repairedProfile = updated.profiles?.[payload.userId] || current.profiles?.[payload.userId] || null;
        const repairedMembership = repairedGroup?.memberships?.[payload.userId] || null;
        if (String(payload?.profileDisplayName || "").trim() && repairedProfile?.email) {
          await syncProfileToCanonical(
            payload.userId,
            repairedProfile.email,
            String(payload.profileDisplayName).trim(),
            { throwOnError: true }
          );
        }
        if (repairedGroup && repairedMembership?.displayName) {
          await repairDisplayNameSnapshotsInCanonical(
            payload.groupId,
            payload.userId,
            payload.oldName,
            repairedMembership.displayName,
            { throwOnError: true }
          );
          await syncBlocMemberToCanonical(
            repairedGroup,
            payload.userId,
            repairedMembership.role || "member",
            { throwOnError: true }
          );
        }
        const persisted = await persistState(updated, `repair-display-name:${payload.groupId}:${payload.oldName}:${payload.newName}`);
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

function renameKey(obj, oldKey, newKey) {
  if (!oldKey || oldKey === newKey || !Object.prototype.hasOwnProperty.call(obj, oldKey)) return obj;
  const next = { ...obj, [newKey]: obj[oldKey] };
  delete next[oldKey];
  return next;
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
