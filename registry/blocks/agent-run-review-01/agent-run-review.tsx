"use client";

import { useState } from "react";
import { Calculator, Database, PencilLine, Search } from "lucide-react";
import {
  AgentStep,
  AgentTimeline,
  ApprovalCard,
  ApprovalCardAccepted,
  ApprovalCardActions,
  ApprovalCardApprove,
  ApprovalCardDeny,
  ApprovalCardDescription,
  ApprovalCardRejected,
  ApprovalCardRequest,
  ApprovalCardTitle,
  Plan,
  PlanAction,
  PlanApprove,
  PlanContent,
  PlanDescription,
  PlanFooter,
  PlanHeader,
  PlanRequestChanges,
  PlanStatusLine,
  PlanTitle,
  PlanTrigger,
  TokenUsage,
  TokenUsageContent,
  TokenUsageContentFooter,
  TokenUsageContentHeader,
  TokenUsageTrigger,
  Tool,
  ToolContent,
  ToolDetails,
  ToolHeader,
  ToolInput,
  ToolOutput,
  ToolResultCard,
  type PlanStatus,
} from "@elabs-ai/components-ai";
import { Bar, BarChart, BarXAxis, ChartTooltip, Grid } from "@elabs-ai/components-charts";
import { Badge } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export interface AgentRunReviewProps {
  /** Start with the plan already approved — the run view without the first decision. */
  defaultPlanStatus?: PlanStatus;
  /** Fired with the decision on the side effect; the block never performs it. */
  onDecision?: (approved: boolean) => void;
  className?: string;
}

const lateByLane = [
  { lane: "RTM → LAX", late: 21 },
  { lane: "RTM → GRU", late: 16 },
  { lane: "RTM → SHA", late: 12 },
  { lane: "RTM → JNB", late: 10 },
  { lane: "RTM → SIN", late: 9 },
];

/**
 * One agent run, reviewable end to end: the plan it asks you to approve, the steps it has
 * taken, the tool calls behind them (arguments and results one click away), the chart it
 * produced, what it has spent, and the one side effect that waits for a human.
 */
export function AgentRunReview({
  defaultPlanStatus = "awaiting",
  onDecision,
  className,
}: AgentRunReviewProps) {
  const [planStatus, setPlanStatus] = useState<PlanStatus>(defaultPlanStatus);
  const [approved, setApproved] = useState<boolean | null>(null);
  const decide = (value: boolean) => {
    setApproved(value);
    onDecision?.(value);
  };

  return (
    <section
      aria-label="Agent run review"
      className={cn("@container flex flex-col gap-4", className)}
      data-slot="agent-run-review"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
            Run 8f2c · lane-delay analyst
          </p>
          <h2 className="text-title font-semibold text-balance">
            Which lanes are late, and should the carriers hear about it?
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={approved === null ? "warning" : approved ? "success" : "secondary"}>
            {approved === null ? "Waiting for you" : approved ? "Sent" : "Stopped"}
          </Badge>
          <TokenUsage maxTokens={200_000} usedTokens={38_400}>
            <TokenUsageTrigger />
            <TokenUsageContent>
              <TokenUsageContentHeader />
              <TokenUsageContentFooter />
            </TokenUsageContent>
          </TokenUsage>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <Plan defaultOpen status={planStatus}>
            <PlanHeader>
              <div className="min-w-0">
                <PlanTitle>Find the late lanes and brief the carriers</PlanTitle>
                <PlanDescription>
                  Read the quarter's sailings, rank lanes by late share, then draft one note per
                  carrier.
                </PlanDescription>
              </div>
              <PlanAction>
                <PlanTrigger />
              </PlanAction>
            </PlanHeader>
            <PlanContent>
              <ol className="list-decimal space-y-1 ps-5 text-body text-muted-foreground">
                <li>Query sailings for the quarter from the warehouse</li>
                <li>Rank lanes by share of late arrivals</li>
                <li>Chart the five worst lanes</li>
                <li>Draft a note per carrier and ask before sending</li>
              </ol>
            </PlanContent>
            <PlanFooter className="flex-col items-stretch gap-3">
              <PlanStatusLine />
              {planStatus === "awaiting" ? (
                <div className="flex w-full items-center justify-end gap-2">
                  <PlanRequestChanges onClick={() => setPlanStatus("changes-requested")}>
                    Request changes
                  </PlanRequestChanges>
                  <PlanApprove onClick={() => setPlanStatus("approved")}>Approve</PlanApprove>
                </div>
              ) : null}
            </PlanFooter>
          </Plan>

          <AgentTimeline aria-label="Agent progress">
            <AgentStep
              icon={Database}
              name="Queried ops.sailings"
              status="complete"
              summary="7 lanes · 1,204 sailings this quarter"
            />
            <AgentStep
              icon={Calculator}
              name="Ranked lanes by late share"
              status="complete"
              summary="Two lanes under the 85% on-time floor"
            />
            <AgentStep
              icon={Search}
              name="Looked up carrier contacts"
              status="complete"
              summary="4 carriers · 4 account owners"
            />
            <AgentStep
              icon={PencilLine}
              name="Drafting carrier notes"
              status={approved === null ? "awaiting-approval" : approved ? "complete" : "skipped"}
            />
          </AgentTimeline>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Tool>
            <ToolHeader
              state="output-available"
              summary="7 rows · 2 under the floor"
              title="Query warehouse"
              toolName="queryWarehouse"
              type="dynamic-tool"
            />
            <ToolContent>
              <ToolDetails>
                <ToolInput
                  input={{
                    sql: "select lane, avg(late::int) late_share from ops.sailings where quarter = '2026-Q3' group by 1 order by 2 desc",
                  }}
                />
                <ToolOutput
                  errorText={undefined}
                  output={{ rows: 7, worst: "RTM → LAX", late_share: 0.21 }}
                />
              </ToolDetails>
            </ToolContent>
          </Tool>

          <ToolResultCard
            status="complete"
            summary="Share of sailings that arrived outside their window, this quarter"
            title="Five lanes carry most of the lateness"
          >
            <BarChart
              accessibleLabel="Late share by lane, percent"
              data={lateByLane}
              plotHeight={220}
              xDataKey="lane"
            >
              <Grid horizontal />
              <Bar dataKey="late" fill="var(--chart-1)" lineCap="round" />
              <BarXAxis />
              <ChartTooltip />
            </BarChart>
          </ToolResultCard>

          <ApprovalCard
            approval={{ id: "appr_carrier_notes", approved: approved ?? undefined }}
            state={approved === null ? "approval-requested" : "approval-responded"}
          >
            <ApprovalCardRequest>
              <ApprovalCardTitle>
                Send the four carrier notes from <strong>ops@acme-logistics.example</strong>?
              </ApprovalCardTitle>
              <ApprovalCardDescription>
                Emails leave the building. Nothing is sent until you approve, and each note stays
                editable in Drafts either way.
              </ApprovalCardDescription>
              <ApprovalCardActions>
                <ApprovalCardDeny onClick={() => decide(false)}>Don't send</ApprovalCardDeny>
                <ApprovalCardApprove onClick={() => decide(true)}>
                  Approve and send
                </ApprovalCardApprove>
              </ApprovalCardActions>
            </ApprovalCardRequest>
            <ApprovalCardAccepted>
              <ApprovalCardTitle>Approved — four notes sent.</ApprovalCardTitle>
            </ApprovalCardAccepted>
            <ApprovalCardRejected>
              <ApprovalCardTitle>
                Stopped — nothing was sent. The drafts are kept.
              </ApprovalCardTitle>
            </ApprovalCardRejected>
          </ApprovalCard>
        </div>
      </div>
    </section>
  );
}
