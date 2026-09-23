/**
 * `useChartInteraction` — touch handlers (#609).
 *
 * Two fixes: (1) no more `event.preventDefault()` inside `onTouchStart`/
 * `onTouchMove` — React attaches those root listeners as passive, so the
 * call was a no-op that only logged a browser console warning on every tap;
 * `interactionStyle`'s `touchAction: "none"` (unchanged) already blocks the
 * browser's default pan/pinch-zoom on the same element. (2) a touchstart now
 * commits its tooltip synchronously (`commitTooltipNow`, not the RAF-gated
 * `scheduleTooltip`) so a same-frame `touchend` — a 0ms synthetic tap
 * included — always reads live `tooltipData` for tap-to-pin (RM-119).
 *
 * `@visx/event`'s `localPoint` is stubbed to a plain client-coordinate
 * passthrough — real point/SVG-CTM geometry isn't under test here.
 */

import type { TouchEvent } from "react";
import { scaleLinear, scaleTime } from "@visx/scale";
import { act, renderHook } from "@testing-library/react";
import { bisector } from "d3-array";
import { describe, expect, it, vi } from "vitest";
import type { LineConfig } from "./chart-context";
import { useChartInteraction } from "./use-chart-interaction";

vi.mock("@visx/event", () => ({
  localPoint: (a: unknown, b?: unknown) => {
    const source = (b ?? a) as { clientX?: number; clientY?: number };
    return { x: source.clientX ?? 0, y: source.clientY ?? 0 };
  },
}));

const rows: Record<string, unknown>[] = [
  { date: new Date(2024, 0, 1), value: 10 },
  { date: new Date(2024, 0, 2), value: 20 },
];

function makeArgs() {
  const xAccessor = (d: Record<string, unknown>) => d.date as Date;
  return {
    xScale: scaleTime({ domain: [rows[0]?.date as Date, rows[1]?.date as Date], range: [0, 100] }),
    yScale: scaleLinear({ domain: [0, 20], range: [100, 0] }),
    yScales: {},
    data: rows,
    lines: [{ dataKey: "value", stroke: "red", strokeWidth: 2 }] satisfies LineConfig[],
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    xAccessor,
    bisectDate: bisector<Record<string, unknown>, Date>((d) => xAccessor(d)).left,
    canInteract: true,
  };
}

/** A minimal fake touch event — just enough for `getChartPoint`'s touch branch. */
function fakeTouchEvent(overrides: {
  touches: { clientX: number; clientY: number }[];
  preventDefault: () => void;
}): TouchEvent<SVGGElement> {
  return {
    currentTarget: { ownerSVGElement: {} },
    ...overrides,
  } as unknown as TouchEvent<SVGGElement>;
}

describe("useChartInteraction — touch (#609)", () => {
  it("never calls preventDefault on a single-touch start or move", () => {
    // `makeArgs()` is built ONCE, outside the render callback — the same
    // scale/array objects every render. Rebuilding fresh ones each render
    // would give `resolveTooltipFromX` a new identity every time, retrigger
    // the hook's xScale re-anchor effect on every commit, and loop forever.
    const args = makeArgs();
    const { result } = renderHook(() => useChartInteraction(args));
    const preventDefault = vi.fn();

    act(() => {
      result.current.interactionHandlers.onTouchStart?.(
        fakeTouchEvent({ touches: [{ clientX: 10, clientY: 10 }], preventDefault }),
      );
    });
    expect(preventDefault).not.toHaveBeenCalled();

    act(() => {
      result.current.interactionHandlers.onTouchMove?.(
        fakeTouchEvent({ touches: [{ clientX: 20, clientY: 10 }], preventDefault }),
      );
    });
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("never calls preventDefault on a two-finger pinch touch either", () => {
    const args = makeArgs();
    const { result } = renderHook(() => useChartInteraction(args));
    const preventDefault = vi.fn();

    act(() => {
      result.current.interactionHandlers.onTouchStart?.(
        fakeTouchEvent({
          touches: [
            { clientX: 10, clientY: 10 },
            { clientX: 30, clientY: 10 },
          ],
          preventDefault,
        }),
      );
    });
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("commits the tooltip synchronously on touchstart — a same-tick touchend (a 0ms tap) reads live data", () => {
    const args = makeArgs();
    const { result } = renderHook(() => useChartInteraction(args));

    act(() => {
      result.current.interactionHandlers.onTouchStart?.(
        fakeTouchEvent({ touches: [{ clientX: 50, clientY: 50 }], preventDefault: vi.fn() }),
      );
    });

    // No animation frame flushed — this is exactly the same-tick read a
    // `touchend` pin handler performs (`chart-tooltip.tsx`'s native
    // listener). Before the fix this raced `scheduleTooltip`'s RAF gate and
    // could still read `null` here.
    expect(result.current.tooltipData).not.toBeNull();
  });
});
