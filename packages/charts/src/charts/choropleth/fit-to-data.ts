/**
 * fit-to-data.ts — frame a choropleth on the regions that carry data (RM-124).
 *
 * Datawrapper's "crop to data": the projection's scale and translate are
 * solved so the DATA-BEARING features fill the plot, minus a padding. The
 * other regions stay on the map (cropped by the plot edge) unless the chart
 * also sets `hideNoData`, which removes them from the DOM.
 *
 * Pure: no React, no DOM. `d3-geo` does the fitting (`fitExtent`), with the
 * same Mercator projection and centre `ChoroplethChart` draws with, so the
 * solved scale / translate drop straight into it.
 */

import { geoMercator } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import type { ChoroplethFeatureProperties } from "./choropleth-context";

/** `fitToData` on `ChoroplethChart`: `true`, or the padding around the framed regions. */
export interface ChoroplethFitToDataOptions {
  /** Space kept between the framed regions and the plot edge, in px. Default: 5% of the shorter side, at least 8. */
  padding?: number;
}

export type ChoroplethFitToData = boolean | ChoroplethFitToDataOptions;

/** A solved Mercator projection. */
export interface FittedProjection {
  scale: number;
  translate: [number, number];
}

/** A feature's numeric value at `key` — `undefined` when it has none (no data). */
export function featureValueAt(
  feature: Feature<Geometry | null, ChoroplethFeatureProperties | null>,
  key: string,
): number | undefined {
  const raw = feature.properties?.[key];
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/** True when the feature carries a finite value at `key`. */
export function featureHasData(
  feature: Feature<Geometry | null, ChoroplethFeatureProperties | null>,
  key: string,
): boolean {
  return featureValueAt(feature, key) !== undefined;
}

/** The padding `fitToData` resolves to for a plot of `width × height`. */
export function resolveFitPadding(fit: ChoroplethFitToData, width: number, height: number): number {
  const auto = Math.max(8, Math.round(Math.min(width, height) * 0.05));
  const requested = typeof fit === "object" && fit.padding !== undefined ? fit.padding : auto;
  // Never more than a third of the shorter side: the framed extent keeps a size.
  return Math.max(0, Math.min(requested, Math.min(width, height) / 3));
}

/**
 * Solve the Mercator `scale` / `translate` that fits `features` into the box
 * `[padding, padding] – [width − padding, height − padding]`, around `center`.
 * Returns `null` when there is nothing to fit or the box has no area.
 */
export function fitProjectionToFeatures(
  features: readonly Feature<Geometry, ChoroplethFeatureProperties>[],
  width: number,
  height: number,
  center: [number, number],
  padding: number,
): FittedProjection | null {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  const pad = Math.max(0, Math.min(padding, w / 2, h / 2));
  if (features.length === 0 || w - 2 * pad <= 0 || h - 2 * pad <= 0) return null;
  const projection = geoMercator()
    .center(center)
    .fitExtent(
      [
        [pad, pad],
        [w - pad, h - pad],
      ],
      { type: "FeatureCollection", features: [...features] },
    );
  const scale = projection.scale();
  const [tx, ty] = projection.translate();
  if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(tx) || !Number.isFinite(ty)) {
    return null;
  }
  return { scale, translate: [tx, ty] };
}
