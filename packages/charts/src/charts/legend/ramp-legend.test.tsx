import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { RampLegend, rampPositionOf } from "./ramp-legend";

describe("rampPositionOf", () => {
  it("clamps to [0, 1] and reads the domain proportionally", () => {
    expect(rampPositionOf(0, [0, 100])).toBe(0);
    expect(rampPositionOf(50, [0, 100])).toBe(0.5);
    expect(rampPositionOf(100, [0, 100])).toBe(1);
    expect(rampPositionOf(-10, [0, 100])).toBe(0);
    expect(rampPositionOf(150, [0, 100])).toBe(1);
  });

  it("returns the midpoint for a zero-width domain", () => {
    expect(rampPositionOf(5, [5, 5])).toBe(0.5);
  });
});

describe("RampLegend", () => {
  it("renders a stepped ramp with one swatch per step and a range label per swatch", () => {
    const { container } = render(
      <RampLegend scale={{ type: "stepped", domain: [0, 100], steps: 5, labels: "ranges" }} />,
    );
    expect(container.querySelectorAll('[data-slot="ramp-legend-step"]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-slot="ramp-legend-range-label"]')).toHaveLength(5);
  });

  it("renders a continuous gradient strip with ruler labels and no marker without a hover value", () => {
    const { container } = render(<RampLegend scale={{ type: "continuous", domain: [0, 42] }} />);
    expect(container.querySelector('[data-slot="ramp-legend-strip"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-slot="ramp-legend-step"]')).toHaveLength(0);
    expect(container.querySelector('[data-slot="ramp-legend-marker"]')).toBeNull();
  });

  it("moves the marker to the hovered value's position", () => {
    const { container } = render(
      <RampLegend scale={{ type: "continuous", domain: [0, 100] }} hover={25} />,
    );
    const marker = container.querySelector('[data-slot="ramp-legend-marker"]') as HTMLElement;
    expect(marker).not.toBeNull();
    expect(marker.style.left).toBe("25%");
  });

  it("states the scale once for assistive tech", () => {
    const { container } = render(
      <RampLegend scale={{ type: "stepped", domain: [0, 10], steps: 5 }} />,
    );
    const summary = container.querySelector(".sr-only");
    expect(summary?.textContent).toContain("5 steps");
  });
});
