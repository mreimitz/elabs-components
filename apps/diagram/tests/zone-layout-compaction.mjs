/** Compound zones remain compact without moving nodes outside their parent or detaching flows. */
/* global URL, process, console, localStorage, sessionStorage, performance, document, CSS, DOMMatrix, getComputedStyle */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5455";
const evidence = process.env.ZONE_LAYOUT_EVIDENCE;
const folder = `zone-compaction-${process.pid}`;
const dir = new URL(`../workspace/${folder}/`, import.meta.url);
const browser = await chromium.launch();
const results = [],
  errors = [];
let page;
async function geometry() {
  return page.evaluate(async () => {
    const moduleURL = performance
      .getEntriesByType("resource")
      .findLast((entry) => new URL(entry.name).pathname === "/src/state/diagram-store.ts")?.name;
    const { diagramStore } = await import(moduleURL ?? "/src/state/diagram-store.ts");
    const compiled = diagramStore.get().drawn.graph;
    const root = document.querySelector('[data-lens-pane="technical"]');
    const zoom = new DOMMatrix(
      getComputedStyle(root.querySelector(".react-flow__viewport")).transform,
    ).a;
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x / zoom, y: r.y / zoom, width: r.width / zoom, height: r.height / zoom };
    };
    const nodes = [...root.querySelectorAll(".react-flow__node")].map((el) => ({
      id: el.dataset.id,
      ...box(el),
      parent: compiled.nodes.find((n) => n.id === el.dataset.id)?.parentId,
    }));
    const labels = [...root.querySelectorAll('[data-slot="edge-label-cluster"]')].map((el) => ({
      text: el.textContent,
      ...box(el),
    }));
    const endpoints = [...root.querySelectorAll(".react-flow__edge")]
      .map((el) => {
        const edge = compiled.edges.find((e) => e.id === el.dataset.id),
          path = el.querySelector('[data-slot="data-flow-edge"]');
        if (!edge || !path) return null;
        const distances = [false, true].map((end) => {
          const p = path
            .getPointAtLength(end ? path.getTotalLength() : 0)
            .matrixTransform(path.getScreenCTM());
          const node = root.querySelector(
            `.react-flow__node[data-id="${CSS.escape(end ? edge.target : edge.source)}"]`,
          );
          if (!node) return null;
          // Zone endpoints float on their border; leaf endpoints meet a handle's outward face.
          const boxes = [node, ...node.querySelectorAll(".react-flow__handle")].map((el) =>
            el.getBoundingClientRect(),
          );
          return Math.min(
            ...boxes.map((b) => {
              const x = Math.min(b.right, Math.max(b.left, p.x)),
                y = Math.min(b.bottom, Math.max(b.top, p.y));
              if (p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom)
                return Math.min(p.x - b.left, b.right - p.x, p.y - b.top, b.bottom - p.y) / zoom;
              return Math.hypot(p.x - x, p.y - y) / zoom;
            }),
          );
        });
        return { id: edge.id, distances, routed: path.dataset.routed };
      })
      .filter(Boolean);
    return { nodes, labels, endpoints };
  });
}
function check(g, label) {
  const overlap = (a, b) =>
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 &&
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;
  for (const n of g.nodes) {
    const p = g.nodes.find((p) => p.id === n.parent);
    if (p)
      assert.ok(
        n.x >= p.x - 1 &&
          n.y >= p.y - 1 &&
          n.x + n.width <= p.x + p.width + 1 &&
          n.y + n.height <= p.y + p.height + 1,
        `${label}: ${n.id} contained by ${p.id}`,
      );
    for (const other of g.nodes)
      if (n.id < other.id && n.parent === other.parent)
        assert.ok(!overlap(n, other), `${label}: siblings ${n.id}/${other.id} overlap`);
  }
  const leaves = g.nodes.filter((n) => !g.nodes.some((child) => child.parent === n.id));
  const collisions = g.labels.flatMap((l) =>
    leaves.filter((n) => overlap(l, n)).map((n) => `${l.text}/${n.id}`),
  );
  assert.deepEqual(collisions, [], `${label}: labels clear leaf nodes`);
  for (const edge of g.endpoints)
    for (const d of edge.distances)
      if (d !== null) assert.ok(d < 8, `${label}: ${edge.id} endpoint misses node by ${d}`);
}
try {
  await mkdir(dir, { recursive: true });
  if (evidence) await mkdir(evidence, { recursive: true });
  const template = await readFile(
    new URL("../workspace/templates/qlik-cloud-customer-landscape.yaml", import.meta.url),
    "utf8",
  );
  for (const direction of ["LR", "TB"])
    await writeFile(
      new URL(`${direction}.yaml`, dir),
      template.replace(/^direction:.*$/m, `direction: ${direction}`),
    );
  for (const direction of ["LR", "TB"])
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width: 1800, height: 1100 },
        reducedMotion: "reduce",
      });
      await context.addInitScript((theme) => {
        performance.setResourceTimingBufferSize(10000);
        localStorage.setItem("brand-ui-theme", theme);
        sessionStorage.setItem("diagram-legend-open", "false");
      }, theme);
      page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${base}/#d/${folder}/${direction}.yaml`);
      await expect(
        page.locator(
          '[data-lens-pane="technical"] [data-slot="data-flow-edge"][data-routed="elk"]',
        ),
      ).not.toHaveCount(0);
      await expect
        .poll(async () => {
          const g = await geometry();
          const c = g.nodes.find((n) => n.id === "customer");
          return c?.height ?? 0;
        })
        .toBeGreaterThan(100);
      // Wait for two equal samples rather than capturing the first provisional fit.
      let previous = "";
      await expect
        .poll(async () => {
          const g = await geometry();
          const key = JSON.stringify(g.nodes);
          const equal = key === previous;
          previous = key;
          return equal;
        })
        .toBe(true);
      const initial = await geometry();
      check(initial, `${direction}/${theme}`);
      const customer = initial.nodes.find((n) => n.id === "customer"),
        onprem = initial.nodes.find((n) => n.id === "onprem"),
        azure = initial.nodes.find((n) => n.id === "azure");
      if (direction === "LR") {
        assert.ok(customer.height < 600, `Customer estate remains compact: ${customer.height}`);
        assert.ok(azure.y >= onprem.y - 1, "Azure no longer protrudes above data center");
        assert.ok(
          azure.y + azure.height <= onprem.y + onprem.height + 1,
          "Azure fits beside data center vertically",
        );
      }
      if (evidence) await page.screenshot({ path: `${evidence}/${direction}-${theme}.png` });
      await page.getByRole("button", { name: "Collapse all zones", exact: true }).click();
      await expect(
        page.locator('[data-lens-pane="technical"] .react-flow__node[data-id="gateway"]'),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Expand all zones", exact: true }).click();
      await expect(
        page.locator('[data-lens-pane="technical"] .react-flow__node[data-id="gateway"]'),
      ).toBeVisible();
      await expect
        .poll(async () => {
          try {
            check(await geometry(), "expanded");
            return true;
          } catch {
            return false;
          }
        })
        .toBe(true);
      await page.getByRole("button", { name: /^Edit/ }).click();
      await page.getByRole("button", { name: "Auto layout", exact: true }).click();
      await expect
        .poll(async () => {
          try {
            check(await geometry(), "relayout");
            return true;
          } catch {
            return false;
          }
        })
        .toBe(true);
      results.push({
        direction,
        theme,
        customer: { width: customer.width, height: customer.height },
        onprem,
        azure,
        paths: initial.endpoints.length,
      });
      await context.close();
    }
  for (const documentPath of [
    "templates/qlik-talend-cloud-pipeline.yaml",
    "examples/lakehouse-aws.yaml",
    "examples/qlik-cloud-data-gateway.yaml",
  ]) {
    const context = await browser.newContext({
      viewport: { width: 1800, height: 1100 },
      reducedMotion: "reduce",
    });
    page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/#d/${documentPath}`);
    await expect(
      page.locator('[data-lens-pane="technical"] [data-slot="data-flow-edge"][data-routed="elk"]'),
    ).not.toHaveCount(0);
    let previous = "";
    await expect
      .poll(async () => {
        const g = await geometry();
        const key = JSON.stringify(g.nodes);
        const equal = key === previous;
        previous = key;
        return equal;
      })
      .toBe(true);
    const g = await geometry();
    check(g, documentPath);
    if (evidence)
      await page.screenshot({ path: `${evidence}/${documentPath.split("/").pop()}.png` });
    results.push({ documentPath, paths: g.endpoints.length, nodes: g.nodes.length });
    await context.close();
  }
  assert.deepEqual(errors, []);
  if (evidence)
    await writeFile(`${evidence}/results.json`, JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify({ results, errors }, null, 2));
} catch (error) {
  if (evidence && page && !page.isClosed())
    await page.screenshot({ path: `${evidence}/failure.png` });
  throw error;
} finally {
  await browser.close();
  await rm(dir, { recursive: true, force: true });
}
