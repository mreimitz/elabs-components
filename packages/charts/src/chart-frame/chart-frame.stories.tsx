import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Bar } from "../charts/bar";
import { BarChart } from "../charts/bar-chart";
import { BarXAxis } from "../charts/bar-x-axis";
import { Grid } from "../charts/grid";
import { ChartTooltip } from "../charts/tooltip";
import { ChartFrame } from "./chart-frame";

const meta = {
  title: "Charts/ChartFrame",
  component: ChartFrame,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof ChartFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── Sample data ───────────────────────────────────────────────────────────────

const monthlyData = [
  { month: "Jan", revenue: 12000, profit: 4500 },
  { month: "Feb", revenue: 15500, profit: 5200 },
  { month: "Mar", revenue: 11000, profit: 3800 },
  { month: "Apr", revenue: 18500, profit: 7100 },
  { month: "May", revenue: 16800, profit: 5400 },
  { month: "Jun", revenue: 21200, profit: 8800 },
];

const monthlyColumns = [
  { key: "month", header: "Month" },
  { key: "revenue", header: "Revenue ($)" },
  { key: "profit", header: "Profit ($)" },
];

/**
 * A real `@elabs-ai/components-charts` BarChart — ChartFrame wraps actual charts, so the
 * stories exercise the genuine integration (sizing, theming, toolbar overlay).
 * ChartFrame's body supplies the height, so the chart fills its box.
 */
function DemoChart() {
  return (
    <BarChart data={monthlyData} xDataKey="month">
      <Grid horizontal />
      <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" />
      <Bar dataKey="profit" fill="var(--chart-2)" lineCap="round" />
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  );
}

// ── Stories ───────────────────────────────────────────────────────────────────

/** Default closed state — full toolbar, data wired to both chart and ChartFrame. */
export const Default: Story = {
  render: () => (
    <div className="w-[560px]">
      <ChartFrame
        title="Monthly revenue"
        description="Jan – Jun 2025"
        data={monthlyData}
        columns={monthlyColumns}
      >
        <DemoChart />
      </ChartFrame>
    </div>
  ),
};

/** Expand modal opened via a play function interaction. */
export const Expanded: Story = {
  render: () => (
    <div className="w-[560px]">
      <ChartFrame
        title="Monthly revenue"
        description="Jan – Jun 2025"
        data={monthlyData}
        columns={monthlyColumns}
      >
        <DemoChart />
      </ChartFrame>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("Expand chart"));
    // Dialog is portalled outside canvasElement — query the document body.
    const dialog = await within(document.body).findByRole("dialog");
    // waitFor rides out the entrance animation (opacity starts at 0) — #278 D1.
    await waitFor(() => expect(dialog).toBeVisible());
    // Radix moves focus into the dialog after mount (focus-trap) — poll that too.
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  },
};

/** Flip-to-table view active on load (via play interaction). */
export const TableFlipped: Story = {
  render: () => (
    <div className="w-[560px]">
      <ChartFrame
        title="Revenue table"
        description="Flip using the table toggle"
        data={monthlyData}
        columns={monthlyColumns}
      >
        <DemoChart />
      </ChartFrame>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const flipToggle = canvas.getByLabelText("Flip to table view");
    await userEvent.click(flipToggle);
    // The flipped view remounts (key={state.view}) and replays the fade-in-0
    // entrance animation — waitFor rides out the opacity:0 frame (#278 D1).
    await waitFor(() => {
      expect(canvas.getByRole("table")).toBeVisible();
      expect(canvas.getByText("Month")).toBeInTheDocument();
      expect(canvas.getByText("Revenue ($)")).toBeInTheDocument();
    });
  },
};

/** No data — download and table controls are hidden (degraded toolbar). */
export const NoData: Story = {
  render: () => (
    <div className="w-[560px]">
      <ChartFrame title="No data yet" description="Toolbar degrades gracefully">
        <div className="flex h-full items-center justify-center text-body text-muted-foreground">
          No data available
        </div>
      </ChartFrame>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("Expand chart")).toBeInTheDocument();
    await expect(canvas.queryByLabelText("Flip to table view")).toBeNull();
    await expect(canvas.queryByLabelText("Download CSV")).toBeNull();
  },
};

/** Only the expand control shown when features is restricted. */
export const FeaturesSubset: Story = {
  render: () => (
    <div className="w-[560px]">
      <ChartFrame
        title="Expand only"
        description="Table and download are disabled"
        data={monthlyData}
        columns={monthlyColumns}
        features={["expand"]}
      >
        <DemoChart />
      </ChartFrame>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("Expand chart")).toBeInTheDocument();
    await expect(canvas.queryByLabelText("Flip to table view")).toBeNull();
    await expect(canvas.queryByLabelText("Download CSV")).toBeNull();
  },
};

/** Loading vs ready (#268) — a layout-shaped skeleton body, toolbar suppressed. */
export const Loading: Story = {
  render: () => (
    <div className="w-[560px]">
      <ChartFrame title="Monthly revenue" description="Jan – Jun 2025" loading>
        <DemoChart />
      </ChartFrame>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toBeInTheDocument();
    await expect(canvas.queryByLabelText("Expand chart")).toBeNull();
    await expect(canvas.queryByLabelText("Flip to table view")).toBeNull();
    await expect(canvas.queryByLabelText("Download CSV")).toBeNull();
  },
};

/**
 * The card contract's fourth part (lieflat) — an attribution/provenance
 * footer, shown inline and (via the play function below) inside the expand
 * modal's detail pane too. A plain-string `source` also rides the downloaded
 * CSV as a trailing `# source: …` comment row.
 */
export const WithSource: Story = {
  render: () => (
    <div className="w-[560px]">
      <ChartFrame
        title="Revenue is up 8% quarter over quarter"
        description="Monthly revenue, Jan – Jun 2025"
        data={monthlyData}
        columns={monthlyColumns}
        source="Source: Internal analytics, updated daily"
      >
        <DemoChart />
      </ChartFrame>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Source: Internal analytics, updated daily")).toBeVisible();

    await userEvent.click(canvas.getByLabelText("Expand chart"));
    const dialog = await within(document.body).findByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());
    await waitFor(() =>
      expect(
        within(dialog).getAllByText("Source: Internal analytics, updated daily").length,
      ).toBeGreaterThan(0),
    );
  },
};

/** Download callback fires with the correct rows when triggered. */
export const DownloadCallback: Story = {
  args: {
    onDownload: fn(),
  },
  render: (args) => (
    <div className="w-[560px]">
      <ChartFrame {...args} title="Download test" data={monthlyData} columns={monthlyColumns}>
        <DemoChart />
      </ChartFrame>
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("Download CSV"));
    await expect(args.onDownload).toHaveBeenCalledOnce();
    await expect(args.onDownload).toHaveBeenCalledWith(
      monthlyData,
      expect.arrayContaining([expect.objectContaining({ key: "month" })]),
    );
  },
};

// ── SVG/PNG export (RM-042) ────────────────────────────────────────────────────

// Module-scoped (not `args`) so the play function can inspect `.mock.calls`
// directly — mirrors `data-table.stories.tsx`'s `clickableRowsOnRowClick`.
const exportSpy = fn();

/**
 * Exports the chart's real rendered `<svg>` as SVG/PNG. `onExport` intercepts
 * the generated file instead of triggering a real browser download, so the
 * interaction test can inspect the `Blob` directly: the SVG is self-contained
 * (every `var(--…)` colour resolved via `getComputedStyle` at export time,
 * `<rect>` background painted from the card) and the PNG rasterises the same
 * built SVG.
 */
export const Export: Story = {
  render: () => (
    <div className="w-[560px]">
      <ChartFrame
        title="Monthly revenue"
        description="Jan – Jun 2025"
        data={monthlyData}
        columns={monthlyColumns}
        onExport={exportSpy}
      >
        <DemoChart />
      </ChartFrame>
    </div>
  ),
  play: async ({ canvasElement }) => {
    exportSpy.mockClear();
    const canvas = within(canvasElement);

    // The controls only appear once ChartFrameInner registers the rendered
    // <svg> (RM-042) — wait for it rather than assuming it's synchronous.
    await waitFor(() => expect(canvas.getByLabelText("Export as SVG")).toBeInTheDocument());
    await expect(canvas.getByLabelText("Export as PNG")).toBeInTheDocument();

    await userEvent.click(canvas.getByLabelText("Export as SVG"));
    await waitFor(() =>
      expect(exportSpy).toHaveBeenCalledWith(
        "svg",
        expect.any(Blob),
        expect.stringContaining(".svg"),
      ),
    );
    const svgCall = exportSpy.mock.calls.find((call) => call[0] === "svg");
    const svgBlob = svgCall?.[1] as Blob;
    const svgText = await svgBlob.text();
    await expect(svgText).not.toContain("var(");
    await expect(svgText).toContain("<rect");

    await userEvent.click(canvas.getByLabelText("Export as PNG"));
    await waitFor(() =>
      expect(exportSpy).toHaveBeenCalledWith(
        "png",
        expect.any(Blob),
        expect.stringContaining(".png"),
      ),
    );
    const pngCall = exportSpy.mock.calls.find((call) => call[0] === "png");
    const pngBlob = pngCall?.[1] as Blob;
    await expect(pngBlob.type).toBe("image/png");
    await expect(pngBlob.size).toBeGreaterThan(0);
  },
};
