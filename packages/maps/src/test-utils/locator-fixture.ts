/**
 * A hand-simplified Lake Ontario locator fixture (≈ 20 vertices a shape, WGS 84
 * lon / lat) for the locator-furniture stories and tests — two area markers
 * and a few places. Offline and tiny on purpose; not survey-accurate.
 */

export const LAKE_ONTARIO: GeoJSON.Feature<GeoJSON.Polygon, { name: string }> = {
  type: "Feature",
  properties: { name: "Lake Ontario" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-79.8, 43.28],
        [-79.55, 43.47],
        [-79.38, 43.63],
        [-79.05, 43.78],
        [-78.86, 43.87],
        [-78.17, 43.95],
        [-77.55, 43.99],
        [-77.15, 43.86],
        [-76.82, 43.95],
        [-76.48, 44.21],
        [-76.24, 44.19],
        [-76.2, 43.95],
        [-76.46, 43.52],
        [-76.95, 43.28],
        [-77.6, 43.26],
        [-78.3, 43.37],
        [-78.9, 43.33],
        [-79.06, 43.26],
        [-79.56, 43.2],
        [-79.8, 43.28],
      ],
    ],
  },
};

export const GREATER_TORONTO: GeoJSON.Feature<GeoJSON.Polygon, { name: string }> = {
  type: "Feature",
  properties: { name: "Greater Toronto Area" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-79.8, 43.3],
        [-79.55, 43.47],
        [-79.38, 43.63],
        [-79.05, 43.78],
        [-78.86, 43.87],
        [-78.8, 44.15],
        [-79.3, 44.28],
        [-79.85, 44.08],
        [-80.05, 43.72],
        [-79.8, 43.3],
      ],
    ],
  },
};

/** West, south, east, north of both areas — the locator's data extent. */
export const LOCATOR_BOUNDS: [[number, number], [number, number]] = [
  [-80.05, 43.2],
  [-76.2, 44.28],
];

/** Places the locator labels, west → east. */
export const LOCATOR_PLACES = {
  toronto: { longitude: -79.38, latitude: 43.65 },
  hamilton: { longitude: -79.87, latitude: 43.25 },
  rochester: { longitude: -77.61, latitude: 43.16 },
  kingston: { longitude: -76.48, latitude: 44.23 },
  lakeLabel: { longitude: -77.9, latitude: 43.62 },
  gtaLabel: { longitude: -79.45, latitude: 43.93 },
} as const;
