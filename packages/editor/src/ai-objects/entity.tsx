"use client";

/**
 * EntityCard + EntityChip — renders `:::entity{kind=org name="Acme"}` (block card)
 * and `:entity[Acme]{kind=org}` (inline chip) directives.
 *
 * One component handles both syntaxes; the renderer factory branches on `ctx.kind`.
 *
 * Entity kinds and their icon/tone:
 *   org     → Building2 / secondary (companies, organisations)
 *   person  → User      / primary (people, authors)
 *   place   → MapPin    / info    (locations, regions)
 *   product → Box       / success (products, services)
 *   concept → Lightbulb / warning (ideas, topics)
 *   default → Tag       / outline (anything else)
 *
 * The inline chip is a `<span>` — no block wrapper — so it stays inside `<p>` without
 * creating invalid HTML. A11y: kind is conveyed via `aria-label` (not icon alone).
 */
import { Card, CardContent, CardHeader, CardTitle } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { cva, type VariantProps } from "class-variance-authority";
import { Box, Building2, Lightbulb, MapPin, Tag, User } from "lucide-react";
import {
  forwardRef,
  type ComponentType,
  type HTMLAttributes,
  type ReactNode,
  type SVGProps,
} from "react";

/* ------------------------------------------------------------------ */
/* Kind vocabulary                                                      */
/* ------------------------------------------------------------------ */

export const ENTITY_KINDS = ["org", "person", "place", "product", "concept"] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

type KindMeta = {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
};

const KIND_META: Record<string, KindMeta> = {
  org: { Icon: Building2, label: "Organisation" },
  person: { Icon: User, label: "Person" },
  place: { Icon: MapPin, label: "Place" },
  product: { Icon: Box, label: "Product" },
  concept: { Icon: Lightbulb, label: "Concept" },
};

const DEFAULT_KIND_META: KindMeta = { Icon: Tag, label: "Entity" };

function kindMeta(kind: string | undefined): KindMeta {
  return KIND_META[kind ?? ""] ?? DEFAULT_KIND_META;
}

/* ------------------------------------------------------------------ */
/* cva                                                                  */
/* ------------------------------------------------------------------ */

export const entityChipVariants = cva(
  // inline-flex + align-middle keeps the chip in the text baseline;
  // no `block` wrapper so it is valid inside <p>.
  "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-meta font-medium align-middle focus-ring",
  {
    variants: {
      kind: {
        org: "border-border bg-secondary/60 text-secondary-foreground",
        // #399 — same reasoning as `concept` below: a 10% WASH is not a plate
        // and not a mark, so the LABEL takes the on-surface `-text` rung. This
        // is the row that had no `-text` rung to reach for until #399 minted it.
        person: "border-primary/30 bg-primary/10 text-primary-text",
        place: "border-info/30 bg-info/10 text-info-text",
        product: "border-success/30 bg-success/10 text-success-text",
        // `-text`, not `-foreground`: the chip is a 10% WASH on the page surface,
        // not a solid `--warning` plate, so it needs the on-surface rung its
        // place/product siblings use (#381 flipped `--warning-foreground` to
        // light ink for the now-deep fill).
        concept: "border-warning/30 bg-warning/10 text-warning-text",
        default: "border-border text-foreground",
      },
    },
    defaultVariants: { kind: "default" },
  },
);

function chipKind(kind: string | undefined): VariantProps<typeof entityChipVariants>["kind"] {
  if (!kind) return "default";
  const known: Array<VariantProps<typeof entityChipVariants>["kind"]> = [
    "org",
    "person",
    "place",
    "product",
    "concept",
    "default",
  ];
  return known.includes(kind as never)
    ? (kind as VariantProps<typeof entityChipVariants>["kind"])
    : "default";
}

/* ------------------------------------------------------------------ */
/* EntityChip (inline)                                                  */
/* ------------------------------------------------------------------ */

export interface EntityChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** Entity kind — drives icon and tone. */
  kind?: string;
  /** Display label (the directive's label text or `name` attribute). */
  children?: ReactNode;
}

export const EntityChip = forwardRef<HTMLSpanElement, EntityChipProps>(function EntityChip(
  { kind: rawKind, children, className, ...props },
  ref,
) {
  const { Icon, label } = kindMeta(rawKind);
  const resolvedKind = chipKind(rawKind);
  return (
    <span
      ref={ref}
      role="mark"
      aria-label={children ? `${String(children)} (${label})` : label}
      className={cn(entityChipVariants({ kind: resolvedKind }), className)}
      {...props}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
});

/* ------------------------------------------------------------------ */
/* EntityCard (block)                                                   */
/* ------------------------------------------------------------------ */

export interface EntityCardProps extends HTMLAttributes<HTMLElement> {
  /** Entity kind — drives the icon and header tone. */
  kind?: string;
  /** Entity name. Falls back to children when absent. */
  name?: string;
  /** Description body (rendered markdown children of the directive). */
  children?: ReactNode;
}

export const EntityCard = forwardRef<HTMLElement, EntityCardProps>(function EntityCard(
  { kind: rawKind, name, children, className, ...props },
  ref,
) {
  const { Icon, label } = kindMeta(rawKind);

  return (
    <section
      ref={ref}
      aria-label={name ? `${label}: ${name}` : label}
      className={cn("not-prose", className)}
      {...props}
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted"
              aria-hidden="true"
            >
              <Icon className="size-4 text-muted-foreground" />
            </span>
            <div className="min-w-0">
              {name ? <CardTitle className="truncate">{name}</CardTitle> : null}
              <p className="text-meta text-muted-foreground">{label}</p>
            </div>
          </div>
        </CardHeader>
        {children ? (
          <CardContent className="text-body text-foreground">{children}</CardContent>
        ) : null}
      </Card>
    </section>
  );
});
