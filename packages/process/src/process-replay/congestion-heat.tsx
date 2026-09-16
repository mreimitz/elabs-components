"use client";

/**
 * CongestionHeat — the replay's congestion, as a ranked text list (RM-065).
 *
 * The map shows congestion without colour — more tokens on a busy edge, each drawn larger —
 * and this list states it in words: the transitions that held the most cases at once, with
 * the peak count and when it happened, plus a relative bar whose LENGTH (not hue) repeats the
 * peak. It is static (the whole timeline, not the playhead), so it is also the complete
 * reading for anyone who never presses play, including under reduced motion.
 */
import { forwardRef, useId, useMemo, type HTMLAttributes } from "react";
import { useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { rankReplayCongestion, type ReplayTimeline } from "../core/replay-timeline";
import { fillLabel } from "../variant-explorer/variant-explorer-model";
import {
  PROCESS_REPLAY_DEFAULT_LABELS,
  useReplayTimeFormatter,
  type ProcessReplayLabels,
} from "./replay-format";

/** Props for {@link CongestionHeat}. */
export interface CongestionHeatProps extends HTMLAttributes<HTMLElement> {
  /** The replay timeline (`replayTimeline`). */
  timeline: ReplayTimeline;
  /** How many transitions to list. @default 5 */
  limit?: number;
  labels?: Partial<ProcessReplayLabels>;
}

/** The most congested transitions of a replay, ranked. */
export const CongestionHeat = forwardRef<HTMLElement, CongestionHeatProps>(function CongestionHeat(
  { timeline, limit = 5, labels: labelOverrides, className, ...props },
  ref,
) {
  const { formatNumber } = useLocale();
  const labels = useMemo<ProcessReplayLabels>(
    () => ({ ...PROCESS_REPLAY_DEFAULT_LABELS, ...labelOverrides }),
    [labelOverrides],
  );
  const formatTime = useReplayTimeFormatter(timeline, labels.relativeTime);
  const ranked = useMemo(() => rankReplayCongestion(timeline, limit), [timeline, limit]);
  const titleId = useId();
  const top = ranked[0];

  return (
    <section
      ref={ref}
      data-slot="congestion-heat"
      aria-labelledby={titleId}
      className={cn("flex min-w-0 flex-col gap-2", className)}
      {...props}
    >
      <h3 id={titleId} data-slot="congestion-heat-title" className="text-subtitle">
        {labels.congestionTitle}
      </h3>
      {top ? (
        <>
          <p data-slot="congestion-heat-summary" className="text-caption text-muted-foreground">
            {fillLabel(labels.congestionSummary, {
              source: top.source,
              target: top.target,
              peak: formatNumber(top.peak),
              time: formatTime(top.peakAt),
            })}
          </p>
          <ol data-slot="congestion-heat-list" className="flex flex-col gap-2">
            {ranked.map((entry) => (
              <li
                key={entry.edgeId}
                data-slot="congestion-heat-item"
                data-edge-id={entry.edgeId}
                data-peak={entry.peak}
                className="flex min-w-0 flex-col gap-1"
              >
                <span className="text-body truncate">
                  {fillLabel(labels.congestionTransition, {
                    source: entry.source,
                    target: entry.target,
                  })}
                </span>
                <span className="text-meta text-muted-foreground tabular-nums">
                  {fillLabel(labels.congestionPeak, {
                    peak: formatNumber(entry.peak),
                    time: formatTime(entry.peakAt),
                  })}
                </span>
                <span aria-hidden="true" className="h-1 w-full rounded-full bg-muted">
                  <span
                    data-slot="congestion-heat-bar"
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${(entry.peak / top.peak) * 100}%` }}
                  />
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p data-slot="congestion-heat-empty" className="text-caption text-muted-foreground">
          {labels.congestionEmpty}
        </p>
      )}
    </section>
  );
});
