"use client";

import { useMemo } from "react";
import {
  ParallelCoordinatesChart,
  RadarArea,
  RadarAxis,
  RadarChart,
  RadarGrid,
  RadarLabels,
} from "@elabs-ai/components-charts";
import { Badge, Card, CardContent } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  carrierDimensions,
  carrierMeasures,
  carrierProfiles,
  profileMetrics,
  type CarrierProfile,
} from "./data/profiles";

export interface InfographicProfileCompareProps {
  profiles?: CarrierProfile[];
  className?: string;
}

/**
 * "How do the options compare?" — the scored profile as overlapping radar shapes, and the raw
 * measures behind the scores as one line per option across parallel axes. The headline names
 * the option with the best total and the promise it is weakest on.
 */
export function InfographicProfileCompare({
  profiles = carrierProfiles,
  className,
}: InfographicProfileCompareProps) {
  const verdict = useMemo(() => {
    const ranked = profiles
      .map((profile) => ({
        profile,
        total: Object.values(profile.values).reduce((sum, v) => sum + v, 0),
      }))
      .sort((a, b) => b.total - a.total);
    const best = ranked[0]?.profile;
    if (!best) return null;
    const weakest = profileMetrics
      .map((metric) => ({ metric, value: best.values[metric.key] ?? 0 }))
      .sort((a, b) => a.value - b.value)[0];
    return { best, weakest };
  }, [profiles]);

  return (
    <Card className={cn("@container", className)} data-slot="infographic-profile-compare">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body text-muted-foreground">
            Carrier partners, scored on five promises
          </span>
          <Badge className="shrink-0" variant="secondary">
            Trailing 12 months
          </Badge>
        </div>
        <h3 className="text-title text-balance text-foreground">
          {verdict
            ? `${verdict.best.label} has the strongest profile; ${verdict.weakest?.metric.label.toLowerCase()} is where it gives ground`
            : "No carriers to compare"}
        </h3>
        <div className="grid grid-cols-1 items-center gap-6 @3xl:grid-cols-2">
          <div className="flex flex-col items-center gap-3">
            <RadarChart
              accessibleLabel="Carrier scores across five promises"
              data={profiles}
              metrics={profileMetrics}
              size={300}
            >
              <RadarGrid />
              <RadarAxis />
              <RadarLabels fontSize={11} offset={14} />
              {profiles.map((profile, i) => (
                <RadarArea index={i} key={profile.label} />
              ))}
            </RadarChart>
            <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1">
              {profiles.map((profile, i) => (
                <li className="flex items-center gap-1.5 text-meta" key={profile.label}>
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{ background: `var(--chart-${(i % 5) + 1})` }}
                  />
                  {profile.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-meta font-medium text-muted-foreground">
              The measures behind the scores
            </p>
            <ParallelCoordinatesChart
              accessibleLabel="Transit days, cost per kilogram, claims and lanes served per carrier"
              data={carrierMeasures}
              dimensions={carrierDimensions}
              entity="carrier"
            />
          </div>
        </div>
        <p className="text-caption text-muted-foreground">
          How to read it: a bigger, rounder shape is a stronger all-round partner; a spike is one
          promise kept at the expense of the others. On the right each axis has its own scale.
        </p>
      </CardContent>
    </Card>
  );
}
