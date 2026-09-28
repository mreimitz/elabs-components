/** Isolated Chromium regression. Requires PLAYWRIGHT_MODULE when playwright is not resolvable.
 * ATLAS_URL selects the disposable dev server; ATLAS_EVIDENCE optionally saves screenshots.
 * Run: node scripts/tests/reference-browser.mjs (from apps/diagram).
 */
/* global document, getComputedStyle */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const catalogFile = new URL("../../catalog/parts/snowflake.yaml", import.meta.url);
const catalogOriginal = await readFile(catalogFile, "utf8");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.ATLAS_URL ?? "http://localhost:5411";
const path = `examples/reference-regression-${Date.now()}.yaml`;
const source =
  'diagram: "1"\ntitle: Reference regression\nnodes:\n  - id: probe\n    ref: catalog/snowflake/database\n';
const endpoint = `${base}/api/workspace/file?path=${encodeURIComponent(path)}`;
assert.equal((await fetch(`${endpoint}&create=1`, { method: "PUT", body: source })).ok, true);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
const written = () =>
  page.evaluate(async () => (await import("/src/state/diagram-store.ts")).diagramStore.get().text);
const waitText = async (pattern) => {
  await page.waitForFunction(
    async (source) =>
      new RegExp(source).test(
        (await import("/src/state/diagram-store.ts")).diagramStore.get().text,
      ),
    pattern,
  );
};
const screenshot = async (name) => {
  if (!process.env.ATLAS_EVIDENCE) return;
  await mkdir(process.env.ATLAS_EVIDENCE, { recursive: true });
  await page.screenshot({ path: `${process.env.ATLAS_EVIDENCE}/${name}.png`, fullPage: true });
};
try {
  await page.goto(`${base}/#dev/spec-check`);
  await page.getByText(/82 of 82 checks pass/).waitFor();
  assert.equal(await page.locator('[data-pass="false"]').count(), 0);
  await page.goto(`${base}/#d/${path}`);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.locator('.react-flow__node[data-id="probe"]').click();
  const form = page.getByRole("form", { name: "Node", exact: true });
  const beforeCatalogEdit = await written();
  await writeFile(
    catalogFile,
    catalogOriginal.replace("name: Snowflake database", "name: Snowflake database live proof"),
  );
  await form
    .getByText("From the reference: Snowflake database live proof", { exact: true })
    .waitFor();
  assert.equal(await written(), beforeCatalogEdit);
  await writeFile(catalogFile, catalogOriginal);
  await form.getByText("From the reference: Snowflake database", { exact: true }).waitFor();
  await form.getByRole("button", { name: "Clear subtitle", exact: true }).click();
  await waitText('subtitle: ""');
  await form.getByRole("button", { name: "Use reference subtitle", exact: true }).click();
  const type = form.getByRole("combobox", { name: "Type", exact: true });
  await form.getByRole("textbox", { name: "Title", exact: true }).focus();
  await type.click();
  await page.getByRole("option", { name: "queue", exact: true }).click();
  await waitText("type: queue");
  await type.focus();
  await type.press("ArrowDown");
  await page.getByRole("option", { name: "From the reference: datastore", exact: true }).waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "option");
  await page.keyboard.press("Home");
  await page.waitForFunction(
    () => document.activeElement?.textContent === "From the reference: datastore",
  );
  await page
    .getByRole("option", { name: "From the reference: datastore", exact: true })
    .evaluate((el) => {
      if (document.activeElement !== el)
        throw new Error(
          `Home did not focus reference option: ${document.activeElement?.textContent}`,
        );
    });
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    async () =>
      !(await import("/src/state/diagram-store.ts")).diagramStore.get().text.includes("type:"),
  );
  assert.doesNotMatch(await written(), /type:/);
  assert.equal(await type.evaluate((el) => el === document.activeElement), true);
  const title = form.getByRole("textbox", { name: "Title", exact: true });
  await title.fill("Typing survives");
  await title.press("Backspace");
  await waitText("title: Typing survive");
  assert.equal(await page.locator('.react-flow__node[data-id="probe"]').count(), 1);
  const icon = form.getByRole("textbox", { name: "Icon", exact: true });
  await icon.fill("lucide/database");
  assert.equal(
    await form.getByText("From the reference: snowflake/snowflake", { exact: true }).count(),
    0,
  );
  await form.getByRole("button", { name: "Advanced", exact: true }).click();
  const subtitle = form.getByRole("textbox", { name: "Subtitle", exact: true });
  await subtitle.fill("Temporary subtitle");
  await subtitle.fill("");
  await waitText('subtitle: ""');
  await form.getByText("Cleared; the reference would show: Database", { exact: true }).waitFor();
  await screenshot("inspector-light-cleared");
  await form.getByRole("button", { name: "Use reference subtitle", exact: true }).click();
  assert.doesNotMatch(await written(), /subtitle:/);
  await form.getByRole("button", { name: "Advanced", exact: true }).click();
  await form.getByText("From the reference: Database", { exact: true }).waitFor();
  for (const [label, choice] of [
    ["Tone", "info"],
    ["Variant", "card"],
    ["Status", "planned"],
  ]) {
    const control = form.getByRole("combobox", { name: label, exact: true });
    await control.click();
    const option = page.getByRole("option", { name: choice, exact: true });
    await option.click();
    await waitText(`${label.toLowerCase()}: ${choice}`);
    assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), "BODY");
  }
  await page.getByRole("button", { name: "Theme", exact: true }).click();

  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => getComputedStyle(document.documentElement).colorScheme === "dark",
  );
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))),
  );
  await subtitle.scrollIntoViewIfNeeded();
  await screenshot("inspector-dark-restored");
  await page.goto(`${base}/#catalog/snowflake/database`);
  await page
    .getByText(/ref: catalog\/snowflake\/database/)
    .first()
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      result: "pass",
      specChecks: 82,
      mouseSelect: true,
      keyboardRestore: true,
      backspaceSafe: true,
      liveHelp: true,
      subtitleClearRestore: true,
      consoleErrors: errors,
    }),
  );
} finally {
  await writeFile(catalogFile, catalogOriginal);
  await browser.close();
  await fetch(`${base}/api/workspace/trash`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
}
