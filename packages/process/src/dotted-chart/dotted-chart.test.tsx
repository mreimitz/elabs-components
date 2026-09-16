import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import type { EventLog } from "../core/types";
import { computeDots } from "./compute-dots";
import { DottedChart } from "./dotted-chart";

const PLOT = { width: 600, height: 300 };

// jsdom has no layout: give every element a fixed box so the plot measures and mounts
// its canvas layer. The canvas itself has no 2D context under jsdom, which is fine — these
// tests exercise the keyboard, brush and text channels, not pixels.
const originalRect = HTMLElement.prototype.getBoundingClientRect;
beforeAll(() => {
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: PLOT.width,
      bottom: PLOT.height,
      width: PLOT.width,
      height: PLOT.height,
      toJSON: () => ({}),
    }) as DOMRect;
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  // jsdom ships no PointerEvent; without one `fireEvent.pointer*` drops clientX/pointerId.
  if (typeof window.PointerEvent !== "function") {
    class PointerEventShim extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
      }
    }
    window.PointerEvent = PointerEventShim as unknown as typeof PointerEvent;
  }
});
afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = originalRect;
});
afterEach(cleanup);

const log: EventLog = generateSyntheticLog({ cases: 12, seed: 11 });
const rows = computeDots(log).rows;

function cursor() {
  return screen.getByRole("button", { name: /dotted chart/i });
}

describe("DottedChart — rendering", () => {
  it("states the case and event counts in the parallel summary", () => {
    render(<DottedChart log={log} />);
    expect(screen.getByText(new RegExp(`^${rows.length} cases and \\d+ events`))).toBeTruthy();
  });

  it("renders a legend entry for each activity present", () => {
    const { container } = render(<DottedChart log={log} />);
    const legend = container.querySelector('[data-slot="dotted-chart-legend"]');
    expect(legend?.textContent).toContain(log.events[0]!.activity);
  });

  it("renders the empty panel when the log has no events", () => {
    render(<DottedChart log={{ events: [] }} />);
    expect(screen.getByText("No events")).toBeTruthy();
  });

  it("renders the table twin with one row per case", () => {
    render(<DottedChart log={log} tableView />);
    const table = screen.getByRole("table");
    // header row + one row per case
    expect(table.querySelectorAll("tr")).toHaveLength(rows.length + 1);
    expect(screen.getByRole("columnheader", { name: "Duration" })).toBeTruthy();
  });

  it("marks selected cases in the table twin with text, not colour alone", () => {
    render(<DottedChart log={log} tableView selectedCaseIds={[rows[0]!.caseId]} />);
    expect(screen.getByRole("columnheader", { name: "State" })).toBeTruthy();
    expect(screen.getByText("selected")).toBeTruthy();
  });
});

describe("DottedChart — keyboard", () => {
  it("moves by case row in sort order and selects with Enter", () => {
    const onSelect = vi.fn();
    render(<DottedChart log={log} sort="duration" onSelect={onSelect} />);
    const sorted = computeDots(log, { sort: "duration" }).rows;
    const button = cursor();
    fireEvent.focus(button);
    fireEvent.keyDown(button, { key: "ArrowDown" });
    expect(screen.getByRole("status").textContent).toContain(`Case ${sorted[1]!.caseId}`);
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith([sorted[1]!.caseId]);
  });

  it("extends a range with Shift+Arrow and commits it as one filter intent", () => {
    const onSelect = vi.fn();
    const onFilterIntent = vi.fn();
    render(<DottedChart log={log} onSelect={onSelect} onFilterIntent={onFilterIntent} />);
    const button = cursor();
    fireEvent.focus(button);
    fireEvent.keyDown(button, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(button, { key: "ArrowDown", shiftKey: true });
    const expected = rows.slice(0, 3).map((row) => row.caseId);
    expect(onSelect).toHaveBeenLastCalledWith(expected);
    fireEvent.click(button);
    expect(onFilterIntent).toHaveBeenCalledTimes(1);
    expect(onFilterIntent).toHaveBeenCalledWith({ kind: "cases", ids: expected });
  });
});

describe("DottedChart — brush", () => {
  it("emits one filter intent with every brushed case, in rows order", () => {
    const big = generateSyntheticLog({ cases: 200, seed: 9 });
    const bigRows = computeDots(big).rows;
    const onSelect = vi.fn();
    const onFilterIntent = vi.fn();
    const { container } = render(
      <DottedChart log={big} onSelect={onSelect} onFilterIntent={onFilterIntent} />,
    );
    const plot = container.querySelector('[data-slot="dotted-chart-plot"]') as HTMLElement;
    fireEvent.pointerDown(plot, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(plot, { pointerId: 1, clientX: 300, clientY: 150 });
    fireEvent.pointerMove(plot, { pointerId: 1, clientX: PLOT.width, clientY: PLOT.height });
    expect(container.querySelector('[data-slot="dotted-chart-brush"]')).not.toBeNull();
    fireEvent.pointerUp(plot, { pointerId: 1, clientX: PLOT.width, clientY: PLOT.height });

    const expected = bigRows.map((row) => row.caseId);
    expect(onFilterIntent).toHaveBeenCalledTimes(1);
    expect(onFilterIntent).toHaveBeenCalledWith({ kind: "cases", ids: expected });
    expect(onSelect).toHaveBeenCalledWith(expected);
    expect(container.querySelector('[data-slot="dotted-chart-brush"]')).toBeNull();
  });
});
