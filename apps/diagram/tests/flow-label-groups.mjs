/** Shared flow labels preserve authored routes, metadata, selection and story emphasis.
 * Run against an isolated DIAGRAM_URL; only disposable test documents are created. */
/* global process, console, localStorage, sessionStorage, performance */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { URL } from "node:url";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5455";
const evidence = process.env.FLOW_GROUP_EVIDENCE;
const folder = `flow-label-groups-${process.pid}`;
const dir = new URL(`../workspace/${folder}/`, import.meta.url);
const source = (direction) => `diagram: "1"
title: Shared flow labels
direction: ${direction}
zones:
  - id: sources
    title: Source systems
    children:
      - {id: a, title: Source A}
      - {id: b, title: Source B}
      - {id: c, title: Source C}
      - {id: d, title: Source D}
nodes:
  - {id: hub, title: Capture service}
  - {id: x, title: Destination X}
  - {id: y, title: Destination Y}
  - {id: z, title: Destination Z}
  - {id: archive, title: Scheduled archive}
flows:
  - {from: a, to: hub, label: Shared capture}
  - {from: b, to: hub, label: Shared capture}
  - {from: c, to: hub, label: Shared capture}
  - {from: d, to: hub, label: Shared capture}
  - {from: hub, to: x, label: Shared distribution}
  - {from: hub, to: y, label: Shared distribution}
  - {from: hub, to: z, label: Shared distribution}
  - {from: a, to: archive, label: Scheduled copy, schedule: hourly}
  - {from: b, to: archive, label: Scheduled copy, schedule: daily}
story:
  steps:
    - {title: First branch, targets: ["a -> hub"]}
    - {title: Last branch, targets: ["d -> hub"]}
`;
const browser = await chromium.launch();
const results = [],
  errors = [],
  writes = [];
try {
  await mkdir(dir, { recursive: true });
  if (evidence) await mkdir(evidence, { recursive: true });
  for (const direction of ["LR", "TB"])
    await writeFile(new URL(`${direction}.yaml`, dir), source(direction));
  for (const direction of ["LR", "TB"]) {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width: 1600, height: 1000 },
        reducedMotion: "reduce",
      });
      await context.addInitScript((theme) => {
        performance.setResourceTimingBufferSize(10000);
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
      await page.goto(`${base}/#d/${folder}/${direction}.yaml`);
      const pane = page.locator('[data-lens-pane="technical"]');
      const paths = pane.locator('[data-slot="data-flow-edge"]');
      const labels = pane.locator('[data-slot="edge-label-cluster"]');
      const capture = labels.filter({ hasText: "Shared capture" });
      const distribution = labels.filter({ hasText: "Shared distribution" });
      const scheduled = labels.filter({ hasText: "Scheduled copy" });
      const grouped = async () => {
        await expect(paths).toHaveCount(9);
        await expect(capture).toHaveCount(1);
        await expect(capture).toHaveAttribute("data-group-size", "4");
        await expect(distribution).toHaveCount(1);
        await expect(distribution).toHaveAttribute("data-group-size", "3");
        await expect(scheduled).toHaveCount(2);
        await expect(scheduled.filter({ hasText: "hourly" })).toHaveCount(1);
        await expect(scheduled.filter({ hasText: "daily" })).toHaveCount(1);
        await expect(labels).toHaveCount(4);
      };
      await grouped();
      const ids = await pane
        .locator(".react-flow__edge")
        .evaluateAll((edges) => edges.map((edge) => edge.getAttribute("data-id")).sort());
      assert.equal(new Set(ids).size, 9, "each authored connection retains its own ID");
      if (evidence) await page.screenshot({ path: `${evidence}/${theme}-${direction}.png` });
      await page.getByRole("button", { name: "Collapse all zones", exact: true }).click();
      await expect(pane.locator('.react-flow__node[data-id="a"]')).toHaveCount(0);
      await grouped();
      await page.getByRole("button", { name: "Expand all zones", exact: true }).click();
      await expect(pane.locator('.react-flow__node[data-id="a"]')).toBeVisible();
      await grouped();
      assert.deepEqual(
        await pane
          .locator(".react-flow__edge")
          .evaluateAll((edges) => edges.map((edge) => edge.getAttribute("data-id")).sort()),
        ids,
        "unfold restores every original edge",
      );
      // Either the first or last member is guaranteed to differ from the deterministic owner.
      await page.getByRole("button", { name: "Walk through 2 steps", exact: true }).click();
      await expect(capture).toHaveAttribute("data-lit", "true");
      await expect(distribution).toHaveAttribute("data-dimmed", "true");
      await page.getByRole("button", { name: "Next step", exact: true }).click();
      await expect(capture).toHaveAttribute("data-lit", "true");
      await page.getByRole("button", { name: "End story", exact: true }).click();
      await page.getByRole("button", { name: /^Edit/ }).click();
      await expect(page.locator('[data-slot="inspector-panel"]')).toHaveAttribute(
        "data-state",
        "collapsed",
      );
      const owner = await capture.getAttribute("data-edge-id");
      assert.ok(owner, "shared label exposes its representative connection");
      const member = pane.locator(".react-flow__edge").filter({
        has: page.locator('[data-slot="data-flow-edge"]'),
      });
      const nonOwnerId = await member.evaluateAll(
        (edges, owner) =>
          edges
            .find(
              (edge) =>
                edge.getAttribute("data-id") !== owner &&
                edge.getAttribute("aria-label")?.includes("Shared capture"),
            )
            ?.getAttribute("data-id"),
        owner,
      );
      assert.ok(nonOwnerId, "a separate grouped branch remains keyboard accessible");
      const nonOwner = pane.locator(`.react-flow__edge[data-id="${nonOwnerId}"]`);
      await nonOwner.focus();
      await page.keyboard.press("Enter");
      await expect(nonOwner).toHaveClass(/selected/);
      await expect(capture.locator(".border-ring")).toHaveCount(1);
      await expect(paths).toHaveCount(9);
      if (evidence)
        await page.screenshot({ path: `${evidence}/${theme}-${direction}-selected.png` });
      const changeLabel = async (from, to) => {
        await expect(page.locator(".monaco-editor textarea")).toBeVisible();
        await page.evaluate(
          async ({ from, to }) => {
            const resource = performance
              .getEntriesByType("resource")
              .findLast((entry) => new URL(entry.name).pathname.endsWith("/monaco-editor.js"));
            if (!resource) throw Error("Monaco module missing");
            const monaco = await import(resource.name);
            const editor = monaco.editor
              .getEditors()
              .find((editor) => editor.getModel()?.getLanguageId() === "yaml");
            const model = editor?.getModel();
            if (!model) throw Error("YAML editor missing");
            const offset = model.getValue().indexOf(from);
            if (offset < 0) throw Error(`Missing flow ${from}`);
            const start = model.getPositionAt(offset),
              end = model.getPositionAt(offset + from.length);
            editor.executeEdits("flow-group-proof", [
              {
                range: {
                  startLineNumber: start.lineNumber,
                  startColumn: start.column,
                  endLineNumber: end.lineNumber,
                  endColumn: end.column,
                },
                text: to,
              },
            ]);
          },
          { from, to },
        );
      };
      const original = "from: d, to: hub, label: Shared capture";
      const distinct = "from: d, to: hub, label: Separate capture";
      await changeLabel(original, distinct);
      await expect(capture).toHaveAttribute("data-group-size", "3");
      await expect(labels.filter({ hasText: "Separate capture" })).toHaveCount(1);
      await expect(labels).toHaveCount(5);
      await expect(paths).toHaveCount(9);
      await changeLabel(distinct, original);
      await grouped();
      await page.getByRole("button", { name: /^Done/ }).click();
      await expect
        .poll(() => readFile(new URL(`${direction}.yaml`, dir), "utf8"))
        .toBe(source(direction));
      results.push(
        `${theme}/${direction}: grouped fan-in/out, distinct schedules, all 9 paths, folds, nonowner story and keyboard selection, edit split/rejoin`,
      );
      await context.close();
    }
  }
  for (const direction of ["LR", "TB"]) {
    const position = (x, y) => (direction === "LR" ? `{x: ${x}, y: ${y}}` : `{x: ${y}, y: ${x}}`);
    await writeFile(
      new URL(`manual-${direction}.yaml`, dir),
      `diagram: "1"
title: Manual shared flow labels
layout: manual
direction: ${direction}
nodes:
  - {id: a, title: Source A, position: ${position(0, 0)}}
  - {id: b, title: Source B, position: ${position(0, 200)}}
  - {id: c, title: Source C, position: ${position(0, 400)}}
  - {id: d, title: Source D, position: ${position(0, 600)}}
  - {id: e, title: Source E, position: ${position(0, 800)}}
  - {id: hub, title: Shared hub, position: ${position(500, 200)}}
  - {id: x, title: Destination X, position: ${position(1000, 100)}}
  - {id: y, title: Destination Y, position: ${position(1000, 300)}}
flows:
  - {from: a, to: hub, label: Capture manually}
  - {from: b, to: hub, label: Capture manually}
  - {from: c, to: hub, label: Capture manually}
  - {from: d, to: hub, label: Other capture, kind: control, secure: tls, protocol: HTTPS, schedule: nightly}
  - {from: e, to: hub, label: Other capture, kind: control, secure: tls, protocol: HTTPS, schedule: nightly}
  - {from: hub, to: x, label: Distribute manually}
  - {from: hub, to: y, label: Distribute manually}
`,
    );
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width: 1600, height: 1000 },
        reducedMotion: "reduce",
      });
      await context.addInitScript((theme) => localStorage.setItem("brand-ui-theme", theme), theme);
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${base}/#d/${folder}/manual-${direction}.yaml`);
      const pane = page.locator('[data-lens-pane="technical"]');
      const labels = pane.locator('[data-slot="edge-label-cluster"]');
      await expect(pane.locator('[data-slot="data-flow-edge"][data-routed="step"]')).toHaveCount(7);
      await expect(labels).toHaveCount(3);
      await expect(labels.filter({ hasText: "Capture manually" })).toHaveAttribute(
        "data-group-size",
        "3",
      );
      await expect(labels.filter({ hasText: "Distribute manually" })).toHaveAttribute(
        "data-group-size",
        "2",
      );
      await expect(labels.filter({ hasText: "Other capture" })).toHaveAttribute(
        "data-group-size",
        "2",
      );
      await expect(labels.filter({ hasText: "Other capture" })).toContainText("HTTPS");
      await expect(labels.filter({ hasText: "Other capture" })).toContainText("nightly");
      await expect
        .poll(async () => {
          const node = await pane.locator('.react-flow__node[data-id="hub"]').boundingBox();
          const boxes = await labels.evaluateAll((elements) =>
            elements.map((element) => {
              const rect = element.getBoundingClientRect();
              return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            }),
          );
          const separate = (a, b) =>
            Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) <= 1 ||
            Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) <= 1;
          return (
            boxes.every((a, i) => boxes.slice(i + 1).every((b) => separate(a, b))) &&
            boxes.every(
              (box) =>
                Math.min(node.x + node.width, box.x + box.width) - Math.max(node.x, box.x) <= 1 ||
                Math.min(node.y + node.height, box.y + box.height) - Math.max(node.y, box.y) <= 1,
            )
          );
        })
        .toBe(true);
      if (evidence) await page.screenshot({ path: `${evidence}/${theme}-${direction}-manual.png` });
      results.push(
        `${theme}/${direction}: manual fallback keeps distinct groups and common node clear, all 7 paths retained`,
      );
      await context.close();
    }
  }
  assert.deepEqual(errors, [], "no browser exceptions");
  assert.ok(
    writes.every((url) => decodeURIComponent(url).includes(folder)),
    "editing writes only disposable fixtures",
  );
  if (evidence)
    await writeFile(
      `${evidence}/results.json`,
      JSON.stringify({ results, errors, writes }, null, 2),
    );
  console.log(results.map((result) => `PASS ${result}`).join("\n"));
} finally {
  await browser.close();
  await rm(dir, { recursive: true, force: true });
}
