/** Home library browser regression. Run against this checkout's isolated dev server. */
/* global window, document, localStorage, process, console, URL */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile, rm } from "node:fs/promises";
const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const { default: AxeBuilder } = require("@axe-core/playwright");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5460";
const evidence = process.env.HOME_EVIDENCE ?? "/tmp/atlas-home-browser";
const folder = `home-library-proof-${process.pid}`;
const disk = new URL(`../workspace/${folder}/`, import.meta.url);
const path = `${folder}/cafe.yaml`;
const title = "Café integration architecture";
await mkdir(disk, { recursive: true });
await mkdir(evidence, { recursive: true });
await writeFile(
  new URL("cafe.yaml", disk),
  `diagram: "1"\ntitle: ${title}\ndescription: A browser regression fixture.\nnodes:\n  - id: source\n    title: NebulaContentNeedle\n`,
);
const browser = await chromium.launch();
const results = [];
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript((theme) => localStorage.setItem("brand-ui-theme", theme), theme);
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [],
      writes = [];
    page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
    page.on("request", (request) => {
      if (["POST", "PUT", "DELETE"].includes(request.method())) writes.push(request.url());
    });
    await page.goto(`${base}/#home`);
    const home = page.locator('[data-slot="home-browser"]');
    await expect(home).toBeVisible();
    const items = home.locator('[data-slot="browser-result"]');
    const search = home.getByRole("searchbox", { name: "Search library" });
    const collection = (name) => home.getByRole("tab", { name, exact: true });
    await expect(items).toHaveCount(0);
    await page.screenshot({ path: `${evidence}/${theme}-recent.png` });
    await search.fill("NebulaContentNeedle");
    await expect(items.filter({ hasText: title })).toHaveCount(1);
    await expect(items.filter({ hasText: title })).toContainText("NebulaContentNeedle");
    await search.fill("cafe integration");
    await expect(items.filter({ hasText: title })).toHaveCount(1);
    const found = items.filter({ hasText: title });
    await found.getByRole("button", { name: `Preview ${title}`, exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("dialog").locator('[data-slot="component-preview"] .react-flow__node'),
    ).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(
      found.getByRole("button", { name: `Preview ${title}`, exact: true }),
    ).toBeFocused();
    await found.getByRole("link").first().click();
    await page.waitForURL(`**/#d/${path}`);
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await expect(page.locator(".monaco-editor")).toHaveCount(0);
    await page.getByRole("button", { name: "Toggle Sidebar", exact: true }).click();
    const sidebar = page.getByRole("navigation", { name: "Atlas", exact: true });
    await expect.poll(async () => (await sidebar.boundingBox())?.width ?? 0).toBeGreaterThan(100);
    await page.goBack();
    await expect.poll(async () => (await sidebar.boundingBox())?.width ?? 1000).toBeLessThan(100);
    await expect(search).toHaveValue("cafe integration");
    await search.fill("");
    await collection("Recent").click();
    await expect(items.filter({ hasText: title })).toHaveCount(1);
    await collection("Catalog").click();
    await expect(items.first()).toBeVisible();
    assert.ok((await items.count()) <= 48, "Catalog is paginated");
    const gridIds = await items.evaluateAll((nodes) => nodes.map((n) => n.dataset.resourceId));
    await home.getByRole("button", { name: "Table view", exact: true }).click();
    await expect(home.getByRole("table")).toBeVisible();
    assert.deepEqual(
      await items.evaluateAll((nodes) => nodes.map((n) => n.dataset.resourceId)),
      gridIds,
    );
    await page.screenshot({ path: `${evidence}/${theme}-table.png` });
    await home.getByRole("button", { name: "Next page", exact: true }).click();
    assert.notDeepEqual(
      await items.evaluateAll((nodes) => nodes.map((n) => n.dataset.resourceId)),
      gridIds,
    );
    await search.fill("aws lambda");
    const lambda = home.locator('[data-resource-id="catalog:aws/lambda"]');
    await expect(lambda).toBeVisible();
    await lambda.getByRole("link").first().click();
    await page.waitForURL("**/#catalog/aws/lambda");
    await expect(page.getByRole("button", { name: "Copy YAML", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(search).toHaveValue("aws lambda");
    await expect(lambda).toBeVisible();
    await page.goto(`${base}/#home`);
    await expect(items.filter({ hasText: "Lambda" })).toHaveCount(1);
    await collection("Catalog").click();
    await home.getByRole("button", { name: "Grid view", exact: true }).click();
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(search).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      assert.equal(overflow, false, `No page overflow at ${width}`);
      await page.screenshot({ path: `${evidence}/${theme}-${width}-catalog.png` });
      const a11y = await new AxeBuilder({ page }).include('[data-slot="home-browser"]').analyze();
      await writeFile(
        `${evidence}/${theme}-${width}-axe.json`,
        JSON.stringify(a11y.violations, null, 2),
      );
      assert.deepEqual(
        a11y.violations.filter((v) => ["serious", "critical"].includes(v.impact)),
        [],
      );
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    results.push({
      theme,
      result:
        "search, previews, read-only opens, recents, catalog, grid/table, paging and responsive browser passed",
    });
    await context.close();
  }
  const failureContext = await browser.newContext({ reducedMotion: "reduce" });
  const failurePage = await failureContext.newPage();
  const failSource = (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Source temporarily unavailable" }),
    });
  await failurePage.route("**/api/catalog/all", failSource);
  await failurePage.route("**/api/workspace/tree", failSource);
  await failurePage.goto(`${base}/#home&collection=catalog`);
  await expect(failurePage.getByText("Showing the bundled catalog", { exact: true })).toBeVisible();
  await expect(failurePage.locator('[data-slot="browser-result"]').first()).toBeVisible();
  await expect(
    failurePage.getByRole("button", { name: "Retry workspace", exact: true }),
  ).toBeVisible();
  await failurePage.unroute("**/api/catalog/all", failSource);
  await failurePage.getByRole("button", { name: "Retry catalog", exact: true }).click();
  await expect(failurePage.getByText("Showing the bundled catalog", { exact: true })).toHaveCount(
    0,
  );
  await failurePage.unroute("**/api/workspace/tree", failSource);
  await failurePage.getByRole("button", { name: "Retry workspace", exact: true }).click();
  await expect(
    failurePage.getByRole("button", { name: "Retry workspace", exact: true }),
  ).toHaveCount(0);
  results.push({
    result: "Source failures preserve bundled catalog; both retries recover under reduced motion",
  });
  await failureContext.close();
} finally {
  await writeFile(`${evidence}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  await rm(disk, { recursive: true, force: true });
}
console.log(results);
