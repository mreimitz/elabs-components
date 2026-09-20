// registry: agent-designer-01 — copied 2026-09-20
"use client";

import { type ReactNode } from "react";
import {
  Bot,
  BrainCircuit,
  Check,
  CircleAlert,
  Cpu,
  GitFork,
  KeyRound,
  Library,
  PlugZap,
  Send,
  ShieldCheck,
  Sparkles,
  StickyNote,
  TriangleAlert,
  UserCheck,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  FLOW_HANDLE_ANCHOR_CLASS,
  Handle,
  Position,
  type NodeProps,
} from "@elabs-ai/components-flow";
import { Badge, cn, StatusBadge } from "@elabs-ai/components-ui";
import {
  CAPABILITY_PORTS,
  type Autonomy,
  type CapabilityData,
  type CapabilityKind,
  type DesignerNode,
  type RunOverlay,
  type RunStatus,
  type StepData,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Shared look                                                                 */
/* -------------------------------------------------------------------------- */

// The flow package’s three rules for a custom node: the card is the node box, every
// handle carries the anchor class, and keyboard focus is the proxied static ring.
const flowHandle = `!size-2.5 !border-2 !border-flow-edge !bg-flow-node ${FLOW_HANDLE_ANCHOR_CLASS}`;
/** Equipment ports are square, flow handles are round: two kinds of connection, two shapes. */
const portHandle = `!size-2.5 !rounded-xs !border-2 !border-flow-edge !bg-flow-node ${FLOW_HANDLE_ANCHOR_CLASS}`;

const RUN_BORDER: Partial<Record<RunStatus, string>> = {
  running: "border-info",
  complete: "border-success",
  "awaiting-approval": "border-warning",
  denied: "border-destructive",
  failed: "border-destructive",
};

function card(selected: boolean | undefined, overlay: RunOverlay, className?: string) {
  return cn(
    "rounded-lg border border-border bg-flow-node text-flow-node-foreground shadow-sm",
    "transition-[box-shadow,border-color] duration-fast ease-standard",
    overlay.runStatus && RUN_BORDER[overlay.runStatus],
    selected && "ring-2 ring-ring",
    "[[data-id]:focus-visible_&]:focus-ring-static",
    className,
  );
}

/** A design check points here. Glyph and words, not colour alone. */
function IssueMark({ issue }: { issue: RunOverlay["issue"] }) {
  if (!issue) return null;
  const Icon = issue === "error" ? CircleAlert : TriangleAlert;
  return (
    <span
      className={cn(
        "absolute -end-2 -top-2 flex size-5 items-center justify-center rounded-full bg-flow-node shadow-sm",
        issue === "error" ? "text-destructive" : "text-warning",
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      <span className="sr-only">{issue === "error" ? "Has an error" : "Has a warning"}</span>
    </span>
  );
}

function IconTile({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-muted text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-eyebrow text-muted-foreground">{children}</div>;
}

/* -------------------------------------------------------------------------- */
/* Agent                                                                       */
/* -------------------------------------------------------------------------- */

const AUTONOMY_LABEL: Record<Autonomy, string> = {
  suggest: "Suggests only",
  "act-with-approval": "Acts with approval",
  autonomous: "Autonomous",
};

const PORT_ICON: Record<CapabilityKind, LucideIcon> = {
  model: Cpu,
  skill: Sparkles,
  mcp: PlugZap,
  knowledge: Library,
  memory: BrainCircuit,
};

export function AgentNode({ data, selected }: NodeProps<Extract<DesignerNode, { type: "agent" }>>) {
  const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  return (
    <div className={card(selected, data, "relative w-80")} data-slot="agent-node">
      <IssueMark issue={data.issue} />
      <Handle className={flowHandle} id="in" position={Position.Left} type="target" />
      <Handle className={flowHandle} id="out" position={Position.Right} type="source" />
      <div className="flex items-start gap-3 p-3">
        <IconTile className="bg-primary/10 text-primary-text" icon={Bot} />
        <div className="min-w-0 flex-1">
          <Eyebrow>Agent</Eyebrow>
          <div className="truncate text-body font-semibold">{data.name}</div>
          <div className="line-clamp-2 text-caption text-muted-foreground">{data.role}</div>
        </div>
        {data.runStatus ? <StatusBadge size="sm" status={data.runStatus} /> : null}
      </div>
      {data.instructions ? (
        // The clamp sits INSIDE the padded box: on the box itself the third line shows
        // through the bottom padding.
        <div className="mx-3 rounded-md bg-surface-muted px-2 py-1.5">
          <p className="line-clamp-2 text-meta text-muted-foreground">{data.instructions}</p>
        </div>
      ) : (
        <p className="mx-3 rounded-md border border-dashed border-border-strong px-2 py-1.5 text-meta text-muted-foreground">
          No instructions yet
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
        <Badge variant={data.autonomy === "autonomous" ? "warning" : "secondary"}>
          {AUTONOMY_LABEL[data.autonomy]}
        </Badge>
        <span className="text-meta text-muted-foreground tabular-nums">
          {data.maxSteps} steps · {usd.format(data.budgetUsd)} a run
        </span>
      </div>
      {/* Equipment ports. Each cell is the positioning box of its own handle. */}
      <ul
        aria-label="Equipment"
        className="grid grid-cols-5 border-t border-border bg-surface-muted/60"
      >
        {CAPABILITY_PORTS.map((port) => {
          const Icon = PORT_ICON[port.kind];
          const count = data.equipment?.[port.kind] ?? 0;
          return (
            <li
              className="relative flex flex-col items-center gap-0.5 px-1 pb-2.5 pt-1.5 text-center"
              key={port.kind}
            >
              <Icon
                aria-hidden="true"
                className={cn("size-3.5", count ? "text-foreground" : "text-muted-foreground")}
              />
              <span aria-hidden="true" className="text-meta leading-tight text-muted-foreground">
                {port.short}
              </span>
              <span className="sr-only">
                {port.label}: {count} attached
              </span>
              <Handle
                className={portHandle}
                id={`port:${port.kind}`}
                position={Position.Bottom}
                type="source"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Equipment: model, skill, MCP server, knowledge, memory                      */
/* -------------------------------------------------------------------------- */

const KIND_LABEL: Record<CapabilityKind, string> = {
  model: "Model",
  skill: "Skill",
  mcp: "MCP server",
  knowledge: "Knowledge",
  memory: "Memory",
};

function capabilityLines(data: CapabilityData): { title: string; detail: string } {
  switch (data.kind) {
    case "model":
      return { title: data.model, detail: `${data.provider} · temp ${data.temperature}` };
    case "skill":
      return { title: data.name, detail: `v${data.version} · ${data.source}` };
    case "mcp": {
      const on = data.tools.filter((tool) => tool.enabled);
      const writes = on.filter((tool) => tool.access === "write").length;
      return {
        title: data.name,
        detail: `${on.length} of ${data.tools.length} tools${writes ? ` · ${writes} write` : ""}`,
      };
    }
    case "knowledge":
      return {
        title: data.name,
        detail: `${data.documents.toLocaleString("en-US")} docs · ${data.synced}`,
      };
    case "memory":
      return {
        title: data.name,
        detail: data.retentionDays ? `${data.scope} · ${data.retentionDays} d` : data.scope,
      };
  }
}

export function CapabilityNode({
  data,
  selected,
}: NodeProps<Extract<DesignerNode, { type: "capability" }>>) {
  const { title, detail } = capabilityLines(data);
  const authProblem = data.kind === "mcp" && data.auth !== "connected" ? data.auth : null;
  return (
    <div
      className={card(selected, data, "relative flex w-46 items-center gap-2 px-2.5 py-2")}
      data-kind={data.kind}
      data-slot="capability-node"
    >
      <IssueMark issue={data.issue} />
      <Handle className={portHandle} id="attach" position={Position.Top} type="target" />
      <IconTile icon={PORT_ICON[data.kind]} />
      <div className="min-w-0 flex-1">
        <Eyebrow>{KIND_LABEL[data.kind]}</Eyebrow>
        <div className="truncate text-caption font-semibold">{title}</div>
        <div className="flex items-center gap-1 truncate text-meta text-muted-foreground">
          {authProblem ? (
            <>
              <KeyRound aria-hidden="true" className="size-3 shrink-0 text-warning" />
              <span className="truncate text-warning-text">
                {authProblem === "error" ? "Connection failed" : "Needs sign-in"}
              </span>
            </>
          ) : (
            <span className="truncate">{detail}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Steps: trigger, guardrail, approval, action                                 */
/* -------------------------------------------------------------------------- */

const STEP_ICON: Record<StepData["kind"], LucideIcon> = {
  trigger: Zap,
  guardrail: ShieldCheck,
  approval: UserCheck,
  action: Send,
};

const STEP_LABEL: Record<StepData["kind"], string> = {
  trigger: "Trigger",
  guardrail: "Guardrail",
  approval: "Human approval",
  action: "Action",
};

/** A row that owns an outgoing handle: a router branch, an approval outcome. */
function OutcomeRow({
  id,
  icon: Icon,
  label,
  detail,
}: {
  id: string;
  icon?: LucideIcon;
  label: string;
  detail?: string;
}) {
  return (
    <li className="relative flex items-baseline gap-1.5 px-3 py-1.5">
      {Icon ? <Icon aria-hidden="true" className="size-3 shrink-0 self-center" /> : null}
      <span className="shrink-0 text-caption font-medium">{label}</span>
      {detail ? (
        <span className="min-w-0 flex-1 truncate text-end text-meta text-muted-foreground">
          {detail}
        </span>
      ) : null}
      <Handle className={flowHandle} id={id} position={Position.Right} type="source" />
    </li>
  );
}

export function StepNode({ data, selected }: NodeProps<Extract<DesignerNode, { type: "step" }>>) {
  const detail =
    data.kind === "trigger"
      ? `${data.source} · ${data.detail}`
      : data.kind === "guardrail"
        ? `${data.checks.length} ${data.checks.length === 1 ? "check" : "checks"} · on fail: ${data.onFail}`
        : data.kind === "approval"
          ? `${data.approvers} · ${data.channel} · ${data.slaHours} h`
          : `${data.system} · ${data.operation}`;
  return (
    <div
      className={card(selected, data, "relative w-60")}
      data-kind={data.kind}
      data-slot="step-node"
    >
      <IssueMark issue={data.issue} />
      {data.kind === "trigger" ? null : (
        <Handle className={flowHandle} id="in" position={Position.Left} type="target" />
      )}
      {data.kind === "approval" ? null : (
        <Handle className={flowHandle} id="out" position={Position.Right} type="source" />
      )}
      <div className="flex items-start gap-2.5 p-2.5">
        <IconTile
          className={cn(
            data.kind === "trigger" && "bg-primary/10 text-primary-text",
            data.kind === "approval" && "bg-warning/10 text-warning-text",
          )}
          icon={STEP_ICON[data.kind]}
        />
        <div className="min-w-0 flex-1">
          <Eyebrow>{STEP_LABEL[data.kind]}</Eyebrow>
          <div className="truncate text-caption font-semibold">{data.name}</div>
          <div className="truncate text-meta text-muted-foreground">{detail}</div>
        </div>
        {data.runStatus ? <StatusBadge hideIcon size="sm" status={data.runStatus} /> : null}
      </div>
      {data.kind === "action" && (data.sensitive || !data.write) ? (
        <div className="flex gap-1 px-2.5 pb-2.5">
          {data.sensitive ? <Badge variant="warning">moves money</Badge> : null}
          {data.write ? null : <Badge variant="secondary">read-only</Badge>}
        </div>
      ) : null}
      {data.kind === "approval" ? (
        <ul aria-label="Outcomes" className="border-t border-border py-0.5">
          <OutcomeRow icon={Check} id="approved" label="Approved" />
          <OutcomeRow icon={X} id="rejected" label="Rejected" />
        </ul>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Router                                                                      */
/* -------------------------------------------------------------------------- */

export function RouterNode({
  data,
  selected,
}: NodeProps<Extract<DesignerNode, { type: "router" }>>) {
  return (
    <div className={card(selected, data, "relative w-64")} data-slot="router-node">
      <IssueMark issue={data.issue} />
      <Handle className={flowHandle} id="in" position={Position.Left} type="target" />
      <div className="flex items-center gap-2.5 p-2.5">
        <IconTile icon={GitFork} />
        <div className="min-w-0 flex-1">
          <Eyebrow>Router</Eyebrow>
          <div className="truncate text-caption font-semibold">{data.name}</div>
        </div>
        {data.runStatus ? <StatusBadge hideIcon size="sm" status={data.runStatus} /> : null}
      </div>
      <ul aria-label="Branches" className="border-t border-border py-0.5">
        {data.branches.map((branch) => (
          <OutcomeRow
            detail={branch.condition}
            id={`branch:${branch.id}`}
            key={branch.id}
            label={branch.label}
          />
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Note                                                                        */
/* -------------------------------------------------------------------------- */

export function NoteNode({ data, selected }: NodeProps<Extract<DesignerNode, { type: "note" }>>) {
  return (
    <div
      className={cn(
        "flex w-72 gap-2 rounded-md border border-dashed border-border-strong bg-surface-muted px-3 py-2",
        "text-caption text-muted-foreground",
        selected && "ring-2 ring-ring",
        "[[data-id]:focus-visible_&]:focus-ring-static",
      )}
      data-slot="note-node"
    >
      <StickyNote aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <p className="min-w-0 whitespace-pre-wrap">{data.text}</p>
    </div>
  );
}

export const designerNodeTypes = {
  agent: AgentNode,
  capability: CapabilityNode,
  step: StepNode,
  router: RouterNode,
  note: NoteNode,
};
