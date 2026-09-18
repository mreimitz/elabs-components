/**
 * "Atlas" — the fictional AI operations copilot that Acme Logistics (the
 * company behind `kpi-card-parts/data/acme-quarter`) runs over its ERP, CRM,
 * mailbox and telematics feeds. Every agent-ops block in this registry
 * category reads from this ONE dataset so the numbers agree with each other
 * across blocks.
 *
 * Two rules the whole category obeys (they are what the source screens are
 * about, not decoration):
 *
 * 1. Every figure names its SOURCE and its FRESHNESS. A number that cannot
 *    say where it came from is not shown.
 * 2. Atlas never resolves a CONFLICT, contacts a customer or closes a deal on
 *    its own — those always stop and ask a person. So "held" is not an error
 *    and is counted separately from failures.
 *
 * Every number below is a typed FACT (an actual, a count, a timestamp);
 * every derived quantity (a share, a delta, an "n of m") is computed at
 * render time by the block — never pre-typed here.
 */

/** The snapshot moment — 31 Aug 2026, 09:40 UTC (same as `AS_OF_DATE` in acme-quarter). */
export const NOW = new Date(Date.UTC(2026, 7, 31, 9, 40));

/** The 06:02 derivation run that produced today's figures. */
export const DERIVED_AT = new Date(Date.UTC(2026, 7, 31, 6, 2));

export const COPILOT_NAME = "Atlas";

// ─── Actors ───────────────────────────────────────────────────────────────────

export type ActorKind = "copilot" | "agent" | "human";

export interface Actor {
  id: string;
  kind: ActorKind;
  name: string;
  /** Two-letter monogram, humans only. */
  initials?: string;
}

export const actors = {
  atlas: { id: "atlas", kind: "copilot", name: COPILOT_NAME },
  enrichment: { id: "enrichment-agent", kind: "agent", name: "Enrichment agent" },
  renewal: { id: "renewal-agent", kind: "agent", name: "Renewal agent" },
  marco: { id: "marco", kind: "human", name: "Marco Reis", initials: "MR" },
  yuki: { id: "yuki", kind: "human", name: "Yuki Tanaka", initials: "YT" },
  sofia: { id: "sofia", kind: "human", name: "Sofia Almeida", initials: "SA" },
} as const satisfies Record<string, Actor>;

// ─── Evidence ─────────────────────────────────────────────────────────────────

/** The kinds of source document a derivation can point at. */
export type EvidenceKind = "email" | "meeting" | "call" | "invoice" | "event" | "note" | "filing";

export interface Evidence {
  kind: EvidenceKind;
  label: string;
}

// ─── Headline KPIs with provenance ────────────────────────────────────────────

export interface ProvenanceKpi {
  id: string;
  label: string;
  /** Already in display units — see `unit`. */
  value: number;
  unit: "currency" | "percent" | "count";
  /** Same KPI at the prior comparison point (last month / last quarter). */
  prior: number;
  higherIsBetter: boolean;
  /** Where the figure comes from, e.g. "ERP" or "Stripe + invoices". */
  source: string;
  /** When that source last reported; `derivedFrom` names what Atlas read instead. */
  refreshedAt: Date;
  /** For a derived figure: "61 open orders" — the input set, so the reader can judge it. */
  derivedFrom?: string;
  currency?: string;
}

export const headlineKpis: ProvenanceKpi[] = [
  {
    id: "recurring-revenue",
    label: "Recurring revenue",
    value: 164_200,
    unit: "currency",
    prior: 146_100,
    higherIsBetter: true,
    source: "ERP",
    refreshedAt: new Date(Date.UTC(2026, 7, 31, 9, 38)),
  },
  {
    id: "open-pipeline",
    label: "Open pipeline",
    value: 1_480_000,
    unit: "currency",
    prior: 1_420_000,
    higherIsBetter: true,
    source: "CRM",
    refreshedAt: DERIVED_AT,
    derivedFrom: "61 open orders",
  },
  {
    id: "net-retention",
    label: "Net revenue retention",
    value: 114,
    unit: "percent",
    prior: 116,
    higherIsBetter: true,
    source: "ERP + invoices",
    refreshedAt: DERIVED_AT,
  },
  {
    id: "weighted-forecast",
    label: "Weighted forecast",
    value: 744_000,
    unit: "currency",
    prior: 731_000,
    higherIsBetter: true,
    source: "Calibrated model",
    refreshedAt: DERIVED_AT,
  },
];

// ─── "What changed while you were away" ───────────────────────────────────────

export type InsightKind = "applied" | "adjusted" | "conflict";

export interface Insight {
  id: string;
  kind: InsightKind;
  /** One sentence, the fact. */
  headline: string;
  /** Why Atlas did it, what it read, what it left alone. */
  explanation: string;
  evidence: Evidence[];
  /** 0–1. Absent for a conflict — Atlas reports no confidence for a decision it declined to make. */
  confidence?: number;
  /** The object the insight is about, for the primary action. */
  subject: string;
  primaryAction: string;
  secondaryAction: string;
}

export const insights: Insight[] = [
  {
    id: "northwind-negotiation",
    kind: "applied",
    headline: "Northwind moved to Negotiation — nobody changed it.",
    explanation:
      "Their VP Finance asked for a redlined MSA on Tuesday and legal replied inside the hour. Atlas moved the stage and set the close date to 12 September. The previous date, 30 September, was entered by Marco on 4 August and is now overridden — his value is kept and shown beneath.",
    evidence: [
      { kind: "email", label: "Email thread" },
      { kind: "meeting", label: "Meeting" },
    ],
    confidence: 0.91,
    subject: "Northwind — Expansion",
    primaryAction: "Open deal",
    secondaryAction: "Keep 30 Sep",
  },
  {
    id: "arden-quiet",
    kind: "adjusted",
    headline: "Arden Health has gone quiet for 19 days.",
    explanation:
      "No inbound since the security review closed on 1 August. Three outbound messages, no replies. Deals of this size that go quiet past 21 days close 34% less often, so the weighted forecast has been reduced by $58,000. Nothing about the deal record itself changed.",
    evidence: [
      { kind: "email", label: "Email thread" },
      { kind: "event", label: "Product event" },
    ],
    confidence: 0.64,
    subject: "Arden Health",
    primaryAction: "Open account",
    secondaryAction: "Snooze 7 days",
  },
  {
    id: "halden-seats",
    kind: "conflict",
    headline: "Two sources disagree on Halden Group’s seat count.",
    explanation:
      "The signed order form says 240 seats. The product has counted 318 active users for eleven straight days. Atlas has not chosen between them. The gap is worth $23,400 in overage and a person should decide whether to bill it.",
    evidence: [
      { kind: "invoice", label: "Invoice" },
      { kind: "event", label: "Product event" },
    ],
    subject: "Halden Group",
    primaryAction: "Review the conflict",
    secondaryAction: "Ask the owner",
  },
];

/** The three things that stopped and are waiting for a person. */
export interface HeldItem {
  id: string;
  tone: "destructive" | "warning";
  title: string;
  note: string;
}

export const heldItems: HeldItem[] = [
  {
    id: "w-31",
    tone: "destructive",
    title: "Renewal email would reach a churn-risk account",
    note: "Automation W-31 · held before sending",
  },
  {
    id: "won-band",
    tone: "warning",
    title: "An agent tried to move Halden to Won",
    note: "Outside its band · stopped and logged",
  },
  {
    id: "close-date",
    tone: "warning",
    title: "Close date conflict on Northwind",
    note: "Order form and calendar disagree",
  },
];

/** Derivation load for the last 24 hours. */
export const derivationLoad = {
  appliedAutomatically: 403,
  sentToAPerson: 9,
  pinnedByPeople: 3,
};

// ─── A record with per-field provenance ───────────────────────────────────────

export type FieldProvenance =
  | { state: "derived"; confidence: number; evidence: Evidence }
  | { state: "pinned"; by: Actor; at: Date }
  | { state: "conflict"; note: string }
  | { state: "empty" };

export interface RecordField {
  id: string;
  label: string;
  /** Already formatted for display — a record field is text, not a number to re-format. */
  value: string | null;
  provenance: FieldProvenance;
}

export const contactRecord = {
  name: "Elena Varga",
  title: "VP Data",
  company: "Northwind Systems",
  stage: "Qualified",
  fields: [
    {
      id: "job-title",
      label: "Job title",
      value: "VP Data",
      provenance: {
        state: "derived",
        confidence: 0.96,
        evidence: { kind: "email", label: "Email" },
      },
    },
    {
      id: "company",
      label: "Company",
      value: "Northwind Systems",
      provenance: {
        state: "derived",
        confidence: 0.99,
        evidence: { kind: "email", label: "Email" },
      },
    },
    {
      id: "seats",
      label: "Seat estimate",
      value: "240 seats",
      provenance: { state: "conflict", note: "Order form says 240, product counts 318" },
    },
    {
      id: "budget",
      label: "Budget",
      value: "$180,000–$200,000",
      provenance: {
        state: "derived",
        confidence: 0.71,
        evidence: { kind: "meeting", label: "Meeting" },
      },
    },
    {
      id: "timeline",
      label: "Decision timeline",
      value: "Q3 close",
      provenance: { state: "pinned", by: actors.marco, at: new Date(Date.UTC(2026, 7, 4, 15, 10)) },
    },
    {
      id: "role",
      label: "Buying role",
      value: "Economic buyer",
      provenance: { state: "derived", confidence: 0.84, evidence: { kind: "call", label: "Call" } },
    },
    { id: "competitor", label: "Competitor", value: null, provenance: { state: "empty" } },
    {
      id: "last-inbound",
      label: "Last inbound",
      value: "18 August",
      provenance: { state: "derived", confidence: 1, evidence: { kind: "email", label: "Email" } },
    },
  ] satisfies RecordField[],
};

// ─── "Why the score is 91" ────────────────────────────────────────────────────

export interface ScoreSignal {
  id: string;
  label: string;
  /** Signed contribution in score points. */
  points: number;
}

export const leadScore = {
  score: 91,
  signals: [
    { id: "exec-reply", label: "Executive replied within 4 hours", points: 18 },
    { id: "trials", label: "Three product trials in 14 days", points: 14 },
    { id: "hiring", label: "Company added 25 engineers on LinkedIn", points: 9 },
    { id: "procurement", label: "No procurement contact identified", points: -6 },
    { id: "cold", label: "First touch was a cold email", points: -4 },
  ] satisfies ScoreSignal[],
  /** Signals considered but not shown because each moved the score by less than 2 points. */
  omittedSignals: 9,
  omittedThreshold: 2,
};

// ─── Agent spend envelopes ────────────────────────────────────────────────────

export type Autonomy = "auto" | "review" | "hold";

export interface AgentEnvelope {
  id: string;
  /** Monospace agent id, e.g. "close-bot". */
  name: string;
  purpose: string;
  operator: Actor;
  model: string;
  autonomy: Autonomy;
  /** Month-to-date spend against `limit`, in USD. */
  spent: number;
  limit: number;
  lastAction: string;
  lastActionAt: Date;
}

const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

export const agentEnvelopes: AgentEnvelope[] = [
  {
    id: "scrape-bot",
    name: "scrape-bot",
    purpose: "Market data",
    operator: actors.marco,
    model: "gemini-3-flash",
    autonomy: "hold",
    spent: 612,
    limit: 500,
    lastAction: "Blocked — over limit",
    lastActionAt: minutesAgo(4 * 60),
  },
  {
    id: "close-bot",
    name: "close-bot",
    purpose: "Month-end close",
    operator: actors.sofia,
    model: "claude-opus-4.6",
    autonomy: "review",
    spent: 4_912,
    limit: 6_000,
    lastAction: "Posted 41 journal entries",
    lastActionAt: minutesAgo(2),
  },
  {
    id: "renewal-bot",
    name: "renewal-bot",
    purpose: "Renewal negotiation",
    operator: actors.marco,
    model: "claude-opus-4.6",
    autonomy: "review",
    spent: 3_180,
    limit: 4_000,
    lastAction: "Drafted 6 counter-offers",
    lastActionAt: minutesAgo(5 * 60),
  },
  {
    id: "recon-bot",
    name: "recon-bot",
    purpose: "Bank reconciliation",
    operator: actors.yuki,
    model: "gpt-5.2",
    autonomy: "auto",
    spent: 928,
    limit: 1_500,
    lastAction: "Matched 1,166 receipts",
    lastActionAt: minutesAgo(3 * 60),
  },
  {
    id: "triage-bot",
    name: "triage-bot",
    purpose: "Support triage",
    operator: actors.yuki,
    model: "gpt-5.2-mini",
    autonomy: "auto",
    spent: 1_802,
    limit: 3_000,
    lastAction: "Issued 12 refunds",
    lastActionAt: minutesAgo(9),
  },
  {
    id: "contract-bot",
    name: "contract-bot",
    purpose: "Contract parsing",
    operator: actors.sofia,
    model: "claude-sonnet-4.6",
    autonomy: "auto",
    spent: 1_406,
    limit: 2_500,
    lastAction: "Parsed 22 renewals",
    lastActionAt: minutesAgo(26 * 60),
  },
  {
    id: "forecast-bot",
    name: "forecast-bot",
    purpose: "Cash forecasting",
    operator: actors.yuki,
    model: "claude-opus-4.6",
    autonomy: "review",
    spent: 2_204,
    limit: 4_000,
    lastAction: "Updated 14-week runway",
    lastActionAt: minutesAgo(6 * 60),
  },
  {
    id: "vendor-bot",
    name: "vendor-bot",
    purpose: "Vendor onboarding",
    operator: actors.sofia,
    model: "claude-sonnet-4.6",
    autonomy: "auto",
    spent: 684,
    limit: 2_000,
    lastAction: "Verified 3 vendors",
    lastActionAt: minutesAgo(60),
  },
];

// ─── Escalation boundary ──────────────────────────────────────────────────────

/** One rung of the evidence ladder: how many of the five signals corroborated a decision. */
export interface EvidenceRung {
  /** 0–5 signals held. */
  held: number;
  meaning: string;
  /** Decisions in the last 90 days that landed on this rung. */
  decisions: number;
  /** Bad decisions among them that a review caught (or would have). */
  badCaught: number;
}

export const evidenceLadder: EvidenceRung[] = [
  {
    held: 5,
    meaning: "Document, vendor, network, calendar and history all agree",
    decisions: 2_918,
    badCaught: 1,
  },
  { held: 4, meaning: "One signal missing, none contradicting", decisions: 942, badCaught: 1 },
  {
    held: 3,
    meaning: "Two signals missing or one weak contradiction",
    decisions: 218,
    badCaught: 1,
  },
  { held: 2, meaning: "Majority uncorroborated", decisions: 86, badCaught: 2 },
  { held: 1, meaning: "Only one signal held", decisions: 14, badCaught: 3 },
  { held: 0, meaning: "Nothing corroborated", decisions: 4, badCaught: 2 },
];

export const EVIDENCE_SIGNALS = 5;
/** Decisions on a rung with at least this many signals clear without a person. Atlas recommends 4. */
export const RECOMMENDED_THRESHOLD = 4;
export const boundaryWindowDays = 90;
export const boundaryStats = {
  medianTimeToClear: "34 seconds",
  caughtBelowTheLine: "3 synthetic receipts",
  clearedAboveInError: 0,
};

// ─── Decision record ──────────────────────────────────────────────────────────

export interface DecisionCheck {
  id: string;
  label: string;
  detail: string;
  confirmed: boolean;
}

export const decisionRecord = {
  id: "txn_9f2c41ab",
  entry: 1_284_006,
  at: new Date(Date.UTC(2026, 7, 31, 6, 2, 9, 418)),
  durationMs: 1_400,
  subject: "Blue Bottle Coffee",
  amount: -38.75,
  currency: "USD",
  verdict: "The receipt does not match the charge",
  verdictDetail:
    "The card network authorised $12.40 at Blue Bottle Coffee on 12 Aug, 09:14. The receipt submitted claims $38.75 for four attendees. The image carries generation artefacts and shares a render signature with two other receipts filed this month.",
  whatItDid: "Held the transaction and stopped the reimbursement. No money moved.",
  whatItLookedAt: [
    { kind: "invoice", label: "Receipt" },
    { kind: "event", label: "Card network" },
    { kind: "meeting", label: "Calendar" },
  ] satisfies Evidence[],
  lookedAtDetail:
    "Card-network authorisation of 12 Aug (mean of the last 14 meals claims: $11.80), the submitted image, and the cardholder’s calendar for that day.",
  rule: "evidence.receipt_contradicts_network",
  ruleDetail:
    "A document that contradicts the card network never clears on its own, at any autonomy setting.",
  confidence: null as number | null,
  confidenceDetail: "Atlas does not report a confidence for a decision it declined to make.",
  howToReverse:
    "Confirm the receipt on the transaction, or reimburse the authorised $12.40. Either choice is pinned and the hold closes.",
  checks: [
    {
      id: "authenticity",
      label: "Document authenticity",
      detail: "Generation artefacts in EXIF and glyph rendering.",
      confirmed: false,
    },
    {
      id: "vendor",
      label: "Vendor record match",
      detail: "Blue Bottle Coffee, 66 Mint St — matches merchant on file.",
      confirmed: true,
    },
    {
      id: "amount",
      label: "Card-network amount",
      detail: "Authorised $12.40. Receipt claims $38.75. Δ $26.35.",
      confirmed: false,
    },
    {
      id: "calendar",
      label: "Calendar corroboration",
      detail: "No four-person meeting on 12 Aug for this employee.",
      confirmed: false,
    },
    {
      id: "history",
      label: "Historical pattern",
      detail: "First meals claim from this cardholder in 14 months.",
      confirmed: false,
    },
  ] satisfies DecisionCheck[],
  proposes: [
    "Reject the receipt and notify the cardholder",
    "Reimburse $12.40 — the authorised amount",
    "Open a document review on 2 matching receipts",
    "Move this cardholder to Review for 60 days",
  ],
};

// ─── Audit log ────────────────────────────────────────────────────────────────

export type AuditResult = "applied" | "held" | "stopped" | "reverted";

export interface AuditEntry {
  id: string;
  at: Date;
  actor: Actor;
  action: string;
  object: string;
  result: AuditResult;
}

const today = (h: number, m: number, s: number) => new Date(Date.UTC(2026, 7, 31, h, m, s));
const yesterday = (h: number, m: number, s: number) => new Date(Date.UTC(2026, 7, 30, h, m, s));

export const auditEntries: AuditEntry[] = [
  {
    id: "a1",
    at: today(6, 2, 14),
    actor: actors.atlas,
    action: "Set stage to Negotiation, confidence 0.91",
    object: "Northwind — Expansion",
    result: "applied",
  },
  {
    id: "a2",
    at: today(6, 2, 14),
    actor: actors.atlas,
    action: "Set close date to 12 Sep; kept the pinned value",
    object: "Northwind — Expansion",
    result: "applied",
  },
  {
    id: "a3",
    at: today(6, 2, 9),
    actor: actors.atlas,
    action: "Detected a conflict on active seats and stopped",
    object: "Halden Group",
    result: "held",
  },
  {
    id: "a4",
    at: today(6, 1, 52),
    actor: actors.atlas,
    action: "Reduced weighted value to $89,000 after 19 days of silence",
    object: "Arden Health",
    result: "applied",
  },
  {
    id: "a5",
    at: today(5, 58, 31),
    actor: actors.enrichment,
    action: "Attempted to set owner — outside its envelope",
    object: "Sable Energy",
    result: "stopped",
  },
  {
    id: "a6",
    at: today(5, 58, 2),
    actor: actors.enrichment,
    action: "Set headcount to 1,240 from a public filing",
    object: "Sable Energy",
    result: "applied",
  },
  {
    id: "a7",
    at: yesterday(22, 14, 8),
    actor: actors.marco,
    action: "Reverted stage to Nurture and pinned it",
    object: "Sable Energy",
    result: "reverted",
  },
  {
    id: "a8",
    at: yesterday(21, 40, 55),
    actor: actors.renewal,
    action: "Prepared a renewal notice; did not send",
    object: "Halden Group",
    result: "held",
  },
  {
    id: "a9",
    at: yesterday(19, 3, 12),
    actor: actors.atlas,
    action: "Set champion to Hugo Delacroix after two bounces",
    object: "Corvid Analytics",
    result: "applied",
  },
  {
    id: "a10",
    at: yesterday(18, 22, 40),
    actor: actors.yuki,
    action: "Set health to At risk; derivation stopped for this field",
    object: "Pike & Rowe",
    result: "applied",
  },
];

// ─── Agent trace ──────────────────────────────────────────────────────────────

export type SpanState = "ok" | "retry" | "failed" | "skipped";

export interface TraceSpan {
  id: string;
  agent: string;
  /** Milliseconds from run start. */
  startMs: number;
  endMs: number;
  tokens: number;
  state: SpanState;
  parentId?: string;
  /** Context fields carried into this span (present / expected). */
  fieldsPresent: number;
  fieldsExpected: number;
  contextKb: number;
}

export const trace = {
  id: "tr_84921",
  workflow: "Customer support · production",
  startedAt: new Date(Date.UTC(2026, 7, 31, 9, 42, 18, 421)),
  durationMs: 4_820,
  p95Ms: 3_100,
  agentsInvoked: 8,
  retries: 2,
  tokensIn: 9_410,
  tokensOut: 3_071,
  costUsd: 0.42,
  workflowAvgCostUsd: 0.13,
  failedAt: "Billing agent",
  failedInvocation: "5 of 8",
  error: "AuthorizationContextMissing",
  errorDetail:
    "Required field authorization_scope absent from the context handed over by Router agent.",
  spans: [
    {
      id: "supervisor",
      agent: "Supervisor agent",
      startMs: 0,
      endMs: 4_820,
      tokens: 1_204,
      state: "ok",
      fieldsPresent: 5,
      fieldsExpected: 5,
      contextKb: 4.2,
    },
    {
      id: "router",
      agent: "Router agent",
      startMs: 0,
      endMs: 580,
      tokens: 842,
      state: "ok",
      parentId: "supervisor",
      fieldsPresent: 5,
      fieldsExpected: 5,
      contextKb: 9.1,
    },
    {
      id: "knowledge",
      agent: "Knowledge agent",
      startMs: 620,
      endMs: 1_490,
      tokens: 3_104,
      state: "ok",
      parentId: "router",
      fieldsPresent: 5,
      fieldsExpected: 5,
      contextKb: 12.4,
    },
    {
      id: "support",
      agent: "Support agent",
      startMs: 1_560,
      endMs: 2_330,
      tokens: 2_441,
      state: "ok",
      parentId: "router",
      fieldsPresent: 5,
      fieldsExpected: 5,
      contextKb: 12.4,
    },
    {
      id: "billing",
      agent: "Billing agent",
      startMs: 2_420,
      endMs: 3_290,
      tokens: 3_241,
      state: "failed",
      parentId: "router",
      fieldsPresent: 4,
      fieldsExpected: 5,
      contextKb: 12.4,
    },
    {
      id: "billing-retry",
      agent: "Billing agent · retry 1",
      startMs: 3_320,
      endMs: 3_940,
      tokens: 3_241,
      state: "retry",
      parentId: "billing",
      fieldsPresent: 4,
      fieldsExpected: 5,
      contextKb: 12.4,
    },
    {
      id: "validator",
      agent: "Validator agent",
      startMs: 3_990,
      endMs: 4_280,
      tokens: 0,
      state: "skipped",
      parentId: "supervisor",
      fieldsPresent: 0,
      fieldsExpected: 5,
      contextKb: 0,
    },
    {
      id: "response",
      agent: "Response agent",
      startMs: 4_340,
      endMs: 4_630,
      tokens: 0,
      state: "skipped",
      parentId: "supervisor",
      fieldsPresent: 0,
      fieldsExpected: 5,
      contextKb: 0,
    },
  ] satisfies TraceSpan[],
};
