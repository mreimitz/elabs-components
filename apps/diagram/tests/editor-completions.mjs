/** Real Monaco suggestion regression. Use an isolated DIAGRAM_URL checkout; this suite
 * creates and removes one disposable workspace file. EDITOR_EVIDENCE saves screenshots. */
/* global window, performance, localStorage, URL, process, console, document, getComputedStyle */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { checkProviderLifecycle } from "./editor-provider-lifecycle.mjs";
const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5410";
const evidence = process.env.EDITOR_EVIDENCE;
if (evidence) await mkdir(evidence, { recursive: true });
const file = `completion-check-${process.pid}.yaml`;
const disk = new URL(`../workspace/${file}`, import.meta.url);
const header =
  'diagram: "1"\ntitle: Completion check\nnodes:\n  - id: source\n    title: Source service\n  - id: target\n';
const browser = await chromium.launch();
const results = [],
  errors = [],
  writes = [];
let activePage;
try {
  await writeFile(disk, `${header}    ref: catalog/aws/rds\n`);
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript((theme) => {
      localStorage.setItem("brand-ui-theme", theme);
      performance.setResourceTimingBufferSize(10000);
      window.__completionModule = (pathname) => {
        const url = performance
          .getEntriesByType("resource")
          .findLast((e) => new URL(e.name).pathname === pathname)?.name;
        if (!url) throw new Error(`Module not loaded: ${pathname}`);
        return import(url);
      };
    }, theme);
    const page = await context.newPage();
    activePage = page;
    page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
    page.on("request", (request) => {
      if (["PUT", "POST", "DELETE"].includes(request.method()))
        writes.push({ url: request.url(), body: request.postData() });
    });
    await page.goto(`${base}/#d/${file}`);
    await page.waitForFunction(
      (theme) => getComputedStyle(document.documentElement).colorScheme === theme,
      theme,
    );
    const state = () =>
      page.evaluate(async () => {
        const { diagramStore } = await window.__completionModule("/src/state/diagram-store.ts");
        return { text: diagramStore.get().text, path: diagramStore.get().path };
      });
    await expect.poll(async () => (await state()).path).toBe(file);
    await page.getByRole("button", { name: /^Edit/ }).click();
    const input = page.locator(".monaco-editor textarea");
    await expect(input).toBeVisible();
    const popup = page.locator(".suggest-widget.visible");
    async function prepare(text) {
      await page.keyboard.press("Escape");
      await page.evaluate(async (text) => {
        const url = performance
          .getEntriesByType("resource")
          .findLast((entry) => new URL(entry.name).pathname.endsWith("/monaco-editor.js"))?.name;
        if (!url) throw new Error("The editor's Monaco module is not loaded");
        const monaco = await import(url);
        const editor = monaco.editor
          .getEditors()
          .find((editor) => editor.getModel()?.getLanguageId() === "yaml");
        if (!editor) throw new Error("YAML editor not found");
        window.__completionEditor = editor;
        editor.getModel().setValue(text);
        editor.setPosition(editor.getModel().getPositionAt(text.length));
        editor.focus();
      }, text);
      await expect.poll(async () => (await state()).text).toBe(text);
      await page.keyboard.press("Escape");
    }
    async function accept(label, expectedText) {
      await expect(popup).toBeVisible();
      const row = popup
        .locator(".monaco-list-row")
        .filter({ has: page.locator(".label-name", { hasText: label }) })
        .first();
      await expect(row).toBeVisible();
      // Navigate to the matching suggestion and accept from the keyboard.
      const index = Number(await row.getAttribute("data-index"));
      const focusedIndex = Number(
        await popup.locator(".monaco-list-row.focused").getAttribute("data-index"),
      );
      for (let i = 0; i < Math.abs(index - focusedIndex); i++)
        await page.keyboard.press(index > focusedIndex ? "ArrowDown" : "ArrowUp");
      await page.keyboard.press("Tab");
      await expect.poll(async () => (await state()).text).toBe(expectedText);
    }
    await prepare(`${header}    ref: catalog`);
    await page.keyboard.type("/");
    await expect(popup).toBeVisible();
    assert.equal(
      await popup
        .locator(".highlight")
        .first()
        .evaluate((element) => {
          const probe = document.createElement("span");
          probe.style.color = "var(--primary-text)";
          element.append(probe);
          const readable = getComputedStyle(probe).color;
          probe.remove();
          return getComputedStyle(element).color === readable;
        }),
      true,
    );
    if (evidence) await page.screenshot({ path: `${evidence}/${theme}-catalog.png` });
    await page.keyboard.type("aws/rd");
    await accept("catalog/aws/rds", `${header}    ref: catalog/aws/rds`);
    results.push(
      `${theme}: slash triggers catalog suggestions; keyboard acceptance writes a valid full reference`,
    );

    await prepare(`${header}    ref: "catalog/aws/rd" # retained`);
    for (let i = 0; i < '" # retained'.length; i++) await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Control+Space");
    await accept("catalog/aws/rds", `${header}    ref: "catalog/aws/rds" # retained`);
    results.push(`${theme}: Ctrl+Space replaces a quoted value and preserves its comment`);

    await prepare(`${header}    ref: ws/Qlik Cloud ten`);
    await page.keyboard.press("Control+Space");
    await accept("qlik-cloud-tenant", `${header}    ref: ws/components/qlik-cloud-tenant`);
    results.push(`${theme}: workspace title lookup inserts its real filename`);

    await prepare(`${header}    icon: aws/la`);
    await page.keyboard.press("Control+Space");
    await accept("aws/lambda", `${header}    icon: aws/lambda`);
    await prepare('diagram: "1"\ndire');
    await page.keyboard.press("Control+Space");
    await accept("direction", 'diagram: "1"\ndirection: ');
    await page.keyboard.type("T");
    await page.keyboard.press("Control+Space");
    await accept("TB", 'diagram: "1"\ndirection: TB');
    results.push(`${theme}: icon names, schema keys and enum values complete`);
    await prepare(`${header}    ty`);
    await page.keyboard.press("Control+Space");
    await accept("type", `${header}    type: `);
    await page.keyboard.type("serv");
    await page.keyboard.press("Control+Space");
    await accept("service", `${header}    type: service`);
    const nested =
      'diagram: "1"\nzones:\n  - id: outer\n    children:\n      - id: child\n        ';
    await prepare(`${nested}stat`);
    await page.keyboard.press("Control+Space");
    await accept("status", `${nested}status: `);
    await page.keyboard.type("degr");
    await page.keyboard.press("Control+Space");
    await accept("degraded", `${nested}status: degraded`);
    results.push(`${theme}: conditional node schemas and nested child enums complete`);

    await prepare(`${header}    title: Target\nflows:\n  - from: source\n    to: sou`);
    await page.keyboard.press("Control+Space");
    await accept("source", `${header}    title: Target\nflows:\n  - from: source\n    to: source`);
    results.push(`${theme}: flow endpoints use live document ids`);
    await prepare(`${header}    title: Target\nflows:\n  - source ->`);
    await page.keyboard.type(" ");
    await accept("target", `${header}    title: Target\nflows:\n  - source -> target`);
    results.push(`${theme}: shorthand arrow offers endpoint ids automatically`);

    const reference = 'diagram: "1"\nnodes:\n  - id: database\n    ref: catalog/aws/rds\n';
    await prepare(`${reference}flows:\n  - from: data`);
    await page.keyboard.press("Control+Space");
    await expect(popup).toContainText("Rds");
    await accept("database", `${reference}flows:\n  - from: database`);
    const hover = page.locator(".monaco-hover").filter({ hasText: "Rds" });
    await page.evaluate(() =>
      window.__completionEditor.trigger("test", "editor.action.showHover", {}),
    );
    await expect(hover).toBeVisible();
    await expect(hover).toHaveCSS("opacity", "1");
    await expect(hover).toContainText("service");
    await expect(hover.locator('img[src$="/icons/aws/rds.svg"]')).toBeVisible();
    await expect
      .poll(() =>
        hover.locator("img").evaluate((image) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true);
    if (evidence) await page.screenshot({ path: `${evidence}/${theme}-inherited-hover.png` });
    await page.keyboard.press("Escape");
    await prepare(reference.trimEnd());
    await page.evaluate(() =>
      window.__completionEditor.trigger("test", "editor.action.showHover", {}),
    );
    const catalogHover = page.locator(".monaco-hover").filter({ hasText: "Rds" });
    await expect(catalogHover).toBeVisible();
    await expect
      .poll(() =>
        catalogHover
          .locator('img[src$="/icons/aws/rds.svg"]')
          .evaluate((image) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true);
    results.push(`${theme}: catalog-reference hover renders a loaded same-origin icon`);
    const overridden =
      reference +
      "    title: Customer queue\n    type: queue\n    icon: aws/lambda\n    description: Current description\nflows:\n  - to: database";
    await prepare(overridden);
    await page.evaluate(() =>
      window.__completionEditor.trigger("test", "editor.action.showHover", {}),
    );
    const overrideHover = page.locator(".monaco-hover").filter({ hasText: "Customer queue" });
    await expect(overrideHover).toBeVisible();
    await expect(overrideHover).toContainText("queue");
    await expect(overrideHover).toContainText("Current description");
    await expect(overrideHover.locator('img[src$="/icons/aws/lambda.svg"]')).toBeVisible();
    await expect(overrideHover).not.toContainText("Rds");
    results.push(
      `${theme}: endpoint suggestions and rendered hover inherit catalog metadata; explicit overrides and icon previews win`,
    );

    await prepare(overridden.replace("title: Customer queue", 'title: ""'));
    await page.evaluate(() =>
      window.__completionEditor.trigger("test", "editor.action.showHover", {}),
    );
    const emptyTitleHover = page
      .locator(".monaco-hover")
      .filter({ hasText: "Current description" });
    await expect(emptyTitleHover).toBeVisible();
    await expect(emptyTitleHover).toContainText("queue");
    await expect(emptyTitleHover.locator('img[src$="/icons/aws/lambda.svg"]')).toBeVisible();
    await expect(emptyTitleHover).not.toContainText("Rds");
    await expect(emptyTitleHover).not.toContainText("****");
    results.push(`${theme}: an explicitly empty title keeps the remaining hover metadata`);

    await prepare('diagram: "1"\nnodes:\n  - comp');
    await page.keyboard.press("Control+Space");
    await accept(
      "component reference",
      'diagram: "1"\nnodes:\n  - id: component\n    ref: ws/components/qlik-cloud-tenant\n    expand: false',
    );
    const selectedText = () =>
      page.evaluate(() => {
        const editor = window.__completionEditor;
        return editor.getModel().getValueInRange(editor.getSelection());
      });
    assert.equal(await selectedText(), "component");
    await page.keyboard.type("tenant");
    await page.keyboard.press("Tab");
    assert.equal(await selectedText(), "components/qlik-cloud-tenant");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Escape");
    assert.equal(
      (await state()).text,
      'diagram: "1"\nnodes:\n  - id: tenant\n    ref: ws/components/qlik-cloud-tenant\n    expand: false',
    );
    results.push(
      `${theme}: component reference snippet inserts valid ref: ws YAML and keyboard tab stops`,
    );
    await prepare('diagram: "1"\ncomp');
    await page.keyboard.press("Control+Space");
    await accept(
      "component reference",
      'diagram: "1"\nnodes:\n  - id: component\n    ref: ws/components/qlik-cloud-tenant\n    expand: false',
    );
    assert.equal(await selectedText(), "component");
    await page.keyboard.press("Escape");
    results.push(
      `${theme}: component reference snippet at root creates nodes without colliding with component metadata`,
    );
    const lifecycle = await checkProviderLifecycle(page);
    assert.equal(lifecycle.length, 6);
    results.push(
      ...lifecycle.map(
        (result) =>
          `${theme}: ${result.mutation} discards pending edits and disposes both providers once`,
      ),
    );

    await prepare(`${header}    # ref: catalog/`);
    await page.keyboard.press("Control+Space");
    await expect(popup.locator(".monaco-list-row")).toHaveCount(0);
    await prepare(`${header}    description: |\n      ref: catalog/`);
    await page.keyboard.press("Control+Space");
    await expect(popup.locator(".monaco-list-row")).toHaveCount(0);
    results.push(`${theme}: comments and block descriptions do not offer structural completions`);
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { workspaceStore } = await window.__completionModule(
            "/src/workspace/workspace-store.ts",
          );
          const state = workspaceStore.get();
          return !state.dirty && ["idle", "saved"].includes(state.save);
        }),
      )
      .toBe(true);
    await page.evaluate(() => {
      window.location.hash = "d/components/qlik-cloud-tenant.yaml";
    });
    await expect.poll(async () => (await state()).path).toBe("components/qlik-cloud-tenant.yaml");
    await page.evaluate((file) => {
      window.location.hash = `d/${file}`;
    }, file);
    await expect.poll(async () => (await state()).path).toBe(file);
    await expect(input).toBeVisible();
    await prepare(`${header}    ref: catalog/aws/rd`);
    await page.keyboard.press("Control+Space");
    await accept("catalog/aws/rds", `${header}    ref: catalog/aws/rds`);
    results.push(`${theme}: completions survive document/editor replacement`);
    const otherTheme = theme === "light" ? "Dark" : "Light";
    await page.getByRole("button", { name: "Theme", exact: true }).click();
    await page.getByRole("menuitemradio", { name: otherTheme, exact: true }).click();
    await page.waitForFunction(
      (theme) =>
        getComputedStyle(document.documentElement).colorScheme === theme &&
        !document.documentElement.hasAttribute("data-vt"),
      otherTheme.toLowerCase(),
    );
    await expect(input).toBeVisible();
    await prepare(`${header}    ref: catalog`);
    await page.keyboard.type("/aws/rd");
    await accept("catalog/aws/rds", `${header}    ref: catalog/aws/rds`);
    results.push(`${theme}: in-place theme switch keeps autocomplete working`);

    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.ok(
    writes.every(
      ({ url, body }) => url.includes(file.replace(/\.yaml$/, "")) || body?.includes(file),
    ),
    JSON.stringify(writes),
  );
  console.log(
    `PASS ${results.length} completion checks; no browser errors; only the disposable fixture changed`,
  );
} catch (error) {
  if (evidence && activePage && !activePage.isClosed())
    await activePage.screenshot({ path: `${evidence}/failure.png` });
  throw error;
} finally {
  if (evidence)
    await writeFile(
      `${evidence}/results.json`,
      JSON.stringify({ results, errors, writes: writes.map(({ url }) => url) }, null, 2),
    );
  await browser.close();
  await rm(disk, { force: true });
  await rm(new URL(`../workspace/${file.replace(/\.yaml$/, ".thumb.png")}`, import.meta.url), {
    force: true,
  });
}
