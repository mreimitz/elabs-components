/** Creation succeeded but navigation failed: keep edits and expose the created file. */
/* global window, performance, URL, process, console */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile, readFile, rm } from "node:fs/promises";
const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const base = process.env.DIAGRAM_URL ?? "http://127.0.0.1:5443";
const originalName = `recovery-original-${process.pid}.yaml`,
  createdName = `recovery-created-${process.pid}.yaml`;
const original = 'diagram: "1"\ntitle: Recovery original\nnodes: [{id: a}]\n';
const originalFile = new URL(`../workspace/${originalName}`, import.meta.url),
  createdFile = new URL(`../workspace/${createdName}`, import.meta.url);
const browser = await chromium.launch();
const errors = [];
try {
  await writeFile(originalFile, original);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    performance.setResourceTimingBufferSize(10000);
    window.__recoveryModule = (path) =>
      import(
        performance.getEntriesByType("resource").findLast((r) => new URL(r.name).pathname === path)
          .name
      );
  });
  await page.route("**/api/workspace/file?*", async (route) => {
    if (
      route.request().method() === "PUT" &&
      new URL(route.request().url()).searchParams.get("path") === originalName
    )
      await route.fulfill({
        status: 503,
        json: { error: "Test save unavailable", code: "unavailable" },
      });
    else await route.continue();
  });
  await page.goto(`${base}/#d/${originalName}`);
  await page.getByRole("button", { name: /^Edit/ }).click();
  const edited = original + "# Keep unsaved work\n";
  await page.evaluate(async (text) => {
    const { diagramActions } = await window.__recoveryModule("/src/state/diagram-store.ts");
    diagramActions.setText(text);
  }, edited);
  if (!(await page.getByRole("button", { name: "Workspace actions", exact: true }).isVisible()))
    await page.getByRole("button", { name: "Toggle Sidebar", exact: true }).click();
  await page.getByRole("button", { name: "Workspace actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "New diagram", exact: true }).click();
  await page.getByRole("dialog").getByRole("textbox").fill(createdName.replace(".yaml", ""));
  await page.getByRole("dialog").getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText("Diagram created, but not opened", { exact: true })).toBeVisible();
  const result = await page.evaluate(async () => {
    const { diagramStore } = await window.__recoveryModule("/src/state/diagram-store.ts");
    const { workspaceStore } = await window.__recoveryModule("/src/workspace/workspace-store.ts");
    return {
      path: diagramStore.get().path,
      text: diagramStore.get().text,
      files: workspaceStore.get().tree.files.map((f) => f.path),
    };
  });
  assert.equal(result.path, originalName);
  assert.equal(result.text, edited);
  assert(result.files.includes(createdName));
  assert((await readFile(createdFile, "utf8")).includes(createdName.replace(".yaml", "")));
  assert.equal(await readFile(originalFile, "utf8"), original);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: created file retained and visible; unsaved original preserved; accurate toast; no browser errors",
  );
} finally {
  await browser.close();
  await rm(originalFile, { force: true });
  await rm(createdFile, { force: true });
}
