import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";

const SOURCE_ROOT = process.env.FERO_SOURCE_ROOT || "/Users/opera_user/Documents/Codex Space/Lift Log Extraction";
const OUT_ROOT = process.env.FERO_JOURNEY_OUT || "/Users/opera_user/Documents/Codex Space/Lift Log/docs/user-journey-screenshots/2026-08-12";
const NODE_BIN_DIR = "/Users/opera_user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const API_PORT = Number(process.env.FERO_API_PORT || 3000);
const WEB_PORT = Number(process.env.FERO_WEB_PORT || 5174);
const DEBUG_PORT = Number(process.env.FERO_CDP_PORT || 9333);
const BASE_URL = `http://127.0.0.1:${WEB_PORT}`;
const DEV_CODE = "000000";
const INVITE_CODE = process.env.FERO_INVITE_CODE || "ALHK05";
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true };
const NOW_ISO = "2026-08-12T10:00:00.000Z";
const CAPTURE_MUTATION_DELAY_MS = 1400;
const FLOW_FILTER = String(process.env.FERO_JOURNEY_FLOW || "")
  .split(",")
  .map(item => item.trim())
  .filter(Boolean);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForHttp(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok || res.status < 500) return;
    } catch {}
    await sleep(400);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function spawnLogged(label, command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  });
  child.stdout.on("data", chunk => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on("data", chunk => process.stderr.write(`[${label}] ${chunk}`));
  return child;
}

async function writeTestImage(filePath) {
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAClklEQVR4nO2aT2sTURjGf5MkNqa0RUHWXURw4UK8CEXxAiKIexfqxYUX8B4UPHkQ8SZ4EUTwJkjFhZBoK7pRkDSZmWTysE3zzSSdTSbZbM7MvF0emF3CmW++782bmUlmZkYAAABgUzKZTOa/PM/hs8b3fWb8u6w6nY4VCoU8R6eT9h8Wk0ms7/sAkCQpAJxOpxzH8a+ZTCbXdc3pdE6tVsvj8ciyLBzH8W63m8/nk2EY5HA4+HW73c/n86k0TqfTFEWxeDz+nu/7yWQy4/E4nU6n3W6X2+3m8Xj4fD7J5/Pn8zluu90ul8t8Pp9pmuY5MplMOp3OZrPZ5/P5+Xw+5XIZwzB4PB5JkkQiEVVVhWEYfN/3xWLxfr+fJEnS6XTG43G/3+f1epnNZrVabTQaMZvN9Ho9h8Oh0+nQ6XQul8sURYmiiKqqJEmSIAgikUj4fD4+n8+fTqdqtVqj0ciyLPl8Pj6fj8/nM5/P0+l0m82m3W5XFEWJx+NGo5GmaeJ5nlwuF4/Hw+l0er1e0zTt9/vVanWlUrlarU6n0/l8Pp/PJ5vNJkmSRCLx9/sdDoclk0m/3+f1epmmyWQy4/E4nU6n1+vx+/3EYjGfzycIAqPRiNlsJp/PV6vVRqORpmmWy2Xq9Xq5XG63WzabjWEYfD6fRqMRg8HA5/OZTCaXy2U2m3W7Xbfb7XA4fD6f6XQ6Pp/Pm80mSZIwGAwcDkdZlkmlUqPRiM/nM5/PL5fL5fL5AAAA4L+3BXm+4j9r8S5xAAAAAElFTkSuQmCC";
  await fs.writeFile(filePath, Buffer.from(pngBase64, "base64"));
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.pending = new Map();
    this.events = new Map();
    this.ws.onmessage = event => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result || {});
        return;
      }
      if (msg.method && this.events.has(msg.method)) {
        for (const fn of this.events.get(msg.method)) fn(msg.params || {});
      }
    };
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }
  send(method, params = {}) {
    const id = this.id++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  on(method, fn) {
    if (!this.events.has(method)) this.events.set(method, new Set());
    this.events.get(method).add(fn);
  }
  close() {
    this.ws.close();
  }
}

async function getJson(url) {
  return await new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (error) { reject(error); }
      });
    }).on("error", reject);
  });
}

async function connectChrome() {
  const version = await getJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
  const browser = new Cdp(version.webSocketDebuggerUrl);
  await browser.open();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const targets = await getJson(`http://127.0.0.1:${DEBUG_PORT}/json`);
  const target = targets.find(item => item.id === targetId) || targets.find(item => item.type === "page");
  const page = new Cdp(target.webSocketDebuggerUrl);
  await page.open();
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("DOM.enable");
  await page.send("Fetch.enable", {
    patterns: [
      { urlPattern: "*api/lift-log*", requestStage: "Request" }
    ]
  });
  installApiFixture(page);
  await page.send("Emulation.setDeviceMetricsOverride", VIEWPORT);
  await page.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  return { browser, page };
}

function slugify(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "user";
}

function hashLocalDevUuidPart(input, salt) {
  let hash = 2166136261 ^ salt;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function buildLocalDevUserId(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const source = `fero-local-dev-otp:${normalizedEmail}`;
  const part1 = hashLocalDevUuidPart(source, 0x1234);
  const part2 = hashLocalDevUuidPart(source, 0x5678);
  const part3 = hashLocalDevUuidPart(source, 0x9abc);
  const part4 = hashLocalDevUuidPart(source, 0xdef0);
  const variant = ((Number.parseInt(part3.slice(0, 2), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0");
  return `${part1}-${part2.slice(0, 4)}-4${part2.slice(5, 8)}-${variant}${part3.slice(2, 4)}-${part3.slice(4)}${part4}`;
}

function decodeLocalDevEmail(authHeader = "") {
  const token = String(authHeader || "").replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith("local-dev:")) return "";
  try {
    const encoded = token.slice("local-dev:".length).replace(/-/g, "+").replace(/_/g, "/");
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    return Buffer.from(padded, "base64").toString("utf8").trim().toLowerCase();
  } catch {
    return "";
  }
}

function userIdForEmail(email) {
  return buildLocalDevUserId(email || "journey@local.test");
}

function localDevAccessToken(email) {
  return `local-dev:${Buffer.from(String(email || "").trim().toLowerCase(), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")}`;
}

function makeMembership(displayName, email, role = "member", joinedAt = "2026-08-01T08:00:00.000Z") {
  return {
    userId: userIdForEmail(email),
    displayName,
    role,
    joinedAt
  };
}

function makeProfile(displayName, email, profilePhotoUrl = "") {
  return {
    id: userIdForEmail(email),
    email,
    displayName,
    profilePhotoUrl,
    createdAt: NOW_ISO
  };
}

function logsFor(count, type = "Gym") {
  const days = [1, 2, 4, 5, 7, 8, 10, 12, 14, 15, 17, 19, 21, 23, 25, 27];
  return days.slice(0, count).map((day, index) => ({
    id: `log-${type}-${day}-${index}`,
    date: `2026-08-${String(day).padStart(2, "0")}`,
    type,
    note: index % 2 ? "Logged before work" : "",
    createdAt: `2026-08-${String(day).padStart(2, "0")}T08:30:00.000Z`
  }));
}

function baseGroup({ id = "journey-seed", name = "Join Flow Seed 191851", inviteCode = INVITE_CODE } = {}) {
  const members = [
    makeMembership("51 Man", "seed-51@local.test", "admin"),
    makeMembership("Bet Man", "seed-bet@local.test"),
    makeMembership("Big Tester", "seed-big@local.test"),
    makeMembership("Invite Seed", "seed-invite@local.test"),
    makeMembership("Join Tester", "seed-join@local.test")
  ];
  const memberships = Object.fromEntries(members.map(member => [member.userId, member]));
  const profiles = Object.fromEntries([
    makeProfile("51 Man", "seed-51@local.test"),
    makeProfile("Bet Man", "seed-bet@local.test"),
    makeProfile("Big Tester", "seed-big@local.test"),
    makeProfile("Invite Seed", "seed-invite@local.test"),
    makeProfile("Join Tester", "seed-join@local.test")
  ].map(profile => [profile.id, profile]));
  return {
    group: {
      id,
      name,
      adminName: "51 Man",
      adminUserId: userIdForEmail("seed-51@local.test"),
      inviteCode,
      createdAt: "2026-08-01T08:00:00.000Z",
      memberOrder: members.map(member => member.displayName),
      activeMemberOrder: members.map(member => member.displayName),
      memberships,
      joinedMonthByName: {},
      settings: {
        minTarget: 12,
        fineAmount: 20,
        currency: "NOK",
        feeModel: "escalating",
        escalationStepAmount: 5,
        acceptedWorkoutTypes: ["Gym", "Run", "Sports", "Other"],
        timeZone: "Europe/Oslo",
        minRunDistance: 3,
        distanceUnit: "km",
        stravaEnabled: true,
        setupReview: { pending: false, fields: [], reviewedAt: NOW_ISO }
      },
      logs: {
        "51 Man": logsFor(11, "Gym"),
        "Bet Man": logsFor(9, "Run"),
        "Big Tester": logsFor(7, "Sports"),
        "Invite Seed": [],
        "Join Tester": []
      },
      excused: {},
      solo: {},
      soloRequests: [],
      monthHistory: [],
      lastMonth: "2026-7"
    },
    profiles
  };
}

function stateWithGroups(groups, profiles = {}) {
  return {
    version: 2,
    groups: Object.fromEntries(groups.map(group => [group.id, group])),
    groupOrder: groups.map(group => group.id),
    defaultGroupId: groups[0]?.id || null,
    profiles,
    meta: { revision: Date.now(), updatedAt: NOW_ISO }
  };
}

function withMember(group, profile, role = "member") {
  const displayName = profile.displayName;
  const membership = {
    userId: profile.id,
    displayName,
    role,
    joinedAt: NOW_ISO
  };
  return {
    ...group,
    memberOrder: [...(group.memberOrder || []).filter(name => name !== displayName), displayName],
    activeMemberOrder: [...(group.activeMemberOrder || group.memberOrder || []).filter(name => name !== displayName), displayName],
    memberships: { ...(group.memberships || {}), [profile.id]: membership },
    logs: { ...(group.logs || {}), [displayName]: group.logs?.[displayName] || [] }
  };
}

function makeCreatedGroup(payload, profile) {
  const groupName = String(payload?.name || payload?.groupName || "Journey Crew").trim() || "Journey Crew";
  const groupId = `created-${slugify(groupName)}`;
  return {
    id: groupId,
    name: groupName,
    adminName: profile.displayName,
    adminUserId: profile.id,
    inviteCode: "CREATE1",
    createdAt: NOW_ISO,
    memberOrder: [profile.displayName],
    activeMemberOrder: [profile.displayName],
    memberships: {
      [profile.id]: {
        userId: profile.id,
        displayName: profile.displayName,
        role: "admin",
        joinedAt: NOW_ISO
      }
    },
    joinedMonthByName: {},
    settings: {
      minTarget: Number(payload?.settings?.minTarget || 12),
      fineAmount: Number(payload?.settings?.fineAmount || 20),
      currency: payload?.settings?.currency || "NOK",
      feeModel: payload?.settings?.feeModel || "escalating",
      escalationStepAmount: Number(payload?.settings?.escalationStepAmount || 5),
      acceptedWorkoutTypes: payload?.settings?.acceptedWorkoutTypes || ["Gym", "Run", "Sports", "Other"],
      timeZone: payload?.settings?.timeZone || "Europe/Oslo",
      minRunDistance: 3,
      distanceUnit: "km",
      stravaEnabled: true,
      setupReview: { pending: true, fields: ["feeModel", "acceptedWorkoutTypes", "timeZone"], reviewedAt: null }
    },
    logs: { [profile.displayName]: [] },
    excused: {},
    solo: {},
    soloRequests: [],
    monthHistory: [],
    lastMonth: "2026-7"
  };
}

function inviteContextPayload() {
  const { group } = baseGroup();
  return {
    inviteCode: INVITE_CODE,
    groupId: group.id,
    groupName: group.name,
    minTarget: group.settings.minTarget,
    memberCount: 8,
    leaderboardRows: [
      { name: "51 Man", userId: userIdForEmail("seed-51@local.test"), logged: 11, target: 12 },
      { name: "Bet Man", userId: userIdForEmail("seed-bet@local.test"), logged: 9, target: 12 },
      { name: "Big Tester", userId: userIdForEmail("seed-big@local.test"), logged: 7, target: 12 }
    ]
  };
}

function installApiFixture(page) {
  const profilesByEmail = new Map();
  const photoByEmail = new Map();
  const createdGroupsByEmail = new Map();
  const joinedGroupsByEmail = new Map();

  const getProfile = email => {
    const normalized = String(email || "").trim().toLowerCase();
    const existing = profilesByEmail.get(normalized);
    if (existing) return existing;
    return null;
  };

  const setProfile = (email, displayName, profilePhotoUrl = "") => {
    const normalized = String(email || "").trim().toLowerCase();
    const profile = makeProfile(displayName, normalized, profilePhotoUrl || photoByEmail.get(normalized) || "");
    profilesByEmail.set(normalized, profile);
    return profile;
  };

  const seedProfile = (email, displayName, groupOptions = null) => {
    const profile = setProfile(email, displayName);
    if (groupOptions) {
      const { group } = baseGroup(groupOptions);
      joinedGroupsByEmail.set(String(email || "").trim().toLowerCase(), withMember(group, profile));
    }
    return profile;
  };

  seedProfile("journey-returning@local.test", "Returning User", {
    id: "returning-seed",
    name: "Returning Test Bloc",
    inviteCode: "RETURN1"
  });
  seedProfile("journey-existing-invite@local.test", "Existing Invite User");
  seedProfile("seed-invite@local.test", "Invite Seed", {
    id: "journey-seed",
    name: "Join Flow Seed 191851",
    inviteCode: INVITE_CODE
  });

  const stateForEmail = email => {
    const profile = getProfile(email);
    const groups = [];
    const profiles = {};
    if (profile) profiles[profile.id] = profile;
    if (createdGroupsByEmail.has(email)) groups.push(createdGroupsByEmail.get(email));
    if (joinedGroupsByEmail.has(email)) groups.push(joinedGroupsByEmail.get(email));
    return stateWithGroups(groups, profiles);
  };

  page.on("Fetch.requestPaused", async event => {
    const request = event.request || {};
    const url = new URL(request.url);
    if (!url.pathname.endsWith("/api/lift-log")) {
      await page.send("Fetch.continueRequest", { requestId: event.requestId }).catch(() => {});
      return;
    }
    const authEmail = decodeLocalDevEmail(request.headers?.Authorization || request.headers?.authorization || "");
    let status = 200;
    let body = {};
    try {
      if (request.method === "GET") {
        if (url.searchParams.get("config") === "auth") {
          body = {
            supabaseUrl: "http://local.supabase.test",
            supabaseAnonKey: "local-anon",
            enableLocalPreviewAuth: false,
            enableLocalDevOtp: true,
            localDevOtpCode: DEV_CODE
          };
        } else if (url.searchParams.get("revision")) {
          body = { revision: Date.now() };
        } else {
          body = stateForEmail(authEmail);
        }
      } else {
        const payload = request.postData ? JSON.parse(request.postData) : {};
        const action = payload.action;
        if (action === "auth-sync") {
          const profile = getProfile(authEmail);
          body = {
            state: stateForEmail(authEmail),
            session: {
              userId: userIdForEmail(authEmail),
              email: authEmail,
              needsProfileSetup: !profile?.displayName
            }
          };
        } else if (action === "auth-email-exists") {
          const email = String(payload.email || "").trim().toLowerCase();
          body = { exists: profilesByEmail.has(email) || /existing|signin/.test(email) };
        } else if (action === "invite-context") {
          const code = String(payload.inviteCode || "").trim().toUpperCase();
          if (code !== INVITE_CODE) {
            status = 404;
            body = { error: "This invite link doesn't work." };
          } else {
            body = inviteContextPayload();
          }
        } else if (action === "invite-email-membership") {
          const email = String(payload.email || "").trim().toLowerCase();
          const alreadyMember = email === "seed-invite@local.test";
          body = {
            alreadyMember,
            groupId: "journey-seed",
            groupName: "Join Flow Seed 191851",
            inviteCode: INVITE_CODE
          };
        } else if (action === "upsert-profile") {
          await sleep(CAPTURE_MUTATION_DELAY_MS);
          const email = String(payload.email || authEmail || "").trim().toLowerCase();
          const displayName = String(payload.displayName || "").trim();
          const profile = setProfile(email, displayName, photoByEmail.get(email) || "");
          body = stateWithGroups([], { [profile.id]: profile });
        } else if (action === "upload-profile-photo") {
          await sleep(CAPTURE_MUTATION_DELAY_MS);
          const dataUrl = String(payload.dataUrl || "").trim();
          if (authEmail) photoByEmail.set(authEmail, dataUrl);
          const profile = getProfile(authEmail);
          if (profile) {
            const updated = setProfile(authEmail, profile.displayName, dataUrl);
            body = { state: stateForEmail(authEmail), profilePhotoUrl: updated.profilePhotoUrl };
          } else {
            body = { state: stateForEmail(authEmail), profilePhotoUrl: dataUrl };
          }
        } else if (action === "update-profile-photo") {
          await sleep(CAPTURE_MUTATION_DELAY_MS);
          const dataUrl = String(payload.profilePhotoUrl || "").trim();
          if (authEmail) photoByEmail.set(authEmail, dataUrl);
          const profile = getProfile(authEmail);
          if (profile) setProfile(authEmail, profile.displayName, dataUrl);
          body = stateForEmail(authEmail);
        } else if (action === "create-group") {
          await sleep(CAPTURE_MUTATION_DELAY_MS);
          const profile = getProfile(authEmail) || setProfile(authEmail, payload.creatorName || "Journey Maker");
          const group = makeCreatedGroup(payload, profile);
          createdGroupsByEmail.set(authEmail, group);
          body = {
            state: stateWithGroups([group], { [profile.id]: profile }),
            createdGroupId: group.id
          };
        } else if (action === "join-group") {
          await sleep(CAPTURE_MUTATION_DELAY_MS);
          const code = String(payload.inviteCode || "").trim().toUpperCase();
          if (code !== INVITE_CODE) {
            status = 404;
            body = { error: "Invite not found" };
          } else {
            const profile = getProfile(authEmail) || setProfile(authEmail, "Journey Joiner");
            const { group, profiles } = baseGroup();
            const joined = withMember(group, profile);
            joinedGroupsByEmail.set(authEmail, joined);
            body = {
              state: stateWithGroups([joined], { ...profiles, [profile.id]: profile }),
              joinedGroupId: joined.id
            };
          }
        } else if (action === "stream-unread-count") {
          body = { unreadCount: 0 };
        } else if (action === "stream-list") {
          body = { messages: [] };
        } else {
          body = stateForEmail(authEmail);
        }
      }
    } catch (error) {
      status = 500;
      body = { error: error instanceof Error ? error.message : String(error) };
    }
    await page.send("Fetch.fulfillRequest", {
      requestId: event.requestId,
      responseCode: status,
      responseHeaders: [
        { name: "Content-Type", value: "application/json; charset=utf-8" },
        { name: "Cache-Control", value: "no-store" }
      ],
      body: Buffer.from(JSON.stringify(body), "utf8").toString("base64")
    }).catch(() => {});
  });
}

async function navigate(page, url) {
  await page.send("Page.navigate", { url });
  await sleep(1200);
}

async function evaluate(page, expression) {
  const result = await page.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
  }
  return result.result?.value;
}

function qText(text) {
  return JSON.stringify(text);
}

async function waitForText(page, text, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const found = await evaluate(page, `document.body?.innerText?.includes(${qText(text)}) || false`);
    if (found) return;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for text: ${text}`);
}

async function screenshot(page, flow, name) {
  await sleep(250);
  const dir = path.join(OUT_ROOT, flow);
  await fs.mkdir(dir, { recursive: true });
  const result = await page.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const file = path.join(dir, `${name}.png`);
  await fs.writeFile(file, Buffer.from(result.data, "base64"));
  return file;
}

async function clickByText(page, text) {
  const ok = await evaluate(page, `
    (() => {
      const needle = ${qText(text)};
      const candidates = [...document.querySelectorAll('button,a,[role="button"]')]
        .filter(node => {
          const rect = node.getBoundingClientRect();
          if (!rect.width || !rect.height) return false;
          const style = window.getComputedStyle(node);
          if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity || 1) === 0) return false;
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const top = document.elementFromPoint(cx, cy);
          return top && (node === top || node.contains(top));
        })
        .map(node => ({ node, label: (node.innerText || node.textContent || '').trim() }));
      const exact = candidates.filter(item => item.label === needle);
      const partial = candidates.filter(item => item.label.includes(needle));
      const item = (exact.length ? exact : partial).at(-1);
      const el = item?.node;
      if (!el) return false;
      el.click();
      return true;
    })()
  `);
  if (!ok) throw new Error(`Could not click text: ${text}`);
  await sleep(700);
}

async function clickEnabledButtonByText(page, text) {
  const rect = await evaluate(page, `
    (() => {
      const needle = ${qText(text)};
      const buttons = [...document.querySelectorAll('button')]
        .filter(button => {
          const label = (button.innerText || button.textContent || '').trim();
          const rect = button.getBoundingClientRect();
          const style = window.getComputedStyle(button);
          return label === needle
            && !button.disabled
            && rect.width > 0
            && rect.height > 0
            && style.visibility !== 'hidden'
            && style.display !== 'none'
            && Number(style.opacity || 1) !== 0;
        });
      const button = buttons.at(-1);
      if (!button) return null;
      button.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = button.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    })()
  `);
  if (!rect) throw new Error(`Could not click enabled button: ${text}`);
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  await sleep(500);
}

async function clickAria(page, label) {
  const ok = await evaluate(page, `
    (() => {
      const el = document.querySelector('[aria-label=${qText(label)}]');
      if (!el) return false;
      el.click();
      return true;
    })()
  `);
  if (!ok) throw new Error(`Could not click aria: ${label}`);
  await sleep(450);
}

async function fillFirstInput(page, value) {
  const ok = await evaluate(page, `
    (() => {
      const input = [...document.querySelectorAll('input, textarea')].find(el => el.type !== 'file' && !el.disabled);
      if (!input) return false;
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
      if (setter) setter.call(input, ${qText(value)});
      else input.value = ${qText(value)};
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);
  if (!ok) throw new Error(`Could not fill input with ${value}`);
  await sleep(300);
}

async function fillInputByPlaceholder(page, placeholder, value) {
  const ok = await evaluate(page, `
    (() => {
      const input = [...document.querySelectorAll('input, textarea')].find(el => (el.placeholder || '').includes(${qText(placeholder)}));
      if (!input) return false;
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
      if (setter) setter.call(input, ${qText(value)});
      else input.value = ${qText(value)};
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: ${qText(value)}, inputType: 'insertText' }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return input.value === ${qText(value)};
    })()
  `);
  if (!ok) throw new Error(`Could not fill placeholder: ${placeholder}`);
  const stuck = await waitForExpression(page, `
    [...document.querySelectorAll('input, textarea')]
      .find(el => (el.placeholder || '').includes(${qText(placeholder)}))?.value === ${qText(value)}
  `, 3000).catch(() => false);
  if (!stuck) throw new Error(`Input did not retain value for placeholder: ${placeholder}`);
  await sleep(300);
}

async function fillInputByLabel(page, labelText, value) {
  const ok = await evaluate(page, `
    (() => {
      const labelNeedle = ${qText(labelText)};
      const labels = [...document.querySelectorAll('label')];
      const label = labels.find(item => (item.innerText || item.textContent || '').includes(labelNeedle));
      const input = label?.querySelector('input, textarea');
      if (!input) return false;
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
      if (setter) setter.call(input, ${qText(value)});
      else input.value = ${qText(value)};
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: ${qText(value)}, inputType: 'insertText' }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return input.value === ${qText(value)};
    })()
  `);
  if (!ok) throw new Error(`Could not fill label: ${labelText}`);
  const stuck = await waitForExpression(page, `
    [...document.querySelectorAll('label')]
      .find(item => (item.innerText || item.textContent || '').includes(${qText(labelText)}))
      ?.querySelector('input, textarea')?.value === ${qText(value)}
  `, 3000).catch(() => false);
  if (!stuck) throw new Error(`Input did not retain value for label: ${labelText}`);
  await sleep(450);
}

async function waitForExpression(page, expression, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const found = await evaluate(page, `Boolean(${expression})`);
    if (found) return true;
    await sleep(120);
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

async function setFirstFileInput(page, filePath) {
  const { root } = await page.send("DOM.getDocument", {});
  const { nodeId } = await page.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: "input[type=file]"
  });
  if (!nodeId) throw new Error("No file input found");
  await page.send("DOM.setFileInputFiles", { nodeId, files: [filePath] });
  await sleep(900);
}

async function clearSession(page) {
  await evaluate(page, `
    (() => {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(';').forEach(cookie => {
        document.cookie = cookie.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date(0).toUTCString() + ';path=/');
      });
      return true;
    })()
  `).catch(() => {});
}

async function seedLocalDevSession(page, email) {
  const normalized = String(email || "").trim().toLowerCase();
  await evaluate(page, `
    (() => {
      localStorage.setItem("ll_auth_session_hint_v1", JSON.stringify({
        localDevOtp: true,
        userId: ${qText(userIdForEmail(normalized))},
        email: ${qText(normalized)},
        accessToken: ${qText(localDevAccessToken(normalized))}
      }));
      return true;
    })()
  `);
}

async function waitForAnyText(page, texts, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const found = await evaluate(page, `
      (() => {
        const text = document.body?.innerText || "";
        return ${JSON.stringify(texts)}.find(item => text.includes(item)) || "";
      })()
    `);
    if (found) return found;
    await sleep(150);
  }
  throw new Error(`Timed out waiting for any text: ${texts.join(", ")}`);
}

async function captureColdCreate(page, testPhoto) {
  const flow = "01-cold-create-bloc";
  await navigate(page, `${BASE_URL}/?onboarding=1&journey=cold-create`);
  await clearSession(page);
  await navigate(page, `${BASE_URL}/?onboarding=1&journey=cold-create`);
  await waitForText(page, "For the Bloc");
  await screenshot(page, flow, "01-onboarding-leaderboard");
  await clickAria(page, "Next onboarding screen");
  await screenshot(page, flow, "02-onboarding-activity");
  await clickAria(page, "Next onboarding screen");
  await screenshot(page, flow, "03-onboarding-settlement");
  await clickAria(page, "Next onboarding screen");
  await screenshot(page, flow, "04-onboarding-create-entry");
  await fillInputByPlaceholder(page, "Type your Bloc name", "Journey Crew");
  await screenshot(page, flow, "05-onboarding-create-entry-filled");
  await clickByText(page, "Create your Bloc");
  await waitForText(page, "Create a Bloc");
  await screenshot(page, flow, "06-create-bloc-modal");
  await clickByText(page, "Create");
  await waitForText(page, "Sign in first");
  await screenshot(page, flow, "07-sign-in-first-email");
  await fillFirstInput(page, "journey-create@local.test");
  await clickByText(page, "Send code");
  await waitForText(page, "Check your email");
  await screenshot(page, flow, "08-otp-code");
  await fillFirstInput(page, DEV_CODE);
  await clickByText(page, "Verify");
  await waitForText(page, "What should your Bloc call you");
  await screenshot(page, flow, "09-display-name-photo-empty");
  await setFirstFileInput(page, testPhoto);
  await fillInputByPlaceholder(page, "Display name", "Journey Maker");
  await screenshot(page, flow, "10-display-name-photo-filled");
  await clickEnabledButtonByText(page, "Continue");
  await waitForAnyText(page, ["Saving your name", "Securing your profile", "Creating your Bloc", "Setting things up", "Final touches", "Opening your Bloc"], 15000);
  await screenshot(page, flow, "11-progress-creating");
  await waitForText(page, "Finish setup", 25000).catch(() => waitForText(page, "Bloc Leaderboard", 25000));
  await screenshot(page, flow, "12-landed-in-new-bloc");
}

async function captureColdJoin(page, testPhoto) {
  const flow = "02-cold-join-code";
  await navigate(page, `${BASE_URL}/?onboarding=1&journey=cold-join`);
  await clearSession(page);
  await navigate(page, `${BASE_URL}/?onboarding=1&journey=cold-join`);
  await waitForText(page, "For the Bloc");
  for (let i = 0; i < 3; i += 1) await clickAria(page, "Next onboarding screen");
  await waitForText(page, "Join an existing Bloc instead");
  await screenshot(page, flow, "01-onboarding-join-entry");
  await clickByText(page, "Join an existing Bloc instead");
  await waitForText(page, "Join a Bloc");
  await screenshot(page, flow, "02-invite-code");
  await fillInputByLabel(page, "Invite code", INVITE_CODE);
  await waitForExpression(page, `[...document.querySelectorAll('button')].some(button => (button.innerText || '').trim() === 'Continue' && !button.disabled)`, 3000);
  await clickByText(page, "Continue");
  await waitForText(page, "Sign in first");
  await screenshot(page, flow, "03-sign-in-first-email");
  await fillFirstInput(page, "journey-join@local.test");
  await clickByText(page, "Send code");
  await waitForText(page, "Check your email");
  await screenshot(page, flow, "04-otp-code");
  await fillFirstInput(page, DEV_CODE);
  await clickByText(page, "Verify");
  await waitForText(page, "What should your Bloc call you");
  await screenshot(page, flow, "05-display-name-photo-empty");
  await setFirstFileInput(page, testPhoto);
  await fillInputByPlaceholder(page, "Display name", "Journey Joiner");
  await screenshot(page, flow, "06-display-name-photo-filled");
  await clickEnabledButtonByText(page, "Continue");
  await waitForAnyText(page, ["Saving your name", "Securing your profile", "Joining your Bloc", "Syncing the leaderboard", "Final touches", "Opening your Bloc"], 15000);
  await screenshot(page, flow, "07-progress-joining");
  await waitForText(page, "Bloc Leaderboard", 25000);
  await screenshot(page, flow, "08-landed-in-joined-bloc");
}

async function captureInviteLink(page, testPhoto) {
  const flow = "03-invite-link-new-user";
  await navigate(page, `${BASE_URL}/?invite=${INVITE_CODE}&journey=invite-link`);
  await clearSession(page);
  await navigate(page, `${BASE_URL}/?invite=${INVITE_CODE}&journey=invite-link`);
  await waitForText(page, "Welcome to the Bloc");
  await screenshot(page, flow, "01-invite-preview");
  await clickByText(page, "Join this Bloc");
  await waitForText(page, "Sign in first");
  await screenshot(page, flow, "02-sign-in-first-email");
  await fillFirstInput(page, "journey-invite@local.test");
  await clickByText(page, "Send code");
  await waitForText(page, "Check your email");
  await screenshot(page, flow, "03-otp-code");
  await fillFirstInput(page, DEV_CODE);
  await clickByText(page, "Verify");
  await waitForText(page, "What should your Bloc call you");
  await screenshot(page, flow, "04-display-name-photo-empty");
  await setFirstFileInput(page, testPhoto);
  await fillInputByPlaceholder(page, "Display name", "Invite Journey");
  await screenshot(page, flow, "05-display-name-photo-filled");
  await clickEnabledButtonByText(page, "Continue");
  await waitForAnyText(page, ["Saving your name", "Securing your profile", "Joining your Bloc", "Syncing the leaderboard", "Final touches", "Opening your Bloc"], 15000);
  await screenshot(page, flow, "06-progress-joining");
  await waitForText(page, "You're in", 25000).catch(() => {});
  await waitForText(page, "Bloc Leaderboard", 25000);
  await screenshot(page, flow, "07-landed-with-toast");
}

async function captureWelcomeBack(page, testPhoto) {
  const flow = "04-welcome-back-new-account";
  await navigate(page, `${BASE_URL}/?journey=welcome-back`);
  await clearSession(page);
  await evaluate(page, `localStorage.setItem("fero_cold_onboarding_seen", "1")`);
  await navigate(page, `${BASE_URL}/?journey=welcome-back`);
  await waitForText(page, "Welcome back");
  await screenshot(page, flow, "01-welcome-back");
  await clickByText(page, "Create new account");
  await waitForText(page, "Create your account");
  await screenshot(page, flow, "02-create-account-email");
  await fillFirstInput(page, "journey-welcome@local.test");
  await clickByText(page, "Send code");
  await waitForText(page, "Check your email");
  await screenshot(page, flow, "03-otp-code");
  await fillFirstInput(page, DEV_CODE);
  await clickByText(page, "Verify");
  await waitForText(page, "For the Bloc");
  await screenshot(page, flow, "04-onboarding-start-after-account");
  for (let i = 0; i < 3; i += 1) await clickAria(page, "Next onboarding screen");
  await fillInputByPlaceholder(page, "Type your Bloc name", "Welcome Crew");
  await screenshot(page, flow, "05-onboarding-create-entry");
  await clickByText(page, "Create your Bloc");
  await waitForText(page, "Create a Bloc");
  await screenshot(page, flow, "06-create-bloc-modal");
  await clickByText(page, "Create");
  await waitForText(page, "What should your Bloc call you");
  await setFirstFileInput(page, testPhoto);
  await fillInputByPlaceholder(page, "Display name", "Welcome Maker");
  await screenshot(page, flow, "07-display-name-photo-filled");
  await clickEnabledButtonByText(page, "Continue");
  await waitForAnyText(page, ["Saving your name", "Securing your profile", "Creating your Bloc", "Setting things up", "Final touches", "Opening your Bloc"], 15000);
  await screenshot(page, flow, "08-progress-creating");
  await waitForText(page, "Finish setup", 25000).catch(() => waitForText(page, "Bloc Leaderboard", 25000));
  await screenshot(page, flow, "09-landed-in-new-bloc");
}

async function captureWelcomeBackSignIn(page) {
  const flow = "05-welcome-back-existing-sign-in";
  await navigate(page, `${BASE_URL}/?journey=welcome-back-signin`);
  await clearSession(page);
  await evaluate(page, `localStorage.setItem("fero_cold_onboarding_seen", "1")`);
  await navigate(page, `${BASE_URL}/?journey=welcome-back-signin`);
  await waitForText(page, "Welcome back");
  await screenshot(page, flow, "01-welcome-back");
  await clickByText(page, "Sign in");
  await waitForText(page, "Continue with email");
  await screenshot(page, flow, "02-sign-in-email");
  await fillFirstInput(page, "journey-returning@local.test");
  await clickByText(page, "Send code");
  await waitForText(page, "Check your email");
  await screenshot(page, flow, "03-otp-code");
  await fillFirstInput(page, DEV_CODE);
  await clickByText(page, "Verify");
  await waitForAnyText(page, ["Bloc Leaderboard", "YOUR BLOCS", "Returning Test Bloc"], 25000);
  const onSwitcher = await evaluate(page, `document.body?.innerText?.includes("Returning Test Bloc") && !document.body?.innerText?.includes("Bloc Leaderboard")`);
  if (onSwitcher) {
    await screenshot(page, flow, "04-returned-to-account");
    await clickByText(page, "Returning Test Bloc");
    await waitForText(page, "Bloc Leaderboard", 25000);
    await screenshot(page, flow, "05-landed-in-existing-bloc");
    return;
  }
  await screenshot(page, flow, "04-landed-in-existing-bloc");
}

async function captureInviteExistingUser(page) {
  const flow = "06-invite-link-existing-user";
  await navigate(page, `${BASE_URL}/?invite=${INVITE_CODE}&journey=invite-existing`);
  await clearSession(page);
  await navigate(page, `${BASE_URL}/?invite=${INVITE_CODE}&journey=invite-existing`);
  await waitForText(page, "Welcome to the Bloc");
  await screenshot(page, flow, "01-invite-preview");
  await clickByText(page, "Join this Bloc");
  await waitForText(page, "Sign in first");
  await screenshot(page, flow, "02-sign-in-first-email");
  await fillFirstInput(page, "journey-existing-invite@local.test");
  await clickByText(page, "Send code");
  await waitForText(page, "Check your email");
  await screenshot(page, flow, "03-otp-code");
  await fillFirstInput(page, DEV_CODE);
  await clickByText(page, "Verify");
  await waitForAnyText(page, ["Joining your Bloc", "Syncing the leaderboard", "Opening your Bloc"], 15000);
  await screenshot(page, flow, "04-progress-joining");
  await waitForText(page, "Bloc Leaderboard", 25000);
  await screenshot(page, flow, "05-landed-in-joined-bloc");
}

async function captureInviteAlreadyMemberSignedOut(page) {
  const flow = "07-invite-link-already-member-signed-out";
  await navigate(page, `${BASE_URL}/?invite=${INVITE_CODE}&journey=already-member-signed-out`);
  await clearSession(page);
  await navigate(page, `${BASE_URL}/?invite=${INVITE_CODE}&journey=already-member-signed-out`);
  await waitForText(page, "Welcome to the Bloc");
  await screenshot(page, flow, "01-invite-preview");
  await clickByText(page, "Join this Bloc");
  await waitForText(page, "Sign in first");
  await screenshot(page, flow, "02-sign-in-first-email");
  await fillFirstInput(page, "seed-invite@local.test");
  await clickByText(page, "Send code").catch(() => {});
  await waitForText(page, "You're already in this Bloc", 10000);
  await screenshot(page, flow, "03-already-member");
  await clickByText(page, "Enter the Bloc");
  await waitForText(page, "Check your email");
  await screenshot(page, flow, "04-otp-code");
  await fillFirstInput(page, DEV_CODE);
  await clickByText(page, "Verify");
  await waitForText(page, "Bloc Leaderboard", 25000);
  await screenshot(page, flow, "05-landed-in-existing-bloc");
}

async function captureInviteAlreadyMemberSignedIn(page) {
  const flow = "08-invite-link-already-member-signed-in";
  await navigate(page, `${BASE_URL}/?journey=seed-session`);
  await clearSession(page);
  await evaluate(page, `localStorage.setItem("fero_cold_onboarding_seen", "1")`);
  await navigate(page, `${BASE_URL}/?journey=seed-session`);
  await waitForText(page, "Welcome back");
  await clickByText(page, "Sign in");
  await waitForText(page, "Continue with email");
  await fillFirstInput(page, "seed-invite@local.test");
  await clickByText(page, "Send code");
  await waitForText(page, "Check your email");
  await fillFirstInput(page, DEV_CODE);
  await clickByText(page, "Verify");
  await waitForAnyText(page, ["Bloc Leaderboard", "YOUR BLOCS", "Join Flow Seed 191851"], 25000);
  await waitForExpression(page, `
    (() => {
      const raw = localStorage.getItem("ll_auth_session_hint_v1");
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return parsed?.localDevOtp && parsed?.email === "seed-invite@local.test";
    })()
  `, 5000);
  await navigate(page, `${BASE_URL}/?invite=${INVITE_CODE}&journey=already-member-signed-in`);
  await waitForText(page, "Welcome to the Bloc");
  await sleep(3500);
  await waitForExpression(page, `
    (() => {
      const raw = localStorage.getItem("ll_auth_session_hint_v1");
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return parsed?.localDevOtp && parsed?.email === "seed-invite@local.test";
    })()
  `, 5000);
  await screenshot(page, flow, "01-invite-preview-signed-in");
  await clickEnabledButtonByText(page, "Join this Bloc");
  const next = await waitForAnyText(page, ["You're already in this Bloc", "Joining your Bloc", "Bloc Leaderboard", "YOUR BLOCS", "Sign in first", "Welcome to the Bloc"], 15000);
  if (next === "Welcome to the Bloc") {
    await screenshot(page, flow, "02-after-join-tap-no-state-change");
    const text = await evaluate(page, `document.body?.innerText || ""`);
    throw new Error(`Signed-in invite join did not leave preview. Visible text: ${text.slice(0, 1000)}`);
  }
  if (next === "Sign in first") {
    await screenshot(page, flow, "02-unexpected-sign-in-first");
    throw new Error("Signed-in invite join unexpectedly opened auth.");
  }
  if (next === "You're already in this Bloc") {
    await screenshot(page, flow, "02-already-member");
    await clickByText(page, "Enter the Bloc");
    await waitForText(page, "Bloc Leaderboard", 25000);
    await screenshot(page, flow, "03-landed-in-existing-bloc");
    return;
  }
  if (next === "Joining your Bloc") {
    await screenshot(page, flow, "02-progress-joining");
    await waitForText(page, "Bloc Leaderboard", 25000);
    await screenshot(page, flow, "03-landed-in-existing-bloc");
    return;
  }
  if (next === "YOUR BLOCS") {
    await screenshot(page, flow, "02-returned-to-account");
    await clickByText(page, "Join Flow Seed 191851");
    await waitForText(page, "Bloc Leaderboard", 25000);
    await screenshot(page, flow, "03-landed-in-existing-bloc");
    return;
  }
  await screenshot(page, flow, "02-landed-in-existing-bloc");
}

async function captureEdgeStates(page) {
  const flow = "09-edge-states";
  await navigate(page, `${BASE_URL}/?invite=INVALID&journey=invalid-invite`);
  await clearSession(page);
  await navigate(page, `${BASE_URL}/?invite=INVALID&journey=invalid-invite`);
  await waitForText(page, "invite", 10000).catch(() => {});
  await screenshot(page, flow, "01-invalid-invite");
  await navigate(page, `${BASE_URL}/?invite=${INVITE_CODE}&full=1&journey=full-invite`);
  await clearSession(page);
  await navigate(page, `${BASE_URL}/?invite=${INVITE_CODE}&full=1&journey=full-invite`);
  await waitForText(page, "Welcome to the Bloc");
  await waitForText(page, "This Bloc is full", 10000);
  await screenshot(page, flow, "02-full-bloc");
}

async function writeIndex(files) {
  const lines = [
    "# Fero Onboarding Journey Screenshots",
    "",
    `Generated: 2026-08-12`,
    `Source worktree: \`${SOURCE_ROOT}\``,
    `Base URL: \`${BASE_URL}\``,
    `Local test profile image: \`${path.join(OUT_ROOT, "local-test-profile.png")}\``,
    "",
    "These PNGs are intended for product review and Google Slides documentation. The captures use the preview branch local dev OTP path and include a local profile-photo upload.",
    "",
  ];
  for (const [flow, flowFiles] of Object.entries(files)) {
    lines.push(`## ${flow}`);
    for (const file of flowFiles) {
      const rel = path.relative(OUT_ROOT, file);
      lines.push(`- [${path.basename(file)}](${rel})`);
    }
    lines.push("");
  }
  await fs.writeFile(path.join(OUT_ROOT, "README.md"), lines.join("\n"));
}

async function main() {
  await fs.mkdir(OUT_ROOT, { recursive: true });
  const testPhoto = path.join(OUT_ROOT, "local-test-profile.png");
  await writeTestImage(testPhoto);

  const env = {
    ...process.env,
    PATH: `${NODE_BIN_DIR}:${process.env.PATH || ""}`,
    HOST: "127.0.0.1",
    PORT: String(API_PORT),
    SUPABASE_URL: process.env.SUPABASE_URL || "http://local.supabase.test",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "local-anon",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "local-service",
    ENABLE_LOCAL_DEV_OTP: "true",
    ENABLE_LOCAL_PREVIEW_AUTH: "false",
    LOCAL_DEV_OTP_CODE: DEV_CODE
  };

  const api = spawnLogged("api", process.execPath, ["scripts/local-dev-server.mjs"], { cwd: SOURCE_ROOT, env });
  const vite = spawnLogged("vite", process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(WEB_PORT)], { cwd: SOURCE_ROOT, env });
  const chromeProfile = path.join("/tmp", `fero-journey-chrome-${Date.now()}`);
  const chrome = spawnLogged("chrome", CHROME, [
    "--headless=new",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${chromeProfile}`,
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    `--window-size=${VIEWPORT.width},${VIEWPORT.height}`
  ]);

  const files = {};
  try {
    await waitForHttp(`${BASE_URL}/`);
    await waitForHttp(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    const { browser, page } = await connectChrome();
    try {
      for (const [name, fn] of [
        ["01-cold-create-bloc", () => captureColdCreate(page, testPhoto)],
        ["02-cold-join-code", () => captureColdJoin(page, testPhoto)],
        ["03-invite-link-new-user", () => captureInviteLink(page, testPhoto)],
        ["04-welcome-back-new-account", () => captureWelcomeBack(page, testPhoto)],
        ["05-welcome-back-existing-sign-in", () => captureWelcomeBackSignIn(page)],
        ["06-invite-link-existing-user", () => captureInviteExistingUser(page)],
        ["07-invite-link-already-member-signed-out", () => captureInviteAlreadyMemberSignedOut(page)],
        ["08-invite-link-already-member-signed-in", () => captureInviteAlreadyMemberSignedIn(page)],
        ["09-edge-states", () => captureEdgeStates(page)]
      ]) {
        if (FLOW_FILTER.length && !FLOW_FILTER.includes(name)) continue;
        console.log(`\n[capture] ${name}`);
        await fn();
        const dir = path.join(OUT_ROOT, name);
        const names = await fs.readdir(dir).catch(() => []);
        files[name] = names.filter(file => file.endsWith(".png")).sort().map(file => path.join(dir, file));
      }
      await writeIndex(files);
    } finally {
      page.close();
      browser.close();
    }
  } finally {
    for (const child of [chrome, vite, api]) {
      if (child && !child.killed) child.kill("SIGTERM");
    }
  }
  console.log(`\nDone: ${OUT_ROOT}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
