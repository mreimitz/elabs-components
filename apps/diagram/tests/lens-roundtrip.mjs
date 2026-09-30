/** Repeated switching retains each camera and the actual rendered graph; measure frame
 * timing over ten round trips instead of drawing conclusions from a four-frame reversal. */
/* global document, performance, requestAnimationFrame */
import assert from "node:assert/strict";
import process from "node:process";
import console from "node:console";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const url = process.env.DIAGRAM_URL ?? "http://localhost:5472";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${url}/#d/examples/lakehouse-aws.yaml`);
  await page.locator('[data-lens-pane="technical"] .react-flow__node').first().waitFor();
  await page.waitForFunction(() => document.querySelector('[data-visual-ready="true"]'));
  const metrics = await page.evaluate(async () => {
    const resource = (path) =>
      performance.getEntriesByType("resource").findLast((entry) => entry.name.includes(path)).name;
    const { lensActions, lensStore } = await import(resource("/src/shell/lens-store.ts"));
    const { diagramStore } = await import(resource("/src/state/diagram-store.ts"));
    const initialText = diagramStore.get().text;
    const snapshot = () =>
      [...document.querySelectorAll("[data-lens-pane] .react-flow__viewport")].map((pane) => ({
        camera: pane.style.transform,
        nodes: [...pane.querySelectorAll(".react-flow__node")].map((node) => [
          node.dataset.id,
          node.style.transform,
          node.style.width,
          node.style.height,
        ]),
        routes: [...pane.querySelectorAll(".react-flow__edge path")].map((path) =>
          path.getAttribute("d"),
        ),
      }));
    const switchTo = (target) => {
      lensActions.setLens(target);
      const frameTimes = [];
      let last;
      return new Promise((resolve) => {
        const check = (time) => {
          const state = lensStore.get();
          if (state.position > 0 && state.position < 1 && last !== undefined)
            frameTimes.push(time - last);
          last = time;
          if (!state.animating && state.lens === target) resolve(frameTimes);
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      });
    };
    await switchTo("visual");
    await switchTo("technical");
    const before = snapshot();
    const times = [];
    const rounds = [];
    for (let i = 0; i < 10; i++) {
      times.push(...(await switchTo("visual")), ...(await switchTo("technical")));
      rounds.push(snapshot());
    }
    return {
      before,
      rounds,
      textUnchanged: diagramStore.get().text === initialText,
      frameCount: times.length,
      withinBudget: times.filter((dt) => dt <= 16.9).length / times.length,
      maxFrame: Math.max(...times),
      overBudget: times.filter((dt) => dt > 16.9),
    };
  });
  assert.equal(metrics.textUnchanged, true);
  metrics.rounds.forEach((round, i) =>
    assert.deepEqual(round, metrics.before, `geometry/camera changed in round ${i + 1}`),
  );
  assert.deepEqual(errors, []);
  if (process.env.LENS_EVIDENCE_DIR) {
    await mkdir(process.env.LENS_EVIDENCE_DIR, { recursive: true });
    await writeFile(
      `${process.env.LENS_EVIDENCE_DIR}/roundtrip.json`,
      JSON.stringify(metrics, null, 2),
    );
  }
  console.log(JSON.stringify({ ...metrics, before: undefined, rounds: undefined }, null, 2));
  assert(metrics.withinBudget >= 0.95, "Repeated switching missed 95% within 16.9ms");
} finally {
  await browser.close();
}
