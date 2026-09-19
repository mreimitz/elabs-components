import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { colorScaleFor } from "@elabs-ai/components-ui";
import { HeatmapCell, HeatmapLegend, heatmapCellStyle } from "./heatmap-cell";

describe("HeatmapCell", () => {
  it("keeps the value for AT when hidden, and paints the td with a ramp token", () => {
    render(<HeatmapCell label="42" hideValue />);
    expect(screen.getByText("42")).toHaveClass("sr-only");
    expect(heatmapCellStyle("var(--chart-seq-3)")).toEqual({
      backgroundColor: "var(--chart-seq-3)",
    });
    expect(heatmapCellStyle(null)).toBeUndefined();
  });
  it("legend: one swatch per stepped class, a ramp strip for continuous", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const { container, rerender } = render(
      <HeatmapLegend
        scale={colorScaleFor(values, { type: "stepped", steps: 4 })}
        title="Rides"
        formatValue={String}
      />,
    );
    expect(screen.getByRole("group", { name: "Rides" })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="heatmap-legend-swatch"]')).toHaveLength(4);
    rerender(
      <HeatmapLegend scale={colorScaleFor(values, { type: "continuous" })} formatValue={String} />,
    );
    expect(container.querySelector('[data-slot="heatmap-legend-ramp"]')).not.toBeNull();
  });
});
