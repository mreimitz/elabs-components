"use client";

import type { HTMLAttributes } from "react";
import {
  Activity,
  Bot,
  FileText,
  Mail,
  Phone,
  Receipt,
  Sparkles,
  StickyNote,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, Badge, Meter } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { Actor, Evidence, EvidenceKind } from "./data/atlas-ops";
import { formatClock, formatRelative, formatShare } from "./format";

// ─── ProvenanceLine ───────────────────────────────────────────────────────────

export interface ProvenanceLineProps extends HTMLAttributes<HTMLParagraphElement> {
  /** Where the figure comes from — "ERP", "Stripe + invoices", "Calibrated model". */
  source: string;
  /** When that source last reported. */
  refreshedAt: Date;
  /** The snapshot moment `refreshedAt` is relative to — never the wall clock. */
  now: Date;
  /** For a derived figure, the input set: "61 open orders". Rendered as "Derived from …". */
  derivedFrom?: string;
  locale?: string;
}

/**
 * "ERP · 2 min ago" / "Derived from 61 open orders · 06:02" — the one line
 * every figure carries so a reader can judge it: WHERE it came from and HOW
 * FRESH it is. A number never appears without one.
 */
export function ProvenanceLine({
  source,
  refreshedAt,
  now,
  derivedFrom,
  locale = "en-US",
  className,
  ...props
}: ProvenanceLineProps) {
  // A live feed reads as freshness ("2 min ago"); a derivation reads as the
  // RUN that produced it ("06:02") — the reader wants to know which batch,
  // not how long ago the batch ran.
  const when = derivedFrom
    ? formatClock(refreshedAt, locale)
    : formatRelative(refreshedAt, now, locale);
  return (
    <p
      className={cn("truncate text-caption text-muted-foreground", className)}
      data-slot="provenance-line"
      title={derivedFrom ? `${source}, run of ${when}` : undefined}
      {...props}
    >
      {derivedFrom ? `Derived from ${derivedFrom}` : source}
      <span aria-hidden="true"> · </span>
      <span className="sr-only">, </span>
      {when}
    </p>
  );
}

// ─── ConfidenceBar ────────────────────────────────────────────────────────────

export interface ConfidenceBarProps extends HTMLAttributes<HTMLSpanElement> {
  /** 0–1. */
  value: number;
  /** What the confidence is OF, for the accessible name: "Atlas’s confidence". Default "confidence". */
  label?: string;
  locale?: string;
}

/**
 * A word-sized confidence meter: the ui `Meter` at its `xs` rung with the
 * percentage printed beside it. Default ink on purpose — confidence is a
 * quantity, not a verdict, so it carries no status hue. Two channels (length
 * + the printed number) for WCAG 1.4.1. A preset, not a primitive.
 */
export function ConfidenceBar({
  value,
  label = "confidence",
  locale = "en-US",
  className,
  ...props
}: ConfidenceBarProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const pct = formatShare(clamped, locale, 0);
  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      data-slot="confidence-bar"
      {...props}
    >
      <Meter
        aria-label={label}
        aria-valuetext={pct}
        className="w-14 shrink-0"
        max={1}
        size="xs"
        value={clamped}
      />
      <span aria-hidden="true" className="text-meta tabular-nums text-muted-foreground">
        {pct}
      </span>
    </span>
  );
}

// ─── SourceChip ───────────────────────────────────────────────────────────────

const SOURCE_ICONS: Record<EvidenceKind, LucideIcon> = {
  email: Mail,
  meeting: Video,
  call: Phone,
  invoice: Receipt,
  event: Activity,
  note: StickyNote,
  filing: FileText,
};

export interface SourceChipProps extends HTMLAttributes<HTMLSpanElement> {
  evidence: Evidence;
}

/**
 * The kind of source document a derivation read — the ui `Badge` in its
 * `outline` variant with a leading glyph, the same construction every chip in
 * the library uses (`FilterChip`, ai’s `InlineCitationCardTrigger`). Not a new
 * primitive. Named SourceChip, not EvidenceChip: `@elabs-ai/components-ai`
 * already exports an `EvidenceChip` (a grounded-citation hover trigger), and
 * this is a different thing — a tone-free pointer at a document kind.
 */
export function SourceChip({ evidence, className, ...props }: SourceChipProps) {
  const Icon = SOURCE_ICONS[evidence.kind];
  return (
    <Badge
      className={cn("font-normal text-foreground", className)}
      data-slot="source-chip"
      variant="outline"
      {...props}
    >
      <Icon aria-hidden="true" className="size-3 text-muted-foreground" />
      {evidence.label}
    </Badge>
  );
}

// ─── EvidenceMeter ────────────────────────────────────────────────────────────

export interface EvidenceMeterProps extends HTMLAttributes<HTMLSpanElement> {
  /** Signals that corroborated the decision. */
  held: number;
  /** Signals checked in total. Default 5. */
  of?: number;
  /** Print "4 of 5" beside the cells. Default true. */
  showLabel?: boolean;
}

/**
 * "|||| 4 of 5" — how many of the checked signals held: the ui `Meter` in
 * its segmented form (one cell per signal, stated in the label) rather than a
 * percentage bar. Five discrete facts read better as five marks than as 80%.
 * A preset, not a primitive.
 */
export function EvidenceMeter({
  held,
  of = 5,
  showLabel = true,
  className,
  ...props
}: EvidenceMeterProps) {
  const clamped = Math.min(of, Math.max(0, Math.floor(held)));
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      data-slot="evidence-meter"
      {...props}
    >
      <Meter
        aria-label="Signals held"
        aria-valuetext={`${clamped} of ${of} signals held`}
        className="w-6 shrink-0"
        max={of}
        segments={of}
        value={clamped}
      />
      {showLabel ? (
        <span aria-hidden="true" className="font-mono text-code tabular-nums text-muted-foreground">
          {clamped} of {of}
        </span>
      ) : null}
    </span>
  );
}

// ─── ActorAvatar ──────────────────────────────────────────────────────────────

export interface ActorAvatarProps extends HTMLAttributes<HTMLSpanElement> {
  actor: Actor;
  /** Print the actor’s name beside the avatar. Default true. */
  showName?: boolean;
}

/**
 * Who acted — a block-local preset over the ui `Avatar`, NOT a new primitive.
 * It mirrors `MessageAvatar` (`@elabs-ai/components-ai`, research 11 §B.1
 * MSG-2): a non-human actor is a glyph on the `primary`/`primary-foreground`
 * ground — the house agent-identity colour — and a person is a monogram on
 * `muted`. It exists here rather than importing `MessageAvatar` only so a
 * copy-own audit/KPI block does not take the whole `ai` package as a
 * dependency for one avatar. The one thing it adds is a glyph that tells the
 * copilot (sparkle) from a delegated agent (bot); the name is always in the
 * DOM for AT, so the row reads in greyscale and in a screen reader alike.
 */
export function ActorAvatar({ actor, showName = true, className, ...props }: ActorAvatarProps) {
  const Icon = actor.kind === "copilot" ? Sparkles : actor.kind === "agent" ? Bot : null;
  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-2", className)}
      data-slot="actor-avatar"
      {...props}
    >
      <Avatar className="size-6">
        <AvatarFallback
          aria-hidden="true"
          className={cn(
            "text-meta",
            Icon ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {Icon ? <Icon className="size-3.5" /> : actor.initials}
        </AvatarFallback>
      </Avatar>
      <span className={cn("truncate text-body text-foreground", !showName && "sr-only")}>
        {actor.name}
      </span>
    </span>
  );
}
