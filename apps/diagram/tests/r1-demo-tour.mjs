/** Maintainer acceptance tour. Run only after the complete R1 app is integrated, on an
 * isolated checkout/server. Real UI writes touch only the Home-created customer copy.
 * The primary recording includes the offline export; a second clip proves persisted reopen.
 * R1_PREFLIGHT=1 stops after step 10 without writing accepted release artifacts.
 * R1_EVIDENCE controls diagnostics, R1_RELEASE_DIR the two successful tour recordings. */
/* global window, performance, localStorage, setTimeout, clearTimeout */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import process from "node:process";
import console from "node:console";
const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const root = fileURLToPath(new URL("../", import.meta.url));
const base = process.env.DIAGRAM_URL ?? "http://127.0.0.1:5446";
const evidence = path.resolve(process.env.R1_EVIDENCE ?? path.join(root, ".evidence/r1-tour"));
const releases = path.resolve(process.env.R1_RELEASE_DIR ?? path.join(root, "docs/releases"));
const pace = Number(process.env.R1_PACE_MS ?? 4500);
const preflight = process.env.R1_PREFLIGHT === "1";
const template = "templates/qlik-cloud-customer-landscape.yaml";
const templateFile = path.join(root, "workspace", template);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const originalTemplate = await readFile(templateFile);
const componentFile = path.join(root, "workspace/components/qlik-cloud-tenant.yaml");
const originalComponent = await readFile(componentFile);
const originalFiles = new Set(
  await readdir(path.join(root, "workspace/customers")).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  }),
);
await mkdir(evidence, { recursive: true });
const startedAt = Date.now();
const steps = [],
  errors = [],
  externalRequests = [],
  writes = [],
  offlineRequests = [];
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "no-preference",
  acceptDownloads: true,
  recordVideo: { dir: path.join(evidence, "clips"), size: { width: 1440, height: 900 } },
});
await context.addInitScript(() => {
  localStorage.setItem("brand-ui-theme", "qlik-light");
  performance.setResourceTimingBufferSize(20000);
  window.tourModule = (pathname) => {
    const entry = performance
      .getEntriesByType("resource")
      .findLast((item) => new URL(item.name).pathname === pathname);
    if (!entry) throw new Error(`App module not loaded: ${pathname}`);
    return import(entry.name);
  };
});
await context.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (["http:", "https:"].includes(url.protocol) && url.origin !== new URL(base).origin) {
    externalRequests.push(url.href);
    await route.abort();
  } else await route.continue();
});
let page = await context.newPage();
const primaryVideo = page.video();
let reopenVideo,
  copyPath,
  savedText,
  downloadPath,
  success = false,
  completed = false;
function observe(current) {
  current.on("pageerror", (error) => errors.push(error.stack ?? error.message));
  current.on("request", (request) => {
    if (request.url().includes("/api/workspace/") && request.method() !== "GET")
      writes.push({
        method: request.method(),
        url: request.url(),
        path: new URL(request.url()).searchParams.get("path") ?? request.postDataJSON()?.path,
      });
  });
}
observe(page);
const state = () =>
  page.evaluate(async () => {
    const { diagramStore } = await window.tourModule("/src/state/diagram-store.ts");
    const { lensStore } = await window.tourModule("/src/shell/lens-store.ts");
    const { workspaceStore } = await window.tourModule("/src/workspace/workspace-store.ts");
    const { storyStore } = await window.tourModule("/src/story/story-store.ts");
    const current = diagramStore.get();
    return {
      path: current.path,
      text: current.text,
      dirty: workspaceStore.get().dirty,
      save: workspaceStore.get().save,
      ok: current.compiled.ok,
      title: current.compiled.ast?.title,
      nodes: current.drawn.graph?.nodes.length,
      edges: current.drawn.graph?.edges.length,
      lens: lensStore.get(),
      story: { index: storyStore.get().index, playing: storyStore.get().playing },
    };
  });
const saved = async () => {
  await expect
    .poll(
      async () => {
        const current = await state();
        return (
          current.path === copyPath &&
          current.ok &&
          !current.dirty &&
          ["idle", "saved"].includes(current.save)
        );
      },
      { timeout: 20000 },
    )
    .toBe(true);
  await expect
    .poll(
      async () =>
        (await readFile(path.join(root, "workspace", copyPath), "utf8")) === (await state()).text,
    )
    .toBe(true);
};
const node = (id) =>
  page.locator(`[data-lens-pane="technical"] .react-flow__node[data-id="${id}"]`).first();
const canvasFocus = () => page.locator('[data-lens-pane="technical"]').focus();
const settleLens = (lens) =>
  expect
    .poll(
      async () => {
        const s = (await state()).lens;
        return !s.animating && s.position === (lens === "visual" ? 1 : 0);
      },
      { timeout: 20000 },
    )
    .toBe(true);
async function checkpoint(number, description, details = {}) {
  await page.screenshot({ path: path.join(evidence, `${String(number).padStart(2, "0")}.png`) });
  if (pace > 0) await page.waitForTimeout(pace);
  steps.push({
    number,
    description,
    status: "pass",
    elapsedSeconds: (Date.now() - startedAt) / 1000,
    ...details,
  });
  await writeFile(
    path.join(evidence, "steps.json"),
    JSON.stringify({ steps, errors, externalRequests, writes }, null, 2),
  );
}
async function selectYamlText(find) {
  await page.evaluate(async (find) => {
    const entry = performance
      .getEntriesByType("resource")
      .findLast((item) => new URL(item.name).pathname.endsWith("/monaco-editor.js"));
    if (!entry) throw new Error("Monaco is not loaded");
    const monaco = await import(entry.name);
    const editor = monaco.editor
      .getEditors()
      .find((editor) => editor.getModel()?.getLanguageId() === "yaml");
    const model = editor?.getModel();
    if (!editor || !model) throw new Error("YAML editor missing");
    const offset = model.getValue().indexOf(find);
    if (offset < 0) throw new Error(`YAML selection not found: ${find}`);
    const start = model.getPositionAt(offset),
      end = model.getPositionAt(offset + find.length);
    editor.setSelection({
      startLineNumber: start.lineNumber,
      startColumn: start.column,
      endLineNumber: end.lineNumber,
      endColumn: end.column,
    });
    editor.revealPositionInCenter(start);
    editor.focus();
  }, find);
}
try {
  await page.goto(`${base}/#home`);
  await expect(page.getByRole("button", { name: "New from template", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "New diagram", exact: true })).toBeVisible();
  await checkpoint(1, "Home entry points available");

  await page.getByRole("button", { name: "New from template", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Qlik Cloud and the customer landscape", exact: true })
    .click();
  await expect(node("erp")).toBeVisible();
  await expect.poll(async () => (await state()).path ?? "").toMatch(/^customers\//);
  copyPath = (await state()).path;
  assert(!originalFiles.has(path.basename(copyPath)), "Home must create a new customer file");
  await expect(page.getByRole("button", { name: /^Done/ })).toBeVisible();
  assert.match((await state()).title, /\(copy(?: \d+)?\)$/);
  await saved();
  await expect(node("erp")).toBeVisible();
  await expect(page.locator('[data-slot="flow-particles"]')).toHaveCount(1);
  assert.equal(hash(await readFile(templateFile)), hash(originalTemplate));
  await checkpoint(2, "Numbered customer copy opens Edit with technical particles", { copyPath });

  await page.getByRole("button", { name: /^Done/ }).click();
  await node("gateway").hover();
  const details = page.locator('[data-slot="details-card"]');
  await expect(details).toBeVisible();
  await expect(details).toContainText("Qlik Data Gateway");
  await expect(details.locator('[data-slot="details-card-description"]')).not.toBeEmpty();
  await expect(details.getByRole("link", { name: /Open docs/ })).toHaveAttribute(
    "href",
    /^https:\/\//,
  );
  await checkpoint(3, "Gateway hover exposes safe documentation and description");
  await page.keyboard.press("Escape");

  await node("tenant").dblclick();
  await expect(page.locator('[data-slot="drill-canvas"]')).toBeVisible();
  await expect(
    page.locator('[data-slot="drill-canvas"] .react-flow__node[data-id="qtdi"]'),
  ).toBeVisible();
  await checkpoint(4, "Read-only tenant drill-down with inner nodes");
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-slot="drill-canvas"]')).toHaveCount(0);
  assert.equal(hash(await readFile(componentFile)), hash(originalComponent));

  await canvasFocus();
  await page.keyboard.press("e");
  await expect(page.locator(".monaco-editor textarea")).toBeVisible();
  const titleLine = (await state()).text.match(/^title:.*$/m)?.[0];
  assert(titleLine);
  await selectYamlText(titleLine);
  await page.keyboard.insertText("title: Contoso");
  await saved();
  assert.equal((await state()).title, "Contoso");
  await checkpoint(5, "Real keyboard title edit saves Contoso without renaming its file");

  const positionsBefore = await page
    .locator('[data-lens-pane="technical"] .react-flow__node')
    .evaluateAll((nodes) =>
      Object.fromEntries(
        nodes
          .filter((node) => node.dataset.id !== "erp")
          .map((node) => [node.dataset.id, node.style.transform]),
      ),
    );
  await node("erp").click();
  const form = page.getByRole("form", { name: "Node", exact: true });
  await form.getByRole("textbox", { name: "Title", exact: true }).fill("Contoso ERP (SAP)");
  await form.getByRole("textbox", { name: "Icon", exact: true }).fill("sap/s4hana");
  await form.getByRole("textbox", { name: "Icon", exact: true }).press("Tab");
  await saved();
  assert.match((await state()).text, /title: Contoso ERP \(SAP\)/);
  assert.match((await state()).text, /icon: sap\/s4hana/);
  await expect(node("erp")).toContainText("Contoso ERP (SAP)");
  const positionsAfter = await page
    .locator('[data-lens-pane="technical"] .react-flow__node')
    .evaluateAll((nodes) =>
      Object.fromEntries(
        nodes
          .filter((node) => node.dataset.id !== "erp")
          .map((node) => [node.dataset.id, node.style.transform]),
      ),
    );
  assert.deepEqual(
    positionsAfter,
    positionsBefore,
    "Inspector overrides must not move unrelated nodes",
  );
  await checkpoint(6, "Inspector title and icon overrides save to the customer copy");

  await selectYamlText("\nnotes:");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.insertText("\n  - erp -> ");
  await page.keyboard.press("Control+Space");
  const popup = page.locator(".suggest-widget.visible");
  await expect(popup).toBeVisible();
  await page.keyboard.type("tenant.qt");
  const suggestion = popup
    .locator(".monaco-list-row")
    .filter({ has: page.locator(".label-name", { hasText: "tenant.qtdi" }) })
    .first();
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  await page.keyboard.insertText(": CDC");
  await page.keyboard.press("Escape");
  await saved();
  assert.match((await state()).text, /- erp -> tenant\.qtdi: CDC/);
  await checkpoint(7, "Real Monaco completion adds the qualified CDC flow");

  await page.getByRole("button", { name: /^Done/ }).click();
  await canvasFocus();
  await page.keyboard.press("l");
  await settleLens("visual");
  await expect(
    page.locator('[data-lens-pane="visual"] [data-slot="capability-box"]').first(),
  ).toBeVisible();
  const visualText = (await state()).text;
  await checkpoint(8, "Authored Qlik visual layout after a normal-motion morph");

  await page.getByRole("button", { name: "Play story in technical view", exact: true }).click();
  await settleLens("technical");
  await expect.poll(async () => (await state()).story.index).toBe(0);
  await expect(page.getByText("Sources and the security boundary", { exact: true })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Next step", exact: true }).click();
  await expect.poll(async () => (await state()).story.index).toBe(1);
  await expect(page.getByText("The gateway dials out only", { exact: true })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Pause story", exact: true }).click();
  await expect.poll(async () => (await state()).story.playing).toBe(false);
  assert.equal((await state()).text, visualText);
  await checkpoint(
    9,
    "Visual story handoff starts technical fit/follow playback without YAML writes",
  );

  await page.getByRole("button", { name: "Present story", exact: true }).click();
  await expect(page.getByRole("main", { name: "Diagram presentation" })).toBeVisible();
  await expect(page.locator('[data-slot="diagram-toolbar"]')).toHaveCount(0);
  await page.getByRole("main", { name: "Diagram presentation" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await state()).story.index).toBe(2);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await state()).story.index).toBe(1);
  await checkpoint(10, "Chrome-free presentation retains story keyboard navigation");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-slot="diagram-toolbar"]')).toBeVisible();
  await saved();
  savedText = (await state()).text;

  if (!preflight) {
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await expect(page.getByText("Notes and metrics are excluded.", { exact: true })).toBeVisible();
    const downloading = page.waitForEvent("download", { timeout: 90000 });
    await page.getByRole("menuitem", { name: "Interactive HTML", exact: true }).click();
    const download = await downloading;
    assert.match(download.suggestedFilename(), /\.atlas\.html$/);
    downloadPath = path.join(evidence, download.suggestedFilename());
    await download.saveAs(downloadPath);
    assert((await stat(downloadPath)).size > 1000);
    await context.setOffline(true);
    page.on("request", (request) => {
      if (/^https?:/.test(request.url())) offlineRequests.push(request.url());
    });
    await page.goto(pathToFileURL(downloadPath).href);
    await expect(page.getByRole("radio", { name: "Technical", exact: true })).toBeVisible();
    await expect(
      page.locator('[data-lens-pane="technical"] .react-flow__node[data-id="erp"]'),
    ).toContainText("Contoso ERP (SAP)");
    await page.getByRole("radio", { name: "Visual", exact: true }).click();
    await expect(page.locator('[data-lens-pane="visual"]')).toHaveCSS("opacity", "1");
    await expect(
      page.locator('[data-lens-pane="visual"] [data-slot="capability-box"]').first(),
    ).toBeVisible();
    await page.waitForTimeout(1200);
    await page.getByRole("radio", { name: "Technical", exact: true }).click();
    await expect(page.locator('[data-lens-pane="technical"]')).toHaveCSS("opacity", "1");
    await page.getByRole("button", { name: /^Walk through \d+ steps$/ }).click();
    await page.getByRole("button", { name: "Next step", exact: true }).click();
    await expect(page.getByText("The gateway dials out only", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "End story", exact: true }).click();
    await page.locator('[data-lens-pane="technical"] .react-flow__node[data-id="gateway"]').focus();
    await page.keyboard.press("?");
    await expect(page.locator('[data-slot="details-card"]')).toBeVisible();
    await expect(page.locator(".monaco-editor")).toHaveCount(0);
    assert.deepEqual(offlineRequests, []);
    await checkpoint(
      11,
      "Downloaded customer-safe HTML works offline with both lenses, story and details",
      { download: path.basename(downloadPath), bytes: (await stat(downloadPath)).size },
    );
    await page.close();

    await context.setOffline(false);
    page = await context.newPage();
    reopenVideo = page.video();
    observe(page);
    await page.goto(`${base}/#home`);
    const recentCopy = page
      .getByLabel("Recent", { exact: true })
      .getByRole("link", { name: "Contoso", exact: true });
    await expect(recentCopy).toBeVisible();
    await recentCopy.click();
    await expect(node("erp")).toBeVisible();
    await expect.poll(async () => (await state()).path).toBe(copyPath);
    assert.equal((await state()).text, savedText);
    assert.equal(await readFile(path.join(root, "workspace", copyPath), "utf8"), savedText);
    assert.equal(hash(await readFile(templateFile)), hash(originalTemplate));
    assert.equal(hash(await readFile(componentFile)), hash(originalComponent));
    await checkpoint(
      12,
      "Closed tab reopens the persisted customer copy; source files stay unchanged",
    );
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(offlineRequests, []);
  for (const request of writes) {
    const written = request.path;
    assert(
      written === copyPath || written === copyPath.replace(/\.ya?ml$/, ".thumb.png"),
      `Unexpected workspace write: ${request.url}`,
    );
  }
  completed = true;
  success = !preflight;
} catch (error) {
  await page.screenshot({ path: path.join(evidence, "failure.png") }).catch(() => {});
  await writeFile(path.join(evidence, "failure.txt"), error.stack ?? String(error));
  throw error;
} finally {
  await context.close();
  if (copyPath && !originalFiles.has(path.basename(copyPath))) {
    await rm(path.join(root, "workspace", copyPath), { force: true });
    await rm(path.join(root, "workspace", copyPath.replace(/\.ya?ml$/, ".thumb.png")), {
      force: true,
    });
  }
  const report = {
    success,
    preflight,
    preflightPassed: preflight && completed,
    commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    browser: browser.version(),
    viewport: { width: 1440, height: 900 },
    theme: "qlik-light",
    motion: "normal",
    steps,
    errors,
    externalRequests,
    offlineRequests,
    writes,
    templateHash: hash(originalTemplate),
    componentHash: hash(originalComponent),
    copyPath,
    cleaned: Boolean(copyPath),
  };
  try {
    if (success) {
      await mkdir(releases, { recursive: true });
      const artifacts = [];
      for (const [video, name] of [
        [primaryVideo, "r1-tour.webm"],
        [reopenVideo, "r1-tour-reopen.webm"],
      ]) {
        const target = path.join(releases, name);
        await video.saveAs(target);
        const probe = await browser.newPage();
        await probe.goto(pathToFileURL(target).href);
        const seconds = await probe.locator("video").evaluate(
          (video) =>
            new Promise((resolve, reject) => {
              let seekingEnd = false;
              const timer = setTimeout(
                () => reject(new Error("Video duration unavailable after bounded end seek")),
                10000,
              );
              const finish = () => {
                if (Number.isFinite(video.duration) && video.duration > 0) {
                  clearTimeout(timer);
                  resolve(video.duration);
                } else if (video.readyState >= 1 && !seekingEnd) {
                  // Streaming WebM metadata may initially report Infinity. Seeking beyond its
                  // end makes Chromium determine the actual last timestamp without re-recording.
                  seekingEnd = true;
                  video.currentTime = 1e10;
                }
              };
              for (const event of ["loadedmetadata", "durationchange", "seeked", "timeupdate"])
                video.addEventListener(event, finish);
              video.addEventListener(
                "error",
                () => {
                  clearTimeout(timer);
                  reject(new Error("Recording did not load"));
                },
                { once: true },
              );
              finish();
            }),
        );
        await probe.close();
        artifacts.push({ name, seconds, bytes: (await stat(target)).size });
      }
      report.artifacts = artifacts;
      await writeFile(
        path.join(releases, "r1-tour-run.md"),
        `# R1 maintainer tour\n\nAutomated engineering verification passed all twelve [demo steps](../demo-script.md) on ${report.commit}.\n\n- [Main tour](r1-tour.webm): ${artifacts[0].seconds.toFixed(1)} seconds, ${artifacts[0].bytes.toLocaleString("en-US")} bytes. Includes the actual offline HTML.\n- [Persisted reopen](r1-tour-reopen.webm): ${artifacts[1].seconds.toFixed(1)} seconds, ${artifacts[1].bytes.toLocaleString("en-US")} bytes.\n\nBrowser: Chromium ${report.browser}; 1440 × 900, Qlik light, normal motion. No external network requests or browser exceptions occurred. Template and referenced component hashes stayed unchanged. The test customer copy was removed after its saved contents were verified.\n\nReproduce on an isolated dev server with \`DIAGRAM_URL=http://127.0.0.1:5446 node tests/r1-demo-tour.mjs\` from apps/diagram; see [the test harness](../../tests/r1-demo-tour.mjs). Evidence includes per-step screenshots, JSON results and the downloaded HTML. This is automated engineering verification, not proof of real-deal adoption or written owner acceptance. Phase B onboarding remains outside this tour.\n`,
      );
    }
  } catch (error) {
    report.success = false;
    report.recordingError = error.stack ?? String(error);
    success = false;
    process.exitCode = 1;
    console.error(report.recordingError);
  } finally {
    await writeFile(path.join(evidence, "result.json"), JSON.stringify(report, null, 2));
    if (report.success)
      await writeFile(path.join(releases, "r1-tour-result.json"), JSON.stringify(report, null, 2));
    await browser.close();
  }
}
console.log(JSON.stringify({ steps: steps.length, success, preflight, evidence }, null, 2));
