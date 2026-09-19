// registry: geo-network-map-01 — copied 2026-09-19
"use client";

import { useMemo, useState } from "react";
import {
  MapArc,
  MapCanvas,
  MapControls,
  MapMarker,
  MapMarkerContent,
  MapMarkerLabel,
  MapMarkerTooltip,
  type MapArcDatum,
} from "@elabs-ai/components-maps";
import { Badge, Meter } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  LANE_ON_TIME_FLOOR,
  networkHubs,
  networkLanes,
  type NetworkHub,
  type NetworkLane,
} from "./data/network";

export interface GeoNetworkMapProps {
  hubs?: NetworkHub[];
  lanes?: NetworkLane[];
  /** Below this on-time share a lane is called out. */
  onTimeFloor?: number;
  /** Draw the network on a globe instead of a flat map. Default true. */
  globe?: boolean;
  /** No basemap tiles — the network on a blank canvas, with no request to a tile server. */
  blank?: boolean;
  locale?: string;
  className?: string;
}

type LaneArc = MapArcDatum & { weight: number };

/**
 * The network on the map it runs on: one arc per lane, as wide as the volume it carries; the
 * lanes ranked beside it, the late ones called out; select a lane and the map answers.
 */
export function GeoNetworkMap({
  hubs = networkHubs,
  lanes = networkLanes,
  onTimeFloor = LANE_ON_TIME_FLOOR,
  globe = true,
  blank = false,
  locale = "en-US",
  className,
}: GeoNetworkMapProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const number = new Intl.NumberFormat(locale);
  const hubById = useMemo(() => new Map(hubs.map((hub) => [hub.id, hub])), [hubs]);
  const ranked = useMemo(() => [...lanes].sort((a, b) => b.volume - a.volume), [lanes]);
  const peak = ranked[0]?.volume ?? 1;
  const total = lanes.reduce((sum, lane) => sum + lane.volume, 0);
  const late = lanes.filter((lane) => lane.onTime < onTimeFloor);

  const arcs = useMemo<LaneArc[]>(
    () =>
      lanes.flatMap((lane) => {
        const from = hubById.get(lane.from);
        const to = hubById.get(lane.to);
        if (!from || !to) return [];
        return [{ id: lane.id, from: from.at, to: to.at, weight: 1 + (lane.volume / peak) * 5 }];
      }),
    [hubById, lanes, peak],
  );
  const selectedArc = arcs.filter((arc) => arc.id === selected);
  const laneName = (lane: NetworkLane) =>
    `${hubById.get(lane.from)?.name ?? lane.from} → ${hubById.get(lane.to)?.name ?? lane.to}`;

  return (
    <section
      aria-label="Network map"
      className={cn("@container h-full min-h-112", className)}
      data-slot="geo-network-map"
    >
      {/* The query container cannot style itself, so the frame is its first child. */}
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground @3xl:flex-row">
        <div className="relative min-h-80 min-w-0 flex-1">
          <MapCanvas
            blank={blank}
            center={[25, 25]}
            projection={globe ? { type: "globe" } : undefined}
            zoom={1.7}
          >
            <MapArc
              data={arcs}
              hoverPaint={{ "line-opacity": 1 }}
              onClick={(event) =>
                setSelected(event.arc.id === selected ? null : String(event.arc.id))
              }
              paint={{ "line-width": ["get", "weight"], "line-opacity": selected ? 0.3 : 0.75 }}
            />
            {selectedArc.length > 0 ? (
              <MapArc data={selectedArc} interactive={false} paint={{ "line-width": 6 }} />
            ) : null}
            {hubs.map((hub) => (
              <MapMarker key={hub.id} latitude={hub.at[1]} longitude={hub.at[0]}>
                <MapMarkerContent>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "block rounded-full border-2 border-background bg-primary shadow-sm",
                      hub.role === "hub" ? "size-4" : "size-2.5",
                    )}
                  />
                </MapMarkerContent>
                <MapMarkerTooltip>{hub.name}</MapMarkerTooltip>
                {hub.role === "hub" ? (
                  <MapMarkerLabel position="top">{hub.name}</MapMarkerLabel>
                ) : null}
              </MapMarker>
            ))}
            <MapControls position="bottom-right" showCompass />
          </MapCanvas>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-t border-border p-5 @3xl:w-80 @3xl:border-s @3xl:border-t-0">
          <header className="flex flex-col gap-1">
            <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
              Long-haul network · this quarter
            </p>
            <h2 className="text-subtitle font-semibold text-balance">
              {number.format(total)} containers on {lanes.length} lanes,{" "}
              {late.length === 0 ? "all on time" : `${late.length} running late`}
            </h2>
          </header>
          <ul className="flex flex-col gap-1">
            {ranked.map((lane) => {
              const isLate = lane.onTime < onTimeFloor;
              const active = lane.id === selected;
              return (
                <li key={lane.id}>
                  <button
                    aria-pressed={active}
                    className={cn(
                      "flex w-full flex-col gap-1.5 rounded-md px-2.5 py-2 text-start focus-ring hover:bg-accent",
                      active && "bg-accent",
                    )}
                    onClick={() => setSelected(active ? null : lane.id)}
                    type="button"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-body font-medium">{laneName(lane)}</span>
                      {isLate ? <Badge variant="warning">{lane.onTime}% on time</Badge> : null}
                    </span>
                    <Meter
                      aria-label={`${laneName(lane)}: ${number.format(lane.volume)} containers`}
                      max={peak}
                      size="xs"
                      value={lane.volume}
                    />
                    <span className="flex justify-between text-caption text-muted-foreground tabular-nums">
                      <span>{number.format(lane.volume)} containers</span>
                      <span>
                        {lane.transitDays} days{isLate ? "" : ` · ${lane.onTime}% on time`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </section>
  );
}
