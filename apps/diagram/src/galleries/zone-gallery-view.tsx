import { useEffect, useRef } from "react";
import { useNodesInitialized } from "@xyflow/react";
import {
  CanvasShell,
  FlowMiniMap,
  ReactFlowProvider,
  ZoomControls,
  collapseGroup,
  layoutFlowElk,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
} from "@elabs-ai/components-flow";
import { archEdgeTypes } from "../edges/edge-types";
import { archNodeTypes } from "../nodes/node-types";
import { isZoneNode } from "../nodes/zone-data";
import { useZoneAutofit } from "../nodes/use-zone-autofit";
import { zoneGalleryCollapsed, zoneGalleryEdges, zoneGalleryNodes } from "../fixtures/zone-gallery";

// DG-06 — `#zones` gallery: four owners, nested kinds, ELK layout once measured, auto-fit.

/**
 * P4: library gap — the fixture's `collapsed: true` is not a collapse flow can undo:
 * `expandGroup` needs the snapshot `collapseGroup` stashes (group-operations.ts:315). So the zones render expanded, get laid out,
 * and are then folded through `collapseGroup` (DG-06-zone-primitives.md, "Collapse").
 */
const zoneGalleryInitialNodes: Node[] = zoneGalleryNodes.map((node) =>
  isZoneNode(node) && node.data.collapsed
    ? { ...node, data: { ...node.data, collapsed: false } }
    : node,
);

export function ZoneGalleryView() {
  return (
    <ReactFlowProvider>
      <ZoneGalleryCanvas />
    </ReactFlowProvider>
  );
}

function ZoneGalleryCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(zoneGalleryInitialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(zoneGalleryEdges);
  const initialized = useNodesInitialized();
  const { fitView, getNodes } = useReactFlow();
  const laidOut = useRef(false);

  // Lay out once the leaves are MEASURED, so ELK sizes zones from the real node boxes
  // (unmeasured leaves fall back to 172×40 and would overflow their zones).
  useEffect(() => {
    if (!initialized || laidOut.current) return;
    laidOut.current = true;
    const measured = getNodes();
    const groups = measured.filter(isZoneNode).map((zone) => ({
      id: zone.id,
      children: measured.filter((node) => node.parentId === zone.id).map((node) => node.id),
    }));
    void layoutFlowElk(measured, zoneGalleryEdges, { direction: "LR", groups }).then((result) => {
      // P4: library gap — `layoutFlowElk` stamps `extent: "parent"` on every child
      // (layout-flow-elk.ts:359), which clamps a drag at the zone edge; auto-fit needs
      // the drag to cross it. Stripped here.
      let next = {
        nodes: result.nodes.map(({ extent: _extent, ...node }) => node as Node),
        edges: result.edges,
      };
      if (process.env.NODE_ENV !== "production") {
        // One line per node: parent-relative position (a child under a zone header
        // must have y ≥ 44) and, for zones, the size ELK gave it.
        console.log(
          `[DG-06] layoutFlowElk engine=${result.engine}\n` +
            next.nodes
              .map(
                (node) =>
                  `${node.id} parent=${node.parentId ?? "-"} ` +
                  `x=${Math.round(node.position.x)} y=${Math.round(node.position.y)}` +
                  (isZoneNode(node) ? ` w=${node.width} h=${node.height}` : ""),
              )
              .join("\n"),
        );
      }
      for (const id of zoneGalleryCollapsed) {
        next = collapseGroup(next.nodes, next.edges, id);
      }
      setNodes(next.nodes);
      setEdges(next.edges);
      // P4: library gap — not CanvasShell's `fitViewKey`: its clamp check reads a numeric
      // padding as a fraction of the pane PER SIDE, React Flow's `fitView` as a zoom-out
      // factor (≈ half that), so every width-limited fit counts as "overflowing" and is
      // pinned left, pushing the right-hand zones off-screen (DG-06 findings, "Re-fit").
      // A plain `fitView` once the auto-fit has settled on the laid-out geometry.
      window.setTimeout(() => void fitView({ padding: 0.1 }), 150);
    });
  }, [initialized, fitView, getNodes, setNodes, setEdges]);

  useZoneAutofit(nodes, setNodes);

  return (
    <CanvasShell
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      // Module-level maps: React Flow warns when `nodeTypes`/`edgeTypes` are fresh each render.
      nodeTypes={archNodeTypes}
      edgeTypes={archEdgeTypes}
      // No canvas delete: the YAML is the source of truth (plan D2) and there is no undo
      // yet (DG-16) — wave-1 review m4.
      deleteKeyCode={null}
      proOptions={{ hideAttribution: true }}
    >
      <FlowMiniMap position="bottom-left" pannable zoomable />
      <ZoomControls />
    </CanvasShell>
  );
}
