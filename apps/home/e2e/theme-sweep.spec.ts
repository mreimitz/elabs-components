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

// Screenshot budget (brief: 72 PNGs under 8 MB, else reduce): the full 4-region set measured
// 8.12 MB for 54 PNGs without `tokens`, so every family keeps `hero` + `tour` and only the two
// reference families (`default`, `qlik`) keep every region. The value assertions still run for all.
const FULL_SET = new Set(["default", "qlik"]);
const SWEPT = (slug: string): RegionName[] =>
  FULL_SET.has(slug) ? ["hero", "tour", "agents", "tokens"] : ["hero", "tour"];

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
            description: `${region}: ${REGIONS[region]} is not on this page (RM-103 not merged)`,
          });
          continue;
        }
        await target.scrollIntoViewIfNeeded();
        await page.waitForLoadState("networkidle");
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        await regionShot(target, `${family.slug}-${mode}-${region}.png`, testInfo);
      }
    });
  }
}
