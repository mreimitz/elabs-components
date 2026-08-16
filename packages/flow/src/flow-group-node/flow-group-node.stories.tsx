import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { Panel, useEdgesState, useNodesState, type Edge, type Node } from "@xyflow/react";
import { Boxes } from "lucide-react";
import { CanvasShell } from "../canvas-shell";
import { FlowNode } from "../flow-node";
import { ZoomControls } from "../zoom-controls";
import { useFlowGroups } from "../use-flow-groups";
import { FlowGroupNode } from "./flow-group-node";

const nodeTypes = { brand: FlowNode, group: FlowGroupNode };

const toolbarButton =
  "rounded-md border border-input bg-surface-elevated px-3 py-1.5 text-body shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

const meta = {
  title: "Flow/FlowGroupNode",
  component: FlowGroupNode,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FlowGroupNode>;
export default meta;
type Story = StoryObj<typeof meta>;

/* --------------------------------------------------------------------------
 * Group & ungroup — select nodes, then group / dissolve them from a toolbar.
 * ------------------------------------------------------------------------ */

const looseNodes: Node[] = [
  {
    id: "extract",
    type: "brand",
    position: { x: 60, y: 60 },
    data: { kind: "Source", title: "Extract" },
  },
  {
    id: "clean",
    type: "brand",
    position: { x: 300, y: 60 },
    data: { kind: "Transform", title: "Clean" },
  },
  {
    id: "join",
    type: "brand",
    position: { x: 300, y: 200 },
    data: { kind: "Transform", title: "Join" },
  },
  {
    id: "load",
    type: "brand",
    position: { x: 560, y: 130 },
    data: { kind: "Output", title: "Load" },
  },
];

const looseEdges: Edge[] = [
  { id: "e1", source: "extract", target: "clean" },
  { id: "e2", source: "clean", target: "join" },
  { id: "e3", source: "join", target: "load" },
];

function GroupToolbar() {
  const { groupSelection, ungroup } = useFlowGroups();
  return (
    <div className="flex gap-2">
      <button
        type="button"
        className={toolbarButton}
        onClick={() => groupSelection({ title: "Transforms", tone: "accent" })}
      >
        Group selection
      </button>
      <button type="button" className={toolbarButton} onClick={() => ungroup("group-transforms")}>
        Ungroup
      </button>
    </div>
  );
}

function GroupAndUngroupDemo() {
  const [nodes, , onNodesChange] = useNodesState(looseNodes);
  const [edges, , onEdgesChange] = useEdgesState(looseEdges);
  return (
    <div className="h-[520px]">
      <CanvasShell
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
      >
        <Panel position="top-left">
          <GroupToolbar />
        </Panel>
        <ZoomControls />
      </CanvasShell>
    </div>
  );
}

/**
 * Shift-click to select the `Clean` + `Join` nodes, then **Group selection** wraps
 * them in a `FlowGroupNode` parent. **Ungroup** dissolves the group with the id
 * `group-transforms` (this demo generates a random id, so use the header toggle
 * for collapse and the toolbar mainly to see grouping).
 */
export const GroupAndUngroup: Story = {
  render: () => <GroupAndUngroupDemo />,
};

/* --------------------------------------------------------------------------
 * Expand & collapse — a pre-built group with edges crossing the boundary.
 * ------------------------------------------------------------------------ */

function preGroupedGraph(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: "pipeline",
      type: "group",
      position: { x: 80, y: 80 },
      width: 420,
      height: 240,
      data: { title: "ETL pipeline", tone: "accent", icon: <Boxes /> },
    },
    {
      id: "extract",
      type: "brand",
      parentId: "pipeline",
      extent: "parent",
      position: { x: 24, y: 70 },
      data: { kind: "Source", title: "Extract" },
    },
    {
      id: "transform",
      type: "brand",
      parentId: "pipeline",
      extent: "parent",
      position: { x: 230, y: 130 },
      data: { kind: "Transform", title: "Transform" },
    },
    {
      id: "warehouse",
      type: "brand",
      position: { x: 640, y: 160 },
      data: { kind: "Output", title: "Warehouse" },
    },
  ];
  const edges: Edge[] = [
    { id: "e-ex-tr", source: "extract", target: "transform" }, // fully inside
    { id: "e-tr-wh", source: "transform", target: "warehouse" }, // crosses boundary
  ];
  return { nodes, edges };
}

function CollapseToolbar({ groupId }: { groupId: string }) {
  const { collapseGroup, expandGroup } = useFlowGroups();
  return (
    <div className="flex gap-2">
      <button type="button" className={toolbarButton} onClick={() => collapseGroup(groupId)}>
        Collapse
      </button>
      <button type="button" className={toolbarButton} onClick={() => expandGroup(groupId)}>
        Expand
      </button>
    </div>
  );
}

function ExpandAndCollapseDemo() {
  const initial = preGroupedGraph();
  const [nodes, , onNodesChange] = useNodesState(initial.nodes);
  const [edges, , onEdgesChange] = useEdgesState(initial.edges);
  return (
    <div className="h-[520px]">
      <CanvasShell
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
      >
        <Panel position="top-left">
          <CollapseToolbar groupId="pipeline" />
        </Panel>
        <ZoomControls />
      </CanvasShell>
    </div>
  );
}

/**
 * Collapse the group to an overview chip via the header chevron (or the toolbar).
 * The `Transform → Warehouse` edge crosses the collapse boundary, so it is
 * re-routed to a **proxy edge** from the group node to `Warehouse`; the
 * fully-inside `Extract → Transform` edge is simply hidden. Expanding restores the
 * exact original graph.
 */
export const ExpandAndCollapse: Story = {
  render: () => <ExpandAndCollapseDemo />,
};

/* --------------------------------------------------------------------------
 * Nested groups — a subgroup inside a group, each independently collapsible.
 * ------------------------------------------------------------------------ */

function nestedGraph(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: "outer",
      type: "group",
      position: { x: 60, y: 60 },
      width: 520,
      height: 320,
      data: { title: "Region: EU", tone: "accent" },
    },
    {
      id: "ingest",
      type: "brand",
      parentId: "outer",
      extent: "parent",
      position: { x: 24, y: 90 },
      data: { kind: "Source", title: "Ingest" },
    },
    {
      id: "inner",
      type: "group",
      parentId: "outer",
      extent: "parent",
      position: { x: 230, y: 70 },
      width: 250,
      height: 200,
      data: { title: "Enrichment", tone: "success" },
    },
    {
      id: "geo",
      type: "brand",
      parentId: "inner",
      extent: "parent",
      position: { x: 24, y: 90 },
      data: { kind: "Transform", title: "Geocode" },
    },
    {
      id: "sink",
      type: "brand",
      position: { x: 700, y: 180 },
      data: { kind: "Output", title: "Sink" },
    },
  ];
  const edges: Edge[] = [
    { id: "e-in-geo", source: "ingest", target: "geo" }, // crosses inner boundary
    { id: "e-geo-sink", source: "geo", target: "sink" }, // crosses both boundaries
  ];
  return { nodes, edges };
}

function NestedGroupsDemo() {
  const initial = nestedGraph();
  const [nodes, , onNodesChange] = useNodesState(initial.nodes);
  const [edges, , onEdgesChange] = useEdgesState(initial.edges);
  return (
    <div className="h-[560px]">
      <CanvasShell
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
      >
        <ZoomControls />
      </CanvasShell>
    </div>
  );
}

/**
 * A subgroup (`Enrichment`) nested inside an outer group (`Region: EU`). Collapse
 * the inner group first, then the outer — each header toggle works independently,
 * and expanding the outer keeps the inner collapsed (no double-unhide). Edges that
 * cross either boundary re-route to proxy edges on the relevant group.
 */
export const NestedGroups: Story = {
  render: () => <NestedGroupsDemo />,
};
