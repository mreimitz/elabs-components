import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactElement, useMemo, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ChartFrame } from "../../chart-frame";
import type { ChartSelectionIntent } from "../selection/types";
import {
  DensityScatterChart,
  type DensityFrameStats,
  type DensityScatterChartProps,
} from "./density-scatter-chart";
import { buildLateralTraffic, buildWaferProbe, LATERAL_ZONES } from "./fixtures";
import type { DensityScatterSelection, DensityView } from "./types";

/**
 * `DensityScatterChart` is the point plot for 10⁵–10⁶ rows. Every point is
 * always drawn; its colour is the density around it; zones on the axes classify
 * it; an x range, a y range, a lasso and a zone pick intersect into one
 * selection. WebGL dots, JS bins, a Canvas-2D fallback.
 *
 * The stories below carry what the prop table cannot: the LOOK at 200,000
 * points (zoom in — the shape resolves into dots), the measured frame time on
 * this machine, and the selection contract exercised by play functions.
 */
const meta = {
  title: "Charts/DensityScatterChart",
  component: DensityScatterChart,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A point plot for 10⁵–10⁶ rows with zones on the axes and a zoom-dependent level of " +
          "detail. Every point is always a dot: zoomed out, 200k slightly translucent dots overlap " +
          "into a solid density shape; zooming in spreads the same dots apart, so the transition is " +
          "continuous by construction. Dots render on the GPU (positions upload once, one byte per " +
          "point per frame); density is binned in screen pixels on the JS side. Selection is an " +
          "intersection of an x range (drag the bottom axis), a y range (drag the left axis), a lasso " +
          "and a zone pick — every gesture also emits a `ChartSelectionIntent`. Wheel zooms at the " +
          "cursor, drag pans, double-click resets.",
      },
    },
  },
  argTypes: {
    data: { control: false },
    zones: { control: false },
    onFrame: { control: false },
    onSelectionIntent: { control: false },
  },
} satisfies Meta<typeof DensityScatterChart>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── Fixtures ────────────────────────────────────────────────────────────────

const TRAFFIC_200K = buildLateralTraffic(200_000);
const TRAFFIC_20K = buildLateralTraffic(20_000);
/** The window the reference plot uses; the rare outliers past ±240 m stay reachable by zooming out. */
const TRACK_DOMAIN = { y0: -240, y1: 240 };

const kt = (v: number) => `${Math.round(v)} kt`;
const metres = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;

/** A wrapper that shows the chart's own frame statistics and the last intent. */
function Readout(props: Partial<DensityScatterChartProps> & { points?: number }): ReactElement {
  const { points = 200_000, ...rest } = props;
  const data = useMemo(
    () => (points === 200_000 ? TRAFFIC_200K : buildLateralTraffic(points)),
    [points],
  );
  const [stats, setStats] = useState<DensityFrameStats | null>(null);
  const [intent, setIntent] = useState<ChartSelectionIntent | null>(null);
  const [selection, setSelection] = useState<DensityScatterSelection>({});
  return (
    <div className="flex flex-col gap-2">
      <DensityScatterChart
        accessibleLabel="Lateral deviation along the track"
        data={data}
        domain={TRACK_DOMAIN}
        formatX={metres}
        formatY={metres}
        formatValue={kt}
        legend
        onFrame={setStats}
        onSelectionChange={setSelection}
        onSelectionIntent={setIntent}
        plotHeight={380}
        selection={selection}
        selectionField="along"
        selectionFieldY="cross"
        selectionGestures={["range", "lasso"]}
        valueKey="speed"
        xLabel="Along-track distance (m) — drag here to select an x range"
        yLabel="Cross-track (m)"
        zones={LATERAL_ZONES}
        {...rest}
      />
      <p className="text-meta text-muted-foreground tabular-nums" data-testid="density-readout">
        {stats
          ? `${stats.visible.toLocaleString("en")} in view · ${stats.selected.toLocaleString("en")} selected · ${stats.maxPerCell} max/cell · bin + upload ${stats.ms.toFixed(1)} ms · ${stats.renderer}`
          : "—"}
        {intent
          ? ` · last intent: ${intent.gesture.kind} ${intent.field} (${intent.mode}, ${intent.source})`
          : ""}
      </p>
    </div>
  );
}

/**
 * 200,000 points of lateral-deviation traffic with two zones on the axes (a core
 * band and an expanded envelope that narrows along x). Wheel-zoom into the
 * funnel throat: the solid core resolves into individual dots; zoom out and it
 * packs again. The readout is this machine's real bin time.
 */
export const TwoHundredThousandPoints: Story = {
  args: { data: TRAFFIC_200K, zones: LATERAL_ZONES },
  render: () => <Readout />,
  play: async ({ canvas }) => {
    await waitFor(
      () => expect(canvas.getByTestId("density-readout")).toHaveTextContent(/in view/),
      {
        timeout: 8_000,
      },
    );
    await expect(canvas.getByTestId("density-readout")).toHaveTextContent(/webgl|canvas2d/);
    await expect(
      canvas.getByRole("figure", { name: "Lateral deviation along the track" }),
    ).toHaveAccessibleDescription(/200,000 points.*zones: Core/);
  },
};

/** `status="loading"` (RM-185): a skeleton fills the same plot box the ready
 * chart would use, at every width, so nothing moves once the data lands. */
export const Loading: Story = {
  render: () => (
    <div className="flex w-[900px] max-w-full flex-col gap-6">
      {[380, 600, 900].map((width) => (
        <div className="w-full" key={width} style={{ maxWidth: width }}>
          <DensityScatterChart
            accessibleLabel="Lateral deviation along the track"
            data={TRAFFIC_20K}
            status="loading"
          />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const statuses = canvas.getAllByRole("status");
    await expect(statuses).toHaveLength(3);
    for (const status of statuses) {
      await expect(status).toHaveAttribute("aria-live", "polite");
      await expect(status).toHaveTextContent("Loading chart…");
      const skeleton = status.querySelector('[data-slot="skeleton"]');
      await expect(skeleton).toHaveAttribute("aria-hidden", "true");
    }
    await expect(canvasElement.querySelector("canvas")).toBeNull();
  },
};

/** One million points — the budget story. The picture is the same; only the readout changes. */
export const OneMillionPoints: Story = {
  args: { data: TRAFFIC_200K, zones: LATERAL_ZONES },
  render: () => <Readout points={1_000_000} />,
};

/**
 * Colour by a continuous column: dense cells show the cell's MEAN ground speed
 * on the sequential ramp; sparse dots show their own value. A binned-mean map
 * at no extra cost.
 */
const SPEED_COLOR_BY = { kind: "value", key: "speed", domain: [80, 160] } as const;

export const ColorByValue: Story = {
  args: { data: TRAFFIC_200K, zones: LATERAL_ZONES },
  render: () => <Readout colorBy={SPEED_COLOR_BY} legend={false} />,
};

/** Density alone on the neutral wire rung — no zones, one hue, lightness carries the count. */
const DENSITY_COLOR_BY = { kind: "density" } as const;
const NO_ZONES: never[] = [];

export const DensityOnly: Story = {
  args: { data: TRAFFIC_200K },
  render: () => <Readout colorBy={DENSITY_COLOR_BY} legend={false} zones={NO_ZONES} />,
};

/**
 * Colour by a categorical column (wafer probe bins) — the series ramp, one
 * entry per distinct value, the legend hides/shows each.
 */
const WAFER = buildWaferProbe(150_000);
const WAFER_COLOR_BY = { kind: "category", key: "bin" } as const;

export const ColorByCategory: Story = {
  args: { data: WAFER },
  render: () => (
    <DensityScatterChart
      accessibleLabel="Wafer probe results"
      colorBy={WAFER_COLOR_BY}
      data={WAFER}
      formatValue={(v) => `${Math.round(v)} mV`}
      legend
      plotHeight={{ aspect: 1 }}
      selectionGestures={["range", "lasso"]}
      valueKey="vth"
      xLabel="Die x (mm)"
      yLabel="Die y (mm)"
    />
  ),
};

/**
 * Selection is an intersection. The play function drives the KEYBOARD path —
 * the x-range slider thumbs are `role="slider"` buttons in the axis gutter —
 * and asserts the intent that leaves the chart and the live-region announcement.
 */
export const KeyboardRangeSelection: Story = {
  args: { data: TRAFFIC_20K, zones: LATERAL_ZONES },
  render: () => <Readout points={20_000} />,
  play: async ({ canvas, canvasElement }) => {
    // The chart's own count region — the selection session mounts a second
    // `role="status"` (silent in immediate mode), so `getByRole` is ambiguous.
    const status = () => canvasElement.querySelector('[data-slot="density-scatter-chart-status"]');
    const from = canvas.getByRole("slider", {
      name: "Range start, Along-track distance (m) — drag here to select an x range",
    });
    const to = canvas.getByRole("slider", {
      name: "Range end, Along-track distance (m) — drag here to select an x range",
    });
    await expect(canvas.getAllByRole("slider")).toHaveLength(4);
    from.focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    await waitFor(() =>
      expect(canvas.getByTestId("density-readout")).toHaveTextContent("last intent: range along"),
    );
    await expect(canvas.getByTestId("density-readout")).toHaveTextContent("(replace, keyboard)");
    // The selection narrowed the visible set and the live region says so.
    await waitFor(() => expect(status()).toHaveTextContent(/of .* points selected/));
    to.focus();
    await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    // Also set a y range (RM-185 review fix3): an x thumb's own Escape must
    // clear only x — before this fix it bubbled to the chart root's own
    // Esc-clears-everything handler and wiped this y range too.
    const yFrom = canvas.getByRole("slider", { name: "Range start, Cross-track (m)" });
    yFrom.focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    await waitFor(() =>
      expect(canvas.getByTestId("density-readout")).toHaveTextContent("last intent: range cross"),
    );
    to.focus();
    await userEvent.keyboard("{Escape}");
    // The x constraint is gone, but the y one — and the narrowed count it
    // implies — survives.
    await waitFor(() => expect(status()).toHaveTextContent(/of .* points selected/));
  },
};

/**
 * The legend (RM-118): a plain click hides/shows a zone (`aria-pressed`); a
 * Shift- or Ctrl-click SELECTS that zone as a constraint instead. Each zone
 * also carries a named tag inside the plot that selects it on a plain click.
 */
export const LegendHideAndSelect: Story = {
  args: { data: TRAFFIC_20K, zones: LATERAL_ZONES },
  render: () => <Readout points={20_000} />,
  play: async ({ canvas }) => {
    const core = await canvas.findByRole("button", { name: /^Core$/ });
    await expect(core).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(core);
    await expect(core).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(core);
    await expect(core).toHaveAttribute("aria-pressed", "true");
    // Modifier-click: a zone constraint, not a toggle. One `setup()` instance so
    // the held Shift carries into the click (the direct APIs each start fresh).
    const user = userEvent.setup();
    await user.keyboard("{Shift>}");
    await user.click(core);
    await user.keyboard("{/Shift}");
    await expect(core).toHaveAttribute("aria-pressed", "true");
    await waitFor(() =>
      expect(canvas.getByTestId("density-readout")).toHaveTextContent(
        "last intent: click zone (add",
      ),
    );
    // The in-plot tag is a real, pressed button now.
    const tag = canvas.getByRole("button", { name: "Select zone Core" });
    await expect(tag).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(tag);
    await expect(tag).toHaveAttribute("aria-pressed", "false");
  },
};

/**
 * The toolbar (RM-145) is the way into the plot gestures: Pointer pans and
 * zooms, Range turns a drag in the plot into an x AND a y range at once, Lasso
 * is freehand. The play function switches tools through the real buttons.
 */
export const ToolbarTools: Story = {
  args: { data: TRAFFIC_200K, zones: LATERAL_ZONES },
  render: () => <Readout />,
  play: async ({ canvas, canvasElement }) => {
    const chart = () => canvasElement.querySelector('[data-slot="density-scatter-chart"]');
    await waitFor(() => expect(chart()).toHaveAttribute("data-selection-tool", "pointer"));
    await userEvent.click(canvas.getByRole("radio", { name: /lasso/i }));
    await expect(chart()).toHaveAttribute("data-selection-tool", "lasso");
    await userEvent.click(canvas.getByRole("radio", { name: /range/i }));
    await expect(chart()).toHaveAttribute("data-selection-tool", "range");
  },
};

/** A controlled view: the host owns the window, the chart eases into every change. */
export const ControlledView: Story = {
  args: { data: TRAFFIC_200K, zones: LATERAL_ZONES },
  render: function ControlledViewStory() {
    const HOME: DensityView = { x0: -2300, x1: 3600, y0: -240, y1: 240 };
    const THROAT: DensityView = { x0: -700, x1: 300, y0: -70, y1: 70 };
    const [view, setView] = useState<DensityView>(HOME);
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            className="focus-ring rounded-md border border-border px-2 py-1 text-meta"
            onClick={() => setView(HOME)}
            type="button"
          >
            Whole track
          </button>
          <button
            className="focus-ring rounded-md border border-border px-2 py-1 text-meta"
            onClick={() => setView(THROAT)}
            type="button"
          >
            Funnel throat
          </button>
        </div>
        <DensityScatterChart
          accessibleLabel="Lateral deviation along the track"
          data={TRAFFIC_200K}
          formatX={metres}
          formatY={metres}
          legend
          onViewChange={setView}
          plotHeight={380}
          view={view}
          zones={LATERAL_ZONES}
        />
      </div>
    );
  },
};

/** Inside `ChartFrame`: title, description, notes and the frame's own chrome. */
export const InChartFrame: Story = {
  args: { data: TRAFFIC_200K, zones: LATERAL_ZONES },
  render: () => (
    <ChartFrame
      description="200,000 recorded positions, coloured by the zone they fall in. Wheel to zoom, drag an axis to select a range."
      notes="Core: within ±15 m of the centreline past the throat. Expanded EIS: the envelope that narrows from ±215 m to ±30 m."
      plotHeight={380}
      title="Lateral service volume — every position, not an average"
    >
      <DensityScatterChart
        accessibleLabel="Lateral deviation along the track"
        data={TRAFFIC_200K}
        formatX={metres}
        formatY={metres}
        legend
        selectionGestures={["range", "lasso"]}
        xLabel="Along-track distance (m)"
        yLabel="Cross-track (m)"
        zones={LATERAL_ZONES}
      />
    </ChartFrame>
  ),
};

/** The Canvas-2D fallback, forced — what a browser without WebGL gets. Same picture, slower. */
export const Canvas2DFallback: Story = {
  args: { data: TRAFFIC_200K, zones: LATERAL_ZONES },
  render: () => <Readout points={50_000} renderer="canvas2d" />,
  play: async ({ canvas }) => {
    await waitFor(
      () => expect(canvas.getByTestId("density-readout")).toHaveTextContent("canvas2d"),
      { timeout: 8_000 },
    );
  },
};
