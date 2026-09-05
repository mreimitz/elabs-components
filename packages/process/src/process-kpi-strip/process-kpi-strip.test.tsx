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
