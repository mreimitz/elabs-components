import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { discoverGraph } from "../core/discover-graph";
import { extractVariants } from "../core/extract-variants";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import { segmentKey } from "../core/segments";
import type { EventLog, EventRow } from "../core/types";
import { PerformanceSpectrum } from "./performance-spectrum";

afterEach(cleanup);

// jsdom has no PointerEvent, so `fireEvent.pointer*` would build a bare Event with no
// `clientX`/`pointerId`. A MouseEvent subclass carrying `pointerId` is enough here.
beforeAll(() => {
  if (typeof window.PointerEvent === "undefined") {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
      }
    }
    window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
  }
});

const H = 3_600_000;

function kase(caseId: string, offset: number, waits: [number, number]): EventRow[] {
  const t0 = offset * H;
  return [
    { caseId, activity: "A", timestamp: t0 },
    { caseId, activity: "B", timestamp: t0 + waits[0] * H },
    { caseId, activity: "C", timestamp: t0 + (waits[0] + waits[1]) * H },
  ];
}

/** Four cases A → B → C, starting an hour apart; domain is 0 h … 10 h. */
const LOG: EventLog = {
  events: [
    ...kase("c1", 0, [1, 1]),
    ...kase("c2", 1, [1, 2]),
    ...kase("c3", 2, [2, 2]),
    ...kase("c4", 6, [2, 2]),
  ],
};

const ORDER = [
  { from: "A", to: "B" },
  { from: "B", to: "C" },
];

describe("PerformanceSpectrum — rendering", () => {
  it("renders one named canvas row per segment, with a parallel summary", () => {
    render(<PerformanceSpectrum log={LOG} order={ORDER} />);
    const view = screen.getByRole("group", { name: "Performance spectrum" });
    expect(within(view).getByRole("group", { name: "A → B" })).toBeInTheDocument();
    expect(within(view).getByRole("group", { name: "B → C" })).toHaveAccessibleDescription(
      /4 occurrences across 4 cases/,
    );
    // One keyboard cursor per row: Tab moves row by row.
    expect(view.querySelectorAll('[data-slot="canvas-layer-cursor"]')).toHaveLength(2);
  });

  it("defaults to the busiest transitions and honours segmentLimit", () => {
    const log = generateSyntheticLog({ cases: 60, seed: 5 });
    const graph = discoverGraph(log);
    const { container } = render(<PerformanceSpectrum log={log} segmentLimit={3} />);
    const rows = container.querySelectorAll('[data-slot="performance-spectrum-row"]');
    expect(rows).toHaveLength(3);
    const first = graph.transitions[0]!;
    expect(
      screen.getByRole("group", { name: `${first.source} → ${first.target}` }),
    ).toBeInTheDocument();
  });

  it("derives rows from one variant's path", () => {
    const [variant] = extractVariants(LOG);
    render(<PerformanceSpectrum log={LOG} order={{ variantId: variant!.id }} />);
    expect(screen.getByRole("group", { name: "A → B" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "B → C" })).toBeInTheDocument();
  });

  it("marks a row touched by the selection in its accessible name", () => {
    render(
      <PerformanceSpectrum
        log={LOG}
        order={ORDER}
        selection={{ kind: "transition", id: segmentKey("B", "C") }}
      />,
    );
    expect(screen.getByRole("group", { name: "B → C, selected" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "A → B" })).toBeInTheDocument();
  });

  it("renders the loading and empty panels", () => {
    const { rerender, container } = render(<PerformanceSpectrum log={LOG} loading />);
    expect(container.querySelector('[data-state="loading"]')).not.toBeNull();
    rerender(<PerformanceSpectrum log={LOG} order={[{ from: "C", to: "A" }]} />);
    expect(screen.getByText("No segment occurrences")).toBeInTheDocument();
  });

  it("renders the table twin with cases, median and p90 per segment", () => {
    render(<PerformanceSpectrum log={LOG} order={ORDER} tableView />);
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent("A → B");
    expect(rows[1]).toHaveTextContent("4");
  });

  it("renders aggregated mode as one cursor stop per row over bins", () => {
    const { container } = render(
      <PerformanceSpectrum log={LOG} order={ORDER} mode="aggregated" binSize={2 * H} />,
    );
    expect(container.querySelector('[data-mode="aggregated"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-slot="canvas-layer-cursor"]')).toHaveLength(2);
  });
});

describe("PerformanceSpectrum — interaction", () => {
  function mockTrack(el: Element) {
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 1000,
      height: 32,
      right: 1000,
      bottom: 32,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  }

  it("brushing the time axis emits one cases intent with every overlapping case", () => {
    const onFilterIntent = vi.fn();
    render(<PerformanceSpectrum log={LOG} order={ORDER} onFilterIntent={onFilterIntent} />);
    const axis = screen.getByRole("group", { name: "Time range" });
    mockTrack(axis);

    // Domain 0 h … 10 h over 1000 px: drag 0 → 150 px covers 0 h … 1.5 h.
    fireEvent.pointerDown(axis, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(axis, { pointerId: 1, clientX: 100 });
    fireEvent.pointerUp(axis, { pointerId: 1, clientX: 150 });

    expect(onFilterIntent).toHaveBeenCalledTimes(1);
    expect(onFilterIntent).toHaveBeenCalledWith({ kind: "cases", ids: ["c1", "c2"] });
  });

  it("a click without travel clears instead of filtering", () => {
    const onFilterIntent = vi.fn();
    render(<PerformanceSpectrum log={LOG} order={ORDER} onFilterIntent={onFilterIntent} />);
    const axis = screen.getByRole("group", { name: "Time range" });
    mockTrack(axis);
    fireEvent.pointerDown(axis, { pointerId: 1, clientX: 400 });
    fireEvent.pointerUp(axis, { pointerId: 1, clientX: 401 });
    expect(onFilterIntent).not.toHaveBeenCalled();
  });

  it("brushes from the keyboard with Shift+Arrow and Enter", () => {
    const onFilterIntent = vi.fn();
    render(<PerformanceSpectrum log={LOG} order={ORDER} onFilterIntent={onFilterIntent} />);
    const axis = screen.getByRole("group", { name: "Time range" });
    act(() => axis.focus());
    // End jumps to 10 h; Shift+PageDown ×2 extends back 2.5 h to 7.5 h.
    fireEvent.keyDown(axis, { key: "End" });
    fireEvent.keyDown(axis, { key: "PageDown", shiftKey: true });
    fireEvent.keyDown(axis, { key: "PageDown", shiftKey: true });
    const status = document.querySelector('[data-slot="performance-spectrum-brush-status"]');
    expect(status?.textContent).toMatch(/1 cases$/);
    fireEvent.keyDown(axis, { key: "Enter" });
    expect(onFilterIntent).toHaveBeenCalledWith({ kind: "cases", ids: ["c4"] });
  });

  it("activating a row's cursor selects the focused occurrence's case", () => {
    const onCaseSelect = vi.fn();
    const { container } = render(
      <PerformanceSpectrum log={LOG} order={ORDER} onCaseSelect={onCaseSelect} />,
    );
    const cursor = container.querySelector(
      '[data-slot="canvas-layer-cursor"]',
    ) as HTMLButtonElement;
    act(() => cursor.focus());
    fireEvent.keyDown(cursor, { key: "ArrowRight" });
    fireEvent.click(cursor);
    expect(onCaseSelect).toHaveBeenCalledWith("c2", expect.objectContaining({ caseId: "c2" }));
  });
});
