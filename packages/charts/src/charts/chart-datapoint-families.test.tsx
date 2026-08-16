/**
 * Per-family drill-down coverage (#349).
 *
 * The interaction contract is only worth having if it is the SAME contract on
 * every family the issue names — bar, line, area, pie, ring, funnel, plus the
 * legend. `chart-datapoint-layer.test.tsx` locks the shared keyboard model on
 * the cartesian shell; this file walks each family's own pointer surface and
 * asserts the payload it produces.
 *
 * jsdom caveats (pre-existing, documented in each family's own smoke test):
 * `@visx/responsive` needs ResizeObserver, `FunnelChart` measures with
 * `getBoundingClientRect`. Both are stubbed here so the REAL components render
 * — nothing about the interaction layer is mocked.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) => React.createElement(React.Fragment, null, children({ width: 560, height: 288 })),
  };
});

import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import type { ChartDatapoint } from "./chart-datapoint";
import { ChartLegend } from "./chart-legend";
import { FunnelChart } from "./funnel-chart";
import { PieChart } from "./pie-chart";
import { PieSlice } from "./pie-slice";
import { Ring } from "./ring";
import { RingChart } from "./ring-chart";

const TARGET = '[data-slot="chart-datapoint-layer-target"]';

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const barData = [
  { name: "Mon", visits: 12 },
  { name: "Tue", visits: 24 },
  { name: "Wed", visits: 8 },
];

const pieData = [
  { label: "Direct", value: 320 },
  { label: "Organic", value: 280 },
  { label: "Referral", value: 190 },
];

const ringData = [
  { label: "Storage", value: 60, maxValue: 100 },
  { label: "Compute", value: 30, maxValue: 100 },
];

const funnelData = [
  { label: "Visitors", value: 12000 },
  { label: "Signups", value: 4800 },
  { label: "Paid", value: 840 },
];

describe("BarChart drill-down (#349)", () => {
  it("fires with the clicked bar's datum, series and category", () => {
    const onDatapointClick = vi.fn();
    const { container } = render(
      <BarChart data={barData} onDatapointClick={onDatapointClick}>
        <Bar dataKey="visits" />
      </BarChart>,
    );

    const bars = container.querySelectorAll("svg rect:not([fill='transparent'])");
    expect(bars.length).toBeGreaterThanOrEqual(3);
    fireEvent.click(bars[1] as Element);

    expect(onDatapointClick).toHaveBeenCalledTimes(1);
    const [point] = onDatapointClick.mock.calls[0] as [ChartDatapoint];
    expect(point).toMatchObject({
      category: "Tue",
      index: 1,
      seriesKey: "visits",
      source: "pointer",
      value: 24,
    });
    expect(point.datum).toBe(barData[1]);
  });

  it("exposes one keyboard target per bar, outside the aria-hidden SVG", () => {
    const { container } = render(
      <BarChart data={barData} onDatapointClick={() => {}}>
        <Bar dataKey="visits" />
      </BarChart>,
    );
    const targets = container.querySelectorAll(TARGET);
    expect(targets).toHaveLength(3);
    expect(container.querySelectorAll(`${TARGET}[tabindex="0"]`)).toHaveLength(1);
    for (const target of targets) {
      expect(target.closest("svg")).toBeNull();
    }
    expect(targets[0]?.getAttribute("aria-label")).toBe("visits, Mon: 12");
  });

  it("renders no layer without a handler", () => {
    const { container } = render(
      <BarChart data={barData}>
        <Bar dataKey="visits" />
      </BarChart>,
    );
    expect(container.querySelector('[data-slot="chart-datapoint-layer"]')).toBeNull();
  });
});

describe("PieChart drill-down (#349)", () => {
  it("fires with the clicked slice's datum", () => {
    const onDatapointClick = vi.fn();
    const { container } = render(
      <PieChart data={pieData} onDatapointClick={onDatapointClick} size={240}>
        <PieSlice index={0} />
        <PieSlice index={1} />
        <PieSlice index={2} />
      </PieChart>,
    );

    // Each PieSlice renders its transparent hitbox path first.
    const hitboxes = container.querySelectorAll('path[fill="transparent"]');
    expect(hitboxes).toHaveLength(3);
    fireEvent.click(hitboxes[2] as Element);

    const [point] = onDatapointClick.mock.calls[0] as [ChartDatapoint];
    expect(point).toMatchObject({
      category: "Referral",
      index: 2,
      source: "pointer",
      value: 190,
    });
    // Single-series family — no series key to report.
    expect(point.seriesKey).toBeUndefined();
  });

  it("registers a keyboard target per slice with an accessible name", () => {
    const { container } = render(
      <PieChart data={pieData} onDatapointClick={() => {}} size={240}>
        <PieSlice index={0} />
      </PieChart>,
    );
    const targets = container.querySelectorAll(TARGET);
    expect(targets).toHaveLength(3);
    expect(targets[0]?.getAttribute("aria-label")).toBe("Direct: 320");
    for (const target of targets) {
      expect(target.closest("svg")).toBeNull();
    }
  });
});

describe("RingChart drill-down (#349)", () => {
  it("registers a keyboard target per ring and fires on activation", () => {
    const onDatapointClick = vi.fn();
    const { container } = render(
      <RingChart data={ringData} onDatapointClick={onDatapointClick} size={240}>
        <Ring index={0} />
        <Ring index={1} />
      </RingChart>,
    );

    const targets = [...container.querySelectorAll<HTMLButtonElement>(TARGET)];
    expect(targets).toHaveLength(2);
    expect(targets[1]?.getAttribute("aria-label")).toBe("Compute: 30");

    fireEvent.click(targets[1] as HTMLButtonElement, { detail: 0 });
    const [point] = onDatapointClick.mock.calls[0] as [ChartDatapoint];
    expect(point).toMatchObject({
      category: "Compute",
      index: 1,
      source: "keyboard",
      value: 30,
    });
  });
});

describe("FunnelChart drill-down (#349)", () => {
  function stubMeasurement() {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 300,
      height: 300,
      left: 0,
      right: 600,
      toJSON: () => ({}),
      top: 0,
      width: 600,
      x: 0,
      y: 0,
    } as DOMRect);
  }

  it("fires with the clicked stage and registers one keyboard target per stage", () => {
    stubMeasurement();
    const onDatapointClick = vi.fn();
    const { container } = render(
      <FunnelChart data={funnelData} onDatapointClick={onDatapointClick} />,
    );

    const targets = container.querySelectorAll(TARGET);
    expect(targets).toHaveLength(3);
    expect(targets[0]?.getAttribute("aria-label")).toBe("Visitors: 12000");

    // The stage label overlay is the funnel's own pointer surface.
    const overlays = container.querySelectorAll(".absolute.cursor-pointer");
    expect(overlays.length).toBeGreaterThanOrEqual(3);
    fireEvent.click(overlays[1] as Element);

    const [point] = onDatapointClick.mock.calls[0] as [ChartDatapoint];
    expect(point).toMatchObject({
      category: "Signups",
      index: 1,
      source: "pointer",
      value: 4800,
    });
  });
});

describe("ChartLegend drill-down (#349)", () => {
  const items = [
    { color: "var(--chart-1)", label: "Revenue", value: 120 },
    { color: "var(--chart-2)", label: "Costs", value: 80 },
  ];

  it("renders plain <div> items when onItemClick is unset", () => {
    const { container } = render(<ChartLegend items={items} />);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("renders REAL buttons (not div-as-button) and fires with the item", () => {
    const onItemClick = vi.fn();
    render(<ChartLegend items={items} onItemClick={onItemClick} />);
    const button = screen.getByRole("button", { name: /Costs/ });
    fireEvent.click(button);
    expect(onItemClick).toHaveBeenCalledTimes(1);
    expect(onItemClick.mock.calls[0]?.[0]).toBe(items[1]);
    expect(onItemClick.mock.calls[0]?.[1]).toBe(1);
  });
});
