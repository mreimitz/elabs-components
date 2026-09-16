import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DashboardSpec } from "../core/spec";
import { DashboardProvider, createPlaceholderTileKind } from "../dashboard-sheet";
import { useDashboardContext } from "../dashboard-sheet/use-dashboard";
import {
  useDashboardShortcuts,
  type UseDashboardShortcutsOptions,
} from "./use-dashboard-shortcuts";

const TILES = [createPlaceholderTileKind("chart")];

const SPEC: DashboardSpec = {
  version: 1,
  id: "shortcuts-test",
  grid: { mode: "fit", columns: 24, rows: 12, gap: 8 },
  tiles: [
    { id: "chart-1", kind: "chart", layout: { x: 0, y: 0, w: 4, h: 4 }, content: {} },
    { id: "chart-2", kind: "chart", layout: { x: 4, y: 0, w: 4, h: 4 }, content: {} },
  ],
};

function Probe({
  onReady,
}: {
  onReady: (store: ReturnType<typeof useDashboardContext>["store"]) => void;
}) {
  const { store } = useDashboardContext();
  onReady(store);
  return null;
}

function Harness(options: UseDashboardShortcutsOptions) {
  const containerRef = useDashboardShortcuts(options);
  return (
    <div ref={containerRef} data-testid="container">
      <input data-testid="input" />
      <textarea data-testid="textarea" />
      <div
        data-testid="editable"
        contentEditable
        suppressContentEditableWarning
        // jsdom never implements the `isContentEditable` getter's ancestor-walk algorithm
        // (https://github.com/jsdom/jsdom/issues/1670), so define it directly for the guard test.
        ref={(node) => {
          if (node)
            Object.defineProperty(node, "isContentEditable", { value: true, configurable: true });
        }}
      />
    </div>
  );
}

function renderHarness(options: UseDashboardShortcutsOptions = {}): {
  store: ReturnType<typeof useDashboardContext>["store"];
} {
  let store: ReturnType<typeof useDashboardContext>["store"] | undefined;
  render(
    <DashboardProvider spec={SPEC} tiles={TILES}>
      <div data-testid="outside" />
      <Harness {...options} />
      <Probe onReady={(s) => (store = s)} />
    </DashboardProvider>,
  );
  if (!store) throw new Error("store never mounted");
  return { store };
}

function container(): HTMLElement {
  return screen.getByTestId("container");
}

describe("useDashboardShortcuts", () => {
  it("Delete with 2 focused tiles removes both as ONE history entry; one undo restores both", () => {
    const { store } = renderHarness();
    act(() => store.getState().actions.setFocus(["chart-1", "chart-2"]));
    const before = structuredClone(store.getState().spec);
    expect(store.getState().history.past).toBe(0);

    fireEvent.keyDown(container(), { key: "Delete" });

    expect(store.getState().spec.tiles).toHaveLength(0);
    expect(store.getState().history.past).toBe(1);

    act(() => store.getState().actions.undo());
    expect(store.getState().spec).toEqual(before);
  });

  it("Backspace with 2 focused tiles behaves the same as Delete", () => {
    const { store } = renderHarness();
    act(() => store.getState().actions.setFocus(["chart-1", "chart-2"]));
    fireEvent.keyDown(container(), { key: "Backspace" });
    expect(store.getState().spec.tiles).toHaveLength(0);
    expect(store.getState().history.past).toBe(1);
  });

  it("Mod+D with 2 focused tiles duplicates both as ONE history entry; one undo removes both copies", () => {
    const { store } = renderHarness();
    act(() => store.getState().actions.setFocus(["chart-1", "chart-2"]));
    const before = structuredClone(store.getState().spec);
    expect(store.getState().history.past).toBe(0);

    fireEvent.keyDown(container(), { key: "d", metaKey: true });

    expect(store.getState().spec.tiles).toHaveLength(4);
    expect(store.getState().spec.tiles.map((t) => t.id)).toEqual(
      expect.arrayContaining(["chart-1", "chart-2", "chart-1-copy", "chart-2-copy"]),
    );
    expect(store.getState().history.past).toBe(1);

    act(() => store.getState().actions.undo());
    expect(store.getState().spec).toEqual(before);
  });

  it("Mod+Z undoes the last change", () => {
    const { store } = renderHarness();
    const before = structuredClone(store.getState().spec);
    act(() => store.getState().actions.moveTile("chart-1", { x: 2, y: 2 }));
    expect(store.getState().dirty).toBe(true);

    fireEvent.keyDown(container(), { key: "z", metaKey: true });

    expect(store.getState().spec).toEqual(before);
  });

  it("Mod+Shift+Z redoes", () => {
    const { store } = renderHarness();
    act(() => store.getState().actions.moveTile("chart-1", { x: 2, y: 2 }));
    const moved = structuredClone(store.getState().spec);
    act(() => store.getState().actions.undo());

    fireEvent.keyDown(container(), { key: "z", metaKey: true, shiftKey: true });

    expect(store.getState().spec).toEqual(moved);
  });

  it("Mod+Y also redoes", () => {
    const { store } = renderHarness();
    act(() => store.getState().actions.moveTile("chart-1", { x: 2, y: 2 }));
    const moved = structuredClone(store.getState().spec);
    act(() => store.getState().actions.undo());

    fireEvent.keyDown(container(), { key: "y", metaKey: true });

    expect(store.getState().spec).toEqual(moved);
  });

  it("Mod+S calls onSave", () => {
    const onSave = vi.fn();
    renderHarness({ onSave });

    fireEvent.keyDown(container(), { key: "s", metaKey: true });

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("E toggles edit mode", () => {
    const { store } = renderHarness();
    expect(store.getState().mode).toBe("view");

    fireEvent.keyDown(container(), { key: "e" });
    expect(store.getState().mode).toBe("edit");

    fireEvent.keyDown(container(), { key: "e" });
    expect(store.getState().mode).toBe("view");
  });

  it("Escape clears focus", () => {
    const { store } = renderHarness();
    act(() => store.getState().actions.setFocus(["chart-1"]));
    expect(store.getState().focus).toEqual(["chart-1"]);

    fireEvent.keyDown(container(), { key: "Escape" });

    expect(store.getState().focus).toEqual([]);
  });

  it.each([
    ["input", "Delete"],
    ["textarea", "Delete"],
    ["editable", "Delete"],
    ["input", "e"],
    ["textarea", "e"],
    ["editable", "e"],
  ])("ignores %s target for key %s", (testId, key) => {
    const { store } = renderHarness();
    act(() => store.getState().actions.setFocus(["chart-1", "chart-2"]));
    const before = structuredClone(store.getState().spec);
    const beforeMode = store.getState().mode;

    fireEvent.keyDown(screen.getByTestId(testId), { key });

    expect(store.getState().spec).toEqual(before);
    expect(store.getState().mode).toBe(beforeMode);
  });

  it("a keydown outside the container ref does nothing", () => {
    const { store } = renderHarness();
    act(() => store.getState().actions.setFocus(["chart-1", "chart-2"]));
    const before = structuredClone(store.getState().spec);

    fireEvent.keyDown(screen.getByTestId("outside"), { key: "Delete" });

    expect(store.getState().spec).toEqual(before);
    expect(store.getState().history.past).toBe(0);
  });
});
