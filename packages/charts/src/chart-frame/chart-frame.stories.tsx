import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@elabs-ai/components-ui";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Bar } from "../charts/bar";
import { BarChart } from "../charts/bar-chart";
import { BarXAxis } from "../charts/bar-x-axis";
import { Grid } from "../charts/grid";
import { PieCenter } from "../charts/pie-center";
import { PieChart } from "../charts/pie-chart";
import { PieSlice } from "../charts/pie-slice";
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
 * footer, shown inline and (via the play function below) under the chart
 * inside the expand modal too — never appended to the summary/detail pane
 * (#184). A plain-string `source` also rides the downloaded CSV as a
 * trailing `# source: …` comment row.
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

// ── RM-072: density tiers, tile chrome, interactions ─────────────────────────

/** Fills the frame body instead of holding a 2:1 aspect, so a tile sets the height. */
function FillChart() {
  return (
    <BarChart data={monthlyData} xDataKey="month" aspectRatio="auto" className="h-full">
      <Grid horizontal />
      <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" />
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  );
}

const densityTiers = [
  { id: "xs", label: "xs — 196 × 92", box: "w-[196px] h-[92px]" },
  { id: "sm", label: "sm — 392 × 184", box: "w-full max-w-[392px] h-[184px]" },
  { id: "md", label: "md — 784 × 368", box: "w-full max-w-[784px] h-[368px]" },
  { id: "lg", label: "lg — full width", box: "w-full h-[420px]" },
] as const;

/** Characters of `el`'s single-line text actually painted before it clips (ellipsis excluded). */
function visibleCharCount(el: HTMLElement): number {
  const text = el.textContent ?? "";
  const node = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode();
  if (!node) return 0;
  const box = el.getBoundingClientRect();
  // Reserve one character's width for the ellipsis that `truncate` paints.
  const ellipsis = Number.parseFloat(getComputedStyle(el).fontSize) * 0.6;
  const range = document.createRange();
  let count = 0;
  for (let i = 1; i <= text.length; i++) {
    range.setStart(node, i - 1);
    range.setEnd(node, i);
    const limit = i === text.length ? box.right : box.right - ellipsis;
    if (range.getBoundingClientRect().right > limit + 0.5) break;
    count = i;
  }
  return count;
}

/** True when `inner` lies wholly inside `outer` (half-pixel tolerance for subpixel layout). */
function isInside(inner: Element, outer: Element): boolean {
  const a = inner.getBoundingClientRect();
  const b = outer.getBoundingClientRect();
  return (
    a.left >= b.left - 0.5 &&
    a.right <= b.right + 0.5 &&
    a.top >= b.top - 0.5 &&
    a.bottom <= b.bottom + 0.5
  );
}

/**
 * The same chart at the sheet-tile sizes a 24 × 12 fit grid produces at 1200 px.
 * `density` only REMOVES furniture: `xs` drops every axis label, the legend, the
 * description and the source row; `sm` keeps the category axis with at most four
 * ticks; `md` is the default frame; `lg` is today’s frame at full width.
 */
export const DensityTiers: Story = {
  name: "Density tiers",
  render: () => (
    <div className="flex w-full flex-col gap-6">
      {densityTiers.map((tier) => (
        <section key={tier.id} aria-label={tier.label} className="flex flex-col gap-2">
          <p className="text-meta text-muted-foreground">{tier.label}</p>
          <div className={`${tier.box} overflow-hidden rounded-lg border bg-card p-2`}>
            <ChartFrame
              chrome="tile"
              density={tier.id}
              title="Revenue is up 77% since January"
              description="Monthly revenue, Jan – Jun 2025"
              source="Source: Internal ledger"
              data={monthlyData}
              columns={monthlyColumns}
            >
              <FillChart />
            </ChartFrame>
          </div>
        </section>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const xs = canvas.getByRole("region", { name: densityTiers[0].label });
    const md = canvas.getByRole("region", { name: densityTiers[2].label });
    await waitFor(() =>
      expect(md.querySelectorAll(".text-chart-label.text-meta").length).toBeGreaterThan(0),
    );
    await expect(xs.querySelectorAll(".text-chart-label.text-meta")).toHaveLength(0);
    await expect(within(xs).queryByText("Source: Internal ledger")).toBeNull();
    await expect(within(md).getByText("Source: Internal ledger")).toBeInTheDocument();

    // #444: every tier FITS its tile — nothing is hidden by the host's overflow.
    for (const tier of densityTiers) {
      const section = canvas.getByRole("region", { name: tier.label });
      const frame = section.querySelector<HTMLElement>('[data-slot="chart-frame"]')!;
      const host = frame.parentElement!;
      await waitFor(() => expect(frame.querySelector("svg")).not.toBeNull());
      for (const box of [host, frame]) {
        await expect(box.scrollHeight, `${tier.id} height`).toBeLessThanOrEqual(box.clientHeight);
        await expect(box.scrollWidth, `${tier.id} width`).toBeLessThanOrEqual(box.clientWidth);
      }
      // The title keeps readable text: more than one painted character.
      const title = frame.querySelector<HTMLElement>('[data-slot="card-title"]')!;
      await expect(visibleCharCount(title), `${tier.id} title`).toBeGreaterThan(1);
      // Axis labels and the source row are either absent or wholly inside the frame.
      const furniture = frame.querySelectorAll(".text-chart-label, svg text");
      for (const node of furniture) {
        await expect(isInside(node, frame), `${tier.id} axis`).toBe(true);
      }
      const source = within(frame).queryByText("Source: Internal ledger");
      if (source) await expect(isInside(source, frame), `${tier.id} source`).toBe(true);
    }
    // The smallest tiers collapse the toolbar to one control (Expand).
    const xsFrame = xs.querySelector('[data-slot="chart-frame-header"]')!;
    await expect(xsFrame.querySelectorAll("button")).toHaveLength(1);
    await expect(within(xs).getByRole("button", { name: "Expand chart" })).toBeVisible();
  },
};

const datapointClickSpy = fn();
const DATAPOINT_TARGET = '[data-slot="chart-datapoint-layer-target"][tabindex="0"]';

/**
 * Keyboard users see what hover shows (#447): tabbing onto a datapoint target
 * shows the chart’s own tooltip, and tabbing away hides it again.
 */
export const KeyboardTooltip: Story = {
  render: () => (
    <div className="h-[320px] w-full max-w-[560px] rounded-lg border bg-card p-3">
      <ChartFrame chrome="tile" title="Monthly revenue" data={monthlyData} features={[]}>
        <BarChart
          data={monthlyData}
          xDataKey="month"
          aspectRatio="auto"
          className="h-full"
          onDatapointClick={datapointClickSpy}
        >
          <Grid horizontal />
          <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" />
          <BarXAxis />
          <ChartTooltip />
        </BarChart>
      </ChartFrame>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const tooltip = () => doc.querySelector<HTMLElement>('[data-slot="chart-tooltip-box"]');
    await waitFor(() => expect(canvasElement.querySelector(DATAPOINT_TARGET)).not.toBeNull());
    await expect(tooltip()).toBeNull();

    // One tab, one wait: the bridge replays once the chart accepts hover.
    await userEvent.tab();
    await expect(canvasElement.querySelector(DATAPOINT_TARGET)).toHaveFocus();
    await waitFor(() => expect(tooltip()).toBeVisible(), { timeout: 3000 });

    await userEvent.tab();
    await waitFor(() => expect(tooltip()).toBeNull());
  },
};

const pieData = [
  { label: "Direct", value: 320 },
  { label: "Organic", value: 280 },
  { label: "Referral", value: 190 },
];

/**
 * The same bridge on a family with its own hover vocabulary (#447): a Pie has
 * no tooltip box — hovering a slice lifts it with a glow and names it in the
 * donut centre — so focusing a slice’s keyboard target shows exactly that.
 */
export const KeyboardTooltipPie: Story = {
  name: "Keyboard tooltip (Pie)",
  render: () => (
    <div className="w-full max-w-[360px] rounded-lg border bg-card p-3">
      <ChartFrame chrome="tile" title="Traffic by source" data={pieData} features={[]}>
        <PieChart
          accessibleLabel="Traffic by source"
          data={pieData}
          innerRadius={70}
          size={240}
          onDatapointClick={datapointClickSpy}
        >
          {pieData.map((item, i) => (
            <PieSlice index={i} key={item.label} />
          ))}
          <PieCenter defaultLabel="Traffic" />
        </PieChart>
      </ChartFrame>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvasElement.querySelector(DATAPOINT_TARGET)).not.toBeNull());
    await expect(canvas.getByText("Traffic")).toBeVisible();

    // The pie's figure is its own tab stop (the chart summary); the slice
    // targets come next.
    await userEvent.tab();
    await expect(canvas.getByRole("figure", { name: "Traffic by source" })).toHaveFocus();
    await userEvent.tab();
    const target = canvasElement.querySelector<HTMLElement>(DATAPOINT_TARGET)!;
    await expect(target).toHaveFocus();
    // The focused slice's hover feedback: its name in the centre and the glow.
    await waitFor(
      () => {
        expect(canvas.getByText("Direct")).toBeVisible();
        expect(canvasElement.querySelector('[style*="drop-shadow"]')).not.toBeNull();
      },
      { timeout: 3000 },
    );

    await userEvent.tab();
    await waitFor(() => expect(canvas.getByText("Traffic")).toBeVisible());
  },
};

const expandChangeSpy = fn();

/**
 * `chrome="tile"` for a dashboard sheet: the host tile owns the border and the
 * header, so the frame draws no card. `headerSlot` and `menuSlot` replace the
 * default title and toolbar; the menu receives the frame’s actions, so the
 * expand modal still opens from the host’s own button and `onExpandChange`
 * reports it.
 */
export const TileChrome: Story = {
  render: () => (
    <div className="w-full max-w-[560px] rounded-lg border bg-card p-3">
      <ChartFrame
        chrome="tile"
        height={220}
        title="Monthly revenue"
        data={monthlyData}
        columns={monthlyColumns}
        source="Source: Internal ledger"
        onExpandChange={expandChangeSpy}
        headerSlot={<p className="text-subtitle truncate">Revenue tile</p>}
        menuSlot={(api) => (
          <Button variant="ghost" size="sm" onClick={api.expand}>
            Open full view
          </Button>
        )}
      >
        <FillChart />
      </ChartFrame>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expandChangeSpy.mockClear();
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Revenue tile")).toBeInTheDocument();
    await expect(canvas.queryByLabelText("Expand chart")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Open full view" }));
    const dialog = await within(document.body).findByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(expandChangeSpy).toHaveBeenCalledWith(true);
  },
};

/** `chrome="bare"`: the chart body only — for a host that draws everything else. */
export const BareChrome: Story = {
  render: () => (
    <div className="h-[220px] w-full max-w-[560px]">
      <ChartFrame chrome="bare" height={220} title="Monthly revenue" data={monthlyData}>
        <FillChart />
      </ChartFrame>
    </div>
  ),
};

const datapointSpy = fn();

/**
 * `interactions` switches behaviour off without unmounting children (the nebula.js
 * `Interactions` model): `passive: false` removes the tooltip, `select: false`
 * keeps the keyboard layer but never fires `onDatapointClick`.
 */
export const InteractionsOff: Story = {
  render: () => (
    <div className="w-full max-w-[560px]">
      <ChartFrame
        title="Monthly revenue (read-only)"
        data={monthlyData}
        columns={monthlyColumns}
        interactions={{ passive: false, select: false }}
      >
        <BarChart data={monthlyData} xDataKey="month" onDatapointClick={datapointSpy}>
          <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" />
          <BarXAxis />
          <ChartTooltip />
        </BarChart>
      </ChartFrame>
    </div>
  ),
  play: async ({ canvasElement }) => {
    datapointSpy.mockClear();
    const target = await waitFor(() => {
      const el = canvasElement.querySelector<HTMLButtonElement>(
        '[data-slot="chart-datapoint-layer-target"]',
      );
      if (!el) throw new Error("datapoint layer not mounted yet");
      return el;
    });
    target.focus();
    await userEvent.keyboard("{Enter}");
    await expect(datapointSpy).not.toHaveBeenCalled();
  },
};

/**
 * A fixed short body with genuinely tall content — the scrollable region ALWAYS
 * overflows, so this deterministically (never intermittently) exercises the
 * overflow-aware `tabIndex`/`role="group"`/`aria-label` fix (#432 round 3), and
 * Storybook's own axe check (`a11y: { test: "error" }`) runs against a body that
 * is guaranteed to be in the labelled/focusable state — proving `role="group"`
 * (not `aria-label` on a bare `div`) satisfies axe's `aria-prohibited-attr` rule.
 */
export const OverflowingBody: Story = {
  render: () => (
    <div className="w-[320px]">
      <ChartFrame title="Tall content" chrome="tile" height={80}>
        <div style={{ height: 400 }}>Tall content that always overflows its 80px box.</div>
      </ChartFrame>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const body = canvasElement.querySelector<HTMLElement>('[data-slot="chart-frame-body"] > div');
    if (!body) throw new Error("chart-frame-body scroll container not found");
    await waitFor(() => {
      expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
      expect(body).toHaveAttribute("tabindex", "0");
    });
    expect(body).toHaveAttribute("role", "group");
    expect(body).toHaveAccessibleName("Scrollable chart: Tall content");
  },
};
