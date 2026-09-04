/**
 * UnitChart — jsdom smoke + contract tests (RM-024).
 *
 * `UnitChart` measures its container with `getBoundingClientRect` (same
 * pattern as `FunnelChart`, see `chart-datapoint-families.test.tsx`), which
 * jsdom always reports as zero-sized unless stubbed — so every test that
 * needs marks/ticks/targets on the page stubs `HTMLElement.prototype
 * .getBoundingClientRect` first. A full visual pass lives in the co-located
 * Storybook story (`unit-chart.stories.tsx`), exercised by
 * `pnpm --filter @elabs-ai/components-docs test-storybook`.
 */

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ChartDatapoint } from "./chart-datapoint";
import { UnitChart } from "./unit-chart";
import { computeArithmetic } from "./unit-layouts";

const TARGET = '[data-slot="chart-datapoint-layer-target"]';
const MARK = '[data-slot="unit-chart-mark"]';

beforeAll(() => {
  if (typeof window !== "undefined" && !window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function stubMeasurement(width = 600, height = 300) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    bottom: height,
    height,
    left: 0,
    right: width,
    toJSON: () => ({}),
    top: 0,
    width,
    x: 0,
    y: 0,
  } as DOMRect);
}

// Exactly the roadmap's "41 + 35 + 12 + 12 = 100" example — sums cleanly.
const sources = [
  { label: "Search", value: 41 },
  { label: "Direct", value: 35 },
  { label: "Referral", value: 12 },
  { label: "Social", value: 12 },
];

// The roadmap's rounding acceptance example: rounds to 98, 2 rounded away.
const roundingExample = [
  { label: "A", value: 49.0 },
  { label: "B", value: 27.4 },
  { label: "C", value: 13.9 },
  { label: "D", value: 5.0 },
  { label: "E", value: 3.2 },
];

const fears = [
  { label: "Heights", value: 32 },
  { label: "Spiders", value: 24 },
  { label: "Public speaking", value: 61 },
  { label: "Snakes", value: 18 },
  { label: "Flying", value: 22 },
  { label: "Dark", value: 9 },
];

describe("UnitChart", () => {
  it("is exported as a forwardRef component", () => {
    expect(typeof UnitChart).toBe("object");
    expect(UnitChart).toBeTruthy();
  });

  it("returns null for empty data without throwing", () => {
    const { container } = render(<UnitChart data={[]} layout="waffle" />);
    expect(container.firstChild).toBeNull();
  });

  it("mounts each layout without throwing", () => {
    for (const layout of ["waffle", "field", "rows"] as const) {
      const { container, unmount } = render(
        <div style={{ width: 400, height: 400 }}>
          <UnitChart data={sources} layout={layout} />
        </div>,
      );
      expect(container.querySelector('[data-slot="unit-chart"]')).toBeInTheDocument();
      unmount();
    }
  });

  it("accepts a forwarded ref", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(<UnitChart data={sources} layout="waffle" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("adds role/aria-label/tabIndex when accessibleLabel is provided", () => {
    const { container } = render(
      <UnitChart accessibleLabel="Traffic sources" data={sources} layout="waffle" />,
    );
    const root = container.querySelector('[data-slot="unit-chart"]');
    expect(root).toHaveAttribute("role", "figure");
    expect(root).toHaveAttribute("aria-label", "Traffic sources");
    expect(root).toHaveAttribute("tabindex", "0");
  });

  it('renders a role="img" summary naming every series with value and share', () => {
    const { container } = render(<UnitChart data={sources} layout="waffle" />);
    const summary = container.querySelector('[role="img"]');
    expect(summary).toBeInTheDocument();
    expect(summary?.getAttribute("aria-label")).toBe(
      "Search: 41 (41%), Direct: 35 (35%), Referral: 12 (12%), Social: 12 (12%)",
    );
  });

  it('folds unitLabel into the role="img" summary', () => {
    const { container } = render(
      <UnitChart data={sources} layout="waffle" unitLabel="one dot = one visit in a hundred" />,
    );
    const summary = container.querySelector('[role="img"]');
    expect(summary?.getAttribute("aria-label")).toMatch(/^one dot = one visit in a hundred\. /);
  });

  it('shows the exact arithmetic when counts sum to total ("41 + 35 + 12 + 12 = 100")', () => {
    const { getByText } = render(<UnitChart data={sources} layout="waffle" />);
    expect(getByText("41 + 35 + 12 + 12 = 100")).toBeInTheDocument();
  });

  it('calls out the rounding remainder ("98 · 2 rounded away") for the roadmap example', () => {
    const arithmetic = computeArithmetic(roundingExample, 1, 100);
    expect(arithmetic.sum).toBe(98);
    expect(arithmetic.remainder).toBe(2);
    expect(arithmetic.text).toBe("98 · 2 rounded away");

    const { getByText } = render(<UnitChart data={roundingExample} layout="waffle" />);
    expect(getByText("98 · 2 rounded away")).toBeInTheDocument();
  });

  it("draws exactly sum(round(value/unit)) marks for a waffle layout", () => {
    stubMeasurement();
    const { container } = render(<UnitChart data={sources} layout="waffle" />);
    expect(container.querySelectorAll(MARK)).toHaveLength(100);
  });

  it("registers ONE keyboard target per SERIES, never per mark", () => {
    stubMeasurement();
    const onDatapointClick = vi.fn();
    const { container } = render(
      <UnitChart data={sources} layout="waffle" onDatapointClick={onDatapointClick} />,
    );
    const targets = container.querySelectorAll(TARGET);
    // 4 series, 100 marks — the targets must track the series, not the marks.
    expect(targets).toHaveLength(sources.length);
    expect(targets[0]?.getAttribute("aria-label")).toBe("Search: 41");
  });

  it("fires onDatapointClick with the clicked series", () => {
    stubMeasurement();
    const onDatapointClick = vi.fn();
    const { container } = render(
      <UnitChart data={sources} layout="waffle" onDatapointClick={onDatapointClick} />,
    );
    const group = container.querySelector('[data-slot="unit-chart-series"]');
    expect(group).toBeInTheDocument();
    fireEvent.click(group as Element);
    expect(onDatapointClick).toHaveBeenCalledTimes(1);
    const [point] = onDatapointClick.mock.calls[0] as [ChartDatapoint];
    expect(point).toMatchObject({ category: "Search", index: 0, source: "pointer", value: 41 });
  });

  it("draws one cluster + Leader callout per series for the field layout", () => {
    stubMeasurement();
    const { container } = render(<UnitChart data={fears} layout="field" />);
    expect(container.querySelectorAll(MARK).length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-slot="leader"]')).toHaveLength(fears.length);
    for (const fear of fears) {
      expect(container.textContent).toContain(fear.label);
    }
  });

  it("draws one tick row per series, with the value at the inked (right) edge, for the rows layout", () => {
    stubMeasurement();
    const { container, getByText } = render(<UnitChart data={fears} layout="rows" />);
    expect(container.querySelectorAll('[data-slot="unit-stack"]')).toHaveLength(fears.length);
    for (const fear of fears) {
      expect(getByText(fear.label)).toBeInTheDocument();
      expect(getByText(String(fear.value))).toBeInTheDocument();
    }
  });

  it("ignores `total` for rows — a row may sum past it", () => {
    // 6 fears at unit=1, values well past 100 in aggregate — rows must not clip.
    stubMeasurement();
    const { container } = render(<UnitChart data={fears} layout="rows" total={100} />);
    const stacks = container.querySelectorAll('[data-slot="unit-stack"]');
    expect(stacks).toHaveLength(fears.length);
    // "Public speaking" (61) alone already exceeds a 100-total waffle's per-series share.
    const tickGroup = stacks[2];
    expect(tickGroup?.querySelectorAll('[data-slot="unit-stack-unit"]')).toHaveLength(61);
  });

  it('sorts descending when sort="desc"', () => {
    stubMeasurement();
    const unsorted = [
      { label: "Low", value: 5 },
      { label: "High", value: 90 },
      { label: "Mid", value: 5 },
    ];
    const { container } = render(<UnitChart data={unsorted} layout="rows" sort="desc" />);
    const labels = Array.from(container.querySelectorAll("text")).map((el) => el.textContent);
    expect(labels[0]).toBe("High");
  });
});
