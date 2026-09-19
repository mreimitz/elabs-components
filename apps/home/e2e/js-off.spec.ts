import { expect, test } from "@playwright/test";
import { agentLoopCopy, routeCardsCopy, worksWithCopy } from "../content/copy";
import { INSTALL, REGIONS } from "./helpers";

// Concept §5: the page reads perfectly with JavaScript off — the server HTML carries every
// heading, the honesty line (D5), the install commands and the nav/footer links.
test.use({ javaScriptEnabled: false });

test("the server HTML reads without JavaScript", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const id of ["tour", "agents", "works-with"] as const) {
    const heading = page.locator(`#${id}`).getByRole("heading").first();
    await expect(heading, `#${id} heading`).toBeAttached();
    expect((await heading.textContent())?.trim().length ?? 0).toBeGreaterThan(0);
  }
  await expect(page.getByRole("heading", { name: worksWithCopy.heading })).toBeAttached();
  await expect(page.getByRole("heading", { name: routeCardsCopy.heading })).toBeAttached();
  await expect(page.locator(REGIONS.hero)).toBeAttached();

  const html = await page.content();
  expect(html).toContain(agentLoopCopy.honestyLine);
  expect(html).toContain(INSTALL.hostedMcp.command);

  const navLinks = page.getByRole("banner").getByRole("link");
  expect(await navLinks.count()).toBeGreaterThan(0);
  const footerLinks = page.getByRole("contentinfo").getByRole("link");
  expect(await footerLinks.count()).toBeGreaterThan(3);

  const hidden = await page.$$eval("[style]", (els) =>
    els
      .filter((el) => /(^|;)\s*opacity\s*:\s*0(\.0*)?\s*(;|$)/.test(el.getAttribute("style") ?? ""))
      .map((el) => el.outerHTML.slice(0, 120)),
  );
  expect(hidden, "inline opacity:0 hides content with JS off").toEqual([]);

  await expect(page.locator('head link[rel="alternate"][href="/llms.txt"]')).toHaveCount(1);
});
