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

    // Selecting "Feb" excludes the other two rows — de-emphasised with the
    // muted-foreground ink + dashed-frame recipe (`.claude/rules/dashboard.md`), never the
    // ghost opacity (that drops running text below the 4.5:1 contrast floor).
    await userEvent.click(canvas.getByRole("option", { name: /^Feb/ }));
    const dimmed = canvasElement.querySelectorAll(
      '[data-slot="dashboard-tile-table"] tr.text-muted-foreground',
    );
    // "2 rows de-emphasised (Jan, Mar) once Feb is selected"
    await expect(dimmed.length).toBe(2);

    // #429 P1-3: the selected row (Feb) is never colour-only — a solid `chart-foreground`
    // outline is the second channel, and the row's hidden activation button's accessible
    // name carries the state to assistive tech too.
    const selectedRow = canvasElement.querySelector<HTMLElement>(
      '[data-slot="dashboard-tile-table"] tr.border-chart-foreground',
    );
    await expect(selectedRow).not.toBeNull();
    const outline = getComputedStyle(selectedRow!).borderColor;
    await expect(outline).not.toBe(""); // quoted below via the assertion message
    await expect(getComputedStyle(selectedRow!).borderStyle).not.toBe("none");
    await expect(canvas.getByRole("button", { name: "Feb, selected" })).toBeInTheDocument();
  },
};
