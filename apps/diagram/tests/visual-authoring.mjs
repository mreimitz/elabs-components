/** Authored projection, materialization and read-only browser regression. */
/* global window, document, performance, localStorage, URL, process, console */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5441";
const evidence = process.env.VISUAL_EVIDENCE;
if (evidence) await mkdir(evidence, { recursive: true });
const name = `visual-authoring-${process.pid}.yaml`;
const file = new URL(`../workspace/${name}`, import.meta.url);
const original =
  'diagram: "1"\ntitle: Visual authoring check\n# Preserve this comment\nnodes: [{id: source, title: Source}, {id: target, title: Target}]\nflows: [source -> target]\n';
const browser = await chromium.launch();
const results = [],
  errors = [];
async function state(page) {
  return page.evaluate(async () => {
    const { diagramStore } = await window.__visualModule("/src/state/diagram-store.ts");
    const { lensStore } = await window.__visualModule("/src/shell/lens-store.ts");
    const d = diagramStore.get();
    return { text: d.text, path: d.path, ok: d.compiled.ok, lens: lensStore.get() };
  });
}
try {
  await writeFile(file, original);
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript((theme) => {
      localStorage.setItem("brand-ui-theme", theme);
      performance.setResourceTimingBufferSize(10000);
      window.__visualModule = (path) => {
        const url = performance
          .getEntriesByType("resource")
          .findLast((r) => new URL(r.name).pathname === path)?.name;
        if (!url) throw new Error(`Missing module ${path}`);
        return import(url);
      };
    }, theme);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/#d/${name}`);
    await expect.poll(async () => (await state(page)).path).toBe(name);
    await expect(page.getByRole("button", { name: "Visual layout", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: /^Edit/ }).click();
    await page.getByRole("button", { name: "Visual layout", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Save a visual layout" })).toBeVisible();
    assert.equal((await state(page)).text, original);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal((await state(page)).text, original);
    await page.getByRole("button", { name: "Visual layout", exact: true }).click();
    await dialog.getByRole("button", { name: "Apply layout", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(async () => (await state(page)).text.includes("visual:")).toBe(true);
    const applied = (await state(page)).text;
    assert(applied.includes("# Preserve this comment"));
    await expect.poll(async () => (await state(page)).ok).toBe(true);
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(async () => (await state(page)).text).toBe(original);
    await page.getByRole("button", { name: /^Done/ }).click();
    // The two authored templates previously ignored their visual blocks entirely.
    for (const path of [
      "templates/qlik-cloud-customer-landscape.yaml",
      "templates/qlik-talend-cloud-pipeline.yaml",
    ]) {
      await page.goto(`${base}/#d/${path}`);
      await expect.poll(async () => (await state(page)).path).toBe(path);
      await page.evaluate(async () => {
        const { lensActions } = await window.__visualModule("/src/shell/lens-store.ts");
        lensActions.setLens("visual");
      });
      await expect
        .poll(async () => {
          const s = await state(page);
          return s.lens.position === 1 && !s.lens.animating;
        })
        .toBe(true);
      await expect(
        page.locator('[data-lens-pane="visual"] [data-slot="capability-box"]').first(),
      ).toBeVisible();
      const projection = await page.evaluate(async () => {
        const { diagramStore } = await window.__visualModule("/src/state/diagram-store.ts");
        const { visualSnapshot } = await window.__visualModule("/src/visual/snapshot.ts");
        const ast = diagramStore.get().compiled.ast;
        const lens = visualSnapshot(ast).lens;
        return {
          authored: ast.visual.boxes.map((b) => b.title),
          boxes: lens.boxes.map((b) => b.title),
          controls: lens.boxes.filter((b) => b.controlPlane).length,
          rendered: document.querySelectorAll(
            '[data-lens-pane="visual"] [data-slot="capability-box"]',
          ).length,
        };
      });
      for (const title of projection.authored) assert(projection.boxes.includes(title));
      assert(projection.rendered > 0, JSON.stringify(projection));
      if (evidence)
        await page.screenshot({ path: `${evidence}/${theme}-${path.split("/").at(-1)}.png` });
      for (const lens of ["technical", "visual", "technical"]) {
        await page.evaluate(async (lens) => {
          const { lensActions } = await window.__visualModule("/src/shell/lens-store.ts");
          lensActions.setLens(lens);
        }, lens);
        await expect
          .poll(async () => {
            const s = await state(page);
            return s.lens.lens === lens && !s.lens.animating;
          })
          .toBe(true);
        const visible = await page
          .locator(
            `[data-lens-pane="${lens === "visual" ? "technical" : "visual"}"] .react-flow__node`,
          )
          .evaluateAll(
            (nodes) =>
              nodes.filter((n) =>
                n.checkVisibility({ visibilityProperty: true, opacityProperty: true }),
              ).length,
          );
        assert.equal(visible, 0, "inactive diagram painted");
      }
      results.push({ theme, path, ...projection });
    }
    await context.close();
    // Wait for the undo autosave before preparing the next independent context.
    await expect.poll(async () => await readFile(file, "utf8")).toBe(original);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ results, errors }, null, 2));
  if (evidence)
    await writeFile(`${evidence}/authoring.json`, JSON.stringify({ results, errors }, null, 2));
} finally {
  await browser.close();
  await rm(file, { force: true });
}
