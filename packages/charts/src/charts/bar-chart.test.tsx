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

import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import { BarXAxis } from "./bar-x-axis";
import { BarYAxis } from "./bar-y-axis";
import { Grid } from "./grid";

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
      const { container } = render(
        <BarChart data={longLabels} xDataKey="month">
          <Bar dataKey="value" fill="var(--chart-1)" />
          <BarXAxis />
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
});
