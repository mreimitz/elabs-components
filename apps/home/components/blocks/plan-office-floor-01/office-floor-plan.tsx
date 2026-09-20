// registry: plan-office-floor-01 — copied 2026-09-20
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapCanvas,
  MapControls,
  MapGeoJSON,
  MapPlanImage,
  MapPlanOverlay,
  MapPlanStatus,
  MapPlanTable,
  planRegionsFromGeoJSON,
  usePlanSelection,
  useTokenColor,
  type MapPlanRegion,
  type PlanStatus,
} from "@elabs-ai/components-maps";
import { Button, StatePanel } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

import {
  OFFICE_FLOOR_EXTENT,
  officeFloorCorridor,
  officeFloorRooms,
  officeFloorShell,
  secondFloorRooms,
  type RoomProperties,
} from "./data/office-floor";

type RoomData = GeoJSON.FeatureCollection<GeoJSON.Polygon, RoomProperties>;

const EMPTY_FLOOR: RoomData = { type: "FeatureCollection", features: [] };

/** A room is free or in use — two of the four plan states, with their own words. */
const ROOM_STATE: Partial<Record<PlanStatus, string>> = { free: "free", occupied: "in use" };

export interface OfficeFloorPlanProps {
  /** Which level is shown first. The switch above the plan changes it. */
  level?: 3 | 4;
  /**
   * Show the floor with no rooms on it — the state a building with no survey data is
   * in. Swap `data/office-floor.ts` for your own rooms once you have copied the block.
   */
  empty?: boolean;
  /**
   * Lay the surveyor’s drawing under the rooms — the custom background picture in
   * plan units. Held at low opacity: the drawing is context, the rooms are the ink.
   */
  showDrawing?: boolean;
  /** No data yet: the plan keeps its shape and says so once. */
  loading?: boolean;
  className?: string;
}

/**
 * Which desks and rooms are free on a floor, drawn in the building’s own
 * centimetres rather than on a world map: `MapCanvas plan` declares the extent
 * once and every shape after it is written in plan units.
 */
export function OfficeFloorPlan({
  level: initialLevel = 3,
  empty = false,
  showDrawing = false,
  loading = false,
  className,
}: OfficeFloorPlanProps) {
  const [level, setLevel] = useState<3 | 4>(initialLevel);
  const rooms = empty ? EMPTY_FLOOR : level === 3 ? officeFloorRooms : secondFloorRooms;

  const regions = useMemo(
    () =>
      planRegionsFromGeoJSON(rooms, {
        id: "id",
        label: "name",
        description: (properties) =>
          `${ROOM_STATE[properties.status]}, ${properties.kind}, ${properties.seats} seats`,
      }),
    [rooms],
  );

  const selection = usePlanSelection();
  const [activeId, setActiveId] = useState<string | null>(null);

  const selected = rooms.features.find(
    (feature) => feature.properties.id === selection.selectedId,
  )?.properties;
  const free = rooms.features.filter((feature) => feature.properties.status === "free").length;

  const roomState = (region: MapPlanRegion) =>
    rooms.features.find((feature) => feature.properties.id === region.id)?.properties.status;

  if (!loading && rooms.features.length === 0) {
    return (
      <div className={cn("grid h-full place-items-center p-8", className)}>
        <StatePanel
          kind="empty"
          title="No rooms on this floor"
          description="Pick another level, or import the floor’s rooms to see them here."
        />
      </div>
    );
  }

  return (
    <div data-slot="office-floor-plan" className={cn("flex h-full flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {([3, 4] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={level === value ? "default" : "outline"}
              aria-pressed={level === value}
              onClick={() => setLevel(value)}
            >
              Level {value}
            </Button>
          ))}
        </div>
        <p className="text-meta text-muted-foreground">
          Drawn in centimetres — one rectangle is one room
        </p>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md">
        <MapCanvas blank plan={OFFICE_FLOOR_EXTENT} loading={loading} className="h-full">
          <FloorLayers
            rooms={rooms}
            showDrawing={showDrawing}
            selectedId={selection.selectedIds}
            hoveredId={activeId}
          />
          <MapPlanOverlay
            regions={regions}
            label={`Rooms on level ${level}`}
            selectedId={selection.selectedIds}
            onSelect={(id) => selection.select(id)}
            onActiveChange={setActiveId}
          />
          <MapControls position="top-right" />
        </MapCanvas>
      </div>

      <p className="text-caption text-muted-foreground">
        {selected
          ? `${selected.name}: ${ROOM_STATE[selected.status]}, ${selected.kind}, ${selected.seats} seats.`
          : "Select a room — click it, or Tab into the plan and use the arrow keys."}
      </p>

      <MapPlanStatus
        message={
          selected
            ? `${selected.name} selected, ${ROOM_STATE[selected.status]}.`
            : `${free} of ${rooms.features.length} rooms free on level ${level}.`
        }
      />

      <div className="max-h-56 min-h-0 overflow-auto">
        <MapPlanTable
          regions={regions}
          caption={`Every room on level ${level}, with its state`}
          nameHeader="Room"
          status={roomState}
          statusLabels={ROOM_STATE}
          statusHeader="State"
          selectedId={selection.selectedIds}
          onSelect={(id) => selection.select(id)}
          columns={[
            {
              key: "kind",
              header: "Kind",
              cell: (region) =>
                rooms.features.find((feature) => feature.properties.id === region.id)?.properties
                  .kind ?? "",
            },
            {
              key: "seats",
              header: "Seats",
              numeric: true,
              cell: (region) =>
                rooms.features.find((feature) => feature.properties.id === region.id)?.properties
                  .seats ?? 0,
            },
          ]}
        />
      </div>
    </div>
  );
}

/**
 * The shapes, inside the canvas: `useTokenColor` has to run under `MapCanvas`,
 * since a WebGL paint is a concrete colour resolved from the live theme.
 */
function FloorLayers({
  rooms,
  showDrawing,
  selectedId,
  hoveredId,
}: {
  rooms: RoomData;
  showDrawing: boolean;
  selectedId: readonly string[];
  hoveredId: string | null;
}) {
  const shell = useTokenColor("--muted");
  const outline = useTokenColor("--border-strong");
  const free = useTokenColor("--success");
  const busy = useTokenColor("--muted-foreground");
  const primary = useTokenColor("--primary");
  const drawing = useSurveyDrawing(showDrawing, outline);

  return (
    <>
      {drawing && (
        <MapPlanImage
          id="survey"
          src={drawing}
          alt="Surveyor’s drawing of this level, one square per metre"
          opacity={0.3}
          resampling="nearest"
        />
      )}
      <MapGeoJSON
        id="shell"
        data={officeFloorShell}
        interactive={false}
        fillPaint={{ "fill-color": shell, "fill-opacity": 0.5 }}
        linePaint={{ "line-color": outline, "line-width": 2 }}
      />
      <MapGeoJSON<RoomProperties>
        id="rooms"
        data={rooms}
        promoteId="id"
        selectedId={selectedId}
        hoveredId={hoveredId}
        fillPaint={{
          "fill-color": ["case", ["==", ["get", "status"], "free"], free, busy] as never,
          "fill-opacity": 0.18,
        }}
        fillHoverPaint={{ "fill-opacity": 0.3 }}
        fillSelectedPaint={{ "fill-opacity": 0.45, "fill-color": primary }}
        // The state also rides the OUTLINE as a dash, so free and in use stay apart in
        // greyscale. A dash reads feature properties, never feature-state — which is why
        // selection never touches it.
        linePaint={{
          "line-color": outline,
          "line-width": 1.5,
          "line-dasharray": [
            "case",
            ["==", ["get", "status"], "free"],
            ["literal", [1, 0]],
            ["literal", [3, 2]],
          ] as never,
        }}
        lineSelectedPaint={{ "line-color": primary, "line-width": 3 }}
      />
      <MapGeoJSON
        id="corridor"
        data={officeFloorCorridor}
        interactive={false}
        fillPaint={false}
        linePaint={{ "line-color": outline, "line-width": 1, "line-opacity": 0.6 }}
      />
    </>
  );
}

/**
 * Stands in for the scan or CAD export a real building has: a metre grid drawn onto
 * a canvas, which `MapPlanImage` takes as-is. Swap it for `src="/level-3.png"` and
 * nothing else changes.
 */
function useSurveyDrawing(enabled: boolean, ink: string) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) {
      setDrawing(null);
      return;
    }
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvasRef.current = canvas;
    canvas.width = OFFICE_FLOOR_EXTENT.width;
    canvas.height = OFFICE_FLOOR_EXTENT.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = ink;
    context.lineWidth = 2;
    for (let x = 0; x <= canvas.width; x += 100) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 100) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }
    setDrawing(canvas);
  }, [enabled, ink]);

  return drawing;
}
