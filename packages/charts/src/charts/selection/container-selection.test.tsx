/**
 * RM-145: the session + chrome wired through a real container (BarChart) and a
 * real `ChartFrame` — explicit accumulation with provisional paint, the
 * toolbar's placement (raw container / frame action row / `"none"`), and a
 * keyboard datapoint activation feeding the session.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

import { ChartFrame } from "../../chart-frame/chart-frame";
import { Bar } from "../bar";
import { BarChart } from "../bar-chart";
import { countHostSelected } from "./container-selection";
import type { ChartSelectionIntent, ChartSelectionIntentHandler } from "./types";

afterEach(cleanup);

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

const data = [
  { name: "A", v: 3 },
  { name: "B", v: 5 },
  { name: "C", v: 2 },
  { name: "D", v: 4 },
];

function drag(plot: Element, from: [number, number], to: [number, number]) {
  const base = { pointerId: 1, pointerType: "mouse", button: 0 };
  act(() => {
    fireEvent.pointerDown(plot, { ...base, clientX: from[0], clientY: from[1] });
    fireEvent.pointerMove(plot, { ...base, clientX: to[0], clientY: to[1] });
    fireEvent.pointerUp(plot, { ...base, clientX: to[0], clientY: to[1] });
  });
}

function plotOf(container: HTMLElement) {
  return container.querySelector('[data-slot="chart-selection-gesture"]')!.parentElement!;
}

function bars(extra: Record<string, unknown> = {}) {
  return (
    <BarChart data={data} selectionGestures={["rect"]} xDataKey="name" {...extra}>
      <Bar dataKey="v" />
    </BarChart>
  );
}

describe("a raw container", () => {
  it("renders the toolbar above the plot inside its own root", () => {
    const { container } = render(bars({ onSelectionIntent: vi.fn() }));
    const root = container.querySelector('[data-slot="chart-selection-root"]')!;
    expect(root.firstElementChild).toHaveAttribute("data-slot", "chart-selection-toolbar");
    expect(screen.getByRole("radio", { name: "Rectangle" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("immediate: the count is what the host paints, and clears when the host clears", () => {
    const selected = (picks: string[]) => (category: unknown) =>
      picks.includes(String(category)) ? ("selected" as const) : ("excluded" as const);
    const { container, rerender } = render(
      bars({ onSelectionIntent: vi.fn(), selectionStates: selected(["A", "C"]) }),
    );
    const count = () =>
      container.querySelector('[data-slot="chart-selection-toolbar-count"]')!.textContent;
    expect(count()).toBe("2 selected");
    rerender(bars({ onSelectionIntent: vi.fn(), selectionStates: selected([]) }));
    expect(count()).toBe("");
    // A host that paints nothing at all leaves the count to the last gesture.
    rerender(bars({ onSelectionIntent: vi.fn() }));
    expect(count()).toBe("");
  });

  it("countHostSelected: distinct field values the resolver marks selected", () => {
    const rows = [
      { region: "north", v: 1 },
      { region: "north", v: 2 },
      { region: "south", v: 3 },
      { region: null, v: 4 },
    ];
    const resolver = (category: unknown) => (category === "north" ? "selected" : "associated");
    expect(countHostSelected({ rows, selectionStates: resolver }, "region")).toBe(1);
    expect(countHostSelected({ rows }, "region")).toBeUndefined();
    expect(countHostSelected({ rows, selectionStates: resolver }, undefined)).toBeUndefined();
  });

  it('selectionToolbar="none" hides the toolbar; the root is display: contents', () => {
    const { container } = render(bars({ onSelectionIntent: vi.fn(), selectionToolbar: "none" }));
    expect(container.querySelector('[data-slot="chart-selection-toolbar"]')).toBeNull();
    expect(container.querySelector('[data-slot="chart-selection-root"]')).toHaveClass("contents");
  });

  it("explicit: a rectangle paints provisionally; ✓ commits ONE replace intent; ✕ restores", () => {
    const onSelectionIntent = vi.fn<ChartSelectionIntentHandler>();
    const { container } = render(bars({ onSelectionIntent, selectionConfirm: "explicit" }));
    const root = container.querySelector('[data-slot="chart-selection-root"]')!;
    // The whole plot, then nothing emitted yet.
    drag(plotOf(container), [0, 0], [480, 208]);
    expect(onSelectionIntent).not.toHaveBeenCalled();
    expect(root).toHaveAttribute("data-selection-provisional", "true");
    expect(container.querySelectorAll('[data-selection="selected"]').length).toBeGreaterThan(0);
    expect(container.querySelector('[data-selection="excluded"]')).toBeNull();
    expect(screen.getByText("4 selected")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="chart-selection-status"]')?.textContent).toBe(
      "Rectangle selected: 4 categories. Press Enter to confirm, Escape to cancel.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm selection" }));
    expect(onSelectionIntent).toHaveBeenCalledTimes(1);
    expect(onSelectionIntent.mock.calls[0]?.[0]).toMatchObject({
      mode: "replace",
      field: "name",
      values: ["A", "B", "C", "D"],
      gesture: { kind: "rect" },
    });
    expect(root).not.toHaveAttribute("data-selection-provisional");
    expect(container.querySelector("[data-selection]")).toBeNull();

    drag(plotOf(container), [0, 0], [480, 208]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel selection" }));
    expect(onSelectionIntent).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-selection]")).toBeNull();
  });

  it("a keyboard datapoint activation toggles the provisional set; onDatapointClick still fires", () => {
    const onSelectionIntent = vi.fn<ChartSelectionIntentHandler>();
    const onDatapointClick = vi.fn();
    const { container } = render(
      bars({ onSelectionIntent, onDatapointClick, selectionConfirm: "explicit" }),
    );
    const targets = container.querySelectorAll<HTMLButtonElement>(
      '[data-slot="chart-datapoint-layer-target"]',
    );
    expect(targets.length).toBeGreaterThan(0);
    // `detail: 0` is how the layer tells a keyboard activation from a pointer click.
    fireEvent.click(targets[0]!, { detail: 0 });
    expect(onDatapointClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "Enter" });
    const intent = onSelectionIntent.mock.calls[0]?.[0] as ChartSelectionIntent;
    expect(intent).toMatchObject({ mode: "replace", values: ["A"], gesture: { kind: "click" } });
  });
});

describe("inside a ChartFrame", () => {
  it("the toolbar joins the frame's action row", () => {
    const { container } = render(
      <ChartFrame data={data} title="Revenue">
        {bars({ onSelectionIntent: vi.fn() })}
      </ChartFrame>,
    );
    expect(container.querySelectorAll('[data-slot="chart-selection-toolbar"]')).toHaveLength(1);
    const toolbar = container.querySelector('[data-slot="chart-selection-toolbar"]')!;
    // In the card header beside the frame's own actions, not above the plot.
    expect(toolbar.closest('[data-slot="chart-selection-root"]')).toBeNull();
    expect(toolbar.closest('[data-slot="card-header"]')).not.toBeNull();
    expect(within(toolbar as HTMLElement).getByRole("radio", { name: "Pointer" })).toBeTruthy();
  });

  it("the frame's selection default flips confirm; the chart's own prop wins", () => {
    const { container, rerender } = render(
      <ChartFrame data={data} selection={{ confirm: "explicit" }} title="Revenue">
        {bars({ onSelectionIntent: vi.fn() })}
      </ChartFrame>,
    );
    expect(screen.getByRole("button", { name: "Confirm selection" })).toBeInTheDocument();
    rerender(
      <ChartFrame data={data} selection={{ confirm: "explicit" }} title="Revenue">
        {bars({ onSelectionIntent: vi.fn(), selectionConfirm: "immediate" })}
      </ChartFrame>,
    );
    expect(screen.queryByRole("button", { name: "Confirm selection" })).toBeNull();
    expect(container.querySelector('[data-slot="chart-selection-toolbar"]')).not.toBeNull();
  });

  it('selection={{ toolbar: "none" }} keeps it out of the frame', () => {
    const { container } = render(
      <ChartFrame data={data} selection={{ toolbar: "none" }} title="Revenue">
        {bars({ onSelectionIntent: vi.fn() })}
      </ChartFrame>,
    );
    expect(container.querySelector('[data-slot="chart-selection-toolbar"]')).toBeNull();
  });

  it("a frame around a chart without gestures is unchanged", () => {
    const { container } = render(
      <ChartFrame data={data} title="Revenue">
        <BarChart data={data} xDataKey="name">
          <Bar dataKey="v" />
        </BarChart>
      </ChartFrame>,
    );
    expect(container.innerHTML).not.toContain("chart-selection");
  });
});

describe("AutoChart (ChartSpec.selection)", () => {
  it("passes spec.selection + onSelectionIntent to the family; without a handler nothing mounts", async () => {
    const { AutoChart } = await import("../../auto-chart/auto-chart");
    const spec = {
      type: "bar" as const,
      data,
      x: "name",
      series: ["v"],
      selection: { gestures: ["range" as const, "lasso" as const], confirm: "explicit" as const },
    };
    const { container, unmount } = render(<AutoChart onSelectionIntent={vi.fn()} spec={spec} />);
    expect(container.querySelector('[data-slot="chart-selection-toolbar"]')).not.toBeNull();
    expect(screen.getByRole("radio", { name: "Range" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Lasso" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm selection" })).toBeInTheDocument();
    unmount();
    const bare = render(<AutoChart spec={spec} />);
    expect(bare.container.innerHTML).not.toContain("chart-selection");
  });
});
