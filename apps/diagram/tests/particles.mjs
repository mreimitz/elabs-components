/** Actual technical canvas: animation is local, bounded and absent from exported pictures. */
/* global process, console, window, document, localStorage, performance, URL, getComputedStyle */
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5440";
const evidence = process.env.PARTICLE_EVIDENCE;
const folder = `particles-${process.pid}`;
const dir = new URL(`../workspace/${folder}/`, import.meta.url);
const source = `diagram: "1"
title: Flow cadence proof
direction: LR
nodes:
  - {id: a, title: Producer}
  - {id: b, title: Consumer}
  - {id: c, title: Request}
  - {id: d, title: Identity}
  - {id: e, title: Controller}
  - {id: f, title: Network}
  - {id: child, ref: ws/${folder}/child}
flows:
  - a -> b: {kind: data, schedule: real-time}
  - b <- c: {kind: request, schedule: hourly}
  - c <-> d: {kind: access, schedule: nightly}
  - d -> e: {kind: control, schedule: on-demand}
  - e -> f: {kind: network, schedule: custom}
  - f -> child: {schedule: hourly}
`;
const child =
  'diagram: "1"\ntitle: Inner flow\nnodes:\n  - {id: x, title: Inner source}\n  - {id: y, title: Inner target}\nflows:\n  - x -> y: {schedule: real-time}\n';
const browser = await chromium.launch();
const results = [],
  errors = [];
let page;
const poll = async (fn, label) => {
  const end = Date.now() + 25000;
  while (Date.now() < end) {
    if (await fn()) return;
    await setTimeout(40);
  }
  throw Error(`Timed out: ${label}`);
};
const canvas = () => page.locator('canvas[data-slot="flow-particles"]');
const stats = () =>
  page.evaluate(async () => {
    const { readParticleStats } = await window.moduleFor("/src/particles/engine.ts");
    return readParticleStats(document.querySelector('canvas[data-slot="flow-particles"]'));
  });
const ready = () =>
  poll(
    async () => (await canvas().count()) === 1 && (await stats())?.frames > 3,
    "single active canvas",
  );
const image = () =>
  page.evaluate(async () => {
    const { pictureOfCanvas, pngBlob } = await window.moduleFor("/src/io/export.ts");
    const picture = await pictureOfCanvas("Particle export proof");
    const { blob } = await pngBlob(picture, 1);
    return { svg: picture.svg, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) };
  });
try {
  await mkdir(dir, { recursive: true });
  if (evidence) await mkdir(evidence, { recursive: true });
  await writeFile(new URL("proof.yaml", dir), source);
  await writeFile(new URL("child.yaml", dir), child);
  for (const [theme, width] of [
    ["light", 1440],
    ["dark", 1440],
    ["light", 390],
    ["dark", 390],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "no-preference",
    });
    page = await context.newPage();
    const writes = [];
    await page.addInitScript((theme) => {
      localStorage.setItem("brand-ui-theme", theme);
      performance.setResourceTimingBufferSize(10000);
      const urls = new Map();
      window.moduleFor = (path) => {
        if (!urls.has(path))
          urls.set(
            path,
            performance
              .getEntriesByType("resource")
              .findLast((e) => new URL(e.name).pathname === path)?.name,
          );
        if (!urls.get(path)) throw Error(`Missing module ${path}`);
        return import(urls.get(path));
      };
    }, theme);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (["PUT", "POST", "DELETE"].includes(r.method()) && r.url().includes("/api/workspace/"))
        writes.push(r.url());
    });
    await page.goto(`${base}/#d/${folder}/proof.yaml`);
    await ready();
    assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
    const mounted = await canvas().evaluate((el) => ({
      parent: el.parentElement.className,
      next: el.nextElementSibling.className,
      export: el.dataset.diagramExport,
      pointer: getComputedStyle(el).pointerEvents,
      pixels: el
        .getContext("2d")
        .getImageData(0, 0, el.width, el.height)
        .data.some((v, i) => i % 4 === 3 && v > 0),
    }));
    assert.match(mounted.parent, /react-flow__viewport/);
    assert.match(mounted.next, /react-flow__nodes/);
    assert.equal(mounted.export, "exclude");
    assert.equal(mounted.pointer, "none");
    assert.equal(mounted.pixels, true);
    const sampleBefore = (await stats()).samples;
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await poll(async () => (await stats()).frames > 20, "frames after camera change");
    assert.equal((await stats()).samples, sampleBefore, "zoom does not resample paths");
    if (evidence) await page.screenshot({ path: `${evidence}/${theme}-${width}.png` });
    const picture = width === 1440 && theme === "light" ? await image() : null;
    await page.getByRole("button", { name: "Pause flow animation", exact: true }).click();
    await poll(async () => (await canvas().count()) === 0, "pause removes canvas/clock");
    if (picture) {
      const paused = await image();
      assert.equal(paused.svg.includes("flow-particles"), false);
      assert.deepEqual(
        paused.bytes,
        picture.bytes,
        "PNG pixels/encoding unchanged with particles enabled",
      );
    }
    await page.reload();
    await page.getByRole("button", { name: "Resume flow animation", exact: true }).waitFor();
    assert.equal(await canvas().count(), 0, "pause persists");
    await page.getByRole("button", { name: "Resume flow animation", exact: true }).click();
    await ready();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await poll(async () => (await canvas().count()) === 0, "live OS reduce");
    await page
      .getByRole("button", { name: "Flow animation off: reduced motion", exact: true })
      .waitFor();
    await page.evaluate(() => document.documentElement.setAttribute("data-motion-pref", "full"));
    await ready();
    await page.evaluate(() => document.documentElement.setAttribute("data-motion-pref", "reduced"));
    await poll(async () => (await canvas().count()) === 0, "root reduce overrides OS");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    assert.equal(await canvas().count(), 0, "root reduce persists after OS changes");
    await page.evaluate(() => document.documentElement.removeAttribute("data-motion-pref"));
    await ready();
    // Lens/navigation APIs are driven by real controls; no preparatory normalization toggle.
    if (width === 1440) {
      await page.getByRole("radio", { name: "Visual view (L)", exact: true }).click();
      await poll(async () => (await canvas().count()) === 0, "visual has no animation");
      await page.getByRole("radio", { name: "Technical view (L)", exact: true }).click();
      await ready();
    }
    await page.goto(`${base}/#d/${folder}/proof.yaml&into=child`);
    await ready();
    assert.equal(
      await canvas().evaluate((el) => !!el.closest('[data-slot="drill-down"]')),
      true,
      "child owns its canvas",
    );
    await page.goto(`${base}/#v/${folder}/proof.yaml`);
    await page.locator(".react-flow__node").first().waitFor({ state: "visible" });
    assert.equal(await canvas().count(), 0, "pure shared picture has no animation");
    assert.equal(await page.getByRole("button", { name: /flow animation/ }).count(), 0);
    assert.deepEqual(writes, []);
    assert.equal(await readFile(new URL("proof.yaml", dir), "utf8"), source);
    results.push(
      `${theme}/${width}: pixels, layering, zoom cache, pause persistence, root/OS motion, lens/drill/live, exports and zero writes`,
    );
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ results, errors }, null, 2));
} catch (error) {
  if (evidence && page && !page.isClosed())
    await page.screenshot({ path: `${evidence}/failure.png` }).catch(() => {});
  console.error(error);
  console.error({ results, errors });
  process.exitCode = 1;
} finally {
  await browser.close();
  await rm(dir, { recursive: true, force: true });
}
