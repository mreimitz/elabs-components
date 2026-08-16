import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// react-use-measure uses ResizeObserver for layout measurement, which jsdom
// does not implement. Mock it to return a fixed size so the chart's inner
// render gate (width > 0 && height > 0) is satisfied.
// Real render + a11y are covered by the Storybook interaction tests.
vi.mock("react-use-measure", () => ({
  default: () => [() => undefined, { width: 560, height: 288 }],
}));

import { ScatterChart, Scatter } from "./scatter-chart";
import { XAxis } from "./x-axis";

afterEach(cleanup);

const chartData = [
  { date: new Date("2024-01-01"), sessions: 420, conversions: 28 },
  { date: new Date("2024-02-01"), sessions: 510, conversions: 34 },
  { date: new Date("2024-03-01"), sessions: 390, conversions: 22 },
];

// A categorical x dimension — single letters are genuinely non-Date-coercible
// (`new Date("A").getTime()` is `NaN`), matching the LineChart/AreaChart #352
// regression repro exactly. ScatterChart carried an un-synced copy of the same
// crash: `shortDateFmt.format(xAccessor(d))` on an Invalid Date throws
// `RangeError: Invalid time value`.
const nonDateXData = [
  { ch: "A", value: 5 },
  { ch: "B", value: 8 },
];

describe("ScatterChart", () => {
  it("is exported as a function / forwardRef component", () => {
    expect(typeof ScatterChart).toBe("object"); // forwardRef returns an object
    expect(ScatterChart.displayName).toBe("ScatterChart");
  });

  it("mounts without throwing and attaches to the document", () => {
    const { container } = render(
      <ScatterChart data={chartData}>
        <Scatter dataKey="sessions" />
      </ScatterChart>,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("applies a custom className to the container", () => {
    const { container } = render(
      <ScatterChart data={chartData} className="my-chart">
        <Scatter dataKey="sessions" />
      </ScatterChart>,
    );
    expect(container.firstChild).toHaveClass("my-chart");
  });

  it("forwards a ref to the container div", () => {
    let capturedRef: HTMLDivElement | null = null;
    render(
      <ScatterChart
        data={chartData}
        ref={(el) => {
          capturedRef = el;
        }}
      >
        <Scatter dataKey="sessions" />
      </ScatterChart>,
    );
    expect(capturedRef).toBeInstanceOf(HTMLDivElement);
  });

  it("adds role/aria-label/tabIndex when accessibleLabel is provided", () => {
    const { container } = render(
      <ScatterChart
        data={chartData}
        accessibleLabel="Sessions vs conversions scatter chart"
        accessibleDescription="Series: Sessions (390–510), Conversions (22–34)."
      >
        <Scatter dataKey="sessions" />
      </ScatterChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("figure");
    expect(root.getAttribute("aria-label")).toBe("Sessions vs conversions scatter chart");
    expect(root.getAttribute("tabindex")).toBe("0");
    const descSpan = root.querySelector("span.sr-only");
    expect(descSpan).toBeInTheDocument();
  });

  it("does NOT add role/aria-label when accessibleLabel is absent", () => {
    const { container } = render(
      <ScatterChart data={chartData}>
        <Scatter dataKey="sessions" />
      </ScatterChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBeNull();
    expect(root.getAttribute("aria-label")).toBeNull();
  });
});

describe("ScatterChart — non-Date xDataKey value (#352)", () => {
  it("does not throw when xDataKey values are not Date-coercible", () => {
    expect(() =>
      render(
        <ScatterChart data={nonDateXData} xDataKey="ch">
          <Scatter dataKey="value" />
        </ScatterChart>,
      ),
    ).not.toThrow();
  });

  it('does not throw with a mounted XAxis (default tickMode="domain") — a SECOND, independent #352 crash site', () => {
    // ScatterChart builds its xScale domain via `Math.min`/`Math.max` over
    // `.getTime()` (not the NaN-skipping `extent()` LineChart/AreaChart use),
    // so an all-invalid dataset poisons the WHOLE domain to NaN rather than
    // degrading to a finite [0, 0] range. `XAxis`'s default tickMode="domain"
    // then interpolates within that NaN domain in `buildDomainTicks`
    // (x-axis.tsx), which threw the SAME `RangeError: Invalid time value` —
    // reachable via the exact path `AutoChart`'s scatter branch always mounts
    // (it renders a default, unconfigured `<XAxis />`). Guarded independently
    // of the ScatterChartInner dateLabels memo above.
    expect(() =>
      render(
        <ScatterChart data={nonDateXData} xDataKey="ch">
          <Scatter dataKey="value" />
          <XAxis />
        </ScatterChart>,
      ),
    ).not.toThrow();
  });

  it("warns once (dev-only) instead of silently swallowing the invalid x value", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { rerender } = render(
        <ScatterChart data={nonDateXData} xDataKey="ch">
          <Scatter dataKey="value" />
        </ScatterChart>,
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toMatch(/xDataKey.*"ch"/);

      // Re-rendering (e.g. a parent re-render) must NOT warn again — "once" holds.
      rerender(
        <ScatterChart data={nonDateXData} xDataKey="ch">
          <Scatter dataKey="value" />
        </ScatterChart>,
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does NOT warn for valid Date-based x data (no regression on the common case)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(
        <ScatterChart data={chartData}>
          <Scatter dataKey="sessions" />
        </ScatterChart>,
      );
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
