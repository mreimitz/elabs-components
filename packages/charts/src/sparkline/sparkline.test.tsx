import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Sparkline } from "./sparkline";

describe("Sparkline", () => {
  it("renders one bar per value with an accessible name", () => {
    const { container } = render(<Sparkline values={[1, 4, 2, 8]} label="Edits per week" />);
    expect(screen.getByRole("img", { name: "Edits per week" })).toBeInTheDocument();
    expect(container.querySelectorAll("rect")).toHaveLength(4);
  });

  it("renders a polyline in line variant", () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} variant="line" />);
    expect(container.querySelector("polyline")).toBeInTheDocument();
  });

  it("renders a baseline (not a crash) for empty data", () => {
    const { container } = render(<Sparkline values={[]} />);
    expect(screen.getByRole("img", { name: "No data" })).toBeInTheDocument();
    expect(container.querySelector("line")).toBeInTheDocument();
  });

  it("keeps small nonzero bars visible next to a large outlier (min height)", () => {
    const { container } = render(<Sparkline values={[1, 100]} height={20} />);
    const rects = container.querySelectorAll("rect");
    // 15% of the drawable height (height - 1 = 19) ≈ 2.85 — not a 1px dash.
    expect(Number.parseFloat(rects[0]!.getAttribute("height")!)).toBeGreaterThanOrEqual(0.15 * 19);
    expect(Number.parseFloat(rects[1]!.getAttribute("height")!)).toBeCloseTo(19);
  });

  it("keeps zero values as a 1px baseline stub (distinct from activity)", () => {
    const { container } = render(<Sparkline values={[0, 100]} height={20} />);
    const rects = container.querySelectorAll("rect");
    expect(Number.parseFloat(rects[0]!.getAttribute("height")!)).toBe(1);
  });

  it("handles an all-zero series without NaN coordinates", () => {
    const { container } = render(<Sparkline values={[0, 0, 0]} />);
    for (const rect of container.querySelectorAll("rect")) {
      expect(rect.getAttribute("y")).not.toContain("NaN");
    }
  });
});
