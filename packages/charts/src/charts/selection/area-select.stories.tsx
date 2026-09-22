import type { Meta, StoryObj } from "@storybook/react-vite";
import { polygonContains } from "d3-polygon";
import { scaleLinear, scaleTime } from "d3-scale";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Bar } from "../bar";
import { BarChart } from "../bar-chart";
import { BarValueAxis } from "../bar-value-axis";
import { BarXAxis } from "../bar-x-axis";
import { CanvasLayer } from "../canvas-layer/canvas-layer";
import { createSpatialGrid } from "../canvas-layer/hit-test";
import { canvasTokenColor } from "../canvas-layer/use-canvas-draw";
import { Grid } from "../grid";
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
 * **Area & lasso selection** (RM-144, ADR 0040 §3–5).
 *
 * - **Rectangle** — plain drag when the engine mode is `rect` (the first
 *   gesture listed), or **Shift+drag** in pointer mode on any chart listing
 *   `"rect"`.
 * - **Lasso** — drag in `lasso` mode, or **Shift+Alt+drag** anywhere; the path
 *   is simplified (1.5 px) and snaps closed within 12 px of its start. On touch
 *   a 400 ms long-press arms it.
 * - **Radial** — a lasso preset: press at the centre, release at the radius.
 * - Hit rule `selectionHitRule`: `overlap` (default — any part of a bar inside)
 *   or `contain`; points are hit by their centre. **Visible marks only**: a
 *   point outside a navigator window is never selected.
 * - **Keyboard rectangle** — the keyboard equivalent of all three: Tab to
 *   “Select an area with the keyboard”, press **S** for a crosshair, arrows move
 *   it (Shift ×10), **hold Space** and use the arrows to draw, **release Space**
 *   to select (Shift add, Ctrl toggle), Esc cancels; the live region announces
 *   “12 points selected”.
 *
 * The canvas layer registers its points in the same geometry registry, so a
 * rectangle over 2 000 canvas points resolves exactly as it does over SVG.
 */
const meta = {
  title: "Charts/Selection/Area & lasso",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { onSelectionIntent: fn() },
} satisfies Meta<{ onSelectionIntent: ChartSelectionIntentHandler }>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Fixtures — a seeded LCG: the picture and every assertion are stable.
// ---------------------------------------------------------------------------

function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

interface Reading extends Record<string, unknown> {
  id: number;
  at: Date;
  latency: number;
}

const START = new Date(2024, 0, 1).getTime();
const DAY = 86_400_000;

/** 2 000 readings over a year: a slow drift plus noise. */
const READINGS: Reading[] = (() => {
  const next = lcg(7);
  return Array.from({ length: 2000 }, (_, id) => {
    const t = next();
    const at = new Date(START + Math.floor(t * 365) * DAY + Math.floor(next() * 24) * 3_600_000);
    const latency = Math.round(80 + 120 * t + 90 * (next() - 0.5) + 40 * Math.sin(t * 12));
    return { id, at, latency };
  }).sort((a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id);
})();

const MONTHS = Array.from({ length: 24 }, (_, i) => ({
  month: new Date(2023, i, 1),
  revenue: Math.round(120 + 40 * Math.sin(i / 3) + i * 3),
  cost: Math.round(80 + 25 * Math.cos(i / 4) + i * 2),
}));

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

const DAILY = Array.from({ length: 60 }, (_, i) => ({
  day: new Date(2024, 2, 1 + i),
  sessions: 300 + ((i * 97) % 240),
}));

// ---------------------------------------------------------------------------
// Helpers
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

/** The plot `<g>` the engine binds to, and the box of its background rect. */
async function plotOf(root: HTMLElement): Promise<{ plot: Element; box: DOMRect }> {
  let plot: Element | null = null;
  await waitFor(() => {
    const layer = root.querySelector('[data-slot="chart-selection-gesture"]');
    plot = layer?.parentElement ?? null;
    expect(plot).not.toBeNull();
  });
  // Let a debounced `ParentSize` settle: a chart re-measures ~100 ms after
  // mount, and a drag no human could start that fast would straddle it.
  await new Promise((resolve) => setTimeout(resolve, 150));
  const el = (root.querySelector('[data-slot="chart-selection-gesture"]')?.parentElement ??
    plot) as unknown as Element;
  return { plot: el, box: (el.firstElementChild ?? el).getBoundingClientRect() };
}

/** Drags through fractions of `box`, dispatching on `target`. */
async function drawPath(
  target: Element,
  box: DOMRect,
  points: ReadonlyArray<readonly [number, number]>,
  init: PointerEventInit = {},
  hold = 0,
) {
  const at = ([fx, fy]: readonly [number, number]) =>
    [box.left + box.width * fx, box.top + box.height * fy] as const;
  const [first, ...rest] = points.map(at);
  if (!first) return;
  fire(target, "pointerdown", first[0], first[1], init);
  if (hold > 0) await new Promise((resolve) => setTimeout(resolve, hold));
  for (const [x, y] of rest) {
    fire(target, "pointermove", x, y, init);
    await frame();
  }
  const end = rest.at(-1) ?? first;
  fire(target, "pointerup", end[0], end[1], init);
}

async function drag(
  target: Element,
  box: DOMRect,
  a: readonly [number, number],
  b: readonly [number, number],
  init: PointerEventInit = {},
) {
  const steps = [1, 2, 3, 4].map(
    (s) => [a[0] + ((b[0] - a[0]) * s) / 4, a[1] + ((b[1] - a[1]) * s) / 4] as const,
  );
  await drawPath(target, box, [a, ...steps], init);
}

/** Readings inside a rect intent's data-unit geometry. */
function inRect(intent: ChartSelectionIntent | undefined): Reading[] {
  if (intent?.gesture.kind !== "rect") return [];
  const [x0, x1] = intent.gesture.x.map(asNumber).sort((a, b) => a - b) as [number, number];
  const [y0, y1] = intent.gesture.y;
  // The rect's own edges went through a pixel round trip: allow float slack.
  const eps = 1e-6;
  return READINGS.filter((r) => {
    const t = r.at.getTime();
    return t >= x0 - 1 && t <= x1 + 1 && r.latency >= y0 - eps && r.latency <= y1 + eps;
  });
}

/** Readings inside a lasso intent's data-unit polygon (the axes are affine, so containment carries over). */
function inLasso(intent: ChartSelectionIntent | undefined): Reading[] {
  if (intent?.gesture.kind !== "lasso") return [];
  const polygon = intent.gesture.path.map((p) => [asNumber(p.x), p.y] as [number, number]);
  return READINGS.filter((r) => polygonContains(polygon, [r.at.getTime(), r.latency]));
}

function distinctDates(rows: readonly Reading[]): number[] {
  return [...new Set(rows.map((r) => r.at.getTime()))];
}

const LASSO_PATH: ReadonlyArray<readonly [number, number]> = [
  [0.3, 0.15],
  [0.7, 0.2],
  [0.8, 0.55],
  [0.55, 0.85],
  [0.25, 0.7],
  [0.2, 0.4],
  [0.3, 0.16],
];

function ReadingsScatter({
  onSelectionIntent,
  gestures,
}: {
  onSelectionIntent: ChartSelectionIntentHandler;
  gestures: readonly ("rect" | "lasso" | "radial")[];
}) {
  return (
    <div className="w-full max-w-[720px]" data-testid="chart">
      <ScatterChart
        animationDuration={0}
        data={READINGS}
        onSelectionIntent={onSelectionIntent}
        selectionGestures={gestures}
        xDataKey="at"
      >
        <Grid horizontal />
        <Scatter dataKey="latency" />
        <XAxis />
        <YAxis />
      </ScatterChart>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG scatter
// ---------------------------------------------------------------------------

/** A rectangle over 2 000 SVG points: every reading inside the data-unit rect, and only those. */
export const ScatterRectangle: Story = {
  render: (args) => <ReadingsScatter {...args} gestures={["rect", "lasso", "radial"]} />,
  play: async ({ args, canvasElement }) => {
    const { plot, box } = await plotOf(within(canvasElement).getByTestId("chart"));
    await drag(plot, box, [0.2, 0.2], [0.6, 0.7]);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    const intent = lastIntent(args.onSelectionIntent);
    await expect(intent?.gesture.kind).toBe("rect");
    await expect(intent?.mode).toBe("replace");
    const expected = inRect(intent);
    await expect(expected.length).toBeGreaterThan(50);
    await expect(intent?.datapoints).toHaveLength(expected.length);
    await expect(intent?.values.map(asNumber)).toEqual(distinctDates(expected));
  },
};

/** A freehand lasso over the same 2 000 points: containment in data units matches. */
export const ScatterLasso: Story = {
  render: (args) => <ReadingsScatter {...args} gestures={["lasso", "rect"]} />,
  play: async ({ args, canvasElement }) => {
    const { plot, box } = await plotOf(within(canvasElement).getByTestId("chart"));
    await drawPath(plot, box, LASSO_PATH);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    const intent = lastIntent(args.onSelectionIntent);
    await expect(intent?.gesture.kind).toBe("lasso");
    const expected = inLasso(intent);
    await expect(expected.length).toBeGreaterThan(50);
    await expect(intent?.datapoints).toHaveLength(expected.length);
    await expect(intent?.values.map(asNumber)).toEqual(distinctDates(expected));
  },
};

/** Radial: press at the centre, release at the radius — a circle, resolved as a 24-gon. */
export const ScatterRadial: Story = {
  render: (args) => <ReadingsScatter {...args} gestures={["radial"]} />,
  play: async ({ args, canvasElement }) => {
    const { plot, box } = await plotOf(within(canvasElement).getByTestId("chart"));
    await drag(plot, box, [0.5, 0.5], [0.62, 0.5]);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    const intent = lastIntent(args.onSelectionIntent);
    if (intent?.gesture.kind !== "radial") throw new Error("expected a radial gesture");
    const { center, rx, ry } = intent.gesture;
    const cx = asNumber(center.x);
    const reach = (r: Reading) =>
      ((r.at.getTime() - cx) / rx) ** 2 + ((r.latency - center.y) / ry) ** 2;
    // The 24-gon lies between its inscribed and circumscribed circles.
    const inner = READINGS.filter((r) => reach(r) <= Math.cos(Math.PI / 24) ** 2).length;
    const outer = READINGS.filter((r) => reach(r) <= 1).length;
    const hits = intent.datapoints.length;
    await expect(hits).toBeGreaterThanOrEqual(inner);
    await expect(hits).toBeLessThanOrEqual(outer);
    await expect(hits).toBeGreaterThan(10);
  },
};

// ---------------------------------------------------------------------------
// Canvas scatter — the same points, painted on a canvas
// ---------------------------------------------------------------------------

const CANVAS_PAD = 12;

function CanvasReadings({ onSelectionIntent }: { onSelectionIntent: ChartSelectionIntentHandler }) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const { x, y } = useMemo(() => {
    const times = READINGS.map((r) => r.at.getTime());
    const values = READINGS.map((r) => r.latency);
    return {
      x: scaleTime()
        .domain([new Date(Math.min(...times)), new Date(Math.max(...times))])
        .range([CANVAS_PAD, Math.max(CANVAS_PAD, size.width - CANVAS_PAD)]),
      y: scaleLinear()
        .domain([Math.min(...values), Math.max(...values)])
        .range([Math.max(CANVAS_PAD, size.height - CANVAS_PAD), CANVAS_PAD]),
    };
  }, [size.height, size.width]);
  const grid = useMemo(() => {
    const g = createSpatialGrid<Reading>(8);
    for (const r of READINGS) g.insert(x(r.at), y(r.latency), r);
    return g;
  }, [x, y]);
  const selectionMark = useMemo(
    () => (r: Reading) => ({
      x: x(r.at),
      y: y(r.latency),
      category: r.at,
      value: r.latency,
      seriesKey: "latency",
    }),
    [x, y],
  );
  return (
    <div className="h-72 w-full max-w-[720px]" data-testid="chart" ref={boxRef}>
      {size.width > 0 ? (
        <CanvasLayer
          accessibleDescription="2,000 latency readings across 2024, drifting upward."
          accessibleLabel="Latency readings"
          draw={(ctx) => {
            ctx.fillStyle = canvasTokenColor("--chart-mono-7", ctx.canvas, "transparent");
            for (const r of READINGS) ctx.fillRect(x(r.at) - 1, y(r.latency) - 1, 2, 2);
          }}
          drawSignature={`${size.width}x${size.height}`}
          height={size.height}
          hitTest={(px, py) => grid.query(px, py, 8)}
          onSelectionIntent={onSelectionIntent}
          points={READINGS}
          selectionAxes={{ x: { kind: "time", scale: x }, y: { kind: "linear", scale: y } }}
          selectionField="at"
          selectionGestures={["rect", "lasso"]}
          selectionMark={selectionMark}
          width={size.width}
        />
      ) : null}
    </div>
  );
}

/**
 * The canvas layer: a plain drag draws the rectangle, Shift+Alt+drag the lasso;
 * both intents hold exactly the readings inside their data-unit geometry — the
 * same contract as the SVG scatter above.
 */
export const CanvasRectangleAndLasso: Story = {
  render: (args) => <CanvasReadings {...args} />,
  play: async ({ args, canvasElement }) => {
    const root = within(canvasElement).getByTestId("chart");
    const surface = await waitFor(() => {
      const el = root.querySelector('[data-slot="canvas-layer"]');
      expect(el?.querySelector('[data-slot="chart-selection-gesture"]')).toBeTruthy();
      return el as HTMLElement;
    });
    const canvas = surface.querySelector("canvas") as HTMLCanvasElement;
    const box = surface.getBoundingClientRect();
    await drag(canvas, box, [0.2, 0.2], [0.6, 0.7]);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    let intent = lastIntent(args.onSelectionIntent);
    await expect(intent?.gesture.kind).toBe("rect");
    await expect(intent?.field).toBe("at");
    const rect = inRect(intent);
    await expect(rect.length).toBeGreaterThan(50);
    await expect(intent?.datapoints).toHaveLength(rect.length);
    await expect(intent?.values.map(asNumber)).toEqual(distinctDates(rect));

    await drawPath(canvas, box, LASSO_PATH, { shiftKey: true, altKey: true });
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(2));
    intent = lastIntent(args.onSelectionIntent);
    await expect(intent?.gesture.kind).toBe("lasso");
    await expect(intent?.mode).toBe("add");
    const lasso = inLasso(intent);
    await expect(lasso.length).toBeGreaterThan(50);
    await expect(intent?.datapoints).toHaveLength(lasso.length);
  },
};

// ---------------------------------------------------------------------------
// Line, bars, navigator window
// ---------------------------------------------------------------------------

/**
 * `["range", "rect"]` keeps the plot a pointer — a plain drag selects nothing —
 * and Shift+drag draws the rectangle (an ADD).
 */
export const LineShiftRectangle: Story = {
  render: ({ onSelectionIntent }) => (
    <div className="w-full max-w-[720px]" data-testid="chart">
      <LineChart
        animationDuration={0}
        data={MONTHS}
        onSelectionIntent={onSelectionIntent}
        selectionGestures={["range", "rect"]}
        xDataKey="month"
      >
        <Grid horizontal />
        <Line dataKey="revenue" />
        <Line dataKey="cost" />
        <XAxis />
        <YAxis />
      </LineChart>
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const { plot, box } = await plotOf(within(canvasElement).getByTestId("chart"));
    await drag(plot, box, [0.3, 0.02], [0.6, 0.98]);
    await frame();
    await expect(args.onSelectionIntent).not.toHaveBeenCalled();
    await drag(plot, box, [0.3, 0.02], [0.6, 0.98], { shiftKey: true });
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    const intent = lastIntent(args.onSelectionIntent);
    await expect(intent?.gesture.kind).toBe("rect");
    await expect(intent?.mode).toBe("add");
    if (intent?.gesture.kind !== "rect") return;
    const [x0, x1] = intent.gesture.x.map(asNumber);
    const expected = MONTHS.filter(
      (m) => m.month.getTime() >= (x0 as number) && m.month.getTime() <= (x1 as number),
    );
    await expect(intent.values.map(asNumber)).toEqual(expected.map((m) => m.month.getTime()));
    // Both series' points under the rectangle.
    await expect(intent.datapoints).toHaveLength(expected.length * 2);
  },
};

function RegionBars({
  onSelectionIntent,
  gestures,
  rule,
  testId,
}: {
  onSelectionIntent: ChartSelectionIntentHandler;
  gestures: readonly ("rect" | "lasso")[];
  rule?: "overlap" | "contain";
  testId: string;
}) {
  return (
    <section aria-label={testId} className="w-full" data-testid={testId}>
      <BarChart
        animationDuration={0}
        data={REGIONS}
        onSelectionIntent={onSelectionIntent}
        selectionGestures={gestures}
        selectionHitRule={rule}
        xDataKey="region"
      >
        <Grid horizontal />
        <Bar dataKey="revenue" />
        <BarXAxis />
        <BarValueAxis />
      </BarChart>
    </section>
  );
}

/** A lasso across the bars (`overlap`): every bar the band crosses — i.e. tall enough to reach it. */
export const BarLassoOverlap: Story = {
  render: ({ onSelectionIntent }) => (
    <div className="w-full max-w-[640px]">
      <RegionBars gestures={["lasso"]} onSelectionIntent={onSelectionIntent} testId="bars" />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const { plot, box } = await plotOf(within(canvasElement).getByTestId("bars"));
    await drawPath(plot, box, [
      [0.01, 0.35],
      [0.99, 0.35],
      [0.99, 0.55],
      [0.01, 0.55],
      [0.012, 0.36],
    ]);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    const intent = lastIntent(args.onSelectionIntent);
    if (intent?.gesture.kind !== "lasso") throw new Error("expected a lasso");
    // The band's lower edge, in revenue: a bar reaching above it crosses the band.
    const floor = Math.min(...intent.gesture.path.map((p) => p.y));
    const expected = REGIONS.filter((r) => r.revenue >= floor).map((r) => r.region);
    await expect(expected.length).toBeGreaterThan(1);
    await expect(intent.values).toEqual(expected);
  },
};

/**
 * `overlap` vs `contain`, the same rectangle over the left half: overlap takes
 * every bar it touches, contain only the bars wholly inside it.
 */
export const BarOverlapVersusContain: Story = {
  render: ({ onSelectionIntent }) => (
    <div className="grid w-full max-w-[960px] gap-6 md:grid-cols-2">
      <RegionBars gestures={["rect"]} onSelectionIntent={onSelectionIntent} testId="overlap" />
      <RegionBars
        gestures={["rect"]}
        onSelectionIntent={onSelectionIntent}
        rule="contain"
        testId="contain"
      />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const overlap = await plotOf(canvas.getByTestId("overlap"));
    await drag(overlap.plot, overlap.box, [0.001, 0.5], [0.5, 1.1]);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    const touched = lastIntent(args.onSelectionIntent);
    await expect(touched?.values).toEqual(["North", "East", "South", "West"]);

    const contain = await plotOf(canvas.getByTestId("contain"));
    await drag(contain.plot, contain.box, [0.001, 0.5], [0.5, 1.1]);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(2));
    const inside = lastIntent(args.onSelectionIntent);
    if (inside?.gesture.kind !== "rect") throw new Error("expected a rect");
    const top = inside.gesture.y[1];
    const expected = REGIONS.slice(0, 4)
      .filter((r) => r.revenue <= top)
      .map((r) => r.region);
    await expect(expected.length).toBeGreaterThan(0);
    await expect(expected.length).toBeLessThan(4);
    await expect(inside.values).toEqual(expected);
  },
};

/**
 * A navigator window hides March 1–20: a lasso drawn over (and past) the whole
 * plot selects only the days the window shows — a point outside it is never in
 * the intent.
 */
export const LassoRespectsNavigatorWindow: Story = {
  render: ({ onSelectionIntent }) => (
    <div className="w-full max-w-[720px]" data-testid="chart">
      <LineChart
        animationDuration={0}
        data={DAILY}
        defaultWindow={{
          kind: "time",
          start: new Date(2024, 2, 21, 12),
          end: new Date(2024, 3, 10, 12),
        }}
        onSelectionIntent={onSelectionIntent}
        selectionGestures={["lasso"]}
        xDataKey="day"
      >
        <Grid horizontal />
        <Line dataKey="sessions" />
        <XAxis />
        <YAxis />
      </LineChart>
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const { plot, box } = await plotOf(within(canvasElement).getByTestId("chart"));
    await drawPath(plot, box, [
      [-0.2, -0.2],
      [1.2, -0.2],
      [1.2, 1.2],
      [-0.2, 1.2],
      [-0.19, -0.19],
    ]);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    const intent = lastIntent(args.onSelectionIntent);
    const lo = new Date(2024, 2, 21, 12).getTime();
    const hi = new Date(2024, 3, 10, 12).getTime();
    const shown = DAILY.filter((d) => d.day.getTime() > lo && d.day.getTime() < hi);
    await expect(intent?.values.map(asNumber)).toEqual(shown.map((d) => d.day.getTime()));
    await expect(intent?.values.map(asNumber)).not.toContain(new Date(2024, 2, 1).getTime());
  },
};

// ---------------------------------------------------------------------------
// Keyboard and touch
// ---------------------------------------------------------------------------

/**
 * The keyboard rectangle — the lasso's keyboard equivalent: S, arrows, hold
 * Space and grow, release to select; the live region says how many.
 */
export const KeyboardRectangle: Story = {
  render: (args) => <ReadingsScatter {...args} gestures={["lasso", "rect"]} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // One session: a key held with `>` stays held across calls.
    const user = userEvent.setup();
    const target = await canvas.findByRole("button", { name: "Select an area with the keyboard" });
    target.focus();
    await user.keyboard("s");
    const root = canvas.getByTestId("chart");
    const crosshair = await waitFor(() => {
      const el = root.querySelector('[data-slot="chart-selection-keyboard-crosshair"]');
      expect(el).not.toBeNull();
      return el as Element;
    });
    await expect(crosshair).toHaveAttribute("aria-hidden", "true");
    await user.keyboard("{Shift>}{ArrowLeft}{ArrowUp}{/Shift}");
    await user.keyboard("[Space>]");
    await waitFor(() => expect(crosshair).toHaveAttribute("data-anchored", "true"));
    await user.keyboard("{Shift>}{ArrowRight}{ArrowRight}{ArrowDown}{/Shift}");
    await expect(args.onSelectionIntent).not.toHaveBeenCalled();
    await user.keyboard("[/Space]");
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    let intent = lastIntent(args.onSelectionIntent);
    await expect(intent?.source).toBe("keyboard");
    await expect(intent?.gesture.kind).toBe("rect");
    await expect(intent?.mode).toBe("replace");
    const expected = inRect(intent);
    await expect(expected.length).toBeGreaterThan(10);
    await expect(intent?.datapoints).toHaveLength(expected.length);
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-slot="chart-selection-gesture-status"]')?.textContent,
      ).toBe(`${expected.length} points selected`),
    );

    // Released with Shift held → add.
    await user.keyboard("{Shift>}{ArrowUp}{ArrowLeft}{/Shift}");
    await user.keyboard("[Space>]{Shift>}{ArrowRight}{ArrowDown}[/Space]{/Shift}");
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(2));
    intent = lastIntent(args.onSelectionIntent);
    await expect(intent?.mode).toBe("add");

    // Esc leaves rectangle mode.
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(root.querySelector('[data-slot="chart-selection-keyboard-crosshair"]')).toBeNull(),
    );
  },
};

/** Touch: a 400 ms long-press arms the lasso; the path then selects like a mouse lasso. */
export const TouchLongPressLasso: Story = {
  render: (args) => <ReadingsScatter {...args} gestures={["rect", "lasso"]} />,
  play: async ({ args, canvasElement }) => {
    const { plot, box } = await plotOf(within(canvasElement).getByTestId("chart"));
    await drawPath(plot, box, LASSO_PATH, { pointerType: "touch", pointerId: 9 }, 480);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    const intent = lastIntent(args.onSelectionIntent);
    await expect(intent?.gesture.kind).toBe("lasso");
    const expected = inLasso(intent);
    await expect(expected.length).toBeGreaterThan(50);
    await expect(intent?.datapoints).toHaveLength(expected.length);
  },
};
