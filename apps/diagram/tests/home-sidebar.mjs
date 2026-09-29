/** Route-specific sidebar state regression. Run against the local diagram server. */
/* global console, document, location, process, URL */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../home/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5460";
const browser = await chromium.launch();

async function routeTo(page, hash) {
  await page.evaluate((next) => {
    location.hash = next;
  }, hash);
  await expect(page).toHaveURL(new RegExp(`#${hash.slice(1)}(?:$|&)`));
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto(`${base}/#settings`);
  const frame = desktop.locator('[data-slot="sidebar-wrapper"]');
  const trigger = desktop.locator('[data-slot="sidebar-trigger"]:visible');
  await expect(frame).toHaveAttribute("data-state", "collapsed");
  await trigger.click();
  await expect(frame).toHaveAttribute("data-state", "expanded");
  await routeTo(desktop, "#home");
  await expect(frame).toHaveAttribute("data-state", "collapsed");
  assert.match(await desktop.evaluate(() => document.cookie), /(?:^|; )sidebar_state=true(?:;|$)/);
  await trigger.click();
  await expect(frame).toHaveAttribute("data-state", "expanded");
  await routeTo(desktop, "#settings");
  await expect(frame).toHaveAttribute("data-state", "expanded");
  await trigger.click();
  await expect(frame).toHaveAttribute("data-state", "collapsed");
  await routeTo(desktop, "#catalog");
  await expect(frame).toHaveAttribute("data-state", "collapsed");
  await trigger.click();
  await expect(frame).toHaveAttribute("data-state", "expanded");
  await routeTo(desktop, "#home");
  await expect(frame).toHaveAttribute("data-state", "collapsed");
  await routeTo(desktop, "#settings");
  await expect(frame).toHaveAttribute("data-state", "collapsed");
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${base}/#settings`);
  const mobileTrigger = mobile.locator('[data-slot="sidebar-trigger"]:visible');
  const sheet = mobile.locator('[data-slot="sidebar"][data-mobile="true"]');
  await mobileTrigger.click();
  await expect(sheet).toBeVisible();
  await routeTo(mobile, "#home");
  await expect(sheet).toHaveCount(0);
  await mobileTrigger.click();
  await expect(sheet).toBeVisible();
  await routeTo(mobile, "#catalog");
  await routeTo(mobile, "#home");
  await expect(sheet).toHaveCount(0);
  await mobile.close();
  console.log("Home and Catalog sidebar lifecycle passed on desktop and mobile.");
} finally {
  await browser.close();
}
