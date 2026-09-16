import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardSpec } from "../core/spec";
import { DashboardProvider, createPlaceholderTileKind } from "../dashboard-sheet";
import { useDashboardContext } from "../dashboard-sheet/use-dashboard";
import { DashboardToolbar } from "./dashboard-toolbar";

const TILES = [createPlaceholderTileKind("chart")];

const SPEC: DashboardSpec = {
  version: 1,
  id: "toolbar-test",
  grid: { mode: "fit", columns: 24, rows: 12, gap: 8 },
  tiles: [{ id: "chart-1", kind: "chart", layout: { x: 0, y: 0, w: 4, h: 4 }, content: {} }],
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

function renderToolbar(
  props: Partial<React.ComponentProps<typeof DashboardToolbar>> = {},
): ReturnType<typeof useDashboardContext>["store"] {
  let store: ReturnType<typeof useDashboardContext>["store"] | undefined;
  render(
    <DashboardProvider spec={SPEC} tiles={TILES}>
      <DashboardToolbar {...props} />
      <Probe onReady={(s) => (store = s)} />
    </DashboardProvider>,
  );
  if (!store) throw new Error("store never mounted");
  return store;
}

describe("DashboardToolbar", () => {
  it("carries the toolbar role and accessible name, View selected by default", () => {
    renderToolbar();
    expect(screen.getByRole("toolbar", { name: "Dashboard toolbar" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "View" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Edit" })).toHaveAttribute("aria-checked", "false");
  });

  it("clicking Edit sets the store's mode; Undo/Redo start disabled", async () => {
    const user = userEvent.setup();
    const store = renderToolbar();
    await user.click(screen.getByRole("radio", { name: "Edit" }));
    await waitFor(() => expect(store.getState().mode).toBe("edit"));
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
  });

  it("a move dirties the store, enables Undo/Save/Discard; Undo restores and enables Redo", async () => {
    const user = userEvent.setup();
    const store = renderToolbar({ onSave: vi.fn() });
    const before = structuredClone(store.getState().spec);
    act(() => store.getState().actions.moveTile("chart-1", { x: 2, y: 2 }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Undo" })).not.toBeDisabled());
    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Discard" })).not.toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");

    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(store.getState().spec).toEqual(before));
    expect(screen.getByRole("button", { name: "Redo" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("Save calls onSave with the current spec and clears dirty", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const store = renderToolbar({ onSave });
    act(() => store.getState().actions.moveTile("chart-1", { x: 2, y: 2 }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled());
    const current = structuredClone(store.getState().spec);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith(current);
    await waitFor(() => expect(store.getState().dirty).toBe(false));
  });

  it("hides Save without an onSave prop", () => {
    renderToolbar();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("Discard opens a confirm dialog; confirming restores the mount snapshot", async () => {
    const user = userEvent.setup();
    const store = renderToolbar();
    const mount = structuredClone(store.getState().spec);
    act(() => store.getState().actions.moveTile("chart-1", { x: 3, y: 3 }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Discard" })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: "Discard" }));
    await user.click(await screen.findByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(store.getState().spec).toEqual(mount));
    expect(store.getState().dirty).toBe(false);
  });

  it("features flags hide Add, Grid and the shortcuts trigger", () => {
    renderToolbar({ features: { add: false, grid: false, shortcuts: false } });
    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Grid" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });

  it("Add opens the assets panel via setPanel when onAdd is not given", async () => {
    const user = userEvent.setup();
    const store = renderToolbar();
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(store.getState().ui.assets).toBe(true);
  });
});

describe("DashboardToolbar — narrow viewport (R8)", () => {
  const realResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    // `useBreakpoint` (RM-084) reads the toolbar's OWN width through a `ResizeObserver`, never
    // `window`/`matchMedia` — simulate a narrow container by firing the observer callback with
    // a `contentRect.width` below the `"sm"` threshold (640) the instant it starts observing.
    class NarrowResizeObserver {
      #callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.#callback = callback;
      }
      observe() {
        this.#callback(
          [{ contentRect: { width: 400 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = NarrowResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = realResizeObserver;
  });

  it("disables the Edit toggle with a tooltip explaining why", async () => {
    const user = userEvent.setup();
    renderToolbar();
    const edit = screen.getByRole("radio", { name: "Edit" });
    expect(edit).toBeDisabled();

    const wrap = document.querySelector('[data-slot="dashboard-toolbar-edit-toggle-wrap"]');
    if (!wrap) throw new Error("edit-toggle wrap never rendered");
    await user.hover(wrap);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Editing needs a wider screen");
  });
});
