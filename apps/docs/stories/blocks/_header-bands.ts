import { expect, waitFor } from "storybook/test";

/**
 * Every header band an app shell puts side by side: the content column's top
 * bar and the right-hand SideDock / ContextRail header. They are separate components, and each one has in the past been sized
 * on its own (`h-14`, `h-12`, padding) — which lined up in one theme and broke in
 * the next. The `header-band` check rule forbids that in source; this is the
 * same promise measured in a real browser.
 */
const BAND_SELECTOR = [
  '[data-slot$="top-bar"]',
  '[data-slot="side-dock-header"]',
  '[data-slot="context-rail-header"]',
].join(",");

/**
 * Asserts that every VISIBLE header band's bottom edge sits on one line (±1px).
 * Needs at least two bands on screen — a single band aligns with nothing, and a
 * lock that passes on one band would pass on a shell that lost its panel.
 */
export async function expectHeaderBandsAligned(canvasElement: HTMLElement) {
  await waitFor(async () => {
    const bands = [...canvasElement.querySelectorAll<HTMLElement>(BAND_SELECTOR)]
      .map((el) => ({ slot: el.dataset.slot, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0);
    await expect(`bands on screen: ${bands.length >= 2 ? "≥2" : bands.length}`).toBe(
      "bands on screen: ≥2",
    );
    const first = bands[0]!;
    for (const band of bands) {
      // Read as a sentence so a failure names both bands and both edges.
      await expect(
        `${band.slot} bottom ${Math.abs(band.rect.bottom - first.rect.bottom) <= 1 ? "=" : "≠"} ${first.slot} bottom (${band.rect.bottom.toFixed(1)} vs ${first.rect.bottom.toFixed(1)})`,
      ).toBe(
        `${band.slot} bottom = ${first.slot} bottom (${band.rect.bottom.toFixed(1)} vs ${first.rect.bottom.toFixed(1)})`,
      );
    }
  });
}
