import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, waitFor } from "storybook/test";
import { AutoChart } from "../../auto-chart";
import { Area } from "../area";
import { AreaChart } from "../area-chart";
import { Bar } from "../bar";
import { BarChart } from "../bar-chart";
import { BarValueAxis } from "../bar-value-axis";
import { BarYAxis } from "../bar-y-axis";
import { DistributionChart } from "../distribution/distribution-chart";
import { Grid } from "../grid";
import { Line } from "../line";
import { LineChart } from "../line-chart";
import { Scatter, ScatterChart } from "../scatter-chart";
import { ChartTooltip } from "../tooltip";
import { XAxis } from "../x-axis";
import { YAxis } from "../y-axis";
import {
  CAMPAIGNS,
  MARKET_REVENUE,
  MONTHLY_REVENUE,
  MONTHLY_TEMPERATURE,
  RESPONSE_TIMES,
} from "./analytics-fixtures";
import { fitModel } from "./regression";
import { confidenceInterval, max, mean, median, min, quantile, stddev } from "./stats";
import type { AnalyticRow, ChartAnalytic } from "./types";

/**
 * Charts / Analytics — computed lines and bands (RM-138, ADR 0040 §1).
 *
 * `analytics[]` sits beside `annotations[]`: every entry is a statistic of the
 * chart's own rows, resolved once and drawn by the annotation layer as a `line`
 * or a `range` — an average, a median with its quartile band, a percentile, a
 * ±1 standard-deviation band, a 95 % confidence interval. Each play function
 * recomputes the statistic on the SAME fixture with the framework-free maths
 * (`stats.ts`) and asserts the painted `data-value`.
 */
const meta = {
  title: "Charts/Analytics",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          'Computed reference lines and bands: `analytics={[{ kind: "line", value: "mean" }]}` on any cartesian container, `ScatterChart` (both axes) and `DistributionChart`. A line is drawn in `--chart-foreground`, dashed; a band is the quiet range wash under the series. Labels: `"computation"` (default, “Average 73.8”), `"value"`, `"none"` or your own text; every analytic is restated in the figure description.',
      },
    },
  },
  decorators: [
    (Story: () => React.ReactElement) => (
      <div className="w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// ── helpers ──────────────────────────────────────────────────────────────────

const values = (rows: readonly AnalyticRow[], key: string): number[] =>
  rows.map((row) => row[key]).filter((v): v is number => typeof v === "number");

/** The painted computed line of analytic `id` (waits for the chart to lay out). */
async function paintedLine(canvas: HTMLElement, id: string): Promise<Element> {
  return waitFor(() => {
    const el = canvas.querySelector(`[data-slot="chart-annotations-line"][data-analytic="${id}"]`);
    expect(el).not.toBeNull();
    return el as Element;
  });
}

/** The painted computed band of analytic `id`, as `[from, to]`. */
async function paintedBand(canvas: HTMLElement, id: string): Promise<[number, number]> {
  const el = await waitFor(() => {
    const found = canvas.querySelector(
      `[data-slot="chart-annotations-range"][data-analytic="${id}"]`,
    );
    expect(found).not.toBeNull();
    return found as Element;
  });
  const [from, to] = (el.getAttribute("data-value") ?? "").split(",").map(Number);
  return [from as number, to as number];
}

/** The figure description behind `aria-describedby`. */
function description(canvas: HTMLElement): string {
  const figure = canvas.querySelector('[role="figure"]');
  const id = figure?.getAttribute("aria-describedby");
  return (id ? canvas.querySelector(`[id="${id}"]`)?.textContent : "") ?? "";
}

// ── 1. Average line ──────────────────────────────────────────────────────────

/**
 * **An average line on a `LineChart`.** `{ kind: "line", value: "mean" }` —
 * dashed, in the foreground ink, labelled with the localised computation and
 * the value in the axis' own notation, and restated in the figure description
 * after the auto summary.
 */
export const AverageLine: Story = {
  render: () => (
    <LineChart
      accessibleLabel="Monthly revenue"
      analytics={[{ kind: "line", value: "mean", id: "average" }]}
      data={MONTHLY_REVENUE}
      plotHeight={280}
    >
      <Grid horizontal />
      <Line dataKey="revenue" />
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </LineChart>
  ),
  play: async ({ canvasElement }) => {
    const line = await paintedLine(canvasElement, "average");
    const expected = mean(values(MONTHLY_REVENUE, "revenue")) as number;
    await expect(Number(line.getAttribute("data-value"))).toBeCloseTo(expected, 8);
    await expect(line.textContent).toMatch(/^Average /);
    await expect(line.querySelector("line")?.getAttribute("stroke")).toBe(
      "var(--chart-foreground)",
    );
    await expect(description(canvasElement)).toContain(`${line.textContent}.`);
  },
};

// ── 2. Median + quartile band (horizontal bars) ──────────────────────────────

/**
 * **Median + interquartile band on a horizontal `BarChart`.** The value axis
 * runs along x, so both analytics land there by default: the band (P25–P75)
 * washes under the bars, the median rule paints over them.
 */
export const MedianAndQuartileBand: Story = {
  render: () => (
    <div className="h-[420px] w-full">
      <BarChart
        accessibleLabel="Revenue per market"
        analytics={[
          { kind: "band", spread: { percentiles: [25, 75] }, id: "iqr" },
          { kind: "line", value: "median", id: "median" },
        ]}
        data={MARKET_REVENUE}
        orientation="horizontal"
        xDataKey="market"
      >
        <Grid horizontal={false} vertical />
        <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" />
        <BarYAxis />
        <BarValueAxis />
        <ChartTooltip />
      </BarChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const revenue = values(MARKET_REVENUE, "revenue");
    const [from, to] = await paintedBand(canvasElement, "iqr");
    await expect(from).toBeCloseTo(quantile(revenue, 0.25) as number, 8);
    await expect(to).toBeCloseTo(quantile(revenue, 0.75) as number, 8);
    const line = await paintedLine(canvasElement, "median");
    await expect(Number(line.getAttribute("data-value"))).toBeCloseTo(median(revenue) as number, 8);
    // Vertical rule: the value runs along x.
    const rule = line.querySelector("line");
    await expect(rule?.getAttribute("x1")).toBe(rule?.getAttribute("x2"));
  },
};

// ── 3. Min / max lines (area) ────────────────────────────────────────────────

/** **Minimum and maximum lines on an `AreaChart`** — the range the season swings through. */
export const MinMaxLines: Story = {
  render: () => (
    <AreaChart
      accessibleLabel="Mean monthly temperature"
      analytics={[
        { kind: "line", value: "max", id: "max" },
        { kind: "line", value: "min", id: "min" },
      ]}
      data={MONTHLY_TEMPERATURE}
      plotHeight={260}
    >
      <Grid horizontal />
      <Area dataKey="temp" fill="var(--chart-2)" stroke="var(--chart-2)" />
      <XAxis />
      <YAxis unit="°C" />
      <ChartTooltip />
    </AreaChart>
  ),
  play: async ({ canvasElement }) => {
    const temps = values(MONTHLY_TEMPERATURE, "temp");
    const hi = await paintedLine(canvasElement, "max");
    const lo = await paintedLine(canvasElement, "min");
    await expect(Number(hi.getAttribute("data-value"))).toBe(max(temps));
    await expect(Number(lo.getAttribute("data-value"))).toBe(min(temps));
    await expect(hi.textContent).toMatch(/^Maximum /);
    await expect(lo.textContent).toMatch(/^Minimum /);
  },
};

// ── 4. Percentile line: clip vs extend ───────────────────────────────────────

/** This week's p95 latency beside the previous release's samples (not drawn). */
const LATENCY: AnalyticRow[] = MONTHLY_TEMPERATURE.slice(0, 18).map((row, i) => ({
  date: row.date,
  current: Math.round(180 + 30 * Math.sin(i / 2) + (row.temp as number)),
  previous: Math.round(260 + 60 * Math.cos(i / 3) + 2 * (row.temp as number)),
}));

const PREVIOUS_P90: ChartAnalytic = {
  kind: "line",
  of: "previous",
  value: { percentile: 90 },
  label: "Previous release P90",
  id: "p90",
};

/**
 * **`{ percentile: 90 }` with `ifOverflow`.** The line is the 90th percentile
 * of the PREVIOUS release (a field the chart does not draw), which sits above
 * this release's whole range. `"clip"` (left, the default) leaves the domain
 * alone and draws nothing; `"extend"` (right) grows the value domain until the
 * line fits.
 */
export const PercentileOverflow: Story = {
  render: () => (
    <div className="grid w-full gap-6 md:grid-cols-2">
      {(["clip", "extend"] as const).map((ifOverflow) => (
        <div data-overflow={ifOverflow} key={ifOverflow}>
          <p className="text-meta text-muted-foreground">ifOverflow: “{ifOverflow}”</p>
          <LineChart
            analytics={[{ ...PREVIOUS_P90, ifOverflow } as ChartAnalytic]}
            data={LATENCY}
            plotHeight={220}
          >
            <Grid horizontal />
            <Line dataKey="current" />
            <XAxis />
            <YAxis unit="ms" />
          </LineChart>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const extend = canvasElement.querySelector<HTMLElement>('[data-overflow="extend"]');
    const clip = canvasElement.querySelector<HTMLElement>('[data-overflow="clip"]');
    const line = await paintedLine(extend as HTMLElement, "p90");
    const expected = quantile(values(LATENCY, "previous"), 0.9) as number;
    await expect(Number(line.getAttribute("data-value"))).toBeCloseTo(expected, 8);
    await expect(Math.max(...values(LATENCY, "current"))).toBeLessThan(expected);
    await expect(clip?.querySelector('[data-analytic="p90"]')).toBeNull();
  },
};

// ── 5. ±1 standard deviation on both scatter axes ────────────────────────────

/**
 * **±1 standard deviation on a `ScatterChart`, on both axes.** One band per
 * axis (`axis: "x"` reduces the x column), plus the two means — the classic
 * "typical campaign" box.
 */
export const StdDevBandsOnScatter: Story = {
  render: () => (
    <ScatterChart
      accessibleLabel="Ad spend against revenue"
      analytics={[
        { kind: "band", spread: { stddev: 1 }, id: "y-sd", label: "none" },
        { kind: "band", axis: "x", spread: { stddev: 1 }, id: "x-sd", label: "none" },
        { kind: "line", value: "mean", id: "y-mean" },
        { kind: "line", axis: "x", value: "mean", id: "x-mean" },
      ]}
      data={CAMPAIGNS}
      plotHeight={320}
      xDataKey="spend"
      xScale="linear"
    >
      <Grid horizontal vertical />
      <Scatter dataKey="revenue" />
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </ScatterChart>
  ),
  play: async ({ canvasElement }) => {
    for (const [id, key] of [
      ["y-sd", "revenue"],
      ["x-sd", "spend"],
    ] as const) {
      const xs = values(CAMPAIGNS, key);
      const m = mean(xs) as number;
      const s = stddev(xs, { sample: true }) as number;
      const [from, to] = await paintedBand(canvasElement, id);
      await expect(from).toBeCloseTo(m - s, 8);
      await expect(to).toBeCloseTo(m + s, 8);
    }
    const xMean = await paintedLine(canvasElement, "x-mean");
    await expect(Number(xMean.getAttribute("data-value"))).toBeCloseTo(
      mean(values(CAMPAIGNS, "spend")) as number,
      8,
    );
  },
};

// ── 6. Confidence interval on a distribution ─────────────────────────────────

/**
 * **A 95 % confidence interval of the mean on a `DistributionChart`.** The
 * band (t-based, `{ spread: { ci: 0.95 } }`) washes under the boxes; the
 * pooled average paints over them.
 */
export const ConfidenceBandOnDistribution: Story = {
  render: () => (
    <div className="h-72 w-full">
      <DistributionChart
        accessibleLabel="First-response time by tier"
        analytics={[
          { kind: "band", spread: { ci: 0.95 }, id: "ci" },
          { kind: "line", value: "mean", id: "mean" },
        ]}
        data={RESPONSE_TIMES}
        groupKey="tier"
        kind="box"
        valueKey="hours"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const hours = values(RESPONSE_TIMES, "hours");
    const ci = confidenceInterval(hours, 0.95);
    const band = await waitFor(() => {
      const el = canvasElement.querySelector(
        '[data-slot="distribution-chart-reference-band"][data-analytic="ci"]',
      );
      expect(el).not.toBeNull();
      return el as Element;
    });
    const [from, to] = (band.getAttribute("data-value") ?? "").split(",").map(Number);
    await expect(from).toBeCloseTo(ci?.lower as number, 8);
    await expect(to).toBeCloseTo(ci?.upper as number, 8);
    const line = canvasElement.querySelector(
      '[data-slot="distribution-chart-reference-line"][data-analytic="mean"]',
    );
    await expect(Number(line?.getAttribute("data-value"))).toBeCloseTo(mean(hours) as number, 8);
    await expect(description(canvasElement)).toContain("95 % confidence interval");
  },
};

// ── 7. A show-condition ──────────────────────────────────────────────────────

const TARGET = 150;
const AVERAGE_WHEN_ON_TARGET: ChartAnalytic = {
  kind: "line",
  value: "mean",
  id: "on-target",
  label: "Average (on target)",
  when: (rows) => (mean(values(rows, "revenue")) ?? 0) >= TARGET,
};

/**
 * **`when` — the show-condition.** The same analytic on two years: the
 * average line only draws while the average clears the 150 k$ target, so the
 * first year (average below target) shows no line at all.
 */
export const WhenCondition: Story = {
  render: () => (
    <div className="grid w-full gap-6 md:grid-cols-2">
      {[
        { year: "2022", rows: MONTHLY_REVENUE.slice(0, 12) },
        { year: "2024", rows: MONTHLY_REVENUE.slice(24, 36) },
      ].map(({ year, rows }) => (
        <div data-year={year} key={year}>
          <p className="text-meta text-muted-foreground">{year}</p>
          <LineChart analytics={[AVERAGE_WHEN_ON_TARGET]} data={rows} plotHeight={200}>
            <Grid horizontal />
            <Line dataKey="revenue" />
            <XAxis />
            <YAxis />
          </LineChart>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const late = canvasElement.querySelector<HTMLElement>('[data-year="2024"]') as HTMLElement;
    const early = canvasElement.querySelector<HTMLElement>('[data-year="2022"]') as HTMLElement;
    await expect(mean(values(MONTHLY_REVENUE.slice(24, 36), "revenue"))).toBeGreaterThanOrEqual(
      TARGET,
    );
    await expect(mean(values(MONTHLY_REVENUE.slice(0, 12), "revenue"))).toBeLessThan(TARGET);
    await paintedLine(late, "on-target");
    await expect(early.querySelector('[data-analytic="on-target"]')).toBeNull();
  },
};

// ── 8. A custom reducer ──────────────────────────────────────────────────────

/** The mean of the last six rows — a value no preset names. */
function lastSixMonths(rows: readonly AnalyticRow[], key: string): number | null {
  return mean(values(rows.slice(-6), key));
}

/**
 * **A custom-function value.** `value: (rows, key) => number` covers any
 * statistic the presets do not: here, the average of the last six months,
 * labelled by the caller.
 */
export const CustomFunctionValue: Story = {
  render: () => (
    <LineChart
      analytics={[
        { kind: "line", value: lastSixMonths, label: "Last 6 months", id: "recent" },
        { kind: "line", value: "mean", label: "value", id: "all-time", style: "dotted" },
      ]}
      data={MONTHLY_REVENUE}
      plotHeight={260}
    >
      <Grid horizontal />
      <Line dataKey="revenue" />
      <XAxis />
      <YAxis />
    </LineChart>
  ),
  play: async ({ canvasElement }) => {
    const recent = await paintedLine(canvasElement, "recent");
    await expect(Number(recent.getAttribute("data-value"))).toBeCloseTo(
      lastSixMonths(MONTHLY_REVENUE, "revenue") as number,
      8,
    );
    await expect(recent.textContent).toBe("Last 6 months");
  },
};

// ── 9. Label modes ───────────────────────────────────────────────────────────

/**
 * **The four label modes** on one chart: `"none"` (unlabelled — still in the
 * description), `"value"` (the number alone), `"computation"` (the statistic
 * and the number) and a custom string.
 */
export const LabelModes: Story = {
  render: () => (
    <LineChart
      accessibleLabel="Monthly revenue with four labelled statistics"
      analytics={[
        { kind: "line", value: "min", label: "none", id: "none" },
        { kind: "line", value: { percentile: 25 }, label: "value", id: "value" },
        { kind: "line", value: "median", label: "computation", id: "computation" },
        { kind: "line", value: "max", label: "Best month", id: "custom" },
      ]}
      data={MONTHLY_REVENUE}
      plotHeight={300}
    >
      <Grid horizontal />
      <Line dataKey="revenue" />
      <XAxis />
      <YAxis />
    </LineChart>
  ),
  play: async ({ canvasElement }) => {
    const none = await paintedLine(canvasElement, "none");
    const value = await paintedLine(canvasElement, "value");
    const computation = await paintedLine(canvasElement, "computation");
    const custom = await paintedLine(canvasElement, "custom");
    await expect(none.textContent).toBe("");
    await expect(value.textContent).toMatch(/^[\d.,]+$/);
    await expect(computation.textContent).toMatch(/^Median [\d.,]+$/);
    await expect(custom.textContent).toBe("Best month");
    // "none" is unlabelled on the plot, never in the description.
    await expect(description(canvasElement)).toMatch(/Minimum [\d.,]+\./);
  },
};

// ── 10. Everything together ──────────────────────────────────────────────────

/**
 * **Everything together — an editorial chart.** Three years of revenue with
 * the interquartile band behind, the average over, a linear trend with its
 * 95 % confidence band, and a six-month seasonal forecast. The legend lists
 * the measure, then the two models with their fit; the tooltip adds a muted
 * row per model; the description reads one sentence per analytic.
 */
export const EverythingTogether: Story = {
  render: () => (
    <LineChart
      accessibleLabel="Monthly revenue, with statistics and a forecast"
      analytics={[
        { kind: "band", spread: { percentiles: [25, 75] }, id: "iqr", opacity: 0.8 },
        { kind: "line", value: "mean", id: "mean" },
        { kind: "trend", ci: 0.95, id: "trend" },
        { kind: "forecast", horizon: 6, season: 12, id: "forecast" },
      ]}
      animationDuration={300}
      data={MONTHLY_REVENUE}
      legend
      plotHeight={320}
    >
      <Grid horizontal />
      <Line dataKey="revenue" name="Revenue" stroke="var(--chart-1)" />
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </LineChart>
  ),
  play: async ({ canvasElement }) => {
    await paintedLine(canvasElement, "mean");
    await paintedBand(canvasElement, "iqr");
    const trend = await waitFor(() => {
      const el = canvasElement.querySelector(
        '[data-slot="analytic-series"][data-analytic="trend"]',
      );
      expect(el).not.toBeNull();
      return el as Element;
    });
    const pts = JSON.parse(trend.getAttribute("data-points") ?? "[]") as Array<[number, number]>;
    const fit = fitModel(
      MONTHLY_REVENUE.map((r) => ({ x: r.date.getTime(), y: r.revenue })),
      "linear",
    );
    for (const [x, y] of [pts[0], pts[17], pts.at(-1)] as Array<[number, number]>) {
      await expect(y).toBeCloseTo(fit?.predict(x) as number, 6);
    }
    const legend = canvasElement.querySelector('[data-slot="container-legend-root"]');
    await expect(legend?.querySelectorAll('[data-slot="chart-legend-dashed-marker"]')).toHaveLength(
      2,
    );
    await expect(legend?.textContent).toContain(`r² ${fit?.rSquared?.toFixed(2)}`);
    const text = description(canvasElement);
    await expect(text).toContain("Interquartile range");
    await expect(text).toContain("A 6-step forecast of Revenue");

    // Hover the middle of the plot: the trend adds a muted tooltip row.
    const svg = [...canvasElement.querySelectorAll("svg")].find((el) =>
      el.querySelector(":scope > g[transform]"),
    ) as SVGSVGElement;
    const plot = svg.querySelector(":scope > g[transform]") as SVGGElement;
    const box = svg.getBoundingClientRect();
    await waitFor(
      () => {
        fireEvent.mouseMove(plot, {
          clientX: box.left + box.width / 2,
          clientY: box.top + box.height / 2,
        });
        const row = document.querySelector('[data-slot="chart-tooltip-derived-row"]');
        expect(row?.textContent).toMatch(/^Trend[\d.,]+$/);
      },
      { timeout: 4000 },
    );
  },
};

// ── 11. From a spec ──────────────────────────────────────────────────────────

/**
 * **`ChartSpec.analytics`** — the serialisable form an agent emits: no
 * callbacks, the same kinds and value union. `AutoChart` hands it to the
 * container unchanged.
 */
export const FromSpec: Story = {
  render: () => (
    <AutoChart
      spec={{
        type: "bar",
        title: "Revenue per market",
        data: MARKET_REVENUE,
        x: "market",
        series: ["revenue"],
        analytics: [
          { kind: "band", spread: { percentiles: [25, 75] }, id: "iqr" },
          { kind: "line", value: "mean", id: "mean" },
        ],
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const line = await paintedLine(canvasElement, "mean");
    await expect(Number(line.getAttribute("data-value"))).toBeCloseTo(
      mean(values(MARKET_REVENUE, "revenue")) as number,
      8,
    );
    await paintedBand(canvasElement, "iqr");
  },
};
