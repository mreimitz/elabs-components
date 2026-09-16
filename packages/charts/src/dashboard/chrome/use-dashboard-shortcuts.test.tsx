import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ComponentsUi from "@elabs-ai/components-ui";

import { readDashboardClipboard, resetDashboardClipboardForTests } from "../edit/clipboard";
import type { DashboardSpec } from "../core/spec";
import { DashboardProvider, createPlaceholderTileKind } from "../dashboard-sheet";
import { useDashboardContext } from "../dashboard-sheet/use-dashboard";
import {
  dashboardShortcutDescriptors,
  useDashboardShortcuts,
  type UseDashboardShortcutsOptions,
} from "./use-dashboard-shortcuts";

const toastMock = vi.fn();
vi.mock("@elabs-ai/components-ui", async (importOriginal) => {
  const actual = await importOriginal<typeof ComponentsUi>();
  return { ...actual, toast: (...args: unknown[]) => toastMock(...args) };
});

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
      {/* A stand-in for a real tile root (which always carries `data-tile-id` — `dashboard.md`) so
          the Shift+F10 tests can dispatch on an element `dispatchAnchoredContextMenu` can anchor a
          rect from, the same way a real focused tile does. */}
      <div data-testid="tile" data-tile-id="chart-1" tabIndex={-1} />
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

function tileTarget(): HTMLElement {
  return screen.getByTestId("tile");
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

  // tile operations — RM-081
  describe("tile operations", () => {
    beforeEach(() => resetDashboardClipboardForTests());

    it("Mod+A selects every top-level tile", () => {
      const { store } = renderHarness();
      fireEvent.keyDown(container(), { key: "a", metaKey: true });
      expect(store.getState().focus).toEqual(["chart-1", "chart-2"]);
    });

    it("Mod+C copies the focused tiles to the clipboard (marker'd JSON)", async () => {
      const { store } = renderHarness();
      act(() => store.getState().actions.setFocus(["chart-1"]));
      await act(async () => {
        fireEvent.keyDown(container(), { key: "c", metaKey: true });
        await Promise.resolve();
      });
      const tiles = await readDashboardClipboard();
      expect(tiles).toEqual([{ kind: "chart", content: {}, layout: { w: 4, h: 4 } }]);
    });

    it("Mod+X copies then removes the focused tiles as one history entry", async () => {
      const { store } = renderHarness();
      act(() => store.getState().actions.setFocus(["chart-1"]));
      await act(async () => {
        fireEvent.keyDown(container(), { key: "x", metaKey: true });
        await Promise.resolve();
      });
      expect(store.getState().spec.tiles.map((t) => t.id)).toEqual(["chart-2"]);
      expect(store.getState().history.past).toBe(1);
      const tiles = await readDashboardClipboard();
      expect(tiles).toEqual([{ kind: "chart", content: {}, layout: { w: 4, h: 4 } }]);
    });

    it("Mod+V pastes the clipboard's tiles with a new id, at the first empty slot", async () => {
      const { store } = renderHarness();
      act(() => store.getState().actions.setFocus(["chart-1"]));
      await act(async () => {
        fireEvent.keyDown(container(), { key: "c", metaKey: true });
        await Promise.resolve();
      });
      act(() => store.getState().actions.setFocus([]));
      await act(async () => {
        fireEvent.keyDown(container(), { key: "v", metaKey: true });
        await Promise.resolve();
      });
      expect(store.getState().spec.tiles).toHaveLength(3);
      const pasted = store
        .getState()
        .spec.tiles.find((t) => !["chart-1", "chart-2"].includes(t.id));
      expect(pasted).toBeDefined();
      expect(pasted?.kind).toBe("chart");
    });

    it("Delete offers Undo via a toast", () => {
      const { store } = renderHarness();
      act(() => store.getState().actions.setFocus(["chart-1"]));
      toastMock.mockClear();

      fireEvent.keyDown(container(), { key: "Delete" });

      expect(store.getState().spec.tiles.map((t) => t.id)).toEqual(["chart-2"]);
      expect(toastMock).toHaveBeenCalledTimes(1);
      const [message, opts] = toastMock.mock.calls[0] as [
        string,
        { action: { onClick: () => void } },
      ];
      expect(message).toBe("Tile deleted");
      act(() => opts.action.onClick());
      expect(store.getState().spec.tiles.map((t) => t.id)).toEqual(["chart-1", "chart-2"]);
    });

    it("Shift+F10 with exactly one focused tile dispatches a native contextmenu event at the target, anchored at the tile's own rect", () => {
      const { store } = renderHarness();
      act(() => store.getState().actions.setFocus(["chart-1"]));
      // Must dispatch INSIDE the shortcuts container ref (the listener is scoped to that
      // subtree — see "a keydown outside the container ref does nothing" above), on a
      // non-text-entry element (isTextEntry guards return early for input/textarea/editable)
      // that is (or sits inside) a real tile root — `dispatchAnchoredContextMenu`
      // (visual P1, RM-081 follow-up 5) needs a `[data-tile-id]` ancestor to anchor a rect
      // from, the same way Shift+F10 always fires from inside the focused tile in production.
      const target = tileTarget();
      const onContextMenu = vi.fn();
      target.addEventListener("contextmenu", onContextMenu);
      fireEvent.keyDown(target, { key: "F10", shiftKey: true });
      expect(onContextMenu).toHaveBeenCalledTimes(1);
      // Not the viewport's top-left corner — jsdom's own layout gives every element a
      // 0×0 `getBoundingClientRect()`, so this just guards the dispatch actually carries
      // `clientX`/`clientY` rather than leaving them at the `MouseEvent` default of 0.
      const [event] = onContextMenu.mock.calls[0] as [MouseEvent];
      expect(event.clientX).toBe(8); // ANCHOR_INSET past a 0×0 rect's left edge
      expect(event.clientY).toBe(8);
    });

    it("Shift+F10 with no or multiple focused tiles does nothing", () => {
      const { store } = renderHarness();
      const target = tileTarget();
      const onContextMenu = vi.fn();
      target.addEventListener("contextmenu", onContextMenu);
      fireEvent.keyDown(target, { key: "F10", shiftKey: true });
      expect(onContextMenu).not.toHaveBeenCalled();
      act(() => store.getState().actions.setFocus(["chart-1", "chart-2"]));
      fireEvent.keyDown(target, { key: "F10", shiftKey: true });
      expect(onContextMenu).not.toHaveBeenCalled();
    });

    it("dashboardShortcutDescriptors lists the new bindings", () => {
      const actions = dashboardShortcutDescriptors().map((d) => d.action);
      expect(actions).toEqual(
        expect.arrayContaining(["copy", "cut", "paste", "selectAll", "contextMenu"]),
      );
    });
  });
});
