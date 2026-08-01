import fs from "node:fs";

loadEnvFile(".env.local");
loadEnvFile(".env");

const supabaseUrl = process.env.SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const rows = await fetchRpcArray("read_ante_core_month_history");
const mismatches = [];
let checkedMembers = 0;
let checkedSeasons = 0;

for (const row of rows) {
  const monthKey = String(row?.month_key || "");
  const members = Array.isArray(row?.members) ? row.members : [];
  const logs = Array.isArray(row?.logs) ? row.logs : [];
  if (!monthKey || members.length === 0) continue;
  checkedSeasons += 1;

  const countedLogsByName = new Map();
  for (const log of logs) {
    if (log?.flag_status === "rejected") continue;
    const owner = String(log?.owner_display_name || "").trim();
    if (!owner) continue;
    countedLogsByName.set(owner, (countedLogsByName.get(owner) || 0) + 1);
  }

  for (const member of members) {
    if (member?.joined_for_month === false) continue;
    const displayName = String(member?.display_name || "").trim();
    if (!displayName) continue;
    checkedMembers += 1;

    const storedCount = Number(member?.workout_count || 0);
    const actualCount = countedLogsByName.get(displayName) || 0;
    if (storedCount === actualCount) continue;

    mismatches.push({
      bloc: row?.bloc_name || row?.legacy_group_key || "(unknown bloc)",
      monthKey,
      label: row?.label || monthKey,
      member: displayName,
      storedCount,
      actualCount
    });
  }
}

if (mismatches.length) {
  console.error(`Rollover count audit failed: ${mismatches.length} mismatch${mismatches.length === 1 ? "" : "es"}.`);
  console.table(mismatches);
  process.exit(1);
}

console.log(`Rollover count audit passed: ${checkedMembers} members checked across ${checkedSeasons} canonical month snapshots.`);

async function fetchRpcArray(functionName) {
  let response;
  try {
    response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({})
    });
  } catch (err) {
    throw new Error(`${functionName} network failure: ${err?.cause?.code || err?.message || err}`);
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${functionName} failed (${response.status}): ${text}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error(`${functionName} returned ${typeof data}, expected array.`);
  }
  return data;
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
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}
