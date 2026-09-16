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

  it("keeps the default rendering byte-identical when no reference props are set", () => {
    const before = render(<Sparkline values={[1, 4, 2, 8]} />).container.innerHTML;
    const after = render(<Sparkline values={[1, 4, 2, 8]} />).container.innerHTML;
    expect(before).toBe(after);
    expect(before).not.toContain("sparkline-target");
    expect(before).not.toContain("sparkline-baseline");
    expect(before).not.toContain("sparkline-band");
    expect(before).not.toContain("sparkline-last-value");
  });

  it("stamps the root data-slot", () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} />);
    expect(container.querySelector("svg")).toHaveAttribute("data-slot", "sparkline");
  });

  describe("target", () => {
    it("draws a target line and widens the bar domain so nothing clips", () => {
      const { container } = render(<Sparkline values={[10, 20, 82]} target={90} />);
      const line = container.querySelector('[data-slot="sparkline-target"]');
      expect(line).toBeInTheDocument();
      // The target (90) is above every bar's own value, so the tallest bar's
      // rect must sit strictly below the target line's y — i.e. inside the
      // viewBox, never clipped above it.
      const targetY = Number.parseFloat(line!.getAttribute("y1")!);
      const rects = container.querySelectorAll("rect");
      const lastRect = rects[rects.length - 1]!;
      const lastRectTop = Number.parseFloat(lastRect.getAttribute("y")!);
      expect(lastRectTop).toBeGreaterThanOrEqual(targetY);
    });

    it("includes the target fact in the accessible name", () => {
      render(<Sparkline values={[10, 20, 82]} target={90} />);
      expect(screen.getByRole("img")).toHaveAccessibleName(
        "Trend of 3 values, latest 82, target 90",
      );
    });

    it("stays zero-based for bars with a target present", () => {
      const { container } = render(<Sparkline values={[10, 20, 82]} target={90} />);
      const rects = container.querySelectorAll("rect");
      // Bottom edge of every bar sits at the SVG's own height (zero-based).
      for (const rect of rects) {
        const y = Number.parseFloat(rect.getAttribute("y")!);
        const h = Number.parseFloat(rect.getAttribute("height")!);
        expect(y + h).toBeCloseTo(20);
      }
    });
  });

  describe("baseline", () => {
    it("draws a baseline polyline and folds its latest value into the accessible name", () => {
      const { container } = render(
        <Sparkline
          values={[10, 20, 82]}
          baseline={[8, 15, 76]}
          labels={{ baseline: "last year" }}
        />,
      );
      expect(container.querySelector('[data-slot="sparkline-baseline"]')).toBeInTheDocument();
      expect(screen.getByRole("img")).toHaveAccessibleName(
        "Trend of 3 values, latest 82, last year 76",
      );
    });
  });

  describe("band", () => {
    it("draws a band rect that stays inside the viewBox", () => {
      const { container } = render(<Sparkline values={[40, 55, 60]} band={[70, 88]} height={20} />);
      const rect = container.querySelector('[data-slot="sparkline-band"]')!;
      const y = Number.parseFloat(rect.getAttribute("y")!);
      const h = Number.parseFloat(rect.getAttribute("height")!);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y + h).toBeLessThanOrEqual(20);
    });

    it("includes the band fact in the accessible name with an en dash", () => {
      render(<Sparkline values={[40, 55, 60]} band={[70, 88]} />);
      expect(screen.getByRole("img")).toHaveAccessibleName(
        "Trend of 3 values, latest 60, normal range 70–88",
      );
    });
  });

  describe("line variant with references", () => {
    it("keeps the widened min–max domain inside the viewBox (target above every value)", () => {
      const { container } = render(
        <Sparkline values={[10, 20, 82]} variant="line" target={90} height={20} />,
      );
      const polyline = container.querySelector("polyline")!;
      const ys = polyline
        .getAttribute("points")!
        .split(" ")
        .map((pt) => Number.parseFloat(pt.split(",")[1]!));
      for (const y of ys) {
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(20);
      }
      const targetLine = container.querySelector('[data-slot="sparkline-target"]')!;
      const targetY = Number.parseFloat(targetLine.getAttribute("y1")!);
      expect(targetY).toBeGreaterThanOrEqual(0);
    });
  });

  describe("all references combined", () => {
    it("uses formatValue for every number in the accessible name", () => {
      render(
        <Sparkline
          values={[10, 20, 82]}
          target={90}
          baseline={[8, 15, 76]}
          band={[70, 88]}
          formatValue={(v) => `${v}%`}
        />,
      );
      expect(screen.getByRole("img")).toHaveAccessibleName(
        "Trend of 3 values, latest 82%, target 90%, baseline 76%, normal range 70%–88%",
      );
    });
  });

  describe("showLastValue", () => {
    it("renders the formatted last value as text and reserves width for it", () => {
      const { container } = render(<Sparkline values={[1, 4, 2, 8]} showLastValue width={80} />);
      const text = container.querySelector('[data-slot="sparkline-last-value"]');
      expect(text).toBeInTheDocument();
      expect(text).toHaveTextContent("8");
      // The plot itself must have shrunk to make room — the last bar's right
      // edge sits before the text's x position, not past the svg width.
      const textX = Number.parseFloat(text!.getAttribute("x")!);
      expect(textX).toBeLessThanOrEqual(80);
      const rects = container.querySelectorAll("rect");
      const lastRect = rects[rects.length - 1]!;
      const lastRectRight =
        Number.parseFloat(lastRect.getAttribute("x")!) +
        Number.parseFloat(lastRect.getAttribute("width")!);
      expect(lastRectRight).toBeLessThan(textX);
    });

    it("uses formatValue when provided", () => {
      const { container } = render(
        <Sparkline values={[1, 4, 2, 8000]} showLastValue formatValue={(v) => `${v}%`} />,
      );
      expect(container.querySelector('[data-slot="sparkline-last-value"]')).toHaveTextContent(
        "8000%",
      );
    });
  });
});
