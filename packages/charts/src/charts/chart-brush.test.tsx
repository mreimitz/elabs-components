/**
 * ChartBrush — the controlled `selection` prop (RM-169, F35).
 *
 * `selection` was documented ("when set, a visible selection rect is drawn") but
 * destructured as `_selection` and ignored. Rendered through `LineChart` (real
 * `ChartProvider`), with `ParentSize` pinned so the plot has a real width; `Line`
 * is omitted (it calls `getTotalLength()`, which jsdom lacks) — the brush needs
 * only the shell's x scale.
 */

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-use-measure", () => ({
  default: () => [() => undefined, { width: 560, height: 288 }],
}));

// @visx/responsive measures with ResizeObserver + real layout, which jsdom lacks.
vi.mock("./chart-parent-size", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ChartParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) => React.createElement("div", null, children({ width: 560, height: 288 })),
  };
});

import { ChartBrush, type ChartBrushSelection } from "./chart-brush";
import { LineChart } from "./line-chart";

afterEach(cleanup);

const data = [
  { date: new Date("2024-01-01"), visits: 186 },
  { date: new Date("2024-02-01"), visits: 305 },
  { date: new Date("2024-03-01"), visits: 237 },
  { date: new Date("2024-04-01"), visits: 73 },
  { date: new Date("2024-05-01"), visits: 209 },
];

const FEB_TO_MAR: ChartBrushSelection = {
  start: new Date("2024-02-01"),
  end: new Date("2024-03-01"),
};
const MAR_TO_MAY: ChartBrushSelection = {
  start: new Date("2024-03-01"),
  end: new Date("2024-05-01"),
};

function selectionRect(container: HTMLElement): SVGRectElement {
  const rect = container.querySelector<SVGRectElement>(".visx-brush-selection");
  expect(rect).not.toBeNull();
  return rect as SVGRectElement;
}

/** The drawn window as fractions of the plot width, so the test never hard-codes margins. */
function drawnWindow(container: HTMLElement): { from: number; to: number } {
  const stage = container.querySelector(".visx-brush-overlay");
  expect(stage).not.toBeNull();
  const stageWidth = Number(stage!.getAttribute("width"));
  const rect = selectionRect(container);
  const x = Number(rect.getAttribute("x"));
  const width = Number(rect.getAttribute("width"));
  return { from: x / stageWidth, to: (x + width) / stageWidth };
}

/** Where a date falls along the data's time span, 0..1. */
function fractionOf(date: Date): number {
  const first = data[0]!.date.getTime();
  const last = data[data.length - 1]!.date.getTime();
  return (date.getTime() - first) / (last - first);
}

function renderBrush(props: React.ComponentProps<typeof ChartBrush>) {
  return render(
    <LineChart animationDuration={0} data={data} xDataKey="date">
      <ChartBrush {...props} />
    </LineChart>,
  );
}

describe("ChartBrush selection (controlled)", () => {
  it("draws the controlled window", () => {
    const { container } = renderBrush({ selection: FEB_TO_MAR });
    const drawn = drawnWindow(container);
    expect(drawn.from).toBeCloseTo(fractionOf(FEB_TO_MAR.start), 2);
    expect(drawn.to).toBeCloseTo(fractionOf(FEB_TO_MAR.end), 2);
  });

  it("wins over initialSelection", () => {
    const { container } = renderBrush({ initialSelection: FEB_TO_MAR, selection: MAR_TO_MAY });
    const drawn = drawnWindow(container);
    expect(drawn.from).toBeCloseTo(fractionOf(MAR_TO_MAY.start), 2);
    expect(drawn.to).toBeCloseTo(fractionOf(MAR_TO_MAY.end), 2);
  });

  it("redraws when the parent changes the selection, and clears on null", () => {
    const { container, rerender } = renderBrush({ selection: FEB_TO_MAR });
    rerender(
      <LineChart animationDuration={0} data={data} xDataKey="date">
        <ChartBrush selection={MAR_TO_MAY} />
      </LineChart>,
    );
    const moved = drawnWindow(container);
    expect(moved.from).toBeCloseTo(fractionOf(MAR_TO_MAY.start), 2);
    expect(moved.to).toBeCloseTo(fractionOf(MAR_TO_MAY.end), 2);

    rerender(
      <LineChart animationDuration={0} data={data} xDataKey="date">
        <ChartBrush selection={null} />
      </LineChart>,
    );
    expect(Number(selectionRect(container).getAttribute("width"))).toBe(0);
  });

  it("keeps the mounted brush when the parent echoes the brush's own report", () => {
    const onSelectionChange = vi.fn();
    function Controlled() {
      const [selection, setSelection] = useState<ChartBrushSelection | null>(FEB_TO_MAR);
      return (
        <LineChart animationDuration={0} data={data} xDataKey="date">
          <ChartBrush
            onSelectionChange={(next) => {
              onSelectionChange(next);
              setSelection(next);
            }}
            selection={selection}
          />
        </LineChart>
      );
    }
    const { container } = render(<Controlled />);
    const before = selectionRect(container);
    expect(Number(before.getAttribute("width"))).toBeGreaterThan(0);

    // A double-click on the stage clears the brush; the brush reports `null`, the
    // parent hands `null` back, and the brush must NOT remount for its own echo.
    act(() => {
      fireEvent.doubleClick(container.querySelector(".visx-brush-overlay")!);
    });
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
    const after = selectionRect(container);
    expect(after).toBe(before);
    expect(Number(after.getAttribute("width"))).toBe(0);
  });

  it("redraws a parent value that matches an older report once the parent moved on", () => {
    // The brush reports `null`, the parent then moves the window elsewhere, then sets
    // `null` again (a Clear button). That `null` is no longer the brush's echo — the
    // brush draws MAR_TO_MAY by then — so it must redraw, not keep the old window.
    let setFromParent: (next: ChartBrushSelection | null) => void = () => undefined;
    function Controlled() {
      const [selection, setSelection] = useState<ChartBrushSelection | null>(FEB_TO_MAR);
      setFromParent = setSelection;
      return (
        <LineChart animationDuration={0} data={data} xDataKey="date">
          <ChartBrush onSelectionChange={setSelection} selection={selection} />
        </LineChart>
      );
    }
    const { container } = render(<Controlled />);

    act(() => {
      fireEvent.doubleClick(container.querySelector(".visx-brush-overlay")!);
    });
    expect(Number(selectionRect(container).getAttribute("width"))).toBe(0);

    act(() => setFromParent(MAR_TO_MAY));
    const moved = drawnWindow(container);
    expect(moved.from).toBeCloseTo(fractionOf(MAR_TO_MAY.start), 2);
    expect(moved.to).toBeCloseTo(fractionOf(MAR_TO_MAY.end), 2);

    act(() => setFromParent(null));
    expect(Number(selectionRect(container).getAttribute("width"))).toBe(0);
  });

  it("leaves an uncontrolled brush on initialSelection", () => {
    const { container } = renderBrush({ initialSelection: FEB_TO_MAR });
    const drawn = drawnWindow(container);
    expect(drawn.from).toBeCloseTo(fractionOf(FEB_TO_MAR.start), 2);
    expect(drawn.to).toBeCloseTo(fractionOf(FEB_TO_MAR.end), 2);
  });
});
