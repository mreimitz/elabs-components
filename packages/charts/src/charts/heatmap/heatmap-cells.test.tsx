/**
 * HeatmapChart — the rendered grid, in jsdom.
 *
 * `heatmap-chart.test.tsx` documents why jsdom never gets past `ParentSize`'s
 * size guard. This file stubs `ParentSize` with a fixed 560×315 box so the
 * cells, their marks and their labels actually render, which is what the
 * zero-vs-missing (#251) and label-ink (#238) locks need. Pixel measurements
 * (contrast, footprint height) still live in the stories, where layout happens.
 */

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { applyThemeVars } from "../on-mark-ink.fixtures";
import { HeatmapChart } from "./heatmap-chart";

vi.mock("@visx/responsive", () => ({
  ParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => ReactNode;
  }) => children({ width: 560, height: 315 }),
}));

beforeAll(() => {
  if (typeof window !== "undefined" && !window.IntersectionObserver) {
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  }
});

const FG = "var(--chart-foreground)";
const BG = "var(--chart-background)";

/** One row with a real zero, a real null and signed values either side. */
const ZERO_AND_MISSING = [
  { col: "a", row: "r", v: -8 },
  { col: "b", row: "r", v: 0 },
  { col: "c", row: "r", v: null },
  { col: "d", row: "r", v: 8 },
];

function cellOf(container: HTMLElement, id: string) {
  const cell = container.querySelector<SVGGElement>(`[data-heatmap-cell="${id}"]`);
  if (!cell) throw new Error(`cell ${id} did not render`);
  return cell;
}

describe("zero is not missing (#251)", () => {
  it("draws a measured zero and a null with different marks, labels off", () => {
    const { container } = render(
      <HeatmapChart
        data={ZERO_AND_MISSING}
        palette="diverging"
        showValues={false}
        valueKey="v"
        x="col"
        y="row"
      />,
    );
    const zero = cellOf(container, "1:0");
    const missing = cellOf(container, "2:0");

    expect(zero.dataset.state).toBe("zero");
    expect(missing.dataset.state).toBe("missing");
    // Structurally different marks, not two class strings.
    expect(zero.querySelector('[data-slot="quiet-dot"]')?.tagName).toBe("circle");
    expect(zero.querySelector('[data-slot="heatmap-missing-mark"]')).toBeNull();
    expect(missing.querySelector('[data-slot="heatmap-missing-mark"]')?.tagName).toBe("rect");
    expect(missing.querySelector('[data-slot="quiet-dot"]')).toBeNull();
  });

  it("keys each state present in the grid, and never both under one name", () => {
    const { container } = render(
      <HeatmapChart data={ZERO_AND_MISSING} palette="diverging" valueKey="v" x="col" y="row" />,
    );
    const legend = container.querySelector('[data-slot="heatmap-legend"]');
    expect(legend?.querySelector('[data-slot="heatmap-legend-zero"]')).toHaveTextContent("zero");
    expect(legend?.querySelector('[data-slot="heatmap-legend-missing"]')).toHaveTextContent(
      "no data",
    );
    expect(container.textContent).not.toContain("none or zero");
  });

  it("names the no-data cells in the chart's accessible name", () => {
    render(<HeatmapChart data={ZERO_AND_MISSING} valueKey="v" x="col" y="row" />);
    expect(screen.getByRole("figure")).toHaveAccessibleName(
      "Heatmap, 1 rows × 4 columns, peak 8 at r d. 1 cell has no data.",
    );
  });

  it("leaves a sequential grid with zeros and no nulls as it was: pinpricks, no no-data key", () => {
    const data = [
      { col: "a", row: "r", v: 0 },
      { col: "b", row: "r", v: 5 },
    ];
    const { container } = render(<HeatmapChart data={data} valueKey="v" x="col" y="row" />);
    expect(cellOf(container, "0:0").querySelector('[data-slot="quiet-dot"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="heatmap-missing-mark"]')).toBeNull();
    expect(container.querySelector('[data-slot="heatmap-legend-missing"]')).toBeNull();
    expect(container.querySelector('[data-slot="heatmap-legend-zero"]')).not.toBeNull();
  });

  it('draws neither mark with emptyValue="blank"', () => {
    const { container } = render(
      <HeatmapChart data={ZERO_AND_MISSING} emptyValue="blank" valueKey="v" x="col" y="row" />,
    );
    expect(container.querySelector('[data-slot="quiet-dot"]')).toBeNull();
    expect(container.querySelector('[data-slot="heatmap-missing-mark"]')).toBeNull();
  });
});

describe("value labels take the ink of the plate they sit on (#238)", () => {
  const RAMP_ROW = [1, 2, 3, 4, 5, 6, 7].map((v) => ({ col: `c${v}`, row: "r", v }));
  const ON_LIGHT = "var(--chart-ink-on-light)";
  const ON_DARK = "var(--chart-ink-on-dark)";

  let cleanup: (() => void) | null = null;
  afterEach(() => {
    cleanup?.();
    cleanup = null;
  });

  function labelOf(container: HTMLElement, id: string) {
    const text = cellOf(container, id).querySelector('[data-slot="halo-text"]');
    if (!text) throw new Error(`cell ${id} has no label`);
    return text;
  }

  it("falls back to the theme-inverting plot inks while the fills cannot be resolved", () => {
    const { container } = render(
      <HeatmapChart data={RAMP_ROW} showValues steps={7} valueKey="v" x="col" y="row" />,
    );
    expect(labelOf(container, "0:0").getAttribute("fill")).toBe(FG);
    expect(labelOf(container, "6:0").getAttribute("fill")).toBe(BG);
  });

  it.each([
    // [theme, first step (seq-1), third step (seq-3), last step (seq-7)]
    ["light", ON_LIGHT, ON_LIGHT, ON_DARK],
    ["dark", ON_DARK, ON_LIGHT, ON_LIGHT],
  ] as const)("picks the anchor from each resolved step in %s", (theme, first, third, last) => {
    cleanup = applyThemeVars(theme);
    const { container } = render(
      <HeatmapChart data={RAMP_ROW} showValues steps={7} valueKey="v" x="col" y="row" />,
    );
    expect(labelOf(container, "0:0").getAttribute("fill")).toBe(first);
    expect(labelOf(container, "2:0").getAttribute("fill")).toBe(third);
    expect(labelOf(container, "6:0").getAttribute("fill")).toBe(last);
    // The halo is always the opposite anchor.
    expect(labelOf(container, "6:0").getAttribute("stroke")).toBe(
      last === ON_DARK ? ON_LIGHT : ON_DARK,
    );
  });

  it("gives both arms of a light diverging ramp the light ink, and its pivot the dark ink", () => {
    cleanup = applyThemeVars("light");
    const data = [-9, 0.5, 9].map((v, i) => ({ col: `c${i}`, row: "r", v }));
    const { container } = render(
      <HeatmapChart data={data} palette="diverging" valueKey="v" x="col" y="row" />,
    );
    expect(labelOf(container, "0:0").getAttribute("fill")).toBe(ON_DARK);
    expect(labelOf(container, "1:0").getAttribute("fill")).toBe(ON_LIGHT);
    expect(labelOf(container, "2:0").getAttribute("fill")).toBe(ON_DARK);
  });
});
