// Self-test for blob-remirror.mjs.
//
// A re-mirror that writes the wrong surface corrupts the rollback path it
// exists to protect, so each scope is proven to touch exactly its own fields:
// wave-a must not add/remove logs, nothing may touch blob-only groups, and
// no scope may reach into monthHistory or lifecycle fields.
//
// Usage: node scripts/blob-remirror.test.mjs
// Offline; dry-run only; no credentials required.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "blob-remirror.mjs");
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "remirror-test-"));

// Blob: group alpha with two logs for Ana (one with a stale reaction, one that
// canonical deleted) plus an orphan group with no canonical row. Canonical:
// alpha has Ana's log 1 (fresh reaction), a new log 3 the blob lacks, changed
// settings, and one season override the blob is missing.
function fixture() {
  return {
    live_state: {
      revision: 50,
      updated_at: "2026-08-30T00:00:00Z",
      state: {
        groups: {
          "alpha-abc123": {
            name: "Alpha",
            settings: { minTarget: 10, currency: "USD" },
            seasonOverrides: {},
            leftMemberNames: ["Ghost"],
            monthHistory: [{ key: "2026-07", logsByUser: { Ana: [{ id: "h1", reactions: {} }] } }],
            logs: {
              Ana: [
                { id: "1", type: "run", reactions: { "🔥": ["Ben"] }, flagStatus: null },
                { id: "2", type: "lift", reactions: {}, flagStatus: null }
              ]
            }
          },
          "orphan-zzz": {
            name: "Orphan",
            logs: { Aadhil: [{ id: "9", type: "run", reactions: { "👏": ["X"] } }] }
          }
        }
      }
    },
    current_logs: [
      {
        legacy_group_key: "alpha-abc123", id: "1", owner_display_name: "Ana",
        workout_date: "2026-08-02", workout_type: "run", note: "", photo_url: "",
        created_at: "2026-08-02T09:00:00.000Z", verified_via: "photo", comment_count: 0,
        flag_status: null, flag_reason: "", flag_response: "", flagged_by: null,
        decision_by: null, decision_at: null,
        reactions: { "🔥": ["Ben", "Cal"] }
      },
      {
        legacy_group_key: "alpha-abc123", id: "3", owner_display_name: "Ben",
        workout_date: "2026-08-05", workout_type: "lift", note: "new", photo_url: "",
        created_at: "2026-08-05T09:00:00.000Z", verified_via: "photo", comment_count: 0,
        flag_status: null, flag_reason: "", flag_response: "", flagged_by: null,
        decision_by: null, decision_at: null,
        reactions: {}
      }
    ],
    blocs: [
      { legacy_group_key: "alpha-abc123", name: "Alpha", min_target: 12, currency: "EUR" }
    ],
    season_overrides: [
      { legacy_group_key: "alpha-abc123", month_key: "2026-08", prorated: true, prorated_mas: 6, chosen_at: "2026-08-03T00:00:00Z", chosen_by: "Ana", chosen_by_user_id: "u-ana" }
    ]
  };
}

function run(scope, mutate = () => {}) {
  const data = fixture();
  mutate(data);
  const dir = fs.mkdtempSync(path.join(workDir, `${scope}-`));
  for (const [name, value] of Object.entries({
    "live_state.json": data.live_state,
    "current_logs.json": data.current_logs,
    "blocs.json": data.blocs,
    "season_overrides.json": data.season_overrides
  })) {
    fs.writeFileSync(path.join(dir, name), JSON.stringify(value));
  }
  const stdout = execFileSync("node", [script, "--scope", scope, "--fixture-dir", dir, "--output-dir", dir], { encoding: "utf8" });
  const summary = JSON.parse(stdout);
  const report = JSON.parse(fs.readFileSync(summary.reportPath, "utf8"));
  return report;
}

const results = [];
function expect(label, actual, predicate, want) {
  const ok = predicate(actual);
  results.push(ok);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}`);
  if (!ok) console.log(`       want ${want}, got: ${JSON.stringify(actual)}`);
}

// --- wave A -----------------------------------------------------------------
{
  const report = run("wave-a");
  const fields = report.changes.map(change => change.field).sort();
  expect("wave-a fixes only the drifted reaction field", fields,
    f => JSON.stringify(f) === JSON.stringify(["reactions"]), '["reactions"]');
  expect("wave-a change targets log 1", report.changes[0],
    c => c?.logId === "1" && c?.group === "alpha-abc123", "log 1 in alpha");
  expect("wave-a does not add or remove logs", report.changes,
    c => !c.some(change => change.field === "log-added" || change.field === "log-removed"), "no log-added/log-removed");
  expect("wave-a skips the blob-only group", report.skippedBlobOnlyGroups,
    s => JSON.stringify(s) === JSON.stringify(["orphan-zzz"]), '["orphan-zzz"]');
}

// --- wave B -----------------------------------------------------------------
{
  const report = run("wave-b");
  const kinds = report.changes.map(change => change.field).sort();
  expect("wave-b fixes fields, removes log 2, adds log 3", kinds,
    k => JSON.stringify(k) === JSON.stringify(["log-added", "log-removed", "reactions"]),
    '["log-added","log-removed","reactions"]');
  const added = report.changes.find(change => change.field === "log-added");
  const removed = report.changes.find(change => change.field === "log-removed");
  expect("wave-b adds canonical log 3 under Ben", added,
    c => c?.logId === "3" && c?.owner === "Ben", "log 3 / Ben");
  expect("wave-b removes blob-only log 2", removed,
    c => c?.logId === "2" && c?.owner === "Ana", "log 2 / Ana");
}

// --- wave C -----------------------------------------------------------------
{
  const report = run("wave-c");
  const fields = report.changes.map(change => change.field).sort();
  expect("wave-c updates settings and the missing override", fields,
    f => JSON.stringify(f) === JSON.stringify(["seasonOverrides.2026-08", "settings.currency", "settings.minTarget"]),
    '["seasonOverrides.2026-08","settings.currency","settings.minTarget"]');
  expect("wave-c does not touch logs", report.changes,
    c => !c.some(change => change.logId), "no log changes");
}

// --- no drift ---------------------------------------------------------------
{
  const report = run("wave-a", data => {
    data.live_state.state.groups["alpha-abc123"].logs.Ana[0].reactions = { "🔥": ["Ben", "Cal"] };
  });
  expect("no drift -> zero changes", report.changeCount, c => c === 0, "0");
}

// --- surfaces that must never appear ---------------------------------------
{
  for (const scope of ["wave-a", "wave-b", "wave-c"]) {
    const report = run(scope);
    expect(`${scope} never touches monthHistory or lifecycle fields`, report.changes,
      c => !c.some(change => String(change.field).includes("monthHistory") || String(change.field).includes("leftMemberNames") || String(change.field).includes("joinedMonthByName")),
      "no monthHistory/lifecycle changes");
  }
}

fs.rmSync(workDir, { recursive: true, force: true });
const failed = results.filter(ok => !ok).length;
console.log(`\n${results.length - failed}/${results.length} assertions passed`);
process.exit(failed ? 1 : 0);
