import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import {
  DashboardProvider,
  DashboardSheet,
  filterTileKind,
  type DashboardSpec,
} from "@elabs-ai/components-charts/dashboard";
import { tableTileKind } from "@/components/dashboard-tile-table/dashboard-tile-table";

/**
 * Renders the SHIPPED registry block (`@/components/…` maps to `registry/blocks`), a
 * `DashboardTileKind` for the sheet's `table` tile. See `.claude/rules/registry.md`.
 */
const SPEC: DashboardSpec = {
  version: 1,
  id: "table-tile-demo",
  grid: { mode: "fit", columns: 12, rows: 8, gap: 8 },
  tiles: [
    {
      id: "filter-month",
      kind: "filter",
      title: "Month",
      layout: { x: 0, y: 0, w: 4, h: 8 },
      content: {
        field: "month",
        label: "Month",
        values: [{ value: "Jan" }, { value: "Feb" }, { value: "Mar" }],
      },
    },
    {
      id: "table-orders",
      kind: "table",
      title: "Orders",
      layout: { x: 4, y: 0, w: 8, h: 8 },
      content: {
        field: "month",
        columns: [
          { id: "month", header: "Month" },
          { id: "revenue", header: "Revenue" },
        ],
        rows: [
          { month: "Jan", revenue: 12 },
          { month: "Feb", revenue: 18 },
          { month: "Mar", revenue: 15 },
        ],
      },
    },
  ],
};

function TableTileDemo() {
  return (
    <div className="h-[420px] w-full min-w-[560px]">
      <DashboardProvider spec={SPEC} tiles={[filterTileKind, tableTileKind]}>
        <DashboardSheet renderAll />
      </DashboardProvider>
    </div>
  );
}

const meta = {
  title: "Dashboard/Recipes/Tile — Table",
  component: TableTileDemo,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof TableTileDemo>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Selecting a filter value dims the table's non-matching rows via the shared tri-state. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Orders")).toBeInTheDocument();

    // Selecting "Feb" excludes the other two rows — dimmed with the ghost opacity +
    // dashed-frame recipe (`.claude/rules/dashboard.md`).
    await userEvent.click(canvas.getByRole("option", { name: /^Feb/ }));
    const dimmed = canvasElement.querySelectorAll(
      '[data-slot="dashboard-tile-table"] tr.opacity-50',
    );
    // "2 rows dimmed (Jan, Mar) once Feb is selected"
    await expect(dimmed.length).toBe(2);
  },
};
