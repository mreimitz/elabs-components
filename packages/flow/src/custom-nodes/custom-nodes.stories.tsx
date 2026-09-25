/**
 * Custom nodes — how to write your OWN node type on the branded canvas.
 *
 * Every node below is a plain React component registered in `nodeTypes`, built on the
 * same two parts `FlowNode` is built on: `FlowNodeCard` (the node box — selection ring,
 * proxied keyboard focus, tone) and `FlowPort` (the connector dot — anchor class, and
 * `in:<port>`/`out:<port>` ids from its `port` prop). A tone is `flowToneVariants` on the
 * card: mark a part `data-flow-tone-part="mark"` or `"ink"` to have it follow the tone,
 * and add `FlowToneIndicator` so the tone is never colour alone. The reasons behind each
 * part live in their own docblocks. Copy the node closest to what you need.
 *
 * Controls inside a node (inputs, switches, buttons) carry React Flow's `nodrag`
 * class so a click or a text selection does not start a node drag.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { type ReactNode } from "react";
import {
  FlowNodeCard,
  FlowPort,
  FlowToneIndicator,
  NodeResizer,
  NodeToolbar,
  Position,
  resolveFlowTone,
  useReactFlow,
  type Edge,
  type FlowNodeBaseData,
  type FlowTone,
  type Node,
  type NodeProps,
} from "../index";
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
import { FlowNode, type BrandFlowNode } from "../flow-node";

const edgeTypes = { brand: FlowEdge };
/** Fit at reading size: a two-node story should not be blown up to React Flow’s max zoom. */
const fitViewOptions = { maxZoom: 1, padding: 0.2 };

function Stage({ height = 320, children }: { height?: number; children: ReactNode }) {
  return <div style={{ height }}>{children}</div>;
}

/* -------------------------------------------------------------------------- */
/* 1. Sectioned card — header, body, footer.                                   */
/* -------------------------------------------------------------------------- */

/**
 * Extending `FlowNodeBaseData` gives the node the fields every built-in node shares —
 * `title`, `icon`, `tone`, `emphasis` — so they mean the same thing on this node as on
 * `FlowNode`.
 */
interface SectionedNodeData extends FlowNodeBaseData {
  kind: string;
  lines: [string, string][];
  footer: string;
}
type SectionedNode = Node<SectionedNodeData, "sectioned">;

function SectionedCardNode({ data, selected }: NodeProps<SectionedNode>) {
  // Maps the legacy `"default"`/`"accent"` values, so any `FlowNodeBaseData` tone is safe.
  const { tone, emphasis } = resolveFlowTone(data.tone, data.emphasis);
  return (
    <FlowNodeCard
      className="w-60"
      data-slot="sectioned-node"
      emphasis={emphasis}
      selected={selected}
      tone={tone}
    >
      <FlowPort position={Position.Left} type="target" />
      <FlowPort position={Position.Right} type="source" />
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        {/* A mark: the card's tone paints it on the fill rung. */}
        <span
          aria-hidden="true"
          className="text-muted-foreground [&_svg]:size-4"
          data-flow-tone-part="mark"
        >
          {data.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-eyebrow text-muted-foreground">{data.kind}</div>
          <div className="truncate text-body font-medium">{data.title}</div>
        </div>
        {/* The non-colour channel: a glyph plus an `sr-only` name. */}
        <FlowToneIndicator emphasis={emphasis} tone={tone} />
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
    </FlowNodeCard>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Status node — an execution state with a second channel (glyph + word).   */
/* -------------------------------------------------------------------------- */

type StepStatus = "pending" | "running" | "complete" | "failed";
type StatusNodeType = Node<{ title: string; detail: string; status: StepStatus }, "status">;

/** A domain state names its tone; the card's `flowToneVariants` owns every class. */
const statusTone: Record<StepStatus, FlowTone> = {
  pending: "neutral",
  running: "info",
  complete: "success",
  failed: "destructive",
};

function StatusNode({ data, selected }: NodeProps<StatusNodeType>) {
  return (
    <FlowNodeCard
      className="w-64 px-3 py-2"
      data-slot="status-node"
      data-status={data.status}
      selected={selected}
      tone={statusTone[data.status]}
    >
      <FlowPort position={Position.Left} type="target" />
      <FlowPort position={Position.Right} type="source" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-body font-medium">{data.title}</div>
          <div className="truncate text-caption text-muted-foreground">{data.detail}</div>
        </div>
        {/* The non-colour channel here is StatusBadge, not FlowToneIndicator: it pairs
            every state with its own glyph AND its word, so the state survives greyscale. */}
        <StatusBadge size="sm" status={data.status} />
      </div>
    </FlowNodeCard>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Labelled ports — one handle per row, each with a stable id.              */
/* -------------------------------------------------------------------------- */

type PortsNodeType = Node<{ title: string; inputs: string[]; outputs: string[] }, "ports">;

function PortRow({ port, side }: { port: string; side: "in" | "out" }) {
  return (
    // `relative` makes THIS row the handle's positioning box, so the dot sits at
    // the row's mid-line on the card's edge instead of the card's mid-line.
    <li
      className={cn("relative px-3 py-1 text-caption", side === "out" ? "text-end" : "text-start")}
    >
      {/* `port` names the handle: `in:<port>` on a target, `out:<port>` on a source. */}
      <FlowPort
        port={port}
        position={side === "in" ? Position.Left : Position.Right}
        type={side === "in" ? "target" : "source"}
      />
      <span className="font-mono">{port}</span>
    </li>
  );
}

function PortsNode({ data, selected }: NodeProps<PortsNodeType>) {
  return (
    <FlowNodeCard className="w-56" data-slot="ports-node" selected={selected}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Braces aria-hidden="true" className="size-4 text-muted-foreground" />
        <span className="truncate text-body font-medium">{data.title}</span>
      </div>
      <div className="grid grid-cols-2 py-1">
        <ul aria-label="Inputs">
          {data.inputs.map((port) => (
            <PortRow key={port} port={port} side="in" />
          ))}
        </ul>
        <ul aria-label="Outputs">
          {data.outputs.map((port) => (
            <PortRow key={port} port={port} side="out" />
          ))}
        </ul>
      </div>
    </FlowNodeCard>
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
    <FlowNodeCard className="w-52 px-3 py-2" data-slot="toolbar-node" selected={selected}>
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
      <FlowPort position={Position.Left} type="target" />
      <FlowPort position={Position.Right} type="source" />
      <div className="truncate text-body font-medium">{data.title}</div>
      <div className="truncate text-caption text-muted-foreground">{data.subtitle}</div>
    </FlowNodeCard>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. Editable fields — controls inside a node write back to its data.         */
/* -------------------------------------------------------------------------- */

type FilterNodeType = Node<{ field: string; threshold: number; enabled: boolean }, "filter">;

function FilterNode({ id, data, selected }: NodeProps<FilterNodeType>) {
  const { updateNodeData } = useReactFlow();
  return (
    <FlowNodeCard className="w-64" data-slot="filter-node" selected={selected}>
      <FlowPort position={Position.Left} type="target" />
      <FlowPort position={Position.Right} type="source" />
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
    </FlowNodeCard>
  );
}

/* -------------------------------------------------------------------------- */
/* 6. Annotation — a note that is not part of the graph.                       */
/* -------------------------------------------------------------------------- */

type NoteNodeType = Node<{ text: string }, "note">;

function NoteNode({ data, selected }: NodeProps<NoteNodeType>) {
  return (
    // No ports: a note cannot be wired. It is still a FlowNodeCard, so it keeps the
    // selection ring and the proxied focus indicator; `className` restyles the rest.
    <FlowNodeCard
      className={cn(
        "flex w-56 gap-2 rounded-md border-dashed border-border-strong bg-surface-muted px-3 py-2 shadow-none",
        "text-caption text-muted-foreground",
      )}
      data-slot="note-node"
      selected={selected}
    >
      <StickyNote aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <p>{data.text}</p>
    </FlowNodeCard>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. Resizable — the node takes whatever box the reader drags it to.          */
/* -------------------------------------------------------------------------- */

type ResizableNodeType = Node<{ title: string; body: string }, "resizable">;

function ResizableNode({ data, selected }: NodeProps<ResizableNodeType>) {
  return (
    // No `overflow-hidden` on the card: its ports and resize corners sit half outside it.
    // The body scrolls instead.
    <FlowNodeCard
      className="flex h-full w-full flex-col"
      data-slot="resizable-node"
      selected={selected}
    >
      <NodeResizer
        handleClassName="!size-2 !rounded-sm !border-ring !bg-flow-node"
        isVisible={selected}
        lineClassName="!border-ring"
        minHeight={96}
        minWidth={176}
      />
      <FlowPort position={Position.Left} type="target" />
      <FlowPort position={Position.Right} type="source" />
      <div className="border-b border-border px-3 py-2 text-body font-medium">{data.title}</div>
      <p className="min-h-0 flex-1 overflow-auto px-3 py-2 text-caption text-muted-foreground">
        {data.body}
      </p>
    </FlowNodeCard>
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
          "How to write your own node type on the branded canvas. Each story is one self-contained node component registered in `nodeTypes`, built on the parts `FlowNode` is built on: `FlowNodeCard` is the node box (selection ring, proxied keyboard focus, tone) and `FlowPort` is the connector dot (`port` gives it an `in:`/`out:` id). A tone paints the card’s border and every `data-flow-tone-part` inside it; `FlowToneIndicator` adds the glyph and name. Controls inside a node carry React Flow’s `nodrag` class. When `FlowNode` plus its `footer` slot is enough, prefer it — see the last story.",
      },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A card with a header, a definition list and a footer — the base shape most custom nodes
 * start from. The trigger is `emphasis: "featured"` (primary border, star) and the output
 * `tone: "success"` (success border and icon, check glyph), both through `FlowNodeCard`.
 */
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
          emphasis: "featured",
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
          tone: "success",
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

/** A `FlowPort` per row. Its `port` prop gives it the id `in:<port>` or `out:<port>`, so an edge names the exact port it uses (`sourceHandle` / `targetHandle`). */
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
