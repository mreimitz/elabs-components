import { act, cleanup, render, screen } from "@testing-library/react";
import {
  ReactFlowProvider,
  useStoreApi,
  type Node,
  type NodeProps,
  type ReactFlowState,
} from "@xyflow/react";
import { Profiler, type ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { FlowGroupNode, type BrandFlowGroupNode } from "./flow-group-node";

// Against a REAL React Flow store (no engine mock): what is under test is which store
// updates reach the group, and that is the store's behaviour, not a double's.

afterEach(cleanup);

type StoreApi = { getState: () => ReactFlowState };

/** Hands the provider's store to the test, so it can push `setNodes` the way a canvas does. */
function CaptureStore({ onStore }: { onStore: (store: StoreApi) => void }) {
  onStore(useStoreApi() as unknown as StoreApi);
  return null;
}

function groupProps(id: string): NodeProps<BrandFlowGroupNode> {
  return {
    id,
    type: "group",
    data: { title: "Pipeline" },
    selected: false,
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    draggable: true,
    deletable: true,
    selectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    width: 320,
    height: 200,
  };
}

const node = (id: string, x: number, parentId?: string): Node => ({
  id,
  position: { x, y: 0 },
  data: {},
  ...(parentId ? { parentId } : {}),
});

function setup(children: ReactNode) {
  let store!: StoreApi;
  let renders = 0;
  render(
    <ReactFlowProvider>
      <CaptureStore onStore={(s) => (store = s)} />
      <Profiler id="group" onRender={() => (renders += 1)}>
        {children}
      </Profiler>
    </ReactFlowProvider>,
  );
  return {
    setNodes: (nodes: Node[]) => act(() => store.getState().setNodes(nodes)),
    renders: () => renders,
  };
}

describe("FlowGroupNode store subscription", () => {
  it("does not re-render when an unrelated node changes", () => {
    const canvas = setup(<FlowGroupNode {...groupProps("g")} />);
    canvas.setNodes([node("g", 0), node("a", 10, "g"), node("loose", 400)]);
    expect(screen.getByText("1 node")).toBeInTheDocument();
    const settled = canvas.renders();

    // Move the loose node twice, and select it: a new `nodes` array every time. Under
    // `useNodes()` each of these re-rendered every group on the canvas.
    canvas.setNodes([node("g", 0), node("a", 10, "g"), node("loose", 420)]);
    canvas.setNodes([node("g", 0), node("a", 10, "g"), node("loose", 440)]);
    canvas.setNodes([node("g", 0), node("a", 10, "g"), { ...node("loose", 440), selected: true }]);
    // Moving the group's own child does not change the count either.
    canvas.setNodes([node("g", 0), node("a", 30, "g"), node("loose", 440)]);

    expect(canvas.renders()).toBe(settled);
  });

  it("re-renders with the new count when a child is added or removed", () => {
    const canvas = setup(<FlowGroupNode {...groupProps("g")} />);
    canvas.setNodes([node("g", 0), node("a", 10, "g")]);
    expect(screen.getByText("1 node")).toBeInTheDocument();
    const before = canvas.renders();

    canvas.setNodes([node("g", 0), node("a", 10, "g"), node("b", 20, "g")]);
    expect(screen.getByText("2 nodes")).toBeInTheDocument();
    expect(screen.getByText("2")).toHaveAttribute("aria-hidden", "true");
    expect(canvas.renders()).toBe(before + 1);

    canvas.setNodes([node("g", 0), node("b", 20, "g")]);
    expect(screen.getByText("1 node")).toBeInTheDocument();
  });

  it("counts only its own direct children, hidden ones included", () => {
    const canvas = setup(
      <>
        <FlowGroupNode {...groupProps("outer")} />
        <FlowGroupNode {...groupProps("inner")} />
      </>,
    );
    canvas.setNodes([
      node("outer", 0),
      node("x", 10, "outer"),
      node("inner", 20, "outer"),
      // A collapsed group hides its children; the count must not drop.
      { ...node("y", 30, "inner"), hidden: true },
      { ...node("z", 40, "inner"), hidden: true },
      { ...node("w", 50, "inner"), hidden: true },
    ]);
    // outer: x + inner (direct children only); inner: y, z, w.
    expect(screen.getByText("2 nodes")).toBeInTheDocument();
    expect(screen.getByText("3 nodes")).toBeInTheDocument();
  });
});
