import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Bar } from "../bar";
import { BarChart } from "../bar-chart";
import { BarXAxis } from "../bar-x-axis";
import { BarValueAxis } from "../bar-value-axis";
import { DistributionChart } from "../distribution/distribution-chart";
import { Grid } from "../grid";
import { HeatmapChart } from "../heatmap/heatmap-chart";
import { Line } from "../line";
import { LineChart } from "../line-chart";
import { Scatter } from "../scatter";
import { ScatterChart } from "../scatter-chart";
import { XAxis } from "../x-axis";
import { YAxis } from "../y-axis";
import type {
  ChartSelectionIntent,
  ChartSelectionIntentHandler,
  ChartSelectionValue,
} from "./types";

/**
 * **Axis range selection** (RM-143, ADR 0040 §3–5). With `"range"` in
 * `selectionGestures`, press in an axis's tick-label zone and drag along it:
 *
 * - a **dimension** axis (categories, time) selects the categories / rows in
 *   the band — on a time axis every row in range, visible or not;
 * - a **measure** axis selects the DIMENSION values whose measure (of the first
 *   series — `gesture.of`) lies in the band — never "rows between two numbers";
 * - the band stays painted with a **range bubble** at each end: click one on a
 *   measure or time axis to type an exact bound (Enter applies, Esc reverts);
 * - stacked bars arm the dimension axis only.
 *
 * Keyboard: Tab to **"Select a range on the X axis"**, Enter paints the middle
 * third and focuses two `role="slider"` thumbs — arrows ±1 step, Shift ×10,
 * Home / End, PageUp / PageDown ±10 %, Enter selects, Esc cancels.
 *
 * Every story logs `onSelectionIntent` to the Actions panel and asserts the
 * intent against its fixture.
 */
const meta = {
  title: "Charts/Selection/Axis range",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { onSelectionIntent: fn() },
} satisfies Meta<{ onSelectionIntent: ChartSelectionIntentHandler }>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Fixtures — deterministic, no Math.random.
// ---------------------------------------------------------------------------

const MONTHS = Array.from({ length: 24 }, (_, i) => ({
  month: new Date(2023, i, 1),
  revenue: Math.round(120 + 40 * Math.sin(i / 3) + i * 3),
}));

/** Two regions share 118 — a measure range takes BOTH (the orchestrator's check). */
const REGIONS = [
  { region: "North", revenue: 42 },
  { region: "East", revenue: 118 },
  { region: "South", revenue: 67 },
  { region: "West", revenue: 118 },
  { region: "Central", revenue: 96 },
  { region: "Coast", revenue: 154 },
  { region: "Valley", revenue: 31 },
  { region: "Harbor", revenue: 173 },
];

const STACKED = REGIONS.map((row, i) => ({
  region: row.region,
  online: Math.round(row.revenue * 0.6),
  retail: Math.round(row.revenue * 0.4) + (i % 3) * 5,
}));

const DAILY = Array.from({ length: 60 }, (_, i) => ({
  day: new Date(2024, 2, 1 + i),
  sessions: 300 + ((i * 97) % 240),
}));

const WAIT_TIMES = Array.from({ length: 48 }, (_, i) => ({
  patient: `P${String(i + 1).padStart(2, "0")}`,
  ward: ["Cardiology", "Oncology", "Surgery"][i % 3] as string,
  minutes: 12 + ((i * 37) % 90) + (i % 3) * 8,
}));

const HOURS = ["08", "09", "10", "11", "12", "13", "14", "15", "16", "17"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const TICKETS = DAYS.flatMap((day, d) =>
  HOURS.map((hour, h) => ({ day, hour, tickets: 5 + ((d * 7 + h * 11) % 23) })),
);

// ---------------------------------------------------------------------------
// Helpers — real PointerEvents on the gutter (Chromium).
// ---------------------------------------------------------------------------

type IntentFn = ReturnType<typeof fn>;
const lastIntent = (mock: unknown) =>
  (mock as IntentFn).mock.calls.at(-1)?.[0] as ChartSelectionIntent | undefined;

const asNumber = (value: ChartSelectionValue) =>
  value instanceof Date ? value.getTime() : Number(value);

function frame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function fire(
  target: Element,
  type: "pointerdown" | "pointermove" | "pointerup",
  x: number,
  y: number,
  init: PointerEventInit = {},
) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      ...init,
    }),
  );
}

async function gutterOf(root: HTMLElement, axis: "x" | "y"): Promise<Element> {
  const selector = `[data-slot="chart-selection-gesture-gutter-${axis}"]`;
  await waitFor(() => expect(root.querySelector(selector)).not.toBeNull());
  // Let a debounced `ParentSize` settle: a chart re-measures ~100 ms after
  // mount, and a drag no human could start that fast would straddle it.
  await new Promise((resolve) => setTimeout(resolve, 150));
  return root.querySelector(selector) as Element;
}

/** Drags along an axis gutter between two fractions of its length. */
async function dragGutter(root: HTMLElement, axis: "x" | "y", from: number, to: number) {
  const gutter = await gutterOf(root, axis);
  const box = gutter.getBoundingClientRect();
  const at = (f: number) =>
    axis === "x"
      ? ([box.left + box.width * f, box.top + box.height / 2] as const)
      : ([box.left + box.width / 2, box.top + box.height * f] as const);
  const [x0, y0] = at(from);
  const [x1, y1] = at(to);
  fire(gutter, "pointerdown", x0, y0);
  for (let step = 1; step <= 4; step++) {
    fire(gutter, "pointermove", x0 + ((x1 - x0) * step) / 4, y0 + ((y1 - y0) * step) / 4);
    await frame();
  }
  fire(gutter, "pointerup", x1, y1);
}

/** The fixture rows whose `key` lies in the intent's own `[from, to]`. */
function inRange<T extends Record<string, unknown>>(
  rows: readonly T[],
  key: keyof T,
  intent: ChartSelectionIntent | undefined,
): T[] {
  if (intent?.gesture.kind !== "range") return [];
  const lo = asNumber(intent.gesture.from);
  const hi = asNumber(intent.gesture.to);
  return rows.filter((row) => {
    const v = asNumber(row[key] as ChartSelectionValue);
    return v >= lo && v <= hi;
  });
}

function IntentReadout({ intent }: { intent: ChartSelectionIntent | null }) {
  const text = intent
    ? `${intent.gesture.kind} · ${intent.field}: ${intent.values
        .map((v) => (v instanceof Date ? v.toLocaleDateString("en-US") : String(v)))
        .join(", ")}`
    : "Drag along an axis label zone, or Tab to “Select a range…”.";
  return (
    <output className="text-meta text-muted-foreground" data-testid="readout">
      {text}
    </output>
  );
}

function useLogged(handler: ChartSelectionIntentHandler) {
  const [last, setLast] = useState<ChartSelectionIntent | null>(null);
  const log: ChartSelectionIntentHandler = (intent) => {
    setLast(intent);
    handler(intent);
  };
  return [last, log] as const;
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

function MonthlyLine({ onSelectionIntent }: { onSelectionIntent: ChartSelectionIntentHandler }) {
  const [last, log] = useLogged(onSelectionIntent);
  return (
    <div className="flex w-full max-w-[720px] flex-col gap-3" data-testid="chart">
      <LineChart
        animationDuration={0}
        data={MONTHS}
        onSelectionIntent={log}
        selectionGestures={["range"]}
        xDataKey="month"
      >
        <Grid horizontal />
        <Line dataKey="revenue" />
        <XAxis />
        <YAxis />
      </LineChart>
      <IntentReadout intent={last} />
    </div>
  );
}

/** An x range on a monthly line chart: the months in the band; the bubbles show dates. */
export const MonthlyLineXRange: Story = {
  render: (args) => <MonthlyLine {...args} />,
  play: async ({ args, canvasElement }) => {
    const root = within(canvasElement).getByTestId("chart");
    await dragGutter(root, "x", 0.25, 0.55);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    const intent = lastIntent(args.onSelectionIntent);
    await expect(intent?.field).toBe("month");
    await expect(intent?.gesture).toMatchObject({ kind: "range", axis: "x" });
    const expected = inRange(MONTHS, "month", intent).map((row) => row.month.getTime());
    await expect(expected.length).toBeGreaterThan(3);
    await expect(intent?.values.map((v) => asNumber(v))).toEqual(expected);
    // The band stays, with a date bubble at each end.
    await waitFor(() =>
      expect(root.querySelector('[data-slot="chart-selection-range-band"]')).not.toBeNull(),
    );
    const bubbles = root.querySelectorAll('[data-slot="chart-selection-range-bubble"]');
    await expect(bubbles).toHaveLength(2);
    for (const bubble of bubbles) await expect(bubble.textContent).toMatch(/20(23|24)/);
  },
};

function RegionBars({
  onSelectionIntent,
  confirm,
}: {
  onSelectionIntent: ChartSelectionIntentHandler;
  confirm?: "explicit";
}) {
  const [last, log] = useLogged(onSelectionIntent);
  return (
    <div className="flex w-full max-w-[640px] flex-col gap-3" data-testid="chart">
      <BarChart
        animationDuration={0}
        data={REGIONS}
        onSelectionIntent={log}
        selectionConfirm={confirm}
        selectionGestures={["range"]}
        xDataKey="region"
      >
        <Grid horizontal />
        <Bar dataKey="revenue" />
        <BarXAxis />
        <BarValueAxis />
      </BarChart>
      <IntentReadout intent={last} />
    </div>
  );
}

/**
 * A MEASURE range on a bar chart resolves to the regions whose revenue is in
 * the band — East and West share 118, so a band over 118 takes both.
 */
export const BarMeasureYRange: Story = {
  render: (args) => <RegionBars {...args} />,
  play: async ({ args, canvasElement }) => {
    const root = within(canvasElement).getByTestId("chart");
    await dragGutter(root, "y", 0.65, 0.3);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    const intent = lastIntent(args.onSelectionIntent);
    await expect(intent?.field).toBe("region");
    await expect(intent?.gesture).toMatchObject({ kind: "range", axis: "y", of: "revenue" });
    const expected = inRange(REGIONS, "revenue", intent).map((row) => row.region);
    await expect(expected).toEqual(expect.arrayContaining(["East", "West"]));
    await expect(intent?.values).toEqual(expected);
  },
};

/** Stacked bars: the measure gutter is NOT armed; the category gutter is. */
export const StackedBarDimensionOnly: Story = {
  render: ({ onSelectionIntent }) => (
    <div className="w-full max-w-[640px]" data-testid="chart">
      <BarChart
        animationDuration={0}
        data={STACKED}
        onSelectionIntent={onSelectionIntent}
        selectionGestures={["range"]}
        stacked
        xDataKey="region"
      >
        <Grid horizontal />
        <Bar dataKey="online" />
        <Bar dataKey="retail" />
        <BarXAxis />
        <BarValueAxis />
      </BarChart>
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByTestId("chart");
    await gutterOf(root, "x");
    await expect(root.querySelector('[data-slot="chart-selection-gesture-gutter-y"]')).toBeNull();
    await expect(canvas.queryByRole("button", { name: "Select a range on the Y axis" })).toBeNull();
    await expect(canvas.getByRole("button", { name: "Select a range on the X axis" })).toBeTruthy();
    await dragGutter(root, "x", 0.02, 0.48);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    await expect(lastIntent(args.onSelectionIntent)?.values).toEqual([
      "North",
      "East",
      "South",
      "West",
    ]);
  },
};

/** Both axes on a scatter: a time range, then a measure range. */
export const ScatterBothAxes: Story = {
  render: ({ onSelectionIntent }) => (
    <div className="w-full max-w-[640px]" data-testid="chart">
      <ScatterChart
        animationDuration={0}
        data={DAILY}
        onSelectionIntent={onSelectionIntent}
        selectionGestures={["range"]}
        xDataKey="day"
      >
        <Grid horizontal />
        <Scatter dataKey="sessions" />
        <XAxis />
        <YAxis />
      </ScatterChart>
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const root = within(canvasElement).getByTestId("chart");
    await dragGutter(root, "x", 0.1, 0.4);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    let intent = lastIntent(args.onSelectionIntent);
    await expect(intent?.gesture).toMatchObject({ kind: "range", axis: "x" });
    await expect(intent?.values.map(asNumber)).toEqual(
      inRange(DAILY, "day", intent).map((row) => row.day.getTime()),
    );

    await dragGutter(root, "y", 0.7, 0.2);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(2));
    intent = lastIntent(args.onSelectionIntent);
    await expect(intent?.gesture).toMatchObject({ kind: "range", axis: "y", of: "sessions" });
    const expected = inRange(DAILY, "sessions", intent).map((row) => row.day.getTime());
    await expect(expected.length).toBeGreaterThan(0);
    await expect(intent?.values.map(asNumber)).toEqual(expected);
  },
};

/** A value range on a distribution: every record whose minutes fall in the band, by patient. */
export const DistributionValueRange: Story = {
  render: ({ onSelectionIntent }) => (
    <div className="h-72 w-full max-w-[640px]" data-testid="chart">
      <DistributionChart
        data={WAIT_TIMES}
        groupKey="ward"
        kind="strip"
        onSelectionIntent={onSelectionIntent}
        selectionField="patient"
        selectionGestures={["range"]}
        valueKey="minutes"
      />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const root = within(canvasElement).getByTestId("chart");
    await dragGutter(root, "x", 0.2, 0.6);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    const intent = lastIntent(args.onSelectionIntent);
    await expect(intent?.field).toBe("patient");
    const expected = inRange(WAIT_TIMES, "minutes", intent).map((row) => row.patient);
    await expect(expected.length).toBeGreaterThan(3);
    await expect(intent?.values).toEqual(expected);
  },
};

/** A heatmap column range reports hours; a row range reports days. */
export const HeatmapColumnRange: Story = {
  render: ({ onSelectionIntent }) => (
    <div className="w-full max-w-[640px]" data-testid="chart">
      <HeatmapChart
        data={TICKETS}
        onSelectionIntent={onSelectionIntent}
        selectionGestures={["range"]}
        valueKey="tickets"
        x="hour"
        y="day"
      />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const root = within(canvasElement).getByTestId("chart");
    await dragGutter(root, "x", 0.25, 0.55);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    let intent = lastIntent(args.onSelectionIntent);
    await expect(intent?.field).toBe("hour");
    if (intent?.gesture.kind !== "range") throw new Error("expected a range");
    const first = HOURS.indexOf(String(intent.gesture.from));
    const last = HOURS.indexOf(String(intent.gesture.to));
    await expect(first).toBeGreaterThan(0);
    await expect(intent.values).toEqual(HOURS.slice(first, last + 1));
    // Every cell of those columns — one per day.
    await expect(intent.datapoints).toHaveLength((last - first + 1) * DAYS.length);

    await dragGutter(root, "y", 0.05, 0.45);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(2));
    intent = lastIntent(args.onSelectionIntent);
    await expect(intent?.field).toBe("day");
    await expect(intent?.values[0]).toBe("Mon");
  },
};

/** Click the upper bubble, type 150, Enter: the band moves and the intent follows. */
export const EditableBubble: Story = {
  render: (args) => <RegionBars {...args} />,
  play: async ({ args, canvasElement }) => {
    const root = within(canvasElement).getByTestId("chart");
    await dragGutter(root, "y", 0.9, 0.6);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    const band = () =>
      root.querySelector('[data-slot="chart-selection-range-band"] rect')?.getAttribute("y");
    const before = band();
    const hi = await waitFor(() => {
      const el = root.querySelector<HTMLElement>(
        '[data-slot="chart-selection-range-bubble"][data-edge="hi"]',
      );
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    await userEvent.click(hi);
    const input = await waitFor(() => {
      const el = root.querySelector<HTMLInputElement>(
        '[data-slot="chart-selection-range-bubble-input"]',
      );
      expect(el).not.toBeNull();
      return el as HTMLInputElement;
    });
    await expect(input).toHaveAttribute("type", "number");
    await userEvent.clear(input);
    await userEvent.type(input, "150{Enter}");
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(2));
    const intent = lastIntent(args.onSelectionIntent);
    await expect(intent?.gesture).toMatchObject({ kind: "range", axis: "y", to: 150 });
    await expect(intent?.values).toEqual(
      inRange(REGIONS, "revenue", intent).map((row) => row.region),
    );
    // 150 takes the three regions between 96 and 118, still not Coast (154).
    await expect(intent?.values).toEqual(expect.arrayContaining(["East", "West", "Central"]));
    await expect(intent?.values).not.toContain("Coast");
    await waitFor(() => expect(band()).not.toBe(before));
    await expect(
      root.querySelector('[data-slot="chart-selection-range-bubble"][data-edge="hi"]')?.textContent,
    ).toBe("150");
  },
};

/**
 * Keyboard, end to end: the X thumbs walk categories, the Y thumbs walk ticks;
 * `aria-valuetext` is in data terms throughout.
 */
export const KeyboardThumbs: Story = {
  render: (args) => <RegionBars {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole("button", { name: "Select a range on the X axis" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const start = await canvas.findByRole("slider", { name: "Range start, region" });
    await waitFor(() => expect(start).toHaveFocus());
    await expect(start).toHaveAttribute("aria-valuetext", "South");
    const end = canvas.getByRole("slider", { name: "Range end, region" });
    await expect(end).toHaveAttribute("aria-valuetext", "Coast");
    await userEvent.keyboard("{ArrowRight}");
    await expect(start).toHaveAttribute("aria-valuetext", "West");
    await userEvent.tab();
    await expect(end).toHaveFocus();
    await userEvent.keyboard("{End}");
    await expect(end).toHaveAttribute("aria-valuetext", "Harbor");
    // Nothing is emitted until Enter.
    await expect(args.onSelectionIntent).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    let intent = lastIntent(args.onSelectionIntent);
    await expect(intent?.source).toBe("keyboard");
    await expect(intent?.values).toEqual(["West", "Central", "Coast", "Valley", "Harbor"]);
    await expect(intent?.gesture).toMatchObject({
      kind: "range",
      axis: "x",
      from: "West",
      to: "Harbor",
    });
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Select a range on the X axis" })).toHaveFocus(),
    );
    await expect(
      canvasElement.querySelector('[data-slot="chart-selection-gesture-status"]')?.textContent,
    ).toBe("5 values selected, West to Harbor");

    // The measure axis: numeric value text, tick steps, Home to the axis floor.
    canvas.getByRole("button", { name: "Select a range on the Y axis" }).focus();
    await userEvent.keyboard("{Enter}");
    const low = await canvas.findByRole("slider", { name: "Range start, revenue" });
    await waitFor(() => expect(low).toHaveFocus());
    await userEvent.keyboard("{Home}");
    await expect(low).toHaveAttribute("aria-valuetext", "0");
    await userEvent.keyboard("{ArrowUp}");
    const stepped = Number(low.getAttribute("aria-valuenow"));
    await expect(stepped).toBeGreaterThan(0);
    await expect(low).toHaveAttribute("aria-valuetext", String(stepped));
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(2));
    intent = lastIntent(args.onSelectionIntent);
    await expect(intent?.gesture).toMatchObject({ kind: "range", axis: "y", from: stepped });
    await expect(intent?.values).toEqual(
      inRange(REGIONS, "revenue", intent).map((row) => row.region),
    );

    // Esc cancels without emitting.
    canvas.getByRole("button", { name: "Select a range on the X axis" }).focus();
    await userEvent.keyboard("{Enter}");
    await canvas.findByRole("slider", { name: "Range start, region" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(canvas.queryByRole("slider")).toBeNull());
    await expect(args.onSelectionIntent).toHaveBeenCalledTimes(2);
  },
};

/**
 * `selectionConfirm="explicit"`: the band is provisional until Enter (the ✓ of
 * the toolbar, RM-145); Esc drops it without an intent.
 */
export const ExplicitConfirm: Story = {
  render: (args) => <RegionBars {...args} confirm="explicit" />,
  play: async ({ args, canvasElement }) => {
    const root = within(canvasElement).getByTestId("chart");
    await dragGutter(root, "y", 0.65, 0.3);
    await waitFor(() =>
      expect(root.querySelector('[data-slot="chart-selection-range-band"]')).not.toBeNull(),
    );
    await expect(args.onSelectionIntent).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    await expect(lastIntent(args.onSelectionIntent)?.mode).toBe("replace");

    await dragGutter(root, "y", 0.9, 0.5);
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(root.querySelector('[data-slot="chart-selection-range-band"]')).toBeNull(),
    );
    await expect(args.onSelectionIntent).toHaveBeenCalledTimes(1);
  },
};
