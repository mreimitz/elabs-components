/**
 * What the palette offers. Sample data: in your product this list comes from your skill
 * library, your MCP registry and your model gateway.
 */
import type {
  ActionData,
  AgentData,
  ApprovalData,
  DesignerData,
  GuardrailData,
  KnowledgeData,
  McpServerData,
  McpTool,
  MemoryData,
  ModelData,
  RouterData,
  SkillData,
  TriggerData,
} from "../types";

export type CatalogGroup =
  | "Triggers"
  | "Agents"
  | "Control"
  | "Models"
  | "Skills"
  | "MCP servers"
  | "Knowledge and memory"
  | "Actions";

export interface CatalogItem {
  id: string;
  group: CatalogGroup;
  label: string;
  description: string;
  /** A fresh copy each time: two nodes never share one object. */
  create: () => DesignerData;
}

const tool = (
  name: string,
  description: string,
  access: McpTool["access"] = "read",
  enabled = access === "read",
): McpTool => ({ name, description, access, enabled, requiresApproval: access === "write" });

/* ---- MCP servers ---- */

export const MCP_SERVERS: Record<string, McpServerData> = {
  zendesk: {
    kind: "mcp",
    name: "Zendesk",
    url: "mcp.zendesk.example/v1",
    transport: "Streamable HTTP",
    auth: "connected",
    tools: [
      tool("search_tickets", "Find tickets by requester, status or text"),
      tool("get_ticket", "Read one ticket with its full thread"),
      tool("list_macros", "List the team’s reply macros"),
      tool("add_internal_note", "Add a note only agents can see", "write", true),
      tool("reply_to_ticket", "Send a public reply to the requester", "write", true),
      tool("update_ticket", "Change status, priority, tags or assignee", "write", true),
      tool("merge_tickets", "Merge duplicates into one ticket", "write"),
    ],
  },
  salesforce: {
    kind: "mcp",
    name: "Salesforce",
    url: "mcp.salesforce.example/crm",
    transport: "Streamable HTTP",
    auth: "connected",
    tools: [
      tool("query_records", "Run a read-only SOQL query"),
      tool("get_account", "Read an account with contacts and open opportunities"),
      tool("get_lead", "Read one lead"),
      tool("create_task", "Create a follow-up task for an owner", "write", true),
      tool("update_lead", "Change lead status, score or owner", "write", true),
      tool("convert_lead", "Convert a lead to an account and opportunity", "write"),
    ],
  },
  sap: {
    kind: "mcp",
    name: "SAP S/4HANA",
    url: "mcp.erp.acme.example/finance",
    transport: "Streamable HTTP",
    auth: "connected",
    tools: [
      tool("get_purchase_order", "Read a purchase order with its lines"),
      tool("get_goods_receipt", "Read goods receipts for a purchase order"),
      tool("get_vendor", "Read vendor master data and bank details"),
      tool("park_invoice", "Park an invoice without posting it", "write", true),
      tool("post_invoice", "Post an invoice to the ledger", "write", true),
      tool("block_payment", "Set a payment block on an invoice", "write"),
    ],
  },
  stripe: {
    kind: "mcp",
    name: "Stripe",
    url: "mcp.stripe.example",
    transport: "Streamable HTTP",
    auth: "needs-sign-in",
    tools: [
      tool("get_charge", "Read a charge and its dispute state"),
      tool("list_refunds", "List refunds for a customer"),
      tool("create_refund", "Refund a charge in full or in part", "write", true),
    ],
  },
  slack: {
    kind: "mcp",
    name: "Slack",
    url: "mcp.slack.example",
    transport: "Streamable HTTP",
    auth: "connected",
    tools: [
      tool("search_messages", "Search channels the app was added to"),
      tool("post_message", "Post to a channel or thread", "write", true),
      tool("open_dm", "Message one person directly", "write"),
    ],
  },
  microsoft365: {
    kind: "mcp",
    name: "Microsoft 365",
    url: "mcp.graph.example",
    transport: "Streamable HTTP",
    auth: "connected",
    tools: [
      tool("read_mail", "Read messages in a mailbox the agent was granted"),
      tool("get_attachment", "Download an attachment"),
      tool("find_meeting_times", "Suggest times that work for a group"),
      tool("send_mail", "Send mail from the shared mailbox", "write", true),
      tool("create_event", "Put a meeting in calendars", "write"),
    ],
  },
  analytics: {
    kind: "mcp",
    name: "Product analytics",
    url: "mcp.analytics.acme.example",
    transport: "Streamable HTTP",
    auth: "connected",
    tools: [
      tool("search_dashboards", "Find dashboards by name or tag"),
      tool("get_metric", "Read one governed metric with its definition"),
      tool("get_usage_by_account", "How an existing customer uses the product"),
      tool("set_filter", "Apply a filter before reading", "write", true),
    ],
  },
  warehouse: {
    kind: "mcp",
    name: "Snowflake",
    url: "mcp.data.acme.example",
    transport: "Streamable HTTP",
    auth: "error",
    tools: [
      tool("list_tables", "List tables the role can see"),
      tool("run_query", "Run a read-only SQL query with a row limit"),
    ],
  },
  web: {
    kind: "mcp",
    name: "Web research",
    url: "local: web-research",
    transport: "stdio",
    auth: "connected",
    tools: [
      tool("search", "Search the public web"),
      tool("fetch_page", "Read one page as text"),
      tool("company_profile", "Firmographics for a domain"),
    ],
  },
};

/* ---- Skills ---- */

const skill = (
  name: string,
  description: string,
  source: SkillData["source"],
  version: string,
  files: number,
): SkillData => ({ kind: "skill", name, description, source, version, files });

export const SKILLS: Record<string, SkillData> = {
  refundPolicy: skill(
    "Refund policy",
    "When a refund is due, how much, and who signs off above the limit.",
    "Organisation",
    "3.2",
    4,
  ),
  toneOfVoice: skill(
    "Tone of voice",
    "How we write to customers: plain, warm, no blame, no jargon.",
    "Organisation",
    "2.0",
    3,
  ),
  ticketTriage: skill(
    "Ticket triage",
    "Topic, urgency and sentiment labels with worked examples per queue.",
    "This workspace",
    "1.4",
    6,
  ),
  invoiceCoding: skill(
    "Invoice coding",
    "Cost centre and G/L account rules by vendor category and entity.",
    "Organisation",
    "5.1",
    9,
  ),
  threeWayMatch: skill(
    "Three-way match",
    "Compare invoice, purchase order and goods receipt; tolerances per category.",
    "Organisation",
    "2.3",
    5,
  ),
  leadScoring: skill(
    "Lead scoring rubric",
    "Fit and intent signals, weights, and the score that means “call today”.",
    "This workspace",
    "0.9",
    4,
  ),
  accountBrief: skill(
    "Account brief",
    "A one-page brief before a first call: who they are, why now, what to ask.",
    "Marketplace",
    "1.1",
    2,
  ),
  outreachPlaybook: skill(
    "Outreach playbook",
    "First-touch email patterns by persona, with the claims legal has cleared.",
    "Organisation",
    "4.0",
    7,
  ),
  sqlAnalyst: skill(
    "SQL analyst",
    "Writes and checks read-only queries against the governed marts.",
    "Marketplace",
    "2.6",
    8,
  ),
};

/* ---- Everything the palette lists ---- */

const trigger = (name: string, source: string, detail: string): TriggerData => ({
  kind: "trigger",
  name,
  source,
  detail,
});
const agent = (name: string, role: string, instructions: string): AgentData => ({
  kind: "agent",
  name,
  role,
  instructions,
  autonomy: "act-with-approval",
  maxSteps: 12,
  budgetUsd: 0.5,
});
const model = (provider: string, name: string, temperature = 0.2): ModelData => ({
  kind: "model",
  provider,
  model: name,
  temperature,
  maxOutputTokens: 4096,
});
const knowledge = (
  name: string,
  system: string,
  documents: number,
  synced: string,
): KnowledgeData => ({ kind: "knowledge", name, system, documents, synced });
const memory = (name: string, scope: MemoryData["scope"], retentionDays: number): MemoryData => ({
  kind: "memory",
  name,
  scope,
  retentionDays,
});
const action = (
  name: string,
  system: string,
  operation: string,
  write = true,
  sensitive = false,
): ActionData => ({ kind: "action", name, system, operation, write, sensitive });
const guardrail = (
  name: string,
  checks: string[],
  onFail: GuardrailData["onFail"],
): GuardrailData => ({ kind: "guardrail", name, checks, onFail });

const item = (
  group: CatalogGroup,
  label: string,
  description: string,
  make: () => DesignerData,
): CatalogItem => ({
  id: `${group}:${label}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  group,
  label,
  description,
  create: () => structuredClone(make()),
});

export const CATALOG: CatalogItem[] = [
  item("Triggers", "New ticket", "A customer opens a support ticket", () =>
    trigger("New ticket", "Zendesk", "Any channel · business hours and after"),
  ),
  item("Triggers", "Shared mailbox", "Mail arrives in a team inbox", () =>
    trigger("Mail received", "Microsoft 365", "invoices@acme.example"),
  ),
  item("Triggers", "New lead", "A lead is created or changes stage", () =>
    trigger("New lead", "Salesforce", "Source: web form, event scan, partner"),
  ),
  item("Triggers", "Schedule", "Run at a fixed time", () =>
    trigger("Every weekday", "Schedule", "07:00 Europe/Vienna"),
  ),
  item("Triggers", "Webhook", "Another system calls this design", () =>
    trigger("Incoming webhook", "HTTPS", "POST /hooks/agent"),
  ),

  item("Agents", "Blank agent", "Start from nothing", () =>
    agent("New agent", "Describe what this agent is for", ""),
  ),
  item("Agents", "Specialist", "One job, few tools, tight instructions", () =>
    agent(
      "Specialist",
      "Does one task and hands the result back",
      "You do exactly one thing. If the request is outside it, say so and stop.",
    ),
  ),
  item("Agents", "Supervisor", "Plans the work and delegates to other agents", () => ({
    ...agent(
      "Supervisor",
      "Breaks the request down and delegates",
      "Plan first. Delegate each part to the agent built for it. Check what comes back before you answer.",
    ),
    maxSteps: 20,
    budgetUsd: 1.5,
  })),
  item("Agents", "Reviewer", "Checks another agent’s output before it leaves", () => ({
    ...agent(
      "Reviewer",
      "Second pair of eyes before anything is sent",
      "Check facts against the sources given. Flag anything you cannot verify. Never rewrite silently.",
    ),
    autonomy: "suggest" as const,
  })),

  item(
    "Control",
    "Router",
    "Send the work down one of several paths",
    (): RouterData => ({
      kind: "router",
      name: "Route",
      branches: [
        { id: "a", label: "Path A", condition: "when…" },
        { id: "else", label: "Otherwise", condition: "everything else" },
      ],
    }),
  ),
  item(
    "Control",
    "Human approval",
    "Stop until a person approves or rejects",
    (): ApprovalData => ({
      kind: "approval",
      name: "Approval",
      approvers: "Team lead",
      channel: "Slack",
      slaHours: 4,
    }),
  ),
  item("Control", "Personal-data guardrail", "Find and mask personal data", () =>
    guardrail(
      "Personal data",
      ["Mask names, emails, phone numbers", "Drop card and bank numbers"],
      "redact",
    ),
  ),
  item("Control", "Policy guardrail", "Check output against written policy", () =>
    guardrail(
      "Policy check",
      ["No promises outside policy", "No legal or medical advice"],
      "escalate",
    ),
  ),
  item("Control", "Note", "Explain the design to the next person", () => ({
    kind: "note",
    text: "Why this step exists…",
  })),

  item("Models", "Claude Sonnet", "Balanced: most agent work", () =>
    model("Anthropic", "Claude Sonnet"),
  ),
  item("Models", "Claude Haiku", "Fast and cheap: triage, extraction", () =>
    model("Anthropic", "Claude Haiku", 0),
  ),
  item("Models", "Claude Opus", "Hardest reasoning, highest cost", () =>
    model("Anthropic", "Claude Opus"),
  ),
  item("Models", "Mistral Large", "EU-hosted alternative", () => model("Mistral", "Mistral Large")),
  item("Models", "Llama (self-hosted)", "Runs in your own cluster", () =>
    model("Self-hosted", "Llama 70B", 0.1),
  ),

  ...Object.values(SKILLS).map((entry) =>
    item("Skills", entry.name, entry.description, () => entry),
  ),

  ...Object.values(MCP_SERVERS).map((entry) =>
    item(
      "MCP servers",
      entry.name,
      `${entry.tools.length} tools · ${entry.tools.filter((t) => t.access === "write").length} can write`,
      () => entry,
    ),
  ),

  item("Knowledge and memory", "Help centre", "Public articles, synced nightly", () =>
    knowledge("Help centre", "Zendesk Guide", 1240, "2 h ago"),
  ),
  item("Knowledge and memory", "Policy handbook", "Finance and HR policies", () =>
    knowledge("Policy handbook", "SharePoint", 318, "yesterday"),
  ),
  item("Knowledge and memory", "Product catalogue", "Specs, prices, availability", () =>
    knowledge("Product catalogue", "PIM export", 6250, "1 h ago"),
  ),
  item(
    "Knowledge and memory",
    "Won-deal library",
    "Proposals and call notes from closed deals",
    () => knowledge("Won-deal library", "Google Drive", 412, "3 days ago"),
  ),
  item("Knowledge and memory", "Run scratchpad", "Forgotten when the run ends", () =>
    memory("Run scratchpad", "This run", 0),
  ),
  item("Knowledge and memory", "Customer memory", "What we learned about this customer", () =>
    memory("Customer memory", "Per customer", 365),
  ),

  item("Actions", "Reply to customer", "Send the drafted reply", () =>
    action("Reply to customer", "Zendesk", "reply_to_ticket"),
  ),
  item("Actions", "Post to channel", "Tell a team what happened", () =>
    action("Post to channel", "Slack", "post_message"),
  ),
  item("Actions", "Create CRM task", "Give a person the next step", () =>
    action("Create task", "Salesforce", "create_task"),
  ),
  item("Actions", "Post invoice", "Book the invoice in the ledger", () =>
    action("Post invoice", "SAP S/4HANA", "post_invoice", true, true),
  ),
  item("Actions", "Issue refund", "Send money back", () =>
    action("Issue refund", "Stripe", "create_refund", true, true),
  ),
  item("Actions", "Write report", "Save a summary; changes nothing else", () =>
    action("Write report", "Workspace", "save_document", false),
  ),
];

export const CATALOG_GROUPS: CatalogGroup[] = [
  "Triggers",
  "Agents",
  "Control",
  "Models",
  "Skills",
  "MCP servers",
  "Knowledge and memory",
  "Actions",
];
