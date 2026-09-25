"use client";

import type { ReactNode } from "react";
import { BadgeCheck, CircleAlert, Minus } from "lucide-react";
import { Sparkline } from "@elabs-ai/components-charts";
import { Heading, Text, cn } from "@elabs-ai/components-ui";

export type StatTone = "positive" | "negative" | "neutral";

export interface BigStat {
  id: string;
  /** The number, already formatted — “41M”, “96.4”. */
  value: string;
  /** The unit or suffix beside it — “%”, “ms”, “parcels”. */
  unit?: string;
  /** One line that says what the number means. */
  meaning: string;
  /** The trend behind the number, oldest first. */
  series: number[];
  /** Whether the trend is good news; shown with an arrow and a word, not colour alone. */
  tone?: StatTone;
  /** The change in words — “up 12 pt this year”. */
  change?: string;
}

export interface MarketingStatsBigProps {
  eyebrow?: ReactNode;
  /** The sentence the numbers prove. */
  title?: ReactNode;
  stats?: BigStat[];
  /** Footnote under the numbers — the period, the source. */
  source?: ReactNode;
  className?: string;
}

const DEFAULT_STATS: BigStat[] = [
  {
    id: "events",
    value: "2.4",
    unit: "bn",
    meaning: "events processed every day",
    series: [0.6, 0.7, 0.8, 0.9, 1.1, 1.2, 1.4, 1.6, 1.7, 1.9, 2.2, 2.4],
    tone: "positive",
    change: "up 4× in two years",
  },
  {
    id: "latency",
    value: "180",
    unit: "ms",
    meaning: "from event to dashboard, p95",
    series: [910, 860, 720, 640, 590, 470, 410, 360, 290, 240, 210, 180],
    tone: "positive",
    change: "down from 910 ms",
  },
  {
    id: "uptime",
    value: "99.99",
    unit: "%",
    meaning: "uptime over the last twelve months",
    series: [99.93, 99.95, 99.94, 99.97, 99.98, 99.98, 99.99, 99.99, 99.99, 99.99, 99.99, 99.99],
    tone: "neutral",
    change: "held for eight months",
  },
  {
    id: "incidents",
    value: "3",
    unit: "",
    meaning: "customer-facing incidents this year",
    series: [14, 12, 11, 9, 9, 7, 6, 6, 5, 4, 3, 3],
    tone: "positive",
    change: "down from 14",
  },
];

const TONE_ICON: Record<StatTone, ReactNode> = {
  positive: <BadgeCheck aria-hidden="true" className="size-4" />,
  negative: <CircleAlert aria-hidden="true" className="size-4" />,
  neutral: <Minus aria-hidden="true" className="size-4" />,
};

const TONE_WORD: Record<StatTone, string> = {
  positive: "Better",
  negative: "Worse",
  neutral: "Steady",
};

/**
 * Four very large numbers, each with its unit, what it means, and the trend that got it
 * there — a headline sentence above ties them together. Good and bad trends carry an arrow
 * and a word as well as a colour.
 */
export function MarketingStatsBig({
  eyebrow = "At scale",
  title = "The numbers behind every dashboard we serve",
  stats = DEFAULT_STATS,
  source = "Trailing twelve months, all regions. Updated monthly.",
  className,
}: MarketingStatsBigProps) {
  return (
    <section
      className={cn(
        "@container mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-16",
        className,
      )}
      data-slot="marketing-stats-big"
    >
      <div className="flex max-w-3xl flex-col gap-3">
        {eyebrow ? (
          <Text as="span" tone="primary" variant="eyebrow">
            {eyebrow}
          </Text>
        ) : null}
        <Heading className="text-balance" level={2} size="display">
          {title}
        </Heading>
      </div>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-10 @md:grid-cols-2 @4xl:grid-cols-4">
        {stats.map((stat) => {
          const tone = stat.tone ?? "neutral";
          return (
            <div
              className="flex min-w-0 flex-col gap-3 border-t border-border-strong pt-5"
              data-slot="marketing-stats-big-stat"
              data-tone={tone}
              key={stat.id}
            >
              <dt className="order-2 text-body text-muted-foreground text-pretty">
                {stat.meaning}
              </dt>
              <dd className="order-1 flex items-baseline gap-1">
                <span className="text-display-lg font-semibold tracking-tight tabular-nums">
                  {stat.value}
                </span>
                {stat.unit ? (
                  <span className="text-title font-medium text-muted-foreground">{stat.unit}</span>
                ) : null}
              </dd>
              <dd className="order-3 flex flex-col gap-2">
                <Sparkline
                  className="w-full"
                  emphasizeLast
                  fit="fill"
                  fitDomain
                  height={36}
                  label={`${stat.meaning}, trend`}
                  values={stat.series}
                  variant="line"
                />
                {stat.change ? (
                  <span
                    className={cn(
                      "flex items-center gap-1 text-meta",
                      tone === "positive" && "text-success-text",
                      tone === "negative" && "text-destructive-text",
                      tone === "neutral" && "text-muted-foreground",
                    )}
                  >
                    {TONE_ICON[tone]}
                    <span className="font-medium">{TONE_WORD[tone]}</span>
                    <span aria-hidden="true">·</span>
                    {stat.change}
                  </span>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>
      {source ? (
        <p className="text-meta text-muted-foreground" data-slot="marketing-stats-big-source">
          {source}
        </p>
      ) : null}
    </section>
  );
}
