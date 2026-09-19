import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";

import { MapCanvas } from "../map-canvas";
import { MapMarker, MapMarkerContent } from "../map-marker";
import { LOCATOR_BOUNDS, LOCATOR_PLACES } from "../test-utils/locator-fixture";
import { MAP_LABEL_ANCHORS } from "./anchor";
import { MapAnnotation } from "./map-annotation";

const meta = {
  title: "Maps/MapAnnotation",
  component: MapAnnotation,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MapAnnotation>;
export default meta;
type Story = StoryObj<typeof meta>;

const NOTES = [
  { id: "toronto", at: LOCATOR_PLACES.toronto, text: "Toronto sits on the north shore." },
  { id: "lake", at: LOCATOR_PLACES.lakeLabel, text: "The lake is 311 km long." },
  { id: "kingston", at: LOCATOR_PLACES.kingston, text: "Kingston marks the outlet." },
] as const;

/**
 * Three notes with leader lines. From `medium` up each is painted beside its
 * point; at `narrow` (under 480 px of map width) the text would cover the
 * data, so each point gets a number and the notes move to a numbered key
 * under the map, in reading order.
 */
export const Default: Story = {
  args: { longitude: 0, latitude: 0, text: "" },
  render: () => (
    <div className="w-full p-4">
      <MapCanvas interactive={false} bounds={LOCATOR_BOUNDS} fitBoundsOptions={{ padding: 48 }}>
        {NOTES.map((note, index) => (
          <MapAnnotation
            key={note.id}
            {...note.at}
            text={note.text}
            anchor={index === 1 ? "bottom-right" : "top-right"}
          />
        ))}
      </MapCanvas>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const map = canvasElement.querySelector<HTMLElement>('[data-slot="map-canvas"]');
    if (!map || !canvasElement.querySelector(".maplibregl-canvas")) return;
    await waitFor(() =>
      expect(canvasElement.querySelectorAll('[data-slot="map-annotation"]')).toHaveLength(3),
    );
    if (map.getAttribute("data-map-breakpoint") === "narrow") {
      const key = await waitFor(() => {
        const el = canvasElement.querySelector('[data-slot="map-annotation-key"]');
        expect(el).not.toBeNull();
        return el!;
      });
      await expect(key.querySelectorAll('[data-slot="map-annotation-key-item"]')).toHaveLength(3);
      await expect(map.contains(key)).toBe(false);
    } else {
      await expect(canvasElement.querySelector('[data-slot="map-annotation-key"]')).toBeNull();
      await expect(
        canvasElement.querySelectorAll('[data-slot="map-annotation-connector"]'),
      ).toHaveLength(3);
    }
  },
};

/**
 * Every anchor around one point, with arrowheads; a note whose `showAt` says
 * `narrow: false` stays off small maps entirely instead of joining the key.
 */
export const AnchorsAndArrows: Story = {
  args: { longitude: 0, latitude: 0, text: "" },
  render: () => (
    <div className="w-full p-4">
      <MapCanvas interactive={false} center={[-78.2, 43.7]} zoom={6.4}>
        <MapMarker longitude={-78.2} latitude={43.7}>
          <MapMarkerContent />
        </MapMarker>
        {MAP_LABEL_ANCHORS.map((anchor) => (
          <MapAnnotation
            key={anchor}
            longitude={-78.2}
            latitude={43.7}
            text={anchor}
            anchor={anchor}
            connector={{ arrow: true }}
            showAt={{ base: true, narrow: anchor.includes("-") ? false : true }}
          />
        ))}
      </MapCanvas>
    </div>
  ),
};

/** A note with no leader line — the text sits right at its point. */
export const WithoutConnector: Story = {
  args: { longitude: 0, latitude: 0, text: "" },
  render: () => (
    <div className="w-full p-4">
      <MapCanvas interactive={false} center={[-79.38, 43.65]} zoom={8}>
        <MapAnnotation
          {...LOCATOR_PLACES.toronto}
          text="Downtown Toronto"
          anchor="right"
          connector={false}
        />
      </MapCanvas>
    </div>
  ),
};
