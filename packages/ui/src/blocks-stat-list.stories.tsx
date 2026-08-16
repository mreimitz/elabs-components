/**
 * Stat List — ranked-list / leaderboard / activity-feed widgets.
 *
 * The reference dashboards lean heavily on compact summary widgets that brand-ui
 * has the primitives for but no copy-ready block: a ranked list (Sales by
 * Country / Top performers — avatar or code + label + value + delta), and a
 * transaction/activity feed (icon + title + subtitle + signed amount). These
 * compose Card + Avatar + Badge + Progress only.
 *
 * Compose-only from @elabs/components-* primitives; semantic tokens only; reads in all
 * three themes. Verify with globals=theme:<slug>.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowDownLeft, Banknote, CreditCard, RotateCcw, Wallet } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
} from "./index";

/* ---- Ranked list (Sales by Country) ------------------------------------- */

const COUNTRIES = [
  { code: "US", name: "United States", value: "$8,567k", share: 100, delta: 4.7 },
  { code: "BR", name: "Brazil", value: "$2,415k", share: 28, delta: -1.7 },
  { code: "IN", name: "India", value: "$865k", share: 10, delta: 4.7 },
  { code: "AU", name: "Australia", value: "$745k", share: 9, delta: -1.7 },
  { code: "FR", name: "France", value: "$410k", share: 5, delta: 2.1 },
];

function RankedListWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales by country</CardTitle>
        <CardDescription>This year</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {COUNTRIES.map((c) => (
          <div key={c.code} className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="text-meta font-medium">{c.code}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-body font-medium text-foreground">{c.name}</span>
                <span className="tabular-nums text-body font-semibold text-foreground">
                  {c.value}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Progress value={c.share} className="h-1.5 flex-1" aria-label={`${c.name} share`} />
                <span
                  className={[
                    "shrink-0 text-meta tabular-nums",
                    c.delta >= 0 ? "text-success-text" : "text-destructive-text",
                  ].join(" ")}
                >
                  {c.delta >= 0 ? "+" : ""}
                  {c.delta}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---- Leaderboard (Top performers) --------------------------------------- */

const PERFORMERS = [
  {
    initials: "JD",
    name: "Johnathan Doe",
    role: "Top sales",
    value: "+68",
    tone: "success" as const,
  },
  { initials: "FW", name: "Footware", role: "Best seller", value: "+12", tone: "success" as const },
  {
    initials: "FS",
    name: "Fashionware",
    role: "Most commented",
    value: "-36",
    tone: "destructive" as const,
  },
];

function LeaderboardWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly stats</CardTitle>
        <CardDescription>Average sales</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {PERFORMERS.map((p, i) => (
          <div key={p.name} className="flex items-center gap-3">
            <span className="w-4 shrink-0 text-meta tabular-nums text-muted-foreground">
              {i + 1}
            </span>
            <Avatar className="size-8">
              <AvatarFallback className="text-meta">{p.initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-body font-medium text-foreground">{p.name}</div>
              <div className="truncate text-meta text-muted-foreground">{p.role}</div>
            </div>
            <Badge variant={p.tone}>{p.value}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---- Transaction / activity feed ---------------------------------------- */

const TX = [
  {
    icon: Banknote,
    title: "PayPal transfer",
    sub: "Money added",
    amount: "+$6,235",
    positive: true,
  },
  { icon: Wallet, title: "Wallet", sub: "Big brands", amount: "+$345", positive: true },
  {
    icon: CreditCard,
    title: "Credit card",
    sub: "Money reversed",
    amount: "+$2,235",
    positive: true,
  },
  {
    icon: ArrowDownLeft,
    title: "Bank transfer",
    sub: "Money added",
    amount: "+$320",
    positive: true,
  },
  { icon: RotateCcw, title: "Refund", sub: "Bill payment", amount: "-$32", positive: false },
];

function TransactionFeedWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent transactions</CardTitle>
        <CardDescription>Last 24 hours</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {TX.map((t) => (
            <li key={t.title} className="flex items-center gap-3 py-1.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-muted text-muted-foreground">
                <t.icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-body font-medium text-foreground">{t.title}</div>
                <div className="truncate text-meta text-muted-foreground">{t.sub}</div>
              </div>
              <span
                className={[
                  "shrink-0 text-body font-semibold tabular-nums",
                  t.positive ? "text-success-text" : "text-destructive-text",
                ].join(" ")}
              >
                {t.amount}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function StatListShowcase() {
  return (
    <div className="grid grid-cols-1 gap-4 bg-background p-6 text-foreground md:grid-cols-3">
      <RankedListWidget />
      <LeaderboardWidget />
      <TransactionFeedWidget />
    </div>
  );
}

const meta = {
  title: "Patterns/Blocks/Stat List",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Compact summary widgets the reference dashboards rely on: a ranked list with share bars + delta (Sales by country), a leaderboard (Top performers), and a transaction/activity feed with signed amounts. Compose Card + Avatar + Badge + Progress; semantic tokens only; reads in all three themes.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <StatListShowcase /> };
