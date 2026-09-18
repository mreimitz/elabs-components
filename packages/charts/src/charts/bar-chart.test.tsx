import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// @visx/responsive uses ResizeObserver + real DOM measurement which jsdom lacks.
// Mock ParentSize to supply a fixed 560×288 viewport so ChartInner renders.
// Real render/interaction/a11y is covered by the Storybook build (Charts/BarChart story).
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

import { UNIT_STACK_EMPHASIS } from "../marks";
import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import { BarXAxis } from "./bar-x-axis";
import { BarYAxis } from "./bar-y-axis";
import { resolvePalette } from "./chart-context";
import { Grid } from "./grid";
import { YAxis } from "./y-axis";

const minimalData = [
  { month: "Jan", value: 100 },
  { month: "Feb", value: 200 },
  { month: "Mar", value: 150 },
];

afterEach(cleanup);

describe("BarChart", () => {
  it("is exported as a function (forwardRef wrapper)", () => {
    expect(typeof BarChart).toBe("object"); // forwardRef returns an exotic object, not a plain function
    expect(BarChart.displayName).toBe("BarChart");
  });

  it("mounts without throwing and attaches a container div to the document", () => {
    const { container } = render(
      <BarChart data={minimalData} xDataKey="month">
        <Bar dataKey="value" fill="var(--chart-1)" />
      </BarChart>,
    );
    // The root element rendered by BarChart is a div
    const root = container.firstChild as HTMLElement;
    expect(root).toBeInTheDocument();
    expect(root.tagName).toBe("DIV");
  });

  it("applies a custom className to the container", () => {
    const { container } = render(
      <BarChart data={minimalData} xDataKey="month" className="my-bar-chart">
        <Bar dataKey="value" fill="var(--chart-1)" />
      </BarChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass("my-bar-chart");
  });

  it("forwards a ref to the container div", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <BarChart data={minimalData} xDataKey="month" ref={ref}>
        <Bar dataKey="value" fill="var(--chart-1)" />
      </BarChart>,
    );
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe("DIV");
  });

  it("renders a Grid child without throwing", () => {
    expect(() =>
      render(
        <BarChart data={minimalData} xDataKey="month">
          <Grid horizontal />
          <Bar dataKey="value" fill="var(--chart-1)" />
        </BarChart>,
      ),
    ).not.toThrow();
  });

  // #394: axis tick labels must reach the density-aware `text-meta` ROLE, not
  // the raw `text-xs` UTILITY the type dial cannot see (styling-and-tokens.md
  // "Type is a role, not a size").
  describe("BarXAxis / BarYAxis — density-role className (#394)", () => {
    it("BarXAxis renders its tick label with the text-meta role, not the raw text-xs utility", () => {
      const { container } = render(
        <BarChart data={minimalData} xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" />
          <BarXAxis />
        </BarChart>,
      );
      const label = container.querySelector(".text-chart-label");
      expect(label).not.toBeNull();
      expect(label).toHaveClass("text-meta");
      expect(label).not.toHaveClass("text-xs");
    });

    it("BarYAxis renders its tick label with the text-meta role, not the raw text-xs utility, and keeps text-end/truncate", () => {
      const { container } = render(
        <BarChart data={minimalData} xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" />
          <BarYAxis />
        </BarChart>,
      );
      const label = container.querySelector("span.truncate");
      expect(label).not.toBeNull();
      expect(label).toHaveClass("text-meta");
      expect(label).not.toHaveClass("text-xs");
      expect(label).toHaveClass("text-end");
      expect(label).toHaveClass("truncate");
      expect(label).toHaveClass("whitespace-nowrap");
    });
  });

  // The category axis measures its labels and picks a mode instead of letting
  // them overprint each other. The cascade itself is unit-tested exhaustively in
  // `category-axis-plan.test.ts`; these assert the WIRING — that the rendered
  // axis actually reflects the plan the chart reserved space from.
  describe("category axis fit", () => {
    const longLabels = Array.from({ length: 6 }, (_, i) => ({
      month: `Q${i + 1} Western Region Alpha`,
      value: 100 + i,
    }));

    it("leaves short labels horizontal and untruncated", () => {
      const { container } = render(
        <BarChart data={minimalData} xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" />
          <BarXAxis />
        </BarChart>,
      );

      expect(container.querySelector(".-rotate-45")).toBeNull();
      expect(container.querySelector(".sr-only")).toBeNull();
      expect(container.textContent).toContain("Jan");
    });

    it("tilts and ellipsizes long labels, keeping the full name for AT", () => {
      // `fit="tilt"` pins the tilt + ellipsis rung: under `"auto"` these
      // labels now take the two-line wrap rung first (RM-108).
      const { container } = render(
        <BarChart data={longLabels} xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" />
          <BarXAxis fit="tilt" />
        </BarChart>,
      );

      expect(container.querySelector(".-rotate-45")).not.toBeNull();
      // `span[…]`, not `[…]`: the chart body <svg> is aria-hidden too.
      const painted = container.querySelector<HTMLElement>('span[aria-hidden="true"]');
      expect(painted?.textContent).toMatch(/…$/);
      // The ellipsised string must never be the accessible name.
      const srOnly = container.querySelector<HTMLElement>(".sr-only");
      expect(srOnly?.textContent).toBe("Q1 Western Region Alpha");
    });

    it('fit="off" pins the pre-fit render — full labels, no rotation', () => {
      const { container } = render(
        <BarChart data={longLabels} xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" />
          <BarXAxis fit="off" />
        </BarChart>,
      );

      expect(container.querySelector(".-rotate-45")).toBeNull();
      expect(container.querySelector(".sr-only")).toBeNull();
      expect(container.textContent).toContain("Q1 Western Region Alpha");
    });

    // The standing bug this fixes: labels were clipped at a hardcoded 70px
    // inside a 40px gutter, so every long row label overflowed the chart.
    it("BarYAxis clips to the gutter the chart reserved, not a constant", () => {
      const { container } = render(
        <BarChart data={longLabels} orientation="horizontal" xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" />
          <BarYAxis />
        </BarChart>,
      );

      const label = container.querySelector<HTMLElement>("span.truncate");
      expect(label).not.toBeNull();
      const gutter = label?.parentElement?.parentElement as HTMLElement;
      const gutterWidth = Number.parseFloat(gutter.style.width);
      const maxWidth = Number.parseFloat(label?.style.maxWidth ?? "");

      expect(Number.isFinite(gutterWidth)).toBe(true);
      // The gutter grew past the 40px default margin to pay for the labels.
      expect(gutterWidth).toBeGreaterThan(40);
      expect(maxWidth).toBeLessThanOrEqual(gutterWidth - 8);
      expect(maxWidth).toBeGreaterThan(70);
      expect(container.querySelector(".-rotate-45")).toBeNull();
    });

    // The cascade is a fix for sighted readers and, without this, a regression
    // for everyone else: the chart body is `aria-hidden`, so a category the
    // axis stops painting would leave the accessibility tree outright.
    it.each([
      ["BarXAxis", <BarXAxis key="x" />, undefined],
      ["BarYAxis", <BarYAxis key="y" />, "horizontal" as const],
    ])("%s keeps every dropped category name available to AT", (_name, axis, orientation) => {
      const crowded = Array.from({ length: 40 }, (_, i) => ({
        month: `Region ${i} Northwest Division`,
        value: 100 + i,
      }));

      const { container } = render(
        <BarChart data={crowded} orientation={orientation} xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" />
          {axis}
        </BarChart>,
      );

      const painted = container.querySelectorAll(".text-chart-label").length;
      expect(painted).toBeLessThan(crowded.length);
      // Nothing is lost: the names the axis did not paint are re-stated once.
      for (const row of crowded) {
        expect(container.textContent).toContain(row.month);
      }
    });
  });

  // Loading vs ready (#268): a charts-scoped `status: ChartStatus` alias renders
  // placeholder categories/bars instead of the (likely empty) real data.
  describe("loading", () => {
    it("renders without throwing when status is loading and data is empty", () => {
      expect(() =>
        render(
          <BarChart data={[]} status="loading" xDataKey="month">
            <Grid horizontal />
            <Bar dataKey="value" fill="var(--chart-1)" />
          </BarChart>,
        ),
      ).not.toThrow();
    });

    it("reports the loading chart phase via onPhaseChange", () => {
      const onPhaseChange = vi.fn();
      render(
        <BarChart data={[]} onPhaseChange={onPhaseChange} status="loading" xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" />
        </BarChart>,
      );
      expect(onPhaseChange).toHaveBeenCalledWith("loading");
    });

    it("renders a centered loading label when provided", () => {
      const { getByText } = render(
        <BarChart data={[]} loadingLabel="Loading data…" status="loading" xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" />
        </BarChart>,
      );
      expect(getByText("Loading data…")).toBeInTheDocument();
    });

    // Regression: placeholder bars (generateCategoricalSkeletonData) used to
    // paint at the real series color, presenting fabricated values as if they
    // were real (mirrors Line/Area's stroke de-emphasis via chartPhase).
    it("paints placeholder bars with the neutral skeleton fill, not the series color", () => {
      const { container } = render(
        <BarChart data={[]} status="loading" xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" />
        </BarChart>,
      );
      const barRects = Array.from(container.querySelectorAll("rect")).filter(
        (rect) => rect.getAttribute("fill") !== "transparent",
      );
      expect(barRects.length).toBeGreaterThan(0);
      for (const rect of barRects) {
        expect(rect.getAttribute("fill")).toBe("var(--muted)");
        expect(rect).not.toHaveAttribute("fill", "var(--chart-1)");
      }
    });
  });

  // RM-027: diverging bars + the zero baseline hairline.
  describe("diverging bars / zeroLine", () => {
    const divergingData = [
      { month: "Jan", value: 100 },
      { month: "Feb", value: -50 },
      { month: "Mar", value: 30 },
    ];

    it("auto-shows the zero baseline when any value is negative", () => {
      const { container } = render(
        <BarChart data={divergingData} xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" />
        </BarChart>,
      );
      const zeroLine = container.querySelector("svg > g > line");
      expect(zeroLine).not.toBeNull();
      expect(zeroLine).toHaveAttribute("stroke", "var(--chart-foreground-muted)");
      expect(zeroLine).toHaveAttribute("stroke-width", "0.8");
    });

    it("stays off with all-positive data by default", () => {
      const { container } = render(
        <BarChart data={minimalData} xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" />
        </BarChart>,
      );
      expect(container.querySelector("svg > g > line")).toBeNull();
    });

    it("zeroLine={false} forces the hairline off even with negative data", () => {
      const { container } = render(
        <BarChart data={divergingData} xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" zeroLine={false} />
        </BarChart>,
      );
      expect(container.querySelector("svg > g > line")).toBeNull();
    });

    it("zeroLine={true} forces the hairline on even with all-positive data", () => {
      const { container } = render(
        <BarChart data={minimalData} xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" zeroLine />
        </BarChart>,
      );
      expect(container.querySelector("svg > g > line")).not.toBeNull();
    });

    it("renders a negative bar as an asymmetric-radius <path>, not a <rect>, and never emits negative geometry", () => {
      const { container } = render(
        <BarChart data={divergingData} xDataKey="month">
          <Bar animate={false} dataKey="value" fill="var(--chart-1)" />
        </BarChart>,
      );
      // At least one negative bar (Feb: -50) must render via the path branch.
      // Selected by the stable `data-slot`, not by `fill` — at high decoration
      // `bar.tsx` swaps the palette fill for a `url(#bp-series-…)` pattern
      // (ADR 0011), so a fill-keyed selector only matches one of the two
      // render paths (#254).
      const barPaths = Array.from(container.querySelectorAll('[data-slot="bar-negative"]'));
      expect(barPaths.length).toBeGreaterThan(0);
      for (const p of barPaths) {
        expect(p.getAttribute("d")).toMatch(/^M/);
      }
      // No rect/path in the bar series ever gets negative width/height.
      const rects = container.querySelectorAll("rect");
      for (const rect of rects) {
        const w = rect.getAttribute("width");
        const h = rect.getAttribute("height");
        if (w !== null) expect(Number.parseFloat(w)).toBeGreaterThanOrEqual(0);
        if (h !== null) expect(Number.parseFloat(h)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // RM-027: showValues value labels.
  describe("showValues", () => {
    it("prints a signed HaloText label on a wide bar once settled", () => {
      const { container } = render(
        <BarChart data={minimalData} xDataKey="month">
          <Bar animate={false} dataKey="value" fill="var(--chart-1)" showValues />
        </BarChart>,
      );
      const labels = container.querySelectorAll(".text-chart-value");
      expect(labels.length).toBe(minimalData.length);
      expect(container.textContent).toContain("100");
      expect(container.textContent).toContain("200");
    });

    it("signs a negative value's label with the Unicode minus sign, not a hyphen", () => {
      const { container } = render(
        <BarChart data={[{ month: "Feb", value: -50 }]} xDataKey="month">
          <Bar animate={false} dataKey="value" fill="var(--chart-1)" showValues />
        </BarChart>,
      );
      const label = container.querySelector(".text-chart-value");
      expect(label?.textContent).toBe("−50");
      expect(label?.textContent).not.toContain("-50");
    });

    it("hides the label on a bar narrower than the minimum label width instead of shrinking it", () => {
      const crowded = Array.from({ length: 40 }, (_, i) => ({
        month: `C${i}`,
        value: 100 + i,
      }));
      const { container } = render(
        <BarChart data={crowded} xDataKey="month">
          <Bar animate={false} dataKey="value" fill="var(--chart-1)" showValues />
        </BarChart>,
      );
      expect(container.querySelectorAll(".text-chart-value").length).toBe(0);
      // The bars themselves still render.
      expect(container.querySelectorAll("rect[fill='var(--chart-1)']").length).toBe(crowded.length);
    });

    it("does not render any label when showValues is unset (default, byte-identical)", () => {
      const { container } = render(
        <BarChart data={minimalData} xDataKey="month">
          <Bar animate={false} dataKey="value" fill="var(--chart-1)" />
        </BarChart>,
      );
      expect(container.querySelectorAll(".text-chart-value").length).toBe(0);
    });

    // #250 — compaction was decided per value, so a series straddling
    // `COMPACT_THRESHOLD` (1000) mixed "1K" beside "400" in one label set.
    it("uses ONE notation across every value label, even when the series straddles the compact threshold", () => {
      const { container } = render(
        <BarChart
          data={[
            { month: "Jan", value: 4200 },
            { month: "Feb", value: -900 },
            { month: "Mar", value: 5600 },
          ]}
          xDataKey="month"
        >
          <Bar animate={false} dataKey="value" fill="var(--chart-1)" showValues />
        </BarChart>,
      );
      const labels = [...container.querySelectorAll(".text-chart-value")].map((l) => l.textContent);
      expect(labels).toHaveLength(3);
      // Either every label is compact or none is — never a mix.
      const compactCount = labels.filter((l) => /[KMB]/.test(l ?? "")).length;
      expect(compactCount === 0 || compactCount === labels.length).toBe(true);
      // -900 never compacts on its own, so the set (correctly) stays plain.
      expect(container.textContent).toContain("4,200");
      expect(container.textContent).toContain("−900");
      expect(container.textContent).toContain("5,600");
    });
  });

  // RM-027: unit mode (lieflat F1 Rung Bars) — a countable UnitStack instead
  // of a solid fill.
  describe("unit mode", () => {
    it("renders a UnitStack instead of a solid rect when unit is set", () => {
      const { container } = render(
        <BarChart data={minimalData} xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" unit={20} />
        </BarChart>,
      );
      const stacks = container.querySelectorAll('[data-slot="unit-stack"]');
      expect(stacks.length).toBe(minimalData.length);
      const units = container.querySelectorAll('[data-slot="unit-stack-unit"]');
      // Jan: 100/20 = 5 rungs, Feb: 200/20 = 10, Mar: 150/20 = 7.5 -> FLOORED
      // to 7, not rounded to 8 — a rung ladder must never count past the
      // value it encodes (#241).
      expect(units.length).toBe(5 + 10 + 7);
    });

    it("renders instantly without an AnimatedBar grow-in even on first mount", () => {
      const { container } = render(
        <BarChart data={minimalData} xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" unit={20} />
        </BarChart>,
      );
      // No solid <rect> bars for this series — unit mode never falls through
      // to AnimatedBar/the static rect branch.
      expect(container.querySelectorAll('[data-slot="unit-stack"]').length).toBeGreaterThan(0);
    });

    it("leaves rendering unchanged (solid rects, no UnitStack) when unit is unset", () => {
      const { container } = render(
        <BarChart data={minimalData} xDataKey="month">
          <Bar animate={false} dataKey="value" fill="var(--chart-1)" />
        </BarChart>,
      );
      expect(container.querySelectorAll('[data-slot="unit-stack"]').length).toBe(0);
    });

    // #241 — two geometry bugs: the emphatic rung overran its own column into
    // the next one, and the rung pitch was derived from the bar's own pixel
    // span instead of the value scale (worth a different amount per column,
    // and always one unit short of the bar's true value).
    describe("rung geometry (#241)", () => {
      const monthlyValues = [
        { month: "Jan", value: 12000 },
        { month: "Feb", value: 15500 },
        { month: "Mar", value: 11000 },
      ];

      const rangeOf = (stack: Element) => {
        const xs = [...stack.querySelectorAll('[data-slot="unit-stack-unit"]')].flatMap((u) => [
          Number.parseFloat(u.getAttribute("x1") ?? "0"),
          Number.parseFloat(u.getAttribute("x2") ?? "0"),
        ]);
        return [Math.min(...xs), Math.max(...xs)] as const;
      };

      it("keeps adjacent stacks' cross-axis extents disjoint (no emphatic-rung overhang)", () => {
        const { container } = render(
          <BarChart data={monthlyValues} xDataKey="month">
            <Bar dataKey="value" fill="var(--chart-1)" unit={2000} />
          </BarChart>,
        );
        const stacks = [...container.querySelectorAll('[data-slot="unit-stack"]')];
        expect(stacks.length).toBe(3);
        const ranges = stacks.map(rangeOf);
        for (let i = 1; i < ranges.length; i++) {
          // Adjacent bars run left to right, so the previous stack's right
          // edge must not reach into the next stack's left edge.
          expect(ranges[i - 1]![1]).toBeLessThanOrEqual(ranges[i]![0]);
        }
      });

      it("uses the same rung pitch in every column of one chart", () => {
        const { container } = render(
          <BarChart data={monthlyValues} xDataKey="month">
            <Bar dataKey="value" fill="var(--chart-1)" unit={2000} />
          </BarChart>,
        );
        const pitchOf = (stack: Element) => {
          const ys = [...stack.querySelectorAll('[data-slot="unit-stack-unit"]')]
            .map((u) => Number.parseFloat(u.getAttribute("y1") ?? "0"))
            .sort((a, b) => a - b);
          return ys[1]! - ys[0]!;
        };
        const stacks = [...container.querySelectorAll('[data-slot="unit-stack"]')];
        const pitches = stacks.map(pitchOf);
        for (const pitch of pitches.slice(1)) {
          expect(pitch).toBeCloseTo(pitches[0]!, 5);
        }
      });

      it("floors the count so a rung ladder never counts past the value it encodes", () => {
        // 11000 / 2000 = 5.5 — must floor to 5, never round to 6.
        const { container } = render(
          <BarChart data={[{ month: "Mar", value: 11000 }]} xDataKey="month">
            <Bar dataKey="value" fill="var(--chart-1)" unit={2000} />
          </BarChart>,
        );
        expect(container.querySelectorAll('[data-slot="unit-stack-unit"]').length).toBe(5);
      });

      it("keeps the emphatic (every-5th) rung within the bar's own cross-axis extent", () => {
        const { container } = render(
          <BarChart data={[{ month: "Jan", value: 12000 }]} xDataKey="month">
            <Bar dataKey="value" fill="var(--chart-1)" unit={2000} />
          </BarChart>,
        );
        const units = [...container.querySelectorAll('[data-slot="unit-stack-unit"]')];
        const widthOf = (u: Element) =>
          Math.abs(Number(u.getAttribute("x2")) - Number(u.getAttribute("x1")));
        // 12000 / 2000 = 6 rungs; the 5th (index 4) is the emphatic one.
        const ordinaryWidth = widthOf(units[0]!);
        const emphaticWidth = widthOf(units[4]!);
        expect(emphaticWidth).toBeGreaterThan(ordinaryWidth);
        // The emphatic mark is reserved exactly UNIT_STACK_EMPHASIS× the
        // ordinary width — never wider, which is what keeps it flush with
        // (not beyond) the bar's own edge.
        expect(emphaticWidth).toBeCloseTo(ordinaryWidth * UNIT_STACK_EMPHASIS, 5);
      });
    });
  });

  // RM-027: highlightKey — one hero bar in --chart-foreground ink, the rest
  // from a resolved palette instead of the series fill.
  describe("highlightKey", () => {
    it("draws the matched bar in --chart-foreground and the rest from the palette", () => {
      const { container } = render(
        <BarChart data={minimalData} xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" highlightKey="Feb" />
        </BarChart>,
      );
      const rects = Array.from(container.querySelectorAll('g[class^="bar-series-"] rect')).filter(
        (r) => r.hasAttribute("fill"),
      );
      const fills = rects.map((r) => r.getAttribute("fill"));
      // Exactly one hero bar (Feb) in --chart-foreground ink...
      expect(fills.filter((f) => f === "var(--chart-foreground)")).toHaveLength(1);
      // ...and the other two draw exactly the resolved (non-hero) palette,
      // not the series' own `fill` prop.
      const restColors = resolvePalette(undefined, 2, { explicit: false });
      const nonHeroFills = fills.filter((f) => f !== "var(--chart-foreground)");
      expect(nonHeroFills.slice().sort()).toEqual([...restColors].sort());
    });

    it("supports a predicate highlightKey", () => {
      const { container } = render(
        <BarChart data={minimalData} xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" highlightKey={(d) => d.month === "Mar"} />
        </BarChart>,
      );
      const fills = Array.from(container.querySelectorAll('g[class^="bar-series-"] rect'))
        .filter((r) => r.hasAttribute("fill"))
        .map((r) => r.getAttribute("fill"));
      expect(fills).toContain("var(--chart-foreground)");
    });

    it("leaves every bar drawing the series fill when highlightKey is unset", () => {
      const { container } = render(
        <BarChart data={minimalData} xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" />
        </BarChart>,
      );
      const fills = Array.from(container.querySelectorAll('g[class^="bar-series-"] rect'))
        .filter((r) => r.hasAttribute("fill"))
        .map((r) => r.getAttribute("fill"));
      expect(fills.every((f) => f === "var(--chart-1)")).toBe(true);
    });
  });

  // RM-027: BarChart-level `palette` — only ever assigns colours to Bar
  // children that would otherwise collide on the shared default fill.
  describe("palette (BarChart-level default-fill assignment)", () => {
    it("leaves a single unfilled Bar series on the pre-RM-027 default fill", () => {
      const { container } = render(
        <BarChart data={minimalData} xDataKey="month">
          <Bar dataKey="value" />
        </BarChart>,
      );
      const rects = Array.from(container.querySelectorAll('g[class^="bar-series-"] rect')).filter(
        (r) => r.hasAttribute("fill"),
      );
      expect(rects.every((r) => r.getAttribute("fill") === "var(--chart-line-primary)")).toBe(true);
    });

    it("degrades nine unfilled Bar series to the mono ladder and warns once (dev safety net)", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const nineSeriesData = [
        { month: "Jan", a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9 },
      ];
      const { container } = render(
        <BarChart data={nineSeriesData} xDataKey="month">
          <Bar dataKey="a" />
          <Bar dataKey="b" />
          <Bar dataKey="c" />
          <Bar dataKey="d" />
          <Bar dataKey="e" />
          <Bar dataKey="f" />
          <Bar dataKey="g" />
          <Bar dataKey="h" />
          <Bar dataKey="i" />
        </BarChart>,
      );
      expect(warnSpy).toHaveBeenCalled();
      const warningMessage = warnSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(warningMessage).toContain("9 categorical series exceeds");
      const rects = Array.from(container.querySelectorAll('g[class^="bar-series-"] rect')).filter(
        (r) => r.hasAttribute("fill"),
      );
      expect(rects.length).toBeGreaterThan(0);
      // None of the nine series fall back to the single-series default —
      // applyBarPalette assigned every one of them a resolved colour.
      expect(rects.every((r) => r.getAttribute("fill") !== "var(--chart-line-primary)")).toBe(true);
      warnSpy.mockRestore();
    });

    it("never touches a Bar child that sets its own fill, even alongside unfilled siblings", () => {
      const { container } = render(
        <BarChart data={[{ month: "Jan", a: 1, b: 2 }]} xDataKey="month">
          <Bar dataKey="a" fill="var(--chart-5)" />
          <Bar dataKey="b" />
        </BarChart>,
      );
      const rects = Array.from(container.querySelectorAll('g[class^="bar-series-"] rect')).filter(
        (r) => r.hasAttribute("fill"),
      );
      const fills = rects.map((r) => r.getAttribute("fill"));
      expect(fills).toContain("var(--chart-5)");
    });
  });

  describe("value-axis domain (RM-108)", () => {
    const sales = [
      { month: "Jan", value: 80 },
      { month: "Feb", value: 120 },
      { month: "Mar", value: 150 },
    ];

    function yLabels(container: HTMLElement): string[] {
      return [...container.querySelectorAll('[data-slot="y-axis"] span')].map(
        (node) => node.textContent ?? "",
      );
    }

    it("honours the upper bound but keeps bars zero-based, with a dev warning", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { container } = render(
        <BarChart data={sales} xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" />
          <YAxis domain={[50, 300]} numTicks={3} />
        </BarChart>,
      );
      const labels = yLabels(container);
      expect(labels[0]).toBe("0");
      expect(labels.at(-1)).toBe("300");
      expect(warn.mock.calls.some(([message]) => String(message).includes("excludes 0"))).toBe(
        true,
      );
      warn.mockRestore();
    });

    it("draws bars linear even when a log scale is asked for", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { container } = render(
        <BarChart data={sales} xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" />
          <YAxis scale="log" />
        </BarChart>,
      );
      expect(yLabels(container)[0]).toBe("0");
      expect(warn.mock.calls.some(([message]) => String(message).includes("linear only"))).toBe(
        true,
      );
      warn.mockRestore();
    });
  });
});
