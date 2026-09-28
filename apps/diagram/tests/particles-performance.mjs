/** Real 60-edge canvas: warm-up separated from measured CPU work and actual frame cadence. */
/* global process, console, window, document, performance, URL, requestAnimationFrame */
import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5440";
const folder = `particles-perf-${process.pid}`;
const dir = process.env.PARTICLE_WORKSPACE
  ? new URL(`file://${process.env.PARTICLE_WORKSPACE}/${folder}/`)
  : new URL(`../workspace/${folder}/`, import.meta.url);
const kinds = ["data", "request", "access", "control", "network"];
const nodes = Array.from({ length: 6 }, (_, r) => [
  `  - {id: a${r}, title: Source ${r}, position: {x: 0, y: ${r * 130}}}`,
  `  - {id: b${r}, title: Target ${r}, position: {x: 1000, y: ${r * 130}}}`,
]).flat();
const flows = Array.from(
  { length: 60 },
  (_, i) =>
    `  - a${i % 6} ${i % 3 === 0 ? "<->" : i % 3 === 1 ? "<-" : "->"} b${i % 6}: {kind: ${kinds[i % 5]}, schedule: real-time}`,
);
const source = [
  'diagram: "1"',
  "title: Sixty visible flows",
  "layout: manual",
  "nodes:",
  ...nodes,
  "flows:",
  ...flows,
  "",
].join("\n");
const browser = await chromium.launch();
let page;
try {
  await mkdir(dir, { recursive: true });
  await writeFile(new URL("sixty.yaml", dir), source);
  page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: "no-preference",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => performance.setResourceTimingBufferSize(10000));
  await page.goto(`${base}/#d/${folder}/sixty.yaml`);
  await page.locator('canvas[data-slot="flow-particles"]').waitFor();
  const report = await page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .findLast((e) => new URL(e.name).pathname === "/src/particles/engine.ts")?.name;
    const { readParticleStats } = await import(url);
    const canvas = document.querySelector('canvas[data-slot="flow-particles"]');
    const wait = (ms) =>
      new Promise((resolve) => {
        const start = performance.now();
        const tick = (now) => (now - start >= ms ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      });
    await wait(2000);
    const before = readParticleStats(canvas);
    const start = performance.now();
    await wait(5000);
    const elapsed = performance.now() - start;
    const after = readParticleStats(canvas);
    const timings = after.timings.slice(before.frames).sort((a, b) => a - b);
    return {
      userAgent: window.navigator.userAgent,
      dpr: window.devicePixelRatio,
      viewport: [window.innerWidth, window.innerHeight],
      warmupMs: 2000,
      measureMs: elapsed,
      frames: after.frames - before.frames,
      fps: (after.frames - before.frames) / (elapsed / 1000),
      visibleEdges: after.visibleEdges,
      cachedEdges: after.cachedEdges,
      draws: after.draws,
      samples: after.samples,
      timings: {
        count: timings.length,
        p50: timings[Math.floor(timings.length * 0.5)],
        p95: timings[Math.floor(timings.length * 0.95)],
        max: timings.at(-1),
      },
    };
  });
  assert.equal(report.visibleEdges, 60);
  assert.equal(report.cachedEdges, 60);
  assert.ok(report.draws >= 60);
  assert.ok(report.timings.count >= 200);
  assert.ok(report.timings.p95 <= 4);
  assert.ok(report.fps >= 45);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ report, errors }, null, 2));
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
  await rm(dir, { recursive: true, force: true });
}
