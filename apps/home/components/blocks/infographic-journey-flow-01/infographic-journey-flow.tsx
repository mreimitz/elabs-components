// registry: infographic-journey-flow-01 — copied 2026-09-19
"use client";

import { useMemo } from "react";
import {
  FunnelChart,
  SankeyChart,
  SankeyLink,
  SankeyNode,
  SankeyTooltip,
} from "@elabs-ai/components-charts";
import { Badge, Card, CardContent } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  journeyFunnel,
  journeyOutcomes,
  journeySources,
  journeyStages,
  journeyThreads,
  type JourneyThread,
} from "./data/journey";

export interface InfographicJourneyFlowProps {
  threads?: JourneyThread[];
  funnel?: { label: string; value: number }[];
  locale?: string;
  className?: string;
}

/**
 * "Where do they drop off?" — every request followed from the channel it came in on,
 * through what happened to the quote, to how it ended; the funnel beside it puts a number on
 * each step. The headline names the channel that loses the most.
 */
export function InfographicJourneyFlow({
  threads = journeyThreads,
  funnel = journeyFunnel,
  locale = "en-US",
  className,
}: InfographicJourneyFlowProps) {
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });

  // Two hops per request — channel → what happened to the quote → how it ended — summed per
  // pair, because a Sankey link is a pair of node indexes, not a path.
  const data = useMemo(() => {
    const names = [...journeySources, ...journeyStages, ...journeyOutcomes];
    const pairs = new Map<string, { source: number; target: number; value: number }>();
    const add = (from: string, to: string, value: number) => {
      const key = `${from}>${to}`;
      const link = pairs.get(key) ?? {
        source: names.indexOf(from),
        target: names.indexOf(to),
        value: 0,
      };
      link.value += value;
      pairs.set(key, link);
    };
    for (const thread of threads) {
      add(thread.source, thread.stage, thread.value);
      add(thread.stage, thread.outcome, thread.value);
    }
    return {
      nodes: [
        ...journeySources.map((name) => ({ name, category: "source" as const })),
        ...journeyStages.map((name) => ({ name, category: "landing" as const })),
        ...journeyOutcomes.map((name) => ({ name, category: "outcome" as const })),
      ],
      links: [...pairs.values()].filter((link) => link.source >= 0 && link.target >= 0),
    };
  }, [threads]);

  // The channel with the largest share of its own requests ending in "Cancelled".
  const worst = useMemo(() => {
    const byChannel = new Map<string, { lost: number; total: number }>();
    for (const thread of threads) {
      const row = byChannel.get(thread.source) ?? { lost: 0, total: 0 };
      row.total += thread.value;
      if (thread.outcome === "Cancelled") row.lost += thread.value;
      byChannel.set(thread.source, row);
    }
    return [...byChannel.entries()]
      .map(([channel, row]) => ({ channel, share: row.lost / row.total }))
      .sort((a, b) => b.share - a.share)[0];
  }, [threads]);

  const first = funnel[0]?.value ?? 0;
  const last = funnel.at(-1)?.value ?? 0;

  return (
    <Card className={cn("@container", className)} data-slot="infographic-journey-flow">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body text-muted-foreground">
            Quote to delivery, by channel
          </span>
          <Badge className="shrink-0" variant="secondary">
            Last quarter
          </Badge>
        </div>
        <h3 className="text-title text-balance text-foreground">
          {worst
            ? `${worst.channel} loses ${percent.format(worst.share)} of its requests before they ship`
            : "Every request shipped"}
        </h3>
        <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-3">
          <div className="min-w-0 @3xl:col-span-2">
            <SankeyChart aspectRatio="16 / 9" data={data}>
              <SankeyLink />
              <SankeyNode formatValue={(value) => `${number.format(value)} requests`} />
              <SankeyTooltip />
            </SankeyChart>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-meta font-medium text-muted-foreground">The same journey, counted</p>
            <div className="h-64">
              <FunnelChart
                accessibleLabel="Requests remaining at each step from quote to delivery"
                data={funnel}
                plotHeight={240}
                showLabels
                showValues
              />
            </div>
            <p className="text-caption text-muted-foreground">
              {number.format(last)} of {number.format(first)} requests were delivered (
              {percent.format(first ? last / first : 0)}).
            </p>
          </div>
        </div>
        <p className="text-caption text-muted-foreground">
          How to read it: a band's width is the number of requests that moved between two steps.
          Follow a channel on the left through the middle column to where its requests end.
        </p>
      </CardContent>
    </Card>
  );
}
