/** Browser regression for tab overflow and shell controls. Uses the isolated server at
 * DIAGRAM_URL (default :5410); TAB_EVIDENCE optionally records screenshots and results.
 * Opens shipped files without changing their contents. */
/* global window, document, localStorage, performance, getComputedStyle, URL, process, console */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5410";
const evidence = process.env.TAB_EVIDENCE;
if (evidence) await mkdir(evidence, { recursive: true });
const paths = [
  "components/qlik-cloud-tenant.yaml",
  "examples/clickhouse-cloud-stack.yaml",
  "examples/lakehouse-aws.yaml",
  "examples/qlik-cloud-data-gateway.yaml",
  "examples/qlik-sense-enterprise-onprem.yaml",
  "templates/qlik-talend-cloud-pipeline.yaml",
  "templates/qlik-cloud-customer-landscape.yaml",
];
const id = (path) => `doc-tab-${path.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
const browser = await chromium.launch();
const results = [];
const openPaths = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("atlas.shell.tabs")));
async function ready(page, path) {
  await expect
    .poll(() =>
      page
        .evaluate(async () => {
          const { workspaceStore } = await window.__tabModule("/src/workspace/workspace-store.ts");
          return workspaceStore.get().current?.path;
        })
        .catch((error) => {
          if (/Execution context was destroyed|Module is not loaded/.test(error.message))
            return null;
          throw error;
        }),
    )
    .toBe(path);
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveAttribute("id", id(path));
}
try {
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(
        ({ paths, theme }) => {
          localStorage.setItem("atlas.shell.tabs", JSON.stringify(paths));
          localStorage.setItem("brand-ui-theme", theme);
          window.__tabModule = async (path) => {
            const url = performance
              .getEntriesByType("resource")
              .filter((entry) => new URL(entry.name).pathname === path)
              .at(-1)?.name;
            if (!url) throw new Error(`Module is not loaded: ${path}`);
            return import(url);
          };
        },
        { paths, theme },
      );
      const page = await context.newPage();
      const errors = [],
        writes = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (["PUT", "POST", "DELETE"].includes(request.method())) writes.push(request.url());
      });
      await page.goto(`${base}/#d/${paths.at(-1)}`);
      await ready(page, paths.at(-1));
      const row = page.locator('[data-slot="doc-tabs"]');
      const toolbar = page.locator('[data-slot="diagram-toolbar"]');
      const tabs = row.getByRole("tab");
      await expect(tabs).toHaveCount(width === 1440 ? 3 : 1);
      const rowBox = await row.boundingBox(),
        toolbarBox = await toolbar.boundingBox();
      assert.ok(rowBox.y + rowBox.height <= toolbarBox.y + 1);
      await expect(row.locator('[data-slot="sidebar-trigger"]')).toHaveCount(1);
      await expect(row.getByRole("button", { name: "Theme", exact: true })).toHaveCount(1);
      await expect(toolbar.locator('[data-slot="sidebar-trigger"]')).toHaveCount(0);
      await expect(toolbar.getByRole("button", { name: "Theme", exact: true })).toHaveCount(0);
      assert.equal(await tabs.first().evaluate((el) => getComputedStyle(el).fontSize), "12px");
      assert.equal(await row.evaluate((el) => el.scrollWidth > el.clientWidth), false);
      const overflow = row.getByRole("button", { name: /^More open diagrams/ });
      const overflowBox = await overflow.boundingBox(),
        firstTabBox = await tabs.first().boundingBox();
      assert.ok(overflowBox.x + overflowBox.width <= firstTabBox.x);
      const visibleCount = await tabs.count();
      await overflow.click();
      const items = page.getByRole("menuitem");
      await expect(items).toHaveCount(paths.length - visibleCount);
      const chosen = await items.first().getAttribute("title");
      await items.first().click();
      await ready(page, chosen);
      await expect(page.locator(`#${id(chosen)}`)).toBeFocused();
      assert.equal((await openPaths(page)).length, paths.length);
      await overflow.click();
      await page.keyboard.press("Escape");
      await expect(overflow).toBeFocused();

      await page.locator('[role="tab"][aria-selected="true"]').focus();
      await page.keyboard.press("End");
      await expect(tabs.last()).toBeFocused();
      await page.keyboard.press("Home");
      await expect(tabs.first()).toBeFocused();
      await page.keyboard.press("ArrowLeft");
      await expect(tabs.last()).toBeFocused();
      const activated = await tabs.last().getAttribute("id");
      await page.keyboard.press("Enter");
      await ready(
        page,
        paths.find((path) => id(path) === activated),
      );
      // A failed save still opens the existing confirmation; cancelling returns focus.
      await page.evaluate(async () => {
        const { workspaceStore } = await window.__tabModule("/src/workspace/workspace-store.ts");
        workspaceStore.set({ save: "error" });
      });
      await page.keyboard.press("Delete");
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible();
      assert.equal((await openPaths(page)).length, paths.length);
      await dialog.getByRole("button", { name: "Keep it open", exact: true }).click();
      await expect(page.locator('[role="tab"][aria-selected="true"]')).toBeFocused();
      await page.evaluate(async () => {
        const { workspaceStore } = await window.__tabModule("/src/workspace/workspace-store.ts");
        workspaceStore.set({ save: "saved" });
      });

      await row.getByRole("button", { name: "Theme", exact: true }).click();
      const nextTheme = theme === "light" ? "Dark" : "Light";
      await page.getByRole("menuitemradio", { name: nextTheme, exact: true }).click();
      await expect
        .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
        .toBe(nextTheme.toLowerCase());
      await row.getByRole("button", { name: "Theme", exact: true }).click();
      await page
        .getByRole("menuitemradio", { name: theme === "light" ? "Light" : "Dark", exact: true })
        .click();
      await expect
        .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
        .toBe(theme);
      await page.waitForFunction(() => !document.documentElement.hasAttribute("data-vt"));
      const sidebar = row.locator('[data-slot="sidebar-trigger"]');
      const before = await sidebar.getAttribute("aria-expanded");
      await sidebar.click();
      await expect(sidebar).not.toHaveAttribute("aria-expanded", before);
      if (width === 390) {
        const sheet = page.getByRole("dialog");
        await expect(sheet).toBeVisible();
        await sheet.press("Escape");
      } else await sidebar.click();
      await expect(sidebar).toHaveAttribute("aria-expanded", before);
      if (evidence)
        await page.screenshot({
          path: `${evidence}/${theme}-${width}.png`,
          clip: { x: 0, y: 0, width, height: 230 },
        });
      // Shrinking/growing the actual shell always keeps the selected document visible.
      await page.setViewportSize({ width: width === 1440 ? 390 : 1440, height: 900 });
      await expect(tabs).toHaveCount(width === 1440 ? 1 : 3);
      await expect(page.locator('[role="tab"][aria-selected="true"]')).toBeVisible();
      await page.setViewportSize({ width, height: 900 });
      await expect(tabs).toHaveCount(width === 1440 ? 3 : 1);

      for (let remaining = paths.length; remaining > 0; remaining--) {
        const selected = page.locator('[role="tab"][aria-selected="true"]');
        await selected.focus();
        await page.keyboard.press("Delete");
        await expect.poll(async () => (await openPaths(page)).length).toBe(remaining - 1);
        if (remaining > 1) {
          await expect(page.locator('[role="tab"][aria-selected="true"]')).toBeFocused();
          const visible = await tabs.count();
          assert.ok(visible <= 3);
          await expect(overflow).toHaveCount(remaining - 1 > visible ? 1 : 0);
        }
      }
      await expect(row).toHaveCount(0);
      await expect(toolbar.getByRole("button", { name: "Theme", exact: true })).toBeVisible();
      await expect(toolbar.locator('[data-slot="sidebar-trigger"]')).toBeVisible();
      await expect(page.locator("#diagram-workspace")).toBeFocused();
      assert.deepEqual(errors, []);
      assert.deepEqual(writes, []);
      results.push({
        width,
        theme,
        order: true,
        overflowSelection: true,
        keyboard: true,
        closeConfirmation: true,
        responsive: true,
        globalControls: true,
        noWrites: true,
      });
      await context.close();
    }
  console.log(JSON.stringify({ result: "pass", results }, null, 2));
} finally {
  await browser.close();
  if (evidence) await writeFile(`${evidence}/results.json`, JSON.stringify(results, null, 2));
}
