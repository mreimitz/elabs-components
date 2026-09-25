/**
 * RM-142 guarantee: with no `selectionGestures` / `onSelectionIntent` the
 * three wired families (ScatterChart, BarChart, the time-series shell via
 * LineChart) render byte-identical DOM. The snapshots were recorded against
 * the pre-RM-142 tree; a gesture prop set WITHOUT the handler must also mount
 * nothing (the layer needs both).
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("react-use-measure", () => ({
  default: () => [() => undefined, { width: 560, height: 288 }],
}));

vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "parent-size" },
        children({ width: 560, height: 288 }),
      ),
  };
});

import { Bar } from "../bar";
import { BarChart } from "../bar-chart";
import { CanvasLayer } from "../canvas-layer/canvas-layer";
import { DistributionChart } from "../distribution/distribution-chart";
import { HeatmapChart } from "../heatmap/heatmap-chart";
import { LineChart } from "../line-chart";
import { Scatter, ScatterChart } from "../scatter-chart";
import type { ChartSelectionIntent } from "./types";

afterEach(cleanup);

beforeAll(() => {
  // The heatmap's reveal waits on `IntersectionObserver` (jsdom has none); a
  // canvas has no 2D context in jsdom — both stubbed, never exercised here.
  if (typeof window !== "undefined" && !window.IntersectionObserver) {
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  }
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

/**
 * `useId` values differ per mount; compare structure, not the counter. The
 * helpers below pass `tooltip={false}`: the snapshots predate the default tooltip.
 */
const stripIds = (html: string) => html.replace(/_r_[a-z0-9]+_/g, "_r_");

const scatterData = [
  { date: new Date(2024, 0, 1), sessions: 420 },
  { date: new Date(2024, 1, 1), sessions: 510 },
  { date: new Date(2024, 2, 1), sessions: 390 },
];
const barData = [
  { name: "A", v: 3 },
  { name: "B", v: 5 },
  { name: "C", v: 2 },
];

function scatter(extra: Record<string, unknown> = {}) {
  return render(
    <ScatterChart data={scatterData} tooltip={false} {...extra}>
      <Scatter dataKey="sessions" />
    </ScatterChart>,
  ).container.innerHTML;
}
function bar(extra: Record<string, unknown> = {}) {
  return render(
    <BarChart data={barData} tooltip={false} xDataKey="name" {...extra}>
      <Bar dataKey="v" />
    </BarChart>,
  ).container.innerHTML;
}
function line(extra: Record<string, unknown> = {}) {
  // No `Line` child: jsdom lacks `getTotalLength` (see line-chart.test.tsx).
  return render(
    <LineChart data={scatterData} tooltip={false} {...extra}>
      {null}
    </LineChart>,
  ).container.innerHTML;
}

describe("gesture props unset → DOM byte-identical (RM-142)", () => {
  it("ScatterChart", () => {
    expect(scatter()).toMatchSnapshot();
  });
  it("BarChart", () => {
    expect(bar()).toMatchSnapshot();
  });
  it("LineChart (time-series shell)", () => {
    expect(line()).toMatchSnapshot();
  });

  it("a gesture list without a handler mounts nothing", () => {
    const plainScatter = scatter();
    cleanup();
    expect(stripIds(scatter({ selectionGestures: ["rect"] }))).toBe(stripIds(plainScatter));
    cleanup();
    const plainBar = bar();
    cleanup();
    expect(stripIds(bar({ selectionGestures: ["rect"] }))).toBe(stripIds(plainBar));
  });
});

// RM-143/144: the three families that joined the engine, and the canvas layer.
const records = Array.from({ length: 12 }, (_, i) => ({
  id: `P${i}`,
  minutes: i * 10,
  ward: i % 2 ? "A" : "B",
}));
const cells = ["Mon", "Tue"].flatMap((day, d) =>
  ["08", "09", "10"].map((hour, h) => ({ day, hour, tickets: d * 3 + h })),
);
function distribution(extra: Record<string, unknown> = {}) {
  return render(
    <DistributionChart data={records} groupKey="ward" kind="strip" valueKey="minutes" {...extra} />,
  ).container.innerHTML;
}
function heatmap(extra: Record<string, unknown> = {}) {
  return render(<HeatmapChart data={cells} valueKey="tickets" x="hour" y="day" {...extra} />)
    .container.innerHTML;
}
function canvas(extra: Record<string, unknown> = {}) {
  return render(
    <CanvasLayer
      draw={() => {}}
      height={200}
      hitTest={() => null}
      points={records}
      width={400}
      {...extra}
    />,
  ).container.innerHTML;
}

describe("gesture props unset → DOM byte-identical (RM-143/144)", () => {
  it("DistributionChart", () => {
    const html = distribution();
    expect(html).not.toContain("chart-selection");
    expect(stripIds(html)).toMatchSnapshot();
  });
  it("HeatmapChart", () => {
    const html = heatmap();
    expect(html).not.toContain("chart-selection");
    expect(stripIds(html)).toMatchSnapshot();
  });
  it("CanvasLayer", () => {
    const html = canvas();
    expect(html).not.toContain("chart-selection");
    expect(stripIds(html)).toMatchSnapshot();
  });
  it("a gesture list without a handler (or, on a canvas, without `selectionMark`) mounts nothing", () => {
    const plain = [distribution(), heatmap(), canvas()].map(stripIds);
    cleanup();
    expect(stripIds(distribution({ selectionGestures: ["range", "lasso"] }))).toBe(plain[0]);
    cleanup();
    expect(stripIds(heatmap({ selectionGestures: ["range"] }))).toBe(plain[1]);
    cleanup();
    expect(stripIds(canvas({ selectionGestures: ["rect"], onSelectionIntent: () => {} }))).toBe(
      plain[2],
    );
  });
});

describe("gesture props set → the engine mounts inside the plot", () => {
  // jsdom ships no PointerEvent; a MouseEvent carrying the pointer fields is
  // what the engine reads.
  if (typeof window.PointerEvent === "undefined") {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? "mouse";
      }
    }
    Object.defineProperty(window, "PointerEvent", {
      value: PointerEventPolyfill,
      configurable: true,
    });
  }

  function drag(plot: Element, from: [number, number], to: [number, number], shift = false) {
    const base = { pointerId: 1, pointerType: "mouse", button: 0, shiftKey: shift };
    act(() => {
      fireEvent.pointerDown(plot, { ...base, clientX: from[0], clientY: from[1] });
      fireEvent.pointerMove(plot, { ...base, clientX: to[0], clientY: to[1] });
      fireEvent.pointerUp(plot, { ...base, clientX: to[0], clientY: to[1] });
    });
  }

  it("BarChart: a rect over the plot emits an intent with the band categories", () => {
    const onSelectionIntent = vi.fn<(intent: ChartSelectionIntent) => void>();
    const { container } = render(
      <BarChart
        data={barData}
        onSelectionIntent={onSelectionIntent}
        selectionGestures={["rect"]}
        xDataKey="name"
      >
        <Bar dataKey="v" />
      </BarChart>,
    );
    const layer = container.querySelector('[data-slot="chart-selection-gesture"]');
    expect(layer).not.toBeNull();
    // jsdom has no layout: plot pixels == client pixels. The whole plot.
    drag(layer?.parentElement as Element, [0, 0], [480, 208]);
    expect(onSelectionIntent).toHaveBeenCalledTimes(1);
    expect(onSelectionIntent.mock.calls[0]?.[0]).toMatchObject({
      field: "name",
      values: ["A", "B", "C"],
      mode: "replace",
      gesture: { kind: "rect" },
    });
  });

  it("ScatterChart: Shift+drag → add", () => {
    const onSelectionIntent = vi.fn<(intent: ChartSelectionIntent) => void>();
    const { container } = render(
      <ScatterChart
        data={scatterData}
        onSelectionIntent={onSelectionIntent}
        selectionGestures={["rect", "lasso"]}
      >
        <Scatter dataKey="sessions" />
      </ScatterChart>,
    );
    const layer = container.querySelector('[data-slot="chart-selection-gesture"]');
    drag(layer?.parentElement as Element, [0, 0], [480, 208], true);
    expect(onSelectionIntent.mock.calls[0]?.[0]).toMatchObject({ mode: "add", field: "date" });
    expect(onSelectionIntent.mock.calls[0]?.[0].values.length).toBeGreaterThan(0);
  });

  it("DistributionChart: a value-axis range resolves to the records' field values", () => {
    const onSelectionIntent = vi.fn<(intent: ChartSelectionIntent) => void>();
    const { container } = render(
      <DistributionChart
        data={records}
        groupKey="ward"
        kind="strip"
        onSelectionIntent={onSelectionIntent}
        selectionField="id"
        selectionGestures={["range", "lasso"]}
        valueKey="minutes"
      />,
    );
    // Host + controls + the hit area mount only now.
    expect(container.querySelector('[data-slot="chart-selection-gesture-host"]')).not.toBeNull();
    expect(
      container.querySelector('[data-slot="chart-selection-gesture-hit-area"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-slot="chart-selection-gesture-gutter-y"]')).toBeNull();
    const gutter = container.querySelector('[data-slot="chart-selection-gesture-gutter-x"]');
    const plotWidth = Number(gutter?.getAttribute("width"));
    // jsdom has no layout: plot pixels == client pixels. The left half of the value axis.
    drag(gutter as Element, [0, 260], [plotWidth / 2, 260]);
    expect(onSelectionIntent).toHaveBeenCalledTimes(1);
    const intent = onSelectionIntent.mock.calls[0]?.[0];
    expect(intent?.field).toBe("id");
    expect(intent?.gesture).toMatchObject({ kind: "range", axis: "x" });
    const hi = intent?.gesture.kind === "range" ? Number(intent.gesture.to) : 0;
    expect(intent?.values).toEqual(records.filter((r) => r.minutes <= hi).map((r) => r.id));
  });

  it("HeatmapChart: column range → hours; row range → days", () => {
    const onSelectionIntent = vi.fn<(intent: ChartSelectionIntent) => void>();
    const { container } = render(
      <HeatmapChart
        data={cells}
        onSelectionIntent={onSelectionIntent}
        selectionGestures={["range", "rect"]}
        valueKey="tickets"
        x="hour"
        y="day"
      />,
    );
    const gx = container.querySelector('[data-slot="chart-selection-gesture-gutter-x"]') as Element;
    const width = Number(gx.getAttribute("width"));
    const top = Number(gx.getAttribute("y"));
    drag(gx, [0, top + 4], [width * 0.4, top + 4]);
    expect(onSelectionIntent.mock.calls[0]?.[0]).toMatchObject({
      field: "hour",
      values: ["08", "09"],
    });
    const gy = container.querySelector('[data-slot="chart-selection-gesture-gutter-y"]') as Element;
    const height = Number(gy.getAttribute("height"));
    drag(gy, [-4, height * 0.6], [-4, height * 0.9]);
    expect(onSelectionIntent.mock.calls[1]?.[0]).toMatchObject({ field: "day", values: ["Tue"] });
    // The keyboard targets live in the host, outside the svg.
    const host = container.querySelector('[data-slot="chart-selection-gesture-host"]');
    expect(host?.querySelector('[data-slot="chart-selection-keyboard-rect"]')).not.toBeNull();
    expect(host?.querySelectorAll('[data-slot="chart-selection-range-trigger"]')).toHaveLength(2);
    expect(container.querySelector("svg [data-slot='chart-selection-keyboard-rect']")).toBeNull();
  });

  it("CanvasLayer: canvas points join the registry; a rect over them resolves", () => {
    const onSelectionIntent = vi.fn<(intent: ChartSelectionIntent) => void>();
    const { container } = render(
      <CanvasLayer
        draw={() => {}}
        height={200}
        hitTest={() => null}
        onSelectionIntent={onSelectionIntent}
        points={records}
        selectionField="id"
        selectionGestures={["rect"]}
        selectionMark={(r) => ({ x: r.minutes * 3, y: 100, category: r.id })}
        width={400}
      />,
    );
    const surface = container.querySelector("canvas") as Element;
    // x 0..150 → minutes 0..50.
    drag(surface, [0, 50], [150, 150]);
    expect(onSelectionIntent.mock.calls[0]?.[0]).toMatchObject({
      field: "id",
      values: ["P0", "P1", "P2", "P3", "P4", "P5"],
      gesture: { kind: "rect" },
    });
  });
});
