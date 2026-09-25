"use client";

import { useMemo, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import {
  Bell,
  Braces,
  Bug,
  Building2,
  Calendar,
  Cloud,
  Database,
  GitBranch,
  Handshake,
  Kanban,
  Mail,
  MessageSquare,
  Phone,
  SearchX,
  Server,
  Table2,
  Workflow,
} from "lucide-react";
import { SearchInput } from "@elabs-ai/components-data";
import {
  Badge,
  Button,
  Card,
  CardContent,
  SectionHeader,
  StatePanel,
  ToggleGroup,
  ToggleGroupItem,
} from "@elabs-ai/components-ui";

type Glyph = ComponentType<SVGProps<SVGSVGElement>>;

export type IntegrationCategory = "Data" | "Messaging" | "CRM" | "Dev tools";

export interface IntegrationTile {
  id: string;
  name: string;
  /** Generic glyph — a fictional product gets a Lucide icon, never a borrowed logo. */
  icon: Glyph;
  category: IntegrationCategory;
  summary: string;
  /** Built and supported by us, or reachable through the public API. */
  kind: "Native" | "Via API";
  href?: string;
}

export interface MarketingIntegrationsProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  integrations?: IntegrationTile[];
  /** Tab order; "All" is added first. */
  categories?: IntegrationCategory[];
  requestLabel?: string;
  requestHref?: string;
}

const DEFAULT_CATEGORIES: IntegrationCategory[] = ["Data", "Messaging", "CRM", "Dev tools"];

const DEFAULT_INTEGRATIONS: IntegrationTile[] = [
  {
    id: "glacier",
    name: "Glacier Warehouse",
    icon: Database,
    category: "Data",
    summary: "Query every table in place. Nothing is copied.",
    kind: "Native",
  },
  {
    id: "bigtable",
    name: "Bigtable Cloud",
    icon: Cloud,
    category: "Data",
    summary: "Read replicas and scheduled extracts.",
    kind: "Native",
  },
  {
    id: "sheetsync",
    name: "SheetSync",
    icon: Table2,
    category: "Data",
    summary: "A spreadsheet becomes a live source in one click.",
    kind: "Native",
  },
  {
    id: "pipelane",
    name: "Pipelane",
    icon: Workflow,
    category: "Data",
    summary: "Trigger a model run when a pipeline finishes.",
    kind: "Via API",
  },
  {
    id: "huddle",
    name: "Huddle",
    icon: MessageSquare,
    category: "Messaging",
    summary: "Ask a question in a channel, get the chart back.",
    kind: "Native",
  },
  {
    id: "pigeon",
    name: "Pigeon Mail",
    icon: Mail,
    category: "Messaging",
    summary: "Scheduled digests to any list, every Monday.",
    kind: "Native",
  },
  {
    id: "signal",
    name: "Signalbox",
    icon: Bell,
    category: "Messaging",
    summary: "A metric crosses a line, a page goes out.",
    kind: "Native",
  },
  {
    id: "ringline",
    name: "Ringline",
    icon: Phone,
    category: "Messaging",
    summary: "Voice alerts for the on-call rota.",
    kind: "Via API",
  },
  {
    id: "orbit",
    name: "Orbit CRM",
    icon: Handshake,
    category: "CRM",
    summary: "Accounts, deals and health scores, synced hourly.",
    kind: "Native",
  },
  {
    id: "ledger",
    name: "Ledgerline",
    icon: Building2,
    category: "CRM",
    summary: "Invoices and renewals next to product usage.",
    kind: "Native",
  },
  {
    id: "meetly",
    name: "Meetly",
    icon: Calendar,
    category: "CRM",
    summary: "Meeting outcomes written back to the account.",
    kind: "Via API",
  },
  {
    id: "forge",
    name: "Forge",
    icon: GitBranch,
    category: "Dev tools",
    summary: "Metric definitions live in your repository.",
    kind: "Native",
  },
  {
    id: "tracker",
    name: "Tracker",
    icon: Bug,
    category: "Dev tools",
    summary: "Open an issue from any anomaly, context attached.",
    kind: "Native",
  },
  {
    id: "boards",
    name: "Boards",
    icon: Kanban,
    category: "Dev tools",
    summary: "Cycle time and throughput from your boards.",
    kind: "Via API",
  },
  {
    id: "deployer",
    name: "Deployer",
    icon: Server,
    category: "Dev tools",
    summary: "Mark every deploy on every chart.",
    kind: "Via API",
  },
  {
    id: "sdk",
    name: "Beacon SDK",
    icon: Braces,
    category: "Dev tools",
    summary: "TypeScript and Python clients for everything above.",
    kind: "Native",
  },
];

/**
 * The integrations wall — a search box and category toggles that filter a grid of tiles, each
 * with a glyph, the product, one line on what it does and whether it is native or reached
 * through the API. The match count is announced when it changes; an empty result says what
 * to try and where to ask for a connector.
 */
export function MarketingIntegrations({
  eyebrow = "Integrations",
  title = "Beacon fits the stack you already run",
  description = "Native connectors are built and supported by us. Anything else reaches Beacon through the same API our own connectors use.",
  integrations = DEFAULT_INTEGRATIONS,
  categories = DEFAULT_CATEGORIES,
  requestLabel = "Request a connector",
  requestHref = "#request",
}: MarketingIntegrationsProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | IntegrationCategory>("All");

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return integrations.filter(
      (item) =>
        (category === "All" || item.category === category) &&
        (needle === "" ||
          item.name.toLowerCase().includes(needle) ||
          item.summary.toLowerCase().includes(needle) ||
          item.category.toLowerCase().includes(needle)),
    );
  }, [category, integrations, query]);

  const countOf = (name: "All" | IntegrationCategory) =>
    name === "All"
      ? integrations.length
      : integrations.filter((item) => item.category === name).length;

  const summary =
    shown.length === integrations.length
      ? `All ${integrations.length} integrations`
      : `${shown.length} of ${integrations.length} integrations`;

  return (
    <section
      className="@container mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-16"
      data-slot="marketing-integrations"
    >
      <SectionHeader
        actions={
          <Button asChild variant="outline">
            <a href={requestHref}>{requestLabel}</a>
          </Button>
        }
        as="h2"
        description={description}
        eyebrow={eyebrow}
        title={title}
      />

      <div
        className="flex flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:justify-between"
        data-slot="marketing-integrations-filters"
      >
        {/*
          A segmented toggle rather than `Tabs`: there is one grid, not a panel per
          category, so a tablist would point every tab at a panel that does not exist.
        */}
        <ToggleGroup
          aria-label="Category"
          className="flex-wrap"
          onValueChange={(value) => value && setCategory(value as "All" | IntegrationCategory)}
          type="single"
          value={category}
          variant="segmented"
        >
          {(["All", ...categories] as const).map((name) => (
            <ToggleGroupItem key={name} value={name}>
              {name}
              <span className="ms-1.5 text-meta tabular-nums text-muted-foreground">
                {countOf(name)}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <SearchInput
          containerClassName="w-full @2xl:w-72"
          label="Search integrations"
          onValueChange={setQuery}
          placeholder="Search by product or purpose"
          value={query}
        />
      </div>

      <p aria-live="polite" className="text-meta tabular-nums text-muted-foreground" role="status">
        {summary}
        {query.trim() ? ` matching “${query.trim()}”` : ""}
        {category !== "All" ? ` in ${category}` : ""}
      </p>

      {shown.length === 0 ? (
        <StatePanel
          actions={
            <>
              <Button
                onClick={() => {
                  setQuery("");
                  setCategory("All");
                }}
                variant="outline"
              >
                Clear the filters
              </Button>
              <Button asChild variant="ghost">
                <a href={requestHref}>{requestLabel}</a>
              </Button>
            </>
          }
          description="Try a shorter word, another category, or tell us what you need and we will look into it."
          icon={<SearchX aria-hidden="true" />}
          kind="empty"
          title={`Nothing matches “${query.trim()}”`}
          titleAs="h3"
        />
      ) : (
        <ul
          className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-3 @6xl:grid-cols-4"
          data-slot="marketing-integrations-grid"
        >
          {shown.map((item) => {
            const Icon = item.icon;
            const body = (
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-foreground">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <Badge variant={item.kind === "Native" ? "default" : "outline"}>
                    {item.kind}
                  </Badge>
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-body font-semibold">{item.name}</h3>
                  <p className="text-body text-muted-foreground text-pretty">{item.summary}</p>
                </div>
                <span className="mt-auto text-meta text-muted-foreground">{item.category}</span>
              </CardContent>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <a
                    aria-label={`${item.name}, ${item.kind}`}
                    className="block h-full rounded-lg focus-ring"
                    href={item.href}
                  >
                    <Card className="h-full transition-shadow duration-fast hover:shadow-md">
                      {body}
                    </Card>
                  </a>
                ) : (
                  <Card className="h-full">{body}</Card>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
