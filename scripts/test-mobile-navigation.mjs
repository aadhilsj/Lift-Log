import assert from "node:assert/strict";
import playwright from "/Users/opera_user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js";

const baseUrl = process.env.FERO_QA_BASE_URL || "http://127.0.0.1:3000";
const existingEmail = process.env.FERO_QA_EXISTING_EMAIL || "seed-invite@local.test";
const inviteCode = process.env.FERO_QA_INVITE_CODE || "ALHK05";
const otpCode = process.env.FERO_QA_OTP_CODE || "000000";

const browser = await playwright.chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
});
const context = await browser.newContext({
  viewport: { width:390, height:844 },
  isMobile:true,
  hasTouch:true
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);

const activeTab = async () => page.locator(".mobile-tab[aria-current='page']").innerText();

const swipe = async ({ fromX, toX, fromY, toY = fromY }) => {
  await cdp.send("Input.dispatchTouchEvent", {
    type:"touchStart",
    touchPoints:[{ x:fromX, y:fromY }]
  });
  for (let step = 1; step <= 5; step += 1) {
    const x = fromX + ((toX - fromX) * step / 5);
    const y = fromY + ((toY - fromY) * step / 5);
    await cdp.send("Input.dispatchTouchEvent", {
      type:"touchMove",
      touchPoints:[{ x, y }]
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type:"touchEnd", touchPoints:[] });
  await page.waitForTimeout(180);
};

try {
  await page.goto(baseUrl, { waitUntil:"domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("fero_cold_onboarding_seen", "1");
  });
  await page.reload({ waitUntil:"networkidle" });

  await page.getByRole("button", { name:"Sign in", exact:true }).click();
  await page.locator('input[type="email"]').fill(existingEmail);
  await page.getByRole("button", { name:"Send code" }).click();
  await page.getByText("Check your email", { exact:true }).waitFor();
  await page.locator("input").fill(otpCode);
  await page.getByRole("button", { name:"Verify" }).click();
  await page.getByText("Your Blocs", { exact:true }).waitFor({ timeout:30000 });

  await page.goto(`${baseUrl}/?invite=${inviteCode}&journey=already-member-signed-in`, { waitUntil:"networkidle" });
  await page.getByRole("button", { name:"Join this Bloc" }).click();
  await page.getByText("You're already in this Bloc.", { exact:true }).waitFor();
  await page.getByRole("button", { name:"Enter the Bloc" }).click();
  await page.getByText("Bloc Leaderboard", { exact:true }).first().waitFor({ timeout:30000 });

  // Re-selecting Month or History must leave exactly one interactive page layer.
  for (const tabName of ["Month", "History"]) {
    await page.getByRole("button", { name:tabName, exact:true }).click();
    await page.waitForTimeout(50);
    await page.getByRole("button", { name:tabName, exact:true }).click();
    await page.waitForTimeout(100);
    const interactiveLayers = await page.locator("[data-page-scroll-container='true']").count();
    assert.equal(interactiveLayers, 1, `${tabName} reselect must keep one active page layer`);
    const layerPositions = await page.locator("[data-page-scroll-container='true']").evaluate(active => {
      const viewportWidth = window.innerWidth;
      return [...active.parentElement.children].map(layer => {
        const rect = layer.getBoundingClientRect();
        const style = getComputedStyle(layer);
        return { left:rect.left, right:rect.right, transform:style.transform, visibility:style.visibility, atOrigin:style.visibility !== "hidden" && rect.left < viewportWidth && rect.right > 0 };
      });
    });
    const layersAtViewportOrigin = layerPositions.filter(layer => layer.atOrigin).length;
    assert.equal(layersAtViewportOrigin, 1, `${tabName} reselect must not stack inactive page layers: ${JSON.stringify(layerPositions)}`);
    assert.equal(await activeTab(), tabName, `${tabName} must remain active after reselect`);
  }

  // A rightward swipe beginning near the left edge must navigate back through tabs.
  await swipe({ fromX:60, toX:310, fromY:360 });
  assert.equal(await activeTab(), "Month", "Right swipe from History must open Month");
  await swipe({ fromX:60, toX:310, fromY:360 });
  assert.equal(await activeTab(), "Activity", "Right swipe from Month must open Activity");

  await page.getByRole("button", { name:"History", exact:true }).click();
  const leaderboard = page.locator("[data-page-swipe-priority='horizontal-scroll']");
  await leaderboard.waitFor();
  const leaderboardTouchAction = await leaderboard.evaluate(el => getComputedStyle(el).touchAction);
  assert.match(leaderboardTouchAction, /pan-y/, "Leaderboard must permit vertical page scrolling");
  await leaderboard.scrollIntoViewIfNeeded();
  const leaderboardBox = await leaderboard.boundingBox();
  assert.ok(leaderboardBox, "Leaderboard must have a touchable bounding box");
  const leaderboardY = Math.max(180, Math.min(680, leaderboardBox.y + 90));

  // Horizontal movement inside the table belongs to the table, not page tabs.
  await swipe({ fromX:60, toX:310, fromY:leaderboardY });
  assert.equal(await activeTab(), "History", "Horizontal leaderboard swipe must not change tabs");

  // A vertical drag beginning inside the table must still scroll History.
  const historyScroller = page.locator("[data-page-scroll-container='true']");
  const scrollTopBefore = await historyScroller.evaluate(el => el.scrollTop);
  await swipe({ fromX:195, toX:195, fromY:leaderboardY, toY:Math.max(120, leaderboardY - 180) });
  const scrollTopAfter = await historyScroller.evaluate(el => el.scrollTop);
  assert.ok(scrollTopAfter > scrollTopBefore, "Vertical leaderboard drag must scroll History");

  // A non-adjacent tab tap must keep the viewport covered throughout a
  // deliberate one-screen transition. This catches the former blank/shake
  // where History disappeared while Today animated in from three screens away.
  const tapFrames = await page.evaluate(async () => {
    const active = document.querySelector("[data-page-scroll-container='true']");
    const track = active.parentElement;
    const centerX = window.innerWidth / 2;
    const frames = [];
    const sample = () => {
      const layers = [...track.children].map((layer,index) => {
        const rect = layer.getBoundingClientRect();
        const style = getComputedStyle(layer);
        return {index,left:rect.left,right:rect.right,visibility:style.visibility,active:layer.dataset.pageScrollContainer === "true"};
      });
      frames.push({
        layers,
        centerCovered:layers.some(layer => layer.visibility !== "hidden" && layer.left <= centerX && layer.right >= centerX)
      });
    };
    sample();
    [...document.querySelectorAll(".mobile-tab")].find(button => button.innerText.trim() === "Today")?.click();
    sample();
    await new Promise(resolve => {
      let count = 0;
      const tick = () => {
        sample();
        count += 1;
        if (count >= 16) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return frames;
  });
  assert.ok(tapFrames.every(frame => frame.centerCovered), "Tab-tap transition must never expose a blank viewport frame");
  const visibleTodayPositions = tapFrames.flatMap(frame => frame.layers.filter(layer => layer.index === 0 && layer.visibility !== "hidden").map(layer => layer.left));
  assert.ok(visibleTodayPositions.every(left => Math.abs(left) <= 391), "Non-adjacent Today tap must travel no more than one viewport width");
  assert.ok(visibleTodayPositions.some(left => Math.abs(left) > 20 && Math.abs(left) < 370), "Tab tap must include a visible eased transition frame, not an abrupt swap");
  assert.equal(await activeTab(), "Today", "History-to-Today tap transition must finish on Today");

  console.log(JSON.stringify({
    ok:true,
    activeTabReselect:"passed",
    reversePageSwipes:"passed",
    leaderboardHorizontalContainment:"passed",
    leaderboardVerticalScroll:"passed",
    blankFrameFreeTabTransition:"passed",
    singleScreenTabTravel:"passed"
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
