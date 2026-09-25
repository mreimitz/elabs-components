"use client";

/**
 * Flow workspace tour surface (RM-098, concept §4.2 "a pipeline you can edit on a canvas, with
 * an inspector that knows the node"). `content/fixtures/flow.ts` (RM-095) drives a branded
 * React Flow canvas — `FlowNode`/`FlowEdge`, `ZoomControls`, `FlowMiniMap` — with an
 * `InspectorPanel` bound to whatever node is selected, by mouse or keyboard alike. `fitView` runs once on mount; wheel and
 * pan gestures are React Flow's own defaults, captured inside the canvas only (the page never
 * scrolls under a wheel event fired over the frame).
 *
 * `@elabs-ai/components-flow` (React Flow) loads only when this tab opens — the dynamic
 * `import()` lives in `tour.tsx`, never here.
 */
import {
  CanvasShell,
  FlowEdge,
  FlowMiniMap,
  FlowNode,
  InspectorPanel,
  ZoomControls,
  useNodesState,
  type BrandFlowNode,
  type Edge,
} from "@elabs-ai/components-flow";
import { Descriptions, DescriptionsItem } from "@elabs-ai/components-ui";
import { FLOW_EDGES, FLOW_NODES } from "../../../content/fixtures/flow";
import { tourSurfaceCopy } from "../../../content/copy";

const nodeTypes = { brand: FlowNode };
const edgeTypes = { brand: FlowEdge };

/** The fixture's generic `Node<PipelineNodeData>` shape, re-typed as branded flow nodes. */
const NODES: BrandFlowNode[] = FLOW_NODES.map((node) => ({
  ...node,
  type: "brand",
  data: { kind: "Process", title: node.data.label, subtitle: node.data.description },
}));
const EDGES: Edge[] = FLOW_EDGES.map((edge) => ({ ...edge, type: "brand" }));

export function FlowWorkspaceSurface() {
  // Live node state, and the Inspector reads React Flow's OWN selection back out of it. A
  // click and Enter/Space on a focused node both select through React Flow, but only a click
  // ever calls `onNodeClick` — driving the Inspector from that left keyboard users with an
  // empty panel (issue 536). A pane click deselects through React Flow as well.
  const [nodes, setNodes, onNodesChange] = useNodesState(NODES);
  const selected = nodes.find((node) => node.selected) ?? null;
  const copy = tourSurfaceCopy.flowWorkspace;

  const clearSelection = () =>
    setNodes((current) =>
      current.map((node) => (node.selected ? { ...node, selected: false } : node)),
    );

  return (
    <div className="flex h-full min-h-0 flex-col" aria-label={copy.demoLabel}>
      {/* Narrow screens: the canvas needs real width to be useful — a note instead of a cramped map. */}
      <p className="p-6 text-body text-muted-foreground md:hidden">{copy.narrow}</p>
      <div className="hidden min-h-0 flex-1 md:flex">
        <div className="relative min-h-0 min-w-0 flex-1">
          <CanvasShell
            className="size-full"
            fitView
            nodes={nodes}
            edges={EDGES}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
          >
            <ZoomControls />
            <FlowMiniMap />
          </CanvasShell>
        </div>
        <InspectorPanel
          title={selected?.data.title ?? copy.inspectorTitle}
          hasSelection={selected !== null}
          selectionKey={selected?.id}
          onClose={clearSelection}
          emptyMessage={copy.inspectorEmpty}
        >
          {selected ? (
            <Descriptions>
              <DescriptionsItem label="Node">{selected.data.title}</DescriptionsItem>
              <DescriptionsItem label="Detail">{selected.data.subtitle}</DescriptionsItem>
            </Descriptions>
          ) : null}
        </InspectorPanel>
      </div>
    </div>
  );
}
