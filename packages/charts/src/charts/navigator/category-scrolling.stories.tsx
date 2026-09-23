import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor } from "storybook/test";
import { seededRnd } from "../../marks/seeded-rnd";
import { Bar } from "../bar";
import { BarChart } from "../bar-chart";
import { BarXAxis } from "../bar-x-axis";
import { BarYAxis } from "../bar-y-axis";
import type { ChartDatapoint } from "../chart-datapoint";
import { ComposedChart } from "../composed-chart";
import { Grid } from "../grid";
import { HeatmapChart } from "../heatmap/heatmap-chart";
import { Line } from "../line";
import { SeriesBar } from "../series-bar";
import { ChartTooltip } from "../tooltip";
import { XAxis } from "../x-axis";
import { YAxis } from "../y-axis";
import type { NavigatorChangeMeta, NavigatorWindow } from "./types";

/**
 * Overflow scrolling on the category families (RM-141, ADR 0040 §2).
 *
 * `BarChart` (both orientations), `ComposedChart` / `LineChart` / `AreaChart`
 * on a band x, and `HeatmapChart` (a column window) accept `scrollbar`,
 * `maxVisibleItems`, `window` / `defaultWindow` / `onWindowChange` (kind
 * `"index"`), `align` and `windowDomain`. With the strip on, the plot shows
 * only the window: the band scale is built for the visible slice, every other
 * row stays in `data` (the table flip, the honesty gate and every datapoint
 * index still address the full data), and the value axis keeps the FULL
 * data's domain unless `windowDomain="visible"`.
 *
 * Default `scrollbar="none"`: a chart grows no strip on its own. With a
 * scrollbar set, the strip still appears only once the categories overflow
 * `maxVisibleItems` (default `"auto"` — as many as keep a readable band).
 */
const meta = {
  title: "Charts/Navigator/Category scrolling",
  component: BarChart,
  tags: ["autodocs"],
  args: {
    data: [],
    children: null,
    onWindowChange: fn(),
    onDatapointClick: fn(),
  },
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

type OnWindowChange = (window: NavigatorWindow | null, meta: NavigatorChangeMeta) => void;
type WindowMock = OnWindowChange & { mock: { calls: [NavigatorWindow, NavigatorChangeMeta][] } };
type DatapointMock = ((point: ChartDatapoint) => void) & {
  mock: { calls: [ChartDatapoint, unknown][] };
};

// ── Data ────────────────────────────────────────────────────────────────────

const label = (i: number) => `C${String(i).padStart(3, "0")}`;

/** 120 categories — far more than any plot shows readably. */
const ONE_TWENTY = Array.from({ length: 120 }, (_, i) => ({
  name: label(i),
  revenue: Math.round(40 + seededRnd(i, 3) * 60 + (i % 17 === 0 ? 45 : 0)),
}));

/** 80 rows for the horizontal chart. */
const EIGHTY = Array.from({ length: 80 }, (_, i) => ({
  name: `Store ${String(i + 1).padStart(2, "0")}`,
  sales: Math.round(20 + seededRnd(i, 7) * 80),
}));

/** Stacked: one outlier late in the data sets the full domain. */
const STACKED = Array.from({ length: 90 }, (_, i) => ({
  name: label(i),
  online: Math.round(10 + seededRnd(i, 11) * 20 + (i === 84 ? 120 : 0)),
  retail: Math.round(8 + seededRnd(i, 12) * 16),
}));

const COMPOSED = Array.from({ length: 72 }, (_, i) => ({
  name: `Wk ${i + 1}`,
  orders: Math.round(200 + seededRnd(i, 21) * 120),
  target: 260 + Math.round(Math.sin(i / 6) * 30),
}));

const DAY_NAMES = Array.from({ length: 365 }, (_, i) => {
  const d = new Date(Date.UTC(2025, 0, 1 + i));
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
});
const HEAT = DAY_NAMES.flatMap((day, column) =>
  ["North", "South", "East", "West"].map((region, row) => ({
    day,
    region,
    tickets: Math.round(4 + seededRnd(column * 4 + row, 31) * 20 + (column % 7 === 0 ? 8 : 0)),
  })),
);

// ── Play helpers ─────────────────────────────────────────────────────────────

const stripOf = async (root: Element) =>
  waitFor(() => {
    const el = root.querySelector<HTMLElement>('[data-slot="chart-navigator"]');
    expect(el).not.toBeNull();
    return el!;
  });
const handles = (root: Element) =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-slot="chart-navigator-handle"]'));
const valueNow = (el: Element) => Number(el.getAttribute("aria-valuenow"));
/** The first painted category label (the axis paints them in order). */
const firstLabel = (root: Element, pattern = /^C\d{3}$/) =>
  Array.from(root.querySelectorAll("span.text-meta"))
    .map((el) => el.textContent?.trim() ?? "")
    .find((text) => pattern.test(text)) ?? "";
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

function pointer(target: Element, type: string, clientX: number, clientY: number) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      pointerId: 11,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
    }),
  );
}

// ── Stories ──────────────────────────────────────────────────────────────────

/**
 * 120 categories with the mini chart. The plot shows as many categories as a
 * readable band allows; drag the window (or click the strip, or wheel over
 * it) to scroll. The value axis stays put — it is the full data's.
 */
export const MiniChart120: Story = {
  render: (args) => (
    <div className="w-full max-w-[720px]">
      <BarChart
        animationDuration={0}
        data={ONE_TWENTY}
        onWindowChange={args.onWindowChange}
        scrollbar="miniChart"
        xDataKey="name"
      >
        <Grid horizontal />
        <Bar dataKey="revenue" />
        <BarXAxis />
        <YAxis />
        <ChartTooltip />
      </BarChart>
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const onWindowChange = args.onWindowChange as unknown as WindowMock;
    const strip = await stripOf(canvasElement);
    expect(strip.getAttribute("data-orientation")).toBe("horizontal");
    expect(strip.querySelector('[data-slot="chart-navigator-shadow"]')).not.toBeNull();
    await waitFor(() => expect(firstLabel(canvasElement)).toBe("C000"));

    // Drag the window 120 px to the right: the first visible category follows.
    const [start, end] = handles(strip);
    const track = strip.querySelector('[data-slot="chart-navigator-track"]')!;
    const a = start!.getBoundingClientRect();
    const b = end!.getBoundingClientRect();
    const cx = (a.left + a.width / 2 + b.left + b.width / 2) / 2;
    const cy = a.top + a.height / 2;
    pointer(track, "pointerdown", cx, cy);
    for (const dx of [30, 60, 90, 120]) {
      pointer(track, "pointermove", cx + dx, cy);
      await nextFrame();
    }
    pointer(track, "pointerup", cx + 120, cy);

    await waitFor(() => {
      const commits = onWindowChange.mock.calls.filter(([, m]) => m.phase === "commit");
      expect(commits.length).toBeGreaterThan(0);
    });
    const [committed, commitMeta] = onWindowChange.mock.calls
      .filter(([, m]) => m.phase === "commit")
      .at(-1)!;
    expect(commitMeta.source).toBe("pointer");
    expect(committed.kind).toBe("index");
    expect(committed.start as number).toBeGreaterThan(0);
    await waitFor(() => expect(firstLabel(canvasElement)).toBe(label(committed.start as number)));
  },
};

/**
 * `scrollbar="auto"` with `maxVisibleItems={20}`: the strip appears because
 * 120 > 20, and the plot shows exactly 20 bars. `onDatapointClick` on a
 * visible bar reports the row's index into the FULL `data`.
 */
export const AutoTwentyItems: Story = {
  render: (args) => (
    <div className="w-full max-w-[720px]">
      <BarChart
        animationDuration={0}
        data={ONE_TWENTY}
        defaultWindow={{ kind: "index", start: 40, end: 60 }}
        maxVisibleItems={20}
        onDatapointClick={args.onDatapointClick}
        onWindowChange={args.onWindowChange}
        scrollbar="auto"
        xDataKey="name"
      >
        <Grid horizontal />
        <Bar dataKey="revenue" />
        <BarXAxis />
        <YAxis />
      </BarChart>
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const onDatapointClick = args.onDatapointClick as unknown as DatapointMock;
    await stripOf(canvasElement);
    const targets = await waitFor(() => {
      const found = Array.from(
        canvasElement.querySelectorAll<HTMLElement>('[data-slot="chart-datapoint-layer-target"]'),
      );
      expect(found).toHaveLength(20);
      return found;
    });
    await waitFor(() => expect(firstLabel(canvasElement)).toBe("C040"));
    // The layer's buttons are the keyboard path (the pointer hits the bar itself).
    targets[2]!.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(onDatapointClick.mock.calls.length).toBeGreaterThan(0));
    const point = onDatapointClick.mock.calls.at(-1)![0];
    expect(point.index).toBe(42);
    expect(point.datum).toBe(ONE_TWENTY[42]);
    expect(point.category).toBe("C042");
  },
};

/**
 * Keyboard: Tab to the window's start handle; ArrowRight ×3 moves the start
 * three categories on, Home returns it to the first one. The first category
 * label follows every step, and the live region restates the rows.
 */
export const KeyboardHandles: Story = {
  render: (args) => (
    <div className="w-full max-w-[720px]">
      <BarChart
        animationDuration={0}
        data={ONE_TWENTY}
        maxVisibleItems={24}
        onWindowChange={args.onWindowChange}
        scrollbar="miniChart"
        xDataKey="name"
      >
        <Grid horizontal />
        <Bar dataKey="revenue" />
        <BarXAxis />
        <YAxis />
      </BarChart>
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const onWindowChange = args.onWindowChange as unknown as WindowMock;
    const strip = await stripOf(canvasElement);
    const [start] = handles(strip);
    await waitFor(() => expect(firstLabel(canvasElement)).toBe("C000"));
    for (let i = 0; i < 6 && document.activeElement !== start; i++) {
      await userEvent.tab();
    }
    expect(start).toHaveFocus();
    expect(start!.getAttribute("aria-valuetext")).toBe("Row 1 of 120");

    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    await waitFor(() => expect(valueNow(start!)).toBe(3));
    await waitFor(() => expect(firstLabel(canvasElement)).toBe("C003"));
    expect(onWindowChange.mock.calls.at(-1)![1]).toEqual({ phase: "commit", source: "keyboard" });
    await waitFor(() =>
      expect(strip.querySelector('[data-slot="chart-navigator-status"]')?.textContent).toBe(
        "Showing Row 4 of 120 to Row 24 of 120",
      ),
    );

    await userEvent.keyboard("{Home}");
    await waitFor(() => expect(valueNow(start!)).toBe(0));
    await waitFor(() => expect(firstLabel(canvasElement)).toBe("C000"));
  },
};

/**
 * Horizontal bars, 80 rows: the strip is VERTICAL, on the right edge; its
 * shadow is the bar lengths condensed. Handles announce "Row n of N";
 * ArrowDown moves a handle down.
 */
export const HorizontalRows80: Story = {
  render: (args) => (
    <div className="w-full max-w-[720px]">
      <BarChart
        animationDuration={0}
        data={EIGHTY}
        maxVisibleItems={14}
        onWindowChange={args.onWindowChange}
        orientation="horizontal"
        plotHeight={420}
        scrollbar="miniChart"
        xDataKey="name"
      >
        <Grid vertical />
        <Bar dataKey="sales" />
        <BarYAxis />
      </BarChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const strip = await stripOf(canvasElement);
    expect(strip.getAttribute("data-orientation")).toBe("vertical");
    const [start, end] = handles(strip);
    expect(start!.getAttribute("aria-orientation")).toBe("vertical");
    expect(start!.getAttribute("aria-valuetext")).toBe("Row 1 of 80");
    expect(end!.getAttribute("aria-valuetext")).toBe("Row 14 of 80");
    const first = (pattern = /^Store \d{2}$/) => firstLabel(canvasElement, pattern);
    await waitFor(() => expect(first()).toBe("Store 01"));
    start!.focus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await waitFor(() => expect(start!.getAttribute("aria-valuetext")).toBe("Row 3 of 80"));
    await waitFor(() => expect(first()).toBe("Store 03"));
  },
};

/**
 * Stacked bars scrolled with a stable value axis: the outlier at C084 sets
 * the axis for the whole data, so the first window's short stacks read
 * against the same scale they will have everywhere else.
 */
export const StackedStableAxis: Story = {
  render: (args) => (
    <div className="w-full max-w-[720px]">
      <BarChart
        animationDuration={0}
        data={STACKED}
        maxVisibleItems={18}
        onWindowChange={args.onWindowChange}
        scrollbar="miniChart"
        stacked
        xDataKey="name"
      >
        <Grid horizontal />
        <Bar dataKey="online" fill="var(--chart-1)" />
        <Bar dataKey="retail" fill="var(--chart-2)" />
        <BarXAxis />
        <YAxis />
        <ChartTooltip />
      </BarChart>
    </div>
  ),
};

/**
 * `windowDomain="visible"` refits the value axis to the window (still zero-
 * based — bars are lengths). Scroll to C084 and the axis grows to hold it.
 */
export const VisibleDomainRefit: Story = {
  render: (args) => (
    <div className="w-full max-w-[720px]">
      <BarChart
        animationDuration={0}
        data={STACKED}
        maxVisibleItems={18}
        onWindowChange={args.onWindowChange}
        scrollbar="miniChart"
        stacked
        windowDomain="visible"
        xDataKey="name"
      >
        <Grid horizontal />
        <Bar dataKey="online" fill="var(--chart-1)" />
        <Bar dataKey="retail" fill="var(--chart-2)" />
        <BarXAxis />
        <YAxis />
      </BarChart>
    </div>
  ),
};

/** A composed chart in category mode (`xScale="band"`): bars and a line scroll together. */
export const ComposedCategory: Story = {
  render: (args) => (
    <div className="w-full max-w-[720px]">
      <ComposedChart
        animationDuration={0}
        data={COMPOSED}
        maxVisibleItems={16}
        onWindowChange={args.onWindowChange}
        scrollbar="miniChart"
        xDataKey="name"
        xScale="band"
      >
        <Grid horizontal />
        <SeriesBar dataKey="orders" fill="var(--chart-1)" />
        <Line animate={false} dataKey="target" stroke="var(--chart-2)" />
        <XAxis />
        <YAxis />
        <ChartTooltip />
      </ComposedChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const strip = await stripOf(canvasElement);
    const [start, end] = handles(strip);
    expect(start!.getAttribute("aria-valuetext")).toBe("Row 1 of 72");
    expect(end!.getAttribute("aria-valuetext")).toBe("Row 16 of 72");
  },
};

/**
 * A heatmap with 365 day-columns scrolls by COLUMN: the ramp stays the full
 * year's (`windowDomain="all"`), so a shade means the same count everywhere.
 */
export const Heatmap365Days: Story = {
  render: (args) => (
    <div className="w-full max-w-[720px]">
      <HeatmapChart
        data={HEAT}
        maxVisibleItems={28}
        onWindowChange={args.onWindowChange}
        scrollbar="miniChart"
        valueKey="tickets"
        x="day"
        y="region"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const strip = await stripOf(canvasElement);
    const [, end] = handles(strip);
    expect(end!.getAttribute("aria-valuetext")).toBe("Row 28 of 365");
    await waitFor(() =>
      expect(canvasElement.querySelectorAll('[data-slot="heatmap-cell"]')).toHaveLength(28 * 4),
    );
  },
};

/** `scrollbar="bar"`: a plain scrollbar strip — the window only, no shadow. */
export const PlainBar: Story = {
  render: (args) => (
    <div className="w-full max-w-[720px]">
      <BarChart
        animationDuration={0}
        data={ONE_TWENTY}
        maxVisibleItems={30}
        onWindowChange={args.onWindowChange}
        scrollbar="bar"
        xDataKey="name"
      >
        <Grid horizontal />
        <Bar dataKey="revenue" />
        <BarXAxis />
        <YAxis />
      </BarChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const strip = await stripOf(canvasElement);
    expect(strip.getAttribute("data-scrollbar")).toBe("bar");
    expect(strip.querySelector('[data-slot="chart-navigator-shadow"]')).toBeNull();
  },
};

/** `align="end"`: the first window sits on the LATEST categories. */
export const AlignEnd: Story = {
  render: (args) => (
    <div className="w-full max-w-[720px]">
      <BarChart
        align="end"
        animationDuration={0}
        data={ONE_TWENTY}
        maxVisibleItems={20}
        onWindowChange={args.onWindowChange}
        scrollbar="miniChart"
        xDataKey="name"
      >
        <Grid horizontal />
        <Bar dataKey="revenue" />
        <BarXAxis />
        <YAxis />
      </BarChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const strip = await stripOf(canvasElement);
    const [start, end] = handles(strip);
    expect(start!.getAttribute("aria-valuetext")).toBe("Row 101 of 120");
    expect(end!.getAttribute("aria-valuetext")).toBe("Row 120 of 120");
    await waitFor(() => expect(firstLabel(canvasElement)).toBe("C100"));
  },
};

/**
 * The narrow tier (< 480 px): the strip is 32 px thick and `maxVisibleItems`
 * takes a per-tier value — 20 wide, 8 narrow.
 */
export const NarrowTier: Story = {
  render: (args) => (
    <div className="w-full max-w-[380px]">
      <BarChart
        animationDuration={0}
        data={ONE_TWENTY}
        maxVisibleItems={{ base: 20, narrow: 8 }}
        onWindowChange={args.onWindowChange}
        scrollbar="miniChart"
        xDataKey="name"
      >
        <Grid horizontal />
        <Bar dataKey="revenue" />
        <BarXAxis />
        <YAxis />
      </BarChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const strip = await stripOf(canvasElement);
    expect(strip.closest("[data-chart-breakpoint]")?.getAttribute("data-chart-breakpoint")).toBe(
      "narrow",
    );
    expect(Math.round(strip.getBoundingClientRect().height)).toBe(32);
    const [, end] = handles(strip);
    expect(end!.getAttribute("aria-valuetext")).toBe("Row 8 of 120");
  },
};
