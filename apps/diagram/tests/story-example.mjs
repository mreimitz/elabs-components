/** Record the real six-step ClickHouse story with normal camera motion and unchanged bytes. */
/* global process, console, performance, URL, localStorage */
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5431";
const evidence = process.env.STORY_EVIDENCE;
const file = new URL("../workspace/examples/clickhouse-cloud-stack.yaml", import.meta.url);
const before = await readFile(file, "utf8");
if (evidence) await mkdir(evidence, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "no-preference",
  ...(evidence ? { recordVideo: { dir: evidence, size: { width: 1440, height: 1000 } } } : {}),
});
const page = await context.newPage();
const errors = [],
  writes = [];
await page.addInitScript(() => {
  localStorage.setItem("brand-ui-theme", "light");
  performance.setResourceTimingBufferSize(10000);
});
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (["PUT", "POST", "DELETE"].includes(r.method()) && r.url().includes("/api/workspace/"))
    writes.push(r.url());
});
const poll = async (fn) => {
  const until = Date.now() + 30000;
  while (Date.now() < until) {
    if (await fn()) return;
    await setTimeout(40);
  }
  throw Error("Example story did not reach expected state");
};
try {
  await page.goto(`${base}/#d/examples/clickhouse-cloud-stack.yaml`);
  await page.getByRole("button", { name: "Walk through 6 steps", exact: true }).click();
  const moduleURL = await page.evaluate(
    () =>
      performance
        .getEntriesByType("resource")
        .findLast((e) => new URL(e.name).pathname === "/src/story/story-store.ts")?.name,
  );
  assert.ok(moduleURL);
  const snapshot = () =>
    page.evaluate(async (url) => {
      const { storyStore } = await import(url);
      const s = storyStore.get();
      return {
        index: s.index,
        progress: s.progress,
        playing: s.playing,
        title: s.index === null ? null : s.story.steps[s.index].title,
      };
    }, moduleURL);
  const frames = [];
  for (let index = 0; index < 6; index++) {
    await poll(async () => (await snapshot()).index === index);
    await page.locator('[data-lens-pane="technical"] [data-story-camera-ready="true"]').waitFor();
    await page.getByRole("button", { name: "Play story", exact: true }).click();
    await poll(async () => (await snapshot()).progress >= 0.15);
    const first = await page
      .locator('[data-lens-pane="technical"] .react-flow__viewport')
      .evaluate((el) => el.style.transform);
    await poll(async () => (await snapshot()).progress >= 0.35);
    const last = await page
      .locator('[data-lens-pane="technical"] .react-flow__viewport')
      .evaluate((el) => el.style.transform);
    await page.getByRole("button", { name: "Pause story", exact: true }).click();
    const snap = await snapshot();
    frames.push({ ...snap, moved: first !== last });
    if ([1, 2, 3, 5].includes(index))
      assert.notEqual(first, last, `step${index + 1} follows the real routed flow`);
    if (evidence) await page.screenshot({ path: `${evidence}/step-${index + 1}.png` });
    if (index < 5) await page.getByRole("button", { name: "Next step", exact: true }).click();
  }
  await page.getByRole("button", { name: "End story", exact: true }).click();
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  assert.equal(await readFile(file, "utf8"), before);
  console.log(JSON.stringify({ frames, errors, writes, sourceUnchanged: true }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
