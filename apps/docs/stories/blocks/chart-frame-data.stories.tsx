import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { ChartFrameDataBlock } from "@/components/chart-frame-data/chart-frame-data-block";

/**
 * The INTERACTIVE flip-to-table. `@elabs/components-charts` `ChartFrame` ships a static,
 * dependency-free table on flip (the `charts ↛ data` rule forbids importing the
 * sibling `@elabs/components-data`). To flip to the REAL sortable `@elabs/components-data` `DataTable`,
 * compose both at a layer that may see both — an app, or the copy-own
 * **`chart-frame-data` registry block**, which is exactly what this story renders.
 * The wiring is the `ChartFrame` `renderTable` / `onDownload` seams — no second
 * table engine, no island.
 */
const meta = {
  title: "Patterns/Blocks/ChartFrame + DataTable",
  component: ChartFrameDataBlock,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Interactive flip-to-table = `ChartFrame` + the real `@elabs/components-data` `DataTable` + `downloadCsv`, composed in app/registry code via the `renderTable` / `onDownload` seams. Use the table toggle in the toolbar to flip; the flipped table sorts on header click.\n\nCopy-own it: `npx shadcn add chart-frame-data`.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 680 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChartFrameDataBlock>;

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
