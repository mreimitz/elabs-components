/** Real-frame motion proof. Uses the same environment variables as lens-recovery.mjs. */
/* global document, performance, requestAnimationFrame, getComputedStyle */
import assert from "node:assert/strict";
import process from "node:process";
import console from "node:console";
import { URL } from "node:url";
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
    await page.addInitScript(() => {
      performance.setResourceTimingBufferSize(10000);
      globalThis.__lensModule = (pathname) => {
        const resource = performance
          .getEntriesByType("resource")
          .findLast((entry) => new URL(entry.name).pathname === pathname);
        if (!resource) throw new Error(`Module not loaded: ${pathname}`);
        return import(resource.name);
      };
      globalThis.__lensEffectiveOpacity = (element) => {
        let opacity = 1;
        for (let current = element; current; current = current.parentElement)
          opacity *= Number(getComputedStyle(current).opacity);
        return opacity;
      };
    });
    let releaseRead;
    const readGate = new Promise((resolve) => {
      releaseRead = resolve;
    });
    await page.route("**/api/workspace/file?*", async (route) => {
      if (
        new URL(route.request().url()).searchParams.get("path") ===
        "examples/clickhouse-cloud-stack.yaml"
      )
        await readGate;
      await route.continue();
    });
    await page.goto(`${url}/#d/examples/clickhouse-cloud-stack.yaml`, {
      waitUntil: "domcontentloaded",
    });
    const earlyPromise = page.evaluate(async () => {
      const { lensStore, lensActions } = await globalThis.__lensModule("/src/shell/lens-store.ts");
      const { diagramStore, diagramActions } = await globalThis.__lensModule(
        "/src/state/diagram-store.ts",
      );
      const { isLayoutReady } = await globalThis.__lensModule("/src/panes/layout-ready-store.ts");
      await new Promise((resolve) => {
        const unsubscribe = diagramStore.subscribe(() => {
          if (diagramStore.get().path !== "examples/clickhouse-cloud-stack.yaml") return;
          unsubscribe();
          resolve();
        });
        globalThis.__lensEarlyObserverReady = true;
      });
      const currentDocument = diagramStore.get().path;
      const sourceReadyAtRequest = isLayoutReady(diagramStore.get().path);
      const text = diagramStore.get().text;
      const started = performance.now();
      lensActions.setLens("visual");
      diagramActions.setText(text + "\n# forbidden early write\n");
      const writeBlocked = diagramStore.get().text === text;
      const frames = [];
      return new Promise((resolve) => {
        const sample = (time) => {
          const visible = [
            ...document.querySelectorAll(
              '[data-lens-pane] .react-flow__renderer, [data-slot="canvas-skeleton"], [data-morph-camera]',
            ),
          ].some((element) =>
            element.checkVisibility({ visibilityProperty: true, opacityProperty: true }),
          );
          const renderer = document.querySelector(
            '[data-lens-pane="visual"] .react-flow__renderer',
          );
          const settled =
            !lensStore.get().animating &&
            lensStore.get().position === 1 &&
            isLayoutReady(diagramStore.get().path) &&
            renderer?.checkVisibility({ visibilityProperty: true }) &&
            globalThis.__lensEffectiveOpacity(renderer) === 1;
          frames.push({
            elapsed: performance.now() - started,
            visible,
            settled: !!settled,
            position: lensStore.get().position,
            ready: isLayoutReady(diagramStore.get().path),
            layers: [
              ...document.querySelectorAll(
                '[data-lens-pane] .react-flow__renderer, [data-slot="canvas-skeleton"]',
              ),
            ].map((element) => ({
              class: element.className,
              opacity: globalThis.__lensEffectiveOpacity(element),
              visibility: getComputedStyle(element).visibility,
              ancestors: [
                ...(function* (node) {
                  for (let current = node.parentElement; current; current = current.parentElement)
                    yield current;
                })(element),
              ].map((parent) => ({
                class: parent.className,
                opacity: getComputedStyle(parent).opacity,
                visibility: getComputedStyle(parent).visibility,
                display: getComputedStyle(parent).display,
              })),
              visible: element.checkVisibility({ visibilityProperty: true, opacityProperty: true }),
            })),
          });
          if (settled || time - started > 4000)
            resolve({ currentDocument, sourceReadyAtRequest, writeBlocked, frames });
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
    });
    await page.waitForFunction(() => globalThis.__lensEarlyObserverReady === true);
    releaseRead();
    const early = await earlyPromise;
    if (evidence)
      await writeFile(
        `${evidence}/early-open-${reducedMotion}.json`,
        JSON.stringify(early, null, 2),
      );
    assert.equal(early.currentDocument, "examples/clickhouse-cloud-stack.yaml");
    assert.equal(early.sourceReadyAtRequest, false, "early probe missed document loading");
    assert(early.writeBlocked, "early-toggle write escaped");
    assert(
      early.frames.every((frame) => frame.visible),
      "blank frame during initial loading toggle",
    );
    assert(
      early.frames.at(-1).settled && early.frames.at(-1).elapsed <= 4000,
      "early target did not settle within layout timeout",
    );
    await context.close();
  }
  for (const reducedMotion of process.env.LENS_LOADING_ONLY ? [] : ["no-preference", "reduce"]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion,
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      performance.setResourceTimingBufferSize(10000);
      globalThis.__lensModule = (pathname) => {
        const resource = performance
          .getEntriesByType("resource")
          .findLast((entry) => new URL(entry.name).pathname === pathname);
        if (!resource) throw new Error(`Module not loaded: ${pathname}`);
        return import(resource.name);
      };
      globalThis.__lensEffectiveOpacity = (element) => {
        let opacity = 1;
        for (let current = element; current; current = current.parentElement)
          opacity *= Number(getComputedStyle(current).opacity);
        return opacity;
      };
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${url}/#d/examples/lakehouse-aws.yaml`);
    await page
      .locator('[data-lens-pane="technical"] .react-flow__node')
      .first()
      .waitFor({ state: "attached" });
    // This budget measures lens preparation, separately from the document's initial ELK load.
    await page.evaluate(async () => {
      const { isLayoutReady } = await globalThis.__lensModule("/src/panes/layout-ready-store.ts");
      const { diagramStore } = await globalThis.__lensModule("/src/state/diagram-store.ts");
      await new Promise((resolve) => {
        const ready = () => {
          const renderer = document.querySelector(
            '[data-lens-pane="technical"] .react-flow__renderer',
          );
          if (
            isLayoutReady(diagramStore.get().path) &&
            renderer?.checkVisibility({ visibilityProperty: true }) &&
            globalThis.__lensEffectiveOpacity(renderer) === 1
          )
            resolve();
          else requestAnimationFrame(ready);
        };
        ready();
      });
    });
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
                nodeGeometry: [
                  ...document.querySelectorAll("[data-lens-pane] .react-flow__node"),
                ].map((node) => [node.style.transform, node.style.width, node.style.height]),
                sourceVisible: [
                  ...document.querySelectorAll("[data-lens-pane] .react-flow__renderer"),
                ].some(
                  (renderer) =>
                    globalThis.__lensEffectiveOpacity(renderer) === 1 &&
                    renderer.checkVisibility({ visibilityProperty: true }),
                ),
                chrome: [...document.querySelectorAll("[data-lens-chrome]")].map(
                  (v) => getComputedStyle(v).visibility,
                ),
                interactiveLayers: [...document.querySelectorAll("[data-lens-pane]")].filter(
                  (pane) => !pane.inert && getComputedStyle(pane).visibility === "visible",
                ).length,
                visibleText: [
                  ...document.querySelectorAll("[data-lens-pane] .react-flow__node"),
                ].some(
                  (node) =>
                    node.textContent.trim() && globalThis.__lensEffectiveOpacity(node) >= 0.5,
                ),
                edgeGeometry: [
                  ...document.querySelectorAll("[data-lens-pane] .react-flow__edge path"),
                ].map((path) => path.getAttribute("d")),
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
      results.push({ ...metrics, data });
      if (evidence)
        await writeFile(`${evidence}/motion-metrics.json`, JSON.stringify(results, null, 2));
      assert.equal(data.at(-1).moving, false, `did not settle: ${scenario}`);
      assert(
        data.every((f) => f.chrome.includes("visible")),
        `chrome disappeared: ${scenario}`,
      );
      assert(
        data.every((f) => !f.ghostVisible),
        "synthetic geometry appeared",
      );
      const initial = moving[0];
      for (const frame of moving) {
        assert.deepEqual(frame.cameras, initial.cameras, "retained lens camera moved");
        assert.deepEqual(frame.nodeGeometry, initial.nodeGeometry, "crossfade changed geometry");
        assert.equal(frame.interactiveLayers, 0, "a moving pane remained interactive");
        assert(frame.visibleText, "all real labels disappeared during transition");
        assert.deepEqual(
          frame.edgeGeometry,
          initial.edgeGeometry,
          "actual routes changed during transition",
        );
      }
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
