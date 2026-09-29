/** Zoomed particles must reach both ends of the shipped Talend stream-ingestion route.
 * Uses its real SVG geometry and the production engine with a deterministic RAF clock.
 * The isolated canvas records draw coordinates, including portions panned off screen. */
/* global window, document, localStorage, performance, URL, process, console, getComputedStyle */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5451";
const browser = await chromium.launch();
const results = [];
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1100 },
      reducedMotion: "no-preference",
    });
    await context.addInitScript((theme) => {
      localStorage.setItem("brand-ui-theme", theme);
      performance.setResourceTimingBufferSize(10000);
    }, theme);
    const page = await context.newPage();
    const errors = [],
      writes = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (["PUT", "POST", "DELETE"].includes(request.method())) writes.push(request.url());
    });
    await page.goto(`${base}/#d/templates/qlik-talend-cloud-pipeline.yaml`);
    const edge = page.locator(
      '.react-flow__edge[data-id="streams->lakehouse"] path[data-slot="data-flow-edge"]',
    );
    await expect(edge).toBeAttached({ timeout: 30000 });
    await page.getByRole("button", { name: /^Edit/ }).click();
    await expect(page.locator(".monaco-editor textarea")).toBeVisible();
    const cameraZoom = () =>
      page
        .locator(".react-flow__viewport")
        .first()
        .evaluate((el) => new window.DOMMatrixReadOnly(getComputedStyle(el).transform).a);
    const before = await cameraZoom();
    for (let clicks = 0; (await cameraZoom()) < 1.5 && clicks < 15; clicks++) {
      await page.getByRole("button", { name: "Zoom in", exact: true }).click();
      await page.waitForTimeout(250);
    }
    assert.ok((await cameraZoom()) > before, "real zoom control changes the camera");
    const report = await edge.evaluate(async (source) => {
      const moduleUrl = performance
        .getEntriesByType("resource")
        .findLast((entry) => new URL(entry.name).pathname === "/src/particles/engine.ts")?.name;
      if (!moduleUrl) throw Error("Production particle engine was not loaded");
      const { startParticles, readParticleStats } = await import(moduleUrl);
      const length = source.getTotalLength();
      const checkpoints = Array.from({ length: 101 }, (_, i) =>
        source.getPointAtLength((length * i) / 100),
      );
      const bounds = source.getBBox();
      const pane = document.createElement("div");
      pane.style.cssText =
        "position:fixed;left:0;top:0;width:400px;height:400px;pointer-events:none;opacity:0";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const group = document.createElementNS(svg.namespaceURI, "g");
      group.classList.add("react-flow__edge");
      group.dataset.id = "completion-probe";
      const path = source.cloneNode(true);
      group.append(path);
      svg.append(group);
      const canvas = document.createElement("canvas");
      pane.append(svg, canvas);
      document.body.append(pane);
      const ctx = canvas.getContext("2d");
      const originalRaf = window.requestAnimationFrame;
      const originalCancel = window.cancelAnimationFrame;
      let queued = new Map(),
        nextId = 0;
      window.requestAnimationFrame = (callback) => {
        const id = ++nextId;
        queued.set(id, callback);
        return id;
      };
      window.cancelAnimationFrame = (id) => queued.delete(id);
      const cases = [];
      let stop;
      try {
        for (const zoom of [1, 2]) {
          for (const schedule of ["real-time", "hourly"]) {
            for (const direction of ["forward", "back", "both"]) {
              path.dataset.schedule = schedule;
              path.dataset.direction = direction;
              const coverage = [new Set(), new Set()];
              let drawIndex = 0,
                maxDraws = 0;
              const clear = ctx.clearRect.bind(ctx),
                translate = ctx.translate.bind(ctx);
              ctx.clearRect = (...args) => {
                maxDraws = Math.max(maxDraws, drawIndex);
                drawIndex = 0;
                clear(...args);
              };
              ctx.translate = (x, y) => {
                let closest = 0,
                  distance = Infinity;
                for (let i = 0; i < checkpoints.length; i++) {
                  const delta = (x - checkpoints[i].x) ** 2 + (y - checkpoints[i].y) ** 2;
                  if (delta < distance) {
                    distance = delta;
                    closest = i;
                  }
                }
                coverage[direction === "both" ? drawIndex % 2 : 0].add(closest);
                drawIndex++;
                translate(x, y);
              };
              stop = startParticles({
                canvas,
                pane,
                viewport: () => [-bounds.x * zoom, -bounds.y * zoom, zoom],
              });
              // Engine caps frame gaps at 64ms; 32ms ticks preserve time without wall-clock waiting.
              const duration = ((length * zoom) / 44) * 1000;
              for (let now = 1; now < duration * 2 + 12000; now += 32) {
                const callbacks = [...queued.values()];
                queued.clear();
                for (const callback of callbacks) callback(now);
              }
              const stats = readParticleStats(canvas);
              stop();
              stop = null;
              ctx.clearRect = clear;
              ctx.translate = translate;
              cases.push({
                zoom,
                schedule,
                direction,
                maxDraws,
                samples: stats.samples,
                coverage: coverage.slice(0, direction === "both" ? 2 : 1).map((bins) => ({
                  count: bins.size,
                  first: Math.min(...bins),
                  last: Math.max(...bins),
                })),
              });
            }
          }
        }
      } finally {
        stop?.();
        window.requestAnimationFrame = originalRaf;
        window.cancelAnimationFrame = originalCancel;
        pane.remove();
      }
      return { length, cases };
    });
    assert.ok(report.length > 500, "real routed stream edge is long enough to exercise the cap");
    for (const item of report.cases) {
      const label = `${theme}/${item.zoom}x/${item.schedule}/${item.direction}`;
      for (const [direction, coverage] of item.coverage.entries()) {
        assert.equal(coverage.first, 0, `${label}/${direction}: particles reach source`);
        assert.equal(coverage.last, 100, `${label}/${direction}: particles reach target`);
        assert.equal(coverage.count, 101, `${label}/${direction}: no untraversed route segment`);
      }
      assert.ok(item.maxDraws <= 12, `${label}: particle budget stays bounded`);
      assert.equal(item.samples, 1, `${label}: geometry sampled once`);
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, [], "reproduction does not change the template");
    results.push({ theme, zoomControl: await cameraZoom(), ...report });
    await context.close();
  }
  console.log(JSON.stringify({ results }, null, 2));
} finally {
  await browser.close();
}
