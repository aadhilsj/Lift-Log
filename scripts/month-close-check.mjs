// Month-close verification, for 1 October 2026 and every close after it.
//
// 1 October is the first month close that counts from canonical rather than
// the blob (rebuildClosedMonthSnapshotFromCanonicalLogs, shipped 20 September).
// It is a one-shot event: if a month freezes wrong, the numbers are permanent
// and the next chance to observe the code path is a month away. So the state
// is recorded before the close and compared after, rather than eyeballed.
//
// It also answers the specific worry from handover-2026-09-14 §9: 93 September
// logs carry an `activity` in canonical that the blob never received. On the
// old blob-based close those would have been lost; this close should keep them.
//
// Read-only. Run before the close, then after it:
//
//   node scripts/month-close-check.mjs --before
//   # 1 October, once the rollover has fired
//   node scripts/month-close-check.mjs --after
//
// Uses .env.local (production) by default; --env points elsewhere.

import fs from "node:fs";
import path from "node:path";

const OUTPUT_DIR = "migration-output/month-close";
const args = parseArgs(process.argv.slice(2));
const mode = args.after === "true" ? "after" : "before";

loadEnvFile(args.env || ".env.local");
const supabaseUrl = process.env.SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

// Month keys are JS-style zero-indexed: September 2026 is "2026-8".
const closingKey = args["month-key"] || "2026-8";

const [openSeasons, monthHistory, currentLogs, blocs, systemEvents, blobRow] = await Promise.all([
  rpc("read_ante_core_open_seasons", {}),
  rpc("read_ante_core_month_history", {}),
  rpc("read_ante_core_current_logs", {}),
  rpc("read_ante_core_blocs", {}),
  rpc("read_ante_core_system_events", { p_limit: 100 }),
  rest("/rest/v1/lift_log_state?id=eq.true&select=revision,updated_at")
]);

const blobRevision = blobRow?.[0]?.revision ?? null;

if (mode === "before") {
  // What September looks like while it is still the open month. These are the
  // numbers the closed snapshot has to reproduce.
  const withActivity = currentLogs.filter(l => l.activity);
  const snapshot = {
    mode, closingKey, blobRevision,
    capturedAt: new Date().toISOString(),
    openSeasonsOnClosingMonth: openSeasons.filter(s => s.month_key === closingKey).length,
    openSeasonsTotal: openSeasons.length,
    currentLogs: currentLogs.length,
    currentLogsWithActivity: withActivity.length,
    activityByBloc: countBy(withActivity, l => l.legacy_group_key),
    logsByBloc: countBy(currentLogs, l => l.legacy_group_key),
    blocs: blocs.length
  };
  write("before.json", snapshot);
  console.log(`BEFORE — blob revision ${blobRevision}`);
  console.log(`  open seasons on ${closingKey}: ${snapshot.openSeasonsOnClosingMonth}/${snapshot.openSeasonsTotal}`);
  console.log(`  current logs: ${snapshot.currentLogs}`);
  console.log(`  ...carrying an activity: ${snapshot.currentLogsWithActivity}`);
  console.log(`\nRun again with --after once the rollover has fired on 1 October.`);
  process.exit(0);
}

// --- after ------------------------------------------------------------------

const before = read("before.json");
if (!before) {
  console.error("No before.json — the pre-close snapshot is required to compare against.");
  process.exit(1);
}

const closed = monthHistory.filter(s => s.month_key === closingKey);
const closedLogs = closed.flatMap(s => s.logs || []);
const closedWithActivity = closedLogs.filter(l => l.activity);
const skips = (systemEvents?.recent || []).filter(e => e.eventType === "rollover_skipped");

const checks = [];

// 1. Every bloc moved off the closing month.
const stillOpen = openSeasons.filter(s => s.month_key === closingKey);
checks.push({
  name: "all blocs rolled forward",
  ok: stillOpen.length === 0,
  detail: stillOpen.length === 0
    ? `0 blocs still open on ${closingKey}`
    : `${stillOpen.length} still on ${closingKey}: ${stillOpen.map(s => s.legacy_group_key).join(", ")}`
});

// 2. The closing month exists in history for the blocs that had it open.
checks.push({
  name: "closing month archived",
  ok: closed.length >= before.openSeasonsOnClosingMonth,
  detail: `${closed.length} closed seasons for ${closingKey}, expected >= ${before.openSeasonsOnClosingMonth}`
});

// 3. Logs survived the freeze. The closed snapshot counts only counted logs,
//    so equality is the expectation and fewer is the thing to investigate.
checks.push({
  name: "logs survived the close",
  ok: closedLogs.length >= before.currentLogs,
  detail: `${closedLogs.length} archived vs ${before.currentLogs} open before`
});

// 4. The §9 worry: activities existed only in canonical, and the old
//    blob-based close would have dropped them.
checks.push({
  name: "activities survived the close",
  ok: closedWithActivity.length >= before.currentLogsWithActivity,
  detail: `${closedWithActivity.length} archived with activity vs ${before.currentLogsWithActivity} before`
});

// 5. A skip is the safe outcome, not a silent one — it means that bloc kept
//    its old month and needs a look.
checks.push({
  name: "no blocs skipped",
  ok: skips.length === 0,
  detail: skips.length === 0
    ? "no rollover_skipped events"
    : `${skips.length} skipped: ${skips.map(e => `${e.blocKey} (${e.detail || "no detail"})`).join("; ")}`,
  warnOnly: true
});

console.log(`AFTER — blob revision ${blobRevision} (was ${before.blobRevision})\n`);
for (const c of checks) {
  console.log(`[${c.ok ? "OK  " : c.warnOnly ? "WARN" : "FAIL"}] ${c.name.padEnd(30)} ${c.detail}`);
}

write("after.json", { mode, closingKey, blobRevision, capturedAt: new Date().toISOString(), checks, closedSeasons: closed.length, closedLogs: closedLogs.length, closedWithActivity: closedWithActivity.length });

const failures = checks.filter(c => !c.ok && !c.warnOnly);
console.log(failures.length === 0
  ? "\nMonth close on canonical verified. Run `npm run parity:gate` as well for the full drift check."
  : `\n${failures.length} check(s) FAILED — investigate before anything else ships.`);
process.exit(failures.length ? 1 : 0);

// --- helpers ----------------------------------------------------------------

function countBy(rows, keyFn) {
  const out = {};
  for (const r of rows) { const k = keyFn(r); out[k] = (out[k] || 0) + 1; }
  return out;
}

async function rpc(name, body) {
  return await rest(`/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  });
}

async function rest(endpoint, options = { method: "GET" }) {
  const response = await fetch(`${supabaseUrl}${endpoint}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/json",
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`${endpoint} -> ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return await response.json();
}

function write(name, value) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, name), JSON.stringify(value, null, 2));
}

function read(name) {
  const p = path.join(OUTPUT_DIR, name);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/s, "$2");
    if (key && process.env[key] === undefined && value !== "[SENSITIVE]") process.env[key] = value;
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) parsed[key] = "true";
    else { parsed[key] = next; i += 1; }
  }
  return parsed;
}
