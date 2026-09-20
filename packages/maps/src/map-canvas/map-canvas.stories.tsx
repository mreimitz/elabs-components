import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { resolveTokenColor } from "@elabs-ai/components-tokens";

import { MapCanvas } from "./map-canvas";
import { MapControls } from "../map-controls";
import { MapGeoJSON } from "../map-geojson";
import { MapInset } from "../map-inset";
import { MapLegend } from "../map-legend";
import { MapMarker, MapMarkerContent, MapMarkerTooltip } from "../map-marker";
import { MapScaleBar } from "../map-scale-bar";
import {
  GREATER_TORONTO,
  LAKE_ONTARIO,
  LOCATOR_BOUNDS,
  LOCATOR_PLACES,
} from "../test-utils/locator-fixture";

const meta = {
  title: "Maps/MapCanvas",
  component: MapCanvas,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MapCanvas>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="h-[480px]">
      <MapCanvas center={[13.405, 52.52]} zoom={11}>
        <MapControls />
      </MapCanvas>
    </div>
  ),
};

/** The `loading` prop shows an accessible overlay while the app fetches map data. */
export const Loading: Story = {
  render: () => (
    <div className="h-[480px]">
      <MapCanvas center={[13.405, 52.52]} zoom={11} loading />
    </div>
  ),
};

/** Pin the basemap flavor regardless of the active brand theme. */
export const ForcedDarkBasemap: Story = {
  render: () => (
    <div className="h-[480px]">
      <MapCanvas center={[-74.006, 40.7128]} zoom={10} theme="dark">
        <MapControls />
      </MapCanvas>
    </div>
  ),
};

/** A globe projection — pairs well with `blank` + data layers for data-viz. */
export const Globe: Story = {
  render: () => (
    <div className="h-[480px]">
      <MapCanvas center={[10, 30]} zoom={1.5} projection={{ type: "globe" }}>
        <MapControls showCompass />
      </MapCanvas>
    </div>
  ),
};

/**
 * Consumer-side paint needs concrete colours (WebGL cannot read CSS
 * variables): resolve a token and re-resolve when the theme flips.
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

function LakeOntarioLocator() {
  const lake = useThemedTokenColor("--chart-1");
  const region = useThemedTokenColor("--chart-2");
  return (
    <div className="w-full p-4">
      <MapCanvas
        interactive={false}
        // c-11: the basemap printed "Toronto" 16 px from the marker that
        // names it, with the marker dot over the basemap word's last letters.
        // A locator's editorial labels are the only labels on it.
        basemapLabels={false}
        bounds={LOCATOR_BOUNDS}
        // Room at the top for the inset, at the bottom for the scale bar.
        fitBoundsOptions={{ padding: { top: 152, right: 24, bottom: 56, left: 24 } }}
      >
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
        <MapMarker {...LOCATOR_PLACES.lakeLabel} label={{ text: "Lake Ontario", box: true }} />
        <MapMarker {...LOCATOR_PLACES.gtaLabel} label={{ text: "Greater Toronto Area" }} />
        <MapMarker {...LOCATOR_PLACES.toronto} label={{ text: "Toronto", position: "bottom-left" }}>
          <MapMarkerContent />
          <MapMarkerTooltip>Toronto — Ontario’s capital</MapMarkerTooltip>
        </MapMarker>
        <MapMarker
          {...LOCATOR_PLACES.rochester}
          showAt={{ base: true, narrow: false }}
          label={{ text: "Rochester, NY", position: "right" }}
        >
          <MapMarkerContent />
        </MapMarker>
        <MapInset kind="globe" position="top-right" />
        <MapScaleBar unit="km" position="bottom-left" />
        <MapLegend
          position={{ base: "top-left", narrow: "below" }}
          items={[
            { label: "Lake Ontario", color: "var(--chart-1)", shape: "square" },
            { label: "Greater Toronto Area", color: "var(--chart-2)", shape: "square" },
          ]}
        />
      </MapCanvas>
    </div>
  );
}

/**
 * A Datawrapper-style locator: static (no zoom or pan; tooltips still open),
 * two area markers with a stripe pattern and a vignette glow, inline labels,
 * a globe inset, a scale bar and a key. The map sets no height of its own:
 * it takes 1.6 : 1, and turns square at `narrow` so a phone still gets a map
 * worth reading; there the key moves under the map and Rochester's label
 * (`showAt: { narrow: false }`) steps aside.
 */
export const StaticLocator: Story = {
  parameters: { layout: "fullscreen" },
  render: () => <LakeOntarioLocator />,
  play: async ({ canvasElement }) => {
    // Without WebGL the canvas degrades to an error panel and no furniture mounts.
    const map = await waitFor(
      () => {
        const el = canvasElement.querySelector<HTMLElement>('[data-slot="map-canvas"]');
        expect(el ?? canvasElement.querySelector('[role="alert"]')).not.toBeNull();
        return el;
      },
      { timeout: 5000 },
    );
    if (!map) return;
    await expect(map).toHaveAttribute("data-interactive", "false");
    const tier = map.getAttribute("data-map-breakpoint");
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-slot="map-scale-bar"]')).not.toBeNull(),
    );
    const legend = canvasElement.querySelector('[data-slot="map-legend"]');
    if (tier === "narrow") {
      // Square at narrow; the key sits under the map. The tier is measured
      // after mount, so wait for the box rather than reading it once.
      await waitFor(() => {
        const box = map.getBoundingClientRect();
        expect(box.height).toBeGreaterThanOrEqual(box.width - 1);
      });
      await expect(canvasElement.querySelector('[data-slot="map-canvas-below"]')).not.toBeNull();
      await expect(map.contains(legend)).toBe(false);
    } else {
      await expect(map.contains(legend)).toBe(true);
    }
  },
};

function ViewportReadout() {
  const [viewport, setViewport] = useState("not moved");
  return (
    <div className="flex w-full flex-col gap-2 p-4">
      <div className="h-[360px]">
        <MapCanvas
          interactive={false}
          center={[-79.38, 43.65]}
          zoom={9}
          onViewportChange={(v) =>
            setViewport(
              `${v.center[0].toFixed(3)}, ${v.center[1].toFixed(3)} @ ${v.zoom.toFixed(2)}`,
            )
          }
        >
          <MapMarker {...LOCATOR_PLACES.toronto}>
            <MapMarkerContent />
            <MapMarkerTooltip>Toronto</MapMarkerTooltip>
          </MapMarker>
        </MapCanvas>
      </div>
      <p className="text-caption text-muted-foreground">
        Viewport: <output data-testid="viewport">{viewport}</output>
      </p>
    </div>
  );
}

/**
 * `interactive={false}`: wheel, drag, double-click and keys leave the viewport
 * alone and the cursor stays an arrow, but hovering the marker still opens
 * its tooltip. The readout only changes when the viewport does.
 */
export const StaticMode: Story = {
  parameters: { layout: "fullscreen" },
  render: () => <ViewportReadout />,
  play: async ({ canvasElement }) => {
    const canvas = await waitFor(
      () => {
        const el = canvasElement.querySelector<HTMLCanvasElement>(".maplibregl-canvas");
        const fallback = canvasElement.querySelector('[role="alert"]');
        expect(el ?? fallback).not.toBeNull();
        return el;
      },
      { timeout: 5000 },
    );
    if (!canvas) return;
    const readout = canvasElement.querySelector('[data-testid="viewport"]')!;
    const before = readout.textContent;
    canvas.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: -600,
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 400));
    await expect(readout.textContent).toBe(before);
    await expect(canvas.tabIndex).toBe(-1);
  },
};

/**
 * A map in a parent with no height of its own: `height` resolves per tier —
 * here 320 px, and a square at `narrow`.
 */
export const ResponsiveHeight: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="w-full p-4">
      <MapCanvas center={[-79.38, 43.65]} zoom={8} height={{ base: 320, narrow: { aspect: 1 } }} />
    </div>
  ),
};
