/** Cold-load and navigation regression: never normalize the UI with a preparatory toggle. */
/* global window, document, localStorage, performance, getComputedStyle, requestAnimationFrame, URL, process, console */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5410";
const evidence = process.env.NAVIGATION_EVIDENCE;
if (evidence) await mkdir(evidence, { recursive: true });
const paths = [
  "components/qlik-cloud-tenant.yaml",
  "examples/clickhouse-cloud-stack.yaml",
  "examples/lakehouse-aws.yaml",
  "examples/qlik-cloud-data-gateway.yaml",
  "examples/qlik-sense-enterprise-onprem.yaml",
  "templates/qlik-cloud-customer-landscape.yaml",
];
const tabId = (path) => `doc-tab-${path.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
const browser = await chromium.launch();
const results = [],
  errors = [],
  writes = [];
let page;
async function snapshot() {
  return page.evaluate(async () => {
    const { diagramStore } = await window.__navModule("/src/state/diagram-store.ts");
    const { workspaceStore } = await window.__navModule("/src/workspace/workspace-store.ts");
    const { lensStore } = await window.__navModule("/src/shell/lens-store.ts");
    const { isLayoutReady } = await window.__navModule("/src/panes/layout-ready-store.ts");
    const d = diagramStore.get();
    return {
      hash: window.location.hash,
      path: d.path,
      title: d.drawn.ast?.title,
      current: workspaceStore.get().current?.path,
      selected: document.querySelector('[role="tab"][aria-selected="true"]')?.id,
      lens: lensStore.get(),
      ready: isLayoutReady(d.path),
      layers: [...document.querySelectorAll("[data-lens-pane]")].map((pane) => ({
        lens: pane.getAttribute("data-lens-pane"),
        opacity: getComputedStyle(pane).opacity,
        painted: [...pane.querySelectorAll(".react-flow__node")].filter((node) =>
          node.checkVisibility({ visibilityProperty: true, opacityProperty: true }),
        ).length,
      })),
    };
  });
}
async function settled(path, lens = "technical") {
  await expect
    .poll(
      async () => {
        const s = await snapshot();
        return {
          path: s.path,
          current: s.current,
          selected: s.selected,
          lens: s.lens.lens,
          target: s.lens.target,
          animating: s.lens.animating,
          ready: s.ready,
        };
      },
      { timeout: 15000 },
    )
    .toEqual({
      path,
      current: path,
      selected: tabId(path),
      lens,
      target: lens,
      animating: false,
      ready: true,
    });
  const state = await snapshot();
  assert.ok(
    state.layers.find((layer) => layer.lens === lens)?.painted > 0,
    `No painted ${lens} nodes: ${JSON.stringify(state)}`,
  );
  assert.equal(
    state.layers.find((layer) => layer.lens !== lens)?.painted,
    0,
    `Inactive lens is painted: ${JSON.stringify(state)}`,
  );
  return state;
}
async function choose(path) {
  const tab = page.locator(`#${tabId(path)}`);
  if (await tab.count()) await tab.click();
  else {
    await page.getByRole("button", { name: /^More open diagrams/ }).click();
    await page.locator(`[role="menuitem"][title="${path}"]`).click();
  }
}
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(
      ({ paths, theme }) => {
        localStorage.setItem("atlas.shell.tabs", JSON.stringify(paths));
        localStorage.setItem("brand-ui-theme", theme);
        performance.setResourceTimingBufferSize(10000);
        window.__navModule = (pathname) => {
          const resource = performance
            .getEntriesByType("resource")
            .findLast((e) => new URL(e.name).pathname === pathname);
          if (!resource) throw new Error(`Module not loaded: ${pathname}`);
          return import(resource.name);
        };
      },
      { paths, theme },
    );
    page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (["POST", "PUT", "DELETE"].includes(r.method())) writes.push(r.url());
    });
    const first = paths[3];
    await page.goto(`${base}/#d/${first}`);
    await page.locator('[data-lens-pane="technical"] .react-flow__node').first().waitFor();
    results.push({ name: `${theme}: cold technical`, state: await settled(first) });
    if (evidence) await page.screenshot({ path: `${evidence}/${theme}-cold.png` });
    await page.getByRole("radio", { name: "Visual view (L)", exact: true }).click();
    results.push({ name: `${theme}: visual`, state: await settled(first, "visual") });
    await page.getByRole("radio", { name: "Technical view (L)", exact: true }).click();
    results.push({ name: `${theme}: back to technical`, state: await settled(first) });
    // Reversal and a different tab during an active tween must not reuse old geometry.
    await page.getByRole("radio", { name: "Visual view (L)", exact: true }).click();
    await expect
      .poll(async () => {
        const s = await snapshot();
        return s.lens.position > 0 && s.lens.position < 1;
      })
      .toBe(true);
    await page.getByRole("radio", { name: "Technical view (L)", exact: true }).click();
    results.push({ name: `${theme}: reverse moving lens`, state: await settled(first) });
    await page.getByRole("radio", { name: "Visual view (L)", exact: true }).click();
    await expect
      .poll(async () => {
        const s = await snapshot();
        return s.lens.position > 0 && s.lens.position < 1;
      })
      .toBe(true);
    const visibleBefore = await page
      .locator('[data-slot="doc-tabs"] [role="tab"]')
      .evaluateAll((tabs) => tabs.map((tab) => tab.id));
    await choose(paths[2]);
    assert.deepEqual(
      await page
        .locator('[data-slot="doc-tabs"] [role="tab"]')
        .evaluateAll((tabs) => tabs.map((tab) => tab.id)),
      visibleBefore,
      "Selecting a visible tab must not move the tab window",
    );
    results.push({ name: `${theme}: switch tab mid-morph`, state: await settled(paths[2]) });
    await choose(paths[0]);
    results.push({ name: `${theme}: overflow selection`, state: await settled(paths[0]) });
    await page.goBack();
    results.push({ name: `${theme}: browser back`, state: await settled(paths[2]) });
    await page.goForward();
    results.push({ name: `${theme}: browser forward`, state: await settled(paths[0]) });
    await choose(first);
    await settled(first);

    let releaseRead, sawRead;
    const held = new Promise((resolve) => {
      releaseRead = resolve;
    });
    const intercepted = new Promise((resolve) => {
      sawRead = resolve;
    });
    const delayed = paths[2];
    const delayRoute = async (route) => {
      if (
        new URL(route.request().url()).searchParams.get("path") === delayed &&
        route.request().method() === "GET"
      ) {
        sawRead();
        await held;
      }
      await route.continue();
    };
    await page.route("**/api/workspace/file?*", delayRoute);
    await page.evaluate(async () => {
      const { diagramStore } = await window.__navModule("/src/state/diagram-store.ts");
      window.__navTrace = [];
      window.__navUnsubscribe = diagramStore.subscribe(() =>
        window.__navTrace.push({ path: diagramStore.get().path, hash: window.location.hash }),
      );
    });
    try {
      await choose(delayed);
      await intercepted;
      await expect(page.locator('[data-slot="document-loading"]')).toBeVisible();
      await page.keyboard.press("p");
      await expect(page.locator('[data-slot="document-loading"]')).toBeVisible();
      assert.ok(
        (await snapshot()).layers.every((layer) => layer.painted === 0),
        "Old diagram painted under the requested tab",
      );
      await choose(first);
      await settled(first);
      const response = page.waitForResponse(
        (r) =>
          r.request().method() === "GET" && new URL(r.url()).searchParams.get("path") === delayed,
      );
      releaseRead();
      await (await response).finished();
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      results.push({
        name: `${theme}: delayed A-B-A response discarded`,
        state: await settled(first),
      });
      const trace = await page.evaluate(() => window.__navTrace);
      assert.ok(
        trace.every((entry) => entry.path === first),
        JSON.stringify(trace),
      );
    } finally {
      releaseRead();
      await page.unroute("**/api/workspace/file?*", delayRoute);
      await page.evaluate(() => window.__navUnsubscribe());
    }
    let failNext = true;
    const failRoute = async (route) => {
      if (
        route.request().method() === "GET" &&
        new URL(route.request().url()).searchParams.get("path") === delayed &&
        failNext
      ) {
        failNext = false;
        await route.fulfill({ status: 500, json: { error: "Temporary test failure" } });
      } else await route.continue();
    };
    await page.route("**/api/workspace/file?*", failRoute);
    try {
      await choose(delayed);
      await expect(page.locator('[data-slot="document-load-error"]')).toBeVisible();
      assert.equal((await snapshot()).selected, tabId(delayed));
      assert.ok((await snapshot()).layers.every((layer) => layer.painted === 0));
      const retry = page.getByRole("button", { name: "Retry", exact: true });
      await retry.focus();
      await page.keyboard.press("Enter");
      results.push({
        name: `${theme}: failed load retries the selected document`,
        state: await settled(delayed),
      });
      await expect(page.locator(`#${tabId(delayed)}`)).toBeFocused();
    } finally {
      await page.unroute("**/api/workspace/file?*", failRoute);
    }
    // A direct visual link must paint only visual nodes on its first load, too.
    await page.goto(`${base}/#d/${first}&lens=visual`);
    await page.locator('[data-lens-pane="visual"] .react-flow__node').first().waitFor();
    results.push({ name: `${theme}: cold visual link`, state: await settled(first, "visual") });
    if (evidence) await page.screenshot({ path: `${evidence}/${theme}-visual.png` });
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log(`PASS ${results.length} navigation checks; no browser errors or document writes`);
} catch (error) {
  if (evidence && page && !page.isClosed()) {
    await page.screenshot({ path: `${evidence}/failure.png` });
    results.push({
      name: "failure state",
      state: await snapshot().catch((e) => ({ error: e.message })),
    });
  }
  throw error;
} finally {
  if (evidence)
    await writeFile(
      `${evidence}/results.json`,
      JSON.stringify({ results, errors, writes }, null, 2),
    );
  await browser.close();
}
