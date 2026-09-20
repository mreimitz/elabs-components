"use client";

import type MapLibreGL from "maplibre-gl";
import { useEffect, useId, useMemo, useRef } from "react";

import { useMap } from "../map-canvas/map-context";
import { mergeHoverPaint } from "../lib/merge-hover-paint";
import { useTokenColor } from "../lib/use-token-color";

export type MapGeoJSONData<P extends GeoJSON.GeoJsonProperties = GeoJSON.GeoJsonProperties> =
  | GeoJSON.FeatureCollection<GeoJSON.Geometry, P>
  | GeoJSON.Feature<GeoJSON.Geometry, P>
  | GeoJSON.Geometry
  | string;

export type MapFillPaint = NonNullable<MapLibreGL.FillLayerSpecification["paint"]>;
export type MapLinePaint = NonNullable<MapLibreGL.LineLayerSpecification["paint"]>;

/**
 * A hatch drawn over the fill — the locator-map "area marker" look. `width` is
 * a stripe's thickness and `gap` the space between stripes, both in CSS px
 * measured across the 45° stripes. Stripes take the fill colour (a plain
 * `fill-color`; an expression falls back to the `--foreground` token).
 */
export interface MapGeoJSONPattern {
  kind: "stripes";
  /** Stripe thickness in px (default 2). */
  width?: number;
  /** Space between stripes in px (default 4). */
  gap?: number;
}

/**
 * A soft glow around the area's edge — a second, blurred line layer under the
 * fill, in the fill colour. `width` is how far the glow reaches out, in px.
 */
export interface MapGeoJSONVignette {
  /** Glow reach in px (default 12). */
  width?: number;
  /** Glow opacity, 0–1 (default 0.35). */
  opacity?: number;
}

/** A rendered feature with strongly-typed `properties`. */
export type MapGeoJSONFeature<P extends GeoJSON.GeoJsonProperties = GeoJSON.GeoJsonProperties> =
  Omit<MapLibreGL.MapGeoJSONFeature, "properties"> & { properties: P };

/** Event payload passed to MapGeoJSON interaction callbacks. */
export type MapGeoJSONEvent<P extends GeoJSON.GeoJsonProperties = GeoJSON.GeoJsonProperties> = {
  /** The feature under the cursor, with its typed GeoJSON properties. */
  feature: MapGeoJSONFeature<P>;
  /** Longitude of the cursor at the time of the event. */
  longitude: number;
  /** Latitude of the cursor at the time of the event. */
  latitude: number;
  /**
   * The underlying MapLibre mouse event for advanced use cases. `null` when
   * the feature was reached from the KEYBOARD rather than a pointer — there is
   * no mouse event behind that (c-4/c-2, WCAG 2.1.1).
   */
  originalEvent: MapLibreGL.MapLayerMouseEvent | null;
};

export type MapGeoJSONProps<P extends GeoJSON.GeoJsonProperties = GeoJSON.GeoJsonProperties> = {
  /** GeoJSON data (FeatureCollection, Feature, Geometry) or a URL to fetch it from. */
  data: MapGeoJSONData<P>;
  /** Optional unique identifier prefix for the source/layers. Auto-generated if not provided. */
  id?: string;
  /**
   * Feature property to promote to the feature `id`. Required for hover
   * feature-state (`fillHoverPaint`) and stable `onHover`/`onClick` payloads.
   */
  promoteId?: string;
  /**
   * Paint for the polygon fill layer. Merged on top of a theme-aware neutral
   * default (the `--border` token — a mid neutral that reads on the page
   * surface in every theme). Pass `false` to omit the fill layer entirely
   * (e.g. outlines only).
   */
  fillPaint?: MapFillPaint | false;
  /**
   * Paint for the outline layer. Merged on top of a hairline default
   * (`line-color` = the `--background` token, `line-width` = 0.5) for thin
   * separators. Override `line-color` if your container differs, or pass
   * `false` to omit the layer.
   */
  linePaint?: MapLinePaint | false;
  /**
   * Paint merged onto the fill layer for the feature under the cursor, applied
   * as a `case` expression keyed on hover feature-state. Requires `promoteId`.
   */
  fillHoverPaint?: MapFillPaint;
  /**
   * The fill layer's opacity, 0–1 — shorthand for `fillPaint["fill-opacity"]`
   * (which wins when both are set). Default 1, or 0.25 with a `pattern`, so
   * the stripes read over a tint of the same colour.
   */
  fillOpacity?: number;
  /** Hatch the areas with stripes (see {@link MapGeoJSONPattern}). */
  pattern?: MapGeoJSONPattern;
  /** Glow around the areas' edges (see {@link MapGeoJSONVignette}). */
  vignette?: MapGeoJSONVignette;
  /** Callback when a feature is clicked. */
  onClick?: (e: MapGeoJSONEvent<P>) => void;
  /** Callback fired when the hovered feature changes; `null` when the cursor leaves. */
  onHover?: (e: MapGeoJSONEvent<P> | null) => void;
  /** Whether features respond to mouse events (default: false). */
  interactive?: boolean;
  /**
   * The text of a feature in the keyboard list an `interactive` map renders —
   * one visually-hidden button per feature, so the values a pointer reveals
   * on hover are reachable by Tab and readable by a screen reader (WCAG 2.1.1
   * and 1.3.1). Say what the region is AND what it is worth
   * (`(f) => \`\${f.properties.name}: \${f.properties.value}\`\`). Defaults to the
   * promoted id.
   */
  featureLabel?: (feature: MapGeoJSONFeature<P>, index: number) => string;
  /** Optional MapLibre layer id to insert the layers before (z-order control). */
  beforeId?: string;
};

/**
 * Renders arbitrary GeoJSON as fill + outline layers on the map. Composes like
 * `MapRoute` / `MapArc` — drop it inside `<MapCanvas>` (typically with `blank`)
 * for choropleths and region/data maps. For full control over expressions and
 * multiple layers, manage layers directly via `useMap()` instead.
 */
export function MapGeoJSON<P extends GeoJSON.GeoJsonProperties = GeoJSON.GeoJsonProperties>({
  data,
  id: propId,
  promoteId,
  fillPaint,
  linePaint,
  fillHoverPaint,
  fillOpacity,
  pattern,
  vignette,
  onClick,
  onHover,
  interactive = false,
  featureLabel,
  beforeId,
}: MapGeoJSONProps<P>) {
  const { map, isLoaded } = useMap();
  const autoId = useId();
  const id = propId ?? autoId;
  const sourceId = `geojson-source-${id}`;
  const fillLayerId = `geojson-fill-${id}`;
  const lineLayerId = `geojson-line-${id}`;
  const patternLayerId = `geojson-pattern-${id}`;
  const vignetteLayerId = `geojson-vignette-${id}`;
  const patternImageId = `geojson-pattern-image-${id}`;

  // Theme-driven neutral defaults: landmass = the mid-neutral `--border` rung,
  // separators = the page surface. Both re-resolve on theme change.
  const defaultFill = useTokenColor("--border");
  const defaultLine = useTokenColor("--background");
  const defaultInk = useTokenColor("--foreground");

  const showFill = fillPaint !== false;
  const showLine = linePaint !== false;

  const baseOpacity = fillOpacity ?? (pattern ? 0.25 : undefined);
  const mergedFillPaint = useMemo(
    () =>
      mergeHoverPaint(
        {
          "fill-color": defaultFill,
          ...(baseOpacity !== undefined ? { "fill-opacity": baseOpacity } : {}),
          ...(fillPaint || {}),
        },
        fillHoverPaint,
      ),
    [defaultFill, baseOpacity, fillPaint, fillHoverPaint],
  );
  // The colour stripes and the glow take: the fill's own plain colour, or ink.
  const configuredFill = fillPaint ? fillPaint["fill-color"] : undefined;
  const areaColor =
    configuredFill === undefined
      ? defaultFill
      : typeof configuredFill === "string"
        ? configuredFill
        : defaultInk;
  const stripeWidth = Math.max(1, pattern?.width ?? 2);
  const stripeGap = Math.max(0, pattern?.gap ?? 4);
  const vignetteWidth = Math.max(0, vignette?.width ?? 12);
  const vignetteOpacity = Math.min(1, Math.max(0, vignette?.opacity ?? 0.35));
  const hasPattern = pattern !== undefined;
  const hasVignette = vignette !== undefined;
  // The tile drawn last; a new one is drawn only when colour or size change.
  const patternDrawnRef = useRef<string | null>(null);
  const mergedLinePaint = useMemo(
    () => ({
      "line-color": defaultLine,
      "line-width": 0.5,
      ...(linePaint || {}),
    }),
    [defaultLine, linePaint],
  );
  const latestRef = useRef({ onClick, onHover });
  latestRef.current = { onClick, onHover };
  // c-2: the pointer path owns the hover feature-state inside its effect; the
  // keyboard list below drives the SAME highlight through this handle, so a
  // focused region lights up exactly as a hovered one does.
  const setHoverRef = useRef<((next: string | number | null) => void) | null>(null);

  // Add source on mount.
  useEffect(() => {
    if (!isLoaded || !map) return;

    map.addSource(sourceId, {
      type: "geojson",
      data,
      ...(promoteId ? { promoteId } : {}),
    });

    return () => {
      try {
        if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
        if (map.getLayer(patternLayerId)) map.removeLayer(patternLayerId);
        if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
        if (map.getLayer(vignetteLayerId)) map.removeLayer(vignetteLayerId);
        if (map.hasImage(patternImageId)) map.removeImage(patternImageId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // style may be mid-reload
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- source created once per map; data/layers are synced by the effects below
  }, [isLoaded, map]);

  // Sync data when it changes.
  useEffect(() => {
    if (!isLoaded || !map) return;
    const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource | undefined;
    source?.setData(data as never);
  }, [isLoaded, map, data, sourceId]);

  // Sync layers and paint when visibility or styling changes.
  useEffect(() => {
    if (!isLoaded || !map) return;

    const source = map.getSource(sourceId);
    if (!source) return;

    if (showFill && !map.getLayer(fillLayerId)) {
      map.addLayer(
        {
          id: fillLayerId,
          type: "fill",
          source: sourceId,
          paint: mergedFillPaint,
        },
        beforeId,
      );
    } else if (!showFill && map.getLayer(fillLayerId)) {
      map.removeLayer(fillLayerId);
    }

    if (showLine && !map.getLayer(lineLayerId)) {
      map.addLayer(
        {
          id: lineLayerId,
          type: "line",
          source: sourceId,
          paint: mergedLinePaint,
        },
        beforeId,
      );
    } else if (!showLine && map.getLayer(lineLayerId)) {
      map.removeLayer(lineLayerId);
    }

    if (showFill && map.getLayer(fillLayerId)) {
      for (const [key, value] of Object.entries(mergedFillPaint)) {
        map.setPaintProperty(fillLayerId, key as keyof MapFillPaint, value as never);
      }
    }
    if (showLine && map.getLayer(lineLayerId)) {
      for (const [key, value] of Object.entries(mergedLinePaint)) {
        map.setPaintProperty(lineLayerId, key as keyof MapLinePaint, value as never);
      }
    }

    // Vignette: a blurred line UNDER the fill, so the glow reads outside it.
    const vignettePaint: MapLinePaint = {
      "line-color": areaColor,
      "line-width": vignetteWidth * 2,
      "line-blur": vignetteWidth,
      "line-opacity": vignetteOpacity,
    };
    if (hasVignette && !map.getLayer(vignetteLayerId)) {
      const before = map.getLayer(fillLayerId)
        ? fillLayerId
        : map.getLayer(lineLayerId)
          ? lineLayerId
          : beforeId;
      map.addLayer(
        { id: vignetteLayerId, type: "line", source: sourceId, paint: vignettePaint },
        before,
      );
    } else if (hasVignette) {
      for (const [key, value] of Object.entries(vignettePaint)) {
        map.setPaintProperty(vignetteLayerId, key as keyof MapLinePaint, value as never);
      }
    } else if (map.getLayer(vignetteLayerId)) {
      map.removeLayer(vignetteLayerId);
    }

    // Pattern: a stripe tile drawn in the area colour, on its own fill layer
    // between the fill and the outline. Re-drawn when the colour or size changes.
    if (hasPattern) {
      const drawKey = `${areaColor}|${stripeWidth}|${stripeGap}`;
      if (patternDrawnRef.current !== drawKey || !map.hasImage(patternImageId)) {
        const image = stripeImage(areaColor, stripeWidth, stripeGap);
        if (image) {
          if (map.hasImage(patternImageId)) map.removeImage(patternImageId);
          map.addImage(patternImageId, image.data, { pixelRatio: image.pixelRatio });
          patternDrawnRef.current = drawKey;
        }
      }
      if (map.hasImage(patternImageId)) {
        if (!map.getLayer(patternLayerId)) {
          map.addLayer(
            {
              id: patternLayerId,
              type: "fill",
              source: sourceId,
              paint: { "fill-pattern": patternImageId },
            },
            map.getLayer(lineLayerId) ? lineLayerId : beforeId,
          );
        }
      }
    } else {
      if (map.getLayer(patternLayerId)) map.removeLayer(patternLayerId);
      if (map.hasImage(patternImageId)) map.removeImage(patternImageId);
      patternDrawnRef.current = null;
    }
  }, [
    areaColor,
    hasPattern,
    stripeWidth,
    stripeGap,
    hasVignette,
    vignetteWidth,
    vignetteOpacity,
    patternLayerId,
    vignetteLayerId,
    patternImageId,
    isLoaded,
    map,
    sourceId,
    fillLayerId,
    lineLayerId,
    showFill,
    showLine,
    mergedFillPaint,
    mergedLinePaint,
    beforeId,
  ]);

  // Interaction handlers (bound to the fill layer).
  useEffect(() => {
    if (!isLoaded || !map || !interactive || !showFill) return;

    let hoveredId: string | number | null = null;

    const setHover = (next: string | number | null) => {
      if (next === hoveredId) return;
      const sourceExists = !!map.getSource(sourceId);
      if (hoveredId != null && sourceExists) {
        map.setFeatureState({ source: sourceId, id: hoveredId }, { hover: false });
      }
      hoveredId = next;
      if (next != null && sourceExists) {
        map.setFeatureState({ source: sourceId, id: next }, { hover: true });
      }
    };

    const handleMouseMove = (e: MapLibreGL.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      map.getCanvas().style.cursor = "pointer";

      const featureId = feature.id;
      if (featureId === hoveredId) return;
      setHover(featureId ?? null);
      latestRef.current.onHover?.({
        feature: feature as unknown as MapGeoJSONFeature<P>,
        longitude: e.lngLat.lng,
        latitude: e.lngLat.lat,
        originalEvent: e,
      });
    };

    const handleMouseLeave = () => {
      setHover(null);
      map.getCanvas().style.cursor = "";
      latestRef.current.onHover?.(null);
    };

    const handleClick = (e: MapLibreGL.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      latestRef.current.onClick?.({
        feature: feature as unknown as MapGeoJSONFeature<P>,
        longitude: e.lngLat.lng,
        latitude: e.lngLat.lat,
        originalEvent: e,
      });
    };

    setHoverRef.current = setHover;
    map.on("mousemove", fillLayerId, handleMouseMove);
    map.on("mouseleave", fillLayerId, handleMouseLeave);
    map.on("click", fillLayerId, handleClick);

    return () => {
      map.off("mousemove", fillLayerId, handleMouseMove);
      map.off("mouseleave", fillLayerId, handleMouseLeave);
      map.off("click", fillLayerId, handleClick);
      setHover(null);
      setHoverRef.current = null;
      map.getCanvas().style.cursor = "";
    };
  }, [isLoaded, map, fillLayerId, sourceId, interactive, showFill]);

  // c-2 (WCAG 2.1.1, 1.3.1): the fill layer lives in WebGL, so an interactive
  // choropleth had no DOM at all — its values were reachable by mouse only,
  // with no tab stop, no text alternative and nothing for a screen reader to
  // read. One visually-hidden button per feature gives every region a tab stop
  // whose name IS its value; focusing it lights the region and fires the same
  // `onHover` the pointer does, so a host readout follows the keyboard for
  // free. Hidden, not absent: the map itself is the picture.
  const keyboardFeatures = useMemo(
    () => (interactive && showFill ? listKeyboardFeatures<P>(data, promoteId) : []),
    [interactive, showFill, data, promoteId],
  );

  const reach = (entry: KeyboardFeature<P>) => {
    setHoverRef.current?.(entry.id ?? null);
    latestRef.current.onHover?.({
      feature: entry.feature,
      longitude: entry.longitude,
      latitude: entry.latitude,
      originalEvent: null,
    });
  };

  if (keyboardFeatures.length === 0) {
    return null;
  }

  return (
    <div className="sr-only" data-slot="map-geojson-keyboard-list">
      <ul>
        {keyboardFeatures.map((entry, index) => (
          <li key={entry.key}>
            <button
              onBlur={() => {
                setHoverRef.current?.(null);
                latestRef.current.onHover?.(null);
              }}
              onClick={() =>
                latestRef.current.onClick?.({
                  feature: entry.feature,
                  longitude: entry.longitude,
                  latitude: entry.latitude,
                  originalEvent: null,
                })
              }
              onFocus={() => reach(entry)}
              type="button"
            >
              {featureLabel?.(entry.feature, index) ?? entry.fallbackLabel}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One row of the keyboard list: a feature, where it sits and what it is called. */
interface KeyboardFeature<P extends GeoJSON.GeoJsonProperties> {
  key: string;
  id: string | number | undefined;
  feature: MapGeoJSONFeature<P>;
  longitude: number;
  latitude: number;
  fallbackLabel: string;
}

/** Every coordinate in a geometry, flattened — enough for a bounding box. */
function geometryPositions(geometry: GeoJSON.Geometry): GeoJSON.Position[] {
  if (geometry.type === "GeometryCollection") {
    return geometry.geometries.flatMap(geometryPositions);
  }
  if (geometry.type === "Point") {
    return [geometry.coordinates];
  }
  // Every remaining geometry nests Positions 1–3 arrays deep.
  const flatten = (value: unknown): GeoJSON.Position[] =>
    Array.isArray(value) && typeof value[0] === "number"
      ? [value as GeoJSON.Position]
      : Array.isArray(value)
        ? value.flatMap(flatten)
        : [];
  return flatten(geometry.coordinates);
}

/** The centre of a geometry's bounding box — where a keyboard "hover" lands. */
function geometryCentre(geometry: GeoJSON.Geometry): [number, number] {
  const positions = geometryPositions(geometry);
  if (positions.length === 0) return [0, 0];
  let west = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const [lng, lat] of positions) {
    west = Math.min(west, lng ?? 0);
    east = Math.max(east, lng ?? 0);
    south = Math.min(south, lat ?? 0);
    north = Math.max(north, lat ?? 0);
  }
  return [(west + east) / 2, (south + north) / 2];
}

/**
 * The features a keyboard list can offer. A `data` URL is fetched by MapLibre
 * itself and never reaches React, and a bare Geometry carries no properties to
 * read — both give an empty list rather than a row that says nothing.
 */
function listKeyboardFeatures<P extends GeoJSON.GeoJsonProperties>(
  data: MapGeoJSONData<P>,
  promoteId: string | undefined,
): KeyboardFeature<P>[] {
  if (typeof data === "string") return [];
  const features =
    data.type === "FeatureCollection" ? data.features : data.type === "Feature" ? [data] : [];
  return features.map((feature, index) => {
    const promoted = promoteId ? feature.properties?.[promoteId] : undefined;
    const id =
      typeof promoted === "string" || typeof promoted === "number"
        ? promoted
        : typeof feature.id === "string" || typeof feature.id === "number"
          ? feature.id
          : undefined;
    const [longitude, latitude] = geometryCentre(feature.geometry);
    return {
      key: `${id ?? index}`,
      id,
      feature: feature as unknown as MapGeoJSONFeature<P>,
      longitude,
      latitude,
      fallbackLabel: `${id ?? index + 1}`,
    };
  });
}

/**
 * One seamless tile of 45° stripes, `width` thick with `gap` between them
 * (both measured across the stripes), in `color` — any CSS colour, so a
 * resolved token works as-is. `null` where no 2D canvas exists (tests, SSR).
 */
function stripeImage(
  color: string,
  width: number,
  gap: number,
): { data: ImageData; pixelRatio: number } | null {
  if (typeof document === "undefined") return null;
  const pixelRatio = Math.max(1, Math.round(globalThis.devicePixelRatio || 1));
  // A 45° stripe period of (width + gap) across the stripes is √2 × that along x.
  const size = Math.max(2, Math.round((width + gap) * Math.SQRT2 * pixelRatio));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  let context: CanvasRenderingContext2D | null = null;
  try {
    context = canvas.getContext("2d");
  } catch {
    context = null;
  }
  if (!context) return null;
  context.strokeStyle = color;
  context.lineWidth = width * pixelRatio;
  context.lineCap = "square";
  context.beginPath();
  // x + y = k·size for k = 0, 1, 2 covers the tile, corners included.
  for (const k of [0, 1, 2]) {
    context.moveTo(k * size - size, size);
    context.lineTo(k * size, 0);
  }
  context.stroke();
  return { data: context.getImageData(0, 0, size, size), pixelRatio };
}
