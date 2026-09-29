/** Additional offline controls and hostile envelope proof; run after publish-viewer.mjs. */
/* global document, window, process, console */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL, URL } from "node:url";
const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, firefox, webkit, expect } = require("@playwright/test");
const directory = process.env.PUBLISH_EVIDENCE;
if (!directory) throw Error("PUBLISH_EVIDENCE must identify the prior publish-viewer output.");
await mkdir(join(directory, "controls"), { recursive: true });
const original = await readFile(join(directory, "adversarial.html"), "utf8");
const pattern = /(<script id="atlas-snapshot" type="application\/json">)([\s\S]*?)(<\/script>)/;
const match = original.match(pattern);
assert.ok(match);
const payload = JSON.parse(match[2]);
const variants = {
  version: { ...payload, version: 999 },
  remote: {
    ...payload,
    icons: { hostile: { label: "Remote", src: "https://example.invalid/secret.svg" } },
  },
  unfiltered: {
    ...payload,
    documents: {
      ...payload.documents,
      "published.yaml": `${payload.documents["published.yaml"]}notes: [{at: a, text: PRIVATE}]\n`,
    },
  },
};
for (const [name, value] of Object.entries(variants)) {
  const json = JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  await writeFile(
    join(directory, "controls", `${name}.html`),
    original.replace(pattern, (_, open, _json, close) => open + json + close),
  );
}
const results = [],
  errors = [],
  requests = [];
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch();
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        reducedMotion: "no-preference",
      });
      const url = pathToFileURL(join(directory, "adversarial.html")).href;
      page.on("pageerror", (error) => errors.push({ name, width, message: error.message }));
      page.on("request", (request) => {
        if (request.url() !== url && !request.url().startsWith("data:"))
          requests.push(request.url());
      });
      await page.goto(url);
      const node = page.locator('[data-lens-pane="technical"] .react-flow__node[data-id="a"]');
      await expect(node).toBeVisible({ timeout: 20000 });
      const snapshotBefore = await page.locator("#atlas-snapshot").textContent();
      await expect(page.locator('[data-slot="flow-particles"]')).toHaveCount(1);
      const pause = page.getByRole("button", { name: "Pause flow animation", exact: true });
      await expect(
        page.locator("header").getByRole("button", { name: "Pause flow animation", exact: true }),
      ).toHaveCount(1);
      await expect(
        page
          .locator('[data-slot="canvas-navigation"]')
          .getByRole("button", { name: /flow animation/ }),
      ).toHaveCount(0);
      await pause.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator('[data-slot="flow-particles"]')).toHaveCount(0);
      await page.getByRole("button", { name: "Resume flow animation", exact: true }).click();
      await expect(page.locator('[data-slot="flow-particles"]')).toHaveCount(1);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(page.locator('[data-slot="flow-particles"]')).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Flow animation off: reduced motion", exact: true }),
      ).toHaveAttribute("aria-disabled", "true");
      await node.focus();
      await page.keyboard.press("?");
      const details = page.locator('[data-slot="details-card"]');
      await expect(details).toBeVisible();
      await expect(details).toContainText("</script><script>window.PUBLISH_PWNED=true</script>");
      await expect(details.getByRole("link")).toHaveCount(0);
      assert.equal(await page.evaluate(() => window.PUBLISH_PWNED), undefined);
      await page.keyboard.press("Escape");
      await expect(details).not.toBeVisible();
      const count = await page.locator('[data-lens-pane="technical"] .react-flow__node').count();
      await node.focus();
      await page.keyboard.press("Delete");
      await expect(page.locator('[data-lens-pane="technical"] .react-flow__node')).toHaveCount(
        count,
      );
      await page.getByRole("button", { name: "Walk through 2 steps", exact: true }).click();
      await page.getByRole("button", { name: "Present story", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Exit presentation", exact: true }),
      ).toBeVisible();
      const presentationControls = page.locator('[data-slot="presentation-controls"]');
      await expect
        .poll(() =>
          presentationControls.evaluate((element) => {
            const panel = element.getBoundingClientRect();
            const canvas = element.closest(".react-flow").getBoundingClientRect();
            const title = element
              .closest(".react-flow")
              .querySelector('[data-slot="diagram-title"]')
              .getBoundingClientRect();
            const top = panel.top - canvas.top;
            const right = canvas.right - panel.right;
            const overlap =
              Math.min(panel.right, title.right) > Math.max(panel.left, title.left) &&
              Math.min(panel.bottom, title.bottom) > Math.max(panel.top, title.top);
            return top >= 0 && top <= 24 && right >= 0 && right <= 24 && !overlap;
          }),
        )
        .toBe(true);
      await page.getByRole("button", { name: "Exit presentation", exact: true }).click();
      await page.getByRole("button", { name: "End story", exact: true }).click();
      const composite = page.locator('[data-lens-pane="technical"] .react-flow__node[data-id="t"]');
      await expect(composite).toBeVisible();
      await composite.focus();
      await page.keyboard.press("Enter");
      await expect(
        page.locator('[data-slot="drill-canvas"] .react-flow__node[data-id="leaf"]'),
      ).toBeVisible();
      await page.getByRole("button", { name: "Open diagram", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Back to main diagram", exact: true }),
      ).toBeVisible();
      await expect(
        page.locator('[data-lens-pane="technical"] .react-flow__node[data-id="leaf"]'),
      ).toBeVisible();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
        false,
      );
      await page.getByRole("button", { name: "Back to main diagram", exact: true }).click();
      await expect(node).toBeVisible();
      assert.equal(await page.locator("#atlas-snapshot").textContent(), snapshotBefore);
      await page.screenshot({ path: join(directory, "controls", `${name}-${width}.png`) });
      results.push({ name, width, controls: true });
      await page.close();
    }
    for (const variant of Object.keys(variants)) {
      const page = await browser.newPage();
      const url = pathToFileURL(join(directory, "controls", `${variant}.html`)).href;
      const rejected = [];
      page.on("pageerror", (error) => rejected.push(error.message));
      page.on("request", (request) => {
        if (request.url() !== url && !request.url().startsWith("data:"))
          requests.push(request.url());
      });
      await page.goto(url);
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(page.locator(".react-flow__node")).toHaveCount(0);
      assert.ok(rejected.length <= 1, "Invalid data must fail once at the boundary");
      results.push({ name, variant, refused: true });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
await writeFile(
  join(directory, "controls", "results.json"),
  JSON.stringify({ results, errors, requests }, null, 2),
);
assert.deepEqual(errors, []);
assert.deepEqual(requests, []);
console.log(JSON.stringify({ results, errors, requests }, null, 2));
