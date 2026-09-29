/** Edit mode opens the editor; the inspector requires an explicit request.
 * Run against an isolated DIAGRAM_URL. Shipped files are never changed. */
/* global window, localStorage, URL, process, console */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const browser = await chromium.launch();
const base = process.env.DIAGRAM_URL ?? "http://localhost:5450";
const paths = ["examples/lakehouse-aws.yaml", "templates/qlik-cloud-customer-landscape.yaml"];
try {
  for (const width of [1440, 390]) {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(
        ({ paths, theme }) => {
          localStorage.setItem("atlas.shell.tabs", JSON.stringify(paths));
          localStorage.setItem("brand-ui-theme", theme);
        },
        { paths, theme },
      );
      const page = await context.newPage();
      const errors = [],
        writes = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (["PUT", "POST", "DELETE"].includes(request.method())) writes.push(request.url());
      });
      const inspector = page.locator('[data-slot="inspector-panel"]');
      const edit = page.getByRole("button", { name: /^Edit/ });
      const done = page.getByRole("button", { name: /^Done/ });
      const closed = async () => {
        if (width === 390) {
          await page.getByRole("button", { name: "Diagram options", exact: true }).click();
          await expect(
            page.getByRole("menuitemcheckbox", { name: "Inspector", exact: true }),
          ).toHaveAttribute("aria-checked", "false");
          await page.keyboard.press("Escape");
        } else {
          await expect(inspector).toHaveAttribute("data-state", "collapsed");
          await expect(inspector).toHaveAttribute("inert", "");
        }
      };
      await page.goto(`${base}/#d/${paths[0]}`);
      await edit.click();
      await expect(done).toBeVisible();
      await expect(page.locator(".monaco-editor textarea")).toBeVisible();
      await closed();
      await done.click();
      await edit.focus();
      await page.keyboard.press("e");
      await expect(done).toBeVisible();
      await closed();
      // Returning to a remembered edit-mode document must not open the inspector either.
      await page.evaluate((path) => {
        window.location.hash = `d/${path}`;
      }, paths[1]);
      await expect(edit).toBeVisible();
      await page.evaluate((path) => {
        window.location.hash = `d/${path}`;
      }, paths[0]);
      await expect(done).toBeVisible();
      await closed();
      if (width === 1440) {
        const toggle = page.getByRole("button", { name: "Inspector", exact: true });
        await toggle.click();
        await expect(inspector).toHaveAttribute("data-state", "expanded");
        await expect(toggle).toHaveAttribute("aria-pressed", "true");
        await done.click();
        await closed();
        await edit.click();
        await closed();
        await toggle.click();
        await expect(inspector).toHaveAttribute("data-state", "expanded");
        await toggle.click();
        await closed();
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(writes, []);
      console.log(
        `PASS ${theme} ${width}: edit entry, keyboard entry, remembered tab, no writes/errors${width === 1440 ? ", explicit toggle and Done" : ""}`,
      );
      await context.close();
    }
  }
} finally {
  await browser.close();
}
