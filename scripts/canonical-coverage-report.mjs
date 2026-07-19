import fs from "node:fs";
import path from "node:path";

const DEFAULT_OUTPUT_DIR = "migration-output/coverage";

loadEnvFile(".env.local");
loadEnvFile(".env");

const args = parseArgs(process.argv.slice(2));
const outputDir = path.resolve(args["output-dir"] || DEFAULT_OUTPUT_DIR);
const supabaseUrl = process.env.SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const unavailableReadRpcs = [];

if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const [
  liveState,
  canonicalBlocs,
  canonicalMembers,
  canonicalCurrentLogs,
  canonicalProfiles,
  canonicalExcusedSitouts,
  canonicalOpenSeasons,
  canonicalSeasonOverrides,
  canonicalMonthHistory
] = await Promise.all([
  fetchLiveBlobState(),
  fetchOptionalRpcArray("read_ante_core_blocs"),
  fetchOptionalRpcArray("read_ante_core_bloc_members"),
  fetchOptionalRpcArray("read_ante_core_current_logs"),
  fetchOptionalRpcArray("read_ante_core_profiles"),
  fetchOptionalRpcObject("read_ante_core_current_excused_and_sitouts", {
    excused: [],
    sit_out_requests: [],
    open_seasons: []
  }),
  fetchOptionalRpcArray("read_ante_core_open_seasons"),
  fetchOptionalRpcArray("read_ante_core_season_overrides"),
  fetchOptionalRpcArray("read_ante_core_month_history")
]);

const state = liveState.state || {};
const groups = state.groups || {};
const groupIds = Object.keys(groups).sort();
const canonicalBlocIds = new Set(canonicalBlocs.map(row => String(row.legacy_group_key || "")).filter(Boolean));
const canonicalMembersByGroup = groupRowsBy(canonicalMembers, "legacy_group_key");
const canonicalCurrentLogsByGroup = groupRowsBy(canonicalCurrentLogs, "legacy_group_key");
const canonicalOpenSeasonsByGroup = new Set(
  [
    ...(canonicalExcusedSitouts.open_seasons || []),
    ...canonicalOpenSeasons
  ]
    .map(row => String(row.legacy_group_key || ""))
    .filter(Boolean)
);
const canonicalOverridesByGroup = groupRowsBy(canonicalSeasonOverrides, "legacy_group_key");
const canonicalMonthHistoryByGroup = groupRowsBy(canonicalMonthHistory, "legacy_group_key");
const canonicalProfilesByAuthUserId = new Set(
  canonicalProfiles.map(row => String(row.user_id || "")).filter(Boolean)
);

const groupCoverage = groupIds.map(groupId => {
  const group = groups[groupId] || {};
  const memberships = group.memberships || {};
  const membershipUserIds = Object.keys(memberships).sort();
  const activeMembershipRows = (canonicalMembersByGroup[groupId] || [])
    .filter(row => String(row.auth_user_id || ""));
  const activeCanonicalUserIds = new Set(activeMembershipRows.map(row => String(row.auth_user_id)));
  const missingCanonicalMembers = membershipUserIds.filter(userId => !activeCanonicalUserIds.has(userId));
  const missingCanonicalProfiles = membershipUserIds.filter(userId => !canonicalProfilesByAuthUserId.has(userId));
  const currentBlobLogCount = Object.values(group.logs || {})
    .reduce((count, logs) => count + (Array.isArray(logs) ? logs.length : 0), 0);
  const currentCanonicalLogCount = (canonicalCurrentLogsByGroup[groupId] || []).length;
  const historicalBlobMonthCount = Array.isArray(group.monthHistory) ? group.monthHistory.length : 0;
  const historicalCanonicalMonthCount = (canonicalMonthHistoryByGroup[groupId] || []).length;

  return {
    groupId,
    name: group.name || "",
    hasCanonicalBloc: canonicalBlocIds.has(groupId),
    hasCanonicalOpenSeason: canonicalOpenSeasonsByGroup.has(groupId),
    blobMembershipCount: membershipUserIds.length,
    canonicalActiveMemberCount: activeCanonicalUserIds.size,
    missingCanonicalMembers,
    missingCanonicalProfiles,
    currentBlobLogCount,
    currentCanonicalLogCount,
    historicalBlobMonthCount,
    historicalCanonicalMonthCount,
    hasSeasonOverrideRows: (canonicalOverridesByGroup[groupId] || []).length > 0
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  liveBlob: {
    revision: liveState.revision ?? null,
    updatedAt: liveState.updated_at || null,
    groupCount: groupIds.length,
    profileCount: Object.keys(state.profiles || {}).length
  },
  canonical: {
    unavailableReadRpcs,
    blocCount: canonicalBlocs.length,
    activeBlocMemberRows: canonicalMembers.length,
    profileRows: canonicalProfiles.length,
    currentWorkoutLogRows: canonicalCurrentLogs.length,
    openSeasonRows: canonicalOpenSeasonsByGroup.size,
    seasonOverrideRows: canonicalSeasonOverrides.length,
    monthHistoryRows: canonicalMonthHistory.length
  },
  failures: buildFailures(groupCoverage),
  groupCoverage
};

fs.mkdirSync(outputDir, { recursive: true });
const reportPath = path.join(outputDir, `canonical-coverage-${dateStamp()}.json`);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(JSON.stringify({
  reportPath,
  groupCount: report.liveBlob.groupCount,
  canonicalBlocCount: report.canonical.blocCount,
  failureCount: report.failures.length,
  failures: report.failures
}, null, 2));

function buildFailures(coverage) {
  const failures = [];
  for (const group of coverage) {
    if (!group.hasCanonicalBloc) failures.push({ type: "missing-canonical-bloc", groupId: group.groupId });
    if (!group.hasCanonicalOpenSeason) failures.push({ type: "missing-canonical-open-season", groupId: group.groupId });
    for (const userId of group.missingCanonicalMembers) {
      failures.push({ type: "missing-canonical-member", groupId: group.groupId, userId });
    }
    for (const userId of group.missingCanonicalProfiles) {
      failures.push({ type: "missing-canonical-profile", groupId: group.groupId, userId });
    }
    if (group.currentBlobLogCount !== group.currentCanonicalLogCount) {
      failures.push({
        type: "current-log-count-mismatch",
        groupId: group.groupId,
        blob: group.currentBlobLogCount,
        canonical: group.currentCanonicalLogCount
      });
    }
  }
  return failures;
}

function groupRowsBy(rows, key) {
  return rows.reduce((acc, row) => {
    const groupKey = String(row?.[key] || "");
    if (!groupKey) return acc;
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(row);
    return acc;
  }, {});
}

async function fetchLiveBlobState() {
  const rows = await fetchRestJson("/rest/v1/lift_log_state?id=eq.true&select=state,revision,updated_at", {
    method: "GET",
    headers: { Accept: "application/json" }
  });
  if (!Array.isArray(rows) || !rows.length) return { state: {}, revision: null, updated_at: null };
  return rows[0] || { state: {}, revision: null, updated_at: null };
}

async function fetchRpcArray(name) {
  const payload = await fetchRpcObject(name);
  return Array.isArray(payload) ? payload : [];
}

async function fetchRpcObject(name) {
  return await fetchRestJson(`/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({})
  });
}

async function fetchOptionalRpcArray(name) {
  const payload = await fetchOptionalRpcObject(name, []);
  return Array.isArray(payload) ? payload : [];
}

async function fetchOptionalRpcObject(name, fallback) {
  try {
    return await fetchRpcObject(name);
  } catch (err) {
    const message = String(err?.message || err || "");
    if (message.includes("PGRST202") || message.includes("Could not find the function")) {
      unavailableReadRpcs.push(name);
      return fallback;
    }
    throw err;
  }
}

async function fetchRestJson(endpoint, options) {
  let response;
  try {
    response = await fetch(`${supabaseUrl}${endpoint}`, {
      ...options,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        ...options.headers
      }
    });
  } catch (err) {
    throw new Error(`${endpoint} network failure: ${err?.cause?.code || err?.message || err}`);
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${endpoint} failed (${response.status}): ${text}`);
  }
  return await response.json();
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function dateStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
