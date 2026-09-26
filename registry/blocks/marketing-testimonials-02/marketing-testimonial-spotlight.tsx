"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Quote } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  cn,
  MetricCard,
  Rating,
  SectionHeader,
  type CarouselApi,
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

/**
 * One customer at a time, at full size — the quote, who said it, the company wordmark and
 * the number it is about — on a `Carousel`: previous/next, the dots and arrow keys move
 * between quotes; the strip of the other wordmarks jumps straight to theirs. Nothing
 * advances on its own; the quote region is announced politely when it changes.
 */
export function MarketingTestimonialSpotlight({
  eyebrow = "Customers",
  title = "In their words",
  testimonials = DEFAULT_TESTIMONIALS,
  defaultIndex = 0,
}: MarketingTestimonialSpotlightProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(defaultIndex, 0), Math.max(testimonials.length - 1, 0)),
  );
  const count = testimonials.length;

  useEffect(() => {
    if (!api) return;
    const sync = () => setIndex(api.selectedScrollSnap());
    sync();
    api.on("select", sync);
    api.on("reInit", sync);
    return () => {
      api.off("select", sync);
      api.off("reInit", sync);
    };
  }, [api]);

  if (count === 0) return null;

  return (
    <section
      className="@container mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-16"
      data-slot="marketing-testimonial-spotlight"
    >
      <SectionHeader as="h2" eyebrow={eyebrow} title={title} />

      <Carousel
        aria-label="Customer quotes"
        className="grid grid-cols-1 gap-8 @3xl:grid-cols-[1fr_auto] @3xl:items-start"
        opts={{ loop: true, startIndex: index }}
        setApi={setApi}
      >
        <CarouselContent aria-live="polite" className="items-start">
          {testimonials.map((item, i) => (
            <CarouselItem
              aria-label={`Quote ${i + 1} of ${count}, ${item.company}`}
              data-slot="marketing-testimonial-spotlight-quote"
              key={item.id}
            >
              <figure className="flex min-w-0 flex-col gap-6">
                <Quote aria-hidden="true" className="size-8 text-primary" />
                <blockquote className="text-title font-medium text-balance @2xl:text-display">
                  “{item.quote}”
                </blockquote>
                <figcaption className="flex flex-wrap items-center gap-x-6 gap-y-4">
                  <span className="flex items-center gap-3">
                    <Avatar className="size-12">
                      <AvatarFallback
                        className="text-body"
                        name={item.name.replace(/^Dr\.\s/, "")}
                      />
                    </Avatar>
                    <span className="flex min-w-0 flex-col">
                      <cite className="truncate text-body font-semibold not-italic">
                        {item.name}
                      </cite>
                      <span className="truncate text-meta text-muted-foreground">{item.role}</span>
                    </span>
                  </span>
                  <span className="text-subtitle font-semibold tracking-tight">{item.company}</span>
                  {item.rating ? (
                    <Rating
                      allowHalf
                      aria-label={`${item.rating} out of 5`}
                      readOnly
                      value={item.rating}
                    />
                  ) : null}
                </figcaption>
              </figure>
            </CarouselItem>
          ))}
        </CarouselContent>

        <div
          className="flex flex-col gap-4 @3xl:w-64"
          data-slot="marketing-testimonial-spotlight-controls"
        >
          {testimonials[index]?.result ? (
            <MetricCard
              label={testimonials[index].result.label}
              size="sm"
              value={testimonials[index].result.value}
            />
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <CarouselPrevious aria-label="Previous quote" className="static translate-y-0" />
            <CarouselDots />
            <CarouselNext aria-label="Next quote" className="static translate-y-0" />
          </div>
        </div>
      </Carousel>

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
              onClick={() => api?.scrollTo(i)}
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
