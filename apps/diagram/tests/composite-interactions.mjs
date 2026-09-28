/** Real composite expansion and isolated nested inspection, with unchanged parent/source bytes. */
/* global process, console, window, performance, URL, localStorage, document */
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5427";
const evidence = process.env.COMPOSITE_EVIDENCE;
const folder = `composite-ui-${process.pid}`;
const dir = new URL(`../workspace/${folder}/`, import.meta.url);
const parent = `diagram: "1"\ntitle: Parent proof\nnodes:\n  - id: tenant\n    ref: ws/${folder}/child\n  - id: outside\n    title: Outside\nflows:\n  - from: outside\n    to: tenant.leaf\n`;
const child = `diagram: "1"\ntitle: Child proof\nnodes:\n  - id: leaf\n    title: Child leaf\n    description: Child-only details\n  - id: nested\n    ref: ws/${folder}/nested\nflows:\n  - from: leaf\n    to: nested\n`;
const nested =
  'diagram: "1"\ntitle: Nested proof\nnodes:\n  - id: service\n    title: Nested service\n';
const browser = await chromium.launch();
const results = [],
  errors = [];
let page;
const poll = async (fn, label) => {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    if (await fn()) return;
    await setTimeout(40);
  }
  throw Error(`Timed out: ${label}`);
};
const state = () =>
  page.evaluate(async () => {
    const { diagramStore } = await window.moduleFor("/src/state/diagram-store.ts");
    const s = diagramStore.get();
    return {
      path: s.path,
      text: s.text,
      load: s.loadCount,
      selected: s.selectedId,
      dirty: s.dirty,
    };
  });
const rootNode = (id) =>
  page.locator(`[data-lens-pane="technical"] .react-flow__node[data-id="${id}"]`).first();
const drillNode = (id) =>
  page.locator(`[data-slot="drill-canvas"] .react-flow__node[data-id="${id}"]`);
try {
  await mkdir(dir, { recursive: true });
  if (evidence) await mkdir(evidence, { recursive: true });
  await Promise.all([
    writeFile(new URL("child.yaml", dir), child),
    writeFile(new URL("nested.yaml", dir), nested),
  ]);
  for (const [theme, width] of [
    ["light", 1440],
    ["dark", 1440],
    ["light", 390],
    ["dark", 390],
  ]) {
    const path = `${folder}/${theme}-${width}.yaml`;
    await writeFile(new URL(`${theme}-${width}.yaml`, dir), parent);
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    page = await context.newPage();
    const writes = [];
    await page.addInitScript((theme) => {
      localStorage.setItem("brand-ui-theme", theme);
      performance.setResourceTimingBufferSize(10000);
      const urls = new Map();
      window.moduleFor = (path) => {
        if (!urls.has(path))
          urls.set(
            path,
            performance
              .getEntriesByType("resource")
              .findLast((e) => new URL(e.name).pathname === path)?.name,
          );
        if (!urls.get(path)) throw Error(`Missing ${path}`);
        return import(urls.get(path));
      };
    }, theme);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (["PUT", "POST", "DELETE"].includes(r.method()) && r.url().includes("/api/workspace/"))
        writes.push(r.url());
    });
    await page.goto(`${base}/#d/${path}`);
    await rootNode("tenant")
      .getByRole("button", { name: "Expand Child proof inline", exact: true })
      .waitFor();
    const before = await state();
    await rootNode("tenant")
      .getByRole("button", { name: "Expand Child proof inline", exact: true })
      .click();
    await rootNode("tenant.leaf").waitFor();
    await poll(
      async () =>
        rootNode("tenant")
          .getByRole("button", { name: "Collapse Child proof", exact: true })
          .isEnabled(),
      "expanded layout",
    );
    await rootNode("tenant")
      .getByRole("button", { name: "Collapse Child proof", exact: true })
      .click();
    await poll(async () => !(await rootNode("tenant.leaf").count()), "viewer collapse");
    assert.equal((await state()).text, parent);
    assert.equal(writes.length, 0);
    await rootNode("tenant").focus();
    await page.keyboard.press("Enter");
    await page.locator('[data-slot="drill-canvas"][data-ready="true"]').waitFor();
    assert.match(page.url(), /into=tenant/);
    assert.equal((await state()).load, before.load);
    await drillNode("nested").focus();
    await page.keyboard.press("Enter");
    await drillNode("service").waitFor();
    assert.match(page.url(), /into=tenant.nested/);
    await page.keyboard.press("Delete");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Meta+z");
    assert.equal((await state()).text, parent);
    assert.equal((await state()).path, path);
    await page.keyboard.press("Escape");
    await drillNode("nested").waitFor();
    await page.keyboard.press("Escape");
    await poll(
      async () => !(await page.locator('[data-slot="drill-down"]').count()),
      "parent restored",
    );
    assert.equal((await state()).load, before.load);
    assert.equal((await state()).text, parent);
    assert.equal(writes.length, 0);
    // Presentation has no shell toolbar; the inspection surface supplies its own navigation.
    await page.evaluate(() => {
      window.location.hash += "&present&into=tenant.nested";
    });
    await drillNode("service").waitFor();
    await page
      .getByRole("navigation", { name: "Diagram inspection" })
      .getByRole("button", { name: "Parent proof", exact: true })
      .click();
    await poll(async () => !page.url().includes("into="), "presentation breadcrumb return");
    await page.evaluate(() => {
      window.location.hash = window.location.hash.replace("&present", "");
    });
    await page.getByRole("button", { name: /^Edit/ }).click();
    const editor = page.locator(".monaco-editor textarea").first();
    if (width < 768) await page.getByRole("tab", { name: "Editor", exact: true }).click();
    await editor.focus();
    await page.keyboard.press("Meta+End");
    await page.keyboard.type("\n# parent undo proof");
    await poll(async () => (await state()).text.includes("# parent undo proof"), "Monaco edit");
    const editedBeforeDrill = await state();
    if (width < 768) await page.getByRole("tab", { name: "Canvas", exact: true }).click();
    const viewportBefore = await page
      .locator('[data-lens-pane="technical"] .react-flow__viewport')
      .getAttribute("style");
    await rootNode("tenant").focus();
    await page.keyboard.press("Enter");
    await drillNode("nested").waitFor();
    await page.keyboard.press("Escape");
    await poll(async () => !page.url().includes("into="), "edit inspection return");
    await poll(
      async () =>
        (await page
          .locator('[data-lens-pane="technical"] .react-flow__viewport')
          .getAttribute("style")) === viewportBefore,
      "exact parent camera restored",
    );
    assert.equal((await state()).load, editedBeforeDrill.load);
    if (width < 768) await page.getByRole("tab", { name: "Editor", exact: true }).click();
    await editor.focus();
    await page.keyboard.press("Meta+z");
    await poll(
      async () => !(await state()).text.includes("# parent undo proof"),
      "Monaco undo survives inspection",
    );
    if (width < 768) await page.getByRole("tab", { name: "Canvas", exact: true }).click();
    await rootNode("tenant")
      .getByRole("button", { name: "Expand Child proof inline", exact: true })
      .click();
    await rootNode("tenant.leaf").waitFor();
    await poll(async () => /expand: true/.test((await state()).text), "authored expansion");
    await rootNode("tenant.leaf").click();
    await page.getByText("Read-only · leaf", { exact: true }).waitFor();
    const edited = await state();
    await page.keyboard.press("Delete");
    assert.equal((await state()).text, edited.text);
    if (width < 768) await page.keyboard.press("Escape");
    if (evidence) await page.screenshot({ path: `${evidence}/${theme}-${width}.png` });
    assert.equal(await readFile(new URL("child.yaml", dir), "utf8"), child);
    assert.equal(await readFile(new URL("nested.yaml", dir), "utf8"), nested);
    results.push({
      theme,
      width,
      checks: [
        "viewer expansion/collapse no writes",
        "nested keyboard inspection",
        "parent store preserved",
        "readonly shortcuts",
        "escape restoration",
        "authored expansion",
        "readonly inner selection",
        "child bytes unchanged",
        "presentation breadcrumb",
        "parent camera restored",
        "Monaco undo preserved",
      ],
    });
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ results, errors }, null, 2));
} catch (e) {
  if (page)
    console.log(
      "Failure state",
      await state(),
      await page
        .evaluate(async () => {
          const m = await window.moduleFor("/src/state/component-files.ts");
          return [...m.currentComponentFiles()].map(([p, f]) => [p, f]);
        })
        .catch(String),
    );
  if (page && evidence) await page.screenshot({ path: `${evidence}/failure.png` });
  throw e;
} finally {
  await browser.close();
  await rm(dir, { recursive: true, force: true });
}
