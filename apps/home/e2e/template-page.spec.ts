import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { HOME } from "./helpers";

/**
 * A template page is a product page (RM-147): the screen, the scenario, the hand-off ABOVE the
 * fold, the tour of the views, and "made of" generated from the registry item — with no example
 * that repeats the screen already rendered. The slugs come from the generated catalogue and the
 * tour data, never typed.
 */
interface CatalogPageJson {
  section: string;
  slug: string;
  block: { name: string; registryDependencies: string[] } | null;
  stories: { id: string }[];
}
const PAGES = JSON.parse(
  readFileSync(join(HOME, "content/generated/catalog-pages.json"), "utf8"),
) as Record<string, CatalogPageJson>;
const templates = Object.values(PAGES).filter((p) => p.section === "templates");
const registryTemplate = templates.find((p) => p.block?.registryDependencies.length);
const starter = templates.find((p) => p.slug === "dashboard");

test("a registry template page: hand-off above the fold, tour, generated made-of", async ({
  page,
}) => {
  test.skip(!registryTemplate, "no registry template in the catalogue");
  const slug = registryTemplate!.slug;
  await page.goto(`/templates/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // The hand-off: the copy command names the registry item; the prompt names its blocks.
  const handoff = page.locator('section[aria-labelledby="handoff"]');
  await expect(handoff).toBeVisible();
  await expect(handoff).toContainText(`${registryTemplate!.block!.name}.json`);
  const prompt = handoff.locator("pre").first();
  await expect(prompt).toContainText(registryTemplate!.block!.name);
  // Above the fold: the hand-off heading sits within two viewports of the top at 1440×900 —
  // the screen itself is the first viewport, the hand-off opens the second.
  const top = await handoff.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  expect(top).toBeLessThan(1900);

  // The tour and the made-of list, and every block link resolves.
  await expect(page.locator('section[aria-labelledby="made-of"]')).toBeVisible();
  const links = page.locator('section[aria-labelledby="made-of"] a[href^="/"]');
  const count = await links.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const href = await links.nth(i).getAttribute("href");
    const res = await page.request.get(href!);
    expect(res.status(), href!).toBe(200);
  }

  // No "Examples" section repeating the native screen when it is the only story.
  if (registryTemplate!.stories.length <= 1) await expect(page.locator("#examples")).toHaveCount(0);
  // The old dependency badge row is gone — made-of replaced it.
  await expect(page.locator("#dependencies")).toHaveCount(0);
});

test("a starter page keeps its scaffold command and prompt", async ({ page }) => {
  test.skip(!starter, "no dashboard starter in the catalogue");
  await page.goto(`/templates/${starter!.slug}`);
  const handoff = page.locator('section[aria-labelledby="handoff"]');
  await expect(handoff).toBeVisible();
  await expect(handoff).toContainText(`--template ${starter!.slug}`);
});
