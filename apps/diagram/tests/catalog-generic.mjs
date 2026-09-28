/** Isolated MCP + live browser proof. Fixture files are unique and removed in finally. */
/* global window, performance, localStorage, location, URL, console, process, fetch, navigator */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5424";
const evidence = process.env.CATALOG_EVIDENCE;
if (evidence) await mkdir(evidence, { recursive: true });
const results = [],
  calls = [],
  errors = [];
const clean = [];
let id = 0;
async function rpc(method, params) {
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  assert.equal(response.ok, true);
  const value = await response.json();
  assert.equal(value.error, undefined, JSON.stringify(value));
  return value.result;
}
async function tool(name, args, failure = false) {
  const result = await rpc("tools/call", { name, arguments: args });
  const text = result.content?.find((item) => item.type === "text")?.text;
  calls.push({ name, arguments: args, result });
  assert.equal(result.isError === true, failure, text);
  return failure ? text : JSON.parse(text);
}
const digest = (text) => createHash("sha256").update(text).digest("hex");
const patch = (slug, extra = {}) => ({
  slug,
  name: "Generic analytics",
  description: "Analytics without a product icon.",
  docs: "",
  kind: "datastore",
  ...extra,
});
const browser = await chromium.launch();
try {
  await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "catalog-regression", version: "1" },
  });
  for (const theme of ["light", "dark"])
    for (const width of [1440, 390]) {
      const vendor = `catalog-proof-${process.pid}-${theme}-${width}`;
      const file = `${vendor}.yaml`;
      const disk = new URL(`../workspace/${file}`, import.meta.url);
      const catalog = new URL(`../catalog/${vendor}.yaml`, import.meta.url);
      const rejectedFile = new URL(`../catalog/${vendor}-invalid.yaml`, import.meta.url);
      clean.push(
        disk,
        catalog,
        rejectedFile,
        new URL(`../workspace/${vendor}.thumb.png`, import.meta.url),
      );
      const original =
        'diagram: "1"\ntitle: Generic catalog proof\nnodes:\n  - id: base\n    title: Original document\n';
      await tool("diagram_create", { path: file, text: original });
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        permissions: ["clipboard-read", "clipboard-write"],
      });
      await context.addInitScript((theme) => {
        localStorage.setItem("brand-ui-theme", theme);
        performance.setResourceTimingBufferSize(10000);
        window.catalogProofDocument = Math.random();
      }, theme);
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on("pageerror", (e) => errors.push(e.message));
      let documentRequests = 0;
      page.on("request", (r) => {
        if (r.resourceType() === "document") documentRequests++;
      });
      await page.goto(`${base}/#d/${file}`);
      const pane = page.locator('[data-lens-pane="technical"]');
      await expect(pane.locator('.react-flow__node[data-id="base"]')).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const initial = await page.evaluate(() => ({
        document: window.catalogProofDocument,
        stores: performance
          .getEntriesByType("resource")
          .filter((entry) => new URL(entry.name).pathname === "/src/state/diagram-store.ts")
          .map((entry) => entry.name),
      }));
      assert.equal(initial.stores.length, 1);
      const state = () =>
        page.evaluate(async (url) => (await import(url)).diagramStore.get(), initial.stores[0]);
      await expect.poll(async () => (await state()).path).toBe(file);
      assert.match(
        await tool("catalog_update", { vendor, entries: [patch("analytics")] }, true),
        /create_vendor/,
      );
      const rejected = await tool("catalog_update", {
        vendor: `${vendor}-invalid`,
        create_vendor: true,
        entries: [patch("bad", { icon: "fake/icon" })],
      });
      assert.equal(rejected.rejected.length, 1);
      await assert.rejects(readFile(rejectedFile), { code: "ENOENT" });
      const added = await tool("catalog_update", {
        vendor,
        create_vendor: true,
        entries: [patch("analytics")],
      });
      assert.deepEqual(added.written, ["analytics"]);
      const entry = await tool("catalog_get", { name: `${vendor}/analytics` });
      assert.equal(entry.generic, true);
      assert.equal(entry.icon, "lucide/database");
      assert.match(entry.yaml, new RegExp(`ref: catalog/${vendor}/analytics`));
      assert.equal((await tool("catalog_missing", { vendor })).missing[0].generic, true);
      assert.equal(
        (await tool("catalog_search", { query: "Generic analytics", vendor })).results[0].generic,
        true,
      );
      const read = await tool("diagram_read", { path: file });
      const yaml = `diagram: "1"\ntitle: Generic catalog proof\nnodes:\n  - id: reference\n    ref: catalog/${vendor}/analytics\n  - id: legacy\n    icon: ${vendor}/analytics\n    title: Legacy alias\n`;
      await tool("diagram_write", { path: file, base: read.mtime, text: yaml });
      await expect(pane.locator('.react-flow__node[data-id="reference"]')).toContainText(
        "Generic analytics",
      );
      await expect(pane.locator('.react-flow__node[data-id="legacy"]')).toContainText(
        "Legacy alias",
      );
      await expect(
        pane.locator('.react-flow__node[data-id="reference"] svg.lucide-database'),
      ).toBeVisible();
      await expect(
        pane.locator('.react-flow__node[data-id="legacy"] svg.lucide-database'),
      ).toBeVisible();
      await expect.poll(async () => (await state()).text).toBe(yaml);
      assert.equal(
        (await state()).compiled.issues.some((issue) => issue.code === "unknown-icon"),
        false,
      );
      const before = digest(await readFile(disk));
      await tool("catalog_update", {
        vendor,
        entries: [patch("analytics", { icon: "lucide/brain", name: "Live generic analytics" })],
      });
      await expect(pane.locator('.react-flow__node[data-id="reference"]')).toContainText(
        "Live generic analytics",
      );
      await expect(
        pane.locator('.react-flow__node[data-id="reference"] svg.lucide-brain'),
      ).toBeVisible();
      await expect(
        pane.locator('.react-flow__node[data-id="legacy"] svg.lucide-brain'),
      ).toBeVisible();
      assert.equal(digest(await readFile(disk)), before);
      await expect(page.locator('[data-slot="document-loading"]')).toHaveCount(0);
      const after = await page.evaluate(() => ({
        document: window.catalogProofDocument,
        stores: performance
          .getEntriesByType("resource")
          .filter((entry) => new URL(entry.name).pathname === "/src/state/diagram-store.ts")
          .map((entry) => entry.name),
      }));
      assert.deepEqual(
        after,
        initial,
        "New vendor membership must not reload or duplicate singleton modules",
      );
      assert.equal(documentRequests, 1);
      if (evidence) await page.screenshot({ path: `${evidence}/${theme}-${width}-diagram.png` });
      results.push({
        theme,
        width,
        check:
          "MCP create/update; live ref and legacy glyphs; exact YAML retained; one store and no reload",
        before,
      });
      await page.evaluate((hash) => {
        location.hash = hash;
      }, `#catalog/${vendor}`);
      const card = page.getByRole("link", { name: /Live generic analytics.*No product icon/ });
      await expect(card).toBeVisible();
      await card.focus();
      await page.keyboard.press("Enter");
      const detail = page.locator('[data-slot="entry-view"]');
      await expect(detail.getByRole("heading", { name: "Live generic analytics" })).toBeVisible();
      await expect(detail.getByText("No product icon", { exact: true })).toBeVisible();
      await expect(detail.locator("pre")).toContainText(`ref: catalog/${vendor}/analytics`);
      await detail.getByRole("button", { name: "Copy YAML", exact: true }).click();
      await expect(detail.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
      assert.match(
        await page.evaluate(() => navigator.clipboard.readText()),
        new RegExp(`ref: catalog/${vendor}/analytics`),
      );
      const box = await detail.boundingBox();
      assert.ok(box.width <= width);
      assert.equal(await detail.evaluate((el) => el.scrollWidth > el.clientWidth), false);
      if (width === 390) {
        const snippet = detail.getByRole("region", { name: "YAML snippet" });
        await snippet.focus();
        await page.keyboard.press("ArrowRight");
        await expect.poll(() => snippet.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      }
      const axe = await new AxeBuilder({ page }).include('[data-slot="entry-view"]').analyze();
      assert.deepEqual(axe.violations, []);
      if (evidence) await page.screenshot({ path: `${evidence}/${theme}-${width}-entry.png` });
      const bytes = await readFile(catalog, "utf8");
      await writeFile(catalog, bytes.replace("curated: false", "curated: true"));
      const curated = await readFile(catalog, "utf8");
      assert.deepEqual(
        (await tool("catalog_update", { vendor, entries: [patch("analytics")] })).skippedCurated,
        ["analytics"],
      );
      assert.equal(await readFile(catalog, "utf8"), curated);
      results.push({
        theme,
        width,
        check:
          "Catalog badge, keyboard entry, reference clipboard, phone containment, axe and curated bytes",
      });
      if (theme === "light" && width === 1440) {
        await page.evaluate((hash) => {
          location.hash = hash;
        }, `#d/${file}`);
        await expect(pane.locator('.react-flow__node[data-id="legacy"]')).toBeVisible();
        await page.getByRole("button", { name: "Edit", exact: true }).click();
        await pane.locator('.react-flow__node[data-id="legacy"]').click();
        const title = page
          .getByRole("form", { name: "Node", exact: true })
          .getByRole("textbox", { name: "Title", exact: true });
        await title.fill("Edited legacy alias");
        await title.press("Tab");
        await expect.poll(() => readFile(disk, "utf8")).toContain("Edited legacy alias");
        await page.getByRole("button", { name: "Present", exact: true }).click();
        await expect(page.getByRole("main", { name: "Diagram presentation" })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("button", { name: "Present", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Export", exact: true }).click();
        const download = page.waitForEvent("download");
        await page.getByRole("menuitem", { name: "SVG", exact: true }).click();
        const svg = await download;
        const svgText = await readFile(await svg.path(), "utf8");
        assert.match(svgText, /<svg/);
        assert.match(svgText, /Edited legacy alias/);
        assert.equal(documentRequests, 1);
        results.push({
          theme,
          width,
          check: "Local edit/autosave, presentation exit and SVG download",
          svgBytes: svgText.length,
        });
      }
      await context.close();
    }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks: results.length, results, errors }, null, 2));
} finally {
  await browser.close();
  await Promise.all(clean.map((file) => rm(file, { force: true })));
  if (evidence)
    await writeFile(
      `${evidence}/results.json`,
      JSON.stringify({ results, calls, errors }, null, 2),
    );
}
