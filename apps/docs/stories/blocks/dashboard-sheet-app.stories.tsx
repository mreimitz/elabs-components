import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { expect, within } from "storybook/test";
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
    // "3 tiles on the starter sheet: a month filter, a revenue chart, an orders table"
    const tiles = canvasElement.querySelectorAll("[data-tile-kind]");
    await expect(tiles.length).toBe(3);
  },
};
