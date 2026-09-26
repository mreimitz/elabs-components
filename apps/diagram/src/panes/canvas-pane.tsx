import { useEffect, useState } from "react";
import {
  CanvasShell,
  FlowEdge,
  FlowGroupNode,
  FlowMiniMap,
  FlowNode,
  ReactFlowProvider,
  ZoomControls,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@elabs-ai/components-flow";
import { StatePanel, cn } from "@elabs-ai/components-ui";
import { lakehouseEdges, lakehouseNodes } from "../fixtures/lakehouse-hardcoded";
import { runElk } from "../layout/run-elk";

/**
 * Declared OUTSIDE the component: React Flow warns ("It looks like you've created a new
 * nodeTypes or edgeTypes object") when either map is a fresh object literal every render
 * (verified-apis.md / this item's Step 3).
 */
const nodeTypes = { brand: FlowNode, group: FlowGroupNode };
const edgeTypes = { brand: FlowEdge };

/**
 * The `?dir=TB` query param, read exactly once on mount. The real LR/TB toggle is
 * DG-05's top bar — out of this item's `touches` (orchestrator note).
 */
function readDirectionOnce(): "LR" | "TB" {
  if (typeof window === "undefined") return "LR";
  return new URLSearchParams(window.location.search).get("dir") === "TB" ? "TB" : "LR";
}

/**
 * React Flow's default edge name is "Edge from <source-id> to <target-id>"; name each edge
 * by its end nodes' titles and its label instead (wave-0 review m4). DG-07's
 * `edgeAriaLabel` takes over once DG-10 compiles to `arch/flow` edges.
 */
function withEdgeNames(edges: Edge[], nodes: Node[]): Edge[] {
  const title = (id: string) => {
    const data = nodes.find((n) => n.id === id)?.data as { title?: string } | undefined;
    return data?.title ?? id;
  };
  return edges.map((edge) => {
    const label = (edge.data as { label?: string } | undefined)?.label;
    const name = `${title(edge.source)} to ${title(edge.target)}`;
    return { ...edge, ariaLabel: label ? `${name}: ${label}` : name };
  });
}

type LayoutState = "pending" | "ready" | "error";

/**
 * The right-hand canvas. DG-03: one hard-coded lakehouse diagram
 * (`../fixtures/lakehouse-hardcoded`), laid out by nested `layoutFlowElk`
 * (`../layout/run-elk`) once on mount — the experiment this item measures. `CanvasShell`
 * renders its own `Background` (default `background=true`), so no second one is added
 * here.
 */
export function CanvasPane() {
  const [direction] = useState(readDirectionOnce);
  // The fixture's nodes all sit at {x:0,y:0} until ELK resolves. They still mount (React
  // Flow must measure them for the post-layout fit), but the canvas stays `invisible` —
  // hidden from sight and from assistive tech — behind a loading state (wave-0 review M1).
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(lakehouseNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(lakehouseEdges);
  const [fitViewKey, setFitViewKey] = useState(0);
  const [layout, setLayout] = useState<LayoutState>("pending");

  useEffect(() => {
    let current = true;
    runElk(lakehouseNodes, lakehouseEdges, direction).then(
      (result) => {
        if (!current) return;
        setNodes(result.nodes);
        setEdges(withEdgeNames(result.edges, result.nodes));
        setLayout("ready");
        // Bumped after layout resolves so `CanvasShell`'s `fitViewKey` re-fits onto the
        // laid-out positions — its own `fitView` prop only fits ONCE, on first paint,
        // which for this canvas is before `runElk` has moved anything off `{x:0,y:0}`.
        setFitViewKey((key) => key + 1);
        // `process.env` (not `import.meta.env`): the app's `tsconfig.json` — out of this
        // item's `touches` — has no `vite/client` in `types`, so `import.meta.env` does not
        // typecheck; `process.env` resolves via the existing DG-01 ambient shim
        // (`src/types/process-env.d.ts`).
        if (process.env.NODE_ENV !== "production") {
          console.table(
            result.nodes.map((n) => ({
              id: n.id,
              parentId: n.parentId ?? "",
              x: Math.round(n.position.x),
              y: Math.round(n.position.y),
              w: n.width ?? "",
              h: n.height ?? "",
            })),
          );
          console.log(
            `[DG-03] layoutFlowElk engine=${result.engine} direction=${direction} ms=${result.ms}`,
          );
        }
      },
      () => {
        if (current) setLayout("error");
      },
    );
    return () => {
      current = false;
    };
    // Runs once: the fixture is a module-level constant and `direction` is read once
    // (see `readDirectionOnce`) — the same one-shot pattern as the package's own
    // `layout-flow-elk.stories.tsx`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

  return (
    <div className="relative h-full w-full">
      <div className={cn("h-full w-full", layout !== "ready" && "invisible")}>
        <ReactFlowProvider>
          <CanvasShell
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitViewKey={fitViewKey}
            proOptions={{ hideAttribution: true }}
          >
            {/*
             * Both default to `position="bottom-right"` (React Flow's own
             * MiniMap default), which stacks the minimap directly over the zoom
             * controls — moving the minimap to the other bottom corner is the
             * established pattern (registry/blocks/flow-builder,
             * data-model-viewer-01, agent-designer-01), not a DG-02 invention.
             */}
            {/* Hidden below `md`: at phone width it covers the zoom controls (wave-0 review m11). */}
            <FlowMiniMap position="bottom-left" pannable zoomable className="max-md:hidden" />
            <ZoomControls />
          </CanvasShell>
        </ReactFlowProvider>
      </div>
      {/* P4: library gap — CanvasShell has no `loading` prop; the state overlays the canvas.
          See docs/findings/DG-03-canvas-states.md. */}
      {layout !== "ready" && (
        <div className="absolute inset-0 grid place-items-center p-6">
          {layout === "pending" ? (
            <StatePanel kind="loading" title="Laying out the diagram…" />
          ) : (
            <StatePanel
              kind="error"
              title="The diagram could not be laid out"
              description="The layout engine failed. Reload the page to try again."
            />
          )}
        </div>
      )}
    </div>
  );
}
