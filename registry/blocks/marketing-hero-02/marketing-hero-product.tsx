"use client";

import type { ReactNode } from "react";
import { ArrowRight, Check, Lock, PlayCircle, Timer } from "lucide-react";
import { Area, AreaChart, MetricGrid } from "@elabs-ai/components-charts";
import {
  Badge,
  Button,
  Card,
  Heading,
  MetricCard,
  StatusBadge,
  Text,
  cn,
  type Status,
} from "@elabs-ai/components-ui";

export interface HeroCta {
  label: string;
  href: string;
}

export interface HeroTrustFact {
  label: string;
  /** A small glyph before the fact. Defaults to a check mark. */
  icon?: ReactNode;
}

export interface HeroMetric {
  label: string;
  value: string;
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  /** Whether "up" is the good direction for this metric. Default true. */
  positiveIsGood?: boolean;
}

export interface HeroService {
  name: string;
  status: Status;
  /** One short fact beside the status — a latency, a last-check time. */
  note: string;
}

export interface MarketingHeroProductProps {
  /** The badge above the headline — a release note, a claim, a label. */
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  primaryCta?: HeroCta;
  secondaryCta?: HeroCta;
  /** The row of small facts under the buttons — the reasons not to hesitate. */
  facts?: HeroTrustFact[];
  /** The address shown in the frame's location bar. */
  frameUrl?: string;
  /** The title inside the frame, above the metrics. */
  frameTitle?: string;
  frameCaption?: string;
  metrics?: HeroMetric[];
  /** The series behind the frame's chart, oldest first. */
  series?: number[];
  seriesLabel?: string;
  services?: HeroService[];
  className?: string;
}

const DEFAULT_FACTS: HeroTrustFact[] = [
  { label: "No credit card" },
  { label: "SOC 2 Type II", icon: <Lock aria-hidden="true" className="size-4" /> },
  { label: "Set up in 4 minutes", icon: <Timer aria-hidden="true" className="size-4" /> },
];

// Non-breaking spaces inside a value or delta: a KPI never wraps mid-figure in a narrow tile.
const DEFAULT_METRICS: HeroMetric[] = [
  { label: "Uptime, 30 days", value: "99.98%", delta: "+0.04\u00a0pt", deltaDirection: "up" },
  {
    label: "Acknowledged in",
    value: "1m\u00a040s",
    delta: "−38%",
    deltaDirection: "down",
    positiveIsGood: false,
  },
  {
    label: "Open incidents",
    value: "2",
    delta: "−5",
    deltaDirection: "down",
    positiveIsGood: false,
  },
];

/** Requests per minute over the last 24 hours — a working day with a lunch dip and an evening peak. */
const DEFAULT_SERIES = [
  1180, 1090, 1010, 980, 1020, 1210, 1640, 2210, 2760, 3010, 3120, 2890, 2540, 2870, 3060, 3180,
  3090, 2820, 2410, 2130, 1960, 1720, 1480, 1310,
];

const DEFAULT_SERVICES: HeroService[] = [
  { name: "Public API", status: "complete", note: "p95 142 ms" },
  { name: "Web app", status: "complete", note: "p95 210 ms" },
  { name: "Background workers", status: "running", note: "queue draining, 3 min" },
  { name: "Billing webhooks", status: "awaiting-approval", note: "1 retry pending" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => new Date(Date.UTC(2026, 8, 24, i)));

/**
 * A split hero: the claim, two calls to action and a row of trust facts on the left; on the
 * right the product itself — a live status overview built from the library's own tiles,
 * chart and status vocabulary inside a browser frame, not a screenshot.
 */
export function MarketingHeroProduct({
  eyebrow = "New: on-call schedules",
  title = "Know it broke before your customers do",
  description = "Beacon watches every endpoint, pages the right person and writes the timeline for you — so the incident is over before the status page is out of date.",
  primaryCta = { label: "Start monitoring free", href: "#register" },
  secondaryCta = { label: "Watch the 2-minute tour", href: "#tour" },
  facts = DEFAULT_FACTS,
  frameUrl = "app.beacon.dev/overview",
  frameTitle = "Overview",
  frameCaption = "Last 24 hours · all regions",
  metrics = DEFAULT_METRICS,
  series = DEFAULT_SERIES,
  seriesLabel = "Requests per minute",
  services = DEFAULT_SERVICES,
  className,
}: MarketingHeroProductProps) {
  const data = series.map((value, i) => ({ date: HOURS[i % HOURS.length], value }));
  const number = new Intl.NumberFormat("en-US");
  const peak = Math.max(...series);

  return (
    <section
      className={cn("@container mx-auto w-full max-w-7xl px-4 py-16 @4xl:py-24", className)}
      data-slot="marketing-hero-product"
    >
      <div className="grid items-center gap-12 @4xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] @4xl:gap-16">
        <div className="flex flex-col gap-6" data-slot="marketing-hero-product-copy">
          {eyebrow ? (
            <div>
              <Badge variant="secondary">{eyebrow}</Badge>
            </div>
          ) : null}
          <Heading className="text-balance" level={1} size="display-lg">
            {title}
          </Heading>
          <Text className="max-w-prose text-pretty" tone="muted" variant="lead">
            {description}
          </Text>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <a href={primaryCta.href}>
                {primaryCta.label}
                <ArrowRight aria-hidden="true" />
              </a>
            </Button>
            {secondaryCta ? (
              <Button asChild size="lg" variant="outline">
                <a href={secondaryCta.href}>
                  <PlayCircle aria-hidden="true" />
                  {secondaryCta.label}
                </a>
              </Button>
            ) : null}
          </div>
          {facts.length ? (
            <ul
              aria-label="Good to know"
              className="flex flex-wrap items-center gap-x-5 gap-y-2 text-meta text-muted-foreground"
              data-slot="marketing-hero-product-facts"
            >
              {facts.map((fact) => (
                <li className="flex items-center gap-1.5" key={fact.label}>
                  <span className="text-success">
                    {fact.icon ?? <Check aria-hidden="true" className="size-4" />}
                  </span>
                  {fact.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* The product frame — a browser window drawn with tokens, the app inside it real. */}
        <Card
          aria-label={`${frameTitle} in the product`}
          className="min-w-0 overflow-hidden shadow-lg"
          data-slot="marketing-hero-product-frame"
          role="figure"
        >
          <div
            aria-hidden="true"
            className="flex items-center gap-3 border-b border-border bg-muted px-3 py-2"
            data-slot="marketing-hero-product-chrome"
          >
            <span className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-border-strong" />
              <span className="size-2.5 rounded-full bg-border-strong" />
              <span className="size-2.5 rounded-full bg-border-strong" />
            </span>
            <span className="min-w-0 flex-1 truncate rounded-md bg-background px-3 py-1 text-center font-mono text-meta text-muted-foreground">
              {frameUrl}
            </span>
          </div>
          <div className="flex flex-col gap-4 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-subtitle font-semibold">{frameTitle}</span>
              <span className="text-meta text-muted-foreground">{frameCaption}</span>
            </div>
            {/* Three short tiles fit a mock browser frame from @md, well below MetricGrid's own 3-up rung. */}
            <MetricGrid className="@md:grid-cols-3" columns={3}>
              {metrics.map((metric) => (
                <MetricCard
                  delta={metric.delta}
                  deltaDirection={metric.deltaDirection}
                  key={metric.label}
                  label={metric.label}
                  positiveIsGood={metric.positiveIsGood}
                  value={metric.value}
                />
              ))}
            </MetricGrid>
            <figure className="flex flex-col gap-1">
              <figcaption className="flex items-baseline justify-between text-meta text-muted-foreground">
                <span>{seriesLabel}</span>
                <span className="tabular-nums">peak {number.format(peak)}</span>
              </figcaption>
              <AreaChart
                accessibleLabel={`${seriesLabel} over the last 24 hours`}
                data={data}
                margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
                plotHeight={110}
              >
                <Area dataKey="value" fillOpacity={0.25} />
              </AreaChart>
            </figure>
            <ul
              aria-label="Service status"
              className="divide-y divide-border-strong"
              data-slot="marketing-hero-product-services"
            >
              {services.map((service) => (
                <li
                  className="flex items-center justify-between gap-3 py-2 text-body"
                  key={service.name}
                >
                  <span className="min-w-0 truncate font-medium">{service.name}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-meta text-muted-foreground tabular-nums @md:inline">
                      {service.note}
                    </span>
                    <StatusBadge status={service.status} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </section>
  );
}
