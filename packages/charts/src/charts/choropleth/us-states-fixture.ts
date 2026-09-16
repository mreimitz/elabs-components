import type { FeatureCollection, Geometry } from "geojson";
import type { ChoroplethFeature, ChoroplethFeatureProperties } from "./choropleth-context";

/**
 * A schematic US-states GeoJSON fixture shared by `choropleth-chart.stories.tsx`
 * (the `NoDataHatchAndTopLabels` / `NoDataMuted` stories, RM-032 M1/M2) and
 * `choropleth-chart.test.tsx`'s pure winding-contract lock (#236).
 *
 * Split into its own module — rather than declared inline in the story file —
 * so the test can import it as an ordinary `.ts` module. This package's
 * `tsconfig.json` excludes `**\/*.stories.tsx` from `typecheck` (Storybook
 * story typings are looser than the package's own); importing the story
 * module from a test would pull it back into the type-checked graph and
 * surface every pre-existing, unrelated story-typing gap in this file.
 *
 * world-atlas (this package's only geo-data dependency) ships country-level
 * topology only; there is no state-level TopoJSON in the dependency tree and
 * adding one (e.g. `us-atlas`) is outside this item's touched-file set. Each
 * "state" below is instead a small square Polygon centered on that state's
 * real approximate lon/lat, sized by a rough small/medium/large land-area
 * tier — schematic, not survey-accurate, but positioned in real geographic
 * space so the cluster reads as a US map. Alaska and Hawaii are placed at the
 * common cartographic "inset" position (bottom-left of the frame) rather than
 * their real remote coordinates, matching how every mainstream US choropleth
 * (e.g. d3's albersUsa) insets them, and carry no `value` — the no-data case
 * the stories exist to demonstrate.
 */

export type StateTier = "S" | "M" | "L";

export const TIER_HALF_WIDTH: Record<StateTier, number> = { S: 0.35, M: 0.8, L: 1.3 };

export interface StateSeed {
  id: string;
  name: string;
  lon: number;
  lat: number;
  tier: StateTier;
  /** Population in millions (approx., for a recognizable "5 largest" story). `undefined` = no data. */
  value?: number;
}

export const US_STATE_SEEDS: StateSeed[] = [
  { id: "CA", name: "California", lon: -119.7, lat: 37.2, tier: "L", value: 39.24 },
  { id: "TX", name: "Texas", lon: -99.3, lat: 31.0, tier: "L", value: 30.5 },
  { id: "FL", name: "Florida", lon: -82.4, lat: 28.6, tier: "M", value: 22.24 },
  { id: "NY", name: "New York", lon: -75.5, lat: 42.9, tier: "M", value: 19.34 },
  { id: "PA", name: "Pennsylvania", lon: -77.8, lat: 40.9, tier: "M", value: 13.0 },
  { id: "IL", name: "Illinois", lon: -89.2, lat: 40.0, tier: "M", value: 12.81 },
  { id: "OH", name: "Ohio", lon: -82.9, lat: 40.4, tier: "M", value: 11.8 },
  { id: "GA", name: "Georgia", lon: -83.4, lat: 32.6, tier: "M", value: 10.91 },
  { id: "NC", name: "North Carolina", lon: -79.4, lat: 35.5, tier: "M", value: 10.7 },
  { id: "MI", name: "Michigan", lon: -85.4, lat: 44.3, tier: "M", value: 10.05 },
  { id: "NJ", name: "New Jersey", lon: -74.7, lat: 40.1, tier: "S", value: 9.29 },
  { id: "VA", name: "Virginia", lon: -78.7, lat: 37.5, tier: "M", value: 8.68 },
  { id: "WA", name: "Washington", lon: -120.5, lat: 47.4, tier: "L", value: 7.79 },
  { id: "AZ", name: "Arizona", lon: -111.9, lat: 34.2, tier: "L", value: 7.28 },
  { id: "TN", name: "Tennessee", lon: -86.3, lat: 35.8, tier: "M", value: 7.05 },
  { id: "MA", name: "Massachusetts", lon: -71.8, lat: 42.3, tier: "S", value: 7.03 },
  { id: "IN", name: "Indiana", lon: -86.3, lat: 39.9, tier: "M", value: 6.81 },
  { id: "MO", name: "Missouri", lon: -92.6, lat: 38.5, tier: "M", value: 6.17 },
  { id: "MD", name: "Maryland", lon: -76.7, lat: 39.0, tier: "S", value: 6.16 },
  { id: "WI", name: "Wisconsin", lon: -89.9, lat: 44.6, tier: "M", value: 5.89 },
  { id: "CO", name: "Colorado", lon: -105.5, lat: 39.0, tier: "L", value: 5.84 },
  { id: "MN", name: "Minnesota", lon: -94.6, lat: 46.4, tier: "L", value: 5.71 },
  { id: "SC", name: "South Carolina", lon: -80.9, lat: 33.9, tier: "M", value: 5.28 },
  { id: "AL", name: "Alabama", lon: -86.8, lat: 32.8, tier: "M", value: 5.07 },
  { id: "LA", name: "Louisiana", lon: -92.0, lat: 31.0, tier: "M", value: 4.62 },
  { id: "KY", name: "Kentucky", lon: -85.3, lat: 37.5, tier: "M", value: 4.51 },
  { id: "OR", name: "Oregon", lon: -120.5, lat: 44.0, tier: "L", value: 4.24 },
  { id: "OK", name: "Oklahoma", lon: -97.5, lat: 35.5, tier: "M", value: 4.02 },
  { id: "CT", name: "Connecticut", lon: -72.7, lat: 41.6, tier: "S", value: 3.63 },
  { id: "UT", name: "Utah", lon: -111.7, lat: 39.3, tier: "L", value: 3.38 },
  { id: "IA", name: "Iowa", lon: -93.5, lat: 42.0, tier: "M", value: 3.19 },
  { id: "NV", name: "Nevada", lon: -117.0, lat: 39.5, tier: "L", value: 3.19 },
  { id: "AR", name: "Arkansas", lon: -92.4, lat: 34.9, tier: "M", value: 3.01 },
  { id: "MS", name: "Mississippi", lon: -89.6, lat: 32.7, tier: "M", value: 2.96 },
  { id: "KS", name: "Kansas", lon: -98.4, lat: 38.5, tier: "L", value: 2.94 },
  { id: "NM", name: "New Mexico", lon: -106.0, lat: 34.5, tier: "L", value: 2.11 },
  { id: "NE", name: "Nebraska", lon: -99.8, lat: 41.5, tier: "L", value: 1.96 },
  { id: "ID", name: "Idaho", lon: -114.6, lat: 44.4, tier: "L", value: 1.94 },
  { id: "WV", name: "West Virginia", lon: -80.6, lat: 38.9, tier: "M", value: 1.79 },
  { id: "NH", name: "New Hampshire", lon: -71.6, lat: 43.7, tier: "S", value: 1.39 },
  { id: "ME", name: "Maine", lon: -69.0, lat: 45.3, tier: "M", value: 1.36 },
  { id: "RI", name: "Rhode Island", lon: -71.5, lat: 41.7, tier: "S", value: 1.1 },
  { id: "MT", name: "Montana", lon: -109.6, lat: 47.0, tier: "L", value: 1.1 },
  { id: "DE", name: "Delaware", lon: -75.5, lat: 39.0, tier: "S", value: 1.02 },
  { id: "SD", name: "South Dakota", lon: -100.2, lat: 44.4, tier: "L", value: 0.89 },
  { id: "ND", name: "North Dakota", lon: -100.5, lat: 47.5, tier: "L", value: 0.78 },
  { id: "VT", name: "Vermont", lon: -72.7, lat: 44.0, tier: "S", value: 0.65 },
  { id: "WY", name: "Wyoming", lon: -107.5, lat: 43.0, tier: "L", value: 0.58 },
  // Inset (not their real remote coordinates) — no `value`, so `noDataFill` applies.
  { id: "AK", name: "Alaska", lon: -114, lat: 27, tier: "L" },
  { id: "HI", name: "Hawaii", lon: -101, lat: 24, tier: "S" },
];

// d3-geo reads polygons SPHERICALLY: an exterior ring smaller than a
// hemisphere must be CLOCKWISE (the opposite of RFC 7946's counter-clockwise
// convention). A counter-clockwise ring is read as the sphere MINUS the
// square, and `geoPath` then emits the projection's whole `clipExtent`
// (2 * pi * scale per side) as a second subpath, and `geoCentroid` returns
// the ring's antipode — the defect behind #236. Winding SW -> NW -> NE -> SE
// (west edge first, heading north) keeps the interior on the correct side;
// do NOT "correct" this back to RFC 7946 order.
export function squareStateFeature(seed: StateSeed): ChoroplethFeature {
  const half = TIER_HALF_WIDTH[seed.tier];
  const { lon, lat } = seed;
  return {
    type: "Feature",
    id: seed.id,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [lon - half, lat - half], // SW
          [lon - half, lat + half], // NW
          [lon + half, lat + half], // NE
          [lon + half, lat - half], // SE
          [lon - half, lat - half], // close
        ],
      ],
    },
    properties: { id: seed.id, name: seed.name, value: seed.value },
  };
}

export const usStatesData: FeatureCollection<Geometry, ChoroplethFeatureProperties> = {
  type: "FeatureCollection",
  features: US_STATE_SEEDS.map(squareStateFeature),
};
