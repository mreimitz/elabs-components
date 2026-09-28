/** Run against an isolated Atlas dev server. PLAYWRIGHT_MODULE selects an installed Playwright;
 * ATLAS_URL defaults to :5414; ATLAS_EVIDENCE optionally stores screenshots.
 * ATLAS_COPY_ONLY=1 skips the unrelated Retry/clipboard checks. */
/* global document, navigator, getComputedStyle */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { parseDocument } from "yaml";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.ATLAS_URL ?? "http://localhost:5414";
const stem = `home-regression-${Date.now()}`;
const template = `templates/${stem}.yaml`;
const copies = [`customers/${stem}.yaml`, `customers/${stem}-2.yaml`];
const form = process.env.ATLAS_TITLE_FORM ?? "block";
const rawTitle =
  "Customer architecture with a very long title covering cloud systems data gateways and all downstream consumers" +
  (form === "anchored-multiline" ? '\nSecond line with quotes "kept" and a \\path' : "");
const title = rawTitle.replace(/\s+/g, " ");
const sources = {
  block: `# Keep this template\ndiagram: "1"\ntitle: > # preserve title comment\n  ${title}\ndescription: Copy proof\nnodes:\n  - id: tenant\n    ref: ws/components/qlik-cloud-tenant\n`,
  anchored: `# Keep this template\ndiagram: "1"\ntitle: &name ${title} # preserve title comment\ndescription: *name\nx-values: [*name, *name]\nx-map: {*name : unchanged}\nnodes:\n  - id: tenant\n    title: *name\n    ref: ws/components/qlik-cloud-tenant\n`,
  aliased: `# Keep this template\ndiagram: "1"\nx-title: &name ${title}\ntitle: *name # preserve title comment\ndescription: *name\nnodes:\n  - id: tenant\n    title: *name\n    ref: ws/components/qlik-cloud-tenant\n`,
  flow: `{diagram: "1", title: "${title}", description: Copy proof, nodes: [{id: tenant, ref: ws/components/qlik-cloud-tenant}]} # preserve title comment\n`,
  "anchored-multiline": `# Keep this template\ndiagram: "1"\ntitle: &name ${JSON.stringify(rawTitle)} # preserve title comment\ndescription: *name\nx-values: [*name, {nested: [*name, *name]}]\nx-map: {*name : unchanged}\nnodes:\n  - id: tenant\n    title: *name\n    ref: ws/components/qlik-cloud-tenant\n`,
};
const source = sources[form];
assert.ok(source, "ATLAS_TITLE_FORM must be block, anchored, aliased, flow or anchored-multiline");

const get = async (path) =>
  (await fetch(`${base}/api/workspace/file?path=${encodeURIComponent(path)}`)).text();
const hash = (text) => createHash("sha256").update(text).digest("hex");
assert.equal(
  (
    await fetch(`${base}/api/workspace/file?path=${template}&create=1`, {
      method: "PUT",
      body: source,
    })
  ).ok,
  true,
);
const originalHash = hash(await get(template));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: async () => {
        throw new Error("Clipboard denied for test");
      },
    },
    configurable: true,
  });
  document.execCommand = () => false;
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
const screenshot = async (name) => {
  if (!process.env.ATLAS_EVIDENCE) return;
  await mkdir(process.env.ATLAS_EVIDENCE, { recursive: true });
  await page.screenshot({
    path: `${process.env.ATLAS_EVIDENCE}/${name}.png`,
    animations: "disabled",
  });
};
const settleTheme = async (theme) => {
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  await page.getByRole("menuitemradio", { name: theme, exact: true }).click();
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    (name) => getComputedStyle(document.documentElement).colorScheme === name,
    theme.toLowerCase(),
  );
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))),
  );
};
try {
  for (let i = 0; i < 2; i++) {
    await page.goto(`${base}/#home`);
    await page.getByRole("button", { name: "New from template", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: title, exact: true }).click();
    await page.waitForURL(`**/#d/${copies[i]}`);
    await page
      .getByRole("tab", { name: `${title} ${i === 0 ? "(copy)" : "(copy 2)"}`, exact: true })
      .waitFor();
  }
  assert.equal(hash(await get(template)), originalHash);
  for (let i = 0; i < 2; i++) {
    const text = await get(copies[i]);
    const parsed = parseDocument(text);
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.get("title"), `${rawTitle} ${i === 0 ? "(copy)" : "(copy 2)"}`);
    assert.ok(text.includes("# preserve title comment"));
    const original = parseDocument(source).toJS(),
      copy = parsed.toJS();
    delete original.title;
    delete copy.title;
    assert.deepEqual(copy, original);
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["Light", "Dark"]) {
      await page.goto(`${base}/#home`);
      await settleTheme(theme);
      const recent = page.getByRole("region", { name: "Recent", exact: true });
      for (const marker of ["(copy)", "(copy 2)"]) {
        const name = `${title} ${marker}`;
        await recent.getByRole("link", { name, exact: true }).waitFor();
        await recent.getByRole("heading", { name, exact: true }).waitFor();
        const visibleMarker = recent
          .locator('[aria-hidden="true"]')
          .filter({ hasText: marker })
          .first();
        await visibleMarker.scrollIntoViewIfNeeded();
        assert.ok(await visibleMarker.isVisible());
      }
      await screenshot(`recent-${width}-${theme.toLowerCase()}`);
      const folders = page.getByRole("region", { name: "Folders", exact: true });
      const folderLink = folders.locator(`a[href="#d/${copies[1]}"]`);
      await folderLink.scrollIntoViewIfNeeded();
      assert.match(await folderLink.ariaSnapshot(), /copy 2/);
      await screenshot(`folders-${width}-${theme.toLowerCase()}`);
      const components = page.getByRole("region", { name: "Components", exact: true });
      await components.getByRole("button", { name: /Used in \d+ diagrams/ }).click();
      const popover = page.getByRole("dialog");
      const usedLink = popover.locator(`a[href="#d/${copies[1]}"]`);
      await usedLink.waitFor();
      assert.match(await usedLink.ariaSnapshot(), /copy 2/);
      const box = await popover.boundingBox();
      assert.ok(box.x >= 7 && box.x + box.width <= width - 7);
      await screenshot(`used-in-${width}-${theme.toLowerCase()}`);
      await page.keyboard.press("Escape");
      await page.goto(`${base}/#d/${copies[1]}`);
      const tab = page.getByRole("tab", { name: `${title} (copy 2)`, exact: true });
      await tab.scrollIntoViewIfNeeded();
      assert.ok(await tab.getByText("(copy 2)", { exact: true }).isVisible());
      await screenshot(`tabs-${width}-${theme.toLowerCase()}`);
    }
  }
  if (process.env.ATLAS_COPY_ONLY !== "1") {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/#home`);
    await page.route("**/api/workspace/tree", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Retry proof unavailable" }),
      }),
    );
    await page.reload();
    await page
      .getByRole("heading", { name: "Could not load the workspace", level: 2, exact: true })
      .waitFor();
    await page.unroute("**/api/workspace/tree");
    const retry = page.getByRole("button", { name: "Retry", exact: true }).last();
    await retry.focus();
    await retry.press("Enter");
    await page.waitForFunction(() => document.activeElement?.id === "home-recent");
    await screenshot("retry-focus");
    await page.getByRole("button", { name: "Connect an LLM", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Copy Claude Desktop config", exact: true }).click();
    await dialog.getByText("Selected — press Ctrl+C or ⌘C to copy", { exact: true }).waitFor();
    assert.match(await page.evaluate(() => document.getSelection()?.toString()), /mcpServers/);
    await dialog
      .getByText("Selected — press Ctrl+C or ⌘C to copy", { exact: true })
      .waitFor({ state: "hidden", timeout: 6000 });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth), true);
    await screenshot("connect-phone-fallback-cleared");
    await page.keyboard.press("Escape");
  }
  await page.goto(`${base}/#dev/spec-check`);
  await page.getByRole("heading", { name: "Spec check", exact: true }).waitFor();
  assert.equal(await page.locator('[data-pass="false"]').count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      result: "pass",
      titleForm: form,
      originalHash,
      copies,
      desktopPhoneLightDark: true,
      recentAccessibleNames: true,
      foldersUsedInTabs: true,
      retryKeyboardFocus: process.env.ATLAS_COPY_ONLY !== "1",
      clipboardFallbackExpires: process.env.ATLAS_COPY_ONLY !== "1",
      consoleErrors: errors,
    }),
  );
} finally {
  await browser.close();
  for (const path of [template, ...copies])
    await fetch(`${base}/api/workspace/trash`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
}
