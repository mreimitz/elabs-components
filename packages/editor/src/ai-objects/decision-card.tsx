"use client";

/**
 * DecisionCard — renders a `:::decision{status=accepted date=2026-06-15}` directive
 * as a decision-record card.
 *
 * Anatomy:
 *   - Status badge (accepted | rejected | proposed | superseded) in a header rail.
 *   - Date (ISO or human-readable) rendered as a `<time>` element.
 *   - Rationale body (the directive body text, rendered children).
 *   - Optional "Alternatives considered" section (comma-separated `alternatives=`
 *     attribute). The attribute shape is intentional: alternatives are typically
 *     short phrases, and keeping them out of the body lets the body stay prose.
 *
 * Status → Badge variant mapping:
 *   accepted → success · rejected → destructive · proposed → info ·
 *   superseded → secondary (neutral — de-emphasized, not a failure).
 *
 * The card is a `<section aria-label>` for landmark navigation.
 */
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  Separator,
  type BadgeProps,
} from "@qlik-coe-emea/qlabs-components-ui";
import { cn } from "@qlik-coe-emea/qlabs-components-ui/lib/cn";
import { cva } from "class-variance-authority";
import { CheckCircle2, CircleDashed, Clock, RefreshCw } from "lucide-react";
import {
  forwardRef,
  type ComponentType,
  type HTMLAttributes,
  type ReactNode,
  type SVGProps,
} from "react";

/* ------------------------------------------------------------------ */
/* Status vocabulary                                                    */
/* ------------------------------------------------------------------ */

export const DECISION_STATUSES = ["accepted", "rejected", "proposed", "superseded"] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

const STATUS_BADGE_VARIANT: Record<DecisionStatus, BadgeProps["variant"]> = {
  accepted: "success",
  rejected: "destructive",
  proposed: "info",
  superseded: "secondary",
};

const STATUS_LABELS: Record<DecisionStatus, string> = {
  accepted: "Accepted",
  rejected: "Rejected",
  proposed: "Proposed",
  superseded: "Superseded",
};

const STATUS_ICONS: Record<DecisionStatus, ComponentType<SVGProps<SVGSVGElement>>> = {
  accepted: CheckCircle2,
  rejected: CircleDashed,
  proposed: Clock,
  superseded: RefreshCw,
};

function isDecisionStatus(s: string): s is DecisionStatus {
  return DECISION_STATUSES.includes(s as DecisionStatus);
}

/* ------------------------------------------------------------------ */
/* cva (status rail accent)                                             */
/* ------------------------------------------------------------------ */

export const decisionCardVariants = cva("border-s-4", {
  variants: {
    status: {
      accepted: "border-s-success",
      rejected: "border-s-destructive",
      proposed: "border-s-info",
      superseded: "border-s-border",
    },
  },
  defaultVariants: { status: "proposed" },
});

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export interface DecisionCardProps extends HTMLAttributes<HTMLElement> {
  /**
   * Decision outcome. One of the four canonical states; anything unrecognised
   * renders as "proposed".
   */
  status?: string;
  /**
   * ISO date or human-readable date of the decision
   * (e.g. `"2026-06-15"` or `"June 2026"`).
   */
  date?: string;
  /**
   * Comma-separated alternative options considered before this decision.
   * E.g. `"Redis cache, in-memory map, SQLite"`.
   */
  alternatives?: string;
  /** The rationale body (rendered markdown children of the directive). */
  children?: ReactNode;
}

export const DecisionCard = forwardRef<HTMLElement, DecisionCardProps>(function DecisionCard(
  { status: rawStatus, date, alternatives, children, className, ...props },
  ref,
) {
  const status: DecisionStatus = isDecisionStatus(rawStatus ?? "")
    ? (rawStatus as DecisionStatus)
    : "proposed";
  const badgeVariant = STATUS_BADGE_VARIANT[status];
  const label = STATUS_LABELS[status];
  const Icon = STATUS_ICONS[status];

  const altItems = alternatives
    ? alternatives
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return (
    <section
      ref={ref}
      aria-label={`Decision: ${label}`}
      className={cn("not-prose", className)}
      {...props}
    >
      <Card className={cn(decisionCardVariants({ status }))}>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={badgeVariant} className="gap-1.5">
              <Icon className="size-3" aria-hidden="true" />
              {label}
            </Badge>
            {date ? (
              <time dateTime={date} className="text-meta text-muted-foreground tabular-nums">
                {date}
              </time>
            ) : null}
          </div>
        </CardHeader>

        {children ? (
          <CardContent className="text-body text-foreground">{children}</CardContent>
        ) : null}

        {altItems.length > 0 ? (
          <>
            <Separator />
            <div className="px-6 py-4">
              <p className="mb-2 text-meta font-medium text-muted-foreground">
                Alternatives considered
              </p>
              <ul className="flex flex-wrap gap-1.5" aria-label="Alternatives considered">
                {altItems.map((alt) => (
                  <li key={alt}>
                    <Badge variant="outline" className="text-meta">
                      {alt}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </Card>
    </section>
  );
});
