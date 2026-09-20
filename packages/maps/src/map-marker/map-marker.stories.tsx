import type { Meta, StoryObj } from "@storybook/react-vite";
import { MapPin } from "lucide-react";
import { expect, waitFor } from "storybook/test";

import { MapCanvas } from "../map-canvas";
import { MAP_LABEL_ANCHORS } from "../map-annotation";
import { LOCATOR_BOUNDS, LOCATOR_PLACES } from "../test-utils/locator-fixture";
import {
  MapMarker,
  MapMarkerContent,
  MapMarkerLabel,
  MapMarkerPopup,
  MapMarkerTooltip,
} from "./map-marker";

const meta = {
  title: "Maps/MapMarker",
  component: MapMarker,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MapMarker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="h-[480px]">
      <MapCanvas center={[13.405, 52.52]} zoom={11}>
        <MapMarker longitude={13.405} latitude={52.52}>
          <MapMarkerContent />
          <MapMarkerLabel>Berlin</MapMarkerLabel>
        </MapMarker>
      </MapCanvas>
    </div>
  ),
};

export const WithPopupAndTooltip: Story = {
  render: () => (
    <div className="h-[480px]">
      <MapCanvas center={[13.41, 52.52]} zoom={12}>
        <MapMarker longitude={13.405} latitude={52.52}>
          <MapMarkerContent />
          <MapMarkerTooltip>Click for details</MapMarkerTooltip>
          <MapMarkerPopup closeButton>
            <p className="text-body font-medium">Alexanderplatz</p>
            <p className="text-caption text-muted-foreground">
              Public square in the Mitte district.
            </p>
          </MapMarkerPopup>
        </MapMarker>
        <MapMarker longitude={13.377} latitude={52.516}>
          <MapMarkerContent>
            <MapPin className="size-6 text-primary" aria-hidden="true" />
          </MapMarkerContent>
          <MapMarkerLabel position="bottom">Brandenburg Gate</MapMarkerLabel>
        </MapMarker>
      </MapCanvas>
    </div>
  ),
};

export const Draggable: Story = {
  render: () => (
    <div className="h-[480px]">
      <MapCanvas center={[13.405, 52.52]} zoom={11}>
        <MapMarker longitude={13.405} latitude={52.52} draggable>
          <MapMarkerContent />
          <MapMarkerLabel>Drag me</MapMarkerLabel>
        </MapMarker>
      </MapCanvas>
    </div>
  ),
};

// A marker's own label has no de-confliction pass: it goes where its anchor
// puts it, however close the next marker is. The boxed row's labels offset
// OUTWARD from their point, so at the narrow tier — where a degree of
// longitude is ~100px and a boxed label is up to 71px wide — two neighbours
// print on top of each other. That row is therefore shown from `medium` up
// (`showAt`), which is the prop the docblock already points at.
const LABEL_SPOTS = [
  { longitude: -79.6, latitude: 44.05 },
  { longitude: -78.6, latitude: 44.05 },
  { longitude: -77.6, latitude: 44.05 },
  { longitude: -76.6, latitude: 44.05 },
  { longitude: -79.6, latitude: 43.45 },
  { longitude: -78.6, latitude: 43.45 },
  { longitude: -77.6, latitude: 43.45 },
  { longitude: -76.6, latitude: 43.45 },
] as const;

/**
 * A marker's own label, at each of the eight positions around its point;
 * the lower row adds a box (a plate that keeps the text readable over busy
 * ground) and a callout line.
 */
export const LabelPositions: Story = {
  render: () => (
    <div className="w-full p-4">
      <MapCanvas interactive={false} bounds={LOCATOR_BOUNDS} fitBoundsOptions={{ padding: 48 }}>
        {MAP_LABEL_ANCHORS.map((position, index) => (
          <MapMarker
            key={position}
            {...LABEL_SPOTS[index]!}
            label={{ text: position, position, box: index >= 4, callout: index >= 4 }}
            showAt={index >= 4 ? { base: true, narrow: false } : true}
          >
            <MapMarkerContent />
          </MapMarker>
        ))}
      </MapCanvas>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Two labels printed through each other read as neither. Measured, per
    // tier: the boxed row is off at narrow, so every tier comes out clean.
    await waitFor(() =>
      expect(
        canvasElement.querySelectorAll('[data-slot="map-marker-label"]').length,
      ).toBeGreaterThan(0),
    );
    const boxes = [
      ...canvasElement.querySelectorAll<HTMLElement>('[data-slot="map-marker-label"]'),
    ].map((el) => el.getBoundingClientRect());
    const overlaps: string[] = [];
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (x > 0 && y > 0) overlaps.push(`${Math.round(x * y)}px²`);
      }
    }
    await expect(overlaps).toEqual([]);
  },
};

/**
 * A label with no marker glyph — text placed on the map (a lake or region
 * name) — plus a marker that only shows from `medium` up.
 */
export const LabelOnlyAndShowAt: Story = {
  render: () => (
    <div className="w-full p-4">
      <MapCanvas interactive={false} bounds={LOCATOR_BOUNDS} fitBoundsOptions={{ padding: 48 }}>
        <MapMarker {...LOCATOR_PLACES.lakeLabel} label={{ text: "Lake Ontario", box: true }} />
        <MapMarker {...LOCATOR_PLACES.toronto} label={{ text: "Toronto", position: "top-left" }}>
          <MapMarkerContent />
        </MapMarker>
        <MapMarker
          {...LOCATOR_PLACES.rochester}
          showAt={{ base: true, narrow: false }}
          label={{ text: "Rochester, NY", position: "right" }}
        >
          <MapMarkerContent />
        </MapMarker>
      </MapCanvas>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const map = canvasElement.querySelector<HTMLElement>('[data-slot="map-canvas"]');
    if (!map || !canvasElement.querySelector(".maplibregl-canvas")) return;
    const narrow = map.getAttribute("data-map-breakpoint") === "narrow";
    await waitFor(() =>
      expect(canvasElement.querySelectorAll('[data-slot="map-marker-label"]')).toHaveLength(
        narrow ? 2 : 3,
      ),
    );
  },
};
