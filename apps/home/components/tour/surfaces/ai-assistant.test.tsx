// @vitest-environment jsdom
/**
 * Locks issue 535: the AI-assistant tour surface's streamed reply never told
 * `<Conversation>` it was streaming, so its `role="log"` live region stayed
 * `aria-live="polite"` for the whole reveal instead of suppressing itself
 * (`packages/ai/src/conversation.tsx`'s documented `isStreaming` contract).
 *
 * The reveal is driven by a `requestAnimationFrame` loop (`useStreamedText` in
 * `ai-assistant.tsx`), so `requestAnimationFrame`/`performance.now` are stubbed
 * to step the animation deterministically instead of racing a real frame.
 *
 * `@elabs-ai/components-charts` is mocked out: the artifact chart isn't part of
 * this contract and its real render pulls in `@visx/responsive`/ResizeObserver
 * plumbing this file has no reason to carry (`auto-chart.test.tsx` already
 * covers real chart rendering). `use-stick-to-bottom` (under `Conversation`)
 * does construct a real `ResizeObserver` unconditionally, so that one IS
 * stubbed here.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

vi.mock("@elabs-ai/components-charts", () => ({
  AutoChart: ({ spec }: { spec: { title?: string } }) => (
    <div data-testid="mock-auto-chart">{spec.title}</div>
  ),
}));

import { AiAssistantSurface } from "./ai-assistant";

if (typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

/** Steered rAF queue: tests advance the streamed reveal frame-by-frame instead of racing real time. */
let rafCallbacks: FrameRequestCallback[] = [];
let now = 0;

function flushFrame(elapsedMs: number) {
  now += elapsedMs;
  const pending = rafCallbacks;
  rafCallbacks = [];
  act(() => {
    pending.forEach((cb) => cb(now));
  });
}

beforeEach(() => {
  rafCallbacks = [];
  now = 0;
  window.sessionStorage.clear();
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  vi.spyOn(performance, "now").mockImplementation(() => now);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AiAssistantSurface", () => {
  it("suppresses the log region's aria-live mid-stream and restores it once the reveal settles", () => {
    render(<AiAssistantSurface />);
    const log = screen.getByRole("log");

    // Halfway through the 1200ms reveal: still arriving, so the live region must be suppressed.
    // (Other mounted rAF consumers — e.g. `use-stick-to-bottom`'s own scroll sync — share this
    // stepped queue too; flushing them alongside the streamed-text tick is harmless.)
    flushFrame(600);
    expect(log).toHaveAttribute("aria-live", "off");
    expect(log).toHaveAttribute("aria-busy", "true");

    // Past STREAM_MS: the reveal is done, so the live region returns to its normal contract.
    flushFrame(700);
    expect(log).toHaveAttribute("aria-live", "polite");
    expect(log).not.toHaveAttribute("aria-busy");
  });
});
