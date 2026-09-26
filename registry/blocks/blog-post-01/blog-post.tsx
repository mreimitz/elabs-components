"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  AspectRatio,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  cn,
  FieldControl,
  FieldError,
  FieldLabel,
  FieldRoot,
  Heading,
  IconButton,
  Image,
  Input,
  ProseBlockquote,
  ProseHeading,
  ProseList,
  ProseListItem,
  ProseText,
  TableOfContents,
  Text,
} from "@elabs-ai/components-ui";
import { posterArt } from "@/components/media-parts/media-fixtures";
import { CircleCheck, Clock, Link2, Mail, Share2 } from "lucide-react";

export interface BlogPostAuthor {
  name: string;
  role: string;
}

export interface BlogPostSection {
  id: string;
  heading: string;
  /** Prose in order: paragraphs, one pull quote, a list, a code block, a figure. */
  blocks: BlogPostBlock[];
}

export type BlogPostBlock =
  | { kind: "paragraph"; text: ReactNode }
  | { kind: "quote"; text: string; cite: string }
  | { kind: "list"; items: string[] }
  | { kind: "code"; code: string; caption?: string }
  | { kind: "figure"; src: string; alt: string; caption: string };

export interface RelatedPost {
  id: string;
  title: string;
  tag: string;
  readMinutes: number;
  href: string;
}

export interface BlogPostData {
  tag: string;
  title: string;
  lead: string;
  author: BlogPostAuthor;
  /** ISO date (`YYYY-MM-DD`). */
  date: string;
  readMinutes: number;
  sections: BlogPostSection[];
  related: RelatedPost[];
}

export interface BlogPostProps {
  post?: BlogPostData;
  /**
   * Pin the table of contents to one section. Leave it unset and the list follows the
   * reader’s scroll position.
   */
  currentSection?: string;
  /** Called with the share channel; the block does not open anything itself. */
  onShare?: (channel: "link" | "email" | "social") => void;
  /** Return a message to show it as the error; return nothing on success. */
  onSubscribe?: (email: string) => string | void | Promise<string | void>;
  locale?: string;
  className?: string;
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

export const POST: BlogPostData = {
  tag: "Engineering",
  title: "Why our ETAs got 40% tighter in a quarter",
  lead: "We replaced a carrier-reported arrival time with a model that watches vessel AIS, port dwell and the last 90 days of the same lane. Here is what moved the needle — and what did not.",
  author: { name: "Jonas Lindqvist", role: "Staff Engineer, Routing" },
  date: "2026-09-18",
  readMinutes: 9,
  sections: [
    {
      id: "the-problem",
      heading: "The problem with the carrier’s ETA",
      blocks: [
        {
          kind: "paragraph",
          text: "Every ocean carrier sends an estimated arrival with the booking. It is updated, on average, 1.8 times over a 30-day voyage. The second update usually lands after the vessel has already anchored outside the port. For a planner deciding when to book a truck, that number is worse than no number: it looks precise and it is stale.",
        },
        {
          kind: "paragraph",
          text: "In Q2 we measured the carrier ETA against actual gate-out at 41 terminals. The median absolute error was 2.6 days. On the Shanghai–Rotterdam lane it was 3.9.",
        },
        {
          kind: "quote",
          text: "A truck booked two days early costs a demurrage day. A truck booked two days late costs a customer.",
          cite: "Ingrid Solberg, COO at Northwind Retail",
        },
      ],
    },
    {
      id: "what-we-built",
      heading: "What we built instead",
      blocks: [
        {
          kind: "paragraph",
          text: "The model takes three inputs the carrier does not: the vessel’s live AIS position and speed, the terminal’s dwell time over the last two weeks, and how the same lane has behaved over the last 90 days. It re-estimates every hour and only tells the planner when the estimate moves by more than four hours.",
        },
        {
          kind: "list",
          items: [
            "AIS position, speed over ground and heading, ingested every six minutes.",
            "Terminal dwell: discharge-to-gate-out, rolling 14-day median per terminal.",
            "Lane history: the last 90 days of the same origin, destination and carrier.",
            "Weather closures from port notices, as a hard override.",
          ],
        },
        {
          kind: "code",
          caption: "The estimate is a plain object; the confidence band is part of the contract.",
          code: `{
  "shipment": "HBL-2291-044",
  "eta": "2026-09-24T06:00:00Z",
  "band": { "p10": "2026-09-23T19:00:00Z", "p90": "2026-09-24T16:00:00Z" },
  "drivers": ["dwell:rtm", "ais:speed", "lane:90d"],
  "confidence": 0.82
}`,
        },
      ],
    },
    {
      id: "results",
      heading: "What the numbers did",
      blocks: [
        {
          kind: "paragraph",
          text: "Across the network the median absolute error fell from 2.6 days to 1.5 — a 42% improvement. On the lanes with the most AIS coverage it is under a day. The result that mattered more: planners stopped overriding the ETA. Overrides went from 31% of shipments to 6%.",
        },
        {
          kind: "figure",
          src: posterArt("bars", "eta-error-by-lane", { width: 1200, height: 600 }),
          alt: "Bar chart: median ETA error per lane before and after the model, all lanes lower after.",
          caption:
            "Median absolute ETA error by lane, Q2 versus Q3. Every lane improved; Shanghai–Rotterdam the most.",
        },
        {
          kind: "paragraph",
          text: "What did not work: weather forecasts. Adding a marine forecast feed made the estimate noisier, not tighter, because vessels slow down before storms in ways the forecast does not predict. We took it out and kept only hard port closures.",
        },
      ],
    },
    {
      id: "whats-next",
      heading: "What’s next",
      blocks: [
        {
          kind: "paragraph",
          text: "Rail and inland legs. The ocean leg is now the most predictable part of the journey, which means the last 200 kilometres are where the error lives. Same approach: watch the asset, learn the lane, tell the planner only when it matters.",
        },
      ],
    },
  ],
  related: [
    {
      id: "ais-gaps",
      title: "AIS goes dark more than you think",
      tag: "Engineering",
      readMinutes: 10,
      href: "#/blog/ais-gaps",
    },
    {
      id: "dwell-time-benchmarks",
      title: "Port dwell time, benchmarked across 41 terminals",
      tag: "Data",
      readMinutes: 7,
      href: "#/blog/dwell-time-benchmarks",
    },
    {
      id: "on-time-definition",
      title: "What “on time” should actually mean",
      tag: "Data",
      readMinutes: 6,
      href: "#/blog/on-time-definition",
    },
  ],
};

/**
 * An article page: header with tag, title, lead, author and share buttons; a sticky
 * table of contents that marks the current section; the body as real prose — headings,
 * paragraphs, a pull quote, a list, a code block and a figure; related posts and a
 * newsletter foot that validates.
 */
export function BlogPost({
  post = POST,
  currentSection,
  onShare,
  onSubscribe,
  locale,
  className,
}: BlogPostProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [copied, setCopied] = useState(false);

  const date = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${post.date}T00:00:00Z`));

  const share = (channel: "link" | "email" | "social") => {
    if (channel === "link") setCopied(true);
    onShare?.(channel);
  };

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
    <article
      className={cn(
        "@container mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-12",
        className,
      )}
      data-slot="blog-post"
    >
      <header className="flex max-w-4xl flex-col gap-5" data-slot="blog-post-header">
        <div className="flex flex-wrap items-center gap-2">
          <Text as="span" tone="primary" variant="eyebrow">
            Blog
          </Text>
          <span aria-hidden="true" className="text-muted-foreground">
            ·
          </span>
          <Badge variant="outline">{post.tag}</Badge>
        </div>
        <Heading level={1} size="display">
          {post.title}
        </Heading>
        <Text className="max-w-prose text-pretty" tone="muted" variant="lead">
          {post.lead}
        </Text>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback>{initials(post.author.name)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-body font-medium">{post.author.name}</span>
              <span className="flex flex-wrap items-center gap-x-1.5 text-meta text-muted-foreground">
                <span>{post.author.role}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={post.date}>{date}</time>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1 tabular-nums">
                  <Clock aria-hidden="true" className="size-3" />
                  {post.readMinutes} min read
                </span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1" data-slot="blog-post-share">
            <span className="me-1 text-meta text-muted-foreground">Share</span>
            <IconButton
              icon={<Link2 />}
              label={copied ? "Link copied" : "Copy link"}
              onClick={() => share("link")}
              size="icon-sm"
              variant="ghost"
            />
            <IconButton
              icon={<Mail />}
              label="Share by email"
              onClick={() => share("email")}
              size="icon-sm"
              variant="ghost"
            />
            <IconButton
              icon={<Share2 />}
              label="Share to your network"
              onClick={() => share("social")}
              size="icon-sm"
              variant="ghost"
            />
            <span aria-live="polite" className="sr-only">
              {copied ? "Link copied to the clipboard." : ""}
            </span>
          </div>
        </div>
      </header>

      <div className="grid gap-10 @3xl:grid-cols-4 @3xl:gap-14">
        <TableOfContents
          activeId={currentSection}
          className="@3xl:sticky @3xl:top-[calc(var(--spacing)*var(--header-size)+1.5rem)] @3xl:order-2 @3xl:col-span-1 @3xl:self-start"
          items={post.sections.map((section) => ({ id: section.id, label: section.heading }))}
          offset={96}
        />

        <div
          className="flex min-w-0 max-w-prose flex-col gap-10 @3xl:order-1 @3xl:col-span-3"
          data-slot="blog-post-body"
        >
          {post.sections.map((section) => (
            <section
              aria-labelledby={`${section.id}-title`}
              className="flex flex-col gap-4 scroll-mt-[calc(var(--spacing)*var(--header-size)+1.5rem)]"
              id={section.id}
              key={section.id}
            >
              <ProseHeading id={`${section.id}-title`} level={2}>
                {section.heading}
              </ProseHeading>
              {section.blocks.map((block) => (
                <Block block={block} key={blockKey(block)} />
              ))}
            </section>
          ))}
        </div>
      </div>

      <section
        aria-labelledby="blog-post-related"
        className="flex flex-col gap-5 border-t pt-10"
        data-slot="blog-post-related"
      >
        <Heading id="blog-post-related" level={2}>
          Keep reading
        </Heading>
        <ul className="grid gap-4 @xl:grid-cols-3">
          {post.related.map((item) => (
            <li className="min-w-0" key={item.id}>
              <a
                className="group/related flex h-full flex-col gap-2 rounded-lg border bg-card p-5 shadow-xs focus-ring"
                href={item.href}
              >
                <Badge className="self-start" variant="outline">
                  {item.tag}
                </Badge>
                <span className="text-subtitle font-semibold text-balance group-hover/related:underline">
                  {item.title}
                </span>
                <span className="mt-auto flex items-center gap-1 text-meta text-muted-foreground tabular-nums">
                  <Clock aria-hidden="true" className="size-3" />
                  {item.readMinutes} min read
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="blog-post-newsletter"
        className="bg-hairline-hatch grid items-center gap-6 rounded-lg border bg-card p-6 @3xl:grid-cols-2 @3xl:p-8"
        data-slot="blog-post-newsletter"
      >
        <div className="flex flex-col gap-1">
          <Heading id="blog-post-newsletter" level={2}>
            One email a month
          </Heading>
          <Text className="max-w-prose text-pretty" tone="muted">
            What shipped, what we learned from a customer, and one number worth knowing.
          </Text>
        </div>
        {state === "done" ? (
          <p aria-live="polite" className="flex items-center gap-3 text-body">
            <CircleCheck aria-hidden="true" className="size-6 shrink-0 text-success-text" />
            <span>
              You are on the list. The next issue goes to <strong>{email.trim()}</strong>.
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
      </section>
    </article>
  );
}

/** Blocks carry no id; their content is the identity (a static article never reorders). */
function blockKey(block: BlogPostBlock): string {
  switch (block.kind) {
    case "paragraph":
      return `p:${String(block.text).slice(0, 80)}`;
    case "quote":
      return `q:${block.text}`;
    case "list":
      return `l:${block.items[0] ?? ""}`;
    case "code":
      return `c:${block.code.slice(0, 80)}`;
    case "figure":
      return `f:${block.alt}`;
  }
}

function Block({ block }: { block: BlogPostBlock }) {
  switch (block.kind) {
    case "paragraph":
      return (
        <ProseText className="text-pretty" variant="lead">
          {block.text}
        </ProseText>
      );
    case "quote":
      return (
        <ProseBlockquote
          className="my-2 border-s-primary py-1 ps-5 text-foreground not-italic"
          data-slot="blog-post-quote"
        >
          <p className="font-display text-subtitle text-balance">“{block.text}”</p>
          <footer className="mt-2 text-meta text-muted-foreground">— {block.cite}</footer>
        </ProseBlockquote>
      );
    case "list":
      return (
        <ProseList className="text-pretty">
          {block.items.map((item) => (
            <ProseListItem key={item}>{item}</ProseListItem>
          ))}
        </ProseList>
      );
    case "code":
      return (
        <figure className="flex flex-col gap-2" data-slot="blog-post-code">
          <pre className="overflow-x-auto rounded-lg border bg-surface-muted p-4 text-code text-foreground">
            <code>{block.code}</code>
          </pre>
          {block.caption ? (
            <figcaption className="text-meta text-muted-foreground">{block.caption}</figcaption>
          ) : null}
        </figure>
      );
    case "figure":
      return (
        <figure className="flex flex-col gap-2" data-slot="blog-post-figure">
          <AspectRatio className="overflow-hidden rounded-lg border bg-muted" ratio={2}>
            <Image
              alt={block.alt}
              className="size-full"
              fit="cover"
              showSkeleton={false}
              src={block.src}
            />
          </AspectRatio>
          <figcaption className="text-meta text-muted-foreground">{block.caption}</figcaption>
        </figure>
      );
  }
}
