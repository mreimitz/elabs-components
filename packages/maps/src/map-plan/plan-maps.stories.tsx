import { useEffect, useMemo, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { resolveTokenColor } from "@elabs-ai/components-tokens";
import { Button, StatePanel } from "@elabs-ai/components-ui";

import { MapCanvas } from "../map-canvas";
import { MapGeoJSON } from "../map-geojson";
import { MapPlanImage } from "../map-plan-image";
import { planRegionsFromGeoJSON } from "../lib/plan-regions";
import { MapPlanOverlay } from "./map-plan-overlay";
import { usePlanSelection } from "./use-plan-selection";
import {
  OFFICE_FLOOR_EXTENT,
  officeFloorCorridor,
  officeFloorRooms,
  officeFloorShell,
  secondFloorRooms,
  type RoomProperties,
} from "./fixtures/office-floor";

/**
 * WebGL paint cannot read CSS variables, and Storybook stamps `data-theme`
 * after the first render — so resolve the token and re-resolve on theme change,
 * the same contract the package's own `useTokenColor` follows.
 */
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

const STATUS_WORD: Record<string, string> = { free: "free", occupied: "in use" };

/** The rooms as overlay regions: one box and one name per room. */
function useRoomRegions(data: GeoJSON.FeatureCollection<GeoJSON.Polygon, RoomProperties>) {
  return useMemo(
    () =>
      planRegionsFromGeoJSON(data, {
        id: "id",
        label: "name",
        description: (properties) =>
          `${STATUS_WORD[properties.status]}, ${properties.kind}, ${properties.seats} seats`,
      }),
    [data],
  );
}

const meta = {
  title: "Maps/Plan Maps",
  component: MapPlanOverlay,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A custom, non-geographic map: a floor plan, a factory layout or a carriage used as the map itself, with the plan’s own coordinate system driving every shape. Declare the extent once on `MapCanvas plan`, then write coordinates in the plan’s units — centimetres here.",
      },
    },
  },
} satisfies Meta<typeof MapPlanOverlay>;
export default meta;
type Story = StoryObj<typeof meta>;

function FloorPlanDemo() {
  const rooms = officeFloorRooms;
  const regions = useRoomRegions(rooms);
  const selection = usePlanSelection();
  const [activeId, setActiveId] = useState<string | null>(null);

  const shell = useThemedTokenColor("--muted");
  const outline = useThemedTokenColor("--border-strong");
  const free = useThemedTokenColor("--success");
  const busy = useThemedTokenColor("--muted-foreground");
  const primary = useThemedTokenColor("--primary");

  const selected = rooms.features.find(
    (feature) => feature.properties.id === selection.selectedId,
  )?.properties;

  return (
    <div className="flex h-[560px] flex-col gap-3 p-4">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md">
        <MapCanvas blank plan={OFFICE_FLOOR_EXTENT} className="h-full">
          {/* The building shell, then the rooms, then the corridor. */}
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
            selectedId={selection.selectedIds}
            hoveredId={activeId}
            fillPaint={{
              "fill-color": ["case", ["==", ["get", "status"], "free"], free, busy] as never,
              "fill-opacity": 0.18,
            }}
            fillHoverPaint={{ "fill-opacity": 0.3 }}
            fillSelectedPaint={{ "fill-opacity": 0.45, "fill-color": primary }}
            // Status also rides the OUTLINE as a dash, so the two states stay
            // apart in greyscale. A dash reads feature properties, never
            // feature-state — which is why selection never touches it.
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
            promoteId="id"
            fillPaint={false}
            linePaint={{ "line-color": outline, "line-width": 1, "line-opacity": 0.6 }}
          />
          <MapPlanOverlay
            regions={regions}
            label="Rooms on level 3"
            selectedId={selection.selectedIds}
            onSelect={(id) => selection.select(id)}
            onActiveChange={setActiveId}
          />
        </MapCanvas>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-caption text-muted-foreground">
        <span>
          Solid outline — <span className="text-success-text">free</span>
        </span>
        <span>Dashed outline — in use</span>
        <span>
          {selected
            ? `${selected.name}: ${STATUS_WORD[selected.status]}, ${selected.seats} seats`
            : "Select a room — click it, or Tab into the plan and use the arrow keys."}
        </span>
      </div>

      <table className="w-full text-caption">
        <caption className="sr-only">Every room on level 3, with its state</caption>
        <thead>
          <tr className="text-start text-muted-foreground">
            <th scope="col" className="py-1 text-start font-medium">
              Room
            </th>
            <th scope="col" className="py-1 text-start font-medium">
              Kind
            </th>
            <th scope="col" className="py-1 text-start font-medium">
              State
            </th>
            <th scope="col" className="py-1 text-end font-medium">
              Seats
            </th>
          </tr>
        </thead>
        <tbody>
          {rooms.features.map((feature) => (
            <tr key={feature.properties.id} className="border-t border-border">
              <td className="py-1">{feature.properties.name}</td>
              <td className="py-1">{feature.properties.kind}</td>
              <td className="py-1">{STATUS_WORD[feature.properties.status]}</td>
              <td className="py-1 text-end tabular-nums">{feature.properties.seats}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The full showcase: an office floor in centimetres, keyboard-operable, with the
 * same information repeated as words in the table below — a WebGL canvas prints
 * blank and cannot be read by assistive technology.
 */
export const OfficeFloorPlan: Story = {
  render: () => <FloorPlanDemo />,
  play: async ({ canvas }) => {
    // The exact accessible name, not a regex: the visible label has to come
    // first (WCAG 2.5.3), and if CI ever fails to hand MapLibre a WebGL context
    // the canvas renders its error panel instead — where this assertion fails
    // rather than passing on nothing.
    await expect(
      await canvas.findByRole("button", { name: "Helsinki, in use, meeting, 10 seats" }),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("list", { name: "Rooms on level 3" })).toBeInTheDocument();
    // The same facts as words, for a surface that prints blank.
    await expect(canvas.getByRole("table", { name: /Every room on level 3/ })).toBeInTheDocument();
  },
};

/**
 * The recommended default: no asset at all. A plan drawn as GeoJSON in plan
 * units paints from tokens, themes correctly and never blurs.
 */
export const VectorOnly: Story = {
  render: () => {
    function Demo() {
      const outline = useThemedTokenColor("--border-strong");
      const fill = useThemedTokenColor("--muted");
      return (
        <div className="h-[420px] p-4">
          <MapCanvas blank plan={OFFICE_FLOOR_EXTENT} className="h-full">
            <MapGeoJSON
              id="rooms"
              data={officeFloorRooms}
              promoteId="id"
              fillPaint={{ "fill-color": fill, "fill-opacity": 0.6 }}
              linePaint={{ "line-color": outline, "line-width": 1.5 }}
            />
          </MapCanvas>
        </div>
      );
    }
    return <Demo />;
  },
};

/**
 * Draw the plan into a canvas and hand that to `MapPlanImage` — the same path a
 * scanned drawing or a CAD export takes, without a network round trip. The
 * picture is context, held back at low opacity; the data on top is the ink.
 */
export const WithPlanImage: Story = {
  render: () => {
    function Demo() {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const [picture, setPicture] = useState<HTMLCanvasElement | null>(null);
      const grid = useThemedTokenColor("--border-strong");
      const outline = useThemedTokenColor("--foreground");

      useEffect(() => {
        const canvas = canvasRef.current ?? document.createElement("canvas");
        canvasRef.current = canvas;
        canvas.width = OFFICE_FLOOR_EXTENT.width;
        canvas.height = OFFICE_FLOOR_EXTENT.height;
        const context = canvas.getContext("2d");
        if (!context) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.strokeStyle = grid;
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
        setPicture(canvas);
      }, [grid]);

      return (
        <div className="h-[420px] p-4">
          <MapCanvas blank plan={OFFICE_FLOOR_EXTENT} className="h-full">
            {picture && (
              <MapPlanImage
                id="drawing"
                src={picture}
                alt="Level 3 survey grid, one square per metre"
                opacity={0.35}
                resampling="nearest"
              />
            )}
            <MapGeoJSON
              id="rooms"
              data={officeFloorRooms}
              promoteId="id"
              fillPaint={false}
              linePaint={{ "line-color": outline, "line-width": 2 }}
            />
          </MapCanvas>
        </div>
      );
    }
    return <Demo />;
  },
};

/** Two floors, one extent: switch the data, keep the camera. */
export const MultiFloor: Story = {
  render: () => {
    function Demo() {
      const [level, setLevel] = useState<3 | 4>(3);
      const rooms = level === 3 ? officeFloorRooms : secondFloorRooms;
      const regions = useRoomRegions(rooms);
      const outline = useThemedTokenColor("--border-strong");
      const fill = useThemedTokenColor("--muted");

      return (
        <div className="flex h-[480px] flex-col gap-3 p-4">
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
          <div className="min-h-0 flex-1 overflow-hidden rounded-md">
            <MapCanvas blank plan={OFFICE_FLOOR_EXTENT} className="h-full">
              <MapGeoJSON
                id="rooms"
                data={rooms}
                promoteId="id"
                fillPaint={{ "fill-color": fill, "fill-opacity": 0.6 }}
                linePaint={{ "line-color": outline, "line-width": 1.5 }}
              />
              <MapPlanOverlay regions={regions} label={`Rooms on level ${level}`} />
            </MapCanvas>
          </div>
        </div>
      );
    }
    return <Demo />;
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("button", { name: /^Helsinki/ })).toBeInTheDocument();
  },
};

/** Nothing to draw yet — the plan’s own skeleton, not a blank rectangle. */
export const Loading: Story = {
  render: () => (
    <div className="h-[420px] p-4">
      <MapCanvas blank plan={OFFICE_FLOOR_EXTENT} loading className="h-full" />
    </div>
  ),
};

/** A plan with no regions on it — say so, rather than showing an empty grid. */
export const EmptyPlan: Story = {
  render: () => (
    <div className="relative h-[420px] p-4">
      <MapCanvas blank plan={OFFICE_FLOOR_EXTENT} className="h-full" />
      <div className="absolute inset-0 grid place-items-center p-8">
        <StatePanel
          kind="empty"
          title="No rooms on this floor"
          description="Pick another level, or import the floor’s rooms to see them here."
        />
      </div>
    </div>
  ),
};

/**
 * The picture failed; the plan did not. `MapPlanImage` reports the failure and
 * keeps the shapes, so the consumer decides what the gap should look like.
 */
export const PlanImageMissing: Story = {
  render: () => {
    function Demo() {
      const [failed, setFailed] = useState(false);
      const outline = useThemedTokenColor("--border-strong");

      return (
        <div className="flex h-[420px] flex-col gap-2 p-4">
          {failed && (
            <StatePanel
              kind="error"
              title="Floor drawing unavailable"
              description="The plan is still usable — every room is drawn from its own coordinates."
            />
          )}
          <div className="min-h-0 flex-1 overflow-hidden rounded-md">
            <MapCanvas blank plan={OFFICE_FLOOR_EXTENT} className="h-full">
              <MapPlanImage
                id="drawing"
                src="./missing-floor-plan.png"
                onError={() => setFailed(true)}
              />
              <MapGeoJSON
                id="rooms"
                data={officeFloorRooms}
                promoteId="id"
                fillPaint={false}
                linePaint={{ "line-color": outline, "line-width": 2 }}
              />
            </MapCanvas>
          </div>
        </div>
      );
    }
    return <Demo />;
  },
};
