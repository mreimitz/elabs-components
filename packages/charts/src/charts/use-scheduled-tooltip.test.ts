/**
 * `useScheduledTooltip` — the RAF-gated commit and its synchronous escape
 * hatch, `commitTooltipNow` (#609).
 *
 * `scheduleTooltip` coalesces a continuous pointer stream (mousemove,
 * touchmove) to one commit per animation frame — right for those, wrong for
 * a single discrete event. `use-chart-interaction.ts`'s touchstart handler
 * used `scheduleTooltip` for the first touch too, so a same-frame `touchend`
 * (a 0ms synthetic tap, Playwright's `touchscreen.tap()`) could read a still
 * `null`/stale `tooltipData` a beat before the RAF fired — racing tap-to-pin
 * (`use-tooltip-pin.ts`, RM-119). `commitTooltipNow` commits synchronously,
 * cancelling any pending RAF first, so a discrete event's tooltip is always
 * live by the time the very next synchronous read happens.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useScheduledTooltip } from "./use-scheduled-tooltip";

interface Point {
  index: number;
  x: number;
}

/** Flush one real `requestAnimationFrame` tick (jsdom polyfills it). */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

describe("useScheduledTooltip", () => {
  it("scheduleTooltip defers the commit past the current synchronous tick", async () => {
    const { result } = renderHook(() => useScheduledTooltip<Point>());

    act(() => {
      result.current.scheduleTooltip({ index: 0, x: 10 });
    });
    // Not committed yet — this is exactly the window a same-frame
    // `touchend` used to race (#609).
    expect(result.current.tooltipData).toBeNull();

    await act(() => nextFrame());
    expect(result.current.tooltipData).toEqual({ index: 0, x: 10 });
  });

  it("commitTooltipNow commits synchronously, with nothing to race", () => {
    const { result } = renderHook(() => useScheduledTooltip<Point>());

    act(() => {
      result.current.commitTooltipNow({ index: 0, x: 10 });
    });
    // No frame flush needed — a same-tick read already sees it.
    expect(result.current.tooltipData).toEqual({ index: 0, x: 10 });
  });

  it("commitTooltipNow cancels a pending scheduled commit instead of racing it", async () => {
    const { result } = renderHook(() => useScheduledTooltip<Point>());

    act(() => {
      result.current.scheduleTooltip({ index: 0, x: 10 });
      result.current.commitTooltipNow({ index: 1, x: 20 });
    });
    expect(result.current.tooltipData).toEqual({ index: 1, x: 20 });

    // The RAF `scheduleTooltip` queued was cancelled — it must not land a
    // stale commit on top of the immediate one once the frame fires.
    await act(() => nextFrame());
    expect(result.current.tooltipData).toEqual({ index: 1, x: 20 });
  });
});
