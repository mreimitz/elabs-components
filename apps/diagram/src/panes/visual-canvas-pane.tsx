import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ComponentProps,
  type RefObject,
} from "react";
import {
  CanvasShell,
  ReactFlowProvider,
  useReactFlow,
  ZoomControls,
  type Edge,
  type Node,
} from "@elabs-ai/components-flow";
import { Button, StatePanel } from "@elabs-ai/components-ui";
// P4: library gap — flow does not re-export `useNodesInitialized` (verified-apis.md → flow,
// "Not re-exported by flow"); read straight from the engine, as `use-diagram-layout.ts` does.
import { useNodesInitialized } from "@xyflow/react";
import { Workflow } from "lucide-react";
import { chromeFitPadding } from "../chrome/fit-padding";
import { TitleBlock } from "../chrome/title-block";
import { focusEditor } from "../shell/focus";
import { modeActions, useDocMode } from "../shell/mode-store";
import type { ArchDiagram } from "../spec/dialect";
import { useDiagram } from "../state/diagram-store";
import { buildVisualGraph } from "../visual/build-visual-graph";
import { deriveVisualLens } from "../visual/derive-visual";
import { layoutVisualLens } from "../visual/lane-layout";
import { visualEdgeTypes, visualNodeTypes } from "../visual/visual-node-types";

/** The pane's strings, in one place (`conventions/i18n-strings`). Mirrors
 * `canvas-pane.tsx`'s `CANVAS_LABELS` for the not-a-diagram/unsupported-version states: the
 * visual lens shares the technical pane's reasons for having nothing to draw, not a generic
 * placeholder (see `emptyState` below). */
const VISUAL_LABELS = {
  emptyTitle: "Nothing to draw yet",
  emptyHint: "Write YAML in the editor.",
  notADiagram: "The text is not a diagram",
  notADiagramHint: "Fix the first error in the editor.",
  newerFormatTitle: "This diagram uses a newer format",
  newerFormatHint: (version: string) =>
    `Atlas cannot draw format ${version} yet. It opens in a later version; the file is unchanged.`,
  fixInEditor: "Fix it in the editor.",
  editAction: "Edit",
  source: (boxes: number, lanes: number) =>
    `Atlas · visual lens · ${boxes} ${boxes === 1 ? "box" : "boxes"} · ${lanes} ${lanes === 1 ? "lane" : "lanes"}`,
} as const;

/** `Dialect "1" is not supported…` → `"1"` — the same extraction `canvas-pane.tsx` uses on the
 * same message shape (`spec/dialect/normalize.ts`'s error text). */
function issueVersion(message: string): string {
  return /Dialect "([^"]*)"/.exec(message)?.[1] ?? "?";
}

/**
 * The visual lens's canvas. Derived, laid out and built fresh from the compiled technical
 * diagram on every structural change (`src/visual/derive-visual.ts`, `lane-layout.ts`,
 * `build-visual-graph.ts` — all pure and synchronous, so there is no layout-engine wait the way
 * the technical pane has for ELK: the fit happens on the same frame the canvas mounts).
 * View-only, unconditionally: nothing here writes the file, marks it dirty, or enters undo
 * (`diagram-store`/`workspace-store` are never imported) — no drag, no connect, no delete, no
 * selection, in view OR edit mode.
 *
 * The floating `TitleBlock` (top-left) sits over whatever the fit places there; the technical
 * pane clears it with `chromeFitPadding` (`chrome/fit-padding.ts`) and this pane reuses the
 * exact same function — it needs no zone-specific change: `chromeFitPadding`'s node-aware pass
 * already treats any non-zone node as a full-height obstacle, which is what a lane or box needs
 * too. This is the ONLY fit this pane does — `<CanvasShell>` below carries no declarative
 * `fitView`/`fitViewOptions` prop, on purpose: RF's own "fit on nodes-initialized" and
 * `VisualFlow`'s effect both fire off the same `useNodesInitialized()` signal, and when the pane
 * mounts via the in-app lens toggle (as opposed to a fresh page load) RF's plain-padding fit was
 * winning the race and landing after this one, uncovering the title-block overlap this fixes.
 * One fit, one padding function, no race. A `ResizeObserver` on the pane refits on every size
 * change after that — an editor-split drag, the inspector opening or closing, or a window
 * resize — but only while the view is still exactly where the last fit left it, since this lens
 * is pannable/zoomable by hand too and a resize must not stomp on that.
 */
interface VisualFlowProps {
  paneRef: RefObject<HTMLDivElement | null>;
  ast: ArchDiagram;
  built: { nodes: Node[]; edges: Edge[]; lens: ReturnType<typeof deriveVisualLens> };
  source: string;
}

/** Renders the graph and keeps it fitted — split out from `VisualCanvasPane` because both need
 * `useReactFlow()`/`useNodesInitialized()`, which only work inside the `<ReactFlowProvider>`
 * this component is mounted under. */
function VisualFlow({ paneRef, ast, built, source }: VisualFlowProps) {
  const { getNodes, fitView } = useReactFlow();
  const initialized = useNodesInitialized();
  // Whether the user has panned/zoomed since the last programmatic fit — set only from
  // `onMoveStart`'s event argument, which xyflow passes `null` for a `fitView`/`setViewport`
  // call and a real `MouseEvent`/`TouchEvent`/`WheelEvent` for a person's own gesture. Comparing
  // `getViewport()` against a remembered value instead (the previous approach) raced `fitView`'s
  // own async contract — it returns a `Promise<boolean>` that resolves once the transform lands,
  // even at `duration: 0` — so a read taken right after CALLING `fitView` still saw the pre-fit
  // viewport, and the very next resize saw the (by then genuinely post-fit) viewport differ from
  // that stale reading, read that as "the user moved the view", and skipped refitting forever.
  const userMoved = useRef(false);

  const fit = useCallback(() => {
    const pane = paneRef.current?.querySelector<HTMLElement>(".react-flow");
    if (!pane) return;
    void fitView({ padding: chromeFitPadding(pane, getNodes()), duration: 0 }).then(() => {
      userMoved.current = false;
    });
  }, [paneRef, getNodes, fitView]);

  const handleMoveStart = useCallback<
    NonNullable<ComponentProps<typeof CanvasShell>["onMoveStart"]>
  >((event) => {
    if (event) userMoved.current = true;
  }, []);

  useEffect(() => {
    if (initialized) fit();
  }, [initialized, fit]);

  // An editor-split drag, the inspector opening/closing, or a window resize leaves the diagram
  // exactly where the old size fit it; refit on every size change, but only while the view is
  // still exactly where the last fit left it — this lens is pannable/zoomable by hand too, and a
  // resize must not stomp on that.
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane || !initialized) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!userMoved.current) fit();
      });
    });
    observer.observe(pane);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [initialized, paneRef, fit]);

  return (
    <CanvasShell
      nodes={built.nodes}
      edges={built.edges}
      nodeTypes={visualNodeTypes}
      edgeTypes={visualEdgeTypes}
      minZoom={0.1}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesReconnectable={false}
      elementsSelectable={false}
      // Edges and lane panels have nothing to do on focus, only a box's own inner button
      // (`capability-box-node.tsx`) does — so they are not tab stops; without this a screen
      // reader read out React Flow's internal edge ids ("Edge from box:6 to box:2").
      nodesFocusable={false}
      edgesFocusable={false}
      // No `panOnScroll` — the technical pane sets none either, so both lenses scroll-to-zoom
      // the same way (RF's own default), and the one gesture does the same thing in both.
      deleteKeyCode={null}
      onMoveStart={handleMoveStart}
      proOptions={{ hideAttribution: true }}
    >
      <TitleBlock title={ast.title} description={ast.description} meta={source} />
      <ZoomControls />
    </CanvasShell>
  );
}

export function VisualCanvasPane() {
  const blank = useDiagram((s) => s.text.trim() === "");
  const ast = useDiagram((s) => s.drawn.ast);
  const issues = useDiagram((s) => s.drawn.issues);
  const structure = useDiagram((s) => s.structure);
  const viewing = useDocMode() === "view";
  const paneRef = useRef<HTMLDivElement>(null);

  const built = useMemo(() => {
    if (!ast) return null;
    const lens = deriveVisualLens(ast);
    const layout = layoutVisualLens(lens);
    return { ...buildVisualGraph(lens, layout), lens };
  }, [ast]);

  if (!ast || !built || built.nodes.length === 0) {
    // Mirrors `canvas-pane.tsx`'s empty/error branches: a diagram that fails to parse or
    // validate shows its own reason, not the same placeholder as a genuinely blank file — the
    // visual lens has no separate parse step, so `drawn.issues` (the technical compile's own
    // issues) is the one source of truth for why there is nothing to draw. A valid diagram with
    // no groupable content (`ast` parses but `built` has no boxes) still gets the plain empty
    // state, exactly like the technical pane's own `noNodes` case.
    const editAction =
      viewing && !ast ? (
        <Button
          size="sm"
          onClick={() => {
            modeActions.setMode("edit");
            focusEditor();
          }}
        >
          {VISUAL_LABELS.editAction}
        </Button>
      ) : undefined;
    const firstIssue = !ast ? issues[0] : undefined;
    if (!blank && firstIssue) {
      if (firstIssue.code === "unsupported-version") {
        return (
          <div className="grid h-full w-full place-items-center p-6">
            <StatePanel
              kind="empty"
              icon={<Workflow aria-hidden="true" />}
              title={VISUAL_LABELS.newerFormatTitle}
              description={VISUAL_LABELS.newerFormatHint(issueVersion(firstIssue.message))}
            />
          </div>
        );
      }
      return (
        <div className="grid h-full w-full place-items-center p-6">
          <StatePanel
            kind="error"
            title={VISUAL_LABELS.notADiagram}
            description={`${firstIssue.message} ${VISUAL_LABELS.fixInEditor}`}
            actions={editAction}
          />
        </div>
      );
    }
    return (
      <div className="grid h-full w-full place-items-center p-6">
        <StatePanel
          kind="empty"
          icon={<Workflow aria-hidden="true" />}
          title={VISUAL_LABELS.emptyTitle}
          description={VISUAL_LABELS.emptyHint}
          actions={editAction}
        />
      </div>
    );
  }

  const source = VISUAL_LABELS.source(built.lens.boxes.length, built.lens.lanes.length);

  return (
    // `structure` changing means the technical graph reshaped, so the derived lens did too:
    // a fresh provider re-fits, the same way `TechnicalCanvasPane` keys on `loadCount`.
    <ReactFlowProvider key={structure}>
      <div ref={paneRef} className="@container h-full w-full">
        <VisualFlow
          paneRef={paneRef}
          ast={ast}
          built={built as VisualFlowProps["built"]}
          source={source}
        />
      </div>
    </ReactFlowProvider>
  );
}
