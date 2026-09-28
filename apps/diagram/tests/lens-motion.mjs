/** Real-frame motion proof. Uses the same environment variables as lens-recovery.mjs. */
/* global document, performance, requestAnimationFrame, getComputedStyle */
import assert from "node:assert/strict";
import process from "node:process";
import console from "node:console";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const url = process.env.DIAGRAM_URL ?? "http://localhost:5415";
const evidence = process.env.LENS_EVIDENCE_DIR;
if (evidence) await mkdir(evidence, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${url}/#d/examples/lakehouse-aws.yaml`);
    await page
      .locator('[data-lens-pane="technical"] .react-flow__node')
      .first()
      .waitFor({ state: "attached" });
    for (const scenario of ["immediate", "return", "resize", "reverse"]) {
      if (scenario === "resize") await page.setViewportSize({ width: 1280, height: 900 });
      const target = scenario === "return" ? "technical" : "visual";
      const data = await page.evaluate(
        async ({ target, reverse }) => {
          const { lensStore, lensActions } = await import(
            performance
              .getEntriesByType("resource")
              .find((e) => e.name.includes("/src/shell/lens-store.ts")).name
          );
          const frames = [];
          let last = performance.now(),
            reversed = false;
          lensActions.setLens(target);
          return new Promise((resolve) => {
            const sample = (time) => {
              const s = lensStore.get();
              const viewports = [
                ...document.querySelectorAll("[data-lens-pane] .react-flow__viewport"),
              ];
              frames.push({
                dt: time - last,
                p: s.position,
                moving: s.animating,
                cameras: viewports.map((v) => v.style.transform),
                sourceVisible: [
                  ...document.querySelectorAll("[data-lens-pane] .react-flow__renderer"),
                ].some(
                  (renderer) =>
                    getComputedStyle(renderer).opacity === "1" &&
                    renderer.checkVisibility({ visibilityProperty: true }),
                ),
                chrome: [...document.querySelectorAll("[data-lens-chrome]")].map(
                  (v) => getComputedStyle(v).visibility,
                ),
                ghostVisible:
                  document
                    .querySelector("[data-morph-camera]")
                    ?.checkVisibility({ visibilityProperty: true }) ?? false,
              });
              last = time;
              if (reverse && !reversed && s.position > 0.25 && s.position < 0.75) {
                lensActions.setLens("technical");
                reversed = true;
              }
              if (frames.length > 2 && !s.animating) resolve(frames);
              else if (frames.length < 240) requestAnimationFrame(sample);
              else resolve(frames);
            };
            requestAnimationFrame(sample);
          });
        },
        { target, reverse: scenario === "reverse" },
      );
      const moving = data.filter((f) => f.p > 0 && f.p < 1);
      const metrics = {
        reducedMotion,
        scenario,
        frameCount: moving.length,
        withinBudget: moving.filter((f) => f.dt <= 16.9).length / Math.max(1, moving.length),
        maxFrame: Math.max(...moving.map((f) => f.dt)),
        preparationMs: data
          .slice(
            0,
            data.findIndex((f) => f.p > 0 && f.p < 1),
          )
          .reduce((sum, f) => sum + f.dt, 0),
      };
      assert.equal(data.at(-1).moving, false, `did not settle: ${scenario}`);
      assert(
        data.every((f) => f.chrome.includes("visible")),
        `chrome disappeared: ${scenario}`,
      );
      if (reducedMotion === "no-preference" && moving.length)
        assert(
          moving.every((f) => f.cameras[0] === f.cameras[1]),
          "independent cameras during morph",
        );
      if (reducedMotion === "reduce")
        assert(
          data.every((f) => !f.ghostVisible),
          "reduced-motion geometry moved",
        );
      assert(moving.length > 0, `transition skipped: ${scenario}`);
      if (scenario === "reverse") {
        assert(
          data.some((frame) => frame.p > 0.25),
          "reverse never reached a moving frame",
        );
        assert.equal(data.at(-1).p, 0, "reverse did not return to technical");
      }
      assert(metrics.preparationMs < 150, `preparation exceeded 150ms: ${metrics.preparationMs}`);
      const preparation = data.slice(
        0,
        data.findIndex((frame) => frame.p > 0 && frame.p < 1),
      );
      assert(
        preparation.every((frame) => frame.sourceVisible),
        "source blank during preparation",
      );
      results.push({ ...metrics, data });
      // Return to technical before the reversal proof.
      if (scenario === "resize") {
        await page.keyboard.press("l");
        await page.waitForTimeout(1000);
      }
      await page.waitForTimeout(100);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  if (evidence)
    await writeFile(`${evidence}/motion-metrics.json`, JSON.stringify(results, null, 2));
  console.log(
    JSON.stringify(
      results.map((result) => ({ ...result, data: undefined })),
      null,
      2,
    ),
  );
  for (const result of results.filter((result) => result.reducedMotion === "no-preference"))
    assert(
      result.withinBudget >= 0.95,
      `${result.scenario}: ${(result.withinBudget * 100).toFixed(2)}% frames within 16.9ms, requires 95%`,
    );
} finally {
  await browser.close();
}
