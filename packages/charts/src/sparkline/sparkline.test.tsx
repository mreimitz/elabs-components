import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

  describe("fit", () => {
    it('draws at exactly width×height with no preserveAspectRatio override when unset (default "fixed")', () => {
      const { container } = render(<Sparkline values={[1, 2, 3]} width={80} height={20} />);
      const svg = container.querySelector("svg")!;
      expect(svg).not.toHaveAttribute("preserveAspectRatio");
      expect(svg).toHaveAttribute("width", "80");
      expect(svg).toHaveAttribute("viewBox", "0 0 80 20");
    });

    it('stays on the `width` fallback when ResizeObserver is unavailable (fit="fill")', () => {
      const original = globalThis.ResizeObserver;
      // @ts-expect-error -- deliberately simulating jsdom's default (no ResizeObserver)
      delete globalThis.ResizeObserver;
      try {
        const { container } = render(
          <Sparkline values={[1, 2, 3]} fit="fill" width={80} height={20} />,
        );
        const svg = container.querySelector("svg")!;
        expect(svg).toHaveAttribute("width", "80");
        expect(svg).toHaveAttribute("viewBox", "0 0 80 20");
      } finally {
        globalThis.ResizeObserver = original;
      }
    });

    it('measures the real rendered width and redraws at that exact size (fit="fill")', () => {
      const original = globalThis.ResizeObserver;
      class MockResizeObserver {
        #callback: ResizeObserverCallback;
        constructor(callback: ResizeObserverCallback) {
          this.#callback = callback;
        }
        observe() {
          // Real ResizeObservers report asynchronously; this fires
          // synchronously with a fixed width, standing in for "the
          // container measured 300px wide".
          this.#callback(
            [{ contentRect: { width: 300 } } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          );
        }
        unobserve() {}
        disconnect() {}
      }
      globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
      try {
        const { container } = render(
          <Sparkline values={[1, 2, 3]} fit="fill" width={80} height={20} />,
        );
        const svg = container.querySelector("svg")!;
        // Real measured width, not the `width` fallback — and no
        // `preserveAspectRatio` needed since viewBox now matches it exactly.
        expect(svg).toHaveAttribute("width", "300");
        expect(svg).toHaveAttribute("viewBox", "0 0 300 20");
        expect(svg).not.toHaveAttribute("preserveAspectRatio");
      } finally {
        globalThis.ResizeObserver = original;
      }
    });
  });

  describe("target", () => {
    /**
     * b-7 — the reference outranked the data: the dashed target was painted in
     * `--chart-foreground` (the darkest ink in light, the lightest in dark —
     * the dominant mark either way) while the series it exists to be read
     * against was drawn in the muted rung. The measured thing has to be the
     * strongest mark on the plot.
     */
    it("draws the series above the reference rung, never below it", () => {
      const { container } = render(<Sparkline values={[10, 20, 82]} target={90} />);
      const svg = container.querySelector('[data-slot="sparkline"]')!;
      // `currentColor` is the series ink (the line's stroke, the bars' fill).
      expect(svg).toHaveClass("text-chart-foreground");
      expect(svg).not.toHaveClass("text-muted-foreground");
      expect(container.querySelector('[data-slot="sparkline-target"]')).toHaveAttribute(
        "stroke",
        "var(--chart-foreground-muted)",
      );
    });
    it("a sparkline with nothing to outrank keeps the quiet series rung", () => {
      const { container } = render(<Sparkline values={[10, 20, 82]} />);
      expect(container.querySelector('[data-slot="sparkline"]')).toHaveClass(
        "text-muted-foreground",
      );
    });
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

  describe("hover + keyboard readout", () => {
    /** A fixed, nonzero rect for every element — the svg root AND the portaled
     *  readout box both call `getBoundingClientRect`, and jsdom answers all
     *  zeros unmocked (no layout engine). `width`/`height` match the
     *  component's own defaults (80×20), so the screen↔user-unit scale is 1:1
     *  and the geometry math stays easy to reason about in each assertion. */
    function mockRect() {
      return vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
        width: 80,
        height: 20,
        top: 0,
        left: 0,
        right: 80,
        bottom: 20,
        x: 0,
        y: 0,
        toJSON() {},
      } as DOMRect);
    }

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("is a keyboard tab stop by default (interactive defaults true)", () => {
      const { container } = render(<Sparkline values={[1, 2, 3]} />);
      const svg = container.querySelector("svg")!;
      expect(svg).toHaveAttribute("tabindex", "0");
      expect(svg).toHaveClass("focus-ring");
    });

    it("gives no tab stop when interactive={false}", () => {
      const { container } = render(<Sparkline values={[1, 2, 3]} interactive={false} />);
      expect(container.querySelector("svg")).not.toHaveAttribute("tabindex");
    });

    it("gives no tab stop when the caller's aria-hidden is truthy", () => {
      const { container } = render(<Sparkline values={[1, 2, 3]} aria-hidden="true" />);
      expect(container.querySelector("svg")).not.toHaveAttribute("tabindex");
    });

    it("renders no readout for an empty series, even though interactive defaults true", () => {
      const { container } = render(<Sparkline values={[]} />);
      expect(container.querySelector("svg")).not.toHaveAttribute("tabindex");
      fireEvent.focus(screen.getByRole("img"));
      expect(document.querySelector('[data-slot="sparkline-tooltip"]')).not.toBeInTheDocument();
    });

    it("focus shows the readout at the latest point, with the baseline/target rows", () => {
      mockRect();
      render(<Sparkline baseline={[8, 15, 76]} target={90} values={[10, 20, 82]} variant="line" />);
      fireEvent.focus(screen.getByRole("img"));
      const tooltip = document.querySelector('[data-slot="sparkline-tooltip"]')!;
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent("3 of 3");
      expect(tooltip).toHaveTextContent("82");
      expect(tooltip).toHaveTextContent("76");
      expect(tooltip).toHaveTextContent("90");
    });

    it("ArrowLeft moves to the previous point", () => {
      mockRect();
      render(<Sparkline values={[10, 20, 82]} variant="line" />);
      const svg = screen.getByRole("img");
      fireEvent.focus(svg);
      expect(screen.getByText("3 of 3")).toBeInTheDocument();
      fireEvent.keyDown(svg, { key: "ArrowLeft" });
      expect(screen.getByText("2 of 3")).toBeInTheDocument();
    });

    it("Escape hides the readout", () => {
      mockRect();
      render(<Sparkline values={[10, 20, 82]} variant="line" />);
      const svg = screen.getByRole("img");
      fireEvent.focus(svg);
      expect(document.querySelector('[data-slot="sparkline-tooltip"]')).toBeInTheDocument();
      fireEvent.keyDown(svg, { key: "Escape" });
      expect(document.querySelector('[data-slot="sparkline-tooltip"]')).not.toBeInTheDocument();
    });

    it("updates the live status region only on keyboard steps, never on pointer hover", () => {
      mockRect();
      render(<Sparkline values={[1, 2, 3, 4]} variant="line" />);
      const svg = screen.getByRole("img");
      fireEvent.focus(svg);
      const status = document.querySelector('[data-slot="sparkline-tooltip-status"]')!;
      const afterFocus = status.textContent;
      expect(afterFocus).toContain("4 of 4");
      fireEvent.pointerMove(svg, { clientX: 0, clientY: 10 });
      expect(status.textContent).toBe(afterFocus);
    });
  });
});
