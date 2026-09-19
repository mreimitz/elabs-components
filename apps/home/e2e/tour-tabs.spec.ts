import { expect, test, type Page } from "@playwright/test";
import { tourCopy } from "../content/copy";
import { gotoHome } from "./helpers";

// Concept §7: every tab is interactive within 1 s of the click. Each tab's named interaction is
// the RM-097/098 validators' check, promoted to a permanent spec.
const panel = (page: Page) => page.locator('#tour [role="tabpanel"][data-state="active"]');

async function openTab(page: Page, label: string) {
  const tab = page.locator("#tour").getByRole("tab", { name: label, exact: true });
  await tab.hover();
  const started = Date.now();
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await expect
    .poll(() =>
      panel(page).evaluate(
        (el) =>
          el.querySelectorAll('[data-slot="skeleton"]').length === 0 &&
          el.textContent!.trim().length > 0,
      ),
    )
    .toBe(true);
  return Date.now() - started;
}

test.beforeEach(async ({ page }) => {
  await gotoHome(page);
  await page.locator("#tour").scrollIntoViewIfNeeded();
  await page.waitForLoadState("networkidle");
});

for (const [id, meta] of Object.entries(tourCopy.tabs)) {
  test(`${id} opens within 1 s of the click`, async ({ page }, testInfo) => {
    if (id !== "dashboard") await openTab(page, tourCopy.tabs.dashboard.label);
    const ms = await openTab(page, meta.label);
    testInfo.annotations.push({ type: "open-ms", description: `${id}: ${ms} ms` });
    expect(ms).toBeLessThanOrEqual(1_000);
  });
}

test("dashboard: dragging a tile changes the spec", async ({ page }) => {
  await openTab(page, tourCopy.tabs.dashboard.label);
  await panel(page).getByRole("radio", { name: /edit/i }).click();
  const layout = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            __tourDashboardSpec?: { tiles: { id: string; layout: unknown }[] };
          }
        ).__tourDashboardSpec?.tiles.find((t) => t.id === "metric-arr")?.layout,
    );
  const before = await layout();
  const handle = panel(page).getByRole("button", { name: /^Move Annual recurring revenue$/i });
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 5 });
  await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2 + 5, { steps: 8 });
  await page.mouse.up();
  await expect.poll(layout).not.toEqual(before);
});

test("data app: a search filters the order count", async ({ page }) => {
  await openTab(page, tourCopy.tabs["data-app"].label);
  const count = async () => {
    const text =
      (await panel(page)
        .getByText(/^[\d,.\s]+ orders$/)
        .first()
        .textContent()) ?? "";
    return Number(text.replace(/\D/g, ""));
  };
  const before = await count();
  await panel(page).getByRole("textbox").first().fill("EMEA");
  await expect.poll(count).toBeLessThan(before);
});

test("settings: delete is guarded by a confirmation", async ({ page }) => {
  await openTab(page, tourCopy.tabs.settings.label);
  await panel(page)
    .getByRole("button", { name: /danger/i })
    .click();
  await panel(page)
    .getByRole("button", { name: /^Delete .*workspace$/i })
    .first()
    .click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^Delete .*workspace$/i })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("AI assistant: a tool call expands", async ({ page }) => {
  await openTab(page, tourCopy.tabs["ai-assistant"].label);
  const tool = panel(page)
    .getByRole("button", { name: /query_kpis/i })
    .first();
  await tool.click();
  await expect(tool).toHaveAttribute("aria-expanded", "true");
});

test("flow workspace: selecting a node fills the inspector", async ({ page }) => {
  await openTab(page, tourCopy.tabs["flow-workspace"].label);
  const node = panel(page).locator(".react-flow__node").first();
  await expect(node).toBeVisible();
  const label = (await node.innerText()).split("\n")[0]!.trim();
  await node.click();
  await expect
    .poll(async () => (await panel(page).innerText()).split(label).length - 1)
    .toBeGreaterThan(1);
});

test("process explorer: picking a variant filters the cases", async ({ page }) => {
  await openTab(page, tourCopy.tabs["process-explorer"].label);
  const caseRows = async () => {
    await page.getByRole("button", { name: "Case table" }).click();
    const n = await page.locator('[data-slot="case-table"] tbody tr').count();
    await page.keyboard.press("Escape");
    return n;
  };
  const before = await caseRows();
  const variants = panel(page).locator('[data-slot="variant-explorer-row"]');
  expect(await variants.count()).toBeGreaterThan(1);
  await variants.nth(1).locator('[data-slot="checkbox"]').click();
  await expect.poll(caseRows).not.toBe(before);
});
