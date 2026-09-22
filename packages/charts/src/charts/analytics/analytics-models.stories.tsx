import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, waitFor } from "storybook/test";
import { Bar } from "../bar";
import { BarChart } from "../bar-chart";
import { BarXAxis } from "../bar-x-axis";
import { Candlestick } from "../candlestick";
import { CandlestickChart } from "../candlestick-chart";
import { Grid } from "../grid";
import { Line } from "../line";
import { LineChart } from "../line-chart";
import { Scatter, ScatterChart } from "../scatter-chart";
import { ChartTooltip } from "../tooltip";
import { XAxis } from "../x-axis";
import { YAxis } from "../y-axis";
import {
  CAMPAIGNS,
  DAILY_OHLC,
  DAILY_SIGNUPS,
  MONTHLY_REVENUE,
  MONTHLY_TEMPERATURE,
  PRODUCT_LINES,
  PRODUCT_SERIES,
  TEAM_SCORES,
} from "./analytics-fixtures";
import { forecastHoltWinters } from "./forecast";
import { fitModel } from "./regression";
import type { AnalyticTrendModel } from "./types";
import { windowReduce } from "./window";

/**
 * Charts / Analytics / Models — derived series (RM-139, ADR 0040 §1).
 *
 * `trend`, `window`, `forecast` and `errorBars` are computed once from the
 * rows and drawn on the family's own scales: a dashed path in the muted ink
 * for a model, the series token only for a moving average that `replace`s its
 * measure. Each derived series joins the legend (dashed marker, the model's
 * r²), the tooltip (a muted row) and the figure description (one sentence).
 *
 * Every play function reads the painted samples (`data-points`: `[x, y]` per
 * sample, x in the data's own units — epoch ms on a time axis) and compares
 * them with RM-137's maths on the same seeded fixture.
 */
const meta = {
  title: "Charts/Analytics/Models",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          'Trend lines (linear, log, exp, pow, polynomial, loess), rolling windows (mean, median, sum, min, max, exponential), additive Holt-Winters forecasts with a prediction band, and per-datum error bars — `analytics={[{ kind: "trend", model: { poly: 3 } }]}` and friends.',
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

type Sample = [number, number];

/** The painted samples of derived series `id`. */
async function derivedSamples(canvas: HTMLElement, id: string): Promise<Sample[]> {
  const el = await waitFor(
    () => {
      const found = canvas.querySelector(`[data-slot="analytic-series"][data-analytic="${id}"]`);
      expect(found).not.toBeNull();
      return found as Element;
    },
    { timeout: 4000 },
  );
  return JSON.parse(el.getAttribute("data-points") ?? "[]") as Sample[];
}

/** Three samples spread across the series: first, middle, last. */
function threeOf(samples: readonly Sample[]): Sample[] {
  return [samples[0], samples[Math.floor(samples.length / 2)], samples.at(-1)] as Sample[];
}

function legendText(canvas: HTMLElement): string {
  return canvas.querySelector('[data-slot="container-legend-root"]')?.textContent ?? "";
}

function dashedLegendMarkers(canvas: HTMLElement): number {
  return canvas.querySelectorAll(
    '[data-slot="container-legend-root"] [data-slot="chart-legend-dashed-marker"]',
  ).length;
}

/** Moves the pointer over the plot at `fraction` of its width; resolves with the derived tooltip rows' text. */
async function hoverDerivedRows(canvas: HTMLElement, fraction: number): Promise<string[]> {
  // The chart's own <svg> (legend swatches are small svgs too): the one with a plot group.
  const svg = [...canvas.querySelectorAll("svg")].find((el) =>
    el.querySelector(":scope > g[transform]"),
  ) as SVGSVGElement;
  const plot = svg.querySelector(":scope > g[transform]") as SVGGElement;
  return waitFor(
    () => {
      const box = svg.getBoundingClientRect();
      fireEvent.mouseMove(plot, {
        clientX: box.left + box.width * fraction,
        clientY: box.top + box.height / 2,
      });
      const rows = [...document.querySelectorAll('[data-slot="chart-tooltip-derived-row"]')];
      expect(rows.length).toBeGreaterThan(0);
      return rows.map((row) => row.textContent ?? "");
    },
    { timeout: 4000 },
  );
}

const campaignPoints = CAMPAIGNS.map((c) => ({ x: c.spend, y: c.revenue }));

// ── 1. Three models on one scatter ───────────────────────────────────────────

const MODELS: Array<{ id: string; model: AnalyticTrendModel }> = [
  { id: "linear", model: "linear" },
  { id: "poly3", model: { poly: 3 } },
  { id: "loess", model: { loess: 0.35 } },
];

/**
 * **Linear, cubic and loess trends on the same scatter.** Three dashed
 * overlays in the muted ink; the legend lists all three after the series,
 * with r² for the two least-squares fits (a loess has no r²).
 */
export const ThreeTrendModels: Story = {
  render: () => (
    <ScatterChart
      accessibleLabel="Ad spend against revenue, three trend models"
      analytics={MODELS.map(({ id, model }) => ({ kind: "trend" as const, id, model }))}
      data={CAMPAIGNS}
      legend
      plotHeight={340}
      xDataKey="spend"
      xScale="linear"
    >
      <Grid horizontal />
      <Scatter dataKey="revenue" name="Campaign" />
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </ScatterChart>
  ),
  play: async ({ canvasElement }) => {
    for (const { id, model } of MODELS) {
      const fit = fitModel(campaignPoints, model);
      const samples = await derivedSamples(canvasElement, id);
      for (const [x, y] of threeOf(samples)) {
        await expect(y).toBeCloseTo(fit?.predict(x) as number, 6);
      }
    }
    await waitFor(() => expect(dashedLegendMarkers(canvasElement)).toBe(3));
    const text = legendText(canvasElement);
    const linear = fitModel(campaignPoints, "linear");
    const cubic = fitModel(campaignPoints, { poly: 3 });
    await expect(text).toContain(`Trend (r² ${linear?.rSquared?.toFixed(2)})`);
    await expect(text).toContain(`(r² ${cubic?.rSquared?.toFixed(2)})`);
    await expect(text).toContain("Smoothed trend");
    await expect(text).not.toContain("Smoothed trend (r²");
  },
};

// ── 2. Trend per series ──────────────────────────────────────────────────────

/**
 * **One trend per series on a three-series `LineChart`.** Each `of` names its
 * measure; the legend reads "Trend · Atlas (r² …)" so three dashed lines stay
 * attributable. Toggling a series off hides its trend too.
 */
export const TrendPerSeries: Story = {
  render: () => (
    <LineChart
      accessibleLabel="Three product lines with their trends"
      analytics={PRODUCT_SERIES.map((s) => ({ kind: "trend" as const, of: s.key, id: s.key }))}
      data={PRODUCT_LINES}
      legend={{ interactive: "toggle" }}
      plotHeight={300}
    >
      <Grid horizontal />
      {PRODUCT_SERIES.map((s) => (
        <Line dataKey={s.key} key={s.key} name={s.label} stroke={s.color} />
      ))}
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </LineChart>
  ),
  play: async ({ canvasElement }) => {
    for (const s of PRODUCT_SERIES) {
      const fit = fitModel(
        PRODUCT_LINES.map((row) => ({ x: (row.date as Date).getTime(), y: row[s.key] as number })),
        "linear",
      );
      for (const [x, y] of threeOf(await derivedSamples(canvasElement, s.key))) {
        await expect(y).toBeCloseTo(fit?.predict(x) as number, 6);
      }
    }
    await waitFor(() => expect(dashedLegendMarkers(canvasElement)).toBe(3));
    await expect(legendText(canvasElement)).toContain("Trend · Atlas (r²");
    // Toggle Atlas off: its trend leaves the plot with it.
    // The legend names a `Line` by its dataKey; the trend by the series name.
    const atlas = [...canvasElement.querySelectorAll("button[aria-pressed]")].find(
      (b) => b.textContent === "atlas",
    ) as HTMLElement;
    fireEvent.click(atlas);
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-slot="analytic-series"][data-analytic="atlas"]'),
      ).toBeNull(),
    );
  },
};

// ── 3. A 7-day moving average replacing the daily series ─────────────────────

/**
 * **`window` k=7 with `replace: true`.** The noisy daily series is swapped for
 * its 7-point moving average, which takes the measure's token and the name
 * "Sign-ups · 7-point moving average" — a transform OF the measure, not a
 * model beside it, so it is solid and in the series colour.
 */
export const MovingAverageReplace: Story = {
  render: () => (
    <LineChart
      accessibleLabel="Daily sign-ups, 7-day moving average"
      analytics={[{ kind: "window", k: 7, replace: true, id: "ma7" }]}
      data={DAILY_SIGNUPS}
      legend
      plotHeight={280}
    >
      <Grid horizontal />
      <Line dataKey="signups" name="Sign-ups" stroke="var(--chart-2)" />
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </LineChart>
  ),
  play: async ({ canvasElement }) => {
    const expected = windowReduce(
      DAILY_SIGNUPS.map((d) => d.signups),
      { k: 7, reduce: "mean" },
    );
    const samples = await derivedSamples(canvasElement, "ma7");
    for (const i of [6, 60, 119]) {
      await expect(samples[i]?.[0]).toBe(DAILY_SIGNUPS[i]?.date.getTime());
      await expect(samples[i]?.[1]).toBeCloseTo(expected[i] as number, 10);
    }
    const path = canvasElement.querySelector(
      '[data-analytic="ma7"] [data-slot="analytic-series-path"]',
    );
    await expect(path?.getAttribute("stroke")).toBe("var(--chart-2)");
    await expect(path?.getAttribute("stroke-dasharray")).toBeNull();
    await expect(legendText(canvasElement)).toContain("Sign-ups · 7-point moving average");
    await expect(dashedLegendMarkers(canvasElement)).toBe(0);
  },
};

// ── 4. An exponential average beside the series ──────────────────────────────

/**
 * **`window` with `reduce: "ewm"` beside the measure.** A 14-point
 * exponentially weighted mean in the muted ink over the raw daily series; the
 * tooltip adds it as a muted row under the measured value.
 */
export const ExponentialAverageBeside: Story = {
  render: () => (
    <LineChart
      accessibleLabel="Daily sign-ups with an exponential average"
      analytics={[{ kind: "window", k: 14, reduce: "ewm", id: "ewm" }]}
      animationDuration={300}
      data={DAILY_SIGNUPS}
      legend
      plotHeight={280}
    >
      <Grid horizontal />
      <Line dataKey="signups" name="Sign-ups" stroke="var(--chart-2)" strokeWidth={1.5} />
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </LineChart>
  ),
  play: async ({ canvasElement }) => {
    const expected = windowReduce(
      DAILY_SIGNUPS.map((d) => d.signups),
      { k: 14, reduce: "ewm" },
    );
    const samples = await derivedSamples(canvasElement, "ewm");
    for (const i of [13, 70, 119]) {
      await expect(samples[i]?.[1]).toBeCloseTo(expected[i] as number, 10);
    }
    const path = canvasElement.querySelector(
      '[data-analytic="ewm"] [data-slot="analytic-series-path"]',
    );
    await expect(path?.getAttribute("stroke")).toBe("var(--chart-foreground-muted)");
    const rows = await hoverDerivedRows(canvasElement, 0.5);
    await expect(rows[0]).toMatch(/^14-point exponential average[\d.,]+$/);
  },
};

// ── 5. A six-month forecast with a 95 % band ─────────────────────────────────

/**
 * **`forecast` — six months ahead, seasonal, with a 95 % prediction band.**
 * Additive Holt-Winters with a 12-month season; the x axis extends to show
 * the horizon, the path is dashed from the last actual month, and the band
 * widens with the horizon. It never paints in the series colour.
 */
export const SixMonthForecast: Story = {
  render: () => (
    <LineChart
      accessibleLabel="Monthly revenue with a six-month forecast"
      analytics={[{ kind: "forecast", horizon: 6, season: 12, interval: 0.95, id: "fc" }]}
      data={MONTHLY_REVENUE}
      legend
      plotHeight={300}
    >
      <Grid horizontal />
      <Line dataKey="revenue" name="Revenue" stroke="var(--chart-1)" />
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </LineChart>
  ),
  play: async ({ canvasElement }) => {
    const fc = forecastHoltWinters(
      MONTHLY_REVENUE.map((r) => r.revenue),
      { horizon: 6, season: 12, interval: 0.95 },
    );
    const samples = await derivedSamples(canvasElement, "fc");
    await expect(samples).toHaveLength(7);
    // The first sample is the last actual month; then the six forecast steps.
    await expect(samples[0]?.[1]).toBe(MONTHLY_REVENUE.at(-1)?.revenue);
    for (const h of [1, 3, 6]) {
      await expect(samples[h]?.[1]).toBeCloseTo(fc?.points[h - 1] as number, 8);
      await expect(samples[h]?.[0]).toBe(new Date(2025, h - 1, 1).getTime());
    }
    // The prediction band washes UNDER the series (its own back-pass group).
    await expect(
      canvasElement.querySelector(
        '[data-slot="analytic-series-band-layer"][data-analytic="fc"] [data-slot="analytic-series-band"]',
      ),
    ).not.toBeNull();
    const series = canvasElement.querySelector('[data-slot="analytic-series"][data-analytic="fc"]');
    const path = series?.querySelector('[data-slot="analytic-series-path"]');
    await expect(path?.getAttribute("stroke-dasharray")).toBeTruthy();
    await expect(path?.getAttribute("stroke")).toBe("var(--chart-foreground-muted)");
    await expect(legendText(canvasElement)).toContain("Forecast (95 % interval)");
    // The x domain reaches the horizon: the dashed path ends inside the plot,
    // at its right edge, not past it.
    const plotRect = series?.parentElement?.closest("g[transform]")?.querySelector(":scope > rect");
    const plotWidth = Number(plotRect?.getAttribute("width"));
    const box = (path as SVGGraphicsElement).getBBox();
    await expect(box.x + box.width).toBeLessThanOrEqual(plotWidth + 1);
    await expect(box.x + box.width).toBeGreaterThan(plotWidth * 0.95);
  },
};

// ── 6. SMA 20 / EMA 50 on a candlestick ──────────────────────────────────────

/**
 * **SMA 20 and EMA 50 on a `CandlestickChart`.** Moving averages of the
 * closes: a simple 20-session mean and a 50-session exponential one, both in
 * the muted ink beside the candles, labelled in the description.
 */
export const CandlestickMovingAverages: Story = {
  render: () => (
    <CandlestickChart
      accessibleLabel="Daily price with 20- and 50-session moving averages"
      analytics={[
        { kind: "window", k: 20, id: "sma20", label: "SMA 20" },
        { kind: "window", k: 50, reduce: "ewm", id: "ema50", label: "EMA 50" },
      ]}
      data={DAILY_OHLC}
      plotHeight={320}
    >
      <Grid horizontal />
      <Candlestick />
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </CandlestickChart>
  ),
  play: async ({ canvasElement }) => {
    const closes = DAILY_OHLC.map((d) => d.close);
    const sma = windowReduce(closes, { k: 20, reduce: "mean" });
    const ema = windowReduce(closes, { k: 50, reduce: "ewm" });
    const smaSamples = await derivedSamples(canvasElement, "sma20");
    const emaSamples = await derivedSamples(canvasElement, "ema50");
    for (const i of [19, 90, 159]) {
      await expect(smaSamples[i]?.[1]).toBeCloseTo(sma[i] as number, 10);
      await expect(emaSamples[i]?.[1]).toBeCloseTo(ema[i] as number, 10);
    }
    const figure = canvasElement.querySelector('[role="figure"]');
    const desc = canvasElement.querySelector(
      `[id="${figure?.getAttribute("aria-describedby")}"]`,
    )?.textContent;
    await expect(desc).toContain("A SMA 20 of Close.");
  },
};

// ── 7. Error bars by field on bars ───────────────────────────────────────────

/**
 * **Error bars from two fields on a `BarChart`.** `low`/`high` name each
 * estimate's bounds; the whiskers sit on the bar's own column and wait for
 * the bars to finish growing. The tooltip reads the range.
 */
export const ErrorBarsOnBars: Story = {
  render: () => (
    <BarChart
      accessibleLabel="Net promoter score by team, with 95 % intervals"
      analytics={[{ kind: "errorBars", low: "low", high: "high", id: "ci" }]}
      animationDuration={300}
      data={TEAM_SCORES}
      plotHeight={280}
      xDataKey="team"
    >
      <Grid horizontal />
      <Bar dataKey="nps" fill="var(--chart-3)" />
      <BarXAxis />
      <YAxis />
      <ChartTooltip />
    </BarChart>
  ),
  play: async ({ canvasElement }) => {
    const whiskers = await waitFor(
      () => {
        const found = canvasElement.querySelectorAll('[data-analytic="ci"] [data-low]');
        expect(found).toHaveLength(TEAM_SCORES.length);
        return [...found];
      },
      { timeout: 4000 },
    );
    for (const [i, row] of TEAM_SCORES.entries()) {
      await expect(Number(whiskers[i]?.getAttribute("data-low"))).toBe(row.low);
      await expect(Number(whiskers[i]?.getAttribute("data-high"))).toBe(row.high);
    }
  },
};

// ── 8. An error band by percent on a line ────────────────────────────────────

/**
 * **An error band by percent on a `LineChart`.** `{ low: { percent: 8 },
 * band: true }` — ±8 % of each month's value, drawn as a band behind the line
 * instead of whiskers. The tooltip shows the month's range as a muted row.
 */
export const ErrorBandByPercent: Story = {
  render: () => (
    <LineChart
      accessibleLabel="Mean monthly temperature, ±8 % measurement band"
      analytics={[{ kind: "errorBars", low: { percent: 8 }, band: true, id: "band" }]}
      animationDuration={300}
      data={MONTHLY_TEMPERATURE}
      plotHeight={260}
    >
      <Grid horizontal />
      <Line dataKey="temp" name="Temperature" stroke="var(--chart-4)" />
      <XAxis />
      <YAxis unit="°C" />
      <ChartTooltip />
    </LineChart>
  ),
  play: async ({ canvasElement }) => {
    const samples = await derivedSamples(canvasElement, "band");
    for (const i of [0, 12, 23]) {
      await expect(samples[i]?.[1]).toBe(MONTHLY_TEMPERATURE[i]?.temp);
    }
    await expect(
      canvasElement.querySelector(
        '[data-slot="analytic-series-band-layer"][data-analytic="band"] [data-slot="analytic-series-band"]',
      ),
    ).not.toBeNull();
    const rows = await hoverDerivedRows(canvasElement, 0.5);
    const match = /^Error range([\d.]+)–([\d.]+)$/.exec(rows[0] ?? "");
    await expect(match).not.toBeNull();
    await expect(Number(match?.[2])).toBeGreaterThan(Number(match?.[1]));
  },
};

// ── 9. A linear trend with its confidence band ───────────────────────────────

/**
 * **A linear trend with a 95 % confidence band** (`ci: 0.95`) and
 * `extent: "domain"` — the fit across the whole x domain, the band widening
 * away from the data's centre.
 */
export const TrendWithConfidenceBand: Story = {
  render: () => (
    <ScatterChart
      accessibleLabel="Ad spend against revenue, linear trend with a 95 % band"
      analytics={[{ kind: "trend", ci: 0.95, id: "fit" }]}
      data={CAMPAIGNS}
      legend
      plotHeight={300}
      xDataKey="spend"
      xScale="linear"
    >
      <Grid horizontal />
      <Scatter dataKey="revenue" name="Campaign" />
      <XAxis />
      <YAxis />
    </ScatterChart>
  ),
  play: async ({ canvasElement }) => {
    const fit = fitModel(campaignPoints, "linear", { ci: 0.95 });
    const samples = await derivedSamples(canvasElement, "fit");
    for (const [x, y] of threeOf(samples)) {
      await expect(y).toBeCloseTo(fit?.predict(x) as number, 6);
    }
    await expect(
      canvasElement.querySelector(
        '[data-slot="analytic-series-band-layer"][data-analytic="fit"] [data-slot="analytic-series-band"]',
      ),
    ).not.toBeNull();
  },
};
