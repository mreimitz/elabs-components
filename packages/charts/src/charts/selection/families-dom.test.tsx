/**
 * RM-142 guarantee: with no `selectionGestures` / `onSelectionIntent` the
 * three wired families (ScatterChart, BarChart, the time-series shell via
 * LineChart) render byte-identical DOM. The snapshots were recorded against
 * the pre-RM-142 tree; a gesture prop set WITHOUT the handler must also mount
 * nothing (the layer needs both).
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
import { LineChart } from "../line-chart";
import { Scatter, ScatterChart } from "../scatter-chart";
import type { ChartSelectionIntent } from "./types";

afterEach(cleanup);

/** `useId` values differ per mount; compare structure, not the counter. */
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
    <ScatterChart data={scatterData} {...extra}>
      <Scatter dataKey="sessions" />
    </ScatterChart>,
  ).container.innerHTML;
}
function bar(extra: Record<string, unknown> = {}) {
  return render(
    <BarChart data={barData} xDataKey="name" {...extra}>
      <Bar dataKey="v" />
    </BarChart>,
  ).container.innerHTML;
}
function line(extra: Record<string, unknown> = {}) {
  // No `Line` child: jsdom lacks `getTotalLength` (see line-chart.test.tsx).
  return render(
    <LineChart data={scatterData} {...extra}>
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
});
