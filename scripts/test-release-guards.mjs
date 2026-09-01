import assert from "node:assert/strict";
import fs from "node:fs";

const server = fs.readFileSync(new URL("../api/lift-log.js", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../src/lib/api.js", import.meta.url), "utf8");

assert.ok(server.includes("const IS_PRODUCTION_DEPLOYMENT"), "server must identify production deployments");
assert.ok(server.includes("const ENABLE_LOCAL_DEV_OTP = !IS_PRODUCTION_DEPLOYMENT"), "local OTP support must be disabled in production");
assert.ok(client.includes("if (isLocalDevEnvironment() && config?.enableLocalDevOtp)"), "client must only use local OTP on a local host");
assert.ok(client.includes('endsWith("@local.test")'), "local OTP must remain limited to local test identities");

console.log("Release guard checks passed.");
