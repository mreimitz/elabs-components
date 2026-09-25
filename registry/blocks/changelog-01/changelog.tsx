"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  cn,
  FieldControl,
  FieldError,
  FieldLabel,
  FieldRoot,
  Input,
  SectionHeader,
  ToggleGroup,
  ToggleGroupItem,
} from "@elabs-ai/components-ui";
import { ArrowUpRight, Bug, CircleCheck, Rss, Sparkles, TriangleAlert, Wrench } from "lucide-react";

export type ChangeType = "new" | "improved" | "fixed";
export type ReleaseKind = "major" | "minor" | "patch";

export interface Change {
  type: ChangeType;
  text: string;
  /** A link to the docs for this change. */
  href?: string;
}

export interface Release {
  version: string;
  kind: ReleaseKind;
  /** ISO date (`YYYY-MM-DD`). */
  date: string;
  title: string;
  summary?: string;
  changes: Change[];
  /** Shown as a callout above the changes. */
  breaking?: { title: string; detail: string; href?: string };
}

export interface ChangelogProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  /** Newest first. */
  releases?: Release[];
  rssHref?: string;
  /** Return a message to show it as the error; return nothing on success. */
  onSubscribe?: (email: string) => string | void | Promise<string | void>;
  locale?: string;
  /**
   * The heading level of the title. `"h1"` when the changelog titles the page (the
   * default); `"h2"` under a page header that already carries the `<h1>`.
   */
  titleAs?: "h1" | "h2";
  className?: string;
}

type Filter = "all" | "major" | "minor";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All releases" },
  { value: "major", label: "Major" },
  { value: "minor", label: "Minor" },
];

const CHANGE_TYPE: Record<
  ChangeType,
  { label: string; variant: "success" | "info" | "warning"; icon: typeof Sparkles }
> = {
  new: { label: "New", variant: "success", icon: Sparkles },
  improved: { label: "Improved", variant: "info", icon: Wrench },
  fixed: { label: "Fixed", variant: "warning", icon: Bug },
};

const KIND_VARIANT: Record<ReleaseKind, "default" | "secondary" | "outline"> = {
  major: "default",
  minor: "secondary",
  patch: "outline",
};

export const RELEASES: Release[] = [
  {
    version: "4.0.0",
    kind: "major",
    date: "2026-09-16",
    title: "Control Tower, and a new exceptions model",
    summary:
      "Exceptions are now first-class objects with an owner, a due time and a resolution — not a filter on shipments.",
    breaking: {
      title: "The `status` field on shipments is now an object",
      detail:
        '`shipment.status` was a string (`"delayed"`); it is now `{ code, since, exception? }`. The v3 API keeps the string until March 2027.',
      href: "#/docs/migrations/v4",
    },
    changes: [
      {
        type: "new",
        text: "Control Tower: every open exception on one screen, grouped by what needs a decision today.",
        href: "#/docs/control-tower",
      },
      {
        type: "new",
        text: "Exception ownership — assign, hand over, and see who has had it and for how long.",
      },
      {
        type: "new",
        text: "Webhooks for `exception.opened`, `exception.assigned` and `exception.resolved`.",
        href: "#/docs/webhooks",
      },
      {
        type: "improved",
        text: "Shipment search is 6× faster on tenants with more than 200k shipments.",
      },
      {
        type: "fixed",
        text: "Customs holds raised outside office hours no longer show a stale “due today” badge.",
      },
    ],
  },
  {
    version: "3.9.0",
    kind: "minor",
    date: "2026-08-26",
    title: "ETA confidence bands in the API and the planner",
    changes: [
      {
        type: "new",
        text: "`eta.band` (p10/p90) on every shipment, and a shaded band on the planner timeline.",
        href: "#/docs/eta",
      },
      {
        type: "improved",
        text: "ETA change notifications only fire when the estimate moves by more than four hours.",
      },
      {
        type: "improved",
        text: "Carrier Connect: 22 EDI 315 dialects now parse without per-carrier rules.",
      },
      { type: "fixed", text: "Vessel names with diacritics matched the wrong AIS track." },
    ],
  },
  {
    version: "3.8.2",
    kind: "patch",
    date: "2026-08-12",
    title: "Customs Desk fixes",
    changes: [
      { type: "fixed", text: "HS code lookup returned chapter notes for 8-digit queries." },
      {
        type: "fixed",
        text: "Pre-clearance filings sent twice when the broker retried within a minute.",
      },
    ],
  },
  {
    version: "3.8.0",
    kind: "minor",
    date: "2026-07-29",
    title: "Weather closures as routing overrides",
    changes: [
      {
        type: "new",
        text: "Port notices for storm closures are read automatically and applied as hard routing overrides.",
        href: "#/docs/routing/closures",
      },
      { type: "new", text: "Bulk re-plan: pick a lane, see every affected shipment, apply once." },
      {
        type: "improved",
        text: "Planner timeline scrolls smoothly at 5,000 shipments; virtualised rows.",
      },
    ],
  },
  {
    version: "3.7.0",
    kind: "minor",
    date: "2026-07-01",
    title: "SSO and audit export",
    changes: [
      {
        type: "new",
        text: "SAML single sign-on for every plan; SCIM on Enterprise.",
        href: "#/docs/sso",
      },
      { type: "new", text: "Audit log export as CSV or to an S3-compatible bucket, nightly." },
      { type: "improved", text: "Member roles now include a read-only “Auditor”." },
      { type: "fixed", text: "Invite emails expired after one day instead of seven." },
    ],
  },
  {
    version: "3.0.0",
    kind: "major",
    date: "2026-03-10",
    title: "Customs Desk",
    summary:
      "A second product: filings, HS classification and broker hand-off, on the same shipment record.",
    breaking: {
      title: "API base path moved to `/v3`",
      detail: "`/v2` continues to work until September 2026 and returns a `Deprecation` header.",
      href: "#/docs/migrations/v3",
    },
    changes: [
      {
        type: "new",
        text: "Customs Desk: pre-clearance filings from the shipment record.",
        href: "#/docs/customs",
      },
      { type: "new", text: "HS code assistant with classification history per SKU." },
      {
        type: "improved",
        text: "Shipment record loads its documents lazily; 40% faster first paint.",
      },
    ],
  },
];

/**
 * Versioned release notes down a rail: date, version badge and title per release, changes
 * grouped by kind with a New / Improved / Fixed badge that carries an icon as well as a
 * colour, a “Breaking” callout where one applies, links to the docs, and a subscribe row.
 * The filter narrows to major or minor releases.
 */
export function Changelog({
  eyebrow = "Changelog",
  title = "What shipped",
  description = "Every release, newest first. Major versions carry a migration note.",
  releases = RELEASES,
  rssHref = "#/changelog.rss",
  onSubscribe,
  locale,
  titleAs = "h1",
  className,
}: ChangelogProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");

  const shown = useMemo(
    () => (filter === "all" ? releases : releases.filter((r) => r.kind === filter)),
    [filter, releases],
  );
  const formatDate = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }),
    [locale],
  );

  async function subscribe(event: FormEvent) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError("Enter an email address we can write to.");
    }
    setError(null);
    setState("pending");
    const message = await onSubscribe?.(email.trim());
    if (message) {
      setError(message);
      return setState("idle");
    }
    setState("done");
  }

  return (
    <section
      className={cn(
        "@container mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-16",
        className,
      )}
      data-slot="changelog"
    >
      <SectionHeader
        actions={
          <ToggleGroup
            aria-label="Show releases"
            onValueChange={(value) => value && setFilter(value as Filter)}
            size="sm"
            type="single"
            value={filter}
            variant="outline"
          >
            {FILTERS.map((item) => (
              <ToggleGroupItem key={item.value} value={item.value}>
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
        as={titleAs}
        description={description}
        eyebrow={eyebrow}
        size="lg"
        title={title}
      />

      <p aria-live="polite" className="sr-only">
        {shown.length === 1 ? "1 release" : `${shown.length} releases`} shown.
      </p>

      <ol className="flex flex-col" data-slot="changelog-rail">
        {shown.map((release) => {
          return (
            <li
              className="group/release relative grid gap-4 pb-12 ps-8 last:pb-0 @2xl:grid-cols-[10rem_1fr] @2xl:gap-8 @2xl:ps-0"
              data-slot="changelog-release"
              key={release.version}
            >
              <span
                aria-hidden="true"
                className="absolute start-[7px] top-2 h-full w-px bg-border-strong group-last/release:hidden @2xl:start-[10.5rem]"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "absolute start-0 top-1 size-4 rounded-full border-2 bg-background @2xl:start-[9.5rem]",
                  release.kind === "major" ? "border-primary bg-primary" : "border-border-strong",
                )}
              />
              <div className="flex flex-wrap items-center gap-2 @2xl:flex-col @2xl:items-start @2xl:gap-1.5 @2xl:pe-6">
                <time
                  className="text-meta text-muted-foreground tabular-nums"
                  dateTime={release.date}
                >
                  {formatDate.format(new Date(`${release.date}T00:00:00Z`))}
                </time>
                <Badge className="font-mono tabular-nums" variant={KIND_VARIANT[release.kind]}>
                  v{release.version}
                </Badge>
              </div>
              <article
                aria-labelledby={`release-${release.version}`}
                className="flex min-w-0 flex-col gap-4 @2xl:ps-6"
              >
                <div className="flex flex-col gap-1">
                  <h2
                    className="text-title font-semibold text-balance"
                    id={`release-${release.version}`}
                  >
                    {release.title}
                  </h2>
                  {release.summary ? (
                    <p className="text-body text-muted-foreground text-pretty">{release.summary}</p>
                  ) : null}
                </div>
                {release.breaking ? (
                  <Alert role="note" variant="warning">
                    <TriangleAlert aria-hidden="true" />
                    <AlertTitle as="h3">Breaking: {release.breaking.title}</AlertTitle>
                    <AlertDescription>
                      {release.breaking.detail}
                      {release.breaking.href ? (
                        <>
                          {" "}
                          <a
                            className="inline-flex items-center gap-0.5 font-medium text-link underline underline-offset-4 hover:no-underline focus-ring"
                            href={release.breaking.href}
                          >
                            Migration guide
                            <ArrowUpRight aria-hidden="true" className="size-3" />
                          </a>
                        </>
                      ) : null}
                    </AlertDescription>
                  </Alert>
                ) : null}
                <ul className="flex flex-col gap-2.5">
                  {release.changes.map((change) => {
                    const meta = CHANGE_TYPE[change.type];
                    const Icon = meta.icon;
                    return (
                      <li className="flex items-start gap-3" key={change.text}>
                        <Badge
                          appearance="tint"
                          className="mt-0.5 w-24 shrink-0 justify-center"
                          variant={meta.variant}
                        >
                          <Icon aria-hidden="true" className="size-3" />
                          {meta.label}
                        </Badge>
                        <span className="min-w-0 text-body text-pretty">
                          {change.text}
                          {change.href ? (
                            <>
                              {" "}
                              <a
                                className="inline-flex items-center gap-0.5 whitespace-nowrap font-medium text-link underline underline-offset-4 hover:no-underline focus-ring"
                                href={change.href}
                              >
                                Docs
                                <ArrowUpRight aria-hidden="true" className="size-3" />
                              </a>
                            </>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            </li>
          );
        })}
      </ol>

      <div
        className="grid items-center gap-6 rounded-lg border bg-card p-6 @2xl:grid-cols-2 @2xl:p-8"
        data-slot="changelog-subscribe"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-title font-semibold">Get the next release in your inbox</h2>
          <p className="text-body text-muted-foreground text-pretty">
            One email per release, never more. Or follow the{" "}
            <a
              className="inline-flex items-center gap-1 font-medium text-link underline underline-offset-4 hover:no-underline focus-ring"
              href={rssHref}
            >
              <Rss aria-hidden="true" className="size-3.5" />
              RSS feed
            </a>
            .
          </p>
        </div>
        {state === "done" ? (
          <p aria-live="polite" className="flex items-center gap-3 text-body">
            <CircleCheck aria-hidden="true" className="size-6 shrink-0 text-success-text" />
            <span>
              Subscribed. Release notes go to <strong>{email.trim()}</strong>.
            </span>
          </p>
        ) : (
          <form className="flex flex-col gap-3" noValidate onSubmit={subscribe}>
            <FieldRoot invalid={error !== null}>
              <FieldLabel>Email</FieldLabel>
              <div className="flex flex-col gap-2 @md:flex-row">
                <FieldControl>
                  <Input
                    autoComplete="email"
                    inputMode="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    type="email"
                    value={email}
                  />
                </FieldControl>
                <Button disabled={state === "pending"} type="submit">
                  {state === "pending" ? "Subscribing…" : "Subscribe"}
                </Button>
              </div>
              {error ? <FieldError>{error}</FieldError> : null}
            </FieldRoot>
          </form>
        )}
      </div>
    </section>
  );
}
