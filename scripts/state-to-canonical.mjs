import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DEFAULT_GROUP_TIME_ZONE = "Europe/Oslo";
const DEFAULT_MIN_TARGET = 12;
const DEFAULT_FINE_AMOUNT = 20;
const DEFAULT_FEE_MODEL = "escalating";
const DEFAULT_CURRENCY = "NOK";
const DEFAULT_MIN_RUN_DISTANCE = 3;
const DEFAULT_DISTANCE_UNIT = "km";
const DEFAULT_STRAVA_ENABLED = true;
const LEGACY_GROUP_ID = "legacy-group";
const LEGACY_GROUP_NAME = "Lift Log OG";
const DEFAULT_MEMBER_NAMES = ["Aadhil", "Isira", "Rahul", "Kisal", "Rishane", "Deyhan", "Aysha", "Nishara", "Abhishek"];
const DEFAULT_JOINED_MONTH_BY_NAME = { Abhishek: "2026-4" };
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const [, , inputPathArg, outputDirArg, canonicalProfilesPathArg, canonicalBlocsPathArg, canonicalSeasonsPathArg] = process.argv;

if (!inputPathArg) {
  console.error("Usage: node scripts/state-to-canonical.mjs <input.json> [output-dir] [canonical-profiles.json] [canonical-blocs.json] [canonical-seasons.json]");
  process.exit(1);
}

const inputPath = path.resolve(inputPathArg);
const outputDir = path.resolve(outputDirArg || "migration-output/canonical");

const raw = fs.readFileSync(inputPath, "utf8");
const parsed = parseInput(raw, inputPath);
const inputState = normalizeInputShape(parsed);

const tables = {
  profiles: [],
  payment_methods: [],
  auth_otps: [],
  blocs: [],
  bloc_members: [],
  seasons: [],
  season_member_status: [],
  workout_logs: [],
  workout_reactions: [],
  season_overrides: [],
  sit_out_requests: [],
  settlement_runs: [],
  settlement_entries: [],
  settlement_transfers: [],
  notification_jobs: []
};

const warnings = [];

// Canonical profile resolution maps.
// Populated from a live ante_core.profiles export when provided as the third CLI argument.
// Keys: email (lowercase) -> canonical profiles.id
//       auth_user_id (string) -> canonical profiles.id
// When present these take precedence over blob-derived or stableUuid-derived IDs so that
// all generated profile_id FK references point to the IDs already in the database.
const canonicalIdByEmail = new Map();
const canonicalIdByAuthUserId = new Map();

if (canonicalProfilesPathArg) {
  const canonicalProfilesPath = path.resolve(canonicalProfilesPathArg);
  const canonicalProfiles = JSON.parse(fs.readFileSync(canonicalProfilesPath, "utf8"));
  for (const row of canonicalProfiles) {
    if (row.email) canonicalIdByEmail.set(String(row.email).trim().toLowerCase(), row.id);
    if (row.auth_user_id) canonicalIdByAuthUserId.set(String(row.auth_user_id).trim(), row.id);
  }
}

// Canonical bloc resolution map.
// Populated from a live ante_core.blocs export when provided as the fourth CLI argument.
// Key: legacy_group_key -> canonical blocs.id
// When present, ensures all generated bloc_id FK references — and all downstream IDs
// derived from blocId (season IDs, bloc_members IDs, etc.) — use the actual canonical
// bloc ID already in the database rather than a stableUuid-derived value.
const canonicalBlocIdByLegacyKey = new Map();

if (canonicalBlocsPathArg) {
  const canonicalBlocsPath = path.resolve(canonicalBlocsPathArg);
  const canonicalBlocs = JSON.parse(fs.readFileSync(canonicalBlocsPath, "utf8"));
  for (const row of canonicalBlocs) {
    if (row.legacy_group_key) canonicalBlocIdByLegacyKey.set(String(row.legacy_group_key).trim(), row.id);
  }
}

// Canonical season resolution map.
// Populated from a live ante_core.seasons export when provided as the fifth CLI argument.
// Key: "${bloc_id}:${month_key}" -> canonical seasons.id
// When present, ensures all generated season_id FK references — and all downstream IDs
// derived from seasonId (season_member_status, sit_out_requests, season_overrides) — use
// the actual canonical season ID already in the database rather than a stableUuid-derived value.
const canonicalSeasonIdByBlocAndMonthKey = new Map();

if (canonicalSeasonsPathArg) {
  const canonicalSeasonsPath = path.resolve(canonicalSeasonsPathArg);
  const canonicalSeasons = JSON.parse(fs.readFileSync(canonicalSeasonsPath, "utf8"));
  for (const row of canonicalSeasons) {
    if (row.bloc_id && row.month_key) {
      canonicalSeasonIdByBlocAndMonthKey.set(`${String(row.bloc_id).trim()}:${String(row.month_key).trim()}`, row.id);
    }
  }
}

const profileByLegacyKey = new Map();
const profileByEmail = new Map();
const profileByDisplayName = new Map();
const blocIdByLegacyKey = new Map();
const seasonIdByKey = new Map();
const profileIdByBlocAndDisplayName = new Map();

for (const profile of Object.values(inputState.profiles || {})) {
  const legacyKey = String(profile.id || "").trim();
  const email = String(profile.email || "").trim().toLowerCase();
  const displayName = String(profile.displayName || "").trim();
  const canonicalId =
    canonicalIdByEmail.get(email) ||
    (isUuid(legacyKey) ? canonicalIdByAuthUserId.get(legacyKey) : null) ||
    stableUuid("profile", email || legacyKey || displayName);
  tables.profiles.push({
    id: canonicalId,
    auth_user_id: isUuid(legacyKey) ? legacyKey : "",
    legacy_user_key: isUuid(legacyKey) ? "" : legacyKey,
    email,
    display_name: displayName,
    created_at: profile.createdAt || ""
  });
  if (legacyKey) profileByLegacyKey.set(legacyKey, canonicalId);
  if (email) profileByEmail.set(email, canonicalId);
  if (displayName) profileByDisplayName.set(displayName, canonicalId);
}

for (const [email, otp] of Object.entries(inputState.pendingOtps || {})) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const legacyUserKey = String(otp?.userId || "").trim();
  tables.auth_otps.push({
    email: normalizedEmail,
    code: String(otp?.code || ""),
    expires_at: otp?.expiresAt || "",
    profile_id: resolveProfileId({ legacyUserKey, email: normalizedEmail }) || "",
    created_at: ""
  });
}

for (const group of Object.values(inputState.groups || {})) {
  const blocId = canonicalBlocIdByLegacyKey.get(group.id) || stableUuid("bloc", group.id);
  blocIdByLegacyKey.set(group.id, blocId);
  const adminProfileId = resolveProfileId({
    legacyUserKey: group.adminUserId,
    displayName: group.adminName
  });

  tables.blocs.push({
    id: blocId,
    legacy_group_key: group.id,
    name: group.name,
    admin_profile_id: adminProfileId || "",
    invite_code: group.inviteCode,
    created_at: group.createdAt || "",
    updated_at: inputState.meta?.updatedAt || "",
    time_zone: group.settings?.timeZone || DEFAULT_GROUP_TIME_ZONE,
    currency: group.settings?.currency || DEFAULT_CURRENCY,
    min_target: Number(group.settings?.minTarget || DEFAULT_MIN_TARGET),
    fine_amount: Number(group.settings?.fineAmount || DEFAULT_FINE_AMOUNT),
    fee_model: normalizeFeeModel(group.settings?.feeModel),
    escalation_step_amount: numericOrBlank(group.settings?.escalationStepAmount),
    min_run_distance: Number(group.settings?.minRunDistance || DEFAULT_MIN_RUN_DISTANCE),
    distance_unit: group.settings?.distanceUnit || DEFAULT_DISTANCE_UNIT,
    strava_enabled: group.settings?.stravaEnabled !== false,
    accepted_workout_types: JSON.stringify(group.settings?.acceptedWorkoutTypes || []),
    sort_order: numericOrBlank(inputState.groupOrder?.indexOf(group.id))
  });

  const memberNames = uniqueNames([
    ...(group.memberOrder || []),
    ...Object.values(group.memberships || {}).map(m => m.displayName),
    ...Object.keys(group.logs || {}),
    ...(group.monthHistory || []).flatMap(month => Object.keys(month.counts || {})),
    ...(group.monthHistory || []).flatMap(month => Object.keys(month.logsByUser || {}))
  ]);

  for (const displayName of memberNames) {
    const membership = Object.values(group.memberships || {}).find(m => m.displayName === displayName) || null;
    const profileId = resolveProfileId({
      legacyUserKey: membership?.userId,
      displayName
    });
    if (!profileId) {
      warnings.push({ type: "missing-profile-for-member", groupId: group.id, displayName });
    }
    profileIdByBlocAndDisplayName.set(`${blocId}:${displayName}`, profileId || "");
    tables.bloc_members.push({
      id: stableUuid("bloc-member", `${blocId}:${profileId || displayName}`),
      bloc_id: blocId,
      profile_id: profileId || "",
      display_name_snapshot: displayName,
      role: membership?.role || (group.adminName === displayName ? "admin" : "member"),
      joined_at: membership?.joinedAt || "",
      joined_month_key: group.joinedMonthByName?.[displayName] || "",
      left_at: "",
      sort_order: numericOrBlank((group.memberOrder || []).indexOf(displayName)),
      created_at: membership?.joinedAt || group.createdAt || ""
    });
  }

  for (const month of group.monthHistory || []) {
    addSeasonForMonth({ group, blocId, month, status: inferHistoricalSeasonStatus(month), closedAt: month.closedAt || inputState.meta?.updatedAt || "" });
  }

  if (group.lastMonth) {
    const openMonth = buildOpenMonthSnapshot(group);
    addSeasonForMonth({ group, blocId, month: openMonth, status: "open", closedAt: "" });
  }
}

fs.mkdirSync(outputDir, { recursive: true });
for (const [name, rows] of Object.entries(tables)) {
  fs.writeFileSync(path.join(outputDir, `${name}.json`), JSON.stringify(rows, null, 2));
  writeCsv(path.join(outputDir, `${name}.csv`), rows);
}

const summary = Object.fromEntries(
  Object.entries(tables).map(([name, rows]) => [name, rows.length])
);
fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(outputDir, "warnings.json"), JSON.stringify(warnings, null, 2));

console.log(JSON.stringify({ outputDir, summary, warningCount: warnings.length }, null, 2));

function addSeasonForMonth({ group, blocId, month, status, closedAt }) {
  const monthKey = month.key;
  const seasonId = canonicalSeasonIdByBlocAndMonthKey.get(`${blocId}:${monthKey}`) || stableUuid("season", `${blocId}:${monthKey}`);
  seasonIdByKey.set(`${blocId}:${monthKey}`, seasonId);
  const monthParts = getMonthParts(monthKey);
  const settings = buildNormalizedSettings(month.settings || group.settings);
  tables.seasons.push({
    id: seasonId,
    bloc_id: blocId,
    month_key: monthKey,
    month_start: `${monthParts.year}-${String(monthParts.monthIndex + 1).padStart(2, "0")}-01`,
    label: month.label || formatMonthLabel(monthKey),
    year: Number(month.year ?? monthParts.year),
    month_index: Number(month.month ?? monthParts.monthIndex),
    status,
    created_at: closedAt || group.createdAt || "",
    updated_at: closedAt || inputState.meta?.updatedAt || "",
    closed_at: closedAt || "",
    min_target: Number(settings.minTarget),
    fine_amount: Number(settings.fineAmount),
    fee_model: normalizeFeeModel(settings.feeModel),
    escalation_step_amount: numericOrBlank(settings.escalationStepAmount),
    currency: settings.currency,
    min_run_distance: Number(settings.minRunDistance),
    distance_unit: settings.distanceUnit,
    strava_enabled: settings.stravaEnabled !== false,
    time_zone: settings.timeZone,
    accepted_workout_types: JSON.stringify(settings.acceptedWorkoutTypes || [])
  });

  const memberNames = uniqueNames([
    ...(group.memberOrder || []),
    ...Object.keys(month.counts || {}),
    ...Object.keys(month.excused || {}),
    ...Object.keys(month.logsByUser || {}),
    ...Object.keys(month.settlements || {})
  ]);

  for (const displayName of memberNames) {
    const profileId = profileIdByBlocAndDisplayName.get(`${blocId}:${displayName}`) || resolveProfileId({ displayName }) || "";
    if (!profileId) warnings.push({ type: "missing-profile-for-season-member", groupId: group.id, monthKey, displayName });
    tables.season_member_status.push({
      id: stableUuid("season-member-status", `${seasonId}:${displayName}`),
      season_id: seasonId,
      profile_id: profileId,
      display_name_snapshot: displayName,
      joined_for_month: isJoinedForMonth(group.joinedMonthByName || {}, displayName, monthKey),
      workout_count: Number(month.counts?.[displayName] || getCountedLogCount(month.logsByUser?.[displayName] || [])),
      excused: !!month.excused?.[displayName],
      settlement_status: month.settlements?.[displayName]?.status || "",
      settlement_settled_at: month.settlements?.[displayName]?.settledAt || "",
      settlement_updated_at: month.settlements?.[displayName]?.updatedAt || "",
      created_at: closedAt || inputState.meta?.updatedAt || group.createdAt || "",
      updated_at: closedAt || inputState.meta?.updatedAt || ""
    });
  }

  for (const [ownerDisplayName, logs] of Object.entries(month.logsByUser || {})) {
    for (const log of logs || []) {
      const normalizedLog = normalizeLogEntry(log);
      const profileId = profileIdByBlocAndDisplayName.get(`${blocId}:${ownerDisplayName}`) || resolveProfileId({ displayName: ownerDisplayName }) || "";
      tables.workout_logs.push({
        id: String(normalizedLog.id),
        bloc_id: blocId,
        season_id: seasonId,
        profile_id: profileId,
        owner_display_name: ownerDisplayName,
        workout_date: normalizedLog.date,
        workout_type: normalizedLog.type,
        note: normalizedLog.note || "",
        photo_url: normalizedLog.photoUrl || "",
        created_at: normalizedLog.createdAt || closedAt || inputState.meta?.updatedAt || "",
        verified_via: normalizedLog.verifiedVia || "manual",
        flag_status: normalizedLog.flagStatus || "",
        flag_reason: normalizedLog.flagReason || "",
        flag_response: normalizedLog.flagResponse || "",
        flagged_by: normalizedLog.flaggedBy || "",
        decision_by: normalizedLog.decisionBy || "",
        decision_at: normalizedLog.decisionAt || ""
      });
      for (const [emoji, reactors] of Object.entries(normalizedLog.reactions || {})) {
        for (const reactorDisplayName of reactors) {
          const reactorProfileId = profileIdByBlocAndDisplayName.get(`${blocId}:${reactorDisplayName}`) || resolveProfileId({ displayName: reactorDisplayName }) || "";
          if (!reactorProfileId) warnings.push({ type: "missing-profile-for-reactor", groupId: group.id, monthKey, reactorDisplayName, logId: String(normalizedLog.id) });
          tables.workout_reactions.push({
            workout_log_id: String(normalizedLog.id),
            reactor_profile_id: reactorProfileId,
            reactor_display_name: reactorDisplayName,
            emoji,
            created_at: normalizedLog.createdAt || closedAt || inputState.meta?.updatedAt || ""
          });
        }
      }
    }
  }

  const override = group.seasonOverrides?.[monthKey];
  if (override) {
    tables.season_overrides.push({
      id: stableUuid("season-override", seasonId),
      season_id: seasonId,
      prorated: !!override.prorated,
      prorated_mas: numericOrBlank(override.proratedMas),
      chosen_at: override.chosenAt || "",
      chosen_by: override.chosenBy || "",
      chosen_by_user_id: resolveProfileId({ legacyUserKey: override.chosenByUserId }) || "",
      created_at: override.chosenAt || "",
      updated_at: override.chosenAt || ""
    });
  }

  const requests = group.sitOutRequests?.[monthKey] || {};
  for (const [displayName, request] of Object.entries(requests)) {
    tables.sit_out_requests.push({
      id: stableUuid("sit-out-request", `${seasonId}:${displayName}`),
      bloc_id: blocId,
      season_id: seasonId,
      profile_id: resolveProfileId({ displayName, legacyUserKey: request?.requestedByUserId }) || "",
      display_name_snapshot: displayName,
      status: normalizeSitOutStatus(request?.status),
      reason: request?.reason || "",
      exceptional: !!request?.exceptional,
      requested_at: request?.requestedAt || "",
      requested_by: request?.requestedBy || displayName,
      requested_by_user_id: resolveProfileId({ legacyUserKey: request?.requestedByUserId }) || "",
      target_approver_name: request?.targetApproverName || "",
      target_approver_user_id: resolveProfileId({ legacyUserKey: request?.targetApproverUserId }) || "",
      decided_at: request?.decidedAt || "",
      decided_by: request?.decidedBy || "",
      decided_by_user_id: resolveProfileId({ legacyUserKey: request?.decidedByUserId }) || "",
      auto_approved: !!request?.autoApproved,
      created_at: request?.requestedAt || "",
      updated_at: request?.decidedAt || request?.requestedAt || ""
    });
  }
}

function buildOpenMonthSnapshot(group) {
  const monthKey = group.lastMonth;
  const logsByUser = Object.fromEntries(
    Object.entries(group.logs || {}).map(([name, logs]) => [name, (logs || []).map(normalizeLogEntry)])
  );
  const relevantNames = uniqueNames([
    ...(group.memberOrder || []),
    ...Object.keys(logsByUser),
    ...Object.keys(group.excused || {})
  ]);
  const counts = Object.fromEntries(
    relevantNames.map(name => [name, getCountedLogCount(logsByUser[name] || [])])
  );
  const excused = Object.fromEntries(
    relevantNames.map(name => [name, !!group.excused?.[name]?.[monthKey]])
  );
  return {
    key: monthKey,
    label: formatMonthLabel(monthKey),
    year: getMonthParts(monthKey).year,
    month: getMonthParts(monthKey).monthIndex,
    counts,
    excused,
    logsByUser,
    settings: group.settings,
    settlements: {}
  };
}

function normalizeInputShape(parsed) {
  const candidate = parsed?.record ? parsed.record : parsed?.state ? parsed.state : parsed;
  if (candidate?.version === 2 && candidate?.groups) return candidate;
  return {
    version: 2,
    groups: {
      [LEGACY_GROUP_ID]: {
        id: LEGACY_GROUP_ID,
        name: LEGACY_GROUP_NAME,
        adminName: DEFAULT_MEMBER_NAMES[0],
        adminUserId: "",
        inviteCode: "OGGROUP",
        createdAt: candidate?.meta?.updatedAt || "",
        memberOrder: [...DEFAULT_MEMBER_NAMES],
        memberships: {},
        joinedMonthByName: { ...DEFAULT_JOINED_MONTH_BY_NAME },
        settings: buildNormalizedSettings({
          minTarget: DEFAULT_MIN_TARGET,
          fineAmount: DEFAULT_FINE_AMOUNT,
          feeModel: DEFAULT_FEE_MODEL,
          currency: DEFAULT_CURRENCY,
          minRunDistance: DEFAULT_MIN_RUN_DISTANCE,
          distanceUnit: DEFAULT_DISTANCE_UNIT,
          stravaEnabled: DEFAULT_STRAVA_ENABLED,
          timeZone: DEFAULT_GROUP_TIME_ZONE,
          acceptedWorkoutTypes: ["Gym", "Run", "Pilates", "Sports", "Other"]
        }),
        logs: candidate?.logs || {},
        excused: candidate?.excused || {},
        seasonOverrides: {},
        sitOutRequests: {},
        monthHistory: Array.isArray(candidate?.monthHistory) ? candidate.monthHistory : [],
        lastMonth: candidate?.lastMonth || null
      }
    },
    groupOrder: [LEGACY_GROUP_ID],
    defaultGroupId: LEGACY_GROUP_ID,
    profiles: {},
    pendingOtps: {},
    meta: {
      revision: Number.isFinite(Number(candidate?.meta?.revision)) ? Number(candidate.meta.revision) : 0,
      updatedAt: candidate?.meta?.updatedAt || null
    }
  };
}

function parseInput(raw, sourcePath) {
  const extension = path.extname(sourcePath).toLowerCase();
  if (extension === ".csv") return parseSupabaseCsvExport(raw);
  return JSON.parse(raw);
}

function parseSupabaseCsvExport(raw) {
  const rows = parseCsv(raw.trim());
  if (rows.length < 2) {
    throw new Error("CSV export is empty");
  }
  const headers = rows[0];
  const values = rows[1];
  const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  if (record.state) {
    return { state: JSON.parse(record.state) };
  }
  if (record.record) {
    return { record: JSON.parse(record.record) };
  }
  throw new Error("CSV export did not contain a state or record column");
}

function parseCsv(raw) {
  const rows = [];
  let currentField = "";
  let currentRow = [];
  let inQuotes = false;
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    const next = raw[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        currentField += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }
    if (char === "\n" && !inQuotes) {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      continue;
    }
    if (char === "\r") continue;
    currentField += char;
  }
  currentRow.push(currentField);
  rows.push(currentRow);
  return rows.filter(row => row.length > 1 || row[0] !== "");
}

function resolveProfileId({ legacyUserKey = "", email = "", displayName = "" }) {
  const normalizedLegacy = String(legacyUserKey || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedDisplay = String(displayName || "").trim();
  return canonicalIdByEmail.get(normalizedEmail)
    || canonicalIdByAuthUserId.get(normalizedLegacy)
    || profileByLegacyKey.get(normalizedLegacy)
    || profileByEmail.get(normalizedEmail)
    || profileByDisplayName.get(normalizedDisplay)
    || "";
}

function stableUuid(namespace, value) {
  const hex = crypto.createHash("sha256").update(`${namespace}:${value}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function uniqueNames(values) {
  return [...new Set((values || []).map(v => String(v || "").trim()).filter(Boolean))];
}

function buildNormalizedSettings(settings) {
  return {
    minTarget: Number.isFinite(Number(settings?.minTarget)) ? Math.max(1, Number(settings.minTarget)) : DEFAULT_MIN_TARGET,
    fineAmount: Number.isFinite(Number(settings?.fineAmount)) ? Number(settings.fineAmount) : DEFAULT_FINE_AMOUNT,
    feeModel: normalizeFeeModel(settings?.feeModel),
    escalationStepAmount: Number.isFinite(Number(settings?.escalationStepAmount)) ? Number(settings.escalationStepAmount) : null,
    currency: String(settings?.currency || DEFAULT_CURRENCY),
    minRunDistance: Number.isFinite(Number(settings?.minRunDistance)) ? Number(settings.minRunDistance) : DEFAULT_MIN_RUN_DISTANCE,
    distanceUnit: String(settings?.distanceUnit || DEFAULT_DISTANCE_UNIT),
    stravaEnabled: settings?.stravaEnabled !== false,
    timeZone: String(settings?.timeZone || DEFAULT_GROUP_TIME_ZONE),
    acceptedWorkoutTypes: Array.isArray(settings?.acceptedWorkoutTypes) ? settings.acceptedWorkoutTypes : []
  };
}

function normalizeFeeModel(value) {
  return value === "flat" ? "flat" : DEFAULT_FEE_MODEL;
}

function normalizeSitOutStatus(value) {
  return value === "approved" || value === "denied" ? value : "pending";
}

function inferHistoricalSeasonStatus(month) {
  const statuses = Object.values(month?.settlements || {}).map(s => s?.status).filter(Boolean);
  if (statuses.length && statuses.every(status => status === "settled")) return "settled";
  return "closed";
}

function getCountedLogCount(logs) {
  return Array.isArray(logs) ? logs.filter(log => log?.flagStatus !== "rejected").length : 0;
}

function isJoinedForMonth(joinedMonthByName, name, monthKey) {
  const joinedMonth = joinedMonthByName?.[name];
  return !joinedMonth || compareMonthKeys(monthKey, joinedMonth) >= 0;
}

function compareMonthKeys(a, b) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  const [ay, am] = String(a).split("-").map(Number);
  const [by, bm] = String(b).split("-").map(Number);
  if (ay !== by) return ay - by;
  return am - bm;
}

function getMonthParts(monthKey) {
  const [year, monthIndex] = String(monthKey || "").split("-").map(Number);
  return { year, monthIndex };
}

function formatMonthLabel(monthKey) {
  const { year, monthIndex } = getMonthParts(monthKey);
  return `${MONTH_NAMES[monthIndex]} '${String(year).slice(2)}`;
}

function normalizeLogEntry(log) {
  return {
    id: String(log?.id || "").trim(),
    date: String(log?.date || "").trim(),
    type: String(log?.type || "").trim(),
    note: String(log?.note || "").trim(),
    photoUrl: String(log?.photoUrl || "").trim(),
    createdAt: log?.createdAt || "",
    verifiedVia: String(log?.verifiedVia || "manual").trim(),
    flagStatus: log?.flagStatus || "",
    flagReason: String(log?.flagReason || "").trim(),
    flagResponse: String(log?.flagResponse || "").trim(),
    flaggedBy: String(log?.flaggedBy || "").trim(),
    decisionBy: String(log?.decisionBy || "").trim(),
    decisionAt: log?.decisionAt || "",
    reactions: normalizeReactions(log?.reactions)
  };
}

function normalizeReactions(reactions) {
  if (!reactions || typeof reactions !== "object") return {};
  return Object.fromEntries(
    Object.entries(reactions).map(([emoji, reactors]) => [
      emoji,
      uniqueNames(Array.isArray(reactors) ? reactors : [])
    ]).filter(([, reactors]) => reactors.length)
  );
}

function numericOrBlank(value) {
  return Number.isFinite(Number(value)) ? Number(value) : "";
}

function writeCsv(filePath, rows) {
  if (!rows.length) {
    fs.writeFileSync(filePath, "");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map(header => csvCell(row[header])).join(","));
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
}

function csvCell(value) {
  const stringValue = value == null ? "" : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}
