// Builds the scenario the joiner prompt needs, then gets out of the way.
//
//   npm run sandbox:seed        (with `npm run sandbox` already running)
//
// The prompt appears only when all three of these hold (src/App.jsx,
// needsTrainingChoice):
//
//   1. the Bloc already has a closed month behind it
//   2. the member's join month resolves to the current month
//   3. that member has not answered yet
//
// So this creates a Bloc, gives it a month of history, and leaves an invite
// code. You supply condition 2 by joining as somebody new.
//
// The Bloc and its admin are created through the real API. The month being
// closed is placed into the blob directly — see the note further down for why
// that cannot go through the API — but it is still the app's own rollover that
// closes it, counts it and settles it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const blobFile = path.join(rootDir, ".sandbox-data", "blob.json");
const api = `http://127.0.0.1:${Number(process.env.SANDBOX_APP_PORT || 3000)}/api/lift-log`;

const ADMIN_EMAIL = "riley@local.test";
const ADMIN_NAME = "Riley";
const BLOC_NAME = "Sandbox Bloc";

const tokenFor = email =>
  `local-dev:${Buffer.from(email.trim().toLowerCase(), "utf8").toString("base64url")}`;

async function call(email, payload) {
  const response = await fetch(api, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenFor(email)}`
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* non-JSON error bodies are printed raw */ }
  if (!response.ok) {
    throw new Error(`${payload.action} failed (${response.status}): ${body?.error || text.slice(0, 300)}`);
  }
  return body;
}

async function waitForApi() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      // Any answer means the server is listening. A 401 is a perfectly good
      // sign of life here — the revision endpoint wants a signed-in caller.
      await fetch(`${api}?revision=1`);
      return;
    } catch { /* not up yet */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("The sandbox API never came up. Is `npm run sandbox` running?");
}

function readBlob() {
  return JSON.parse(fs.readFileSync(blobFile, "utf8"));
}

function writeBlob(row) {
  fs.writeFileSync(blobFile, JSON.stringify(row, null, 2));
}

// Month keys are `YYYY-M` with a ZERO-BASED month, matching the Date
// constructor the app compares them with. September 2026 is "2026-8".
function previousMonthKey(monthKey) {
  const [year, month] = String(monthKey).split("-").map(Number);
  return month === 0 ? `${year - 1}-11` : `${year}-${month - 1}`;
}

console.log("Waiting for the sandbox API…");
await waitForApi();

const existing = readBlob();
if (Object.keys(existing.state?.groups || {}).length > 0) {
  console.log("\nThe sandbox already has a Bloc in it.");
  console.log("Delete .sandbox-data/blob.json and restart `npm run sandbox` to reseed.\n");
  process.exit(0);
}

console.log(`Creating ${ADMIN_NAME}…`);
await call(ADMIN_EMAIL, { action: "auth-sync" });
await call(ADMIN_EMAIL, { action: "upsert-profile", displayName: ADMIN_NAME });

console.log(`Creating "${BLOC_NAME}"…`);
const created = await call(ADMIN_EMAIL, {
  action: "create-group",
  groupName: BLOC_NAME,
  creatorName: ADMIN_NAME,
  minTarget: 12,
  fineAmount: 10,
  escalationStepAmount: 5,
  feeModel: "escalating",
  currency: "GBP",
  groupTimeZone: "Europe/Oslo",
  trainingWheels: true
});

const groupId = Object.keys(created?.state?.groups || {})[0];
if (!groupId) throw new Error("create-group returned no Bloc.");

// A closed month needs logs dated INSIDE that month. normalizeMonthHistory
// derives a month's key from its own log dates and discards the month when
// that key is the current one — so September-dated logs can never become a
// closed August, however far `lastMonth` is rewound.
//
// The API will not accept a log dated into a past month either (it rolls the
// month over first), so the month being closed is written into the blob
// directly. Only `id`, `date` and `type` are needed: normalizeLogEntry fills
// in every other field, and the counts and settlement are still computed by
// the app's own rollover below.
const before = readBlob();
const group = before.state.groups[groupId];
const closedKey = previousMonthKey(group.lastMonth);
const [closedYear, closedMonthIndex] = closedKey.split("-").map(Number);
const closedMonthName = new Date(closedYear, closedMonthIndex, 1)
  .toLocaleString("en", { month: "long" });

const WORKOUTS = 14;
group.logs = {
  [ADMIN_NAME]: Array.from({ length: WORKOUTS }, (unused, index) => ({
    id: `seed-${index + 1}`,
    date: `${closedYear}-${String(closedMonthIndex + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
    type: "Gym"
  }))
};
group.lastMonth = closedKey;
group.createdAt = new Date(closedYear, closedMonthIndex, 1).toISOString();
before.revision = (Number(before.revision) || 0) + 1;
writeBlob(before);

console.log(`Closing ${closedMonthName} through the app's own rollover…`);
console.log(`  ${WORKOUTS} workouts for ${ADMIN_NAME} against a target of 12.`);

// A read is enough: rolloverStateIfNeeded runs on the way through and the
// result is persisted.
await fetch(api, { headers: { Authorization: `Bearer ${tokenFor(ADMIN_EMAIL)}` } });

const after = readBlob();
const settled = after.state.groups[groupId];
const history = settled.monthHistory || [];
if (history.length === 0) throw new Error("Rollover did not produce a closed month.");

const closed = history[history.length - 1];
console.log(`  Closed ${closed.label}: ${JSON.stringify(closed.counts)}`);

console.log("");
console.log("  ────────────────────────────────────────────────");
console.log(`  Bloc          ${BLOC_NAME}`);
console.log(`  Invite code   ${settled.inviteCode}`);
console.log(`  Closed month  ${closed.label}`);
console.log(`  Admin         ${ADMIN_NAME}  (riley@local.test)`);
console.log("  ────────────────────────────────────────────────");
console.log("");
console.log("  Now open http://127.0.0.1:3000 and sign in as somebody NEW");
console.log("  — say  jordan@local.test  — code 000000, then join with the");
console.log("  code above. The prompt should appear on arrival.");
console.log("");
