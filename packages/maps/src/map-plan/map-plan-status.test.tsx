import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MapPlanStatus } from "./map-plan-status";

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("MapPlanStatus", () => {
  it("is one polite live region, silent on screen by default", () => {
    render(<MapPlanStatus message="Nothing selected" />);

    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("Nothing selected");
    expect(region.className).toContain("sr-only");
  });

  it("says the first message straight away", () => {
    const { rerender } = render(<MapPlanStatus message="Nothing selected" />);
    rerender(<MapPlanStatus message="Cell A1 selected" />);

    expect(screen.getByRole("status")).toHaveTextContent("Cell A1 selected");
  });

  it("coalesces a burst into one sentence, the newest one", () => {
    const { rerender } = render(<MapPlanStatus message="idle" coalesceMs={2000} />);
    rerender(<MapPlanStatus message="Cell A1 stopped" />);
    expect(screen.getByRole("status")).toHaveTextContent("Cell A1 stopped");

    // Three changes inside the quiet window: the region must not read all three.
    rerender(<MapPlanStatus message="Cell A2 stopped" />);
    rerender(<MapPlanStatus message="Cell A3 stopped" />);
    rerender(<MapPlanStatus message="Cell A4 stopped" />);
    expect(screen.getByRole("status")).toHaveTextContent("Cell A1 stopped");

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Cell A4 stopped");
  });

  it("drops a pending announcement when it unmounts", () => {
    const { rerender, unmount } = render(<MapPlanStatus message="idle" />);
    rerender(<MapPlanStatus message="first" />);
    rerender(<MapPlanStatus message="second" />);

    unmount();

    // A timer that fires after teardown would set state on a gone component.
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(4000);
      });
    }).not.toThrow();
  });

  it("can also be shown, for a readout beside the plan", () => {
    render(<MapPlanStatus message="Cell A1 selected" visible />);

    const region = screen.getByRole("status");
    expect(region.className).not.toContain("sr-only");
    expect(region).toHaveTextContent("Cell A1 selected");
  });
});
