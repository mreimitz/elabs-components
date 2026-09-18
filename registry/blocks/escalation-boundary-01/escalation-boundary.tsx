"use client";

import { useState } from "react";
import { Card, CardContent, STATUS_TONE_ICONS, StatusBadge } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  COPILOT_NAME,
  EVIDENCE_SIGNALS,
  RECOMMENDED_THRESHOLD,
  boundaryStats,
  boundaryWindowDays,
  evidenceLadder,
  type EvidenceRung,
} from "@/components/agent-ops-parts/data/atlas-ops";
import { formatCount, formatShare } from "@/components/agent-ops-parts/format";
import { EvidenceMeter } from "@/components/agent-ops-parts/provenance";

export interface EscalationBoundaryProps {
  /** One row per evidence rung, highest first. Defaults to the shared Atlas dataset. */
  ladder?: EvidenceRung[];
  /** Signals checked per decision. Default 5. */
  signals?: number;
  /** Initial threshold: decisions with at least this many signals clear on their own. */
  defaultThreshold?: number;
  /** The threshold the copilot recommends; the scenario card for it is marked. */
  recommendedThreshold?: number;
  /** Fires when a scenario card moves the boundary. */
  onThresholdChange?: (threshold: number) => void;
  windowDays?: number;
  stats?: typeof boundaryStats;
  copilotName?: string;
  locale?: string;
  className?: string;
}

/**
 * "Where autonomy ends" — the escalation boundary, the one dial an AI-ops
 * product must put on screen: the line between what the copilot does alone
 * and what reaches a person’s queue. Set on EVIDENCE, never on amount.
 *
 * Three parts, one card:
 * 1. A stacked distribution bar — every decision in the window, laid out by
 *    how many of the checked signals corroborated it, with the threshold
 *    drawn as a vertical mark. Rungs at or above the line are ink (auto);
 *    rungs below are the warning rung (review). Two channels: hue AND the
 *    legend’s counts.
 * 2. The evidence ladder — a row per rung with a countable tick meter, what
 *    that rung means, decisions, share and side.
 * 3. "If you move it" — three scenario cards (one rung looser, current, one
 *    rung tighter) that state the trade in the reader’s own units: cleared
 *    share, queue delta, bad decisions caught, reviews per extra catch.
 *    Clicking a card MOVES the boundary; the copilot’s recommendation is
 *    marked and the safe option keeps the emphasis.
 */
export function EscalationBoundary({
  ladder = evidenceLadder,
  signals = EVIDENCE_SIGNALS,
  defaultThreshold = RECOMMENDED_THRESHOLD,
  recommendedThreshold = RECOMMENDED_THRESHOLD,
  onThresholdChange,
  windowDays = boundaryWindowDays,
  stats = boundaryStats,
  copilotName = COPILOT_NAME,
  locale = "en-US",
  className,
}: EscalationBoundaryProps) {
  const [threshold, setThreshold] = useState(defaultThreshold);
  const rungs = [...ladder].sort((a, b) => b.held - a.held);
  const total = rungs.reduce((s, r) => s + r.decisions, 0);
  const totalBad = rungs.reduce((s, r) => s + r.badCaught, 0);

  const outcome = (t: number) => {
    const auto = rungs.filter((r) => r.held >= t).reduce((s, r) => s + r.decisions, 0);
    const review = total - auto;
    const caught = rungs.filter((r) => r.held < t).reduce((s, r) => s + r.badCaught, 0);
    return { auto, review, caught, autoShare: total ? auto / total : 0 };
  };
  const current = outcome(threshold);
  const move = (t: number) => {
    setThreshold(t);
    onThresholdChange?.(t);
  };

  // The mark sits at the boundary between the lowest AUTO rung and the highest REVIEW rung.
  const autoWidth = total ? current.auto / total : 0;

  return (
    <Card className={cn("@container", className)} data-slot="escalation-boundary">
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-subtitle text-foreground">Where autonomy ends</h3>
            <p className="text-caption text-muted-foreground">
              {formatCount(total, locale)} decisions in the last {windowDays} days, laid out by how
              well corroborated each one was
            </p>
          </div>
          <p className="text-caption text-muted-foreground">
            evidence threshold ·{" "}
            <span className="font-mono text-code text-foreground">
              {threshold} of {signals}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0">
            {/* Distribution bar */}
            <div className="relative pt-7" data-slot="escalation-boundary-bar">
              <span
                aria-hidden="true"
                className="absolute top-0 -translate-x-1/2 rounded-md bg-foreground px-2 py-0.5 font-mono text-code text-background"
                style={{ insetInlineStart: `${autoWidth * 100}%` }}
              >
                {threshold} of {signals}
              </span>
              <div
                aria-label={`${formatShare(current.autoShare, locale)} of decisions clear on their own at ${threshold} of ${signals} signals; ${formatCount(current.review, locale)} reach a person`}
                className="relative flex h-10 w-full overflow-hidden rounded-md"
                role="img"
              >
                {rungs.map((r) => {
                  const auto = r.held >= threshold;
                  const w = total ? (r.decisions / total) * 100 : 0;
                  // Ink deepens with evidence inside each side, so the bar
                  // still reads as a ladder in greyscale.
                  const depth = signals ? r.held / signals : 0;
                  return (
                    <span
                      className={cn("h-full", auto ? "bg-foreground" : "bg-warning")}
                      key={r.held}
                      style={{ width: `${w}%`, opacity: 0.45 + depth * 0.55 }}
                      title={`${r.held} of ${signals} · ${formatCount(r.decisions, locale)}`}
                    />
                  );
                })}
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-background"
                  style={{ insetInlineStart: `${autoWidth * 100}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-caption">
                <span className="inline-flex items-center gap-2 text-foreground">
                  <span aria-hidden="true" className="size-2.5 rounded-full bg-foreground" />
                  Auto — {copilotName} acts alone ·{" "}
                  <span className="tabular-nums">
                    {formatCount(current.auto, locale)} ({formatShare(current.autoShare, locale)})
                  </span>
                </span>
                <span className="inline-flex items-center gap-2 text-foreground">
                  <span aria-hidden="true" className="size-2.5 rounded-full bg-warning" />
                  Review — reaches your queue ·{" "}
                  <span className="tabular-nums">
                    {formatCount(current.review, locale)} (
                    {formatShare(1 - current.autoShare, locale)})
                  </span>
                </span>
              </div>
            </div>

            {/* Ladder */}
            <table className="mt-5 w-full border-collapse" data-slot="escalation-boundary-ladder">
              <thead>
                <tr className="text-start text-meta uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pe-3 text-start font-normal" scope="col">
                    Evidence
                  </th>
                  <th className="pb-2 pe-3 text-start font-normal" scope="col">
                    What that means
                  </th>
                  <th className="pb-2 pe-3 text-end font-normal" scope="col">
                    Decisions
                  </th>
                  <th className="hidden pb-2 pe-3 text-end font-normal @xl:table-cell" scope="col">
                    Share
                  </th>
                  <th className="pb-2 text-end font-normal" scope="col">
                    Side
                  </th>
                </tr>
              </thead>
              <tbody>
                {rungs.map((r) => {
                  const auto = r.held >= threshold;
                  return (
                    <tr
                      className={cn("border-t border-border", !auto && "bg-warning/5")}
                      key={r.held}
                    >
                      <td className="py-2 pe-3 align-top">
                        <EvidenceMeter held={r.held} of={signals} />
                      </td>
                      <td className="py-2 pe-3 align-top text-body text-foreground">{r.meaning}</td>
                      <td className="py-2 pe-3 text-end align-top text-body tabular-nums text-foreground">
                        {formatCount(r.decisions, locale)}
                      </td>
                      <td className="hidden py-2 pe-3 text-end align-top text-body tabular-nums text-muted-foreground @xl:table-cell">
                        {formatShare(total ? r.decisions / total : 0, locale)}
                      </td>
                      <td className="py-2 text-end align-top">
                        <StatusBadge
                          status={
                            auto
                              ? { label: "Auto", tone: "neutral" }
                              : {
                                  label: "Review",
                                  tone: "warning",
                                  icon: STATUS_TONE_ICONS.warning,
                                }
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Stat strip */}
            <dl className="mt-5 grid grid-cols-2 gap-4 rounded-lg bg-surface-muted p-4 @xl:grid-cols-4">
              <Stat
                label="Reached a human"
                value={`${formatCount(current.review, locale)} in ${windowDays} days`}
              />
              <Stat label="Median time to clear" value={stats.medianTimeToClear} />
              <Stat label="Caught below the line" value={stats.caughtBelowTheLine} />
              <Stat
                label="Cleared above it in error"
                value={formatCount(stats.clearedAboveInError, locale)}
              />
            </dl>
          </div>

          {/* Scenarios */}
          <div className="min-w-0" data-slot="escalation-boundary-scenarios">
            <p className="mb-2 text-meta uppercase tracking-wide text-muted-foreground">
              If you move it
            </p>
            <div className="space-y-2" role="radiogroup" aria-label="Evidence threshold">
              {[threshold + 1, threshold, threshold - 1]
                .filter((t) => t >= 1 && t <= signals)
                .map((t) => {
                  const o = outcome(t);
                  const queueDelta = o.review - current.review;
                  const catchDelta = o.caught - current.caught;
                  const perCatch = o.caught > 0 ? Math.round(o.review / o.caught) : null;
                  const isCurrent = t === threshold;
                  const isRecommended = t === recommendedThreshold;
                  return (
                    <button
                      aria-checked={isCurrent}
                      className={cn(
                        "focus-ring w-full rounded-lg p-3 text-start",
                        isCurrent
                          ? "border-2 border-foreground bg-card"
                          : "border border-border bg-card",
                      )}
                      key={t}
                      onClick={() => move(t)}
                      role="radio"
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-code text-foreground">
                          {t} of {signals}
                        </span>
                        {isRecommended ? (
                          <span className="text-meta text-info-text">{copilotName} recommends</span>
                        ) : isCurrent ? (
                          <span className="text-meta text-muted-foreground">current</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-subtitle tabular-nums text-foreground">
                        {formatShare(o.autoShare, locale)}{" "}
                        <span className="text-caption text-muted-foreground">
                          cleared without a human
                        </span>
                      </p>
                      <ul className="mt-1.5 space-y-0.5 text-caption tabular-nums text-muted-foreground">
                        <li>
                          {isCurrent
                            ? `${formatCount(o.review, locale)} in your queue`
                            : `${queueDelta > 0 ? "+" : "−"}${formatCount(Math.abs(queueDelta), locale)} ${queueDelta > 0 ? "to" : "from"} your queue`}
                        </li>
                        <li>
                          {isCurrent
                            ? `${formatCount(o.caught, locale)} bad decisions caught`
                            : `${catchDelta > 0 ? "+" : "−"}${formatCount(Math.abs(catchDelta), locale)} bad ${Math.abs(catchDelta) === 1 ? "decision" : "decisions"} caught`}
                        </li>
                        <li className="text-foreground">
                          {perCatch === null
                            ? "no catches at this setting"
                            : `${formatCount(perCatch, locale)} reviews per catch`}
                        </li>
                      </ul>
                    </button>
                  );
                })}
            </div>
            <p className="mt-3 text-caption text-muted-foreground">
              {copilotName} recommends staying at {recommendedThreshold} of {signals}. Tightening by
              one rung costs the next rung’s whole volume in reviews for one more catch — the
              reviewer becomes the bottleneck, and review quality drops as volume rises.{" "}
              {formatCount(totalBad, locale)} bad decisions in {windowDays} days, all told.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-meta uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-body tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
