/**
 * contract.test.tsx — the locking test for issue #364 ("Test to add").
 *
 * Three assertions, matching the issue verbatim:
 *   1. every doubled component renders under jsdom without throwing, given a
 *      valid props fixture.
 *   2. omitting a required prop, and passing data whose x values are not
 *      coercible to a valid Date, EACH throw `ChartContractError` — the
 *      assertion that proves the double is not a no-op stub.
 *   3. the received props round-trip out of the DOM via `readChartDoubleProps`.
 *
 * Plus a compile-time assignability check per family (a double that stops
 * accepting a prop the real component accepts fails `pnpm typecheck`, not this
 * file at runtime) and a CONSUMER-SHAPED regression: a component that renders
 * `<LineChart data={[{turn:"A"}]} xDataKey="turn">` under the module mock must
 * FAIL — the same input that passed green against a no-op stub while crashing
 * in production (the item-8 `RangeError: Invalid time value`).
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";
import {
  AreaChart,
  AutoChart,
  BarChart,
  CandlestickChart,
  ChartCard,
  ChartFrame,
  ChoroplethChart,
  ComposedChart,
  FunnelChart,
  Gantt,
  LineChart,
  LiveLineChart,
  MetricCard,
  MetricGrid,
  PieChart,
  RadarChart,
  RingChart,
  SankeyChart,
  ScatterChart,
  Sparkline,
} from "./doubles";
import {
  ChartContractError,
  configureChartTestDouble,
  readChartDoubleProps,
  resetChartTestDoubleConfig,
} from "./contract";
import type {
  AreaChartProps,
  AutoChartProps,
  BarChartProps,
  CandlestickChartProps,
  ChartCardProps,
  ChartFrameProps,
  ChoroplethChartProps,
  ComposedChartProps,
  FunnelChartProps,
  GanttProps,
  LineChartProps,
  LiveLineChartProps,
  MetricCardProps,
  MetricGridProps,
  PieChartProps,
  RadarChartProps,
  RingChartProps,
  SankeyChartProps,
  ScatterChartProps,
  SparklineProps,
} from "./index";

afterEach(() => {
  cleanup();
  resetChartTestDoubleConfig();
});

/** A minimal series marker — created via JSX (a REAL React element, `isValidElement`
 *  returns true), never mounted by the container double (only inspected). */
function FakeSeries(_props: { dataKey: string }) {
  return null;
}

// ── (1) valid-props fixtures render under jsdom without throwing ────────────

describe("chart test doubles — render under jsdom", () => {
  it("LineChart renders and stamps data-chart", () => {
    const { container } = render(
      <LineChart
        data={[
          { date: new Date("2024-01-01"), revenue: 10 },
          { date: new Date("2024-02-01"), revenue: 20 },
        ]}
      >
        {null}
      </LineChart>,
    );
    expect(container.querySelector('[data-chart="LineChart"]')).toBeInTheDocument();
  });

  it("AreaChart / BarChart / ComposedChart / ScatterChart / CandlestickChart render", () => {
    const rows = [
      { date: new Date("2024-01-01"), revenue: 10 },
      { date: new Date("2024-02-01"), revenue: 20 },
    ];
    let result = render(<AreaChart data={rows}>{null}</AreaChart>);
    expect(result.container.querySelector('[data-chart="AreaChart"]')).toBeInTheDocument();
    cleanup();
    result = render(<BarChart data={[{ name: "Jan", revenue: 10 }]}>{null}</BarChart>);
    expect(result.container.querySelector('[data-chart="BarChart"]')).toBeInTheDocument();
    cleanup();
    result = render(<ComposedChart data={rows}>{null}</ComposedChart>);
    expect(result.container.querySelector('[data-chart="ComposedChart"]')).toBeInTheDocument();
    cleanup();
    result = render(<ScatterChart data={rows}>{null}</ScatterChart>);
    expect(result.container.querySelector('[data-chart="ScatterChart"]')).toBeInTheDocument();
    cleanup();
    result = render(
      <CandlestickChart
        data={[{ date: new Date("2024-01-01"), open: 10, high: 12, low: 9, close: 11 }]}
      >
        {null}
      </CandlestickChart>,
    );
    expect(result.container.querySelector('[data-chart="CandlestickChart"]')).toBeInTheDocument();
  });

  it("LiveLineChart renders", () => {
    const { container } = render(
      <LiveLineChart data={[{ time: 1, value: 1 }]} value={1}>
        {null}
      </LiveLineChart>,
    );
    expect(container.querySelector('[data-chart="LiveLineChart"]')).toBeInTheDocument();
  });

  it("PieChart / RingChart / FunnelChart / RadarChart render", () => {
    let result = render(<PieChart data={[{ label: "A", value: 1 }]}>{null}</PieChart>);
    expect(result.container.querySelector('[data-chart="PieChart"]')).toBeInTheDocument();
    cleanup();
    result = render(<RingChart data={[{ label: "A", value: 1, maxValue: 10 }]}>{null}</RingChart>);
    expect(result.container.querySelector('[data-chart="RingChart"]')).toBeInTheDocument();
    cleanup();
    result = render(<FunnelChart data={[{ label: "A", value: 1 }]} />);
    expect(result.container.querySelector('[data-chart="FunnelChart"]')).toBeInTheDocument();
    cleanup();
    result = render(
      <RadarChart
        data={[{ label: "A", values: { speed: 1 } }]}
        metrics={[{ key: "speed", label: "Speed" }]}
      >
        {null}
      </RadarChart>,
    );
    expect(result.container.querySelector('[data-chart="RadarChart"]')).toBeInTheDocument();
  });

  it("ChoroplethChart / SankeyChart render", () => {
    let result = render(
      <ChoroplethChart data={{ type: "FeatureCollection", features: [] }}>{null}</ChoroplethChart>,
    );
    expect(result.container.querySelector('[data-chart="ChoroplethChart"]')).toBeInTheDocument();
    cleanup();
    result = render(<SankeyChart data={{ nodes: [], links: [] }}>{null}</SankeyChart>);
    expect(result.container.querySelector('[data-chart="SankeyChart"]')).toBeInTheDocument();
  });

  it("Gantt renders", () => {
    const { container } = render(
      <Gantt
        tasks={[
          { id: "1", name: "Task 1", start: new Date("2024-01-01"), end: new Date("2024-01-05") },
        ]}
      />,
    );
    expect(container.querySelector('[data-chart="Gantt"]')).toBeInTheDocument();
  });

  it("AutoChart renders", () => {
    const { container } = render(
      <AutoChart spec={{ type: "line", data: [{ x: "a", y: 1 }], x: "x", series: ["y"] }} />,
    );
    expect(container.querySelector('[data-chart="AutoChart"]')).toBeInTheDocument();
  });

  it("MetricCard / MetricGrid / ChartCard / ChartFrame / Sparkline (real, jsdom-safe already) render", () => {
    render(<MetricCard label="Revenue" value="$10k" />);
    render(<Sparkline values={[1, 2, 3]} />);
    render(
      <ChartCard title="Revenue">
        <div />
      </ChartCard>,
    );
    render(
      <ChartFrame title="Revenue">
        <div />
      </ChartFrame>,
    );
    render(
      <MetricGrid>
        <MetricCard label="Revenue" value="$10k" />
      </MetricGrid>,
    );
  });
});

// ── (2) missing required prop / invalid Date each throw ChartContractError ──

describe("chart test doubles — contract violations throw", () => {
  it("LineChart throws ChartContractError when `data` is missing", () => {
    expect(() =>
      render(
        // @ts-expect-error — intentionally omitting the required `data` prop
        <LineChart>{null}</LineChart>,
      ),
    ).toThrow(ChartContractError);
  });

  it("LineChart throws ChartContractError when a row's x value is not a valid Date", () => {
    expect(() =>
      render(<LineChart data={[{ date: "not-a-date", revenue: 10 }]}>{null}</LineChart>),
    ).toThrow(/not coercible to a valid Date/);
  });

  // #352 ⨯ #364 — the two wave-2 charts changes only collide here. `xScale="band"`
  // makes a non-Date x FIRST-CLASS on Line/Area/Composed, so a double that still
  // demanded a parseable Date would be STRICTER than the component it stands in
  // for and fail a test whose real chart renders fine.
  //
  // The x values below MUST be strings `new Date()` rejects. V8 parses far more
  // than ISO — `new Date("turn 1")` is 2001-01-01 and `new Date("run-7")` is
  // 2001-07-01 — so the obvious "turn 1" fixture sails through the Date branch
  // and the test passes whether or not the fix is present. `"turn A"` does not
  // parse; verified by mutation (delete the `xScale` guard in `contract.ts` and
  // these three go red, while the sibling default-scale case above stays red for
  // the opposite reason).
  it.each(["band", "linear"] as const)(
    "LineChart does NOT require a Date x value on xScale=%s",
    (xScale) => {
      expect(new Date("turn A").getTime()).toBeNaN(); // the fixture is genuinely unparseable
      expect(() =>
        render(
          <LineChart data={[{ date: "turn A", revenue: 10 }]} xScale={xScale}>
            {null}
          </LineChart>,
        ),
      ).not.toThrow();
    },
  );

  it("AreaChart does NOT require a Date x value on a band scale", () => {
    expect(new Date("step one").getTime()).toBeNaN();
    expect(() =>
      render(
        <AreaChart data={[{ date: "step one", revenue: 10 }]} xScale="band">
          {null}
        </AreaChart>,
      ),
    ).not.toThrow();
  });

  it("LineChart still requires a Date x value on the DEFAULT (time) scale", () => {
    expect(() =>
      render(<LineChart data={[{ date: "turn A", revenue: 10 }]}>{null}</LineChart>),
    ).toThrow(/not coercible to a valid Date/);
  });

  it("Gantt throws when a task's start/end is not a valid Date", () => {
    expect(() =>
      render(<Gantt tasks={[{ id: "1", name: "Task 1", start: "nope", end: "nope" }]} />),
    ).toThrow(ChartContractError);
  });

  it("BarChart throws when `data` is not an array", () => {
    expect(() =>
      render(
        // @ts-expect-error — `data` must be an array
        <BarChart data={{}}>{null}</BarChart>,
      ),
    ).toThrow(/must be an array/);
  });

  it("PieChart throws when a row is missing a required key", () => {
    expect(() =>
      render(
        // @ts-expect-error — rows must carry `value`
        <PieChart data={[{ label: "A" }]}>{null}</PieChart>,
      ),
    ).toThrow(/missing required key "value"/);
  });

  it("LineChart throws when a series declared INSIDE A FRAGMENT is absent from the rows", () => {
    // The real `extractLineConfigs` (packages/charts/src/charts/line-chart.tsx)
    // recurses into a child's own children, so it registers this series and then
    // reads a key the rows don't have. A one-level `Children.forEach` in the
    // double would silently miss it — under-validating exactly where a consumer
    // composes (`<>…</>`, a wrapper component, a mapped list in a wrapper).
    expect(() =>
      render(
        <LineChart data={[{ date: new Date("2024-01-01") }]}>
          <>
            <FakeSeries dataKey="revenue" />
          </>
        </LineChart>,
      ),
    ).toThrow(/missing declared series key "revenue"/);
  });

  it("configureChartTestDouble({ onViolation: 'warn' }) downgrades to console.error, no throw", () => {
    configureChartTestDouble({ onViolation: "warn" });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(<LineChart data={[{ date: "not-a-date", revenue: 10 }]}>{null}</LineChart>),
    ).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ── (3) props round-trip out of the DOM ──────────────────────────────────────

// ── (2b) AutoChart's spec contract (RM-038) ─────────────────────────────────
//
// AutoChart is the one container that never throws — it renders ChartFallback.
// That is right in production and wrong in a test, so the double is stricter
// than the component exactly where the component's leniency hides a mistake.

describe("AutoChart's spec contract", () => {
  it("throws for a `type` outside the ChartType union", () => {
    expect(() =>
      render(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the whole point
        <AutoChart
          spec={{ type: "sankey" as any, data: [{ a: "x", b: 1 }], x: "a", series: ["b"] }}
        />,
      ),
    ).toThrow(/"type" must be one of/);
  });

  it("throws when a declared series names a column no row has", () => {
    expect(() =>
      render(
        <AutoChart
          spec={{ data: [{ month: "Jan", revenue: 10 }], x: "month", series: ["profit"] }}
        />,
      ),
    ).toThrow(/names a column that no row has/);
  });

  it("throws for a treemap with no hierarchy", () => {
    expect(() =>
      render(
        <AutoChart spec={{ type: "treemap", data: [{ a: "x", b: 1 }], x: "a", series: ["b"] }} />,
      ),
    ).toThrow(/carries its nodes in "hierarchy"/);
  });

  it("throws for an explicit heatmap with no second categorical column", () => {
    expect(() =>
      render(
        <AutoChart
          spec={{
            type: "heatmap",
            data: [{ day: "Mon", visits: 3 }],
            x: "day",
            series: ["visits"],
          }}
        />,
      ),
    ).toThrow(/needs a SECOND categorical column/);
  });

  it("accepts a treemap whose rows live in `hierarchy`", () => {
    const { container } = render(
      <AutoChart
        spec={{
          type: "treemap",
          data: [],
          x: "name",
          series: [],
          hierarchy: { name: "Spend", children: [{ name: "Cloud", value: 40 }] },
        }}
      />,
    );
    expect(container.querySelector('[data-chart="AutoChart"]')).toBeInTheDocument();
  });
});

describe("readChartDoubleProps — round trip", () => {
  it("recovers xDataKey, series and dataLength from the rendered double", () => {
    const rows = [
      { date: new Date("2024-01-01"), revenue: 10 },
      { date: new Date("2024-02-01"), revenue: 20 },
      { date: new Date("2024-03-01"), revenue: 30 },
    ];
    const { container } = render(
      <LineChart data={rows} xDataKey="date" status="ready">
        <FakeSeries dataKey="revenue" />
      </LineChart>,
    );
    const el = container.querySelector('[data-chart="LineChart"]');
    const payload = readChartDoubleProps(el);
    expect(payload.component).toBe("LineChart");
    expect(payload.xDataKey).toBe("date");
    expect(payload.dataLength).toBe(3);
    expect(payload.status).toBe("ready");
    expect(payload.series).toEqual(["revenue"]);
  });
});

// ── CONSUMER-SHAPED regression: the exact input that used to pass a no-op mock

describe("consumer-shaped regression (the bug a no-op mock hid)", () => {
  function Dashboard() {
    return (
      <LineChart data={[{ turn: "A" }, { turn: "B" }]} xDataKey="turn">
        {null}
      </LineChart>
    );
  }

  it("fails loudly instead of silently passing (turn is not a valid Date)", () => {
    expect(() => render(<Dashboard />)).toThrow(ChartContractError);
  });
});

// ── Compile-time assignability (no `!`/`as` — a real structural check) ──────
// A double that stops accepting a prop the real component accepts fails
// `pnpm typecheck`, not this assertion — `expectAssignable<T>(value)` only
// compiles when `value`'s type is assignable to the explicit `T`, so a
// narrowed double breaks the BUILD, not a silent runtime pass.
function expectAssignable<T>(_value: T): void {
  /* compile-time-only — the call itself is the assertion */
}

describe("compile-time assignability", () => {
  it("every double is assignable to React.ComponentType<RealProps>", () => {
    expectAssignable<ComponentType<LineChartProps>>(LineChart);
    expectAssignable<ComponentType<AreaChartProps>>(AreaChart);
    expectAssignable<ComponentType<BarChartProps>>(BarChart);
    expectAssignable<ComponentType<ComposedChartProps>>(ComposedChart);
    expectAssignable<ComponentType<ScatterChartProps>>(ScatterChart);
    expectAssignable<ComponentType<CandlestickChartProps>>(CandlestickChart);
    expectAssignable<ComponentType<LiveLineChartProps>>(LiveLineChart);
    expectAssignable<ComponentType<PieChartProps>>(PieChart);
    expectAssignable<ComponentType<RingChartProps>>(RingChart);
    expectAssignable<ComponentType<FunnelChartProps>>(FunnelChart);
    expectAssignable<ComponentType<RadarChartProps>>(RadarChart);
    expectAssignable<ComponentType<ChoroplethChartProps>>(ChoroplethChart);
    expectAssignable<ComponentType<SankeyChartProps>>(SankeyChart);
    expectAssignable<ComponentType<GanttProps>>(Gantt);
    expectAssignable<ComponentType<AutoChartProps>>(AutoChart);
    expectAssignable<ComponentType<MetricCardProps>>(MetricCard);
    expectAssignable<ComponentType<MetricGridProps>>(MetricGrid);
    expectAssignable<ComponentType<ChartCardProps>>(ChartCard);
    expectAssignable<ComponentType<ChartFrameProps>>(ChartFrame);
    expectAssignable<ComponentType<SparklineProps>>(Sparkline);
    expect(true).toBe(true);
  });
});
