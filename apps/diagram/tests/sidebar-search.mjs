/**
 * Browser regressions against a running diagram dev server. Uses an isolated context and
 * virtual HTTP fixtures, leaving the workspace unchanged. Run with Playwright available:
 * DIAGRAM_URL=http://localhost:5412 PLAYWRIGHT_MODULE=playwright node tests/sidebar-search.mjs
 * PLAYWRIGHT_MODULE can also identify an installed Playwright module's file URL.
 */
/* global document, getComputedStyle */
import process from "node:process";
import console from "node:console";
import { URL } from "node:url";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const baseURL = process.env.DIAGRAM_URL ?? "http://localhost:5412";
const evidence = process.env.SEARCH_EVIDENCE_DIR;
if (evidence) await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];
const queries = [
  "aws",
  "lakehouse",
  "snowflake",
  "dmz",
  "the customer",
  "replication",
  "reuse",
  "license check",
  "cataloged",
  "qlik-cloud-tenant",
  "NAT gateway",
  "Customer Tenant",
  "grafana okta",
  "cloud landscape",
  "qlik customer",
  "lakehouse snow",
  "knowledge",
  "alpha beta gamma",
  "longmatchwithoutbreaks",
  "tenant",
  "examples/lakehouse",
  "knowledge laterword",
];
const fixture = `version: 1\ntitle: Alpha with a very long middle and Beta\ndescription: Longmatchwithoutbreaks and knowledge ${"context ".repeat(2000)} laterword\nnodes:\n  - id: gamma\n    title: Gamma\n`;
const fixtures = Object.fromEntries(
  [1, 2, 3].map((depth) => [
    `${["search-fixture", "nested", "deep"].slice(0, depth).join("/")}/fixture.yaml`,
    fixture,
  ]),
);
let checks = 0;
try {
  for (const width of [1440, 1280, 390])
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/api/workspace/tree", async (route) => {
        const response = await route.fetch();
        const tree = await response.json();
        tree.folders.push("search-fixture", "search-fixture/nested", "search-fixture/nested/deep");
        tree.files.push(
          ...Object.keys(fixtures).map((path) => ({
            path,
            title: "Alpha with a very long middle and Beta",
            mtime: 1,
            size: fixture.length,
          })),
        );
        await route.fulfill({ response, json: tree });
      });
      await page.route("**/api/workspace/file?*", (route) => {
        const path = new URL(route.request().url()).searchParams.get("path");
        return fixtures[path]
          ? route.fulfill({
              body: fixtures[path],
              headers: { "X-Workspace-Mtime": "1", "Content-Type": "text/yaml" },
            })
          : route.continue();
      });
      await page.goto(`${baseURL}/#home`);
      if (width === 1440 && theme === "light") {
        const matching = await page.evaluate(async () => {
          const { buildEntry, matchEntry, queryWords } =
            await import("/src/workspace/search-index.ts");
          const entry = buildEntry(
            { path: "fixture.yaml", title: "Architecture", mtime: 1 },
            "nodes:\n  - id: grafana\n    title: Grafana\n  - id: okta\n    title: Okta\n  - id: snowflake\n    title: Snowflake\n",
          );
          const match = matchEntry(entry, [], queryWords("grafana okta snowflake"));
          return {
            fields: match.reasons.map((reason) => reason.field),
            texts: match.reasons.map((reason) => reason.text),
            missing: matchEntry(entry, [], queryWords("grafana nonexistent")),
          };
        });
        assert.deepEqual(matching.fields, ["boxTitle", "boxTitle", "boxTitle"]);
        assert.deepEqual(matching.texts, ["Grafana", "Okta", "Snowflake"]);
        assert.equal(matching.missing, null);
      }
      await page.evaluate(
        (theme) => document.documentElement.setAttribute("data-theme", theme),
        theme,
      );
      await page.keyboard.press("/");
      const input = page.getByRole("textbox", { name: "Search workspace" });
      await input.waitFor();
      await input.fill("aws");
      await page.waitForFunction(() => document.querySelector("a[data-tree-path] strong"));
      // The opening sidebar animates its width before the first measurement.
      await page.waitForTimeout(350);
      const measure = async (query) =>
        page.evaluate((query) => {
          const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
          const words = fold(query).trim().split(/\s+/).filter(Boolean);
          return [...document.querySelectorAll("a[data-tree-path]")].flatMap((row) => {
            const visible = [...row.querySelectorAll("strong")]
              .filter((strong) => {
                const evidence = strong.closest("[data-search-evidence]");
                const box = (evidence ?? strong.parentElement).getBoundingClientRect();
                let right = box.right;
                if (
                  !evidence &&
                  strong.parentElement.scrollWidth > strong.parentElement.clientWidth
                ) {
                  const canvas = document.createElement("canvas");
                  const ctx = canvas.getContext("2d");
                  ctx.font = getComputedStyle(strong.parentElement).font;
                  right -= ctx.measureText("…").width;
                }
                return [...strong.getClientRects()].every(
                  (r) => r.left >= box.left - 1 && r.right <= right + 1 && r.width > 0,
                );
              })
              .map((s) => fold(s.textContent));
            const missing = words.filter((word) => !visible.some((text) => text.includes(word)));
            return missing.length ? [{ path: row.dataset.treePath, missing, visible }] : [];
          });
        }, query);
      for (const query of queries) {
        await input.fill(query);
        await page.waitForTimeout(60);
        const missing = await measure(query);
        checks++;
        if (missing.length) failures.push({ width, theme, query, missing });
      }
      await input.fill("knowledge laterword");
      await page.waitForTimeout(60);
      const heights = await page
        .locator('a[data-tree-path^="search-fixture"]')
        .evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
      assert(
        heights.every((height) => height < 180),
        "distant description matches must keep bounded snippets",
      );
      // Each incremental key and backspace must remeasure even if the result rows remain mounted.
      await input.fill("");
      for (const character of "aws") {
        await input.pressSequentially(character);
        await page.waitForTimeout(50);
        const query = await input.inputValue();
        const missing = await measure(query);
        checks++;
        if (missing.length) failures.push({ width, theme, typed: query, missing });
      }
      for (let i = 0; i < 2; i++) {
        await input.press("Backspace");
        await page.waitForTimeout(50);
        const query = await input.inputValue();
        const missing = await measure(query);
        checks++;
        if (missing.length) failures.push({ width, theme, backspaced: query, missing });
      }
      await input.fill("alpha beta gamma");
      await page.waitForTimeout(100);
      assert.equal(await page.locator('a[data-tree-path^="search-fixture"]').count(), 3);
      if (evidence) await page.screenshot({ path: `${evidence}/${width}-${theme}-nested.png` });
      // Resize the persistent rail; the title itself and matches need no React update for this.
      if (width > 390) {
        await page.evaluate(() =>
          document
            .querySelector('[data-slot="sidebar-wrapper"]')
            .style.setProperty("--sidebar-width", "22rem"),
        );
        await page.waitForTimeout(100);
        const missing = await measure("alpha beta gamma");
        checks++;
        if (missing.length) failures.push({ width, theme, resize: true, missing });
      }
      await input.fill("tenant");
      await page.waitForTimeout(60);
      const tenant = page.locator('a[data-tree-path="components/qlik-cloud-tenant.yaml"]');
      if (await tenant.count())
        assert.equal(
          await tenant.locator("[data-search-evidence]").count(),
          0,
          "fully visible title must not gain false evidence",
        );
      await input.fill("not-a-real-result-string");
      await page.waitForTimeout(60);
      assert.equal(await page.locator("a[data-tree-path]").count(), 0);
      await input.press("Escape");
      assert.equal(await input.inputValue(), "");
      await input.press("Escape");
      if (width === 390) await input.waitFor({ state: "hidden" });
      await page.keyboard.press("/");
      await input.waitFor();
      await page.waitForFunction(
        () => document.activeElement?.getAttribute("placeholder") === "Search workspace…",
      );
      assert.deepEqual(errors, []);
      await context.close();
    }
  const spec = await browser.newPage();
  await spec.goto(`${baseURL}/#dev/spec-check`);
  const summary = await spec.getByText(/\d+ of \d+ checks pass/).innerText();
  const counts = summary.match(/(\d+) of (\d+) checks pass/);
  assert(counts && counts[1] === counts[2], summary);
  await spec.close();
  console.log(JSON.stringify({ checks, specChecks: Number(counts[1]), failures }, null, 2));
  assert.deepEqual(failures, []);
} finally {
  await browser.close();
}
