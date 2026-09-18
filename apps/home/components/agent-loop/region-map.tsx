"use client";
/**
 * Region map (RM-099) — the render for "Show revenue by region on a map". The RM named the
 * `stat-card-choropleth-01` block, but it needs `geojson` + `topojson-client`, which the site's
 * library-only rule (`home-imports`) blocks; this composes `MapCanvas` + `MapGeoJSON` +
 * `MapMarker` from `@elabs-ai/components-maps` over the order fixture instead.
 *
 * `blank` (orchestrator ruling 15): the tile-less transparent style, so the map makes NO request
 * to any outside origin (no basemap, glyph or sprite fetch). The geography cue is a generated
 * 30° graticule drawn with `MapGeoJSON`; each region is a marker labelled with its revenue.
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

/** Meridians every 30° and parallels every 30°, as LineStrings — geography without tiles. */
function graticule() {
  const features = [];
  for (let lng = -180; lng <= 180; lng += 30)
    features.push({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: Array.from({ length: 17 }, (_, i) => [lng, -80 + i * 10]),
      },
    });
  for (let lat = -60; lat <= 60; lat += 30)
    features.push({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: Array.from({ length: 37 }, (_, i) => [-180 + i * 10, lat]),
      },
    });
  return { type: "FeatureCollection" as const, features };
}

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
  const lines = useMemo(graticule, []);
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
        <MapGeoJSON id="agent-loop-graticule" data={lines} fillPaint={false} />
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
