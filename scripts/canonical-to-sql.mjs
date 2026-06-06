import fs from "node:fs";
import path from "node:path";

const DEFAULT_CANONICAL_DIR = path.resolve("migration-output/canonical-live-backup");
const TARGET_SCHEMA = "ante_core";

const TABLES = [
  { name: "profiles", conflict: ["id"] },
  { name: "payment_methods", conflict: ["id"] },
  { name: "auth_otps", conflict: ["email"] },
  { name: "blocs", conflict: ["id"] },
  { name: "bloc_members", conflict: ["id"] },
  { name: "seasons", conflict: ["id"] },
  { name: "season_member_status", conflict: ["id"] },
  { name: "workout_logs", conflict: ["id"] },
  { name: "workout_reactions", conflict: ["workout_log_id", "emoji", "reactor_display_name"] },
  { name: "season_overrides", conflict: ["id"] },
  { name: "sit_out_requests", conflict: ["id"] },
  { name: "settlement_runs", conflict: ["id"] },
  { name: "settlement_entries", conflict: ["id"] },
  { name: "settlement_transfers", conflict: ["id"] },
  { name: "notification_jobs", conflict: ["id"] }
];

const [, , canonicalDirArg, outputPathArg] = process.argv;
const canonicalDir = path.resolve(canonicalDirArg || DEFAULT_CANONICAL_DIR);
const outputPath = path.resolve(outputPathArg || path.join(canonicalDir, "canonical-import.sql"));

if (!fs.existsSync(canonicalDir)) {
  throw new Error(`Missing canonical directory: ${canonicalDir}`);
}

const statements = [
  "-- Canonical relational import SQL",
  "-- Generated offline from canonical importer output.",
  "-- Safe intent: additive/idempotent upserts into the draft canonical schema.",
  "",
  "begin;",
  ""
];

for (const table of TABLES) {
  const filePath = path.join(canonicalDir, `${table.name}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing table data file: ${filePath}`);
  }
  const rows = JSON.parse(fs.readFileSync(filePath, "utf8"));
  statements.push(`-- ${table.name}: ${rows.length} row(s)`);
  statements.push(...buildTableStatements(table.name, rows, table.conflict));
  statements.push("");
}

statements.push("commit;");
statements.push("");

fs.writeFileSync(outputPath, statements.join("\n"));

console.log(JSON.stringify({
  canonicalDir,
  outputPath,
  tableCount: TABLES.length
}, null, 2));

function buildTableStatements(tableName, rows, conflictColumns) {
  if (rows.length === 0) {
    return [`-- ${tableName} has no rows in this import snapshot.`];
  }

  const columns = orderedColumns(rows);
  const updateColumns = columns.filter(column => !conflictColumns.includes(column));
  const valueLines = rows.map(row => `  (${columns.map(column => toSqlLiteral(row[column])).join(", ")})`);

  const statements = [
    `insert into ${TARGET_SCHEMA}.${tableName} (${columns.join(", ")})`,
    "values",
    `${valueLines.join(",\n")}`,
    `on conflict (${conflictColumns.join(", ")}) do update`,
    `set ${updateColumns.map(column => `${column} = excluded.${column}`).join(", ")};`
  ];

  return statements;
}

function orderedColumns(rows) {
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      seen.add(key);
    }
  }
  return [...seen];
}

function toSqlLiteral(value) {
  if (value == null) return "null";

  if (Array.isArray(value)) {
    return `array[${value.map(item => toSqlLiteral(item)).join(", ")}]`;
  }

  if (typeof value === "boolean") return value ? "true" : "false";

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "null";
  }

  const stringValue = String(value);
  if (stringValue === "") return "null";

  if (isJsonArrayString(stringValue)) {
    const parsed = JSON.parse(stringValue);
    return `array[${parsed.map(item => toSqlLiteral(item)).join(", ")}]`;
  }

  if (isJsonObjectString(stringValue)) {
    return `${quote(stringValue)}::jsonb`;
  }

  return quote(stringValue);
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function isJsonArrayString(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return false;
  try {
    return Array.isArray(JSON.parse(trimmed));
  } catch {
    return false;
  }
}

function isJsonObjectString(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return false;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed);
  } catch {
    return false;
  }
}
