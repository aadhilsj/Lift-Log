// Blob retirement parity gate.
//
// Runs the six checks from docs/canonical-parity-audit-current-phase.md against
// live production data and exits non-zero on drift, so it can gate a blob mirror
// skip rollout instead of being eyeballed by hand.
//
// Read-only: every canonical read goes through an existing public.read_ante_core_*
// RPC and the blob is fetched as-is. No new SQL, no writes.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/blob-parity-gate.mjs
//   node scripts/blob-parity-gate.mjs --output-dir migration-output/parity-gate
//   node scripts/blob-parity-gate.mjs --fixture-dir <dir>   # offline, for gate self-tests
//
// Fixture mode reads live_state.json, month_history.json, blocs.json and
// bloc_members.json from --fixture-dir instead of production, so the checks can
// be proven to catch injected drift (see blob-parity-gate.test.mjs).

import fs from "node:fs";
import path from "node:path";

const DEFAULT_OUTPUT_DIR = "migration-output/parity-gate";
const SAMPLE_LIMIT = 20;

loadEnvFile(".env.local");
loadEnvFile(".env");

const args = parseArgs(process.argv.slice(2));
const outputDir = path.resolve(args["output-dir"] || DEFAULT_OUTPUT_DIR);
const fixtureDir = args["fixture-dir"] ? path.resolve(args["fixture-dir"]) : null;
const supabaseUrl = process.env.SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!fixtureDir && (!supabaseUrl || !serviceRoleKey)) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (or pass --fixture-dir).");
  process.exit(1);
}

const [liveState, monthHistory, blocs, blocMembers, seasonOverrides] = fixtureDir
  ? [
      readFixture("live_state.json"),
      readFixture("month_history.json"),
      readFixture("blocs.json"),
      readFixture("bloc_members.json"),
      readFixture("season_overrides.json")
    ]
  : await Promise.all([
      fetchLiveBlobState(),
      fetchRpcArray("read_ante_core_month_history"),
      fetchRpcArray("read_ante_core_blocs"),
      fetchRpcArray("read_ante_core_bloc_members"),
      fetchRpcArray("read_ante_core_season_overrides")
    ]);

const blobState = liveState.state || {};
const blobGroups = blobState.groups || {};

// Blob monthHistory is an array of snapshots keyed by `key`; index it as
// group -> monthKey -> snapshot so canonical rows can be looked up directly.
const blobMonthsByGroup = {};
for (const [groupId, group] of Object.entries(blobGroups)) {
  const months = Array.isArray(group?.monthHistory) ? group.monthHistory : [];
  blobMonthsByGroup[groupId] = Object.fromEntries(
    months.filter(month => month?.key).map(month => [month.key, month])
  );
}

const checks = [
  checkHistoricalWorkoutCounts(),
  checkHistoricalReactionCoverage(),
  checkHistoricalSettlements(),
  checkSeasonOverrideParity(),
  checkBlocSortOrder(),
  checkMemberSortOrder(),
  describeOpenSeasonScope()
];

const failures = checks.filter(check => !check.ok && check.status !== "warning" && check.status !== "info");
const warnings = checks.filter(check => check.status === "warning");

const report = {
  generatedAt: new Date().toISOString(),
  source: {
    ...(fixtureDir ? { fixtureDir } : { supabaseUrl }),
    blobRevision: liveState.revision ?? null,
    blobUpdatedAt: liveState.updated_at ?? null
  },
  summary: {
    blobGroups: Object.keys(blobGroups).length,
    canonicalClosedSeasons: monthHistory.length,
    canonicalBlocs: blocs.length,
    canonicalActiveMembers: blocMembers.length
  },
  checks,
  failures,
  warnings
};

fs.mkdirSync(outputDir, { recursive: true });
const reportPath = path.join(outputDir, `parity-gate-${dateStamp()}.json`);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(JSON.stringify({
  reportPath,
  blobRevision: report.source.blobRevision,
  checkCount: checks.length,
  failureCount: failures.length,
  warningCount: warnings.length,
  failedChecks: failures.map(check => check.name),
  warnedChecks: warnings.map(check => check.name)
}, null, 2));

process.exit(failures.length ? 1 : 0);

// --- checks -----------------------------------------------------------------

// Audit area 1. The documented SQL compares workout_count against a raw
// count(wl.id), but the app counts a log only when isCountedLog() is true, which
// excludes flagStatus === "rejected". Comparing against the raw row count
// therefore reports drift for any member with a rejected log in a closed month.
// Mirror the app's rule instead.
function checkHistoricalWorkoutCounts() {
  const mismatches = [];
  for (const season of monthHistory) {
    const logs = Array.isArray(season.logs) ? season.logs : [];
    for (const member of season.members || []) {
      const actual = logs.filter(log =>
        log?.owner_display_name === member.display_name && !isRejected(log)
      ).length;
      const canonical = Number(member.workout_count || 0);
      if (canonical !== actual) {
        mismatches.push({
          group: season.legacy_group_key,
          monthKey: season.month_key,
          member: member.display_name,
          canonicalWorkoutCount: canonical,
          countedLogRows: actual
        });
      }
    }
  }
  return {
    name: "historical-workout-count-parity",
    ok: mismatches.length === 0,
    details: {
      note: "Counts exclude rejected logs, matching isCountedLog() in api/lift-log.js.",
      mismatchCount: mismatches.length,
      mismatches: mismatches.slice(0, SAMPLE_LIMIT)
    }
  };
}

// Audit area 2. A closed month with logs but no reactions is only a problem if
// the blob recorded reactions for that same month, so compare both sides rather
// than asserting a canonical floor.
function checkHistoricalReactionCoverage() {
  const losses = [];
  const extras = [];
  for (const season of monthHistory) {
    const canonicalCount = (season.logs || [])
      .reduce((total, log) => total + countReactions(log?.reactions), 0);
    const blobMonth = blobMonthsByGroup[season.legacy_group_key]?.[season.month_key];
    if (!blobMonth) continue;
    const blobCount = Object.values(blobMonth.logsByUser || {})
      .flat()
      .reduce((total, log) => total + countReactions(log?.reactions), 0);

    if (blobCount > canonicalCount) {
      losses.push({
        group: season.legacy_group_key,
        monthKey: season.month_key,
        blobReactions: blobCount,
        canonicalReactions: canonicalCount
      });
    } else if (canonicalCount > blobCount) {
      extras.push({
        group: season.legacy_group_key,
        monthKey: season.month_key,
        blobReactions: blobCount,
        canonicalReactions: canonicalCount
      });
    }
  }
  return {
    name: "historical-reaction-coverage",
    ok: losses.length === 0,
    ...(losses.length === 0 && extras.length ? { status: "warning" } : {}),
    details: {
      note: "Fails only on canonical reaction loss; canonical-ahead months are reported as extras.",
      lossCount: losses.length,
      losses: losses.slice(0, SAMPLE_LIMIT),
      extraCount: extras.length,
      extras: extras.slice(0, SAMPLE_LIMIT)
    }
  };
}

// Audit area 3. Blob settlements are { name: { status, settledAt, updatedAt } };
// canonical exposes settlement_status per member. Absent on both sides is fine.
function checkHistoricalSettlements() {
  const mismatches = [];
  for (const season of monthHistory) {
    const blobMonth = blobMonthsByGroup[season.legacy_group_key]?.[season.month_key];
    if (!blobMonth) continue;
    const blobSettlements = blobMonth.settlements || {};
    const names = new Set([
      ...(season.members || []).map(member => member.display_name),
      ...Object.keys(blobSettlements)
    ]);
    for (const name of names) {
      const canonicalStatus = (season.members || [])
        .find(member => member.display_name === name)?.settlement_status || null;
      const blobStatus = blobSettlements[name]?.status || null;
      if (canonicalStatus !== blobStatus) {
        mismatches.push({
          group: season.legacy_group_key,
          monthKey: season.month_key,
          member: name,
          canonicalStatus,
          blobStatus
        });
      }
    }
  }
  return {
    name: "historical-settlement-parity",
    ok: mismatches.length === 0,
    details: {
      mismatchCount: mismatches.length,
      mismatches: mismatches.slice(0, SAMPLE_LIMIT)
    }
  };
}

// Season override parity — the documented drift risk the six audit areas do
// not cover. Blob stores group.seasonOverrides[monthKey]; canonical rows come
// from read_ante_core_season_overrides. Substantive fields (prorated,
// proratedMas) and presence on both sides gate the run; chosenBy is a
// display-name field with documented historical noise, so name diffs are
// surfaced as a warning rather than a failure.
function checkSeasonOverrideParity() {
  const mismatches = [];
  const nameDiffs = [];
  const canonicalByKey = new Map(
    seasonOverrides.map(row => [`${row.legacy_group_key}:${row.month_key}`, row])
  );
  const seen = new Set();

  for (const [groupId, group] of Object.entries(blobGroups)) {
    for (const [monthKey, override] of Object.entries(group?.seasonOverrides || {})) {
      if (!override) continue;
      const key = `${groupId}:${monthKey}`;
      seen.add(key);
      const row = canonicalByKey.get(key);
      if (!row) {
        mismatches.push({ group: groupId, monthKey, issue: "missing-canonical" });
        continue;
      }
      const blobMas = normalizeMas(override.proratedMas);
      const canonicalMas = normalizeMas(row.prorated_mas);
      if (Boolean(override.prorated) !== Boolean(row.prorated) || blobMas !== canonicalMas) {
        mismatches.push({
          group: groupId,
          monthKey,
          issue: "field-drift",
          blob: { prorated: Boolean(override.prorated), proratedMas: blobMas },
          canonical: { prorated: Boolean(row.prorated), proratedMas: canonicalMas }
        });
      } else if ((override.chosenBy || null) !== (row.chosen_by || null)) {
        nameDiffs.push({
          group: groupId,
          monthKey,
          blobChosenBy: override.chosenBy || null,
          canonicalChosenBy: row.chosen_by || null
        });
      }
    }
  }
  for (const [key, row] of canonicalByKey) {
    if (!seen.has(key)) {
      mismatches.push({
        group: row.legacy_group_key,
        monthKey: row.month_key,
        issue: "missing-blob"
      });
    }
  }
  return {
    name: "season-override-parity",
    ok: mismatches.length === 0,
    ...(mismatches.length === 0 && nameDiffs.length ? { status: "warning" } : {}),
    details: {
      note: "prorated/proratedMas and presence gate the run; chosenBy diffs warn only (display-name noise).",
      blobOverrides: seen.size,
      canonicalOverrides: canonicalByKey.size,
      mismatchCount: mismatches.length,
      mismatches: mismatches.slice(0, SAMPLE_LIMIT),
      chosenByDiffCount: nameDiffs.length,
      chosenByDiffs: nameDiffs.slice(0, SAMPLE_LIMIT)
    }
  };
}

// Audit area 4. Null sort_order blocks canonical groupOrder authority. The
// documented pass condition scopes to ACTIVE blocs — a bloc with no active
// members appears in nobody's group list, so its ordering is moot. Dead blocs
// with null sort_order are reported informationally, not as failures.
function checkBlocSortOrder() {
  const activeBlocKeys = new Set(blocMembers.map(member => member.legacy_group_key));
  const nullSorted = blocs.filter(bloc => bloc.sort_order === null || bloc.sort_order === undefined);
  const missingActive = nullSorted
    .filter(bloc => activeBlocKeys.has(bloc.legacy_group_key))
    .map(bloc => ({ group: bloc.legacy_group_key, name: bloc.name }));
  const missingInactive = nullSorted
    .filter(bloc => !activeBlocKeys.has(bloc.legacy_group_key))
    .map(bloc => ({ group: bloc.legacy_group_key, name: bloc.name }));
  return {
    name: "bloc-sort-order-coverage",
    ok: missingActive.length === 0,
    details: {
      note: "Guarded blob ordering fallback must remain until active-bloc coverage is zero.",
      totalBlocs: blocs.length,
      activeBlocs: activeBlocKeys.size,
      missingActiveCount: missingActive.length,
      missingActive: missingActive.slice(0, SAMPLE_LIMIT),
      inactiveBlocsWithNullSortOrder: missingInactive.slice(0, SAMPLE_LIMIT)
    }
  };
}

// Audit area 5. read_ante_core_bloc_members already filters to left_at is null,
// so every row here is an active member.
function checkMemberSortOrder() {
  const missing = blocMembers
    .filter(member => member.sort_order === null || member.sort_order === undefined)
    .map(member => ({ group: member.legacy_group_key, member: member.display_name }));
  return {
    name: "member-sort-order-coverage",
    ok: missing.length === 0,
    details: {
      note: "Guarded blob memberOrder fallback must remain until this is zero.",
      totalActiveMembers: blocMembers.length,
      missingCount: missing.length,
      missing: missing.slice(0, SAMPLE_LIMIT)
    }
  };
}

// Audit area 6 is interpretive, not a gate: a zero-log, non-excused member
// legitimately has no open-season status row. Report scope so the run is
// self-describing without ever failing on it.
function describeOpenSeasonScope() {
  return {
    name: "open-season-scope",
    ok: true,
    status: "info",
    details: {
      note: "Open seasons are excluded by design; season_member_status is a rollover snapshot, not the live counter.",
      closedSeasonsAudited: monthHistory.length,
      blobGroupsWithHistory: Object.values(blobMonthsByGroup).filter(months => Object.keys(months).length).length
    }
  };
}

// --- helpers ----------------------------------------------------------------

function readFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8"));
}

function isRejected(log) {
  return String(log?.flag_status || "").trim().toLowerCase() === "rejected";
}

// Mirrors normalizeSeasonOverrides() in api/lift-log.js: non-finite becomes
// null, otherwise clamped to a minimum of 1 and rounded.
function normalizeMas(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(1, Math.round(num)) : null;
}

// Both sides shape reactions as { emoji: [reactorName, ...] }.
function countReactions(reactions) {
  if (!reactions || typeof reactions !== "object") return 0;
  return Object.values(reactions)
    .reduce((total, names) => total + (Array.isArray(names) ? names.length : 0), 0);
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
  const payload = await fetchRestJson(`/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({})
  });
  return Array.isArray(payload) ? payload : [];
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
