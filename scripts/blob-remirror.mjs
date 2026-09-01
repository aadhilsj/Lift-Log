// Canonical -> blob re-mirror for mirror-skip rollback.
//
// While BLOB_MIRROR_SKIP_ACTIONS is enabled for an action family, the blob
// misses that family's writes. If the flag is rolled back, the blob is stale
// for the skip window. This script closes that gap by copying the affected
// fields from canonical back into the blob — and nothing else.
//
// It is deliberately NOT built on fetchReadableCurrentState(): readable state
// filters the group set through canonical blocs, so persisting it would erase
// blob-only groups. This script starts from the current blob and touches only
// the data surface of the wave being rolled back:
//
//   --scope wave-a   reaction/flag fields on existing current-month logs
//                    (reaction, flag, flag-response, flag-review)
//   --scope wave-b   current-month log sets: add/remove/replace from canonical
//                    (add-log, multi-log, delete-log; implies wave-a fields)
//   --scope wave-c   group settings and season overrides
//                    (update-settings, season-proration-choice)
//
// Never touched: monthHistory, leftMemberNames, joinedMonthByName, memberOrder,
// profiles, groups with no canonical bloc row.
//
// Dry-run by default: prints and saves a diff report, writes nothing. Pass
// --apply to persist, which uses a compare-and-swap on the blob revision and
// aborts if a concurrent write moved it. Run during low traffic and run the
// parity gate afterwards.
//
// Usage:
//   node scripts/blob-remirror.mjs --scope wave-a            # dry run
//   node scripts/blob-remirror.mjs --scope wave-a --apply
//   node scripts/blob-remirror.mjs --scope wave-a --fixture-dir <dir>  # tests

import fs from "node:fs";
import path from "node:path";

const DEFAULT_OUTPUT_DIR = "migration-output/blob-remirror";
const SCOPES = ["wave-a", "wave-b", "wave-c"];

// Reaction/flag fields owned by wave A actions, canonical -> blob names.
const WAVE_A_FIELDS = {
  reactions: "reactions",
  flag_status: "flagStatus",
  flag_reason: "flagReason",
  flag_response: "flagResponse",
  flagged_by: "flaggedBy",
  decision_by: "decisionBy",
  decision_at: "decisionAt"
};

// Full canonical -> blob log mapping for wave B log replacement.
const LOG_FIELDS = {
  id: "id",
  workout_type: "type",
  workout_date: "date",
  note: "note",
  photo_url: "photoUrl",
  created_at: "createdAt",
  verified_via: "verifiedVia",
  comment_count: "commentCount",
  ...WAVE_A_FIELDS
};

// Canonical bloc row -> blob group.settings mapping for wave C, matching
// buildNormalizedSettings() in api/lift-log.js.
const SETTINGS_FIELDS = {
  min_target: "minTarget",
  accepted_workout_types: "acceptedWorkoutTypes",
  time_zone: "timeZone",
  fine_amount: "fineAmount",
  escalation_step_amount: "escalationStepAmount",
  currency: "currency",
  fee_model: "feeModel",
  min_run_distance: "minRunDistance",
  distance_unit: "distanceUnit",
  strava_enabled: "stravaEnabled"
};

loadEnvFile(".env.local");
loadEnvFile(".env");

const args = parseArgs(process.argv.slice(2));
const scope = args.scope;
const apply = args.apply === "true";
const fixtureDir = args["fixture-dir"] ? path.resolve(args["fixture-dir"]) : null;
const outputDir = path.resolve(args["output-dir"] || DEFAULT_OUTPUT_DIR);
const supabaseUrl = process.env.SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SCOPES.includes(scope)) {
  console.error(`--scope is required: ${SCOPES.join(" | ")}`);
  process.exit(1);
}
if (fixtureDir && apply) {
  console.error("--apply cannot be combined with --fixture-dir.");
  process.exit(1);
}
if (!fixtureDir && (!supabaseUrl || !serviceRoleKey)) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (or pass --fixture-dir).");
  process.exit(1);
}

const [liveState, currentLogs, blocs, seasonOverrides] = fixtureDir
  ? [
      readFixture("live_state.json"),
      readFixture("current_logs.json"),
      readFixture("blocs.json"),
      readFixture("season_overrides.json")
    ]
  : await Promise.all([
      fetchLiveBlobState(),
      fetchRpcArray("read_ante_core_current_logs"),
      fetchRpcArray("read_ante_core_blocs"),
      fetchRpcArray("read_ante_core_season_overrides")
    ]);

const startRevision = Number(liveState.revision);
if (!Number.isFinite(startRevision)) {
  console.error("Could not read blob revision; refusing to continue.");
  process.exit(1);
}

// Deep-copy so the diff can compare against the untouched original.
const nextState = JSON.parse(JSON.stringify(liveState.state || {}));
const groups = nextState.groups || {};

const canonicalBlocByKey = new Map(blocs.map(row => [row.legacy_group_key, row]));
const canonicalLogsByGroup = new Map();
for (const row of currentLogs) {
  if (!canonicalLogsByGroup.has(row.legacy_group_key)) canonicalLogsByGroup.set(row.legacy_group_key, []);
  canonicalLogsByGroup.get(row.legacy_group_key).push(row);
}
const overridesByGroup = new Map();
for (const row of seasonOverrides) {
  if (!overridesByGroup.has(row.legacy_group_key)) overridesByGroup.set(row.legacy_group_key, []);
  overridesByGroup.get(row.legacy_group_key).push(row);
}

const changes = [];
const skippedGroups = [];

for (const [groupId, group] of Object.entries(groups)) {
  if (!canonicalBlocByKey.has(groupId)) {
    // Blob-only group (no canonical row): out of every wave's write surface.
    skippedGroups.push(groupId);
    continue;
  }
  if (scope === "wave-a") remirrorWaveA(groupId, group);
  if (scope === "wave-b") remirrorWaveB(groupId, group);
  if (scope === "wave-c") remirrorWaveC(groupId, group);
}

const report = {
  generatedAt: new Date().toISOString(),
  scope,
  mode: apply ? "apply" : "dry-run",
  source: fixtureDir ? { fixtureDir } : { supabaseUrl },
  startRevision,
  changeCount: changes.length,
  changes,
  skippedBlobOnlyGroups: skippedGroups
};

fs.mkdirSync(outputDir, { recursive: true });
const reportPath = path.join(outputDir, `remirror-${scope}-${dateStamp()}.json`);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

let applied = false;
if (apply && changes.length) {
  applied = await applyWithRevisionCas();
}

console.log(JSON.stringify({
  reportPath,
  scope,
  mode: report.mode,
  startRevision,
  changeCount: changes.length,
  skippedBlobOnlyGroups: skippedGroups,
  ...(apply ? { applied, ...(applied ? { newRevision: startRevision + 1 } : {}) } : {})
}, null, 2));

if (apply && changes.length && !applied) process.exit(1);

// --- wave scopes ------------------------------------------------------------

function remirrorWaveA(groupId, group) {
  const canonicalById = new Map(
    (canonicalLogsByGroup.get(groupId) || []).map(row => [String(row.id), row])
  );
  for (const [owner, logs] of Object.entries(group.logs || {})) {
    for (const log of Array.isArray(logs) ? logs : []) {
      const row = canonicalById.get(String(log?.id));
      if (!row) continue; // log existence is wave B's surface
      for (const [canonicalField, blobField] of Object.entries(WAVE_A_FIELDS)) {
        const nextValue = normalizeFieldValue(canonicalField, row[canonicalField]);
        // Normalize the blob side with the same defaults before comparing:
        // normalizeLogEntry() in api/lift-log.js coerces missing flag strings
        // to "" and missing reactions to {}, so undefined vs "" is not drift.
        if (!deepEqual(normalizeFieldValue(canonicalField, log[blobField]), nextValue)) {
          changes.push({ group: groupId, owner, logId: String(log.id), field: blobField, from: log[blobField], to: nextValue });
          log[blobField] = nextValue;
        }
      }
    }
  }
}

function remirrorWaveB(groupId, group) {
  remirrorWaveA(groupId, group); // field drift on surviving logs
  const canonicalRows = canonicalLogsByGroup.get(groupId) || [];
  const canonicalIds = new Set(canonicalRows.map(row => String(row.id)));
  const blobIds = new Set(
    Object.values(group.logs || {}).flat().map(log => String(log?.id)).filter(Boolean)
  );

  // Remove blob logs canonical no longer has (deleted during the skip window).
  for (const [owner, logs] of Object.entries(group.logs || {})) {
    const kept = (Array.isArray(logs) ? logs : []).filter(log => canonicalIds.has(String(log?.id)));
    if (kept.length !== (logs || []).length) {
      for (const log of logs) {
        if (!canonicalIds.has(String(log?.id))) {
          changes.push({ group: groupId, owner, logId: String(log?.id), field: "log-removed" });
        }
      }
      group.logs[owner] = kept;
    }
  }

  // Add canonical logs the blob never received.
  for (const row of canonicalRows) {
    if (blobIds.has(String(row.id))) continue;
    const owner = row.owner_display_name;
    if (!group.logs) group.logs = {};
    if (!Array.isArray(group.logs[owner])) group.logs[owner] = [];
    const entry = {};
    for (const [canonicalField, blobField] of Object.entries(LOG_FIELDS)) {
      entry[blobField] = normalizeFieldValue(canonicalField, row[canonicalField]);
    }
    group.logs[owner].push(entry);
    changes.push({ group: groupId, owner, logId: String(row.id), field: "log-added" });
  }
}

function remirrorWaveC(groupId, group) {
  const bloc = canonicalBlocByKey.get(groupId);
  if (!group.settings) group.settings = {};
  for (const [canonicalField, blobField] of Object.entries(SETTINGS_FIELDS)) {
    if (bloc[canonicalField] === undefined || bloc[canonicalField] === null) continue;
    if (!deepEqual(group.settings[blobField], bloc[canonicalField])) {
      changes.push({ group: groupId, field: `settings.${blobField}`, from: group.settings[blobField], to: bloc[canonicalField] });
      group.settings[blobField] = bloc[canonicalField];
    }
  }
  for (const row of overridesByGroup.get(groupId) || []) {
    const existing = group.seasonOverrides?.[row.month_key];
    // Drift = absence or substantive change (prorated/proratedMas), matching
    // the parity gate's semantics. chosenAt string precision differs between
    // the blob and the RPC's timestamptz serialization, and chosenBy carries
    // documented display-name noise — neither is drift, so an existing
    // override keeps its own metadata.
    const substantiveDrift = !existing
      || Boolean(existing.prorated) !== Boolean(row.prorated)
      || normalizeMas(existing.proratedMas) !== normalizeMas(row.prorated_mas);
    if (!substantiveDrift) continue;
    const next = {
      prorated: Boolean(row.prorated),
      proratedMas: row.prorated_mas ?? null,
      chosenAt: existing?.chosenAt ?? row.chosen_at ?? null,
      chosenBy: existing?.chosenBy ?? row.chosen_by ?? null,
      chosenByUserId: existing?.chosenByUserId ?? row.chosen_by_user_id ?? null
    };
    {
      changes.push({ group: groupId, field: `seasonOverrides.${row.month_key}`, from: existing ?? null, to: next });
      if (!group.seasonOverrides) group.seasonOverrides = {};
      group.seasonOverrides[row.month_key] = next;
    }
  }
}

// --- apply ------------------------------------------------------------------

// Compare-and-swap on the revision column: the PATCH only matches if the blob
// is still at the revision this run read. A concurrent server write bumps the
// revision, the filter matches zero rows, and we abort instead of clobbering.
async function applyWithRevisionCas() {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/lift_log_state?id=eq.true&revision=eq.${startRevision}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        state: nextState,
        revision: startRevision + 1,
        updated_at: new Date().toISOString()
      })
    }
  );
  if (!response.ok) {
    console.error(`apply failed (${response.status}): ${await response.text()}`);
    return false;
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error(`apply aborted: blob moved past revision ${startRevision} during the run. Re-run to retry.`);
    return false;
  }
  return true;
}

// --- helpers ----------------------------------------------------------------

function normalizeFieldValue(canonicalField, value) {
  if (canonicalField === "reactions") return value && typeof value === "object" ? value : {};
  if (canonicalField === "comment_count") return Number.isFinite(Number(value)) ? Number(value) : 0;
  if (["flag_reason", "flag_response", "note", "photo_url"].includes(canonicalField)) return value ?? "";
  return value ?? null;
}

function deepEqual(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// Mirrors normalizeSeasonOverrides() in api/lift-log.js.
function normalizeMas(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(1, Math.round(num)) : null;
}

function readFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8"));
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
