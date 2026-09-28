/** Viewer-only stories: real keyboard, camera, inline expansion, links and unchanged sources. */
/* global process, console, window, performance, URL, localStorage, location */
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5431";
const evidence = process.env.STORY_EVIDENCE;
const folder = `story-ui-${process.pid}`;
const dir = new URL(`../workspace/${folder}/`, import.meta.url);
const child = 'diagram: "1"\ntitle: Story child\nnodes:\n  - id: leaf\n    title: Inner leaf\n';
const source = `diagram: "1"
title: Story proof
zones:
  - id: z
    title: Source group
    children:
      - {id: a, title: Source}
      - {id: b, title: Destination}
nodes:
  - {id: outside, title: Other}
  - id: tenant
    ref: ws/${folder}/child
flows:
  - from: a
    to: b
    label: Main path
  - from: b
    to: tenant.leaf
    label: Import
story:
  steps:
    - title: A focused introduction
      targets: [z]
      duration: 1
      text: "**Readable** caption with [docs](https://example.com)."
      callouts:
        - at: a
          text: First numbered callout
    - title: Follow the main path
      targets: ["a -> b"]
      duration: 1
    - title: Follow both paths
      targets: ["a -> b", "b -> tenant.leaf"]
      duration: 1
    - title: Reveal a referenced child
      targets: [tenant]
      duration: 1
    - title: Mixed targets fit together
      targets: [a, "b -> tenant.leaf"]
      duration: 1
    - title: Last step
      targets: [b]
      duration: 1
`;
const browser = await chromium.launch();
const results = [],
  errors = [];
let page;
const poll = async (predicate, label) => {
  const end = Date.now() + 25000;
  while (Date.now() < end) {
    if (await predicate()) return;
    await setTimeout(40);
  }
  throw Error(`Timed out: ${label}`);
};
const story = () =>
  page.evaluate(async () => {
    const { storyStore } = await window.moduleFor("/src/story/story-store.ts");
    const s = storyStore.get();
    return { index: s.index, progress: s.progress, playing: s.playing, camera: s.camera };
  });
const state = () =>
  page.evaluate(async () => {
    const { diagramStore } = await window.moduleFor("/src/state/diagram-store.ts");
    const s = diagramStore.get();
    return { text: s.text, path: s.path, load: s.loadCount };
  });
const node = (id) =>
  page.locator(`[data-lens-pane="technical"] .react-flow__node[data-id="${id}"]`).first();
try {
  await mkdir(dir, { recursive: true });
  if (evidence) await mkdir(evidence, { recursive: true });
  await writeFile(new URL("child.yaml", dir), child);
  const cases = process.env.STORY_MOTION
    ? [["light", 1440]]
    : [
        ["light", 1440],
        ["dark", 1440],
        ["light", 390],
        ["dark", 390],
      ];
  for (const [theme, width] of cases) {
    const path = `${folder}/${theme}-${width}.yaml`;
    await writeFile(new URL(`${theme}-${width}.yaml`, dir), source);
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: process.env.STORY_MOTION ? "no-preference" : "reduce",
      ...(process.env.STORY_MOTION && evidence
        ? { recordVideo: { dir: evidence, size: { width: 1440, height: 900 } } }
        : {}),
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
        if (!urls.get(path)) throw Error(`Missing ${path}`);
        return import(urls.get(path));
      };
    }, theme);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (["PUT", "POST", "DELETE"].includes(r.method()) && r.url().includes("/api/workspace/"))
        writes.push(r.url());
    });
    await page.goto(`${base}/#d/${path}`);
    await page.getByRole("button", { name: "Walk through 6 steps", exact: true }).waitFor();
    await node("a").waitFor({ state: "visible" });
    const before = await state();
    await page.getByRole("button", { name: "Walk through 6 steps", exact: true }).click();
    await page.getByText("A focused introduction", { exact: true }).waitFor();
    assert.equal((await story()).playing, false, "opening a story never autoplays");
    assert.match(page.url(), /step=1/);
    await poll(
      () =>
        node("outside")
          .getAttribute("data-dimmed")
          .then((v) => v === "true"),
      "node dimming",
    );
    assert.equal(await node("a").getAttribute("data-dimmed"), null);
    assert.equal(
      await node("b").getAttribute("data-dimmed"),
      null,
      "whole-zone descendants stay lit",
    );
    await page.getByRole("link", { name: "docs", exact: true }).waitFor();
    if (evidence) await page.screenshot({ path: `${evidence}/${theme}-${width}-caption.png` });
    results.push(`${theme}/${width}: start, readable caption, callout, dimming`);
    await page.getByRole("button", { name: "Next step", exact: true }).click();
    await poll(async () => (await story()).index === 1, "next step");
    const cameraBefore = await page
      .locator('[data-lens-pane="technical"] .react-flow__viewport')
      .evaluate((el) => el.style.transform);
    const slider = page.getByRole("slider", { name: "Step progress", exact: true });
    await slider.focus();
    await page.keyboard.press("End");
    await poll(async () => (await story()).progress === 1, "native scrub End");
    assert.equal((await story()).index, 1, "slider End does not move story step");
    await page
      .locator(
        '[data-lens-pane="technical"] [data-story-camera-ready="true"][data-story-camera-step="story:1"]',
      )
      .waitFor();
    const earlySeek = await page
      .locator('[data-lens-pane="technical"] .react-flow__viewport')
      .evaluate((el) => el.style.transform);
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("End");
    await poll(
      async () =>
        (await page
          .locator('[data-lens-pane="technical"] .react-flow__viewport')
          .evaluate((el) => el.style.transform)) === earlySeek,
      "early seek applies latest progress when fit settles",
    );
    if (process.env.STORY_MOTION)
      await poll(
        async () =>
          (await page
            .locator('[data-lens-pane="technical"] .react-flow__viewport')
            .evaluate((el) => el.style.transform)) !== cameraBefore,
        "actual flow-follow viewport movement",
      );
    await page.getByRole("button", { name: "Next step", exact: true }).click();
    await node("tenant.leaf").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Next step", exact: true }).click();
    await poll(async () => (await story()).index === 3, "composite step");
    await poll(
      async () => (await node("tenant.leaf").getAttribute("data-dimmed")) === null,
      "whole composite descendant lit",
    );
    await page
      .locator(
        '[data-lens-pane="technical"] [data-story-camera-ready="true"][data-story-camera-step="story:3"]',
      )
      .waitFor();
    const bounds = await node("tenant").boundingBox();
    assert.ok(
      bounds.x >= 0 && bounds.x + bounds.width <= width + 1,
      "expanded composite fits phone width",
    );
    assert.equal((await state()).text, source);
    await page.getByRole("button", { name: "Next step", exact: true }).click();
    await page.getByRole("button", { name: "Next step", exact: true }).focus();
    await page.keyboard.press("End");
    await poll(async () => (await story()).index === 5, "story End key");
    await page.getByRole("button", { name: "Play story", exact: true }).click();
    await poll(
      async () => !(await story()).playing && (await story()).progress === 1,
      "stop at final step",
    );
    await page.getByRole("button", { name: "End story", exact: true }).click();
    await poll(async () => !(await node("tenant.leaf").count()), "temporary expansion restored");
    assert.deepEqual(await state(), before);
    assert.equal(writes.length, 0);
    results.push(
      `${theme}/${width}: native scrub, step keys, temporary expansion, final stop, no writes`,
    );
    await page.getByRole("button", { name: "Walk through 6 steps", exact: true }).click();
    await page.getByRole("button", { name: "Play story", exact: true }).click();
    const pane = page.locator('[data-lens-pane="technical"] .react-flow__pane');
    await pane.click({ position: { x: 30, y: 300 } });
    await poll(
      async () => !(await story()).playing && !(await story()).camera,
      "manual camera cancels playback",
    );
    await page.getByRole("button", { name: "End story", exact: true }).click();
    await page.evaluate(() => {
      location.hash += "&lens=visual";
    });
    await page
      .getByRole("button", { name: "Play story in technical view", exact: true })
      .waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Play story in technical view", exact: true }).click();
    await poll(async () => (await story()).playing, "explicit technical play");
    await page.getByRole("button", { name: "Pause story", exact: true }).click();
    await page.getByRole("button", { name: "Present story", exact: true }).click();
    await page.getByRole("button", { name: "End story", exact: true }).focus();
    await page.keyboard.press("Escape");
    await poll(async () => (await story()).index === null, "Escape ends story first");
    assert.match(page.url(), /present/);
    await page.getByRole("button", { name: "Exit presentation", exact: true }).click();
    await poll(async () => !page.url().includes("&present"), "presentation exit");
    assert.equal((await state()).text, source);
    assert.equal(writes.length, 0);
    results.push(`${theme}/${width}: gesture cancel, visual opt-in, presentation Escape hierarchy`);
    await page.goto(`${base}/#d/${path}&step=4`);
    await node("tenant.leaf").waitFor({ state: "visible" });
    await poll(async () => (await story()).index === 3, "one-based deep link");
    await writeFile(
      new URL(`${theme}-${width}.yaml`, dir),
      source.replace("A focused introduction", "Updated source title"),
    );
    await poll(
      async () => (await state()).text.includes("Updated source title"),
      "live source update",
    );
    assert.equal((await story()).index, null, "source revision stops story");
    await page.goto(`${base}/#v/${path}`);
    await page.locator('[data-slot="live-view"]').waitFor();
    assert.equal(await page.getByRole("region", { name: "Story", exact: true }).count(), 0);
    results.push(`${theme}/${width}: deep link, source invalidation, inert shared view`);
    await context.close();
    assert.equal(await readFile(new URL("child.yaml", dir), "utf8"), child);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ results, errors }, null, 2));
} catch (error) {
  if (evidence && page && !page.isClosed())
    await page.screenshot({ path: `${evidence}/failure.png` }).catch(() => {});
  console.error(JSON.stringify({ results, errors }, null, 2));
  throw error;
} finally {
  await browser.close();
  await rm(dir, { recursive: true, force: true });
}
