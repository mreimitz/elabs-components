import { expect, test, type Page } from "@playwright/test";
import { gotoHome } from "./helpers";

// RM-099's "Ask your agent" loop: the live path talks to the site's own /mcp (request bodies
// asserted), and with /mcp unreachable the same prompt replays the recorded responses.
const PROMPT = "Build me a KPI overview for churn with a trend and a movers list";

async function runPrompt(page: Page) {
  await gotoHome(page);
  await page.locator("#agents").scrollIntoViewIfNeeded();
  await page.getByRole("combobox", { name: "Choose an example prompt" }).click();
  await page.getByRole("option", { name: PROMPT }).click();
  await page.locator('[data-slot="agent-loop"]').getByRole("button", { name: "Run" }).click();
  await expect(page.locator('[data-slot="agent-loop"][data-phase="done"]')).toHaveCount(1, {
    timeout: 20_000,
  });
  return page.$$eval('[data-slot="agent-loop-trace-step"]', (steps) =>
    steps.map((s) => ({
      status: s.getAttribute("data-status"),
      recorded: s.getAttribute("data-recorded"),
    })),
  );
}

test("live: the loop calls the site's /mcp", async ({ page }) => {
  const bodies: string[] = [];
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/mcp" && req.method() === "POST")
      bodies.push(req.postData() ?? "");
  });
  const trace = await runPrompt(page);
  const calls = bodies.map((b) => JSON.parse(b) as { method?: string; params?: { name?: string } });
  expect(calls.some((c) => c.method === "tools/call" && !!c.params?.name)).toBe(true);
  expect(trace.length).toBeGreaterThan(0);
  expect(trace.every((s) => s.recorded !== "true")).toBe(true);
  await expect(page.locator('[data-slot="agent-loop-render"]').first()).toBeVisible();
});

test("recorded: with /mcp unreachable the loop replays", async ({ page }) => {
  await page.route("**/mcp", (route) => route.abort());
  const trace = await runPrompt(page);
  expect(trace.length).toBeGreaterThan(0);
  expect(trace.every((s) => s.recorded === "true")).toBe(true);
  await expect(page.locator('[data-slot="agent-loop-render"]').first()).toBeVisible();
});
