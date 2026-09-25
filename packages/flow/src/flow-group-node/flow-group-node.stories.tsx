import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { Panel, useEdgesState, useNodesState, type Edge, type Node } from "@xyflow/react";
import { Boxes, Database, Gauge, Layers, ShieldAlert, Sparkles, Workflow } from "lucide-react";
import { expect, userEvent, waitFor } from "storybook/test";
import { CanvasShell } from "../canvas-shell";
import { FlowNode } from "../flow-node";
import { ZoomControls } from "../zoom-controls";
import { useFlowGroups } from "../use-flow-groups";
import { FlowGroupNode, type BrandFlowGroupNode } from "./flow-group-node";

const nodeTypes = { brand: FlowNode, group: FlowGroupNode };

const toolbarButton =
  "rounded-md border border-input bg-surface-elevated px-3 py-1.5 text-body shadow-sm hover:bg-accent focus-ring disabled:opacity-50";

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
        onClick={() => groupSelection({ title: "Transforms", emphasis: "featured" })}
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
      data: { title: "ETL pipeline", emphasis: "featured", icon: <Boxes /> },
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
      data: { title: "Region: EU", emphasis: "featured" },
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

/* --------------------------------------------------------------------------
 * Tones & emphasis — the one tone system, on a group.
 * ------------------------------------------------------------------------ */

const toneGroup = (
  id: string,
  column: number,
  row: number,
  data: BrandFlowGroupNode["data"],
): BrandFlowGroupNode => ({
  id,
  type: "group",
  position: { x: 20 + column * 270, y: 20 + row * 120 },
  width: 240,
  height: 96,
  data,
});

const toneGroups: BrandFlowGroupNode[] = [
  toneGroup("neutral", 0, 0, {
    title: "Staging",
    tone: "neutral",
    icon: <Layers />,
    childCount: 4,
  }),
  toneGroup("info", 1, 0, { title: "Queued", tone: "info", icon: <Workflow />, childCount: 2 }),
  toneGroup("success", 2, 0, {
    title: "Published",
    tone: "success",
    icon: <Database />,
    childCount: 3,
  }),
  toneGroup("warning", 0, 1, {
    title: "Slow path",
    tone: "warning",
    icon: <Gauge />,
    childCount: 1,
  }),
  toneGroup("destructive", 1, 1, {
    title: "Failed jobs",
    tone: "destructive",
    icon: <ShieldAlert />,
    childCount: 5,
  }),
  toneGroup("default", 2, 1, { title: "Transforms", emphasis: "default", childCount: 2 }),
  toneGroup("featured", 0, 2, {
    title: "Entry pipeline",
    emphasis: "featured",
    icon: <Sparkles />,
    childCount: 3,
  }),
  toneGroup("featured-warning", 1, 2, {
    title: "Hot path",
    tone: "warning",
    emphasis: "featured",
    icon: <Gauge />,
    childCount: 2,
  }),
];

/**
 * Every status tone and both emphasis values on a group. The tone colours the header's
 * icon (the fill rung) and count badge (the text rung) and adds its glyph and name; the
 * group keeps its own surface and border. `featured` adds the star.
 */
export const Tones: Story = {
  render: () => (
    <div className="h-[420px]">
      <CanvasShell nodes={toneGroups} edges={[]} nodeTypes={nodeTypes} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const group = (id: string) =>
      canvasElement.querySelector<HTMLElement>(`[data-id="${id}"] [data-slot="flow-group-node"]`);
    await waitFor(() => {
      expect(canvasElement.querySelectorAll('[data-slot="flow-group-node"]')).toHaveLength(8);
    });
    await expect(group("neutral")).toHaveAttribute("data-tone", "neutral");
    await expect(group("neutral")?.querySelector('[data-slot="flow-tone-indicator"]')).toBe(null);
    await expect(group("info")).toHaveTextContent("Info");
    await expect(group("success")).toHaveTextContent("Success");
    await expect(group("warning")).toHaveTextContent("Warning");
    await expect(group("destructive")).toHaveTextContent("Destructive");
    await expect(group("featured")).toHaveAttribute("data-emphasis", "featured");
    await expect(group("featured-warning")).toHaveTextContent("Featured, Warning");
    // The count's digits are decoration; the phrase is what a screen reader hears.
    await expect(group("destructive")).toHaveTextContent("5 nodes");
  },
};

/**
 * A group is a keyboard stop like any node. React Flow focuses its own wrapper, so the
 * group's frame paints the proxied focus indicator, separate from the selection ring.
 */
export const KeyboardFocus: Story = {
  render: () => {
    const nodes: Node[] = [
      {
        id: "pipeline",
        type: "group",
        position: { x: 40, y: 40 },
        width: 320,
        height: 160,
        data: { title: "ETL pipeline", icon: <Boxes /> },
      },
      {
        id: "extract",
        type: "brand",
        parentId: "pipeline",
        extent: "parent",
        position: { x: 24, y: 70 },
        data: { kind: "Source", title: "Extract" },
      },
    ];
    return (
      <div className="h-[280px]">
        <CanvasShell nodes={nodes} edges={[]} nodeTypes={nodeTypes} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    let wrapper!: HTMLElement;
    let frame!: HTMLElement;
    await waitFor(() => {
      const found = canvasElement.querySelector<HTMLElement>('[data-testid="rf__node-pipeline"]');
      expect(found).not.toBe(null);
      wrapper = found!;
      frame = found!.querySelector<HTMLElement>('[data-slot="flow-group-node"]')!;
      expect(frame).not.toBe(null);
    });
    await expect(getComputedStyle(frame).outlineStyle).toBe("none");

    // Reach the group by keyboard alone — real tab order, no synthetic .focus().
    let guard = 0;
    while (document.activeElement !== wrapper && guard < 40) {
      await userEvent.tab();
      guard += 1;
    }
    await expect(document.activeElement).toBe(wrapper);
    await waitFor(() => {
      expect(getComputedStyle(frame).outlineStyle).toBe("solid");
    });
  },
};
