/**
 * Workflow-builder scaffold (copy-owned block).
 *
 * A realistic, forkable canvas that ties together the @elabs/components-flow capabilities:
 * a node palette, auto-layout, grouping, placeholder growth + insert-between,
 * an inspector, and app-owned undo/redo + copy/paste. It is a COMPOSITION of
 * installed @elabs/components-* packages — not new package API — so copy it into your app
 * and edit it freely.
 *
 * Remember to `import "@xyflow/react/dist/style.css"` once at the app root.
 * Depends on installed @elabs/components-flow + @elabs/components-ui + @xyflow/react + lucide-react.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  addEdge,
  CanvasShell,
  FlowEdge,
  FlowGroupNode,
  FlowMiniMap,
  FlowNode,
  FlowButtonEdge,
  FlowPlaceholderNode,
  InspectorPanel,
  Panel,
  useEdgesState,
  useFlowGroups,
  useFlowLayout,
  useNodesState,
  ZoomControls,
  type BrandFlowGroupNode,
  type BrandFlowNode,
  type BrandFlowPlaceholderNode,
  type Connection,
  type Edge,
  type FlowLayoutDirection,
  type FlowNodeData,
} from "@elabs/components-flow";
import { Button, cn } from "@elabs/components-ui";
import {
  Boxes,
  ClipboardPaste,
  Columns3,
  Copy,
  Database,
  Redo2,
  Rows3,
  Undo2,
  Upload,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { useCopyPaste } from "./use-copy-paste";
import { useUndoRedo } from "./use-undo-redo";

/** The nodes this canvas understands. Register them in `nodeTypes` below. */
type CanvasNode = BrandFlowNode | BrandFlowGroupNode | BrandFlowPlaceholderNode;
type CanvasEdge = Edge;

const nodeTypes = { brand: FlowNode, group: FlowGroupNode, placeholder: FlowPlaceholderNode };
const edgeTypes = { brand: FlowEdge, button: FlowButtonEdge };

const TONES: NonNullable<FlowNodeData["tone"]>[] = [
  "default",
  "accent",
  "success",
  "warning",
  "destructive",
];

interface PalettePreset {
  kind: string;
  label: string;
  tone: FlowNodeData["tone"];
  Icon: LucideIcon;
}

const PALETTE: PalettePreset[] = [
  { kind: "Source", label: "Source", tone: "accent", Icon: Database },
  { kind: "Transform", label: "Transform", tone: "default", Icon: Wand2 },
  { kind: "Output", label: "Output", tone: "success", Icon: Upload },
];

const initialNodes: CanvasNode[] = [
  {
    id: "source",
    type: "brand",
    position: { x: 80, y: 40 },
    data: { kind: "Source", title: "Ingest", tone: "accent" },
  },
  {
    id: "transform",
    type: "brand",
    position: { x: 80, y: 220 },
    data: { kind: "Transform", title: "Clean" },
  },
  {
    id: "placeholder-0",
    type: "placeholder",
    position: { x: 80, y: 400 },
    data: {},
  },
];

const initialEdges: CanvasEdge[] = [
  // A `button` edge exposes a "+" affordance to insert a node between two steps.
  {
    id: "e-source-transform",
    source: "source",
    target: "transform",
    type: "button",
    data: { label: "Insert node between Ingest and Clean" },
  },
  { id: "e-transform-placeholder-0", source: "transform", target: "placeholder-0", type: "brand" },
];

export function FlowBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasEdge>(initialEdges);

  // App-owned state (copy-own hooks, see the two files beside this one).
  const history = useUndoRedo<CanvasNode, CanvasEdge>({ nodes, edges, setNodes, setEdges });
  const clipboard = useCopyPaste<CanvasNode, CanvasEdge>({
    nodes,
    edges,
    setNodes,
    setEdges,
    onBeforePaste: history.takeSnapshot,
  });

  // Monotonic id source for newly created nodes.
  const idRef = useRef(0);
  // Flipped by growth/insert actions; the invisible <PlaceholderAutoLayout>
  // re-runs the auto-layout once the new node has been measured.
  const pendingLayoutRef = useRef(false);

  const onConnect = useCallback(
    (connection: Connection) => {
      history.takeSnapshot();
      setEdges((current) => addEdge({ ...connection, type: "brand" }, current));
    },
    [history, setEdges],
  );

  /** Palette click — drop a fresh, loose node onto the canvas. */
  const addNode = useCallback(
    (preset: PalettePreset) => {
      history.takeSnapshot();
      const id = `node-${++idRef.current}`;
      setNodes((current) => [
        ...current.map((node) => (node.selected ? { ...node, selected: false } : node)),
        {
          id,
          type: "brand",
          position: { x: 320 + (current.length % 4) * 24, y: 60 + (current.length % 4) * 24 },
          data: { kind: preset.kind, title: preset.label, tone: preset.tone },
          selected: true,
        } as CanvasNode,
      ]);
    },
    [history, setNodes],
  );

  /** Placeholder growth — convert the placeholder to a real step and grow a new tail. */
  const growPlaceholder = useCallback(
    (placeholderId: string) => {
      history.takeSnapshot();
      const step = ++idRef.current;
      const newPlaceholderId = `placeholder-${step}`;
      setNodes((current) => [
        ...current.map(
          (node): CanvasNode =>
            node.id === placeholderId
              ? ({
                  ...node,
                  type: "brand",
                  data: { kind: "Step", title: `Step ${step}` },
                } as CanvasNode)
              : node,
        ),
        // Temporary position — the auto-layout pass repositions it once measured.
        {
          id: newPlaceholderId,
          type: "placeholder",
          position: { x: 0, y: 0 },
          data: {},
        } as CanvasNode,
      ]);
      setEdges((current) => [
        ...current,
        {
          id: `e-${placeholderId}-${newPlaceholderId}`,
          source: placeholderId,
          target: newPlaceholderId,
          type: "brand",
        },
      ]);
      pendingLayoutRef.current = true;
    },
    [history, setNodes, setEdges],
  );

  /** Insert-between — split a `button` edge with a new node and rewire it. */
  const insertOnEdge = useCallback(
    (edgeId: string) => {
      const edge = edges.find((candidate) => candidate.id === edgeId);
      if (!edge) return;
      history.takeSnapshot();
      const step = ++idRef.current;
      const midId = `node-${step}`;
      const source = nodes.find((node) => node.id === edge.source);
      const target = nodes.find((node) => node.id === edge.target);
      const position =
        source && target
          ? {
              x: (source.position.x + target.position.x) / 2,
              y: (source.position.y + target.position.y) / 2,
            }
          : { x: 0, y: 0 };
      setNodes((current) => [
        ...current,
        {
          id: midId,
          type: "brand",
          position,
          data: { kind: "Step", title: `Step ${step}` },
        } as CanvasNode,
      ]);
      setEdges((current) => [
        ...current.filter((candidate) => candidate.id !== edgeId),
        {
          id: `${edgeId}-a`,
          source: edge.source,
          target: midId,
          type: "button",
          data: { label: "Insert node on edge" },
        },
        {
          id: `${edgeId}-b`,
          source: midId,
          target: edge.target,
          type: "button",
          data: { label: "Insert node on edge" },
        },
      ]);
      pendingLayoutRef.current = true;
    },
    [history, nodes, edges, setNodes, setEdges],
  );

  // The selected brand node drives the inspector.
  const selectedNode = nodes.find((node) => node.selected && node.type === "brand") as
    | BrandFlowNode
    | undefined;

  const updateSelected = useCallback(
    (patch: Partial<FlowNodeData>) => {
      if (!selectedNode) return;
      setNodes((current) =>
        current.map((node) =>
          node.id === selectedNode.id
            ? ({ ...node, data: { ...node.data, ...patch } } as CanvasNode)
            : node,
        ),
      );
    },
    [selectedNode, setNodes],
  );

  // Attach the placeholder/edge handlers at render time so each handler closes
  // over its own node/edge id (the handlers are not stored in state).
  const displayNodes = useMemo<CanvasNode[]>(
    () =>
      nodes.map((node) =>
        node.type === "placeholder"
          ? ({
              ...node,
              data: { ...node.data, onActivate: () => growPlaceholder(node.id) },
            } as CanvasNode)
          : node,
      ),
    [nodes, growPlaceholder],
  );
  const displayEdges = useMemo<CanvasEdge[]>(
    () =>
      edges.map((edge) =>
        edge.type === "button"
          ? { ...edge, data: { ...edge.data, onInsert: () => insertOnEdge(edge.id) } }
          : edge,
      ),
    [edges, insertOnEdge],
  );

  // Keyboard shortcuts: Cmd/Ctrl+Z / Shift+Z (undo/redo) + Cmd/Ctrl+C / V.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return; // don't hijack shortcuts while typing in a field
      }
      switch (event.key.toLowerCase()) {
        case "z":
          event.preventDefault();
          if (event.shiftKey) history.redo();
          else history.undo();
          break;
        case "y":
          event.preventDefault();
          history.redo();
          break;
        case "c":
          clipboard.copy();
          break;
        case "v":
          event.preventDefault();
          clipboard.paste();
          break;
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [history, clipboard]);

  return (
    <div className="flex h-[640px] w-full overflow-hidden rounded-lg border bg-card text-foreground">
      <div className="relative flex-1">
        <CanvasShell
          helperLines
          nodes={displayNodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={history.takeSnapshot}
          onBeforeDelete={async () => {
            history.takeSnapshot();
            return true;
          }}
        >
          <Palette onAdd={addNode} />
          <Toolbar
            onBeforeAction={history.takeSnapshot}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            onUndo={history.undo}
            onRedo={history.redo}
            canPaste={clipboard.canPaste}
            onCopy={clipboard.copy}
            onPaste={clipboard.paste}
          />
          <PlaceholderAutoLayout pendingRef={pendingLayoutRef} />
          <FlowMiniMap position="bottom-left" pannable zoomable />
          <ZoomControls />
        </CanvasShell>
      </div>
      <InspectorPanel
        title="Inspector"
        hasSelection={Boolean(selectedNode)}
        selectionKey={selectedNode?.id}
        emptyMessage="Select a node to edit its details."
      >
        {selectedNode ? <NodeInspector node={selectedNode} onChange={updateSelected} /> : null}
      </InspectorPanel>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Palette — click to add a loose node (rendered inside the flow as a Panel).  */
/* -------------------------------------------------------------------------- */

function Palette({ onAdd }: { onAdd: (preset: PalettePreset) => void }) {
  return (
    <Panel position="top-left">
      <div className="flex w-40 flex-col gap-0.5 rounded-lg bg-surface-elevated p-2 shadow-ring-sm">
        <p className="px-1 pb-1 text-meta font-medium uppercase tracking-wide text-muted-foreground">
          Palette
        </p>
        {PALETTE.map((preset) => (
          <button
            key={preset.kind}
            type="button"
            onClick={() => onAdd(preset)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-body",
              "hover:bg-accent hover:text-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <preset.Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>{preset.label}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Toolbar — history + clipboard (via props) and layout/grouping (via hooks).  */
/* -------------------------------------------------------------------------- */

interface ToolbarProps {
  onBeforeAction: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canPaste: boolean;
  onCopy: () => void;
  onPaste: () => void;
}

function Toolbar({
  onBeforeAction,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  canPaste,
  onCopy,
  onPaste,
}: ToolbarProps) {
  // These hooks need React Flow context, so the toolbar lives inside CanvasShell.
  const { layout, ready } = useFlowLayout();
  const { groupSelection } = useFlowGroups();

  const runLayout = (direction: FlowLayoutDirection) => {
    onBeforeAction();
    layout(direction);
  };
  const group = () => {
    onBeforeAction();
    groupSelection({ title: "Group", tone: "accent" });
  };

  return (
    <Panel position="top-center">
      <div className="flex items-center gap-0.5 rounded-lg bg-surface-elevated p-1 shadow-ring-sm">
        <ToolbarButton label="Undo" onClick={onUndo} disabled={!canUndo}>
          <Undo2 aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Redo" onClick={onRedo} disabled={!canRedo}>
          <Redo2 aria-hidden="true" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton label="Copy selection" onClick={onCopy}>
          <Copy aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Paste" onClick={onPaste} disabled={!canPaste}>
          <ClipboardPaste aria-hidden="true" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton label="Group selection" onClick={group}>
          <Boxes aria-hidden="true" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          label="Auto-layout top to bottom"
          onClick={() => runLayout("TB")}
          disabled={!ready}
        >
          <Rows3 aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Auto-layout left to right"
          onClick={() => runLayout("LR")}
          disabled={!ready}
        >
          <Columns3 aria-hidden="true" />
        </ToolbarButton>
      </div>
    </Panel>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

function ToolbarDivider() {
  return <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />;
}

/* -------------------------------------------------------------------------- */
/* Auto-layout after placeholder growth / edge insertion.                      */
/* -------------------------------------------------------------------------- */

function PlaceholderAutoLayout({ pendingRef }: { pendingRef: React.MutableRefObject<boolean> }) {
  const { layout, ready } = useFlowLayout();
  // `ready` flips false→true when a freshly added node gets measured; that's the
  // cue to lay out (never against an unmeasured 0×0 node).
  useEffect(() => {
    if (pendingRef.current && ready) {
      pendingRef.current = false;
      layout("TB");
    }
  }, [ready, layout, pendingRef]);
  return null;
}

/* -------------------------------------------------------------------------- */
/* Inspector — edit the selected node's details.                               */
/* -------------------------------------------------------------------------- */

function NodeInspector({
  node,
  onChange,
}: {
  node: BrandFlowNode;
  onChange: (patch: Partial<FlowNodeData>) => void;
}) {
  const fieldClass =
    "w-full rounded-md border border-input bg-background px-2 py-1.5 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-meta font-medium text-muted-foreground">Title</span>
        <input
          className={fieldClass}
          value={node.data.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-meta font-medium text-muted-foreground">Kind</span>
        <input
          className={fieldClass}
          value={node.data.kind ?? ""}
          placeholder="e.g. Transform…"
          onChange={(event) => onChange({ kind: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-meta font-medium text-muted-foreground">Tone</span>
        <select
          className={fieldClass}
          value={node.data.tone ?? "default"}
          onChange={(event) => onChange({ tone: event.target.value as FlowNodeData["tone"] })}
        >
          {TONES.map((tone) => (
            <option key={tone} value={tone}>
              {tone}
            </option>
          ))}
        </select>
      </label>
      <dl className="flex items-center justify-between border-t pt-3 text-meta">
        <dt className="text-muted-foreground">Node id</dt>
        <dd className="font-mono text-foreground">{node.id}</dd>
      </dl>
    </div>
  );
}
