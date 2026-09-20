// registry: marketing-bento-01 — copied 2026-09-19
"use client";

import type { ReactNode } from "react";
import { Area, AreaChart, Sparkline } from "@elabs-ai/components-charts";
import { Badge, BentoGrid, BentoGridItem, Meter, SectionHeader } from "@elabs-ai/components-ui";

export interface MarketingBentoProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
}

const onTime = Array.from({ length: 24 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 0, 5 + i * 7)),
  rate: Math.round((90 + i * 0.27 + Math.sin(i / 2) * 1.4) * 10) / 10,
}));

function Tile({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-subtitle font-semibold">{title}</h3>
        <p className="text-body text-muted-foreground text-pretty">{body}</p>
      </div>
      {children ? <div className="mt-auto min-w-0">{children}</div> : null}
    </div>
  );
}

/**
 * A bento of product proof — each tile shows the thing rather than describing it: a live
 * chart, a meter, a sparkline, a status. The hero tile carries the headline claim.
 */
export function MarketingBento({
  eyebrow = "The product",
  title = "See it working before you read about it",
  description = "Every tile below is a real component from the library, not a screenshot.",
}: MarketingBentoProps) {
  return (
    <section
      className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-16"
      data-slot="marketing-bento"
    >
      <SectionHeader as="h2" description={description} eyebrow={eyebrow} title={title} />
      <BentoGrid>
        <BentoGridItem size="hero">
          <Tile
            body="Six months after go-live the on-time rate is up six points and still climbing."
            title="On-time delivery, week by week"
          >
            <AreaChart
              accessibleLabel="On-time delivery rate per week"
              data={onTime}
              plotHeight={180}
            >
              <Area curve="monotone" dataKey="rate" fill="var(--chart-1)" fillOpacity={0.3} />
            </AreaChart>
          </Tile>
        </BentoGridItem>
        <BentoGridItem size="sm">
          <Tile body="of today's stops are done" title="72%">
            <Meter aria-label="72% of today's stops are done" size="sm" value={72} />
          </Tile>
        </BentoGridItem>
        <BentoGridItem size="sm">
          <Tile body="Parcels scanned per hour, today" title="Throughput">
            <Sparkline
              className="w-full"
              fit="fill"
              height={44}
              label="Parcels scanned per hour today"
              values={[120, 180, 260, 340, 420, 390, 410, 460, 430, 380, 300, 220]}
            />
          </Tile>
        </BentoGridItem>
        <BentoGridItem size="md">
          <Tile
            body="Documents are checked before the vessel sails. Holds are the exception, and you hear first."
            title="Customs, cleared ahead"
          >
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">214 cleared</Badge>
              <Badge variant="warning">3 need a document</Badge>
              <Badge variant="destructive">1 held</Badge>
            </div>
          </Tile>
        </BentoGridItem>
        <BentoGridItem size="sm">
          <Tile body="median from booking to label" title="4 min" />
        </BentoGridItem>
        <BentoGridItem size="sm">
          <Tile body="claims per thousand parcels, down from 4.1" title="1.9" />
        </BentoGridItem>
      </BentoGrid>
    </section>
  );
}
