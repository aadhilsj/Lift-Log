import fs from "node:fs";
import path from "node:path";

const [, , inputPath, outputPathArg] = process.argv;

if (!inputPath) {
  console.error("Usage: node scripts/jsonbin-to-supabase-state.mjs <input.json> [output.sql]");
  process.exit(1);
}

const resolvedInput = path.resolve(inputPath);
const resolvedOutput = path.resolve(outputPathArg || "migration-output/lift_log_state_seed.sql");
const raw = fs.readFileSync(resolvedInput, "utf8");
const parsed = JSON.parse(raw);
const state = parsed?.record ? parsed.record : parsed;
const revision = Number.isFinite(Number(state?.meta?.revision)) ? Number(state.meta.revision) : 0;
const updatedAt = state?.meta?.updatedAt || new Date().toISOString();

const sql = `insert into lift_log_state (id, state, revision, updated_at)
values (
  true,
  ${sqlJson(state)}::jsonb,
  ${revision},
  ${sqlString(updatedAt)}::timestamptz
)
on conflict (id) do update
set
  state = excluded.state,
  revision = excluded.revision,
  updated_at = excluded.updated_at;

insert into lift_log_backups (state_revision, state, reason)
values (
  ${revision},
  ${sqlJson(state)}::jsonb,
  'initial-import'
);
`;

fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
fs.writeFileSync(resolvedOutput, sql);
console.log(resolvedOutput);

function sqlJson(value) {
  return sqlString(JSON.stringify(value));
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
