"use client";
/**
 * Region map (RM-099) — the render for "Show revenue by region on a map". The RM named the
 * `stat-card-choropleth-01` block, but it needs `geojson` + `topojson-client`, which the site's
 * library-only rule (`home-imports`) blocks; this composes `MapCanvas` + `MapGeoJSON` +
 * `MapMarker` from `@elabs-ai/components-maps` over the order fixture instead.
 *
 * `blank` (orchestrator ruling 15): the tile-less transparent style, so the map makes NO request
 * to any outside origin (no basemap, glyph or sprite fetch). With no basemap the canvas would
 * otherwise carry no geography at all — `GRATICULE` draws a plain lat/lng reference grid, generated
 * in code (no `geojson`/`topojson-client` dataset needed), through `MapGeoJSON`'s own token-driven
 * line paint (`--border`, resolved for WebGL at render time). Each region is a marker labelled
 * with its revenue, drawn over the grid.
 * Reached only through a dynamic `import()` in `renders.tsx`, so the maps chunk loads when this
 * prompt runs, never before.
 */
import { useMemo } from "react";
import {
  MapCanvas,
  MapGeoJSON,
  MapMarker,
  MapMarkerContent,
  MapMarkerLabel,
} from "@elabs-ai/components-maps";
import { REGIONS, type Region } from "../../content/fixtures/company";
import { generateOrders } from "../../content/fixtures/orders";

/** A representative point per sales region (lng, lat) — placement only, not data. */
const REGION_POINTS: Record<Region, [number, number]> = {
  EMEA: [10, 48],
  AMER: [-98, 39],
  APAC: [115, 10],
  LATAM: [-60, -15],
};

/** Degrees between graticule lines. */
const GRATICULE_STEP = 30;

/**
 * A world reference grid — parallels and meridians every {@link GRATICULE_STEP}
 * degrees — built from plain coordinates so the map reads as geography without
 * a basemap fetch or a `geojson`/`topojson-client` boundary dataset.
 */
function buildGraticule(): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const meridians: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (let lng = -180; lng <= 180; lng += GRATICULE_STEP) {
    meridians.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: Array.from({ length: 19 }, (_, i) => [lng, -90 + i * 10]),
      },
    });
  }
  const parallels: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (let lat = -60; lat <= 60; lat += GRATICULE_STEP) {
    parallels.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: Array.from({ length: 37 }, (_, i) => [-180 + i * 10, lat]),
      },
    });
  }
  return { type: "FeatureCollection", features: [...meridians, ...parallels] };
}

const GRATICULE = buildGraticule();

export type RegionMapProps = {
  label: string;
  locale?: string;
};

export function RegionMap({ label, locale = "en-US" }: RegionMapProps) {
  const revenue = useMemo(() => {
    const totals = Object.fromEntries(REGIONS.map((r) => [r, 0])) as Record<Region, number>;
    for (const order of generateOrders(2000)) totals[order.region] += order.amount;
    return totals;
  }, []);
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return (
    <div
      className="h-72 w-full overflow-hidden rounded-md bg-surface-muted"
      role="region"
      aria-label={label}
    >
      <MapCanvas blank viewport={{ center: [0, 20], zoom: 0.4 }}>
        <MapGeoJSON
          data={GRATICULE}
          fillPaint={false}
          linePaint={{ "line-color": "--border", "line-width": 1, "line-opacity": 0.5 }}
        />
        {REGIONS.map((region) => (
          <MapMarker
            key={region}
            longitude={REGION_POINTS[region][0]}
            latitude={REGION_POINTS[region][1]}
          >
            <MapMarkerContent>
              <span className="block size-3 rounded-full bg-primary" aria-hidden="true" />
            </MapMarkerContent>
            <MapMarkerLabel>{`${region} · ${money.format(revenue[region])}`}</MapMarkerLabel>
          </MapMarker>
        ))}
      </MapCanvas>
    </div>
  );
}
