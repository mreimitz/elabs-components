/**
 * `analytics[]` on the containers (RM-138 / RM-139): computed lines and bands
 * through the annotation layer, derived series through the analytics layer,
 * the legend entries, the tooltip rows and the accessible description.
 */
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) => React.createElement("div", null, children({ width: 900, height: 400 })),
  };
});
vi.mock("react-use-measure", () => ({
  default: () => [() => undefined, { width: 900, height: 400 }],
}));

import { AutoChart } from "../../auto-chart";
import { Bar } from "../bar";
import { BarChart } from "../bar-chart";
import { CandlestickChart } from "../candlestick-chart";
import { ChartConfigProvider } from "../chart-config-context";
import { DistributionChart } from "../distribution/distribution-chart";
import { Line } from "../line";
import { LABEL_LINE_HEIGHT } from "../labels/use-chart-labels";
import { LineChart } from "../line-chart";
import { ReferenceLine } from "../reference-line";
import { Scatter, ScatterChart } from "../scatter-chart";
import {
  CAMPAIGNS,
  DAILY_OHLC,
  DAILY_SIGNUPS,
  LIFE_BY_YEAR,
  MONTHLY_REVENUE,
  PRODUCT_LINES,
  PRODUCT_SERIES,
  RESPONSE_TIMES,
  TEAM_SCORES,
} from "./analytics-fixtures";
import { fitModel } from "./regression";
import { confidenceInterval, mean, quantile } from "./stats";
import { windowReduce } from "./window";

afterEach(cleanup);

beforeAll(() => {
  Object.defineProperty(SVGElement.prototype, "getTotalLength", {
    configurable: true,
    value: () => 100,
  });
});

function describedBy(container: HTMLElement): string {
  const figure = container.querySelector('[role="figure"]');
  const id = figure?.getAttribute("aria-describedby");
  return (id ? container.querySelector(`[id="${id}"]`)?.textContent : "") ?? "";
}

function samples(el: Element | null): Array<[number, number]> {
  return JSON.parse(el?.getAttribute("data-points") ?? "[]") as Array<[number, number]>;
}

describe("computed lines and bands (RM-138)", () => {
  it("an average line lands at the mean, labelled and described as “Average 73.8”", () => {
    const { container } = render(
      <LineChart
        accessibleLabel="Life expectancy"
        analytics={[{ kind: "line", value: "mean" }]}
        data={LIFE_BY_YEAR}
      >
        <Line dataKey="years" />
      </LineChart>,
    );
    const line = container.querySelector('[data-slot="chart-annotations-line"]');
    expect(Number(line?.getAttribute("data-value"))).toBeCloseTo(73.8, 10);
    expect(line?.textContent).toBe("Average 73.8");
    expect(describedBy(container)).toContain("Average 73.8.");
  });

  it("keeps the auto summary and appends the analytics sentence", () => {
    const { container } = render(
      <LineChart
        accessibleLabel="Life expectancy"
        analytics={[{ kind: "line", value: "mean" }]}
        data={LIFE_BY_YEAR}
      >
        <Line dataKey="years" />
      </LineChart>,
    );
    const text = describedBy(container);
    expect(text.length).toBeGreaterThan("Average 73.8.".length);
    expect(text.endsWith("Average 73.8.")).toBe(true);
  });

  it("`when` false renders nothing; label modes value / none / custom", () => {
    const { container } = render(
      <LineChart
        analytics={[
          { kind: "line", value: "mean", when: () => false },
          { kind: "line", value: "max", label: "value", id: "v" },
          { kind: "line", value: "min", label: "none", id: "n" },
          { kind: "line", value: "median", label: "Typical year", id: "c" },
        ]}
        data={LIFE_BY_YEAR}
      >
        <Line dataKey="years" />
      </LineChart>,
    );
    const lines = [...container.querySelectorAll('[data-slot="chart-annotations-line"]')];
    expect(lines.map((l) => l.getAttribute("data-analytic"))).toEqual(["v", "n", "c"]);
    expect(lines[0]?.textContent).toBe("77.3");
    expect(lines[1]?.textContent).toBe("");
    expect(lines[2]?.textContent).toBe("Typical year");
  });

  it("clip hides a line outside the domain; extend grows the domain to show it", () => {
    const threshold = 400;
    const clip = render(
      <LineChart analytics={[{ kind: "line", value: threshold }]} data={MONTHLY_REVENUE}>
        <Line dataKey="revenue" />
      </LineChart>,
    );
    expect(clip.container.querySelector('[data-slot="chart-annotations-line"]')).toBeNull();
    cleanup();
    const extend = render(
      <LineChart
        analytics={[{ kind: "line", value: threshold, ifOverflow: "extend" }]}
        data={MONTHLY_REVENUE}
      >
        <Line dataKey="revenue" />
      </LineChart>,
    );
    expect(extend.container.querySelector('[data-slot="chart-annotations-line"]')).not.toBeNull();
  });

  it("a quartile band on a horizontal bar chart runs along x", () => {
    const values = TEAM_SCORES.map((d) => d.nps);
    const { container } = render(
      <BarChart
        analytics={[{ kind: "band", spread: { percentiles: [25, 75] } }]}
        data={TEAM_SCORES}
        orientation="horizontal"
        xDataKey="team"
      >
        <Bar dataKey="nps" />
      </BarChart>,
    );
    const band = container.querySelector('[data-slot="chart-annotations-range"]');
    const [from, to] = (band?.getAttribute("data-value") ?? "").split(",").map(Number);
    expect(from).toBeCloseTo(quantile(values, 0.25) as number, 10);
    expect(to).toBeCloseTo(quantile(values, 0.75) as number, 10);
    expect(band?.querySelector("rect")?.getAttribute("height")).not.toBeNull();
  });

  it("scatter takes a computed line on each axis", () => {
    const { container } = render(
      <ScatterChart
        analytics={[
          { kind: "line", value: "mean", id: "y-mean" },
          { kind: "line", axis: "x", value: "mean", id: "x-mean" },
        ]}
        data={CAMPAIGNS}
        xDataKey="spend"
        xScale="linear"
      >
        <Scatter dataKey="revenue" />
      </ScatterChart>,
    );
    const byId = (id: string) =>
      container.querySelector(`[data-slot="chart-annotations-line"][data-analytic="${id}"]`);
    expect(Number(byId("y-mean")?.getAttribute("data-value"))).toBeCloseTo(
      mean(CAMPAIGNS.map((c) => c.revenue)) as number,
      8,
    );
    expect(Number(byId("x-mean")?.getAttribute("data-value"))).toBeCloseTo(
      mean(CAMPAIGNS.map((c) => c.spend)) as number,
      8,
    );
  });

  it("ReferenceLine value accepts a statistic", () => {
    const { container } = render(
      <LineChart data={LIFE_BY_YEAR}>
        <Line dataKey="years" />
        <ReferenceLine label="computation" value="mean" />
      </LineChart>,
    );
    const rule = container.querySelector('[data-slot="chart-reference-line"]');
    expect(Number(rule?.getAttribute("data-value"))).toBeCloseTo(73.8, 10);
    expect(rule?.textContent).toBe("Average 73.8");
  });

  it("DistributionChart draws a CI band over valueKey", () => {
    const ci = confidenceInterval(
      RESPONSE_TIMES.map((r) => r.hours),
      0.95,
    );
    const { container } = render(
      <div style={{ height: 300 }}>
        <DistributionChart
          analytics={[{ kind: "band", spread: { ci: 0.95 } }]}
          data={RESPONSE_TIMES}
          kind="box"
          valueKey="hours"
        />
      </div>,
    );
    const band = container.querySelector('[data-slot="distribution-chart-reference-band"]');
    const [from, to] = (band?.getAttribute("data-value") ?? "").split(",").map(Number);
    expect(from).toBeCloseTo(ci?.lower as number, 8);
    expect(to).toBeCloseTo(ci?.upper as number, 8);
  });
});

describe("derived series (RM-139)", () => {
  it("a trend's samples equal fitModel's predict; the legend lists it with r²", () => {
    const points = CAMPAIGNS.map((c) => ({ x: c.spend, y: c.revenue }));
    const fit = fitModel(points, { poly: 3 });
    const { container } = render(
      <ScatterChart
        analytics={[{ kind: "trend", model: { poly: 3 }, id: "poly" }]}
        data={CAMPAIGNS}
        legend
        xDataKey="spend"
        xScale="linear"
      >
        <Scatter dataKey="revenue" />
      </ScatterChart>,
    );
    const path = container.querySelector('[data-slot="analytic-series"][data-analytic="poly"]');
    const pts = samples(path);
    expect(pts.length).toBeGreaterThan(10);
    for (const [x, y] of [pts[0], pts[20], pts.at(-1)] as Array<[number, number]>) {
      expect(y).toBeCloseTo(fit?.predict(x) as number, 8);
    }
    const legend = container.querySelector('[data-slot="container-legend-root"]');
    expect(legend?.textContent).toContain(`r² ${fit?.rSquared?.toFixed(2)}`);
    expect(container.querySelector('[data-slot="chart-legend-dashed-marker"]')).not.toBeNull();
  });

  it("a replacing moving average hides its measure and takes its token", () => {
    const k = 7;
    const expected = windowReduce(
      DAILY_SIGNUPS.map((d) => d.signups),
      { k, reduce: "mean" },
    );
    const { container } = render(
      <LineChart analytics={[{ kind: "window", k, replace: true, id: "ma" }]} data={DAILY_SIGNUPS}>
        <Line dataKey="signups" stroke="var(--chart-2)" />
      </LineChart>,
    );
    const series = container.querySelector('[data-slot="analytic-series"][data-analytic="ma"]');
    const pts = samples(series);
    expect(pts[30]?.[1]).toBeCloseTo(expected[30] as number, 10);
    expect(series?.querySelector("path")?.getAttribute("stroke")).toBe("var(--chart-2)");
  });

  it("a forecast extends past the data and is dashed in the muted ink", () => {
    const { container } = render(
      <LineChart
        accessibleLabel="Revenue"
        analytics={[{ kind: "forecast", horizon: 6, season: 12, id: "fc" }]}
        data={MONTHLY_REVENUE}
      >
        <Line dataKey="revenue" />
      </LineChart>,
    );
    const series = container.querySelector('[data-slot="analytic-series"][data-analytic="fc"]');
    expect(samples(series)).toHaveLength(7);
    const path = series?.querySelector('[data-slot="analytic-series-path"]');
    expect(path?.getAttribute("stroke")).toBe("var(--chart-foreground-muted)");
    expect(path?.getAttribute("stroke-dasharray")).toBeTruthy();
    expect(describedBy(container)).toContain("A 6-step forecast of revenue");
  });

  it("per-series trends on a three-series line chart", () => {
    const { container } = render(
      <LineChart
        analytics={PRODUCT_SERIES.map((s) => ({ kind: "trend" as const, of: s.key, id: s.key }))}
        data={PRODUCT_LINES}
        legend
      >
        {PRODUCT_SERIES.map((s) => (
          <Line dataKey={s.key} key={s.key} name={s.label} stroke={s.color} />
        ))}
      </LineChart>,
    );
    expect(container.querySelectorAll('[data-slot="analytic-series"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-slot="chart-legend-dashed-marker"]')).toHaveLength(3);
  });

  it("toggling a series off dims its trend's legend entry too; the entry is inert until the series returns", () => {
    const first = PRODUCT_SERIES[0]!;
    const { container } = render(
      <LineChart
        analytics={PRODUCT_SERIES.map((s) => ({ kind: "trend" as const, of: s.key, id: s.key }))}
        data={PRODUCT_LINES}
        legend={{ interactive: "toggle" }}
      >
        {PRODUCT_SERIES.map((s) => (
          <Line dataKey={s.key} key={s.key} name={s.label} stroke={s.color} />
        ))}
      </LineChart>,
    );
    const legend = container.querySelector('[data-slot="container-legend-root"]')!;
    const buttons = () => Array.from(legend.querySelectorAll<HTMLButtonElement>("button"));
    const pressed = () => buttons().map((b) => b.getAttribute("aria-pressed"));
    const trendOf = () => buttons().find((b) => b.textContent?.includes(`Trend · ${first.label}`))!;
    expect(pressed()).toEqual(["true", "true", "true", "true", "true", "true"]);

    fireEvent.click(buttons()[0]!);
    expect(buttons()[0]).toHaveAttribute("aria-pressed", "false");
    expect(trendOf()).toHaveAttribute("aria-pressed", "false");
    expect(
      container.querySelector(`[data-slot="analytic-series"][data-analytic="${first.key}"]`),
    ).toBeNull();

    // The dimmed trend follows its source: clicking it changes nothing …
    fireEvent.click(trendOf());
    expect(trendOf()).toHaveAttribute("aria-pressed", "false");
    // … and re-showing the series brings the trend back with it.
    fireEvent.click(buttons()[0]!);
    expect(trendOf()).toHaveAttribute("aria-pressed", "true");
    expect(
      container.querySelector(`[data-slot="analytic-series"][data-analytic="${first.key}"]`),
    ).not.toBeNull();
  });

  it("error bars by field on bars (after the bars settle)", async () => {
    const { container } = render(
      <BarChart
        analytics={[{ kind: "errorBars", low: "low", high: "high", id: "err" }]}
        animationDuration={10}
        data={TEAM_SCORES}
        xDataKey="team"
      >
        <Bar dataKey="nps" />
      </BarChart>,
    );
    const query = () =>
      container.querySelectorAll('[data-slot="analytic-series"][data-analytic="err"] [data-low]');
    await waitFor(() => expect(query()).toHaveLength(TEAM_SCORES.length));
    const whiskers = query();
    expect(whiskers[0]?.getAttribute("data-low")).toBe("36");
  });

  it("candlestick draws a moving average of the closes", () => {
    const { container } = render(
      <CandlestickChart analytics={[{ kind: "window", k: 20, id: "sma" }]} data={DAILY_OHLC}>
        <></>
      </CandlestickChart>,
    );
    const pts = samples(
      container.querySelector('[data-slot="analytic-series"][data-analytic="sma"]'),
    );
    const expected = windowReduce(
      DAILY_OHLC.map((d) => d.close),
      { k: 20, reduce: "mean" },
    );
    expect(pts[40]?.[1]).toBeCloseTo(expected[40] as number, 10);
  });

  it("names a derived series with an end tag while no legend lists it, and drops the tag once one does", async () => {
    // CandlestickChart has no legend engine: the moving averages name themselves.
    const { container } = render(
      <CandlestickChart
        analytics={[
          { kind: "window", k: 20, id: "sma", label: "20-day average" },
          { kind: "window", k: 50, id: "ema", reduce: "ewm", label: "EMA 50" },
        ]}
        data={DAILY_OHLC}
      >
        <></>
      </CandlestickChart>,
    );
    const tags = [...container.querySelectorAll('[data-slot="analytic-series-end-label"]')];
    expect(tags.map((t) => t.textContent)).toEqual(["20-day average", "EMA 50"]);
    // Two tags never share a line box, and both sit inside the plot.
    const ys = tags.map((t) => Number(t.getAttribute("y")));
    expect(Math.abs((ys[0] as number) - (ys[1] as number))).toBeGreaterThanOrEqual(14);
    for (const y of ys) expect(y).toBeGreaterThan(0);
    for (const t of tags) expect(t.getAttribute("fill")).toContain("var(--chart-label)");
    cleanup();

    // A line chart with its legend on: the legend names the trend, no tag.
    const withLegend = render(
      <LineChart analytics={[{ kind: "trend", id: "t" }]} data={MONTHLY_REVENUE} legend>
        <Line dataKey="revenue" name="Revenue" />
      </LineChart>,
    );
    await waitFor(() => {
      expect(
        withLegend.container.querySelector('[data-slot="container-legend-root"]'),
      ).not.toBeNull();
    });
    expect(
      withLegend.container.querySelector('[data-slot="analytic-series-end-label"]'),
    ).toBeNull();
    // `legend` unset: the same chart tags its trend.
    cleanup();
    const noLegend = render(
      <LineChart analytics={[{ kind: "trend", id: "t" }]} data={MONTHLY_REVENUE}>
        <Line dataKey="revenue" name="Revenue" />
      </LineChart>,
    );
    expect(
      noLegend.container.querySelector('[data-slot="analytic-series-end-label"]'),
    ).not.toBeNull();
    // The narrow tier drops in-plot labels; the tooltip and description keep the name.
    cleanup();
    const narrow = render(
      <ChartConfigProvider value={{ breakpoint: "narrow" }}>
        <LineChart analytics={[{ kind: "trend", id: "t" }]} data={MONTHLY_REVENUE}>
          <Line dataKey="revenue" name="Revenue" />
        </LineChart>
      </ChartConfigProvider>,
    );
    expect(narrow.container.querySelector('[data-slot="analytic-series"]')).not.toBeNull();
    expect(narrow.container.querySelector('[data-slot="analytic-series-end-label"]')).toBeNull();
  });

  it("steps an end tag off a reference line's label when the path ends on the line", async () => {
    // A 1-point window ends exactly on the last revenue value; the plan line
    // sits there too, with its label at the right edge above the rule.
    const last = MONTHLY_REVENUE[MONTHLY_REVENUE.length - 1]!.revenue;
    const tagAt = async (
      annotations?: { kind: "line"; y: number; label?: string }[],
      child?: ReactNode,
    ) => {
      const { container } = render(
        <LineChart
          analytics={[{ kind: "window", k: 1, id: "w", label: "Trailing" }]}
          annotations={annotations}
          data={MONTHLY_REVENUE}
        >
          <Line dataKey="revenue" name="Revenue" />
          {child}
        </LineChart>,
      );
      const tag = container.querySelector('[data-slot="analytic-series-end-label"]');
      expect(tag).not.toBeNull();
      // A `ReferenceLine` registers its label box in an effect: settle first.
      await waitFor(() => expect(tag!.isConnected).toBe(true));
      await new Promise((r) => setTimeout(r, 0));
      const y = Number(
        container.querySelector('[data-slot="analytic-series-end-label"]')!.getAttribute("y"),
      );
      cleanup();
      return y;
    };
    const alone = await tagAt();
    const unlabelled = await tagAt([{ kind: "line", y: last }]);
    const labelled = await tagAt([{ kind: "line", y: last, label: "Plan" }]);
    const reference = await tagAt(undefined, <ReferenceLine label="Plan" value={last} />);
    // An unlabelled rule occupies nothing; a labelled one — an annotation or a
    // `ReferenceLine` child — pushes the tag a full line box away.
    expect(unlabelled).toBe(alone);
    expect(Math.abs(labelled - alone)).toBeGreaterThanOrEqual(LABEL_LINE_HEIGHT - 1);
    expect(Math.abs(reference - alone)).toBeGreaterThanOrEqual(LABEL_LINE_HEIGHT - 1);
  });

  it("the deprecated Scatter trend keeps its own painter and gains a legend entry", () => {
    const { container } = render(
      <ScatterChart data={CAMPAIGNS} legend xDataKey="spend" xScale="linear">
        <Scatter dataKey="revenue" trend="linear" />
      </ScatterChart>,
    );
    expect(container.querySelector('[data-slot="scatter-trend-line"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="analytic-series"]')).toBeNull();
    expect(container.querySelector('[data-slot="chart-legend-dashed-marker"]')).not.toBeNull();
  });
});

describe("AutoChart spec.analytics", () => {
  it("renders spec.analytics", () => {
    const { container } = render(
      <AutoChart
        spec={{
          type: "line",
          data: LIFE_BY_YEAR.map((d) => ({ year: d.date.toISOString(), years: d.years })),
          x: "year",
          series: ["years"],
          analytics: [{ kind: "line", value: "mean" }],
        }}
      />,
    );
    const line = container.querySelector('[data-slot="chart-annotations-line"]');
    expect(Number(line?.getAttribute("data-value"))).toBeCloseTo(73.8, 10);
  });
});
