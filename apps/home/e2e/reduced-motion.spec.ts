import { expect, test, type Page } from "@playwright/test";
import { REGIONS, THEME_FAMILIES, gotoHome, selectTheme } from "./helpers";

// `prefers-reduced-motion: reduce` removes parallax, drift, count-ups and staggers and keeps
// opacity crossfades (standing rule). Ruling 29: some Animation objects legitimately stay
// `running` — collapsed (~0 ms) crossfades — so the gate counts only REAL motion: an animation
// longer than 1 ms, one touching anything but `opacity`, or one that never ends.
test.use({ contextOptions: { reducedMotion: "reduce" } });

interface Motion {
  total: number;
  running: number;
  real: { target: string; duration: number; properties: string[]; iterations: number }[];
}

function motionOf(page: Page) {
  return page.evaluate((): Motion => {
    const all = document.getAnimations();
    const running = all.filter((a) => a.playState === "running");
    const describe = (el: Element | null | undefined) => {
      if (!el) return "(none)";
      const slot = el.getAttribute("data-slot");
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${slot ? `[data-slot=${slot}]` : ""}`;
    };
    const real = running
      .map((a) => {
        const effect = a.effect as KeyframeEffect | null;
        const timing = effect?.getComputedTiming();
        const duration = Number(timing?.duration ?? 0) * Math.abs(a.playbackRate || 1);
        const properties = [
          ...new Set(
            (effect?.getKeyframes() ?? []).flatMap((k) =>
              Object.keys(k).filter(
                (p) => !["offset", "computedOffset", "easing", "composite"].includes(p),
              ),
            ),
          ),
        ];
        return {
          target: describe(effect?.target as Element | null),
          duration,
          properties,
          iterations: Number(timing?.iterations ?? 1),
        };
      })
      .filter(
        (m) =>
          m.duration > 1 || m.iterations === Infinity || m.properties.some((p) => p !== "opacity"),
      );
    return { total: all.length, running: running.length, real };
  });
}

test("no real motion after load or after a theme switch", async ({ page }, testInfo) => {
  await gotoHome(page);
  await page.waitForLoadState("networkidle");
  const afterLoad = await motionOf(page);

  const other = THEME_FAMILIES.find((f) => f.slug !== "default") ?? THEME_FAMILIES[0]!;
  await selectTheme(page, other, "dark");
  await page.waitForTimeout(500);
  const afterSwitch = await motionOf(page);

  testInfo.annotations.push({
    type: "getAnimations",
    description: `load: ${afterLoad.total} total / ${afterLoad.running} running; after switch to ${other.slug}-dark: ${afterSwitch.total} total / ${afterSwitch.running} running`,
  });
  expect(afterLoad.real, "real motion after load").toEqual([]);
  expect(afterSwitch.real, "real motion after a theme switch").toEqual([]);
});

test("parallax planes stay put while scrolling", async ({ page }) => {
  await gotoHome(page);
  for (const y of [400, 1200]) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    await page.waitForTimeout(150);
    const transforms = await page.$$eval('[data-slot="parallax-plane"]', (planes) =>
      planes.map((p) => getComputedStyle(p).transform),
    );
    for (const t of transforms) expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(t);
  }
});

test("the hero shows its final values at first paint", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const scene = page.locator(`${REGIONS.hero} [role="region"]`).first();
  // Text outside SVG: chart axis ticks are laid out after the first measure, not streamed in.
  const values = () =>
    scene.evaluate((root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const out: string[] = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode())
        if (!n.parentElement?.closest("svg") && n.textContent?.trim())
          out.push(n.textContent.trim());
      return out.join("\n");
    });
  const first = await values();
  await page.waitForTimeout(2_500);
  expect(await values()).toBe(first);
  expect(first.trim().length).toBeGreaterThan(40);
});
