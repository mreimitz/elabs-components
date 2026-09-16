/**
 * DistributionChart smoke + budget tests.
 *
 * `@visx/responsive`'s `ParentSize` measures with a `ResizeObserver`, which
 * jsdom does not implement, so it is mocked to a concrete box — the same
 * precedent `choropleth-chart.test.tsx` sets. Full render + axe a11y across both
 * themes is the Storybook interaction suite's job
 * (`pnpm --filter @elabs-ai/components-docs test-storybook`); what is asserted
 * here is the wiring those stories cannot see: shared bins, the seeded jitter's
 * determinism, the keyboard-target parity rule, and the 2,000-record hover
 * budget.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/** The mocked box. Mutable so a test can re-render the same chart at another height. */
const mockSize = vi.hoisted(() => ({ width: 640, height: 320 }));

vi.mock("@visx/responsive", () => ({
  ParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => React.ReactNode;
    debounceTime?: number;
  }) => <>{children({ width: mockSize.width, height: mockSize.height })}</>,
}));

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

import { seededRnd } from "../../marks/seeded-rnd";
import { compositeOver, contrastOf, type Rgba, resolveCssColor } from "../on-mark-ink";
import { applyThemeVars, readerFor, type ReferenceTheme } from "../on-mark-ink.fixtures";
import { DistributionChart } from "./distribution-chart";
import { seriesPatternFills, seriesPatterns, stubHighDecoration } from "../high-decoration-fixture";
import { rungCount } from "./kinds/histogram";

/** The median flag runs from a horizontal histogram's baseline to the far edge of its band. */
function flagSpan(container: HTMLElement): { base: number; band: number } {
  const flag = container.querySelector('[data-slot="distribution-chart-median"] line');
  const base = Number(flag?.getAttribute("y1"));
  return { base, band: base - Number(flag?.getAttribute("y2")) };
}

/** How far the tallest rung stack reaches above the baseline. */
function tallestStackExtent(container: HTMLElement, base: number): number {
  let extent = 0;
  for (const rung of container.querySelectorAll('[data-slot="unit-stack-unit"]')) {
    extent = Math.max(extent, base - Number(rung.getAttribute("y1")));
  }
  return extent;
}

/** The reply-time fixture the stories use, in miniature. */
function replies(n: number, k: number, team: string) {
  return Array.from({ length: n }, (_v, i) => ({
    id: `${team}-${i}`,
    team,
    minutes: 5 + seededRnd(i, k) * 180,
  }));
}

const DATA = [...replies(60, 3, "Support"), ...replies(60, 9, "Billing")];

describe("DistributionChart", () => {
  it("renders a box for every group, on one axis", () => {
    const { container } = render(
      <DistributionChart data={DATA} groupKey="team" kind="box" valueKey="minutes" />,
    );
    expect(container.querySelectorAll('[data-slot="distribution-chart-box"]')).toHaveLength(2);
    // One axis, drawn once — not one per group.
    expect(container.querySelectorAll('[data-slot="distribution-chart-axis"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-slot="distribution-chart-group-label"]')).toHaveLength(
      2,
    );
  });

  it("switches the mark without moving the axis — the 'one picture' claim", () => {
    const ticksOf = (kind: "box" | "violin" | "strip") => {
      const { container, unmount } = render(
        <DistributionChart data={DATA} groupKey="team" kind={kind} valueKey="minutes" />,
      );
      const labels = [
        ...container.querySelectorAll('[data-slot="distribution-chart-axis"] text'),
      ].map((node) => node.textContent);
      unmount();
      return labels;
    };
    expect(ticksOf("strip")).toEqual(ticksOf("box"));
  });

  it("widens the axis for a violin — the ONE documented exception to the shared scale", () => {
    // A violin's silhouette runs 1.6 bandwidths past the data (`kde.ts`), so the
    // plot has to reach that far or the tails are clipped by the SVG edge. Every
    // other kind shares the data's own extent. Asserted, not left implicit,
    // because it is the single place the "one scale" promise bends.
    const domainOf = (kind: "box" | "violin") => {
      const { container, unmount } = render(
        <DistributionChart data={DATA} groupKey="team" kind={kind} valueKey="minutes" />,
      );
      const ticks = [...container.querySelectorAll('[data-slot="distribution-chart-axis"] text')]
        .map((node) => Number(node.textContent))
        .filter((value) => Number.isFinite(value));
      unmount();
      return [Math.min(...ticks), Math.max(...ticks)] as const;
    };
    const box = domainOf("box");
    const violin = domainOf("violin");
    expect(violin[0]).toBeLessThan(box[0]);
    expect(violin[1]).toBeGreaterThan(box[1]);
  });

  it("gives every group the SAME histogram bin edges", () => {
    const { container } = render(
      <DistributionChart
        bins={8}
        data={DATA}
        groupKey="team"
        kind="histogram"
        valueKey="minutes"
      />,
    );
    const groups = [...container.querySelectorAll('[data-slot="distribution-chart-histogram"]')];
    expect(groups).toHaveLength(2);
    const edgesOf = (group: Element) =>
      [...group.querySelectorAll("rect[fill='transparent']")].map((node) => node.getAttribute("x"));
    expect(edgesOf(groups[1] as Element)).toEqual(edgesOf(groups[0] as Element));
  });

  it("draws bins as countable rungs when `unit` is set, and as bars otherwise", () => {
    const bars = render(
      <DistributionChart bins={6} data={DATA} kind="histogram" valueKey="minutes" />,
    );
    expect(
      bars.container.querySelectorAll('[data-slot="distribution-chart-histogram"] rect'),
    ).not.toHaveLength(0);
    bars.unmount();

    const rungs = render(
      <DistributionChart bins={6} data={DATA} kind="histogram" unit={2} valueKey="minutes" />,
    );
    expect(rungs.container.querySelectorAll('[data-slot="unit-stack"]').length).toBeGreaterThan(0);
  });

  it("puts rungs on the plot's count scale, so the stack grows with the plot (#242)", () => {
    const measure = (height: number) => {
      mockSize.height = height;
      const view = render(
        <DistributionChart bins={6} data={DATA} kind="histogram" unit={2} valueKey="minutes" />,
      );
      const { base, band } = flagSpan(view.container);
      const extent = tallestStackExtent(view.container, base);
      view.unmount();
      return { band, extent };
    };
    try {
      const short = measure(300);
      const tall = measure(600);
      // The tallest bin fills the count room (0.86 of the band), not a fixed 6px pitch.
      expect(short.extent).toBeGreaterThanOrEqual(short.band * 0.86 * 0.8);
      expect(tall.extent / short.extent).toBeGreaterThan(1.8);
    } finally {
      mockSize.height = 320;
    }
  });

  it("draws a one-rung bin above the baseline, and never an occupied bin as empty (#242)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(
      <DistributionChart
        bins={[0, 50, 100]}
        data={[{ minutes: 10 }, { minutes: 20 }, { minutes: 30 }, { minutes: 40 }, { minutes: 60 }]}
        kind="histogram"
        unit={4}
        valueKey="minutes"
      />,
    );
    const { base } = flagSpan(container);
    const counts = [...container.querySelectorAll('[data-slot="unit-stack"]')].map(
      (stack) => stack.querySelectorAll('[data-slot="unit-stack-unit"]').length,
    );
    // Four records → one rung; ONE record → still one rung, not an empty bin.
    expect(counts).toEqual([1, 1]);
    for (const rung of container.querySelectorAll('[data-slot="unit-stack-unit"]')) {
      expect(Number(rung.getAttribute("y1"))).toBeLessThan(base);
    }
    expect(rungCount(0, 4)).toBe(0);
    expect(rungCount(1, 4)).toBe(1);
    expect(rungCount(11, 5)).toBe(2);
    // A one-rung tallest bin is too coarse to count: the caller hears about it once.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("too coarse to count"));
    warn.mockRestore();
  });

  it("renders the unit legend and folds it into the description, only with rungs (#242)", () => {
    const { container, rerender } = render(
      <DistributionChart
        accessibleLabel="Reply time"
        data={DATA}
        kind="histogram"
        unit={2}
        unitLabel="one rung = 2 tickets"
        valueKey="minutes"
      />,
    );
    expect(
      container.querySelector('[data-slot="distribution-chart-unit-label"]')?.textContent,
    ).toBe("one rung = 2 tickets");
    const figure = screen.getByRole("figure", { name: "Reply time" });
    const description = document.getElementById(figure.getAttribute("aria-describedby") as string);
    expect(description?.textContent?.startsWith("one rung = 2 tickets. ")).toBe(true);

    // Bars have nothing for the legend to decode.
    rerender(
      <DistributionChart
        accessibleLabel="Reply time"
        data={DATA}
        kind="histogram"
        unitLabel="one rung = 2 tickets"
        valueKey="minutes"
      />,
    );
    expect(container.querySelector('[data-slot="distribution-chart-unit-label"]')).toBeNull();
  });

  it("renders one record per row on a strip, jittered deterministically", () => {
    const positions = () => {
      const { container, unmount } = render(
        <DistributionChart data={DATA} groupKey="team" kind="strip" valueKey="minutes" />,
      );
      const dots = [...container.querySelectorAll('[data-slot="distribution-chart-record"]')];
      const cy = dots.map((node) => node.getAttribute("cy"));
      unmount();
      return { count: dots.length, cy };
    };
    const first = positions();
    expect(first.count).toBe(DATA.length);
    // Seeded, not random: the same rows land in the same places on a re-render.
    expect(positions().cy).toEqual(first.cy);
    // …and the jitter really displaces (a strip whose dots all share one cy is
    // a line, which is the bug the seeded jitter exists to avoid).
    expect(new Set(first.cy).size).toBeGreaterThan(10);
  });

  it("suppresses outliers when asked", () => {
    const spiked = [...DATA, { id: "x", team: "Support", minutes: 4000 }];
    const shown = render(
      <DistributionChart data={spiked} groupKey="team" kind="box" valueKey="minutes" />,
    );
    expect(
      shown.container.querySelectorAll('[data-slot="distribution-chart-outlier"]').length,
    ).toBeGreaterThan(0);
    shown.unmount();

    const hidden = render(
      <DistributionChart
        data={spiked}
        groupKey="team"
        kind="box"
        showOutliers={false}
        valueKey="minutes"
      />,
    );
    expect(
      hidden.container.querySelectorAll('[data-slot="distribution-chart-outlier"]'),
    ).toHaveLength(0);
  });

  it("drops the median mark when showMedian is false", () => {
    const { container, rerender } = render(
      <DistributionChart data={DATA} groupKey="team" kind="box" valueKey="minutes" />,
    );
    expect(container.querySelectorAll('[data-slot="distribution-chart-median"]')).toHaveLength(2);
    rerender(
      <DistributionChart
        data={DATA}
        groupKey="team"
        kind="box"
        showMedian={false}
        valueKey="minutes"
      />,
    );
    expect(container.querySelectorAll('[data-slot="distribution-chart-median"]')).toHaveLength(0);
  });

  it("puts n, the median and the IQR in a text alternative, per group", () => {
    render(
      <DistributionChart
        accessibleLabel="Reply time by team"
        data={DATA}
        groupKey="team"
        kind="box"
        valueFormat="number"
        valueKey="minutes"
      />,
    );
    const figure = screen.getByRole("figure", { name: "Reply time by team" });
    const description = document.getElementById(figure.getAttribute("aria-describedby") as string);
    expect(description?.textContent).toContain("Support: 60 records, median");
    expect(description?.textContent).toContain("Billing: 60 records, median");
    expect(description?.textContent).toContain("IQR");
  });

  it("lets a caller's own description win over the generated one", () => {
    render(
      <DistributionChart
        accessibleDescription="Mediana 30 minutos"
        accessibleLabel="Tiempo de respuesta"
        data={DATA}
        kind="box"
        valueKey="minutes"
      />,
    );
    const figure = screen.getByRole("figure", { name: "Tiempo de respuesta" });
    const description = document.getElementById(figure.getAttribute("aria-describedby") as string);
    expect(description?.textContent).toBe("Mediana 30 minutos");
  });

  it("adds NO focusable target and no layer until the caller asks for interaction", () => {
    const { container } = render(
      <DistributionChart data={DATA} groupKey="team" kind="strip" valueKey="minutes" />,
    );
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.querySelectorAll('[data-slot="chart-datapoint-layer-target"]')).toHaveLength(
      0,
    );
  });

  it("makes EVERY record a keyboard target on a strip (2.1.1 parity), with one tab stop", () => {
    const { container } = render(
      <DistributionChart
        data={DATA}
        groupKey="team"
        kind="strip"
        onDatapointClick={() => {}}
        valueKey="minutes"
      />,
    );
    const targets = [
      ...container.querySelectorAll<HTMLButtonElement>(
        '[data-slot="chart-datapoint-layer-target"]',
      ),
    ];
    expect(targets).toHaveLength(DATA.length);
    expect(targets.filter((node) => node.tabIndex === 0)).toHaveLength(1);
  });

  it("hands the activated record back through the shared datapoint payload", () => {
    const onDatapointClick = vi.fn();
    const { container } = render(
      <DistributionChart
        data={DATA}
        groupKey="team"
        kind="strip"
        onDatapointClick={onDatapointClick}
        valueKey="minutes"
      />,
    );
    const target = container.querySelector<HTMLButtonElement>(
      '[data-slot="chart-datapoint-layer-target"]',
    );
    fireEvent.click(target as HTMLButtonElement);
    expect(onDatapointClick).toHaveBeenCalledTimes(1);
    const point = onDatapointClick.mock.calls[0]?.[0];
    expect(point.datum).toEqual(DATA[0]);
    expect(point.seriesKey).toBe("minutes");
    expect(point.value).toBe(DATA[0]?.minutes);
  });

  it("shades a box by MEDIAN RANK under the sequential palette", () => {
    // Two groups with deliberately different medians; the slower one must get
    // the more intense step of the ordered ramp, whichever order it was listed in.
    const fast = Array.from({ length: 20 }, (_v, i) => ({ team: "Fast", minutes: 10 + i * 0.1 }));
    const slow = Array.from({ length: 20 }, (_v, i) => ({ team: "Slow", minutes: 90 + i * 0.1 }));
    const { container } = render(
      <DistributionChart
        data={[...slow, ...fast]}
        groupKey="team"
        kind="box"
        palette="sequential"
        valueKey="minutes"
      />,
    );
    const fills = [...container.querySelectorAll('[data-slot="distribution-chart-box"] rect')].map(
      (node) => node.getAttribute("fill"),
    );
    // Listed slow-first, so the FIRST box is the higher-median group and must
    // carry the ramp's last (most intense) step.
    expect(fills[0]).toBe("var(--chart-seq-7)");
    expect(fills[1]).toBe("var(--chart-seq-1)");
  });

  it("renders nothing rather than dividing by zero for empty data", () => {
    const { container } = render(<DistributionChart data={[]} kind="box" valueKey="minutes" />);
    expect(container.querySelectorAll('[data-slot="distribution-chart-box"]')).toHaveLength(0);
    expect(container.querySelector('[data-slot="distribution-chart"]')).not.toBeNull();
  });

  it("drops a row whose value column is not a number instead of pulling the median to zero", () => {
    const dirty = [
      ...DATA,
      { id: "bad", team: "Support", minutes: null },
      { id: "worse", team: "Support" },
    ];
    const { container } = render(
      <DistributionChart data={dirty} groupKey="team" kind="strip" valueKey="minutes" />,
    );
    expect(container.querySelectorAll('[data-slot="distribution-chart-record"]')).toHaveLength(
      DATA.length,
    );
  });

  /**
   * The acceptance budget: "2,000-record strip stays interactive (< 16 ms
   * hover)". The wall clock is measured in the BROWSER, by the `DenseStrip`
   * story's play function — that is where a frame budget means anything, and
   * where 16 ms is the frame. Asserting it here would be measuring jsdom under
   * whatever else the machine is running: the same hover measured 6 ms idle and
   * 49 ms with nine sibling package builds in flight, which makes an absolute
   * millisecond threshold a coin toss rather than a regression detector.
   *
   * What jsdom CAN prove, deterministically, is the reason the hover is cheap:
   * the memoized mark layer is not re-rendered by the container's tooltip state,
   * so a hover costs one tooltip, not 2,000 circles. That is asserted
   * structurally (node identity) and as a RATIO against a full mount, which
   * scales with the machine instead of fighting it.
   */
  it("hovers one of 2,000 records without redrawing the strip", () => {
    const many = replies(2000, 17, "Support");
    const mountStart = performance.now();
    const { container } = render(<DistributionChart data={many} kind="strip" valueKey="minutes" />);
    const mountCost = performance.now() - mountStart;
    const dots = container.querySelectorAll('[data-slot="distribution-chart-record"]');
    expect(dots).toHaveLength(2000);

    const before = dots[500] as SVGCircleElement;
    const start = performance.now();
    fireEvent.pointerEnter(before);
    const elapsed = performance.now() - start;

    // Structural: the same DOM nodes are still there, i.e. the memoized layer
    // was not re-rendered by the tooltip's state change.
    const after = container.querySelectorAll('[data-slot="distribution-chart-record"]');
    expect(after[500]).toBe(before);
    // …and the cost is a small fraction of drawing the strip, not another one.
    expect(elapsed * 4).toBeLessThan(mountCost);
  });
});

describe("DistributionChart decoration pattern channel (ADR 0011, #257)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("patterns each group's box and violin body with its own series pattern at high decoration", () => {
    stubHighDecoration();
    for (const kind of ["box", "violin"] as const) {
      const { container, unmount } = render(
        <DistributionChart data={DATA} groupKey="team" kind={kind} valueKey="minutes" />,
      );
      const ids = seriesPatterns(container).map((pattern) => pattern.id);
      expect(ids).toHaveLength(2);
      const fills = seriesPatternFills(
        container,
        `[data-slot="distribution-chart-${kind}"] [fill]`,
      );
      expect(new Set(fills.map((el) => el.getAttribute("fill")))).toEqual(
        new Set(ids.map((id) => `url(#${id})`)),
      );
      unmount();
    }
  });

  it("patterns histogram bars but never strip dots, and nothing at low decoration", () => {
    const low = render(<DistributionChart data={DATA} kind="histogram" valueKey="minutes" />);
    expect(seriesPatterns(low.container)).toHaveLength(0);
    low.unmount();

    stubHighDecoration();
    const histogram = render(<DistributionChart data={DATA} kind="histogram" valueKey="minutes" />);
    expect(seriesPatterns(histogram.container)).toHaveLength(1);
    expect(seriesPatternFills(histogram.container, "rect").length).toBeGreaterThan(0);
    histogram.unmount();

    const strip = render(
      <DistributionChart data={DATA} groupKey="team" kind="strip" valueKey="minutes" />,
    );
    expect(seriesPatterns(strip.container)).toHaveLength(0);
  });
});

describe("the box/violin median tick reads on its own group's fill (#243)", () => {
  const ON_LIGHT = "var(--chart-ink-on-light)";
  const ON_DARK = "var(--chart-ink-on-dark)";
  /** Three groups → `spread` hands them sequential steps 1, 4 and 7 by median rank. */
  const THREE = [10, 50, 90].flatMap((base, g) =>
    Array.from({ length: 20 }, (_v, i) => ({ team: `G${g}`, minutes: base + i * 0.1 })),
  );

  let cleanup: (() => void) | null = null;
  afterEach(() => {
    cleanup?.();
    cleanup = null;
  });

  /** Each median tick's stroke, and its contrast on the composited body. */
  function ticks(container: HTMLElement, theme: ReferenceTheme, kind: "box" | "violin") {
    const read = readerFor(theme);
    const ground = resolveCssColor("var(--chart-background)", read) as Rgba;
    const groups = [...container.querySelectorAll(`[data-slot="distribution-chart-${kind}"]`)];
    return groups.map((group) => {
      const mark = group.querySelector(kind === "box" ? "rect" : "path") as Element;
      const tick = group.querySelector('[data-slot="distribution-chart-median"]') as Element;
      const plate = compositeOver(
        resolveCssColor(mark.getAttribute("fill") as string, read) as Rgba,
        ground,
        Number(mark.getAttribute("opacity")),
      );
      const stroke = tick.getAttribute("stroke") as string;
      return { stroke, ratio: contrastOf(resolveCssColor(stroke, read) as Rgba, plate) };
    });
  }

  it.each([
    ["light", "box", [ON_LIGHT, ON_LIGHT, ON_DARK]],
    ["dark", "box", [ON_DARK, ON_LIGHT, ON_LIGHT]],
    ["light", "violin", [ON_LIGHT, ON_LIGHT, ON_DARK]],
    ["dark", "violin", [ON_DARK, ON_LIGHT, ON_LIGHT]],
  ] as const)(
    "%s %s, sequential: each tick takes the anchor its step needs",
    (theme, kind, inks) => {
      cleanup = applyThemeVars(theme);
      const { container } = render(
        <DistributionChart
          data={THREE}
          groupKey="team"
          kind={kind}
          palette="sequential"
          valueKey="minutes"
        />,
      );
      const measured = ticks(container, theme, kind);
      expect(measured.map((t) => t.stroke)).toEqual(inks);
      for (const { stroke, ratio } of measured) {
        // WCAG 1.4.11 asks 3:1 of a mark; the anchors reach AA text.
        expect(ratio, `${theme} ${kind} ${stroke} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    },
  );

  it.each(["light", "dark"] as const)(
    "%s, default categorical palette: every tick clears 3:1 (was 1.42 / 2.49 / 2.61 on light)",
    (theme) => {
      cleanup = applyThemeVars(theme);
      const { container } = render(
        <DistributionChart data={THREE} groupKey="team" kind="box" valueKey="minutes" />,
      );
      const measured = ticks(container, theme, "box");
      expect(measured).toHaveLength(3);
      for (const { stroke, ratio } of measured) {
        expect(ratio, `${theme} ${stroke} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3);
      }
    },
  );
});
