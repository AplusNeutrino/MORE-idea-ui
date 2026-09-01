const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const scriptPath = path.resolve(__dirname, "..", "nga-vscode.user.js");
const scriptSource = fs.readFileSync(scriptPath, "utf8");
const launchOptions = { headless: true };
if (process.env.BROWSER_EXECUTABLE_PATH) launchOptions.executablePath = process.env.BROWSER_EXECUTABLE_PATH;
else launchOptions.channel = "msedge";

function readFixture() {
  return `<!doctype html><html><head><title>Fixture Topic</title></head><body>
    <div id="m_nav"><span>Folder</span><span>Fixture Topic</span></div>
    <div id="postsubject0">Fixture Topic</div>
    <div id="m_posts">
      <table id="post1strow0"><tbody><tr><td>
        <span id="postauthor0">tester</span><span id="postdate0">2026-08-31</span>
        <div id="postBtnPos0">#1</div>
        <div id="postcontent0" class="postcontent">body<img src="/assets/sample.png" alt="sample"></div>
      </td></tr></tbody></table>
    </div>
    <span id="fast_post_c"><div class="module_wrap"><div class="w100">
      <table class="forumbox"><tbody><tr class="row1"><td class="c2"><div>
        <input data-fixture="subject" value="">
        <textarea data-fixture="content"></textarea>
        <button title="插入表情" type="button">emoji</button>
        <a class="uitxt1" href="javascript:void(0)">发表回复(Ctrl+Enter)</a>
      </div></td></tr></tbody></table>
    </div></div></span>
    <script>
      window.__submitCount = 0;
      const fixtureSubmit = document.querySelector('#fast_post_c a.uitxt1');
      fixtureSubmit.addEventListener('click', () => { window.__submitCount += 1; });
    </script>
  </body></html>`;
}

async function openFixture(browser, host = "bbs.nga.cn") {
  const page = await browser.newPage();
  await page.route(`https://${host}/**`, (route) => route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: readFixture(),
  }));
  await page.addInitScript({ content: scriptSource });
  await page.goto(`https://${host}/read.php?tid=1`, { waitUntil: "domcontentloaded" });
  await page.locator("#nga-vsc-app").waitFor({ state: "attached", timeout: 4000 });
  await page.locator(".nga-vsc-terminal").waitFor({ state: "visible", timeout: 4000 });
  return page;
}

async function assertTerminal(page) {
  const panel = page.locator("#nga-vsc-panel");
  const nativeRoot = panel.locator("#fast_post_c");
  const input = panel.locator(".nga-vsc-terminal-input");

  assert.equal(await panel.locator(".nga-vsc-terminal-code").count(), 1, "terminal code surface is missing");
  assert.equal(await nativeRoot.locator("table").isVisible(), false, "native quick-reply table is exposed");
  assert.equal(await nativeRoot.locator('[data-fixture="subject"]').isVisible(), false, "native subject field is exposed");
  assert.equal(await input.isVisible(), true, "reply textarea is not embedded in the terminal code");
  assert.equal(await input.getAttribute("rows"), "3", "reply editor must start at three rows");
  assert.equal((await panel.locator(".nga-vsc-terminal-edit-row .nga-vsc-terminal-prefix").innerText()).split("\n")[0], "//", "TypeScript reply prefix is wrong");

  await input.fill("first line\nsecond line");
  assert.equal(await input.evaluate((node) => node.value), "first line\nsecond line", "comment prefix leaked into native reply text");
  await input.fill(Array.from({ length: 10 }, (_, index) => `line ${index + 1}`).join("\n"));
  assert.equal(await input.getAttribute("rows"), "8", "reply editor must stop growing after eight rows");
  await input.fill("first line\nsecond line");

  await page.locator(".nga-vsc-terminal-run").click();
  assert.equal(await page.evaluate(() => window.__submitCount), 1, "run icon did not proxy exactly one native submit");
  await input.press("Control+Enter");
  assert.equal(await page.evaluate(() => window.__submitCount), 2, "Ctrl+Enter did not proxy exactly one native submit");

  await page.getByRole("button", { name: "Terminal", exact: true }).click();
  assert.equal(await panel.getAttribute("aria-hidden"), "true", "Terminal menu did not close the panel");
  await page.keyboard.press("Control+`");
  assert.equal(await panel.getAttribute("aria-hidden"), "false", "Ctrl+` did not reopen the panel");

  await page.locator("#nga-vsc-language").click();
  assert.equal((await panel.locator(".nga-vsc-terminal-edit-row .nga-vsc-terminal-prefix").innerText()).split("\n")[0], "#", "Python reply prefix is wrong");
  assert.equal(await input.evaluate((node) => node.value), "first line\nsecond line", "language rerender discarded the draft");

  await page.keyboard.press("Control+Alt+Shift+N");
  const nativeDebugInput = page.locator('body > #fast_post_c textarea[data-fixture="content"]');
  assert.equal(await nativeDebugInput.evaluate((node) => node.value), "first line\nsecond line", "native debug mode did not restore the reply control");
  await page.keyboard.press("Control+Alt+Shift+N");
  await page.locator(".nga-vsc-terminal").waitFor({ state: "visible" });
  assert.equal(await input.evaluate((node) => node.value), "first line\nsecond line", "returning from native debug mode discarded the draft");

  const visibleText = await page.locator("#nga-vsc-app").innerText();
  assert.doesNotMatch(visibleText, /NGA|玩家社区|发表回复|快速发帖/, "visible terminal leaks forum identity");
}

async function assertExplorer(page) {
  const app = page.locator("#nga-vsc-app");
  for (const id of ["open-editors", "workspace", "src", "assets"]) {
    const toggle = page.locator(`[data-collapse-id="${id}"]`);
    const group = page.locator(`[data-collapse-group="${id}"]`);
    assert.equal(await toggle.getAttribute("aria-expanded"), "true", `${id} must be expanded by default`);
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-expanded"), "false", `${id} did not collapse`);
    assert.equal(await group.isVisible(), false, `${id} children remain visible after collapse`);
    await toggle.click();
  }

  const openEditors = page.locator('[data-collapse-id="open-editors"]');
  await openEditors.click();
  await page.locator("#nga-vsc-language").click();
  assert.equal(await page.locator('[data-collapse-id="open-editors"]').getAttribute("aria-expanded"), "false", "collapse state was lost after rerender");

  const explorer = page.locator('.nga-vsc-activity-btn[data-activity="explorer"]');
  await explorer.click();
  assert.equal(await app.getAttribute("data-sidebar-visible"), "false", "active Explorer icon did not hide the sidebar");
  await explorer.click();
  assert.equal(await app.getAttribute("data-sidebar-visible"), "true", "Explorer icon did not restore the sidebar");
  await explorer.click();
  await page.locator('.nga-vsc-activity-btn[data-activity="source"]').click();
  assert.equal(await app.getAttribute("data-sidebar-visible"), "true", "switching activity did not restore the sidebar");

  const persisted = await page.evaluate(() => ({
    visible: localStorage.getItem("nga-vsc-sidebar-visible"),
    collapsed: localStorage.getItem("nga-vsc-tree-collapsed"),
  }));
  assert.equal(persisted.visible, "1", "sidebar visibility was not persisted");
  assert.match(persisted.collapsed || "", /open-editors/, "tree collapse state was not persisted");
}

async function assertFileHome(browser, host) {
  const page = await openFixture(browser, host);
  const file = page.getByRole("button", { name: "File", exact: true });
  assert.equal(await file.getAttribute("data-command"), "home", "File is missing the home command");
  await file.click();
  await page.waitForURL(`https://${host}/`, { timeout: 4000 });
  assert.equal(page.url(), `https://${host}/`, "File did not return to the current host root");
  await page.close();
}

(async () => {
  const browser = await chromium.launch(launchOptions);
  try {
    const page = await openFixture(browser);
    await assertTerminal(page);
    await assertExplorer(page);
    await page.close();
    await assertFileHome(browser, "bbs.nga.cn");
    await assertFileHome(browser, "ngabbs.com");
    console.log("PASS nga-vscode workbench interactions");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
