/**
 * Locks the three review fixes to MermaidDiagram:
 *
 * 1. Concurrent renders are serialized through `withMermaidLock` so two
 *    instances (or two overlapping theme changes) never interleave
 *    `mermaid.initialize()` (one shared module-level config) with a
 *    different instance's `mermaid.render()`.
 * 2. The render effect debounces on `chart`, so a rapidly-changing
 *    (streaming) source only triggers one real `mermaid.render()` call for
 *    the final value, not one per intermediate change.
 * 3. `downloadSvg()` defers `URL.revokeObjectURL` past the click (Safari).
 *
 * Isolated from `mermaid-diagram.test.tsx` because these tests need fake
 * timers and finer control over when each `mermaid.render()` call resolves,
 * which would otherwise fight that file's real-timer `waitFor` calls.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const callOrder: string[] = [];
let resolveFirstRender: (() => void) | undefined;

const initializeMock = vi.fn(() => {
  callOrder.push("initialize");
});

let renderStarts = 0;
let holdFirstRender = false;
const renderMock = vi.fn(async (id: string, chart: string) => {
  renderStarts += 1;
  const isFirst = holdFirstRender && renderStarts === 1;
  callOrder.push("render-start");
  if (isFirst) {
    await new Promise<void>((resolve) => {
      resolveFirstRender = resolve;
    });
  }
  callOrder.push("render-end");
  return { svg: `<svg data-id="${id}" data-chart="${chart}"></svg>` };
});

vi.mock("mermaid", () => ({
  default: { initialize: initializeMock, render: renderMock },
}));

import { MermaidDiagram } from "./mermaid-diagram";

beforeEach(() => {
  callOrder.length = 0;
  renderStarts = 0;
  holdFirstRender = false;
  resolveFirstRender = undefined;
  renderMock.mockClear();
  initializeMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("MermaidDiagram — serializes concurrent renders across instances (review finding)", () => {
  it("never starts a second instance's initialize before the first instance's render settles", async () => {
    holdFirstRender = true;
    vi.useFakeTimers();
    render(<MermaidDiagram chart={"graph TD; A-->B"} />);
    render(<MermaidDiagram chart={"graph TD; C-->D"} />);

    // Fire both debounce timers; only the FIRST queued render should have
    // started — the second instance's `initialize` must wait for it.
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(callOrder).toEqual(["initialize", "render-start"]);

    // Let the first render settle; the queue should now release the second.
    resolveFirstRender?.();
    await act(() => vi.advanceTimersByTimeAsync(0));
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(callOrder).toEqual([
      "initialize",
      "render-start",
      "render-end",
      "initialize",
      "render-start",
      "render-end",
    ]);
  });
});

describe("MermaidDiagram — debounces re-rendering while the source is changing (review finding)", () => {
  it("only renders once, for the final chart value, across rapid successive changes", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<MermaidDiagram chart={"graph TD; A-->B"} />);
    rerender(<MermaidDiagram chart={"graph TD; A-->C"} />);
    rerender(<MermaidDiagram chart={"graph TD; A-->D"} />);

    // Just under the debounce window: nothing has rendered yet.
    await act(() => vi.advanceTimersByTimeAsync(299));
    expect(renderMock).not.toHaveBeenCalled();

    // Past the window: exactly one render, for the last value only.
    await act(() => vi.advanceTimersByTimeAsync(50));
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledWith(expect.any(String), "graph TD; A-->D");
  });
});

describe("MermaidDiagram — defers revoking the download object URL (review finding)", () => {
  it("does not call URL.revokeObjectURL synchronously after the download click", async () => {
    render(<MermaidDiagram chart={"graph TD; A-->B"} label="Flow" />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Download diagram as SVG" })).toBeInTheDocument(),
    );

    vi.useFakeTimers();
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    const revokeSpy = vi.fn();
    global.URL.revokeObjectURL = revokeSpy;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    fireEvent.click(screen.getByRole("button", { name: "Download diagram as SVG" }));

    // Not revoked synchronously — the click handler must have returned first.
    expect(revokeSpy).not.toHaveBeenCalled();
    act(() => vi.runAllTimers());
    expect(revokeSpy).toHaveBeenCalledWith("blob:mock");

    clickSpy.mockRestore();
  });
});
