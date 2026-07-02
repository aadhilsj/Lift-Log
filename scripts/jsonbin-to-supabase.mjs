import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node scripts/jsonbin-to-supabase.mjs <input.json> [output-dir]");
  process.exit(1);
}

const [, , inputPath, outputDirArg] = process.argv;
if (!inputPath) usage();

const outputDir = path.resolve(outputDirArg || "migration-output");
const raw = fs.readFileSync(path.resolve(inputPath), "utf8");
const data = JSON.parse(raw);

const NAMES = ["Aadhil","Isira","Rahul","Kisal","Rishane","Deyhan","Aysha","Nishara","Abhishek"];
const JOINED_MONTH_BY_NAME = { Abhishek: "2026-4" };

const players = [];
const workoutLogs = [];
const monthExcusals = [];
const monthlySnapshots = [];
const monthlySnapshotCounts = [];
const settlementStatus = [];

for (const name of NAMES) {
  players.push({
    name,
    joined_month_key: JOINED_MONTH_BY_NAME[name] || ""
  });
}

const currentMonthKey = data.lastMonth || "";
const revision = Number.isFinite(Number(data?.meta?.revision)) ? Number(data.meta.revision) : 0;
const updatedAt = data?.meta?.updatedAt || "";

for (const name of NAMES) {
  const logs = Array.isArray(data?.logs?.[name]) ? data.logs[name] : [];
  for (const log of logs) {
    workoutLogs.push({
      id: String(log.id),
      player_name: name,
      workout_date: log.date,
      workout_type: log.type,
      month_key: getMonthKeyFromIso(log.date),
      source: "current-jsonbin"
    });
  }
}

for (const name of NAMES) {
  const excusedByMonth = data?.excused?.[name] || {};
  for (const [monthKey, excused] of Object.entries(excusedByMonth)) {
    monthExcusals.push({
      player_name: name,
      month_key: monthKey,
      excused: Boolean(excused),
      source: "current-jsonbin"
    });
  }
}

for (const month of Array.isArray(data?.monthHistory) ? data.monthHistory : []) {
  monthlySnapshots.push({
    month_key: month.key,
    label: month.label,
    year: month.year,
    month: month.month,
    migrated_from_last_month: true
  });

  for (const name of Object.keys(month.counts || {})) {
    monthlySnapshotCounts.push({
      month_key: month.key,
      player_name: name,
      workout_count: Number(month.counts[name] || 0),
      excused: Boolean(month.excused?.[name])
    });
  }

  for (const name of NAMES) {
    const logs = Array.isArray(month?.logsByUser?.[name]) ? month.logsByUser[name] : [];
    for (const log of logs) {
      workoutLogs.push({
        id: String(log.id),
        player_name: name,
        workout_date: log.date,
        workout_type: log.type,
        month_key: month.key,
        source: "historical-snapshot"
      });
    }
    const settlement = month?.settlements?.[name];
    if (settlement) {
      settlementStatus.push({
        month_key: month.key,
        player_name: name,
        status: settlement.status,
        settled_at: settlement.settledAt || "",
        updated_at: settlement.updatedAt || ""
      });
    }
  }
}

const appState = [{
  id: true,
  current_month_key: currentMonthKey,
  revision,
  updated_at: updatedAt,
  imported_at: new Date().toISOString()
}];

fs.mkdirSync(outputDir, { recursive: true });
writeCsv(path.join(outputDir, "players.csv"), players);
writeCsv(path.join(outputDir, "workout_logs.csv"), dedupeLogs(workoutLogs));
writeCsv(path.join(outputDir, "month_excusals.csv"), dedupeMonthExcusals(monthExcusals));
writeCsv(path.join(outputDir, "monthly_snapshots.csv"), monthlySnapshots);
writeCsv(path.join(outputDir, "monthly_snapshot_counts.csv"), monthlySnapshotCounts);
writeCsv(path.join(outputDir, "settlement_status.csv"), settlementStatus);
writeCsv(path.join(outputDir, "app_state.csv"), appState);

const summary = {
  players: players.length,
  workout_logs: dedupeLogs(workoutLogs).length,
  month_excusals: dedupeMonthExcusals(monthExcusals).length,
  monthly_snapshots: monthlySnapshots.length,
  monthly_snapshot_counts: monthlySnapshotCounts.length,
  settlement_status: settlementStatus.length,
  app_state: appState.length
};

fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ outputDir, summary }, null, 2));

function getMonthKeyFromIso(iso) {
  const [year, month] = String(iso).split("-").map(Number);
  return `${year}-${month - 1}`;
}

function dedupeLogs(rows) {
  const seen = new Map();
  for (const row of rows) {
    const key = `${row.player_name}|${row.id}|${row.month_key}`;
    if (!seen.has(key)) seen.set(key, row);
  }
  return [...seen.values()];
}

function dedupeMonthExcusals(rows) {
  const seen = new Map();
  for (const row of rows) {
    const key = `${row.player_name}|${row.month_key}`;
    seen.set(key, row);
  }
  return [...seen.values()];
}

function writeCsv(filePath, rows) {
  if (!rows.length) {
    fs.writeFileSync(filePath, "");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map(header => csvCell(row[header])).join(","));
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
}

function csvCell(value) {
  const stringValue = value == null ? "" : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}
