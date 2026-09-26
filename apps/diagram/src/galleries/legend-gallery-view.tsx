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

// m2: the route-hash grammar used to sit in the visible title block's meta line; it is
// documented on `parseLegendMode` below instead (`#legend` → "auto"; `#legend/none` →
// "none"; `#legend/<section>[,<section>…]` → that section list).
const TITLE = {
  title: "Legend demo",
  description: "Four owners, three providers and every edge kind.",
} as const;

/**
 * M3: `fitView`'s own padding knows nothing about the `Panel`s mounted inside it — the
 * expanded legend (bottom-left, all three sections open, the fixture's default) measured
 * 174×450 px at 1440×900, right edge at x≈190; the title block measured 68 px tall, bottom
 * edge at y≈83 (`docs/findings/DG-08-legend.md`, evidence `legend-fit-bounds.json`). These
 * per-side pixel paddings reserve that column/row so `fitView` never places a node under
 * either, at the cost of a slightly smaller canvas on those two edges; `right`/`bottom`
 * keep `fitView`'s own ~5% breathing room since no panel sits there. P4: library gap —
 * `CanvasShell` should measure its own mounted `Panel`s and reserve their insets
 * automatically (`fitViewInsets="panels"`) instead of a consumer hand-computing this; its
 * `fitViewKey` re-fit path also only accepts a NUMERIC padding today
 * (`canvas-shell.tsx:244`), so a re-fit-on-layout-change canvas cannot reuse this shape yet.
 */
const FIT_VIEW_OPTIONS = {
  padding: { left: "210px", top: "100px", right: 0.05, bottom: 0.05 },
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
          // m4: a keyboard Backspace/Delete on a selected edge removed it at once, with no
          // undo and no confirm (conventions, "destructive actions confirm or offer
          // undo"), and dropped focus to `<body>`. `null` turns off React Flow's own
          // delete-key handling; a future delete affordance can wire its own confirm/undo.
          deleteKeyCode={null}
          edges={edges}
          edgeTypes={archEdgeTypes}
          fitView
          fitViewOptions={FIT_VIEW_OPTIONS}
          nodeTypes={archNodeTypes}
          nodes={nodes}
          onEdgesChange={onEdgesChange}
          onNodesChange={onNodesChange}
          proOptions={{ hideAttribution: true }}
        >
          {/* m10: this route has no app shell, so its own `<h1>` lives here. */}
          <TitleBlock description={TITLE.description} headingLevel={1} title={TITLE.title} />
          <DiagramLegend mode={mode} />
          <ZoomControls />
        </CanvasShell>
      </ReactFlowProvider>
    </main>
  );
}
