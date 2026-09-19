"use client";

import { useMemo, useState } from "react";
import { Gantt, type GanttMarker, type GanttTask } from "@elabs-ai/components-charts";
import {
  Badge,
  Card,
  CardContent,
  Descriptions,
  DescriptionsItem,
  Meter,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { LAUNCH_GO_LIVE, LAUNCH_TODAY, launchMarkers, launchTasks } from "./data/launch-plan";

export interface CommandCenterLaunchPlanProps {
  tasks?: GanttTask[];
  markers?: GanttMarker[];
  today?: Date;
  goLive?: Date;
  locale?: string;
  className?: string;
}

const DAY_MS = 86_400_000;
const asTime = (value: Date | string | number) => new Date(value).getTime();

/**
 * A launch on one screen: the plan as a Gantt with its dependencies, baselines and markers, a
 * strip that says how much runway is left, and the selected task spelled out beside it.
 */
export function CommandCenterLaunchPlan({
  tasks = launchTasks,
  markers = launchMarkers,
  today = LAUNCH_TODAY,
  goLive = LAUNCH_GO_LIVE,
  locale = "en-US",
  className,
}: CommandCenterLaunchPlanProps) {
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => tasks.find((task) => task.status === "warning")?.id,
  );
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });

  const leaves = useMemo(
    () => tasks.filter((task) => !tasks.some((other) => other.parentId === task.id)),
    [tasks],
  );
  const work = leaves.filter((task) => !task.isMilestone);
  const overall = work.length
    ? Math.round(work.reduce((sum, task) => sum + (task.progress ?? 0), 0) / work.length)
    : 0;
  const slipped = work.filter(
    (task) => task.baseline && asTime(task.end) > asTime(task.baseline.end),
  );
  const daysLeft = Math.max(0, Math.round((goLive.getTime() - today.getTime()) / DAY_MS));
  const selected = tasks.find((task) => task.id === selectedId);
  const slipDays = (task: GanttTask) =>
    task.baseline ? Math.round((asTime(task.end) - asTime(task.baseline.end)) / DAY_MS) : 0;
  const rootIds = tasks.filter((task) => !task.parentId).map((task) => task.id);

  return (
    <section
      aria-label="Launch plan"
      className={cn("@container flex flex-col gap-4", className)}
      data-slot="command-center-launch-plan"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
            Lyon depot · launch plan
          </p>
          <h2 className="text-title font-semibold text-balance">
            {daysLeft} days to go live,{" "}
            {slipped.length === 0
              ? "and every task is inside its baseline"
              : `and ${slipped.length === 1 ? "one task has" : `${slipped.length} tasks have`} slipped past baseline`}
          </h2>
        </div>
        <div className="flex w-full max-w-64 flex-col gap-1">
          <span className="flex justify-between text-meta text-muted-foreground tabular-nums">
            <span>Work complete</span>
            <span>{overall}%</span>
          </span>
          <Meter aria-label={`${overall}% of the work is complete`} size="sm" value={overall} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 @5xl:grid-cols-4">
        <Card className="min-w-0 overflow-hidden p-0 @5xl:col-span-3">
          <Gantt
            aria-label="Lyon depot launch plan"
            defaultExpandedIds={rootIds}
            defaultPixelsPerDay={9}
            defaultViewMode="week"
            labelColumnWidth={220}
            locale={locale}
            markers={markers}
            onSelect={setSelectedId}
            selectedId={selectedId}
            style={{ height: tasks.length * 40 + 110 }}
            tasks={tasks}
          />
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4 p-5">
            {selected ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
                    Selected task
                  </p>
                  <h3 className="text-subtitle font-semibold">{selected.name}</h3>
                  {slipDays(selected) > 0 ? (
                    <Badge className="self-start" variant="warning">
                      {slipDays(selected)} days past baseline
                    </Badge>
                  ) : null}
                </div>
                <Descriptions columns={1}>
                  <DescriptionsItem label="Starts">
                    {date.format(new Date(selected.start))}
                  </DescriptionsItem>
                  <DescriptionsItem label={selected.isMilestone ? "Due" : "Ends"}>
                    {date.format(new Date(selected.end))}
                  </DescriptionsItem>
                  {selected.baseline ? (
                    <DescriptionsItem label="Baseline end">
                      {date.format(new Date(selected.baseline.end))}
                    </DescriptionsItem>
                  ) : null}
                  <DescriptionsItem label="Waits for">
                    {selected.dependencies?.length
                      ? selected.dependencies
                          .map((id) => tasks.find((task) => task.id === id)?.name ?? id)
                          .join(", ")
                      : "Nothing"}
                  </DescriptionsItem>
                </Descriptions>
                {selected.isMilestone ? null : (
                  <div className="flex flex-col gap-1">
                    <span className="flex justify-between text-meta text-muted-foreground tabular-nums">
                      <span>Progress</span>
                      <span>{selected.progress ?? 0}%</span>
                    </span>
                    <Meter
                      aria-label={`${selected.progress ?? 0}% complete`}
                      size="sm"
                      value={selected.progress ?? 0}
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="text-body text-muted-foreground">
                Select a task in the plan to see its dates, its baseline and what it waits for.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
