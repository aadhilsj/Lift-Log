import fs from "node:fs";
import path from "node:path";

const DEFAULT_CANONICAL_DIR = path.resolve("migration-output/canonical-live-backup");
const DEFAULT_DOWNLOADS_DIR = "/Users/opera_user/Downloads";

const DEFAULT_FILES = {
  liveState: path.join(DEFAULT_DOWNLOADS_DIR, "Supabase Snippet Recent Lift Log Backup Status.csv"),
  projectionMeta: path.join(DEFAULT_DOWNLOADS_DIR, "Supabase Snippet Recent Lift Log Backup Status (1).csv"),
  projectionGroups: path.join(DEFAULT_DOWNLOADS_DIR, "Supabase Snippet Recent Lift Log Backup Status (2).csv"),
  projectionMemberships: path.join(DEFAULT_DOWNLOADS_DIR, "Supabase Snippet Recent Lift Log Backup Status (3).csv"),
  projectionGroupLogs: path.join(DEFAULT_DOWNLOADS_DIR, "Supabase Snippet Recent Lift Log Backup Status (4).csv"),
  projectionMonthHistory: path.join(DEFAULT_DOWNLOADS_DIR, "Supabase Snippet Recent Lift Log Backup Status (5).csv"),
  projectionMonthCounts: path.join(DEFAULT_DOWNLOADS_DIR, "Supabase Snippet Recent Lift Log Backup Status (6).csv"),
  projectionMonthLogs: path.join(DEFAULT_DOWNLOADS_DIR, "Supabase Snippet Recent Lift Log Backup Status (7).csv"),
  projectionLogReactions: path.join(DEFAULT_DOWNLOADS_DIR, "Supabase Snippet Recent Lift Log Backup Status (8).csv"),
  projectionProfiles: path.join(DEFAULT_DOWNLOADS_DIR, "Supabase Snippet Recent Lift Log Backup Status (9).csv")
};

const args = parseArgs(process.argv.slice(2));
const canonicalDir = path.resolve(args["canonical-dir"] || DEFAULT_CANONICAL_DIR);

const files = {
  liveState: path.resolve(args["live-state"] || DEFAULT_FILES.liveState),
  projectionMeta: path.resolve(args["projection-meta"] || DEFAULT_FILES.projectionMeta),
  projectionGroups: path.resolve(args["projection-groups"] || DEFAULT_FILES.projectionGroups),
  projectionMemberships: path.resolve(args["projection-memberships"] || DEFAULT_FILES.projectionMemberships),
  projectionGroupLogs: path.resolve(args["projection-group-logs"] || DEFAULT_FILES.projectionGroupLogs),
  projectionMonthHistory: path.resolve(args["projection-month-history"] || DEFAULT_FILES.projectionMonthHistory),
  projectionMonthCounts: path.resolve(args["projection-month-counts"] || DEFAULT_FILES.projectionMonthCounts),
  projectionMonthLogs: path.resolve(args["projection-month-logs"] || DEFAULT_FILES.projectionMonthLogs),
  projectionLogReactions: path.resolve(args["projection-log-reactions"] || DEFAULT_FILES.projectionLogReactions),
  projectionProfiles: path.resolve(args["projection-profiles"] || DEFAULT_FILES.projectionProfiles)
};

for (const filePath of Object.values(files)) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing input file: ${filePath}`);
  }
}
if (!fs.existsSync(canonicalDir)) {
  throw new Error(`Missing canonical output directory: ${canonicalDir}`);
}

const canonical = {
  summary: readJson(path.join(canonicalDir, "summary.json")),
  profiles: readJson(path.join(canonicalDir, "profiles.json")),
  blocs: readJson(path.join(canonicalDir, "blocs.json")),
  blocMembers: readJson(path.join(canonicalDir, "bloc_members.json")),
  seasons: readJson(path.join(canonicalDir, "seasons.json")),
  seasonMemberStatus: readJson(path.join(canonicalDir, "season_member_status.json")),
  workoutLogs: readJson(path.join(canonicalDir, "workout_logs.json")),
  workoutReactions: readJson(path.join(canonicalDir, "workout_reactions.json"))
};

const liveStateRows = readCsvObjects(files.liveState);
const projectionMetaRows = readCsvObjects(files.projectionMeta);
const projectionGroupsRows = readCsvObjects(files.projectionGroups);
const projectionMembershipRows = readCsvObjects(files.projectionMemberships);
const projectionGroupLogRows = readCsvObjects(files.projectionGroupLogs);
const projectionMonthHistoryRows = readCsvObjects(files.projectionMonthHistory);
const projectionMonthCountRows = readCsvObjects(files.projectionMonthCounts);
const projectionMonthLogRows = readCsvObjects(files.projectionMonthLogs);
const projectionLogReactionRows = readCsvObjects(files.projectionLogReactions);
const projectionProfileRows = readCsvObjects(files.projectionProfiles);

const liveStateRevision = Number(liveStateRows[0]?.revision || 0);
const projectionSourceRevision = Number(projectionMetaRows[0]?.source_revision || 0);

const seasonById = new Map(canonical.seasons.map(row => [row.id, row]));
const workoutLogById = new Map(canonical.workoutLogs.map(row => [String(row.id), row]));
const blocLegacyKeyById = new Map(canonical.blocs.map(row => [row.id, row.legacy_group_key]));

const openSeasonIds = new Set(
  canonical.seasons.filter(row => row.status === "open").map(row => row.id)
);
const historicalSeasonIds = new Set(
  canonical.seasons.filter(row => row.status !== "open").map(row => row.id)
);

const openWorkoutLogs = canonical.workoutLogs.filter(row => openSeasonIds.has(row.season_id));
const historicalWorkoutLogs = canonical.workoutLogs.filter(row => historicalSeasonIds.has(row.season_id));

const openWorkoutReactions = canonical.workoutReactions.filter(row => {
  const log = workoutLogById.get(String(row.workout_log_id));
  return log && openSeasonIds.has(log.season_id);
});
const historicalWorkoutReactions = canonical.workoutReactions.filter(row => {
  const log = workoutLogById.get(String(row.workout_log_id));
  return log && historicalSeasonIds.has(log.season_id);
});

const historicalSeasonMemberStatus = canonical.seasonMemberStatus.filter(row =>
  historicalSeasonIds.has(row.season_id)
);

const monthLogsLikelyTruncated = projectionMonthLogRows.length === 100 && historicalWorkoutLogs.length > projectionMonthLogRows.length;

const checks = [
  checkEqual("revision-parity", liveStateRevision, projectionSourceRevision, {
    liveStateRevision,
    projectionSourceRevision
  }),
  checkSet(
    "group-keys",
    canonical.blocs.map(row => row.legacy_group_key),
    projectionGroupsRows.map(row => row.group_id)
  ),
  checkSet(
    "member-display-names",
    canonical.blocMembers.map(row => `${blocLegacyKeyById.get(row.bloc_id) || row.bloc_id}:${row.display_name_snapshot}`),
    projectionMembershipRows.map(row => `${row.group_id}:${row.display_name}`)
  ),
  checkSet(
    "profile-identity",
    canonical.profiles.map(row => `${row.email}:${row.display_name}`),
    projectionProfileRows.map(row => `${row.email}:${row.display_name}`)
  ),
  checkSet(
    "historical-month-keys",
    canonical.seasons
      .filter(row => row.status !== "open")
      .map(row => `${blocLegacyKeyById.get(row.bloc_id) || row.bloc_id}:${row.month_key}`),
    projectionMonthHistoryRows.map(row => `${row.group_id}:${row.month_key}`)
  ),
  checkEqual("historical-month-count-row-count", historicalSeasonMemberStatus.length, projectionMonthCountRows.length, {
    canonicalHistoricalSeasonMemberStatus: historicalSeasonMemberStatus.length,
    projectionMonthCountRows: projectionMonthCountRows.length
  }),
  checkSet(
    "historical-month-count-keys",
    historicalSeasonMemberStatus.map(row => {
      const season = seasonById.get(row.season_id);
      return `${blocLegacyKeyById.get(season?.bloc_id) || season?.bloc_id}:${season?.month_key}:${row.display_name_snapshot}:${row.workout_count}:${row.excused}:${normalizeNullable(row.settlement_status)}`;
    }),
    projectionMonthCountRows.map(row =>
      `${row.group_id}:${row.month_key}:${row.display_name}:${normalizeNumber(row.workout_count)}:${normalizeBoolean(row.excused)}:${normalizeNullable(row.settlement_status)}`
    )
  ),
  checkEqual("open-group-log-count", openWorkoutLogs.length, projectionGroupLogRows.length, {
    canonicalOpenWorkoutLogs: openWorkoutLogs.length,
    projectionGroupLogRows: projectionGroupLogRows.length
  }),
  checkSet(
    "open-group-log-keys",
    openWorkoutLogs.map(row => `${blocLegacyKeyById.get(row.bloc_id) || row.bloc_id}:${row.id}:${row.owner_display_name}:${row.workout_date}:${row.workout_type}`),
    projectionGroupLogRows.map(row => `${row.group_id}:${row.log_id}:${row.owner_display_name}:${row.workout_date}:${row.workout_type}`)
  ),
  ...(monthLogsLikelyTruncated
    ? [
        checkWarning("historical-month-log-export-truncated", {
          canonicalHistoricalWorkoutLogs: historicalWorkoutLogs.length,
          exportedProjectionMonthLogRows: projectionMonthLogRows.length,
          note: "Projection month-log CSV appears limited to 100 rows. Re-export with no row limit before final parity signoff."
        }),
        checkSubset(
          "historical-month-log-keys-subset",
          projectionMonthLogRows.map(row =>
            `${row.group_id}:${row.month_key}:${row.log_id}:${row.owner_display_name}:${row.workout_date}:${row.workout_type}`
          ),
          historicalWorkoutLogs.map(row => {
            const season = seasonById.get(row.season_id);
            return `${blocLegacyKeyById.get(row.bloc_id) || row.bloc_id}:${season?.month_key}:${row.id}:${row.owner_display_name}:${row.workout_date}:${row.workout_type}`;
          })
        )
      ]
    : [
        checkEqual("historical-month-log-count", historicalWorkoutLogs.length, projectionMonthLogRows.length, {
          canonicalHistoricalWorkoutLogs: historicalWorkoutLogs.length,
          projectionMonthLogRows: projectionMonthLogRows.length
        }),
        checkSet(
          "historical-month-log-keys",
          historicalWorkoutLogs.map(row => {
            const season = seasonById.get(row.season_id);
            return `${blocLegacyKeyById.get(row.bloc_id) || row.bloc_id}:${season?.month_key}:${row.id}:${row.owner_display_name}:${row.workout_date}:${row.workout_type}`;
          }),
          projectionMonthLogRows.map(row =>
            `${row.group_id}:${row.month_key}:${row.log_id}:${row.owner_display_name}:${row.workout_date}:${row.workout_type}`
          )
        )
      ]),
  checkEqual("open-log-reaction-count", openWorkoutReactions.length, projectionLogReactionRows.length, {
    canonicalOpenWorkoutReactions: openWorkoutReactions.length,
    projectionLogReactionRows: projectionLogReactionRows.length
  }),
  checkSet(
    "open-log-reaction-keys",
    openWorkoutReactions.map(row => {
      const log = workoutLogById.get(String(row.workout_log_id));
      return `${blocLegacyKeyById.get(log?.bloc_id) || log?.bloc_id}:${row.workout_log_id}:${row.emoji}:${row.reactor_display_name}`;
    }),
    projectionLogReactionRows.map(row => `${row.group_id}:${row.log_id}:${row.emoji}:${row.reactor_display_name}`)
  ),
  checkEqual("historical-log-reaction-count", historicalWorkoutReactions.length, 0, {
    canonicalHistoricalWorkoutReactions: historicalWorkoutReactions.length,
    projectionHistoricalReactionRows: 0
  })
];

const report = {
  generatedAt: new Date().toISOString(),
  canonicalDir,
  files,
  summary: {
    liveStateRevision,
    projectionSourceRevision,
    canonical: canonical.summary,
    projection: {
      groups: projectionGroupsRows.length,
      memberships: projectionMembershipRows.length,
      groupLogs: projectionGroupLogRows.length,
      monthHistory: projectionMonthHistoryRows.length,
      monthCounts: projectionMonthCountRows.length,
      monthLogs: projectionMonthLogRows.length,
      logReactions: projectionLogReactionRows.length,
      monthLogReactions: 0,
      profiles: projectionProfileRows.length
    }
  },
  checks,
  failures: checks.filter(check => !check.ok && check.status !== "warning"),
  warnings: checks.filter(check => check.status === "warning")
};

const reportPath = path.join(canonicalDir, "parity-report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(JSON.stringify({
  reportPath,
  checkCount: checks.length,
  failureCount: report.failures.length,
  warningCount: report.warnings.length,
  failedChecks: report.failures.map(check => check.name)
}, null, 2));

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readCsvObjects(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current);
  return out;
}

function checkEqual(name, left, right, details = {}) {
  return {
    name,
    ok: left === right,
    details: { expected: left, actual: right, ...details }
  };
}

function checkWarning(name, details = {}) {
  return {
    name,
    ok: true,
    status: "warning",
    details
  };
}

function checkSet(name, leftValues, rightValues) {
  const left = [...new Set(leftValues.filter(Boolean))].sort();
  const right = [...new Set(rightValues.filter(Boolean))].sort();
  const missingFromProjection = left.filter(value => !right.includes(value));
  const unexpectedInProjection = right.filter(value => !left.includes(value));
  return {
    name,
    ok: missingFromProjection.length === 0 && unexpectedInProjection.length === 0,
    details: {
      leftCount: left.length,
      rightCount: right.length,
      missingFromProjection: missingFromProjection.slice(0, 20),
      unexpectedInProjection: unexpectedInProjection.slice(0, 20)
    }
  };
}

function checkSubset(name, subsetValues, supersetValues) {
  const subset = [...new Set(subsetValues.filter(Boolean))].sort();
  const superset = new Set(supersetValues.filter(Boolean));
  const missingFromCanonical = subset.filter(value => !superset.has(value));
  return {
    name,
    ok: missingFromCanonical.length === 0,
    details: {
      subsetCount: subset.length,
      supersetCount: superset.size,
      missingFromCanonical: missingFromCanonical.slice(0, 20)
    }
  };
}

function normalizeNumber(value) {
  if (value === "" || value == null) return 0;
  return Number(value);
}

function normalizeBoolean(value) {
  return String(value).toLowerCase() === "true";
}

function normalizeNullable(value) {
  if (value == null) return "";
  const normalized = String(value).trim().toLowerCase();
  return normalized === "null" ? "" : String(value).trim();
}
