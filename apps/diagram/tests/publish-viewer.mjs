/** Actual menu download followed by isolated file:// use, without authoring services. */
/* global document, window, localStorage, getComputedStyle, process, console */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Buffer } from "node:buffer";
import { pathToFileURL, URL } from "node:url";
import { gzipSync } from "node:zlib";
const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, firefox, webkit, expect } = require("@playwright/test");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5442";
const evidence = process.env.PUBLISH_EVIDENCE ?? (await mkdtemp(join(tmpdir(), "atlas-publish-")));
const folder = `publish-ui-${process.pid}`;
const fixture = new URL(`../workspace/${folder}/`, import.meta.url);
const attack = "</script><script>window.PUBLISH_PWNED=true</script>";
const source = `diagram: "1"
title: 'Published ${attack}'
description: Public description
notes: [{at: a, text: SECRET_NOTE_COLLECTION}]
metrics: {private: SECRET_ROOT_METRIC}
nodes:
  - {id: a, title: Start, description: 'Public ${attack}', docs: 'javascript:window.PUBLISH_PWNED=true', status: ok}
  - {id: b, title: Finish}
  - {id: t, ref: ws/${folder}/child}
  - {id: private-note, type: note, text: SECRET_NOTE_NODE}
flows:
  - {a -> b: {label: Public flow, schedule: continuous, step: 1}}
  - {b -> t.leaf: Import}
story:
  steps:
    - {title: Safe narrative, targets: [a], duration: 1, text: '**Public** <img src="https://example.invalid/private" onerror="window.PUBLISH_PWNED=true">'}
    - {title: Follow the flow, targets: ["a -> b"], duration: 1}
`;
const child =
  'diagram: "1"\ntitle: Embedded child\nnodes: [{id: leaf, title: Child leaf}, {id: private, type: note, text: SECRET_CHILD_NOTE}]\n';
const cases = [
  { path: "examples/lakehouse-aws.yaml", theme: "light", name: "lakehouse" },
  { path: "examples/clickhouse-cloud-stack.yaml", theme: "dark", name: "clickhouse" },
  { path: "templates/qlik-cloud-customer-landscape.yaml", theme: "qlik-dark", name: "qlik" },
  { path: `${folder}/root.yaml`, theme: "light", name: "adversarial" },
];
const results = [];
const errors = [];
const writes = [];
const technical = (page) => page.locator('[data-lens-pane="technical"]');
const graph = async (page) =>
  technical(page)
    .locator(".react-flow__node")
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => !node.className.includes("arch/note"))
        .map((node) => {
          const publicContent = node.cloneNode(true);
          // Removing private notes intentionally changes a zone's child count.
          publicContent
            .querySelectorAll('.sr-only,[data-slot="arch-zone-count"]')
            .forEach((item) => item.remove());
          return { id: node.dataset.id, text: publicContent.textContent };
        })
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
const visualPaint = (page) =>
  page.locator('[data-lens-pane="visual"]').evaluate((pane) => ({
    background: getComputedStyle(pane.querySelector(".bg-canvas")).backgroundColor,
    boxes: [...pane.querySelectorAll('[data-slot="capability-box"]')].map((box) => ({
      text: box.textContent,
      background: getComputedStyle(box).backgroundColor,
      color: getComputedStyle(box).color,
      hero: box.dataset.hero ?? null,
    })),
  }));
async function ready(page, lens = "technical") {
  const pane = page.locator(`[data-lens-pane="${lens}"]`);
  await expect(pane).toHaveCSS("opacity", "1");
  await expect(page.locator(`[data-lens-chrome="${lens}"]`)).toHaveCSS("visibility", "visible");
  await expect(
    page.locator(`[data-lens-chrome="${lens === "technical" ? "visual" : "technical"}"]`),
  ).toHaveCSS("visibility", "hidden");
  await expect(page.locator(`[data-lens-chrome="${lens}"]`)).not.toHaveAttribute("inert", "");
  await expect(pane.locator(".react-flow__node").first()).toBeVisible({ timeout: 20000 });
  await expect.poll(() => pane.locator(".react-flow__edge-path").count()).toBeGreaterThan(0);
}
await mkdir(evidence, { recursive: true });
await mkdir(fixture, { recursive: true });
await writeFile(new URL("root.yaml", fixture), source);
await writeFile(new URL("child.yaml", fixture), child);
const author = await chromium.launch();
try {
  for (const item of cases) {
    const context = await author.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(
      (theme) => localStorage.setItem("brand-ui-theme", theme),
      item.theme,
    );
    const page = await context.newPage();
    page.on("pageerror", (error) =>
      errors.push({ stage: "author", case: item.name, message: error.message }),
    );
    page.on("request", (request) => {
      if (["PUT", "POST", "DELETE", "PATCH"].includes(request.method())) writes.push(request.url());
    });
    await page.goto(`${base}/#d/${item.path}`);
    await ready(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", item.theme);
    item.graph = await graph(page);
    await page.screenshot({ path: join(evidence, `${item.name}-author.png`) });
    await page.getByRole("radio", { name: "Visual view (L)", exact: true }).click();
    await ready(page, "visual");
    item.visual = await visualPaint(page);
    await page.screenshot({ path: join(evidence, `${item.name}-author-visual.png`) });
    await page.getByRole("radio", { name: "Technical view (L)", exact: true }).click();
    await ready(page);
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await expect(page.getByText("Notes and metrics are excluded.", { exact: true })).toBeVisible();
    const downloading = page.waitForEvent("download", { timeout: 120000 });
    await page.getByRole("menuitem", { name: "Interactive HTML", exact: true }).click();
    const download = await downloading;
    item.file = join(evidence, `${item.name}.html`);
    await download.saveAs(item.file);
    const html = await readFile(item.file);
    item.raw = html.length;
    item.gzip = gzipSync(html).length;
    assert.ok(item.gzip <= 3 * 1024 * 1024, `${item.name} exceeds the 3MiB gzip budget`);
    assert.ok(!html.includes(Buffer.from("SECRET_")), "Private data entered the HTML");
    assert.ok(
      !html.includes(Buffer.from(["", "Users", ""].join("/"))),
      "Machine path entered the HTML",
    );
    await context.close();
  }
  await author.close();
  for (const [engineName, engine] of Object.entries({ chromium, firefox, webkit }).filter(
    ([name]) =>
      !process.env.PUBLISH_ENGINES || process.env.PUBLISH_ENGINES.split(",").includes(name),
  )) {
    const browser = await engine.launch();
    try {
      for (const item of cases) {
        for (const width of [1440, 390]) {
          const context = await browser.newContext({
            viewport: { width, height: 900 },
            reducedMotion:
              item.name === "adversarial" && width === 1440 ? "no-preference" : "reduce",
            ...(engineName === "chromium" && item.name === "adversarial" && width === 1440
              ? { recordVideo: { dir: evidence } }
              : {}),
          });
          const page = await context.newPage();
          const attempted = [];
          page.on("pageerror", (error) =>
            errors.push({ engineName, case: item.name, width, message: error.message }),
          );
          page.on("console", (message) => {
            if (message.type() === "error")
              errors.push({ engineName, case: item.name, width, message: message.text() });
          });
          const url = pathToFileURL(item.file).href;
          page.on("request", (request) => {
            if (request.url() !== url && !request.url().startsWith("data:"))
              attempted.push(request.url());
          });
          await page.goto(url);
          await ready(page);
          await expect(page.locator("html")).toHaveAttribute("data-theme", item.theme);
          assert.equal(await page.locator('.monaco-editor,[data-slot="doc-tabs"]').count(), 0);
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
            false,
          );
          if (item.name !== "adversarial")
            assert.deepEqual(
              await graph(page),
              item.graph,
              `${item.name} public node content differs`,
            );
          const viewport = technical(page).locator(".react-flow__viewport");
          const before = await viewport.getAttribute("style");
          await page.getByRole("button", { name: /zoom in/i }).click();
          await expect.poll(() => viewport.getAttribute("style")).not.toBe(before);
          await page.getByRole("radio", { name: "Visual", exact: true }).click();
          await ready(page, "visual");
          if (item.name !== "adversarial" && engineName === "chromium")
            assert.deepEqual(
              await visualPaint(page),
              item.visual,
              `${item.name} fixed profile paint differs`,
            );
          await page.screenshot({
            path: join(evidence, `${item.name}-${engineName}-${width}-visual.png`),
          });
          await page.getByRole("radio", { name: "Technical", exact: true }).click();
          await ready(page);
          await page.getByRole("button", { name: "Legend", exact: true }).click();
          await expect(page.locator('[data-slot="diagram-legend"]')).toBeVisible();
          if (item.name === "adversarial") {
            assert.equal(await page.evaluate(() => window.PUBLISH_PWNED), undefined);
            assert.equal(await technical(page).locator('[data-id="private-note"]').count(), 0);
            const walk = page.getByRole("button", { name: "Walk through 2 steps", exact: true });
            await walk.click();
            await expect(page.getByText("Safe narrative", { exact: true })).toBeVisible();
            await page.getByRole("button", { name: "Next step", exact: true }).click();
            await expect(page.getByText("Follow the flow", { exact: true })).toBeVisible();
            await page.getByRole("button", { name: "End story", exact: true }).click();
            const composite = technical(page).locator('.react-flow__node[data-id="t"]');
            await expect(composite).toBeVisible();
            await composite.focus();
            await page.keyboard.press("Enter");
            await expect(
              page.locator('[data-slot="drill-canvas"] .react-flow__node[data-id="leaf"]'),
            ).toBeVisible();
            await page.keyboard.press("Escape");
            await expect(page).not.toHaveURL(/into=/);
            assert.equal(await page.evaluate(() => window.PUBLISH_PWNED), undefined);
          }
          await page.screenshot({
            path: join(evidence, `${item.name}-${engineName}-${width}.png`),
          });
          assert.deepEqual(attempted, [], `${item.name} attempted offline requests`);
          results.push({ engineName, name: item.name, width, raw: item.raw, gzip: item.gzip });
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }
  }
  assert.deepEqual(errors, [], "Browser errors");
  assert.deepEqual(writes, [], "Publishing wrote workspace data");
  assert.equal(await readFile(new URL("root.yaml", fixture), "utf8"), source);
  assert.equal(await readFile(new URL("child.yaml", fixture), "utf8"), child);
  console.log(JSON.stringify({ results, errors, writes }, null, 2));
} finally {
  await author.close();
  await writeFile(
    join(evidence, "results.json"),
    JSON.stringify({ results, errors, writes }, null, 2),
  );
  await rm(fixture, { recursive: true, force: true });
}
