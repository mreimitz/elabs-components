/** Real YAML details-card proof. Creates only disposable workspace/catalog fixtures. */
/* global window, document, performance, localStorage, URL, process, console, getComputedStyle */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5421";
const evidence = process.env.DETAILS_EVIDENCE;
if (evidence) await mkdir(evidence, { recursive: true });
const vendor = `details-proof-${process.pid}`;
const file = `${vendor}.yaml`,
  component = `${vendor}-component.yaml`;
const disk = new URL(`../workspace/${file}`, import.meta.url);
const catalogDisk = new URL("../catalog/parts/qlik.yaml", import.meta.url);
const originalCatalog = await readFile(catalogDisk, "utf8");
const componentDisk = new URL(`../workspace/${component}`, import.meta.url);
const description =
  "A deliberately long product description with enough words to wrap across more than three lines at every supported width. It describes ingestion, transformation, governance, analysis and delivery, with customer-specific terms preserved.\n\nSecond paragraph stays readable when More is activated.";
const catalogText = (description) =>
  `${vendor}:\n  icon: aws/glue\n  name: Catalog product\n  description: ${JSON.stringify(description)}\n  docs: https://example.org/catalog\n  docs_unverified: true\n  curated: false\n`;
const source = `diagram: "1"\ntitle: Details proof\nnodes:\n  - id: inherited\n    ref: catalog/qlik/${vendor}\n    title: Customer ingestion with a long meaningful name\n    icon: lucide/database\n    status: degraded\n  - id: own\n    ref: catalog/qlik/${vendor}\n    title: Own metadata\n    description: "Own plain text <img src=x onerror=alert(1)>"\n    docs: https://example.org/own\n    href: https://example.org/legacy\n    status: ok\n  - id: cleared\n    ref: catalog/qlik/${vendor}\n    title: Cleared metadata\n    description: ""\n    docs: ""\n    status: planned\n  - id: child\n    ref: ws/${component.replace(".yaml", "")}\n    title: Referenced architecture\n    status: down\n`;
const digest = (value) => createHash("sha256").update(value).digest("hex");
const results = [],
  errors = [],
  writes = [];
const browser = await chromium.launch();
let page;
try {
  await writeFile(disk, source);
  await writeFile(
    componentDisk,
    'diagram: "1"\ntitle: Referenced diagram target\nnodes:\n  - id: target\n    title: Target service\n',
  );
  for (const theme of ["light", "dark"])
    for (const width of [1440, 390]) {
      await writeFile(catalogDisk, originalCatalog + "\n" + catalogText(description));
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript((theme) => {
        localStorage.setItem("brand-ui-theme", theme);
        performance.setResourceTimingBufferSize(10000);
        window.detailsModule = (path) => {
          const url = performance
            .getEntriesByType("resource")
            .findLast((e) => new URL(e.name).pathname === path)?.name;
          if (!url) throw Error("Missing " + path);
          return import(url);
        };
      }, theme);
      page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (["POST", "PUT", "DELETE"].includes(r.method())) writes.push(r.url());
      });
      await page.goto(`${base}/#d/${file}`);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect
        .poll(() =>
          page.evaluate(async () => {
            const { diagramStore } = await window.detailsModule("/src/state/diagram-store.ts");
            return diagramStore.get().path;
          }),
        )
        .toBe(file);
      const card = page.locator("[data-slot=details-card]");
      const node = (id) =>
        page.locator(`[data-lens-pane=technical] .react-flow__node[data-id="${id}"]`);
      let openedId;
      async function close(expectedId = openedId) {
        await page.keyboard.press("Escape");
        await expect(card).toHaveCount(0);
        if (expectedId) await expect(node(expectedId)).toBeFocused();
      }
      async function open(id) {
        openedId = id;
        await node(id).waitFor();
        await node(id).focus();
        await page.keyboard.press("?");
        await expect(card).toBeVisible();
      }
      await open("inherited");
      await expect(
        card.getByRole("heading", { name: "Customer ingestion with a long meaningful name" }),
      ).toBeVisible();
      await expect(card.getByText("Catalog product", { exact: true })).toBeVisible();
      await expect(card.getByText("Degraded", { exact: true })).toBeVisible();
      await expect(card.getByText("Link not checked yet", { exact: true })).toBeVisible();
      const more = card.getByRole("button", { name: "More", exact: true });
      await expect(more).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(card.getByRole("button", { name: "Less", exact: true })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      await page.keyboard.press("Tab");
      await expect(
        card.getByRole("link", { name: "Open docs (opens in a new tab)", exact: true }),
      ).toBeFocused();
      await expect(
        card.getByRole("link", { name: "Open docs (opens in a new tab)", exact: true }),
      ).toHaveAttribute("href", "https://example.org/catalog");
      await expect(
        card.getByRole("link", { name: "Open docs (opens in a new tab)", exact: true }),
      ).toHaveAttribute("target", "_blank");
      await expect(
        card.getByRole("link", { name: "View in catalog", exact: true }),
      ).toHaveAttribute("href", `#catalog/qlik/${vendor}`);
      await expect
        .poll(async () => {
          const box = await card.boundingBox();
          return box !== null && box.x >= 0 && box.x + box.width <= width + 1;
        })
        .toBe(true);
      await expect
        .poll(() => card.evaluate((element) => getComputedStyle(element).opacity))
        .toBe("1");
      assert.deepEqual(
        (await new AxeBuilder({ page }).include("[data-slot=details-card]").analyze()).violations,
        [],
      );
      if (evidence) await page.screenshot({ path: `${evidence}/${theme}-${width}.png` });
      await close();
      await expect(card).toHaveCount(0);
      await expect(node("inherited")).toBeFocused();
      await open("own");
      await expect(
        card.getByText("Own plain text <img src=x onerror=alert(1)>", { exact: true }),
      ).toBeVisible();
      assert.equal(await card.locator("img[src=x]").count(), 0);
      await expect(card.getByText("Healthy", { exact: true })).toBeVisible();
      await expect(
        card.getByRole("link", { name: "Open docs (opens in a new tab)", exact: true }),
      ).toHaveAttribute("href", "https://example.org/own");
      await expect(card.getByText("Link not checked yet")).toHaveCount(0);
      await close();
      await open("cleared");
      await expect(card.locator("[data-slot=details-card-description]")).toHaveCount(0);
      await expect(
        card.getByRole("link", { name: "Open docs (opens in a new tab)", exact: true }),
      ).toHaveCount(0);
      await expect(card.getByText("Planned", { exact: true })).toBeVisible();
      await close();
      await open("inherited");
      await expect(card.getByRole("button", { name: "More", exact: true })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await writeFile(
        catalogDisk,
        originalCatalog + "\n" + catalogText("Catalog changed while this card is open."),
      );
      await expect(
        card.getByText("Catalog changed while this card is open.", { exact: true }),
      ).toBeVisible({ timeout: 10000 });
      await expect(card.locator("[data-slot=details-card-description] p")).toBeFocused();
      assert.equal(digest(await readFile(disk)), digest(source));
      await close();
      await node("own").focus();
      const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-id"));
      await node("inherited").hover();
      await expect(card).toBeVisible();
      assert.equal(
        await page.evaluate(() => document.activeElement?.getAttribute("data-id")),
        focused,
      );
      await close("own");
      await open("child");
      await expect(card.getByText("Diagram reference", { exact: true })).toBeVisible();
      await expect(card.getByText("Down", { exact: true })).toBeVisible();
      await expect(card.getByRole("link", { name: "Open diagram", exact: true })).toHaveAttribute(
        "href",
        `#d/${component}`,
      );
      await card.getByRole("link", { name: "Open diagram", exact: true }).click();
      await expect
        .poll(() =>
          page.evaluate(async () => {
            const { diagramStore } = await window.detailsModule("/src/state/diagram-store.ts");
            return diagramStore.get().path;
          }),
        )
        .toBe(component);
      results.push({
        theme,
        width,
        passed: [
          "catalog identity and header",
          "measured More/Less keyboard",
          "docs safety attributes",
          "own overrides",
          "explicit clears",
          "status words",
          "Escape focus",
          "live catalog no write",
          "pointer hover focus",
          "composite navigation",
        ],
      });
      await context.close();
    }
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log(`PASS ${results.length * 10} details checks; no browser errors or writes`);
} catch (error) {
  if (page && !page.isClosed())
    console.log(
      "DIAGNOSTIC",
      await page.evaluate(async () => {
        const resources = performance
          .getEntriesByType("resource")
          .filter((e) => new URL(e.name).pathname === "/src/state/diagram-store.ts")
          .map((e) => e.name);
        const states = [];
        for (const url of resources) {
          const { diagramStore } = await import(url);
          states.push({
            url,
            path: diagramStore.get().path,
            title: diagramStore.get().drawn.ast?.title,
          });
        }
        return {
          states,
          hash: window.location.hash,
          loading: document.querySelector("[data-document-loading]")?.outerHTML.slice(0, 700),
        };
      }),
    );
  if (evidence && page && !page.isClosed())
    await page.screenshot({ path: `${evidence}/failure.png` });
  throw error;
} finally {
  if (evidence)
    await writeFile(
      `${evidence}/results.json`,
      JSON.stringify({ results, errors, writes }, null, 2),
    );
  await browser.close();
  await writeFile(catalogDisk, originalCatalog);
  await Promise.all(
    [
      disk,
      componentDisk,
      new URL(`../workspace/${file.replace(".yaml", ".thumb.png")}`, import.meta.url),
      new URL(`../workspace/${component.replace(".yaml", ".thumb.png")}`, import.meta.url),
    ].map((path) => rm(path, { force: true })),
  );
}
