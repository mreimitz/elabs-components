import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartTooltipInline } from "./tooltip-inline";

function label(pointerY?: number | null) {
  const { container } = render(
    <svg>
      <ChartTooltipInline color="currentColor" pointerY={pointerY} text="42" x={100} y={80} />
    </svg>,
  );
  return container.querySelector<SVGTextElement>('[data-slot="chart-tooltip-inline"]');
}

describe("ChartTooltipInline", () => {
  it("sits above its point by default", () => {
    expect(label()?.getAttribute("data-placement")).toBe("above");
    expect(label()?.getAttribute("dy")).toBe("-10");
  });

  it("moves below the point when the pointer is where the label would be", () => {
    const text = label(70);
    expect(text?.getAttribute("data-placement")).toBe("below");
    expect(Number(text?.getAttribute("dy"))).toBeGreaterThan(0);
  });

  it("stays above when the pointer is on or below the point, or far above it", () => {
    expect(label(80)?.getAttribute("data-placement")).toBe("above");
    expect(label(120)?.getAttribute("data-placement")).toBe("above");
    expect(label(10)?.getAttribute("data-placement")).toBe("above");
  });
});
