/** Shell conflict and cleanup regressions for the shared live-view transport. */
/* global window, performance, URL, Event, process, console */
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.DIAGRAM_URL ?? "http://127.0.0.1:5425";
const evidence = process.env.LIVE_EVIDENCE;
const folder = `live-shell-${process.pid}`;
const root = new URL(`../workspace/${folder}/`, import.meta.url);
const source =
  'diagram: "1"\ntitle: Original\nnodes:\n  - id: a\n    type: service\n    title: Original node\n';
const file = `${folder}/editor.yaml`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [],
  thumbs = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.stack ?? e.message));
page.on("request", (r) => {
  if (r.method() === "POST" && r.url().includes("/thumb")) thumbs.push(r.url());
});
await page.addInitScript(() => {
  performance.setResourceTimingBufferSize(10000);
  const urls = new Map();
  window.moduleFor = (path) => {
    if (!urls.has(path))
      urls.set(
        path,
        performance.getEntriesByType("resource").findLast((e) => new URL(e.name).pathname === path)
          ?.name,
      );
    if (!urls.get(path)) throw Error(`Missing actual module ${path}`);
    return import(urls.get(path));
  };
});
const poll = async (fn, label) => {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    if (await fn()) return;
    await setTimeout(40);
  }
  throw Error(label);
};
const state = () =>
  page.evaluate(async () => {
    const { diagramStore } = await window.moduleFor("/src/state/diagram-store.ts");
    const { workspaceStore } = await window.moduleFor("/src/workspace/workspace-store.ts");
    return {
      text: diagramStore.get().text,
      path: diagramStore.get().path,
      ...workspaceStore.get(),
    };
  });
const unloadBlocked = () =>
  page.evaluate(() => !window.dispatchEvent(new Event("beforeunload", { cancelable: true })));
async function edit(comment) {
  const input = page.locator(".monaco-editor textarea");
  await input.focus();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText(`\n# ${comment}\n`);
  await poll(
    async () => (await state()).text.includes(comment) && (await state()).dirty,
    "real editor dirty",
  );
}
try {
  await mkdir(root, { recursive: true });
  await writeFile(new URL("editor.yaml", root), source);
  await writeFile(new URL("picture.yaml", root), source.replaceAll("Original", "Picture"));
  await page.goto(`${base}/#d/${file}`);
  await poll(
    async () =>
      (await state()).path === file && (await page.locator(".react-flow__node").count()) > 0,
    "editor fixture loaded",
  );
  await page.getByRole("button", { name: /^Edit/ }).click();
  await edit("Keep this local text");
  const external = source.replaceAll("Original", "External");
  await writeFile(new URL("editor.yaml", root), external);
  await page.getByRole("button", { name: "Reload", exact: true }).waitFor();
  assert.match((await state()).text, /Keep this local text/);
  assert.equal((await state()).conflict, true);
  await page.getByRole("button", { name: "Reload", exact: true }).click();
  await poll(
    async () => (await state()).text === external && !(await state()).dirty,
    "reload accepts external text",
  );
  checks.push("dirty shell SSE conflict preserves local text until explicit Reload");
  let failed = 0;
  await page.route("**/api/workspace/file?**", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    failed++;
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "test save failure" }),
    });
  });
  await edit("Unsaved failed transition");
  await page.evaluate((path) => {
    window.location.hash = `v/${path}`;
  }, `${folder}/picture.yaml`);
  await page.locator('[data-slot="live-canvas"][data-ready="true"]').waitFor();
  await poll(async () => failed > 0 && (await state()).save === "error", "cleanup save failure");
  assert.equal((await state()).dirty, true);
  assert.match((await state()).text, /Unsaved failed transition/);
  assert.equal(await unloadBlocked(), true);
  assert.equal(await page.locator("[data-sonner-toaster]").count(), 0);
  assert.equal(thumbs.length, 0);
  checks.push("failed cleanup save retains dirty memory and beforeunload protection in live view");
  await page.unroute("**/api/workspace/file?**");
  await page.evaluate((path) => {
    window.location.hash = `d/${path}`;
  }, file);
  await page.locator(".monaco-editor textarea").waitFor();
  assert.match((await state()).text, /Unsaved failed transition/);
  checks.push("return to editor retains failed-save text");
  await edit("Successful transition");
  await page.evaluate((path) => {
    window.location.hash = `v/${path}`;
  }, `${folder}/picture.yaml`);
  await page.locator('[data-slot="live-canvas"][data-ready="true"]').waitFor();
  await poll(
    async () =>
      (await readFile(new URL("editor.yaml", root), "utf8")).includes("Successful transition") &&
      !(await state()).dirty,
    "queued editor save persisted",
  );
  await setTimeout(1200);
  assert.equal(await unloadBlocked(), false);
  assert.equal(thumbs.length, 0);
  checks.push(
    "successful cleanup flush saves editor text without publishing live picture thumbnail",
  );
  assert.deepEqual(errors, []);
  if (evidence) {
    await mkdir(evidence, { recursive: true });
    await writeFile(
      `${evidence}/shell-results.json`,
      JSON.stringify({ checks, errors, thumbs }, null, 2),
    );
  }
  console.log(JSON.stringify({ checks, errors, thumbs }, null, 2));
} catch (error) {
  if (evidence) {
    await mkdir(evidence, { recursive: true });
    await page.screenshot({ path: `${evidence}/shell-failure.png` });
  }
  throw error;
} finally {
  await browser.close();
  await rm(root, { recursive: true, force: true });
}
