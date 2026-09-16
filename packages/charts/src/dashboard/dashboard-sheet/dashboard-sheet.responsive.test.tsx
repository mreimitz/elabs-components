import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { DashboardSpec } from "../core/spec";
import { DashboardProvider } from "./dashboard-provider";
import { DashboardSheet, resolveBreakpointLayout } from "./dashboard-sheet";
import { createPlaceholderTileKind } from "./placeholder-tile";

const TILES = ["chart"].map((kind) => createPlaceholderTileKind(kind));

const SPEC: DashboardSpec = {
  version: 1,
  id: "responsive-test",
  grid: { mode: "fit", columns: 24, rows: 12, gap: 8 },
  tiles: [
    { id: "a", kind: "chart", layout: { x: 0, y: 0, w: 8, h: 4 }, content: {} },
    { id: "b", kind: "chart", layout: { x: 8, y: 0, w: 8, h: 4 }, content: {} },
    { id: "c", kind: "chart", layout: { x: 0, y: 4, w: 24, h: 4 }, content: {} },
  ],
  layouts: {
    md: [
      { id: "a", x: 0, y: 0, w: 24, h: 4 },
      { id: "b", x: 0, y: 4, w: 24, h: 4 },
      { id: "c", x: 0, y: 8, w: 24, h: 4 },
    ],
  },
};

describe("resolveBreakpointLayout (RM-084, R9)", () => {
  it("'lg' always reads the base layout, ignoring spec.layouts", () => {
    const resolved = resolveBreakpointLayout(SPEC, "lg");
    expect(resolved.get("a")).toMatchObject({ x: 0, y: 0, w: 8, h: 4 });
    expect(resolved.get("b")).toMatchObject({ x: 8, y: 0, w: 8, h: 4 });
  });

  it("'md' reads spec.layouts.md when the author set one", () => {
    const resolved = resolveBreakpointLayout(SPEC, "md");
    expect(resolved.get("a")).toMatchObject({ x: 0, y: 0, w: 24, h: 4 });
    expect(resolved.get("b")).toMatchObject({ x: 0, y: 4, w: 24, h: 4 });
  });

  it("'sm' without an override falls back to stackForNarrow: one column, y-then-x, w === columns", () => {
    const resolved = resolveBreakpointLayout(SPEC, "sm");
    const order = [...resolved.values()].sort((x, y) => x.y - y.y);
    for (const cell of order) expect(cell.w).toBe(SPEC.grid.columns);
    // a, b share y=0 in the base layout; a's x (0) sorts before b's (8) — stable order.
    expect(order.map((c) => c.x)).toEqual([0, 0, 0]);
  });

  it("'sm' reads spec.layouts.sm when the author set one, ignoring stackForNarrow", () => {
    const withSm: DashboardSpec = {
      ...SPEC,
      layouts: { sm: [{ id: "a", x: 0, y: 0, w: 12, h: 4 }] },
    };
    const resolved = resolveBreakpointLayout(withSm, "sm");
    expect(resolved.get("a")).toMatchObject({ x: 0, y: 0, w: 12, h: 4 });
    expect(resolved.has("b")).toBe(false); // the author's override lists only "a".
  });
});

describe("DashboardSheet — container-query breakpoint (RM-084)", () => {
  const realResizeObserver = globalThis.ResizeObserver;

  function mockWidth(width: number) {
    class FixedWidthResizeObserver {
      #callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.#callback = callback;
      }
      observe() {
        this.#callback([{ contentRect: { width } } as ResizeObserverEntry], this as never);
      }
      unobserve() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = FixedWidthResizeObserver as unknown as typeof ResizeObserver;
  }

  afterEach(() => {
    globalThis.ResizeObserver = realResizeObserver;
  });

  it("reports its own width as data-breakpoint, never the window's", () => {
    mockWidth(500);
    render(
      <DashboardProvider spec={SPEC} tiles={TILES}>
        <DashboardSheet />
      </DashboardProvider>,
    );
    const sheet = document.querySelector('[data-slot="dashboard-sheet"]');
    expect(sheet).toHaveAttribute("data-breakpoint", "sm");
  });

  it("drops to view rendering (no edit layer) at 'sm' even when the store mode is 'edit'", () => {
    mockWidth(500);
    render(
      <DashboardProvider spec={SPEC} tiles={TILES} mode="edit">
        <DashboardSheet />
      </DashboardProvider>,
    );
    expect(
      document.querySelector('[data-slot="dashboard-edit-layer-announcer"]'),
    ).not.toBeInTheDocument();
  });
});
