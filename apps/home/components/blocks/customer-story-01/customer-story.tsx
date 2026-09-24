// registry: customer-story-01 — copied 2026-09-24
"use client";

import { useCallback, useState, type KeyboardEvent } from "react";
import {
  AspectRatio,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  Descriptions,
  DescriptionsItem,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Heading,
  IconButton,
  Image,
  MetricCard,
  SectionHeader,
  Separator,
  Text,
  Video,
  formatMediaTime,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Maximize2,
  Play,
} from "lucide-react";
import { STORY, type CustomerStory as CustomerStoryData, type StoryQuote } from "./data/story";

export interface CustomerStoryProps {
  /** The story to tell. Defaults to the sample. */
  story?: CustomerStoryData;
  /** Which section the screenshot gallery follows. Default: the second-to-last. */
  screenshotsAfter?: string;
  className?: string;
}

const initials = (name: string) =>
  name
    .replace(/^Dr\.\s/, "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

/**
 * A customer story as a reading page: the headline and lead, the customer's
 * film in the ui `Video` player (poster, captions, docked controls), the
 * results as metric tiles, then the numbered narrative beside a sticky fact
 * sheet. Pull quotes sit inside the narrative; a screenshot gallery opens each
 * screen in a lightbox with previous/next and arrow keys; related stories and
 * a call to action close the page.
 */
export function CustomerStory({ story = STORY, screenshotsAfter, className }: CustomerStoryProps) {
  const [shot, setShot] = useState<number | null>(null);
  const shots = story.screenshots;
  const galleryAfter =
    screenshotsAfter ?? story.sections[Math.max(0, story.sections.length - 2)]?.id;

  const step = useCallback(
    (delta: number) =>
      setShot((current) =>
        current === null ? current : Math.min(shots.length - 1, Math.max(0, current + delta)),
      ),
    [shots.length],
  );
  const onLightboxKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    }
  };
  const active = shot === null ? null : shots[shot];

  return (
    <article
      data-slot="customer-story"
      className={cn(
        "mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-12 lg:gap-16",
        className,
      )}
    >
      {/* Headline */}
      <header data-slot="customer-story-header" className="flex max-w-4xl flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Text as="span" variant="eyebrow" tone="primary">
            Customer story
          </Text>
          <span aria-hidden="true" className="text-muted-foreground">
            ·
          </span>
          <Badge variant="outline">{story.industry}</Badge>
        </div>
        <Heading level={1} size="display">
          {story.title}
        </Heading>
        <Text variant="lead" tone="muted" className="max-w-prose text-pretty">
          {story.lead}
        </Text>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-meta text-muted-foreground">
          <span className="flex items-center gap-2">
            <Avatar className="size-7">
              <AvatarFallback className="text-caption">{initials(story.customer)}</AvatarFallback>
            </Avatar>
            <span className="font-medium text-foreground">{story.customer}</span>
          </span>
          <span>{story.published}</span>
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden="true" />
            {story.readMinutes} min read
          </span>
        </div>
      </header>

      {/* The film */}
      <figure data-slot="customer-story-film" className="flex flex-col gap-3">
        <div className="hairline-corners">
          <Video
            src={story.video.src}
            poster={story.video.poster}
            // The sample file is sound standing in for a film; a real film needs no `kind`.
            kind="video"
            aspectRatio={16 / 9}
            preload="metadata"
            label={`Film: ${story.title}`}
            tracks={
              story.video.captions
                ? [{ src: story.video.captions, kind: "captions", srclang: "en", label: "English" }]
                : []
            }
          />
        </div>
        <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Play className="size-3.5 fill-current" aria-hidden="true" />
            Watch
          </span>
          <span className="text-pretty">{story.video.caption}</span>
          <span className="tabular-nums">{formatMediaTime(story.video.seconds)}</span>
        </figcaption>
      </figure>

      {/* Results */}
      <section data-slot="customer-story-results" aria-labelledby="customer-story-results">
        <h2 id="customer-story-results" className="sr-only">
          Results
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {story.results.map((result) => (
            <li key={result.label} className="min-w-0">
              <MetricCard
                label={result.label}
                value={result.value}
                description={result.description}
                delta={result.delta}
                deltaDirection={result.deltaDirection}
                positiveIsGood={result.positiveIsGood}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* Narrative beside the fact sheet */}
      <div className="grid gap-12 lg:grid-cols-3 lg:gap-16">
        <div
          data-slot="customer-story-narrative"
          className="flex min-w-0 flex-col gap-12 lg:col-span-2"
        >
          {story.sections.map((section) => (
            <div key={section.id} className="contents">
              <section
                id={`story-${section.id}`}
                aria-labelledby={`story-${section.id}-title`}
                className="flex flex-col gap-4"
              >
                <div className="flex items-baseline gap-3">
                  <Text as="span" variant="eyebrow" tone="primary" className="tabular-nums">
                    {section.number}
                  </Text>
                  <Heading id={`story-${section.id}-title`} level={2}>
                    {section.title}
                  </Heading>
                </div>
                {section.paragraphs.map((paragraph) => (
                  <Text key={paragraph} variant="lead" className="max-w-prose text-pretty">
                    {paragraph}
                  </Text>
                ))}
                {section.quote ? <PullQuote quote={section.quote} /> : null}
              </section>
              {section.id === galleryAfter && shots.length > 0 ? (
                <section
                  data-slot="customer-story-screens"
                  aria-labelledby="customer-story-screens"
                  className="flex flex-col gap-5"
                >
                  <SectionHeader
                    as="h2"
                    eyebrow="Inside the rollout"
                    title={
                      <span id="customer-story-screens">The screens the desk uses every day</span>
                    }
                    description={`${shots.length} screens · select one to see it larger.`}
                  />
                  <ul className="grid gap-4 sm:grid-cols-2">
                    {shots.map((screenshot, i) => (
                      <li key={screenshot.id} className={cn("min-w-0", i === 0 && "sm:col-span-2")}>
                        <button
                          type="button"
                          onClick={() => setShot(i)}
                          aria-label={`Open screen ${i + 1} of ${shots.length}: ${screenshot.alt}`}
                          className="group/shot flex w-full flex-col gap-2 rounded-lg text-start focus-ring"
                        >
                          <AspectRatio
                            ratio={16 / 10}
                            className="overflow-hidden rounded-lg border bg-muted shadow-xs"
                          >
                            <Image
                              src={screenshot.src}
                              alt=""
                              fit="cover"
                              showSkeleton={false}
                              loading="lazy"
                              className="size-full transition-transform duration-base ease-standard group-hover/shot:scale-[1.02] motion-reduce:transition-none"
                            />
                            <span
                              aria-hidden="true"
                              className="absolute end-2 top-2 flex size-8 items-center justify-center rounded-md bg-background/80 text-foreground opacity-0 shadow-xs backdrop-blur transition-opacity duration-base ease-standard group-hover/shot:opacity-100 group-focus-visible/shot:opacity-100"
                            >
                              <Maximize2 className="size-4" />
                            </span>
                          </AspectRatio>
                          <span className="line-clamp-2 px-0.5 text-meta text-muted-foreground">
                            {screenshot.caption}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ))}
        </div>

        <aside data-slot="customer-story-facts" className="lg:col-span-1">
          <div className="flex flex-col gap-4 lg:sticky lg:top-6">
            <Card>
              <CardContent className="flex flex-col gap-5 p-5">
                <div className="flex items-center justify-between gap-3">
                  <Heading level={2} size="subtitle">
                    Fact sheet
                  </Heading>
                  <Avatar className="size-8">
                    <AvatarFallback className="text-caption">
                      {initials(story.customer)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <hr className="hairline-rule" />
                <Descriptions layout="vertical" columns={2} className="gap-y-4">
                  {story.facts.map((fact) => (
                    <DescriptionsItem
                      key={fact.label}
                      label={fact.label}
                      numeric={fact.numeric}
                      className={cn(Array.isArray(fact.value) && "col-span-full")}
                    >
                      {Array.isArray(fact.value) ? (
                        <span className="flex flex-wrap gap-1.5 pt-0.5">
                          {fact.value.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        <span className="font-medium">{fact.value}</span>
                      )}
                    </DescriptionsItem>
                  ))}
                </Descriptions>
                <Separator />
                <div className="flex flex-col gap-2">
                  <Button className="w-full">
                    {story.cta.primary}
                    <ArrowRight aria-hidden="true" />
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Download aria-hidden="true" />
                    {story.cta.secondary}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>

      {/* Related stories */}
      <section
        data-slot="customer-story-related"
        aria-labelledby="customer-story-related"
        className="flex flex-col gap-6"
      >
        <SectionHeader
          as="h2"
          eyebrow="More stories"
          title={<span id="customer-story-related">Other teams on the same path</span>}
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {story.related.map((related) => (
            <li key={related.id} className="min-w-0">
              <a
                href={related.href}
                className="group/related flex h-full flex-col gap-3 rounded-lg focus-ring"
              >
                <AspectRatio
                  ratio={16 / 9}
                  className="overflow-hidden rounded-lg border bg-muted shadow-xs"
                >
                  <Image
                    src={related.poster}
                    alt=""
                    fit="cover"
                    showSkeleton={false}
                    loading="lazy"
                    className="size-full transition-transform duration-base ease-standard group-hover/related:scale-[1.03] motion-reduce:transition-none"
                  />
                </AspectRatio>
                <span className="flex flex-col gap-1 px-0.5">
                  <span className="text-meta text-muted-foreground">
                    {related.customer} · {related.industry}
                  </span>
                  <span className="line-clamp-2 text-body font-medium text-foreground text-pretty group-hover/related:underline">
                    {related.title}
                  </span>
                  <span className="text-meta text-muted-foreground">
                    {related.readMinutes} min read
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Call to action */}
      <section
        data-slot="customer-story-cta"
        aria-labelledby="customer-story-cta"
        className="bg-hairline-hatch flex flex-col items-start gap-5 rounded-lg border bg-card p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
      >
        <div className="flex flex-col gap-1">
          <Heading id="customer-story-cta" level={2}>
            {story.cta.title}
          </Heading>
          <Text tone="muted" className="max-w-prose text-pretty">
            {story.cta.description}
          </Text>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="lg">
            {story.cta.primary}
            <ArrowRight aria-hidden="true" />
          </Button>
          <Button size="lg" variant="outline">
            <Download aria-hidden="true" />
            PDF
          </Button>
        </div>
      </section>

      {/* Lightbox */}
      <Dialog open={active !== null} onOpenChange={(open) => !open && setShot(null)}>
        {active && shot !== null ? (
          <DialogContent size="xl" className="max-w-5xl" onKeyDown={onLightboxKey}>
            <DialogHeader>
              <DialogTitle>
                Screen {shot + 1} of {shots.length}
              </DialogTitle>
              <DialogDescription>{active.caption}</DialogDescription>
            </DialogHeader>
            <AspectRatio ratio={16 / 10} className="overflow-hidden rounded-lg border bg-muted">
              {/* `key` swaps the image without a stale frame showing through. */}
              <Image
                key={active.id}
                src={active.src}
                alt={active.alt}
                fit="contain"
                showSkeleton={false}
                className="size-full"
              />
            </AspectRatio>
            <div className="flex items-center justify-between gap-3">
              <p className="text-meta text-muted-foreground">
                Use ← and → to move between screens.
              </p>
              <div className="flex items-center gap-2">
                <IconButton
                  variant="outline"
                  size="icon-sm"
                  label="Previous screen"
                  icon={<ChevronLeft />}
                  disabled={shot <= 0}
                  onClick={() => step(-1)}
                />
                <span className="text-meta tabular-nums text-muted-foreground">
                  {shot + 1} / {shots.length}
                </span>
                <IconButton
                  variant="outline"
                  size="icon-sm"
                  label="Next screen"
                  icon={<ChevronRight />}
                  disabled={shot >= shots.length - 1}
                  onClick={() => step(1)}
                />
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </article>
  );
}

function PullQuote({ quote }: { quote: StoryQuote }) {
  return (
    <blockquote
      data-slot="customer-story-quote"
      className="my-2 flex flex-col gap-4 border-s-2 border-s-primary ps-5 py-1"
    >
      <p className="font-display text-subtitle text-balance text-foreground">“{quote.text}”</p>
      <footer className="flex items-center gap-3">
        <Avatar className="size-8">
          <AvatarFallback className="text-caption">{initials(quote.name)}</AvatarFallback>
        </Avatar>
        <span className="flex min-w-0 flex-col">
          <cite className="truncate text-body font-medium not-italic">{quote.name}</cite>
          <span className="truncate text-meta text-muted-foreground">{quote.role}</span>
        </span>
      </footer>
    </blockquote>
  );
}
