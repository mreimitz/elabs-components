/** Story controls share the legend baseline and stay still as caption lengths change.
 * Run against an isolated DIAGRAM_URL; only a disposable test document is created. */
/* global process, console, localStorage, sessionStorage, document, window */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { URL } from "node:url";
import { mkdir, writeFile, rm } from "node:fs/promises";
const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5453";
const evidence = process.env.STORY_CONTROLS_EVIDENCE;
const folder = `story-controls-${process.pid}`;
const dir = new URL(`../workspace/${folder}/`, import.meta.url);
const longText = Array.from(
  { length: 24 },
  (_, i) =>
    `Paragraph ${i + 1}: Read the complete explanation while the playback controls stay in the same position.`,
).join("\n\n");
const source = `diagram: "1"
title: Story control layout proof
nodes:
  - {id: a, title: Source}
  - {id: b, title: Destination}
flows:
  - {from: a, to: b, label: Data}
story:
  steps:
    - title: Short caption
      targets: [a]
      text: One short sentence.
    - title: Long caption
      targets: [b]
      text: ${JSON.stringify(longText)}
    - title: No description
      targets: [a]
`;
const browser = await chromium.launch();
const results = [],
  errors = [],
  writes = [];
const near = (a, b, label, tolerance = 1) =>
  assert.ok(Math.abs(a - b) <= tolerance, `${label}: ${a} versus ${b}`);
const center = (box) => box.y + box.height / 2;
try {
  await mkdir(dir, { recursive: true });
  await writeFile(new URL("captions.yaml", dir), source);
  if (evidence) await mkdir(evidence, { recursive: true });
  for (const width of [1440, 390, 760, 780]) {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
      });
      await context.addInitScript((theme) => {
        localStorage.setItem("brand-ui-theme", theme);
        sessionStorage.setItem("diagram-legend-open", "false");
      }, theme);
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (
          ["PUT", "POST", "DELETE"].includes(request.method()) &&
          request.url().includes("/api/workspace/")
        )
          writes.push(request.url());
      });
      const bar = page.locator('[data-slot="story-bar"]').filter({ visible: true });
      const controls = bar.locator('[data-slot="story-controls"]');
      const caption = bar.locator('[data-slot="story-caption"]');
      const progress = bar.locator('[data-slot="story-progress"]');
      const legend = page.locator('[data-slot="diagram-legend"]').filter({ visible: true });
      const settled = async () => {
        let previous = "",
          count = 0;
        await expect
          .poll(async () => {
            const next = JSON.stringify(await bar.boundingBox());
            count = previous === next ? count + 1 : 0;
            previous = next;
            return count;
          })
          .toBeGreaterThanOrEqual(2);
      };
      const clearOfPanels = () =>
        bar.evaluate((element) => {
          const host = element.closest("[data-lens-chrome]") ?? element.closest(".react-flow");
          const a = element.getBoundingClientRect();
          return [
            ...host.querySelectorAll(
              ".react-flow__panel.bottom.left,.react-flow__panel.bottom.right,.react-flow__panel.bottom.center:not([data-slot=step-player])",
            ),
          ].every((panel) => {
            const b = panel.getBoundingClientRect();
            return (
              !b.width ||
              !b.height ||
              Math.min(a.right, b.right) - Math.max(a.left, b.left) <= 1 ||
              Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) <= 1
            );
          });
        });
      const geometry = async () => {
        await settled();
        const boxes = {
          bar: await bar.boundingBox(),
          caption: await caption.boundingBox(),
          progress: await progress.boundingBox(),
          controls: await controls.boundingBox(),
        };
        assert.ok(
          boxes.caption.y + boxes.caption.height <= boxes.progress.y + 1,
          "caption precedes timeline",
        );
        assert.ok(
          boxes.progress.y + boxes.progress.height <= boxes.controls.y + 1,
          "timeline precedes playback controls",
        );
        if (width === 1440)
          near(
            center(boxes.controls),
            center(await legend.boundingBox()),
            "playback row/legend baseline",
            4,
          );
        await expect.poll(clearOfPanels).toBe(true);
        await expect
          .poll(() =>
            page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          )
          .toBe(true);
        assert.ok(
          boxes.bar.x >= 0 && boxes.bar.x + boxes.bar.width <= width + 1,
          "story fits viewport width",
        );
        return boxes;
      };
      const stable = (actual, initial) => {
        for (const slot of ["bar", "caption", "progress", "controls"]) {
          for (const dimension of ["y", "height"])
            near(
              actual[slot][dimension],
              initial[slot][dimension],
              `${slot} ${dimension} stays fixed`,
            );
        }
      };
      await page.goto(`${base}/#d/templates/qlik-talend-cloud-pipeline.yaml`);
      const start = page.getByRole("button", { name: "Walk through 6 steps", exact: true });
      await expect(start).toBeVisible();
      await expect(legend).toBeVisible();
      await settled();
      if (width === 1440)
        near(
          center(await start.boundingBox()),
          center(await legend.boundingBox()),
          "start/legend baseline",
          4,
        );
      await expect.poll(clearOfPanels).toBe(true);
      if (evidence) await page.screenshot({ path: `${evidence}/${theme}-${width}-start.png` });
      await start.click();
      let initial;
      for (let step = 1; step <= 6; step++) {
        await expect(controls).toContainText(`Step ${step} of 6`);
        const boxes = await geometry();
        if (initial) stable(boxes, initial);
        else initial = boxes;
        if (step < 6) await page.getByRole("button", { name: "Next step", exact: true }).click();
      }
      if (evidence) await page.screenshot({ path: `${evidence}/${theme}-${width}-active.png` });
      await page.getByRole("button", { name: "End story", exact: true }).click();
      await expect(start).toBeFocused();
      await page.goto(`${base}/#d/${folder}/captions.yaml`);
      await page.getByRole("button", { name: "Walk through 3 steps", exact: true }).click();
      const short = await geometry();
      await page.getByRole("button", { name: "Next step", exact: true }).click();
      await expect(caption).toContainText("Long caption");
      stable(await geometry(), short);
      assert.ok(
        await caption.evaluate((el) => el.scrollHeight > el.clientHeight),
        "long caption scrolls",
      );
      await caption.focus();
      await page.keyboard.press("PageDown");
      await expect.poll(() => caption.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      await expect(controls).toContainText("Step 2 of 3");
      await page.keyboard.press("End");
      await expect
        .poll(() => caption.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop))
        .toBeLessThanOrEqual(1);
      await expect(controls).toContainText("Step 2 of 3");
      if (evidence) await page.screenshot({ path: `${evidence}/${theme}-${width}-long.png` });
      await page.getByRole("button", { name: "Next step", exact: true }).click();
      await expect(caption).toContainText("No description");
      stable(await geometry(), short);
      await expect.poll(() => caption.evaluate((el) => el.scrollTop)).toBe(0);
      await caption.focus();
      await page.keyboard.press("Escape");
      const fixtureStart = page.getByRole("button", { name: "Walk through 3 steps", exact: true });
      await expect(fixtureStart).toBeVisible();
      await expect(fixtureStart).toBeFocused();
      assert.ok(!page.url().includes("step="), "Escape from caption ends story in view mode");
      await fixtureStart.click();
      await page.getByRole("button", { name: "Present story", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Exit presentation", exact: true }),
      ).toBeVisible();
      await expect(caption).toBeVisible();
      await geometry();
      const presentationControls = page
        .locator('[data-slot="presentation-controls"]')
        .filter({ visible: true });
      await expect(presentationControls).toBeVisible();
      const presentationBounds = await presentationControls.evaluate((panel) => {
        const canvas = panel.closest(".react-flow");
        const host = canvas.getBoundingClientRect();
        const controls = panel.getBoundingClientRect();
        const title = canvas.querySelector('[data-slot="diagram-title"]').getBoundingClientRect();
        const story = canvas.querySelector('[data-slot="story-bar"]').getBoundingClientRect();
        const overlap = (a, b) =>
          Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
        return {
          top: controls.top - host.top,
          right: host.right - controls.right,
          overlapsTitle: overlap(controls, title),
          overlapsStory: overlap(controls, story),
        };
      });
      assert.ok(
        presentationBounds.top >= 0 && presentationBounds.top <= 24,
        "presentation controls stay near canvas top",
      );
      assert.ok(
        presentationBounds.right >= 0 && presentationBounds.right <= 24,
        "presentation controls stay near canvas right",
      );
      assert.equal(
        presentationBounds.overlapsTitle,
        false,
        "presentation controls leave title readable",
      );
      assert.equal(
        presentationBounds.overlapsStory,
        false,
        "presentation controls leave story usable",
      );
      if (evidence)
        await page.screenshot({ path: `${evidence}/${theme}-${width}-presentation.png` });
      await caption.focus();
      await page.keyboard.press("Escape");
      await expect(fixtureStart).toBeVisible();
      await expect(fixtureStart).toBeFocused();
      assert.ok(!page.url().includes("step="), "Escape from caption ends presentation story");
      assert.ok(page.url().includes("present"), "Escape ends story before leaving presentation");
      results.push({
        width,
        theme,
        talendSteps: 6,
        captions: ["short", "long", "missing"],
        keyboardScroll: true,
        captionEscape: true,
        presentationClearance: true,
        presentationBounds,
        fixedBounds: initial,
      });
      await context.close();
      console.log(
        `PASS ${theme}/${width}: legend baseline, stacked controls, 6 stable Talend steps, short/long/missing text, keyboard scrolling`,
      );
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
} finally {
  await browser.close();
  await rm(dir, { recursive: true, force: true });
  if (evidence)
    await writeFile(
      `${evidence}/results.json`,
      JSON.stringify({ results, errors, writes }, null, 2),
    );
}
