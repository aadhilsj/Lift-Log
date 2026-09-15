// What the sign-in screen says when a code cannot be sent.
//
// This exists because the app used to answer every one of these conditions with
// "No Fero account found for that email." The production auth log for
// 2026-09-04 03:06:14 shows the consequence: a 429 rate limit, reported to the
// founder as his account not existing.
//
// The error shapes below are copied from that log and from Supabase's own
// responses — not invented — because a classifier tested against made-up input
// proves nothing about the real thing.
//
// Run: npm run test:otp-errors

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const outDir = mkdtempSync(join(tmpdir(), "fero-otp-"));
const outFile = join(outDir, "api.mjs");
const banner = [
  "globalThis.window={location:{hostname:'localhost',origin:'http://localhost',pathname:'/'},",
  "localStorage:{getItem:()=>null,setItem(){},removeItem(){}},addEventListener(){},removeEventListener(){}};",
  "globalThis.localStorage=window.localStorage;"
].join("");

execFileSync("npx", [
  "esbuild", "src/lib/api.js",
  "--bundle", "--platform=node", "--format=esm",
  `--outfile=${outFile}`, "--loader:.css=empty", "--log-level=error",
  `--banner:js=${banner}`
], { stdio: "inherit" });

const { classifyOtpSendError } = await import(pathToFileURL(outFile).href);

let failures = 0;
const test = (label, fn) => {
  try {
    fn();
    console.log(`  PASS  ${label}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL  ${label}\n        ${error.message}`);
  }
};

// ── The one that actually happened ───────────────────────────────────────────
// Verbatim from the production auth log, 2026-09-04T03:06:14Z.
const REAL_RATE_LIMIT = {
  message: "For security purposes, you can only request this after 36 seconds.",
  code: "over_email_send_rate_limit",
  status: 429
};

test("the real 429 is recognised as a rate limit", () => {
  const result = classifyOtpSendError(REAL_RATE_LIMIT);
  assert.equal(result.rateLimited, true);
});

test("the real 429 is NOT reported as a missing account", () => {
  // This is the whole bug. If this ever goes true again, members are being told
  // their account does not exist because they tapped twice.
  const result = classifyOtpSendError(REAL_RATE_LIMIT);
  assert.equal(result.noAccount, false);
});

test("the exact wait is read out of the message, not guessed", () => {
  const result = classifyOtpSendError(REAL_RATE_LIMIT);
  assert.equal(result.retryAfterSeconds, 36);
});

test("other wait lengths are read too", () => {
  for (const seconds of [1, 9, 47, 60]) {
    const result = classifyOtpSendError({
      message: `For security purposes, you can only request this after ${seconds} seconds.`,
      code: "over_email_send_rate_limit",
      status: 429
    });
    assert.equal(result.retryAfterSeconds, seconds, `expected ${seconds}`);
  }
});

test("a singular second still parses", () => {
  const result = classifyOtpSendError({
    message: "For security purposes, you can only request this after 1 second.",
    status: 429
  });
  assert.equal(result.retryAfterSeconds, 1);
});

test("a rate limit with unfamiliar wording falls back to a minute", () => {
  // Supabase may reword this. Better a slightly long wait than no number.
  const result = classifyOtpSendError({ message: "Too many requests", status: 429 });
  assert.equal(result.rateLimited, true);
  assert.equal(result.retryAfterSeconds, 60);
});

test("a 429 is caught even without the error code", () => {
  const result = classifyOtpSendError({ message: "slow down", status: 429 });
  assert.equal(result.rateLimited, true);
});

// ── Genuinely no account ─────────────────────────────────────────────────────
// What Supabase returns for signInWithOtp when shouldCreateUser is false and
// the address is unknown.
test("otp_disabled is the only thing that means no account", () => {
  const result = classifyOtpSendError({
    message: "Signups not allowed for otp",
    code: "otp_disabled",
    status: 422
  });
  assert.equal(result.noAccount, true);
  assert.equal(result.rateLimited, false);
});

test("the same answer without a code is still recognised", () => {
  const result = classifyOtpSendError({ message: "Signups not allowed for otp", status: 422 });
  assert.equal(result.noAccount, true);
});

// ── Everything else keeps its own reason ─────────────────────────────────────
test("a server error is neither, and keeps its message", () => {
  const result = classifyOtpSendError({ message: "Internal Server Error", status: 500 });
  assert.equal(result.rateLimited, false);
  assert.equal(result.noAccount, false);
  assert.equal(result.error, "Internal Server Error");
});

test("a dropped connection is neither", () => {
  const result = classifyOtpSendError({ message: "Failed to fetch" });
  assert.equal(result.rateLimited, false);
  assert.equal(result.noAccount, false);
});

test("an empty error still says something", () => {
  const result = classifyOtpSendError({});
  assert.equal(result.error, "Unable to send code");
  assert.equal(result.noAccount, false);
});

test("a non-rate-limit never carries a countdown", () => {
  for (const error of [{ message: "Internal Server Error", status: 500 }, { message: "Signups not allowed for otp", code: "otp_disabled" }, {}]) {
    assert.equal(classifyOtpSendError(error).retryAfterSeconds, null);
  }
});

rmSync(outDir, { recursive: true, force: true });
console.log(failures ? `\n${failures} failing` : "\nAll OTP send-error checks passed");
process.exit(failures ? 1 : 0);
