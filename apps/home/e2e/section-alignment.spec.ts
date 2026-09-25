import { expect, test } from "@playwright/test";

/**
 * Locks #555: `WorksWith` and `RouteCards` used a narrower `max-w-6xl` container than every
 * other section, so the page's left edge visibly jumped at their seams. Site padding is
 * theme-independent (only color tokens vary by theme, per #568's own evidence), so one theme
 * (default) is enough to prove the box model.
 *
 * The page reorganization since the original wave-3 review moved `WorksWith` onto `/agents`
 * (after `AgentLoopSection` + `EmitUiSection`) and left `RouteCards` on `/` (after `#themes`) —
 * they are no longer adjacent to each other on any single page. So this checks each section
 * against its REAL current neighbor, not the original (now-stale) "one continuous scroll"
 * framing.
 */
const leftEdge = async (page: import("@playwright/test").Page, selector: string) => {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`${selector} has no box`);
  return Math.round(box.x);
};

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`/agents: #agents, #emit-ui and #works-with share one left edge at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/agents");
    const agents = await leftEdge(page, "#agents");
    const emitUi = await leftEdge(page, "#emit-ui");
    const worksWith = await leftEdge(page, "#works-with");
    expect(worksWith).toBe(agents);
    expect(worksWith).toBe(emitUi);
  });

  test(`/: #themes and the route cards share one left edge at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const themes = await leftEdge(page, "#themes");
    const routeCards = await leftEdge(page, '[data-slot="route-cards"]');
    expect(routeCards).toBe(themes);
  });
}
