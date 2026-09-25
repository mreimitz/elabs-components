"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  cn,
  IconButton,
  Rating,
  SectionHeader,
} from "@elabs-ai/components-ui";

export interface SpotlightTestimonial {
  id: string;
  quote: string;
  name: string;
  role: string;
  /** The customer’s company; shown as a text wordmark under the quote and in the strip. */
  company: string;
  /** Stars out of five, when the quote came with a rating. */
  rating?: number;
  /** One number the quote is about, e.g. "31 h → 19 h". */
  result?: { value: string; label: string };
}

export interface MarketingTestimonialSpotlightProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  testimonials?: SpotlightTestimonial[];
  /** Which quote opens first. */
  defaultIndex?: number;
}

const DEFAULT_TESTIMONIALS: SpotlightTestimonial[] = [
  {
    id: "northwind",
    quote:
      "The team stopped asking where a shipment is and started asking what to do about it. That is the whole change, and it happened in a quarter.",
    name: "Ingrid Solberg",
    role: "Chief Operating Officer",
    company: "Northwind Retail",
    rating: 5,
    result: { value: "96.4%", label: "delivered on time, up from 90.1%" },
  },
  {
    id: "halden",
    quote:
      "Clearance went from 31 hours to 19 in the first month. Nothing else we changed that year came close, and the audit was the easiest we have had.",
    name: "Dr. Marta Lind",
    role: "Head of Supply",
    company: "Halden Pharma",
    rating: 5,
    result: { value: "19 h", label: "median customs clearance" },
  },
  {
    id: "pelican",
    quote:
      "Our drivers chose to keep using the app after the pilot. In eleven years of rolling out software that has never happened.",
    name: "Sven Aalto",
    role: "Fleet Manager",
    company: "Pelican Lines",
    rating: 4.5,
    result: { value: "312", label: "drivers on the app by choice" },
  },
  {
    id: "kestrel",
    quote:
      "When a vessel slipped, we knew before the customer did, with the fix already proposed. We used to find out from an angry email.",
    name: "Tomas Pereira",
    role: "Head of Logistics",
    company: "Kestrel Foods",
    rating: 5,
    result: { value: "4 h", label: "earlier warning on every slipped vessel" },
  },
  {
    id: "bluewater",
    quote:
      "Set up on a Tuesday, planning live routes by Friday. The spreadsheet retired the week after.",
    name: "Aiko Mori",
    role: "Operations Lead",
    company: "Bluewater Marine",
    rating: 5,
    result: { value: "3 days", label: "from sign-up to live routes" },
  },
];

const initials = (name: string) =>
  name
    .replace(/^Dr\.\s/, "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

/**
 * One customer at a time, at full size — the quote, who said it, the company wordmark and
 * the number it is about. Previous, next and the dots move between quotes; the strip of the
 * other wordmarks jumps straight to theirs. Nothing advances on its own; the quote region
 * is announced politely when it changes.
 */
export function MarketingTestimonialSpotlight({
  eyebrow = "Customers",
  title = "In their words",
  testimonials = DEFAULT_TESTIMONIALS,
  defaultIndex = 0,
}: MarketingTestimonialSpotlightProps) {
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(defaultIndex, 0), Math.max(testimonials.length - 1, 0)),
  );
  const headingId = useId();
  const count = testimonials.length;
  const current = testimonials[index];
  const go = (next: number) => setIndex(((next % count) + count) % count);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      go(0);
    } else if (event.key === "End") {
      event.preventDefault();
      go(count - 1);
    }
  };

  if (!current) return null;

  return (
    <section
      className="@container mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-16"
      data-slot="marketing-testimonial-spotlight"
    >
      <SectionHeader as="h2" eyebrow={eyebrow} title={title} />

      <div
        aria-labelledby={headingId}
        aria-roledescription="carousel"
        className="grid grid-cols-1 gap-8 @3xl:grid-cols-[1fr_auto] @3xl:items-start"
        onKeyDown={onKeyDown}
        role="group"
      >
        <h3 className="sr-only" id={headingId}>
          Customer quotes
        </h3>
        <figure
          aria-atomic="true"
          aria-live="polite"
          className="flex min-w-0 flex-col gap-6"
          data-slot="marketing-testimonial-spotlight-quote"
        >
          <Quote aria-hidden="true" className="size-8 text-primary" />
          <blockquote className="text-title font-medium text-balance @2xl:text-display">
            “{current.quote}”
          </blockquote>
          <figcaption className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <span className="flex items-center gap-3">
              <Avatar className="size-12">
                <AvatarFallback className="text-body">{initials(current.name)}</AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-col">
                <cite className="truncate text-body font-semibold not-italic">{current.name}</cite>
                <span className="truncate text-meta text-muted-foreground">{current.role}</span>
              </span>
            </span>
            <span className="text-subtitle font-semibold tracking-tight">{current.company}</span>
            {current.rating ? (
              <Rating
                allowHalf
                aria-label={`${current.rating} out of 5`}
                readOnly
                value={current.rating}
              />
            ) : null}
            <span className="sr-only">
              Quote {index + 1} of {count}.
            </span>
          </figcaption>
        </figure>

        <div
          className="flex flex-col gap-4 @3xl:w-64"
          data-slot="marketing-testimonial-spotlight-controls"
        >
          {current.result ? (
            <p className="flex flex-col gap-1 rounded-lg bg-surface-muted p-5">
              <span className="text-kpi font-semibold tabular-nums">{current.result.value}</span>
              <span className="text-meta text-muted-foreground">{current.result.label}</span>
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <IconButton
              icon={<ChevronLeft />}
              label="Previous quote"
              onClick={() => go(index - 1)}
              variant="outline"
            />
            <ul aria-label="Quotes" className="flex items-center gap-2" role="list">
              {testimonials.map((item, i) => (
                <li key={item.id}>
                  <button
                    aria-current={i === index ? "true" : undefined}
                    aria-label={`Quote ${i + 1} of ${count}, ${item.company}`}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full focus-ring",
                      "before:size-2 before:rounded-full before:bg-border-strong before:transition-colors before:duration-fast",
                      "hover:before:bg-muted-foreground",
                      i === index && "before:size-2.5 before:bg-primary hover:before:bg-primary",
                    )}
                    onClick={() => go(i)}
                    type="button"
                  />
                </li>
              ))}
            </ul>
            <IconButton
              icon={<ChevronRight />}
              label="Next quote"
              onClick={() => go(index + 1)}
              variant="outline"
            />
          </div>
        </div>
      </div>

      <ul
        aria-label="More customers"
        className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-border-strong pt-8"
        data-slot="marketing-testimonial-spotlight-strip"
      >
        {testimonials.map((item, i) => (
          <li key={item.id}>
            <button
              aria-current={i === index ? "true" : undefined}
              aria-label={`Read what ${item.company} said`}
              className={cn(
                "rounded-sm text-subtitle font-semibold tracking-tight transition-colors duration-fast focus-ring",
                i === index
                  ? "text-foreground underline decoration-primary decoration-2 underline-offset-8"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => go(i)}
              type="button"
            >
              {item.company}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
