import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { HOME } from "./helpers";

// Read, don't import: Playwright runs these specs through Node's ESM loader, where a bare
// `import … from "….json"` is a TypeError without an import attribute. The other specs read
// generated content the same way.
const catalogIndex = JSON.parse(
  readFileSync(join(HOME, "content/generated/catalog-index.json"), "utf8"),
) as { section: string; slug: string; name: string }[];

// The surface tour left the home page: templates are now catalogue pages (`/templates/<slug>`),
// each rendering its Storybook story live. This spec keeps the old file's job — every template a
// visitor can open actually opens — against the new routes.
const TEMPLATES = catalogIndex.filter((entry) => entry.section === "templates");

test("the templates index lists every template", async ({ page }) => {
  await page.goto("/templates", { waitUntil: "load" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const template of TEMPLATES) {
    await expect(page.locator(`main a[href="/templates/${template.slug}"]`).first()).toBeAttached();
  }
});

for (const template of TEMPLATES) {
  test(`/templates/${template.slug} renders its live preview`, async ({ page }) => {
    const response = await page.goto(`/templates/${template.slug}`, { waitUntil: "load" });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: template.name })).toBeVisible();
    const frame = page.locator('[data-slot="story-frame"]').first();
    await expect(frame).toBeVisible();
    await expect(frame).not.toHaveAttribute("data-state", "loading", { timeout: 30_000 });
  });
}
