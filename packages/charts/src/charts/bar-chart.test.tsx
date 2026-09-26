import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// @visx/responsive uses ResizeObserver + real DOM measurement which jsdom lacks.
// Mock ParentSize to supply a fixed 560×288 viewport so ChartInner renders.
// Real render/interaction/a11y is covered by the Storybook build (Charts/BarChart story).
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

import { UNIT_STACK_EMPHASIS } from "../marks";
import { Bar, type BarShowValues } from "./bar";
import { BarChart } from "./bar-chart";
import { BarValueAxis } from "./bar-value-axis";
import { BarXAxis } from "./bar-x-axis";
import { BarYAxis } from "./bar-y-axis";
import { ChartConfigProvider } from "./chart-config-context";
import { resolvePalette, useChart } from "./chart-context";
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

  // RM-188: the bar category axes draw their title through the shared
  // `AxisTitle` — `BarXAxis` on the bottom of a vertical chart, `BarYAxis` on
  // the left of a horizontal one, each `outside` (default) or `inside`.
  describe("BarXAxis / BarYAxis — title and titlePlacement (RM-188)", () => {
    const cases = [
      { axis: "BarXAxis", orientation: "vertical", side: "bottom", placement: "outside" },
      { axis: "BarXAxis", orientation: "vertical", side: "bottom", placement: "inside" },
      { axis: "BarYAxis", orientation: "horizontal", side: "left", placement: "outside" },
      { axis: "BarYAxis", orientation: "horizontal", side: "left", placement: "inside" },
    ] as const;

    it.each(cases)(
      "$axis on a $orientation chart draws a $placement title on the $side side",
      async ({ axis, orientation, side, placement }) => {
        const Axis = axis === "BarXAxis" ? BarXAxis : BarYAxis;
        const { container } = render(
          <BarChart data={minimalData} orientation={orientation} xDataKey="month">
            <Bar dataKey="value" fill="var(--chart-1)" />
            <Axis title="Month" titlePlacement={placement} />
          </BarChart>,
        );
        const title = await waitFor(() => {
          const el = container.querySelector(
            `[data-slot="axis-title"][data-side="${side}"][data-placement="${placement}"]`,
          );
          expect(el).not.toBeNull();
          return el!;
        });
        expect(title.textContent).toBe("Month");
        if (placement === "inside") {
          // The inside title is ink (`aria-hidden` SVG) with an `sr-only` copy.
          expect(title).toHaveAttribute("aria-hidden", "true");
          const copy = title.nextElementSibling;
          expect(copy).toHaveClass("sr-only");
          expect(copy?.textContent).toBe("Month");
        } else {
          expect(title).not.toHaveAttribute("aria-hidden");
        }
      },
    );

    it("draws no title when none is given", async () => {
      const { container } = render(
        <BarChart data={minimalData} xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" />
          <BarXAxis />
          <BarYAxis />
        </BarChart>,
      );
      await waitFor(() => expect(container.querySelector(".text-chart-label")).not.toBeNull());
      expect(container.querySelector('[data-slot="axis-title"]')).toBeNull();
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
      // The CSS cap is a safety net over the plan's own trim: the reserved
      // gutter minus its padding, plus the measurement slack that stops a
      // sub-pixel drift between canvas and layout re-cutting a label.
      expect(maxWidth).toBeLessThanOrEqual(gutterWidth - 8 + 2);
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
  describe("fillStyle (the hairline seam)", () => {
    const seriesRects = (container: HTMLElement) =>
      Array.from(
        container.querySelectorAll(
          'g[class^="bar-series-"] > rect, g[class^="bar-series-"] g > rect',
        ),
      ).filter((r) => r.hasAttribute("fill"));

    it("defaults to solid: no pattern def, no stroke attribute", () => {
      const { container } = render(
        <BarChart data={minimalData} xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" />
        </BarChart>,
      );
      expect(container.querySelector('pattern[id^="bp-hatch-"]')).toBeNull();
      const rects = seriesRects(container);
      expect(rects.length).toBeGreaterThan(0);
      expect(rects.every((r) => r.getAttribute("fill") === "var(--chart-1)")).toBe(true);
      expect(rects.every((r) => !r.hasAttribute("stroke"))).toBe(true);
    });

    it('"hatch" draws an outlined hairline pattern in the series colour at decoration 0', () => {
      const { container } = render(
        <BarChart data={minimalData} xDataKey="month">
          <Bar animate={false} dataKey="value" fill="var(--chart-2)" fillStyle="hatch" />
        </BarChart>,
      );
      const pattern = container.querySelector('pattern[id^="bp-hatch-"]');
      expect(pattern).not.toBeNull();
      expect(pattern?.querySelector("path")?.getAttribute("stroke")).toBe("var(--chart-2)");
      const rects = seriesRects(container);
      expect(rects.length).toBeGreaterThan(0);
      for (const r of rects) {
        expect(r.getAttribute("fill")).toBe(`url(#${pattern?.id})`);
        expect(r.getAttribute("stroke")).toBe("var(--chart-2)");
        expect(r.getAttribute("stroke-width")).toBe("1");
      }
    });

    it("leaves an author's url() fill exactly as authored", () => {
      const { container } = render(
        <BarChart data={minimalData} xDataKey="month">
          <Bar animate={false} dataKey="value" fill="url(#mine)" fillStyle="hatch" />
        </BarChart>,
      );
      expect(container.querySelector('pattern[id^="bp-hatch-"]')).toBeNull();
      expect(seriesRects(container).every((r) => r.getAttribute("fill") === "url(#mine)")).toBe(
        true,
      );
    });
  });

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

// BarChart — RM-113: percent + diverging stacks, sort, groupBy, colorBy,
// track, overlays and comparison. jsdom renders at the mocked 560×288.
describe("BarChart richness (RM-113)", () => {
  const LIKERT = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
  const INKS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-mono-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];
  const likertData = ["Q1", "Q2", "Q3", "Q4", "Q5"].map((q, i) => ({
    q,
    "Strongly disagree": 5 + i,
    Disagree: 15 + i * 2,
    Neutral: 20 + i,
    Agree: 35 - i * 2,
    "Strongly agree": 25 - i,
  }));

  function likertBars() {
    return LIKERT.map((key, i) => (
      <Bar animate={false} dataKey={key} fill={INKS[i]} key={key} lineCap="butt" />
    ));
  }

  function rectsByFill(container: HTMLElement, fill: string) {
    return [...container.querySelectorAll(`rect[fill="${fill}"]`)] as SVGRectElement[];
  }

  const num = (el: Element | undefined, attr: string) => Number(el?.getAttribute(attr));

  it('stacked="diverging" centres the named series on the zero line', () => {
    const { container } = render(
      <BarChart
        data={likertData}
        divergingCenter="Neutral"
        orientation="horizontal"
        stacked="diverging"
        xDataKey="q"
      >
        {likertBars()}
      </BarChart>,
    );
    const zero = container.querySelector("svg g > line");
    const zeroX = num(zero ?? undefined, "x1");
    const neutral = rectsByFill(container, "var(--chart-mono-3)");
    expect(neutral).toHaveLength(5);
    for (const rect of neutral) {
      expect(num(rect, "x") + num(rect, "width") / 2).toBeCloseTo(zeroX, 6);
    }
    // Disagree sits left of the neutral block, Agree right of it.
    const disagree = rectsByFill(container, "var(--chart-2)")[0];
    const agree = rectsByFill(container, "var(--chart-4)")[0];
    expect(num(disagree, "x") + num(disagree, "width")).toBeCloseTo(num(neutral[0], "x"), 6);
    expect(num(agree, "x")).toBeCloseTo(num(neutral[0], "x") + num(neutral[0], "width"), 6);
  });

  it('stacked="percent" ends every stack at the same pixel on a 0–100 % axis', () => {
    const { container } = render(
      <BarChart data={likertData} stacked="percent" xDataKey="q">
        {likertBars()}
        <YAxis />
      </BarChart>,
    );
    const top = rectsByFill(container, "var(--chart-5)");
    expect(top).toHaveLength(5);
    const tops = top.map((rect) => num(rect, "y"));
    for (const y of tops) {
      expect(y).toBeCloseTo(tops[0] as number, 6);
    }
    const bottom = rectsByFill(container, "var(--chart-1)");
    const bottoms = bottom.map((rect) => num(rect, "y") + num(rect, "height"));
    for (const b of bottoms) {
      expect(b).toBeCloseTo(bottoms[0] as number, 6);
    }
    expect(container.textContent).toContain("100%");
    expect(container.textContent).toContain("0%");
  });

  it('sort="desc" orders rows by value and colorBy colours them with a key', () => {
    const data = [
      { name: "a", v: 10, region: "North" },
      { name: "b", v: 40, region: "South" },
      { name: "c", v: 25, region: "North" },
      { name: "d", v: 5, region: "East" },
    ];
    const { container } = render(
      <BarChart colorBy={{ key: "region" }} data={data} orientation="horizontal" sort="desc">
        <Bar animate={false} dataKey="v" />
      </BarChart>,
    );
    const rects = [...container.querySelectorAll("svg rect[width]")].filter(
      (rect) => rect.getAttribute("fill")?.startsWith("var(--chart-") && num(rect, "height") > 0,
    );
    const byY = [...rects].sort((a, b) => num(a, "y") - num(b, "y"));
    const widths = byY.map((rect) => num(rect, "width"));
    expect([...widths].sort((a, b) => b - a)).toEqual(widths);
    const fills = new Set(byY.map((rect) => rect.getAttribute("fill")));
    expect(fills.size).toBe(3);
    const key = container.querySelector('[data-slot="bar-chart-color-key"]');
    expect(key?.querySelectorAll("li")).toHaveLength(3);
    expect(key?.textContent).toContain("South");
  });

  it("colorBy past six categories falls to the neutral ladder with one warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = Array.from({ length: 7 }, (_, i) => ({ name: `n${i}`, v: i + 1, cat: `c${i}` }));
    const { container } = render(
      <BarChart colorBy={{ key: "cat" }} data={data}>
        <Bar animate={false} dataKey="v" />
      </BarChart>,
    );
    const fills = [...container.querySelectorAll("svg rect")]
      .map((rect) => rect.getAttribute("fill") ?? "")
      .filter((fill) => fill.startsWith("var(--chart-"));
    expect(fills.length).toBe(7);
    expect(fills.every((fill) => fill.startsWith("var(--chart-mono-"))).toBe(true);
    const capWarnings = warn.mock.calls.filter((call) => String(call[0]).includes("cap"));
    expect(capWarnings).toHaveLength(1);
    warn.mockRestore();
  });

  it("groupBy + overlays paints headers, three overlay layers and exposes their legend items", () => {
    const cars = [
      { model: "A1", cls: "Small", lo90: 900, hi90: 1300, lo50: 1000, hi50: 1200, avg: 1100 },
      { model: "B2", cls: "Large", lo90: 1500, hi90: 2300, lo50: 1700, hi50: 2100, avg: 1900 },
      { model: "A2", cls: "Small", lo90: 950, hi90: 1400, lo50: 1050, hi50: 1250, avg: 1150 },
    ];
    let exposed: readonly { kind: string; label: string }[] | undefined;
    function LegendProbe() {
      exposed = useChart().legendItems;
      return null;
    }
    const { container } = render(
      <BarChart
        data={cars}
        groupBy="cls"
        orientation="horizontal"
        overlays={[
          { kind: "range", lowKey: "lo90", highKey: "hi90", label: "90 %" },
          { kind: "range", lowKey: "lo50", highKey: "hi50", label: "50 %" },
          { kind: "value", key: "avg", label: "Average" },
        ]}
        xDataKey="model"
      >
        <BarYAxis />
        <LegendProbe />
      </BarChart>,
    );
    const headers = [...container.querySelectorAll('[data-slot="bar-chart-group-header"]')];
    expect(headers.map((h) => h.textContent)).toEqual(["Small", "Large"]);
    expect(container.querySelectorAll('[data-slot="bar-chart-group-separator"]')).toHaveLength(1);
    const layers = container.querySelectorAll('[data-slot="bar-chart-overlay"]');
    expect(layers).toHaveLength(3);
    for (const layer of layers) {
      expect(layer.querySelectorAll("rect")).toHaveLength(3);
    }
    expect(exposed?.filter((item) => item.kind === "overlay").map((item) => item.label)).toEqual([
      "90 %",
      "50 %",
      "Average",
    ]);
    // The header rows are never category labels.
    expect(container.textContent).not.toContain("group:");
  });

  it("BarValueAxis prints the value ticks of a horizontal chart, and nothing in a vertical one", () => {
    const data = [
      { name: "Alpha", v: 30 },
      { name: "Beta", v: 80 },
    ];
    const axisOf = (orientation: "horizontal" | "vertical") =>
      render(
        <BarChart animationDuration={0} data={data} orientation={orientation} xDataKey="name">
          <Bar animate={false} dataKey="v" />
          <BarValueAxis title="hours" valueFormat={{ suffix: " h" }} />
        </BarChart>,
      ).container.querySelector('[data-slot="bar-value-axis"]');
    expect(axisOf("vertical")).toBeNull();
    const axis = axisOf("horizontal");
    const labels = [...(axis?.querySelectorAll("span") ?? [])].map((el) => el.textContent);
    expect(labels.length).toBeGreaterThanOrEqual(3);
    expect(labels[0]).toBe("0 h");
    // The axis title rides on the last tick only.
    expect(labels.filter((label) => label?.endsWith(" hours"))).toHaveLength(1);
    expect(labels[labels.length - 1]).toMatch(/ hours$/);
  });

  it("a valueFormat that owns the sign prints one sign on a negative bar, not two", () => {
    const { container } = render(
      <BarChart
        animationDuration={0}
        data={[
          { name: "Up", v: 4.2 },
          { name: "Down", v: -5.6 },
        ]}
        xDataKey="name"
      >
        <Bar animate={false} dataKey="v" showValues valueFormat={{ sign: "always", decimals: 1 }} />
      </BarChart>,
    );
    const labels = [...container.querySelectorAll(".text-chart-value")].map((el) => el.textContent);
    expect(labels).toHaveLength(2);
    expect(labels[0]).toBe("+4.2");
    expect(labels[1]).toMatch(/^[−-]5\.6$/);
  });

  it("the container legend lists the overlays after the series", () => {
    const { container } = render(
      <BarChart
        data={[{ model: "A1", lo: 900, hi: 1300, avg: 1100 }]}
        legend
        orientation="horizontal"
        overlays={[
          { kind: "range", lowKey: "lo", highKey: "hi", label: "Typical range" },
          { kind: "value", key: "avg", label: "Average" },
        ]}
        xDataKey="model"
      >
        <BarYAxis />
      </BarChart>,
    );
    const legend = container.querySelector(".legend-container");
    expect(legend?.textContent).toContain("Typical range");
    expect(legend?.textContent).toContain("Average");
  });

  it("comparison paints a muted column behind each main column with difference labels", () => {
    const data = [
      { name: "Jan", v: 120, prev: 100 },
      { name: "Feb", v: 80, prev: 95 },
    ];
    const { container } = render(
      <BarChart
        animationDuration={0}
        comparison={{ key: "prev", label: "2024" }}
        comparisonLabel="difference"
        data={data}
      >
        <Bar animate={false} dataKey="v" fill="var(--chart-1)" />
      </BarChart>,
    );
    const behind = [...container.querySelectorAll('[data-slot="bar-chart-comparison"] rect')];
    expect(behind).toHaveLength(2);
    const main = rectsByFill(container, "var(--chart-1)");
    expect(main).toHaveLength(2);
    // The main column is narrower and centred inside the comparison column.
    const [c0, m0] = [behind[0], main[0]];
    expect(num(m0, "width")).toBeLessThan(num(c0, "width"));
    expect(num(m0, "x") + num(m0, "width") / 2).toBeCloseTo(num(c0, "x") + num(c0, "width") / 2, 6);
  });

  it("track paints one background bar per row to the axis maximum", () => {
    const { container } = render(
      <BarChart data={minimalData} orientation="horizontal" track xDataKey="month">
        <Bar animate={false} dataKey="value" fill="var(--chart-1)" />
      </BarChart>,
    );
    const tracks = [...container.querySelectorAll('[data-slot="bar-chart-track"] rect')];
    expect(tracks).toHaveLength(3);
    const widths = new Set(tracks.map((rect) => rect.getAttribute("width")));
    expect(widths.size).toBe(1);
  });

  it("leaves a plain stacked chart on the cumulative path (no extents published)", () => {
    let extents: unknown = "unset";
    function Probe() {
      extents = useChart().stackExtents;
      return null;
    }
    render(
      <BarChart data={minimalData} stacked xDataKey="month">
        <Bar animate={false} dataKey="value" />
        <Probe />
      </BarChart>,
    );
    expect(extents).toBeUndefined();
  });

  // Integration with RM-110: one showValues type and one label path.
  it("labels percent segments through the shared showValues spec: centred shares, hover waits", () => {
    const labelled = (showValues: BarShowValues) =>
      LIKERT.map((key, i) => (
        <Bar
          animate={false}
          dataKey={key}
          fill={INKS[i]}
          key={key}
          lineCap="butt"
          showValues={showValues}
        />
      ));
    const { container, rerender } = render(
      <BarChart data={likertData} stacked="percent" xDataKey="q">
        {labelled({ placement: "outside" })}
      </BarChart>,
    );
    const labels = [...container.querySelectorAll(".text-chart-value")];
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label.textContent).toMatch(/%$/);
    }
    // Q1's "Strongly agree" segment (25 of 100) centres its "25%" share
    // label, even though the spec asks for "outside".
    const segment = rectsByFill(container, "var(--chart-5)")[0];
    const share = labels.find(
      (label) =>
        label.textContent === "25%" &&
        Math.abs(num(label, "y") - (num(segment, "y") + num(segment, "height") / 2)) < 1e-6,
    );
    expect(share).toBeDefined();
    expect(num(share, "x")).toBeCloseTo(num(segment, "x") + num(segment, "width") / 2, 6);
    rerender(
      <BarChart data={likertData} stacked="percent" xDataKey="q">
        {labelled({ visibility: "hover" })}
      </BarChart>,
    );
    expect(container.querySelectorAll(".text-chart-value")).toHaveLength(0);
  });

  it("labels only the bars a showValues filter lets through", () => {
    const { container } = render(
      <BarChart
        animationDuration={0}
        data={[
          { name: "Alpha", v: 30 },
          { name: "Beta", v: 80 },
          { name: "Gamma", v: 55 },
        ]}
        xDataKey="name"
      >
        <Bar
          animate={false}
          dataKey="v"
          showValues={{ filter: (datum) => datum.name === "Beta" }}
        />
      </BarChart>,
    );
    const labels = [...container.querySelectorAll(".text-chart-value")];
    expect(labels.map((label) => label.textContent)).toEqual(["80"]);
  });

  // Integration with RM-111: the annotations prop wraps the plot that carries
  // the RM-113 props, and a row note follows its category through a sort.
  it("keeps the comparison layer and moves an annotation row note with sort", () => {
    const data = [
      { name: "Alpha", v: 30, prev: 25 },
      { name: "Beta", v: 80, prev: 60 },
    ];
    const noteY = (sort: "none" | "desc") => {
      const { container } = render(
        <BarChart
          animationDuration={0}
          annotations={[{ kind: "row", category: "Alpha", text: "Start" }]}
          comparison={{ key: "prev" }}
          data={data}
          orientation="horizontal"
          sort={sort}
        >
          <Bar animate={false} dataKey="v" fill="var(--chart-1)" />
        </BarChart>,
      );
      expect(container.querySelectorAll('[data-slot="bar-chart-comparison"] rect')).toHaveLength(2);
      const note = container.querySelector('[data-slot="chart-annotations-row"]');
      expect(note?.textContent).toBe("Start");
      const y = Number(note?.getAttribute("y"));
      cleanup();
      return y;
    };
    const unsorted = noteY("none");
    const sorted = noteY("desc");
    expect(Number.isFinite(unsorted) && Number.isFinite(sorted)).toBe(true);
    expect(sorted).toBeGreaterThan(unsorted);
  });
});

// Legend engine (RM-118): `legend` prop → `useContainerLegend`.
describe("BarChart legend (RM-118)", () => {
  const twoSeriesData = [
    { name: "Jan", a: 100, b: 40 },
    { name: "Feb", a: 60, b: 90 },
    { name: "Mar", a: 80, b: 30 },
  ];

  it("an unset legend renders no legend, even with more than one series (R1 default)", () => {
    const { container } = render(
      <BarChart data={twoSeriesData} xDataKey="name">
        <Bar animate={false} dataKey="a" fill="var(--chart-1)" />
        <Bar animate={false} dataKey="b" fill="var(--chart-2)" />
      </BarChart>,
    );
    expect(container.querySelector('[data-slot="container-legend-root"]')).toBeNull();
    expect(container.querySelector(".legend-container")).toBeNull();
  });

  it("legend={true} lists both series", () => {
    const { container } = render(
      <BarChart data={twoSeriesData} legend xDataKey="name">
        <Bar animate={false} dataKey="a" fill="var(--chart-1)" />
        <Bar animate={false} dataKey="b" fill="var(--chart-2)" />
      </BarChart>,
    );
    expect(container.querySelector('[data-slot="container-legend-root"]')).not.toBeNull();
    const legend = container.querySelector(".legend-container");
    expect(legend?.textContent).toContain("a");
    expect(legend?.textContent).toContain("b");
  });

  it('interactive: "toggle" on grouped bars hides the clicked series, flips aria-pressed, recomputes the zero-based y-domain from the visible series, and is keyboard-operable', async () => {
    let latestDomain: readonly number[] = [];
    function DomainProbe() {
      latestDomain = useChart().yScale.domain() as number[];
      return null;
    }
    const { container } = render(
      <BarChart
        animationDuration={0}
        data={twoSeriesData}
        legend={{ interactive: "toggle" }}
        xDataKey="name"
      >
        <Bar animate={false} dataKey="a" fill="var(--chart-1)" />
        <Bar animate={false} dataKey="b" fill="var(--chart-2)" />
        <DomainProbe />
      </BarChart>,
    );

    const rectsA = () => container.querySelectorAll('rect[fill="var(--chart-1)"]');
    const rectsB = () => container.querySelectorAll('rect[fill="var(--chart-2)"]');
    expect(rectsA()).toHaveLength(3);
    expect(rectsB()).toHaveLength(3);
    // "a" (max 100) is the max series driving today's domain.
    const domainBefore = latestDomain[1] as number;
    expect(latestDomain[0]).toBe(0);
    expect(domainBefore).toBeGreaterThanOrEqual(100);

    // Real <button aria-pressed> — a native element is keyboard-operable by
    // construction (Enter/Space), no extra wiring on this end.
    const buttons = container.querySelectorAll(".legend-container button[aria-pressed]");
    expect(buttons).toHaveLength(2);
    const buttonA = buttons[0] as HTMLButtonElement;
    expect(buttonA.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(buttonA);

    await waitFor(() => {
      expect(buttonA.getAttribute("aria-pressed")).toBe("false");
      // The toggled-off series' <Bar> no longer mounts at all.
      expect(rectsA()).toHaveLength(0);
    });
    // The remaining (visible) series is untouched.
    expect(rectsB()).toHaveLength(3);
    // The value domain recomputes from the visible series only ("b", max
    // 90) and stays zero-based through `resolveBarValueDomain`
    // (charts-honesty) — never the stale, still-includes-"a" domain.
    expect(latestDomain[0]).toBe(0);
    expect(latestDomain[1]).toBeLessThan(domainBefore);
    expect(latestDomain[1]).toBeGreaterThanOrEqual(90);

    // WCAG 1.4.1: hidden reads via a struck-through label, not colour alone.
    expect(buttonA.querySelector("span.line-through")).not.toBeNull();

    fireEvent.click(buttonA);
    await waitFor(() => {
      expect(buttonA.getAttribute("aria-pressed")).toBe("true");
      expect(rectsA()).toHaveLength(3);
      expect(latestDomain[1]).toBe(domainBefore);
    });
  });

  // #606: toggling off every legend series used to fall through to a bare,
  // unexplained axis grid — no bars, no message. This locks the fix: the
  // shared `ChartFallback` "nothing to show" panel takes the plot's place,
  // and the legend itself stays mounted and clickable so a reader can
  // recover without reloading.
  it('interactive: "toggle" on every series shows the empty state, not a blank plot, and the legend stays usable', async () => {
    const { container } = render(
      <BarChart
        animationDuration={0}
        data={twoSeriesData}
        legend={{ interactive: "toggle" }}
        xDataKey="name"
      >
        <Bar animate={false} dataKey="a" fill="var(--chart-1)" />
        <Bar animate={false} dataKey="b" fill="var(--chart-2)" />
      </BarChart>,
    );

    const rects = () => container.querySelectorAll("svg rect[fill^='var(--chart-']");
    const buttons = () => container.querySelectorAll(".legend-container button[aria-pressed]");
    expect(rects().length).toBeGreaterThan(0);
    expect(container.querySelector('[data-kind="empty"]')).toBeNull();

    fireEvent.click(buttons()[0] as HTMLButtonElement);
    fireEvent.click(buttons()[1] as HTMLButtonElement);

    await waitFor(() => {
      expect(rects()).toHaveLength(0);
      const fallback = container.querySelector('[data-slot="chart-fallback"]');
      expect(fallback).not.toBeNull();
      expect(fallback?.textContent).toMatch(/every series is hidden/i);
    });
    // The legend survives the fallback — both toggles are still real,
    // pressable buttons, so the reader can show a series again.
    expect(buttons()).toHaveLength(2);
    expect((buttons()[0] as HTMLButtonElement).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(buttons()[0] as HTMLButtonElement);
    await waitFor(() => {
      expect(container.querySelector('[data-slot="chart-fallback"]')).toBeNull();
      expect(rects().length).toBeGreaterThan(0);
    });
  });

  it('interactive: "toggle" on a stacked bar drops the hidden segment, keeps the sibling series, and stays zero-based', async () => {
    let latestDomain: readonly number[] = [];
    function DomainProbe() {
      latestDomain = useChart().yScale.domain() as number[];
      return null;
    }
    const { container } = render(
      <BarChart
        animationDuration={0}
        data={twoSeriesData}
        legend={{ interactive: "toggle" }}
        stacked
        xDataKey="name"
      >
        <Bar animate={false} dataKey="a" fill="var(--chart-1)" />
        <Bar animate={false} dataKey="b" fill="var(--chart-2)" />
        <DomainProbe />
      </BarChart>,
    );
    expect(container.querySelectorAll('rect[fill="var(--chart-1)"]')).toHaveLength(3);
    expect(container.querySelectorAll('rect[fill="var(--chart-2)"]')).toHaveLength(3);
    expect(latestDomain[0]).toBe(0);

    const buttonB = container.querySelectorAll(".legend-container button[aria-pressed]")[1];
    fireEvent.click(buttonB as Element);

    await waitFor(() => {
      expect((buttonB as HTMLButtonElement).getAttribute("aria-pressed")).toBe("false");
      // The toggled-off segment no longer mounts at all…
      expect(container.querySelectorAll('rect[fill="var(--chart-2)"]')).toHaveLength(0);
    });
    // …the sibling series is untouched, and the domain is still zero-based.
    expect(container.querySelectorAll('rect[fill="var(--chart-1)"]')).toHaveLength(3);
    expect(latestDomain[0]).toBe(0);
  });

  it("hovering a legend item dims every other series via Bar's existing ChartLegendHoverProvider seam", async () => {
    const { container } = render(
      <BarChart animationDuration={0} data={twoSeriesData} legend xDataKey="name">
        <Bar animate={false} dataKey="a" fill="var(--chart-1)" />
        <Bar animate={false} dataKey="b" fill="var(--chart-2)" />
      </BarChart>,
    );
    // A static, non-animated positive bar renders as a bare `<rect
    // opacity=…>` (no wrapping `<g>`) — read the rect's own attribute.
    const rectOpacity = (fill: string) =>
      container.querySelector(`rect[fill="${fill}"]`)?.getAttribute("opacity");
    expect(rectOpacity("var(--chart-1)")).toBe("1");
    expect(rectOpacity("var(--chart-2)")).toBe("1");

    // #607: a hover-only legend item (default `interactive: "hover"`, no
    // `onItemClick`) is a real focusable `<button>` now, not a plain `<div>`
    // — mouse and keyboard drive the same highlight.
    const legendItems = container.querySelectorAll(".legend-container > button");
    expect(legendItems.length).toBeGreaterThanOrEqual(2);
    fireEvent.mouseEnter(legendItems[1] as Element);

    await waitFor(() => {
      expect(rectOpacity("var(--chart-2)")).toBe("1");
      expect(rectOpacity("var(--chart-1)")).toBe("0.3");
    });

    fireEvent.mouseLeave(legendItems[1] as Element);
    await waitFor(() => {
      expect(rectOpacity("var(--chart-1)")).toBe("1");
    });
  });

  it("colorBy's own key wins: the container legend yields (renders nothing, no toggle) — R4", () => {
    const data = [
      { name: "a", v: 10, region: "North" },
      { name: "b", v: 40, region: "South" },
    ];
    const { container } = render(
      <BarChart
        colorBy={{ key: "region" }}
        data={data}
        legend={{ interactive: "toggle" }}
        xDataKey="name"
      >
        <Bar animate={false} dataKey="v" />
      </BarChart>,
    );
    // colorBy's own key still renders…
    expect(container.querySelector('[data-slot="bar-chart-color-key"]')).not.toBeNull();
    // …but the container legend engine yields — nothing new mounts, so
    // there is no toggle affordance in this mode either.
    expect(container.querySelector('[data-slot="container-legend-root"]')).toBeNull();
    expect(container.querySelector(".legend-container")).toBeNull();
  });

  it("density xs still hides the legend; density sm renders stack layout only", () => {
    const stacked1 = render(
      <ChartConfigProvider value={{ density: "xs" }}>
        <BarChart data={twoSeriesData} legend xDataKey="name">
          <Bar animate={false} dataKey="a" fill="var(--chart-1)" />
          <Bar animate={false} dataKey="b" fill="var(--chart-2)" />
        </BarChart>
      </ChartConfigProvider>,
    );
    expect(stacked1.container.querySelector('[data-slot="container-legend-root"]')).toBeNull();
    cleanup();

    const stacked2 = render(
      <ChartConfigProvider value={{ density: "sm" }}>
        <BarChart data={twoSeriesData} legend xDataKey="name">
          <Bar animate={false} dataKey="a" fill="var(--chart-1)" />
          <Bar animate={false} dataKey="b" fill="var(--chart-2)" />
        </BarChart>
      </ChartConfigProvider>,
    );
    expect(
      stacked2.container.querySelector('[data-container-legend-layout="stack"]'),
    ).not.toBeNull();
  });
});
