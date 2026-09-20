// registry: agent-studio-page — copied 2026-09-20
/**
 * What the studio knows about its designs beyond the designs themselves: how they have
 * been running, and the runs. Sample data for one week at a mid-size distributor.
 */
import type { RunStatus } from "../../agent-designer-01/types";

export interface DesignStats {
  state: "live" | "draft";
  /** Runs per day, oldest first, last seven days. */
  runsByDay: number[];
  /** Share of runs that finished without a person taking over. */
  unattended: number;
  avgCostUsd: number;
  avgSeconds: number;
  waitingApprovals: number;
  editedBy: string;
  edited: string;
}

export const DESIGN_STATS: Record<string, DesignStats> = {
  support: {
    state: "draft",
    runsByDay: [412, 388, 455, 431, 470, 212, 198],
    unattended: 0.71,
    avgCostUsd: 0.21,
    avgSeconds: 9.4,
    waitingApprovals: 3,
    editedBy: "Jonas Weber",
    edited: "2 h ago",
  },
  invoices: {
    state: "live",
    runsByDay: [188, 203, 176, 214, 229, 12, 4],
    unattended: 0.64,
    avgCostUsd: 0.17,
    avgSeconds: 14.2,
    waitingApprovals: 7,
    editedBy: "Amira Haddad",
    edited: "6 days ago",
  },
  leads: {
    state: "draft",
    runsByDay: [61, 74, 58, 92, 80, 9, 6],
    unattended: 0.38,
    avgCostUsd: 0.44,
    avgSeconds: 31.0,
    waitingApprovals: 5,
    editedBy: "Mei Tanaka",
    edited: "yesterday",
  },
};

export interface StudioRun {
  id: string;
  designId: string;
  subject: string;
  status: RunStatus;
  started: string;
  seconds: number;
  costUsd: number;
  toolCalls: number;
  /** What happened, in the order it happened. */
  steps: { title: string; detail: string; status: RunStatus }[];
  /** This run has a full trace behind it (the `agent-trace-waterfall-01` block). */
  hasTrace?: boolean;
}

const ok = (title: string, detail: string) => ({ title, detail, status: "complete" as const });

export const RUNS: StudioRun[] = [
  {
    id: "tr_84921",
    designId: "support",
    subject: "Ticket #48213 · double charge on renewal",
    status: "failed",
    started: "09:42",
    seconds: 4.8,
    costUsd: 0.42,
    toolCalls: 8,
    hasTrace: true,
    steps: [
      ok("New ticket", "Email from a customer on the Team plan"),
      ok("Personal data", "1 card number masked"),
      ok("Support resolver", "Found two charges 40 s apart; policy rule R-7 applies"),
      ok("What does it need?", "Took “Refund over €100”"),
      {
        title: "Issue refund",
        detail: "Stripe.create_refund failed: authorization context missing",
        status: "failed",
      },
    ],
  },
  {
    id: "tr_84917",
    designId: "invoices",
    subject: "Invoice 2026-1183 · Nordwind Logistik · €12,480.00",
    status: "awaiting-approval",
    started: "09:37",
    seconds: 13.1,
    costUsd: 0.19,
    toolCalls: 6,
    steps: [
      ok("Mail received", "PDF, 3 pages"),
      ok("Invoice reader", "14 lines, confidence 0.97; coded to 6300 / CC 4410"),
      ok("Duplicate check", "No match in 18 months; bank details match"),
      ok("Matcher", "PO 4500018832 and 2 goods receipts: all lines within tolerance"),
      ok("Match result", "Took “Clean, €5,000 or more”"),
      {
        title: "Controller signs",
        detail: "Waiting for Financial controllers in Microsoft Teams (19 h left)",
        status: "awaiting-approval",
      },
    ],
  },
  {
    id: "tr_84915",
    designId: "support",
    subject: "Ticket #48209 · where is my order",
    status: "complete",
    started: "09:35",
    seconds: 7.2,
    costUsd: 0.12,
    toolCalls: 4,
    steps: [
      ok("New ticket", "Chat"),
      ok("Personal data", "Nothing to mask"),
      ok("Support resolver", "Carrier scan 06:12 in Linz; answered from help centre article 214"),
      ok("What does it need?", "Took “An answer”"),
      ok("Reply to customer", "Sent in German, 84 words"),
    ],
  },
  {
    id: "tr_84911",
    designId: "leads",
    subject: "Lead · Alpenrail Cargo GmbH · web form",
    status: "awaiting-approval",
    started: "09:31",
    seconds: 38.4,
    costUsd: 0.51,
    toolCalls: 17,
    steps: [
      ok("New lead", "Pricing page form"),
      ok("Researcher", "420 staff, rail freight; existing customer of one product since 2024"),
      ok("Scorer", "Score 82: install base, headcount growth, pricing-page visit"),
      ok("Score", "Took “Hot”"),
      ok("Outreach writer", "Draft: 96 words, one question"),
      ok("Reviewer", "All 4 claims verified against the brief"),
      {
        title: "Rep sends or edits",
        detail: "Waiting for the lead owner by email (6 h left)",
        status: "awaiting-approval",
      },
    ],
  },
  {
    id: "tr_84902",
    designId: "invoices",
    subject: "Invoice R-77120 · Brenner Verpackung · €1,912.40",
    status: "complete",
    started: "09:24",
    seconds: 11.8,
    costUsd: 0.15,
    toolCalls: 6,
    steps: [
      ok("Mail received", "XML (ZUGFeRD)"),
      ok("Invoice reader", "6 lines, confidence 0.99"),
      ok("Duplicate check", "No match"),
      ok("Matcher", "All lines within tolerance"),
      ok("Match result", "Took “Clean, under €5,000”"),
      ok("Post invoice", "Document 5100043377 posted"),
    ],
  },
  {
    id: "tr_84896",
    designId: "invoices",
    subject: "Invoice 88-2291 · Kessler Stahl · €23,004.75",
    status: "denied",
    started: "09:18",
    seconds: 15.5,
    costUsd: 0.2,
    toolCalls: 7,
    steps: [
      ok("Mail received", "PDF, 2 pages"),
      ok("Invoice reader", "9 lines, confidence 0.93"),
      ok("Duplicate check", "No match"),
      ok("Matcher", "Line 4: price 3.2% over PO, tolerance is 2%"),
      ok("Match result", "Took “Differences”"),
      { title: "Park and ask buyer", detail: "Parked; buyer asked about line 4", status: "denied" },
    ],
  },
  {
    id: "tr_84880",
    designId: "leads",
    subject: "Lead · student enquiry · event scan",
    status: "complete",
    started: "09:02",
    seconds: 21.9,
    costUsd: 0.33,
    toolCalls: 11,
    steps: [
      ok("New lead", "Badge scan, trade fair"),
      ok("Researcher", "Private address, no company"),
      ok("Scorer", "Score 12"),
      ok("Score", "Took “Cold”"),
      ok("Close as unqualified", "Reason: no company"),
    ],
  },
];
