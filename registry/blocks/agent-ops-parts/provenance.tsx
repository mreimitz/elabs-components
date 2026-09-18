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
import { Avatar, AvatarFallback } from "@elabs-ai/components-ui";
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
  /** What the confidence is OF, for the accessible name: "confidence that the stage is Negotiation". Default "confidence". */
  label?: string;
  locale?: string;
}

/**
 * A word-sized confidence meter — a short neutral track, an ink fill and the
 * percentage beside it. The fill is `bg-foreground` on purpose: confidence
 * is a quantity, not a verdict, so it carries no status hue. Two channels
 * (length + the printed number) for WCAG 1.4.1.
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
      aria-label={`${label}: ${pct}`}
      className={cn("inline-flex items-center gap-2", className)}
      data-slot="confidence-bar"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      {...props}
    >
      <span aria-hidden="true" className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-foreground"
          data-slot="confidence-bar-fill"
          style={{ width: `${clamped * 100}%` }}
        />
      </span>
      <span aria-hidden="true" className="text-meta tabular-nums text-muted-foreground">
        {pct}
      </span>
    </span>
  );
}

// ─── EvidenceChip ─────────────────────────────────────────────────────────────

const EVIDENCE_ICONS: Record<EvidenceKind, LucideIcon> = {
  email: Mail,
  meeting: Video,
  call: Phone,
  invoice: Receipt,
  event: Activity,
  note: StickyNote,
  filing: FileText,
};

export interface EvidenceChipProps extends HTMLAttributes<HTMLSpanElement> {
  evidence: Evidence;
}

/**
 * The kind of source document a derivation read — an icon + label chip. Not
 * a `Badge` (which carries a status tone) and not a `StatusBadge`: evidence
 * has no status, it is a pointer at a thing.
 */
export function EvidenceChip({ evidence, className, ...props }: EvidenceChipProps) {
  const Icon = EVIDENCE_ICONS[evidence.kind];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-md border border-border-strong px-2 text-meta text-foreground",
        className,
      )}
      data-slot="evidence-chip"
      {...props}
    >
      <Icon aria-hidden="true" className="size-3.5 text-muted-foreground" />
      {evidence.label}
    </span>
  );
}

// ─── EvidenceMeter ────────────────────────────────────────────────────────────

export interface EvidenceMeterProps extends HTMLAttributes<HTMLSpanElement> {
  /** Signals that corroborated the decision. */
  held: number;
  /** Signals checked in total. Default 5. */
  of?: number;
  /** Print "4 of 5" beside the ticks. Default true. */
  showLabel?: boolean;
}

/**
 * "|||| 4 of 5" — how many of the checked signals held. A countable tick
 * strip (each tick is one signal, stated in the label) rather than a
 * percentage bar: five discrete facts read better as five marks than as 80%.
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
      aria-label={`${clamped} of ${of} signals held`}
      className={cn("inline-flex items-center gap-1.5", className)}
      data-slot="evidence-meter"
      role="img"
      {...props}
    >
      <span aria-hidden="true" className="inline-flex items-end gap-px">
        {Array.from({ length: of }, (_, i) => (
          <span
            className={cn(
              "block h-3 w-0.5 rounded-full",
              i < clamped ? "bg-foreground" : "bg-border-strong",
            )}
            key={i}
          />
        ))}
      </span>
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
