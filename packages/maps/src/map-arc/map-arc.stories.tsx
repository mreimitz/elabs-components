import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { MapCanvas } from "../map-canvas";
import { MapArc, type MapArcDatum } from "./map-arc";

type CityArc = MapArcDatum & { label: string };

// Connections out of Frankfurt.
const arcs: CityArc[] = [
  { id: "fra-jfk", from: [8.6821, 50.1109], to: [-73.7781, 40.6413], label: "FRA → JFK" },
  { id: "fra-nrt", from: [8.6821, 50.1109], to: [140.3929, 35.7719], label: "FRA → NRT" },
  { id: "fra-gru", from: [8.6821, 50.1109], to: [-46.4731, -23.4356], label: "FRA → GRU" },
  { id: "fra-sin", from: [8.6821, 50.1109], to: [103.9915, 1.3644], label: "FRA → SIN" },
  { id: "fra-jnb", from: [8.6821, 50.1109], to: [28.246, -26.1392], label: "FRA → JNB" },
];

const meta = {
  title: "Maps/MapArc",
  component: MapArc,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MapArc>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Default paint follows the theme's `--primary` token. */
export const Default: Story = {
  render: () => (
    <div className="h-[480px]">
      <MapCanvas center={[8.68, 50.11]} zoom={1.6}>
        <MapArc data={arcs} />
      </MapCanvas>
    </div>
  ),
};

function HoverableArcs() {
  const [hovered, setHovered] = useState<CityArc | null>(null);
  return (
    <div className="relative h-[480px]">
      <MapCanvas center={[8.68, 50.11]} zoom={1.6} projection={{ type: "globe" }}>
        <MapArc
          data={arcs}
          hoverPaint={{ "line-width": 4 }}
          onHover={(e) => setHovered(e?.arc ?? null)}
        />
      </MapCanvas>
      <div className="absolute top-2 left-2 rounded-md border bg-card px-3 py-2 text-caption text-card-foreground shadow-sm">
        {hovered ? hovered.label : "Hover an arc…"}
      </div>
    </div>
  );
}

export const GlobeWithHover: Story = {
  render: () => <HoverableArcs />,
};
