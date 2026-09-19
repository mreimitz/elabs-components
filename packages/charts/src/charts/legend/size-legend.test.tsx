import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { SizeLegend } from "./size-legend";

describe("SizeLegend", () => {
  it("renders three sqrt-scaled sample circles by default", () => {
    const { container } = render(<SizeLegend domain={[0, 100]} />);
    const samples = container.querySelectorAll('[data-slot="size-legend-sample"]');
    expect(samples).toHaveLength(3);
    const radii = Array.from(container.querySelectorAll("circle")).map((c) =>
      Number(c.getAttribute("r")),
    );
    // Sample values are 33.3, 66.7, 100 — sqrt-scaled radii, so the ratio
    // between consecutive radii is sqrt(2/1)/sqrt(3/2) < 2 (never linear).
    expect(radii[2]).toBeGreaterThan(radii[1] as number);
    expect(radii[1]).toBeGreaterThan(radii[0] as number);
    // The largest sample draws at maxRadius (default 16).
    expect(radii[2]).toBeCloseTo(16, 0);
  });

  it("honours a custom step count", () => {
    const { container } = render(<SizeLegend domain={[0, 10]} steps={2} />);
    expect(container.querySelectorAll('[data-slot="size-legend-sample"]')).toHaveLength(2);
  });

  it("states the scale once for assistive tech", () => {
    const { container } = render(<SizeLegend domain={[0, 50]} />);
    expect(container.querySelector(".sr-only")?.textContent).toContain("Size scale");
  });
});
