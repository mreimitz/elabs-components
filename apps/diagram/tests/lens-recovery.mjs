/** Isolated real-browser lens checks. DIAGRAM_URL, PLAYWRIGHT_MODULE, LENS_EVIDENCE_DIR. */
/* global document, performance, setTimeout, getComputedStyle */
import assert from "node:assert/strict";
import process from "node:process";
import console from "node:console";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const url = process.env.DIAGRAM_URL ?? "http://localhost:5415";
const evidence = process.env.LENS_EVIDENCE_DIR;
if (evidence) await mkdir(evidence, { recursive: true });
const browser = await chromium.launch();
const paths = [
  "examples/lakehouse-aws.yaml",
  "examples/clickhouse-cloud-stack.yaml",
  "examples/qlik-cloud-data-gateway.yaml",
  "examples/qlik-sense-enterprise-onprem.yaml",
  "templates/qlik-cloud-customer-landscape.yaml",
  "templates/qlik-talend-cloud-pipeline.yaml",
  "components/qlik-cloud-tenant.yaml",
];
const results = [];
// Import the actual module URL already loaded by Vite, including its HMR version if present.
async function lens(page, action) {
  return page.evaluate(async (action) => {
    const moduleURL = performance
      .getEntriesByType("resource")
      .find((entry) => entry.name.includes("/src/shell/lens-store.ts"))?.name;
    const { lensStore, lensActions } = await import(moduleURL ?? "/src/shell/lens-store.ts");
    if (action) lensActions.setLens(action);
    return lensStore.get();
  }, action);
}
async function settled(page, target) {
  for (let i = 0; i < 120; i++) {
    const state = await lens(page);
    if (!state.animating && state.lens === target) {
      await page.waitForFunction((target) => {
        const pane = document.querySelector(`[data-lens-pane="${target}"]`);
        const renderer = pane?.querySelector(".react-flow__renderer");
        return (
          pane &&
          getComputedStyle(pane).visibility === "visible" &&
          (!renderer || globalThis.__lensEffectiveOpacity(renderer) === 1)
        );
      }, target);
      return;
    }
    await page.waitForTimeout(25);
  }
  throw new Error(`Lens did not settle on ${target}`);
}
try {
  for (const width of process.env.LENS_SKIP_GALLERY ? [] : [1440, 390])
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      await page.addInitScript(() => {
        performance.setResourceTimingBufferSize(10000);
        globalThis.__lensEffectiveOpacity = (element) => {
          let opacity = 1;
          for (let current = element; current; current = current.parentElement)
            opacity *= Number(getComputedStyle(current).opacity);
          return opacity;
        };
      });
      const errors = [],
        writes = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/api/workspace/**", (route) => {
        if (["PUT", "POST", "DELETE"].includes(route.request().method())) {
          writes.push(route.request().url());
          return route.fulfill({
            status: 409,
            json: { error: "Unexpected write in read-only test" },
          });
        }
        return route.continue();
      });
      for (const path of paths) {
        await page.goto(`${url}/#d/${path}`);
        await page.evaluate(
          (theme) => document.documentElement.setAttribute("data-theme", theme),
          theme,
        );
        await page
          .locator('[data-lens-pane="technical"] .react-flow__node')
          .first()
          .waitFor({ state: "attached" });
        await page.waitForTimeout(850);
        const name = path.replaceAll("/", "-").replace(".yaml", "");
        if (evidence)
          await page.screenshot({ path: `${evidence}/${width}-${theme}-${name}-technical.png` });
        // Real keyboard event, including compact/mobile toolbars where the toggle lives in a menu.
        await page.keyboard.press("l");
        await settled(page, "visual");
        const boxes = page.locator('[data-lens-pane="visual"] [data-slot="capability-box"]');
        assert((await boxes.count()) > 0, path);
        const fit = await page.locator('[data-lens-pane="visual"]').evaluate((pane) => {
          const frame = pane.getBoundingClientRect();
          return [...pane.querySelectorAll('[data-slot="capability-box"]')].every((box) => {
            const rect = box.getBoundingClientRect();
            return (
              rect.left >= frame.left - 1 &&
              rect.right <= frame.right + 1 &&
              rect.top >= frame.top - 1 &&
              rect.bottom <= frame.bottom + 1
            );
          });
        });
        assert(fit, `${path} boxes outside fitted pane`);
        const clipped = await boxes.evaluateAll((elements) =>
          elements
            .filter((element) => element.scrollHeight > element.clientHeight + 2)
            .map((element) => element.getAttribute("aria-label")),
        );
        assert.deepEqual(clipped, [], `clipped box content: ${path}`);
        if (evidence)
          await page.screenshot({ path: `${evidence}/${width}-${theme}-${name}-visual.png` });
        const geometry = await page.evaluate(async () => {
          const moduleURL = performance
            .getEntriesByType("resource")
            .find((entry) => entry.name.includes("/src/state/diagram-store.ts"))?.name;
          const { diagramStore } = await import(moduleURL);
          const { deriveVisualLens } = await import("/src/visual/derive-visual.ts");
          const { visualGeometryIssues } = await import("/src/visual/check-visual-geometry.ts");
          return visualGeometryIssues(deriveVisualLens(diagramStore.get().drawn.ast));
        });
        assert.deepEqual(geometry, [], `${path} geometry`);
        for (let index = 0; index < (await boxes.count()); index++) {
          await page.mouse.move(0, 0);
          await page.waitForTimeout(180);
          await boxes.nth(index).hover();
          const card = page.locator('[data-slot="hover-card-content"][data-state="open"]');
          await card.waitFor({ state: "visible" });
          await page.waitForTimeout(120);
          const rect = await card.boundingBox();
          assert(
            rect &&
              rect.x >= 0 &&
              rect.y >= 0 &&
              rect.x + rect.width <= width &&
              rect.y + rect.height <= 900,
            `${path} hover ${index} outside viewport`,
          );
          assert((await card.textContent()).includes("Contains:"));
          if (index === 0 && evidence)
            await page.screenshot({ path: `${evidence}/${width}-${theme}-${name}-hover.png` });
        }
        results.push({ width, theme, path, boxes: await boxes.count() });
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(writes, []);
      await context.close();
    }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    performance.setResourceTimingBufferSize(10000);
    globalThis.__lensEffectiveOpacity = (element) => {
      let opacity = 1;
      for (let current = element; current; current = current.parentElement)
        opacity *= Number(getComputedStyle(current).opacity);
      return opacity;
    };
  });
  const writes = [],
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.method() === "PUT" || request.url().includes("/api/workspace/thumb"))
      writes.push(request.url());
  });
  await page.goto(`${url}/#d/examples/lakehouse-aws.yaml`);
  await page.waitForTimeout(1200);
  // Prepare an immediate transition after a size change; the source must not go blank.
  await page.setViewportSize({ width: 1280, height: 900 });
  await lens(page, "visual");
  await settled(page, "visual");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.waitForTimeout(500);
  // A user zoom remains intentional across resize, then becomes the morph's actual camera.
  const visualPane = page.locator('[data-lens-pane="visual"] .react-flow');
  await visualPane.hover({ position: { x: 80, y: 500 } });
  await page.mouse.wheel(0, -160);
  await page.waitForTimeout(350);
  const camera = () =>
    page.locator('[data-lens-pane="visual"] .react-flow__viewport').getAttribute("style");
  const zoomed = await camera();
  await page.setViewportSize({ width: 1180, height: 900 });
  await page.waitForTimeout(200);
  assert.equal(await camera(), zoomed, "resize overwrote intentional zoom");
  const guard = await page.evaluate(async () => {
    const module = async (path) =>
      import(
        performance.getEntriesByType("resource").find((entry) => entry.name.includes(path))?.name
      );
    const { diagramStore, diagramActions, editActions } = await module(
      "/src/state/diagram-store.ts",
    );
    const { lensActions, lensStore } = await module("/src/shell/lens-store.ts");
    const { canUseHistory, historyActions } = await module("/src/state/history.ts");
    const text = diagramStore.get().text;
    const before = lensStore.get();
    diagramActions.setText(text + "# forbidden\n");
    diagramActions.setTopLevel("direction", "TB");
    editActions.applyEdit(() => text + "# forbidden\n");
    historyActions.undo();
    const visualUnchanged = diagramStore.get().text === text;
    lensActions.setLens("technical");
    const historyBlocked = !canUseHistory();
    editActions.applyEdit(() => text + "# reversal forbidden\n");
    const reversalUnchanged = diagramStore.get().text === text;
    lensActions.setLens("visual");
    return { visualUnchanged, reversalUnchanged, historyBlocked, before: before.lens };
  });
  assert.deepEqual(guard, {
    visualUnchanged: true,
    reversalUnchanged: true,
    historyBlocked: true,
    before: "visual",
  });
  await settled(page, "visual");
  const textarea = page.getByRole("textbox", { name: "Diagram YAML" });
  if (await textarea.count()) {
    await textarea.focus();
    await page.keyboard.type("forbidden");
  }
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Meta+z");
  await page.waitForTimeout(900);
  assert.deepEqual(writes, []);
  // Keyboard drill-down lands on a real technical node after the transition and fit.
  const box = page.locator('[data-lens-pane="visual"] [data-slot="capability-box"]').first();
  await box.focus();
  await page.keyboard.press("Alt+Enter");
  await settled(page, "technical");
  await page.waitForFunction(() => document.activeElement?.classList.contains("react-flow__node"));
  // Enter a real shared-document route before creating history; do not detach the model
  // from a workspace URL (that is now correctly treated as pending navigation).
  const historyUrl = await page.evaluate(async () => {
    const module = (path) =>
      import(
        performance.getEntriesByType("resource").findLast((entry) => entry.name.includes(path)).name
      );
    const { diagramStore } = await module("/src/state/diagram-store.ts");
    const { shareUrl } = await module("/src/io/share-url.ts");
    return shareUrl(diagramStore.get().text);
  });
  await page.goto("about:blank");
  await page.goto(historyUrl);
  await page
    .locator('[data-lens-pane="technical"] .react-flow__node')
    .first()
    .waitFor({ state: "attached" });
  const historyGuard = await page.evaluate(async () => {
    const module = (path) =>
      import(
        performance.getEntriesByType("resource").find((entry) => entry.name.includes(path)).name
      );
    const { diagramStore, diagramActions } = await module("/src/state/diagram-store.ts");
    const { historyActions, historyCounts } = await module("/src/state/history.ts");
    const { lensStore, lensActions } = await module("/src/shell/lens-store.ts");
    if (diagramStore.get().path !== null)
      throw new Error("History fixture is not a shared document");
    const { modeActions } = await module("/src/shell/mode-store.ts");
    modeActions.setMode("edit");
    diagramActions.setText(diagramStore.get().text + "\n# first history step\n");
    await new Promise((resolve) => setTimeout(resolve, 550));
    diagramActions.setText(diagramStore.get().text + "# second history step\n");
    historyActions.undo();
    const expected = historyCounts();
    const text = diagramStore.get().text;
    const locked = () => {
      const undo = historyActions.undo(),
        redo = historyActions.redo();
      return { undo, redo, counts: historyCounts(), unchanged: diagramStore.get().text === text };
    };
    lensActions.setLens("visual");
    const immediate = locked();
    while (lensStore.get().animating) await new Promise((resolve) => setTimeout(resolve, 25));
    const visual = locked();
    lensActions.setLens("technical");
    const reversal = locked();
    while (lensStore.get().animating) await new Promise((resolve) => setTimeout(resolve, 25));
    const restored = historyActions.redo();
    return { expected, immediate, visual, reversal, restored };
  });
  assert.deepEqual(historyGuard.expected, { undo: 1, redo: 1 });
  for (const phase of ["immediate", "visual", "reversal"])
    assert.deepEqual(
      historyGuard[phase],
      { undo: false, redo: false, counts: historyGuard.expected, unchanged: true },
      phase,
    );
  assert.equal(historyGuard.restored, true);
  await page.keyboard.press("e");
  await lens(page, "visual");
  await settled(page, "visual");
  const picture = await page.evaluate(async () => {
    const moduleURL = performance
      .getEntriesByType("resource")
      .find((entry) => entry.name.includes("/src/io/export.ts"))?.name;
    const { pictureOfCanvas, pngBlob } = await import(moduleURL ?? "/src/io/export.ts");
    const picture = await pictureOfCanvas();
    const png = await pngBlob(picture, 1);
    return {
      visual: picture.svg.includes("capability-box"),
      title: picture.svg.includes("diagram-title"),
      pngBytes: png.blob.size,
    };
  });
  assert(picture.visual && picture.title && picture.pngBytes > 1000);
  await page.getByRole("button", { name: "Present", exact: true }).click();
  await page.waitForTimeout(700);
  assert((await lens(page)).lens === "visual");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  // Reload the route after presentation: the in-memory history fixture has no workspace
  // path, so presentation's route restoration can still have a document load in flight.
  await page.goto(`${url}/?lens-fixture=empty#d/examples/lakehouse-aws.yaml`);
  await page
    .locator('[data-lens-pane="technical"] .react-flow__node')
    .first()
    .waitFor({ state: "attached" });
  await lens(page, "visual");
  await settled(page, "visual");
  for (const [text, title] of [
    ["", "Nothing to draw yet"],
    ["title: [", "The text is not a diagram"],
  ]) {
    const fixtureUrl = await page.evaluate(async (text) => {
      const moduleURL = performance
        .getEntriesByType("resource")
        .findLast((entry) => entry.name.includes("/src/io/share-url.ts")).name;
      const { shareUrl } = await import(moduleURL);
      return shareUrl(text);
    }, text);
    await page.goto("about:blank");
    await page.goto(`${fixtureUrl}&lens=visual`);
    await lens(page, "visual");
    await settled(page, "visual");
    await page
      .locator('[data-lens-pane="visual"]')
      .getByText(title, { exact: true })
      .waitFor({ state: "visible" });
  }
  await page.goto(`${url}/#dev/lens-check`);
  await page.locator("table").first().waitFor();
  assert.equal(await page.locator('[data-pass="false"]').count(), 0);
  await page.goto(`${url}/#dev/spec-check`);
  await page.locator("table").first().waitFor();
  assert.equal(await page.locator('[data-pass="false"]').count(), 0);
  assert.deepEqual(errors, []);
  await context.close();
  console.log(
    JSON.stringify(
      { galleries: results.length, guard, historyGuard, picture, errors, writes },
      null,
      2,
    ),
  );
  if (evidence)
    await writeFile(
      `${evidence}/functional-checks.json`,
      JSON.stringify({ results, guard, historyGuard, picture, errors, writes }, null, 2),
    );
} finally {
  await browser.close();
}
