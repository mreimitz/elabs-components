import type { ReactNode } from "react";
import {
  Avatar,
  AvatarFallback,
  Card,
  CardContent,
  Rating,
  SectionHeader,
} from "@elabs-ai/components-ui";

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  /** Stars out of five, when the quote came with a rating. */
  rating?: number;
}

export interface MarketingTestimonialsProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  testimonials?: Testimonial[];
}

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    quote: "The team stopped asking where a shipment is and started asking what to do about it.",
    name: "Ingrid Solberg",
    role: "COO, Northwind Retail",
    rating: 5,
  },
  {
    quote:
      "Clearance went from 31 hours to 19 in the first month. Nothing else we changed that year came close.",
    name: "Leila Haddad",
    role: "Customs Lead, Northwind Retail",
    rating: 5,
  },
  {
    quote:
      "Our drivers chose to keep using the app after the pilot. That has never happened before.",
    name: "Sven Aalto",
    role: "Fleet Manager, Pelican Lines",
    rating: 4.5,
  },
  {
    quote:
      "We replaced three tools and a wall of spreadsheets. The audit was the easiest we have had.",
    name: "Dr. Marta Lind",
    role: "Head of Supply, Halden Pharma",
    rating: 5,
  },
  {
    quote: "When a vessel slipped, we knew before the customer did, with the fix already proposed.",
    name: "Tomas Pereira",
    role: "Head of Logistics, Kestrel Foods",
    rating: 4.5,
  },
  {
    quote: "Set up on a Tuesday, planning live routes by Friday.",
    name: "Aiko Mori",
    role: "Operations, Bluewater Marine",
    rating: 5,
  },
];

const initials = (name: string) =>
  name
    .replace(/^Dr\.\s/, "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

/** What customers say, as a wall: each quote with who said it and, where given, their rating. */
export function MarketingTestimonials({
  eyebrow = "Customers",
  title = "Said by the people who run the docks",
  testimonials = DEFAULT_TESTIMONIALS,
}: MarketingTestimonialsProps) {
  return (
    <section
      className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-16"
      data-slot="marketing-testimonials"
    >
      <SectionHeader as="h2" eyebrow={eyebrow} title={title} />
      <ul className="columns-1 gap-4 md:columns-2 xl:columns-3">
        {testimonials.map((item) => (
          <li className="mb-4 break-inside-avoid" key={item.name}>
            <Card>
              <CardContent className="flex flex-col gap-4 p-5">
                {item.rating ? (
                  <Rating
                    allowHalf
                    aria-label={`${item.rating} out of 5`}
                    readOnly
                    value={item.rating}
                  />
                ) : null}
                <blockquote className="text-body text-pretty">“{item.quote}”</blockquote>
                <footer className="flex items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarFallback className="text-caption">{initials(item.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <cite className="truncate text-body font-medium not-italic">{item.name}</cite>
                    <span className="truncate text-meta text-muted-foreground">{item.role}</span>
                  </div>
                </footer>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
