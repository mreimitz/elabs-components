/** Component roundtrips preserve geometry and animate actual canvas coordinates. */
/* global window, document, localStorage, performance, requestAnimationFrame, cancelAnimationFrame, process, console, URL */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
expect.configure({ timeout: 20000 });
const base = process.env.DIAGRAM_URL ?? "http://localhost:5455";
const evidence = process.env.COMPONENT_MOTION_EVIDENCE ?? "/tmp/diagram-component-motion";
const path = "templates/qlik-cloud-customer-landscape.yaml";
const browser = await chromium.launch();
const results = [];
await mkdir(evidence, { recursive: true });
try {
  for (const theme of ["light", "dark"]) {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion,
      });
      await context.addInitScript((theme) => {
        localStorage.setItem("brand-ui-theme", theme);
        window.geometry = () =>
          [...document.querySelectorAll('[data-lens-pane="technical"] .react-flow__node')]
            .map((n) => ({
              id: n.getAttribute("data-id"),
              transform: n.style.transform.replace(/-?\d+(?:\.\d+)?/g, (value) =>
                String(Math.round(Number(value) * 100) / 100),
              ),
              width: n.offsetWidth,
              height: n.offsetHeight,
            }))
            .sort((a, b) => a.id.localeCompare(b.id));
      }, theme);
      const page = await context.newPage();
      const errors = [],
        writes = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (req) => {
        if (["PUT", "POST", "DELETE"].includes(req.method())) writes.push(req.url());
      });
      await page.goto(`${base}/#d/${path}`);
      const expand = page
        .locator('[data-lens-pane="technical"] .react-flow__node[data-id="tenant"]')
        .getByRole("button", { name: "Expand Qlik Cloud tenant inline", exact: true });
      const collapse = page
        .locator('[data-lens-pane="technical"] .react-flow__node[data-id="tenant"]')
        .getByRole("button", { name: "Collapse Qlik Cloud tenant", exact: true });
      const geometry = () => page.evaluate(() => window.geometry());
      async function settled() {
        let last = "",
          since = Date.now();
        await expect
          .poll(
            async () => {
              const next = JSON.stringify(await geometry());
              if (next !== last) {
                last = next;
                since = Date.now();
              }
              return Date.now() - since;
            },
            { timeout: 20000, intervals: [50] },
          )
          .toBeGreaterThan(500);
        return geometry();
      }
      await expect(expand).toBeVisible({ timeout: 30000 });
      const original = await settled();
      await page.screenshot({ path: `${evidence}/${theme}-${reducedMotion}-before.png` });
      async function toggle(button, target) {
        await page.evaluate(() => {
          window.samples = [];
          const sample = () => {
            const box = document
              .querySelector('[data-lens-pane="technical"] .react-flow__node[data-id="tenant"]')
              ?.getBoundingClientRect();
            window.samples.push({
              at: performance.now(),
              nodes: window.geometry(),
              anchor:
                box && !document.querySelector('[data-slot="component-measurement-cover"]')
                  ? { x: box.x, y: box.y }
                  : null,
              camera: document
                .querySelector('[data-lens-pane="technical"] .react-flow__viewport')
                ?.getAttribute("style"),
            });
            window.sampleFrame = requestAnimationFrame(sample);
          };
          sample();
        });
        await button.click();
        await expect(target).toBeVisible();
        const final = await settled();
        const samples = await page.evaluate(() => {
          cancelAnimationFrame(window.sampleFrame);
          return window.samples;
        });
        await writeFile(
          `${evidence}/${theme}-${reducedMotion}-samples.json`,
          JSON.stringify(samples),
        );
        await page.screenshot({ path: `${evidence}/${theme}-${reducedMotion}-latest.png` });
        const anchors = samples.map((frame) => frame.anchor).filter(Boolean);
        assert.ok(anchors.length > 2, "Capture component anchor in real frames");
        if (anchors.length) {
          assert.ok(
            Math.max(...anchors.map((p) => p.x)) - Math.min(...anchors.map((p) => p.x)) < 1,
            "Component must not travel sideways during disclosure",
          );
          assert.ok(
            Math.max(...anchors.map((p) => p.y)) - Math.min(...anchors.map((p) => p.y)) < 1,
            "Component must not travel upward during disclosure",
          );
        }
        assert.equal(
          new Set(samples.map((frame) => frame.camera)).size,
          1,
          "Disclosure must not zoom or recenter the camera",
        );
        const states = new Set(
          samples.map((frame) => JSON.stringify(frame.nodes.find((n) => n.id === "qlik"))),
        );
        if (!process.env.MOTION_BASELINE) {
          if (reducedMotion === "reduce")
            assert.ok(
              states.size <= 5,
              `Reduced motion should settle without tween frames: ${states.size}`,
            );
          if (reducedMotion === "no-preference")
            assert.ok(
              states.size > 3,
              `Real node movement must have intermediate frames: ${states.size}`,
            );
        }
        return { final, frames: states.size };
      }
      const opened = await toggle(expand, collapse);
      await page.screenshot({ path: `${evidence}/${theme}-${reducedMotion}-expanded.png` });
      const closed = await toggle(collapse, expand);
      await page.screenshot({ path: `${evidence}/${theme}-${reducedMotion}-after.png` });
      await writeFile(
        `${evidence}/${theme}-${reducedMotion}-geometry.json`,
        JSON.stringify({ original, opened, closed }, null, 2),
      );
      assert.deepEqual(
        closed.final,
        original,
        "Expand/collapse must restore original graph geometry",
      );
      await toggle(expand, collapse);
      assert.deepEqual(
        (await toggle(collapse, expand)).final,
        original,
        "Repeated roundtrip must not accumulate size or position drift",
      );
      if (reducedMotion === "no-preference") {
        await toggle(expand, collapse);
        await collapse.evaluate((button) => button.click());
        await expect(expand).toBeAttached();
        await page.waitForTimeout(100);
        await expand.evaluate((button) => button.click());
        await expect(collapse).toBeAttached();
        await settled();
        await collapse.click();
        await expect(expand).toBeAttached();
        assert.deepEqual(
          await settled(),
          original,
          "Reopening mid-collapse must preserve canonical compact geometry",
        );
      }
      // Interrupt before the first layout/transition settles: latest collapse wins.
      await expand.evaluate((button) => button.click());
      await expect(collapse).toBeAttached();
      await collapse.evaluate((button) => button.click());
      await expect(expand).toBeAttached();
      assert.deepEqual(
        await settled(),
        original,
        "Rapid reversal must finish collapsed with original geometry",
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(writes, []);
      results.push({
        theme,
        reducedMotion,
        expandFrames: opened.frames,
        collapseFrames: closed.frames,
      });
      console.log("PASS", results.at(-1));
      await context.close();
    }
  }
} finally {
  await writeFile(`${evidence}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
