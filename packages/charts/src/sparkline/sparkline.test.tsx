import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetWarnOnce } from "@elabs-ai/components-ui/definition";
import { cleanup } from "@testing-library/react";
import {
  ChartContractError,
  configureChartTestDouble,
  resetChartTestDoubleConfig,
  Sparkline as SparklineDouble,
} from "../test";

import { ChartAnalyticsDescriptionContext } from "../charts/chart-a11y";
import { CHART_RESIZE_DEBOUNCE_MS } from "../charts/layout-size";
import { Sparkline } from "./sparkline";

describe("Sparkline", () => {
  it("renders one bar per value with an accessible name", () => {
    const { container } = render(
      <Sparkline values={[1, 4, 2, 8]} accessibleLabel="Edits per week" />,
    );
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
      // The observer only says WHEN to measure: the width is the svg's own
      // content box, read from its computed style (the one chart measurement
      // path), which jsdom does not lay out — stand in a 300px-wide box.
      const rects = vi
        .spyOn(Element.prototype, "getClientRects")
        .mockImplementation(() => [new DOMRect(0, 0, 300, 20)] as unknown as DOMRectList);
      const realGetComputedStyle = window.getComputedStyle.bind(window);
      const computed = vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) => {
        const style = realGetComputedStyle(el, pseudo);
        if (!(el instanceof SVGSVGElement)) return style;
        return new Proxy(style, {
          get(target, prop) {
            if (prop === "width") return "300px";
            if (prop === "height") return "20px";
            if (prop === "boxSizing") return "content-box";
            const value = Reflect.get(target, prop, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      });
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
        rects.mockRestore();
        computed.mockRestore();
        globalThis.ResizeObserver = original;
      }
    });

    it('keeps its last measured width while hidden, not the `width` fallback (fit="fill")', () => {
      vi.useFakeTimers();
      const original = globalThis.ResizeObserver;
      const callbacks: ResizeObserverCallback[] = [];
      class MockResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          callbacks.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      }
      globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
      const observe = () =>
        act(() => {
          for (const callback of callbacks) callback([], {} as ResizeObserver);
        });
      // Shown, the svg has one box, 300px wide; hidden, it has none.
      let shown = true;
      const rects = vi
        .spyOn(Element.prototype, "getClientRects")
        .mockImplementation(
          () => (shown ? [new DOMRect(0, 0, 300, 20)] : []) as unknown as DOMRectList,
        );
      const realGetComputedStyle = window.getComputedStyle.bind(window);
      const computed = vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) => {
        const style = realGetComputedStyle(el, pseudo);
        if (!(el instanceof SVGSVGElement)) return style;
        return new Proxy(style, {
          get(target, prop) {
            if (prop === "width") return "300px";
            if (prop === "height") return "20px";
            if (prop === "boxSizing") return "content-box";
            const value = Reflect.get(target, prop, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      });
      try {
        const { container } = render(
          <Sparkline values={[1, 2, 3]} fit="fill" width={80} height={20} />,
        );
        const svg = container.querySelector("svg")!;
        observe(); // measured: 300
        expect(svg).toHaveAttribute("viewBox", "0 0 300 20");
        act(() => vi.advanceTimersByTime(CHART_RESIZE_DEBOUNCE_MS)); // the burst ends
        shown = false;
        observe(); // measured: 0
        act(() => vi.advanceTimersByTime(CHART_RESIZE_DEBOUNCE_MS));
        expect(svg).toHaveAttribute("width", "300");
        expect(svg).toHaveAttribute("viewBox", "0 0 300 20");
      } finally {
        rects.mockRestore();
        computed.mockRestore();
        globalThis.ResizeObserver = original;
        vi.useRealTimers();
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
          messages={{ baseline: "last year" }}
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

// ── RM-191 renames (ADR 0042 A.1) ────────────────────────────────────────────
//
// Each renamed prop: the old name renders the same DOM as the new one, warns once in
// development and never in production, the `./test` double stays silent under its default
// `deprecatedProps: "ignore"`, and when both names are set the new one wins (`new-wins`).

/** `container.innerHTML` with React's per-root `useId` values made comparable. */
const rm191Html = (container: HTMLElement) =>
  container.innerHTML.replace(/«r[0-9a-z]+»|:r[0-9a-z]+:|_r_[0-9a-z]+_/g, "«id»");

const rm191WarnSpy = () => vi.spyOn(console, "warn").mockImplementation(() => {});

describe.each([
  {
    row: "row 3",
    old: "labels",
    renamed: "messages",
    oldValue: { target: "goal" },
    newValue: { target: "aim" },
    name: "Trend of 3 values, latest 8, goal 6",
    both: "Trend of 3 values, latest 8, aim 6",
  },
  {
    row: "row 5",
    old: "label",
    renamed: "accessibleLabel",
    oldValue: "Edits per week",
    newValue: "Edits, weekly",
    name: "Edits per week",
    both: "Edits, weekly",
  },
] as const)("Sparkline `$old` → `$renamed` (RM-191, $row)", (row) => {
  afterEach(() => {
    cleanup();
    resetWarnOnce();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  const base = { values: [2, 5, 8], target: 6 };
  const withOld = (value: unknown = row.oldValue) => ({ ...base, [row.old]: value });

  it("the old name renders the same DOM as the new one", () => {
    rm191WarnSpy();
    const renamed = render(<Sparkline {...base} {...{ [row.renamed]: row.oldValue }} />).container;
    const old = render(<Sparkline {...withOld()} />).container;
    expect(rm191Html(old)).toBe(rm191Html(renamed));
    expect(old.querySelector("svg")).toHaveAccessibleName(row.name);
  });

  it("warns once in development, however often it renders", () => {
    const warn = rm191WarnSpy();
    const { rerender } = render(<Sparkline {...withOld()} />);
    rerender(<Sparkline {...withOld(row.newValue)} />);
    render(<Sparkline {...withOld()} />);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      `[Sparkline] "${row.old}" is deprecated and will be removed in 6.0.0. Use "${row.renamed}".`,
    );
  });

  it("never warns in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = rm191WarnSpy();
    render(<Sparkline {...withOld()} />);
    expect(warn).not.toHaveBeenCalled();
  });

  it("the ./test double stays silent under its default, and still reads the old name", () => {
    const warn = rm191WarnSpy();
    const { container } = render(<SparklineDouble {...withOld()} />);
    expect(warn).not.toHaveBeenCalled();
    expect(container.querySelector("svg")).toHaveAccessibleName(row.name);
  });

  it("both names set: the new one wins", () => {
    rm191WarnSpy();
    const { container } = render(<Sparkline {...withOld()} {...{ [row.renamed]: row.newValue }} />);
    expect(container.querySelector("svg")).toHaveAccessibleName(row.both);
  });
});

describe("Sparkline accessibleDescription (the a11y group, RM-191)", () => {
  it("describes the chart through a hidden element; unset, the DOM is unchanged", () => {
    const plain = render(<Sparkline values={[2, 5, 8]} />).container;
    expect(plain.querySelector("[aria-describedby]")).toBeNull();
    const { container } = render(
      <Sparkline values={[2, 5, 8]} accessibleDescription="Rising for three weeks." />,
    );
    expect(container.querySelector("svg")).toHaveAccessibleDescription("Rising for three weeks.");
  });

  it("describes the empty-series chart too", () => {
    const { container } = render(
      <Sparkline values={[]} accessibleDescription="No edits recorded yet." />,
    );
    expect(container.querySelector("svg")).toHaveAccessibleDescription("No edits recorded yet.");
  });

  it("never picks up an enclosing chart's analytics sentence", () => {
    for (const values of [[2, 5, 8], []]) {
      const { container, unmount } = render(
        <ChartAnalyticsDescriptionContext value="Average 5.0 across the parent chart.">
          <Sparkline values={values} />
        </ChartAnalyticsDescriptionContext>,
      );
      expect(container.querySelector(".sr-only")).toBeNull();
      expect(container.querySelector("[aria-describedby]")).toBeNull();
      unmount();
    }
  });
});

describe("Sparkline ./test double wrapper (RM-191)", () => {
  afterEach(() => {
    cleanup();
    resetWarnOnce();
    resetChartTestDoubleConfig();
    vi.restoreAllMocks();
  });

  const DOUBLE_PREFIX = "@elabs-ai/components-charts/test:";

  it('`deprecatedProps: "warn"`: one warning per old name across a rerender, none from the real Sparkline', () => {
    configureChartTestDouble({ deprecatedProps: "warn" });
    const warn = rm191WarnSpy();
    const { rerender } = render(
      <SparklineDouble values={[2, 5, 8]} target={6} label="Edits" labels={{ target: "goal" }} />,
    );
    rerender(
      <SparklineDouble values={[2, 5, 9]} target={6} label="Edits" labels={{ target: "aim" }} />,
    );
    const messages = warn.mock.calls.map(([message]) => String(message));
    const fromDouble = (name: string) =>
      messages.filter((m) => m.startsWith(DOUBLE_PREFIX) && m.includes(`prop "${name}"`));
    expect(fromDouble("label")).toHaveLength(1);
    expect(fromDouble("labels")).toHaveLength(1);
    expect(messages.filter((m) => m.startsWith("[Sparkline]"))).toEqual([]);
    expect(messages).toHaveLength(2);
  });

  it('`deprecatedProps: "throw"`: the old `label` throws a ChartContractError', () => {
    configureChartTestDouble({ deprecatedProps: "throw" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<SparklineDouble values={[2, 5, 8]} label="Edits" />)).toThrow(
      ChartContractError,
    );
  });

  it("forwards its ref to the real <svg>", () => {
    const ref = { current: null as SVGSVGElement | null };
    const { container } = render(<SparklineDouble ref={ref} values={[2, 5, 8]} />);
    expect(ref.current).toBeInstanceOf(SVGSVGElement);
    expect(ref.current).toBe(container.querySelector("svg"));
  });
});

describe("Sparkline in the A2UI catalogue (RM-191)", () => {
  afterEach(() => {
    cleanup();
    resetWarnOnce();
    vi.restoreAllMocks();
  });

  it("a stored surface's `label` still names the chart, with no warning", async () => {
    const { CHARTS_A2UI_BINDINGS } = await import("../a2ui/charts-catalog");
    const Bound = CHARTS_A2UI_BINDINGS.Sparkline!;
    const warn = rm191WarnSpy();
    const { container } = render(<Bound values={[2, 5, 8]} label="Edits per week" />);
    expect(container.querySelector("svg")).toHaveAccessibleName("Edits per week");
    expect(warn).not.toHaveBeenCalled();
  });
});
