const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const scriptPath = path.resolve(__dirname, "..", "nga-vscode.user.js");
const scriptSource = fs.readFileSync(scriptPath, "utf8");
const launchOptions = { headless: true };
if (process.env.BROWSER_EXECUTABLE_PATH) launchOptions.executablePath = process.env.BROWSER_EXECUTABLE_PATH;
else launchOptions.channel = "msedge";

async function assertWorkbench(page, label) {
  await page.locator("#nga-vsc-app").waitFor({ state: "attached", timeout: 4000 });
  const initial = await page.evaluate(() => ({
    title: document.title,
    ready: document.documentElement.classList.contains("nga-vsc-ready"),
    app: Boolean(document.getElementById("nga-vsc-app")),
  }));
  assert.deepEqual(initial, {
    title: "workspace — Visual Studio Code",
    ready: true,
    app: true,
  }, `${label}: workbench did not initialize`);

  await page.evaluate(() => {
    const nativeIcon = [...document.querySelectorAll('link[rel~="icon"]')]
      .find((node) => node.id !== "nga-vsc-favicon");
    if (nativeIcon) nativeIcon.setAttribute("href", "/site-rewrite.ico");
  });
  await page.waitForFunction(() => {
    const nativeIcon = [...document.querySelectorAll('link[rel~="icon"]')]
      .find((node) => node.id !== "nga-vsc-favicon");
    return !nativeIcon || nativeIcon.getAttribute("href")?.startsWith("data:image/svg+xml,");
  }, null, { timeout: 1000 });

  const timerResponsive = await page.evaluate(() => new Promise((resolve) => {
    setTimeout(() => resolve(true), 25);
  }));
  assert.equal(timerResponsive, true, `${label}: identity observer starved the event loop`);
}

(async () => {
  const browser = await chromium.launch(launchOptions);
  try {
    const inlinePage = await browser.newPage();
    const inlineScript = scriptSource.replace(/<\/script/gi, "<\\/script");
    await inlinePage.route("https://bbs.nga.cn/**", (route) => route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html><head><script>${inlineScript}</script><title>NGA玩家社区</title><link rel="icon" href="/favicon.ico"></head><body><main id="mc">fixture</main></body></html>`,
    }));
    await inlinePage.goto("https://bbs.nga.cn/inline-start", { waitUntil: "commit", timeout: 4000 });
    await assertWorkbench(inlinePage, "head-present document-start");

    const earliestPage = await browser.newPage();
    await earliestPage.route("https://bbs.nga.cn/**", (route) => route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: "<!doctype html><html><head><title>NGA玩家社区</title><link rel=\"icon\" href=\"/favicon.ico\"></head><body><main id=\"mc\">fixture</main></body></html>",
    }));
    await earliestPage.addInitScript({ content: scriptSource });
    await earliestPage.goto("https://bbs.nga.cn/earliest-start", { waitUntil: "commit", timeout: 4000 });
    await assertWorkbench(earliestPage, "pre-documentElement document-start");

    console.log("PASS nga-vscode bootstrap and identity guard");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
