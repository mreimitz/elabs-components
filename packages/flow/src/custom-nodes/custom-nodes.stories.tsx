/**
 * Custom nodes — how to write your OWN node type on the branded canvas.
 *
 * Nothing here is new package API. Every node below is a plain React component
 * registered in `nodeTypes`, built from React Flow's `Handle`/`NodeToolbar`/
 * `NodeResizer`, `@elabs-ai/components-ui` primitives and the three conventions
 * `FlowNode` itself follows. Copy the one closest to what you need.
 *
 * The three conventions (see `nodeCardClassName` / `handleClassName` below):
 *
 * 1. The painted card IS the node box. Handles live inside it, so their dots sit
 *    on its border. Extra rows go INSIDE the card, never beside it.
 * 2. Every `<Handle>` carries `FLOW_HANDLE_ANCHOR_CLASS` — a connector dot is a
 *    measurement anchor and must never be mid-transition when React Flow reads it.
 * 3. React Flow focuses ITS wrapper, not your div, so the focus indicator is the
 *    proxied flavour: `[[data-id]:focus-visible_&]:focus-ring-static`. `selected`
 *    paints a ring of its own; the two never merge.
 *
 * Controls inside a node (inputs, switches, buttons) carry React Flow's `nodrag`
 * class so a click or a text selection does not start a node drag.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { type ReactNode } from "react";
import {
  Handle,
  NodeResizer,
  NodeToolbar,
  Position,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  Braces,
  Copy,
  FileSpreadsheet,
  Filter,
  Mail,
  Play,
  StickyNote,
  Trash2,
  Webhook,
} from "lucide-react";
import {
  Badge,
  Button,
  IconButton,
  Input,
  Label,
  Meter,
  StatusBadge,
  Switch,
  cn,
} from "@elabs-ai/components-ui";
import { CanvasShell } from "../canvas-shell";
import { FlowEdge } from "../flow-edge";
import { FLOW_HANDLE_ANCHOR_CLASS } from "../flow-handle";
import { FlowNode, type BrandFlowNode } from "../flow-node";

/* -------------------------------------------------------------------------- */
/* The shared conventions, written once.                                       */
/* -------------------------------------------------------------------------- */

/** Convention 1 + 3: the card is the node box, and it paints the proxied focus ring. */
const nodeCardClassName = (selected: boolean | undefined, className?: string) =>
  cn(
    "rounded-lg border border-border bg-flow-node text-flow-node-foreground shadow-sm",
    "transition-[box-shadow,border-color] duration-fast ease-standard",
    selected && "ring-2 ring-ring",
    "[[data-id]:focus-visible_&]:focus-ring-static",
    className,
  );

/** Convention 2: the anchor class goes last on every handle. */
const handleClassName = `!size-2 !border-2 !border-flow-edge !bg-flow-node ${FLOW_HANDLE_ANCHOR_CLASS}`;

const edgeTypes = { brand: FlowEdge };
/** Fit at reading size: a two-node story should not be blown up to React Flow’s max zoom. */
const fitViewOptions = { maxZoom: 1, padding: 0.2 };

function Stage({ height = 320, children }: { height?: number; children: ReactNode }) {
  return <div style={{ height }}>{children}</div>;
}

/* -------------------------------------------------------------------------- */
/* 1. Sectioned card — header, body, footer.                                   */
/* -------------------------------------------------------------------------- */

type SectionedNode = Node<
  { title: string; kind: string; icon: ReactNode; lines: [string, string][]; footer: string },
  "sectioned"
>;

function SectionedCardNode({ data, selected }: NodeProps<SectionedNode>) {
  return (
    <div className={nodeCardClassName(selected, "w-60")} data-slot="sectioned-node">
      <Handle className={handleClassName} position={Position.Left} type="target" />
      <Handle className={handleClassName} position={Position.Right} type="source" />
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span aria-hidden="true" className="text-muted-foreground [&_svg]:size-4">
          {data.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-eyebrow text-muted-foreground">{data.kind}</div>
          <div className="truncate text-body font-medium">{data.title}</div>
        </div>
      </div>
      <dl className="flex flex-col gap-1 px-3 py-2 text-caption">
        {data.lines.map(([term, value]) => (
          <div className="flex justify-between gap-3" key={term}>
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="truncate font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-border px-3 py-1.5 text-meta text-muted-foreground">
        {data.footer}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Status node — an execution state with a second channel (glyph + word).   */
/* -------------------------------------------------------------------------- */

type StepStatus = "pending" | "running" | "complete" | "failed";
type StatusNodeType = Node<{ title: string; detail: string; status: StepStatus }, "status">;

const statusBorder: Record<StepStatus, string> = {
  pending: "border-border",
  running: "border-info",
  complete: "border-success",
  failed: "border-destructive",
};

function StatusNode({ data, selected }: NodeProps<StatusNodeType>) {
  return (
    <div
      className={nodeCardClassName(selected, cn("w-64 px-3 py-2", statusBorder[data.status]))}
      data-slot="status-node"
      data-status={data.status}
    >
      <Handle className={handleClassName} position={Position.Left} type="target" />
      <Handle className={handleClassName} position={Position.Right} type="source" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-body font-medium">{data.title}</div>
          <div className="truncate text-caption text-muted-foreground">{data.detail}</div>
        </div>
        {/* StatusBadge pairs every tone with its own glyph, so the state survives greyscale. */}
        <StatusBadge size="sm" status={data.status} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Labelled ports — one handle per row, each with a stable id.              */
/* -------------------------------------------------------------------------- */

type PortsNodeType = Node<{ title: string; inputs: string[]; outputs: string[] }, "ports">;

function PortRow({ id, label, side }: { id: string; label: string; side: "in" | "out" }) {
  return (
    // `relative` makes THIS row the handle's positioning box, so the dot sits at
    // the row's mid-line on the card's edge instead of the card's mid-line.
    <li
      className={cn("relative px-3 py-1 text-caption", side === "out" ? "text-end" : "text-start")}
    >
      <Handle
        className={handleClassName}
        id={id}
        position={side === "in" ? Position.Left : Position.Right}
        type={side === "in" ? "target" : "source"}
      />
      <span className="font-mono">{label}</span>
    </li>
  );
}

function PortsNode({ data, selected }: NodeProps<PortsNodeType>) {
  return (
    <div className={nodeCardClassName(selected, "w-56")} data-slot="ports-node">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Braces aria-hidden="true" className="size-4 text-muted-foreground" />
        <span className="truncate text-body font-medium">{data.title}</span>
      </div>
      <div className="grid grid-cols-2 py-1">
        <ul aria-label="Inputs">
          {data.inputs.map((port) => (
            <PortRow id={`in:${port}`} key={port} label={port} side="in" />
          ))}
        </ul>
        <ul aria-label="Outputs">
          {data.outputs.map((port) => (
            <PortRow id={`out:${port}`} key={port} label={port} side="out" />
          ))}
        </ul>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Node toolbar — actions that appear with the selection.                   */
/* -------------------------------------------------------------------------- */

type ToolbarNodeType = Node<{ title: string; subtitle: string }, "toolbar">;

function ToolbarNode({ id, data, selected }: NodeProps<ToolbarNodeType>) {
  const { deleteElements, getNode, addNodes } = useReactFlow();
  const duplicate = () => {
    const self = getNode(id);
    if (!self) return;
    addNodes({
      ...self,
      id: `${id}-copy-${Date.now()}`,
      position: { x: self.position.x + 32, y: self.position.y + 72 },
      selected: false,
    });
  };
  return (
    <div className={nodeCardClassName(selected, "w-52 px-3 py-2")} data-slot="toolbar-node">
      {/* Visible while the node is selected; React Flow portals it above the node. */}
      <NodeToolbar
        className="nodrag flex items-center gap-0.5 rounded-md bg-surface-elevated p-0.5 shadow-ring-sm"
        position={Position.Top}
      >
        <IconButton icon={<Play aria-hidden="true" />} label="Run from here" size="icon-sm" />
        <IconButton
          icon={<Copy aria-hidden="true" />}
          label="Duplicate"
          onClick={duplicate}
          size="icon-sm"
        />
        <IconButton
          icon={<Trash2 aria-hidden="true" />}
          label="Delete"
          onClick={() => void deleteElements({ nodes: [{ id }] })}
          size="icon-sm"
        />
      </NodeToolbar>
      <Handle className={handleClassName} position={Position.Left} type="target" />
      <Handle className={handleClassName} position={Position.Right} type="source" />
      <div className="truncate text-body font-medium">{data.title}</div>
      <div className="truncate text-caption text-muted-foreground">{data.subtitle}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. Editable fields — controls inside a node write back to its data.         */
/* -------------------------------------------------------------------------- */

type FilterNodeType = Node<{ field: string; threshold: number; enabled: boolean }, "filter">;

function FilterNode({ id, data, selected }: NodeProps<FilterNodeType>) {
  const { updateNodeData } = useReactFlow();
  return (
    <div className={nodeCardClassName(selected, "w-64")} data-slot="filter-node">
      <Handle className={handleClassName} position={Position.Left} type="target" />
      <Handle className={handleClassName} position={Position.Right} type="source" />
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Filter aria-hidden="true" className="size-4 text-muted-foreground" />
        <span className="flex-1 truncate text-body font-medium">Filter rows</span>
        <Switch
          aria-label="Filter enabled"
          checked={data.enabled}
          className="nodrag"
          onCheckedChange={(enabled) => updateNodeData(id, { enabled })}
        />
      </div>
      {/* `nodrag` on the fields: typing and selecting text must not drag the node. */}
      <div className="nodrag flex flex-col gap-2 px-3 py-2">
        <div className="flex flex-col gap-1">
          <Label className="text-meta text-muted-foreground" htmlFor={`${id}-field`}>
            Column
          </Label>
          <Input
            id={`${id}-field`}
            onChange={(event) => updateNodeData(id, { field: event.target.value })}
            value={data.field}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-meta text-muted-foreground" htmlFor={`${id}-threshold`}>
            Keep rows above
          </Label>
          <Input
            id={`${id}-threshold`}
            inputMode="numeric"
            onChange={(event) => updateNodeData(id, { threshold: Number(event.target.value) || 0 })}
            type="number"
            value={data.threshold}
          />
        </div>
      </div>
      <div className="border-t border-border px-3 py-1.5 font-mono text-meta text-muted-foreground">
        {data.enabled ? `${data.field || "…"} > ${data.threshold}` : "passes every row"}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 6. Annotation — a note that is not part of the graph.                       */
/* -------------------------------------------------------------------------- */

type NoteNodeType = Node<{ text: string }, "note">;

function NoteNode({ data, selected }: NodeProps<NoteNodeType>) {
  return (
    // No handles: a note cannot be wired. It still takes selection and focus.
    <div
      className={cn(
        "flex w-56 gap-2 rounded-md border border-dashed border-border-strong bg-surface-muted px-3 py-2",
        "text-caption text-muted-foreground",
        selected && "ring-2 ring-ring",
        "[[data-id]:focus-visible_&]:focus-ring-static",
      )}
      data-slot="note-node"
    >
      <StickyNote aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <p>{data.text}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. Resizable — the node takes whatever box the reader drags it to.          */
/* -------------------------------------------------------------------------- */

type ResizableNodeType = Node<{ title: string; body: string }, "resizable">;

function ResizableNode({ data, selected }: NodeProps<ResizableNodeType>) {
  return (
    <div
      className={nodeCardClassName(selected, "flex h-full w-full flex-col overflow-hidden")}
      data-slot="resizable-node"
    >
      <NodeResizer
        handleClassName="!size-2 !rounded-sm !border-ring !bg-flow-node"
        isVisible={selected}
        lineClassName="!border-ring"
        minHeight={96}
        minWidth={176}
      />
      <Handle className={handleClassName} position={Position.Left} type="target" />
      <Handle className={handleClassName} position={Position.Right} type="source" />
      <div className="border-b border-border px-3 py-2 text-body font-medium">{data.title}</div>
      <p className="min-h-0 flex-1 overflow-auto px-3 py-2 text-caption text-muted-foreground">
        {data.body}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stories                                                                     */
/* -------------------------------------------------------------------------- */

const meta = {
  title: "Flow/Custom Nodes",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "How to write your own node type on the branded canvas, with nothing but today’s exports. Each story is one self-contained node component registered in `nodeTypes`. They all follow the three conventions `FlowNode` follows: the painted card is the node box and the handles sit inside it; every `<Handle>` carries `FLOW_HANDLE_ANCHOR_CLASS`; and the keyboard focus indicator is the proxied `[[data-id]:focus-visible_&]:focus-ring-static`, separate from the `selected` ring. Controls inside a node carry React Flow’s `nodrag` class. When `FlowNode` plus its `footer` slot is enough, prefer it — see the last story.",
      },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** A card with a header, a definition list and a footer — the base shape most custom nodes start from. */
export const SectionedCard: Story = {
  render: () => {
    const nodes: SectionedNode[] = [
      {
        id: "inbox",
        type: "sectioned",
        position: { x: 0, y: 0 },
        data: {
          kind: "Trigger",
          title: "Shared AP inbox",
          icon: <Mail />,
          lines: [
            ["Mailbox", "ap@acme.example"],
            ["Polls every", "5 min"],
            ["Last 24 h", "212 messages"],
          ],
          footer: "Attachments: PDF, XML",
        },
      },
      {
        id: "sheet",
        type: "sectioned",
        position: { x: 340, y: 0 },
        data: {
          kind: "Output",
          title: "Accruals workbook",
          icon: <FileSpreadsheet />,
          lines: [
            ["Sheet", "2026-Q3"],
            ["Mode", "Append rows"],
            ["Owner", "Finance ops"],
          ],
          footer: "Writes 1 row per invoice",
        },
      },
    ];
    const edges: Edge[] = [{ id: "e", source: "inbox", target: "sheet", type: "brand" }];
    return (
      <Stage>
        <CanvasShell
          fitViewOptions={fitViewOptions}
          edgeTypes={edgeTypes}
          edges={edges}
          nodeTypes={{ sectioned: SectionedCardNode }}
          nodes={nodes}
        />
      </Stage>
    );
  },
};

/** One node per execution state. The border tints, and `StatusBadge` repeats the state as a glyph and a word. */
export const StatusStates: Story = {
  render: () => {
    const steps: [string, string, StepStatus][] = [
      ["Fetch orders", "1,204 rows · 0.8 s", "complete"],
      ["Match payments", "Row 640 of 1,204", "running"],
      ["Post to ledger", "Waiting for match", "pending"],
      ["Notify treasury", "SMTP timeout", "failed"],
    ];
    const nodes: StatusNodeType[] = steps.map(([title, detail, status], index) => ({
      id: `s${index}`,
      type: "status",
      position: { x: index * 310, y: index % 2 === 0 ? 0 : 70 },
      data: { title, detail, status },
    }));
    const edges: Edge[] = steps.slice(1).map((_, index) => ({
      id: `e${index}`,
      source: `s${index}`,
      target: `s${index + 1}`,
      type: "brand",
    }));
    return (
      <Stage height={280}>
        <CanvasShell
          fitViewOptions={fitViewOptions}
          edgeTypes={edgeTypes}
          edges={edges}
          nodeTypes={{ status: StatusNode }}
          nodes={nodes}
        />
      </Stage>
    );
  },
};

/** A handle per row, each with its own id, so an edge names the exact port it uses (`sourceHandle` / `targetHandle`). */
export const LabelledPorts: Story = {
  render: () => {
    const nodes: PortsNodeType[] = [
      {
        id: "parse",
        type: "ports",
        position: { x: 0, y: 20 },
        data: { title: "Parse invoice", inputs: ["document"], outputs: ["header", "lines", "tax"] },
      },
      {
        id: "match",
        type: "ports",
        position: { x: 340, y: 0 },
        data: {
          title: "Three-way match",
          inputs: ["header", "lines", "purchase_order"],
          outputs: ["matched", "exceptions"],
        },
      },
    ];
    const edges: Edge[] = [
      {
        id: "e-header",
        source: "parse",
        sourceHandle: "out:header",
        target: "match",
        targetHandle: "in:header",
        type: "brand",
      },
      {
        id: "e-lines",
        source: "parse",
        sourceHandle: "out:lines",
        target: "match",
        targetHandle: "in:lines",
        type: "brand",
      },
    ];
    return (
      <Stage>
        <CanvasShell
          fitViewOptions={fitViewOptions}
          edgeTypes={edgeTypes}
          edges={edges}
          nodeTypes={{ ports: PortsNode }}
          nodes={nodes}
        />
      </Stage>
    );
  },
};

/** Select a node (click, or Tab then Enter) and its actions appear above it. Duplicate and Delete are wired to the flow. */
export const WithToolbar: Story = {
  render: () => {
    const nodes: ToolbarNodeType[] = [
      {
        id: "hook",
        type: "toolbar",
        position: { x: 0, y: 60 },
        selected: true,
        data: { title: "Order webhook", subtitle: "POST /hooks/orders" },
      },
      {
        id: "enrich",
        type: "toolbar",
        position: { x: 300, y: 60 },
        data: { title: "Enrich customer", subtitle: "CRM lookup by email" },
      },
    ];
    const edges: Edge[] = [{ id: "e", source: "hook", target: "enrich", type: "brand" }];
    return (
      <Stage>
        <CanvasShell
          fitViewOptions={fitViewOptions}
          defaultEdges={edges}
          defaultNodes={nodes}
          edgeTypes={edgeTypes}
          nodeTypes={{ toolbar: ToolbarNode }}
        />
      </Stage>
    );
  },
};

/** Inputs and a switch inside the node write to its `data` through `updateNodeData`; the footer reads it back. */
export const EditableFields: Story = {
  render: () => {
    const nodes: (FilterNodeType | BrandFlowNode)[] = [
      {
        id: "source",
        type: "brand",
        position: { x: 0, y: 70 },
        data: { kind: "Source", title: "Open invoices", icon: <Webhook /> },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: "filter",
        type: "filter",
        position: { x: 280, y: 0 },
        data: { field: "amount_eur", threshold: 5000, enabled: true },
      },
    ];
    const edges: Edge[] = [{ id: "e", source: "source", target: "filter", type: "brand" }];
    return (
      <Stage height={340}>
        <CanvasShell
          fitViewOptions={fitViewOptions}
          defaultEdges={edges}
          defaultNodes={nodes}
          edgeTypes={edgeTypes}
          nodeTypes={{ brand: FlowNode, filter: FilterNode }}
        />
      </Stage>
    );
  },
};

/** A note has no handles, so it cannot be wired into the graph — it explains the graph. */
export const Annotation: Story = {
  render: () => {
    const nodes: (NoteNodeType | BrandFlowNode)[] = [
      {
        id: "approve",
        type: "brand",
        position: { x: 0, y: 0 },
        data: { kind: "Approval", title: "Controller sign-off", tone: "warning" },
      },
      {
        id: "note",
        type: "note",
        position: { x: 230, y: -6 },
        data: {
          text: "Required above €5,000 since the 2026 audit. Do not remove without Finance.",
        },
      },
    ];
    return (
      <Stage height={240}>
        <CanvasShell
          fitViewOptions={fitViewOptions}
          edges={[]}
          nodeTypes={{ brand: FlowNode, note: NoteNode }}
          nodes={nodes}
        />
      </Stage>
    );
  },
};

/** Select the node and drag a corner. The card fills the box React Flow gives it (`h-full w-full`). */
export const Resizable: Story = {
  render: () => {
    const nodes: ResizableNodeType[] = [
      {
        id: "prompt",
        type: "resizable",
        position: { x: 0, y: 0 },
        width: 280,
        height: 140,
        selected: true,
        data: {
          title: "Reply guidelines",
          body: "Answer in the customer’s language. Quote the order number. Never promise a delivery date the carrier has not confirmed.",
        },
      },
    ];
    return (
      <Stage>
        <CanvasShell
          fitViewOptions={fitViewOptions}
          defaultEdges={[]}
          defaultNodes={nodes}
          nodeTypes={{ resizable: ResizableNode }}
        />
      </Stage>
    );
  },
};

/**
 * Before writing a node at all: `FlowNode` takes a `footer` — a meter, a chip row, a button —
 * and keeps the handles, tones and focus ring for free.
 */
export const FooterSlotFirst: Story = {
  render: () => {
    const nodes: BrandFlowNode[] = [
      {
        id: "queue",
        type: "brand",
        position: { x: 0, y: 0 },
        data: {
          kind: "Queue",
          title: "Exceptions",
          subtitle: "38 of 50 slots used",
          tone: "warning",
          footer: (
            <Meter
              aria-label="Exceptions queue: 38 of 50 slots used"
              max={50}
              size="xs"
              value={38}
            />
          ),
        },
      },
      {
        id: "tags",
        type: "brand",
        position: { x: 260, y: 0 },
        data: {
          kind: "Classifier",
          title: "Route by topic",
          footer: (
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">billing</Badge>
              <Badge variant="secondary">delivery</Badge>
              <Badge variant="secondary">returns</Badge>
            </div>
          ),
        },
      },
      {
        id: "manual",
        type: "brand",
        position: { x: 520, y: 0 },
        data: {
          kind: "Manual step",
          title: "Review sample",
          footer: (
            <Button className="nodrag w-full" size="sm" variant="secondary">
              Open 12 items
            </Button>
          ),
        },
      },
    ];
    return (
      <Stage height={260}>
        <CanvasShell
          fitViewOptions={fitViewOptions}
          edges={[]}
          nodeTypes={{ brand: FlowNode }}
          nodes={nodes}
        />
      </Stage>
    );
  },
};
