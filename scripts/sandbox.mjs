// Fero sandbox: the whole app on this Mac, against a JSON file.
//
//   npm run sandbox
//
// Nothing here can reach production. SUPABASE_URL, the anon key and the
// service-role key are all overwritten with sandbox values before
// local-dev-server.mjs loads .env.local, and that loader keeps whatever is
// already in process.env (scripts/local-dev-server.mjs, loadEnvFile). A guard
// below refuses to start if the production project ref appears anyway.
//
// Why not a Vercel preview: preview deployments point at the production
// database. Confirmed 2026-09-03, docs/rollover-incident-2026-09-01.md.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(rootDir, ".sandbox-data");
const blobFile = path.join(dataDir, "blob.json");
const supabasePort = 54321;
const appPort = Number(process.env.SANDBOX_APP_PORT || 3000);
const PRODUCTION_REF = "bpvvvqjsfwmmfjvvijkd";

const sandboxEnv = {
  ...process.env,

  // The three that decide which database we talk to.
  SUPABASE_URL: `http://127.0.0.1:${supabasePort}`,
  SUPABASE_ANON_KEY: "sandbox-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "sandbox-service-role-key",

  // Sign in as anyone @local.test with the code below. No email is sent and
  // Supabase Auth is never called (api/lift-log.js, parseLocalDevAuthToken).
  ENABLE_LOCAL_DEV_OTP: "true",
  LOCAL_DEV_OTP_CODE: "000000",
  ENABLE_LOCAL_PREVIEW_AUTH: "false",

  // Production sets this, and .env.local was pulled from production. Left
  // alone it would skip blob writes for some actions and expect canonical to
  // hold them instead — but sandbox canonical keeps nothing, so those writes
  // would silently disappear. Cleared deliberately.
  BLOB_MIRROR_SKIP_ACTIONS: "",
  WRITE_HYDRATION_PARITY_ACTIONS: "",

  VERCEL_ENV: "development",
  ADMIN_PIN: "0000",
  CRON_SECRET: "sandbox",

  SANDBOX_BLOB_FILE: blobFile,
  SANDBOX_SUPABASE_PORT: String(supabasePort),
  PORT: String(appPort),

  // Listen on the local network, not just this Mac. Fero is tested on a phone,
  // and 127.0.0.1 is unreachable from one. The API already treats 192.168.x.x,
  // 10.x.x.x and 172.16–31.x.x callers as local (isLocalDevRequest), so the
  // dev sign-in works from a phone exactly as it does here.
  HOST: "0.0.0.0"
};

// The address a phone on the same wifi should use.
const lanAddress = Object.values(os.networkInterfaces())
  .flat()
  .find(entry => entry?.family === "IPv4" && !entry.internal)?.address || null;

for (const [key, value] of Object.entries(sandboxEnv)) {
  if (typeof value === "string" && value.includes(PRODUCTION_REF)) {
    console.error(`\nRefusing to start: ${key} still points at production (${PRODUCTION_REF}).\n`);
    process.exit(1);
  }
}

fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(blobFile)) {
  // An empty object is NOT an empty state. normalizeState() treats anything
  // without `version: 2` as a legacy single-group document and wraps it into a
  // group called "legacy-group" — which then swallows the first real Bloc.
  // Start shaped correctly instead.
  fs.writeFileSync(blobFile, JSON.stringify({
    state: {
      version: 2,
      groups: {},
      groupOrder: [],
      profiles: {},
      meta: { revision: 0, updatedAt: new Date().toISOString() }
    },
    revision: 0,
    updated_at: new Date().toISOString()
  }, null, 2));
}

if (!fs.existsSync(path.join(rootDir, "dist", "index.html"))) {
  console.error("\nNo dist/ build found. Run `npm run build` first, then `npm run sandbox`.\n");
  process.exit(1);
}

const children = [];
function start(label, file) {
  const child = spawn(process.execPath, [file], { env: sandboxEnv, cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] });
  const prefix = line => line && console.log(`[${label}] ${line}`);
  child.stdout.on("data", d => String(d).split("\n").forEach(prefix));
  child.stderr.on("data", d => String(d).split("\n").forEach(prefix));
  child.on("exit", code => {
    console.log(`[${label}] exited (${code})`);
    shutdown(code ?? 0);
  });
  children.push(child);
  return child;
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    try { child.kill("SIGTERM"); } catch { /* already gone */ }
  }
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start("sandbox-supabase", path.join(rootDir, "scripts", "sandbox-supabase.mjs"));
setTimeout(() => {
  start("fero", path.join(rootDir, "scripts", "local-dev-server.mjs"));
  setTimeout(() => {
    console.log("");
    console.log("  Fero sandbox is up.");
    console.log("");
    console.log(`    On this Mac   http://127.0.0.1:${appPort}`);
    if (lanAddress) console.log(`    On your phone http://${lanAddress}:${appPort}   (same wifi)`);
    console.log("");
    console.log("    Sign in       any address ending @local.test");
    console.log("    Code          000000");
    console.log("");
    console.log(`    Data          ${path.relative(rootDir, blobFile)}  (delete it to start over)`);
    console.log("    Live app      untouched — this talks to a local file only");
    console.log("");
  }, 700);
}, 400);
