import { useMemo } from "react";
import {
  CanvasShell,
  ReactFlowProvider,
  ZoomControls,
  type Edge,
  type Node,
} from "@elabs-ai/components-flow";
import { StatePanel } from "@elabs-ai/components-ui";
import { Workflow } from "lucide-react";
import { TitleBlock } from "../chrome/title-block";
import { useDiagram } from "../state/diagram-store";
import { buildVisualGraph } from "../visual/build-visual-graph";
import { deriveVisualLens } from "../visual/derive-visual";
import { layoutVisualLens } from "../visual/lane-layout";
import { visualEdgeTypes, visualNodeTypes } from "../visual/visual-node-types";

/** The pane's strings, in one place (`conventions/i18n-strings`). */
const VISUAL_LABELS = {
  emptyTitle: "Nothing to draw yet",
  emptyHint: "Write YAML in the editor.",
  source: (boxes: number, lanes: number) =>
    `Atlas · visual lens · ${boxes} ${boxes === 1 ? "box" : "boxes"} · ${lanes} ${lanes === 1 ? "lane" : "lanes"}`,
} as const;

/**
 * maintainer 2026-09-27 — the visual lens's canvas. Derived, laid out and built fresh from
 * the compiled technical diagram on every structural change (`src/visual/derive-visual.ts`,
 * `lane-layout.ts`, `build-visual-graph.ts` — all pure and synchronous, so there is no
 * layout-engine wait the way the technical pane has for ELK: the fit happens on the same
 * frame the canvas mounts). View-only, unconditionally: nothing here writes the file, marks
 * it dirty, or enters undo (`diagram-store`/`workspace-store` are never imported) — no drag,
 * no connect, no delete, no selection, in view OR edit mode.
 */
export function VisualCanvasPane() {
  const ast = useDiagram((s) => s.drawn.ast);
  const structure = useDiagram((s) => s.structure);

  const built = useMemo(() => {
    if (!ast) return null;
    const lens = deriveVisualLens(ast);
    const layout = layoutVisualLens(lens);
    return { ...buildVisualGraph(lens, layout), lens };
  }, [ast]);

  if (!ast || !built || built.nodes.length === 0) {
    return (
      <div className="grid h-full w-full place-items-center p-6">
        <StatePanel
          kind="empty"
          icon={<Workflow aria-hidden="true" />}
          title={VISUAL_LABELS.emptyTitle}
          description={VISUAL_LABELS.emptyHint}
        />
      </div>
    );
  }

  const source = VISUAL_LABELS.source(built.lens.boxes.length, built.lens.lanes.length);

  return (
    // `structure` changing means the technical graph reshaped, so the derived lens did too:
    // a fresh provider re-fits, the same way `TechnicalCanvasPane` keys on `loadCount`.
    <ReactFlowProvider key={structure}>
      <div className="@container h-full w-full">
        <CanvasShell
          nodes={built.nodes as Node[]}
          edges={built.edges as Edge[]}
          nodeTypes={visualNodeTypes}
          edgeTypes={visualEdgeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.1}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesReconnectable={false}
          elementsSelectable={false}
          panOnScroll
          deleteKeyCode={null}
          proOptions={{ hideAttribution: true }}
        >
          <TitleBlock title={ast.title} description={ast.description} meta={source} />
          <ZoomControls />
        </CanvasShell>
      </div>
    </ReactFlowProvider>
  );
}
