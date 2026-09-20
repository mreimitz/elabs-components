import { useEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { StatePanel } from "@elabs-ai/components-ui";

import { MapCanvas } from "../map-canvas";
import { MapGeoJSON } from "../map-geojson";
import { useTokenColor } from "../lib/use-token-color";
import { MapPlanImage } from "./map-plan-image";

/**
 * A small plan, so the story is about the PICTURE rather than about a building:
 * 1200 × 600 of whatever unit the caller works in.
 */
const PLAN = { width: 1200, height: 600, unit: "cm" } as const;

/** Two rooms and a corridor, in plan units — the ink that sits on the picture. */
const SHAPES: GeoJSON.FeatureCollection<GeoJSON.Polygon, { id: string; name: string }> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "west",
      properties: { id: "west", name: "West wing" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [60, 60],
            [560, 60],
            [560, 540],
            [60, 540],
            [60, 60],
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "east",
      properties: { id: "east", name: "East wing" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [640, 60],
            [1140, 60],
            [1140, 540],
            [640, 540],
            [640, 60],
          ],
        ],
      },
    },
  ],
};

/**
 * Stands in for a scan or a CAD export: a grid drawn onto a canvas, which is one of
 * the sources `MapPlanImage` takes as-is. `hue` shifts the drawing so a floor swap
 * is visible without a second asset.
 */
function usePlanDrawing(ink: string, step = 100) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvasRef.current = canvas;
    canvas.width = PLAN.width;
    canvas.height = PLAN.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = ink;
    context.lineWidth = 2;
    for (let x = 0; x <= canvas.width; x += step) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
    for (let y = 0; y <= canvas.height; y += step) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }
    setDrawing(canvas);
  }, [ink, step]);

  return drawing;
}

const meta = {
  title: "Maps/MapPlanImage",
  component: MapPlanImage,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The custom background picture of a plan map: a floor plan, a scanned drawing, a CAD export or a canvas, laid out in the plan’s own units rather than on a world map. It takes a URL, a decoded image, a bitmap or a canvas, covers the whole plan by default, and accepts an `extent` in plan units for one wing of it. A swap goes through the existing source, so nothing refetches and nothing cross-fades.\n\nThe picture is context and the data on top is the ink — hold a drawing with baked-in colours back at low opacity, or leave it out and draw the plan as shapes, which themes correctly and never blurs.",
      },
    },
  },
} satisfies Meta<typeof MapPlanImage>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The whole plan: the picture underneath, the shapes on top. */
export const Default: Story = {
  render: () => <PictureUnderShapes />,
  play: async ({ canvas }) => {
    // The picture's own parallel channel: `alt` is the one thing about a WebGL raster
    // that assistive technology can read, so the story locks it.
    await expect(await canvas.findByText("Survey grid, one square per metre")).toBeInTheDocument();
  },
};

function PictureUnderShapes() {
  return (
    <div className="h-[420px] p-4">
      <MapCanvas blank plan={PLAN} className="h-full">
        <Layers />
      </MapCanvas>
    </div>
  );
}

function Layers({ extent }: { extent?: { x: number; y: number; width: number; height: number } }) {
  const ink = useTokenColor("--border-strong");
  const outline = useTokenColor("--foreground");
  const drawing = usePlanDrawing(ink);

  return (
    <>
      {drawing && (
        <MapPlanImage
          id="drawing"
          src={drawing}
          extent={extent}
          alt="Survey grid, one square per metre"
          opacity={0.35}
          resampling="nearest"
        />
      )}
      <MapGeoJSON
        id="wings"
        data={SHAPES}
        promoteId="id"
        interactive={false}
        fillPaint={false}
        linePaint={{ "line-color": outline, "line-width": 2 }}
      />
    </>
  );
}

/** One wing only: `extent` places the picture in plan units, not across the whole plan. */
export const OverOneWing: Story = {
  render: () => (
    <div className="h-[420px] p-4">
      <MapCanvas blank plan={PLAN} className="h-full">
        <Layers extent={{ x: 640, y: 60, width: 500, height: 480 }} />
      </MapCanvas>
    </div>
  ),
};

/** A floor swap: the same source, a new drawing — no refetch, no cross-fade. */
export const FloorSwap: Story = {
  render: () => {
    function Demo() {
      const [fine, setFine] = useState(false);
      return (
        <div className="flex h-[460px] flex-col gap-3 p-4">
          <label className="flex items-center gap-2 text-caption">
            <input
              type="checkbox"
              checked={fine}
              onChange={(event) => setFine(event.target.checked)}
            />
            Half-metre grid
          </label>
          <div className="min-h-0 flex-1">
            <MapCanvas blank plan={PLAN} className="h-full">
              <SwappedDrawing step={fine ? 50 : 100} />
            </MapCanvas>
          </div>
          <p className="text-meta text-muted-foreground">
            The grid ink is a semantic token, resolved inside the canvas — WebGL cannot read a CSS
            variable.
          </p>
        </div>
      );
    }
    return <Demo />;
  },
};

function SwappedDrawing({ step }: { step: number }) {
  const ink = useTokenColor("--border-strong");
  const drawing = usePlanDrawing(ink, step);
  return drawing ? (
    <MapPlanImage id="drawing" src={drawing} alt={`Survey grid, ${step} cm squares`} />
  ) : null;
}

/** `visible={false}` toggles the layer’s visibility; the source stays, so nothing reloads. */
export const Hidden: Story = {
  render: () => {
    function Demo() {
      const [shown, setShown] = useState(false);
      return (
        <div className="flex h-[460px] flex-col gap-3 p-4">
          <label className="flex items-center gap-2 text-caption">
            <input
              type="checkbox"
              checked={shown}
              onChange={(event) => setShown(event.target.checked)}
            />
            Show the drawing
          </label>
          <div className="min-h-0 flex-1">
            <MapCanvas blank plan={PLAN} className="h-full">
              <ToggledDrawing visible={shown} />
            </MapCanvas>
          </div>
        </div>
      );
    }
    return <Demo />;
  },
};

function ToggledDrawing({ visible }: { visible: boolean }) {
  const ink = useTokenColor("--border-strong");
  const drawing = usePlanDrawing(ink);
  return drawing ? (
    <MapPlanImage id="drawing" src={drawing} visible={visible} alt="Survey grid" />
  ) : null;
}

/** Nothing loaded yet: the canvas keeps the plan’s shape and says so once. */
export const Loading: Story = {
  render: () => (
    <div className="h-[420px] p-4">
      <MapCanvas blank plan={PLAN} loading className="h-full" />
    </div>
  ),
};

/**
 * The picture failed; the plan did not. `onError` reports it and the shapes stay, so
 * the consumer decides what the gap should look like.
 */
export const MissingPicture: Story = {
  render: () => {
    function Demo() {
      const [failed, setFailed] = useState(false);
      return (
        <div className="flex h-[460px] flex-col gap-2 p-4">
          {failed && (
            <StatePanel
              kind="error"
              title="Floor drawing unavailable"
              description="The plan is still usable — every wing is drawn from its own coordinates."
            />
          )}
          <div className="min-h-0 flex-1">
            <MapCanvas blank plan={PLAN} className="h-full">
              <MapPlanImage
                id="drawing"
                src="./missing-drawing.png"
                onError={() => setFailed(true)}
              />
              <ShapesOnly />
            </MapCanvas>
          </div>
        </div>
      );
    }
    return <Demo />;
  },
};

function ShapesOnly() {
  const outline = useTokenColor("--foreground");
  return (
    <MapGeoJSON
      id="wings"
      data={SHAPES}
      promoteId="id"
      interactive={false}
      fillPaint={false}
      linePaint={{ "line-color": outline, "line-width": 2 }}
    />
  );
}
