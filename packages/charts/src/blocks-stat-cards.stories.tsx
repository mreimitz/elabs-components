/**
 * Stat Cards — elevated KPI tiles (the "more than a flat number" options).
 *
 * The `MetricCard` primitive already has a `visual` slot; these blocks show the
 * batteries-included compositions a builder copies instead of wiring it each
 * time — value + delta + an inline `Sparkline` (no extra deps, colour via a
 * `--chart-*` token), plus a goal/progress tile and a comparison tile that the
 * bare MetricCard doesn't cover. Reference: shadcnspace Statistics/Widgets.
 *
 * Compose-only from @elabs/components-* primitives; semantic tokens only; reads in all
 * three themes. Verify with globals=theme:<slug>.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge, Card, CardContent, MetricCard, Progress } from "@elabs/components-ui";
import { Sparkline } from "./sparkline/sparkline";

const revenueSeries = [31, 34, 33, 38, 42, 40, 45, 48];
const ordersSeries = [220, 240, 235, 280, 305, 290, 360, 384];

/** A KPI tile with an inline trend sparkline in the MetricCard `visual` slot. */
function SparkStatCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MetricCard
        label="Revenue"
        value="$48.2M"
        delta="12.4%"
        deltaDirection="up"
        description="vs $42.9M last quarter"
        visual={
          <Sparkline
            values={revenueSeries}
            variant="line"
            label="Revenue trend, last 8 weeks"
            width={160}
            height={40}
            className="w-full"
            style={{ color: "var(--chart-1)" }}
          />
        }
      />
      <MetricCard
        label="Orders"
        value="1,284"
        delta="8.1%"
        deltaDirection="up"
        description="last 7 days"
        visual={
          <Sparkline
            values={ordersSeries}
            variant="bar"
            label="Orders trend, last 8 weeks"
            width={160}
            height={40}
            className="w-full"
            style={{ color: "var(--chart-2)" }}
          />
        }
      />
      <MetricCard
        label="Refund rate"
        value="1.9%"
        delta="0.4 pp"
        deltaDirection="down"
        description="lower is better"
        positiveIsGood={false}
        visual={
          <Sparkline
            values={[3.1, 2.8, 2.6, 2.4, 2.2, 2.1, 2.0, 1.9]}
            variant="line"
            label="Refund-rate trend"
            width={160}
            height={40}
            className="w-full"
            style={{ color: "var(--chart-4)" }}
          />
        }
      />
    </div>
  );
}

/** A goal tile — current value against a target, with a progress bar. */
function GoalStatCard({
  label,
  value,
  target,
  pct,
}: {
  label: string;
  value: string;
  target: string;
  pct: number;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-body text-muted-foreground">{label}</span>
          <Badge variant="secondary" className="tabular-nums">
            {pct}%
          </Badge>
        </div>
        <div className="text-kpi font-semibold tabular-nums text-foreground">{value}</div>
        <Progress value={pct} aria-label={`${label}: ${pct}% of target`} />
        <p className="text-meta text-muted-foreground">
          <span className="tabular-nums">{value}</span> of{" "}
          <span className="tabular-nums">{target}</span> goal
        </p>
      </CardContent>
    </Card>
  );
}

/** A comparison tile — this period vs last, with the delta. */
function ComparisonStatCard() {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <span className="text-body text-muted-foreground">Active users</span>
        <div className="flex items-end gap-3">
          <div className="text-kpi font-semibold tabular-nums text-foreground">18,402</div>
          <Badge variant="success" className="mb-1">
            ↑ 6.2%
          </Badge>
        </div>
        <div className="flex items-center justify-between text-meta text-muted-foreground">
          <span>This month</span>
          <span className="tabular-nums">prev 17,320</span>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCardShowcase() {
  return (
    <div className="space-y-4 bg-background p-6 text-foreground">
      <SparkStatCards />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GoalStatCard label="Quarterly target" value="$36.2k" target="$50k" pct={72} />
        <GoalStatCard label="Onboarding complete" value="184" target="250" pct={74} />
        <ComparisonStatCard />
      </div>
    </div>
  );
}

const meta = {
  title: "Patterns/Blocks/Stat Cards",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Elevated KPI tiles beyond a flat number: MetricCard + inline Sparkline (area/bar/line, coloured by a --chart-* token, no extra deps), a goal/progress tile, and a this-vs-last comparison tile. Copy-ready compositions for dashboard overviews. Semantic tokens only; reads in all three themes.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <StatCardShowcase /> };
