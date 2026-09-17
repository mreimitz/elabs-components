import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { DashboardSheetApp } from "@/components/dashboard-sheet-app/dashboard-sheet-app";

/**
 * Renders the SHIPPED registry block (`@/components/…` maps to `registry/blocks`) — the
 * installable version of `packages/charts/src/templates-dashboard-sheet.stories.tsx`,
 * with the `table`/`chat`/`process-map` tile blocks pre-registered. See
 * `.claude/rules/registry.md`.
 */
const meta = {
  title: "Dashboard/Recipes/Dashboard sheet app",
  component: DashboardSheetApp,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof DashboardSheetApp>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The full chrome: nav, toolbar, selection bar and a starter sheet with a `table` tile. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Dashboards" })).toBeInTheDocument();
    await expect(canvas.getByRole("radio", { name: "View" })).toBeInTheDocument();
    await expect(canvas.getByText("Orders by month")).toBeInTheDocument();
    // "3 tiles on the starter sheet: a month filter, a revenue chart, an orders table".
    // Scoped to the sheet's own `data-slot="dashboard-tile"` wrapper — some tile kinds
    // (the built-in `filter`, this block's own `table`) also stamp `data-tile-kind` on
    // their inner root, which an unscoped query would double-count.
    const tiles = canvasElement.querySelectorAll('[data-slot="dashboard-tile"][data-tile-kind]');
    await expect(tiles.length).toBe(3);

    // #432 regression (wave-4-review-visual.md P0-1): Edit -> Add opens the
    // Assets dock beside the block's own Sidebar — it must never paint over
    // the nav, leave a dead gap, or intersect the Sidebar's rect.
    await userEvent.click(canvas.getByRole("radio", { name: "Edit" }));
    await userEvent.click(canvas.getByRole("button", { name: "Add" }));
    const dashboardsNav = canvas.getByRole("button", { name: "Dashboards" });
    await expect(dashboardsNav).toBeVisible();
    const sidebarContainer = canvasElement.querySelector(
      '[data-slot="sidebar-container"]',
    ) as HTMLElement;
    const dockContainer = canvasElement.querySelector(
      '[data-dashboard-panel="assets"][data-slot="side-dock-container"]',
    ) as HTMLElement;
    const canvasWrapper = (
      canvasElement.querySelector('[data-slot="dashboard-sheet"]') as HTMLElement
    ).parentElement as HTMLElement;
    // Settle the open tween before measuring (mirrors the ui SideDock stories).
    await waitFor(() => {
      const dockRect = dockContainer.getBoundingClientRect();
      const sidebarRect = sidebarContainer.getBoundingClientRect();
      expect(dockRect.left).toBeGreaterThanOrEqual(sidebarRect.right);
    });
    const sidebarRect = sidebarContainer.getBoundingClientRect();
    const dockRect = dockContainer.getBoundingClientRect();
    const canvasRect = canvasWrapper.getBoundingClientRect();
    const overlaps =
      sidebarRect.left < dockRect.right &&
      dockRect.left < sidebarRect.right &&
      sidebarRect.top < dockRect.bottom &&
      dockRect.top < sidebarRect.bottom;
    await expect(overlaps).toBe(false);
    await expect(dockRect.left).toBeGreaterThanOrEqual(sidebarRect.right);
    await expect(Math.abs(canvasRect.left - dockRect.right)).toBeLessThanOrEqual(1);

    // #432 round 3 (wave-4-review-3.md §4): the Assets dock stays open (never
    // silence the underlying gap by closing it here) and the sheet's canvas is
    // now genuinely narrower, which can make "Orders by month" overflow its
    // `chart-frame-body` box intermittently. That box is now overflow-aware
    // (ResizeObserver-driven `tabIndex`) — wait for its measurement to settle
    // so Storybook's a11y addon runs its post-play axe check against final
    // layout, never a mid-measurement frame.
    const chartBodies = Array.from(
      canvasElement.querySelectorAll('[data-slot="chart-frame-body"] > div'),
    ) as HTMLElement[];
    await waitFor(() => {
      for (const body of chartBodies) {
        const overflowing =
          body.scrollWidth > body.clientWidth || body.scrollHeight > body.clientHeight;
        expect(body.tabIndex === 0).toBe(overflowing);
      }
    });
  },
};
