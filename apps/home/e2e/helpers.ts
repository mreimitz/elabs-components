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
 * labelled by the H1's `#hero-title`; `examples` is the component wall directly under it.
 */
export const REGIONS = {
  hero: 'section[aria-labelledby="hero-title"]',
  useCases: "#use-cases",
  examples: "#examples",
  charts: "#charts",
  agents: "#agents",
  themes: "#themes",
} as const;
export type RegionName = keyof typeof REGIONS;

/**
 * The app shell's `ThemeSwitcher` — the site's only theme control. It sits in the top bar and in
 * the agent panel; below `sm` the top bar hides its copy to keep the bar to one row, so a
 * phone-width run takes the first one a visitor can see.
 */
export const heroSwitch = (page: Page) =>
  page.getByRole("button", { name: "Theme" }).filter({ visible: true }).first();

/**
 * Pick family + mode through the real `ThemeSwitcher` menu, the way a visitor does. At phone width
 * that means opening the agent panel first, and closing it again once the pick is made.
 */
export async function selectTheme(page: Page, family: ThemeFamily, mode: ThemeMode) {
  const viaPanel = !(await heroSwitch(page).isVisible());
  if (viaPanel) await page.getByRole("button", { name: "Show the agent panel" }).click();
  await heroSwitch(page).click();
  await page.getByRole("menuitemradio", { name: family.displayName, exact: true }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await heroSwitch(page).click();
  await page
    .getByRole("menuitemradio", { name: mode === "light" ? "Light" : "Dark", exact: true })
    .click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  if (viaPanel) {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
}

/** `document.body`'s computed background vs the computed form of the `themes.json` value. */
export async function expectBodyBackground(page: Page, background: string) {
  // Browsers serialise the same colour differently (`oklch(…)` vs `lab(…)`), so both sides are
  // painted into one canvas pixel and compared as sRGB bytes (±1 for rounding).
  const read = () =>
    page.evaluate((value) => {
      const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      const paint = (color: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
      };
      const body = getComputedStyle(document.body).backgroundColor;
      const a = paint(body);
      const b = paint(value);
      return { body, a, b, same: a.every((v, i) => Math.abs(v - (b[i] ?? -9)) <= 1) };
    }, background);
  await expect.poll(async () => (await read())?.same).toBe(true);
  const final = await read();
  return `${final?.body} = sRGB bytes [${final?.a.join(", ")}]`;
}

/**
 * Compare against a baseline only where one exists for THIS platform (ruling 28); otherwise
 * attach the actual image so CI uploads it. `--update-snapshots` always writes.
 *
 * `mask` (RM-089 ruling 38): regions to blank out of the PIXEL comparison only — their content is
 * already covered by a value/DOM assertion elsewhere, so baselining them just churns the PNG.
 * `style`: CSS applied only while the shot is taken (e.g. `REGION_SHOT_STYLE`, which hides the
 * sticky site nav so a region taller than the viewport never bakes the nav into its baseline).
 */
export async function regionShot(
  target: Locator,
  name: string,
  testInfo: TestInfo,
  options: { mask?: Locator[]; style?: string } = {},
) {
  // `expect(locator).toHaveScreenshot` takes no `style` option, so the CSS is injected for the
  // shot and removed again whatever the outcome.
  const styleTag = options.style
    ? await target.page().addStyleTag({ content: options.style })
    : undefined;
  try {
    const updating = ["all", "changed"].includes(testInfo.config.updateSnapshots);
    const baseline = testInfo.snapshotPath(name, { kind: "screenshot" });
    if (existsSync(baseline) || updating) {
      await expect(target).toHaveScreenshot(name, { mask: options.mask });
      return "compared";
    }
    const body = await target.screenshot({ animations: "disabled", mask: options.mask });
    await testInfo.attach(name, { body, contentType: "image/png" });
    testInfo.annotations.push({
      type: "screenshot",
      description: `${name}: no ${process.platform} baseline — attached, value assertions only`,
    });
    return "attached";
  } finally {
    await styleTag?.evaluate((el) => (el as Element).remove());
  }
}

/** `/` with no interaction, the page settled (fonts, hydration, lazy CSS). */
export async function gotoHome(page: Page, query = "") {
  const response = await page.goto(`/${query}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return response;
}

/**
 * Wait until every finite animation/transition has finished (infinite ones are ignored), so a
 * check reads SETTLED colours, never a crossfade's intermediate blend.
 *
 * Under `prefers-reduced-motion` the tokens clamp every transition to 0.01 ms (`themes.css`),
 * and `transition-property` defaults to `all` — so on a live chart whose SVG path redraws every
 * second, each redraw opens a fresh epsilon transition on the geometry that Chromium leaves at
 * `currentTime 0` until its next frame. Those never blend anything a reader sees and do not
 * count; an epsilon tween on an HTML element (a focus ring rising from transparent) still does.
 */
export async function settle(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.getAnimations().filter((a) => {
              const timing = a.effect?.getComputedTiming();
              const target = (a.effect as KeyframeEffect | null)?.target;
              return (
                a.playState === "running" &&
                Number(timing?.iterations ?? 1) !== Infinity &&
                (Number(timing?.duration ?? 0) >= 1 || !(target instanceof SVGElement))
              );
            }).length,
        ),
      { timeout: 10_000 },
    )
    .toBe(0);
}
