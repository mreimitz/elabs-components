"use client";
/**
 * block-renders — the registry blocks this site renders from its own copy. Each loads on demand
 * (a block pulls charts, maps or the flow canvas), and only in the browser: several measure
 * their box or open a WebGL context.
 */
import { useEffect, useRef, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import { Maximize2 } from "lucide-react";
import {
  CommandChip,
  Dialog,
  DialogTrigger,
  ExpandDialog,
  Heading,
  IconButton,
  Skeleton,
  Text,
} from "@elabs-ai/components-ui";
import { catalogCopy, heroCopy } from "../../content/copy";
import { NARROW_BLOCKS, NATIVE_BLOCKS, type NativeBlockName } from "./block-render-meta";

/** What the enlarge dialog's detail pane says about the block. */
export interface BlockHeroDetail {
  pageName: string;
  question?: string;
  summary?: string;
  labels?: string[];
  commands?: { label: string; command: string }[];
  links?: { label: string; href: string }[];
}

const pending = () => <Skeleton className="h-96 w-full" />;

const RENDERS: Record<NativeBlockName, ComponentType> = {
  "command-center-revenue-01": dynamic(
    () =>
      import("../blocks/command-center-revenue-01/command-center-revenue").then(
        (m) => m.CommandCenterRevenue,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "command-center-live-ops-01": dynamic(
    () =>
      import("../blocks/command-center-live-ops-01/command-center-live-ops").then(
        (m) => m.CommandCenterLiveOps,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "command-center-market-tape-01": dynamic(
    () =>
      import("../blocks/command-center-market-tape-01/command-center-market-tape").then(
        (m) => m.CommandCenterMarketTape,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "command-center-launch-plan-01": dynamic(
    () =>
      import("../blocks/command-center-launch-plan-01/command-center-launch-plan").then(
        (m) => m.CommandCenterLaunchPlan,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "geo-network-map-01": dynamic(
    () => import("../blocks/geo-network-map-01/geo-network-map").then((m) => m.GeoNetworkMap),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "geo-fleet-tracker-01": dynamic(
    () => import("../blocks/geo-fleet-tracker-01/geo-fleet-tracker").then((m) => m.GeoFleetTracker),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "infographic-journey-flow-01": dynamic(
    () =>
      import("../blocks/infographic-journey-flow-01/infographic-journey-flow").then(
        (m) => m.InfographicJourneyFlow,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "infographic-profile-compare-01": dynamic(
    () =>
      import("../blocks/infographic-profile-compare-01/infographic-profile-compare").then(
        (m) => m.InfographicProfileCompare,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "infographic-dependency-web-01": dynamic(
    () =>
      import("../blocks/infographic-dependency-web-01/infographic-dependency-web").then(
        (m) => m.InfographicDependencyWeb,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "agent-run-review-01": dynamic(
    () => import("../blocks/agent-run-review-01/agent-run-review").then((m) => m.AgentRunReview),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "revenue-ops-page": dynamic(
    () =>
      import("../blocks/revenue-ops-page/revenue-ops-page").then((m) => {
        const Page = m.default;
        return function Framed() {
          return <Page frame="container" />;
        };
      }),
    { ssr: false, loading: pending },
  ),
  "control-tower-page": dynamic(
    () =>
      import("../blocks/control-tower-page/control-tower-page").then((m) => {
        const Page = m.default;
        return function Framed() {
          return <Page frame="container" />;
        };
      }),
    { ssr: false, loading: pending },
  ),
  "agent-ops-center-page": dynamic(
    () =>
      import("../blocks/agent-ops-center-page/agent-ops-center-page").then((m) => {
        const Page = m.default;
        return function Framed() {
          return <Page frame="container" />;
        };
      }),
    { ssr: false, loading: pending },
  ),
  "customer-360-page": dynamic(
    () =>
      import("../blocks/customer-360-page/customer-360-page").then((m) => {
        const Page = m.default;
        return function Framed() {
          return <Page frame="container" />;
        };
      }),
    { ssr: false, loading: pending },
  ),
  "support-desk-page": dynamic(
    () =>
      import("../blocks/support-desk-page/support-desk-page").then((m) => {
        const Page = m.default;
        return function Framed() {
          return <Page frame="container" />;
        };
      }),
    { ssr: false, loading: pending },
  ),
  "incident-command-page": dynamic(
    () =>
      import("../blocks/incident-command-page/incident-command-page").then((m) => {
        const Page = m.default;
        return function Framed() {
          return <Page frame="container" />;
        };
      }),
    { ssr: false, loading: pending },
  ),
  "market-desk-page": dynamic(
    () =>
      import("../blocks/market-desk-page/market-desk-page").then((m) => {
        const Page = m.default;
        return function Framed() {
          return <Page frame="container" />;
        };
      }),
    { ssr: false, loading: pending },
  ),
  "login-01": dynamic(() => import("../blocks/login-01/login-form").then((m) => m.LoginForm), {
    ssr: false,
    loading: pending,
  }),
  "login-02": dynamic(() => import("../blocks/login-02/login-split").then((m) => m.LoginSplit), {
    ssr: false,
    loading: pending,
  }),
  "register-01": dynamic(
    () => import("../blocks/register-01/register-form").then((m) => m.RegisterForm),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "forgot-password-01": dynamic(
    () => import("../blocks/forgot-password-01/forgot-password").then((m) => m.ForgotPassword),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "reset-password-01": dynamic(
    () => import("../blocks/reset-password-01/reset-password").then((m) => m.ResetPassword),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "two-factor-01": dynamic(
    () => import("../blocks/two-factor-01/two-factor").then((m) => m.TwoFactor),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "verify-email-01": dynamic(
    () => import("../blocks/verify-email-01/verify-email").then((m) => m.VerifyEmail),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "marketing-navbar-01": dynamic(
    () => import("../blocks/marketing-navbar-01/marketing-navbar").then((m) => m.MarketingNavbar),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "marketing-features-01": dynamic(
    () =>
      import("../blocks/marketing-features-01/marketing-features").then((m) => m.MarketingFeatures),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "marketing-stats-01": dynamic(
    () => import("../blocks/marketing-stats-01/marketing-stats").then((m) => m.MarketingStats),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "marketing-bento-01": dynamic(
    () => import("../blocks/marketing-bento-01/marketing-bento").then((m) => m.MarketingBento),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "marketing-pricing-01": dynamic(
    () =>
      import("../blocks/marketing-pricing-01/marketing-pricing").then((m) => m.MarketingPricing),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "marketing-testimonials-01": dynamic(
    () =>
      import("../blocks/marketing-testimonials-01/marketing-testimonials").then(
        (m) => m.MarketingTestimonials,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "marketing-faq-01": dynamic(
    () => import("../blocks/marketing-faq-01/marketing-faq").then((m) => m.MarketingFaq),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "marketing-cta-01": dynamic(
    () => import("../blocks/marketing-cta-01/marketing-cta").then((m) => m.MarketingCta),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "marketing-newsletter-01": dynamic(
    () =>
      import("../blocks/marketing-newsletter-01/marketing-newsletter").then(
        (m) => m.MarketingNewsletter,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "marketing-contact-01": dynamic(
    () =>
      import("../blocks/marketing-contact-01/marketing-contact").then((m) => m.MarketingContact),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "marketing-team-01": dynamic(
    () => import("../blocks/marketing-team-01/marketing-team").then((m) => m.MarketingTeam),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "marketing-footer-01": dynamic(
    () => import("../blocks/marketing-footer-01/marketing-footer").then((m) => m.MarketingFooter),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "settings-profile-01": dynamic(
    () => import("../blocks/settings-profile-01/settings-profile").then((m) => m.SettingsProfile),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "settings-members-01": dynamic(
    () => import("../blocks/settings-members-01/settings-members").then((m) => m.SettingsMembers),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "settings-notifications-01": dynamic(
    () =>
      import("../blocks/settings-notifications-01/settings-notifications").then(
        (m) => m.SettingsNotifications,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "settings-billing-01": dynamic(
    () => import("../blocks/settings-billing-01/settings-billing").then((m) => m.SettingsBilling),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "empty-states-01": dynamic(
    () => import("../blocks/empty-states-01/empty-states").then((m) => m.EmptyStates),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "onboarding-checklist-01": dynamic(
    () =>
      import("../blocks/onboarding-checklist-01/onboarding-checklist").then(
        (m) => m.OnboardingChecklist,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "todo-list-01": dynamic(
    () => import("../blocks/todo-list-01/todo-list").then((m) => m.TodoList),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "kanban-board-01": dynamic(
    () => import("../blocks/kanban-board-01/kanban-board").then((m) => m.KanbanBoard),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "project-cards-01": dynamic(
    () => import("../blocks/project-cards-01/project-cards").then((m) => m.ProjectCards),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "product-grid-01": dynamic(
    () => import("../blocks/product-grid-01/product-grid").then((m) => m.ProductGrid),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "product-detail-01": dynamic(
    () => import("../blocks/product-detail-01/product-detail").then((m) => m.ProductDetail),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "shopping-cart-01": dynamic(
    () => import("../blocks/shopping-cart-01/shopping-cart").then((m) => m.ShoppingCart),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "checkout-01": dynamic(() => import("../blocks/checkout-01/checkout").then((m) => m.Checkout), {
    ssr: false,
    loading: pending,
  }),
  "order-receipt-01": dynamic(
    () => import("../blocks/order-receipt-01/order-receipt").then((m) => m.OrderReceipt),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "project-hub-page": dynamic(
    () =>
      import("../blocks/project-hub-page/project-hub-page").then((m) => {
        const Page = m.default;
        return function Framed() {
          return <Page frame="container" />;
        };
      }),
    { ssr: false, loading: pending },
  ),
  "audit-log-01": dynamic(
    () => import("../blocks/audit-log-01/audit-log").then((m) => m.AuditLog),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "decision-record-01": dynamic(
    () => import("../blocks/decision-record-01/decision-record").then((m) => m.DecisionRecord),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "escalation-boundary-01": dynamic(
    () =>
      import("../blocks/escalation-boundary-01/escalation-boundary").then(
        (m) => m.EscalationBoundary,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "finding-cards-01": dynamic(
    () => import("../blocks/finding-cards-01/finding-cards").then((m) => m.FindingCards),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "handoff-inspector-01": dynamic(
    () =>
      import("../blocks/handoff-inspector-01/handoff-inspector").then((m) => m.HandoffInspector),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "insight-feed-01": dynamic(
    () => import("../blocks/insight-feed-01/insight-feed").then((m) => m.InsightFeed),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "kpi-provenance-strip-01": dynamic(
    () =>
      import("../blocks/kpi-provenance-strip-01/kpi-provenance-strip").then(
        (m) => m.KpiProvenanceStrip,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "provenance-record-01": dynamic(
    () =>
      import("../blocks/provenance-record-01/provenance-record").then((m) => m.ProvenanceRecord),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "score-explanation-01": dynamic(
    () =>
      import("../blocks/score-explanation-01/score-explanation").then((m) => m.ScoreExplanation),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "spend-against-limit-01": dynamic(
    () =>
      import("../blocks/spend-against-limit-01/spend-against-limit").then(
        (m) => m.SpendAgainstLimit,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "agent-trace-waterfall-01": dynamic(
    () =>
      import("../blocks/agent-trace-waterfall-01/agent-trace-waterfall").then(
        (m) => m.AgentTraceWaterfall,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "verdict-side-by-side-01": dynamic(
    () =>
      import("../blocks/verdict-side-by-side-01/verdict-side-by-side").then(
        (m) => m.VerdictSideBySide,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "ai-chart": dynamic(
    () => import("../blocks/ai-chart/ai-chart-block").then((m) => m.AiChartBlock),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "code-workspace": dynamic(
    () => import("../blocks/code-workspace/code-workspace").then((m) => m.CodeWorkspaceBlock),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "data-table": dynamic(
    () => import("../blocks/data-table/data-table-block").then((m) => m.DataTableBlock),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "marketing-hero": dynamic(
    () => import("../blocks/marketing-hero/marketing-hero").then((m) => m.MarketingHero),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "flow-builder": dynamic(
    () => import("../blocks/flow-builder/flow-builder").then((m) => m.FlowBuilder),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "flow-canvas": dynamic(
    () => import("../blocks/flow-canvas/flow-canvas").then((m) => m.FlowCanvas),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "process-explorer-page": dynamic(
    () =>
      import("../blocks/process-explorer-page/process-explorer-page").then(
        (m) => m.ProcessExplorerPage,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-bar-highlight-01": dynamic(
    () =>
      import("../blocks/chart-story-bar-highlight-01/chart-story-bar-highlight").then(
        (m) => m.ChartStoryBarHighlight,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-bar-diverging-01": dynamic(
    () =>
      import("../blocks/chart-story-bar-diverging-01/chart-story-bar-diverging").then(
        (m) => m.ChartStoryBarDiverging,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-bar-range-01": dynamic(
    () =>
      import("../blocks/chart-story-bar-range-01/chart-story-bar-range").then(
        (m) => m.ChartStoryBarRange,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-bar-stacked-mix-01": dynamic(
    () =>
      import("../blocks/chart-story-bar-stacked-mix-01/chart-story-bar-stacked-mix").then(
        (m) => m.ChartStoryBarStackedMix,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-column-highlight-01": dynamic(
    () =>
      import("../blocks/chart-story-column-highlight-01/chart-story-column-highlight").then(
        (m) => m.ChartStoryColumnHighlight,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-column-diverging-01": dynamic(
    () =>
      import("../blocks/chart-story-column-diverging-01/chart-story-column-diverging").then(
        (m) => m.ChartStoryColumnDiverging,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-line-highlight-01": dynamic(
    () =>
      import("../blocks/chart-story-line-highlight-01/chart-story-line-highlight").then(
        (m) => m.ChartStoryLineHighlight,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-line-projection-01": dynamic(
    () =>
      import("../blocks/chart-story-line-projection-01/chart-story-line-projection").then(
        (m) => m.ChartStoryLineProjection,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-line-events-01": dynamic(
    () =>
      import("../blocks/chart-story-line-events-01/chart-story-line-events").then(
        (m) => m.ChartStoryLineEvents,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-area-threshold-01": dynamic(
    () =>
      import("../blocks/chart-story-area-threshold-01/chart-story-area-threshold").then(
        (m) => m.ChartStoryAreaThreshold,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-line-seasons-01": dynamic(
    () =>
      import("../blocks/chart-story-line-seasons-01/chart-story-line-seasons").then(
        (m) => m.ChartStoryLineSeasons,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-area-multiples-01": dynamic(
    () =>
      import("../blocks/chart-story-area-multiples-01/chart-story-area-multiples").then(
        (m) => m.ChartStoryAreaMultiples,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-column-panels-01": dynamic(
    () =>
      import("../blocks/chart-story-column-panels-01/chart-story-column-panels").then(
        (m) => m.ChartStoryColumnPanels,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-dual-axis-01": dynamic(
    () =>
      import("../blocks/chart-story-dual-axis-01/chart-story-dual-axis").then(
        (m) => m.ChartStoryDualAxis,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-pareto-01": dynamic(
    () =>
      import("../blocks/chart-story-pareto-01/chart-story-pareto").then((m) => m.ChartStoryPareto),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-donut-01": dynamic(
    () => import("../blocks/chart-story-donut-01/chart-story-donut").then((m) => m.ChartStoryDonut),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-pie-pair-01": dynamic(
    () =>
      import("../blocks/chart-story-pie-pair-01/chart-story-pie-pair").then(
        (m) => m.ChartStoryPiePair,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-bubble-01": dynamic(
    () =>
      import("../blocks/chart-story-bubble-01/chart-story-bubble").then((m) => m.ChartStoryBubble),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-calendar-01": dynamic(
    () =>
      import("../blocks/chart-story-calendar-01/chart-story-calendar").then(
        (m) => m.ChartStoryCalendar,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-dot-plot-01": dynamic(
    () =>
      import("../blocks/chart-story-dot-plot-01/chart-story-dot-plot").then(
        (m) => m.ChartStoryDotPlot,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-range-plot-01": dynamic(
    () =>
      import("../blocks/chart-story-range-plot-01/chart-story-range-plot").then(
        (m) => m.ChartStoryRangePlot,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-arrow-plot-01": dynamic(
    () =>
      import("../blocks/chart-story-arrow-plot-01/chart-story-arrow-plot").then(
        (m) => m.ChartStoryArrowPlot,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-waterfall-bridge-01": dynamic(
    () =>
      import("../blocks/chart-story-waterfall-bridge-01/chart-story-waterfall-bridge").then(
        (m) => m.ChartStoryWaterfallBridge,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "chart-story-waterfall-running-01": dynamic(
    () =>
      import("../blocks/chart-story-waterfall-running-01/chart-story-waterfall-running").then(
        (m) => m.ChartStoryWaterfallRunning,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
};

/**
 * The block at working size — a block page's lead example — with the same enlarge control the
 * story frames carry: the library's ExpandDialog, the block filling the view (a map, a wall)
 * or scrolling inside it (a desk taller than the screen), its details and links beside it.
 */
export function BlockHero({ name, detail }: { name: NativeBlockName; detail?: BlockHeroDetail }) {
  const Render = RENDERS[name];
  const stage = NATIVE_BLOCKS[name];
  const fill = stage !== "flow";
  const [open, setOpen] = useState(false);
  const chip = heroCopy.chip;
  return (
    <div data-slot="block-hero" className="group/hero relative w-full min-w-0">
      <div
        className={
          stage === "screen"
            ? "w-full min-w-0 overflow-hidden rounded-md border border-border bg-background"
            : fill
              ? "h-144 w-full min-w-0"
              : "w-full min-w-0"
        }
        // A whole app frame wants a screen's worth of height, capped to the window.
        style={stage === "screen" ? { height: "min(56rem, 84svh)" } : undefined}
      >
        <Render />
      </div>
      {detail ? (
        // An app frame keeps its own actions in its top corner, so its enlarge control sits on the
        // frame's lower edge instead of on top of them.
        <div
          className={`absolute end-2 opacity-0 transition-opacity duration-fast ease-standard group-focus-within/hero:opacity-100 group-hover/hero:opacity-100 ${stage === "screen" ? "bottom-2" : "top-2"}`}
        >
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <IconButton
                variant="outline"
                size="icon-sm"
                label={catalogCopy.frame.expand}
                icon={<Maximize2 />}
              />
            </DialogTrigger>
            <ExpandDialog
              title={detail.pageName}
              description={detail.question || detail.summary || undefined}
              detailLabel={catalogCopy.frame.details}
              viewClassName="p-0"
              detail={
                <div className="flex flex-col gap-5 p-4">
                  <div className="flex flex-col gap-2">
                    <Heading level={3} size="subtitle">
                      {detail.pageName}
                    </Heading>
                    {detail.labels?.length ? (
                      <Text variant="caption" tone="muted" className="capitalize">
                        {detail.labels.join(" · ")}
                      </Text>
                    ) : null}
                    {detail.summary ? (
                      <Text variant="caption" tone="muted">
                        {detail.summary}
                      </Text>
                    ) : null}
                  </div>
                  {detail.commands?.map((item) => (
                    <CommandChip
                      key={item.label}
                      aria-label={item.label}
                      hosts={[{ id: item.label, label: item.label, command: item.command }]}
                      labels={{
                        copy: chip.copy,
                        copied: chip.copied,
                        selectFallback: chip.selectFallback,
                        chooseHost: item.label,
                        menuLabel: item.label,
                      }}
                      className="w-full"
                    />
                  ))}
                  <ul className="flex flex-col gap-1.5">
                    {(detail.links ?? []).map((link) => (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          className="rounded-sm text-body text-foreground underline underline-offset-4 focus-ring"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              }
            >
              <div
                className={
                  fill
                    ? "size-full min-h-96 overflow-hidden rounded-md bg-background"
                    : "size-full min-h-96 overflow-auto rounded-md bg-background p-6"
                }
              >
                {open ? <Render /> : null}
              </div>
            </ExpandDialog>
          </Dialog>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The block as a card thumbnail: rendered at a desktop width and scaled to the card, mounted
 * when near the viewport. Decorative — the card's link names the target.
 */
export function BlockThumb({
  name,
  width = 1180,
  ratio = 0.625,
}: {
  name: NativeBlockName;
  width?: number;
  ratio?: number;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [scale, setScale] = useState(0);
  const Render = RENDERS[name];
  const screen = NATIVE_BLOCKS[name] === "screen";
  // A full app frame is drawn at a laptop's width, edge to edge; a block gets breathing room.
  if (screen) width = 1440;
  else if (NARROW_BLOCKS.includes(name)) width = 860;

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / width);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "undefined") setNear(true);
    else {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            setNear(true);
            io?.disconnect();
          }
        },
        { rootMargin: "400px 0px" },
      );
      io.observe(el);
    }
    return () => {
      ro?.disconnect();
      io?.disconnect();
    };
  }, [width]);

  return (
    <div
      ref={holder}
      aria-hidden="true"
      data-slot="block-thumb"
      inert
      className="pointer-events-none relative w-full overflow-hidden bg-background"
      style={{ aspectRatio: `1 / ${ratio}` }}
    >
      {near && scale > 0 ? (
        <div
          className={`absolute start-0 top-0 origin-top-left ${screen ? "" : "p-6"}`}
          style={{ width, height: width * ratio, transform: `scale(${scale})` }}
        >
          <Render />
        </div>
      ) : (
        <Skeleton className="absolute inset-0 rounded-none" />
      )}
    </div>
  );
}
