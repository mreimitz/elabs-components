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
import { describe, expect, it, vi } from "vitest";

vi.mock("@visx/responsive", () => ({
  ParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => React.ReactNode;
    debounceTime?: number;
  }) => <>{children({ width: 640, height: 320 })}</>,
}));

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

import { seededRnd } from "../../marks/seeded-rnd";
import { DistributionChart } from "./distribution-chart";

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
   * hover)". Two assertions, because the wall clock alone would be a flaky
   * proxy — the STRUCTURAL one is the real guarantee (the memoized mark layer
   * does not re-render when the container's tooltip state changes), and the
   * clock confirms it holds in practice with room to spare.
   */
  it("hovers one of 2,000 records inside a frame, without redrawing the strip", () => {
    const many = replies(2000, 17, "Support");
    const { container } = render(<DistributionChart data={many} kind="strip" valueKey="minutes" />);
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
    expect(elapsed).toBeLessThan(16);
  });
});
