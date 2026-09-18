import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { useEffect, useState } from "react";
import {
  A2UI_CATALOG_SCHEMA,
  A2uiSurface,
  Conversation,
  ConversationContent,
  Message,
  MessageContent,
  MessageResponse,
  UI_CATALOG_BINDINGS,
  createA2uiCatalog,
  defineA2uiType,
  type A2uiAction,
  type A2uiActionContext,
  type A2uiSurfaceSpec,
} from "@elabs-ai/components-ai";
import { CHARTS_A2UI_BINDINGS, CHARTS_A2UI_CATALOG_SCHEMA } from "@elabs-ai/components-charts";
import { Badge, Button } from "@elabs-ai/components-ui";
import {
  acmeKpis,
  costPerShipment,
  nps,
  onTimeDelivery,
  ordersShipped,
  qualitativeBandsForTarget,
  revenue,
  type KpiMetric,
} from "@/components/kpi-card-parts/data/acme-quarter";
import type { KpiUnit } from "@/components/kpi-card-parts/format";
import { KpiHeroSatellites } from "@/components/kpi-hero-satellites-01/kpi-hero-satellites";
import { KpiTargetBullet } from "@/components/kpi-target-bullet-01/kpi-target-bullet";
import { KpiMovers } from "@/components/kpi-movers-01/kpi-movers";
import { onTimeByDepot } from "@/components/kpi-movers-01/data/depot-movers";
import { InfographicScorecard } from "@/components/infographic-scorecard-01/infographic-scorecard";
import { InfographicGapToBenchmark } from "@/components/infographic-gap-to-benchmark-01/infographic-gap-to-benchmark";
import {
  ON_TIME_BENCHMARK,
  onTimeVsBenchmark,
} from "@/components/infographic-gap-to-benchmark-01/data/depot-vs-benchmark";
import { InfographicPartToWhole } from "@/components/infographic-part-to-whole-01/infographic-part-to-whole";
import { fuelCostScenario } from "@/components/infographic-part-to-whole-01/data/cost-breakdown";

/**
 * Charts, KPI cards and infographics as **agent-designed surfaces**. This is the
 * composition an analytics app ships: the `@elabs-ai/components-ui` catalog, the
 * `@elabs-ai/components-charts` catalog (`AutoChart`, `ChartCard`, `MetricGrid`,
 * `Sparkline`, `BulletChart`, `Gauge`) and the app's own copy-own KPI blocks from
 * the registry — bound through **adapters** so the agent emits the simplest honest
 * shape (facts: actual, target, prior year, a weekly series) and the block derives
 * everything else (bands, normal range, deltas) the way it always has.
 *
 * Every story is one question a person asked and the surface the agent answered
 * with. Nothing here is JSX from a model: it is JSON, validated against this
 * catalog, rendered by `<A2uiSurface>`; every button reaches the host's `onAction`.
 */

// ---------------------------------------------------------------------------
// Adapters — the agent's shape for a KPI is FACTS; the block computes the rest.
// ---------------------------------------------------------------------------

/** What the agent emits for one KPI. Deltas, pace and bands are never typed by hand. */
interface KpiFacts {
  id?: string;
  label: string;
  unit: KpiUnit;
  actual: number;
  target: number;
  priorYear: number;
  /** Trailing weekly series, oldest first. */
  weekly: number[];
  weeklyPriorYear?: number[];
  higherIsBetter?: boolean;
  budget?: number;
  currency?: string;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function toKpiMetric(f: KpiFacts): KpiMetric {
  const higherIsBetter = f.higherIsBetter ?? true;
  const lo = Math.min(...f.weekly);
  const hi = Math.max(...f.weekly);
  const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.05;
  return {
    id: f.id ?? slug(f.label),
    label: f.label,
    unit: f.unit,
    higherIsBetter,
    actual: f.actual,
    target: f.target,
    priorYear: f.priorYear,
    budget: f.budget ?? f.target,
    weekly: f.weekly,
    weeklyPriorYear: f.weeklyPriorYear ?? f.weekly.map((v) => v * (f.priorYear / f.actual)),
    normalBand: [lo - pad, hi + pad],
    bullet: qualitativeBandsForTarget(f.target, higherIsBetter),
    ...(f.currency ? { currency: f.currency } : {}),
  };
}

/** "What's the headline?" — one hero KPI with satellites, from facts. */
function KpiHero({
  hero,
  satellites,
  locale,
}: {
  hero: KpiFacts;
  satellites: KpiFacts[];
  locale?: string;
}) {
  return (
    <KpiHeroSatellites
      heroMetric={toKpiMetric(hero)}
      satelliteMetrics={satellites.map(toKpiMetric)}
      locale={locale}
    />
  );
}

/** The scorecard: one honest row per KPI, from facts. */
function KpiScorecard({ metrics, locale }: { metrics: KpiFacts[]; locale?: string }) {
  return <InfographicScorecard metrics={metrics.map(toKpiMetric)} locale={locale} />;
}

/** "Am I on target?" — one bullet per KPI, from facts. */
function KpiTargets({ metrics, locale }: { metrics: KpiFacts[]; locale?: string }) {
  return <KpiTargetBullet metrics={metrics.map(toKpiMetric)} locale={locale} />;
}

const KPI_FACTS_PROPS = {
  id: { type: "string" as const },
  label: { type: "string" as const, required: true },
  unit: {
    type: "string" as const,
    enum: ["currency", "percent", "count", "score", "hours"],
    required: true,
  },
  actual: { type: "number" as const, required: true },
  target: { type: "number" as const, required: true },
  priorYear: { type: "number" as const, required: true },
  weekly: {
    type: "array" as const,
    required: true,
    description: "Trailing weekly values, oldest first (13 is the house length).",
  },
  weeklyPriorYear: { type: "array" as const },
  higherIsBetter: { type: "boolean" as const, default: true },
  budget: { type: "number" as const },
  currency: { type: "string" as const },
};
const KPI_FACTS_DOC = `{ ${Object.entries(KPI_FACTS_PROPS)
  .map(([k, p]) => `${k}${"required" in p && p.required ? "" : "?"}`)
  .join(", ")} }`;

/** The app's catalog: ui + charts + the KPI blocks it copied from the registry. */
const analyticsCatalog = createA2uiCatalog(
  {
    ...UI_CATALOG_BINDINGS,
    ...CHARTS_A2UI_BINDINGS,
    KpiHero,
    KpiScorecard,
    KpiTargets,
    KpiMovers,
    GapToBenchmark: InfographicGapToBenchmark,
    PartToWhole: InfographicPartToWhole,
  },
  {
    ...A2UI_CATALOG_SCHEMA,
    ...CHARTS_A2UI_CATALOG_SCHEMA,
    KpiHero: defineA2uiType({
      summary:
        "The headline: one hero KPI (big value, vs target, 13-week trend vs last year) with up to three satellites.",
      props: {
        hero: { type: "object", required: true, description: `KPI facts ${KPI_FACTS_DOC}` },
        satellites: { type: "array", required: true, description: "2–3 KPI facts objects." },
        locale: { type: "string" },
      },
    }),
    KpiScorecard: defineA2uiType({
      summary: "One honest row per KPI: actual, target, delta, progress bullet, trend, status.",
      props: {
        metrics: {
          type: "array",
          required: true,
          description: `KPI facts objects ${KPI_FACTS_DOC}`,
        },
        locale: { type: "string" },
      },
    }),
    KpiTargets: defineA2uiType({
      summary: "Am I on target? One bullet chart per KPI inside qualitative bands.",
      props: {
        metrics: { type: "array", required: true, description: "KPI facts objects." },
        locale: { type: "string" },
      },
    }),
    KpiMovers: defineA2uiType({
      summary: "What changed most? Biggest risers and fallers between two points in time.",
      props: {
        onTimeData: {
          type: "array",
          description: "[{ id, label, current, prior }] on-time %, by depot.",
        },
        revenueData: {
          type: "array",
          description: "[{ id, label, current, prior }] revenue, by depot.",
        },
        only: { type: "string", enum: ["onTime", "revenue"] },
        count: { type: "number", default: 3 },
        locale: { type: "string" },
      },
    }),
    GapToBenchmark: defineA2uiType({
      summary: "A sorted dumbbell of actual vs a benchmark, worst gaps emphasised.",
      props: {
        points: { type: "array", required: true, description: "[{ id, label, actual }]" },
        benchmark: { type: "number", required: true },
        benchmarkLabel: { type: "string" },
        metricLabel: { type: "string" },
        unit: { type: "string", enum: ["currency", "percent", "count", "score", "hours"] },
        higherIsBetter: { type: "boolean", default: true },
        worstCount: { type: "number", default: 2 },
        locale: { type: "string" },
      },
    }),
    PartToWhole: defineA2uiType({
      summary:
        "Where does the money go? A two-level treemap with one highlighted leaf and its share.",
      props: {
        scenario: {
          type: "object",
          required: true,
          description:
            "{ id, groups: [{ name, children: [{ name, value }] }], highlightGroup, highlightLeaf, priorSharePct, context }",
        },
        locale: { type: "string" },
      },
    }),
  },
);

// ---------------------------------------------------------------------------
// The facts an agent would have pulled from the warehouse — serialisable, plain.
// ---------------------------------------------------------------------------
const facts = (m: KpiMetric): KpiFacts => ({
  label: m.label,
  unit: m.unit,
  actual: m.actual,
  target: m.target,
  priorYear: m.priorYear,
  weekly: m.weekly,
  weeklyPriorYear: m.weeklyPriorYear,
  higherIsBetter: m.higherIsBetter,
  ...(m.currency ? { currency: m.currency } : {}),
});

const WEEKS = Array.from({ length: 13 }, (_, i) => `W${27 + i}`);
const weeklyRows = (m: KpiMetric) =>
  WEEKS.map((week, i) => ({ week, thisYear: m.weekly[i], lastYear: m.weeklyPriorYear[i] }));

const ORDERS_BY_REGION = [
  { region: "DACH", orders: 4_120, target: 4_000 },
  { region: "Benelux", orders: 2_310, target: 2_500 },
  { region: "Nordics", orders: 1_640, target: 1_500 },
  { region: "Iberia", orders: 980, target: 1_200 },
];

// ---------------------------------------------------------------------------
// Surfaces — what the agent answered with.
// ---------------------------------------------------------------------------

/** "How is Q3 going?" */
const QUARTER_HEADLINE: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "Q3 so far",
  root: {
    type: "Stack",
    props: { gap: "lg" },
    children: [
      {
        type: "SectionHeader",
        props: {
          eyebrow: "Acme Logistics · Q3",
          title: "Q3 so far: revenue ahead of last year, on-time delivery behind target",
          description:
            "Revenue is 8.9% above last year and pacing to target; on-time delivery has slipped to 91.4% against a 95% target and is the one KPI off track.",
          actions: { type: "Badge", props: { variant: "secondary" }, children: ["as of 31 Aug"] },
        },
      },
      {
        type: "KpiHero",
        props: {
          hero: facts(revenue),
          satellites: [facts(ordersShipped), facts(onTimeDelivery), facts(nps)],
        },
      },
      {
        type: "Grid",
        props: { columns: 2, gap: "lg" },
        children: [
          {
            type: "ChartCard",
            props: {
              title: "Weekly revenue vs last year",
              description: "13 trailing weeks; last year re-based to the same weeks.",
              source: "ERP · revenue_weekly",
            },
            children: [
              {
                type: "AutoChart",
                props: {
                  spec: {
                    type: "line",
                    data: weeklyRows(revenue),
                    x: "week",
                    series: [
                      { key: "thisYear", label: "This year" },
                      { key: "lastYear", label: "Last year" },
                    ],
                    valueFormat: "currency",
                    currency: "EUR",
                    legend: true,
                  },
                  height: 240,
                },
                on: { datapointClick: { name: "drill-week" } },
              },
            ],
          },
          {
            type: "ChartCard",
            props: {
              title: "Orders by region vs target",
              description: "Iberia and Benelux are below target; DACH carries the quarter.",
              source: "ERP · orders_by_region",
            },
            children: [
              {
                type: "AutoChart",
                props: {
                  spec: {
                    type: "bar",
                    data: ORDERS_BY_REGION,
                    x: "region",
                    series: [
                      { key: "orders", label: "Orders" },
                      { key: "target", label: "Target" },
                    ],
                    valueFormat: "compact",
                    legend: true,
                  },
                  height: 240,
                },
                on: { datapointClick: { name: "drill-region" } },
              },
            ],
          },
        ],
      },
      {
        type: "Stack",
        props: { direction: "row", gap: "sm", justify: "end" },
        children: [
          {
            type: "Button",
            props: { variant: "outline" },
            on: { click: { name: "open-board", payload: { board: "q3-overview" } } },
            children: ["Open the Q3 board"],
          },
          {
            type: "Button",
            on: { click: { name: "explain", payload: { kpi: "onTimeDelivery" } } },
            children: ["Why is on-time delivery down?"],
          },
        ],
      },
    ],
  },
};

/** "Why is on-time delivery down?" */
const WHY_ON_TIME: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "Why on-time delivery is down",
  root: {
    type: "Stack",
    props: { gap: "lg" },
    children: [
      {
        type: "Text",
        props: { variant: "lead" },
        children: [
          "Two depots explain most of the gap. Nuremberg (83.8%) and Leipzig (88.3%) fell furthest since last quarter, and Nuremberg and Dresden sit furthest under the 95% industry benchmark; only Berlin and Munich are above it.",
        ],
      },
      {
        type: "GapToBenchmark",
        props: {
          points: onTimeVsBenchmark,
          benchmark: ON_TIME_BENCHMARK,
          benchmarkLabel: "industry on-time delivery",
          metricLabel: "on-time delivery",
          unit: "percent",
          worstCount: 2,
        },
      },
      {
        type: "Grid",
        props: { columns: 2, gap: "lg" },
        children: [
          { type: "KpiMovers", props: { onTimeData: onTimeByDepot, only: "onTime", count: 3 } },
          {
            type: "Stack",
            props: { gap: "md" },
            children: [
              {
                type: "Alert",
                props: { variant: "warning" },
                children: [
                  { type: "AlertTitle", children: ["Nuremberg: 83.8%, down 8.2 pts"] },
                  {
                    type: "AlertDescription",
                    children: [
                      "The drop coincides with the depot's fleet-maintenance backlog (14 vehicles out of service in week 34). Leipzig shows the same pattern at a smaller scale.",
                    ],
                  },
                ],
              },
              {
                type: "Descriptions",
                props: { columns: 1 },
                children: [
                  {
                    type: "DescriptionsItem",
                    props: { label: "Network on-time" },
                    children: ["91.4% (target 95%)"],
                  },
                  {
                    type: "DescriptionsItem",
                    props: { label: "Depots below benchmark" },
                    children: ["10 of 12"],
                  },
                  {
                    type: "DescriptionsItem",
                    props: { label: "Largest single gap" },
                    children: ["Nuremberg, −11.2 pp"],
                  },
                ],
              },
              {
                type: "Stack",
                props: { direction: "row", gap: "sm" },
                children: [
                  {
                    type: "Button",
                    props: { variant: "outline" },
                    on: { click: { name: "open-depot", payload: { id: "nuremberg" } } },
                    children: ["Open Nuremberg"],
                  },
                  {
                    type: "Button",
                    on: {
                      click: {
                        name: "create-task",
                        payload: { depot: "nuremberg", title: "Clear maintenance backlog" },
                      },
                    },
                    children: ["Create a task"],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

/** "Where does the money go?" */
const COST_BREAKDOWN: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "Where the money goes",
  root: {
    type: "Stack",
    props: { gap: "lg" },
    children: [
      { type: "PartToWhole", props: { scenario: fuelCostScenario } },
      {
        type: "Grid",
        props: { columns: 3, gap: "md" },
        children: [
          {
            type: "MetricCard",
            props: {
              label: "Cost per shipment",
              value: costPerShipment.actual,
              valueFormat: "currency",
              currency: "EUR",
              delta: "+€0.34 vs target",
              deltaDirection: "up",
              positiveIsGood: false,
              sparkline: {
                type: "Sparkline",
                props: {
                  values: costPerShipment.weekly,
                  variant: "line",
                  label: "Cost per shipment, 13 weeks",
                  target: costPerShipment.target,
                  showLastValue: true,
                },
              },
            },
          },
          {
            type: "MetricCard",
            props: {
              label: "Fuel share of cost",
              value: 0.31,
              valueFormat: "percent",
              delta: "+4 pp vs Q2",
              deltaDirection: "up",
              positiveIsGood: false,
            },
          },
          {
            type: "MetricCard",
            props: {
              label: "Shipments",
              value: ordersShipped.actual,
              valueFormat: "compact",
              delta: "+6.1% vs last year",
              deltaDirection: "up",
            },
          },
        ],
      },
      {
        type: "Stack",
        props: { direction: "row", gap: "sm", justify: "end" },
        children: [
          {
            type: "Button",
            props: { variant: "outline" },
            on: { click: { name: "export", payload: { view: "cost-breakdown" } } },
            children: ["Export"],
          },
          {
            type: "Button",
            on: { click: { name: "simulate", payload: { lever: "fuel" } } },
            children: ["Simulate a fuel hedge"],
          },
        ],
      },
    ],
  },
};

/** "Show me the scorecard" — and whether we are on target. */
const SCORECARD: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "Q3 scorecard",
  root: {
    type: "Stack",
    props: { gap: "lg" },
    children: [
      { type: "KpiScorecard", props: { metrics: acmeKpis.map(facts) } },
      {
        type: "KpiTargets",
        props: { metrics: [revenue, onTimeDelivery, costPerShipment].map(facts) },
      },
      {
        type: "Grid",
        props: { columns: 2, gap: "lg" },
        children: [
          {
            type: "ChartCard",
            props: {
              title: "Quarter pace",
              description: "62 of 92 days elapsed; revenue at 95% of the prorated target.",
              source: "ERP · revenue_qtd",
              height: 220,
            },
            children: [
              {
                type: "Stack",
                props: { align: "center" },
                children: [
                  {
                    type: "Gauge",
                    props: {
                      value: 95,
                      centerValue: 95,
                      suffix: "%",
                      defaultLabel: "of prorated target",
                      target: 100,
                      width: 360,
                      height: 210,
                      accessibleLabel: "Revenue at 95% of the prorated Q3 target",
                    },
                  },
                ],
              },
            ],
          },
          {
            type: "ChartCard",
            props: {
              title: "Revenue vs target and last year",
              description:
                "Actual inside the qualitative bands; the tick is the target, the notch last year.",
              source: "ERP · revenue_qtd",
              height: 220,
            },
            children: [
              {
                type: "Stack",
                props: { gap: "md" },
                children: [
                  {
                    type: "BulletChart",
                    props: {
                      value: 2_885_870,
                      target: 3_032_609,
                      comparative: 2_650_000,
                      bands: qualitativeBandsForTarget(3_032_609, true),
                      valueFormat: "currency",
                      accessibleLabel: "Revenue vs target and last year",
                    },
                  },
                  {
                    type: "Text",
                    props: { variant: "caption", tone: "muted" },
                    children: [
                      "€2.9M against a €3.0M target: 4.8% short with a third of the quarter left, 8.9% ahead of last year.",
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Host chrome for the stories: the action log, the chat, the stream.
// ---------------------------------------------------------------------------
function ActionLog({ entries }: { entries: string[] }) {
  return (
    <div
      data-testid="action-log"
      aria-live="polite"
      className="rounded-md bg-surface-muted p-3 text-caption text-muted-foreground"
    >
      {entries.length ? (
        <ul className="space-y-1">
          {entries.map((e) => (
            <li key={e} className="font-mono">
              {e}
            </li>
          ))}
        </ul>
      ) : (
        "Actions the surface sends to the host appear here."
      )}
    </div>
  );
}

function Answer({ surface }: { surface: A2uiSurfaceSpec }) {
  const [log, setLog] = useState<string[]>([]);
  const onAction = (action: A2uiAction, ctx: A2uiActionContext) =>
    setLog((l) => [
      ...l,
      `${l.length + 1}. ${ctx.event} → ${action.name} ${JSON.stringify(action.payload ?? ctx.value ?? "")}`,
    ]);
  return (
    <div className="flex flex-col gap-4">
      <A2uiSurface surface={surface} catalog={analyticsCatalog} onAction={onAction} />
      <ActionLog entries={log} />
    </div>
  );
}

const meta = {
  title: "AI/A2UI Analytics",
  component: A2uiSurface,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof A2uiSurface>;
export default meta;

type Story = StoryObj<typeof meta>;

/** "How is Q3 going?" — a hero KPI with satellites, two AutoCharts, next questions as actions. */
export const QuarterHeadline: Story = {
  args: { surface: QUARTER_HEADLINE },
  render: (args) => <Answer surface={args.surface as A2uiSurfaceSpec} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("group", { name: "Q3 so far" })).toBeInTheDocument();
    await waitFor(() =>
      expect(
        canvasElement.querySelectorAll("[data-a2ui-type='AutoChart'] svg").length,
      ).toBeGreaterThan(0),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Why is on-time delivery down?" }));
    await expect(canvas.getByTestId("action-log")).toHaveTextContent(
      'explain {"kpi":"onTimeDelivery"}',
    );
  },
};

/** "Why is on-time delivery down?" — narrative, a gap-to-benchmark infographic, movers, and the fix as actions. */
export const WhyOnTimeIsDown: Story = {
  args: { surface: WHY_ON_TIME },
  render: (args) => <Answer surface={args.surface as A2uiSurfaceSpec} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Create a task" }));
    await expect(canvas.getByTestId("action-log")).toHaveTextContent(
      'create-task {"depot":"nuremberg"',
    );
  },
};

/** "Where does the money go?" — a treemap infographic, KPI tiles with a Sparkline inside, levers as actions. */
export const CostBreakdown: Story = {
  args: { surface: COST_BREAKDOWN },
  render: (args) => <Answer surface={args.surface as A2uiSurfaceSpec} />,
};

/** "Show me the scorecard" — the scorecard block, target bullets, a Gauge and a BulletChart from the charts catalog. */
export const Scorecard: Story = {
  args: { surface: SCORECARD },
  render: (args) => <Answer surface={args.surface as A2uiSurfaceSpec} />,
};

/** The same answer inside the chat it belongs to — A2UI rides inside the conversation (D2). */
function InChatDemo() {
  const [log, setLog] = useState<string[]>([]);
  return (
    <div className="flex h-[40rem] flex-col rounded-lg border bg-background">
      <Conversation className="flex-1">
        <ConversationContent>
          <Message from="user">
            <MessageContent>
              <MessageResponse>How is Q3 going?</MessageResponse>
            </MessageContent>
          </Message>
          <Message from="assistant">
            <MessageContent>
              <MessageResponse>
                Here is the headline, with the two charts that explain it.
              </MessageResponse>
              <A2uiSurface
                surface={QUARTER_HEADLINE}
                catalog={analyticsCatalog}
                onAction={(a) =>
                  setLog((l) => [
                    ...l,
                    `${l.length + 1}. ${a.name} ${JSON.stringify(a.payload ?? "")}`,
                  ])
                }
              />
            </MessageContent>
          </Message>
          {log.length ? (
            <Message from="user">
              <MessageContent>
                <MessageResponse>{log[log.length - 1]}</MessageResponse>
              </MessageContent>
            </Message>
          ) : null}
        </ConversationContent>
      </Conversation>
    </div>
  );
}

export const InChat: Story = {
  args: { surface: QUARTER_HEADLINE },
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="p-4">
      <InChatDemo />
    </div>
  ),
};

const STREAM_TARGET = JSON.stringify(WHY_ON_TIME);

function StreamingAnalysisDemo() {
  const [shown, setShown] = useState(0);
  const [running, setRunning] = useState(true);
  useEffect(() => {
    if (!running || shown >= STREAM_TARGET.length) return;
    const id = window.setTimeout(() => setShown((n) => Math.min(STREAM_TARGET.length, n + 24)), 16);
    return () => window.clearTimeout(id);
  }, [running, shown]);
  const done = shown >= STREAM_TARGET.length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setShown(0);
            setRunning(true);
          }}
        >
          Replay
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setRunning((r) => !r)} disabled={done}>
          {running ? "Pause" : "Resume"}
        </Button>
        <Badge variant={done ? "success" : "secondary"}>
          {done ? "settled" : `streaming ${shown}/${STREAM_TARGET.length}`}
        </Badge>
      </div>
      <A2uiSurface
        surface={STREAM_TARGET.slice(0, shown)}
        catalog={analyticsCatalog}
        isStreaming={!done}
      />
    </div>
  );
}

/** The analysis streams in: text first, then the infographic once its points have all arrived, then the movers and the actions. */
export const StreamingAnalysis: Story = {
  args: { surface: "" },
  render: () => <StreamingAnalysisDemo />,
};

/** `loading`: the answer is still being computed — the surface reserves its space. */
export const Loading: Story = {
  args: { surface: null, loading: true, catalog: analyticsCatalog },
};
