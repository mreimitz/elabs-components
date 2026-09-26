"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import {
  Button,
  cn,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Label,
  SectionHeader,
} from "@elabs-ai/components-ui";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Eye,
  FileText,
  KeyRound,
  LifeBuoy,
  MessagesSquare,
  Plug,
  Search,
  Ship,
  Wallet,
} from "lucide-react";

export interface HelpCategory {
  id: string;
  icon: ReactNode;
  name: string;
  description: string;
  articleCount: number;
  href: string;
}

export interface HelpArticle {
  id: string;
  title: string;
  category: string;
  views: number;
  href: string;
}

export interface HelpCenterProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  searchPlaceholder?: string;
  /** Queries offered under the search box; selecting one fills the box and searches. */
  suggestions?: string[];
  categories?: HelpCategory[];
  popular?: HelpArticle[];
  contactHref?: string;
  statusHref?: string;
  communityHref?: string;
  /** Called with the query on submit; the block does not search itself. */
  onSearch?: (query: string) => void;
  locale?: string;
  /**
   * The heading level of the title. `"h1"` when the help centre is the page (the
   * default); `"h2"` when it is a section of a page that already has its `<h1>`.
   */
  titleAs?: "h1" | "h2";
  className?: string;
}

export const CATEGORIES: HelpCategory[] = [
  {
    id: "getting-started",
    icon: <BookOpen aria-hidden="true" />,
    name: "Getting started",
    description: "Your first lane, first carrier and first shipment.",
    articleCount: 14,
    href: "#/help/getting-started",
  },
  {
    id: "shipments",
    icon: <Ship aria-hidden="true" />,
    name: "Shipments & routing",
    description: "Booking, re-planning, ETAs and the planner timeline.",
    articleCount: 38,
    href: "#/help/shipments",
  },
  {
    id: "customs",
    icon: <FileText aria-hidden="true" />,
    name: "Customs Desk",
    description: "Filings, HS codes, brokers and holds.",
    articleCount: 27,
    href: "#/help/customs",
  },
  {
    id: "integrations",
    icon: <Plug aria-hidden="true" />,
    name: "Carriers & integrations",
    description: "EDI, the API, webhooks and the ERP connectors.",
    articleCount: 31,
    href: "#/help/integrations",
  },
  {
    id: "account",
    icon: <KeyRound aria-hidden="true" />,
    name: "Account & access",
    description: "Members, roles, SSO and the audit log.",
    articleCount: 19,
    href: "#/help/account",
  },
  {
    id: "billing",
    icon: <Wallet aria-hidden="true" />,
    name: "Billing",
    description: "Plans, invoices, usage and VAT.",
    articleCount: 9,
    href: "#/help/billing",
  },
];

export const POPULAR: HelpArticle[] = [
  {
    id: "eta-band",
    title: "What the ETA confidence band means, and how to plan against it",
    category: "Shipments & routing",
    views: 18420,
    href: "#/help/shipments/eta-band",
  },
  {
    id: "edi-315",
    title: "Connecting a carrier that sends EDI 315",
    category: "Carriers & integrations",
    views: 12930,
    href: "#/help/integrations/edi-315",
  },
  {
    id: "pre-clearance",
    title: "Filing pre-clearance before the vessel docks",
    category: "Customs Desk",
    views: 11205,
    href: "#/help/customs/pre-clearance",
  },
  {
    id: "sso-saml",
    title: "Setting up SAML single sign-on",
    category: "Account & access",
    views: 7640,
    href: "#/help/account/sso",
  },
  {
    id: "exceptions",
    title: "Exceptions: owners, due times and what “resolved” means",
    category: "Shipments & routing",
    views: 6980,
    href: "#/help/shipments/exceptions",
  },
  {
    id: "webhooks",
    title: "Webhook events and retry behaviour",
    category: "Carriers & integrations",
    views: 5310,
    href: "#/help/integrations/webhooks",
  },
];

/**
 * A help-centre landing: a big search with suggested queries as chips, six category cards
 * with an icon and article count, the most-read articles with their view counts, and a
 * “Still stuck?” row that points at support, the status page and the community.
 */
export function HelpCenter({
  eyebrow = "Help centre",
  title = "How can we help?",
  description = "Guides and answers for every part of Harbourline, written by the people who support it.",
  searchPlaceholder = "Search for “EDI 315”, “pre-clearance”, “SSO”…",
  suggestions = ["Connect a carrier", "ETA confidence band", "HS code lookup", "Invite a member"],
  categories = CATEGORIES,
  popular = POPULAR,
  contactHref = "#/support/new",
  statusHref = "#/status",
  communityHref = "#/community",
  onSearch,
  locale,
  titleAs = "h1",
  className,
}: HelpCenterProps) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const id = useId();
  const views = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });

  const search = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSubmitted(trimmed);
    onSearch?.(trimmed);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    search(query);
  };
  const suggest = (value: string) => {
    setQuery(value);
    search(value);
  };

  return (
    <section
      className={cn(
        "@container mx-auto flex w-full max-w-7xl flex-col gap-14 px-4 py-16",
        className,
      )}
      data-slot="help-center"
    >
      <div
        className="bg-hairline-hatch flex flex-col items-center gap-6 rounded-xl border bg-card px-6 py-12 text-center @3xl:py-16"
        data-slot="help-center-search"
      >
        <SectionHeader
          as={titleAs}
          className="items-center text-center"
          description={description}
          eyebrow={eyebrow}
          size="lg"
          title={title}
        />
        <form className="flex w-full max-w-2xl flex-col gap-3" onSubmit={submit} role="search">
          <Label className="sr-only" htmlFor={`${id}-query`}>
            Search the help centre
          </Label>
          <InputGroup className="h-control-lg">
            <InputGroupAddon className="ps-4">
              <Search aria-hidden="true" className="size-5" />
            </InputGroupAddon>
            <InputGroupInput
              autoComplete="off"
              className="text-subtitle"
              id={`${id}-query`}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              type="search"
              value={query}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="sm" type="submit" variant="default">
                Search
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-meta text-muted-foreground">Try:</span>
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion}
                onClick={() => suggest(suggestion)}
                size="sm"
                type="button"
                variant="outline-subtle"
              >
                {suggestion}
              </Button>
            ))}
          </div>
          <p aria-live="polite" className="sr-only">
            {submitted ? `Searching for ${submitted}.` : ""}
          </p>
        </form>
      </div>

      <section
        aria-labelledby="help-center-browse"
        className="flex flex-col gap-6"
        data-slot="help-center-categories"
      >
        <h2 className="text-title font-semibold" id="help-center-browse">
          Browse by topic
        </h2>
        <ul className="grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
          {categories.map((category) => (
            <li className="min-w-0" key={category.id}>
              <a
                className="group/category flex h-full gap-4 rounded-lg border bg-card p-5 shadow-xs transition-colors duration-fast ease-standard focus-ring hover:bg-surface-muted"
                href={category.href}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">
                  {category.icon}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-subtitle font-semibold group-hover/category:underline">
                    {category.name}
                  </span>
                  <span className="text-body text-muted-foreground text-pretty">
                    {category.description}
                  </span>
                  <span className="mt-1 text-meta text-muted-foreground tabular-nums">
                    {category.articleCount} articles
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="help-center-popular"
        className="flex flex-col gap-6"
        data-slot="help-center-popular"
      >
        <h2 className="text-title font-semibold" id="help-center-popular">
          Most read this month
        </h2>
        <ol className="divide-y divide-border-strong rounded-lg border">
          {popular.map((article, i) => (
            <li className="min-w-0" key={article.id}>
              <a
                className="group/article flex items-center gap-4 p-4 focus-ring-inset hover:bg-surface-muted"
                href={article.href}
              >
                <span className="w-6 shrink-0 text-meta text-muted-foreground tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-body font-medium group-hover/article:underline">
                    {article.title}
                  </span>
                  <span className="text-meta text-muted-foreground">{article.category}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-meta text-muted-foreground tabular-nums">
                  <Eye aria-hidden="true" className="size-3.5" />
                  {views.format(article.views)}
                  <span className="sr-only"> views</span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition-transform duration-base ease-standard group-hover/article:translate-x-0.5 motion-reduce:transition-none"
                />
              </a>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="help-center-stuck"
        className="flex flex-col gap-6"
        data-slot="help-center-contact"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-title font-semibold" id="help-center-stuck">
            Still stuck?
          </h2>
          <p className="text-body text-muted-foreground">
            A person answers within an hour, around the clock.
          </p>
        </div>
        <ul className="grid gap-4 @2xl:grid-cols-3">
          {[
            {
              icon: <LifeBuoy aria-hidden="true" />,
              title: "Contact support",
              description: "Open a ticket with your shipment reference; we reply within the hour.",
              href: contactHref,
              cta: "Open a ticket",
            },
            {
              icon: <Activity aria-hidden="true" />,
              title: "Status page",
              description:
                "Live status for the API, EDI ingestion and the planner, with incident history.",
              href: statusHref,
              cta: "Check status",
            },
            {
              icon: <MessagesSquare aria-hidden="true" />,
              title: "Community",
              description:
                "Ops leads and brokers comparing notes; the Harbourline team reads every thread.",
              href: communityHref,
              cta: "Join the forum",
            },
          ].map((item) => (
            <li
              className="flex flex-col gap-3 rounded-lg border bg-card p-5 shadow-xs"
              key={item.title}
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-surface-muted text-foreground [&_svg]:size-5">
                {item.icon}
              </span>
              <span className="text-subtitle font-semibold">{item.title}</span>
              <span className="text-body text-muted-foreground text-pretty">
                {item.description}
              </span>
              <Button asChild className="mt-auto self-start" variant="outline">
                <a href={item.href}>
                  {item.cta}
                  <ArrowRight aria-hidden="true" />
                </a>
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
