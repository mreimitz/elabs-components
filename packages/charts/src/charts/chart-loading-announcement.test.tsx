/**
 * Line, Area, Composed and Bar show a VISIBLE loading label only when the caller sets
 * `loadingLabel`. Unset, they used to announce nothing while loading; they now announce the
 * catalogue's `charts.chart.loading`, as every other family does, in a visually hidden status
 * region — the screen does not change.
 *
 * The plot itself is not under test: `ChartParentSize` hands every chart a zero box, so the
 * inner chart draws nothing (jsdom has no SVG geometry) while the loading overlay, a sibling
 * of the plot, renders as it does in a browser.
 */

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@elabs-ai/components-ui";

vi.mock("./chart-parent-size", () => ({
  ChartParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => ReactNode;
  }) => children({ width: 0, height: 0 }),
}));

import { AREA_CHART_FIXTURE } from "../definitions/__fixtures__/area-chart.fixture";
import { BAR_CHART_FIXTURE } from "../definitions/__fixtures__/bar-chart.fixture";
import { COMPOSED_CHART_FIXTURE } from "../definitions/__fixtures__/composed-chart.fixture";
import { LINE_CHART_FIXTURE } from "../definitions/__fixtures__/line-chart.fixture";
import { Area } from "./area";
import { AreaChart } from "./area-chart";
import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import { ComposedChart } from "./composed-chart";
import { Line } from "./line";
import { LineChart } from "./line-chart";
import { SeriesBar } from "./series-bar";

afterEach(cleanup);

const OVERRIDE = "Diagramm lädt…";

type OptInLabelChart = (extra: {
  loadingLabel?: string;
  status?: "loading" | "ready";
}) => ReactElement;

const OPT_IN_LABEL: readonly [string, OptInLabelChart][] = [
  [
    "LineChart",
    (extra) => (
      <LineChart {...LINE_CHART_FIXTURE.props} status="loading" {...extra}>
        <Line dataKey="revenue" />
      </LineChart>
    ),
  ],
  [
    "AreaChart",
    (extra) => (
      <AreaChart {...AREA_CHART_FIXTURE.props} status="loading" {...extra}>
        <Area dataKey="revenue" />
      </AreaChart>
    ),
  ],
  [
    "ComposedChart",
    (extra) => (
      <ComposedChart {...COMPOSED_CHART_FIXTURE.props} status="loading" {...extra}>
        <SeriesBar dataKey="revenue" />
        <Line dataKey="profit" />
      </ComposedChart>
    ),
  ],
  [
    "BarChart",
    (extra) => (
      <BarChart {...BAR_CHART_FIXTURE.props} status="loading" {...extra}>
        <Bar dataKey="value" />
      </BarChart>
    ),
  ],
];

describe("Line, Area, Composed and Bar announce loading by default", () => {
  it.each(OPT_IN_LABEL)(
    "%s announces `charts.chart.loading` in a hidden status region",
    (_name, chart) => {
      const { container } = render(chart({}));
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("Loading chart…");
      expect(status).toHaveAttribute("aria-live", "polite");
      expect(status).toHaveClass("sr-only");
      expect(container.querySelector('[data-slot="chart-loading-announcement"]')).toBe(status);
      // No visible label: the shimmer label only renders for a caller's `loadingLabel`.
      expect(screen.queryByText("Loading")).toBeNull();
    },
  );

  it.each(OPT_IN_LABEL)("%s: a caller's `loadingLabel` still wins", (_name, chart) => {
    const { container } = render(chart({ loadingLabel: "Fetching prices" }));
    expect(screen.getByRole("status")).toHaveTextContent("Fetching prices");
    expect(screen.queryByText("Loading chart…")).toBeNull();
    expect(container.querySelector('[data-slot="chart-loading-announcement"]')).toBeNull();
  });

  it.each(OPT_IN_LABEL)("%s reads the `LocaleProvider`'s words", (_name, chart) => {
    render(
      <LocaleProvider locale="de-DE" messages={{ "charts.chart.loading": OVERRIDE }}>
        {chart({})}
      </LocaleProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent(OVERRIDE);
  });

  it.each(OPT_IN_LABEL)("%s announces nothing once it is ready", (_name, chart) => {
    const { container } = render(chart({ status: "ready" }));
    expect(screen.queryByText("Loading chart…")).toBeNull();
    expect(container.querySelector('[data-slot="chart-loading-announcement"]')).toBeNull();
  });
});
