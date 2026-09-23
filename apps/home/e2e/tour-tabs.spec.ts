import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { HOME } from "./helpers";
import { NATIVE_BLOCKS } from "../components/catalog/block-render-meta";

// Read, don't import: Playwright runs these specs through Node's ESM loader, where a bare
// `import … from "….json"` is a TypeError without an import attribute. The other specs read
// generated content the same way.
const catalogIndex = JSON.parse(
  readFileSync(join(HOME, "content/generated/catalog-index.json"), "utf8"),
) as {
  section: string;
  slug: string;
  name: string;
  group: string;
  block: string | null;
}[];
const nativeBlocks = new Set(Object.keys(NATIVE_BLOCKS));

// The surface tour left the home page: templates are now catalogue pages (`/templates/<slug>`),
// each rendering its screen live — natively when the block is in `block-render-meta.ts`, as a
// Storybook frame otherwise. This spec keeps the old file's job — every template a visitor can
// open actually opens — against the new routes.
const TEMPLATES = catalogIndex.filter((entry) => entry.section === "templates");
const familySlug = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

test("the templates index reaches every template", async ({ page }) => {
  await page.goto("/templates", { waitUntil: "load" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // The index is grouped by family: a template is either on it or on its family's page.
  const onIndex = new Set(
    await page
      .locator('main a[href^="/templates/"]')
      .evaluateAll((els) => els.map((a) => a.getAttribute("href") ?? "")),
  );
  for (const family of new Set(TEMPLATES.map((t) => familySlug(t.group)))) {
    expect(onIndex.has(`/templates/group/${family}`), family).toBe(true);
  }
  const missing = TEMPLATES.filter((t) => !onIndex.has(`/templates/${t.slug}`));
  for (const family of new Set(missing.map((t) => familySlug(t.group)))) {
    await page.goto(`/templates/group/${family}`, { waitUntil: "load" });
    for (const template of missing.filter((t) => familySlug(t.group) === family)) {
      await expect(
        page.locator(`main a[href="/templates/${template.slug}"]`).first(),
      ).toBeAttached();
    }
  }
});

for (const template of TEMPLATES) {
  test(`/templates/${template.slug} renders its live preview`, async ({ page }) => {
    const response = await page.goto(`/templates/${template.slug}`, { waitUntil: "load" });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: template.name })).toBeVisible();
    if (template.block && nativeBlocks.has(template.block)) {
      // Rendered natively: the hero mounts the block client-side; its skeleton must give way.
      const hero = page.locator('[data-slot="block-hero"]').first();
      await expect(hero).toBeVisible();
      await expect(hero.locator('[data-slot="skeleton"]')).toHaveCount(0, { timeout: 30_000 });
      await expect(
        hero
          .locator('[data-slot]:not([data-slot="block-hero"]):not([data-slot="skeleton"])')
          .first(),
      ).toBeVisible();
    } else {
      // An embedded story needs a Storybook behind the /storybook/ rewrite (CI serves one).
      const frame = page.locator('[data-slot="story-frame"]').first();
      await expect(frame).toBeVisible();
      await expect(frame).not.toHaveAttribute("data-state", "loading", { timeout: 30_000 });
    }
  });
}
