import { expect, test } from "@playwright/test";
import { gotoHome } from "./helpers";

// The endpoints the site owns (ADR 0038), against the running server. RM-105 reuses this spec
// against the preview and production deploys.

test("/ answers 200 with a title and Open Graph tags", async ({ page }) => {
  const response = await gotoHome(page);
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/\S/);
  for (const property of ["og:title", "og:description", "og:image", "og:url"])
    await expect(page.locator(`meta[property="${property}"]`)).toHaveAttribute("content", /\S/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("fresh load never scrolls and never marks the page past the hero (ruling 13)", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "commit" });
  const samples: { ms: number; scrollY: number }[] = [];
  const started = Date.now();
  for (const at of [0, 300, 800, 1500, 3000]) {
    const wait = at - (Date.now() - started);
    if (wait > 0) await page.waitForTimeout(wait);
    samples.push({ ms: at, scrollY: await page.evaluate(() => window.scrollY) });
  }
  const pastHero = await page.evaluate(() =>
    document.documentElement.hasAttribute("data-past-hero"),
  );
  test.info().annotations.push({
    type: "fresh-load",
    description: `${JSON.stringify(samples)} data-past-hero=${pastHero}`,
  });
  expect(samples.every((s) => s.scrollY === 0)).toBe(true);
  expect(pastHero).toBe(false);
});

test("/llms.txt is plain text", async ({ request }) => {
  const res = await request.get("/llms.txt");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/plain");
  expect((await res.text()).length).toBeGreaterThan(200);
});

test("/.well-known/mcp.json names the hosted server", async ({ request }) => {
  const res = await request.get("/.well-known/mcp.json");
  expect(res.status()).toBe(200);
  expect(JSON.stringify(await res.json())).toContain("/mcp");
});

test("/r/registry.json is the shadcn registry", async ({ request }) => {
  const res = await request.get("/r/registry.json");
  expect(res.status()).toBe(200);
  const registry = (await res.json()) as { items?: unknown[] };
  expect(registry.items?.length ?? 0).toBeGreaterThan(0);
});

test("/mcp answers initialize over POST", async ({ request }) => {
  const res = await request.post("/mcp", {
    headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "site-e2e", version: "0.0.0" },
      },
    },
  });
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain('"serverInfo"');
  expect(body).toContain('"protocolVersion"');
});

test("/storybook/ serves the Storybook manager", async ({ request }) => {
  const origin = (process.env.STORYBOOK_ORIGIN ?? "https://storybook.elabs-ai.com").replace(
    /\/+$/,
    "",
  );
  let reachable = false;
  try {
    const probe = await request.get(`${origin}/`, { timeout: 5_000, maxRedirects: 0 });
    reachable = probe.status() === 200;
  } catch {
    reachable = false;
  }
  test.skip(!reachable, `STORYBOOK_ORIGIN ${origin} is not reachable with a 200 from here`);
  const res = await request.get("/storybook/");
  expect(res.status()).toBe(200);
  expect(await res.text()).toMatch(/sb-manager|storybook/i);
});
