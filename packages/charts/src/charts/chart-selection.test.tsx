/**
 * Selection input contract (RM-073, #437): the pure resolver, the paint flags,
 * and the BarChart mark rendering — including the byte-identical opt-out.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) => React.createElement(React.Fragment, null, children({ width: 560, height: 288 })),
  };
});

vi.mock("react-use-measure", () => ({
  default: () => [() => undefined, { width: 560, height: 288 }],
}));

import { Area } from "./area";
import { AreaChart } from "./area-chart";
import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import {
  SELECTION_EXCLUDED_OPACITY,
  markSelectionPaint,
  resolveMarkState,
  type SelectionState,
} from "./chart-selection";
import { Line } from "./line";
import { LineChart } from "./line-chart";
import { PieChart } from "./pie-chart";
import PieSlice from "./pie-slice";
import Ring from "./ring";
import { RingChart } from "./ring-chart";
import { DumbbellChart } from "./dumbbell-chart";
import { Scatter } from "./scatter";
import { ScatterChart } from "./scatter-chart";
import { TreemapChart } from "./treemap";
import { UnitChart } from "./unit-chart";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
  // jsdom has no SVG geometry; `<Line>`/`<Area>` measure their path length.
  Object.defineProperty(SVGElement.prototype, "getTotalLength", {
    configurable: true,
    value: () => 100,
  });
});

afterEach(cleanup);

const data = [
  { region: "EMEA", sales: 12 },
  { region: "APAC", sales: 24 },
  { region: "AMER", sales: 8 },
];

const STATES: Record<string, SelectionState> = {
  EMEA: "selected",
  APAC: "associated",
  AMER: "excluded",
};
const byRegion = (category: string | number | Date) => STATES[String(category)] ?? "associated";

describe("resolveMarkState", () => {
  it("is undefined without a resolver or a category", () => {
    expect(resolveMarkState(undefined, { category: "EMEA" })).toBeUndefined();
    expect(
      resolveMarkState({ selectionStates: byRegion }, { category: undefined }),
    ).toBeUndefined();
  });

  it("passes category, series key and datum to the resolver", () => {
    const resolver = vi.fn(() => "excluded" as const);
    const datum = { region: "EMEA" };
    expect(
      resolveMarkState(
        { selectionStates: resolver },
        { category: "EMEA", datum, seriesKey: "sales" },
      ),
    ).toBe("excluded");
    expect(resolver).toHaveBeenCalledWith("EMEA", "sales", datum);
  });
});

describe("markSelectionPaint", () => {
  it("dims excluded only while dimExcluded is on, outlines selected", () => {
    expect(markSelectionPaint("excluded")).toMatchObject({ dimmed: true, outlined: false });
    expect(markSelectionPaint("excluded", false)).toMatchObject({
      "data-selection": "excluded",
      dimmed: false,
    });
    expect(markSelectionPaint("selected")).toMatchObject({ dimmed: false, outlined: true });
    expect(markSelectionPaint("associated")).toMatchObject({ dimmed: false, outlined: false });
    expect(markSelectionPaint(undefined)["data-selection"]).toBeUndefined();
  });
});

function renderBars(props: Partial<React.ComponentProps<typeof BarChart>> = {}) {
  return render(
    <BarChart animationDuration={0} data={data} xDataKey="region" {...props}>
      <Bar animate={false} dataKey="sales" />
    </BarChart>,
  );
}

describe("BarChart selectionStates", () => {
  it("renders byte-identical DOM when selectionStates is absent", () => {
    // `useId` differs per mount; everything else must match exactly.
    const normalise = (html: string) => html.replace(/_r_[a-z0-9]+_/g, "_r_");
    const plain = normalise(renderBars().container.innerHTML);
    cleanup();
    const withDim = normalise(renderBars({ dimExcluded: true }).container.innerHTML);
    expect(withDim).toBe(plain);
    expect(plain).not.toContain("data-selection");
  });

  it("paints each state with a non-hue channel", () => {
    const { container } = renderBars({ selectionStates: byRegion });
    const selected = container.querySelector('[data-selection="selected"]');
    const associated = container.querySelector('[data-selection="associated"]');
    const excluded = container.querySelector('[data-selection="excluded"]');

    expect(selected?.querySelector('[data-slot="bar-selection-outline"]')).not.toBeNull();
    expect(selected?.getAttribute("opacity")).toBeNull();
    expect(associated?.querySelector('[data-slot^="bar-selection-"]')).toBeNull();
    expect(excluded?.getAttribute("opacity")).toBe(String(SELECTION_EXCLUDED_OPACITY));
    expect(excluded?.querySelector('[data-slot="bar-selection-hatch"]')).not.toBeNull();
  });

  it("keeps the attribute but paints nothing with dimExcluded={false}", () => {
    const { container } = renderBars({ dimExcluded: false, selectionStates: byRegion });
    const excluded = container.querySelector('[data-selection="excluded"]');
    expect(excluded).not.toBeNull();
    expect(excluded?.getAttribute("opacity")).toBeNull();
    expect(excluded?.querySelector('[data-slot="bar-selection-hatch"]')).toBeNull();
  });
});

// ── Other families (RM-073) ──────────────────────────────────────────────────

const byLabel = (category: string | number | Date) => STATES[String(category)] ?? "associated";
const regionRows = data.map((d) => ({ label: d.region, value: d.sales, maxValue: 30 }));

const FAMILIES: {
  name: string;
  channel: string;
  render: (props: Record<string, unknown>) => React.ReactElement;
}[] = [
  {
    name: "LineChart",
    channel: "chart-selection-series-layer-dash",
    render: (props) => (
      <LineChart animationDuration={0} data={data} xDataKey="region" xScale="band" {...props}>
        <Line animate={false} dataKey="sales" />
      </LineChart>
    ),
  },
  {
    name: "AreaChart",
    channel: "chart-selection-series-layer-hatch",
    render: (props) => (
      <AreaChart animationDuration={0} data={data} xDataKey="region" xScale="band" {...props}>
        <Area animate={false} dataKey="sales" />
      </AreaChart>
    ),
  },
  {
    name: "PieChart",
    channel: "chart-selection-mark-hatch",
    render: (props) => (
      <PieChart data={regionRows} size={240} {...props}>
        {regionRows.map((row, index) => (
          <PieSlice animate={false} index={index} key={row.label} />
        ))}
      </PieChart>
    ),
  },
  {
    name: "RingChart",
    channel: "chart-selection-mark-hatch",
    render: (props) => (
      <RingChart data={regionRows} size={240} {...props}>
        {regionRows.map((row, index) => (
          <Ring animate={false} index={index} key={row.label} />
        ))}
      </RingChart>
    ),
  },
];

describe.each(FAMILIES)("$name selectionStates", ({ channel, render: element }) => {
  const normalise = (html: string) => html.replace(/_r_[a-z0-9]+_/g, "_r_");

  it("renders byte-identical DOM when selectionStates is absent", () => {
    const plain = normalise(render(element({})).container.innerHTML);
    cleanup();
    const withDim = normalise(render(element({ dimExcluded: true })).container.innerHTML);
    expect(withDim).toBe(plain);
    expect(plain).not.toContain("data-selection");
  });

  it("paints the three states apart without hue", () => {
    const { container } = render(element({ selectionStates: byLabel }));
    const excluded = container.querySelector('[data-selection="excluded"]');
    const selected = container.querySelector('[data-selection="selected"]');
    expect(container.querySelector('[data-selection="associated"]')).not.toBeNull();
    expect(excluded?.querySelector(`[data-slot="${channel}"]`)).not.toBeNull();
    expect(selected?.querySelector('[data-slot$="-outline"]')).not.toBeNull();
  });

  it("announces selected and excluded datapoints by name", () => {
    const { container } = render(element({ onDatapointClick: () => {}, selectionStates: byLabel }));
    const names = Array.from(container.querySelectorAll("button[aria-label]")).map((b) =>
      b.getAttribute("aria-label"),
    );
    expect(names.some((name) => name?.endsWith(", selected"))).toBe(true);
    expect(names.some((name) => name?.endsWith(", excluded"))).toBe(true);
  });
});

// ── Measured families (RM-073): Scatter, Treemap, Unit, Dumbbell ─────────────

const MEASURED: typeof FAMILIES = [
  {
    name: "ScatterChart",
    channel: "chart-selection-mark-hollow",
    // Scatter has a continuous x; key the resolver on the datum's region instead.
    render: ({ selectionStates, ...props }) => (
      <ScatterChart
        data={data.map((d, index) => ({ ...d, step: index + 1 }))}
        selectionStates={
          selectionStates
            ? (_category: unknown, _series?: string, datum?: Record<string, unknown>) =>
                byLabel(String(datum?.region))
            : undefined
        }
        xDataKey="step"
        xScale="linear"
        {...props}
      >
        <Scatter animate={false} dataKey="sales" />
      </ScatterChart>
    ),
  },
  {
    name: "TreemapChart",
    channel: "chart-selection-mark-hatch",
    render: (props) => (
      <div style={{ height: 300, width: 600 }}>
        <TreemapChart
          data={{
            name: "Sales",
            children: data.map((d) => ({ name: d.region, value: d.sales })),
          }}
          depth={1}
          {...props}
        />
      </div>
    ),
  },
  {
    name: "UnitChart",
    channel: "chart-selection-mark-hollow",
    render: (props) => (
      <UnitChart
        data={data.map((d) => ({ label: d.region, value: d.sales }))}
        layout="waffle"
        {...props}
      />
    ),
  },
  {
    name: "DumbbellChart",
    channel: "chart-selection-mark-dash",
    render: (props) => (
      <DumbbellChart
        category="region"
        data={data.map((d) => ({ ...d, target: d.sales + 5 }))}
        endKey="target"
        startKey="sales"
        {...props}
      />
    ),
  },
];

describe.each(MEASURED)("$name selectionStates", ({ channel, render: element }) => {
  const normalise = (html: string) => html.replace(/_r_[a-z0-9]+_/g, "_r_");

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 300,
      height: 300,
      left: 0,
      right: 600,
      toJSON: () => ({}),
      top: 0,
      width: 600,
      x: 0,
      y: 0,
    } as DOMRect);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders byte-identical DOM when selectionStates is absent", () => {
    const plain = normalise(render(element({})).container.innerHTML);
    cleanup();
    const withDim = normalise(render(element({ dimExcluded: true })).container.innerHTML);
    expect(withDim).toBe(plain);
    expect(plain).not.toContain("data-selection");
  });

  it("paints the three states apart without hue", () => {
    const { container } = render(element({ selectionStates: byLabel }));
    const excluded = container.querySelector('[data-selection="excluded"]');
    const selected = container.querySelector('[data-selection="selected"]');
    expect(container.querySelector('[data-selection="associated"]')).not.toBeNull();
    expect(excluded?.getAttribute("opacity")).toBe(String(SELECTION_EXCLUDED_OPACITY));
    expect(excluded?.querySelector(`[data-slot="${channel}"]`)).not.toBeNull();
    expect(selected?.querySelector('[data-slot$="-outline"]')).not.toBeNull();
  });
});
