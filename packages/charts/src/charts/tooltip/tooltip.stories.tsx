import type { Meta, StoryObj } from "@storybook/react-vite";
import { curveNatural } from "@visx/curve";
import { expect, fn, userEvent, waitFor } from "storybook/test";
import { Grid } from "../grid";
import { Line } from "../line";
import { LineChart } from "../line-chart";
import { XAxis } from "../x-axis";
import { YAxis } from "../y-axis";
import { ChartTooltip } from "./chart-tooltip";
import { CURSOR_KEEP_OUT, FOCUS_RING_KEEP_OUT } from "./placement/place-tooltip";

/**
 * RM-119 tooltip presets — `variant="rows"` (default), `"table"` (one column
 * per series), `"inline"` (the value painted at the mark, no box); `focus`
 * (nearest-series dim — works standalone, no `focusOnHover` needed on the
 * container); `pin` (tap-to-pin on a coarse pointer).
 */
const meta = {
  title: "Charts/Tooltip Presets",
  component: ChartTooltip,
  tags: ["autodocs"],
} satisfies Meta<typeof ChartTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

const threeSeriesData = [
  { date: new Date(2024, 0, 1), users: 1200, sessions: 3400, revenue: 8200 },
  { date: new Date(2024, 1, 1), users: 1350, sessions: 3800, revenue: 8900 },
  { date: new Date(2024, 2, 1), users: 1100, sessions: 3100, revenue: 7600 },
  { date: new Date(2024, 3, 1), users: 1450, sessions: 4100, revenue: 9500 },
  { date: new Date(2024, 4, 1), users: 1380, sessions: 3900, revenue: 9100 },
  { date: new Date(2024, 5, 1), users: 1520, sessions: 4300, revenue: 10200 },
];

const bikesData = [
  { date: new Date(2024, 0, 1), rides: 420 },
  { date: new Date(2024, 1, 1), rides: 610 },
  { date: new Date(2024, 2, 1), rides: 980 },
  { date: new Date(2024, 3, 1), rides: 1240 },
  { date: new Date(2024, 4, 1), rides: 1580 },
  { date: new Date(2024, 5, 1), rides: 1890 },
];

// #608: a bare `<LineChart>` mounts no keyboard target at all —
// `ChartDatapointLayer` is opt-in on `onDatapointClick` (`.claude/rules/charts.md`,
// "Drill-down"). Every preset below passes a spy (never asserted on — these demo
// stories don't drill down) purely so Tab has somewhere to land, matching
// `charts-chartframe--keyboard-tooltip`'s pattern.
const datapointClickSpy = fn();
const DATAPOINT_TARGET = '[data-slot="chart-datapoint-layer-target"][tabindex="0"]';

/** Tabs to the chart's one roving-tabindex target and asserts the tooltip box shows. */
async function expectKeyboardReachableTooltip(canvasElement: HTMLElement) {
  const doc = canvasElement.ownerDocument;
  const tooltip = () => doc.querySelector<HTMLElement>('[data-slot="chart-tooltip-box"]');
  await waitFor(() => expect(canvasElement.querySelector(DATAPOINT_TARGET)).not.toBeNull());
  await expect(tooltip()).toBeNull();

  await userEvent.tab();
  await expect(canvasElement.querySelector(DATAPOINT_TARGET)).toHaveFocus();
  await waitFor(() => expect(tooltip()).toBeVisible(), { timeout: 3000 });
}

/** Today's default box — `rows`, one row per series, byte-identical to before RM-119. */
export const Rows: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart
        aspectRatio={undefined}
        data={threeSeriesData}
        onDatapointClick={datapointClickSpy}
        xDataKey="date"
      >
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="users" stroke="var(--chart-1)" />
        <Line curve={curveNatural} dataKey="sessions" stroke="var(--chart-2)" />
        <Line curve={curveNatural} dataKey="revenue" stroke="var(--chart-3)" />
        <XAxis />
        <YAxis />
        <ChartTooltip variant="rows" />
      </LineChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expectKeyboardReachableTooltip(canvasElement);
  },
};

/** `variant="table"` — one column per series, header row, date in the `<caption>`. */
export const Table: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart
        aspectRatio={undefined}
        data={threeSeriesData}
        onDatapointClick={datapointClickSpy}
        xDataKey="date"
      >
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="users" stroke="var(--chart-1)" />
        <Line curve={curveNatural} dataKey="sessions" stroke="var(--chart-2)" />
        <Line curve={curveNatural} dataKey="revenue" stroke="var(--chart-3)" />
        <XAxis />
        <YAxis />
        <ChartTooltip variant="table" />
      </LineChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expectKeyboardReachableTooltip(canvasElement);
  },
};

/** `variant="inline"` — no box, the hovered series' value painted at the mark (the bikes chart). */
export const Inline: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart
        aspectRatio={undefined}
        data={bikesData}
        onDatapointClick={datapointClickSpy}
        xDataKey="date"
      >
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="rides" stroke="var(--chart-1)" />
        <XAxis />
        <ChartTooltip showDots={false} variant="inline" />
      </LineChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // `variant="inline"` paints no `chart-tooltip-box` — the reachability
    // check is the datapoint target itself, matching the issue's "Tab reaches
    // at least one datapoint target" (the inline value is an SVG-painted
    // sibling with no separate assertable box).
    await waitFor(() => expect(canvasElement.querySelector(DATAPOINT_TARGET)).not.toBeNull());
    await userEvent.tab();
    await expect(canvasElement.querySelector(DATAPOINT_TARGET)).toHaveFocus();
  },
};

/**
 * `focus` — the tooltip's nearest-series resolution drives RM-112's
 * per-series dim (`SeriesHoverDim`): hovering closer to one series' line
 * fades the other two to the shared excluded opacity. `ChartTooltip focus`
 * registers the request on its own — no `focusOnHover` on the `LineChart`
 * container below.
 */
export const Focus: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart
        aspectRatio={undefined}
        data={threeSeriesData}
        onDatapointClick={datapointClickSpy}
        xDataKey="date"
      >
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="users" stroke="var(--chart-1)" />
        <Line curve={curveNatural} dataKey="sessions" stroke="var(--chart-2)" />
        <Line curve={curveNatural} dataKey="revenue" stroke="var(--chart-3)" />
        <XAxis />
        <YAxis />
        <ChartTooltip focus />
      </LineChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expectKeyboardReachableTooltip(canvasElement);
  },
};

/**
 * `pin` — on a coarse pointer, a tap keeps the tooltip open after the finger
 * lifts; a second tap, `Esc`, or a tap outside the chart releases it.
 * `pin={true}` forces the affordance in this story regardless of the test
 * runner's pointer type.
 */
export const TouchPin: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart
        aspectRatio={undefined}
        data={threeSeriesData}
        onDatapointClick={datapointClickSpy}
        xDataKey="date"
      >
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="users" stroke="var(--chart-1)" />
        <XAxis />
        <ChartTooltip pin />
      </LineChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // `pin={true}` only changes what happens after a touch release — a
    // keyboard focus still drives the same live hover bridge as the other
    // presets, so the box shows exactly the same way.
    await expectKeyboardReachableTooltip(canvasElement);
  },
};

// ── Placement: the box never covers the pointer or what it points at ──────

const TOOLTIP_BOX = '[data-slot="chart-tooltip-box"]';

/** Two animation frames: the hover is scheduled on one, the box placed on the next. */
function nextFrames(win: Window) {
  return new Promise<void>((resolve) => {
    win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve()));
  });
}

/** Moves the mouse to a viewport point, the way a real move reaches the chart under it. */
async function moveMouse(doc: Document, clientX: number, clientY: number) {
  const win = doc.defaultView as Window;
  const target = doc.elementFromPoint(clientX, clientY) ?? doc.body;
  const init: MouseEventInit = { bubbles: true, cancelable: true, clientX, clientY, view: win };
  target.dispatchEvent(new PointerEvent("pointermove", { ...init, pointerType: "mouse" }));
  target.dispatchEvent(new MouseEvent("mousemove", init));
  await nextFrames(win);
  await nextFrames(win);
}

type Box = { left: number; top: number; right: number; bottom: number };

function overlaps(a: Box, b: Box) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** The mouse cursor's own ink around its hotspot — what the box keeps clear of. */
function cursorBox(x: number, y: number): Box {
  return {
    left: x - CURSOR_KEEP_OUT.left,
    top: y - CURSOR_KEEP_OUT.top,
    right: x + CURSOR_KEEP_OUT.right,
    bottom: y + CURSOR_KEEP_OUT.bottom,
  };
}

function describeBox(box: Box) {
  return `${Math.round(box.left)},${Math.round(box.top)} → ${Math.round(box.right)},${Math.round(box.bottom)}`;
}

/**
 * A chart answers hover only once its entrance has settled: hover the first
 * stop until the box shows, so the sweep starts on a live chart.
 */
async function waitForHover(doc: Document, [x, y]: [number, number]) {
  await waitFor(
    async () => {
      await moveMouse(doc, x, y);
      await expect(doc.querySelector(TOOLTIP_BOX)).not.toBeNull();
    },
    { timeout: 5000 },
  );
}

/**
 * Sweeps the mouse across `points` and asserts, at every stop, that a shown
 * box covers neither the cursor nor anything `keepClear` returns.
 */
async function expectBoxClearWhileSweeping(
  doc: Document,
  points: Array<[number, number]>,
  keepClear: (box: HTMLElement) => Box[] = () => [],
) {
  let shown = 0;
  const seen: string[] = [];
  for (const [x, y] of points) {
    await moveMouse(doc, x, y);
    const box = doc.querySelector<HTMLElement>(TOOLTIP_BOX);
    seen.push(box ? `${box.dataset.placementPass}/${box.dataset.side}` : `none@${x},${y}`);
    if (!box || box.dataset.placementPass === "hidden") {
      continue;
    }
    shown += 1;
    const rect = box.getBoundingClientRect();
    await expect(
      overlaps(rect, cursorBox(x, y)),
      `box ${describeBox(rect)} [${seen.at(-1)}] covers the pointer at ${x},${y}`,
    ).toBe(false);
    for (const avoided of keepClear(box)) {
      await expect(
        overlaps(rect, avoided),
        `box ${describeBox(rect)} covers ${describeBox(avoided)} (pointer at ${x},${y})`,
      ).toBe(false);
    }
  }
  await expect(shown, `the box never showed during the sweep: ${seen.join(" ")}`).toBeGreaterThan(
    0,
  );
}

const smallChartData = Array.from({ length: 13 }, (_, i) => ({
  week: `Week ${i + 1}`,
  value: 88 + ((i * 7) % 9) - (i === 12 ? 6 : 0),
}));

/**
 * A 140×56 chart — the Small Multiples panel. There is no room beside the
 * pointer inside it, so the box steps OUTSIDE the chart, beside it, and stays
 * there while the pointer scrubs; it never covers the chart or the cursor. The
 * date pill has no gutter to sit in, so it does not show.
 */
export const SmallChart: Story = {
  render: () => (
    <div className="flex justify-center p-24">
      <div className="h-14 w-[140px]" data-testid="small-chart">
        <LineChart
          data={smallChartData}
          margin={{ bottom: 4, left: 4, right: 6, top: 4 }}
          plotHeight={56}
          xDataKey="week"
          xScale="band"
        >
          <Line dataKey="value" name="On-time" stroke="var(--chart-1)" />
          <ChartTooltip valueFormat={{ abbreviate: false, decimals: 1, suffix: "%" }} />
        </LineChart>
      </div>
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const frame = canvas.getByTestId("small-chart").getBoundingClientRect();
    const midY = frame.top + frame.height / 2;
    const points: Array<[number, number]> = [];
    for (let x = frame.left + 6; x < frame.right - 4; x += 8) {
      points.push([x, midY]);
    }
    await waitForHover(doc, points[0] as [number, number]);
    await expectBoxClearWhileSweeping(doc, points, (box) => [
      (box.parentElement as HTMLElement).getBoundingClientRect(),
    ]);
    const box = doc.querySelector<HTMLElement>(TOOLTIP_BOX);
    await expect(box?.dataset.placementPass).toBe("escape");
    await expect(box).toHaveTextContent(/Week \d+/);
    await expect(box).toHaveTextContent(/%/);
  },
};

/**
 * #605's shape: the wide `table` box in a 380px chart. Wherever the pointer
 * goes, the box sits beside it — never on it, never over the hovered dots.
 */
export const ClearOfPointer: Story = {
  render: () => (
    <div className="h-64 w-full max-w-[380px]" data-testid="narrow-chart">
      <LineChart aspectRatio={undefined} data={threeSeriesData} xDataKey="date">
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="users" stroke="var(--chart-1)" />
        <Line curve={curveNatural} dataKey="sessions" stroke="var(--chart-2)" />
        <Line curve={curveNatural} dataKey="revenue" stroke="var(--chart-3)" />
        <XAxis />
        <YAxis />
        <ChartTooltip variant="table" />
      </LineChart>
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const frame = canvas.getByTestId("narrow-chart").getBoundingClientRect();
    const points: Array<[number, number]> = [];
    for (const share of [0.25, 0.5, 0.75]) {
      for (let x = frame.left + 48; x < frame.right - 44; x += 24) {
        points.push([x, frame.top + frame.height * share]);
      }
    }
    await waitForHover(doc, points[0] as [number, number]);
    await expectBoxClearWhileSweeping(doc, points);

    // Once the dots have settled, the box is clear of every one of them.
    const [lastX, lastY] = points[points.length - 1] as [number, number];
    await moveMouse(doc, lastX, lastY);
    await new Promise((resolve) => setTimeout(resolve, 600));
    const box = doc.querySelector<HTMLElement>(TOOLTIP_BOX);
    await expect(box).not.toBeNull();
    const rect = (box as HTMLElement).getBoundingClientRect();
    const dots = Array.from(
      canvasElement.querySelectorAll<SVGCircleElement>('svg[data-chart-export="exclude"] circle'),
    );
    await expect(dots.length).toBeGreaterThan(0);
    for (const dot of dots) {
      const dotRect = dot.getBoundingClientRect();
      await expect(overlaps(rect, dotRect), `box covers a dot at ${describeBox(dotRect)}`).toBe(
        false,
      );
    }
  },
};

/**
 * Keyboard: stepping through the points with the arrow keys, the box keeps
 * clear of the focused target and its focus ring.
 */
export const KeyboardClear: Story = {
  render: () => (
    <div className="h-64 w-full max-w-[380px]">
      <LineChart
        aspectRatio={undefined}
        data={threeSeriesData}
        onDatapointClick={datapointClickSpy}
        xDataKey="date"
      >
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="users" stroke="var(--chart-1)" />
        <Line curve={curveNatural} dataKey="sessions" stroke="var(--chart-2)" />
        <XAxis />
        <YAxis />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await expectKeyboardReachableTooltip(canvasElement);
    for (let step = 0; step < threeSeriesData.length; step += 1) {
      await nextFrames(doc.defaultView as Window);
      await nextFrames(doc.defaultView as Window);
      const box = doc.querySelector<HTMLElement>(TOOLTIP_BOX);
      const focused = doc.activeElement;
      if (box && focused instanceof HTMLElement && box.dataset.placementPass !== "hidden") {
        const target = focused.getBoundingClientRect();
        const ring = {
          left: target.left - FOCUS_RING_KEEP_OUT,
          top: target.top - FOCUS_RING_KEEP_OUT,
          right: target.right + FOCUS_RING_KEEP_OUT,
          bottom: target.bottom + FOCUS_RING_KEEP_OUT,
        };
        const rect = box.getBoundingClientRect();
        await expect(
          overlaps(rect, ring),
          `box ${describeBox(rect)} covers the focused target ${describeBox(ring)}`,
        ).toBe(false);
      }
      await userEvent.keyboard("{ArrowRight}");
    }
  },
};
