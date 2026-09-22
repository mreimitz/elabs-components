import type { Meta, StoryObj } from "@storybook/react-vite";
import { useId, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Bar } from "../bar";
import { BarChart } from "../bar-chart";
import { BarXAxis } from "../bar-x-axis";
import { Grid } from "../grid";
import { Line } from "../line";
import { LineChart } from "../line-chart";
import { Scatter } from "../scatter";
import { ScatterChart } from "../scatter-chart";
import { XAxis } from "../x-axis";
import { ChartSelectionGestureScope } from "./chart-gesture-layer";
import type {
  ChartSelectionGesture,
  ChartSelectionIntent,
  ChartSelectionIntentHandler,
} from "./types";

/**
 * Dev story for the RM-142 gesture engine: the pointer state machine, the
 * hit-tests and the intent resolver on the three wired families. The range
 * bubbles, keyboard rectangle and toolbar are RM-143/144/145 — not here.
 */

type EngineMode = "rect" | "lasso" | "range";

const GESTURES_BY_MODE: Record<EngineMode, readonly ChartSelectionGesture[]> = {
  // The first drawing gesture is the engine's mode; the rest stay enabled.
  rect: ["rect", "lasso", "range"],
  lasso: ["lasso", "rect", "range"],
  range: ["range", "rect", "lasso"],
};

const day = (d: number) => new Date(2024, 0, 1 + d);

const scatterData = Array.from({ length: 24 }, (_, i) => ({
  date: day(i),
  // Deterministic scatter — no Math.random in stories either.
  sessions: 300 + ((i * 97) % 240),
}));
const barData = [
  { region: "North", revenue: 42 },
  { region: "East", revenue: 67 },
  { region: "South", revenue: 31 },
  { region: "West", revenue: 58 },
  { region: "Central", revenue: 49 },
  { region: "Coast", revenue: 74 },
];
const lineData = Array.from({ length: 30 }, (_, i) => ({
  date: day(i),
  users: 1000 + Math.round(400 * Math.sin(i / 4)) + i * 12,
}));

function describeIntent(intent: ChartSelectionIntent | null): string {
  if (!intent) return "No selection yet — drag on a chart.";
  const values = intent.values
    .map((v) => (v instanceof Date ? v.toLocaleDateString("en-US") : String(v)))
    .join(", ");
  return `${intent.gesture.kind} · ${intent.mode} · ${intent.field}: ${values}`;
}

interface DemoProps {
  onScatterIntent: ChartSelectionIntentHandler;
  onBarIntent: ChartSelectionIntentHandler;
  onLineIntent: ChartSelectionIntentHandler;
}

function SelectionEngineDemo({ onScatterIntent, onBarIntent, onLineIntent }: DemoProps) {
  const [mode, setMode] = useState<EngineMode>("rect");
  const [last, setLast] = useState<ChartSelectionIntent | null>(null);
  const selectId = useId();
  const gestures = GESTURES_BY_MODE[mode];
  const log =
    (handler: ChartSelectionIntentHandler): ChartSelectionIntentHandler =>
    (intent) => {
      setLast(intent);
      handler(intent);
    };

  return (
    <div className="flex w-full max-w-[640px] flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-body" htmlFor={selectId}>
          Engine mode
        </label>
        <select
          className="focus-ring rounded-md border border-input bg-background px-2 py-1 text-body"
          data-testid="engine-mode"
          id={selectId}
          onChange={(event) => setMode(event.target.value as EngineMode)}
          value={mode}
        >
          <option value="rect">Rectangle</option>
          <option value="lasso">Lasso</option>
          <option value="range">Axis range</option>
        </select>
        <output className="text-meta text-muted-foreground" data-testid="last-intent">
          {describeIntent(last)}
        </output>
      </div>

      <section aria-label="Scatter" className="h-64 w-full" data-testid="scatter">
        <ScatterChart
          data={scatterData}
          onSelectionIntent={log(onScatterIntent)}
          selectionGestures={gestures}
        >
          <Grid horizontal />
          <Scatter dataKey="sessions" />
          <XAxis />
        </ScatterChart>
      </section>

      <section aria-label="Bars" className="h-64 w-full" data-testid="bar">
        <BarChart
          data={barData}
          onSelectionIntent={log(onBarIntent)}
          selectionGestures={gestures}
          xDataKey="region"
        >
          <Grid horizontal />
          <Bar dataKey="revenue" />
          <BarXAxis />
        </BarChart>
      </section>

      <section aria-label="Line" className="h-64 w-full" data-testid="line">
        {/* `LineChart` does not thread the gesture props yet; the scope carries
            them to its time-series shell (which does). */}
        <ChartSelectionGestureScope
          onSelectionIntent={log(onLineIntent)}
          selectionGestures={gestures}
        >
          <LineChart data={lineData}>
            <Grid horizontal />
            <Line dataKey="users" />
            <XAxis />
          </LineChart>
        </ChartSelectionGestureScope>
      </section>
    </div>
  );
}

const meta = {
  title: "Charts/Selection/Engine",
  component: SelectionEngineDemo,
  tags: ["dev"],
  parameters: { layout: "padded" },
  args: { onScatterIntent: fn(), onBarIntent: fn(), onLineIntent: fn() },
} satisfies Meta<typeof SelectionEngineDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Pointer helpers — real PointerEvents dispatched on the plot `<g>`.
// ---------------------------------------------------------------------------

async function plotOf(root: HTMLElement): Promise<SVGGElement> {
  let plot: SVGGElement | null = null;
  await waitFor(() => {
    const layer = root.querySelector('[data-slot="chart-selection-gesture"]');
    plot = (layer?.parentElement as SVGGElement | null) ?? null;
    expect(plot).not.toBeNull();
  });
  return plot as unknown as SVGGElement;
}

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

/** Drags across the plot box from `a` to `b` (fractions of the plot). */
async function drag(
  plot: SVGGElement,
  a: [number, number],
  b: [number, number],
  init: PointerEventInit = {},
) {
  // The plot's own background rect is its first child and spans the plot.
  const box = (plot.firstElementChild ?? plot).getBoundingClientRect();
  const at = ([fx, fy]: [number, number]) =>
    [box.left + box.width * fx, box.top + box.height * fy] as const;
  const [x0, y0] = at(a);
  const [x1, y1] = at(b);
  fire(plot, "pointerdown", x0, y0, init);
  for (let step = 1; step <= 4; step++) {
    fire(plot, "pointermove", x0 + ((x1 - x0) * step) / 4, y0 + ((y1 - y0) * step) / 4, init);
    await frame();
  }
  fire(plot, "pointerup", x1, y1, init);
}

type IntentFn = ReturnType<typeof fn>;
const lastIntent = (mock: IntentFn) =>
  mock.mock.calls.at(-1)?.[0] as ChartSelectionIntent | undefined;

/** Rectangle on the scatter: `gesture.kind === "rect"`, a non-empty `values`, `replace`. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const plot = await plotOf(within(canvasElement).getByTestId("scatter"));
    const box = (plot.firstElementChild ?? plot).getBoundingClientRect();
    // The overlay is drawn while dragging, and only then.
    fire(plot, "pointerdown", box.left + 5, box.top + 5);
    fire(plot, "pointermove", box.right - 5, box.bottom - 5);
    await frame();
    await waitFor(() =>
      expect(plot.querySelector('[data-slot="chart-selection-gesture-overlay"]')).not.toBeNull(),
    );
    fire(plot, "pointerup", box.right - 5, box.bottom - 5);
    await waitFor(() => expect(args.onScatterIntent).toHaveBeenCalledTimes(1));
    const intent = lastIntent(args.onScatterIntent as IntentFn);
    await expect(intent?.gesture.kind).toBe("rect");
    await expect(intent?.field).toBe("date");
    await expect(intent?.mode).toBe("replace");
    await expect(intent?.values.length).toBeGreaterThan(0);
    await expect(plot.querySelector('[data-slot="chart-selection-gesture-overlay"]')).toBeNull();
  },
};

/** Shift + drag adds to the selection. */
export const ShiftAdds: Story = {
  play: async ({ args, canvasElement }) => {
    const plot = await plotOf(within(canvasElement).getByTestId("scatter"));
    await drag(plot, [0.02, 0.02], [0.98, 0.98], { shiftKey: true });
    await waitFor(() => expect(args.onScatterIntent).toHaveBeenCalled());
    await expect(lastIntent(args.onScatterIntent as IntentFn)?.mode).toBe("add");
  },
};

/** A rectangle over the middle bars resolves the region categories it overlaps. */
export const BarRectangle: Story = {
  play: async ({ args, canvasElement }) => {
    const plot = await plotOf(within(canvasElement).getByTestId("bar"));
    // Covers the plot's middle third horizontally, the full height.
    await drag(plot, [0.34, 0.01], [0.66, 0.99]);
    await waitFor(() => expect(args.onBarIntent).toHaveBeenCalled());
    const intent = lastIntent(args.onBarIntent as IntentFn);
    await expect(intent?.field).toBe("region");
    await expect(intent?.values).toEqual(["South", "West"]);
    await expect(intent?.gesture).toEqual({
      kind: "rect",
      x: ["South", "West"],
      y: expect.any(Array),
    });
  },
};

/** Switching the mode select to "Lasso": a closed lasso on the line chart. */
export const LineLasso: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(canvas.getByTestId("engine-mode"), "lasso");
    const plot = await plotOf(canvas.getByTestId("line"));
    await waitFor(() => expect(plot.querySelector('[data-gesture-mode="lasso"]')).not.toBeNull());
    const box = (plot.firstElementChild ?? plot).getBoundingClientRect();
    const pts: Array<[number, number]> = [
      [0.01, 0.01],
      [0.5, 0.01],
      [0.5, 0.99],
      [0.01, 0.99],
      [0.012, 0.02],
    ];
    const [first, ...rest] = pts.map(
      ([fx, fy]) => [box.left + box.width * fx, box.top + box.height * fy] as const,
    );
    fire(plot, "pointerdown", first?.[0] ?? 0, first?.[1] ?? 0);
    for (const [x, y] of rest) {
      fire(plot, "pointermove", x, y);
      await frame();
    }
    const end = rest.at(-1) ?? first ?? [0, 0];
    fire(plot, "pointerup", end[0], end[1]);
    await waitFor(() => expect(args.onLineIntent).toHaveBeenCalled());
    const intent = lastIntent(args.onLineIntent as IntentFn);
    await expect(intent?.gesture.kind).toBe("lasso");
    await expect(intent?.field).toBe("date");
    await expect(intent?.values.length).toBeGreaterThan(0);
    await expect(intent?.values[0]).toBeInstanceOf(Date);
  },
};

/** Touch: a 400 ms long-press arms the lasso (the associative BI suite's press-and-drag). */
export const TouchLongPressLasso: Story = {
  play: async ({ args, canvasElement }) => {
    const plot = await plotOf(within(canvasElement).getByTestId("scatter"));
    const box = (plot.firstElementChild ?? plot).getBoundingClientRect();
    const touch: PointerEventInit = { pointerType: "touch", pointerId: 9 };
    const x0 = box.left + 2;
    const y0 = box.top + 2;
    fire(plot, "pointerdown", x0, y0, touch);
    await new Promise((resolve) => setTimeout(resolve, 480));
    for (const [x, y] of [
      [box.right - 2, y0],
      [box.right - 2, box.bottom - 2],
      [x0, box.bottom - 2],
      [x0 + 1, y0 + 2],
    ] as const) {
      fire(plot, "pointermove", x, y, touch);
      await frame();
    }
    fire(plot, "pointerup", x0 + 1, y0 + 2, touch);
    await waitFor(() => expect(args.onScatterIntent).toHaveBeenCalled());
    const intent = lastIntent(args.onScatterIntent as IntentFn);
    await expect(intent?.gesture.kind).toBe("lasso");
    await expect(intent?.values.length).toBeGreaterThan(0);
  },
};
