import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { resolveTokenColor } from "@elabs-ai/components-tokens";

import { MapCanvas } from "../map-canvas";
import { GREATER_TORONTO, LAKE_ONTARIO, LOCATOR_BOUNDS } from "../test-utils/locator-fixture";
import { MapGeoJSON } from "./map-geojson";

/**
 * Theme-reactive token resolution for CONSUMER-side paint (outside the map
 * context). A one-shot `resolveTokenColor` at render time can read the `:root`
 * fallback: Storybook's theme decorator stamps `data-theme` after the first
 * render (the sweep caught the blue `:root` primary instead of the active
 * theme's own).
 * Re-resolve whenever the theme attribute changes — the same contract the
 * package's internal `useTokenColor` follows.
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

type RegionProps = { name: string; value: number };

// A synthetic "regions" grid (offline-friendly stand-in for country shapes).
function makeRegions(): GeoJSON.FeatureCollection<GeoJSON.Polygon, RegionProps> {
  const features: GeoJSON.Feature<GeoJSON.Polygon, RegionProps>[] = [];
  let i = 0;
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const x = -12 + col * 8;
      const y = 38 + row * 5;
      i += 1;
      features.push({
        type: "Feature",
        id: `r${i}`,
        properties: { name: `Region ${i}`, value: ((i * 37) % 100) / 100 },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [x, y],
              [x + 7.4, y],
              [x + 7.4, y + 4.4],
              [x, y + 4.4],
              [x, y],
            ],
          ],
        },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

const regions = makeRegions();

const meta = {
  title: "Maps/MapGeoJSON",
  component: MapGeoJSON,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MapGeoJSON>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Neutral fills + hairline outlines from the theme tokens, on a blank canvas. */
export const Default: Story = {
  render: () => (
    <div className="h-[480px]">
      <MapCanvas blank center={[10, 48]} zoom={3.2}>
        <MapGeoJSON data={regions} />
      </MapCanvas>
    </div>
  ),
};

function ChoroplethDemo() {
  const [hovered, setHovered] = useState<RegionProps | null>(null);
  // WebGL paint can't read CSS variables — resolve the token, re-resolving on
  // theme change (the same mechanism the package uses for its own defaults).
  const primary = useThemedTokenColor("--primary");
  return (
    <div className="relative h-[480px]">
      <MapCanvas blank center={[10, 48]} zoom={3.2}>
        <MapGeoJSON<RegionProps>
          data={regions}
          promoteId="name"
          interactive
          fillPaint={{
            "fill-color": primary,
            "fill-opacity": [
              "interpolate",
              ["linear"],
              ["get", "value"],
              0,
              0.15,
              1,
              0.95,
            ] as never,
          }}
          fillHoverPaint={{ "fill-opacity": 1 }}
          // c-2: the fill lives in WebGL, so without this the 24 values are
          // reachable by mouse only. One visually-hidden button per region
          // carries the same sentence the readout prints.
          featureLabel={(feature) =>
            `${feature.properties.name}: ${(feature.properties.value * 100).toFixed(0)}%`
          }
          onHover={(e) => setHovered(e?.feature.properties ?? null)}
        />
      </MapCanvas>
      <div className="absolute top-2 left-2 rounded-md border bg-card px-3 py-2 text-caption text-card-foreground shadow-sm">
        {hovered ? `${hovered.name}: ${(hovered.value * 100).toFixed(0)}%` : "Hover a region…"}
      </div>
    </div>
  );
}

export const InteractiveHover: Story = {
  render: () => <ChoroplethDemo />,
  play: async ({ canvasElement }) => {
    // c-2 (WCAG 2.1.1 / 1.3.1): before the fix the only tab stop in the story
    // was the map canvas, and none of the 24 region values had any DOM at all.
    const list = await waitFor(() => {
      const element = canvasElement.querySelector('[data-slot="map-geojson-keyboard-list"]');
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    const buttons = [...list.querySelectorAll("button")];
    await expect(buttons).toHaveLength(24);
    await expect(buttons[0]).toHaveAccessibleName("Region 1: 37%");

    // Focusing a region updates the very readout the pointer drives.
    buttons[9]?.focus();
    await waitFor(() =>
      expect(canvasElement.textContent).toContain(
        buttons[9]?.textContent ?? "no region under focus",
      ),
    );
  },
};

function AreaMarkersDemo() {
  const lake = useThemedTokenColor("--chart-1");
  const region = useThemedTokenColor("--chart-2");
  return (
    <div className="w-full p-4">
      <MapCanvas interactive={false} bounds={LOCATOR_BOUNDS} fitBoundsOptions={{ padding: 32 }}>
        <MapGeoJSON
          id="gta"
          data={GREATER_TORONTO}
          fillPaint={{ "fill-color": region }}
          fillOpacity={0.3}
          vignette={{ width: 10, opacity: 0.4 }}
          linePaint={false}
        />
        <MapGeoJSON
          id="lake"
          data={LAKE_ONTARIO}
          fillPaint={{ "fill-color": lake }}
          pattern={{ kind: "stripes", width: 2, gap: 4 }}
          vignette={{ width: 14, opacity: 0.35 }}
          linePaint={{ "line-color": lake, "line-width": 1 }}
        />
      </MapCanvas>
    </div>
  );
}

/**
 * Area markers for a locator: a striped fill (a second channel besides
 * colour — it survives greyscale) and a soft vignette glow along the edge.
 * `fillOpacity` sets the tint under the stripes.
 */
export const PatternAndVignette: Story = {
  render: () => <AreaMarkersDemo />,
};
