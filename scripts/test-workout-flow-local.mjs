// End-to-end API/storage regression. Local Supabase only; fixtures are removed.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import playwright from "/Users/opera_user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js";

const base = "http://127.0.0.1:3000";
const config = await (await fetch(`${base}/api/lift-log?config=auth`)).json();
assert.equal(config.enableLocalDevOtp, true);
assert.equal(new URL(config.supabaseUrl).hostname, "127.0.0.1");
const status = JSON.parse(execFileSync("./.codex-bin/supabase", ["status", "-o", "json", "--workdir", "./supabase-local"], { encoding:"utf8", stdio:["ignore", "pipe", "ignore"] }));
assert.equal(status.API_URL, config.supabaseUrl);
const storage = createClient(status.API_URL, status.SERVICE_ROLE_KEY);
const email = `release-qa-${randomUUID()}@local.test`;
const token = `local-dev:${Buffer.from(email).toString("base64url")}`;
const headers = { "Content-Type":"application/json", Authorization:`Bearer ${token}` };
async function post(action, payload = {}, expected = 200) {
  const response = await fetch(`${base}/api/lift-log`, { method:"POST", headers, body:JSON.stringify({ action, ...payload }) });
  const body = await response.json();
  assert.equal(response.status, expected, `${action}: ${JSON.stringify(body)}`);
  return body;
}
const browser = await playwright.chromium.launch({ headless:true, executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
let accountCreated = false, photoPath;
try {
  const sync = await post("auth-sync");
  accountCreated = true;
  await post("upsert-profile", { displayName:"Release QA" });
  const created = await post("create-group", { groupName:`Release QA ${Date.now()}`, feeModel:"flat", fineAmount:1, minTarget:12, groupTimeZone:"Europe/Oslo" });
  const groupId = created.createdGroupId;
  const page = await browser.newPage({ viewport:{ width:390, height:844 } });
  await page.goto(base, { waitUntil:"networkidle" });
  const jpeg = await page.screenshot({ type:"jpeg" });
  const uploaded = await post("upload-workout-photo", { dataUrl:`data:image/jpeg;base64,${jpeg.toString("base64")}` });
  const url = new URL(uploaded.workoutPhotoUrl);
  assert.equal(url.origin, status.API_URL);
  photoPath = url.pathname.split("/storage/v1/object/public/workout-photos/")[1];
  assert.ok(photoPath?.startsWith(`${sync.session.userId}/`));
  const imageUrl = `${base}/api/lift-log?image=${encodeURIComponent(uploaded.workoutPhotoUrl)}`;
  assert.equal(await page.evaluate(async src => {
    const img = new Image(); img.src = src; await img.decode(); return img.naturalWidth;
  }, imageUrl), 390);

  const date = new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Oslo", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
  const payload = { groupId, date, workoutType:"Gym", note:"Disposable release QA", photoUrl:uploaded.workoutPhotoUrl };
  await post("add-log", payload);
  await post("add-log", payload);
  const third = await post("add-log", payload, 409);
  assert.match(third.details || third.error, /Already logged 2 workouts for this date/);
  const read = async () => (await (await fetch(`${base}/api/lift-log`, { headers })).json()).groups[groupId].logs["Release QA"];
  const logs = await read();
  assert.equal(logs.length, 2);
  assert.ok(logs.every(log => log.photoUrl === uploaded.workoutPhotoUrl));
  await post("delete-log", { groupId, owner:"Release QA", logId:logs[0].id });
  assert.deepEqual((await read()).map(log => log.id), [logs[1].id]);
  await post("add-log", payload);
  assert.equal((await read()).length, 2);
  console.log("Local full-flow passed: authenticated photo upload/render, two same-type saves, HTTP 409 for third, fresh readback, exact deletion and slot reuse.");
} catch (error) {
  console.error("Full-flow failure:", error.message);
  throw error;
} finally {
  try {
    if (accountCreated) await post("delete-account");
  } finally {
    try {
      if (photoPath) {
        const { error } = await storage.storage.from("workout-photos").remove([photoPath]);
        assert.equal(error, null);
      }
    } finally { await browser.close(); }
  }
}
