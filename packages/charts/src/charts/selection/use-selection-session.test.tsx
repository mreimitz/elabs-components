import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChartSelectionIntent, ChartSelectionIntentHandler } from "./types";
import {
  defaultToolMode,
  provisionalMode,
  type SelectionSession,
  selectionToolModes,
  toolModeToEngineMode,
  useSelectionSession,
  type UseSelectionSessionOptions,
} from "./use-selection-session";

afterEach(cleanup);

function click(
  category: string,
  mode: ChartSelectionIntent["mode"] = "replace",
): ChartSelectionIntent {
  return {
    field: "region",
    values: [category],
    mode,
    gesture: { kind: "click", category },
    datapoints: [
      {
        category,
        index: 0,
        value: 1,
        seriesKey: "revenue",
        datum: { region: category },
        source: "pointer",
      },
    ],
    source: "pointer",
  };
}

function range(values: string[]): ChartSelectionIntent {
  return {
    field: "region",
    values,
    mode: "replace",
    gesture: { kind: "range", axis: "x", from: values[0]!, to: values.at(-1)! },
    datapoints: values.map((category, index) => ({
      category,
      index,
      value: index,
      seriesKey: "revenue",
      datum: { region: category },
      source: "pointer" as const,
    })),
    source: "pointer",
  };
}

function hook(options: Partial<UseSelectionSessionOptions> = {}) {
  const onSelectionIntent = vi.fn<ChartSelectionIntentHandler>();
  const result = renderHook(() =>
    useSelectionSession({
      gestures: ["range", "lasso"],
      field: "region",
      onSelectionIntent,
      ...options,
    }),
  );
  return { ...result, onSelectionIntent };
}

describe("helpers", () => {
  it("offers pointer plus the listed gestures, in toolbar order", () => {
    expect(selectionToolModes(["lasso", "range"])).toEqual(["pointer", "range", "lasso"]);
    expect(selectionToolModes([])).toEqual(["pointer"]);
  });

  it("starts in the first drawing gesture, never a range", () => {
    expect(defaultToolMode(["range", "rect"])).toBe("pointer");
    expect(defaultToolMode(["lasso", "range"])).toBe("lasso");
  });

  it("maps a range tool onto the dimension axis", () => {
    expect(toolModeToEngineMode("range")).toBe("range-x");
    expect(toolModeToEngineMode("range", "y")).toBe("range-y");
    expect(toolModeToEngineMode("lasso")).toBe("lasso");
  });

  it("explicit mode: a plain click toggles, a plain gesture adds, modifiers are kept", () => {
    expect(provisionalMode(click("a")).mode).toBe("toggle");
    expect(provisionalMode(range(["a", "b"])).mode).toBe("add");
    expect(provisionalMode(click("a", "add")).mode).toBe("add");
    expect(provisionalMode({ ...range(["a"]), mode: "toggle" }).mode).toBe("toggle");
  });
});

describe("useSelectionSession — immediate", () => {
  it("forwards every gesture at once and never opens a session", () => {
    const { result, onSelectionIntent } = hook();
    act(() => result.current.receive(range(["a", "b"])));
    act(() => result.current.receive(click("c")));
    expect(onSelectionIntent).toHaveBeenCalledTimes(2);
    expect(onSelectionIntent.mock.calls[1]?.[0].mode).toBe("replace");
    expect(result.current.isOpen).toBe(false);
    expect(result.current.count).toBe(1);
    expect(result.current.selectionStates).toBeUndefined();
  });
});

describe("useSelectionSession — explicit", () => {
  it("accumulates: click, click, range → one union; commit emits ONE replace intent", () => {
    const { result, onSelectionIntent } = hook({ confirm: "explicit" });
    act(() => result.current.receive(click("North")));
    act(() => result.current.receive(click("East")));
    act(() => result.current.receive(range(["South", "West"])));
    expect(onSelectionIntent).not.toHaveBeenCalled();
    expect(result.current.isOpen).toBe(true);
    expect(result.current.count).toBe(4);

    let committed: ChartSelectionIntent | null = null;
    act(() => {
      committed = result.current.commit();
    });
    expect(onSelectionIntent).toHaveBeenCalledTimes(1);
    const intent = onSelectionIntent.mock.calls[0]![0];
    expect(intent).toBe(committed);
    expect(intent.mode).toBe("replace");
    expect(intent.values).toEqual(["North", "East", "South", "West"]);
    expect(intent.gesture.kind).toBe("range");
    expect(intent.field).toBe("region");
    expect(result.current.isOpen).toBe(false);
  });

  it("a second click on a provisional value toggles it out; empty closes the session", () => {
    const { result } = hook({ confirm: "explicit" });
    act(() => result.current.receive(click("North")));
    act(() => result.current.receive(click("East")));
    act(() => result.current.receive(click("North")));
    expect(result.current.provisional?.values).toEqual(["East"]);
    act(() => result.current.receive(click("East")));
    expect(result.current.isOpen).toBe(false);
  });

  it("cancel drops the set, emits nothing and runs the engine resets", () => {
    const { result, onSelectionIntent } = hook({ confirm: "explicit" });
    const reset = vi.fn();
    act(() => {
      result.current.registerReset(reset);
    });
    act(() => result.current.receive(range(["a", "b"])));
    act(() => result.current.cancel());
    expect(onSelectionIntent).not.toHaveBeenCalled();
    expect(reset).toHaveBeenCalledTimes(1);
    expect(result.current.isOpen).toBe(false);
    expect(result.current.selectionStates).toBeUndefined();
  });

  it("paints the provisional set: in = selected, rest = associated, nothing excluded", () => {
    const { result } = hook({ confirm: "explicit" });
    act(() => result.current.receive(range(["North", "East"])));
    const paint = result.current.selectionStates!;
    expect(paint("North")).toBe("selected");
    expect(paint("South")).toBe("associated");
    // The row's own field value wins over the mark's category (a scatter point).
    expect(paint(12, "revenue", { region: "East" })).toBe("selected");
    expect(paint(12, "revenue", { region: "West" })).toBe("associated");
  });

  it("announces open, commit and cancel", () => {
    const { result } = hook({ confirm: "explicit" });
    act(() => result.current.receive(range(["a", "b", "c", "d"])));
    expect(result.current.announcement).toBe(
      "Range selected: 4 categories. Press Enter to confirm, Escape to cancel.",
    );
    act(() => {
      result.current.commit();
    });
    expect(result.current.announcement).toBe("Selection confirmed: 4 categories.");
    act(() => result.current.receive(click("a")));
    act(() => result.current.cancel());
    expect(result.current.announcement).toBe("Selection cancelled");
  });

  it("controls the tool mode, ignoring a tool the chart does not list", () => {
    const onModeChange = vi.fn();
    const { result } = hook({ onModeChange });
    expect(result.current.mode).toBe("pointer");
    act(() => result.current.setMode("lasso"));
    expect(result.current.mode).toBe("lasso");
    expect(onModeChange).toHaveBeenCalledWith("lasso");
    act(() => result.current.setMode("rect"));
    expect(result.current.mode).toBe("lasso");
  });
});

// ── DOM: Enter / Esc and click-outside ─────────────────────────────────────────

let session: SelectionSession | null = null;

function Harness(props: Partial<UseSelectionSessionOptions>) {
  const s = useSelectionSession({
    gestures: ["range"],
    field: "region",
    confirm: "explicit",
    ...props,
  });
  session = s as SelectionSession;
  return (
    <div>
      <div data-testid="root" ref={s.rootRef} tabIndex={-1}>
        <button type="button">inside</button>
      </div>
      <button type="button">outside</button>
      <output data-testid="count">{s.count}</output>
    </div>
  );
}

describe("useSelectionSession — keyboard and click-outside", () => {
  it("Enter on the chart root commits; Esc cancels", () => {
    const onSelectionIntent = vi.fn<ChartSelectionIntentHandler>();
    render(<Harness onSelectionIntent={onSelectionIntent} />);
    const root = screen.getByTestId("root");
    act(() => session!.receive(range(["a", "b"])));
    fireEvent.keyDown(root, { key: "Enter" });
    expect(onSelectionIntent).toHaveBeenCalledTimes(1);
    expect(onSelectionIntent.mock.calls[0]![0].mode).toBe("replace");

    act(() => session!.receive(range(["c"])));
    fireEvent.keyDown(root, { key: "Escape" });
    expect(onSelectionIntent).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("Enter on a button inside the chart activates the button, not the commit", () => {
    const onSelectionIntent = vi.fn<ChartSelectionIntentHandler>();
    render(<Harness onSelectionIntent={onSelectionIntent} />);
    act(() => session!.receive(range(["a"])));
    fireEvent.keyDown(screen.getByRole("button", { name: "inside" }), { key: "Enter" });
    expect(onSelectionIntent).not.toHaveBeenCalled();
  });

  it("keys aimed at another widget outside the chart are not the session's", () => {
    const onSelectionIntent = vi.fn<ChartSelectionIntentHandler>();
    render(<Harness onSelectionIntent={onSelectionIntent} />);
    act(() => session!.receive(range(["a"])));
    fireEvent.keyDown(screen.getByRole("button", { name: "outside" }), { key: "Escape" });
    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  it("a press outside the chart commits; a press inside does not", () => {
    const onSelectionIntent = vi.fn<ChartSelectionIntentHandler>();
    render(<Harness onSelectionIntent={onSelectionIntent} />);
    act(() => session!.receive(range(["a", "b"])));
    fireEvent.pointerDown(screen.getByRole("button", { name: "inside" }));
    expect(onSelectionIntent).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByRole("button", { name: "outside" }));
    expect(onSelectionIntent).toHaveBeenCalledTimes(1);
    expect(onSelectionIntent.mock.calls[0]![0].values).toEqual(["a", "b"]);
  });

  it("a registered element (a frame toolbar) counts as inside", () => {
    const onSelectionIntent = vi.fn<ChartSelectionIntentHandler>();
    render(<Harness onSelectionIntent={onSelectionIntent} />);
    act(() => {
      session!.registerInside(screen.getByRole("button", { name: "outside" }));
    });
    act(() => session!.receive(range(["a"])));
    fireEvent.pointerDown(screen.getByRole("button", { name: "outside" }));
    expect(onSelectionIntent).not.toHaveBeenCalled();
  });

  it("no listeners while no session is open", () => {
    const onSelectionIntent = vi.fn<ChartSelectionIntentHandler>();
    render(<Harness onSelectionIntent={onSelectionIntent} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "outside" }));
    fireEvent.keyDown(screen.getByTestId("root"), { key: "Enter" });
    expect(onSelectionIntent).not.toHaveBeenCalled();
  });
});
