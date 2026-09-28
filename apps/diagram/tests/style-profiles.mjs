/** Actual profile paint, workspace reload and read-only lens regression. */
/* global window, document, localStorage, performance, getComputedStyle, requestAnimationFrame, URL, process, console */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5444";
const evidence = process.env.STYLE_EVIDENCE;
if (evidence) await mkdir(evidence, { recursive: true });
const config = new URL("../workspace/atlas.config.yaml", import.meta.url);
const saved = await readFile(config).catch(() => null);
const browser = await chromium.launch();
const results = [],
  errors = [],
  writes = [];
async function state(page) {
  return page.evaluate(async () => {
    const { diagramStore } = await window.__styleModule("/src/state/diagram-store.ts");
    const { lensStore } = await window.__styleModule("/src/shell/lens-store.ts");
    const d = diagramStore.get();
    const pane = document.querySelector('[data-lens-pane="visual"]');
    const paint = (el) =>
      el
        ? { background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }
        : null;
    return {
      path: d.path,
      text: d.text,
      dirty: d.dirty,
      lens: lensStore.get(),
      background: paint(pane?.querySelector(".bg-canvas")),
      heroes: [...(pane?.querySelectorAll('[data-hero="true"]') ?? [])].map(paint),
      boxes: [...(pane?.querySelectorAll('[data-slot="capability-box"]') ?? [])].map(paint),
      technicalVisible: document
        .querySelector('[data-lens-pane="technical"]')
        .checkVisibility({ visibilityProperty: true, opacityProperty: true }),
    };
  });
}
try {
  await rm(config, { force: true });
  for (const theme of ["light", "dark", "qlik-light", "qlik-dark"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript((theme) => {
      localStorage.setItem("brand-ui-theme", theme);
      performance.setResourceTimingBufferSize(20000);
      window.__styleModule = (path) => {
        const url = performance
          .getEntriesByType("resource")
          .findLast((r) => new URL(r.name).pathname === path)?.name;
        if (!url) throw new Error(`Missing module ${path}`);
        return import(url);
      };
    }, theme);
    const page = await context.newPage();
    let streams = 0;
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.url().endsWith("/api/workspace/events")) streams++;
      if (request.url().includes("/api/workspace/") && !["GET", "HEAD"].includes(request.method()))
        writes.push(request.url());
    });
    await page.goto(`${base}/#d/templates/qlik-cloud-customer-landscape.yaml`);
    await expect
      .poll(async () => (await state(page)).path)
      .toBe("templates/qlik-cloud-customer-landscape.yaml");
    const original = (await state(page)).text;
    await page.getByRole("radio", { name: "Visual view (L)", exact: true }).click();
    await expect.poll(async () => (await state(page)).lens.position).toBe(1);
    const rendered = await state(page);
    assert(rendered.boxes.length > 0);
    assert.equal(rendered.technicalVisible, false);
    if (theme.startsWith("qlik")) {
      assert.equal(rendered.background.background, "rgb(14, 35, 64)");
      assert(rendered.heroes.length > 0, "Qlik provider must paint at least one hero");
      assert(
        rendered.heroes.every(
          (p) => p.background === "rgb(0, 122, 56)" && p.color === "rgb(255, 255, 255)",
        ),
      );
      assert(rendered.boxes.some((p) => p.background === "rgb(30, 78, 120)"));
    } else {
      assert.equal(rendered.heroes.length, 0);
      assert.notEqual(rendered.background.background, "rgb(14, 35, 64)");
    }
    if (evidence) await page.screenshot({ path: `${evidence}/${theme}.png` });
    await page.getByRole("radio", { name: "Technical view (L)", exact: true }).click();
    await expect.poll(async () => (await state(page)).lens.position).toBe(0);
    assert.equal((await state(page)).text, original);
    if (theme === "qlik-light") {
      const configState = () =>
        page.evaluate(async () => {
          const s = await window.__styleModule("/src/style/config-service.ts");
          return {
            config: s.currentStyleConfig(),
            issues: s.styleConfigIssues(),
            version: s.styleConfigVersion(),
          };
        });
      await writeFile(config, "styles:\n  technical: atlas-clean\n  visual: qlik-marketecture\n");
      await expect
        .poll(async () => (await configState()).config.styles?.visual)
        .toBe("qlik-marketecture");
      await writeFile(config, "styles:\n  visual: atlas-clean\n");
      await expect.poll(async () => (await configState()).issues.length).toBeGreaterThan(0);
      assert.equal((await configState()).config.styles.visual, "qlik-marketecture");
      await expect(
        page.getByText("Workspace style configuration could not be applied", { exact: true }),
      ).toBeVisible();
      await rm(config);
      await expect.poll(async () => (await configState()).config).toEqual({});
      assert.deepEqual((await configState()).issues, []);
      assert.equal(streams, 1, `Expected one shared event stream; got ${streams}`);
      assert.equal((await state(page)).text, original);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(async () =>
        (await window.__styleModule("/src/shell/lens-store.ts")).lensActions.setLens("visual"),
      );
      await expect.poll(async () => (await state(page)).lens.position).toBe(1);
      assert((await state(page)).boxes.length > 0);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      if (evidence) await page.screenshot({ path: `${evidence}/qlik-phone.png` });
    }
    if (theme === "qlik-dark") {
      await page.evaluate(async () => {
        const { lensActions } = await window.__styleModule("/src/shell/lens-store.ts");
        lensActions.setLens("visual");
      });
      await expect
        .poll(async () => {
          const lens = (await state(page)).lens;
          return lens.animating && lens.position > 0 && lens.position < 1;
        })
        .toBe(true);
      await page.getByRole("button", { name: "Theme", exact: true }).click();
      await page.getByRole("menuitemradio", { name: "Default", exact: true }).click();
      const frame = await page.evaluate(async () => {
        const { lensStore } = await window.__styleModule("/src/shell/lens-store.ts");
        await new Promise(requestAnimationFrame);
        return {
          theme: document.documentElement.dataset.theme,
          lens: lensStore.get(),
          ghosts: [...document.querySelectorAll('[data-slot="lens-morph-overlay"]')].filter((el) =>
            el.checkVisibility({ visibilityProperty: true, opacityProperty: true }),
          ).length,
        };
      });
      assert.equal(frame.theme, "dark");
      assert.equal(frame.lens.animating, false);
      assert.equal(frame.lens.position, 1);
      assert.equal(frame.ghosts, 0);
      assert.equal((await state(page)).text, original);
    }
    results.push({
      theme,
      boxes: rendered.boxes.length,
      heroes: rendered.heroes.length,
      background: rendered.background,
    });
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log(JSON.stringify({ results, errors, writes }, null, 2));
  if (evidence)
    await writeFile(
      `${evidence}/browser.json`,
      JSON.stringify({ results, errors, writes }, null, 2),
    );
} finally {
  await browser.close();
  if (saved) await writeFile(config, saved);
  else await rm(config, { force: true });
}
