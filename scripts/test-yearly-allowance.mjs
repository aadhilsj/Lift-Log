// Yearly allowance: from September 2026 each member gets 2 sit-outs and 3 Solo
// months per calendar year in each Bloc. Past the allowance a request still
// goes through, but always needs approval. Sitting out also means no logging.
//
// The count is worked out in two places, the server (which enforces it) and
// the app (Status tab, profile line). Both are checked against the same Blocs
// so they cannot drift apart. The server clock is faked per check.
//
// Run: npm run test:yearly-allowance

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// A controllable clock: every `new Date()` / `Date.now()` reads FAKE_NOW.
const RealDate = Date;
let FAKE_NOW = new RealDate("2026-10-03T12:00:00Z").getTime();
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [FAKE_NOW])); }
  static now() { return FAKE_NOW; }
};
const setToday = iso => { FAKE_NOW = new RealDate(`${iso}T12:00:00Z`).getTime(); };

const {
  applyAddLog,
  applyMultiLog,
  applySitOutRequest,
  applySoloRequest,
  getYearlyAllowanceUsage
} = await import("../api/lift-log.js");

// appState.js is browser-shaped; bundle it for node the way the Solo test does.
const outDir = mkdtempSync(join(tmpdir(), "fero-allowance-"));
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

let failures = 0;
const test = (label, fn) => {
  try { fn(); console.log(`  ok  ${label}`); }
  catch (err) { failures += 1; console.log(`  FAIL ${label}\n       ${err.message}`); }
};

const GROUP_ID = "allowance-bloc";
const OTHER_ID = "other-bloc";
const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";

// A closed month as monthHistory keeps it: excused is a boolean per name,
// solo is { name: { key: entry } }.
const closed = (key, { sat = [], solo = [] } = {}) => ({
  key,
  counts: { Admin: 12, Member: 0 },
  excused: { Admin: false, Member: sat.includes("Member") },
  solo: Object.fromEntries(solo.map(name => [name, { [key]: { target: 6 } }])),
  training: {},
  memberTargets: { Admin: 12, Member: 12 },
  settings: { minTarget: 12, timeZone: "Europe/Oslo" }
});

const bloc = (id, openKey, history = [], extra = {}) => ({
  id, name: id, inviteCode: id.toUpperCase().slice(0, 8), adminName: "Admin", adminUserId: ADMIN_ID,
  memberOrder: ["Admin", "Member"], activeMemberOrder: ["Admin", "Member"],
  memberships: {
    [ADMIN_ID]: { userId: ADMIN_ID, displayName: "Admin", role: "admin", joinedAt: null },
    [MEMBER_ID]: { userId: MEMBER_ID, displayName: "Member", role: "member", joinedAt: null }
  },
  logs: { Admin: [], Member: [] }, excused: {}, solo: {}, sitOutRequests: {}, soloRequests: {},
  monthHistory: history, lastMonth: openKey,
  settings: { minTarget: 12, timeZone: "Europe/Oslo", acceptedWorkoutTypes: ["Gym", "Run", "Other"] },
  ...extra
});
const state = (openKey, history = [], extra = {}) => ({
  version: 2,
  groups: { [GROUP_ID]: bloc(GROUP_ID, openKey, history, extra), [OTHER_ID]: bloc(OTHER_ID, openKey) },
  groupOrder: [GROUP_ID, OTHER_ID],
  profiles: {},
  meta: { revision: 1, updatedAt: null }
});
const member = { groupId: GROUP_ID, actor: "Member", actorUserId: MEMBER_ID, reason: "Knee surgery" };

// Nishara's real 2026: sat out April and August, Solo in September.
const NISHARA = [closed("2026-3", { sat: ["Member"] }), closed("2026-7", { sat: ["Member"] }), closed("2026-8", { solo: ["Member"] })];

console.log("\nCounting");

test("closed months and the open month both count, in this calendar year only", () => {
  const group = bloc(GROUP_ID, "2026-9", [closed("2025-11", { sat: ["Member"] }), ...NISHARA], {
    solo: { Member: { "2026-9": { target: 6, rule: "standard_penalty" } } }
  });
  const usage = getYearlyAllowanceUsage(group, "Member", "2026-9");
  assert.deepEqual(usage.sitOutMonths, ["2026-3", "2026-7"]);
  assert.deepEqual(usage.soloMonths, ["2026-8", "2026-9"]);
  assert.equal(usage.sitOutsLeft, 0);
  assert.equal(usage.soloLeft, 1);
});

test("the allowance resets on 1 January", () => {
  const usage = getYearlyAllowanceUsage(bloc(GROUP_ID, "2027-0", NISHARA), "Member", "2027-0");
  assert.deepEqual([usage.sitOutsLeft, usage.soloLeft], [2, 3]);
});

test("pending and declined requests do not use anything up", () => {
  const group = bloc(GROUP_ID, "2026-9", [], {
    sitOutRequests: { "2026-9": { Member: { status: "pending" } } },
    soloRequests: { "2026-8": { Member: { status: "declined" } } }
  });
  const usage = getYearlyAllowanceUsage(group, "Member", "2026-9");
  assert.deepEqual([usage.sitOutsLeft, usage.soloLeft], [2, 3]);
});

test("the app counts exactly what the server counts", () => {
  const groups = [
    bloc(GROUP_ID, "2026-9", NISHARA),
    bloc(GROUP_ID, "2026-9", NISHARA, { excused: { Member: { "2026-9": true } } }),
    bloc(GROUP_ID, "2027-0", NISHARA),
    bloc(GROUP_ID, "2026-9", [])
  ];
  groups.forEach(group => {
    assert.deepEqual(
      client.getYearlyAllowanceUsage(group, "Member", group.lastMonth),
      getYearlyAllowanceUsage(group, "Member", group.lastMonth)
    );
  });
  assert.equal(client.isYearlyAllowanceMonth("2026-7"), false);
  assert.equal(client.isYearlyAllowanceMonth("2026-8"), true);
});

console.log("\nSit out, from September");

test("with one left, a sit-out on the 3rd is instant", () => {
  setToday("2026-10-03");
  const next = applySitOutRequest(state("2026-9", [closed("2026-3", { sat: ["Member"] })]), member);
  assert.equal(next.groups[GROUP_ID].sitOutRequests["2026-9"].Member.status, "approved");
  assert.equal(next.groups[GROUP_ID].excused.Member["2026-9"], true);
});

test("with one left, a sit-out after the 5th goes for approval", () => {
  setToday("2026-10-20");
  const next = applySitOutRequest(state("2026-9", [closed("2026-3", { sat: ["Member"] })]), member);
  assert.equal(next.groups[GROUP_ID].sitOutRequests["2026-9"].Member.status, "pending");
});

test("with none left, a plain request is refused and a request always goes for approval", () => {
  setToday("2026-10-03");
  assert.throws(() => applySitOutRequest(state("2026-9", NISHARA), member), /used both sit-outs for 2026/);
  const next = applySitOutRequest(state("2026-9", NISHARA), { ...member, exceptional: true });
  assert.equal(next.groups[GROUP_ID].sitOutRequests["2026-9"].Member.status, "pending");
  assert.equal(next.groups[GROUP_ID].excused?.Member?.["2026-9"], undefined);
});

test("in January the same member is instant again", () => {
  setToday("2027-01-03");
  const next = applySitOutRequest(state("2027-0", NISHARA), member);
  assert.equal(next.groups[GROUP_ID].sitOutRequests["2027-0"].Member.status, "approved");
});

test("September immediately uses the yearly allowance", () => {
  setToday("2026-09-03");
  assert.throws(() => applySitOutRequest(state("2026-8", NISHARA.slice(0, 2)), member), /used both sit-outs for 2026/);
  const next = applySitOutRequest(state("2026-8", NISHARA.slice(0, 2)), { ...member, exceptional: true });
  assert.equal(next.groups[GROUP_ID].sitOutRequests["2026-8"].Member.status, "pending");
});

console.log("\nSolo, from September");

test("with Solo months left, Solo on the 3rd is instant", () => {
  setToday("2026-10-03");
  const next = applySoloRequest(state("2026-9", NISHARA), member);
  assert.deepEqual(next.groups[GROUP_ID].solo.Member["2026-9"], { target: 6, rule: "standard_penalty" });
});

test("with all 3 Solo months used, Solo goes for approval even on the 3rd", () => {
  setToday("2026-10-03");
  const history = [closed("2026-4", { solo: ["Member"] }), closed("2026-5", { solo: ["Member"] }), closed("2026-8", { solo: ["Member"] })];
  const next = applySoloRequest(state("2026-9", history), { ...member, exceptional: true });
  assert.equal(next.groups[GROUP_ID].soloRequests["2026-9"].Member.status, "pending");
  assert.equal(next.groups[GROUP_ID].solo?.Member?.["2026-9"], undefined);
  const plain = applySoloRequest(state("2026-9", history), member);
  assert.equal(plain.groups[GROUP_ID].soloRequests["2026-9"].Member.status, "pending");
});

console.log("\nNo logging while sitting out");

const sittingOut = () => {
  const s = state("2026-9", []);
  s.groups[GROUP_ID].excused = { Member: { "2026-9": true } };
  return s;
};
const logBase = { actor: "Member", actorUserId: MEMBER_ID, date: "2026-10-03", workoutType: "Gym", note: "", photoUrl: "https://example.com/p.jpg" };

test("a workout in a Bloc you are sitting out is refused", () => {
  setToday("2026-10-03");
  assert.throws(() => applyAddLog(sittingOut(), { ...logBase, groupId: GROUP_ID }), /sitting out this month/);
});

test("the same workout in another Bloc still posts", () => {
  setToday("2026-10-03");
  const { log } = applyAddLog(sittingOut(), { ...logBase, groupId: OTHER_ID });
  assert.equal(log.type, "Gym");
});

test("a multi-Bloc workout skips the Bloc you are sitting out", () => {
  setToday("2026-10-03");
  const next = applyMultiLog(sittingOut(), { ...logBase, sourceGroupId: OTHER_ID, targetGroupIds: [GROUP_ID] });
  assert.equal(next.groups[OTHER_ID].logs.Member.length, 1);
  assert.equal(next.groups[GROUP_ID].logs.Member.length, 0);
  assert.throws(() => applyMultiLog(sittingOut(), { ...logBase, sourceGroupId: GROUP_ID, targetGroupIds: [OTHER_ID] }), /sitting out this month/);
});

globalThis.Date = RealDate;
rmSync(outDir, { recursive: true, force: true });
if (failures) {
  console.log(`\n${failures} failed\n`);
  process.exit(1);
}
console.log("\nAll yearly allowance checks passed.\n");
