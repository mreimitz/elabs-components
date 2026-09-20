// registry: plan-seat-map-01 — copied 2026-09-20
"use client";

import { useMemo, useState } from "react";
import {
  MapArc,
  MapCanvas,
  MapControls,
  MapGeoJSON,
  MapPlanLegend,
  MapPlanOverlay,
  MapPlanStatus,
  MapPlanTable,
  MapRoute,
  PLAN_FILL_OPACITY,
  planRegionsFromGeoJSON,
  planStatusMatch,
  usePlanSelection,
  useTokenColor,
  type MapPlanOverlayMode,
  type MapPlanRegion,
  type PlanStatus,
} from "@elabs-ai/components-maps";
import { StatePanel } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

import {
  TRAIN_CARRIAGE_EXTENT,
  TRAIN_SEAT_UNIT,
  trainCarriageAisles,
  trainCarriageSeats,
  trainCarriageShells,
  trainCarriageWalk,
  type SeatProperties,
} from "./data/train-carriage";

type SeatData = GeoJSON.FeatureCollection<GeoJSON.Polygon, SeatProperties>;

const SEAT_STATE: Partial<Record<PlanStatus, string>> = {
  free: "Free",
  occupied: "Booked",
  warning: "Held",
  down: "Out of service",
};

export interface TrainSeatMapProps {
  /**
   * `"groups"` (default) puts one button on each coach and `Enter` goes in — the
   * answer for 192 seats, which no one reaches by pressing Tab. `"regions"` puts
   * every seat on the overlay at once.
   */
  mode?: MapPlanOverlayMode;
  /**
   * Draw the direction of travel along each aisle and the walk from the door of
   * coach A to a seat in coach C.
   */
  showWalk?: boolean;
  /** The seats. Defaults to one deterministic train. */
  seats?: SeatData;
  className?: string;
}

/**
 * A reservation seat map: three coaches of 64 seats, drawn in centimetres in the
 * train’s own coordinates. The overlay works the way a passenger does — which
 * coach first, which seat second.
 */
export function TrainSeatMap({
  mode = "groups",
  showWalk = false,
  seats: seatsProp,
  className,
}: TrainSeatMapProps) {
  const seats = useMemo(() => seatsProp ?? trainCarriageSeats(), [seatsProp]);
  const regions = useMemo(
    () =>
      planRegionsFromGeoJSON(seats, {
        id: "id",
        label: "seat",
        description: (properties) =>
          `${properties.position}, ${(SEAT_STATE[properties.status] ?? "").toLowerCase()}`,
        group: "coach",
        groupLabel: "coachLabel",
      }),
    [seats],
  );

  const selection = usePlanSelection();
  const [activeId, setActiveId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const tally: Partial<Record<PlanStatus, number>> = {};
    for (const feature of seats.features) {
      const status = feature.properties.status;
      tally[status] = (tally[status] ?? 0) + 1;
    }
    return tally;
  }, [seats]);

  const selected = seats.features.find(
    (feature) => feature.properties.id === selection.selectedId,
  )?.properties;

  const seatState = (region: MapPlanRegion) =>
    seats.features.find((feature) => feature.properties.id === region.id)?.properties.status;

  if (seats.features.length === 0) {
    return (
      <div className={cn("grid h-full place-items-center p-8", className)}>
        <StatePanel
          kind="empty"
          title="No seat map for this service"
          description="This train has no seat reservations, so there is nothing to lay out."
        />
      </div>
    );
  }

  return (
    <div data-slot="train-seat-map" className={cn("flex h-full flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MapPlanLegend labels={SEAT_STATE} counts={counts} label="What each seat’s state means" />
        <p className="text-meta text-muted-foreground">{TRAIN_SEAT_UNIT}</p>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md">
        <MapCanvas blank plan={TRAIN_CARRIAGE_EXTENT} className="h-full">
          <SeatLayers
            seats={seats}
            selectedId={selection.selectedIds}
            hoveredId={activeId}
            showWalk={showWalk}
          />
          <MapPlanOverlay
            regions={regions}
            label="Seats on this train"
            mode={mode}
            describeGroup={(group) => `${group.members.length} seats`}
            showLabels={mode === "groups"}
            selectedId={selection.selectedIds}
            onSelect={(id) => selection.select(id)}
            onActiveChange={setActiveId}
          />
          <MapControls position="top-right" />
        </MapCanvas>
      </div>

      <p className="text-caption text-muted-foreground">
        {selected
          ? `Seat ${selected.seat} in ${selected.coachLabel}: ${(SEAT_STATE[selected.status] ?? "").toLowerCase()}, ${selected.position} seat.`
          : mode === "groups"
            ? "Pick a coach — click it, or Tab into the plan and press Enter to go in. Escape comes back out."
            : "Pick a seat — click it, or Tab into the plan and use the arrow keys."}
      </p>

      <MapPlanStatus
        message={
          selected
            ? `Seat ${selected.seat} in ${selected.coachLabel} selected.`
            : `${counts.free ?? 0} of ${seats.features.length} seats free.`
        }
      />

      <div className="max-h-48 min-h-0 overflow-auto">
        <MapPlanTable
          regions={regions}
          caption={`Every seat on the train, with its state (${TRAIN_SEAT_UNIT})`}
          nameHeader="Seat"
          status={seatState}
          statusLabels={SEAT_STATE}
          statusHeader="State"
          selectedId={selection.selectedIds}
          onSelect={(id) => selection.select(id)}
          columns={[
            {
              key: "coach",
              header: "Coach",
              cell: (region) =>
                seats.features.find((feature) => feature.properties.id === region.id)?.properties
                  .coachLabel ?? "",
            },
            {
              key: "position",
              header: "Side",
              cell: (region) =>
                seats.features.find((feature) => feature.properties.id === region.id)?.properties
                  .position ?? "",
            },
          ]}
        />
      </div>
    </div>
  );
}

/** The shapes, and the walk through them. Token colours resolve against the live map. */
function SeatLayers({
  seats,
  selectedId,
  hoveredId,
  showWalk,
}: {
  seats: SeatData;
  selectedId: readonly string[];
  hoveredId: string | null;
  showWalk: boolean;
}) {
  const body = useTokenColor("--muted");
  const outline = useTokenColor("--border-strong");
  const primary = useTokenColor("--primary");
  const free = useTokenColor("--success");
  const booked = useTokenColor("--muted-foreground");
  const held = useTokenColor("--warning");
  const out = useTokenColor("--destructive");

  const tone: Record<PlanStatus, string> = { free, occupied: booked, warning: held, down: out };

  return (
    <>
      <MapGeoJSON
        id="coaches"
        data={trainCarriageShells}
        interactive={false}
        fillPaint={{ "fill-color": body, "fill-opacity": 0.35 }}
        linePaint={{ "line-color": outline, "line-width": 2 }}
      />
      <MapGeoJSON
        id="aisles"
        data={trainCarriageAisles}
        interactive={false}
        fillPaint={false}
        linePaint={{
          "line-color": outline,
          "line-width": 1,
          "line-opacity": 0.5,
          "line-dasharray": [2, 2],
        }}
      />
      <MapGeoJSON<SeatProperties>
        id="seats"
        data={seats}
        promoteId="id"
        selectedId={selectedId}
        hoveredId={hoveredId}
        fillPaint={{
          "fill-color": planStatusMatch("status", (_encoding, status) => tone[status]) as never,
          "fill-opacity": PLAN_FILL_OPACITY.rest,
        }}
        fillHoverPaint={{ "fill-opacity": PLAN_FILL_OPACITY.hover }}
        fillSelectedPaint={{ "fill-opacity": PLAN_FILL_OPACITY.selected }}
        linePaint={{
          "line-color": planStatusMatch("status", (_encoding, status) => tone[status]) as never,
          "line-width": 1.5,
          "line-dasharray": planStatusMatch("status", (encoding) => [
            "literal",
            encoding.dashArray ?? [1, 0],
          ]) as never,
        }}
        lineSelectedPaint={{ "line-color": primary, "line-width": 3 }}
      />
      {showWalk && (
        <>
          {/* Chevrons along the aisle: an icon generated on a canvas, because a blank
              style ships no glyph endpoint and text on a symbol layer draws nothing. */}
          <MapRoute
            id="walk"
            coordinates={trainCarriageWalk}
            color={primary}
            width={2.5}
            direction="forward"
            directionSpacing={70}
          />
          {/* Sampled in PLAN units, then converted: a curve built in lng/lat bows the
              wrong way once Mercator has had its say. */}
          <MapArc
            id="transfer"
            data={[{ id: "a-to-c", from: [220, 240], to: [2400, 1130] }]}
            curvature={0.25}
            paint={{ "line-color": primary, "line-width": 2, "line-dasharray": [2, 2] }}
          />
        </>
      )}
    </>
  );
}
