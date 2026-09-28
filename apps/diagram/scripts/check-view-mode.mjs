/* global window, document, performance, HTMLImageElement, DOMParser, getComputedStyle */
/**
 * View-mode browser regressions. Start the app in an isolated checkout, then run:
 * DIAGRAM_URL=http://localhost:5413 node apps/diagram/scripts/check-view-mode.mjs
 * Uses the monorepo's existing apps/home Playwright dependency. Creates two disposable
 * workspace files; never edits examples. VIEW_EVIDENCE optionally saves screenshots/logs.
 */
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const app = fileURLToPath(new URL("..", import.meta.url));
const baseURL = process.env.DIAGRAM_URL ?? "http://localhost:5413";
const evidence = process.env.VIEW_EVIDENCE;
if (evidence) await mkdir(evidence, { recursive: true });
const prefix = `view-check-${process.pid}`;
const first = `${prefix}-a.yaml`;
const second = `${prefix}-b.yaml`;
const renamed = `${prefix}-renamed.yaml`;
const source = await readFile(
  path.join(app, "workspace/examples/qlik-cloud-data-gateway.yaml"),
  "utf8",
);
const checks = [];
const cleanup = [first, second, renamed];
const errors = [];
const writes = [];
let thumbnailProof;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
// Vite may serve a versioned singleton URL after a worktree update. Import the exact
// resource loaded by the UI; a bare URL can create a second store containing the seed file.
await context.addInitScript(() => {
  performance.setResourceTimingBufferSize(10_000);
  // Observe the actual SVG passed to the rasterizer, rather than infer its revision from
  // the existence of a PNG. Keep the native setter and all rendering behavior unchanged.
  window.__viewCaptures = [];
  const imageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    ...imageSrc,
    set(value) {
      if (typeof value === "string" && value.startsWith("data:image/svg+xml;charset=utf-8,")) {
        const svg = new DOMParser().parseFromString(
          decodeURIComponent(value.split(",").slice(1).join(",")),
          "image/svg+xml",
        );
        window.__viewCaptures.push({
          title: svg.querySelector("svg > title")?.textContent,
          card: svg.querySelector('[data-slot="diagram-title-card"]')?.textContent,
        });
      }
      imageSrc.set.call(this, value);
    },
  });
  const urls = new Map();
  window.__viewModule = (pathname) => {
    if (!urls.has(pathname)) {
      const resource = performance
        .getEntriesByType("resource")
        .findLast((entry) => new URL(entry.name).pathname === pathname);
      if (!resource) throw new Error(`The UI has not loaded ${pathname}`);
      urls.set(pathname, resource.name);
    }
    return import(urls.get(pathname));
  };
});
const page = await context.newPage();
const technical = page.locator('[data-lens-pane="technical"]');
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (["POST", "PUT", "DELETE"].includes(request.method())) {
    writes.push({ url: request.url(), method: request.method(), body: request.postData() });
  }
});
async function check(name, fn) {
  try {
    await fn();
  } catch (error) {
    if (evidence) await page.screenshot({ path: path.join(evidence, "failure.png") });
    throw error;
  }
  checks.push(name);
  console.log(`PASS ${name}`);
}
async function shot(name) {
  if (evidence) await page.screenshot({ path: path.join(evidence, `${name}.png`) });
}
async function open(file) {
  await page.evaluate((file) => {
    window.location.hash = `d/${file}`;
  }, file);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { diagramStore } = await window.__viewModule("/src/state/diagram-store.ts");
        return diagramStore.get().path;
      }),
    )
    .toBe(file);
  await expect(technical.locator(".react-flow__node").first()).toBeVisible();
}
const state = () =>
  page.evaluate(async () => {
    const { diagramStore } = await window.__viewModule("/src/state/diagram-store.ts");
    const { workspaceStore } = await window.__viewModule("/src/workspace/workspace-store.ts");
    const { viewOverrideActions } = await window.__viewModule("/src/shell/view-overrides-store.ts");
    const diagram = diagramStore.get();
    return {
      path: diagram.path,
      text: diagram.text,
      direction: diagram.drawn.ast?.direction,
      override: viewOverrideActions.hasOverride(diagram.path),
      dirty: workspaceStore.get().dirty,
      save: workspaceStore.get().save,
    };
  });
async function editTitle(title, blockThumbnail = false) {
  await page.evaluate(
    async ({ title, blockThumbnail }) => {
      const { modeActions } = await window.__viewModule("/src/shell/mode-store.ts");
      const { diagramActions, diagramStore } = await window.__viewModule(
        "/src/state/diagram-store.ts",
      );
      const { viewOverrideActions } = await window.__viewModule(
        "/src/shell/view-overrides-store.ts",
      );
      modeActions.setMode("edit");
      diagramActions.setTopLevel("title", title);
      if (blockThumbnail) {
        // Queue a legitimate technical edit, then withhold its preview while the user views
        // a personal override. The visual lens intentionally rejects new content edits.
        modeActions.setMode("view");
        const { path, compiled } = diagramStore.get();
        const direction = compiled.ast.direction;
        viewOverrideActions.setOverride(
          path,
          "direction",
          direction === "LR" ? "TB" : "LR",
          direction,
        );
      }
    },
    { title, blockThumbnail },
  );
  await expect
    .poll(async () => {
      const current = await state();
      return current.save === "saved" && !current.dirty;
    })
    .toBe(true);
}
async function setView() {
  await page.evaluate(async () => {
    const { modeActions } = await window.__viewModule("/src/shell/mode-store.ts");
    modeActions.setMode("view");
  });
}
async function setLens(lens) {
  await page.evaluate(async (lens) => {
    const { lensActions } = await window.__viewModule("/src/shell/lens-store.ts");
    lensActions.setLens(lens);
  }, lens);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { lensStore } = await window.__viewModule("/src/shell/lens-store.ts");
        const current = lensStore.get();
        return { lens: current.lens, animating: current.animating };
      }),
    )
    .toEqual({ lens, animating: false });
  await expect(page.locator(`[data-lens-pane="${lens}"]`)).toBeVisible();
}
async function diskHash(file) {
  return createHash("sha256")
    .update(await readFile(path.join(app, "workspace", file)))
    .digest("hex");
}
try {
  for (const file of [first, second]) await writeFile(path.join(app, "workspace", file), source);
  await page.goto(`${baseURL}/#d/${first}`);
  await expect(technical.locator(".react-flow__node").first()).toBeVisible();
  // Prove all later store assertions observe the same file that the UI opened.
  await expect.poll(async () => (await state()).path).toBe(first);
  assert.equal((await state()).text, source);
  await check(
    "view-only direction/style/lens and drag/delete/undo leave disk untouched",
    async () => {
      const before = await diskHash(first);
      const text = (await state()).text;
      const writeStart = writes.length;
      await page.getByRole("radio", { name: "Top to bottom (TB)", exact: true }).click();
      await page.getByRole("radio", { name: "Card nodes", exact: true }).click();
      await expect.poll(async () => (await state()).override).toBe(true);
      const node = technical.locator(".react-flow__node[data-id=erp]");
      await node.click();
      await page.waitForTimeout(500);
      const position = await node.getAttribute("style");
      const box = await node.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 40, { steps: 8 });
      await page.mouse.up();
      assert.equal(await node.getAttribute("style"), position);
      await page.keyboard.press("ArrowRight");
      assert.equal(await node.getAttribute("style"), position);
      await page.keyboard.press("Delete");
      await page.keyboard.press("ControlOrMeta+z");
      await setLens("visual");
      await setLens("technical");
      await page.waitForTimeout(1100);
      assert.equal((await state()).text, text);
      assert.equal(await diskHash(first), before);
      assert.equal(
        writes.slice(writeStart).filter((w) => w.url.includes("/api/workspace/")).length,
        0,
      );
    },
  );
  await check("scope remains visible at ordinary desktop widths in both themes", async () => {
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => document.documentElement.setAttribute("data-theme", theme),
        theme,
      );
      await page.setViewportSize({ width: 1200, height: 900 });
      const hint = page.locator('[data-slot="view-mode-hint"]');
      await expect(hint).toBeVisible();
      await expect(hint).toContainText("forgotten on reload");
      assert.ok((await page.locator("header h1").boundingBox()).width > 30);
      await setLens("visual");
      await expect(hint).toContainText("Direction and node style apply to the technical diagram");
      await expect(
        page.getByRole("radio", { name: "Top to bottom (TB)", exact: true }),
      ).toBeDisabled();
      await shot(`1200-${theme}-visual`);
      await setLens("technical");
    }
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await page.setViewportSize({ width: 1440, height: 900 });
  });
  await check("reset has an action name and retains keyboard focus", async () => {
    const reset = page.getByRole("button", {
      name: "Reset to the diagram’s own setting",
      exact: true,
    });
    await reset.focus();
    await page.keyboard.press("Enter");
    await expect(reset).toHaveCount(0);
    await expect(
      page.getByRole("radio", { name: "Left to right (LR)", exact: true }),
    ).toBeFocused();
  });
  await check("own unrelated save then switch away/back preserves the override", async () => {
    await page.getByRole("radio", { name: "Top to bottom (TB)", exact: true }).click();
    await editTitle("An unrelated local title change");
    await setView();
    const savedText = (await state()).text;
    await technical.locator(".react-flow__pane").click({ position: { x: 10, y: 200 } });
    await page.keyboard.press("ControlOrMeta+z");
    assert.equal((await state()).text, savedText);
    await open(second);
    await open(first);
    assert.equal((await state()).override, true);
    await expect(
      page.getByRole("radio", { name: "Top to bottom (TB)", exact: true }),
    ).toBeChecked();
  });
  await check("open-file A-B-A changes permanently drop the old override", async () => {
    await page.evaluate(async () => {
      const { modeActions } = await window.__viewModule("/src/shell/mode-store.ts");
      const { diagramActions } = await window.__viewModule("/src/state/diagram-store.ts");
      modeActions.setMode("edit");
      diagramActions.setTopLevel("direction", "TB");
      diagramActions.setTopLevel("direction", "LR");
      modeActions.setMode("view");
    });
    assert.equal((await state()).override, false);
  });
  await check("offscreen disk A-B-A drops stale override on reopen", async () => {
    await page.getByRole("radio", { name: "Top to bottom (TB)", exact: true }).click();
    await open(second);
    const file = path.join(app, "workspace", first);
    const text = await readFile(file, "utf8");
    await writeFile(file, text.replace("direction: LR", "direction: TB"));
    await page.waitForTimeout(200);
    await writeFile(file, text);
    await page.waitForTimeout(200);
    await open(first);
    assert.equal((await state()).override, false);
  });
  await check("rename carries the override; resetting it clears the renamed key", async () => {
    await page.getByRole("radio", { name: "Top to bottom (TB)", exact: true }).click();
    await page.evaluate(
      async ({ first, renamed }) => {
        const { workspaceActions } = await window.__viewModule("/src/workspace/workspace-store.ts");
        const { modeActions } = await window.__viewModule("/src/shell/mode-store.ts");
        const moved = await workspaceActions.move(first, renamed);
        modeActions.moved(first, moved);
      },
      { first, renamed },
    );
    await open(renamed);
    assert.equal((await state()).override, true);
    await page
      .getByRole("button", { name: "Reset to the diagram’s own setting", exact: true })
      .click();
    assert.equal((await state()).override, false);
  });
  await check("a blocked old thumbnail cannot supersede a newer save", async () => {
    const oldStart = writes.filter((w) => w.url.includes("/thumb")).length;
    const thumbFile = renamed.replace(/\.yaml$/, ".thumb.png");
    const beforeThumbnailHash = await diskHash(thumbFile).catch(() => null);
    const captureStart = await page.evaluate(() => window.__viewCaptures.length);
    await editTitle("Old blocked thumbnail", true);
    const oldYamlHash = await diskHash(renamed);
    // Exercise the deferred retry after the existing ten-second capture throttle expires.
    await page.waitForTimeout(11000);
    assert.equal(writes.filter((w) => w.url.includes("/thumb")).length, oldStart);
    await editTitle("Newest saved thumbnail", true);
    const newestYamlHash = await diskHash(renamed);
    assert.notEqual(newestYamlHash, oldYamlHash);
    assert.match(
      await readFile(path.join(app, "workspace", renamed), "utf8"),
      /title: Newest saved thumbnail/,
    );
    assert.equal(writes.filter((w) => w.url.includes("/thumb")).length, oldStart);
    assert.equal(await page.evaluate(() => window.__viewCaptures.length), captureStart);
    await page
      .getByRole("button", { name: "Reset to the diagram’s own setting", exact: true })
      .click();
    await expect
      .poll(() => writes.filter((w) => w.url.includes("/thumb")).length, { timeout: 20000 })
      .toBe(oldStart + 1);
    const posted = JSON.parse(writes.filter((w) => w.url.includes("/thumb")).at(-1).body);
    assert.equal(posted.path, renamed);
    const postedHash = createHash("sha256")
      .update(Buffer.from(posted.png.split(",")[1], "base64"))
      .digest("hex");
    await expect.poll(() => diskHash(thumbFile).catch(() => null)).toBe(postedHash);
    const captures = await page.evaluate(
      (start) => window.__viewCaptures.slice(start),
      captureStart,
    );
    assert.equal(captures.length, 1);
    assert.equal(captures[0].title, "Newest saved thumbnail");
    assert.match(captures[0].card, /Newest saved thumbnail/);
    assert.equal(await diskHash(renamed), newestYamlHash);
    assert.equal((await state()).dirty, false);
    thumbnailProof = {
      oldYamlHash,
      newestYamlHash,
      beforeThumbnailHash,
      postedHash,
      captures,
      writesWhileBlocked: 0,
    };
    await setView();
  });
  await check("phone canvas draws; legend/zoom and presentation exit stay reachable", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => document.documentElement.setAttribute("data-theme", theme),
        theme,
      );
      await setLens("technical");
      await expect(technical.locator(".react-flow")).toBeVisible();
      assert.ok((await technical.locator(".react-flow").boundingBox()).width >= 380);
      await page.waitForTimeout(400);
      for (const name of ["Zoom in", "Zoom out", "Fit view", "Legend"]) {
        const button = page.getByRole("button", { name, exact: true });
        await expect(button).toBeVisible();
        assert.equal(
          await button.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          }),
          true,
          name,
        );
      }
      await page.getByRole("button", { name: "Diagram options", exact: true }).click();
      await page.getByRole("menuitemradio", { name: "Visual", exact: true }).click();
      await page.getByRole("button", { name: "Diagram options", exact: true }).click();
      const direction = page.getByRole("menuitemradio", { name: "TB, top to bottom", exact: true });
      await expect(direction).toBeDisabled();
      assert.equal(await direction.evaluate((el) => getComputedStyle(el).opacity), "0.5");
      await shot(`390-${theme}-visual-menu`);
      await page.keyboard.press("Escape");
      await setLens("technical");
      await shot(`390-${theme}-technical`);
    }
    await page.evaluate(() => {
      window.location.hash += "&present";
    });
    await expect(
      page.getByRole("button", { name: "Exit presentation", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Exit presentation", exact: true }).click();
  });
  await check(
    "different share links keep independent overrides and reload forgets them",
    async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const links = await page.evaluate(async (source) => {
        const { encodeDoc } = await import("/src/io/share-url.ts");
        return [
          await encodeDoc(source),
          await encodeDoc(source.replace("title: Qlik Cloud", "title: Another Qlik Cloud")),
        ];
      }, source);
      const visitShare = async (link) => {
        await page.evaluate((link) => {
          window.location.hash = `doc=${link}`;
        }, link);
        await expect.poll(async () => (await state()).path).toBe(null);
        await page.waitForTimeout(400);
      };
      await visitShare(links[0]);
      await page.getByRole("radio", { name: "Top to bottom (TB)", exact: true }).click();
      await visitShare(links[1]);
      await expect(
        page.getByRole("radio", { name: "Left to right (LR)", exact: true }),
      ).toBeChecked();
      await expect(
        page.getByRole("button", { name: "Reset to the diagram’s own setting", exact: true }),
      ).toHaveCount(0);
      await visitShare(links[0]);
      await expect(
        page.getByRole("radio", { name: "Top to bottom (TB)", exact: true }),
      ).toBeChecked();
      await page.reload();
      await expect(
        page.getByRole("radio", { name: "Left to right (LR)", exact: true }),
      ).toBeChecked();
    },
  );
  await check("trashing a file forgets its view override", async () => {
    await open(renamed);
    await page.getByRole("radio", { name: "Top to bottom (TB)", exact: true }).click();
    const trashed = await page.evaluate(async (renamed) => {
      const { workspaceActions } = await window.__viewModule("/src/workspace/workspace-store.ts");
      const { modeActions } = await window.__viewModule("/src/shell/mode-store.ts");
      const { viewOverrideActions } = await window.__viewModule(
        "/src/shell/view-overrides-store.ts",
      );
      const trashed = await workspaceActions.trash(renamed);
      modeActions.closeTabsAt(renamed);
      return { path: trashed, hasOverride: viewOverrideActions.hasOverride(renamed) };
    }, renamed);
    cleanup.push(trashed.path);
    assert.equal(trashed.hasOverride, false);
  });
  assert.deepEqual(errors, []);
  console.log(`PASS ${checks.length} view-mode regressions; no browser errors`);
} finally {
  if (evidence)
    await writeFile(
      path.join(evidence, "results.json"),
      JSON.stringify(
        {
          checks,
          errors,
          thumbnailProof,
          writes: writes.map(({ url, method }) => ({ url, method })),
        },
        null,
        2,
      ),
    );
  await browser.close();
  for (const file of cleanup) {
    await rm(path.join(app, "workspace", file), { force: true });
    await rm(path.join(app, "workspace", file.replace(/\.yaml$/, ".thumb.png")), { force: true });
  }
}
