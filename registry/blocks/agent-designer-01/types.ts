/**
 * The design an agent designer edits. Plain data: nothing here calls a model, opens a
 * connection or runs a tool. Your runtime reads the same shape and does that.
 */
import type { Edge, Node } from "@xyflow/react";

/* ---- What a step in the flow can be (left to right) ---- */

export interface TriggerData extends Record<string, unknown> {
  kind: "trigger";
  name: string;
  /** The system the event comes from: "Zendesk", "Shared mailbox", "Schedule". */
  source: string;
  detail: string;
}

export type Autonomy = "suggest" | "act-with-approval" | "autonomous";

export interface AgentData extends Record<string, unknown> {
  kind: "agent";
  name: string;
  /** One line: what this agent is for. */
  role: string;
  instructions: string;
  autonomy: Autonomy;
  /** Tool calls the agent may make before it must stop and hand over. */
  maxSteps: number;
  /** Spend ceiling for one run, in US dollars. */
  budgetUsd: number;
}

export interface GuardrailData extends Record<string, unknown> {
  kind: "guardrail";
  name: string;
  checks: string[];
  onFail: "block" | "escalate" | "redact";
}

export interface RouterBranch {
  id: string;
  label: string;
  /** Written for a person: "amount over €5,000". Your runtime owns the real expression. */
  condition: string;
}

export interface RouterData extends Record<string, unknown> {
  kind: "router";
  name: string;
  branches: RouterBranch[];
}

export interface ApprovalData extends Record<string, unknown> {
  kind: "approval";
  name: string;
  approvers: string;
  channel: string;
  slaHours: number;
}

export interface ActionData extends Record<string, unknown> {
  kind: "action";
  name: string;
  system: string;
  operation: string;
  /** Changes something outside the agent. */
  write: boolean;
  /** Moves money or books to the ledger: a design check wants an approval before it. */
  sensitive?: boolean;
}

export interface NoteData extends Record<string, unknown> {
  kind: "note";
  text: string;
}

/* ---- What an agent is equipped with (attached beneath it) ---- */

export interface ModelData extends Record<string, unknown> {
  kind: "model";
  provider: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
}

export interface SkillData extends Record<string, unknown> {
  kind: "skill";
  name: string;
  version: string;
  description: string;
  source: "Organisation" | "Marketplace" | "This workspace";
  files: number;
}

export interface McpTool {
  name: string;
  description: string;
  access: "read" | "write";
  enabled: boolean;
  /** Ask a person every time before this tool runs. */
  requiresApproval: boolean;
}

export interface McpServerData extends Record<string, unknown> {
  kind: "mcp";
  name: string;
  url: string;
  transport: "Streamable HTTP" | "stdio";
  auth: "connected" | "needs-sign-in" | "error";
  tools: McpTool[];
}

export interface KnowledgeData extends Record<string, unknown> {
  kind: "knowledge";
  name: string;
  system: string;
  documents: number;
  synced: string;
}

export interface MemoryData extends Record<string, unknown> {
  kind: "memory";
  name: string;
  scope: "This run" | "Per customer" | "Workspace";
  retentionDays: number;
}

export type CapabilityData = ModelData | SkillData | McpServerData | KnowledgeData | MemoryData;
export type StepData = TriggerData | GuardrailData | ApprovalData | ActionData;
export type DesignerData = AgentData | RouterData | NoteData | StepData | CapabilityData;
export type DesignerKind = DesignerData["kind"];
export type CapabilityKind = CapabilityData["kind"];

/** Set by a test run, never saved with the design. */
export type RunStatus =
  | "pending"
  | "running"
  | "complete"
  | "awaiting-approval"
  | "denied"
  | "failed"
  | "skipped";

export interface RunOverlay {
  runStatus?: RunStatus;
  /** A design check points at this node. */
  issue?: "error" | "warning";
  /** Agents only: how many nodes hang off each equipment port. Derived from the edges. */
  equipment?: Partial<Record<CapabilityKind, number>>;
}

export type DesignerNode =
  | Node<AgentData & RunOverlay, "agent">
  | Node<RouterData & RunOverlay, "router">
  | Node<NoteData & RunOverlay, "note">
  | Node<StepData & RunOverlay, "step">
  | Node<CapabilityData & RunOverlay, "capability">;

export interface DesignerEdgeData extends Record<string, unknown> {
  /** `flow` carries the work from step to step; `attach` equips an agent. */
  link: "flow" | "attach";
  label?: string;
  /** 0..1 while a test run travels along this edge. */
  progress?: number;
  travelled?: boolean;
}

export type DesignerEdge = Edge<DesignerEdgeData, "flow" | "attach">;

/** The agent's equipment ports, left to right along its bottom edge. */
export const CAPABILITY_PORTS: { kind: CapabilityKind; label: string; short: string }[] = [
  { kind: "model", label: "Model", short: "Model" },
  { kind: "skill", label: "Skills", short: "Skills" },
  { kind: "mcp", label: "MCP servers", short: "MCP" },
  { kind: "knowledge", label: "Knowledge", short: "Knowledge" },
  { kind: "memory", label: "Memory", short: "Memory" },
];

export const isCapability = (data: DesignerData): data is CapabilityData =>
  CAPABILITY_PORTS.some((port) => port.kind === data.kind);

export const nodeTypeFor = (data: DesignerData): DesignerNode["type"] =>
  data.kind === "agent"
    ? "agent"
    : data.kind === "router"
      ? "router"
      : data.kind === "note"
        ? "note"
        : isCapability(data)
          ? "capability"
          : "step";

/** What the rest of the screen calls a node. */
export const nodeTitle = (data: DesignerData): string =>
  data.kind === "note" ? "Note" : data.kind === "model" ? data.model : data.name;

export interface DesignerScenario {
  id: string;
  name: string;
  summary: string;
  owner: string;
  version: string;
  nodes: DesignerNode[];
  edges: DesignerEdge[];
}
