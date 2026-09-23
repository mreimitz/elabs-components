import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor } from "storybook/test";
import { seededRnd } from "../../marks/seeded-rnd";
import { Grid } from "../grid";
import { Line } from "../line";
import { LineChart } from "../line-chart";
import { ChartTooltip } from "../tooltip";
import { XAxis } from "../x-axis";
import { YAxis } from "../y-axis";
import { ChartNavigator } from "./chart-navigator";
import type { NavigatorChangeMeta, NavigatorWindow } from "./types";

/**
 * `ChartNavigator` (RM-140, ADR 0040 §2) — the overview strip a time-series
 * chart mounts BELOW its plot, outside `plotHeight`. The shadow is a min/max
 * condensation in `--chart-foreground-muted` ink; the window wears the selection compound
 * outline; the two handles are real `role="slider"` buttons outside the svg.
 *
 * On `LineChart` / `AreaChart` / `ComposedChart` / `CandlestickChart` the
 * strip appears by itself once `data.length > maxVisiblePoints` (2 000), when
 * `window` / `defaultWindow` is given, or with `scrollbar="miniChart" | "bar"`.
 */
const meta = {
  title: "Charts/Navigator",
  component: ChartNavigator,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          'An overview strip under a chart that shows the whole series and a draggable window onto it. The strip sits outside `plotHeight`, draws a condensed min/max shadow in the grid ink, and its two handles are real sliders (arrows, Shift ×10, Home/End, PageUp/PageDown). Containers mount it through `scrollbar="miniChart" | "bar" | "auto"` or a `window`.',
      },
    },
  },
  args: {
    kind: "time",
    extent: [new Date(Date.UTC(2020, 0, 1)), new Date(Date.UTC(2020, 11, 31))] as [Date, Date],
    onWindowChange: fn(),
  },
} satisfies Meta<typeof ChartNavigator>;

export default meta;
type Story = StoryObj<typeof meta>;

const DAY = 86_400_000;
const T0 = Date.UTC(2020, 0, 1);

/** A seeded random walk with a few one-day spikes — the shadow must keep them. */
function walk(count: number, stepMs: number, seed = 1) {
  let value = 120;
  return Array.from({ length: count }, (_, i) => {
    value += (seededRnd(i, seed) - 0.5) * 6;
    value = Math.max(20, value);
    const spike = i % 997 === 431 ? 90 : 0;
    return {
      date: new Date(T0 + i * stepMs),
      visitors: Math.round(value + spike),
      signups: Math.round(value * 0.4 + seededRnd(i, seed + 1) * 10),
    };
  });
}

const FIVE_THOUSAND = walk(5000, DAY);
const MONTHLY = Array.from({ length: 120 }, (_, i) => ({
  date: new Date(Date.UTC(2015, i, 1)),
  revenue: Math.round(200 + i * 3 + seededRnd(i, 9) * 60),
  cost: Math.round(150 + i * 2 + seededRnd(i, 10) * 40),
}));

const handles = (root: Element) =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-slot="chart-navigator-handle"]'));
const valueNow = (el: Element) => Number(el.getAttribute("aria-valuenow"));
const firstTick = (root: Element) =>
  root.querySelector('[data-slot="x-axis"] span')?.textContent ?? "";

function pointer(target: Element, type: string, clientX: number, clientY: number) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      pointerId: 7,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
    }),
  );
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

type OnWindowChange = (window: NavigatorWindow | null, meta: NavigatorChangeMeta) => void;
type MockFn = OnWindowChange & { mock: { calls: [NavigatorWindow, NavigatorChangeMeta][] } };

/**
 * 5 000 daily points: above `maxVisiblePoints` (2 000), so `LineChart` shows the
 * strip once `scrollbar="auto"` is set and opens on the first 2 000 rows. The shadow keeps every
 * one-day spike (min/max buckets, not LTTB). Drag the window, click outside it
 * to jump, or wheel over the strip to pan.
 */
export const AutoMiniChart: Story = {
  render: (args) => (
    <div className="w-[720px] max-w-full">
      <LineChart
        animationDuration={0}
        data={FIVE_THOUSAND}
        onWindowChange={args.onWindowChange as OnWindowChange}
        scrollbar="auto"
      >
        <Grid horizontal />
        <Line dataKey="visitors" stroke="var(--chart-1)" />
        <XAxis />
        <YAxis />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const onWindowChange = args.onWindowChange as unknown as MockFn;
    const strip = await waitFor(() => {
      const el = canvasElement.querySelector('[data-slot="chart-navigator"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(strip.querySelector('[data-slot="chart-navigator-shadow"]')).not.toBeNull();
    const [start, end] = handles(strip);
    const initialStart = valueNow(start!);
    expect(initialStart).toBe(T0);
    expect(valueNow(end!)).toBe(T0 + 1999 * DAY);

    // Drag the window 100 px to the right.
    const track = strip.querySelector('[data-slot="chart-navigator-track"]')!;
    const a = start!.getBoundingClientRect();
    const b = end!.getBoundingClientRect();
    const cx = (a.left + a.width / 2 + b.left + b.width / 2) / 2;
    const cy = a.top + a.height / 2;
    pointer(track, "pointerdown", cx, cy);
    for (const dx of [25, 50, 75, 100]) {
      pointer(track, "pointermove", cx + dx, cy);
      await nextFrame();
    }
    pointer(track, "pointerup", cx + 100, cy);

    await waitFor(() => {
      const commits = onWindowChange.mock.calls.filter(([, m]) => m.phase === "commit");
      expect(commits.length).toBeGreaterThan(0);
    });
    const [committed, commitMeta] = onWindowChange.mock.calls
      .filter(([, m]) => m.phase === "commit")
      .at(-1)!;
    expect(commitMeta.source).toBe("pointer");
    expect(committed.kind).toBe("time");
    // 100 px of a track that maps 4 999 days onto its inner width.
    const trackPx = strip.getBoundingClientRect().width - 80;
    const expectedStart = T0 + (100 / trackPx) * 4999 * DAY;
    const got = (committed.start as Date).getTime();
    expect(got).toBeGreaterThan(initialStart);
    expect(Math.abs(got - expectedStart)).toBeLessThan(3 * DAY);
    await waitFor(() => expect(valueNow(start!)).toBe(got));

    // The wheel pans too.
    const before = valueNow(start!);
    strip.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 400 }));
    await waitFor(() => {
      const last = onWindowChange.mock.calls.at(-1)!;
      expect(last[1]).toEqual({ phase: "commit", source: "wheel" });
    });
    await waitFor(() => expect(valueNow(start!)).toBeGreaterThan(before));
  },
};

function SharedWindow({ onWindowChange }: { onWindowChange?: OnWindowChange }) {
  const [win, setWin] = useState<NavigatorWindow>({
    kind: "time",
    start: MONTHLY[0]!.date,
    end: MONTHLY[23]!.date,
  });
  const handle: OnWindowChange = (next, meta) => {
    if (next) setWin(next);
    onWindowChange?.(next, meta);
  };
  return (
    <div className="flex w-[720px] max-w-full flex-col gap-6">
      <LineChart animationDuration={0} data={MONTHLY} onWindowChange={handle} window={win}>
        <Grid horizontal />
        <Line dataKey="revenue" stroke="var(--chart-1)" />
        <XAxis />
        <YAxis />
      </LineChart>
      <LineChart animationDuration={0} data={MONTHLY} onWindowChange={handle} window={win}>
        <Grid horizontal />
        <Line dataKey="cost" stroke="var(--chart-2)" />
        <XAxis />
        <YAxis />
      </LineChart>
    </div>
  );
}

/**
 * One controlled `window` shared by two charts: moving either strip moves
 * both plots. Keyboard: Tab to a handle; arrows step one month (the median
 * data step), Shift+arrows ten, Home/End to the handle's bounds,
 * PageUp/PageDown pan by a whole window.
 */
export const ControlledSharedWindow: Story = {
  render: (args) => <SharedWindow onWindowChange={args.onWindowChange as OnWindowChange} />,
  play: async ({ args, canvasElement }) => {
    const onWindowChange = args.onWindowChange as unknown as MockFn;
    const charts = await waitFor(() => {
      const roots = Array.from(canvasElement.querySelectorAll("[data-chart-breakpoint]"));
      expect(roots).toHaveLength(2);
      expect(handles(roots[0]!)).toHaveLength(2);
      return roots;
    });
    const [first, second] = charts;
    const [start] = handles(first!);
    await waitFor(() => expect(firstTick(first!)).not.toBe(""));
    const tickBefore = firstTick(first!);
    const valueBefore = valueNow(start!);

    // Tab reaches the first chart's start handle.
    for (let i = 0; i < 4 && document.activeElement !== start; i++) {
      await userEvent.tab();
    }
    expect(start).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    await waitFor(() => expect(valueNow(start!)).toBeGreaterThan(valueBefore));
    await waitFor(() => expect(firstTick(first!)).not.toBe(tickBefore));
    // The shared window moved the second chart's handle too.
    expect(valueNow(handles(second!)[0]!)).toBe(valueNow(start!));
    expect(onWindowChange.mock.calls.at(-1)![1]).toEqual({ phase: "commit", source: "keyboard" });
    await waitFor(() =>
      expect(
        first!.querySelector('[data-slot="chart-navigator-status"]')?.textContent ?? "",
      ).toMatch(/^Showing .+ to .+$/),
    );

    // Home → the window starts at the data's first month.
    await userEvent.keyboard("{Home}");
    await waitFor(() => expect(valueNow(start!)).toBe(MONTHLY[0]!.date.getTime()));
    expect(valueNow(handles(second!)[0]!)).toBe(MONTHLY[0]!.date.getTime());
  },
};

function LiveFeed() {
  const [rows, setRows] = useState(() => walk(2400, 60 * 60 * 1000, 4));
  return (
    <div className="flex w-[720px] max-w-full flex-col gap-4">
      <button
        className="self-start rounded-md border border-border px-3 py-1 text-body focus-ring"
        onClick={() =>
          setRows((prev) => [...prev, ...walk(prev.length + 24, 60 * 60 * 1000, 4).slice(-24)])
        }
        type="button"
      >
        Append a day of data
      </button>
      <LineChart align="end" animationDuration={0} data={rows} scrollbar="auto">
        <Grid horizontal />
        <Line dataKey="visitors" stroke="var(--chart-1)" />
        <XAxis />
        <YAxis />
      </LineChart>
    </div>
  );
}

/**
 * `align="end"` (the associative BI suite `scrollStartPos: 1`): the first window sits on the latest
 * data, and — until someone moves it — keeps following the feed as rows arrive.
 */
export const AlignEndLiveFeed: Story = {
  render: () => <LiveFeed />,
  play: async ({ canvasElement }) => {
    const HOUR = 60 * 60 * 1000;
    const strip = await waitFor(() => {
      const el = canvasElement.querySelector('[data-slot="chart-navigator"]');
      expect(el).not.toBeNull();
      return el!;
    });
    const [, end] = handles(strip);
    expect(valueNow(end!)).toBe(T0 + 2399 * HOUR);
    await userEvent.click(canvasElement.querySelector("button[type=button]")!);
    await waitFor(() => expect(valueNow(end!)).toBe(T0 + 2423 * HOUR));
  },
};

/** `scrollbar="bar"`: the same window and handles as a plain 24 px scrollbar — no shadow. */
export const Scrollbar: Story = {
  render: () => (
    <div className="w-[720px] max-w-full">
      <LineChart
        animationDuration={0}
        data={MONTHLY}
        defaultWindow={{ kind: "index", start: 60, end: 96 }}
        scrollbar="bar"
      >
        <Grid horizontal />
        <Line dataKey="revenue" stroke="var(--chart-1)" />
        <XAxis />
        <YAxis />
      </LineChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const strip = await waitFor(() => {
      const el = canvasElement.querySelector<HTMLElement>('[data-slot="chart-navigator"]');
      expect(el).not.toBeNull();
      return el!;
    });
    expect(strip).toHaveAttribute("data-scrollbar", "bar");
    expect(strip.querySelector('[data-slot="chart-navigator-shadow"]')).toBeNull();
    expect(strip.getBoundingClientRect().height).toBe(24);
    // An index `defaultWindow` maps onto the rows' dates.
    expect(valueNow(handles(strip)[0]!)).toBe(MONTHLY[60]!.date.getTime());
  },
};

/**
 * `minSpan` — the smallest window the handles allow (here 30 days; the default
 * is 5× the median step). A handle stops `minSpan` short of the other one.
 */
export const MinSpanClamp: Story = {
  render: () => (
    <div className="w-[720px] max-w-full">
      <LineChart
        animationDuration={0}
        data={walk(365, DAY, 6)}
        defaultWindow={{ kind: "time", start: new Date(T0), end: new Date(T0 + 90 * DAY) }}
        minSpan={30 * DAY}
      >
        <Grid horizontal />
        <Line dataKey="visitors" stroke="var(--chart-1)" />
        <XAxis />
        <YAxis />
      </LineChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const strip = await waitFor(() => {
      const el = canvasElement.querySelector('[data-slot="chart-navigator"]');
      expect(el).not.toBeNull();
      return el!;
    });
    const [start, end] = handles(strip);
    start!.focus();
    await userEvent.keyboard("{End}");
    await waitFor(() => expect(valueNow(end!) - valueNow(start!)).toBe(30 * DAY));
    expect(Number(start!.getAttribute("aria-valuemax"))).toBe(valueNow(start!));
  },
};

/**
 * The narrow tier (a 380 px container): the strip drops to 32 px; the window,
 * handles and keyboard contract are unchanged.
 */
export const NarrowTier: Story = {
  render: () => (
    <div className="w-full max-w-[380px]">
      <LineChart animationDuration={0} data={FIVE_THOUSAND} scrollbar="auto">
        <Grid horizontal />
        <Line dataKey="visitors" stroke="var(--chart-1)" />
        <XAxis />
      </LineChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const strip = await waitFor(() => {
      const el = canvasElement.querySelector<HTMLElement>('[data-slot="chart-navigator"]');
      expect(el).not.toBeNull();
      return el!;
    });
    await waitFor(() => expect(strip.getBoundingClientRect().height).toBe(32));
    expect(strip.getBoundingClientRect().width).toBeLessThanOrEqual(380);
  },
};

/**
 * The strip on its own — an `index` window over 480 rows (the category model
 * RM-141 builds on). The handles speak rows: "Row 121 of 480".
 */
export const StandaloneIndex: Story = {
  args: {
    kind: "index",
    extent: [0, 480] as [number, number],
    defaultWindow: { kind: "index", start: 120, end: 200 },
    data: Array.from({ length: 480 }, (_, i) => ({
      v: 50 + Math.sin(i / 12) * 30 + seededRnd(i, 3) * 20,
    })),
    valueKeys: ["v"],
  },
  render: (args) => (
    <div className="w-[600px] max-w-full">
      <ChartNavigator {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [start] = handles(canvasElement);
    expect(start).toHaveAttribute("aria-valuetext", "Row 121 of 480");
  },
};
