import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

/** Shared seams for the site gates (RM-104). Data comes from the generated content, never typed. */
export const HOME = join(dirname(fileURLToPath(import.meta.url)), "..");

const generated = <T>(name: string): T =>
  JSON.parse(readFileSync(join(HOME, "content/generated", name), "utf8")) as T;

export type ThemeMode = "light" | "dark";
export interface ThemeFamily {
  slug: string;
  displayName: string;
  modes: { mode: ThemeMode; value: string; background: string }[];
}
export const THEME_FAMILIES = generated<ThemeFamily[]>("themes.json");
export const INSTALL = generated<{
  hostedMcp: { command: string; url: string };
  localMcp: { command: string };
}>("install.json");

/**
 * The regions the sweep screenshots, by existing id. `hero` has no id of its own — its section is
 * labelled by the H1's `#hero-title`. `tokens` (RM-103) may be absent on a head without it.
 */
export const REGIONS = {
  hero: 'section[aria-labelledby="hero-title"]',
  tour: "#tour",
  agents: "#agents",
  tokens: "#tokens",
} as const;
export type RegionName = keyof typeof REGIONS;

/** The hero's theme switch (the nav's mobile sheet carries a second one). */
export const heroSwitch = (page: Page) =>
  page.locator(`${REGIONS.hero} [data-slot="theme-family-switch"]`);

/** Pick family + mode with the real switch, the way a visitor does. */
export async function selectTheme(page: Page, family: ThemeFamily, mode: ThemeMode) {
  const sw = heroSwitch(page);
  await sw.getByRole("radio", { name: family.displayName, exact: true }).click();
  await sw
    .locator('[data-slot="theme-family-switch-mode"]')
    .getByRole("radio", { name: mode === "light" ? "Light" : "Dark", exact: true })
    .click();
}

/** `document.body`'s computed background vs the computed form of the `themes.json` value. */
export async function expectBodyBackground(page: Page, background: string) {
  // Browsers serialise the same colour differently (`oklch(…)` vs `lab(…)`), so both sides are
  // painted into one canvas pixel and compared as sRGB bytes (±1 for rounding).
  const read = () =>
    page.evaluate((value) => {
      const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      const rgb = (color: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
      };
      const body = getComputedStyle(document.body).backgroundColor;
      const a = rgb(body);
      const b = rgb(value);
      return { body, a, b, same: a.every((v, i) => Math.abs(v - (b[i] ?? -9)) <= 1) };
    }, background);
  await expect.poll(async () => (await read())?.same).toBe(true);
  const final = await read();
  return `${final?.body} = rgb(${final?.a.join(", ")})`;
}

/**
 * Compare against a baseline only where one exists for THIS platform (ruling 28); otherwise
 * attach the actual image so CI uploads it. `--update-snapshots` always writes.
 */
export async function regionShot(target: Locator, name: string, testInfo: TestInfo) {
  const updating = ["all", "changed"].includes(testInfo.config.updateSnapshots);
  const baseline = testInfo.snapshotPath(name, { kind: "screenshot" });
  if (existsSync(baseline) || updating) {
    await expect(target).toHaveScreenshot(name);
    return "compared";
  }
  const body = await target.screenshot({ animations: "disabled" });
  await testInfo.attach(name, { body, contentType: "image/png" });
  testInfo.annotations.push({
    type: "screenshot",
    description: `${name}: no ${process.platform} baseline — attached, value assertions only`,
  });
  return "attached";
}

/** `/` with no interaction, the page settled (fonts, hydration, lazy CSS). */
export async function gotoHome(page: Page, query = "") {
  const response = await page.goto(`/${query}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return response;
}
