/**
 * `stackGap` (RM-164, finding F14). The gap is cut out of the boundaries
 * BETWEEN stack segments only, half from each side, so a stack still starts on
 * the baseline and ends at its scaled total (charts-honesty). `BarChart`
 * hands its `stackGap` to every `Bar` in every stack mode; `SeriesBar` in a
 * `ComposedChart` shares the same geometry through `insetStackSegment`.
 */
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// @visx/responsive uses ResizeObserver + real DOM measurement which jsdom lacks.
vi.mock("./chart-parent-size", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ChartParentSize: ({
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

import { Bar } from "./bar";
import { BarChart, type BarChartProps } from "./bar-chart";
import { type TooltipData, useChart, useChartHover, useYScale } from "./chart-context";
import { ComposedChart, type ComposedChartProps } from "./composed-chart";
import { SeriesBar } from "./series-bar";

afterEach(cleanup);

const GAP = 6;
const KEYS = ["a", "b", "c"] as const;
type Key = (typeof KEYS)[number];
const FILLS: Record<Key, string> = {
  a: "var(--chart-1)",
  b: "var(--chart-2)",
  c: "var(--chart-3)",
};
const rows = [
  { name: "North", a: 40, b: 25, c: 35 },
  { name: "South", a: 10, b: 30, c: 20 },
];
const total = (row: (typeof rows)[number]) => row.a + row.b + row.c;

/** A segment's extent along the value axis, in plot pixels (`lo` < `hi`). */
interface Span {
  lo: number;
  hi: number;
}

const num = (el: Element, attr: string) => Number(el.getAttribute(attr));

/** Each rect painted in `fill`, in row order, as its span along the value axis. */
function spans(container: HTMLElement, fill: string, horizontal: boolean): Span[] {
  return [...container.querySelectorAll(`rect[fill="${fill}"]`)].map((rect) =>
    horizontal
      ? { lo: num(rect, "x"), hi: num(rect, "x") + num(rect, "width") }
      : { lo: num(rect, "y"), hi: num(rect, "y") + num(rect, "height") },
  );
}

/** Row `row`'s segment spans, one per fill in the order given. */
function stackAt(
  container: HTMLElement,
  fills: readonly string[],
  row: number,
  horizontal: boolean,
): Span[] {
  return fills.map((fill) => {
    const span = spans(container, fill, horizontal)[row];
    if (!span) {
      throw new Error(`no ${fill} segment in row ${row}`);
    }
    return span;
  });
}

type Three = [Span, Span, Span];
const ABC = KEYS.map((key) => FILLS[key]);

/** Captures the value scale the bars are drawn with, and the latest tooltip. */
const probe: { scale: (value: number) => number; tooltip: TooltipData | null } = {
  scale: () => Number.NaN,
  tooltip: null,
};

function ValueScaleProbe() {
  const { orientation, yScale } = useChart();
  const perAxis = useYScale();
  const scale = orientation === "horizontal" ? yScale : perAxis;
  probe.scale = (value) => scale(value) ?? Number.NaN;
  probe.tooltip = useChartHover().tooltipData;
  return null;
}

function renderBarStack(
  props: Omit<BarChartProps, "children" | "data">,
  barProps: Partial<Record<Key, { stackGap?: number }>> = {},
) {
  return render(
    <BarChart data={rows} xDataKey="name" {...props}>
      {KEYS.map((key) => (
        <Bar
          animate={false}
          dataKey={key}
          fill={FILLS[key]}
          key={key}
          lineCap="butt"
          {...barProps[key]}
        />
      ))}
      <ValueScaleProbe />
    </BarChart>,
  );
}

describe("BarChart stackGap (RM-164)", () => {
  it("vertical: the stack keeps its baseline and total, neighbours sit stackGap apart", () => {
    const { container } = renderBarStack({ stacked: true, stackGap: GAP });
    rows.forEach((row, i) => {
      const [sa, sb, sc] = stackAt(container, ABC, i, false) as Three;
      expect(sa.hi).toBeCloseTo(probe.scale(0), 6); // bottom on the baseline
      expect(sc.lo).toBeCloseTo(probe.scale(total(row)), 6); // top at the total
      expect(sa.lo - sb.hi).toBeCloseTo(GAP, 6);
      expect(sb.lo - sc.hi).toBeCloseTo(GAP, 6);
      // Symmetric: the a|b boundary moved half the gap into each segment.
      expect(sa.lo).toBeCloseTo(probe.scale(row.a) + GAP / 2, 6);
      expect(sb.hi).toBeCloseTo(probe.scale(row.a) - GAP / 2, 6);
    });
  });

  it("horizontal: the stack keeps its baseline and total, neighbours sit stackGap apart", () => {
    const { container } = renderBarStack({
      orientation: "horizontal",
      showTotals: true,
      stacked: true,
      stackGap: GAP,
    });
    rows.forEach((row, i) => {
      const [sa, sb, sc] = stackAt(container, ABC, i, true) as Three;
      expect(sa.lo).toBeCloseTo(probe.scale(0), 6);
      expect(sc.hi).toBeCloseTo(probe.scale(total(row)), 6);
      expect(sb.lo - sa.hi).toBeCloseTo(GAP, 6);
      expect(sc.lo - sb.hi).toBeCloseTo(GAP, 6);
    });
  });

  it("percent: every stack still ends at 100 % with the gap cut inside it", () => {
    const { container } = renderBarStack({ stacked: "percent", stackGap: GAP });
    rows.forEach((_, i) => {
      const [sa, sb, sc] = stackAt(container, ABC, i, false) as Three;
      expect(sa.hi).toBeCloseTo(probe.scale(0), 6);
      expect(sc.lo).toBeCloseTo(probe.scale(1), 6);
      expect(sa.lo - sb.hi).toBeCloseTo(GAP, 6);
      expect(sb.lo - sc.hi).toBeCloseTo(GAP, 6);
    });
  });

  it("diverging: positive and negative towers keep their ends and meet at zero with no gap", () => {
    const signed = [{ name: "Net", a: 30, b: -20, c: 10 }];
    const { container } = render(
      <BarChart data={signed} stackGap={GAP} stackOrder="desc" stacked xDataKey="name">
        {KEYS.map((key) => (
          <Bar animate={false} dataKey={key} fill={FILLS[key]} key={key} lineCap="butt" />
        ))}
        <ValueScaleProbe />
      </BarChart>,
    );
    const [a, b, c] = stackAt(container, ABC, 0, false) as Three;
    // stackOrder="desc": a (30) then c (10) above zero, b (−20) below it.
    expect(a.hi).toBeCloseTo(probe.scale(0), 6);
    expect(c.lo).toBeCloseTo(probe.scale(40), 6);
    expect(a.lo - c.hi).toBeCloseTo(GAP, 6);
    expect(b.lo).toBeCloseTo(probe.scale(0), 6);
    expect(b.hi).toBeCloseTo(probe.scale(-20), 6);
  });

  it("diverging Likert: the outer answers keep the ends and the centre stays on zero", () => {
    const likert = [{ q: "Q1", no: 10, meh: 20, neutral: 30, ok: 25, yes: 15 }];
    const likertKeys = ["no", "meh", "neutral", "ok", "yes"];
    const fill = (i: number) => `var(--chart-${i + 1})`;
    const renderLikert = (stackGap: number, divergingCenter?: string) =>
      render(
        <BarChart
          data={likert}
          divergingCenter={divergingCenter}
          orientation="horizontal"
          stackGap={stackGap}
          stacked="diverging"
          xDataKey="q"
        >
          {likertKeys.map((key, i) => (
            <Bar animate={false} dataKey={key} fill={fill(i)} key={key} lineCap="butt" />
          ))}
          <ValueScaleProbe />
        </BarChart>,
      );
    const segments = (container: HTMLElement) =>
      stackAt(
        container,
        likertKeys.map((_, i) => fill(i)),
        0,
        true,
      ) as [Span, Span, Span, Span, Span];

    const centred = segments(renderLikert(GAP, "neutral").container);
    const [no, meh, neutral, ok, yes] = centred;
    expect(no.lo).toBeCloseTo(probe.scale(-45), 6);
    expect(yes.hi).toBeCloseTo(probe.scale(55), 6);
    expect((neutral.lo + neutral.hi) / 2).toBeCloseTo(probe.scale(0), 6);
    expect(meh.lo - no.hi).toBeCloseTo(GAP, 6);
    expect(neutral.lo - meh.hi).toBeCloseTo(GAP, 6);
    expect(ok.lo - neutral.hi).toBeCloseTo(GAP, 6);
    expect(yes.lo - ok.hi).toBeCloseTo(GAP, 6);
    cleanup();

    // No centre: the two halves meet at zero, where no gap is ever cut.
    const halves = segments(renderLikert(GAP).container);
    expect(halves[1].hi).toBeCloseTo(probe.scale(0), 6);
    expect(halves[2].lo).toBeCloseTo(probe.scale(0), 6);
  });

  it("a Bar's own stackGap overrides the chart's for its side of each boundary", () => {
    const { container } = renderBarStack({ stacked: true, stackGap: GAP }, { b: { stackGap: 2 } });
    const [a, b, c] = stackAt(container, ABC, 0, false) as Three;
    // a gives up 3 px, b 1 px, c 3 px at the two boundaries.
    expect(a.lo - b.hi).toBeCloseTo(GAP / 2 + 1, 6);
    expect(b.lo - c.hi).toBeCloseTo(1 + GAP / 2, 6);
  });

  it("anchors the tooltip dots on the segment ends the bars draw", async () => {
    const { container } = renderBarStack({ animationDuration: 0, stacked: true, stackGap: GAP });
    const plot = container.querySelector("svg > g") as SVGGElement;
    // The chart only takes the pointer once its enter phase settles, and the
    // tooltip commit is rAF-scheduled — so poll rather than assert once.
    await waitFor(() => {
      fireEvent.mouseMove(plot, { clientX: 0, clientY: 0 });
      expect(probe.tooltip?.index).toBe(0);
    });
    const drawn = stackAt(container, ABC, 0, false);
    KEYS.forEach((key, i) => {
      expect(probe.tooltip?.yPositions[key]).toBeCloseTo(drawn[i]?.lo ?? Number.NaN, 6);
    });
    expect(probe.tooltip?.yPositions.c).toBeCloseTo(probe.scale(40 + 25 + 35), 6);
  });

  it("stackGap 0 (the default) paints exactly what an unset stackGap paints, segments abutting", () => {
    // Each render mints its own `useId` scope; everything else must match.
    const markup = (container: HTMLElement) =>
      container.innerHTML.replace(/bar-series-[^"\s]+/g, "bar-series");
    for (const stacked of [true, "percent"] as const) {
      const unset = markup(renderBarStack({ stacked }).container);
      cleanup();
      const { container } = renderBarStack({ stacked, stackGap: 0 });
      expect(markup(container)).toBe(unset);
      const [a, b, c] = stackAt(container, ABC, 0, false) as Three;
      expect(a.lo).toBeCloseTo(b.hi, 6);
      expect(b.lo).toBeCloseTo(c.hi, 6);
      cleanup();
    }
  });
});

describe("ComposedChart stackGap (RM-164)", () => {
  const monthly = rows.map((row, i) => ({ ...row, month: new Date(2024, i, 1) }));

  function ComposedScaleProbe() {
    const { yScale } = useChart();
    probe.scale = (value) => yScale(value) ?? Number.NaN;
    return null;
  }

  const renderComposed = (stacked: ComposedChartProps["stacked"]) =>
    render(
      <ComposedChart data={monthly} stackGap={GAP} stacked={stacked} xDataKey="month">
        {KEYS.map((key) => (
          <SeriesBar animate={false} dataKey={key} fill={FILLS[key]} key={key} />
        ))}
        <ComposedScaleProbe />
      </ComposedChart>,
    );

  it("SeriesBar stacks keep their baseline and total, neighbours sit stackGap apart", () => {
    const { container } = renderComposed(true);
    rows.forEach((row, i) => {
      const [sa, sb, sc] = stackAt(container, ABC, i, false) as Three;
      expect(sa.hi).toBeCloseTo(probe.scale(0), 6);
      expect(sc.lo).toBeCloseTo(probe.scale(total(row)), 6);
      expect(sa.lo - sb.hi).toBeCloseTo(GAP, 6);
      expect(sb.lo - sc.hi).toBeCloseTo(GAP, 6);
    });
  });

  it("SeriesBar percent stacks still end at 100 %", () => {
    const { container } = renderComposed("percent");
    rows.forEach((_, i) => {
      const [sa, sb, sc] = stackAt(container, ABC, i, false) as Three;
      expect(sa.hi).toBeCloseTo(probe.scale(0), 6);
      expect(sc.lo).toBeCloseTo(probe.scale(1), 6);
      expect(sa.lo - sb.hi).toBeCloseTo(GAP, 6);
    });
  });
});
