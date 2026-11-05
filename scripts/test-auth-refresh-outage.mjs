// A refresh that could not reach Auth must never sign a member out.
//
// The client half of the 2026-09-22 fix. api/lift-log.js draws this line
// correctly on the server: a rejected token (400/401/403) is a 401, and
// everything else -- unreachable, 5xx, Cloudflare 520/522, 429 -- is a
// retryable 503, because none of those learned anything about the session.
// scripts/test-auth-outage.mjs pins that.
//
// But refreshAuthSession talks straight to Supabase Auth, bypassing our
// server, and its rule was a blocklist: AuthRetryableFetchError or >= 500
// throws, anything else returns null. Every caller signs out on null, so a
// 429 -- Auth rate-limiting, which this project has already drawn in
// production on 2026-09-04 -- read as "your session is invalid".
//
// That matters at launch. Every API call validates its token against Auth, so
// a rate-limited Auth during a signup spike would sign members out of working
// accounts en masse. It would be the fifth time an infrastructure stall
// reached members as data loss or a lost session: 14 Sep, 22 Sep, 29 Sep,
// 2 Nov.
//
//   "'I couldn't check' is never 'it is gone', just as it is never 'you are
//    not signed in'."  -- docs/recurring-debugging-playbook.md
//
// Offline: the Supabase client is stubbed, no network, no credentials.
//
// Usage: node scripts/test-auth-refresh-outage.mjs

import fs from "node:fs";

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "[PASS]" : "[FAIL]"} ${label}${ok ? "" : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
};

// src/lib/api.js reaches for browser globals at import time.
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window ??= { location: { origin: "http://localhost", href: "http://localhost" }, addEventListener() {} };
globalThis.document ??= { addEventListener() {}, visibilityState: "visible" };

const { isDefinitiveAuthRejection } = await import("../src/lib/api.js");

// The source is the contract. If a seam is not available this still pins the
// rule that was wrong, by asserting on the code that implements it.
const source = fs.readFileSync(new URL("../src/lib/api.js", import.meta.url), "utf8");
const refreshBody = source.slice(
  source.indexOf("async function refreshAuthSession"),
  source.indexOf("async function postApi")
);

// --- The rule, read off the implementation ----------------------------------
{
  check("refreshAuthSession throws unless Auth definitively rejected",
    /if \(error && !isDefinitiveAuthRejection\(error\)\) throw error;/.test(refreshBody), true);
  check("the old >= 500 blocklist is gone",
    refreshBody.includes("Number(error?.status) >= 500"), false);
}

// --- Behaviour: the statuses that must NOT sign anyone out -------------------
// Each says nothing about whether the session is valid, so each must fall
// outside the rejection set and make refreshAuthSession throw.
for (const [label, error] of [
  ["429 rate limited", { status: 429, message: "Too Many Requests" }],
  ["500 auth down", { status: 500, message: "Internal Server Error" }],
  ["503 auth unavailable", { status: 503, message: "Service Unavailable" }],
  ["522 cloudflare timeout", { status: 522, message: "Connection Timed Out" }],
  ["408 request timeout", { status: 408, message: "Request Timeout" }],
  ["network unreachable", { name: "AuthRetryableFetchError", message: "Failed to fetch" }]
]) {
  check(`${label} is not a rejection`, isDefinitiveAuthRejection(error), false);
}

// --- The statuses that genuinely mean "sign in again" ------------------------
for (const [label, status] of [["400 bad refresh token", 400], ["401 unauthorized", 401], ["403 forbidden", 403]]) {
  check(`${label} IS a rejection`, isDefinitiveAuthRejection({ status, message: label }), true);
}
check("an error with no status is not a rejection", isDefinitiveAuthRejection({ message: "Failed to fetch" }), false);
check("no error at all is not a rejection", isDefinitiveAuthRejection(undefined), false);

// --- The server still draws the same line ------------------------------------
// If these two ever diverge again, the client and server disagree about what
// "signed out" means, which is how 429 slipped through the first time.
{
  const server = fs.readFileSync(new URL("../api/lift-log.js", import.meta.url), "utf8");
  check("server treats 400/401/403 as the rejected set",
    /tokenRejected = response\.status === 400 \|\| response\.status === 401 \|\| response\.status === 403/.test(server), true);
  check("server returns 503 for everything else",
    /error\.status = tokenRejected \? 401 : 503/.test(server), true);
}

console.log(failures === 0 ? "\nAll auth-refresh outage checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
