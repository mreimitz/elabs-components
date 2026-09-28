/* global window, document, getComputedStyle */
/**
 * View-mode browser regressions. Start the app in an isolated checkout, then run:
 * DIAGRAM_URL=http://localhost:5413 node apps/diagram/scripts/check-view-mode.mjs
 * Uses the monorepo's existing apps/home Playwright dependency. Creates two disposable
 * workspace files; never edits examples. VIEW_EVIDENCE optionally saves screenshots/logs.
 */
import assert from "node:assert/strict";
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
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (["POST", "PUT", "DELETE"].includes(request.method())) {
    writes.push({ url: request.url(), method: request.method(), body: request.postData() });
  }
});
async function check(name, fn) {
  await fn();
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
        const { diagramStore } = await import("/src/state/diagram-store.ts");
        return diagramStore.get().path;
      }),
    )
    .toBe(file);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
}
const state = () =>
  page.evaluate(async () => {
    const { diagramStore } = await import("/src/state/diagram-store.ts");
    const { workspaceStore } = await import("/src/workspace/workspace-store.ts");
    const { viewOverrideActions } = await import("/src/shell/view-overrides-store.ts");
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
async function editTitle(title) {
  await page.evaluate(async (title) => {
    const { modeActions } = await import("/src/shell/mode-store.ts");
    const { diagramActions } = await import("/src/state/diagram-store.ts");
    modeActions.setMode("edit");
    diagramActions.setTopLevel("title", title);
  }, title);
  await expect
    .poll(async () => {
      const current = await state();
      return current.save === "saved" && !current.dirty;
    })
    .toBe(true);
}
async function setView() {
  await page.evaluate(async () => {
    const { modeActions } = await import("/src/shell/mode-store.ts");
    modeActions.setMode("view");
  });
}
async function setLens(lens) {
  await page.evaluate(async (lens) => {
    const { lensActions } = await import("/src/shell/lens-store.ts");
    lensActions.setLens(lens);
  }, lens);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { lensStore } = await import("/src/shell/lens-store.ts");
        return lensStore.get().position;
      }),
    )
    .toBe(lens === "technical" ? 0 : 1);
}
async function diskHash(file) {
  return createHash("sha256")
    .update(await readFile(path.join(app, "workspace", file)))
    .digest("hex");
}
try {
  for (const file of [first, second]) await writeFile(path.join(app, "workspace", file), source);
  await page.goto(`${baseURL}/#d/${first}`);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await check(
    "view-only direction/style/lens and drag/delete/undo leave disk untouched",
    async () => {
      const before = await diskHash(first);
      const text = (await state()).text;
      const writeStart = writes.length;
      await page.getByRole("radio", { name: "Top to bottom (TB)", exact: true }).click();
      await page.getByRole("radio", { name: "Card nodes", exact: true }).click();
      await expect.poll(async () => (await state()).override).toBe(true);
      const node = page.locator(".react-flow__node[data-id=erp]").first();
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
      await expect(hint).toContainText("Applies to the technical diagram");
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
    await page.locator(".react-flow__pane").click({ position: { x: 10, y: 200 } });
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
      const { modeActions } = await import("/src/shell/mode-store.ts");
      const { diagramActions } = await import("/src/state/diagram-store.ts");
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
        const { workspaceActions } = await import("/src/workspace/workspace-store.ts");
        const { modeActions } = await import("/src/shell/mode-store.ts");
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
    await setLens("visual");
    await editTitle("Old blocked thumbnail");
    await page.waitForTimeout(11000);
    const start = writes.filter((w) => w.url.includes("/thumb")).length;
    await editTitle("Newest saved thumbnail");
    await setLens("technical");
    await expect
      .poll(() => writes.filter((w) => w.url.includes("/thumb")).length, { timeout: 20000 })
      .toBeGreaterThan(start);
    assert.equal((await state()).dirty, false);
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
      await expect(page.locator(".react-flow").first()).toBeVisible();
      assert.ok((await page.locator(".react-flow").first().boundingBox()).width >= 380);
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
      const { workspaceActions } = await import("/src/workspace/workspace-store.ts");
      const { modeActions } = await import("/src/shell/mode-store.ts");
      const { viewOverrideActions } = await import("/src/shell/view-overrides-store.ts");
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
        { checks, errors, writes: writes.map(({ url, method }) => ({ url, method })) },
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
