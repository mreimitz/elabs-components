/** Referenced diagram hover is a live, isolated preview; opening is always read-only. */
/* global window, getComputedStyle, performance, localStorage, URL, process, console */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5455";
const evidence = process.env.COMPONENT_PREVIEW_EVIDENCE;
const folder = `component-preview-proof-${process.pid}`;
const disk = new URL(`../workspace/${folder}/`, import.meta.url);
const parent = `${folder}/parent.yaml`;
const child = `${folder}/child.yaml`;
const description = "A referenced architecture containing an ingestion service and a warehouse.";
const childSource = `diagram: "1"\ntitle: Preview child\ndescription: ${description}\nnodes:\n  - id: ingest\n    title: Preview ingestion\n    icon: lucide/database\n  - id: warehouse\n    title: Preview warehouse\n    icon: lucide/server\nflows:\n  - ingest -> warehouse: Preview transfer\n`;
const parentSource = `diagram: "1"\ntitle: Preview parent\nnodes:\n  - id: reference\n    ref: ws/${folder}/child\n    title: Referenced component\n  - id: outside\n    title: Parent-only system\nflows:\n  - outside -> reference: Parent connection\n`;
const browser = await chromium.launch();
const results = [];
let page;
try {
  await mkdir(disk, { recursive: true });
  await writeFile(new URL("parent.yaml", disk), parentSource);
  await writeFile(new URL("child.yaml", disk), childSource);
  if (evidence) await mkdir(evidence, { recursive: true });
  for (const theme of ["light", "dark"])
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await context.addInitScript((theme) => {
        localStorage.setItem("brand-ui-theme", theme);
        performance.setResourceTimingBufferSize(10000);
        window.proofModule = (path) => {
          const url = performance
            .getEntriesByType("resource")
            .findLast((r) => new URL(r.name).pathname === path)?.name;
          if (!url) throw Error(`Missing module: ${path}`);
          return import(url);
        };
      }, theme);
      page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [],
        writes = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (["POST", "PUT", "DELETE"].includes(request.method())) writes.push(request.url());
      });
      const node = page.locator(
        '[data-lens-pane="technical"] .react-flow__node[data-id="reference"]',
      );
      const card = page.locator('[data-slot="details-card"]');
      const preview = card.locator('[data-slot="component-preview"]');
      const edit = page.getByRole("button", { name: /^Edit/ });
      const done = page.getByRole("button", { name: /^Done/ });
      async function snapshot() {
        return page.evaluate(async () => {
          const { diagramStore } = await window.proofModule("/src/state/diagram-store.ts");
          const { modeStore } = await window.proofModule("/src/shell/mode-store.ts");
          const state = diagramStore.get();
          return {
            path: state.path,
            text: state.text,
            nodes: state.drawn.graph?.nodes,
            edges: state.drawn.graph?.edges,
            mode: modeStore.get(),
            hash: window.location.hash,
          };
        });
      }
      async function openPreview(keyboard = false) {
        if (keyboard) {
          await node.focus();
          await page.keyboard.press("?");
        } else await node.hover();
        await expect(preview).toBeVisible();
        await expect(preview.locator('.react-flow__node[data-id="ingest"]')).toBeVisible();
        await expect(preview.locator('.react-flow__node[data-id="warehouse"]')).toBeVisible();
        await expect(preview.locator(".react-flow__edge")).toHaveCount(1);
        await expect(preview.locator('[data-slot="component-preview-canvas"]')).toHaveAttribute(
          "data-ready",
          "true",
        );
        assert.equal(
          await preview
            .locator('.react-flow__node[data-id="ingest"]')
            .evaluate((el) => Boolean(el.closest("[inert]"))),
          true,
          "Preview graph is inert",
        );
        await expect(preview.getByText("Preview ingestion", { exact: true })).toBeVisible();
        await expect(preview.getByText("Preview warehouse", { exact: true })).toBeVisible();
        const previewBox = await preview.boundingBox();
        const descriptionBox = await card
          .locator('[data-slot="details-card-description"]')
          .boundingBox();
        assert.ok(
          descriptionBox &&
            previewBox &&
            previewBox.y >= descriptionBox.y + descriptionBox.height - 1,
          "Preview is below the description",
        );
        assert.ok(
          previewBox.width > 160 && previewBox.height > 100,
          "Preview has usable dimensions",
        );
        await expect(preview.locator('[data-id="outside"]')).toHaveCount(0);
      }
      await page.goto(`${base}/#d/${parent}`);
      await expect(node).toBeVisible();
      await expect(edit).toBeVisible();
      const before = await snapshot();
      for (let repeat = 0; repeat < 3; repeat++) {
        await openPreview(repeat === 2);
        assert.deepEqual(
          await snapshot(),
          before,
          "Hover must not change the document, route, or shell mode",
        );
        if (repeat === 2 && evidence) {
          await expect.poll(() => card.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
          await card.evaluate(async (el) => {
            await Promise.all(
              el
                .getAnimations({ subtree: true })
                .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
                .map((animation) => animation.finished.catch(() => undefined)),
            );
          });
          await page.screenshot({ path: `${evidence}/${theme}-${width}.png` });
        }
        await page.keyboard.press("Escape");
        await expect(card).toHaveCount(0);
        await expect(page.locator('[data-slot="component-preview"]')).toHaveCount(0);
        if (repeat === 2) await expect(node).toBeFocused();
        await page.mouse.move(10, 10);
      }
      if (process.env.COMPONENT_PREVIEW_EXPORT && theme === "light" && width === 1440) {
        assert.ok(evidence, "Export proof needs COMPONENT_PREVIEW_EVIDENCE");
        await page.getByRole("button", { name: "Export", exact: true }).click();
        const downloadEvent = page.waitForEvent("download", { timeout: 120000 });
        await page.getByRole("menuitem", { name: "Interactive HTML", exact: true }).click();
        const download = await downloadEvent;
        const htmlPath = `${evidence}/preview.html`;
        await download.saveAs(htmlPath);
        const offline = await context.newPage();
        const requests = [],
          offlineErrors = [];
        offline.on("request", (request) => {
          if (/^https?:/.test(request.url())) requests.push(request.url());
        });
        offline.on("pageerror", (error) => offlineErrors.push(error.message));
        await offline.goto(pathToFileURL(htmlPath).href);
        const reference = offline.locator(
          '[data-lens-pane="technical"] .react-flow__node[data-id="reference"]',
        );
        await reference.focus();
        await offline.keyboard.press("?");
        const offlineCard = offline.locator('[data-slot="details-card"]');
        const offlinePreview = offlineCard.locator('[data-slot="component-preview"]');
        await expect(offlinePreview.locator('.react-flow__node[data-id="ingest"]')).toBeVisible();
        await expect(
          offlinePreview.locator('.react-flow__node[data-id="warehouse"]'),
        ).toBeVisible();
        await expect(offlinePreview.locator(".react-flow__edge")).toHaveCount(1);
        await offlineCard.getByRole("link", { name: "Open diagram", exact: true }).click();
        await expect(
          offline.locator('[data-lens-pane="technical"] .react-flow__node[data-id="ingest"]'),
        ).toBeVisible();
        await expect(offline.locator(".monaco-editor")).toHaveCount(0);
        assert.deepEqual(requests, []);
        assert.deepEqual(offlineErrors, []);
        await offline.screenshot({ path: `${evidence}/offline.png` });
        await offline.close();
        console.log(
          "PASS offline export: embedded actual preview, Open read-only, no HTTP/errors/editor",
        );
      }
      await openPreview(true);
      await writeFile(
        new URL("child.next", disk),
        childSource.replace("Preview warehouse", "Refreshed warehouse"),
      );
      await rename(new URL("child.next", disk), new URL("child.yaml", disk));
      await expect(preview.getByText("Refreshed warehouse", { exact: true })).toBeVisible();
      await expect(preview.getByText("Preview warehouse", { exact: true })).toHaveCount(0);
      await writeFile(new URL("child.next", disk), childSource);
      await rename(new URL("child.next", disk), new URL("child.yaml", disk));
      await expect(preview.getByText("Preview warehouse", { exact: true })).toBeVisible();
      await card.getByRole("link", { name: "Open diagram", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`#d/${child}$`));
      await expect(edit).toBeVisible();
      await expect(page.locator(".monaco-editor textarea")).toHaveCount(0);
      if (width === 1440) {
        // Remember an edited child, then open it from an edited parent: both modes must be overridden.
        await edit.click();
        await expect(done).toBeVisible();
        await page.evaluate((path) => {
          window.location.hash = `d/${path}`;
        }, parent);
        await expect(node).toBeVisible();
        await edit.click();
        await expect(done).toBeVisible();
        await openPreview(true);
        await card.getByRole("link", { name: "Open diagram", exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`#d/${child}$`));
        await expect(edit).toBeVisible();
        await expect(page.locator(".monaco-editor textarea")).toHaveCount(0);
        // Drill inspection's explicit Open action follows the same view-mode contract.
        await edit.click();
        await expect(done).toBeVisible();
        await page.evaluate((path) => {
          window.location.hash = `d/${path}&into=reference`;
        }, parent);
        await expect(
          page.locator('[data-slot="drill-canvas"] .react-flow__node[data-id="ingest"]'),
        ).toBeVisible();
        await page.getByRole("button", { name: "Open diagram", exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`#d/${child}$`));
        await expect(edit).toBeVisible();
        await expect(page.locator(".monaco-editor textarea")).toHaveCount(0);
      }
      await page.evaluate(
        async ({ child }) => {
          const { diagramStore } = await window.proofModule("/src/state/diagram-store.ts");
          const { modeStore, modeActions, openDoc } = await window.proofModule(
            "/src/shell/mode-store.ts",
          );
          const diagram = diagramStore.get(),
            mode = modeStore.get(),
            href = window.location.href;
          const check = (value, message) => {
            if (!value) throw Error(message);
          };
          try {
            diagramStore.set({
              path: null,
              text: "dirty",
              loadedText: "clean",
              inspectorOpen: true,
            });
            modeStore.set({ modes: { ...mode.modes, [child]: "edit" } });
            openDoc(child, { mode: "view" });
            check(
              modeStore.get().pendingOpen === child && modeStore.get().pendingOpenMode === "view",
              "Pending navigation retains view mode",
            );
            modeActions.cancelOpen();
            check(
              modeStore.get().pendingOpen === null && modeStore.get().pendingOpenMode === null,
              "Cancel clears requested mode",
            );
            openDoc(child, { mode: "view" });
            modeActions.confirmOpen();
            check(
              modeStore.get().modes[child] === "view" && !diagramStore.get().inspectorOpen,
              "Confirmed navigation is view with inspector closed",
            );
          } finally {
            diagramStore.set(diagram);
            modeStore.set(mode);
            window.history.replaceState(null, "", href);
          }
        },
        { child },
      );
      assert.equal(await readFile(new URL("parent.yaml", disk), "utf8"), parentSource);
      assert.equal(await readFile(new URL("child.yaml", disk), "utf8"), childSource);
      assert.deepEqual(errors, []);
      assert.deepEqual(writes, []);
      results.push({
        theme,
        width,
        preview: "actual child graph below description",
        hover: "no state change or writes",
        navigation: "fresh, cached edit, parent edit and drill open in view",
      });
      console.log(
        `PASS ${theme} ${width}: real child preview, repeated hover/keyboard/Escape, isolated state, read-only navigation, zero writes/errors`,
      );
      await context.close();
    }
} catch (error) {
  if (evidence && page && !page.isClosed())
    await page.screenshot({ path: `${evidence}/failure.png` });
  throw error;
} finally {
  if (evidence) await writeFile(`${evidence}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  await rm(disk, { recursive: true, force: true });
}
