import { useMemo } from "react";
import {
  CanvasShell,
  ReactFlowProvider,
  ZoomControls,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@elabs-ai/components-flow";
import { buildLegend, type LegendMode, type LegendSection } from "../chrome/build-legend";
import { DiagramLegend } from "../chrome/diagram-legend";
import { TitleBlock } from "../chrome/title-block";
import { archEdgeTypes } from "../edges/edge-types";
import { legendDemoEdges, legendDemoNodes } from "../fixtures/legend-demo";
import { archNodeTypes } from "../nodes/node-types";
import { useHash } from "../routes/use-hash";

// DG-08: `#legend` — the spec-driven legend + title block demo, full viewport (like `#edges`).

/** The gallery's user-facing strings, in one place. */
const GALLERY_LABELS = { region: "Legend demo" } as const;

const TITLE = {
  title: "Legend demo",
  description: "Four owners, three providers, every edge kind — DG-08's fixture.",
  meta: "#legend · #legend/none · #legend/<section>[,<section>…]",
} as const;

const LEGEND_SECTIONS: readonly LegendSection[] = ["owners", "providers", "edges"];

function isLegendSection(value: string): value is LegendSection {
  return (LEGEND_SECTIONS as readonly string[]).includes(value);
}

/**
 * `#legend` → `"auto"`; `#legend/none` → `"none"`; `#legend/<section>[,<section>…]` → that
 * array (unknown section words are dropped, not thrown).
 */
function parseLegendMode(hash: string): LegendMode {
  const rest = hash.slice("#legend".length).replace(/^\//, "");
  if (!rest) return "auto";
  if (rest === "none") return "none";
  return rest.split(",").filter(isLegendSection);
}

/**
 * Step 1 check: `buildLegend` over the fixture, in `"auto"` mode, must equal exactly what
 * the fixture puts on the canvas — logged once at module load so it shows up the moment
 * `#legend` renders, without an extra render pass.
 */
if (process.env.NODE_ENV !== "production") {
  const spec = buildLegend(legendDemoNodes, legendDemoEdges, "auto");
  const expected = {
    owners: ["customer", "saas", "hosted", "partner"],
    providers: ["azure", "qlik", "aws"],
    edgeKinds: ["data", "request", "access", "control", "network"],
    secure: ["tls", "sso", "private-link"],
    hasSteps: true,
  };
  const matches = JSON.stringify(spec) === JSON.stringify(expected);
  console.log(`[DG-08] buildLegend(legendDemo, "auto") matches expected=${matches}`, spec);
  if (!matches) {
    console.error("[DG-08] buildLegend mismatch", { spec, expected });
  }
}

/** Full-viewport canvas of `fixtures/legend-demo.ts`, laid out in code (no ELK). */
export function LegendGalleryView() {
  const hash = useHash();
  const mode = useMemo(() => parseLegendMode(hash), [hash]);
  const [nodes, , onNodesChange] = useNodesState<Node>(legendDemoNodes);
  const [edges, , onEdgesChange] = useEdgesState<Edge>(legendDemoEdges);

  return (
    <main aria-label={GALLERY_LABELS.region} className="h-dvh w-full bg-background">
      <ReactFlowProvider>
        <CanvasShell
          edges={edges}
          edgeTypes={archEdgeTypes}
          fitView
          nodeTypes={archNodeTypes}
          nodes={nodes}
          onEdgesChange={onEdgesChange}
          onNodesChange={onNodesChange}
          proOptions={{ hideAttribution: true }}
        >
          <TitleBlock description={TITLE.description} meta={TITLE.meta} title={TITLE.title} />
          <DiagramLegend mode={mode} />
          <ZoomControls />
        </CanvasShell>
      </ReactFlowProvider>
    </main>
  );
}
