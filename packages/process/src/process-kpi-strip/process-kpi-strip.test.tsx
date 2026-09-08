import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProcessKpiStrip, type ProcessKpiStripKpis } from "./process-kpi-strip";

afterEach(cleanup);

const kpis: ProcessKpiStripKpis = {
  cases: 240,
  events: 1_842,
  variants: 37,
  medianThroughput: 3 * 24 * 60 * 60 * 1000,
  reworkRate: 0.18,
};

describe("ProcessKpiStrip — rendering", () => {
  it("renders all six KPI labels", () => {
    render(<ProcessKpiStrip kpis={kpis} conformance={0.91} />);
    expect(screen.getByText("Cases")).toBeInTheDocument();
    expect(screen.getByText("Events")).toBeInTheDocument();
    expect(screen.getByText("Variants")).toBeInTheDocument();
    expect(screen.getByText("Median throughput")).toBeInTheDocument();
    expect(screen.getByText("Rework rate")).toBeInTheDocument();
    expect(screen.getByText("Conformance")).toBeInTheDocument();
  });
});

describe("ProcessKpiStrip — conformance unavailable (the RM-052 acceptance criterion)", () => {
  it("renders a real 'not available' state instead of a fabricated 0% when conformance is null", () => {
    render(<ProcessKpiStrip kpis={kpis} conformance={null} />);
    expect(screen.getByText("Not available")).toBeInTheDocument();
    expect(screen.getByText("Run conformance checking to see this metric.")).toBeInTheDocument();
    // Never render a numeric 0% in the gap — that would read as a real, alarming measurement.
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("renders a real percentage once conformance has actually been measured", () => {
    render(<ProcessKpiStrip kpis={kpis} conformance={0.91} />);
    expect(screen.queryByText("Not available")).not.toBeInTheDocument();
    expect(screen.getByText("91%")).toBeInTheDocument();
  });
});

describe("ProcessKpiStrip — loading", () => {
  it("does not throw and reserves the region's live-announcement role while loading", () => {
    render(<ProcessKpiStrip kpis={kpis} conformance={0.91} loading />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

// #359 — a sparkline's accessible name must describe the TREND, not repeat the tile's own
// label. Passing the label straight through overrides Sparkline's own, more informative
// default, so a screen-reader user hears the tile's name twice and learns nothing about
// the series.
describe("ProcessKpiStrip — trend sparkline accessible names (#359)", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const trends = {
    cases: [180, 190, 205, 198, 220, 232, 240],
    events: [1200, 1350, 1480, 1520, 1690, 1780, 1842],
    variants: [22, 25, 28, 30, 33, 35, 37],
    medianThroughput: [4 * DAY, 3.6 * DAY, 3.4 * DAY, 3.2 * DAY, 3.1 * DAY, 3.05 * DAY, 3 * DAY],
    reworkRate: [0.24, 0.22, 0.21, 0.2, 0.19, 0.18, 0.18],
    conformance: [0.82, 0.84, 0.86, 0.87, 0.89, 0.9, 0.91],
  };

  it("never names a sparkline the same as its tile's own label", () => {
    render(<ProcessKpiStrip kpis={kpis} conformance={0.91} trends={trends} />);
    for (const label of [
      "Cases",
      "Events",
      "Variants",
      "Median throughput",
      "Rework rate",
      "Conformance",
    ]) {
      const sparkline = screen.getByRole("img", { name: new RegExp(`^${label}, `) });
      expect(sparkline).not.toHaveAccessibleName(label);
    }
  });

  it("describes the direction and the formatted first/last values, using each tile's own formatter", () => {
    render(<ProcessKpiStrip kpis={kpis} conformance={0.91} trends={trends} />);

    expect(screen.getByRole("img", { name: /^Cases,/ })).toHaveAccessibleName(
      "Cases, 7-period trend, rising from 180 to 240",
    );
    expect(screen.getByRole("img", { name: /^Events,/ })).toHaveAccessibleName(
      "Events, 7-period trend, rising from 1,200 to 1,842",
    );
    expect(screen.getByRole("img", { name: /^Variants,/ })).toHaveAccessibleName(
      "Variants, 7-period trend, rising from 22 to 37",
    );
    // Duration, formatted with the same `formatDurationMs` the tile's own value uses —
    // not a raw millisecond figure.
    expect(screen.getByRole("img", { name: /^Median throughput,/ })).toHaveAccessibleName(
      "Median throughput, 7-period trend, falling from 4.0 d to 3.0 d",
    );
    // Percentage, formatted the same way the tile's `valueFormat="percent"` renders it —
    // not the raw 0..1 fraction.
    expect(screen.getByRole("img", { name: /^Rework rate,/ })).toHaveAccessibleName(
      "Rework rate, 7-period trend, falling from 24% to 18%",
    );
    expect(screen.getByRole("img", { name: /^Conformance,/ })).toHaveAccessibleName(
      "Conformance, 7-period trend, rising from 82% to 91%",
    );
  });
});
