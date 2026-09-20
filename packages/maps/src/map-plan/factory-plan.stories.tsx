import { useEffect, useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { resolveTokenColor } from "@elabs-ai/components-tokens";

import { MapCanvas } from "../map-canvas";
import { MapControls } from "../map-controls";
import { MapGeoJSON } from "../map-geojson";
import { planRegionsFromGeoJSON, type MapPlanRegion } from "../lib/plan-regions";
import { usePlanPatterns, planPatternImageId } from "../lib/plan-patterns";
import {
  PLAN_FILL_OPACITY,
  PLAN_STATUS_ENCODING,
  planStatusMatch,
  type PlanStatus,
} from "../lib/plan-status";
import { useMap } from "../map-canvas/map-context";
import { MapPlanLegend } from "./map-plan-legend";
import { MapPlanOverlay } from "./map-plan-overlay";
import { MapPlanStatus } from "./map-plan-status";
import { MapPlanTable } from "./map-plan-table";
import { usePlanSelection } from "./use-plan-selection";
import {
  FACTORY_FLOOR_EXTENT,
  factoryFloorAisles,
  factoryFloorCells,
  factoryFloorShell,
  type CellProperties,
} from "./fixtures/factory-floor";

/** WebGL cannot read CSS variables; Storybook stamps `data-theme` after first paint. */
function useThemedTokenColor(name: string): string {
  const [color, setColor] = useState("#000000");
  useEffect(() => {
    const update = () => setColor(resolveTokenColor(name));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  }, [name]);
  return color;
}

const STATUS_LABELS: Record<PlanStatus, string> = {
  free: "Idle",
  occupied: "Running",
  warning: "Needs attention",
  down: "Stopped",
};

/** Registers the generated hatch tiles on the map the moment it is ready. */
function PlanPatterns() {
  const { map, isLoaded } = useMap();
  const ink = useThemedTokenColor("--foreground");
  usePlanPatterns(map, isLoaded, ink);
  return null;
}

const meta = {
  title: "Maps/Factory Plan",
  component: MapPlanLegend,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A plant floor in metres, with status carried by three channels at once: tone, a generated hatch texture and the outline style — plus the word, in the legend and the table. Status rides feature properties; hover and selection ride feature-state, so the two can never collide.",
      },
    },
  },
} satisfies Meta<typeof MapPlanLegend>;
export default meta;
type Story = StoryObj<typeof meta>;

function statusOf(cells: GeoJSON.FeatureCollection<GeoJSON.Polygon, CellProperties>) {
  const index = new Map<string, PlanStatus>();
  for (const feature of cells.features) index.set(feature.properties.id, feature.properties.status);
  return (region: MapPlanRegion) => index.get(region.id);
}

function FactoryFloorDemo({ tick = 0 }: { tick?: number }) {
  const cells = useMemo(() => factoryFloorCells(tick), [tick]);
  const regions = useMemo(
    () =>
      planRegionsFromGeoJSON(cells, {
        id: "id",
        label: "name",
        description: (properties) =>
          `${STATUS_LABELS[properties.status]}, ${properties.throughput} units per hour`,
        group: "line",
        groupLabel: "line",
      }),
    [cells],
  );

  const selection = usePlanSelection();
  const [activeId, setActiveId] = useState<string | null>(null);

  const hall = useThemedTokenColor("--muted");
  const outline = useThemedTokenColor("--border-strong");
  const primary = useThemedTokenColor("--primary");
  const free = useThemedTokenColor("--success");
  const busy = useThemedTokenColor("--muted-foreground");
  const warning = useThemedTokenColor("--warning");
  const down = useThemedTokenColor("--destructive");

  const toneByStatus: Record<PlanStatus, string> = {
    free,
    occupied: busy,
    warning,
    down,
  };

  const counts = useMemo(() => {
    const tally: Partial<Record<PlanStatus, number>> = {};
    for (const feature of cells.features) {
      const status = feature.properties.status;
      tally[status] = (tally[status] ?? 0) + 1;
    }
    return tally;
  }, [cells]);

  // Only the textured statuses reach the pattern layer: an empty image id is
  // not a "no texture" value in MapLibre, it is a missing image.
  const texturedCells = useMemo(
    () => ({
      ...cells,
      features: cells.features.filter(
        (feature) => PLAN_STATUS_ENCODING[feature.properties.status].pattern !== "none",
      ),
    }),
    [cells],
  );

  const stopped = cells.features.filter((feature) => feature.properties.status === "down").length;
  const selected = cells.features.find(
    (feature) => feature.properties.id === selection.selectedId,
  )?.properties;

  return (
    <div className="flex h-[640px] flex-col gap-3 p-4">
      <MapPlanLegend
        labels={STATUS_LABELS}
        counts={counts}
        label="What each cell’s appearance means"
      />

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md">
        <MapCanvas blank plan={FACTORY_FLOOR_EXTENT} className="h-full">
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
            selectedId={selection.selectedIds}
            hoveredId={activeId}
            fillPaint={{
              "fill-color": planStatusMatch(
                "status",
                (_encoding, status) => toneByStatus[status],
              ) as never,
              "fill-opacity": PLAN_FILL_OPACITY.rest,
            }}
            fillHoverPaint={{ "fill-opacity": PLAN_FILL_OPACITY.hover }}
            fillSelectedPaint={{ "fill-opacity": PLAN_FILL_OPACITY.selected }}
            // Outline: the full-opacity tone, plus the dash — the status channel.
            linePaint={{
              "line-color": planStatusMatch(
                "status",
                (_encoding, status) => toneByStatus[status],
              ) as never,
              "line-width": 1.75,
              "line-dasharray": planStatusMatch("status", (encoding) => [
                "literal",
                encoding.dashArray ?? [1, 0],
              ]) as never,
            }}
            lineSelectedPaint={{ "line-color": primary, "line-width": 3.5 }}
          />
          {/* Texture: a generated hatch, keyed on the status PROPERTY. A pattern
              ignores `fill-color`, which is why it is its own layer. */}
          <MapGeoJSON<CellProperties>
            id="cells-texture"
            data={texturedCells}
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
            promoteId="id"
            fillPaint={false}
            linePaint={{
              "line-color": outline,
              "line-width": 1,
              "line-opacity": 0.5,
              "line-dasharray": [2, 2],
            }}
          />
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
          ? `${selected.name}: ${STATUS_LABELS[selected.status]}, ${selected.throughput} units per hour.`
          : "Select a cell — click it, or Tab into the plan and use the arrow keys."}
      </p>

      <MapPlanStatus
        message={
          stopped === 0
            ? "Every cell is running or idle."
            : `${stopped} cell${stopped === 1 ? "" : "s"} stopped.`
        }
      />

      <div className="min-h-0 overflow-auto">
        <MapPlanTable
          regions={regions}
          caption="Every machine cell, with its state and throughput"
          nameHeader="Cell"
          status={statusOf(cells)}
          statusLabels={STATUS_LABELS}
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

/**
 * The default is STATIC: one deterministic moment of the plant, so the story is
 * reproducible and a screenshot means something.
 */
export const FactoryFloor: Story = {
  render: () => <FactoryFloorDemo />,
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("button", { name: /^Cell A1, /, exact: false }),
    ).toBeInTheDocument();
    // The legend and the table repeat every status as a word — the greyscale and
    // the assistive-technology channel in one.
    await expect(
      canvas.getByRole("list", { name: "What each cell’s appearance means" }),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("table", { name: /Every machine cell/ })).toBeInTheDocument();
  },
};

/**
 * The same plant, ticking. Each tick walks the same seeded sequence forward, so
 * “live” never means “different every run”.
 */
export const LiveStatus: Story = {
  render: () => {
    function Demo() {
      const [tick, setTick] = useState(0);
      useEffect(() => {
        const timer = setInterval(() => setTick((value) => value + 1), 3000);
        return () => clearInterval(timer);
      }, []);
      return <FactoryFloorDemo tick={tick} />;
    }
    return <Demo />;
  },
};

/** The plan alone, with no status at all — the shape of a bare plant floor. */
export const ShapesOnly: Story = {
  render: () => {
    function Demo() {
      const outline = useThemedTokenColor("--border-strong");
      const hall = useThemedTokenColor("--muted");
      return (
        <div className="h-[420px] p-4">
          <MapCanvas blank plan={FACTORY_FLOOR_EXTENT} className="h-full">
            <MapGeoJSON
              id="hall"
              data={factoryFloorShell}
              interactive={false}
              fillPaint={{ "fill-color": hall, "fill-opacity": 0.4 }}
              linePaint={{ "line-color": outline, "line-width": 2 }}
            />
            <MapGeoJSON
              id="cells"
              data={factoryFloorCells()}
              promoteId="id"
              fillPaint={false}
              linePaint={{ "line-color": outline, "line-width": 1.5 }}
            />
            <MapControls position="top-right" />
          </MapCanvas>
        </div>
      );
    }
    return <Demo />;
  },
};

/** Status as words only — what the plan looks like on paper, where WebGL prints blank. */
export const PrintTable: Story = {
  render: () => {
    function Demo() {
      const cells = factoryFloorCells();
      const regions = planRegionsFromGeoJSON(cells, { id: "id", label: "name" });
      return (
        <div className="space-y-3 p-4">
          <p className="text-caption text-muted-foreground">
            A WebGL canvas prints blank, so a plan meant for paper carries its own table. This one
            is shown here; in a printed plan it would be <code>hidden print:block</code>.
          </p>
          <MapPlanTable
            regions={regions}
            caption="Every machine cell, with its state"
            nameHeader="Cell"
            status={statusOf(cells)}
            statusLabels={STATUS_LABELS}
            statusHeader="State"
          />
        </div>
      );
    }
    return <Demo />;
  },
};

/** Every status, side by side, at the size a legend swatch is actually read at. */
export const StatusEncoding: Story = {
  render: () => (
    <div className="space-y-4 p-4">
      <MapPlanLegend labels={STATUS_LABELS} label="Every status" />
      <ul className="space-y-2 text-caption">
        {(Object.keys(STATUS_LABELS) as PlanStatus[]).map((status) => {
          const encoding = PLAN_STATUS_ENCODING[status];
          return (
            <li key={status} className="flex items-center gap-3">
              <span className={`w-36 ${encoding.textClass}`}>{STATUS_LABELS[status]}</span>
              <span className="text-muted-foreground">texture: {encoding.pattern}</span>
              <span className="text-muted-foreground">outline: {encoding.dash}</span>
              <span className="text-muted-foreground">glyph: {encoding.glyph}</span>
            </li>
          );
        })}
      </ul>
    </div>
  ),
};
