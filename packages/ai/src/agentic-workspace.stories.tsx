import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@qlik-coe-emea/qlabs-components-ui";
import { BrandLogo } from "@qlik-coe-emea/qlabs-components-icons";
// Story-only composition: the agentic-workspace SHOWCASE renders REAL @qlik-coe-emea/qlabs-components-charts
// surfaces — AutoChart (in a ChartFrame: expand / flip-to-table / download) and KPI
// MetricCards with sparklines. @qlik-coe-emea/qlabs-components-charts is a devDependency of @qlik-coe-emea/qlabs-components-ai used
// ONLY by stories — never imported by shipped src (the package's dist stays
// decoupled from its sibling). See research/ai-charts/01-ai-chart-integration-plan.md.
import {
  AutoChart,
  ChartFrame,
  Line,
  LineChart,
  MetricCard,
  MetricGrid,
} from "@qlik-coe-emea/qlabs-components-charts";
import {
  Boxes,
  Calculator,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  Database,
  FolderKanban,
  Globe,
  History,
  LogOut,
  MessageSquarePlus,
  PencilLine,
  RefreshCw,
  Search,
  Settings,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

import { AgentStep, AgentTimeline } from "./agent-timeline";
import { AssetPreview } from "./asset-preview";
import { ChatShell } from "./chat-shell";
import { Checkpoint, CheckpointIcon, CheckpointTrigger } from "./checkpoint";
import {
  ApprovalCard,
  ApprovalCardAccepted,
  ApprovalCardActions,
  ApprovalCardApprove,
  ApprovalCardDeny,
  ApprovalCardDescription,
  ApprovalCardRejected,
  ApprovalCardRequest,
  ApprovalCardTitle,
} from "./confirmation";
import {
  Context,
  ContextContent,
  ContextContentFooter,
  ContextContentHeader,
  ContextTrigger,
} from "./context";
import {
  ContextPanel,
  ContextPanelBody,
  ContextPanelDetail,
  ContextPanelHeader,
  ContextPanelProvider,
  ContextPanelSection,
  ContextPanelTrigger,
  useContextPanel,
  type ContextAsset,
} from "./context-panel";
import { Conversation, ConversationContent, ConversationScrollButton } from "./conversation";
import { ProducedAssetTree } from "./file-tree";
import {
  EvidenceChip,
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselItem,
  InlineCitationCarouselNext,
  InlineCitationCarouselPrev,
  InlineCitationQuote,
  InlineCitationSource,
  InlineCitationText,
} from "./inline-citation";
import {
  AgentMessage,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
  UserMessage,
} from "./message";
import {
  Plan,
  PlanAction,
  PlanContent,
  PlanDescription,
  PlanFooter,
  PlanHeader,
  PlanTitle,
  PlanTrigger,
} from "./plan";
import {
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputButton,
} from "./prompt-input";
import { Composer } from "./composer";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "./reasoning";
import { Shimmer } from "./shimmer";
import { SourceList } from "./sources";
import { Suggestion, Suggestions } from "./suggestion";
import { Task, TaskContent, TaskItem, TaskTrigger } from "./task";
import { Tool, ToolContent, ToolDetails, ToolHeader, ToolInput, ToolOutput } from "./tool";
import { ToolResultCard } from "./tool-result-card";

/* -------------------------------------------------------------------------- */
/*  Fixture data — the "managed" workspace entities                           */
/* -------------------------------------------------------------------------- */

// Q3 board-note figures, rendered as REAL @qlik-coe-emea/qlabs-components-charts surfaces in the showcase:
// a ChartFrame-wrapped AutoChart (expand / flip-to-table / download) plus KPI
// MetricCards with sparkline visuals.
const revenueByRegion = [
  { region: "NA", q2: 18_500_000, q3: 21_200_000 },
  { region: "EMEA", q2: 12_400_000, q3: 13_800_000 },
  { region: "APAC", q2: 8_600_000, q3: 9_400_000 },
  { region: "LATAM", q2: 3_400_000, q3: 3_800_000 },
];

const revenueColumns = [
  { key: "region", header: "Region" },
  { key: "q2", header: "Q2 (USD)" },
  { key: "q3", header: "Q3 (USD)" },
];

/** Tiny token-driven sparkline for a MetricCard `visual` slot. */
function Sparkline({ values, tone }: { values: number[]; tone: string }) {
  const data = values.map((v, i) => ({ date: new Date(2025, i, 1), v }));
  return (
    <div className="h-9 w-full">
      <LineChart
        data={data}
        aspectRatio={undefined}
        margin={{ top: 4, right: 0, bottom: 4, left: 0 }}
      >
        <Line dataKey="v" stroke={tone} strokeWidth={2} />
      </LineChart>
    </div>
  );
}

const PROJECTS = [
  { id: "atlas", name: "Atlas", tag: "Finance Copilot" },
  { id: "nova", name: "Nova", tag: "Support Triage" },
  { id: "orion", name: "Orion", tag: "Sales Insights" },
];

const SESSIONS = [
  { id: "q3-revenue", title: "Q3 revenue board note" },
  { id: "churn", title: "Churn cohort analysis" },
  { id: "schema", title: "Warehouse schema review" },
  { id: "pipeline", title: "Pipeline triage" },
];

const ASSET_CATEGORIES = [
  { id: "reports", name: "Reports", count: 4 },
  { id: "charts", name: "Charts", count: 5 },
  { id: "exports", name: "Exports", count: 3 },
];

const SUGGESTIONS = [
  "Break revenue down by region",
  "Draft a CFO email",
  "Compare against forecast",
];

const BOARD_NOTE_MD = `# Q3 FY26 Revenue — Board Note

**Total revenue: $48.2M, +12.4% QoQ** (Q2: $42.9M) — ~9% ahead of plan.

## Highlights
- Net-new ARR: **$6.1M**
- Gross margin: **79%** (+1.2 pts QoQ)
- Top driver: **EMEA expansion (+$2.3M)**

## Watch items
- Services revenue flat QoQ
- NRR steady at 114%

_Figures reconcile to the Q3 10-Q and \`finance.revenue\`._
`;

const EXEC_SUMMARY_MD = `# Q3 FY26 — Executive summary

Revenue **$48.2M (+12.4% QoQ)**, ~9% ahead of plan. EMEA was the largest
regional driver (+$2.3M); gross margin improved to **79%**.
`;

const REVENUE_SQL = `select quarter,
       region,
       sum(amount) as revenue
from   finance.revenue
where  quarter in ('2026-Q2', '2026-Q3')
group  by 1, 2
order  by 1, 2;`;

const REVENUE_CSV = `region,q2,q3
NA,18500000,21200000
EMEA,12400000,13800000
APAC,8600000,9400000
LATAM,3400000,3800000`;

const FINAL_ANSWER_MD = `Here's the headline for the board:

**Q3 revenue came in at $48.2M, up 12.4% from Q2 ($42.9M)** and ~9% ahead of forecast. Growth was led by **Cloud subscriptions (+18%)**, with **EMEA the largest regional driver (+$2.3M)**. Gross margin improved to **79%** and net-new ARR was **$6.1M**.

I drafted a one-page board note and exported the supporting figures — both are in the **Produced assets** panel on the right.`;

/** The run's grounding — shared by the answer footer and the context rail. */
const GROUNDING_SOURCES = [
  { href: "https://qlik.com/q3-10q", title: "Q3 10-Q filing" },
  { href: "https://qlik.com/earnings-deck", title: "Q3 earnings deck" },
  { href: "https://help.qlik.com/finance-revenue", title: "finance.revenue — warehouse table" },
];

/** Produced assets — the `ContextAsset` units the ContextPanel drill-in focuses. */
const PRODUCED_ASSETS: ContextAsset[] = [
  {
    id: "board-note",
    name: "board-note.md",
    path: "reports/board-note.md",
    type: "markdown",
    content: BOARD_NOTE_MD,
  },
  {
    id: "exec-summary",
    name: "exec-summary.md",
    path: "reports/exec-summary.md",
    type: "markdown",
    content: EXEC_SUMMARY_MD,
  },
  {
    id: "q3-vs-q2",
    name: "q3-vs-q2.csv",
    path: "exports/q3-vs-q2.csv",
    type: "csv",
    content: REVENUE_CSV,
  },
  {
    id: "revenue-sql",
    name: "revenue.sql",
    path: "exports/revenue.sql",
    type: "sql",
    content: REVENUE_SQL,
  },
];

/* -------------------------------------------------------------------------- */
/*  Left rail — the double-sided shell's primary navigation                    */
/* -------------------------------------------------------------------------- */

interface WorkspaceSidebarProps {
  activeProject: string;
  onSelectProject: (id: string) => void;
  activeSession: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
}

function WorkspaceSidebar({
  activeProject,
  onSelectProject,
  activeSession,
  onSelectSession,
  onNewChat,
}: WorkspaceSidebarProps) {
  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Atlas workspace">
              <span className="flex aspect-square size-8 shrink-0 items-center justify-center group-data-[collapsible=icon]:size-4">
                <BrandLogo variant="mark" className="size-full" aria-hidden />
              </span>
              <span className="grid flex-1 text-start leading-tight">
                <span className="truncate text-body font-semibold">Atlas</span>
                <span className="truncate text-meta text-muted-foreground">Agentic workspace</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Primary action */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="New chat"
                  onClick={onNewChat}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                >
                  <MessageSquarePlus />
                  <span>New chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* AI Projects */}
        <SidebarGroup>
          <SidebarGroupLabel>AI Projects</SidebarGroupLabel>
          <SidebarGroupAction title="New project">
            <ChevronRight className="size-4 rotate-90 opacity-0" aria-hidden />
            <span className="sr-only">New project</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="AI Projects">
                      <FolderKanban />
                      <span className="flex-1 truncate text-start">Projects</span>
                      <ChevronRight className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {PROJECTS.map((p) => (
                        <SidebarMenuSubItem key={p.id}>
                          <SidebarMenuSubButton asChild isActive={activeProject === p.id}>
                            <a
                              href={`#project-${p.id}`}
                              onClick={(e) => {
                                e.preventDefault();
                                onSelectProject(p.id);
                              }}
                            >
                              <span className="flex-1 truncate">{p.name}</span>
                              <span className="text-meta text-muted-foreground">{p.tag}</span>
                            </a>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Recent Sessions */}
        <SidebarGroup>
          <SidebarGroupLabel>Recent Sessions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Recent Sessions">
                      <History />
                      <span className="flex-1 truncate text-start">Sessions</span>
                      <ChevronRight className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {SESSIONS.map((s) => (
                        <SidebarMenuSubItem key={s.id}>
                          <SidebarMenuSubButton asChild isActive={activeSession === s.id}>
                            <a
                              href={`#session-${s.id}`}
                              onClick={(e) => {
                                e.preventDefault();
                                onSelectSession(s.id);
                              }}
                            >
                              <span className="truncate">{s.title}</span>
                            </a>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Produced Assets */}
        <SidebarGroup>
          <SidebarGroupLabel>Produced Assets</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Produced Assets">
                      <Boxes />
                      <span className="flex-1 truncate text-start">Assets</span>
                      <ChevronRight className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {ASSET_CATEGORIES.map((c) => (
                        <SidebarMenuSubItem key={c.id}>
                          <SidebarMenuSubButton asChild>
                            <a href={`#assets-${c.id}`}>
                              <span className="flex-1 truncate">{c.name}</span>
                              <span className="text-meta tabular-nums text-muted-foreground">
                                {c.count}
                              </span>
                            </a>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip="Account">
                  <Avatar className="size-7 rounded-md">
                    <AvatarFallback className="rounded-md text-meta">AR</AvatarFallback>
                  </Avatar>
                  <span className="grid flex-1 text-start leading-tight">
                    <span className="truncate text-body font-medium">Avery Rao</span>
                    <span className="truncate text-meta text-muted-foreground">avery@acme.co</span>
                  </span>
                  <ChevronsUpDown className="ms-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-48">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Settings className="me-2 size-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <LogOut className="me-2 size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

/* -------------------------------------------------------------------------- */
/*  Right rail — the real ContextPanel compound (#193, research 09)            */
/* -------------------------------------------------------------------------- */

/** Root view — grounding + the produced-asset tree (drill-in on select). */
function ContextRailRoot() {
  const { state, actions } = useContextPanel();
  return (
    <>
      <ContextPanelSection label="Grounding">
        <SourceList sources={GROUNDING_SOURCES} />
      </ContextPanelSection>
      <ContextPanelSection label="Produced assets">
        <ProducedAssetTree
          assets={PRODUCED_ASSETS}
          selectedId={state.selectedAsset?.id}
          onSelect={actions.openDetail}
        />
      </ContextPanelSection>
    </>
  );
}

/** Detail view — the focused asset behind the drill-in, with BACK in the header. */
function ContextRailDetail() {
  const { state } = useContextPanel();
  return (
    <ContextPanelDetail>
      {state.selectedAsset ? (
        <AssetPreview asset={state.selectedAsset} />
      ) : (
        <p className="text-body text-muted-foreground">Select a produced asset to preview it…</p>
      )}
    </ContextPanelDetail>
  );
}

/**
 * The always-mounted right rail: a `ContextPanel` sibling of the chat under the
 * workspace-wrapping provider — animated width collapse via the canonical
 * `useCollapsiblePanel`, root ↔ detail drill-in with focus management.
 */
function WorkspaceContextPanel() {
  return (
    <ContextPanel>
      <ContextPanelHeader title="Context">
        <Context usedTokens={42000} maxTokens={200000} modelId="anthropic/claude-opus-4">
          <ContextTrigger />
          <ContextContent>
            <ContextContentHeader />
            <ContextContentFooter />
          </ContextContent>
        </Context>
      </ContextPanelHeader>
      <ContextPanelBody root={<ContextRailRoot />} detail={<ContextRailDetail />} />
    </ContextPanel>
  );
}

/* -------------------------------------------------------------------------- */
/*  The agentic transcript — a full reasoning → plan → tools → answer run       */
/* -------------------------------------------------------------------------- */

function AgentRun() {
  // Human-in-the-loop approval for the "post to Slack" side effect.
  const [approved, setApproved] = useState<boolean | null>(null);
  const confirmationState = approved === null ? "approval-requested" : "approval-responded";

  return (
    <>
      {/* The user's request */}
      <UserMessage>
        <MessageContent>
          Summarize Q3 revenue vs Q2, draft a board-ready note, and post the final note to #finance.
        </MessageContent>
      </UserMessage>

      {/* Thinking */}
      <Reasoning duration={8}>
        <ReasoningTrigger />
        <ReasoningContent>
          {`The user wants a board-ready Q3 revenue note plus a Slack post.

I'll ground the numbers in the Q3 filing and reconcile them against the warehouse so the figures match what finance reports. Posting to Slack is a side effect, so I'll pause for approval before sending.`}
        </ReasoningContent>
      </Reasoning>

      {/* Proposed plan — a proposal, not an executed step (stays distinct from
          the timeline); collapsed: only the chart + the answer stay focal. */}
      <Plan>
        <PlanHeader>
          <div className="min-w-0">
            <PlanTitle>Draft the Q3 board note</PlanTitle>
            <PlanDescription>
              Retrieve filings, reconcile to the warehouse, then summarize.
            </PlanDescription>
          </div>
          <PlanAction>
            <PlanTrigger />
          </PlanAction>
        </PlanHeader>
        <PlanContent>
          <ol className="list-decimal space-y-1 ps-5 text-body text-muted-foreground">
            <li>Pull the Q3 10-Q and Q2 board pack</li>
            <li>
              Reconcile to <code>finance.revenue</code> in the warehouse
            </li>
            <li>Compute QoQ growth, ARR and gross margin</li>
            <li>Draft a one-page note and export the figures</li>
          </ol>
        </PlanContent>
        <PlanFooter>
          <span className="text-meta text-muted-foreground">
            4 steps · grounded in filings + warehouse
          </span>
        </PlanFooter>
      </Plan>

      {/* Step timeline — the canonical execution-trace rail (#192) */}
      <AgentTimeline aria-label="Agent progress">
        <AgentStep
          icon={Search}
          status="complete"
          name="Searched financial filings"
          summary="3 documents · Q3 10-Q, earnings deck, board pack Q2"
        />
        <AgentStep
          icon={Database}
          status="complete"
          name="Queried finance.revenue"
          summary="Aggregated by quarter & region"
        />
        <AgentStep
          icon={Calculator}
          status="running"
          name="Computing QoQ deltas"
          summary="Growth, ARR, margin"
        />
        <AgentStep icon={PencilLine} status="pending" name="Draft the board note" />
      </AgentTimeline>

      {/* Tool call — document search; JSON behind the default-collapsed details */}
      <Tool>
        <ToolHeader
          type="tool-searchFilings"
          state="output-available"
          summary="3 documents found"
        />
        <ToolContent>
          <ToolDetails>
            <ToolInput
              input={{
                query: "Q3 revenue, ARR, gross margin",
                period: "2026-Q3",
                sources: ["10-Q", "earnings deck"],
              }}
            />
            <ToolOutput
              output={{
                hits: 3,
                documents: ["Q3-10Q.pdf", "earnings-deck.pdf", "board-pack-Q2.pdf"],
              }}
              errorText={undefined}
            />
          </ToolDetails>
        </ToolContent>
      </Tool>

      {/* Tool call — warehouse query (dynamic tool) */}
      <Tool>
        <ToolHeader
          type="dynamic-tool"
          toolName="queryWarehouse"
          state="output-available"
          title="Query warehouse"
          summary="8 rows · +12.4% QoQ"
        />
        <ToolContent>
          <ToolDetails>
            <ToolInput
              input={{
                sql: "select quarter, region, sum(amount) revenue from finance.revenue where quarter in ('2026-Q2','2026-Q3') group by 1,2",
              }}
            />
            <ToolOutput
              output={{ rows: 8, q3_total: 48200000, q2_total: 42900000, qoq_growth: 0.124 }}
              errorText={undefined}
            />
          </ToolDetails>
        </ToolContent>
      </Tool>

      {/* The produced chart — the elevation-channel headline (#192): a
          ToolResultCard hosting a real @qlik-coe-emea/qlabs-components-charts ChartFrame/AutoChart as
          children, with the tool's technical view behind ToolDetails. */}
      <ToolResultCard
        title="Revenue by region — Q3 vs Q2"
        summary="Reconciled to finance.revenue · USD"
        status="complete"
        details={
          <ToolDetails>
            <ToolInput
              input={{
                chart: "bar",
                x: "region",
                series: ["q2", "q3"],
                metric: "revenue",
              }}
            />
          </ToolDetails>
        }
      >
        <ChartFrame
          data={revenueByRegion}
          columns={revenueColumns}
          height={260}
          detail={
            <div className="space-y-2 p-4 text-body">
              <p className="font-medium text-foreground">Q3 highlights</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>Total $48.2M · +12.4% QoQ</li>
                <li>EMEA the largest driver (+$2.3M)</li>
                <li>Cloud subscriptions +18%</li>
                <li>Gross margin 79% · net-new ARR $6.1M</li>
              </ul>
            </div>
          }
        >
          <AutoChart
            spec={{
              type: "bar",
              x: "region",
              series: [
                { key: "q2", label: "Q2" },
                { key: "q3", label: "Q3" },
              ],
              valueFormat: "compact",
              data: revenueByRegion,
            }}
            height={210}
          />
        </ChartFrame>
      </ToolResultCard>

      {/* Human-in-the-loop approval — question / consequence / role-named actions */}
      <ApprovalCard
        state={confirmationState}
        approval={{ id: "appr_finance", approved: approved ?? undefined }}
      >
        <ApprovalCardRequest>
          <ApprovalCardTitle>
            Post the final board note to <strong>#finance</strong> in Slack?
          </ApprovalCardTitle>
          <ApprovalCardDescription>
            Sends the one-page note to the #finance channel. Posting is a side effect — nothing else
            changes until you approve.
          </ApprovalCardDescription>
          <ApprovalCardActions>
            <ApprovalCardDeny onClick={() => setApproved(false)}>Deny</ApprovalCardDeny>
            <ApprovalCardApprove onClick={() => setApproved(true)}>
              Approve &amp; post
            </ApprovalCardApprove>
          </ApprovalCardActions>
        </ApprovalCardRequest>
        <ApprovalCardAccepted>
          <ApprovalCardTitle>Approved — note posted to #finance.</ApprovalCardTitle>
        </ApprovalCardAccepted>
        <ApprovalCardRejected>
          <ApprovalCardTitle>Denied — nothing was posted.</ApprovalCardTitle>
        </ApprovalCardRejected>
      </ApprovalCard>

      {/* What got done — collapsed run summary on the canonical rail; the
          produced files live in the Produced-assets rail, not inline pills. */}
      <Task>
        <TaskTrigger title="Compiled the board note and exports" />
        <TaskContent>
          <TaskItem>Reconciled 8 warehouse rows against the Q3 filing (0 variances)</TaskItem>
          <TaskItem>Wrote board-note.md and q3-vs-q2.csv — see Produced assets</TaskItem>
          <TaskItem>Rendered the revenue-by-region chart</TaskItem>
        </TaskContent>
      </Task>

      {/* Restore point */}
      <Checkpoint>
        <CheckpointTrigger tooltip="Restore to this checkpoint" onClick={() => undefined}>
          <CheckpointIcon />
          Checkpoint · figures reconciled
        </CheckpointTrigger>
      </Checkpoint>

      {/* The grounded answer — the green-rail final-answer emphasis; KPI band,
          prose, evidence and grounding are COMPOSED children. */}
      <AgentMessage emphasis="answer">
        <MessageContent>
          {/* KPI band: the headline KPI spans wider (featured) and reads one
              rung larger (emphasis="headline"). */}
          <MetricGrid columns={4} featured={0} className="mb-4">
            <MetricCard
              emphasis="headline"
              label="Q3 revenue"
              value="$48.2M"
              delta="12.4%"
              deltaDirection="up"
              description="vs $42.9M in Q2"
              visual={<Sparkline values={[39, 41, 40, 43, 45, 48.2]} tone="var(--chart-1)" />}
            />
            <MetricCard
              label="Net-new ARR"
              value="$6.1M"
              delta="9%"
              deltaDirection="up"
              description="~9% ahead of plan"
              visual={<Sparkline values={[3.8, 4.4, 4.9, 5.3, 5.7, 6.1]} tone="var(--chart-2)" />}
            />
            <MetricCard
              label="Gross margin"
              value="79%"
              delta="1.2 pp"
              deltaDirection="up"
              description="vs 77.8% in Q2"
              visual={<Sparkline values={[76, 76.5, 77, 77.8, 78.4, 79]} tone="var(--chart-3)" />}
            />
            <MetricCard
              label="Cloud subscriptions"
              value="$23.4M"
              delta="18%"
              deltaDirection="up"
              description="largest growth driver"
              visual={<Sparkline values={[9, 11, 12.5, 14, 16, 18]} tone="var(--chart-4)" />}
            />
          </MetricGrid>
          <MessageResponse>{FINAL_ANSWER_MD}</MessageResponse>
          <p className="text-body text-muted-foreground">
            Figures reconcile to the Q3 filing and the warehouse table{" "}
            <InlineCitation>
              <InlineCitationText>finance.revenue</InlineCitationText>
              <InlineCitationCard>
                <EvidenceChip
                  sources={["https://qlik.com/q3-10q", "https://help.qlik.com/finance-revenue"]}
                />
                <InlineCitationCardBody>
                  <InlineCitationCarousel>
                    <InlineCitationCarouselHeader>
                      <InlineCitationCarouselPrev />
                      <InlineCitationCarouselNext />
                      <InlineCitationCarouselIndex />
                    </InlineCitationCarouselHeader>
                    <InlineCitationCarouselContent>
                      <InlineCitationCarouselItem>
                        <InlineCitationSource
                          title="Q3 10-Q filing"
                          url="https://qlik.com/q3-10q"
                          description="Quarterly revenue, ARR and margin."
                        />
                        <InlineCitationQuote>
                          Total revenue of $48.2M, up 12.4% sequentially.
                        </InlineCitationQuote>
                      </InlineCitationCarouselItem>
                      <InlineCitationCarouselItem>
                        <InlineCitationSource
                          title="finance.revenue table"
                          url="https://help.qlik.com/finance-revenue"
                          description="Source-of-truth revenue by quarter and region."
                        />
                      </InlineCitationCarouselItem>
                    </InlineCitationCarouselContent>
                  </InlineCitationCarousel>
                </InlineCitationCardBody>
              </InlineCitationCard>
            </InlineCitation>
            .
          </p>

          <SourceList sources={GROUNDING_SOURCES} />

          <MessageActions>
            <MessageAction tooltip="Copy" label="Copy message">
              <Copy className="size-4" />
            </MessageAction>
            <MessageAction tooltip="Regenerate" label="Regenerate response">
              <RefreshCw className="size-4" />
            </MessageAction>
            <MessageAction tooltip="Good response" label="Good response">
              <ThumbsUp className="size-4" />
            </MessageAction>
            <MessageAction tooltip="Bad response" label="Bad response">
              <ThumbsDown className="size-4" />
            </MessageAction>
          </MessageActions>
        </MessageContent>
      </AgentMessage>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  The double-sided agentic workspace                                         */
/* -------------------------------------------------------------------------- */

interface FollowUp {
  id: string;
  role: "user" | "assistant";
  text: string;
}

function AgenticWorkspace({ defaultSidebarOpen = true }: { defaultSidebarOpen?: boolean }) {
  const [activeProject, setActiveProject] = useState("atlas");
  const [activeSession, setActiveSession] = useState("q3-revenue");
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [status, setStatus] = useState<"ready" | "submitted">("ready");

  const projectName = PROJECTS.find((p) => p.id === activeProject)?.name ?? "Atlas";
  const sessionTitle = SESSIONS.find((s) => s.id === activeSession)?.title ?? "New session";

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setFollowUps((prev) => [...prev, { id: `u${prev.length}`, role: "user", text: trimmed }]);
    setStatus("submitted");
    window.setTimeout(() => {
      setFollowUps((prev) => [
        ...prev,
        {
          id: `a${prev.length}`,
          role: "assistant",
          text: "Done — I updated the board note and refreshed the figures in the Produced assets panel.",
        },
      ]);
      setStatus("ready");
    }, 700);
  };

  return (
    <div className="h-dvh w-full overflow-hidden bg-background text-foreground">
      {/* The provider wraps the WORKSPACE so the header trigger and the panel
          share lifted state (research 09 — the Sidebar/SidebarInset relation). */}
      <ContextPanelProvider>
        <SidebarProvider defaultOpen={defaultSidebarOpen} className="h-full min-h-0">
          <WorkspaceSidebar
            activeProject={activeProject}
            onSelectProject={setActiveProject}
            activeSession={activeSession}
            onSelectSession={setActiveSession}
            onNewChat={() => {
              setFollowUps([]);
              setStatus("ready");
            }}
          />

          <SidebarInset className="flex min-w-0 flex-col">
            {/* Header bar — h-12 to align with the right ContextPanelHeader and
                the library header convention (ChatShell/ContextPanel). */}
            <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
              <SidebarTrigger className="-ms-1" />
              <Separator orientation="vertical" className="me-1 h-5" />
              <div className="flex min-w-0 items-center gap-1.5 text-body">
                <span className="truncate font-medium">{projectName}</span>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-muted-foreground">{sessionTitle}</span>
              </div>
              <div className="ms-auto flex items-center gap-1.5">
                <Badge variant="secondary" className="gap-1 whitespace-nowrap font-mono text-meta">
                  <Sparkles className="size-3" />
                  claude-opus-4.8
                </Badge>
                <ContextPanelTrigger />
                {/* Header chrome action — `ghost`, not the form-field `outline`
                    (#194, research 02 §3a BTN-1). */}
                <Button variant="ghost" size="sm">
                  <Share2 className="size-4" />
                  Share
                </Button>
              </div>
            </header>

            {/* Main agentic chat — immersive (bare) so it fills the pane the
                SidebarInset already bounds, with no redundant card frame. */}
            <div className="min-h-0 flex-1">
              <ChatShell
                variant="bare"
                composer={
                  <div className="space-y-2">
                    <Suggestions>
                      {SUGGESTIONS.map((s) => (
                        <Suggestion key={s} suggestion={s} onClick={send} />
                      ))}
                    </Suggestions>
                    <Composer
                      placeholder="Ask the agent to analyze, draft or export…"
                      status={status === "submitted" ? "Generating…" : "Awaiting your input"}
                      sendStatus={status}
                      showVoice={false}
                      onSubmit={(message) => {
                        if (message.text) send(message.text);
                      }}
                      tools={
                        <>
                          <PromptInputActionMenu>
                            <PromptInputActionMenuTrigger />
                            <PromptInputActionMenuContent>
                              <PromptInputActionAddAttachments />
                            </PromptInputActionMenuContent>
                          </PromptInputActionMenu>
                          <PromptInputButton tooltip="Web search">
                            <Globe className="size-4" />
                          </PromptInputButton>
                          <PromptInputButton tooltip="Connect data">
                            <Database className="size-4" />
                          </PromptInputButton>
                        </>
                      }
                    />
                  </div>
                }
              >
                <Conversation className="flex-1">
                  <ConversationContent>
                    <AgentRun />

                    {followUps.map((m) =>
                      m.role === "user" ? (
                        <UserMessage key={m.id}>
                          <MessageContent>{m.text}</MessageContent>
                        </UserMessage>
                      ) : (
                        <AgentMessage key={m.id}>
                          <MessageContent>
                            <MessageResponse>{m.text}</MessageResponse>
                          </MessageContent>
                        </AgentMessage>
                      ),
                    )}

                    {status === "submitted" ? (
                      <AgentMessage>
                        <MessageContent>
                          <Shimmer>Analyzing…</Shimmer>
                        </MessageContent>
                      </AgentMessage>
                    ) : null}
                  </ConversationContent>
                  <ConversationScrollButton />
                </Conversation>
              </ChatShell>
            </div>
          </SidebarInset>

          <WorkspaceContextPanel />
        </SidebarProvider>
      </ContextPanelProvider>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stories                                                                     */
/* -------------------------------------------------------------------------- */

const meta = {
  title: "Patterns/Scenarios/Agentic AI Workspace",
  component: AgenticWorkspace,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A full-page demo scenario composed from the @qlik-coe-emea/qlabs-components-* grammar: a double-sided application shell (collapsible left nav + the real ContextPanel right rail with animated collapse and asset drill-in) wrapping a complete agentic AI interaction — reasoning, a plan, the AgentTimeline execution rail, tools with JSON behind disclosure, a ToolResultCard chart headline, an ApprovalCard decision, a task summary, a checkpoint, and a grounded AgentMessage answer with an EvidenceChip and a SourceList.",
      },
    },
  },
} satisfies Meta<typeof AgenticWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The full double-sided agentic workspace. */
export const Default: Story = {};

/** Same scenario with the left navigation collapsed to an icon rail. */
export const CollapsedNav: Story = {
  args: { defaultSidebarOpen: false },
};
