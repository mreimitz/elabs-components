// registry: agent-ops-center-page — copied 2026-09-19
/**
 * Agent operations center — the control room for a fleet of AI agents.
 *
 * What it shows a copier: the agent-ops block family working as ONE product. Four tabs, four
 * jobs — what changed and what it costs (Overview), where a run failed and where its context
 * was dropped (Runs), what waits for a human (Review), and who did what (Audit) — with the
 * decisions made in one tab showing up as counts in the navigation and the header. Every
 * callback a block exposes is wired: revoke an agent, move the autonomy threshold, approve
 * a run, settle a decision.
 */
"use client";

import { useState } from "react";
import {
  Bot,
  ClipboardCheck,
  Gauge,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  Waypoints,
  Wallet,
} from "lucide-react";
import {
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toaster,
  toast,
} from "@elabs-ai/components-ui";
import { AgentRunReview } from "../agent-run-review-01/agent-run-review";
import { AgentTraceWaterfall } from "../agent-trace-waterfall-01/agent-trace-waterfall";
import { AuditLog } from "../audit-log-01/audit-log";
import { DecisionRecord } from "../decision-record-01/decision-record";
import { EscalationBoundary } from "../escalation-boundary-01/escalation-boundary";
import { HandoffInspector } from "../handoff-inspector-01/handoff-inspector";
import { InsightFeed } from "../insight-feed-01/insight-feed";
import { SpendAgainstLimit } from "../spend-against-limit-01/spend-against-limit";
import { WorkspaceAssistant } from "../workspace-shell/workspace-assistant";
import { WorkspaceShell, type WorkspaceNavGroup } from "../workspace-shell/workspace-shell";

export interface AgentOpsCenterPageProps {
  /** `"container"` renders the whole app inside a box you give a height. */
  frame?: "viewport" | "container";
  /** Which tab opens first. */
  defaultTab?: "overview" | "runs" | "review" | "audit";
  locale?: string;
}

export default function AgentOpsCenterPage({
  frame = "viewport",
  defaultTab = "overview",
  locale = "en-US",
}: AgentOpsCenterPageProps) {
  const [tab, setTab] = useState<string>(defaultTab);
  // Two things wait for a human when the screen opens: a run's side effect and a decision.
  const [waiting, setWaiting] = useState({ run: true, decision: true });
  const open = Number(waiting.run) + Number(waiting.decision);

  const NAV: WorkspaceNavGroup[] = [
    {
      label: "Operations",
      items: [
        { id: "overview", label: "Overview", href: "#overview", icon: LayoutDashboard },
        { id: "runs", label: "Runs", href: "#runs", icon: Waypoints },
        {
          id: "review",
          label: "Review queue",
          href: "#review",
          icon: ClipboardCheck,
          badge: open > 0 ? String(open) : undefined,
        },
        { id: "audit", label: "Audit log", href: "#audit", icon: ScrollText },
      ],
    },
    {
      label: "Governance",
      items: [
        { id: "agents", label: "Agents", href: "#agents", icon: Bot },
        { id: "budgets", label: "Budgets", href: "#budgets", icon: Wallet },
        { id: "guardrails", label: "Guardrails", href: "#guardrails", icon: ShieldCheck },
        { id: "evaluations", label: "Evaluations", href: "#evaluations", icon: Gauge },
      ],
    },
  ];

  return (
    <>
      <WorkspaceShell
        activeId={tab}
        dock={{
          title: "Ops copilot",
          description: "Answers from the runs, budgets and audit trail on this screen.",
          showLabel: "Show the ops copilot",
          hideLabel: "Hide the ops copilot",
          defaultWidth: 380,
          children: (
            <WorkspaceAssistant
              brief={[
                {
                  title:
                    open === 0
                      ? "Nothing waits for you"
                      : `${open} ${open === 1 ? "item waits" : "items wait"} for a human`,
                  body: "A run's outbound email and one flagged decision. Both are in Review.",
                },
                {
                  title: "One agent is over its ceiling",
                  body: "Spend against limit lists it first; revoking it takes one click and lands in the audit log.",
                },
              ]}
              prompts={[
                {
                  prompt: "Why did the last run fail?",
                  answer:
                    "The billing agent failed, retried once and failed again: the handoff from the router arrived **without `authorization_scope`**, which billing requires. The field is present at the supervisor and the router, so it was dropped in that one hop. The trace waterfall marks it; the handoff inspector shows what was sent against what was expected.",
                },
                {
                  prompt: "Is the autonomy threshold in the right place?",
                  answer:
                    "At the current threshold about one decision in five escalates to a person. Moving it to the recommended rung would cut escalations by roughly a third with no change in reversals over the last 30 days. You can try it on the Overview tab — nothing is saved until you confirm.",
                },
              ]}
            />
          ),
        }}
        frame={frame}
        nav={NAV}
        notifications={[
          { id: "1", fallback: "RA", text: "Billing agent failed after one retry", time: "6m ago" },
          {
            id: "2",
            fallback: "LA",
            text: "Lane-delay analyst is waiting for approval",
            time: "14m ago",
          },
        ]}
        orgName="Atlas Revenue Cloud"
        productName="Agent Ops"
        trail={[
          { href: "#ops", label: "Agent operations" },
          {
            href: `#${tab}`,
            label:
              tab === "review"
                ? "Review queue"
                : tab === "audit"
                  ? "Audit log"
                  : tab === "runs"
                    ? "Runs"
                    : "Overview",
          },
        ]}
        user={{ name: "Noor Haddad", email: "noor@atlas.example" }}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="text-title font-semibold">Agent operations</h1>
              <p className="text-body text-muted-foreground">
                Every agent in one place: what it did, what it cost and what it is asking you.
              </p>
            </div>
            <Badge variant={open > 0 ? "warning" : "success"}>
              {open > 0 ? `${open} waiting for review` : "Review queue is clear"}
            </Badge>
          </div>

          <Tabs onValueChange={setTab} value={tab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="runs">Runs</TabsTrigger>
              <TabsTrigger value="review">Review{open > 0 ? ` (${open})` : ""}</TabsTrigger>
              <TabsTrigger value="audit">Audit log</TabsTrigger>
            </TabsList>

            <TabsContent className="flex flex-col gap-6" value="overview">
              <InsightFeed
                locale={locale}
                onAction={(insight, action) =>
                  toast.success(action === "primary" ? "Action taken" : "Dismissed", {
                    description: insight.headline,
                  })
                }
              />
              <SpendAgainstLimit
                locale={locale}
                onRevoke={(agent) =>
                  toast.success(`Revoked ${agent.name}`, {
                    description: "Its card is frozen and the change is in the audit log.",
                  })
                }
              />
              <EscalationBoundary />
            </TabsContent>

            <TabsContent className="flex flex-col gap-6" value="runs">
              <AgentTraceWaterfall locale={locale} />
              <HandoffInspector locale={locale} />
            </TabsContent>

            <TabsContent className="flex flex-col gap-6" value="review">
              <AgentRunReview
                onDecision={(approved) => {
                  setWaiting((prev) => ({ ...prev, run: false }));
                  toast.success(approved ? "Carrier notes sent" : "Nothing was sent");
                }}
              />
              <DecisionRecord
                locale={locale}
                onDecide={(choice) => {
                  setWaiting((prev) => ({ ...prev, decision: false }));
                  toast.success(choice === "approve" ? "Decision approved" : "Decision dismissed");
                }}
              />
            </TabsContent>

            <TabsContent value="audit">
              <AuditLog locale={locale} />
            </TabsContent>
          </Tabs>
        </div>
      </WorkspaceShell>
      <Toaster />
    </>
  );
}
