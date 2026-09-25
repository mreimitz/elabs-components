"use client";

import type { ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Sparkline } from "@elabs-ai/components-charts";
import {
  Card,
  SectionHeader,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  TimelineItem,
  TimelineRoot,
  cn,
  type Status,
} from "@elabs-ai/components-ui";

export interface ShowcaseLink {
  label: string;
  href: string;
}

export interface ShowcaseSection {
  id: string;
  eyebrow: ReactNode;
  title: ReactNode;
  body: ReactNode;
  bullets: string[];
  link?: ShowcaseLink;
  /** The thing itself — built from real components, never a screenshot. */
  visual: ReactNode;
  /** Accessible name for the visual. */
  visualLabel: string;
}

export interface MarketingFeatureShowcaseProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  sections?: ShowcaseSection[];
  className?: string;
}

/* ---------- Visual 1: the runs table ---------- */

interface Run {
  workflow: string;
  trigger: string;
  status: Status;
  duration: string;
  when: string;
}

const RUNS: Run[] = [
  {
    workflow: "Invoice → ledger",
    trigger: "New invoice",
    status: "complete",
    duration: "2.4 s",
    when: "just now",
  },
  {
    workflow: "Lead enrichment",
    trigger: "Form submit",
    status: "running",
    duration: "—",
    when: "12 s ago",
  },
  {
    workflow: "Refund over €500",
    trigger: "Refund request",
    status: "awaiting-approval",
    duration: "—",
    when: "3 min ago",
  },
  {
    workflow: "Nightly export",
    trigger: "Schedule 02:00",
    status: "complete",
    duration: "41 s",
    when: "6 h ago",
  },
  {
    workflow: "Slack digest",
    trigger: "Schedule 09:00",
    status: "failed",
    duration: "0.8 s",
    when: "yesterday",
  },
];

function RunsTable() {
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Workflow</TableHead>
            <TableHead className="hidden @md:table-cell">Trigger</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-end">Took</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {RUNS.map((run) => (
            <TableRow key={run.workflow}>
              <TableCell className="font-medium">
                <span className="flex flex-col">
                  {run.workflow}
                  <span className="text-meta font-normal text-muted-foreground">{run.when}</span>
                </span>
              </TableCell>
              <TableCell className="hidden text-muted-foreground @md:table-cell">
                {run.trigger}
              </TableCell>
              <TableCell>
                <StatusBadge status={run.status} />
              </TableCell>
              <TableCell className="text-end tabular-nums">{run.duration}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/* ---------- Visual 2: one run, step by step ---------- */

interface RunStep {
  title: string;
  description: string;
  status: Status;
  at: string;
}

const STEPS: RunStep[] = [
  {
    title: "Refund request received",
    description: "Order #48213 · €640.00 · reason: damaged on arrival",
    status: "complete",
    at: "14:02:11",
  },
  {
    title: "Checked the order in Shopify",
    description: "Delivered 4 days ago, no earlier refunds on this customer",
    status: "complete",
    at: "14:02:12",
  },
  {
    title: "Amount is over €500",
    description: "Branch taken: needs a person",
    status: "complete",
    at: "14:02:12",
  },
  {
    title: "Waiting for Finance to approve",
    description: "Sent to #finance-approvals with the photos attached",
    status: "awaiting-approval",
    at: "14:02:13",
  },
  {
    title: "Issue the refund and email the customer",
    description: "Runs the moment someone clicks Approve",
    status: "pending",
    at: "",
  },
];

function RunTimeline() {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <span className="text-subtitle font-semibold">Refund over €500</span>
        <span className="text-meta text-muted-foreground tabular-nums">run 8f31 · today</span>
      </div>
      <TimelineRoot>
        {STEPS.map((step) => (
          <TimelineItem
            description={step.description}
            key={step.title}
            status={step.status}
            timestamp={
              step.at ? <span className="font-mono text-meta tabular-nums">{step.at}</span> : null
            }
          >
            {step.title}
          </TimelineItem>
        ))}
      </TimelineRoot>
    </Card>
  );
}

/* ---------- Visual 3: what changed, per workflow ---------- */

interface Trend {
  name: string;
  values: number[];
  latest: string;
  meaning: string;
}

const TRENDS: Trend[] = [
  {
    name: "Runs a day",
    values: [310, 340, 355, 390, 420, 415, 470, 520, 540, 610, 650, 720],
    latest: "720",
    meaning: "up 2.3× since March",
  },
  {
    name: "Needing a person",
    values: [38, 36, 31, 30, 27, 24, 22, 21, 18, 17, 15, 14],
    latest: "14%",
    meaning: "down from 38%",
  },
  {
    name: "Median run time",
    values: [6.1, 5.8, 5.9, 5.2, 4.9, 4.4, 4.5, 3.9, 3.6, 3.2, 3.1, 2.9],
    latest: "2.9 s",
    meaning: "half of what it was",
  },
  {
    name: "Failed runs",
    values: [2.4, 2.1, 2.6, 1.9, 1.7, 1.5, 1.6, 1.1, 0.9, 0.8, 0.7, 0.6],
    latest: "0.6%",
    meaning: "every one retried and reported",
  },
];

function TrendCard() {
  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-col gap-1">
        <span className="text-subtitle font-semibold">Twelve weeks after switching</span>
        <span className="text-meta text-muted-foreground">
          One customer’s account, week by week
        </span>
      </div>
      <ul className="divide-y divide-border-strong">
        {TRENDS.map((trend) => (
          <li className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3" key={trend.name}>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-body font-medium">{trend.name}</span>
              <span className="truncate text-meta text-muted-foreground">{trend.meaning}</span>
            </span>
            <Sparkline
              height={28}
              label={`${trend.name}, twelve weeks`}
              values={trend.values}
              width={96}
            />
            <span className="w-14 text-end text-subtitle font-semibold tabular-nums">
              {trend.latest}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const DEFAULT_SECTIONS: ShowcaseSection[] = [
  {
    id: "runs",
    eyebrow: "Every run, in one list",
    title: "See what ran, what is waiting and what needs you",
    body: "Conduit keeps one list of every workflow run across every tool you connected. A run that needs a person says so — and who it is waiting for.",
    bullets: [
      "Filter by workflow, trigger, status or the person it is waiting on",
      "Failed runs keep their input, so you retry from the step that broke",
      "Every row links to the full step-by-step record",
    ],
    link: { label: "How runs are recorded", href: "#runs" },
    visual: <RunsTable />,
    visualLabel: "A table of recent workflow runs with their status",
  },
  {
    id: "steps",
    eyebrow: "A record you can read",
    title: "Every decision the workflow made, in plain words",
    body: "Open a run and read what happened as a timeline: what came in, what was checked, which branch was taken, and where a person was asked.",
    bullets: [
      "Each step shows its inputs and outputs, not just a green tick",
      "Approvals happen where your team already is — Slack, Teams or email",
      "Timestamps to the second, exportable for the auditor",
    ],
    link: { label: "Read a full run record", href: "#record" },
    visual: <RunTimeline />,
    visualLabel: "A timeline of one refund workflow run, waiting on approval",
  },
  {
    id: "trends",
    eyebrow: "Proof, not promises",
    title: "Watch the manual work fall away, week by week",
    body: "Every account gets a report of what the workflows took over: runs a day, how many still needed a person, how long they took, and how many failed.",
    bullets: [
      "Numbers per workflow, per team and per connected tool",
      "Share a read-only report with the people who signed it off",
      "Alerts when a number moves the wrong way",
    ],
    link: { label: "See a sample report", href: "#report" },
    visual: <TrendCard />,
    visualLabel: "Four twelve-week trends for one customer account",
  },
];

/**
 * Feature rows in a zig-zag: the copy on one side, the feature itself on the other, sides
 * swapping row by row. Each visual is built from the library’s own table, timeline and
 * sparklines, so it is the product — not a picture of it.
 */
export function MarketingFeatureShowcase({
  eyebrow = "The product",
  title = "Automation you can read back",
  description = "Conduit runs the workflows between your tools and writes down what it did, in words your team and your auditors understand.",
  sections = DEFAULT_SECTIONS,
  className,
}: MarketingFeatureShowcaseProps) {
  return (
    <section
      className={cn(
        "@container mx-auto flex w-full max-w-7xl flex-col gap-16 px-4 py-16 @4xl:gap-24",
        className,
      )}
      data-slot="marketing-feature-showcase"
    >
      <SectionHeader as="h2" description={description} eyebrow={eyebrow} size="lg" title={title} />
      <div className="flex flex-col gap-16 @4xl:gap-24">
        {sections.map((section, index) => {
          const flip = index % 2 === 1;
          return (
            <article
              aria-labelledby={`showcase-${section.id}-title`}
              className="grid items-center gap-8 @2xl:grid-cols-2 @2xl:gap-12 @4xl:gap-16"
              data-slot="marketing-feature-showcase-row"
              key={section.id}
            >
              <div
                className={cn("flex flex-col gap-5", flip && "@2xl:order-2")}
                data-slot="marketing-feature-showcase-copy"
              >
                <Text as="span" tone="primary" variant="eyebrow">
                  {section.eyebrow}
                </Text>
                <h3
                  className="text-title font-semibold text-balance"
                  id={`showcase-${section.id}-title`}
                >
                  {section.title}
                </h3>
                <p className="max-w-prose text-body text-muted-foreground text-pretty">
                  {section.body}
                </p>
                <ul className="flex flex-col gap-2.5">
                  {section.bullets.map((bullet) => (
                    <li className="flex items-start gap-2 text-body" key={bullet}>
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                      {bullet}
                    </li>
                  ))}
                </ul>
                {section.link ? (
                  <a
                    className="inline-flex w-fit items-center gap-1.5 rounded-sm text-body font-medium text-link underline-offset-4 hover:underline focus-ring"
                    href={section.link.href}
                  >
                    {section.link.label}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </a>
                ) : null}
              </div>
              <figure
                aria-label={section.visualLabel}
                className={cn("@container min-w-0", flip && "@2xl:order-1")}
                data-slot="marketing-feature-showcase-visual"
              >
                {section.visual}
              </figure>
            </article>
          );
        })}
      </div>
    </section>
  );
}
