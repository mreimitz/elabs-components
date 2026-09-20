// registry: score-explanation-01 — copied 2026-09-19
"use client";

import { Card, CardContent } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { leadScore, type ScoreSignal } from "../agent-ops-parts/data/atlas-ops";
import { formatCount, formatSignedPoints } from "../agent-ops-parts/format";

export interface ScoreExplanationProps {
  /** The score being explained. */
  score?: number;
  /** Signed contributions, largest magnitude first is the conventional order but any order is honoured. */
  signals?: ScoreSignal[];
  /** How many weaker signals were considered but not listed. */
  omittedSignals?: number;
  /** The |points| threshold below which a signal was omitted. */
  omittedThreshold?: number;
  /** What the score is a score OF, for the title: "Why the score is 91". Default "the score". */
  subject?: string;
  locale?: string;
  className?: string;
}

/**
 * "Why the score is 91" — a scored decision decomposed into its signals: one
 * row per signal, a signed bar whose LENGTH is the contribution in points and
 * whose DIRECTION is the sign. Positive bars grow from the zero line in ink;
 * negative bars grow the other way in the warning rung, and each carries a
 * signed number so the sign never rides on colour alone.
 *
 * The bars share ONE scale (max |points|), zero-based, so lengths compare
 * honestly across rows. The footer states how many weaker signals were
 * considered but not shown — an explanation that hides its own edits is
 * not one.
 *
 * Distinct from `infographic-variance-bridge-01` (a cumulative walk from a
 * start value to an end value): this is a ranked list of independent
 * contributions to a single number.
 */
export function ScoreExplanation({
  score = leadScore.score,
  signals = leadScore.signals,
  omittedSignals = leadScore.omittedSignals,
  omittedThreshold = leadScore.omittedThreshold,
  subject = "the score",
  locale = "en-US",
  className,
}: ScoreExplanationProps) {
  const max = Math.max(1, ...signals.map((s) => Math.abs(s.points)));
  const hasNegative = signals.some((s) => s.points < 0);
  const hasPositive = signals.some((s) => s.points > 0);

  return (
    <Card className={cn("@container", className)} data-slot="score-explanation">
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-subtitle text-foreground">
            Why {subject} is <span className="tabular-nums">{formatCount(score, locale)}</span>
          </h2>
        </div>

        <ol className="space-y-2.5" data-slot="score-explanation-list">
          {signals.map((s) => (
            <SignalRow
              hasNegative={hasNegative}
              hasPositive={hasPositive}
              key={s.id}
              locale={locale}
              max={max}
              signal={s}
            />
          ))}
        </ol>

        {omittedSignals > 0 ? (
          <p className="mt-4 text-caption text-muted-foreground">
            {formatCount(signals.length + omittedSignals, locale)} signals were considered. The{" "}
            {formatCount(omittedSignals, locale)} not shown moved the score by less than{" "}
            {formatCount(omittedThreshold, locale)} points each.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SignalRow({
  signal,
  max,
  hasNegative,
  hasPositive,
  locale,
}: {
  signal: ScoreSignal;
  max: number;
  hasNegative: boolean;
  hasPositive: boolean;
  locale: string;
}) {
  const negative = signal.points < 0;
  const share = Math.abs(signal.points) / max;
  const label = formatSignedPoints(signal.points, locale);
  // The bar track is split at the zero line only when BOTH signs are present;
  // a same-sign list uses the whole width so bars do not shrink to half.
  const split = hasNegative && hasPositive;

  return (
    <li
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 @lg:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)_3rem]"
      data-slot="score-explanation-row"
    >
      <span className="min-w-0 text-body text-foreground">{signal.label}</span>
      <span
        aria-hidden="true"
        className={cn(
          "order-3 col-span-2 flex h-2 @lg:order-none @lg:col-span-1",
          split ? "justify-start" : negative ? "justify-end" : "justify-start",
        )}
      >
        {split ? (
          <span className="grid w-full grid-cols-2">
            <span className="flex justify-end">
              {negative ? (
                <span
                  className="h-full rounded-s-full bg-warning"
                  style={{ width: `${share * 100}%` }}
                />
              ) : null}
            </span>
            <span className="flex justify-start border-s border-border-strong">
              {!negative ? (
                <span
                  className="h-full rounded-e-full bg-foreground"
                  style={{ width: `${share * 100}%` }}
                />
              ) : null}
            </span>
          </span>
        ) : (
          <span
            className={cn("h-full rounded-full", negative ? "bg-warning" : "bg-foreground")}
            style={{ width: `${share * 100}%` }}
          />
        )}
      </span>
      <span
        className={cn(
          "text-end text-body tabular-nums",
          negative ? "text-warning-text" : "text-foreground",
        )}
      >
        <span className="sr-only">contribution </span>
        {label}
      </span>
    </li>
  );
}
