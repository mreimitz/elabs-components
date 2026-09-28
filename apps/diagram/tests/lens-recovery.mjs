/** Isolated real-browser lens checks. DIAGRAM_URL, PLAYWRIGHT_MODULE, LENS_EVIDENCE_DIR. */
/* global document, performance */
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
    const { lensStore, lensActions } = await import(moduleURL);
    if (action) lensActions.setLens(action);
    return lensStore.get();
  }, action);
}
async function settled(page, target) {
  for (let i = 0; i < 120; i++) {
    const state = await lens(page);
    if (!state.animating && state.lens === target) return;
    await page.waitForTimeout(25);
  }
  throw new Error(`Lens did not settle on ${target}`);
}
try {
  for (const width of process.env.LENS_SKIP_GALLERY ? [] : [1440, 390])
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
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
        results.push({ width, theme, path, boxes: await boxes.count() });
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(writes, []);
      await context.close();
    }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
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
  await page.goto(`${url}/#dev/lens-check`);
  await page.locator("table").first().waitFor();
  assert.equal(await page.locator('[data-pass="false"]').count(), 0);
  await page.goto(`${url}/#dev/spec-check`);
  await page.locator("table").first().waitFor();
  assert.equal(await page.locator('[data-pass="false"]').count(), 0);
  assert.deepEqual(errors, []);
  await context.close();
  console.log(
    JSON.stringify({ galleries: results.length, guard, picture, errors, writes }, null, 2),
  );
  if (evidence)
    await writeFile(
      `${evidence}/functional-checks.json`,
      JSON.stringify({ results, guard, picture, errors, writes }, null, 2),
    );
} finally {
  await browser.close();
}
