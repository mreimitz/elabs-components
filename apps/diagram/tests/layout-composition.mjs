/** Browser regression for readable visual overviews and collision-free projected geometry. */
/* global document, performance, getComputedStyle, localStorage, requestAnimationFrame */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";
import console from "node:console";
import { URL } from "node:url";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5180";
const evidence = process.env.LENS_EVIDENCE_DIR;
if (evidence) await mkdir(evidence, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript((theme) => {
      localStorage.setItem("brand-ui-theme", theme);
      performance.setResourceTimingBufferSize(10000);
    }, theme);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const path of [
      "components/Qlik/SaaS/answers.yaml",
      "templates/qlik-talend-cloud-pipeline.yaml",
      "templates/qlik-cloud-customer-landscape.yaml",
    ]) {
      await page.goto(`${base}/#d/${path}&lens=visual`);
      await page.waitForFunction(async (path) => {
        const load = async (pathname) =>
          import(
            performance
              .getEntriesByType("resource")
              .findLast((entry) => new URL(entry.name).pathname === pathname)?.name ?? pathname
          );
        const { diagramStore } = await load("/src/state/diagram-store.ts");
        const { lensStore } = await load("/src/shell/lens-store.ts");
        const state = lensStore.get();
        return (
          diagramStore.get().path === path &&
          diagramStore
            .get()
            .drawn.ast.title?.includes(
              path.includes("answers.yaml")
                ? "Qlik Answers"
                : path.includes("talend")
                  ? "Qlik Talend Cloud"
                  : "customer landscape",
            ) &&
          state.lens === "visual" &&
          !state.animating &&
          document.querySelector('[data-lens-pane="visual"] [data-slot="capability-box"]')
        );
      }, path);
      // Wait for an unchanged camera across multiple rendered frames, not an arbitrary screenshot delay.
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            let previous = "",
              unchanged = 0;
            const sample = () => {
              const viewport = document.querySelector(
                '[data-lens-pane="visual"] .react-flow__viewport',
              );
              const transform = viewport ? getComputedStyle(viewport).transform : "";
              unchanged = transform && transform === previous ? unchanged + 1 : 0;
              previous = transform;
              if (unchanged >= 12) resolve();
              else requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
          }),
      );
      const result = await page.evaluate(async () => {
        const load = async (pathname) =>
          import(
            performance
              .getEntriesByType("resource")
              .findLast((entry) => new URL(entry.name).pathname === pathname)?.name ?? pathname
          );
        const { diagramStore } = await load("/src/state/diagram-store.ts");
        const { visualSnapshot } = await load("/src/visual/snapshot.ts");
        const { visualGeometryIssues } = await load("/src/visual/check-visual-geometry.ts");
        const { layoutVisualLens } = await load("/src/visual/lane-layout.ts");
        const lens = visualSnapshot(diagramStore.get().drawn.ast).lens;
        const titles = [
          ...document.querySelectorAll(
            '[data-lens-pane="visual"] [data-slot="capability-box-title"]',
          ),
        ].map((element) => {
          const node = element.closest(".react-flow__node");
          const rect = element.getBoundingClientRect();
          const scale = node.getBoundingClientRect().width / node.offsetWidth;
          return {
            text: element.textContent,
            screenFont: Number.parseFloat(getComputedStyle(element).fontSize) * scale,
            rect: { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom },
          };
        });
        return {
          titles,
          clippedFlowLabels: [
            ...document.querySelectorAll(
              '[data-lens-pane="visual"] [data-slot="visual-flow-label"] .truncate',
            ),
          ]
            .filter((element) => element.scrollWidth > element.clientWidth + 1)
            .map((element) => element.textContent),
          geometry: visualGeometryIssues(lens),
          bounds: layoutVisualLens(lens).bounds,
        };
      });
      assert(result.titles.length > 0);
      assert(
        result.titles.every((title) => title.screenFont >= 12),
        `${theme} ${path}: primary labels must remain at least 12 screen pixels: ${JSON.stringify(result.titles)}`,
      );
      assert(
        result.titles.every(
          (title) =>
            title.rect.x >= 0 &&
            title.rect.right <= 1440 &&
            title.rect.y >= 0 &&
            title.rect.bottom <= 900,
        ),
        `${path}: no clipped primary labels`,
      );
      assert.deepEqual(result.clippedFlowLabels, [], `${path}: readable flow labels`);
      assert.deepEqual(result.geometry, [], `${path}: projected geometry`);
      assert.deepEqual(errors, [], `${path}: browser errors`);
      if (evidence)
        await page.screenshot({ path: `${evidence}/${theme}-${path.split("/").at(-1)}.png` });
      results.push({ theme, path, ...result });
    }
    await page.setViewportSize({ width: 390, height: 900 });
    if (evidence) await page.screenshot({ path: `${evidence}/${theme}-mobile-before.png` });
    const pane = page.locator('[data-lens-pane="visual"]');
    const viewport = pane.locator(".react-flow__viewport");
    for (const name of ["Zoom in", "Zoom out", "Fit view"]) {
      const control = page.getByRole("button", { name, exact: true });
      await control.waitFor({ state: "visible" });
      assert(await control.isVisible(), `${theme}: mobile ${name} must remain visible`);
      const rect = await control.boundingBox();
      assert(
        rect.x >= 0 && rect.x + rect.width <= 390 && rect.y + rect.height <= 900,
        `${name}: mobile control is clipped`,
      );
    }
    const before = await viewport.evaluate((element) => getComputedStyle(element).transform);
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await page.waitForFunction(
      (before) =>
        getComputedStyle(document.querySelector('[data-lens-pane="visual"] .react-flow__viewport'))
          .transform !== before,
      before,
    );
    const panBefore = await viewport.evaluate(
      (element) =>
        new Promise((resolve) => {
          let previous = "",
            stable = 0;
          const frame = () => {
            const value = getComputedStyle(element).transform;
            stable = value === previous ? stable + 1 : 0;
            previous = value;
            if (stable >= 12) resolve(value);
            else requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
        }),
    );
    // Pointer panning remains available even when the complete overview is small on a phone.
    await page.mouse.move(195, 500);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(125, 550, { steps: 8 });
    await page.mouse.up({ button: "middle" });
    const panAfter = await viewport.evaluate((element) => getComputedStyle(element).transform);
    assert.notEqual(panAfter, panBefore, `${theme}: mobile canvas must respond to pointer panning`);
    assert.deepEqual(errors, [], `${theme}: mobile browser errors`);
    if (evidence) await page.screenshot({ path: `${evidence}/${theme}-mobile-navigation.png` });
    await context.close();
  }
  if (evidence) await writeFile(`${evidence}/results.json`, JSON.stringify(results, null, 2));
  console.log(
    `PASS: ${results.length} visual composition checks, primary labels >=12px, no geometry collisions or browser errors.`,
  );
} finally {
  await browser.close();
}
