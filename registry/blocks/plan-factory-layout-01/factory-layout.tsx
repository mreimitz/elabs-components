"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapCanvas,
  MapControls,
  MapGeoJSON,
  MapPlanLegend,
  MapPlanOverlay,
  MapPlanStatus,
  MapPlanTable,
  PLAN_FILL_OPACITY,
  PLAN_STATUS_ENCODING,
  planPatternImageId,
  planRegionsFromGeoJSON,
  planStatusMatch,
  useMap,
  usePlanPatterns,
  usePlanSelection,
  useTokenColor,
  type MapPlanRegion,
  type PlanStatus,
} from "@elabs-ai/components-maps";
import { cn } from "@elabs-ai/components-ui/lib/cn";

import {
  FACTORY_FLOOR_EXTENT,
  factoryFloorAisles,
  factoryFloorCells,
  factoryFloorShell,
  type CellProperties,
} from "./data/factory-floor";

type CellData = GeoJSON.FeatureCollection<GeoJSON.Polygon, CellProperties>;

const CELL_STATE: Partial<Record<PlanStatus, string>> = {
  free: "Idle",
  occupied: "Running",
  warning: "Needs attention",
  down: "Stopped",
};

export interface FactoryLayoutProps {
  /**
   * Advance the plant through its seeded sequence on a timer. Off by default, so a
   * screenshot of this block always shows the same floor.
   */
  live?: boolean;
  /** How often a live floor ticks, in milliseconds. */
  tickMs?: number;
  className?: string;
}

/**
 * A plant floor in metres, where every machine cell carries its state in four
 * channels at once: tone, a generated hatch texture, the outline style and the
 * word. State rides feature properties; hover and selection ride feature-state,
 * so the two can never overwrite each other.
 */
export function FactoryLayout({ live = false, tickMs = 3000, className }: FactoryLayoutProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setTick((value) => value + 1), tickMs);
    return () => clearInterval(timer);
  }, [live, tickMs]);

  const cells = useMemo(() => factoryFloorCells(tick), [tick]);
  const regions = useMemo(
    () =>
      planRegionsFromGeoJSON(cells, {
        id: "id",
        label: "name",
        description: (properties) =>
          `${CELL_STATE[properties.status]}, ${properties.throughput} units per hour`,
        group: "line",
        groupLabel: "line",
      }),
    [cells],
  );

  const selection = usePlanSelection();
  const [activeId, setActiveId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const tally: Partial<Record<PlanStatus, number>> = {};
    for (const feature of cells.features) {
      const status = feature.properties.status;
      tally[status] = (tally[status] ?? 0) + 1;
    }
    return tally;
  }, [cells]);

  const stopped = counts.down ?? 0;
  const selected = cells.features.find(
    (feature) => feature.properties.id === selection.selectedId,
  )?.properties;

  const cellState = (region: MapPlanRegion) =>
    cells.features.find((feature) => feature.properties.id === region.id)?.properties.status;

  return (
    <div data-slot="factory-layout" className={cn("flex h-full flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MapPlanLegend
          labels={CELL_STATE}
          counts={counts}
          label="What each cell’s appearance means"
        />
        <p className="text-meta text-muted-foreground">
          Drawn in metres — one rectangle is one machine cell
        </p>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md">
        <MapCanvas blank plan={FACTORY_FLOOR_EXTENT} className="h-full">
          <CellLayers cells={cells} selectedId={selection.selectedIds} hoveredId={activeId} />
          <MapPlanOverlay
            regions={regions}
            label="Machine cells on the plant floor"
            selectedId={selection.selectedIds}
            onSelect={(id) => selection.select(id)}
            onActiveChange={setActiveId}
          />
          <MapControls position="top-right" />
        </MapCanvas>
      </div>

      <p className="text-caption text-muted-foreground">
        {selected
          ? `${selected.name}: ${CELL_STATE[selected.status]}, ${selected.throughput} units per hour.`
          : "Select a cell — click it, or Tab into the plan and use the arrow keys."}
      </p>

      <MapPlanStatus
        message={
          stopped === 0
            ? "Every cell is running or idle."
            : `${stopped} cell${stopped === 1 ? "" : "s"} stopped.`
        }
      />

      <div className="max-h-56 min-h-0 overflow-auto">
        <MapPlanTable
          regions={regions}
          caption="Every machine cell, with its state and throughput"
          nameHeader="Cell"
          status={cellState}
          statusLabels={CELL_STATE}
          statusHeader="State"
          selectedId={selection.selectedIds}
          onSelect={(id) => selection.select(id)}
          columns={[
            {
              key: "line",
              header: "Line",
              cell: (region) =>
                cells.features.find((feature) => feature.properties.id === region.id)?.properties
                  .line ?? "",
            },
            {
              key: "throughput",
              header: "Units / hour",
              numeric: true,
              cell: (region) =>
                cells.features.find((feature) => feature.properties.id === region.id)?.properties
                  .throughput ?? 0,
            },
          ]}
        />
      </div>
    </div>
  );
}

/** The hatch tiles, generated on a canvas and registered on the map itself. */
function PlanPatterns() {
  const { map, isLoaded } = useMap();
  const ink = useTokenColor("--foreground");
  usePlanPatterns(map, isLoaded, ink);
  return null;
}

/** The shapes. `useTokenColor` runs here because it needs the live map’s theme. */
function CellLayers({
  cells,
  selectedId,
  hoveredId,
}: {
  cells: CellData;
  selectedId: readonly string[];
  hoveredId: string | null;
}) {
  const hall = useTokenColor("--muted");
  const outline = useTokenColor("--border-strong");
  const primary = useTokenColor("--primary");
  const free = useTokenColor("--success");
  const busy = useTokenColor("--muted-foreground");
  const warning = useTokenColor("--warning");
  const down = useTokenColor("--destructive");

  const tone: Record<PlanStatus, string> = { free, occupied: busy, warning, down };

  // Only the textured states reach the pattern layer: in MapLibre an empty image id is
  // a MISSING image, not a "no texture" value.
  const textured = useMemo(
    () => ({
      ...cells,
      features: cells.features.filter(
        (feature) => PLAN_STATUS_ENCODING[feature.properties.status].pattern !== "none",
      ),
    }),
    [cells],
  );

  return (
    <>
      <PlanPatterns />
      <MapGeoJSON
        id="hall"
        data={factoryFloorShell}
        interactive={false}
        fillPaint={{ "fill-color": hall, "fill-opacity": 0.4 }}
        linePaint={{ "line-color": outline, "line-width": 2 }}
      />
      {/* Tone wash: the feature-state channel (hover, selected). */}
      <MapGeoJSON<CellProperties>
        id="cells"
        data={cells}
        promoteId="id"
        selectedId={selectedId}
        hoveredId={hoveredId}
        fillPaint={{
          "fill-color": planStatusMatch("status", (_encoding, status) => tone[status]) as never,
          "fill-opacity": PLAN_FILL_OPACITY.rest,
        }}
        fillHoverPaint={{ "fill-opacity": PLAN_FILL_OPACITY.hover }}
        fillSelectedPaint={{ "fill-opacity": PLAN_FILL_OPACITY.selected }}
        // Outline: the full-opacity tone, plus the dash — the state channel.
        linePaint={{
          "line-color": planStatusMatch("status", (_encoding, status) => tone[status]) as never,
          "line-width": 1.75,
          "line-dasharray": planStatusMatch("status", (encoding) => [
            "literal",
            encoding.dashArray ?? [1, 0],
          ]) as never,
        }}
        lineSelectedPaint={{ "line-color": primary, "line-width": 3.5 }}
      />
      {/* Texture: its own layer, because a pattern ignores `fill-color`. */}
      <MapGeoJSON<CellProperties>
        id="cells-texture"
        data={textured}
        promoteId="id"
        interactive={false}
        linePaint={false}
        fillPaint={{
          "fill-pattern": planStatusMatch("status", (encoding) =>
            planPatternImageId(encoding.pattern === "none" ? "diagonal" : encoding.pattern),
          ) as never,
        }}
      />
      <MapGeoJSON
        id="aisles"
        data={factoryFloorAisles}
        interactive={false}
        fillPaint={false}
        linePaint={{
          "line-color": outline,
          "line-width": 1,
          "line-opacity": 0.5,
          "line-dasharray": [2, 2],
        }}
      />
    </>
  );
}
