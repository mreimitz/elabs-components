"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  CardContent,
  cn,
  SectionHeader,
  ToggleGroup,
  ToggleGroupItem,
} from "@elabs-ai/components-ui";
import { ArrowRight, Globe, Tag } from "lucide-react";

export interface CaseStudy {
  id: string;
  /** The customer’s name, set as a text wordmark. */
  customer: string;
  industry: string;
  region: string;
  /** The headline number, e.g. `"−38%"`. */
  metric: string;
  /** What the number measures, e.g. `"time to close"`. */
  metricLabel: string;
  summary: string;
  href: string;
  /** The one story shown wide with its quote. */
  featured?: boolean;
  quote?: { text: string; name: string; role: string };
}

export interface CaseStudiesProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  studies?: CaseStudy[];
  allLabel?: string;
  readLabel?: string;
  className?: string;
}

const initials = (name: string) =>
  name
    .replace(/^Dr\.\s/, "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

export const STUDIES: CaseStudy[] = [
  {
    id: "northwind",
    customer: "Northwind Retail",
    industry: "Retail",
    region: "Nordics",
    metric: "−38%",
    metricLabel: "time to clear customs",
    summary:
      "Pre-clearance filings from the shipment record took the median clearance from 31 hours to 19 across 4,200 containers a year.",
    href: "#/customers/northwind",
    featured: true,
    quote: {
      text: "The team stopped asking where a shipment is and started asking what to do about it.",
      name: "Ingrid Solberg",
      role: "COO, Northwind Retail",
    },
  },
  {
    id: "halden",
    customer: "Halden Pharma",
    industry: "Pharma",
    region: "DACH",
    metric: "0",
    metricLabel: "cold-chain breaches in 12 months",
    summary:
      "Temperature-sensitive lanes re-planned automatically around port closures; the audit was the easiest they have had.",
    href: "#/customers/halden",
  },
  {
    id: "pelican",
    customer: "Pelican Lines",
    industry: "Logistics",
    region: "APAC",
    metric: "+11 pts",
    metricLabel: "on-time delivery",
    summary:
      "Drivers kept the app after the pilot. On-time rose from 81% to 92% on the Singapore–Jakarta lane.",
    href: "#/customers/pelican",
  },
  {
    id: "kestrel",
    customer: "Kestrel Foods",
    industry: "Food & beverage",
    region: "UK & Ireland",
    metric: "−2.1 days",
    metricLabel: "median ETA error",
    summary:
      "Model-based ETAs replaced carrier estimates; trucks are booked to the estimate and demurrage fell by a third.",
    href: "#/customers/kestrel",
  },
  {
    id: "bluewater",
    customer: "Bluewater Marine",
    industry: "Logistics",
    region: "Nordics",
    metric: "4 days",
    metricLabel: "from set-up to live routing",
    summary:
      "Set up on a Tuesday, planning live routes by Friday, with every carrier connected over EDI.",
    href: "#/customers/bluewater",
  },
  {
    id: "orrin",
    customer: "Orrin Components",
    industry: "Manufacturing",
    region: "DACH",
    metric: "€1.4M",
    metricLabel: "demurrage avoided",
    summary:
      "Exceptions with an owner and a due time; nothing waits on a dock because nobody saw the alert.",
    href: "#/customers/orrin",
  },
  {
    id: "tidewell",
    customer: "Tidewell Grocers",
    industry: "Retail",
    region: "Benelux",
    metric: "3 → 1",
    metricLabel: "tools for the ops desk",
    summary: "Three tracking tools and a wall of spreadsheets, replaced by one Control Tower.",
    href: "#/customers/tidewell",
  },
  {
    id: "meridian",
    customer: "Meridian Chemicals",
    industry: "Manufacturing",
    region: "APAC",
    metric: "100%",
    metricLabel: "dangerous-goods filings on time",
    summary: "Customs Desk flags a missing DG declaration before booking, not at the gate.",
    href: "#/customers/meridian",
  },
];

/**
 * A case-study grid: industry chips that filter, cards led by the headline result as a
 * big number, the customer as a text wordmark, a one-line summary, industry and region
 * meta and a “Read story” link. One featured story spans two columns with its pull quote.
 */
export function CaseStudies({
  eyebrow = "Customers",
  title = "Results from the docks",
  description = "What changed for the teams running Harbourline, in their own numbers.",
  studies = STUDIES,
  allLabel = "All industries",
  readLabel = "Read story",
  className,
}: CaseStudiesProps) {
  const [industry, setIndustry] = useState(allLabel);
  const industries = useMemo(
    () => [allLabel, ...new Set(studies.map((s) => s.industry))],
    [allLabel, studies],
  );
  const shown = industry === allLabel ? studies : studies.filter((s) => s.industry === industry);

  return (
    <section
      className={cn(
        "@container mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-16",
        className,
      )}
      data-slot="case-studies"
    >
      <SectionHeader as="h2" description={description} eyebrow={eyebrow} size="lg" title={title} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          aria-label="Filter by industry"
          className="flex-wrap"
          onValueChange={(value) => value && setIndustry(value)}
          size="sm"
          type="single"
          value={industry}
          variant="outline"
        >
          {industries.map((name) => (
            <ToggleGroupItem key={name} value={name}>
              {name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p aria-live="polite" className="text-meta text-muted-foreground tabular-nums">
          {shown.length === 1 ? "1 story" : `${shown.length} stories`}
        </p>
      </div>

      <ul className="grid gap-5 @xl:grid-cols-2 @4xl:grid-cols-3" data-slot="case-studies-grid">
        {shown.map((study) => {
          const featured = Boolean(study.featured && study.quote);
          return (
            <li className={cn("min-w-0", featured && "@xl:col-span-2")} key={study.id}>
              <Card
                className={cn("group/study h-full", featured && "bg-hairline-hatch")}
                data-slot="case-studies-card"
              >
                <CardContent
                  className={cn(
                    "flex h-full flex-col gap-5 p-6",
                    featured && "@2xl:grid @2xl:grid-cols-2 @2xl:gap-8 @2xl:p-8",
                  )}
                >
                  <div className="flex h-full flex-col gap-5">
                    <span
                      className="font-display text-subtitle font-semibold tracking-tight"
                      data-slot="case-studies-wordmark"
                    >
                      {study.customer}
                    </span>
                    <div className="flex flex-col gap-1">
                      <span className="font-display text-kpi text-primary-text tabular-nums">
                        {study.metric}
                      </span>
                      <span className="text-body font-medium">{study.metricLabel}</span>
                    </div>
                    <p className="text-body text-muted-foreground text-pretty">{study.summary}</p>
                    <div className="mt-auto flex flex-col gap-4 pt-1">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline">
                          <Tag aria-hidden="true" className="size-3" />
                          {study.industry}
                        </Badge>
                        <Badge variant="outline">
                          <Globe aria-hidden="true" className="size-3" />
                          {study.region}
                        </Badge>
                      </div>
                      <a
                        className="inline-flex items-center gap-1 self-start rounded-sm text-body font-medium text-link focus-ring group-hover/study:underline"
                        href={study.href}
                      >
                        {readLabel}
                        <span className="sr-only">: {study.customer}</span>
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4 transition-transform duration-base ease-standard group-hover/study:translate-x-0.5 motion-reduce:transition-none"
                        />
                      </a>
                    </div>
                  </div>
                  {featured && study.quote ? (
                    <blockquote
                      className="flex flex-col justify-center gap-4 border-t pt-5 @2xl:border-s @2xl:border-t-0 @2xl:ps-8 @2xl:pt-0"
                      data-slot="case-studies-quote"
                    >
                      <p className="font-display text-title text-balance">“{study.quote.text}”</p>
                      <footer className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarFallback className="text-caption">
                            {initials(study.quote.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex min-w-0 flex-col">
                          <cite className="truncate text-body font-medium not-italic">
                            {study.quote.name}
                          </cite>
                          <span className="truncate text-meta text-muted-foreground">
                            {study.quote.role}
                          </span>
                        </span>
                      </footer>
                    </blockquote>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
