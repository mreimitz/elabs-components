"use client";

import { useState } from "react";
import { Truck, Warehouse } from "lucide-react";
import {
  MapCanvas,
  MapControls,
  MapMarker,
  MapMarkerContent,
  MapMarkerLabel,
  MapMarkerTooltip,
  MapRoute,
} from "@elabs-ai/components-maps";
import { Badge, Meter } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { FLEET_DEPOT, fleetVehicles, type FleetVehicle, type VehicleState } from "./data/fleet";

export interface GeoFleetTrackerProps {
  vehicles?: FleetVehicle[];
  depot?: [number, number];
  /** No basemap tiles — routes on a blank canvas, with no request to a tile server. */
  blank?: boolean;
  className?: string;
}

const STATE_BADGE: Record<VehicleState, "success" | "warning" | "secondary"> = {
  "on route": "success",
  delayed: "warning",
  idle: "secondary",
};

/**
 * The fleet where it is: each vehicle's planned route dashed, the part already driven solid,
 * the vehicle at the join. The list says who is late and by how much; select a vehicle and
 * the others step back.
 */
export function GeoFleetTracker({
  vehicles = fleetVehicles,
  depot = FLEET_DEPOT,
  blank = false,
  className,
}: GeoFleetTrackerProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const delayed = vehicles.filter((vehicle) => vehicle.state === "delayed");
  const done = vehicles.reduce((sum, vehicle) => sum + vehicle.stopsDone, 0);
  const planned = vehicles.reduce((sum, vehicle) => sum + vehicle.stopsTotal, 0);

  return (
    <section
      aria-label="Fleet tracker"
      className={cn("@container h-full min-h-112", className)}
      data-slot="geo-fleet-tracker"
    >
      {/* The query container cannot style itself, so the frame is its first child. */}
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground @3xl:flex-row-reverse">
        <div className="relative min-h-80 min-w-0 flex-1">
          <MapCanvas blank={blank} center={[4.43, 51.905]} zoom={11.4}>
            {vehicles.map((vehicle) => {
              const faded = selected !== null && selected !== vehicle.id;
              return (
                <MapRoute
                  coordinates={vehicle.route}
                  dashArray={[2, 2]}
                  interactive={false}
                  key={`${vehicle.id}-plan`}
                  opacity={faded ? 0.15 : 0.5}
                  width={2}
                />
              );
            })}
            {vehicles.map((vehicle) => {
              const faded = selected !== null && selected !== vehicle.id;
              return vehicle.driven > 1 ? (
                <MapRoute
                  coordinates={vehicle.route.slice(0, vehicle.driven)}
                  key={`${vehicle.id}-driven`}
                  onClick={() => setSelected(selected === vehicle.id ? null : vehicle.id)}
                  opacity={faded ? 0.2 : 0.95}
                  width={4}
                />
              ) : null;
            })}
            <MapMarker latitude={depot[1]} longitude={depot[0]}>
              <MapMarkerContent>
                <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-background shadow-sm">
                  <Warehouse aria-hidden="true" className="size-4" />
                </span>
              </MapMarkerContent>
              <MapMarkerLabel position="bottom">Depot</MapMarkerLabel>
            </MapMarker>
            {vehicles.map((vehicle) => {
              const at = vehicle.route[Math.max(0, vehicle.driven - 1)] ?? depot;
              return (
                <MapMarker
                  key={vehicle.id}
                  latitude={at[1]}
                  longitude={at[0]}
                  onClick={() => setSelected(selected === vehicle.id ? null : vehicle.id)}
                >
                  <MapMarkerContent>
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded-full border-2 border-background shadow-sm",
                        vehicle.state === "delayed"
                          ? "bg-warning text-warning-foreground"
                          : "bg-primary text-primary-foreground",
                      )}
                    >
                      <Truck aria-hidden="true" className="size-3.5" />
                    </span>
                  </MapMarkerContent>
                  <MapMarkerTooltip>
                    {vehicle.id} · {vehicle.driver}
                  </MapMarkerTooltip>
                </MapMarker>
              );
            })}
            <MapControls position="bottom-right" />
          </MapCanvas>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-t border-border p-5 @3xl:w-80 @3xl:border-e @3xl:border-t-0">
          <header className="flex flex-col gap-1">
            <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
              Rotterdam last mile · this morning
            </p>
            <h2 className="text-subtitle font-semibold text-balance">
              {done} of {planned} stops done,{" "}
              {delayed.length === 0
                ? "nobody is late"
                : `${delayed.map((vehicle) => vehicle.id).join(" and ")} ${delayed.length === 1 ? "is" : "are"} running late`}
            </h2>
          </header>
          <ul className="flex flex-col gap-1">
            {vehicles.map((vehicle) => {
              const active = vehicle.id === selected;
              return (
                <li key={vehicle.id}>
                  <button
                    aria-pressed={active}
                    className={cn(
                      "flex w-full flex-col gap-1.5 rounded-md px-2.5 py-2 text-start focus-ring hover:bg-accent",
                      active && "bg-accent",
                    )}
                    onClick={() => setSelected(active ? null : vehicle.id)}
                    type="button"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-body font-medium">
                        {vehicle.id}{" "}
                        <span className="font-normal text-muted-foreground">{vehicle.driver}</span>
                      </span>
                      <Badge variant={STATE_BADGE[vehicle.state]}>{vehicle.state}</Badge>
                    </span>
                    <Meter
                      aria-label={`${vehicle.id}: ${vehicle.stopsDone} of ${vehicle.stopsTotal} stops done`}
                      max={vehicle.stopsTotal}
                      size="xs"
                      value={vehicle.stopsDone}
                    />
                    <span className="flex justify-between text-caption text-muted-foreground tabular-nums">
                      <span>
                        {vehicle.stopsDone} of {vehicle.stopsTotal} stops
                      </span>
                      <span>
                        {vehicle.state === "idle"
                          ? "not started"
                          : vehicle.minutesLate > 0
                            ? `${vehicle.minutesLate} min late`
                            : vehicle.minutesLate < 0
                              ? `${-vehicle.minutesLate} min ahead`
                              : "on plan"}
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
