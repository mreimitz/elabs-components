"use client";

/**
 * CaseTimeline — the single-case Gantt every case drill-down opens into (RM-055, issue
 * #204, §4 R12): "single-case timeline with activity durations and waiting time".
 *
 * A THIN wrapper: it computes {@link buildCaseTimelineInstances}'s model and renders
 * `@elabs-ai/components-charts`'s `Gantt` — it does not draw a bar, a gap band or a grid
 * line itself (`.claude/rules/data.md` — "primitives go down, compositions go up"). Waiting
 * time reuses RM-047's `GanttTask.gaps` hatched-band rendering directly; there is no second
 * idle-time renderer here.
 *
 * ## The parallel flag carries a text channel, not just a colour
 *
 * Two overlapping instances get `status="info"` (an existing `Gantt` tone — no new color,
 * per the RM's own instruction), but WCAG 1.4.1 forbids colour as the ONLY channel for a
 * status. `name` (a `ReactNode` `Gantt` already supports) carries a visible "Parallel" tag
 * plus an `sr-only` explanation for anyone who cannot see the tone at all.
 */
import { forwardRef, useMemo, type HTMLAttributes } from "react";
import { Gantt, type GanttGap, type GanttTask } from "@elabs-ai/components-charts";
import { Badge, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { EventRow } from "../core/types";
import { formatDurationMs } from "../process-map/map-model";
import {
  buildCaseTimelineInstances,
  type CaseTimelineInstance,
  type CaseTimelineModelOptions,
} from "./case-timeline-model";

export interface CaseTimelineProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect">, CaseTimelineModelOptions {
  caseId: string;
  /** This case's own events, straight from `core`'s `EventLog.events`. */
  events: EventRow[];
}

function instanceName(
  instance: CaseTimelineInstance,
  t: ReturnType<typeof useLocale>["t"],
): GanttTask["name"] {
  if (!instance.isParallel) return instance.activity;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{instance.activity}</span>
      <Badge variant="info">{t("process.caseTimeline.parallelLabel")}</Badge>
      <span className="sr-only">, {t("process.caseTimeline.parallelSuffix")}</span>
    </span>
  );
}

function instanceGaps(
  instance: CaseTimelineInstance,
  t: ReturnType<typeof useLocale>["t"],
): GanttGap[] | undefined {
  if (!instance.gap) return undefined;
  return [
    {
      start: instance.gap.start,
      end: instance.gap.end,
      label: t("process.caseTimeline.gapLabel", {
        duration: formatDurationMs(instance.gap.durationMs),
      }),
    },
  ];
}

export const CaseTimeline = forwardRef<HTMLDivElement, CaseTimelineProps>(function CaseTimeline(
  { caseId, events, parallelismThreshold, className, ...props },
  ref,
) {
  const { t } = useLocale();

  const instances = useMemo(
    () => buildCaseTimelineInstances(events, { parallelismThreshold }),
    [events, parallelismThreshold],
  );

  const tasks = useMemo<GanttTask[]>(
    () =>
      instances.map((instance) => {
        const task: GanttTask = {
          id: `${caseId}-${instance.id}`,
          name: instanceName(instance, t),
          start: instance.start,
          end: instance.end,
        };
        if (instance.isParallel) task.status = "info";
        const gaps = instanceGaps(instance, t);
        if (gaps) task.gaps = gaps;
        return task;
      }),
    [instances, caseId, t],
  );

  return (
    <Gantt
      ref={ref}
      data-slot="case-timeline"
      aria-label={t("process.caseTimeline.label")}
      tasks={tasks}
      defaultViewMode="auto"
      labelPosition="end"
      className={cn(className)}
      {...props}
    />
  );
});
