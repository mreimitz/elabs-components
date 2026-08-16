/**
 * Flow canvas scaffold (copy-owned block).
 * Remember to `import "@xyflow/react/dist/style.css"` once at the app root.
 * Depends on installed @elabs/components-flow + @xyflow/react.
 */
"use client";

import {
  CanvasShell,
  FlowEdge,
  FlowNode,
  ZoomControls,
  useEdgesState,
  useNodesState,
  type BrandFlowNode,
  type Edge,
} from "@elabs/components-flow";

const nodeTypes = { brand: FlowNode };
const edgeTypes = { brand: FlowEdge };

const initialNodes: BrandFlowNode[] = [
  {
    id: "1",
    type: "brand",
    position: { x: 0, y: 0 },
    data: { kind: "Source", title: "Input", tone: "accent" },
  },
  {
    id: "2",
    type: "brand",
    position: { x: 240, y: 120 },
    data: { kind: "Output", title: "Result", tone: "success" },
  },
];
const initialEdges: Edge[] = [{ id: "e1-2", source: "1", target: "2", type: "brand" }];

export function FlowCanvas() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  return (
    <div className="h-[600px]">
      <CanvasShell
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
      >
        <ZoomControls />
      </CanvasShell>
    </div>
  );
}
