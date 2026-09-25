import type { ReactNode } from "react";
import { StatsBand, type Stat } from "@elabs-ai/components-marketing";
import { cn, Heading, SectionHeader, Text } from "@elabs-ai/components-ui";
import { Anchor, Compass, Handshake, Lightbulb, ShieldCheck } from "lucide-react";

export interface Milestone {
  /** ISO date (`YYYY-MM-DD`); only the year and month are shown. */
  date: string;
  title: string;
  description: string;
  /** The milestone marked as “now”. */
  current?: boolean;
}

export interface CompanyValue {
  icon: ReactNode;
  title: string;
  description: string;
}

export interface AboutStoryProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  /** The mission, as one or two sentences. */
  mission?: ReactNode;
  /** Longer prose under the mission. */
  story?: string[];
  milestones?: Milestone[];
  values?: CompanyValue[];
  stats?: Stat[];
  locale?: string;
  /**
   * The heading level of the title. `"h1"` when the story is the page (the default);
   * `"h2"` when it sits under a page header that already carries the `<h1>`.
   */
  titleAs?: "h1" | "h2";
  /** Heading over the timeline. */
  milestonesTitle?: ReactNode;
  /** Heading over the values, and the line under it (`null` hides the line). */
  valuesTitle?: ReactNode;
  valuesDescription?: ReactNode;
  /** The closing line — where the company sits. `null` hides it. */
  locations?: ReactNode;
  className?: string;
}

export const MILESTONES: Milestone[] = [
  {
    date: "2021-03-01",
    title: "Founded in Oslo",
    description:
      "Three of us, a container terminal, and a spreadsheet that could not keep up with the vessel schedule.",
  },
  {
    date: "2021-11-01",
    title: "First customer",
    description:
      "Bluewater Marine plans its first live route in Harbourline. Set up on a Tuesday, live by Friday.",
  },
  {
    date: "2023-02-01",
    title: "Series A",
    description: "€14M to build Customs Desk and connect every carrier over EDI.",
  },
  {
    date: "2025-06-01",
    title: "100 employees",
    description: "Offices in Rotterdam and Singapore; support that follows the sun.",
  },
  {
    date: "2026-09-01",
    title: "Today",
    description: "Control Tower ships. 2.4 million containers a year move on the platform.",
    current: true,
  },
];

const DEFAULT_VALUES: CompanyValue[] = [
  {
    icon: <Anchor aria-hidden="true" />,
    title: "Ship what the desk needs",
    description:
      "We build for the planner with eleven tabs open. If a feature does not save a decision, it does not ship.",
  },
  {
    icon: <ShieldCheck aria-hidden="true" />,
    title: "Say the true number",
    description:
      "An ETA with a confidence band beats a precise-looking guess. We would rather show a range than be wrong with conviction.",
  },
  {
    icon: <Handshake aria-hidden="true" />,
    title: "Carriers are partners",
    description:
      "Every carrier speaks its own dialect. We meet them where they are instead of asking them to change.",
  },
  {
    icon: <Lightbulb aria-hidden="true" />,
    title: "Small teams, real lanes",
    description:
      "Squads own a customer lane end to end. Nothing teaches faster than watching your work move a container.",
  },
];

const DEFAULT_STATS: Stat[] = [
  { value: "2.4M", label: "containers a year" },
  { value: "41", label: "terminals connected" },
  { value: "84", label: "people in three offices" },
  { value: "99.98%", label: "uptime, trailing twelve months" },
];

/**
 * “Our story”: the mission in one line, the founding prose, a milestone timeline that runs
 * horizontally at wide widths and vertically at narrow ones, four values with an icon and
 * prose, and the company by the numbers in a `StatsBand`.
 */
export function AboutStory({
  eyebrow = "About Harbourline",
  title = "Every port should run on one screen",
  mission = "We build the operations desk for the people who move the world’s containers — so a delayed vessel is a decision, not a surprise.",
  story = [
    "Harbourline started in 2021 at a container terminal outside Oslo, where three of us watched a planning team run a 40-vessel schedule from a spreadsheet and a phone. Every delay was discovered by a customer before it was discovered by the desk.",
    "We built the first version for one terminal. Five years on, the platform plans routes, files customs and tracks exceptions for teams in 19 countries — and the spreadsheet is gone.",
  ],
  milestones = MILESTONES,
  values = DEFAULT_VALUES,
  stats = DEFAULT_STATS,
  locale,
  titleAs = "h1",
  milestonesTitle = "Five years, five milestones",
  valuesTitle = "What we hold to",
  valuesDescription = "Four things we would keep if we had to start over.",
  locations = "Oslo · Rotterdam · Singapore",
  className,
}: AboutStoryProps) {
  const month = new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <section
      className={cn(
        "@container mx-auto flex w-full max-w-7xl flex-col gap-16 px-4 py-16",
        className,
      )}
      data-slot="about-story"
    >
      <div className="grid gap-8 @3xl:grid-cols-5 @3xl:gap-12" data-slot="about-story-mission">
        <div className="flex flex-col gap-5 @3xl:col-span-3">
          <SectionHeader as={titleAs} eyebrow={eyebrow} size="lg" title={title} />
          <Text className="max-w-prose text-pretty" variant="lead">
            {mission}
          </Text>
        </div>
        <div className="flex flex-col gap-4 @3xl:col-span-2 @3xl:pt-12">
          {story.map((paragraph) => (
            <Text className="text-pretty" key={paragraph} tone="muted">
              {paragraph}
            </Text>
          ))}
        </div>
      </div>

      <section
        aria-labelledby="about-story-milestones"
        className="flex flex-col gap-8"
        data-slot="about-story-milestones"
      >
        <Heading id="about-story-milestones" level={2}>
          {milestonesTitle}
        </Heading>
        <ol className="grid gap-8 @3xl:grid-flow-col @3xl:auto-cols-fr @3xl:gap-6">
          {milestones.map((milestone, i) => {
            const last = i === milestones.length - 1;
            return (
              <li
                aria-current={milestone.current ? "step" : undefined}
                className="relative flex gap-4 @3xl:flex-col @3xl:gap-5"
                key={milestone.date}
              >
                {/* The rail: down the side when stacked, across the top when in a row. */}
                <span
                  aria-hidden="true"
                  className="relative flex shrink-0 @3xl:h-4 @3xl:items-center"
                >
                  {last ? null : (
                    <span className="absolute start-[7px] top-4 h-[calc(100%+2rem)] w-px bg-border-strong @3xl:start-4 @3xl:top-1/2 @3xl:h-px @3xl:w-[calc(100%+1.5rem)] @3xl:-translate-y-1/2" />
                  )}
                  <span
                    className={cn(
                      "relative size-4 rounded-full border-2",
                      milestone.current
                        ? "border-primary bg-primary ring-4 ring-primary/20"
                        : "border-border-strong bg-background",
                    )}
                  />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <time
                    className="text-meta text-muted-foreground tabular-nums"
                    dateTime={milestone.date}
                  >
                    {month.format(new Date(`${milestone.date}T00:00:00Z`))}
                  </time>
                  <span className="text-subtitle font-semibold text-balance">
                    {milestone.title}
                    {milestone.current ? <span className="sr-only"> (now)</span> : null}
                  </span>
                  <span className="text-body text-muted-foreground text-pretty">
                    {milestone.description}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section
        aria-labelledby="about-story-values"
        className="flex flex-col gap-8"
        data-slot="about-story-values"
      >
        <div className="flex flex-col gap-2">
          <Heading id="about-story-values" level={2}>
            {valuesTitle}
          </Heading>
          {valuesDescription ? (
            <Text className="max-w-prose text-pretty" tone="muted">
              {valuesDescription}
            </Text>
          ) : null}
        </div>
        <ul className="grid gap-x-8 gap-y-8 @xl:grid-cols-2 @4xl:grid-cols-4">
          {values.map((value) => (
            <li className="flex flex-col gap-3" key={value.title}>
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">
                {value.icon}
              </span>
              <span className="text-subtitle font-semibold">{value.title}</span>
              <span className="text-body text-muted-foreground text-pretty">
                {value.description}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="By the numbers" data-slot="about-story-numbers">
        <StatsBand
          animate={false}
          stats={stats.map((stat) => ({
            ...stat,
            value: <span className="tabular-nums">{stat.value}</span>,
          }))}
        />
      </section>

      {locations ? (
        <p className="flex items-center gap-2 self-center text-meta text-muted-foreground">
          <Compass aria-hidden="true" className="size-3.5" />
          {locations}
        </p>
      ) : null}
    </section>
  );
}
