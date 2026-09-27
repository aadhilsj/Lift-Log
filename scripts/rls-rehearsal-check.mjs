// Before/after harness for the RLS migration
// (supabase/migrations/20260926120000_enable_rls_on_server_only_tables.sql).
//
// The migration enables RLS with no policies on eight server-only ante_core
// tables. The claim is that this cannot break the app, because every path the
// app uses is exempt: service_role carries BYPASSRLS, and the functions over
// these tables are SECURITY DEFINER running as the table owner. That claim is
// worth proving rather than asserting, because if it is wrong the failure mode
// is Bloc Stream, comments and solo mode going silently empty in production.
//
// So: run this BEFORE applying the migration to record what healthy looks
// like, apply it, then run it AFTER and diff. Identical output means the
// SECURITY DEFINER path is genuinely unaffected.
//
// Read-only. Every call is a read RPC or a select; nothing is written.
//
//   node scripts/rls-rehearsal-check.mjs --env .env.staging.local --label before
//   # apply the migration
//   node scripts/rls-rehearsal-check.mjs --env .env.staging.local --label after
//   node scripts/rls-rehearsal-check.mjs --compare
//
// Point --env at a staging env file. It refuses to run against the production
// project ref, since a mistake here would mean probing production while
// believing it is a rehearsal.

import fs from "node:fs";
import path from "node:path";

const PRODUCTION_REF = "bpvvvqjsfwmmfjvvijkd";
const OUTPUT_DIR = "migration-output/rls-rehearsal";

const args = parseArgs(process.argv.slice(2));

if (args.compare === "true") {
  compareRuns();
  process.exit(0);
}

const label = args.label || "run";
loadEnvFile(args.env || ".env.staging.local");

const supabaseUrl = process.env.SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

// Refuse production outright. The whole point of a rehearsal is that it is not
// production, and a mislabelled env file should fail loudly rather than
// quietly probe live data.
const ref = projectRefFromKey(serviceRoleKey);
if (ref === PRODUCTION_REF) {
  console.error(`Refusing to run: that key is for production (${ref}). Use a staging env file.`);
  process.exit(1);
}

console.log(`project ref : ${ref}`);
console.log(`label       : ${label}\n`);

// Discover a real bloc and member to exercise, rather than hardcoding ids that
// would silently stop matching after a fresh restore.
const blocs = await rpc("read_ante_core_blocs", {});
const members = await rpc("read_ante_core_bloc_members", {});
const firstBloc = (Array.isArray(blocs) ? blocs : [])[0];
const blocKey = firstBloc?.legacy_group_key || null;
const member = (Array.isArray(members) ? members : []).find(m => m.legacy_group_key === blocKey);
const authUserId = member?.auth_user_id || null;

console.log(`exercising  : bloc=${blocKey} member=${member?.display_name || "(none)"}\n`);

// Each probe names the table whose RLS it depends on, so a failure points
// straight at the cause instead of just saying "stream broke".
const probes = [
  { name: "blocs (control)",        table: "blocs (RLS already on)",        call: () => rpc("read_ante_core_blocs", {}) },
  { name: "bloc stream",            table: "bloc_messages",                 call: () => rpc("read_ante_core_bloc_stream", { p_legacy_group_key: blocKey, p_auth_user_id: authUserId, p_limit: 20 }) },
  { name: "stream unread count",    table: "bloc_message_reads",            call: () => rpc("read_ante_core_bloc_stream_unread_count", { p_legacy_group_key: blocKey, p_auth_user_id: authUserId }) },
  { name: "revision clock",         table: "revision_clock",                call: () => rpc("read_ante_core_revision", {}) },
  { name: "current logs",           table: "workout_logs (RLS already on)", call: () => rpc("read_ante_core_current_logs", {}) },
  { name: "month history",          table: "seasons (RLS already on)",      call: () => rpc("read_ante_core_month_history", {}) },
  { name: "comment counts",         table: "workout_log_comments",          call: () => commentCountsProbe() },
  { name: "comments for a log",     table: "workout_log_comments",          call: () => commentsProbe() }
];

const results = [];
for (const probe of probes) {
  try {
    const value = await probe.call();
    results.push({ name: probe.name, table: probe.table, ok: true, shape: describe(value) });
    console.log(`[OK]   ${probe.name.padEnd(22)} ${describe(value)}`);
  } catch (err) {
    results.push({ name: probe.name, table: probe.table, ok: false, error: String(err.message || err).slice(0, 300) });
    console.log(`[FAIL] ${probe.name.padEnd(22)} ${String(err.message || err).slice(0, 160)}`);
  }
}

// The other half of the claim: a browser must still be shut out. Uses only the
// publishable key, which is already public in the app bundle.
const anonProbes = [];
for (const table of ["bloc_messages", "workout_log_comments", "solo_requests"]) {
  const status = await anonStatus(table);
  anonProbes.push({ table, ...status });
  console.log(`[anon] ${table.padEnd(22)} default=${status.defaultSchema} ante_core=${status.anteCore}`);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const outPath = path.join(OUTPUT_DIR, `${label}.json`);
fs.writeFileSync(outPath, JSON.stringify({ ref, label, blocKey, results, anonProbes }, null, 2));

const failures = results.filter(r => !r.ok);
console.log(`\n${results.length - failures.length}/${results.length} server-path probes OK -> ${outPath}`);
if (failures.length) {
  console.log(`FAILED: ${failures.map(f => `${f.name} (${f.table})`).join(", ")}`);
}
process.exit(failures.length ? 1 : 0);

// --- probes -----------------------------------------------------------------

// The comment RPCs enforce bloc membership, so a log has to be paired with a
// member of that log's own bloc — not just any member. Pairing them wrongly
// returns 403 "not a bloc member", which would look like the migration broke
// something when it is really the fixture being wrong.
async function firstLogWithMember() {
  const logs = await rpc("read_ante_core_current_logs", {});
  const memberByBloc = new Map();
  for (const m of Array.isArray(members) ? members : []) {
    if (m.auth_user_id && !memberByBloc.has(m.legacy_group_key)) {
      memberByBloc.set(m.legacy_group_key, m.auth_user_id);
    }
  }
  for (const log of Array.isArray(logs) ? logs : []) {
    const uid = memberByBloc.get(log.legacy_group_key);
    if (uid) return { log, authUserId: uid };
  }
  return null;
}

async function commentCountsProbe() {
  const pair = await firstLogWithMember();
  if (!pair) return "(no log with a matching bloc member)";
  return await rpc("read_ante_core_workout_log_comment_counts", {
    p_legacy_group_key: pair.log.legacy_group_key,
    p_auth_user_id: pair.authUserId,
    p_workout_log_ids: [String(pair.log.id)]
  });
}

async function commentsProbe() {
  const pair = await firstLogWithMember();
  if (!pair) return "(no log with a matching bloc member)";
  return await rpc("read_ante_core_workout_log_comments", {
    p_legacy_group_key: pair.log.legacy_group_key,
    p_auth_user_id: pair.authUserId,
    p_workout_log_id: String(pair.log.id)
  });
}

async function anonStatus(table) {
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!anonKey) return { defaultSchema: "(no anon key in env)", anteCore: "(skipped)" };
  const base = `${supabaseUrl}/rest/v1/${table}?select=*&limit=1`;
  const plain = await fetch(base, { headers: { apikey: anonKey } });
  const scoped = await fetch(base, { headers: { apikey: anonKey, "Accept-Profile": "ante_core" } });
  return { defaultSchema: plain.status, anteCore: scoped.status };
}

// --- helpers ----------------------------------------------------------------

async function rpc(name, body) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${name} -> ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return await response.json();
}

// Row counts, not contents: the question is whether the path still returns
// data, and staging holds real display names that need not be written to disk.
function describe(value) {
  if (Array.isArray(value)) return `array(${value.length})`;
  if (value && typeof value === "object") {
    if (Array.isArray(value.messages)) return `object{messages:${value.messages.length}}`;
    return `object{${Object.keys(value).slice(0, 4).join(",")}}`;
  }
  return `${typeof value}(${String(value).slice(0, 40)})`;
}

function projectRefFromKey(jwt) {
  try {
    return JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).ref || "(unknown)";
  } catch {
    return "(unparseable)";
  }
}

function compareRuns() {
  const before = readRun("before");
  const after = readRun("after");
  if (!before || !after) {
    console.error("Need both before.json and after.json in " + OUTPUT_DIR);
    process.exit(1);
  }
  let diffs = 0;
  console.log("probe                    before          after");
  for (const b of before.results) {
    const a = after.results.find(r => r.name === b.name);
    const bs = b.ok ? b.shape : "FAIL";
    const as = a ? (a.ok ? a.shape : "FAIL") : "(missing)";
    const same = bs === as;
    if (!same) diffs += 1;
    console.log(`${same ? "  " : "! "}${b.name.padEnd(22)} ${String(bs).padEnd(15)} ${as}`);
  }
  for (const b of before.anonProbes || []) {
    const a = (after.anonProbes || []).find(r => r.table === b.table);
    const same = a && a.defaultSchema === b.defaultSchema && a.anteCore === b.anteCore;
    if (!same) diffs += 1;
    console.log(`${same ? "  " : "! "}anon ${b.table.padEnd(17)} ${b.defaultSchema}/${b.anteCore}`.padEnd(56) + `${a ? `${a.defaultSchema}/${a.anteCore}` : "(missing)"}`);
  }
  console.log(diffs === 0
    ? "\nIdentical. The SECURITY DEFINER path is unaffected by RLS, as expected."
    : `\n${diffs} difference(s). Investigate before going near production.`);
  process.exit(diffs === 0 ? 0 : 1);
}

function readRun(label) {
  const p = path.join(OUTPUT_DIR, `${label}.json`);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Env file not found: ${filePath}`);
    process.exit(1);
  }
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/s, "$2");
    if (key && value !== "[SENSITIVE]") process.env[key] = value;
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
