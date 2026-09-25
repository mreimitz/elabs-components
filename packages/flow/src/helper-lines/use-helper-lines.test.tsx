import { act, cleanup, render, renderHook } from "@testing-library/react";
import type { Node, NodeChange } from "@xyflow/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The hook reads the live node store and the overlay reads the viewport — both need a
// React Flow context, so stub just those two and keep the rest of the engine real.
let storeNodes: Node[] = [];

vi.mock("@xyflow/react", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useReactFlow: () => ({ getNodes: () => storeNodes }),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}));

import { HelperLines } from "./helper-lines";
import { useHelperLines } from "./use-helper-lines";

afterEach(() => {
  cleanup();
  storeNodes = [];
});

type PositionChange = Extract<NodeChange, { type: "position" }>;

/** Drag node `a` to `(x, y)` against `other`, and report what the hook made of it. */
function drag(dragged: Partial<Node>, other: Partial<Node>, x: number, y: number) {
  storeNodes = [
    { id: "a", position: { x: 0, y: 0 }, data: {}, ...dragged },
    { id: "b", position: { x: 100, y: 100 }, data: {}, ...other },
  ];
  const forwarded = vi.fn();
  const { result } = renderHook(() => useHelperLines(forwarded));
  const change: PositionChange = { type: "position", id: "a", dragging: true, position: { x, y } };
  act(() => result.current.onNodesChange([change]));
  expect(forwarded).toHaveBeenCalledWith([change]);
  return { position: change.position, vertical: result.current.helperLineVertical };
}

// Each case places the dragged node so that exactly ONE size rule decides whether a
// vertical guide appears: the right rule aligns (or misses), the wrong one would do
// the opposite. The other node sits at (100, 100) and every drag goes to y = 500, far
// from any of its horizontal anchors, so no horizontal guide ever interferes.
describe("useHelperLines — node sizes", () => {
  it("uses a node's measured box before its declared width/height", () => {
    const { position, vertical } = drag(
      { measured: { width: 20, height: 40 } },
      // measured right edge: 100 + 60 = 160; the declared 200 would put it at 300.
      { measured: { width: 60, height: 40 }, width: 200, height: 40 },
      148,
      500,
    );
    expect(vertical).toBe(160);
    // Centre snapped onto the guide: 160 − 20 / 2.
    expect(position?.x).toBe(150);
  });

  it("falls back to a node's declared width/height when it has not been measured", () => {
    const { position, vertical } = drag(
      { measured: { width: 20, height: 40 } },
      { width: 60, height: 40 },
      148,
      500,
    );
    expect(vertical).toBe(160);
    expect(position?.x).toBe(150);
  });

  it("never invents a box for an unmeasured node — no 172×40 layout default", () => {
    // A zero-size box puts all three of the other node's anchors at x = 100: nothing near
    // 183. A 172px default box would centre it on 186 — 3px from the dragged left edge.
    const { position, vertical } = drag({ measured: { width: 20, height: 40 } }, {}, 183, 500);
    expect(vertical).toBeUndefined();
    expect(position?.x).toBe(183);
  });

  it("treats an unmeasured dragged node as a zero-size box at its drag position", () => {
    // A 172px dragged box at x = 44 would centre on 130 — the other node's centre.
    const { position, vertical } = drag({}, { measured: { width: 60, height: 40 } }, 44, 500);
    expect(vertical).toBeUndefined();
    expect(position?.x).toBe(44);
  });
});

describe("HelperLines", () => {
  it('marks its overlay with data-slot="helper-lines"', () => {
    const { container } = render(<HelperLines horizontal={10} className="my-lines" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("data-slot", "helper-lines");
    expect(svg).toHaveClass("my-lines");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders nothing while no guide is active", () => {
    const { container } = render(<HelperLines />);
    expect(container.querySelector('[data-slot="helper-lines"]')).toBeNull();
  });
});
