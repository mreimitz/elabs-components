import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Bar, BarChart, BarXAxis, ChartFrame, ChartTooltip, Grid } from "@elabs/components-charts";
import { DataTable, downloadCsv, type ColumnDef } from "@elabs/components-data";

/**
 * The INTERACTIVE flip-to-table. `@elabs/components-charts` `ChartFrame` ships a static,
 * dependency-free table on flip (the `charts ↛ data` rule forbids importing the
 * sibling `@elabs/components-data`). To flip to the REAL sortable `@elabs/components-data` `DataTable`,
 * compose both at a layer that may see both — an app, or the copy-own
 * **`chart-frame-data` registry block** (`npx shadcn add chart-frame-data`), which
 * this demo mirrors. The wiring is the `ChartFrame` `renderTable` / `onDownload`
 * seams — no second table engine, no island.
 */

// `type` (not `interface`) so `Row` carries an implicit index signature and is
// assignable to the chart/table `Record<string, unknown>[]` data props.
type Row = {
  month: string;
  revenue: number;
  profit: number;
};

const data: Row[] = [
  { month: "Jan", revenue: 12000, profit: 4500 },
  { month: "Feb", revenue: 15500, profit: 5200 },
  { month: "Mar", revenue: 11000, profit: 3800 },
  { month: "Apr", revenue: 18500, profit: 7100 },
  { month: "May", revenue: 16800, profit: 5400 },
  { month: "Jun", revenue: 21200, profit: 8800 },
];

const columns = [
  { key: "month", header: "Month" },
  { key: "revenue", header: "Revenue ($)" },
  { key: "profit", header: "Profit ($)" },
];

function ChartFrameDataTableDemo() {
  return (
    <div style={{ maxWidth: 680 }}>
      <ChartFrame
        title="Monthly revenue"
        description="Flip via the toolbar toggle — the table is the real @elabs/components-data DataTable: sortable, with CSV export via downloadCsv."
        data={data}
        columns={columns}
        // Flip-to-table renders the full TanStack DataTable instead of the static table.
        renderTable={(rows, cols) => (
          <DataTable
            data={rows}
            columns={cols.map(
              (c): ColumnDef<Record<string, unknown>> => ({
                accessorKey: c.key,
                header: c.header ?? c.key,
              }),
            )}
          />
        )}
        onDownload={(rows, cols) =>
          downloadCsv(rows, { columns: cols, filename: "monthly-revenue" })
        }
      >
        <BarChart data={data} xDataKey="month">
          <Grid horizontal />
          <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" />
          <Bar dataKey="profit" fill="var(--chart-2)" lineCap="round" />
          <BarXAxis />
          <ChartTooltip />
        </BarChart>
      </ChartFrame>
    </div>
  );
}

const meta = {
  title: "Patterns/Blocks/ChartFrame + DataTable",
  component: ChartFrameDataTableDemo,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Interactive flip-to-table = `ChartFrame` + the real `@elabs/components-data` `DataTable` + `downloadCsv`, composed in app/registry code via the `renderTable` / `onDownload` seams. The copy-own version is the `chart-frame-data` registry block (`npx shadcn add chart-frame-data`). Use the table toggle in the toolbar to flip; the flipped table sorts on header click.",
      },
    },
  },
} satisfies Meta<typeof ChartFrameDataTableDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The chart at rest. Flip via the table toggle in the toolbar. */
export const Default: Story = {};

/**
 * Regression lock: flipping yields the real sortable `DataTable` (not the static
 * island) — clicking a column header reorders the rows.
 */
export const FlipAndSort: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: /flip to table view/i }));

    // The flipped table is the @elabs/components-data DataTable: its sortable column headers
    // are <button>s — the proof it is interactive, not the static charts table.
    const revenueHeader = await canvas.findByRole("button", { name: /revenue/i });

    const firstCellBefore = canvas.getAllByRole("cell")[0]?.textContent;
    await userEvent.click(revenueHeader); // sort by revenue → row order changes
    const firstCellAfter = canvas.getAllByRole("cell")[0]?.textContent;

    await expect(firstCellBefore).not.toBe(firstCellAfter);
  },
};
