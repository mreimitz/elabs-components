"use client";

import { useState, type ReactNode } from "react";
import {
  AspectRatio,
  Badge,
  Button,
  Card,
  CardContent,
  cn,
  Image,
  SectionHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@elabs-ai/components-ui";
import { posterArt } from "@/components/media-parts/media-fixtures";
import { BookOpen, Clock, Download, FileText, LayoutTemplate, Play, Video } from "lucide-react";

export type ResourceType = "guide" | "webinar" | "report" | "template";

export interface Resource {
  id: string;
  type: ResourceType;
  title: string;
  blurb: string;
  /** `"18 min"` for a webinar, `"24 pages"` for a guide or report, `"XLSX"` for a template. */
  meta: string;
  href: string;
  /** ISO date (`YYYY-MM-DD`). */
  published: string;
}

export interface FeaturedResource extends Resource {
  /** The banner picture — a data URL drawn offline here; point it at your own asset. */
  cover: string;
}

export interface ResourcesProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  featured?: FeaturedResource;
  resources?: Resource[];
  /**
   * The heading level of the title. `"h1"` when this block is the resources page (the
   * default); `"h2"` when it is a section of a page that already has an `<h1>`.
   */
  titleAs?: "h1" | "h2";
  locale?: string;
  className?: string;
}

const TYPE: Record<
  ResourceType,
  {
    label: string;
    plural: string;
    icon: typeof BookOpen;
    variant: "info" | "success" | "warning" | "secondary";
    action: "Download" | "Watch" | "Use template";
  }
> = {
  guide: { label: "Guide", plural: "Guides", icon: BookOpen, variant: "info", action: "Download" },
  webinar: {
    label: "Webinar",
    plural: "Webinars",
    icon: Video,
    variant: "success",
    action: "Watch",
  },
  report: {
    label: "Report",
    plural: "Reports",
    icon: FileText,
    variant: "warning",
    action: "Download",
  },
  template: {
    label: "Template",
    plural: "Templates",
    icon: LayoutTemplate,
    variant: "secondary",
    action: "Use template",
  },
};

const TYPES: ResourceType[] = ["guide", "webinar", "report", "template"];

export const FEATURED: FeaturedResource = {
  id: "state-of-ocean-freight-2026",
  type: "report",
  title: "The State of Ocean Freight 2026",
  blurb:
    "Dwell time, ETA accuracy and customs holds across 41 terminals and 2.4 million containers — the benchmarks ops teams plan against.",
  meta: "48 pages",
  href: "#/resources/state-of-ocean-freight-2026",
  published: "2026-09-09",
  cover: posterArt("bars", "state-of-ocean-freight", { width: 1200, height: 675 }),
};

export const RESOURCES: Resource[] = [
  {
    id: "pre-clearance-guide",
    type: "guide",
    title: "The pre-clearance playbook",
    blurb:
      "Filing before the vessel docks: the paperwork, the timing window and the fields brokers get wrong.",
    meta: "24 pages",
    href: "#/resources/pre-clearance-guide",
    published: "2026-09-11",
  },
  {
    id: "control-tower-webinar",
    type: "webinar",
    title: "Control Tower, live: a day on the exceptions desk",
    blurb:
      "Mara Okonkwo walks a real morning of exceptions — what gets a decision, what gets closed, what waits.",
    meta: "32 min",
    href: "#/resources/control-tower-webinar",
    published: "2026-09-04",
  },
  {
    id: "eta-model-report",
    type: "report",
    title: "ETA accuracy by lane, Q3 2026",
    blurb:
      "Median error per lane before and after model-based ETAs, with the confidence bands we publish.",
    meta: "16 pages",
    href: "#/resources/eta-model-report",
    published: "2026-08-28",
  },
  {
    id: "sop-template",
    type: "template",
    title: "Exception-handling SOP",
    blurb: "A fill-in standard operating procedure for who owns which exception, and by when.",
    meta: "DOCX",
    href: "#/resources/sop-template",
    published: "2026-08-21",
  },
  {
    id: "edi-guide",
    type: "guide",
    title: "Connecting carriers over EDI 315",
    blurb: "Dialects, test messages and the four fields that differ between the big carriers.",
    meta: "18 pages",
    href: "#/resources/edi-guide",
    published: "2026-08-14",
  },
  {
    id: "customs-webinar",
    type: "webinar",
    title: "HS codes without the headache",
    blurb:
      "Priya Raman on the five classification mistakes that cost a week, and how Customs Desk catches them.",
    meta: "24 min",
    href: "#/resources/customs-webinar",
    published: "2026-08-07",
  },
  {
    id: "demurrage-calculator",
    type: "template",
    title: "Demurrage exposure calculator",
    blurb:
      "A spreadsheet that turns your free days, volumes and dwell times into an exposure number per terminal.",
    meta: "XLSX",
    href: "#/resources/demurrage-calculator",
    published: "2026-07-31",
  },
  {
    id: "dwell-report",
    type: "report",
    title: "Port dwell time, 41 terminals",
    blurb: "The median container waits 3.4 days after discharge. The best terminal clears in 1.1.",
    meta: "22 pages",
    href: "#/resources/dwell-report",
    published: "2026-07-24",
  },
  {
    id: "onboarding-guide",
    type: "guide",
    title: "Your first 30 days on Harbourline",
    blurb: "Week by week: the first lane, the first carrier, the first customs filing.",
    meta: "12 pages",
    href: "#/resources/onboarding-guide",
    published: "2026-07-17",
  },
  {
    id: "sso-webinar",
    type: "webinar",
    title: "Rolling out SSO and roles",
    blurb: "A 15-minute walkthrough for the admin setting up SAML, SCIM and the Auditor role.",
    meta: "15 min",
    href: "#/resources/sso-webinar",
    published: "2026-07-10",
  },
  {
    id: "rfp-template",
    type: "template",
    title: "Freight-visibility RFP checklist",
    blurb: "The 40 questions to put to any visibility vendor, including us.",
    meta: "PDF",
    href: "#/resources/rfp-template",
    published: "2026-06-26",
  },
];

/**
 * A resource library: a featured banner up top, type tabs (All, Guides, Webinars, Reports,
 * Templates) that filter the grid, cards with a type badge that carries an icon, the
 * title, a blurb, duration or page count, and a Download / Watch action. The result
 * count is announced.
 */
export function Resources({
  eyebrow = "Resources",
  title = "Guides, webinars and benchmarks",
  description = "Everything we have learned about moving containers, written down for the people who do it.",
  featured = FEATURED,
  resources = RESOURCES,
  titleAs = "h1",
  locale,
  className,
}: ResourcesProps) {
  const [tab, setTab] = useState<"all" | ResourceType>("all");
  const shown = tab === "all" ? resources : resources.filter((r) => r.type === tab);
  const date = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const FeaturedIcon = TYPE[featured.type].icon;

  const grid = (items: Resource[]) => (
    <ul className="grid gap-5 @xl:grid-cols-2 @4xl:grid-cols-3" data-slot="resources-grid">
      {items.map((resource) => {
        const meta = TYPE[resource.type];
        const Icon = meta.icon;
        const ActionIcon = meta.action === "Watch" ? Play : Download;
        return (
          <li className="min-w-0" key={resource.id}>
            <Card className="h-full">
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center justify-between gap-2">
                  <Badge appearance="tint" variant={meta.variant}>
                    <Icon aria-hidden="true" className="size-3" />
                    {meta.label}
                  </Badge>
                  <time
                    className="text-meta text-muted-foreground tabular-nums"
                    dateTime={resource.published}
                  >
                    {date.format(new Date(`${resource.published}T00:00:00Z`))}
                  </time>
                </div>
                <h3 className="text-subtitle font-semibold text-balance">{resource.title}</h3>
                <p className="line-clamp-3 text-body text-muted-foreground text-pretty">
                  {resource.blurb}
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                  <span className="flex items-center gap-1 text-meta text-muted-foreground tabular-nums">
                    {resource.type === "webinar" ? (
                      <Clock aria-hidden="true" className="size-3.5" />
                    ) : (
                      <FileText aria-hidden="true" className="size-3.5" />
                    )}
                    {resource.meta}
                  </span>
                  <Button asChild size="sm" variant="outline">
                    <a href={resource.href}>
                      <ActionIcon aria-hidden="true" />
                      {meta.action}
                      <span className="sr-only">: {resource.title}</span>
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section
      className={cn(
        "@container mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-16",
        className,
      )}
      data-slot="resources"
    >
      <SectionHeader
        as={titleAs}
        description={description}
        eyebrow={eyebrow}
        size="lg"
        title={title}
      />

      <article
        className="grid overflow-hidden rounded-xl border bg-card shadow-sm @3xl:grid-cols-5"
        data-slot="resources-featured"
      >
        <div className="flex flex-col justify-center gap-4 p-6 @3xl:order-1 @3xl:col-span-2 @3xl:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Featured</Badge>
            <Badge appearance="tint" variant={TYPE[featured.type].variant}>
              <FeaturedIcon aria-hidden="true" className="size-3" />
              {TYPE[featured.type].label}
            </Badge>
          </div>
          <h2 className="text-title font-semibold text-balance">{featured.title}</h2>
          <p className="text-body text-muted-foreground text-pretty">{featured.blurb}</p>
          <p className="flex flex-wrap items-center gap-x-3 text-meta text-muted-foreground tabular-nums">
            <span>{featured.meta}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={featured.published}>
              {date.format(new Date(`${featured.published}T00:00:00Z`))}
            </time>
          </p>
          <Button asChild className="self-start" size="lg">
            <a href={featured.href}>
              <Download aria-hidden="true" />
              {TYPE[featured.type].action} the {TYPE[featured.type].label.toLowerCase()}
            </a>
          </Button>
        </div>
        <div className="@3xl:order-2 @3xl:col-span-3">
          <AspectRatio className="overflow-hidden bg-muted" ratio={16 / 9}>
            <Image
              alt=""
              className="size-full"
              fit="cover"
              showSkeleton={false}
              src={featured.cover}
            />
          </AspectRatio>
        </div>
      </article>

      <Tabs
        className="flex flex-col gap-6"
        onValueChange={(value) => setTab(value as "all" | ResourceType)}
        value={tab}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-3"
          data-slot="resources-tabs"
        >
          <TabsList aria-label="Resource type">
            <TabsTrigger value="all">All</TabsTrigger>
            {TYPES.map((type) => (
              <TabsTrigger key={type} value={type}>
                {TYPE[type].plural}
              </TabsTrigger>
            ))}
          </TabsList>
          <p aria-live="polite" className="text-meta text-muted-foreground tabular-nums">
            {shown.length === 1 ? "1 resource" : `${shown.length} resources`}
            {tab === "all" ? "" : ` · ${TYPE[tab].plural.toLowerCase()}`}
          </p>
        </div>
        <TabsContent value="all">{grid(resources)}</TabsContent>
        {TYPES.map((type) => (
          <TabsContent key={type} value={type}>
            {grid(resources.filter((r) => r.type === type))}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
