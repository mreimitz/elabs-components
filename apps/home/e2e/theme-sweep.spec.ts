import { expect, test } from "@playwright/test";
import {
  REGIONS,
  THEME_FAMILIES,
  expectBodyBackground,
  gotoHome,
  regionShot,
  selectTheme,
  type RegionName,
} from "./helpers";

// Every family × mode from `themes.json`, picked with the real switch. The VALUE assertions
// (`data-theme`, body background == the generated value) fail a broken theme on every platform;
// the region screenshots compare only against a same-platform baseline (ruling 28).
// Reduced motion keeps the captures deterministic: no stream-in, no parallax, no crossfade.
test.use({ contextOptions: { reducedMotion: "reduce" } });

// Screenshot budget (brief: 72 PNGs under 8 MB, else reduce): shooting every region for every
// family blows it, so every family keeps `hero` + `examples` and only the two reference families
// (`default`, `qlik`) keep every region. The value assertions still run for all.
const FULL_SET = new Set(["default", "qlik"]);
const SWEPT = (slug: string): RegionName[] =>
  FULL_SET.has(slug) ? ["hero", "examples", "charts", "agents", "themes"] : ["hero", "examples"];

// The site nav is sticky: a region taller than the 900 px viewport is shot with the nav painted
// over its middle, hiding the content beneath it and failing on any nav change. Hide it
// (visibility only, no layout shift) for the shot alone — the nav is not what these regions
// baseline, and no value assertion above reads it.
const REGION_SHOT_STYLE = '[data-slot="site-nav"] { visibility: hidden !important; }';

for (const family of THEME_FAMILIES) {
  for (const { mode, value, background } of family.modes) {
    test(`${family.slug} ${mode}`, async ({ page }, testInfo) => {
      await gotoHome(page);
      await selectTheme(page, family, mode);
      await expect(page.locator("html")).toHaveAttribute("data-theme", value);
      const computed = await expectBodyBackground(page, background);
      testInfo.annotations.push({ type: "value", description: `${value} body ${computed}` });
      await page.mouse.move(0, 0);

      for (const region of SWEPT(family.slug)) {
        const target = page.locator(REGIONS[region]);
        if ((await target.count()) === 0) {
          testInfo.annotations.push({
            type: "skip-region",
            description: `${region}: ${REGIONS[region]} is not on this page`,
          });
          continue;
        }
        await target.scrollIntoViewIfNeeded();
        await page.waitForLoadState("networkidle");
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        // Ruling 46 lifts ruling 38's GatesBand mask: the band now renders collapsed (one
        // category label + rule count per group, the rules behind closed <details>), so a new
        // check rule changes a digit or two, well inside `maxDiffPixelRatio`, not the layout.
        await regionShot(target, `${family.slug}-${mode}-${region}.png`, testInfo, {
          style: REGION_SHOT_STYLE,
        });
      }
    });
  }
}

// A template page's native screen re-themes in place when the shell's switcher changes the theme:
// for the two reference families, the same `data-theme` + body values as above, and no
// navigation in between.
const TEMPLATE_PAGE = "/templates/customer-360";

for (const family of THEME_FAMILIES.filter((f) => FULL_SET.has(f.slug))) {
  for (const { mode, value, background } of family.modes) {
    test(`${family.slug} ${mode} on a template page`, async ({ page }, testInfo) => {
      await page.goto(TEMPLATE_PAGE, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      const hero = page.locator('[data-slot="block-hero"]').first();
      await expect(hero).toBeVisible();
      await expect(hero.locator('[data-slot="skeleton"]')).toHaveCount(0, { timeout: 30_000 });

      await selectTheme(page, family, mode);

      await expect(page.locator("html")).toHaveAttribute("data-theme", value);
      const computed = await expectBodyBackground(page, background);
      testInfo.annotations.push({ type: "value", description: `${value} body ${computed}` });
      // Re-themed in place: still the first document, the screen still mounted.
      expect(await page.evaluate(() => performance.getEntriesByType("navigation").length)).toBe(1);
      await expect(hero.locator('[data-slot="skeleton"]')).toHaveCount(0);
      await page.mouse.move(0, 0);
      await hero.scrollIntoViewIfNeeded();
      await page.waitForLoadState("networkidle");
      await regionShot(hero, `${family.slug}-${mode}-template.png`, testInfo, {
        style: REGION_SHOT_STYLE,
      });
    });
  }
}
