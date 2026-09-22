import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardPresentation } from "./dashboard-presentation";

function sheetViews(n: number) {
  return Array.from({ length: n }, (_, i) => <div key={i}>Sheet {i + 1}</div>);
}

describe("DashboardPresentation", () => {
  beforeEach(() => {
    // `shouldAdvanceTime` keeps the fake clock ticking in step with real time so React's own
    // scheduler (a real `setTimeout` fallback in jsdom) is never left waiting on a fake timer
    // nothing advances — plain `vi.useFakeTimers()` hangs `userEvent`'s click/keyboard helpers
    // indefinitely for exactly that reason (see navigation-menu.test.tsx).
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("advances to the next sheet on cycleMs, wrapping around", () => {
    render(<DashboardPresentation sheets={sheetViews(3)} cycleMs={3000} />);
    expect(screen.getByText("Sheet 1")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText("Sheet 2")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText("Sheet 3")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText("Sheet 1")).toBeInTheDocument();
  });

  it("Escape calls onExit", async () => {
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    const onExit = vi.fn();
    render(<DashboardPresentation onExit={onExit}>{sheetViews(1)[0]}</DashboardPresentation>);
    await user.keyboard("{Escape}");
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("the Exit presentation button also calls onExit", async () => {
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    const onExit = vi.fn();
    render(<DashboardPresentation onExit={onExit}>{sheetViews(1)[0]}</DashboardPresentation>);
    await user.click(screen.getByRole("button", { name: "Exit presentation" }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("calls onRefresh on refreshMs's schedule and stops once unmounted", () => {
    const onRefresh = vi.fn();
    const { unmount } = render(
      <DashboardPresentation refreshMs={5000} onRefresh={onRefresh}>
        {sheetViews(1)[0]}
      </DashboardPresentation>,
    );
    act(() => vi.advanceTimersByTime(5000));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(5000));
    expect(onRefresh).toHaveBeenCalledTimes(2);
    unmount();
    act(() => vi.advanceTimersByTime(20000));
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it("pauses auto-advance while the pointer is over the surface", () => {
    render(<DashboardPresentation sheets={sheetViews(2)} cycleMs={1000} />);
    const root = document.querySelector('[data-slot="dashboard-presentation"]') as HTMLElement;
    // `fireEvent.mouseEnter` (not a raw `dispatchEvent`) — React's enter/leave plugin
    // synthesizes `onMouseEnter` from native `mouseover` bubbling, and testing-library's
    // helper reproduces that, unlike a directly dispatched, non-bubbling `mouseenter`.
    act(() => {
      fireEvent.mouseEnter(root);
    });
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("Sheet 1")).toBeInTheDocument();
  });

  it("renders no progress dots and no cycling for a single sheet", () => {
    render(<DashboardPresentation cycleMs={1000}>{sheetViews(1)[0]}</DashboardPresentation>);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("omits the Present button when the runtime has no Fullscreen API (jsdom, some browsers)", () => {
    // jsdom does not implement `requestFullscreen` — this exercises the real guard, not a stub.
    expect(document.documentElement.requestFullscreen).toBeUndefined();
    render(<DashboardPresentation>{sheetViews(1)[0]}</DashboardPresentation>);
    expect(screen.queryByRole("button", { name: "Present" })).toBeNull();
    // The accessible exit control is never gated on the Fullscreen API.
    expect(screen.getByRole("button", { name: "Exit presentation" })).toBeInTheDocument();
  });

  it("requests fullscreen from the Present button when the API exists", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Element.prototype.requestFullscreen = requestFullscreen;
    try {
      const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
      render(<DashboardPresentation>{sheetViews(1)[0]}</DashboardPresentation>);
      await user.click(screen.getByRole("button", { name: "Present" }));
      expect(requestFullscreen).toHaveBeenCalledTimes(1);
    } finally {
      // @ts-expect-error — jsdom never had this in the first place; put it back to "absent".
      delete Element.prototype.requestFullscreen;
    }
  });
});
