// New-rules Solo: an automatic goal of half the Bloc target, and a miss costs
// the standard monthly penalty. Old-rules Solo (Tobias, September 2026) stays
// fully exempt.
//
// The money is worked out in two places, the server (month close) and the app
// (Month, Settlement and profile screens). Both are checked here against the
// same months so they cannot drift apart, and the rule marker is followed
// through every rebuild a closed month goes through.
//
// Run: npm run test:solo-standard-penalty

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  applySoloRequest,
  applySoloReview,
  buildDefaultSettlements,
  buildCanonicalMonthHistoryForGroup,
  normalizeMonthHistory,
  normalizeSolo,
  rolloverGroupIfNeeded
} from "../api/lift-log.js";

// appState.js is browser-shaped; bundle it for node the way test-training-wheels does.
const outDir = mkdtempSync(join(tmpdir(), "fero-solo-penalty-"));
const outFile = join(outDir, "appState.mjs");
const banner = [
  "globalThis.window={innerWidth:390,scrollTo(){},addEventListener(){},removeEventListener(){},",
  "matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),",
  "localStorage:{getItem:()=>null,setItem(){},removeItem(){}},location:{href:'http://localhost/',search:''}};",
  "globalThis.localStorage=window.localStorage;"
].join("");
execFileSync("npx", [
  "esbuild", "src/lib/appState.js",
  "--bundle", "--platform=node", "--format=esm",
  `--outfile=${outFile}`, "--loader:.css=empty", "--log-level=error",
  `--banner:js=${banner}`
], { stdio: "inherit" });
const client = await import(pathToFileURL(outFile).href);

const SEPT = "2026-8";
const OCT = "2026-9";
const SETTINGS = { minTarget: 12, fineAmount: 10, escalationStepAmount: 5, feeModel: "escalating", currency: "GBP", timeZone: "Europe/Oslo" };
const NAMES = ["Ann", "Ben", "Cal", "Dee", "Eve"];
const TARGETS = Object.fromEntries(NAMES.map(name => [name, 12]));

client.syncActiveGroupGlobals(client.normalizeGroupState({
  id: "bloc-1", name: "Test Bloc", adminName: "Ann", inviteCode: "TESTING",
  memberOrder: [...NAMES],
  memberships: Object.fromEntries(NAMES.map((n, i) => [`m${i}`, { userId: `u${i}`, displayName: n, role: n === "Ann" ? "admin" : "member" }])),
  settings: SETTINGS, logs: {}, excused: {}, solo: {}, monthHistory: []
}));

// Dee is new-rules Solo (marker), Eve is old-rules Solo (no marker, like Tobias).
const month = (counts, { key = SEPT, solo, excused = {}, settings = SETTINGS } = {}) => ({
  key,
  label: "Sep '26",
  counts,
  excused,
  solo: solo ?? {
    Dee: { [key]: { target: 6, rule: "standard_penalty" } },
    Eve: { [key]: { target: 6 } }
  },
  training: {},
  memberTargets: TARGETS,
  settings
});

const serverOwing = m => Object.keys(buildDefaultSettlements(m, Object.keys(m.counts), m.settings, m.memberTargets)).sort();
const clientOwing = m => Object.keys(client.buildSettlementMap(m.counts, m.excused, m.settings, m.memberTargets, m.solo, m.key)).sort();
const pairs = m => client.buildSettlementPairsForMonth(m).map(p => `${p.payerDisplayName}->${p.receiverDisplayName}:${p.amount}`).sort();

let failures = 0;
const test = (label, fn) => {
  try { fn(); console.log(`  PASS  ${label}`); }
  catch (error) { failures += 1; console.log(`  FAIL  ${label}\n        ${error.message}`); }
};

console.log("\nSolo standard penalty\n");

test("a new-rules Solo miss owes the fixed penalty; an old-rules Solo miss owes nothing", () => {
  const m = month({ Ann: 18, Ben: 14, Cal: 4, Dee: 3, Eve: 2 });
  assert.deepEqual(serverOwing(m), ["Cal", "Dee"]);
  assert.deepEqual(clientOwing(m), ["Cal", "Dee"]);
  assert.deepEqual(pairs(m), ["Cal->Ann:10", "Dee->Ann:10"]);
});

test("a Solo miss does not raise anyone's escalating penalty", () => {
  const m = month({ Ann: 18, Ben: 4, Cal: 4, Dee: 3, Eve: 2 });
  // Two regular misses: 10 + 5. Dee stays at the flat 10.
  assert.deepEqual(pairs(m), ["Ben->Ann:15", "Cal->Ann:15", "Dee->Ann:10"]);
});

test("reaching the Solo goal clears the month", () => {
  const m = month({ Ann: 18, Ben: 14, Cal: 14, Dee: 6, Eve: 2 });
  assert.deepEqual(serverOwing(m), []);
  assert.deepEqual(clientOwing(m), []);
  assert.deepEqual(pairs(m), []);
});

test("a Solo member can never receive a reward, even with the top count", () => {
  const m = month({ Ann: 14, Ben: 14, Cal: 4, Dee: 30, Eve: 30 });
  const penalties = client.addStandardSoloPenalties(
    client.calcPenalties(["Ann", "Ben", "Cal"].map(name => ({ name, count: m.counts[name], target: 12 })), SETTINGS),
    client.getStandardSoloMisses(m, NAMES),
    SETTINGS
  );
  assert.deepEqual(penalties.winners.map(w => w.name).sort(), ["Ann", "Ben"]);
  assert.ok(!pairs(m).some(p => p.includes("->Dee") || p.includes("->Eve")));
});

test("with no regular winner a Solo miss is still owed, with nobody invented to receive it", () => {
  const m = month({ Ann: 0, Ben: 0, Cal: 0, Dee: 3, Eve: 0 });
  assert.deepEqual(serverOwing(m), ["Dee"]);
  assert.deepEqual(clientOwing(m), ["Dee"]);
  assert.deepEqual(pairs(m), []);
});

test("sitting out overrides Solo: no charge", () => {
  const m = month({ Ann: 18, Ben: 14, Cal: 14, Dee: 0, Eve: 2 }, { excused: { Dee: true } });
  assert.deepEqual(serverOwing(m), []);
  assert.deepEqual(clientOwing(m), []);
});

test("from October every Solo is on the new rules, marker or not", () => {
  const m = month({ Ann: 18, Ben: 14, Cal: 14, Dee: 3, Eve: 2 }, { key: OCT, solo: { Dee: { [OCT]: { target: 6 } }, Eve: { [OCT]: { target: 6 } } } });
  assert.deepEqual(serverOwing(m), ["Dee", "Eve"]);
  assert.deepEqual(clientOwing(m), ["Dee", "Eve"]);
});

test("normalizeSolo keeps the marker and never stamps one on old entries", () => {
  const out = normalizeSolo({ Dee: { [SEPT]: { target: 6, rule: "standard_penalty" } }, Eve: { [SEPT]: { target: 6 } } }, ["Dee", "Eve"]);
  assert.deepEqual(out.Dee[SEPT], { target: 6, rule: "standard_penalty" });
  assert.deepEqual(out.Eve[SEPT], { target: 6 });
  const clientOut = client.normalizeGroupState({ id: "b", name: "b", memberOrder: ["Dee", "Eve"], solo: { Dee: { [SEPT]: { target: 6, rule: "standard_penalty" } }, Eve: { [SEPT]: { target: 6 } } } }).solo;
  assert.deepEqual(clientOut.Dee[SEPT], { target: 6, rule: "standard_penalty" });
  assert.deepEqual(clientOut.Eve[SEPT], { target: 6 });
});

test("the marker survives month close (rollover snapshot)", () => {
  // lastMonth is August, already over, so this rolls.
  const group = {
    id: "g", name: "g", memberOrder: NAMES, activeMemberOrder: NAMES, memberships: {},
    settings: SETTINGS, lastMonth: "2026-7", monthHistory: [],
    logs: {}, excused: {},
    solo: { Dee: { "2026-7": { target: 6, rule: "standard_penalty" } }, Eve: { "2026-7": { target: 6 } } }
  };
  const rolled = rolloverGroupIfNeeded(group);
  const closed = rolled.monthHistory.find(m => m.key === "2026-7");
  assert.deepEqual(closed.solo.Dee["2026-7"], { target: 6, rule: "standard_penalty" });
  assert.deepEqual(closed.solo.Eve["2026-7"], { target: 6 });
  assert.ok(closed.settlements.Dee, "Dee is outstanding at close");
  assert.ok(!closed.settlements.Eve, "Eve is not charged at close");
});

test("the marker survives month-history normalisation", () => {
  // The open month is skipped by design, so use a closed one.
  const AUG = "2026-7";
  const [normalized] = normalizeMonthHistory([month({ Ann: 18, Ben: 14, Cal: 14, Dee: 3, Eve: 2 }, { key: AUG, solo: { Dee: { [AUG]: { target: 6, rule: "standard_penalty" } }, Eve: { [AUG]: { target: 6 } } } })], NAMES, {}, SETTINGS);
  assert.deepEqual(normalized.solo.Dee[AUG], { target: 6, rule: "standard_penalty" });
  assert.deepEqual(normalized.solo.Eve[AUG], { target: 6 });
  assert.ok(normalized.settlements.Dee && !normalized.settlements.Eve);
});

test("the marker survives the closed month being rebuilt from canonical rows", () => {
  const blobMonth = month({ Ann: 18, Ben: 14, Cal: 14, Dee: 3, Eve: 2 });
  const group = { memberOrder: NAMES, activeMemberOrder: NAMES, memberships: {}, settings: SETTINGS, monthHistory: [blobMonth] };
  const season = {
    monthKey: SEPT, label: "Sep '26", year: 2026, monthIndex: 8, ...SETTINGS,
    members: NAMES.map(name => ({
      display_name: name,
      workout_count: blobMonth.counts[name],
      excused: false,
      solo: name === "Dee" || name === "Eve",
      solo_target: name === "Dee" || name === "Eve" ? 6 : null
    })),
    logs: []
  };
  const [rebuilt] = buildCanonicalMonthHistoryForGroup(group, [season]);
  assert.deepEqual(rebuilt.solo.Dee[SEPT], { target: 6, rule: "standard_penalty" });
  assert.deepEqual(rebuilt.solo.Eve[SEPT], { target: 6 });
  assert.deepEqual(pairs(rebuilt), ["Dee->Ann:10"]);
});

// Request paths: the goal is automatic and the marker is written.
const GROUP_ID = "solo-penalty-bloc";
const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";
const liveMonthKey = (() => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric", month: "numeric" }).formatToParts(new Date()).map(p => [p.type, p.value]));
  return `${parts.year}-${Number(parts.month) - 1}`;
})();
const liveState = (minTarget) => ({
  version: 2,
  groups: {
    [GROUP_ID]: {
      id: GROUP_ID, name: "Solo Bloc", inviteCode: "SOLOPN", adminName: "Admin", adminUserId: ADMIN_ID,
      memberOrder: ["Admin", "Member"], activeMemberOrder: ["Admin", "Member"],
      memberships: {
        [ADMIN_ID]: { userId: ADMIN_ID, displayName: "Admin", role: "admin", joinedAt: null },
        [MEMBER_ID]: { userId: MEMBER_ID, displayName: "Member", role: "member", joinedAt: null }
      },
      logs: { Admin: [], Member: [] }, excused: {}, solo: {}, sitOutRequests: {}, soloRequests: {}, monthHistory: [],
      lastMonth: liveMonthKey, settings: { minTarget, timeZone: "Europe/Oslo" }
    }
  },
  groupOrder: [GROUP_ID], profiles: {}, meta: { revision: 0, updatedAt: null }
});

test("the Solo goal is half the Bloc target rounded up, whatever the client sends", () => {
  const requested = applySoloRequest(liveState(13), { groupId: GROUP_ID, actor: "Member", actorUserId: MEMBER_ID, personalTarget: 1, reason: "Travel" });
  const group = requested.groups[GROUP_ID];
  const pending = group.soloRequests?.[liveMonthKey]?.Member;
  const active = group.solo?.Member?.[liveMonthKey];
  const target = pending?.personalTarget ?? active?.target;
  assert.equal(target, 7);
  if (active) assert.equal(active.rule, "standard_penalty");
});

test("an approved Solo request is written with the new-rules marker", () => {
  const requested = applySoloRequest(liveState(12), { groupId: GROUP_ID, actor: "Member", actorUserId: MEMBER_ID, reason: "Travel", exceptional: true });
  if (!requested.groups[GROUP_ID].soloRequests?.[liveMonthKey]?.Member) return; // went instant; covered above
  const approved = applySoloReview(requested, { groupId: GROUP_ID, actor: "Admin", actorUserId: ADMIN_ID, memberName: "Member", monthKey: liveMonthKey, decision: "approve" });
  assert.deepEqual(approved.groups[GROUP_ID].solo.Member[liveMonthKey], { target: 6, rule: "standard_penalty" });
});

rmSync(outDir, { recursive: true, force: true });
if (failures) {
  console.log(`\n${failures} failed\n`);
  process.exit(1);
}
console.log("\nAll Solo standard-penalty checks passed.\n");
