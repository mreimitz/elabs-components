/**
 * Three designs the block opens with. Sample data — each one is a different SHAPE of
 * agent system, so the designer can be judged on more than one picture:
 *
 * - support: one well-equipped agent, a router, an approval on the expensive path.
 * - invoices: a pipeline of two narrow agents with a ledger posting at the end.
 * - leads: four agents handing work along, with a reviewer before anything is sent.
 *
 * Designs run left to right and get wide; the canvas opens on the start of the flow.
 */
import {
  CAPABILITY_PORTS,
  nodeTypeFor,
  type ActionData,
  type AgentData,
  type CapabilityData,
  type DesignerData,
  type DesignerEdge,
  type DesignerNode,
  type DesignerScenario,
} from "../types";
import { MCP_SERVERS, SKILLS } from "./catalog";

/* ---- Geometry shared with the designer’s "attach" placement ---- */

export const AGENT_WIDTH = 320;
export const CAPABILITY_WIDTH = 184;
const COLUMN_PITCH = CAPABILITY_WIDTH + 16;
const ROW_PITCH = 76;
/** Distance from an agent’s top edge to its first row of equipment. */
export const EQUIPMENT_OFFSET = 250;

/** Where the equipment of one agent goes: a column per kind, centred beneath the agent. */
export function placeEquipment(
  agentPosition: { x: number; y: number },
  capabilities: CapabilityData[],
): { data: CapabilityData; position: { x: number; y: number } }[] {
  const columns = CAPABILITY_PORTS.map((port) =>
    capabilities.filter((capability) => capability.kind === port.kind),
  ).filter((column) => column.length > 0);
  const span = columns.length * COLUMN_PITCH - 16;
  const left = agentPosition.x + AGENT_WIDTH / 2 - span / 2;
  return columns.flatMap((column, columnIndex) =>
    column.map((data, rowIndex) => ({
      data,
      position: {
        x: left + columnIndex * COLUMN_PITCH,
        y: agentPosition.y + EQUIPMENT_OFFSET + rowIndex * ROW_PITCH,
      },
    })),
  );
}

const node = (id: string, x: number, y: number, data: DesignerData): DesignerNode =>
  ({ id, type: nodeTypeFor(data), position: { x, y }, data }) as DesignerNode;

const flow = (
  source: string,
  target: string,
  options: { handle?: string; label?: string } = {},
): DesignerEdge => ({
  id: `${source}${options.handle ? `:${options.handle}` : ""}→${target}`,
  type: "flow",
  source,
  target,
  sourceHandle: options.handle ?? "out",
  targetHandle: "in",
  data: { link: "flow", label: options.label },
});

/** An agent with its equipment laid out beneath it, and the edges that attach it. */
function equippedAgent(
  id: string,
  x: number,
  y: number,
  agent: Pick<AgentData, "name" | "role" | "instructions" | "autonomy" | "maxSteps" | "budgetUsd">,
  capabilities: CapabilityData[],
): { nodes: DesignerNode[]; edges: DesignerEdge[] } {
  const placed = placeEquipment({ x, y }, capabilities);
  const nodes = placed.map(({ data, position }, index) =>
    node(`${id}-${data.kind}-${index}`, position.x, position.y, structuredClone(data)),
  );
  return {
    nodes: [node(id, x, y, { kind: "agent", ...agent }), ...nodes],
    edges: nodes.map((capability) => ({
      id: `${id}⇢${capability.id}`,
      type: "attach" as const,
      source: id,
      target: capability.id,
      sourceHandle: `port:${capability.data.kind}`,
      targetHandle: "attach",
      data: { link: "attach" as const },
    })),
  };
}

const model = (name: string, provider = "Anthropic", temperature = 0.2): CapabilityData => ({
  kind: "model",
  provider,
  model: name,
  temperature,
  maxOutputTokens: 4096,
});
const action = (
  name: string,
  system: string,
  operation: string,
  extra: Partial<ActionData> = {},
): ActionData => ({ kind: "action", name, system, operation, write: true, ...extra });

/* -------------------------------------------------------------------------- */
/* 1. Customer support — one capable agent                                     */
/* -------------------------------------------------------------------------- */

const resolver = equippedAgent(
  "resolver",
  560,
  120,
  {
    name: "Support resolver",
    role: "Answers the ticket, or works out exactly what it needs",
    instructions:
      "Read the whole thread before you act. Answer from the help centre when it covers the question. If money has to move, work out the amount from the refund policy and say which rule applies. Never promise a delivery date. If you are not sure, hand over to a person and say why.",
    autonomy: "act-with-approval",
    maxSteps: 14,
    budgetUsd: 0.4,
  },
  [
    model("Claude Sonnet"),
    SKILLS.ticketTriage!,
    SKILLS.refundPolicy!,
    SKILLS.toneOfVoice!,
    MCP_SERVERS.zendesk!,
    MCP_SERVERS.stripe!,
    {
      kind: "knowledge",
      name: "Help centre",
      system: "Zendesk Guide",
      documents: 1240,
      synced: "2 h ago",
    },
    { kind: "memory", name: "Customer memory", scope: "Per customer", retentionDays: 365 },
  ],
);

const SUPPORT: DesignerScenario = {
  id: "support",
  name: "Support resolution",
  summary: "Answers what it can, refunds small amounts itself, asks a lead above €100.",
  owner: "Customer care",
  version: "v14 · draft",
  nodes: [
    node("ticket", 0, 150, {
      kind: "trigger",
      name: "New ticket",
      source: "Zendesk",
      detail: "Email, chat and web form",
    }),
    node("pii", 280, 142, {
      kind: "guardrail",
      name: "Personal data",
      checks: ["Mask card and bank numbers", "Mask phone numbers in attachments"],
      onFail: "redact",
    }),
    ...resolver.nodes,
    node("route", 980, 118, {
      kind: "router",
      name: "What does it need?",
      branches: [
        { id: "answer", label: "An answer", condition: "no money moves" },
        { id: "small", label: "Refund up to €100", condition: "policy rule applies, amount ≤ 100" },
        { id: "large", label: "Refund over €100", condition: "amount > 100" },
        { id: "else", label: "Otherwise", condition: "unsure, angry, legal" },
      ],
    }),
    node("reply", 1340, 0, action("Reply to customer", "Zendesk", "reply_to_ticket")),
    node("approve", 1340, 236, {
      kind: "approval",
      name: "Lead approves refund",
      approvers: "Support leads",
      channel: "Slack",
      slaHours: 4,
    }),
    node(
      "refund",
      1680,
      130,
      action("Issue refund", "Stripe", "create_refund", { sensitive: true }),
    ),
    node("escalate", 1680, 380, action("Hand to tier 2", "Slack", "post_message")),
    node("why", 1300, 480, {
      kind: "note",
      text: "Small refunds skip the lead on purpose: 83% of refunds are under €100 and waiting cost us more than the refunds did. Reviewed quarterly with Finance.",
    }),
  ],
  edges: [
    flow("ticket", "pii"),
    flow("pii", "resolver"),
    flow("resolver", "route"),
    flow("route", "reply", { handle: "branch:answer" }),
    flow("route", "refund", { handle: "branch:small" }),
    flow("route", "approve", { handle: "branch:large" }),
    flow("route", "escalate", { handle: "branch:else" }),
    flow("approve", "refund", { handle: "approved", label: "approved" }),
    flow("approve", "escalate", { handle: "rejected", label: "rejected" }),
    ...resolver.edges,
  ],
};

/* -------------------------------------------------------------------------- */
/* 2. Accounts payable — a pipeline of two narrow agents                       */
/* -------------------------------------------------------------------------- */

const reader = equippedAgent(
  "reader",
  300,
  120,
  {
    name: "Invoice reader",
    role: "Turns a PDF into header, lines and tax — nothing else",
    instructions:
      "Extract vendor, invoice number, dates, currency, every line and the tax breakdown. Propose cost centre and G/L account from the coding rules. Give a confidence per field. Do not guess a purchase order number that is not printed on the document.",
    autonomy: "autonomous",
    maxSteps: 6,
    budgetUsd: 0.05,
  },
  [model("Claude Haiku", "Anthropic", 0), SKILLS.invoiceCoding!, MCP_SERVERS.microsoft365!],
);

const matcher = equippedAgent(
  "matcher",
  960,
  120,
  {
    name: "Matcher",
    role: "Checks the invoice against the order and the goods receipt",
    instructions:
      "Find the purchase order and its goods receipts. Compare quantities, prices and tax within the tolerances of the matching rules. Explain every difference in one sentence a clerk can act on. You may park an invoice. You never post one.",
    autonomy: "act-with-approval",
    maxSteps: 10,
    budgetUsd: 0.25,
  },
  [
    model("Claude Sonnet"),
    SKILLS.threeWayMatch!,
    MCP_SERVERS.sap!,
    {
      kind: "knowledge",
      name: "Policy handbook",
      system: "SharePoint",
      documents: 318,
      synced: "yesterday",
    },
  ],
);

const INVOICES: DesignerScenario = {
  id: "invoices",
  name: "Invoice processing",
  summary: "Reads supplier invoices, matches them three ways, posts the clean ones.",
  owner: "Accounts payable",
  version: "v6 · live",
  nodes: [
    node("mail", 0, 150, {
      kind: "trigger",
      name: "Mail received",
      source: "Microsoft 365",
      detail: "invoices@acme.example · PDF or XML",
    }),
    ...reader.nodes,
    node("dupes", 680, 142, {
      kind: "guardrail",
      name: "Duplicate check",
      checks: [
        "Same vendor, number and amount in the last 18 months",
        "Bank details match vendor master",
      ],
      onFail: "block",
    }),
    ...matcher.nodes,
    node("route", 1380, 118, {
      kind: "router",
      name: "Match result",
      branches: [
        { id: "clean", label: "Clean, under €5,000", condition: "all lines within tolerance" },
        { id: "big", label: "Clean, €5,000 or more", condition: "needs a second signature" },
        { id: "diff", label: "Differences", condition: "any line out of tolerance" },
      ],
    }),
    node("sign", 1740, 190, {
      kind: "approval",
      name: "Controller signs",
      approvers: "Financial controllers",
      channel: "Microsoft Teams",
      slaHours: 24,
    }),
    node(
      "post",
      2080,
      60,
      action("Post invoice", "SAP S/4HANA", "post_invoice", { sensitive: true }),
    ),
    node("park", 2080, 380, action("Park and ask buyer", "SAP S/4HANA", "park_invoice")),
  ],
  edges: [
    flow("mail", "reader"),
    flow("reader", "dupes"),
    flow("dupes", "matcher"),
    flow("matcher", "route"),
    flow("route", "post", { handle: "branch:clean" }),
    flow("route", "sign", { handle: "branch:big" }),
    flow("route", "park", { handle: "branch:diff" }),
    flow("sign", "post", { handle: "approved", label: "approved" }),
    flow("sign", "park", { handle: "rejected", label: "rejected" }),
    ...reader.edges,
    ...matcher.edges,
  ],
};

/* -------------------------------------------------------------------------- */
/* 3. Sales — four agents handing work along                                   */
/* -------------------------------------------------------------------------- */

const researcher = equippedAgent(
  "research",
  300,
  0,
  {
    name: "Researcher",
    role: "Finds out who the company is and what changed recently",
    instructions:
      "Build a short profile: size, industry, tech stack, recent news, who the lead is. Cite every claim. If the company is already a customer, read how they use the product before anything else.",
    autonomy: "autonomous",
    maxSteps: 16,
    budgetUsd: 0.3,
  },
  [model("Claude Sonnet"), SKILLS.accountBrief!, MCP_SERVERS.web!, MCP_SERVERS.analytics!],
);

const scorer = equippedAgent(
  "score",
  960,
  0,
  {
    name: "Scorer",
    role: "Scores fit and intent against the rubric, with reasons",
    instructions:
      "Apply the rubric exactly. Output a score from 0 to 100 and the three signals that moved it most. Do not contact anyone.",
    autonomy: "autonomous",
    maxSteps: 4,
    budgetUsd: 0.05,
  },
  [model("Claude Haiku", "Anthropic", 0), SKILLS.leadScoring!, MCP_SERVERS.salesforce!],
);

const writer = equippedAgent(
  "write",
  1760,
  0,
  {
    name: "Outreach writer",
    role: "Drafts the first email from the brief",
    instructions:
      "One email, under 120 words, one question at the end. Use only cleared claims from the playbook. Mention one specific thing from the brief — never more.",
    autonomy: "suggest",
    maxSteps: 5,
    budgetUsd: 0.1,
  },
  [
    model("Claude Sonnet", "Anthropic", 0.6),
    SKILLS.outreachPlaybook!,
    SKILLS.toneOfVoice!,
    {
      kind: "knowledge",
      name: "Won-deal library",
      system: "Google Drive",
      documents: 412,
      synced: "3 days ago",
    },
  ],
);

const reviewer = equippedAgent(
  "review",
  2420,
  0,
  {
    name: "Reviewer",
    role: "Checks the draft against the brief and the playbook",
    instructions:
      "Verify every factual sentence against the brief. Flag unverifiable claims. Reject drafts that mention pricing or competitors by name.",
    autonomy: "suggest",
    maxSteps: 4,
    budgetUsd: 0.08,
  },
  [model("Claude Opus"), SKILLS.outreachPlaybook!],
);

const LEADS: DesignerScenario = {
  id: "leads",
  name: "Lead qualification",
  summary: "Researches and scores every new lead; drafts outreach for the hot ones.",
  owner: "Revenue operations",
  version: "v3 · draft",
  nodes: [
    node("lead", 0, 30, {
      kind: "trigger",
      name: "New lead",
      source: "Salesforce",
      detail: "Web form, event scan, partner referral",
    }),
    ...researcher.nodes,
    ...scorer.nodes,
    node("route", 1380, -2, {
      kind: "router",
      name: "Score",
      branches: [
        { id: "cold", label: "Cold", condition: "below 40" },
        { id: "warm", label: "Warm", condition: "40 to 69" },
        { id: "hot", label: "Hot", condition: "70 and above" },
      ],
    }),
    node("close", 1760, -300, action("Close as unqualified", "Salesforce", "update_lead")),
    node("nurture", 1760, -160, action("Add to nurture", "Salesforce", "update_lead")),
    ...writer.nodes,
    ...reviewer.nodes,
    node("rep", 2860, 28, {
      kind: "approval",
      name: "Rep sends or edits",
      approvers: "Lead owner",
      channel: "Email",
      slaHours: 8,
    }),
    node("send", 3200, -40, action("Send email", "Microsoft 365", "send_mail")),
    node("task", 3200, 110, action("Create call task", "Salesforce", "create_task")),
    node("handoff", 2080, -150, {
      kind: "note",
      text: "The writer gets the brief and the score — never raw CRM access. The reviewer runs on a stronger model than the writer on purpose.",
    }),
  ],
  edges: [
    flow("lead", "research"),
    flow("research", "score"),
    flow("score", "route"),
    flow("route", "write", { handle: "branch:hot" }),
    flow("route", "nurture", { handle: "branch:warm" }),
    flow("route", "close", { handle: "branch:cold" }),
    flow("write", "review"),
    flow("review", "rep"),
    flow("rep", "send", { handle: "approved", label: "approved" }),
    flow("rep", "task", { handle: "rejected", label: "rejected" }),
    ...researcher.edges,
    ...scorer.edges,
    ...writer.edges,
    ...reviewer.edges,
  ],
};

export const SCENARIOS: DesignerScenario[] = [SUPPORT, INVOICES, LEADS];

/** Which branch a test run takes at each router, per scenario — so the run shows the interesting path. */
export const TEST_PATH: Record<string, Record<string, string>> = {
  support: { route: "large" },
  invoices: { route: "big" },
  leads: { route: "hot" },
};
