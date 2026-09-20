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
            // Matches the canonical open season below, so open-season log
            // parity compares this group rather than skipping it as
            // mid-rollover. logs mirror current_logs exactly, so the two
            // stores start in agreement and only the mutation under test
            // moves them apart.
            lastMonth: "2026-7",
            logs: {
              Ana: [
                { id: "1788000000001", date: "2026-08-03" },
                { id: "1788000000002", date: "2026-08-03" },
                { id: "1788000000003", date: "2026-08-09" }
              ],
              Ben: [{ id: "1788000000004", date: "2026-08-05" }]
            },
            seasonOverrides: {
              "2026-07": { prorated: true, proratedMas: 8, chosenAt: "2026-07-02T10:00:00Z", chosenBy: "Ana", chosenByUserId: "u-ana" }
            },
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
      { legacy_group_key: "alpha-abc123", name: "Alpha", sort_order: 1, time_zone: "UTC" },
      { legacy_group_key: "dead-zzz999", name: "Dead", sort_order: null, time_zone: "UTC" }
    ],
    bloc_members: [
      { legacy_group_key: "alpha-abc123", display_name: "Ana", sort_order: 1 },
      { legacy_group_key: "alpha-abc123", display_name: "Ben", sort_order: 2 }
    ],
    season_overrides: [
      { legacy_group_key: "alpha-abc123", month_key: "2026-07", prorated: true, prorated_mas: 8, chosen_at: "2026-07-02T10:00:00+00:00", chosen_by: "Ana", chosen_by_user_id: "u-ana" }
    ],
    // Liveness inputs. now is 2026-08-15 UTC, so the expected open month key is
    // "2026-7" (month keys are JS-style zero-indexed: 2026-7 = August).
    open_seasons: [
      { legacy_group_key: "alpha-abc123", season_id: "s-open", month_key: "2026-7" }
    ],
    system_events: { last24h: 0, last7d: 0, total: 0, recent: [] },
    // Open-season logs, in sync: blob group.logs and canonical agree on ids.
    // Ana has two sessions on 2026-08-03 (at the daily cap) plus one later day.
    current_logs: [
      { legacy_group_key: "alpha-abc123", id: "1788000000001", owner_display_name: "Ana", workout_date: "2026-08-03" },
      { legacy_group_key: "alpha-abc123", id: "1788000000002", owner_display_name: "Ana", workout_date: "2026-08-03" },
      { legacy_group_key: "alpha-abc123", id: "1788000000003", owner_display_name: "Ana", workout_date: "2026-08-09" },
      { legacy_group_key: "alpha-abc123", id: "1788000000004", owner_display_name: "Ben", workout_date: "2026-08-05" }
    ],
    now: "2026-08-15T12:00:00Z"
  };
}

// Replace the blob's open-season log set for one scenario. The clean fixture
// already mirrors current_logs, so only scenarios pulling the stores apart
// need this.
function withBlobCurrentLogs(fixture, logsByOwner) {
  fixture.live_state.state.groups["alpha-abc123"].logs = logsByOwner;
  return fixture;
}

const SYNCED_BLOB_LOGS = {
  Ana: [
    { id: "1788000000001", date: "2026-08-03" },
    { id: "1788000000002", date: "2026-08-03" },
    { id: "1788000000003", date: "2026-08-09" }
  ],
  Ben: [{ id: "1788000000004", date: "2026-08-05" }]
};

function runGate(fixture, label) {
  const dir = path.join(workDir, label);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "live_state.json"), JSON.stringify(fixture.live_state));
  fs.writeFileSync(path.join(dir, "month_history.json"), JSON.stringify(fixture.month_history));
  fs.writeFileSync(path.join(dir, "blocs.json"), JSON.stringify(fixture.blocs));
  fs.writeFileSync(path.join(dir, "bloc_members.json"), JSON.stringify(fixture.bloc_members));
  fs.writeFileSync(path.join(dir, "season_overrides.json"), JSON.stringify(fixture.season_overrides));
  fs.writeFileSync(path.join(dir, "open_seasons.json"), JSON.stringify(fixture.open_seasons));
  fs.writeFileSync(path.join(dir, "system_events.json"), JSON.stringify(fixture.system_events));
  fs.writeFileSync(path.join(dir, "current_logs.json"), JSON.stringify(fixture.current_logs));
  let summary;
  try {
    const stdout = execFileSync("node", [gateScript, "--fixture-dir", dir, "--output-dir", dir, "--now", fixture.now], { encoding: "utf8" });
    summary = { exitCode: 0, ...JSON.parse(stdout) };
  } catch (err) {
    summary = { exitCode: err.status ?? 1, ...JSON.parse(err.stdout || "{}") };
  }
  // Read the full report back so scenarios can assert on check details, not
  // only on which checks fired.
  const report = summary.reportPath ? JSON.parse(fs.readFileSync(summary.reportPath, "utf8")) : { checks: [] };
  return { ...summary, report };
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
    label: "open-season-phantom-fails",
    note: "the 09-09 delete bug: a blob log canonical does not have must fail — it eats a daily cap slot",
    mutate: fixture => withBlobCurrentLogs(fixture, {
      ...SYNCED_BLOB_LOGS,
      Ben: [...SYNCED_BLOB_LOGS.Ben, { id: "1788000009999", date: "2026-08-05" }]
    }),
    expectFailed: ["open-season-log-parity"],
    expectWarned: []
  },
  {
    label: "open-season-phantom-blocks-logging",
    note: "a phantom on a date already at the cap is reported as blocking that member (the real 409)",
    mutate: fixture => {
      withBlobCurrentLogs(fixture, SYNCED_BLOB_LOGS);
      // Ana keeps two blob sessions on 08-03, but canonical has only one:
      // the survivor of a delete that never mirrored.
      fixture.current_logs = fixture.current_logs.filter(row => row.id !== "1788000000002");
    },
    expectFailed: ["open-season-log-parity"],
    expectWarned: [],
    expectBlocked: [{ member: "Ana", date: "2026-08-03", blobSessions: 2, phantomSessions: 1 }]
  },
  {
    label: "open-season-missing-from-blob-warns",
    note: "canonical ahead of the blob warns, never fails: that is wave B working as intended",
    mutate: fixture => withBlobCurrentLogs(fixture, {
      ...SYNCED_BLOB_LOGS,
      Ana: SYNCED_BLOB_LOGS.Ana.slice(0, 1)
    }),
    expectFailed: [],
    expectWarned: ["open-season-log-parity"]
  },
  {
    label: "open-season-tombstoned-phantom-still-fails",
    note: "the daily cap does not filter deletedCurrentLogIds, so a tombstoned phantom still blocks",
    mutate: fixture => {
      withBlobCurrentLogs(fixture, {
        ...SYNCED_BLOB_LOGS,
        Ben: [...SYNCED_BLOB_LOGS.Ben, { id: "1788000009999", date: "2026-08-05" }]
      });
      fixture.live_state.state.groups["alpha-abc123"].deletedCurrentLogIds = ["1788000009999"];
    },
    expectFailed: ["open-season-log-parity"],
    expectWarned: []
  },
  {
    label: "open-season-mid-rollover-not-compared",
    note: "mid-rollover the two stores legitimately differ: a phantom that would otherwise fail is out of scope",
    mutate: fixture => {
      withBlobCurrentLogs(fixture, {
        ...SYNCED_BLOB_LOGS,
        Ben: [...SYNCED_BLOB_LOGS.Ben, { id: "1788000009999", date: "2026-08-05" }]
      });
      // Blob still on the previous month while canonical has opened the new
      // one. Without the scope guard the phantom above would fail the gate.
      fixture.live_state.state.groups["alpha-abc123"].lastMonth = "2026-6";
    },
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
    label: "override-field-drift",
    note: "canonical proratedMas disagrees with blob",
    mutate: fixture => { fixture.season_overrides[0].prorated_mas = 12; },
    expectFailed: ["season-override-parity"],
    expectWarned: []
  },
  {
    label: "override-missing-canonical",
    note: "blob override with no canonical row would vanish at retirement",
    mutate: fixture => { fixture.season_overrides = []; },
    expectFailed: ["season-override-parity"],
    expectWarned: []
  },
  {
    label: "override-missing-blob",
    note: "canonical override the blob mirror never received",
    mutate: fixture => {
      delete fixture.live_state.state.groups["alpha-abc123"].seasonOverrides["2026-07"];
    },
    expectFailed: ["season-override-parity"],
    expectWarned: []
  },
  {
    label: "override-chosen-by-noise-warns",
    note: "display-name diff on chosenBy warns without failing",
    mutate: fixture => { fixture.season_overrides[0].chosen_by = "Ana R"; },
    expectFailed: [],
    expectWarned: ["season-override-parity"]
  },
  {
    label: "liveness-orphan-blob-group",
    note: "a blob group with no canonical bloc row must fail (the 09-01 incident's root cause)",
    mutate: fixture => {
      fixture.live_state.state.groups["ghost-xyz111"] = { name: "Ghost", monthHistory: [], logs: {} };
    },
    expectFailed: ["rollover-liveness"],
    expectWarned: []
  },
  {
    label: "liveness-rollover-stuck",
    note: "an open season 14 days behind its expected month with no skip event must fail",
    mutate: fixture => { fixture.open_seasons[0].month_key = "2026-6"; },
    expectFailed: ["rollover-liveness"],
    expectWarned: []
  },
  {
    label: "liveness-recorded-skip-passes",
    note: "the same lag with a rollover_skipped system event is expected divergence, not drift",
    mutate: fixture => {
      fixture.open_seasons[0].month_key = "2026-6";
      fixture.system_events.recent = [
        { eventType: "rollover_skipped", blocKey: "alpha-abc123", detail: "canonical season write failed", occurredAt: "2026-08-14T12:00:00Z" }
      ];
    },
    expectFailed: [],
    expectWarned: []
  },
  {
    label: "liveness-grace-window-warns",
    note: "lag within 24h of the month boundary warns instead of failing (rollover is lazy)",
    mutate: fixture => {
      fixture.open_seasons[0].month_key = "2026-6";
      fixture.now = "2026-08-01T05:00:00Z";
    },
    expectFailed: [],
    expectWarned: ["rollover-liveness"]
  },
  {
    label: "liveness-no-open-season",
    note: "an active bloc with no open season row at all must fail",
    mutate: fixture => { fixture.open_seasons = []; },
    expectFailed: ["rollover-liveness"],
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
  // Optional: assert the cap-blocking detail, so "this member cannot log
  // today" is verified rather than inferred from a phantom count.
  let blockedOk = true;
  if (scenario.expectBlocked) {
    const actualBlocked = result.report.checks
      ?.find(check => check.name === "open-season-log-parity")?.details?.blockedFromLoggingToday ?? [];
    blockedOk = JSON.stringify(actualBlocked) === JSON.stringify(scenario.expectBlocked);
    if (!blockedOk) {
      console.log(`       blocked: expected ${JSON.stringify(scenario.expectBlocked)}, got ${JSON.stringify(actualBlocked)}`);
    }
  }
  const ok = gotFailed === wantFailed && gotWarned === wantWarned && exitOk && blockedOk;
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
