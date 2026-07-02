import playwright from "/Users/opera_user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js";

const { chromium, devices } = playwright;

const baseUrl = process.env.QA_BASE_URL || "http://127.0.0.1:3000";
const iphone = devices["iPhone 13"];
const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
});
const context = await browser.newContext({
  ...iphone
});
const page = await context.newPage();
const requestedPreviewMember = String(process.env.QA_LOCAL_PREVIEW_MEMBER || "").trim();

const results = [];

function record(name, data) {
  results.push({ screen: name, ...data });
}

async function basicAudit(name) {
  const data = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const overflow = Math.max(
      doc.scrollWidth - doc.clientWidth,
      body ? body.scrollWidth - body.clientWidth : 0
    );
    const fixedBottomNav = !!document.querySelector(".mobile-bottom-nav");
    return {
      title: document.title,
      textSample: (document.body?.innerText || "").slice(0, 400),
      overflow,
      fixedBottomNav
    };
  });
  record(name, data);
}

async function openAndWait(path = "/") {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
}

async function dismissInstallBannerIfPresent() {
  const hideTip = page.getByRole("button", { name: /hide tip|maybe later/i }).first();
  if (await hideTip.count()) {
    await hideTip.click();
    await page.waitForTimeout(250);
  }
}

async function fetchAuthConfig() {
  const response = await page.request.get(`${baseUrl}/api/lift-log?config=auth`);
  return response.json();
}

async function seedLocalPreviewSession() {
  const response = await page.request.get(`${baseUrl}/api/lift-log`);
  const data = await response.json();
  const firstGroupId = data.defaultGroupId || Object.keys(data.groups || {})[0];
  const firstGroup = firstGroupId ? data.groups?.[firstGroupId] : null;
  const members = firstGroup?.memberOrder || [];
  const selectedMember = requestedPreviewMember && members.includes(requestedPreviewMember)
    ? requestedPreviewMember
    : members[0];
  if (!selectedMember || !firstGroupId) return false;
  await page.evaluate(({ previewDisplayName, groupId }) => {
    localStorage.setItem("ll_preview_auth", JSON.stringify({ previewDisplayName }));
    localStorage.setItem("ll_group_id", groupId);
  }, {
    previewDisplayName: selectedMember,
    groupId: firstGroupId
  });
  return true;
}

async function detectAppShell() {
  return page.evaluate(() => {
    const bodyText = document.body?.innerText || "";
    return {
      hasBottomNav: !!document.querySelector(".mobile-bottom-nav"),
      hasTodayTab: /today/i.test(bodyText),
      hasActivityTab: /activity/i.test(bodyText),
      hasResultsTab: /results/i.test(bodyText),
      hasHistoryTab: /history/i.test(bodyText),
      hasLeaderboard: /bloc leaderboard/i.test(bodyText),
      hasLandingCta: /create a bloc|join a bloc|already have an account/i.test(bodyText)
    };
  });
}

try {
  await openAndWait("/");
  await basicAudit("preview");

  const createButton = page.getByRole("button", { name: /create a bloc/i });
  if (await createButton.count()) {
    await createButton.click();
    await page.waitForTimeout(400);
  }

  const modalAudit = await page.evaluate(() => {
    const dialog = document.querySelector(".modal");
    if (!dialog) return null;
    const rect = dialog.getBoundingClientRect();
    return {
      modalVisible: true,
      modalBottomGap: Math.round(window.innerHeight - rect.bottom),
      modalTopGap: Math.round(rect.top),
      modalOverflowY: window.getComputedStyle(dialog).overflowY
    };
  });
  record("create-bloc-modal", modalAudit || { modalVisible: false });

  const authConfig = await fetchAuthConfig();
  record("auth-config", {
    enableLocalPreviewAuth: !!authConfig?.enableLocalPreviewAuth
  });

  if (authConfig?.enableLocalPreviewAuth) {
    const seeded = await seedLocalPreviewSession();
    record("local-preview-auth", { seeded });
    if (seeded) {
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
    }
  }

  await dismissInstallBannerIfPresent();

  const shell = await detectAppShell();
  record("app-shell", shell);

  const inApp = shell.hasBottomNav && (shell.hasTodayTab || shell.hasActivityTab || shell.hasResultsTab || shell.hasHistoryTab);

  if (inApp) {
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await basicAudit("today");

    const activityTab = page.getByRole("button", { name: /activity/i }).first();
    if (await activityTab.count()) {
      await activityTab.click();
      await page.waitForTimeout(900);
    }

    const resultsTab = page.getByRole("button", { name: /results/i }).first();
    if (await resultsTab.count()) {
      await resultsTab.click();
      await page.waitForTimeout(900);
      await basicAudit("results");
    }

    const historyTab = page.getByRole("button", { name: /history/i }).first();
    if (await historyTab.count()) {
      await historyTab.click();
      await page.waitForTimeout(900);
      await basicAudit("history");
    }
  } else {
    record("signed-out-state", {
      reason: authConfig?.enableLocalPreviewAuth
        ? "Local preview auth did not reach app shell"
        : "Production-like auth requires a real sign-in flow; automated QA remained on public landing"
    });
  }

  process.stdout.write(JSON.stringify({ ok: true, results }, null, 2));
} catch (error) {
  process.stdout.write(JSON.stringify({
    ok: false,
    error: String(error),
    results
  }, null, 2));
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
