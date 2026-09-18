"use client";
/**
 * Region map (RM-099) — the render for "Show revenue by region on a map". The RM named the
 * `stat-card-choropleth-01` block, but it needs `geojson` + `topojson-client`, which the site's
 * library-only rule (`home-imports`) blocks; this composes `MapCanvas` + `MapMarker` from
 * `@elabs-ai/components-maps` over the company fixture instead. Reached only through a dynamic
 * `import()` in `renders.tsx`, so the maps chunk loads when this prompt runs, never before.
 */
import { MapCanvas, MapMarker, MapMarkerContent, MapMarkerLabel } from "@elabs-ai/components-maps";
import { REGIONS, type Region } from "../../content/fixtures/company";

/** A representative point per sales region (lng, lat) — placement only, not data. */
const REGION_POINTS: Record<Region, [number, number]> = {
  EMEA: [10, 50],
  AMER: [-98, 39],
  APAC: [120, 5],
  LATAM: [-58, -15],
};

export function RegionMap({ label }: { label: string }) {
  return (
    <div className="h-72 w-full overflow-hidden rounded-md" role="region" aria-label={label}>
      <MapCanvas viewport={{ center: [10, 20], zoom: 0.6 }}>
        {REGIONS.map((region) => (
          <MapMarker
            key={region}
            longitude={REGION_POINTS[region][0]}
            latitude={REGION_POINTS[region][1]}
          >
            <MapMarkerContent>
              <span className="block size-3 rounded-full bg-primary" aria-hidden="true" />
            </MapMarkerContent>
            <MapMarkerLabel>{region}</MapMarkerLabel>
          </MapMarker>
        ))}
      </MapCanvas>
    </div>
  );
}
