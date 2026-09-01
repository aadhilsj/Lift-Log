import assert from "node:assert/strict";
import fs from "node:fs";

const server = fs.readFileSync(new URL("../api/lift-log.js", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../src/lib/api.js", import.meta.url), "utf8");
const apiOrigin = fs.readFileSync(new URL("../src/lib/apiOrigin.js", import.meta.url), "utf8");
const appState = fs.readFileSync(new URL("../src/lib/appState.js", import.meta.url), "utf8");
const appIconCatalog = fs.readFileSync(new URL("../ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json", import.meta.url), "utf8");

assert.ok(server.includes("const IS_PRODUCTION_DEPLOYMENT"), "server must identify production deployments");
assert.ok(server.includes("const ENABLE_LOCAL_DEV_OTP = !IS_PRODUCTION_DEPLOYMENT"), "local OTP support must be disabled in production");
assert.ok(client.includes("if (isLocalDevEnvironment() && config?.enableLocalDevOtp)"), "client must only use local OTP on a local host");
assert.ok(client.includes('endsWith("@local.test")'), "local OTP must remain limited to local test identities");

assert.ok(apiOrigin.includes("Capacitor.isNativePlatform()"), "native builds must detect the Capacitor runtime");
assert.ok(apiOrigin.includes("VITE_FERO_API_ORIGIN"), "native API origin must be configurable per release environment");
assert.ok(apiOrigin.includes("https://lift-log-nu.vercel.app"), "native builds need a current deployed API fallback");
assert.equal((client.match(/fetch\(getApiUrl\(/g) || []).length, 10, "all client API calls must use the native-safe URL helper");
assert.ok(appState.includes("getApiUrl(`/api/lift-log?image="), "native storage image requests must use the API URL helper");
assert.ok(server.includes('"capacitor://localhost"'), "server must allow the iOS Capacitor origin");
assert.ok(server.includes('"http://localhost"'), "server must allow Android-compatible Capacitor local origin");
assert.ok(server.includes("applyNativeWebviewCors(req, res)"), "server must apply native WebView CORS headers");
assert.ok(server.includes('if (req.method === "OPTIONS")'), "server must handle native WebView CORS preflight requests");
assert.ok(appIconCatalog.includes('"filename" : "FeroAppIcon-1024.png"'), "native build must reference Fero's App Store icon");
assert.ok(fs.existsSync(new URL("../ios/App/App/Assets.xcassets/AppIcon.appiconset/FeroAppIcon-1024.png", import.meta.url)), "native Fero App Store icon asset must exist");

console.log("Release guard checks passed.");
