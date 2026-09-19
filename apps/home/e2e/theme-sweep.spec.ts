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

const SWEPT: RegionName[] = ["hero", "tour", "agents", "tokens"];

for (const family of THEME_FAMILIES) {
  for (const { mode, value, background } of family.modes) {
    test(`${family.slug} ${mode}`, async ({ page }, testInfo) => {
      await gotoHome(page);
      await selectTheme(page, family, mode);
      await expect(page.locator("html")).toHaveAttribute("data-theme", value);
      const computed = await expectBodyBackground(page, background);
      testInfo.annotations.push({ type: "value", description: `${value} body ${computed}` });
      await page.mouse.move(0, 0);

      for (const region of SWEPT) {
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
