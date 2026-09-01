import assert from "node:assert/strict";
import playwright from "playwright";
import fs from "node:fs";

const serverSource = fs.readFileSync(new URL("../api/lift-log.js", import.meta.url), "utf8");
assert.ok(serverSource.includes("const IS_PRODUCTION_DEPLOYMENT"), "production deployment detection must protect local OTP support");
assert.ok(serverSource.includes("const ENABLE_LOCAL_DEV_OTP = !IS_PRODUCTION_DEPLOYMENT"), "local OTP support must be forcibly disabled in production");

const baseUrl = process.env.FERO_QA_BASE_URL || "http://127.0.0.1:3000";
const existingEmail = process.env.FERO_QA_EXISTING_EMAIL || "seed-invite@local.test";
const inviteCode = process.env.FERO_QA_INVITE_CODE || "ALHK05";
const otpCode = process.env.FERO_QA_OTP_CODE || "000000";

const browser = await playwright.chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil:"domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("fero_cold_onboarding_seen", "1");
  });
  await page.reload({ waitUntil:"networkidle" });

  // Regression 1: an existing user who accidentally starts account creation
  // can accept the Sign in handoff and reach their existing account.
  await page.getByRole("button", { name:"Create new account" }).click();
  await page.locator('input[type="email"]').fill(existingEmail);
  await page.getByRole("button", { name:"Send code" }).click();
  await page.getByText("Account already exists", { exact:true }).waitFor();
  await page.getByRole("button", { name:"Sign in", exact:true }).click();
  await page.getByText("Check your email", { exact:true }).waitFor();
  await page.locator("input").fill(otpCode);
  await page.getByRole("button", { name:"Verify" }).click();
  await page.getByText("Your Blocs", { exact:true }).waitFor({ timeout:30000 });

  const storedSessionBeforeInvite = await page.evaluate(() => JSON.parse(localStorage.getItem("ll_auth_session_hint_v1") || "null"));
  assert.equal(storedSessionBeforeInvite?.email, existingEmail);
  assert.equal(storedSessionBeforeInvite?.localDevOtp, true);

  // Regression 2: navigating to an invite on the same origin preserves the
  // local OTP session and recognizes existing membership without another OTP.
  await page.goto(`${baseUrl}/?invite=${inviteCode}&journey=already-member-signed-in`, { waitUntil:"networkidle" });
  const inviteBody = await page.locator("body").innerText();
  assert.ok(!inviteBody.includes("Sign in first"), "Invite navigation must preserve the signed-in local OTP session");
  assert.ok(!inviteBody.includes("Check your email"), "Signed-in invite must not request another OTP");
  await page.getByRole("button", { name:"Join this Bloc" }).click();
  await page.getByText("You're already in this Bloc.", { exact:true }).waitFor();
  await page.getByRole("button", { name:"Enter the Bloc" }).click();
  await page.getByText("Bloc Leaderboard", { exact:true }).first().waitFor({ timeout:30000 });

  console.log(JSON.stringify({
    ok:true,
    existingSignupHandoff:"passed",
    signedInAlreadyMemberInvite:"passed",
    existingEmail,
    inviteCode
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
