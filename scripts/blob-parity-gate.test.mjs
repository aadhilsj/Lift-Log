// Self-test for blob-parity-gate.mjs.
//
// An unvalidated parity gate manufactures false confidence: "system is clean"
// and "my checks silently never fire" produce identical green output. This test
// injects each failure mode into a synthetic fixture and asserts the gate
// catches it — run it after any change to the gate before trusting a green run.
//
// Usage: node scripts/blob-parity-gate.test.mjs
// Offline; no credentials required.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const gateScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "blob-parity-gate.mjs");
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "parity-gate-test-"));

// One bloc, one closed season, two members. Ana has 2 counted logs plus 1
// rejected log (which must NOT count); Ben has 1 log carrying 2 reactions.
function cleanFixture() {
  const logs = [
    { id: 1, owner_display_name: "Ana", workout_date: "2026-07-03", flag_status: null, reactions: {} },
    { id: 2, owner_display_name: "Ana", workout_date: "2026-07-10", flag_status: "cleared", reactions: {} },
    { id: 3, owner_display_name: "Ana", workout_date: "2026-07-11", flag_status: "rejected", reactions: {} },
    { id: 4, owner_display_name: "Ben", workout_date: "2026-07-05", flag_status: null, reactions: { "🔥": ["Ana"], "💪": ["Ana"] } }
  ];
  return {
    live_state: {
      revision: 1,
      updated_at: "2026-08-01T00:00:00Z",
      state: {
        groups: {
          "alpha-abc123": {
            name: "Alpha",
            monthHistory: [{
              key: "2026-07",
              logsByUser: {
                Ana: [
                  { id: "1", reactions: {} },
                  { id: "2", reactions: {} },
                  { id: "3", flagStatus: "rejected", reactions: {} }
                ],
                Ben: [{ id: "4", reactions: { "🔥": ["Ana"], "💪": ["Ana"] } }]
              },
              settlements: {
                Ana: { status: "settled", settledAt: "2026-08-01", updatedAt: null }
              }
            }]
          },
          "dead-zzz999": { name: "Dead", monthHistory: [] }
        }
      }
    },
    month_history: [{
      legacy_group_key: "alpha-abc123",
      month_key: "2026-07",
      members: [
        { display_name: "Ana", workout_count: 2, settlement_status: "settled" },
        { display_name: "Ben", workout_count: 1, settlement_status: null }
      ],
      logs
    }],
    blocs: [
      { legacy_group_key: "alpha-abc123", name: "Alpha", sort_order: 1 },
      { legacy_group_key: "dead-zzz999", name: "Dead", sort_order: null }
    ],
    bloc_members: [
      { legacy_group_key: "alpha-abc123", display_name: "Ana", sort_order: 1 },
      { legacy_group_key: "alpha-abc123", display_name: "Ben", sort_order: 2 }
    ]
  };
}

function runGate(fixture, label) {
  const dir = path.join(workDir, label);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "live_state.json"), JSON.stringify(fixture.live_state));
  fs.writeFileSync(path.join(dir, "month_history.json"), JSON.stringify(fixture.month_history));
  fs.writeFileSync(path.join(dir, "blocs.json"), JSON.stringify(fixture.blocs));
  fs.writeFileSync(path.join(dir, "bloc_members.json"), JSON.stringify(fixture.bloc_members));
  try {
    const stdout = execFileSync("node", [gateScript, "--fixture-dir", dir, "--output-dir", dir], { encoding: "utf8" });
    return { exitCode: 0, ...JSON.parse(stdout) };
  } catch (err) {
    return { exitCode: err.status ?? 1, ...JSON.parse(err.stdout || "{}") };
  }
}

const scenarios = [
  {
    label: "clean-baseline",
    note: "clean fixture passes, including a rejected log excluded from counts and a dead bloc with null sort_order",
    mutate: () => {},
    expectFailed: [],
    expectWarned: []
  },
  {
    label: "workout-count-drift",
    note: "canonical workout_count disagrees with counted log rows",
    mutate: fixture => { fixture.month_history[0].members[0].workout_count = 5; },
    expectFailed: ["historical-workout-count-parity"],
    expectWarned: []
  },
  {
    label: "rejected-log-counted",
    note: "regression: raw row count would flag Ana (3 rows vs count 2); the gate must not",
    mutate: fixture => { fixture.month_history[0].members[0].workout_count = 2; },
    expectFailed: [],
    expectWarned: []
  },
  {
    label: "reaction-loss",
    note: "blob recorded reactions canonical is missing",
    mutate: fixture => { fixture.month_history[0].logs[3].reactions = { "🔥": ["Ana"] }; },
    expectFailed: ["historical-reaction-coverage"],
    expectWarned: []
  },
  {
    label: "reaction-extra-warns",
    note: "canonical ahead of blob is a warning, not a failure",
    mutate: fixture => { fixture.month_history[0].logs[0].reactions = { "👏": ["Ben"] }; },
    expectFailed: [],
    expectWarned: ["historical-reaction-coverage"]
  },
  {
    label: "settlement-mismatch",
    note: "canonical settlement status disagrees with blob",
    mutate: fixture => { fixture.month_history[0].members[0].settlement_status = null; },
    expectFailed: ["historical-settlement-parity"],
    expectWarned: []
  },
  {
    label: "settlement-missing-member",
    note: "blob settles a member canonical has no row for",
    mutate: fixture => {
      fixture.live_state.state.groups["alpha-abc123"].monthHistory[0].settlements.Ghost =
        { status: "settled", settledAt: "2026-08-01", updatedAt: null };
    },
    expectFailed: ["historical-settlement-parity"],
    expectWarned: []
  },
  {
    label: "active-bloc-null-sort-order",
    note: "an active bloc losing sort_order must fail (dead blocs must not)",
    mutate: fixture => { fixture.blocs[0].sort_order = null; },
    expectFailed: ["bloc-sort-order-coverage"],
    expectWarned: []
  },
  {
    label: "member-null-sort-order",
    note: "an active member losing sort_order must fail",
    mutate: fixture => { fixture.bloc_members[1].sort_order = null; },
    expectFailed: ["member-sort-order-coverage"],
    expectWarned: []
  }
];

let failed = 0;
for (const scenario of scenarios) {
  const fixture = cleanFixture();
  scenario.mutate(fixture);
  const result = runGate(fixture, scenario.label);
  const gotFailed = JSON.stringify((result.failedChecks || []).sort());
  const gotWarned = JSON.stringify((result.warnedChecks || []).sort());
  const wantFailed = JSON.stringify([...scenario.expectFailed].sort());
  const wantWarned = JSON.stringify([...scenario.expectWarned].sort());
  const exitOk = scenario.expectFailed.length ? result.exitCode !== 0 : result.exitCode === 0;
  const ok = gotFailed === wantFailed && gotWarned === wantWarned && exitOk;
  if (!ok) failed += 1;
  console.log(`[${ok ? "PASS" : "FAIL"}] ${scenario.label} — ${scenario.note}`);
  if (!ok) {
    console.log(`       expected failed=${wantFailed} warned=${wantWarned} exit${scenario.expectFailed.length ? "!=0" : "=0"}`);
    console.log(`       got      failed=${gotFailed} warned=${gotWarned} exit=${result.exitCode}`);
  }
}

fs.rmSync(workDir, { recursive: true, force: true });
console.log(`\n${scenarios.length - failed}/${scenarios.length} scenarios passed`);
process.exit(failed ? 1 : 0);
