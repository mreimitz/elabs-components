import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// @xyflow/react requires real layout/measurement (React Flow renders no edges
// under jsdom at all — confirmed empirically: the full `<ProcessMap>` canvas
// leaves `.react-flow__edges`/`.react-flow__edgelabel-renderer` both empty even
// with the DOMMatrixReadOnly polyfill in place, because edge geometry depends on
// a real `ResizeObserver` measurement pass jsdom never runs). So this file tests
// `ProcessTransitionEdge` STANDALONE, the pattern its own context module
// documents as intentional (`process-map-context.ts`: "so `ProcessActivityNode`
// and `ProcessTransitionEdge` render correctly outside a `ProcessMap`"), mocking
// only the `@xyflow/react` primitives its `FlowWeightedEdge`/`FlowEdgePath`
// delegates need — the same shape `flow-weighted-edge.test.tsx` already uses.
//
// `vi.mock`'s factory is hoisted above every import — `vi.hoisted` is the escape
// hatch so the mock fns themselves survive the hoist without a TDZ ReferenceError.
const { edgesBox } = vi.hoisted(() => ({ edgesBox: { current: [] as unknown[] } }));

vi.mock("@xyflow/react", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a vi.mock factory is hoisted above imports; a lazy require avoids the TDZ a top-level import would hit
  const React = require("react");
  return {
    BaseEdge: ({
      id,
      path,
      style,
      className,
      markerStart: _markerStart,
      interactionWidth: _interactionWidth,
      ...rest
    }: {
      id: string;
      path: string;
      style?: React.CSSProperties;
      className?: string;
      markerStart?: string;
      interactionWidth?: number;
      [key: string]: unknown;
    }) =>
      React.createElement("svg", { "data-testid": "base-edge" }, [
        React.createElement("path", { key: "p", d: path, id, style, className, ...rest }),
      ]),
    // Real EdgeLabelRenderer portals into a fixed container; a passthrough is
    // enough here since we only assert the rendered pill's own attributes.
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => children,
    getBezierPath: ({
      sourceX,
      sourceY,
      targetX,
      targetY,
    }: {
      sourceX: number;
      sourceY: number;
      targetX: number;
      targetY: number;
    }) => [
      `M${sourceX},${sourceY} C${targetX},${targetY}`,
      (sourceX + targetX) / 2,
      (sourceY + targetY) / 2,
    ],
    getSmoothStepPath: ({
      sourceX,
      sourceY,
      targetX,
      targetY,
    }: {
      sourceX: number;
      sourceY: number;
      targetX: number;
      targetY: number;
    }) => [
      `M${sourceX},${sourceY} L${targetX},${targetY}`,
      (sourceX + targetX) / 2,
      (sourceY + targetY) / 2,
    ],
    useEdges: () => edgesBox.current,
    // `FlowWeightedEdge` reads the laid-out cards to route a back edge's return leg
    // clear of them; nothing here is a back edge, so an empty canvas is enough.
    useNodes: () => [],
    // `FlowWeightedEdge` reads nodes through `useStore(selector)` so a forward edge
    // does not re-render on every node change; this map has no measured rects.
    useStore: (selector: (state: { nodes: unknown[] }) => unknown) => selector({ nodes: [] }),
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  };
});

import { ProcessTransitionEdge } from "./process-transition-edge";
import type { ProcessMapEdge, ProcessTransitionEdgeData } from "./map-model";
import type { EdgeProps } from "@xyflow/react";

afterEach(() => {
  cleanup();
  edgesBox.current = [];
});

/** A complete `ProcessTransitionEdgeData` — a plain forward transition, associated. */
const BASE_EDGE_DATA: ProcessTransitionEdgeData = {
  source: "a",
  target: "b",
  weight: 1,
  value: 1,
  valueDomain: [0, 1],
  label: "12×",
  isSelfLoop: false,
  isBackEdge: false,
  selectionState: "associated",
};

/** Minimal EdgeProps factory for ProcessTransitionEdge — a plain forward transition. */
function makeEdgeProps(
  overrides: Partial<EdgeProps<ProcessMapEdge>> = {},
): EdgeProps<ProcessMapEdge> {
  return {
    id: "a->b",
    type: "process-transition",
    source: "a",
    target: "b",
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: "bottom" as EdgeProps["sourcePosition"],
    targetPosition: "top" as EdgeProps["targetPosition"],
    selected: false,
    animated: false,
    data: BASE_EDGE_DATA,
    ...overrides,
  };
}

// #351 — the label pill is portalled out from under this edge's `<g>` by
// `EdgeLabelRenderer`, so a whole-subtree opacity (the treatment every OTHER
// ghosted mark gets) never reaches it. `ProcessTransitionEdge` instead reaches
// the pill explicitly, by DATA (`labelProps`), with a non-opacity treatment —
// this locks that the data actually lands on the rendered pill, not just that
// the edge's own `<g>` opacity changes (which `process-map.test.tsx`'s sibling
// lock already covers for the node).
describe("ProcessTransitionEdge — reaches an excluded edge's label pill by data (#351)", () => {
  it("stamps the ghost frame (dashed border + data-selection) on the pill when excluded", () => {
    render(
      <ProcessTransitionEdge
        {...makeEdgeProps({ data: { ...BASE_EDGE_DATA, selectionState: "excluded" } })}
      />,
    );
    const pill = screen.getByRole("button", { name: "12×" });
    expect(pill.className).toMatch(/\bborder-dashed\b/);
    expect(pill).toHaveAttribute("data-selection", "excluded");
    // The pill's own text is untouched — no opacity, inline or via class — so it
    // never drops below the 4.5:1 rung the ghosted node's title also keeps.
    expect(pill.style.opacity).toBe("");
    expect(pill.className).not.toMatch(/\bopacity-/);
  });

  it("does not stamp the ghost frame when the transition is not excluded", () => {
    render(<ProcessTransitionEdge {...makeEdgeProps()} />);
    const pill = screen.getByRole("button", { name: "12×" });
    expect(pill.className).not.toMatch(/\bborder-dashed\b/);
    expect(pill).not.toHaveAttribute("data-selection");
  });
});
