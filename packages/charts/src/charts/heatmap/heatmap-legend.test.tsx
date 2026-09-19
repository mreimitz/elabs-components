import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { HeatmapLegend, type HeatmapLegendSwatch } from "./heatmap-legend";

const swatches: HeatmapLegendSwatch[] = Array.from({ length: 5 }, (_, i) => ({
  color: `var(--chart-seq-${i + 1})`,
  opacity: 1,
  hatched: false,
}));

const formatValue = (value: number) => String(value);

describe("HeatmapLegend", () => {
  it("labelMode='endpoints' (default) keeps the lo/hi bracket, no range labels", () => {
    const { container } = render(
      <HeatmapLegend
        continuous={false}
        emptyValue="quiet"
        formatValue={formatValue}
        hi={100}
        lo={0}
        swatches={swatches}
      />,
    );
    expect(container.querySelectorAll('[data-slot="heatmap-legend-range-label"]')).toHaveLength(0);
    expect(container.textContent).toContain("0");
    expect(container.textContent).toContain("100");
  });

  it("labelMode='ranges' renders one range label per swatch (RM-118)", () => {
    const { container } = render(
      <HeatmapLegend
        continuous={false}
        emptyValue="quiet"
        formatValue={formatValue}
        hi={100}
        labelMode="ranges"
        lo={0}
        swatches={swatches}
      />,
    );
    const labels = container.querySelectorAll('[data-slot="heatmap-legend-range-label"]');
    expect(labels).toHaveLength(5);
    expect(labels[0]?.textContent).toBe("0–20");
    expect(labels[4]?.textContent).toBe("80–100");
  });

  it("moves the marker to the hovered value's position on the strip", () => {
    const { container } = render(
      <HeatmapLegend
        continuous={false}
        emptyValue="quiet"
        formatValue={formatValue}
        hi={100}
        hover={25}
        lo={0}
        swatches={swatches}
      />,
    );
    const marker = container.querySelector('[data-slot="heatmap-legend-marker"]') as HTMLElement;
    expect(marker).not.toBeNull();
    expect(marker.style.left).toBe("25%");
  });

  it("renders no marker when hover is unset", () => {
    const { container } = render(
      <HeatmapLegend
        continuous={false}
        emptyValue="quiet"
        formatValue={formatValue}
        hi={100}
        lo={0}
        swatches={swatches}
      />,
    );
    expect(container.querySelector('[data-slot="heatmap-legend-marker"]')).toBeNull();
  });
});
