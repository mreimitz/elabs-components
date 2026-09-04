import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import type { ChartDatapoint } from "../chart-datapoint";
import { HeatmapChart } from "./heatmap-chart";

const meta = {
  title: "Charts/HeatmapChart",
  component: HeatmapChart,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A grid of two categorical axes — weekday by hour, or any category by category — " +
          'shaded or sized by one numeric value per cell, with a `variant="calendar"` mode ' +
          "for one measure per day across a year. Cell fill suits few, dense cells; " +
          '`mode="dot"` reads better once cells get small and numerous.',
      },
    },
  },
} satisfies Meta<typeof HeatmapChart>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── Fixtures ────────────────────────────────────────────────────────────────

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));

/**
 * Deterministic pseudo-random support traffic: a working-hours ridge, a lunch
 * dip and a quiet weekend. Seeded so the story renders the same pixels on every
 * run — an interaction test against a random fixture is a flake generator.
 */
function punchCard(): { day: string; hour: string; count: number }[] {
  let seed = 7;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const rows: { day: string; hour: string; count: number }[] = [];
  for (const day of WEEKDAYS) {
    const weekend = day === "Sat" || day === "Sun";
    for (const hour of HOURS) {
      const h = Number(hour);
      const office = h >= 8 && h <= 18 ? 1 : 0.12;
      const lunch = h === 13 ? 0.55 : 1;
      const base = weekend ? 6 : 44;
      rows.push({ day, hour, count: Math.round(base * office * lunch * (0.55 + next() * 0.9)) });
    }
  }
  // Two measured-but-empty cells: the pinprick has to be visible in the story
  // that documents it, not only in prose.
  rows[3] = { day: "Mon", hour: "03", count: 0 };
  rows[4] = { day: "Mon", hour: "04", count: 0 };
  return rows;
}

const PUNCH_CARD = punchCard();

const REGIONS = ["EMEA", "AMER", "APAC", "LATAM", "MEA"];
const PRODUCTS = ["Core", "Teams", "Enterprise", "Edu", "Trial", "OEM"];

/** A small revenue matrix — the shape a value label actually fits in. */
const REVENUE = PRODUCTS.flatMap((product, p) =>
  REGIONS.map((region, r) => ({
    product,
    region,
    revenue: Math.round(((p + 1) * (r + 2) * 137) % 940),
  })),
);

/** Latency by service × percentile — the `mode="dot"` shape (F10). */
const SERVICES = ["auth", "api", "search", "billing", "media", "sync", "webhook"];
const PERCENTILES = ["p50", "p75", "p90", "p95", "p99", "max"];
const LATENCY = SERVICES.flatMap((service, s) =>
  PERCENTILES.map((percentile, i) => ({
    service,
    percentile,
    ms: Math.round(18 * (i + 1) ** 1.6 * (1 + ((s * 7) % 5) / 6)),
  })),
);

/** A year of deploys, one row per day — the L17 shape. */
function deployYear(): { date: string; deploys: number }[] {
  const rows: { date: string; deploys: number }[] = [];
  const start = Date.UTC(2026, 0, 1);
  let seed = 19;
  for (let i = 0; i < 365; i += 1) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const date = new Date(start + i * 86_400_000);
    const weekday = date.getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    const draw = seed / 2147483648;
    const deploys = weekend ? (draw > 0.88 ? 1 : 0) : Math.round(draw * 11);
    rows.push({ date: date.toISOString().slice(0, 10), deploys });
  }
  return rows;
}

const DEPLOYS = deployYear();

/** Week-over-week change — the diverging shape, where sign is the point. */
const DELTA = PRODUCTS.flatMap((product, p) =>
  REGIONS.map((region, r) => ({
    product,
    region,
    delta: Math.round((((p * 5 + r * 13) % 19) - 9) * 4.7),
  })),
);

// ── Stories ─────────────────────────────────────────────────────────────────

/**
 * The punch card: 7 weekdays × 24 hours, 168 cells, five countable shade steps
 * (L16). The two blank-looking cells at 03:00 and 04:00 on Monday are not
 * missing — they are measured zeroes, drawn as a pinprick.
 */
export const Matrix: Story = {
  args: {
    data: PUNCH_CARD,
    x: "hour",
    y: "day",
    valueKey: "count",
    yOrder: WEEKDAYS,
    xOrder: HOURS,
    valueFormat: "compact",
  },
  render: (args) => (
    <div className="w-[720px]">
      <HeatmapChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The whole grid is one region with one sentence — the SVG is aria-hidden.
    const figure = await canvas.findByRole("figure", { name: /^Heatmap, 7 rows × 24 columns/ });
    await waitFor(() =>
      expect(figure.querySelectorAll('[data-slot="heatmap-cell"]')).toHaveLength(168),
    );
    // Exactly one peak ring, and the reveal rides CSS, not 168 motion drivers.
    await expect(figure.querySelectorAll("[data-peak]")).toHaveLength(1);
    const first = figure.querySelector<SVGGElement>('[data-slot="heatmap-cell"]');
    await expect(first?.style.animationDelay).toMatch(/^\d+(\.\d+)?ms$/);
  },
};

export const MatrixDark: Story = {
  name: "Matrix — dark",
  args: Matrix.args,
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark" storageKey={null}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: Matrix.render,
  play: Matrix.play,
};

/** G20: a small enough matrix that every cell can carry its own number. */
export const MatrixWithValues: Story = {
  args: {
    data: REVENUE,
    x: "region",
    y: "product",
    valueKey: "revenue",
    showValues: true,
    cellRadius: 9,
    valueFormat: "compact",
    aspectRatio: "5 / 3",
  },
  render: (args) => (
    <div className="w-[560px]">
      <HeatmapChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const figure = await canvas.findByRole("figure", { name: /^Heatmap, 6 rows × 5 columns/ });
    await waitFor(() =>
      expect(figure.querySelectorAll('[data-slot="heatmap-cell"]')).toHaveLength(30),
    );
  },
};

export const MatrixWithValuesDark: Story = {
  name: "MatrixWithValues — dark",
  args: MatrixWithValues.args,
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark" storageKey={null}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: MatrixWithValues.render,
  play: MatrixWithValues.play,
};

/**
 * F10: the value is the dot's AREA, not its radius — so a doubled number draws
 * a dot √2 wider, never twice as wide. The shade tracks the same ramp, so the
 * two encodings agree instead of competing.
 */
export const DotHeat: Story = {
  args: {
    data: LATENCY,
    x: "percentile",
    y: "service",
    valueKey: "ms",
    mode: "dot",
    palette: "mono",
    xOrder: PERCENTILES,
    yOrder: SERVICES,
    valueFormat: "number",
    aspectRatio: "7 / 4",
  },
  render: (args) => (
    <div className="w-[600px]">
      <HeatmapChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const figure = await canvas.findByRole("figure", { name: /^Heatmap, 7 rows × 6 columns/ });
    await waitFor(() => expect(figure.querySelectorAll("circle").length).toBeGreaterThan(30));
  },
};

export const DotHeatDark: Story = {
  name: "DotHeat — dark",
  args: DotHeat.args,
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark" storageKey={null}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: DotHeat.render,
  play: DotHeat.play,
};

/**
 * L17: a year of deploys as 53 week columns × 7 weekday rows, with a month
 * label above the week that holds each month's first Monday. A weekend with no
 * deploy is a pinprick, not a gap.
 */
export const Calendar: Story = {
  args: {
    data: DEPLOYS,
    x: "date",
    y: "",
    valueKey: "deploys",
    variant: "calendar",
    palette: "sequential",
    valueFormat: "number",
  },
  render: (args) => (
    <div className="w-[860px]">
      <HeatmapChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const figure = await canvas.findByRole("figure", { name: /^Heatmap, 53 weeks × 7 weekdays/ });
    await waitFor(() =>
      expect(figure.querySelectorAll('[data-slot="heatmap-cell"]')).toHaveLength(365),
    );
    // Twelve month ticks, in order, each above its own first Monday.
    const ticks = Array.from(figure.querySelectorAll('[data-slot="heatmap-month-tick"]'));
    await expect(ticks).toHaveLength(12);
    const columns = ticks.map((tick) => Number(tick.getAttribute("x")));
    await expect(columns).toEqual([...columns].sort((a, b) => a - b));
  },
};

export const CalendarDark: Story = {
  name: "Calendar — dark",
  args: Calendar.args,
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark" storageKey={null}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: Calendar.render,
  play: Calendar.play,
};

/**
 * Week-over-week change. A diverging ramp is lightness-symmetric by
 * construction, so in greyscale a `+18` and a `-18` are the same colour — this
 * chart therefore always carries a second, non-hue channel for sign: the value
 * labels are on by default, and turning them off hatches the negative cells
 * instead (see `DivergingHatched`).
 */
export const Diverging: Story = {
  args: {
    data: DELTA,
    x: "region",
    y: "product",
    valueKey: "delta",
    palette: "diverging",
    cellRadius: 6,
    valueFormat: "number",
    aspectRatio: "5 / 3",
  },
  render: (args) => (
    <div className="w-[560px]">
      <HeatmapChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const figure = await canvas.findByRole("figure", { name: /^Heatmap, 6 rows × 5 columns/ });
    // Sign survives greyscale: every cell prints its own signed number.
    await waitFor(() => expect(figure.querySelectorAll("text").length).toBeGreaterThan(30));
  },
};

export const DivergingDark: Story = {
  name: "Diverging — dark",
  args: Diverging.args,
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark" storageKey={null}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: Diverging.render,
  play: Diverging.play,
};

/** The same data with the labels off — sign then rides a 45° hatch. */
export const DivergingHatched: Story = {
  name: "Diverging — hatched (labels off)",
  args: { ...Diverging.args, showValues: false },
  render: Diverging.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const figure = await canvas.findByRole("figure", { name: /^Heatmap, 6 rows × 5 columns/ });
    await waitFor(() => {
      const hatched = figure.querySelectorAll('[fill^="url(#heatmap-neg-"]');
      expect(hatched.length).toBeGreaterThan(0);
    });
  },
};

/** The layout-shaped skeleton: the same grid, so nothing shifts when data lands. */
export const Loading: Story = {
  args: { ...Matrix.args, loading: true },
  render: Matrix.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("status")).toHaveTextContent(/loading/i);
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-slot="heatmap-skeleton"]')).toBeTruthy(),
    );
  },
};

export const LoadingDark: Story = {
  name: "Loading — dark",
  args: Loading.args,
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark" storageKey={null}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: Matrix.render,
  play: Loading.play,
};

/** No rows at all — a message, never an empty grid pretending to be data. */
export const Empty: Story = {
  args: { data: [], x: "hour", y: "day", valueKey: "count", emptyMessage: "No traffic recorded." },
  render: (args) => (
    <div className="w-[560px]">
      <HeatmapChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("No traffic recorded.")).toBeInTheDocument();
  },
};

export const EmptyDark: Story = {
  name: "Empty — dark",
  args: Empty.args,
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark" storageKey={null}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: Empty.render,
  play: Empty.play,
};

// ── Interaction ─────────────────────────────────────────────────────────────

function DrilldownDemo() {
  const [selected, setSelected] = useState<ChartDatapoint | null>(null);
  return (
    <div className="flex w-[560px] flex-col gap-3">
      <HeatmapChart
        aspectRatio="5 / 3"
        cellRadius={9}
        data={REVENUE}
        onDatapointClick={(point) => setSelected(point)}
        showValues
        valueFormat="compact"
        valueKey="revenue"
        x="region"
        y="product"
      />
      <output
        className="rounded-md border border-border bg-card px-3 py-2 text-body text-card-foreground"
        data-testid="drill-detail"
      >
        {selected
          ? `${selected.seriesLabel} · ${String(selected.category)} · ${selected.value} (via ${selected.source})`
          : "Select a cell to drill in."}
      </output>
    </div>
  );
}

/** The interactive args every drill-down story renders (the render ignores them). */
const DRILLDOWN_ARGS = {
  data: REVENUE,
  x: "region",
  y: "product",
  valueKey: "revenue",
} satisfies Partial<Story["args"]>;

/**
 * Click a cell to drill into it.
 *
 * The pointer path activates the CELL itself; the layer's `<button>`s are
 * `pointer-events: none` on purpose — they exist so a keyboard user reaches
 * what a mouse user can click, without adding a second hit target over the
 * chart. So this story clicks the mark, and `KeyboardDrilldown` drives the
 * buttons.
 */
export const Drilldown: Story = {
  args: DRILLDOWN_ARGS,
  render: () => <DrilldownDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByRole("group", { name: /chart data points/i });
    await expect(await within(group).findAllByRole("button")).toHaveLength(30);
    const cell = await waitFor(() => {
      const found = canvasElement.querySelector<SVGGElement>('[data-heatmap-cell="0:0"]');
      expect(found).toBeTruthy();
      return found as SVGGElement;
    });
    await userEvent.click(cell);
    await expect(canvas.getByTestId("drill-detail")).toHaveTextContent(/via pointer/);
  },
};

/**
 * The same drill-down with the keyboard only: one tab stop for the whole grid,
 * arrows to traverse it, Enter to activate.
 */
export const KeyboardDrilldown: Story = {
  args: DRILLDOWN_ARGS,
  render: () => <DrilldownDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByRole("group", { name: /chart data points/i });
    const targets = await within(group).findAllByRole("button");

    await expect(targets.filter((t) => t.getAttribute("tabindex") === "0")).toHaveLength(1);
    (targets[0] as HTMLElement).focus();
    await expect(targets[0]).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(targets[1]).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByTestId("drill-detail")).toHaveTextContent(/via keyboard/);
  },
};

export const KeyboardDrilldownDark: Story = {
  name: "KeyboardDrilldown — dark",
  args: DRILLDOWN_ARGS,
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark" storageKey={null}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: KeyboardDrilldown.render,
  play: KeyboardDrilldown.play,
};
