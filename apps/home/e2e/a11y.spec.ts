import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { HOME, THEME_FAMILIES, gotoHome, selectTheme } from "./helpers";

// axe on the whole page with the tour's first tab open and the agent loop rendered.
// serious/critical must be 0. Ruling 30: a library- or theme-owned serious finding that is
// already filed may be excluded by rule + selector + issue (at most 3, the list only shrinks).
// `moderate` findings ratchet against `a11y-moderate-baseline.json` (only shrinks).
interface Exclusion {
  rule: string;
  selector: string;
  issue: string;
}
const ratchet = JSON.parse(readFileSync(join(HOME, "e2e/a11y-ratchet.json"), "utf8")) as {
  exclusions: Exclusion[];
  moderate: string[];
};

const CASES = [
  { slug: "default", mode: "light" as const },
  { slug: "qlik", mode: "dark" as const },
];

test("the exclusion list stays at 3 or fewer", () => {
  expect(ratchet.exclusions.length).toBeLessThanOrEqual(3);
  for (const e of ratchet.exclusions) expect(e.issue).toMatch(/^#\d+$/);
});

for (const { slug, mode } of CASES) {
  test(`${slug} ${mode}: no serious or critical violations`, async ({ page }, testInfo) => {
    const family = THEME_FAMILIES.find((f) => f.slug === slug)!;
    await gotoHome(page);
    await selectTheme(page, family, mode);
    await page.mouse.move(0, 0);
    for (const id of ["#tour", "#agents", "#works-with"]) {
      await page.locator(id).scrollIntoViewIfNeeded();
      await page.waitForLoadState("networkidle");
    }
    await expect(page.locator('#tour [role="tabpanel"][data-state="active"]')).toBeVisible();
    await expect(page.locator('[data-slot="agent-loop"]')).toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const nodes = violations.flatMap((v) =>
      v.nodes.map((n) => ({ rule: v.id, impact: v.impact, selector: n.target.join(" ") })),
    );
    const excluded = (n: { rule: string; selector: string }) =>
      ratchet.exclusions.some((e) => e.rule === n.rule && e.selector === n.selector);
    const blocking = nodes.filter(
      (n) => (n.impact === "serious" || n.impact === "critical") && !excluded(n),
    );
    const moderate = nodes
      .filter((n) => n.impact === "moderate")
      .map((n) => `${slug}-${mode}|${n.rule}|${n.selector}`);
    const newModerate = moderate.filter((k) => !ratchet.moderate.includes(k));
    testInfo.annotations.push({
      type: "axe",
      description: `${nodes.length} node(s): ${blocking.length} blocking, ${moderate.length} moderate (${newModerate.length} new), ${nodes.filter(excluded).length} excluded`,
    });
    expect(blocking, "serious/critical axe violations").toEqual([]);
    expect(newModerate, "moderate violations not in the ratchet baseline").toEqual([]);
  });
}
