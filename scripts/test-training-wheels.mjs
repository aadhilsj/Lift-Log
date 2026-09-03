// Training Wheels: the exemption, the knock-on effects, and the boundaries.
//
// Written before any of it is visible in the app. Training Wheels excuses a
// member from a month's stakes without excusing them from the month: they log,
// they rank, they appear. The dangerous part is not the grant itself but what
// it does to everyone else's money, so most of what follows checks other
// people's numbers rather than the exempt member's.
//
// Run: npm run test:training-wheels

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// appState.js is browser-shaped: it reads window at module scope. Bundle it for
// node the same way the app bundles it, rather than re-implementing the maths
// here — a test that reimplements what it checks proves nothing.
const outDir = mkdtempSync(join(tmpdir(), "fero-training-"));
const outFile = join(outDir, "appState.mjs");
const banner = [
  "globalThis.window={innerWidth:390,scrollTo(){},addEventListener(){},removeEventListener(){},",
  "matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),",
  "localStorage:{getItem:()=>null,setItem(){},removeItem(){}},location:{href:'http://localhost/',search:''}};",
  // node >= 21 exposes a read-only navigator, so leave it alone and only fill
  // in the globals the browser build actually reaches for.
  "globalThis.localStorage=window.localStorage;"
].join("");

execFileSync("npx", [
  "esbuild", "src/lib/appState.js",
  "--bundle", "--platform=node", "--format=esm",
  `--outfile=${outFile}`, "--loader:.css=empty", "--log-level=error",
  `--banner:js=${banner}`
], { stdio: "inherit" });

const {
  normalizeGroupState,
  buildSettlementMap,
  buildSettlementPairsForMonth,
  calcPenalties,
  isTrainingForMonth,
  isExemptFromStakes,
  hasDecidedTrainingForMonth,
  getActiveJoinedMonthForMember,
  isSoloForMonth,
  missedTargetInMonth,
  getRedemptionMark,
  syncActiveGroupGlobals
} = await import(pathToFileURL(outFile).href);

const SETTINGS = {
  minTarget: 12,
  fineAmount: 10,
  escalationStepAmount: 5,
  feeModel: "escalating",
  currency: "GBP",
  timeZone: "Europe/Oslo"
};
const NAMES = ["Ann", "Ben", "Cal", "Dee"];

const makeGroup = (overrides = {}) => normalizeGroupState({
  id: "bloc-1",
  name: "Test Bloc",
  adminName: "Ann",
  inviteCode: "TESTING",
  memberOrder: [...NAMES],
  memberships: Object.fromEntries(NAMES.map((n, i) => [`m${i}`, { userId: `u${i}`, displayName: n, role: n === "Ann" ? "admin" : "member" }])),
  settings: SETTINGS,
  logs: {},
  excused: {},
  solo: {},
  monthHistory: [],
  ...overrides
});

const MONTH = "2026-7";
const counts = { Ann: 18, Ben: 14, Cal: 4, Dee: 3 };
const targets = { Ann: 12, Ben: 12, Cal: 12, Dee: 12 };

const settleWith = trainingByName => buildSettlementMap(
  counts, {}, SETTINGS, targets, {}, MONTH, trainingByName
);

const penaltiesFor = exemptNames => calcPenalties(
  Object.keys(counts)
    .filter(name => !exemptNames.includes(name))
    .map(name => ({ name, count: counts[name], target: targets[name] })),
  SETTINGS
);

// buildSettlementMap reads the module-level active roster rather than taking
// one, so the globals have to be primed before any settlement maths is asked
// for. Missing this is why the first run of these tests reported no losers at
// all rather than the wrong losers.
syncActiveGroupGlobals(makeGroup());

let failures = 0;
const test = (label, fn) => {
  try {
    fn();
    console.log(`  PASS  ${label}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL  ${label}\n        ${error.message}`);
  }
};

console.log("\nTraining Wheels\n");

// ─── the map itself ──────────────────────────────────────────────────────────

test("a granted member reads as on training for that month only", () => {
  const group = makeGroup({ training: { Cal: { [MONTH]: true } } });
  assert.equal(isTrainingForMonth(group, "Cal", MONTH), true);
  assert.equal(isTrainingForMonth(group, "Cal", "2026-8"), false);
  assert.equal(isTrainingForMonth(group, "Ann", MONTH), false);
});

test("training and solo are separate maps, not one flavour of the other", () => {
  const group = makeGroup({ training: { Cal: { [MONTH]: true } } });
  assert.equal(isSoloForMonth(group, "Cal", MONTH), false, "training must not read as solo");
  assert.equal(isExemptFromStakes(group, "Cal", MONTH), true);
});

test("a training month does not consume a solo allowance", () => {
  // The reason training is not stored inside the solo map. Solo is limited to
  // once every three months; a free first month must not spend that.
  const group = makeGroup({ training: { Cal: { "2026-5": true, "2026-6": true, [MONTH]: true } } });
  const soloMonths = Object.keys(group.solo?.Cal || {});
  assert.deepEqual(soloMonths, [], "solo map must stay empty for a training member");
});

test("garbage in the map is dropped rather than trusted", () => {
  const group = makeGroup({ training: { Cal: { [MONTH]: false, "": true }, Ghost: null } });
  assert.equal(isTrainingForMonth(group, "Cal", MONTH), false);
  assert.deepEqual(group.training.Ghost, {});
});

// ─── the money ───────────────────────────────────────────────────────────────

test("without training, both under-target members owe", () => {
  const settlements = settleWith({});
  assert.deepEqual(Object.keys(settlements).sort(), ["Cal", "Dee"]);
});

test("a training member is removed from the settlement entirely", () => {
  const settlements = settleWith({ Cal: { [MONTH]: true } });
  assert.deepEqual(Object.keys(settlements), ["Dee"], "Cal must not owe");
});

test("exempting one loser lowers what the other loser pays", () => {
  // The escalating fee scales with the number of losers, so this is never a
  // private change to the exempt member.
  const before = penaltiesFor([]);
  const after = penaltiesFor(["Cal"]);
  assert.equal(before.perLoser, 15, "two losers: 10 + 5");
  assert.equal(after.perLoser, 10, "one loser: 10 + 0");
});

test("exempting a loser shrinks the winner's collection", () => {
  const before = penaltiesFor([]);
  const after = penaltiesFor(["Cal"]);
  assert.equal(before.totalPot, 30);
  assert.equal(after.totalPot, 10);
  assert.equal(before.perWinner, 30);
  assert.equal(after.perWinner, 10);
});

test("exempting every loser leaves an empty pot, not a negative one", () => {
  const after = penaltiesFor(["Cal", "Dee"]);
  assert.equal(after.losers.length, 0);
  assert.equal(after.totalPot, 0);
  assert.equal(after.perWinner, 0);
});

test("a training member never appears in a transfer, in either direction", () => {
  const month = {
    key: MONTH, label: "Aug '26", counts, excused: {}, memberTargets: targets,
    settings: SETTINGS, solo: {}, training: { Cal: { [MONTH]: true } }
  };
  const pairs = buildSettlementPairsForMonth(month);
  assert.ok(pairs.length > 0, "there should still be a transfer from Dee");
  for (const pair of pairs) {
    assert.notEqual(pair.payerDisplayName, "Cal");
    assert.notEqual(pair.receiverDisplayName, "Cal");
  }
});

test("a training member who hits the target still owes nothing", () => {
  const settlements = buildSettlementMap(
    { ...counts, Cal: 20 }, {}, SETTINGS, targets, {}, MONTH, { Cal: { [MONTH]: true } }
  );
  assert.ok(!Object.keys(settlements).includes("Cal"));
});

// ─── the boundaries ──────────────────────────────────────────────────────────

test("the grant clears at the rollover", () => {
  const group = makeGroup({ training: { Cal: { [MONTH]: true } } });
  syncActiveGroupGlobals(group);
  assert.equal(isTrainingForMonth(group, "Cal", "2026-8"), false, "must not carry into the next month");
});

test("a closed month keeps the record of who was on training", () => {
  const group = makeGroup({
    training: { Cal: { [MONTH]: true } },
    monthHistory: [{
      key: MONTH, label: "Aug '26", counts, excused: {}, memberTargets: targets,
      settings: SETTINGS, solo: {}, training: { Cal: { [MONTH]: true } }
    }]
  });
  const closed = group.monthHistory.find(m => m.key === MONTH);
  assert.equal(isTrainingForMonth(closed, "Cal", MONTH), true, "history must survive normalisation");
  assert.ok(!Object.keys(closed.settlements || {}).includes("Cal"), "and must stay out of that month's settlement");
});

test("a training member did not 'miss' the month, so earns no redemption mark", () => {
  const july = {
    key: "2026-6", counts: { Cal: 2, Ann: 15 }, excused: {}, memberTargets: { Cal: 12, Ann: 12 },
    settings: SETTINGS, solo: {}, training: { Cal: { "2026-6": true } }
  };
  assert.equal(missedTargetInMonth(july, "Cal"), false, "exempt is not missed");
  assert.equal(getRedemptionMark([july], "Cal", MONTH, false), null, "no shield for a first month");
});

test("someone who genuinely missed still earns the mark", () => {
  const july = {
    key: "2026-6", counts: { Dee: 2, Ann: 15 }, excused: {}, memberTargets: { Dee: 12, Ann: 12 },
    settings: SETTINGS, solo: {}, training: {}
  };
  assert.equal(missedTargetInMonth(july, "Dee"), true);
  assert.equal(getRedemptionMark([july], "Dee", MONTH, false), "redemption");
  assert.equal(getRedemptionMark([july], "Dee", MONTH, true), "redeemed");
});

test("an unanswered joiner is not recorded as having decided", () => {
  const group = makeGroup({ training: { Cal: { [MONTH]: true } } });
  assert.equal(hasDecidedTrainingForMonth(group, "Cal", MONTH), false,
    "being granted training is not the same as having answered");
});

test("choosing the Bloc default still counts as answered", () => {
  // The reason the decision is recorded separately: someone who picks "same
  // terms as everyone" leaves no training entry behind, so without this they
  // would be asked again every time they opened the app.
  const group = makeGroup({ trainingDecisions: { Cal: { [MONTH]: true } } });
  assert.equal(hasDecidedTrainingForMonth(group, "Cal", MONTH), true);
  assert.equal(isTrainingForMonth(group, "Cal", MONTH), false);
});

test("a decision does not leak into another month or another member", () => {
  const group = makeGroup({ trainingDecisions: { Cal: { [MONTH]: true } } });
  assert.equal(hasDecidedTrainingForMonth(group, "Cal", "2026-8"), false);
  assert.equal(hasDecidedTrainingForMonth(group, "Dee", MONTH), false);
});

// ─── who gets asked ──────────────────────────────────────────────────────────
//
// The joiner prompt shipped keyed on joinedMonthByName and never fired once in
// production, because that map is routinely empty - StavanGang's was empty for
// all six members. These cover the resolver that replaced it, which falls back
// to the membership's joinedAt.

// July 2026 is month key "2026-6" - the key is zero-indexed, the ISO string is
// not, and getting that wrong is what made the first draft of this test fail.
const JULY_KEY = "2026-6";

test("a join month is resolved even when joinedMonthByName is empty", () => {
  const group = makeGroup({
    joinedMonthByName: {},
    memberships: {
      m0: { userId:"u0", displayName:"Ann", role:"admin", joinedAt:"2026-01-04T10:00:00.000Z" },
      m1: { userId:"u1", displayName:"Ben", joinedAt:"2026-07-15T10:00:00.000Z" }
    },
    monthHistory: []
  });
  syncActiveGroupGlobals(group);
  assert.equal(group.joinedMonthByName?.Ben, undefined, "the explicit map really is empty");
  assert.equal(getActiveJoinedMonthForMember("Ben", JULY_KEY), JULY_KEY,
    "the join month still resolves, from the membership timestamp");
});

test("someone who joined an earlier month is not asked", () => {
  const group = makeGroup({
    joinedMonthByName: {},
    memberships: {
      m0: { userId:"u0", displayName:"Ann", role:"admin", joinedAt:"2026-01-04T10:00:00.000Z" }
    },
    monthHistory: []
  });
  syncActiveGroupGlobals(group);
  assert.notEqual(getActiveJoinedMonthForMember("Ann", JULY_KEY), JULY_KEY);
});

test("a Bloc with nobody on training behaves exactly as before", () => {
  const group = makeGroup();
  assert.deepEqual(settleWith({}), settleWith(undefined));
  for (const name of NAMES) {
    assert.equal(isExemptFromStakes(group, name, MONTH), false);
  }
});

rmSync(outDir, { recursive: true, force: true });

console.log(failures ? `\n${failures} failed\n` : "\nAll training wheels checks passed\n");
process.exit(failures ? 1 : 0);
