import { expect, test } from "@playwright/test";
import { agentLoopCopy, galleryCopy, routeCardsCopy, worksWithCopy } from "../content/copy";
import { INSTALL, REGIONS } from "./helpers";

// Concept §5: the page reads perfectly with JavaScript off — the server HTML carries every
// heading, the honesty line (D5), the install commands and the nav/footer links.
test.use({ javaScriptEnabled: false });

test("the server HTML reads without JavaScript", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const id of [
    "use-cases",
    "blocks",
    "charts",
    "maps",
    "examples",
    "agents",
    "themes",
  ] as const) {
    const heading = page.locator(`#${id}`).getByRole("heading").first();
    await expect(heading, `#${id} heading`).toBeAttached();
    expect((await heading.textContent())?.trim().length ?? 0).toBeGreaterThan(0);
  }
  await expect(
    page.getByRole("heading", { name: galleryCopy.sections.charts.title, exact: true }),
  ).toBeAttached();
  await expect(page.getByRole("heading", { name: routeCardsCopy.heading })).toBeAttached();
  await expect(page.locator(REGIONS.hero)).toBeAttached();

  const html = await page.content();
  expect(html).toContain(INSTALL.hostedMcp.command);

  // The site frame is the app shell: its primary navigation is the rail, not a banner. Below the
  // rail's breakpoint the rail is a Sheet only a script can open, so there the server's
  // `<noscript>` nav is the one a visitor sees — either way, one visible "Primary" nav with links.
  const navLinks = page.getByRole("navigation", { name: "Primary" }).getByRole("link");
  expect(await navLinks.count()).toBeGreaterThan(0);
  // A form control's hidden bubble input (Radix Checkbox/Switch render one on the server so a
  // form still posts without JS) is `aria-hidden` and carries no content — not a hidden region.
  const hidden = await page.$$eval("[style]", (els) =>
    els
      .filter((el) => /(^|;)\s*opacity\s*:\s*0(\.0*)?\s*(;|$)/.test(el.getAttribute("style") ?? ""))
      .filter(
        (el) => !(el instanceof HTMLInputElement && el.getAttribute("aria-hidden") === "true"),
      )
      .map((el) => el.outerHTML.slice(0, 120)),
  );
  expect(hidden, "inline opacity:0 hides content with JS off").toEqual([]);

  await expect(page.locator('head link[rel="alternate"][href="/llms.txt"]')).toHaveCount(1);
});

// The agent loop, its honesty line (D5) and the install matrix moved to `/agents`; they read
// with JavaScript off there.
test("/agents reads without JavaScript", async ({ page }) => {
  const response = await page.goto("/agents");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: worksWithCopy.heading })).toBeAttached();
  expect(await page.content()).toContain(agentLoopCopy.honestyLine);
});

for (const route of [
  "/templates",
  "/templates/dashboard",
  "/templates/group/starters",
  "/blocks",
  "/blocks/group/agent-ops",
  "/visualizations",
  "/visualizations/group/kpi-cards",
  "/visualizations/kpi-cards-pace",
  "/components",
  "/components/ui",
  "/components/ui/group/forms",
  "/components/ui/button",
  "/components/charts",
  "/components/charts/group/comparison",
  "/components/charts/barchart",
  "/components/maps/mapcanvas",
  "/resources",
  "/attributions",
]) {
  test(`${route} answers with a level-1 heading, JavaScript off`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

// The app shell has no page footer; the link directory that used to sit there is `/resources`.
test("/resources lists the package docs and agent endpoints, JavaScript off", async ({ page }) => {
  await page.goto("/resources");
  const links = page.locator('[data-slot="site-resources"]').getByRole("link");
  expect(await links.count()).toBeGreaterThan(10);
  await expect(page.locator('[data-slot="site-resources"] a[href="/llms.txt"]')).toBeAttached();
});

// The 2026-09 reorganisation moved pages; every address that existed before still answers.
for (const [from, to] of [
  ["/charts", "/components/charts"],
  ["/charts/barchart", "/components/charts/barchart"],
  ["/blocks/kpi-cards-pace", "/visualizations/kpi-cards-pace"],
  ["/components/patterns/flagship", "/blocks/app-shells-flagship"],
] as const) {
  test(`${from} redirects permanently to ${to}`, async ({ request }) => {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(new URL(response.headers().location ?? "", "http://x").pathname).toBe(to);
  });
}

// The catalogue's front pages lead with highlights; a whole family is one click further. A live
// thumbnail is a Storybook frame, so a front page must never draw its whole branch again.
for (const route of ["/components/ui", "/blocks", "/visualizations", "/components/ai"]) {
  test(`${route} draws at most a dozen thumbnails`, async ({ page }) => {
    await page.goto(route);
    const thumbs = page.locator('[data-slot="story-thumb"], [data-slot="block-thumb"]');
    expect(await thumbs.count()).toBeLessThanOrEqual(12);
  });
}
