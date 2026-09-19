// registry: command-center-live-ops-01 — copied 2026-09-19
"use client";

import { useEffect, useState } from "react";
import {
  ChartCard,
  ChartTooltip,
  Gauge,
  HeatmapChart,
  LiveLine,
  LiveLineChart,
  LiveXAxis,
  LiveYAxis,
  Sparkline,
} from "@elabs-ai/components-charts";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Timeline,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  dispatchLoad,
  opsDials,
  opsIncidents,
  opsServices,
  throughputAt,
  type OpsDial,
  type OpsIncident,
  type OpsService,
  type ServiceState,
} from "./data/live-ops";

export interface CommandCenterLiveOpsProps {
  dials?: OpsDial[];
  services?: OpsService[];
  incidents?: OpsIncident[];
  /** Freeze the stream — for a screenshot, a test, or a reader who asked for stillness. */
  paused?: boolean;
  className?: string;
}

const STATE_BADGE: Record<ServiceState, "success" | "warning" | "destructive"> = {
  healthy: "success",
  degraded: "warning",
  down: "destructive",
};

const WINDOW_SECONDS = 60;

/** One point a second, seeded so the first paint already shows a full window. */
function useThroughput(paused: boolean) {
  const [start] = useState(() => Math.floor(Date.now() / 1000));
  const [points, setPoints] = useState(() =>
    Array.from({ length: WINDOW_SECONDS }, (_, i) => {
      const time = start - (WINDOW_SECONDS - 1 - i);
      return { time, value: throughputAt(time) };
    }),
  );
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setPoints((prev) => {
        const time = (prev.at(-1)?.time ?? start) + 1;
        return [...prev.slice(-(WINDOW_SECONDS * 2)), { time, value: throughputAt(time) }];
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [paused, start]);
  return points;
}

/**
 * The operations wall: what is flowing right now, whether the three promises hold, which
 * service is hurting, when the load arrives, and what the on-call already knows.
 */
export function CommandCenterLiveOps({
  dials = opsDials,
  services = opsServices,
  incidents = opsIncidents,
  paused = false,
  className,
}: CommandCenterLiveOpsProps) {
  const points = useThroughput(paused);
  const latest = points.at(-1)?.value ?? 0;
  const unhealthy = services.filter((service) => service.state !== "healthy").length;

  return (
    <section
      aria-label="Live operations wall"
      className={cn("@container flex flex-col gap-4", className)}
      data-slot="command-center-live-ops"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
            Dispatch platform · operations wall
          </p>
          <h2 className="text-title font-semibold text-balance">
            {unhealthy === 0
              ? "Every service is healthy"
              : `${unhealthy} of ${services.length} services need attention`}
          </h2>
        </div>
        <Badge variant={paused ? "secondary" : "success"}>{paused ? "Paused" : "Streaming"}</Badge>
      </header>

      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-3">
        <ChartCard
          className="@4xl:col-span-2"
          description="Dispatch events per second over the trailing minute. The line eases to each new reading instead of jumping."
          height={280}
          title={`${latest.toLocaleString("en-US")} events a second right now`}
        >
          <LiveLineChart
            accessibleLabel="Dispatch events per second, trailing minute"
            data={points}
            margin={{ left: 56, right: 64 }}
            paused={paused}
            style={{ height: 220 }}
            value={latest}
            window={WINDOW_SECONDS / 2}
          >
            <LiveLine dataKey="value" />
            <LiveXAxis />
            <LiveYAxis />
            <ChartTooltip />
          </LiveLineChart>
        </ChartCard>

        <Card>
          <CardHeader>
            <CardTitle>What the on-call already knows</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline
              items={incidents.map((incident) => ({
                title: incident.title,
                description: incident.detail,
                status: incident.status,
                timestamp: incident.time,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-3">
        {dials.map((dial) => (
          <Card key={dial.id}>
            <CardContent className="flex flex-col items-center gap-2 p-5">
              <div className="w-full max-w-64">
                <Gauge
                  centerValue={dial.value}
                  defaultLabel={dial.label}
                  minWidth={180}
                  suffix={dial.suffix}
                  target={dial.target}
                  value={dial.value}
                />
              </div>
              <p className="text-center text-meta text-muted-foreground text-pretty">
                {dial.caption}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Services, worst first</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {[...services]
                .sort(
                  (a, b) =>
                    ["down", "degraded", "healthy"].indexOf(a.state) -
                    ["down", "degraded", "healthy"].indexOf(b.state),
                )
                .map((service) => (
                  <li className="flex items-center gap-3 py-2.5" key={service.name}>
                    <span className="min-w-0 flex-1 truncate text-body font-medium">
                      {service.name}
                    </span>
                    <div className="hidden w-32 shrink-0 @md:block">
                      <Sparkline
                        className="w-full"
                        fit="fill"
                        height={28}
                        label={`${service.name} requests per second, trailing 20 minutes`}
                        values={service.traffic}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-end text-meta text-muted-foreground tabular-nums">
                      {service.state === "down" ? "no answer" : `p95 ${service.latency} ms`}
                    </span>
                    <Badge
                      className="w-20 shrink-0 justify-center"
                      variant={STATE_BADGE[service.state]}
                    >
                      {service.state}
                    </Badge>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Two waves a day: eight in the morning, five in the afternoon</CardTitle>
            <CardDescription>
              Dispatches per weekday and hour over the trailing four weeks. Darker is busier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HeatmapChart
              data={dispatchLoad.rows}
              valueFormat="compact"
              valueKey="dispatches"
              x="hour"
              xOrder={dispatchLoad.hours}
              y="day"
              yOrder={dispatchLoad.days}
            />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
