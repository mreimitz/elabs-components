import type { Meta, StoryObj } from "@storybook/react-vite";
import { MapPin } from "lucide-react";

import { MapCanvas } from "../map-canvas";
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
