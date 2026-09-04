import { cleanup, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// @visx/responsive uses ResizeObserver + real DOM measurement which jsdom
// lacks. Mock ParentSize to supply a fixed 560×288 viewport so ChartInner
// renders real geometry — the technique `bar-chart.test.tsx` uses. Real
// render/interaction/a11y is covered by the Storybook build (Charts/WaterfallChart).
vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "parent-size" },
        children({ width: 560, height: 288 }),
      ),
  };
});

import {
  computeWaterfallConnectorAnchors,
  computeWaterfallRows,
  WaterfallChart,
  type WaterfallDatum,
} from "./waterfall-chart";

const grossToNet: WaterfallDatum[] = [
  { kind: "total", label: "Gross", value: 1000 },
  { label: "Refunds", value: -100 },
  { label: "COGS", value: -300 },
  { label: "Ops", value: -200 },
  { kind: "total", label: "Net", value: 400 },
];

afterEach(cleanup);

describe("WaterfallChart", () => {
  it("is exported as a function (forwardRef wrapper)", () => {
    expect(typeof WaterfallChart).toBe("object");
  });

  it("renders one shape per step", () => {
    const { container } = render(<WaterfallChart data={grossToNet} />);
    const steps = container.querySelectorAll('[data-slot="waterfall-chart-step"]');
    expect(steps).toHaveLength(grossToNet.length);
  });

  it("never emits a NaN in a step's path geometry", () => {
    const { container } = render(<WaterfallChart data={grossToNet} />);
    for (const step of container.querySelectorAll('[data-slot="waterfall-chart-step"]')) {
      expect(step.getAttribute("d")).not.toContain("NaN");
    }
  });

  it("draws a connector between every adjacent pair of steps", () => {
    const { container } = render(<WaterfallChart data={grossToNet} />);
    const connectors = container.querySelectorAll('svg path[stroke-dasharray="2 3"]');
    expect(connectors).toHaveLength(grossToNet.length - 1);
  });

  it("omits connectors when connectors={false}", () => {
    const { container } = render(<WaterfallChart connectors={false} data={grossToNet} />);
    const connectors = container.querySelectorAll('svg path[stroke-dasharray="2 3"]');
    expect(connectors).toHaveLength(0);
  });

  it("renders signed step labels and unsigned total labels by default", () => {
    // Default `valueFormat` is "compact" (DEFAULT_CHART_VALUE_FORMAT), so the
    // 1000-magnitude total compacts to "1K" while the smaller step deltas do
    // not. A "total" row is an absolute value, not a delta, so it renders
    // unsigned; "step" rows render signed.
    render(<WaterfallChart data={grossToNet} />);
    expect(screen.getByText("1K")).toBeInTheDocument();
    expect(screen.getByText("-100")).toBeInTheDocument();
    expect(screen.getByText("-300")).toBeInTheDocument();
  });

  it("respects an explicit valueFormat", () => {
    render(<WaterfallChart data={grossToNet} valueFormat="number" />);
    expect(screen.getByText("1,000")).toBeInTheDocument();
  });

  it("omits value labels when showValues={false}", () => {
    const { container } = render(<WaterfallChart data={grossToNet} showValues={false} />);
    expect(container.querySelectorAll("svg text")).toHaveLength(0);
    expect(screen.queryByText("1K")).toBeNull();
  });

  it("renders empty for empty data without throwing", () => {
    const { container } = render(<WaterfallChart data={[]} />);
    expect(container.querySelectorAll('[data-slot="waterfall-chart-step"]')).toHaveLength(0);
  });

  it("renders in horizontal orientation via BarYAxis", () => {
    const { container } = render(<WaterfallChart data={grossToNet} orientation="horizontal" />);
    const steps = container.querySelectorAll('[data-slot="waterfall-chart-step"]');
    expect(steps).toHaveLength(grossToNet.length);
    // BarYAxis renders category labels along the left gutter.
    expect(screen.getAllByText("Gross").length).toBeGreaterThan(0);
  });

  it("renders each bar as a UnitStack when unit is set", () => {
    const { container } = render(<WaterfallChart data={grossToNet} unit={25} />);
    const stacks = container.querySelectorAll('[data-slot="unit-stack"]');
    expect(stacks.length).toBeGreaterThan(0);
    const steps = container.querySelectorAll('[data-slot="waterfall-chart-step"]');
    expect(steps).toHaveLength(0);
  });

  it("forwards a ref to the root container element", () => {
    const ref = createRef<HTMLDivElement>();
    render(<WaterfallChart data={grossToNet} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveAttribute("data-slot", "waterfall-chart");
  });

  it("registers one keyboard datapoint target per step (#349)", () => {
    render(<WaterfallChart data={grossToNet} onDatapointClick={() => {}} />);
    const group = screen.getByRole("group", { name: /chart data points/i });
    const targets = within(group).getAllByRole("button");
    expect(targets).toHaveLength(grossToNet.length);
  });

  it("renders no keyboard target layer without an interaction prop", () => {
    render(<WaterfallChart data={grossToNet} />);
    expect(screen.queryByRole("group", { name: /chart data points/i })).toBeNull();
  });

  it("applies a fixed pixel height when height is set", () => {
    const { container } = render(<WaterfallChart data={grossToNet} height={320} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.height).toBe("320px");
  });

  it("wires accessibleLabel through to the chart region", () => {
    render(<WaterfallChart accessibleLabel="Gross to net revenue bridge" data={grossToNet} />);
    expect(screen.getByLabelText("Gross to net revenue bridge")).toBeInTheDocument();
  });
});

// `computeWaterfallRows` is where the waterfall's actual geometry lives — a
// "step" row floats from the PREVIOUS row's running total, a "total" row
// resets it. This is deliberately unit-tested on the pure function directly,
// not only through a render: a coordinator review mutated
// `before = kind === "total" ? 0 : running` to `before = 0` (every bar
// growing from the axis instead of floating — a bar chart with dashed lines
// over it, not a waterfall) and every one of the 16 rendering tests above,
// plus all 6 Storybook stories, stayed green. None of them assert the
// running-total VALUE, only shape/count/presence. These do.
describe("computeWaterfallRows", () => {
  const gross = 1000;
  const refunds = -100;
  const cogs = -300;
  const ops = -200;
  const net = 400;

  it("computes the full { before, after, base, top, kind } shape per row", () => {
    const rows = computeWaterfallRows(grossToNet);

    // Expected values computed here from the input deltas, not pasted from a
    // run of the function under test.
    const afterGross = gross;
    const afterRefunds = afterGross + refunds;
    const afterCogs = afterRefunds + cogs;
    const afterOps = afterCogs + ops;

    expect(
      rows.map((r) => ({
        after: r.after,
        base: r.base,
        before: r.before,
        kind: r.kind,
        top: r.top,
      })),
    ).toEqual([
      { after: afterGross, base: 0, before: 0, kind: "total", top: afterGross },
      {
        after: afterRefunds,
        base: Math.min(afterGross, afterRefunds),
        before: afterGross,
        kind: "step",
        top: Math.max(afterGross, afterRefunds),
      },
      {
        after: afterCogs,
        base: Math.min(afterRefunds, afterCogs),
        before: afterRefunds,
        kind: "step",
        top: Math.max(afterRefunds, afterCogs),
      },
      {
        after: afterOps,
        base: Math.min(afterCogs, afterOps),
        before: afterCogs,
        kind: "step",
        top: Math.max(afterCogs, afterOps),
      },
      { after: net, base: 0, before: 0, kind: "total", top: net },
    ]);
  });

  it("a step row's before equals the previous row's after — the one the mutation breaks", () => {
    const rows = computeWaterfallRows(grossToNet);
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row?.kind === "step") {
        expect(row.before).toBe(rows[i - 1]?.after);
        // The mutated version (`before = 0`) would fail this on every step
        // after the opening total, since the true previous `after` is 1000.
        expect(row.before).not.toBe(0);
      }
    }
  });

  it("a total row's before is 0, its after is its own value, and it resets the running total for the row after it", () => {
    const rows = computeWaterfallRows(grossToNet);
    const grossRow = rows[0];
    const refundsRow = rows[1];
    const netRow = rows[rows.length - 1];

    expect(grossRow?.kind).toBe("total");
    expect(grossRow?.before).toBe(0);
    expect(grossRow?.after).toBe(gross);

    // Refunds floats from Gross's `after` — the reset the total performed.
    expect(refundsRow?.before).toBe(grossRow?.after);

    expect(netRow?.kind).toBe("total");
    expect(netRow?.before).toBe(0);
    expect(netRow?.after).toBe(net);
  });

  it("orders base/top correctly and reports isIncrease=false for a negative step", () => {
    const rows = computeWaterfallRows(grossToNet);
    const refundsRow = rows[1];
    expect(refundsRow?.value).toBeLessThan(0);
    expect(refundsRow?.after).toBeLessThan(refundsRow?.before ?? 0);
    expect(refundsRow?.base).toBe(refundsRow?.after);
    expect(refundsRow?.top).toBe(refundsRow?.before);
    expect(refundsRow?.isIncrease).toBe(false);
  });

  it("the final row's after reconciles with the arithmetic sum of the steps off gross", () => {
    const rows = computeWaterfallRows(grossToNet);
    const stepSum = grossToNet
      .filter((d) => (d.kind ?? "step") === "step")
      .reduce((sum, d) => sum + d.value, 0);
    expect(gross + stepSum).toBe(net);
    expect(rows[rows.length - 1]?.after).toBe(net);
  });
});

// The connector's hand-off is the SAME running-total property, one level up:
// a `Leader` wired to the wrong field (a row's `top` instead of its `after`)
// is invisible on an increasing row — `top === after` there — and only shows
// up as a diagonal jump on a decreasing row or into a "total" row.
describe("computeWaterfallConnectorAnchors", () => {
  it("anchors `from` at the source row's after and `to` at the target row's before (or its after for a total)", () => {
    const rows = computeWaterfallRows(grossToNet);
    const anchors = computeWaterfallConnectorAnchors(rows);
    expect(anchors).toHaveLength(rows.length - 1);

    // Refunds (index 1) is a decreasing step: its `top` (1000, == before)
    // differs from its `after` (900) — the case that stays hidden on an
    // increasing row, where the two are equal.
    const refundsRow = rows[1];
    const refundsToCogs = anchors[1];
    expect(refundsRow?.top).not.toBe(refundsRow?.after);
    expect(refundsToCogs?.from).toBe(refundsRow?.after);
    expect(refundsToCogs?.from).not.toBe(refundsRow?.top);

    // The connector into the closing "total" row anchors at the total's OWN
    // after (its value), not its before (always 0 for a total) — otherwise
    // the hairline would plunge to the axis and back.
    const netRow = rows[rows.length - 1];
    const opsToNet = anchors[anchors.length - 1];
    expect(netRow?.before).toBe(0);
    expect(opsToNet?.to).toBe(netRow?.after);
    expect(opsToNet?.to).not.toBe(netRow?.before);
  });

  it("every connector's from continues exactly where the running total left the previous step", () => {
    const rows = computeWaterfallRows(grossToNet);
    const anchors = computeWaterfallConnectorAnchors(rows);
    for (let i = 0; i < anchors.length; i++) {
      expect(anchors[i]?.from).toBe(rows[i]?.after);
    }
  });
});
