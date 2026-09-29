/** Split-browser navigation, scroll ownership and responsive regression. */
/* global window, document, localStorage, process, console, URL */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile, rm } from "node:fs/promises";
const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const { default: AxeBuilder } = require("@axe-core/playwright");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5461";
const evidence = process.env.HOME_EVIDENCE ?? "/tmp/atlas-home-explorer";
const folder = `explorer-proof-${process.pid}`;
const disk = new URL(`../workspace/${folder}/`, import.meta.url);
await mkdir(new URL("nested/deeper/", disk), { recursive: true });
await writeFile(
  new URL("nested/deeper/diagram.yaml", disk),
  'diagram: "1"\ntitle: Nested explorer fixture\nnodes:\n  - id: fixture\n    title: Fixture\n',
);
await Promise.all(
  Array.from({ length: 45 }, (_, i) =>
    mkdir(new URL(`folder-${String(i).padStart(2, "0")}/`, disk), { recursive: true }),
  ),
);
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript((theme) => localStorage.setItem("brand-ui-theme", theme), theme);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
    await page.goto(`${base}/#home&collection=catalog`);
    const home = page.locator('[data-slot="home-browser"]');
    const pane = home.locator('[data-slot="browser-results-scroll"]');
    const toolbar = home.locator('[data-slot="browser-toolbar"]');
    const crumbs = page.getByRole("navigation", { name: "Library breadcrumbs", exact: true });
    await expect(home.locator('[data-slot="browser-result"]').first()).toBeVisible();
    await expect(crumbs).toContainText("Catalog");
    await expect(home.getByRole("tablist")).toHaveCount(0);
    const toolbarBefore = await toolbar.boundingBox();
    for (const mode of ["Grid view", "Table view"]) {
      await home.getByRole("button", { name: mode, exact: true }).click();
      await pane.evaluate((el) => {
        el.scrollTop = 500;
      });
      await expect.poll(() => pane.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
      assert.equal(await page.evaluate(() => window.scrollY), 0);
      assert.ok(Math.abs((await toolbar.boundingBox()).y - toolbarBefore.y) < 1);
      await expect(crumbs).toBeInViewport();
      await expect(home.getByRole("button", { name: "Next page", exact: true })).toBeInViewport();
      if (mode === "Table view") {
        const header = await home.getByRole("rowgroup").first().boundingBox();
        const viewport = await pane.boundingBox();
        assert.ok(
          header.y >= viewport.y - 2 && header.y < viewport.y + 50,
          "Table header stays visible while rows scroll",
        );
      }
      await page.screenshot({
        path: `${evidence}/${theme}-${mode.split(" ")[0].toLowerCase()}.png`,
      });
    }
    await page.goto(
      `${base}/#home&collection=diagrams&folder=${encodeURIComponent(`${folder}/nested/deeper`)}`,
    );
    await expect(crumbs).toContainText("deeper");
    await expect(home.getByRole("treeitem", { name: "deeper", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(home.getByRole("treeitem", { name: "deeper", exact: true })).toBeInViewport();
    await expect(
      home.getByRole("link", { name: "Nested explorer fixture", exact: true }),
    ).toBeVisible();
    await crumbs.getByRole("link", { name: "nested", exact: true }).click();
    await expect(page).toHaveURL(/folder=.*nested(?:&|$)/);
    await page.goBack();
    await expect(home.getByRole("treeitem", { name: "deeper", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await crumbs.getByRole("button", { name: "Show parent folders", exact: true }).click();
    await page.getByRole("menuitem", { name: "Diagrams", exact: true }).click();
    await expect(page).not.toHaveURL(/folder=/);
    await page.goto(`${base}/#home&collection=catalog`);
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(home.getByRole("searchbox", { name: "Search library" })).toBeVisible();
      const bounds = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        vw: window.innerWidth,
        vh: window.innerHeight,
      }));
      assert.ok(
        bounds.width <= bounds.vw && bounds.height <= bounds.vh + 1,
        `No document overflow ${JSON.stringify(bounds)}`,
      );
      const a11y = await new AxeBuilder({ page }).include('[data-slot="home-browser"]').analyze();
      assert.deepEqual(
        a11y.violations.filter((v) => ["serious", "critical"].includes(v.impact)),
        [],
      );
      await page.screenshot({ path: `${evidence}/${theme}-${width}.png` });
    }
    await page.goto(
      `${base}/#home&collection=diagrams&folder=${encodeURIComponent(`${folder}/nested/deeper`)}`,
    );
    await expect(crumbs.getByText("deeper", { exact: true })).toBeInViewport();
    const currentCrumb = await crumbs.getByText("deeper", { exact: true }).boundingBox();
    assert.ok(
      currentCrumb.width > 20 && currentCrumb.x + currentCrumb.width <= 390,
      "Current folder remains readable on phones",
    );
    await crumbs.getByRole("button", { name: "Show parent folders", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "nested", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await home.getByRole("button", { name: "Browse library", exact: true }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("treeitem", { name: "Recent", exact: true })).toBeVisible();
    await sheet.getByRole("treeitem", { name: "Recent", exact: true }).click();
    await expect(sheet).toHaveCount(0);
    await expect(crumbs).toContainText("Recent");
    assert.deepEqual(errors, []);
    results.push({
      theme,
      result:
        "fixed controls, independently scrolling results, sticky table header, nested tree/breadcrumb history, mobile navigation and accessibility passed",
    });
    await context.close();
  }
} finally {
  await writeFile(`${evidence}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  await rm(disk, { recursive: true, force: true });
}
console.log(results);
