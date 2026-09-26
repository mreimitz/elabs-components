import { expect, test } from "@playwright/test";
import { gotoHome, settle } from "./helpers";

// Buttons tween `box-shadow` into the ring; reduced motion collapses the tween and `settle`
// waits it out, so every stop is read with its ring fully painted.
test.use({ contextOptions: { reducedMotion: "reduce" } });

// Keyboard first: Tab from the skip link through the whole page. Every stop shows a visible
// focus indicator (the `focus-ring` contract: a ring painted from `--ring` plus a 1px
// `--ring-contour` outline), and the walk passes each interactive region in page order.
const STOPS = [
  { name: "template cards", selector: "#use-cases a" },
  { name: "chart tiles", selector: "#charts [data-chart-tile]" },
  { name: "component wall", selector: '[data-slot="component-wall"]' },
  { name: "generative-UI editor", selector: "#emit-ui" },
  { name: "theme cards", selector: '[data-slot="theme-swatches"]' },
  { name: "route cards", selector: '[data-slot="route-cards"]' },
] as const;

interface Stop {
  region: string | null;
  tag: string;
  label: string;
  outline: string;
  shadow: string;
  ringInShadow: boolean;
  visible: boolean;
}

test("Tab walks every region with a visible focus ring", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await gotoHome(page);
  await page.waitForLoadState("networkidle");

  await page.keyboard.press("Tab");
  const skip = page.locator(":focus");
  await expect(skip).toHaveAttribute("href", "#main-content");

  const stops: Stop[] = [];
  for (let i = 0; i < 600; i++) {
    await settle(page);
    const stop = await page.evaluate(
      (regions) => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        // Resolve --ring to the same serialisation the box-shadow uses.
        const probe = document.createElement("span");
        probe.style.color = "var(--ring)";
        el.parentElement?.appendChild(probe);
        const ring = getComputedStyle(probe).color;
        probe.remove();
        // A `focus-ring-within` control paints on the nearest wrapper; look up two levels.
        let painted: HTMLElement | null = el;
        let s = getComputedStyle(el);
        for (let up = 0; up < 3 && painted; up++) {
          s = getComputedStyle(painted);
          if (s.outlineStyle !== "none" || s.boxShadow !== "none") break;
          painted = painted.parentElement;
        }
        const outline = `${s.outlineStyle} ${s.outlineWidth}`;
        const visible =
          (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none";
        return {
          region: regions.find((r) => el.closest(r)) ?? null,
          tag: el.tagName.toLowerCase(),
          label: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40),
          outline,
          shadow: s.boxShadow.slice(0, 400),
          // Colours serialise differently (`oklab(…)` vs `lab(…)`): compare painted sRGB bytes.
          ringInShadow: (
            s.boxShadow.match(/(?:rgba?|oklab|oklch|lab|lch|color)\([^)]*\)/g) ?? []
          ).some((c) => {
            const ctx = document.createElement("canvas").getContext("2d");
            if (!ctx) return false;
            const px = (color: string) => {
              ctx.clearRect(0, 0, 1, 1);
              ctx.fillStyle = color;
              ctx.fillRect(0, 0, 1, 1);
              return [...ctx.getImageData(0, 0, 1, 1).data];
            };
            const a = px(c);
            const b = px(ring);
            return a[3]! > 200 && a.every((v, i) => Math.abs(v - b[i]!) <= 2);
          }),
          visible,
        };
      },
      STOPS.map((s) => s.selector) as string[],
    );
    if (stop) stops.push(stop);
    if (stop?.region === STOPS.at(-1)!.selector) break;
    // Monaco keeps Tab for indentation; Ctrl+M is its documented tab-focus escape.
    const inEditor = await page.evaluate(() => !!document.activeElement?.closest(".monaco-editor"));
    if (inEditor) await page.keyboard.press("Control+m");
    await page.keyboard.press("Tab");
  }

  const reached = STOPS.map((s) => ({
    name: s.name,
    count: stops.filter((x) => x.region === s.selector).length,
  }));
  const invisible = stops.filter((s) => !s.visible);
  const offRing = stops.filter((s) => s.visible && s.shadow !== "none" && !s.ringInShadow);
  testInfo.annotations.push({
    type: "keyboard",
    description: `${stops.length} stops; ${reached.map((r) => `${r.name}: ${r.count}`).join(", ")}; ${invisible.length} without an indicator, ${offRing.length} ring not from --ring`,
  });
  expect(
    reached.filter((r) => r.count === 0).map((r) => r.name),
    "regions never reached",
  ).toEqual([]);
  expect(invisible, "focus stops without a visible indicator").toEqual([]);
  expect(offRing, "focus rings not painted from --ring").toEqual([]);
});
