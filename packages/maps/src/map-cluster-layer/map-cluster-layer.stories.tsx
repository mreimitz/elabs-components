import type { Meta, StoryObj } from "@storybook/react-vite";

import { MapCanvas } from "../map-canvas";
import { MapClusterLayer } from "./map-cluster-layer";

// Deterministic pseudo-random points (seeded LCG, stable across renders).
function makePoints(count: number): GeoJSON.FeatureCollection<GeoJSON.Point, { id: number }> {
  let seed = 42;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const features: GeoJSON.Feature<GeoJSON.Point, { id: number }>[] = [];
  for (let i = 0; i < count; i += 1) {
    // Cluster the points around a handful of European hubs.
    const hubs: [number, number][] = [
      [13.4, 52.5],
      [2.35, 48.85],
      [-0.13, 51.51],
      [12.5, 41.9],
      [-3.7, 40.42],
    ];
    const hub = hubs[Math.floor(next() * hubs.length)]!;
    features.push({
      type: "Feature",
      properties: { id: i },
      geometry: {
        type: "Point",
        coordinates: [hub[0] + (next() - 0.5) * 6, hub[1] + (next() - 0.5) * 4],
      },
    });
  }
  return { type: "FeatureCollection", features };
}

const points = makePoints(1200);

const meta = {
  title: "Maps/MapClusterLayer",
  component: MapClusterLayer,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MapClusterLayer>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Cluster circles step through the status tokens as point counts grow; click a cluster to zoom in. */
export const Default: Story = {
  render: () => (
    <div className="h-[480px]">
      <MapCanvas center={[5, 47]} zoom={3.5}>
        <MapClusterLayer data={points} clusterThresholds={[50, 200]} />
      </MapCanvas>
    </div>
  ),
};
