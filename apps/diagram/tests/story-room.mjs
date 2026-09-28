/** Story chrome must share measured room with both initially absent and expanded panels. */
/* global process, console, window, document */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium, expect } = await import(process.env.PLAYWRIGHT_MODULE ?? "@playwright/test");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5431";
const evidence = process.env.STORY_ROOM_EVIDENCE;
if (evidence) await mkdir(evidence, { recursive: true });
const browser = await chromium.launch();
const errors = [],
  writes = [],
  results = [];
try {
  for (const width of [390, 900, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (["PUT", "POST", "DELETE"].includes(r.method())) writes.push(r.url());
    });
    await page.goto(`${base}/#d/examples/clickhouse-cloud-stack.yaml`);
    await page.getByRole("button", { name: "Walk through 6 steps", exact: true }).click();
    const bar = page.locator('[data-slot="story-bar"]').filter({ visible: true });
    await expect(bar).toBeVisible();
    const overlap = () =>
      page.evaluate(() => {
        const bar = [...document.querySelectorAll('[data-slot="story-bar"]')].find(
          (el) => el.getBoundingClientRect().width > 0 && !el.closest("[inert]"),
        );
        const host = bar.closest("[data-lens-chrome]");
        const a = bar.getBoundingClientRect();
        return [
          ...host.querySelectorAll(
            ".react-flow__panel.bottom.left,.react-flow__panel.bottom.right",
          ),
        ].some((el) => {
          const b = el.getBoundingClientRect();
          return (
            b.width > 0 &&
            b.height > 0 &&
            Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
          );
        });
      });
    await expect.poll(overlap).toBe(false);
    const trigger = page.getByRole("button", { name: "Legend", exact: true });
    if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const legend = page.locator('[data-slot="diagram-legend"]').filter({ visible: true });
    await expect(legend.locator('[data-slot="diagram-legend-providers"]')).toBeVisible();
    let previous = "";
    let stable = 0;
    let bounds;
    await expect
      .poll(async () => {
        bounds = { bar: await bar.boundingBox(), legend: await legend.boundingBox() };
        const signature = JSON.stringify(bounds);
        stable = signature === previous && !(await overlap()) ? stable + 1 : 0;
        previous = signature;
        return stable;
      })
      .toBeGreaterThanOrEqual(3);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    if (evidence) await page.screenshot({ path: `${evidence}/${width}-expanded-legend.png` });
    await page.getByRole("button", { name: "End story", exact: true }).click();
    results.push({ width, noOverlap: true, bounds });
    await page.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log(`PASS ${results.length} story chrome widths; no errors or writes`);
} finally {
  await browser.close();
  if (evidence)
    await writeFile(
      `${evidence}/results.json`,
      JSON.stringify({ results, errors, writes }, null, 2),
    );
}
