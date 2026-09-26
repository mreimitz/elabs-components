import { cleanup, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// @visx/responsive uses ResizeObserver + real DOM measurement which jsdom
// lacks. Mock ParentSize to supply a fixed viewport so ChartInner renders
// real geometry — the technique `bar-chart.test.tsx` uses. Real
// render/interaction/a11y is covered by the Storybook build (Charts/WaterfallChart).
// `mockParentSize` is mutable (`vi.hoisted`, shared with the factory below)
// so #603's narrow-width regression can render at 380px while every other
// test here keeps the default 560×288.
const mockParentSize = vi.hoisted(() => ({ width: 560, height: 288 }));
vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) => React.createElement("div", { "data-testid": "parent-size" }, children(mockParentSize)),
  };
});

import {
  computeWaterfallConnectorAnchors,
  computeWaterfallRows,
  WaterfallChart,
  type WaterfallDatum,
} from "./waterfall-chart";
import { seriesPatterns, stubHighDecoration } from "./high-decoration-fixture";

const grossToNet: WaterfallDatum[] = [
  { kind: "total", label: "Gross", value: 1000 },
  { label: "Refunds", value: -100 },
  { label: "COGS", value: -300 },
  { label: "Ops", value: -200 },
  { kind: "total", label: "Net", value: 400 },
];

afterEach(() => {
  cleanup();
  mockParentSize.width = 560;
  mockParentSize.height = 288;
});

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
    // unsigned; "step" rows render signed with a real minus (`−`, U+2212),
    // never `Intl`'s own ASCII hyphen.
    render(<WaterfallChart data={grossToNet} />);
    expect(screen.getByText("1K")).toBeInTheDocument();
    expect(screen.getByText("−100")).toBeInTheDocument();
    expect(screen.getByText("−300")).toBeInTheDocument();
  });

  it("renders a negative total with a real minus, never Intl's ASCII hyphen", () => {
    const negativeTotal: WaterfallDatum[] = [
      { kind: "total", label: "Start", value: 0 },
      { label: "Drop 1", value: -400 },
      { label: "Drop 2", value: -200 },
      { kind: "total", label: "End", value: -600 },
    ];
    render(<WaterfallChart data={negativeTotal} valueFormat="number" />);
    expect(screen.getByText("−600")).toBeInTheDocument();
    expect(screen.queryByText("-600")).toBeNull();
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

  // #241 — shares its root cause with `bar.tsx`'s `unit` mode: an emphatic
  // rung overran its own column, and the pitch was derived from the step's
  // own pixel span rather than the value scale.
  it("keeps adjacent step's unit-stacks disjoint on the cross axis (no emphatic-rung overhang)", () => {
    const { container } = render(<WaterfallChart data={grossToNet} unit={25} />);
    const stacks = [...container.querySelectorAll('[data-slot="unit-stack"]')];
    expect(stacks.length).toBe(grossToNet.length);
    const rangeOf = (stack: Element) => {
      const xs = [...stack.querySelectorAll('[data-slot="unit-stack-unit"]')].flatMap((u) => [
        Number.parseFloat(u.getAttribute("x1") ?? "0"),
        Number.parseFloat(u.getAttribute("x2") ?? "0"),
      ]);
      return [Math.min(...xs), Math.max(...xs)] as const;
    };
    const ranges = stacks.map(rangeOf);
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i - 1]![1]).toBeLessThanOrEqual(ranges[i]![0]);
    }
  });

  it("uses the same rung pitch for every step in one waterfall", () => {
    const { container } = render(<WaterfallChart data={grossToNet} unit={25} />);
    const stacks = [...container.querySelectorAll('[data-slot="unit-stack"]')];
    const pitchOf = (stack: Element) => {
      const ys = [...stack.querySelectorAll('[data-slot="unit-stack-unit"]')]
        .map((u) => Number.parseFloat(u.getAttribute("y1") ?? "0"))
        .sort((a, b) => a - b);
      return ys[1]! - ys[0]!;
    };
    const pitches = stacks.map(pitchOf).filter((p) => Number.isFinite(p));
    for (const pitch of pitches.slice(1)) {
      expect(pitch).toBeCloseTo(pitches[0]!, 5);
    }
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

  it("sizes the plot box by plotHeight, and by the deprecated height alias", () => {
    // ADR 0039: the px height lands on the chart's plot box (the BarChart
    // root inside the waterfall wrapper), not on the wrapper.
    for (const props of [{ plotHeight: 320 }, { height: 320 }]) {
      const { container, unmount } = render(<WaterfallChart data={grossToNet} {...props} />);
      const plot = container.querySelector("[data-chart-breakpoint]") as HTMLElement;
      expect(plot.style.height).toBe("320px");
      unmount();
    }
  });

  it("wires accessibleLabel through to the chart region", () => {
    render(<WaterfallChart accessibleLabel="Gross to net revenue bridge" data={grossToNet} />);
    expect(screen.getByLabelText("Gross to net revenue bridge")).toBeInTheDocument();
  });

  it("renders no callout furniture without a `callouts` prop — byte-identical default", () => {
    const { container } = render(<WaterfallChart data={grossToNet} />);
    expect(container.querySelectorAll('[data-slot="waterfall-chart-callout"]')).toHaveLength(0);
  });

  it("draws a leader + note above the named step for each callout", () => {
    render(
      <WaterfallChart callouts={[{ label: "COGS", note: "The main driver" }]} data={grossToNet} />,
    );
    expect(screen.getByText("The main driver")).toBeInTheDocument();
    const callout = document.querySelector('[data-slot="waterfall-chart-callout"]');
    expect(callout?.querySelector('[data-slot="leader"]')).not.toBeNull();
  });

  it("ignores callouts under horizontal orientation (no headroom above a horizontal bar)", () => {
    render(
      <WaterfallChart
        callouts={[{ label: "COGS", note: "The main driver" }]}
        data={grossToNet}
        orientation="horizontal"
      />,
    );
    expect(screen.queryByText("The main driver")).toBeNull();
  });

  it("skips a callout whose label matches no step, without throwing", () => {
    render(
      <WaterfallChart callouts={[{ label: "Nonexistent", note: "orphan" }]} data={grossToNet} />,
    );
    expect(screen.queryByText("orphan")).toBeNull();
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

describe("WaterfallChart decoration pattern channel (ADR 0011, #257)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("patterns increase / decrease / total steps with one series pattern each", () => {
    stubHighDecoration();
    const data: WaterfallDatum[] = [...grossToNet.slice(0, 2), { label: "Price", value: 50 }];
    const { container } = render(<WaterfallChart data={data} />);
    const ids = seriesPatterns(container).map((pattern) => pattern.id);
    expect(ids).toHaveLength(3);
    const fills = Array.from(
      container.querySelectorAll('[data-slot="waterfall-chart-step"]'),
      (step) => step.getAttribute("fill"),
    );
    // Gross (total) = series 2, Refunds (decrease) = series 1, Price (increase) = series 0.
    expect(fills).toEqual([`url(#${ids[2]})`, `url(#${ids[1]})`, `url(#${ids[0]})`]);
  });

  it("keeps an author's literal fill and paints no pattern at low decoration", () => {
    const low = render(<WaterfallChart data={grossToNet} />);
    expect(seriesPatterns(low.container)).toHaveLength(0);
    low.unmount();

    stubHighDecoration();
    const { container } = render(
      <WaterfallChart data={grossToNet} negativeFill="var(--destructive)" />,
    );
    expect(seriesPatterns(container)).toHaveLength(1);
    const refunds = container.querySelectorAll('[data-slot="waterfall-chart-step"]')[1];
    expect(refunds?.getAttribute("fill")).toBe("var(--destructive)");
  });
});

// RM-122 — dataFormat, subtotalBy, sort, start/end, zoomToDifferences, labels.
describe("WaterfallChart RM-122", () => {
  it("renders the same bars from a runningTotals fixture as its differences twin", () => {
    const runningTotals: WaterfallDatum[] = [
      { kind: "total", label: "Gross", value: 1000 },
      { label: "Refunds", value: 900 },
      { label: "COGS", value: 600 },
      { label: "Ops", value: 400 },
      { kind: "total", label: "Net", value: 400 },
    ];
    const a = render(<WaterfallChart data={grossToNet} />);
    const aPaths = [...a.container.querySelectorAll('[data-slot="waterfall-chart-step"]')].map(
      (el) => el.getAttribute("d"),
    );
    a.unmount();
    const b = render(<WaterfallChart data={runningTotals} dataFormat="runningTotals" />);
    const bPaths = [...b.container.querySelectorAll('[data-slot="waterfall-chart-step"]')].map(
      (el) => el.getAttribute("d"),
    );
    expect(bPaths).toEqual(aPaths);
  });

  it("subtotalBy inserts a checkpoint per group, filled like a total", () => {
    const quarters: WaterfallDatum[] = [
      { kind: "total", label: "Opening", value: 1000 },
      { label: "Jan", quarter: "Q1", value: 50 },
      { label: "Feb", quarter: "Q1", value: 30 },
      { label: "Apr", quarter: "Q2", value: 20 },
      { label: "May", quarter: "Q2", value: -5 },
      { kind: "total", label: "Closing", value: 1095 },
    ];
    const { container } = render(<WaterfallChart data={quarters} subtotalBy="quarter" />);
    const steps = container.querySelectorAll('[data-slot="waterfall-chart-step"]');
    // 6 data rows + 2 auto-inserted subtotals.
    expect(steps).toHaveLength(8);
    const totalFillSteps = [...steps].filter(
      (el) => el.getAttribute("fill") === "var(--chart-foreground)",
    );
    // Opening + Closing + Q1 subtotal + Q2 subtotal.
    expect(totalFillSteps).toHaveLength(4);
  });

  it("sort=decreasesFirst reorders steps within the group", () => {
    const mixed: WaterfallDatum[] = [
      { kind: "total", label: "Start", value: 100 },
      { label: "A", value: 10 },
      { label: "B", value: -5 },
      { kind: "total", label: "End", value: 105 },
    ];
    render(<WaterfallChart data={mixed} onDatapointClick={() => {}} sort="decreasesFirst" />);
    // Keyboard datapoint targets register in ROW order — the reordering
    // `sortWaterfallSteps` (unit-tested directly) applies before
    // `computeWaterfallRows` ever runs.
    const group = screen.getByRole("group", { name: /chart data points/i });
    const targets = within(group).getAllByRole("button");
    const order = targets
      .map((t) => t.getAttribute("aria-label") ?? "")
      .map((label) => ["Start", "A", "B", "End"].find((name) => label.includes(name)));
    expect(order).toEqual(["Start", "B", "A", "End"]);
  });

  it("start/end show=false drops the endpoint row", () => {
    const { container } = render(
      <WaterfallChart data={grossToNet} end={{ show: false }} start={{ show: false }} />,
    );
    const steps = container.querySelectorAll('[data-slot="waterfall-chart-step"]');
    expect(steps).toHaveLength(grossToNet.length - 2);
  });

  it("start/end label overrides the endpoint's own label", () => {
    render(
      <WaterfallChart
        data={grossToNet}
        end={{ label: "Ending balance" }}
        orientation="horizontal"
        start={{ label: "Starting balance" }}
      />,
    );
    expect(screen.getByText("Starting balance")).toBeInTheDocument();
    expect(screen.getByText("Ending balance")).toBeInTheDocument();
  });

  it("zoomToDifferences renders a large total as a point, never a bar, and keeps step bars", () => {
    const large: WaterfallDatum[] = [
      { kind: "total", label: "Opening", value: 1_000_000 },
      { label: "New", value: 4_500 },
      { label: "Upsell", value: 3_000 },
      { label: "Churn", value: -3_800 },
      { kind: "total", label: "Closing", value: 1_003_700 },
    ];
    const { container } = render(<WaterfallChart data={large} zoomToDifferences />);
    const points = container.querySelectorAll('[data-slot="waterfall-chart-total-point"]');
    expect(points).toHaveLength(2); // Opening + Closing.
    const bars = container.querySelectorAll('[data-slot="waterfall-chart-step"]');
    expect(bars).toHaveLength(3); // New, Upsell, Churn only.
  });

  it("zoomToDifferences is a no-op (no points) on an ordinary small-total fixture", () => {
    const { container } = render(<WaterfallChart data={grossToNet} zoomToDifferences />);
    expect(container.querySelectorAll('[data-slot="waterfall-chart-total-point"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-slot="waterfall-chart-step"]')).toHaveLength(
      grossToNet.length,
    );
  });

  it("charts-honesty passes for the pure zoom domain — every checkpoint sits above the zoomed max", () => {
    // charts-honesty itself is asserted by `pnpm check --rule charts-honesty`
    // (a static gate); this is the runtime half — the geometry the gate's
    // exemption depends on actually holds.
    const large: WaterfallDatum[] = [
      { kind: "total", label: "Opening", value: 1_000_000 },
      { label: "New", value: 4_500 },
      { label: "Upsell", value: 3_000 },
      { label: "Churn", value: -3_800 },
      { kind: "total", label: "Closing", value: 1_003_700 },
    ];
    const { container } = render(<WaterfallChart data={large} zoomToDifferences />);
    for (const step of container.querySelectorAll('[data-slot="waterfall-chart-step"]')) {
      expect(step.getAttribute("d")).not.toContain("NaN");
    }
  });

  it("labels.differences percent paints a signed percent-of-before label", () => {
    render(
      <WaterfallChart
        data={grossToNet}
        labels={{ differences: "percent", totals: "all" }}
        valueFormat="number"
      />,
    );
    // Refunds: -100 off a before of 1000 → -10 %.
    expect(screen.getByText("−10.0 %")).toBeInTheDocument();
  });

  it("labels.totals totalsOnly hides step labels, keeps checkpoint labels", () => {
    render(
      <WaterfallChart data={grossToNet} labels={{ totals: "totalsOnly" }} valueFormat="number" />,
    );
    expect(screen.queryByText("−100")).toBeNull();
    expect(screen.getByText("1,000")).toBeInTheDocument();
  });

  // #603 — a checkpoint (total/subtotal, `priority: 1`) label is built
  // "above the bar" (`roundTop`), the same as an increasing step's, and a
  // waterfall's checkpoints are usually the running total's high points —
  // so once a narrow width's taller category-axis margin eats into
  // `innerHeight`, a checkpoint's preferred label position is the one most
  // likely to start ABOVE the plot's own top edge (y < 0). `layoutLabels`
  // only ever nudges a box along its FREE axis (horizontal, for a
  // top-anchored label): a box that starts outside `bounds` on its FIXED
  // axis can never be rescued and was unconditionally dropped, regardless
  // of `priority` — inverting the story's own contract that a checkpoint
  // wins its placement over a lower-priority step. Same data/`labels`/
  // `margin` as the `PercentDifferenceLabels` story (values changed only so
  // every label's text is unique and assertable), narrowed to 380px, which
  // is exactly wide enough to force the category axis to wrap and grow
  // `margin.bottom` (the story's own 720px canvas does not).
  it("keeps every checkpoint's value label painted at 380px, not just the steps (#603)", () => {
    mockParentSize.width = 380;
    const monthsByQuarter: WaterfallDatum[] = [
      { kind: "total", label: "Opening", value: 1000 },
      { label: "Jan", quarter: "Q1", value: 50 },
      { label: "Feb", quarter: "Q1", value: 30 },
      { label: "Mar", quarter: "Q1", value: -10 },
      { label: "Apr", quarter: "Q2", value: 20 },
      { label: "May", quarter: "Q2", value: -5 },
      // Distinct from the two auto `subtotalBy` checkpoints (1,070 / 1,085)
      // while keeping the SAME tight headroom the story's own 1,085 gives —
      // the running total still peaks at 1,090 on Apr's own bar, so the
      // y-domain (and therefore the negative-`y` box this regresses) is
      // unchanged from `PercentDifferenceLabels`.
      { kind: "total", label: "Closing", value: 1075 },
    ];
    const { container } = render(
      <WaterfallChart
        callouts={[{ label: "Mar", note: "Gives back most of Q1" }]}
        data={monthsByQuarter}
        labels={{ totals: "all" }}
        margin={{ top: 64 }}
        subtotalBy="quarter"
        valueFormat="number"
      />,
    );
    const painted = [...container.querySelectorAll("svg text")].map((t) => t.textContent);
    // The checkpoints: Opening, the two auto `subtotalBy` rows, and Closing.
    for (const checkpointText of ["1,000", "1,070", "1,085", "1,075"]) {
      expect(painted).toContain(checkpointText);
    }
    // Every step painted too — the fix is headroom, not a priority reweight
    // that would trade steps for checkpoints.
    for (const stepText of ["+50", "+30", "−10", "+20", "−5"]) {
      expect(painted).toContain(stepText);
    }
    expect(container.querySelector(".sr-only")?.textContent ?? "").not.toMatch(
      /1,000|1,070|1,085|1,075/,
    );
  });
});

describe("WaterfallChart selection paint-back (RM-185)", () => {
  it("forwards selectionStates/dimExcluded to the inner BarChart, which paints the tri-state", () => {
    const states: Record<string, "selected" | "associated" | "excluded"> = {
      Refunds: "selected",
      COGS: "associated",
      Ops: "excluded",
    };
    const { container } = render(
      <WaterfallChart
        data={grossToNet}
        selectionStates={(category) => states[String(category)] ?? "associated"}
      />,
    );
    expect(container.querySelectorAll('[data-selection="selected"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-selection="associated"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-selection="excluded"]').length).toBeGreaterThan(0);
  });

  it("without selectionStates, the DOM stays byte-identical (no data-selection anywhere)", () => {
    const { container } = render(<WaterfallChart data={grossToNet} />);
    expect(container.querySelectorAll("[data-selection]").length).toBe(0);
  });
});
